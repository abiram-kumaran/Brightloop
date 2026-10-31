import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../../app.js";
import { FastifyInstance } from "fastify";
import { runMigrations } from "../../db/migrate.js";
import { seedDemoData } from "../../db/seed.js";

describe("Auth Module Integration", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    await runMigrations();
    await seedDemoData();
    app = buildApp();
    await app.ready();
  }, 60000);

  it("rejects registration with a weak password", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        fullName: "Test User",
        email: "weakpass@example.com",
        password: "password123",
      },
    });

    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("VALIDATION_FAILED");
    expect(body.error.fields.password).toBeDefined();
  });

  it("registers a valid customer and sets httpOnly cookies", async () => {
    const randomEmail = `test_${Date.now()}@example.com`;
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        fullName: "John Doe",
        email: randomEmail,
        password: "ValidPassword@2026!",
        companyName: "John's Cloud Tech",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.user.email).toBe(randomEmail);
    expect(body.data.user.role).toBe("customer");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("rejects duplicate email registration with 409 Conflict", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/register",
      payload: {
        fullName: "Alice Repeat",
        email: "alice@customer.com",
        password: "ValidPassword@2026!",
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("CONFLICT");
  });

  it("blocks customer accounts from accessing company workspace", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login?isCompany=true",
      payload: {
        email: "alice@customer.com",
        password: "Customer@12345",
      },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toContain("company workspace");
  });

  it("allows admin to log in to company workspace and returns admin redirect", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login?isCompany=true",
      payload: {
        email: "admin@brightloop.com",
        password: "Admin@12345",
      },
    });

    if (res.statusCode !== 200) {
      console.error("ADMIN LOGIN ERROR:", res.body);
    }
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.user.role).toBe("admin");
    expect(body.data.redirectTo).toBe("/admin");
  });
});

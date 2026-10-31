import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../../app.js";
import { FastifyInstance } from "fastify";
import { runMigrations } from "../../db/migrate.js";
import { seedDemoData } from "../../db/seed.js";

describe("Catalog & Rules Integration", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  const runId = Date.now();

  beforeAll(async () => {
    await runMigrations();
    await seedDemoData();
    app = buildApp();
    await app.ready();

    // Authenticate admin to get session cookie
    const loginRes = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "admin@brightloop.com",
        password: "Admin@12345",
        isCompanyLogin: true,
      },
    });
    const cookies = loginRes.cookies;
    const tokenCookie = cookies.find((c) => c.name === "access_token")?.value;
    adminCookie = `access_token=${tokenCookie}`;
  }, 60000);

  it("lists existing seeded products", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/products",
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it("creates a new product with an Odoo variant adding 560", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/products",
      headers: {
        cookie: adminCookie,
      },
      payload: {
        name: `Enterprise ERP Cloud ${runId}`,
        type: "software",
        salesPrice: 2000,
        costPrice: 800,
        notes: "Enterprise grade subscription software",
        variants: [
          {
            name: "Odoo Connector Variant",
            attribute: "Integration",
            value: "Odoo ERP",
            priceAdjustment: 560, // Exactly the problem statement specification
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe(`Enterprise ERP Cloud ${runId}`);
    expect(body.data.salesPrice).toBe(200000); // 2000 in paise
    expect(body.data.variants.length).toBe(1);
    expect(body.data.variants[0].value).toBe("Odoo ERP");
    expect(body.data.variants[0].priceAdjustment).toBe(56000); // 560 in paise
  });

  it("creates a subscription plan with availability dates and lifecycle flags", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/plans",
      headers: {
        cookie: adminCookie,
      },
      payload: {
        name: `Quarterly Growth Plan ${runId}`,
        description: "Billed monthly with quarterly review",
        billingFrequency: "monthly",
        billingIntervalInteger: 1,
        minQuantity: 1,
        autoClose: false,
        allowEarlyClose: true,
        allowPause: true,
        allowRenewal: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body);
    expect(body.data.name).toBe(`Quarterly Growth Plan ${runId}`);
    expect(body.data.billing_period).toBe("monthly");
    expect(body.data.pausable).toBe(true);
  });

  it("creates a tax rule and discount rule", async () => {
    // Tax Rule
    const taxRes = await app.inject({
      method: "POST",
      url: "/api/v1/taxes",
      headers: { cookie: adminCookie },
      payload: {
        name: `Tax Rule ${runId}`,
        ratePercent: 12,
        isActive: true,
      },
    });
    expect(taxRes.statusCode).toBe(201);
    const taxBody = JSON.parse(taxRes.body);
    expect(taxBody.data.name).toBe(`Tax Rule ${runId}`);

    // Discount Rule
    const discRes = await app.inject({
      method: "POST",
      url: "/api/v1/discounts",
      headers: { cookie: adminCookie },
      payload: {
        code: `DISC_${runId}`.slice(0, 20),
        name: "Festive Season Discount",
        type: "percentage",
        value: 10,
        discountScope: "product",
      },
    });
    expect(discRes.statusCode).toBe(201);
    const discBody = JSON.parse(discRes.body);
    expect(discBody.data.discountScope).toBe("product");
  });
});

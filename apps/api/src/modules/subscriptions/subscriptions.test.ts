import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../../app.js";
import { FastifyInstance } from "fastify";
import { runMigrations } from "../../db/migrate.js";
import { seedDemoData } from "../../db/seed.js";

describe("Subscription & Quotation Lifecycle State Machine", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let customerCookie: string;
  let productId: number;
  let variantId: number;
  let planId: number;
  let customerId: number;

  beforeAll(async () => {
    await runMigrations();
    await seedDemoData();
    app = buildApp();
    await app.ready();

    // Authenticate Admin
    const adminLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "admin@brightloop.com",
        password: "Admin@12345",
        isCompanyLogin: true,
      },
    });
    adminCookie = `access_token=${adminLogin.cookies.find((c) => c.name === "access_token")?.value}`;

    // Authenticate Customer (Alice)
    const custLogin = await app.inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {
        email: "alice@customer.com",
        password: "Customer@12345",
        isCompanyLogin: false,
      },
    });
    customerCookie = `access_token=${custLogin.cookies.find((c) => c.name === "access_token")?.value}`;

    // Get seeded catalog data
    const prods = await app.inject({ method: "GET", url: "/api/v1/products" });
    const prodList = JSON.parse(prods.body).data;
    productId = prodList[0].id;
    variantId = prodList[0].variants?.[0]?.id;

    const plans = await app.inject({ method: "GET", url: "/api/v1/plans" });
    planId = JSON.parse(plans.body).data[0].id;

    const custs = await app.inject({
      method: "GET",
      url: "/api/v1/customers",
      headers: { cookie: adminCookie },
    });
    customerId = JSON.parse(custs.body).data[0].id;
  }, 60000);

  it("completes full 7-stage lifecycle: Draft -> Quotation -> Confirmed -> Active -> Paused -> Resumed -> Closed", async () => {
    // 1. Create Draft Quotation
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscriptions",
      headers: { cookie: adminCookie },
      payload: {
        customerId,
        planId,
        startDate: "2026-11-01",
        quoteValidUntil: "2026-11-30",
        anchorDay: 1,
        lines: [
          {
            productId,
            variantId: variantId || null,
            quantity: 2,
            unitPrice: 1560, // 1560 INR
          },
        ],
      },
    });

    expect(createRes.statusCode).toBe(201);
    const sub = JSON.parse(createRes.body).data;
    const subId = sub.id;
    expect(sub.status).toBe("draft");
    expect(sub.number).toMatch(/^SUB-\d+/);

    // 2. Reject Illegal Direct Activation (Must be Confirmed first)
    const illegalRes = await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "activate" },
    });
    expect(illegalRes.statusCode).toBe(409); // State machine guard blocked direct activation

    // 3. Transition: Send Quotation (Draft -> Quotation)
    const quoteRes = await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "send_quotation" },
    });
    expect(quoteRes.statusCode).toBe(200);
    expect(JSON.parse(quoteRes.body).data.status).toBe("quotation");

    // 4. Transition: Confirm (Quotation -> Confirmed)
    const confirmRes = await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "confirm" },
    });
    expect(confirmRes.statusCode).toBe(200);
    expect(JSON.parse(confirmRes.body).data.status).toBe("confirmed");

    // 5. Transition: Activate (Confirmed -> Active)
    const activeRes = await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "activate" },
    });
    expect(activeRes.statusCode).toBe(200);
    expect(JSON.parse(activeRes.body).data.status).toBe("active");

    // 6. Transition: Pause (Active -> Paused)
    const pauseRes = await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "pause" },
    });
    expect(pauseRes.statusCode).toBe(200);
    expect(JSON.parse(pauseRes.body).data.status).toBe("paused");

    // 7. Transition: Resume (Paused -> Active)
    const resumeRes = await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "resume" },
    });
    expect(resumeRes.statusCode).toBe(200);
    expect(JSON.parse(resumeRes.body).data.status).toBe("active");

    // 8. Transition: Close (Active -> Closed)
    const closeRes = await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "close", closeReason: "Customer requested upgrade to annual" },
    });
    expect(closeRes.statusCode).toBe(200);
    const closedSub = JSON.parse(closeRes.body).data;
    expect(closedSub.status).toBe("closed");
    expect(closedSub.closed_at).toBeDefined();

    // 9. Verify Audit Trail and Timeline Events
    const detailRes = await app.inject({
      method: "GET",
      url: `/api/v1/subscriptions/${subId}`,
      headers: { cookie: adminCookie },
    });
    expect(detailRes.statusCode).toBe(200);
    const detail = JSON.parse(detailRes.body).data;
    expect(detail.events.length).toBeGreaterThanOrEqual(6);
  });

  it("enforces customer isolation: customer only sees their own subscriptions", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v1/subscriptions",
      headers: { cookie: customerCookie },
    });
    expect(res.statusCode).toBe(200);
    const list = JSON.parse(res.body).data;
    for (const item of list) {
      expect(item.customerId).toBe(customerId);
    }
  });
});

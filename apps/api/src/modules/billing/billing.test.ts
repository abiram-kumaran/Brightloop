import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../../app.js";
import { FastifyInstance } from "fastify";
import { runMigrations } from "../../db/migrate.js";
import { seedDemoData } from "../../db/seed.js";

describe("Billing Engine & Payments Core", () => {
  let app: FastifyInstance;
  let adminCookie: string;
  let customerCookie: string;
  let subId: number;

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

    // Create and activate a subscription for customer 1
    const createRes = await app.inject({
      method: "POST",
      url: "/api/v1/subscriptions",
      headers: { cookie: adminCookie },
      payload: {
        customerId: 1,
        planId: 1,
        startDate: "2026-11-01",
        anchorDay: 1,
        lines: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 1000, // 1000 INR
          },
        ],
      },
    });
    subId = JSON.parse(createRes.body).data.id;

    // Transition Draft -> Quotation -> Confirmed -> Active
    await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "send_quotation" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "confirm" },
    });
    await app.inject({
      method: "POST",
      url: `/api/v1/subscriptions/${subId}/transition`,
      headers: { cookie: adminCookie },
      payload: { action: "activate" },
    });
  }, 60000);

  it("executes recurring billing run and generates confirmed invoice", async () => {
    const runRes = await app.inject({
      method: "POST",
      url: "/api/v1/billing/run",
      headers: { cookie: adminCookie },
      payload: {
        asOfDate: "2026-11-05",
      },
    });

    expect(runRes.statusCode).toBe(200);
    const result = JSON.parse(runRes.body).data;
    expect(result.invoicesGenerated).toBeGreaterThanOrEqual(1);
    expect(result.invoices[0].invoiceNumber).toMatch(/^INV-2026-\d+/);
  });

  it("proves idempotency: re-running billing run on same date generates 0 duplicate invoices", async () => {
    const rerunRes = await app.inject({
      method: "POST",
      url: "/api/v1/billing/run",
      headers: { cookie: adminCookie },
      payload: {
        asOfDate: "2026-11-05",
      },
    });

    expect(rerunRes.statusCode).toBe(200);
    const result = JSON.parse(rerunRes.body).data;
    // Exactly 0 new invoices generated for already billed subscriptions!
    expect(result.invoicesGenerated).toBe(0);
  });

  it("records payment against invoice and verifies settlement to paid status", async () => {
    // 1. Get the generated invoice
    const invRes = await app.inject({
      method: "GET",
      url: `/api/v1/invoices?subscriptionId=${subId}`,
      headers: { cookie: adminCookie },
    });
    const invList = JSON.parse(invRes.body).data;
    expect(invList.length).toBeGreaterThan(0);
    const invoice = invList[0];
    const totalRupees = invoice.totalPaise / 100;

    // 2. Record partial payment (half of the total)
    const halfRupees = totalRupees / 2;
    const partialRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments",
      headers: { cookie: adminCookie },
      payload: {
        invoiceId: invoice.id,
        amount: halfRupees,
        method: "bank_transfer",
        reference: "NEFT-2026-11001",
        note: "Partial advance settlement",
      },
    });

    expect(partialRes.statusCode).toBe(201);
    const partialData = JSON.parse(partialRes.body).data;
    expect(partialData.isFullyPaid).toBe(false);
    expect(partialData.amountDuePaise).toBe(invoice.totalPaise - halfRupees * 100);

    // 3. Record remaining payment
    const finalRes = await app.inject({
      method: "POST",
      url: "/api/v1/payments",
      headers: { cookie: adminCookie },
      payload: {
        invoiceId: invoice.id,
        amount: halfRupees,
        method: "upi",
        reference: "UPI/2026/88921",
        note: "Final settlement",
      },
    });

    expect(finalRes.statusCode).toBe(201);
    const finalData = JSON.parse(finalRes.body).data;
    expect(finalData.isFullyPaid).toBe(true);
    expect(finalData.amountDuePaise).toBe(0);

    // 4. Verify Invoice is now in 'paid' status
    const verifiedInvRes = await app.inject({
      method: "GET",
      url: `/api/v1/invoices/${invoice.id}`,
      headers: { cookie: adminCookie },
    });
    const verifiedInv = JSON.parse(verifiedInvRes.body).data;
    expect(verifiedInv.status).toBe("paid");
    expect(verifiedInv.amountDuePaise).toBe(0);
    expect(verifiedInv.payments.length).toBe(2);
  });
});

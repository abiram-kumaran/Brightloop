import bcrypt from "bcryptjs";
import { getDb } from "./pool.js";

export async function seedDemoData(): Promise<void> {
  const db = await getDb();
  console.log(`[seed] Seeding demo data using ${db.mode.toUpperCase()} engine...`);

  // ─── ROLES ───────────────────────────────────────────────────────────────────
  const rolesRes = await db.query<{ id: number; name: string }>("SELECT id, name FROM roles");
  const roleMap: Record<string, number> = {};
  for (const r of rolesRes.rows) roleMap[r.name] = r.id;

  // ─── USERS ───────────────────────────────────────────────────────────────────
  console.log("[seed] Seeding users...");
  const adminHash    = await bcrypt.hash("Admin@12345",    10);
  const managerHash  = await bcrypt.hash("Manager@12345",  10);
  const staffHash    = await bcrypt.hash("Staff@12345",    10);
  const custHash     = await bcrypt.hash("Customer@12345", 10);

  const adminRes = await db.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, full_name, role_id)
     VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO UPDATE SET password_hash=$2 RETURNING id`,
    ["admin@brightloop.com", adminHash, "Arthur Pendelton", roleMap["admin"]]
  );
  const adminId = adminRes.rows[0].id;

  await db.query(
    `INSERT INTO users (email, password_hash, full_name, role_id, created_by)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET password_hash=$2`,
    ["manager@brightloop.com", managerHash, "Margaret Vance", roleMap["manager"], adminId]
  );
  await db.query(
    `INSERT INTO users (email, password_hash, full_name, role_id, created_by)
     VALUES ($1,$2,$3,$4,$5) ON CONFLICT (email) DO UPDATE SET password_hash=$2`,
    ["staff@brightloop.com", staffHash, "Bob Harrison", roleMap["staff"], adminId]
  );

  const customerDefs = [
    { email: "alice@acme.com",     name: "Alice Chen",   company: "Acme Innovations Pvt Ltd", gstin: "33AAAAA0000A1Z5", state: "33", phone: "+91 98765 43210", addr: "123 Residency Road, Chennai, TN 600001" },
    { email: "raj@techstart.com",  name: "Raj Kumar",    company: "TechStart Solutions",       gstin: "29BBBBB0000B1Z5", state: "29", phone: "+91 87654 32109", addr: "456 MG Road, Bangalore, KA 560001" },
    { email: "priya@globalco.com", name: "Priya Sharma", company: "Global Commerce Ltd",       gstin: "07CCCCC0000C1Z5", state: "07", phone: "+91 76543 21098", addr: "789 Connaught Place, New Delhi 110001" },
    { email: "samuel@buildco.com", name: "Samuel David", company: "BuildCo Industries",        gstin: "33DDDDD0000D1Z5", state: "33", phone: "+91 65432 10987", addr: "321 Anna Salai, Chennai, TN 600002" },
    { email: "meera@startup.com",  name: "Meera Nair",   company: "Startup Hub",               gstin: null,              state: "32", phone: "+91 54321 09876", addr: "654 Marine Drive, Kochi, KL 682001" },
  ];

  const custUserIds: number[] = [];
  for (const c of customerDefs) {
    const res = await db.query<{ id: number }>(
      `INSERT INTO users (email, password_hash, full_name, role_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT (email) DO UPDATE SET password_hash=$2 RETURNING id`,
      [c.email, custHash, c.name, roleMap["customer"]]
    );
    custUserIds.push(res.rows[0].id);
  }

  // ─── CUSTOMERS ───────────────────────────────────────────────────────────────
  console.log("[seed] Seeding customers...");
  const custIds: number[] = [];
  for (let i = 0; i < customerDefs.length; i++) {
    const c = customerDefs[i];
    const res = await db.query<{ id: number }>(
      `INSERT INTO customers (user_id, company_name, contact_name, contact_email, phone, gstin, state_code, billing_address)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (user_id) DO UPDATE SET company_name=$2 RETURNING id`,
      [custUserIds[i], c.company, c.name, c.email, c.phone, c.gstin, c.state, c.addr]
    );
    custIds.push(res.rows[0].id);
  }

  // ─── TAX RULES ───────────────────────────────────────────────────────────────
  console.log("[seed] Seeding tax rules...");
  const taxEntries = [
    { name: "GST 0%",  rate: 0  },
    { name: "GST 5%",  rate: 5  },
    { name: "GST 12%", rate: 12 },
    { name: "GST 18%", rate: 18 },
    { name: "GST 28%", rate: 28 },
  ];
  const taxMap: Record<string, number> = {};
  for (const t of taxEntries) {
    const res = await db.query<{ id: number }>(
      `INSERT INTO tax_rules (name, rate_percent) VALUES ($1,$2)
       ON CONFLICT (name) DO UPDATE SET rate_percent=$2 RETURNING id`,
      [t.name, t.rate]
    );
    taxMap[t.name] = res.rows[0].id;
  }
  const gst18 = taxMap["GST 18%"];
  const gst12 = taxMap["GST 12%"];

  // ─── PRODUCTS & VARIANTS ─────────────────────────────────────────────────────
  console.log("[seed] Seeding products...");

  async function getOrCreateProduct(name: string, type: string, salesPaise: number, costPaise: number, notes: string): Promise<number> {
    const ex = await db.query<{ id: number }>("SELECT id FROM products WHERE lower(name)=lower($1) AND deleted_at IS NULL", [name]);
    if (ex.rows.length) return ex.rows[0].id;
    const res = await db.query<{ id: number }>(
      "INSERT INTO products (name,type,sales_price_paise,cost_price_paise,notes) VALUES ($1,$2,$3,$4,$5) RETURNING id",
      [name, type, salesPaise, costPaise, notes]
    );
    return res.rows[0].id;
  }

  const pCrm      = await getOrCreateProduct("Brightloop CRM",       "software", 100000,  40000, "Core CRM: pipeline, contacts, deals");
  const pAnalytics= await getOrCreateProduct("Brightloop Analytics", "software", 250000,  90000, "Advanced analytics and BI reporting");
  const pSeat     = await getOrCreateProduct("Extra Seat",           "service",   30000,  10000, "Additional user licence seat");
  const pSupport  = await getOrCreateProduct("Priority Support",     "service",  120000,  50000, "Dedicated 24/7 priority SLA support");
  const pOnboard  = await getOrCreateProduct("Onboarding Pack",      "service",  500000, 200000, "Full onboarding + training (one-time)");

  // Tax links
  for (const pid of [pCrm, pAnalytics, pSupport, pOnboard]) {
    await db.query("INSERT INTO product_taxes (product_id,tax_rule_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [pid, gst18]);
  }
  await db.query("INSERT INTO product_taxes (product_id,tax_rule_id) VALUES ($1,$2) ON CONFLICT DO NOTHING", [pSeat, gst12]);

  // Variants
  async function getOrCreateVariant(productId: number, attr: string, val: string, extraPaise: number): Promise<number> {
    const ex = await db.query<{ id: number }>(
      "SELECT id FROM product_variants WHERE product_id=$1 AND attribute=$2 AND value=$3", [productId, attr, val]
    );
    if (ex.rows.length) return ex.rows[0].id;
    const res = await db.query<{ id: number }>(
      "INSERT INTO product_variants (product_id,attribute,value,extra_price_paise) VALUES ($1,$2,$3,$4) RETURNING id",
      [productId, attr, val, extraPaise]
    );
    return res.rows[0].id;
  }

  const vOdoo     = await getOrCreateVariant(pCrm,       "Brand", "Odoo",     56000);
  const vStandard = await getOrCreateVariant(pCrm,       "Brand", "Standard", 0);
  const vProTier  = await getOrCreateVariant(pAnalytics, "Tier",  "Pro",      80000);
  await getOrCreateVariant(pAnalytics, "Tier", "Basic", 0);

  // ─── PLANS ───────────────────────────────────────────────────────────────────
  console.log("[seed] Seeding plans...");

  async function getOrCreatePlan(
    name: string, period: string, interval: number, minQty: number,
    from: string, to: string | null,
    autoClose: boolean, closable: boolean, pausable: boolean, renewable: boolean
  ): Promise<number> {
    const ex = await db.query<{ id: number }>("SELECT id FROM plans WHERE lower(name)=lower($1) AND deleted_at IS NULL", [name]);
    if (ex.rows.length) return ex.rows[0].id;
    const res = await db.query<{ id: number }>(
      `INSERT INTO plans (name,price_paise,billing_period,billing_interval,min_quantity,
        available_from,available_to,auto_close,closable,pausable,renewable)
       VALUES ($1,0,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [name, period, interval, minQty, from, to, autoClose, closable, pausable, renewable]
    );
    return res.rows[0].id;
  }

  const planStarter  = await getOrCreatePlan("Starter Monthly",  "monthly", 1, 1, "2026-01-01", null,         false, true,  true,  true);
  const planBusiness = await getOrCreatePlan("Business Yearly",  "yearly",  1, 5, "2026-01-01", null,         true,  true,  false, true);
  const planWeekly   = await getOrCreatePlan("Weekly Pilot",     "weekly",  1, 1, "2026-01-01", "2027-12-31", false, true,  false, false);
  const planDaily    = await getOrCreatePlan("Daily Sandbox",    "daily",   1, 1, "2026-01-01", "2027-06-30", true,  false, false, false);

  const planProducts: [number, number][] = [
    [planStarter,  pCrm],     [planStarter,  pSeat],
    [planBusiness, pCrm],     [planBusiness, pAnalytics], [planBusiness, pSupport],
    [planWeekly,   pCrm],
    [planDaily,    pCrm],
  ];
  for (const [planId, productId] of planProducts) {
    await db.query(
      "INSERT INTO plan_products (plan_id,product_id,default_quantity) VALUES ($1,$2,1) ON CONFLICT DO NOTHING",
      [planId, productId]
    );
  }

  // ─── QUOTATION TEMPLATES ─────────────────────────────────────────────────────
  console.log("[seed] Seeding quotation templates...");

  async function getOrCreateTemplate(name: string, planId: number, validity: number): Promise<number> {
    const ex = await db.query<{ id: number }>("SELECT id FROM quotation_templates WHERE lower(name)=lower($1) AND deleted_at IS NULL", [name]);
    if (ex.rows.length) return ex.rows[0].id;
    const res = await db.query<{ id: number }>(
      "INSERT INTO quotation_templates (name,plan_id,validity_days) VALUES ($1,$2,$3) RETURNING id",
      [name, planId, validity]
    );
    return res.rows[0].id;
  }

  const tmplCrm  = await getOrCreateTemplate("CRM Starter",    planStarter,  15);
  const tmplBiz  = await getOrCreateTemplate("Business Suite", planBusiness, 30);
  const tmplPilot= await getOrCreateTemplate("Pilot Pack",     planWeekly,    7);

  // Template lines — schema uses template_id column
  async function upsertTemplateLine(tmplId: number, productId: number, variantId: number | null, qty: number) {
    await db.query(
      `INSERT INTO quotation_template_lines (template_id,product_id,variant_id,quantity)
       VALUES ($1,$2,$3,$4) ON CONFLICT (template_id,product_id,variant_id) DO NOTHING`,
      [tmplId, productId, variantId, qty]
    );
  }
  await upsertTemplateLine(tmplCrm,   pCrm,       vOdoo,    1);
  await upsertTemplateLine(tmplCrm,   pSeat,      null,     2);
  await upsertTemplateLine(tmplBiz,   pCrm,       vOdoo,    5);
  await upsertTemplateLine(tmplBiz,   pAnalytics, vProTier, 1);
  await upsertTemplateLine(tmplBiz,   pSupport,   null,     1);
  await upsertTemplateLine(tmplPilot, pCrm,       vStandard,1);

  // ─── DISCOUNTS ───────────────────────────────────────────────────────────────
  console.log("[seed] Seeding discounts...");

  async function upsertDiscount(
    name: string, type: string, value: number, scope: string,
    minPurchasePaise: number, minQty: number,
    start: string, end: string, limit: number | null
  ) {
    const ex = await db.query<{ id: number }>("SELECT id FROM discounts WHERE lower(name)=lower($1) AND deleted_at IS NULL", [name]);
    if (ex.rows.length) return;
    await db.query(
      `INSERT INTO discounts (name,type,value,scope,min_purchase_paise,min_quantity,
        start_date,end_date,usage_limit,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [name, type, value, scope, minPurchasePaise, minQty, start, end, limit, adminId]
    );
  }
  await upsertDiscount("Seats 10% Off",    "percentage", 10,  "product",      0,      5, "2026-01-01", "2027-06-30", null);
  await upsertDiscount("Welcome ₹500 Off", "fixed",      500, "subscription", 200000, 1, "2026-01-01", "2027-12-31", 1);
  await upsertDiscount("Summer 2025",      "percentage", 15,  "subscription", 0,      1, "2025-06-01", "2025-08-31", 50);

  // ─── PAYMENT TERMS ───────────────────────────────────────────────────────────
  const ptRes = await db.query<{ id: number }>("SELECT id FROM payment_terms LIMIT 1");
  const payTermId = ptRes.rows[0]?.id || 1;

  // ─── DATE HELPERS ────────────────────────────────────────────────────────────
  const today       = new Date();
  const todayStr    = today.toISOString().slice(0, 10);
  const d = (offsetDays: number) => {
    const dt = new Date(today.getTime() + offsetDays * 86400000);
    return dt.toISOString().slice(0, 10);
  };

  // ─── SUBSCRIPTIONS ───────────────────────────────────────────────────────────
  console.log("[seed] Seeding subscriptions...");

  async function createSub(
    custId: number, planId: number, status: string,
    startDate: string, anchorDay: number, nextInvoiceDate: string | null
  ): Promise<number> {
    const closedAt = status === "closed" ? new Date().toISOString() : null;
    const res = await db.query<{ id: number }>(
      `INSERT INTO subscriptions
         (customer_id,plan_id,payment_term_id,status,start_date,anchor_day,next_invoice_date,closed_at,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [custId, planId, payTermId, status, startDate, anchorDay, nextInvoiceDate, closedAt, adminId]
    );
    const subId = res.rows[0].id;

    if (status === "closed") {
      await db.query("UPDATE subscriptions SET closed_at=now(), close_reason='Contract ended' WHERE id=$1", [subId]);
    }
    if (status === "paused") {
      await db.query("UPDATE subscriptions SET paused_at=now() WHERE id=$1", [subId]);
    }

    // Audit events
    await db.query(
      `INSERT INTO subscription_events (subscription_id,event_type,mrr_before_paise,mrr_after_paise,actor_id,meta)
       VALUES ($1,'created',0,0,$2,'{}')`, [subId, adminId]
    );
    if (["active","confirmed","paused","closed"].includes(status)) {
      await db.query(
        `INSERT INTO subscription_events (subscription_id,event_type,mrr_before_paise,mrr_after_paise,actor_id,meta)
         VALUES ($1,'activated',0,0,$2,'{}')`, [subId, adminId]
      );
    }
    if (status === "paused") {
      await db.query(
        `INSERT INTO subscription_events (subscription_id,event_type,mrr_before_paise,mrr_after_paise,actor_id,meta)
         VALUES ($1,'paused',0,0,$2,'{"reason":"Customer requested pause"}')`, [subId, adminId]
      );
    }
    if (status === "closed") {
      await db.query(
        `INSERT INTO subscription_events (subscription_id,event_type,mrr_before_paise,mrr_after_paise,actor_id,meta)
         VALUES ($1,'closed',0,0,$2,'{"reason":"Contract ended"}')`, [subId, adminId]
      );
    }
    return subId;
  }

  async function addLine(subId: number, productId: number, variantId: number | null, qty: number, unitPricePaise: number, taxRuleId: number) {
    await db.query(
      `INSERT INTO subscription_lines (subscription_id,product_id,variant_id,quantity,unit_price_paise,tax_rule_id)
       VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [subId, productId, variantId, qty, unitPricePaise, taxRuleId]
    );
  }

  const anchorDay = today.getDate();

  // 1. Draft
  const sub1 = await createSub(custIds[0], planStarter,  "draft",     todayStr,   anchorDay, null);
  await addLine(sub1, pCrm,  vOdoo,     1, 156000, gst18);

  // 2. Quotation
  const sub2 = await createSub(custIds[1], planBusiness, "quotation",  d(-20),    15,        null);
  await addLine(sub2, pCrm,  vOdoo,     5, 156000, gst18);
  await addLine(sub2, pAnalytics, vProTier, 1, 330000, gst18);

  // 3. Confirmed
  const sub3 = await createSub(custIds[2], planStarter,  "confirmed",  d(-15),    10,        null);
  await addLine(sub3, pCrm,  vStandard, 1, 100000, gst18);
  await addLine(sub3, pSeat, null,       3, 30000,  gst12);

  // 4. Active — DUE TODAY (billing will generate invoice)
  const sub4 = await createSub(custIds[0], planStarter,  "active",     d(-60),    anchorDay, todayStr);
  await addLine(sub4, pCrm,  vOdoo,     1, 156000, gst18);
  await addLine(sub4, pSeat, null,       2, 30000,  gst12);

  // 5. Active — DUE TODAY (weekly)
  const sub5 = await createSub(custIds[1], planWeekly,   "active",     d(-60),    anchorDay, todayStr);
  await addLine(sub5, pCrm,  vStandard, 1, 100000, gst18);

  // 6. Active — future due date (large account)
  const sub6 = await createSub(custIds[3], planBusiness, "active",     d(-30),    15,        d(335));
  await addLine(sub6, pCrm,  vOdoo,    10, 156000, gst18);
  await addLine(sub6, pAnalytics, vProTier, 2, 330000, gst18);
  await addLine(sub6, pSupport, null,   1, 120000, gst18);

  // 7. Paused
  const sub7 = await createSub(custIds[4], planStarter,  "paused",     d(-45),    20,        null);
  await addLine(sub7, pCrm,  vStandard, 1, 100000, gst18);

  // 8. Closed
  const sub8 = await createSub(custIds[2], planDaily,    "closed",     d(-60),     1,        null);
  await addLine(sub8, pCrm,  vStandard, 1, 100000, gst18);

  // ─── INVOICES ────────────────────────────────────────────────────────────────
  console.log("[seed] Seeding invoices...");

  const yearStr    = todayStr.slice(0, 4);
  const seriesName = `INV-${yearStr}`;
  await db.query(
    "INSERT INTO invoice_sequences (series,last_number) VALUES ($1,0) ON CONFLICT DO NOTHING",
    [seriesName]
  );
  async function allocNum(): Promise<string> {
    const res = await db.query<{ last_number: number }>(
      "UPDATE invoice_sequences SET last_number=last_number+1 WHERE series=$1 RETURNING last_number",
      [seriesName]
    );
    return `${seriesName}-${String(res.rows[0].last_number).padStart(5, "0")}`;
  }

  // Invoice helper
  async function createInvoice(
    invoiceNumber: string | null, subId: number, custId: number,
    status: string, periodStart: string, periodEnd: string,
    issueDate: string, dueDate: string,
    supplierState: string, custState: string, isInterstate: boolean,
    subtotal: number, discountTotal: number, taxTotal: number, total: number, amountPaid: number
  ): Promise<number> {
    const confirmedAt = ["confirmed","paid"].includes(status) ? `now() - interval '${Math.floor(Math.random() * 20 + 5)} days'` : "NULL";
    const paidAt      = status === "paid" ? `now() - interval '${Math.floor(Math.random() * 10 + 1)} days'` : "NULL";
    const numVal      = invoiceNumber ? `'${invoiceNumber}'` : "NULL";

    const res = await db.query<{ id: number }>(
      `INSERT INTO invoices
         (number,subscription_id,customer_id,status,period_start,period_end,
          issue_date,due_date,supplier_state,place_of_supply,is_interstate,
          subtotal_paise,discount_total_paise,tax_total_paise,total_paise,
          amount_paid_paise,confirmed_at,paid_at)
       VALUES
         (${numVal},$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,
          ${confirmedAt},${paidAt})
       RETURNING id`,
      [subId, custId, status, periodStart, periodEnd, issueDate, dueDate,
       supplierState, custState, isInterstate, subtotal, discountTotal, taxTotal, total, amountPaid]
    );
    return res.rows[0].id;
  }

  async function addInvoiceLine(
    invId: number, productId: number, variantId: number | null,
    desc: string, qty: number, unitPricePaise: number,
    subtotalPaise: number, taxRuleId: number, taxRate: number, taxPaise: number,
    totalPaise: number, cgst: number, sgst: number, igst: number, isInterstate: boolean
  ) {
    await db.query(
      `INSERT INTO invoice_lines
         (invoice_id,product_id,variant_id,description,quantity,unit_price_paise,
          line_subtotal_paise,discount_paise,taxable_paise,tax_rule_id,
          tax_rate_percent,tax_paise,line_total_paise,breakdown)
       VALUES ($1,$2,$3,$4,$5,$6,$7,0,$7,$8,$9,$10,$11,$12)`,
      [invId, productId, variantId, desc, qty, unitPricePaise, subtotalPaise,
       taxRuleId, taxRate, taxPaise, totalPaise,
       JSON.stringify({ cgstPaise: cgst, sgstPaise: sgst, igstPaise: igst, isInterstate })]
    );
  }

  async function addPayment(invId: number, amountPaise: number, method: string, paidOn: string, ref: string, note: string) {
    await db.query(
      `INSERT INTO payments (invoice_id,amount_paise,method,paid_on,reference,note,status,recorded_by)
       VALUES ($1,$2,$3,$4,$5,$6,'posted',$7)`,
      [invId, amountPaise, method, paidOn, ref, note, adminId]
    );
  }

  // --- Invoice A: PAID — Acme/sub4 (previous period)
  const numA  = await allocNum();
  const invA  = await createInvoice(numA, sub4, custIds[0], "paid",
    d(-60), d(-31), d(-60), d(-45), "33","33",false,
    216000, 0, 38880, 254880, 254880);
  await addInvoiceLine(invA, pCrm,  vOdoo, "Brightloop CRM — Brand: Odoo", 1, 156000, 156000, gst18, 18, 28080, 184080, 14040, 14040, 0, false);
  await addInvoiceLine(invA, pSeat, null,  "Extra Seat × 2",               2, 30000,  60000,  gst12, 12, 7200,  67200,  3600,  3600, 0, false);
  await addPayment(invA, 254880, "bank_transfer", d(-50), "NEFT2026001", "Full payment — prior period");

  // --- Invoice B: PAID — Acme/sub4 (recent period)
  const numB  = await allocNum();
  const invB  = await createInvoice(numB, sub4, custIds[0], "paid",
    d(-30), d(-1), d(-30), d(-15), "33","33",false,
    216000, 0, 38880, 254880, 254880);
  await addInvoiceLine(invB, pCrm,  vOdoo, "Brightloop CRM — Brand: Odoo", 1, 156000, 156000, gst18, 18, 28080, 184080, 14040, 14040, 0, false);
  await addInvoiceLine(invB, pSeat, null,  "Extra Seat × 2",               2, 30000,  60000,  gst12, 12, 7200,  67200,  3600,  3600, 0, false);
  await addPayment(invB, 254880, "upi", d(-10), "UPI20260002", "Monthly subscription payment");

  // --- Invoice C: CONFIRMED + PARTIAL PAYMENT — TechStart/sub5 (interstate: KA→TN)
  const numC  = await allocNum();
  const invC  = await createInvoice(numC, sub5, custIds[1], "confirmed",
    d(-30), d(-1), d(-30), d(0), "33","29",true,
    100000, 0, 18000, 118000, 50000);
  await addInvoiceLine(invC, pCrm, vStandard, "Brightloop CRM — Brand: Standard", 1, 100000, 100000, gst18, 18, 18000, 118000, 0, 0, 18000, true);
  await addPayment(invC, 50000, "upi", d(-5), "UPI20260003", "Partial advance payment");

  // --- Invoice D: OVERDUE (confirmed, past due) — GlobalCo/sub3 (interstate: DL→TN)
  const numD  = await allocNum();
  const invD  = await createInvoice(numD, sub3, custIds[2], "confirmed",
    d(-60), d(-31), d(-60), d(-30), "33","07",true,
    190000, 0, 34200, 224200, 0);
  await addInvoiceLine(invD, pCrm,  vStandard, "Brightloop CRM — Brand: Standard", 1, 100000, 100000, gst18, 18, 18000, 118000, 0, 0, 18000, true);
  await addInvoiceLine(invD, pSeat, null,       "Extra Seat × 3",                  3, 30000,  90000,  gst12, 12, 10800, 100800, 0, 0, 10800, true);

  // --- Invoice E: DRAFT — BuildCo/sub6
  const invE  = await createInvoice(null, sub6, custIds[3], "draft",
    d(-30), d(-1), d(-30), d(0), "33","33",false,
    2100000, 0, 378000, 2478000, 0);
  await addInvoiceLine(invE, pCrm,      vOdoo,    "Brightloop CRM — Brand: Odoo × 10",  10, 156000, 1560000, gst18, 18, 280800, 1840800, 140400,140400, 0, false);
  await addInvoiceLine(invE, pAnalytics,vProTier, "Brightloop Analytics — Tier: Pro × 2", 2, 330000, 660000,  gst18, 18, 118800,  778800,  59400, 59400, 0, false);
  await addInvoiceLine(invE, pSupport,  null,     "Priority Support",                    1, 120000, 120000,  gst18, 18, 21600,   141600,  10800, 10800, 0, false);

  // --- Invoice F: PAID — TechStart/sub5 prior period
  const numF  = await allocNum();
  const invF  = await createInvoice(numF, sub5, custIds[1], "paid",
    d(-60), d(-54), d(-60), d(-45), "33","29",true,
    100000, 0, 18000, 118000, 118000);
  await addInvoiceLine(invF, pCrm, vStandard, "Brightloop CRM — Brand: Standard", 1, 100000, 100000, gst18, 18, 18000, 118000, 0, 0, 18000, true);
  await addPayment(invF, 118000, "card", d(-45), "CARD20260004", "Weekly pilot payment");

  console.log("\n[seed] ✅ Demo data seeded successfully!\n");
  console.log("─────────────────────────────────────────");
  console.log("  INTERNAL LOGINS (company/login)");
  console.log("  Admin:    admin@brightloop.com   / Admin@12345");
  console.log("  Manager:  manager@brightloop.com / Manager@12345");
  console.log("  Staff:    staff@brightloop.com   / Staff@12345");
  console.log("\n  CUSTOMER LOGINS (login)");
  console.log("  alice@acme.com          / Customer@12345  — Acme (TN, intra-state)");
  console.log("  raj@techstart.com       / Customer@12345  — TechStart (KA, inter-state)");
  console.log("  priya@globalco.com      / Customer@12345  — GlobalCo (DL, inter-state)");
  console.log("  samuel@buildco.com      / Customer@12345  — BuildCo (TN, intra-state)");
  console.log("  meera@startup.com       / Customer@12345  — Startup Hub (KL)");
  console.log("─────────────────────────────────────────\n");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed] Error:", err);
      process.exit(1);
    });
}

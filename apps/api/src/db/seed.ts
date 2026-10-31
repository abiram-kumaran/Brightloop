import bcrypt from "bcryptjs";
import { getDb } from "./pool.js";

export async function seedDemoData(): Promise<void> {
  const db = await getDb();
  console.log(`[seed] Seeding demo data using ${db.mode.toUpperCase()} engine...`);

  // 1. Password hash for test accounts
  const adminPasswordHash = await bcrypt.hash("Admin@12345", 10);
  const managerPasswordHash = await bcrypt.hash("Manager@12345", 10);
  const staffPasswordHash = await bcrypt.hash("Staff@12345", 10);
  const customerPasswordHash = await bcrypt.hash("Customer@12345", 10);

  // Get role IDs
  const rolesRes = await db.query<{ id: number; name: string }>(
    "SELECT id, name FROM roles"
  );
  const roleMap: Record<string, number> = {};
  for (const r of rolesRes.rows) {
    roleMap[r.name] = r.id;
  }

  // Seed Users
  console.log("[seed] Seeding users...");
  const adminRes = await db.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, full_name, role_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2
     RETURNING id`,
    ["admin@brightloop.com", adminPasswordHash, "Arthur Pendelton (Admin)", roleMap["admin"]]
  );
  const adminId = adminRes.rows[0].id;

  await db.query(
    `INSERT INTO users (email, password_hash, full_name, role_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2`,
    ["manager@brightloop.com", managerPasswordHash, "Margaret Vance (Manager)", roleMap["manager"], adminId]
  );

  await db.query(
    `INSERT INTO users (email, password_hash, full_name, role_id, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2`,
    ["staff@brightloop.com", staffPasswordHash, "Bob Harrison (Staff)", roleMap["staff"], adminId]
  );

  const customerUserRes = await db.query<{ id: number }>(
    `INSERT INTO users (email, password_hash, full_name, role_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE SET password_hash = $2
     RETURNING id`,
    ["alice@customer.com", customerPasswordHash, "Alice Chen", roleMap["customer"]]
  );
  const customerUserId = customerUserRes.rows[0].id;

  // Seed Customer Record
  console.log("[seed] Seeding customer records...");
  await db.query<{ id: number }>(
    `INSERT INTO customers (user_id, company_name, contact_name, contact_email, phone, gstin, state_code, billing_address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (user_id) DO UPDATE SET company_name = $2
     RETURNING id`,
    [
      customerUserId,
      "Acme Innovations Pvt Ltd",
      "Alice Chen",
      "alice@customer.com",
      "+91 98765 43210",
      "33AAAAA0000A1Z5",
      "33",
      "123 Residency Road, Chennai, Tamil Nadu 600001",
    ]
  );

  // Seed Tax Rules
  console.log("[seed] Seeding tax rules...");
  const taxRes = await db.query<{ id: number }>(
    `INSERT INTO tax_rules (name, rate_percent)
     VALUES ($1, $2)
     ON CONFLICT (name) DO UPDATE SET rate_percent = $2
     RETURNING id`,
    ["GST 18%", 18.00]
  );
  const taxRuleId = taxRes.rows[0].id;

  // Seed Products & Variants
  console.log("[seed] Seeding products & variants...");
  let p1Id: number;
  const existingP1 = await db.query<{ id: number }>(
    "SELECT id FROM products WHERE lower(name) = lower($1) AND deleted_at IS NULL",
    ["Cloud ERP Suite"]
  );
  if (existingP1.rows.length > 0) {
    p1Id = existingP1.rows[0].id;
  } else {
    const p1Res = await db.query<{ id: number }>(
      `INSERT INTO products (name, type, sales_price_paise, cost_price_paise, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ["Cloud ERP Suite", "software", 100000, 40000, "Core business management software"]
    );
    p1Id = p1Res.rows[0].id;
  }

  await db.query(
    "INSERT INTO product_taxes (product_id, tax_rule_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [p1Id, taxRuleId]
  );

  let odooVariantId: number;
  const existingVariant = await db.query<{ id: number }>(
    "SELECT id FROM product_variants WHERE product_id = $1 AND attribute = $2 AND value = $3",
    [p1Id, "Brand", "Odoo"]
  );
  if (existingVariant.rows.length > 0) {
    odooVariantId = existingVariant.rows[0].id;
  } else {
    const odooVariantRes = await db.query<{ id: number }>(
      `INSERT INTO product_variants (product_id, attribute, value, extra_price_paise)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [p1Id, "Brand", "Odoo", 56000]
    );
    odooVariantId = odooVariantRes.rows[0].id;

    await db.query(
      `INSERT INTO product_variants (product_id, attribute, value, extra_price_paise)
       VALUES ($1, $2, $3, $4)`,
      [p1Id, "Brand", "Standard", 0]
    );
  }

  let p2Id: number;
  const existingP2 = await db.query<{ id: number }>(
    "SELECT id FROM products WHERE lower(name) = lower($1) AND deleted_at IS NULL",
    ["Dedicated Account Support"]
  );
  if (existingP2.rows.length > 0) {
    p2Id = existingP2.rows[0].id;
  } else {
    const p2Res = await db.query<{ id: number }>(
      `INSERT INTO products (name, type, sales_price_paise, cost_price_paise, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      ["Dedicated Account Support", "service", 250000, 100000, "24/7 dedicated support representative"]
    );
    p2Id = p2Res.rows[0].id;
  }
  await db.query(
    "INSERT INTO product_taxes (product_id, tax_rule_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
    [p2Id, taxRuleId]
  );

  // Seed Plans
  console.log("[seed] Seeding plans...");
  let plan1Id: number;
  const existingPlan1 = await db.query<{ id: number }>(
    "SELECT id FROM plans WHERE lower(name) = lower($1) AND deleted_at IS NULL",
    ["Professional Monthly"]
  );
  if (existingPlan1.rows.length > 0) {
    plan1Id = existingPlan1.rows[0].id;
  } else {
    const plan1Res = await db.query<{ id: number }>(
      `INSERT INTO plans (name, price_paise, billing_period, billing_interval, min_quantity, available_from, auto_close, closable, pausable, renewable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        "Professional Monthly",
        156000,
        "monthly",
        1,
        1,
        "2026-01-01",
        false,
        true,
        true,
        true,
      ]
    );
    plan1Id = plan1Res.rows[0].id;
    await db.query(
      "INSERT INTO plan_products (plan_id, product_id, default_quantity) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [plan1Id, p1Id, 1]
    );
  }

  let plan2Id: number;
  const existingPlan2 = await db.query<{ id: number }>(
    "SELECT id FROM plans WHERE lower(name) = lower($1) AND deleted_at IS NULL",
    ["Enterprise Annual"]
  );
  if (existingPlan2.rows.length > 0) {
    plan2Id = existingPlan2.rows[0].id;
  } else {
    const plan2Res = await db.query<{ id: number }>(
      `INSERT INTO plans (name, price_paise, billing_period, billing_interval, min_quantity, available_from, auto_close, closable, pausable, renewable)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [
        "Enterprise Annual",
        1500000,
        "yearly",
        1,
        1,
        "2026-01-01",
        false,
        true,
        true,
        true,
      ]
    );
    plan2Id = plan2Res.rows[0].id;
    await db.query(
      "INSERT INTO plan_products (plan_id, product_id, default_quantity) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [plan2Id, p1Id, 1]
    );
    await db.query(
      "INSERT INTO plan_products (plan_id, product_id, default_quantity) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
      [plan2Id, p2Id, 1]
    );
  }

  // Seed Quotation Template
  console.log("[seed] Seeding quotation template...");
  let tmplId: number;
  const existingTmpl = await db.query<{ id: number }>(
    "SELECT id FROM quotation_templates WHERE lower(name) = lower($1) AND deleted_at IS NULL",
    ["Standard Business Setup"]
  );
  if (existingTmpl.rows.length > 0) {
    tmplId = existingTmpl.rows[0].id;
  } else {
    const tmplRes = await db.query<{ id: number }>(
      `INSERT INTO quotation_templates (name, plan_id, validity_days)
       VALUES ($1, $2, $3)
       RETURNING id`,
      ["Standard Business Setup", plan1Id, 30]
    );
    tmplId = tmplRes.rows[0].id;

    await db.query(
      `INSERT INTO quotation_template_lines (template_id, product_id, variant_id, quantity)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [tmplId, p1Id, odooVariantId, 1]
    );
  }

  // Seed Discount
  console.log("[seed] Seeding discount rule...");
  const existingDiscount = await db.query<{ id: number }>(
    "SELECT id FROM discounts WHERE lower(name) = lower($1) AND deleted_at IS NULL",
    ["Launch Special 10%"]
  );
  if (existingDiscount.rows.length === 0) {
    await db.query(
      `INSERT INTO discounts (name, type, value, scope, min_purchase_paise, min_quantity, start_date, end_date, usage_limit, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        "Launch Special 10%",
        "percentage",
        10,
        "subscription",
        100000,
        1,
        "2026-01-01",
        "2026-12-31",
        100,
        adminId,
      ]
    );
  }

  console.log("[seed] Demo database seeded successfully!");
  console.log("Demo logins:");
  console.log("  Admin:    admin@brightloop.com     / Admin@12345");
  console.log("  Manager:  manager@brightloop.com   / Manager@12345");
  console.log("  Staff:    staff@brightloop.com     / Staff@12345");
  console.log("  Customer: alice@customer.com       / Customer@12345");
}

if (process.argv[1]?.endsWith("seed.ts") || process.argv[1]?.endsWith("seed.js")) {
  seedDemoData()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[seed] Error seeding demo data:", err);
      process.exit(1);
    });
}

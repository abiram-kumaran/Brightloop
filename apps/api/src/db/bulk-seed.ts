import { getDb } from "./pool.js";
import { runMigrations } from "./migrate.js";
import { seedDemoData } from "./seed.js";
export async function runBulkSeed(targetCount: number = 1000): Promise<void> {
  const db = await getDb();
  console.log(`[bulk-seed] Starting bulk dataset generation (${targetCount} customers & subscriptions)...`);

  const startTime = Date.now();

  await db.withTransaction(async (client) => {
    // 1. Fetch available plan and product IDs
    const plansRes = await client.query("SELECT id FROM plans WHERE deleted_at IS NULL LIMIT 5");
    const planIds = plansRes.rows.map((r: any) => r.id);

    if (planIds.length === 0) {
      console.log("[bulk-seed] No plans found. Run standard seed first!");
      return;
    }

    // 2. Fetch admin user id for created_by
    const adminRes = await client.query("SELECT id FROM users WHERE role = 'admin' LIMIT 1");
    const adminId = adminRes.rows[0]?.id || 1;

    // 3. Batch generate customers in chunks of 250
    const chunkSize = 250;
    for (let i = 0; i < targetCount; i += chunkSize) {
      const currentChunk = Math.min(chunkSize, targetCount - i);
      const custValues: string[] = [];
      const custParams: any[] = [];

      for (let j = 0; j < currentChunk; j++) {
        const idx = i + j + 100;
        const offset = j * 4;
        custValues.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4})`);
        custParams.push(
          `Enterprise Corp ${idx}`,
          `finance${idx}@enterprisecorp.example`,
          "33", // Tamil Nadu
          "123 Tech Park, Chennai"
        );
      }

      const insertCustSql = `
        INSERT INTO customers (name, email, billing_state_code, billing_address)
        VALUES ${custValues.join(", ")}
        ON CONFLICT (email) DO NOTHING
        RETURNING id, name
      `;

      const insertedCusts = await client.query(insertCustSql, custParams);

      // Generate active subscriptions for each customer
      for (const cust of insertedCusts.rows) {
        const planId = planIds[cust.id % planIds.length];
        const anchorDay = (cust.id % 28) + 1;

        const subRes = await client.query(
          `INSERT INTO subscriptions (
            customer_id, plan_id, status, start_date, anchor_day, billing_period,
            next_invoice_date, mrr_paise, created_by
          ) VALUES (
            $1, $2, 'active', '2026-01-01', $3, 'monthly',
            '2026-11-01', 500000, $4
          ) RETURNING id`,
          [cust.id, planId, anchorDay, adminId]
        );

        const subId = subRes.rows[0].id;

        // Generate past confirmed invoice
        const invRes = await client.query(
          `INSERT INTO invoices (
            number, subscription_id, customer_id, status,
            period_start, period_end, issue_date, due_date,
            supplier_state, place_of_supply, is_interstate,
            subtotal_paise, discount_paise, tax_paise, total_paise,
            amount_paid_paise, amount_due_paise
          ) VALUES (
            $1, $2, $3, 'paid',
            '2026-10-01', '2026-10-31', '2026-10-01', '2026-10-15',
            '33', '33', false,
            500000, 0, 90000, 590000,
            590000, 0
          ) RETURNING id`,
          [`INV-BULK-${subId}`, subId, cust.id]
        );

        // Record settled payment
        await client.query(
          `INSERT INTO payments (
            invoice_id, amount_paise, method, paid_on, reference, status, recorded_by
          ) VALUES (
            $1, 590000, 'bank_transfer', '2026-10-05', $2, 'posted', $3
          )`,
          [invRes.rows[0].id, `NEFT-${subId}-BULK`, adminId]
        );
      }
    }
  });

  const durationMs = Date.now() - startTime;
  console.log(`[bulk-seed] Completed synthetic bulk seed in ${(durationMs / 1000).toFixed(2)}s!`);
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("bulk-seed.ts") || process.argv[1].endsWith("bulk-seed.js"))
) {
  (async () => {
    await runMigrations();
    await seedDemoData();
    await runBulkSeed(200);
    process.exit(0);
  })().catch((err: unknown) => {
    console.error("[bulk-seed] Error:", err);
    process.exit(1);
  });
}
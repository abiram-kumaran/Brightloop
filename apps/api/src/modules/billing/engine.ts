import { getDb } from "../../db/pool.js";
import {
  BillingPeriod,
  nextInvoiceDate,
  formatINR,
  calculateGstBreakdown,
} from "@brightloop/shared";

export interface BillingRunResult {
  asOfDate: string;
  totalSubscriptionsChecked: number;
  invoicesGenerated: number;
  invoicesSkipped: number;
  totalBilledPaise: number;
  invoices: {
    invoiceId: number;
    invoiceNumber: string;
    subscriptionId: number;
    customerId: number;
    customerName: string;
    totalPaise: number;
    periodStart: string;
    periodEnd: string;
  }[];
}

/**
 * Core Automated Recurring Billing Engine
 * Adheres strictly to the specification:
 * 1. Idempotency guarantee: one invoice per subscription period. Retried runs generate 0 duplicates.
 * 2. Anchor-date calculation: Day 1..31 preserved across month lengths without destructive drift.
 * 3. Exact GST breakdown: intra-state split (CGST+SGST) vs inter-state IGST.
 * 4. Atomic gapless invoice number allocation.
 */
export async function executeBillingRun(params: {
  asOfDate?: string;
  dryRun?: boolean;
  actorId?: number;
}): Promise<BillingRunResult> {
  const db = await getDb();
  const asOf = params.asOfDate || new Date().toISOString().slice(0, 10);
  const yearStr = asOf.slice(0, 4);
  const seriesName = `INV-${yearStr}`;

  return await db.withTransaction(async (client) => {
    // 1. Fetch Company Settings for Place of Supply / Supplier State (default '33' Tamil Nadu)
    const compRes = await client.query(
      "SELECT state_code FROM company_settings WHERE id = 1 LIMIT 1"
    );
    const supplierState = compRes.rows[0]?.state_code || "33";
    // 2. Select eligible active subscriptions due for billing on or before asOfDate
    const dueSubsRes = await client.query(
      `SELECT
        s.id,
        s.customer_id,
        s.plan_id,
        s.start_date,
        s.anchor_day,
        s.anchor_month,
        s.next_invoice_date,
        s.last_billed_through,
        p.billing_period,
        p.billing_interval,
        c.company_name,
        c.state_code as customer_state,
        c.gstin,
        c.billing_address,
        pt.due_days
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      JOIN customers c ON s.customer_id = c.id
      JOIN payment_terms pt ON s.payment_term_id = pt.id
      WHERE s.status = 'active'
        AND s.next_invoice_date <= $1
      ORDER BY s.id ASC`,
      [asOf]
    );

    const dueSubs = dueSubsRes.rows;
    const generatedInvoices: BillingRunResult["invoices"] = [];
    let skippedCount = 0;
    let totalBilledPaise = 0;

    for (const sub of dueSubs) {
      const toStr = (d: any) =>
        d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
      const periodStart = toStr(sub.next_invoice_date);

      // Check if invoice already exists for this subscription & period_start (Idempotency check)
      const existingInv = await client.query(
        `SELECT id FROM invoices
         WHERE subscription_id = $1 AND period_start = $2 AND status <> 'cancelled'`,
        [sub.id, periodStart]
      );

      if (existingInv.rows.length > 0) {
        skippedCount++;
        continue;
      }

      // Compute next billing period date from anchor day
      const billingPeriod = sub.billing_period as BillingPeriod;
      const nextPeriodStart = nextInvoiceDate({
        anchorDay: sub.anchor_day,
        anchorMonth: sub.anchor_month || undefined,
        fromDate: periodStart,
        period: billingPeriod,
        interval: sub.billing_interval || 1,
      });

      // Period end is the day before the next period starts
      const nextPeriodStartDate = new Date(nextPeriodStart);
      nextPeriodStartDate.setDate(nextPeriodStartDate.getDate() - 1);
      const periodEnd = nextPeriodStartDate.toISOString().slice(0, 10);

      // Due date = period_start + due_days
      const dueDateObj = new Date(periodStart);
      dueDateObj.setDate(dueDateObj.getDate() + (sub.due_days || 15));
      const dueDate = dueDateObj.toISOString().slice(0, 10);

      // Fetch subscription lines
      const linesRes = await client.query(
        `SELECT
          sl.product_id,
          sl.variant_id,
          sl.quantity,
          sl.unit_price_paise,
          sl.tax_rule_id,
          pr.name as product_name,
          pr.sac_code,
          pv.attribute,
          pv.value,
          COALESCE(tr.rate_percent, 0) as tax_rate
        FROM subscription_lines sl
        JOIN products pr ON sl.product_id = pr.id
        LEFT JOIN product_variants pv ON sl.variant_id = pv.id
        LEFT JOIN tax_rules tr ON sl.tax_rule_id = tr.id
        WHERE sl.subscription_id = $1`,
        [sub.id]
      );

      if (linesRes.rows.length === 0) {
        skippedCount++;
        continue;
      }

      const isInterstate = supplierState !== (sub.customer_state || "33");

      let subtotalPaise = 0;
      let taxTotalPaise = 0;

      const calculatedLines = linesRes.rows.map((line) => {
        const lineSubtotal = line.quantity * Number(line.unit_price_paise);
        const taxable = lineSubtotal; // before discounts
        const taxRate = Number(line.tax_rate);

        const gst = calculateGstBreakdown({
          taxableAmountPaise: taxable,
          taxRatePercent: taxRate,
          isInterstate,
        });

        subtotalPaise += lineSubtotal;
        taxTotalPaise += Number(gst.totalTaxPaise);

        const desc = line.variant_id
          ? `${line.product_name} - ${line.attribute}: ${line.value}`
          : line.product_name;

        return {
          productId: line.product_id,
          variantId: line.variant_id,
          description: desc,
          sacCode: line.sac_code || "998313",
          quantity: line.quantity,
          unitPricePaise: Number(line.unit_price_paise),
          lineSubtotalPaise: lineSubtotal,
          discountPaise: 0,
          taxablePaise: taxable,
          taxRuleId: line.tax_rule_id,
          taxRatePercent: taxRate,
          taxPaise: Number(gst.totalTaxPaise),
          lineTotalPaise: taxable + Number(gst.totalTaxPaise),
          breakdown: {
            isInterstate,
            cgstPaise: Number(gst.cgstPaise),
            sgstPaise: Number(gst.sgstPaise),
            igstPaise: Number(gst.igstPaise),
          },
        };
      });

      const totalPaise = subtotalPaise + taxTotalPaise;

      if (params.dryRun) {
        generatedInvoices.push({
          invoiceId: 0,
          invoiceNumber: "DRY-RUN",
          subscriptionId: sub.id,
          customerId: sub.customer_id,
          customerName: sub.company_name,
          totalPaise,
          periodStart,
          periodEnd,
        });
        totalBilledPaise += totalPaise;
        continue;
      }

      // 3. Atomically allocate gapless sequence number
      await client.query(
        `INSERT INTO invoice_sequences (series, last_number)
         VALUES ($1, 0)
         ON CONFLICT (series) DO NOTHING`,
        [seriesName]
      );

      const seqRes = await client.query(
        `UPDATE invoice_sequences
         SET last_number = last_number + 1
         WHERE series = $1
         RETURNING last_number`,
        [seriesName]
      );
      const nextNum = Number(seqRes.rows[0].last_number);
      const invoiceNumber = `${seriesName}-${String(nextNum).padStart(5, "0")}`;

      // 4. Insert Invoice (Auto-confirmed per specification)
      const invRes = await client.query(
        `INSERT INTO invoices (
          number, subscription_id, customer_id, status, period_start, period_end,
          issue_date, due_date, supplier_state, place_of_supply, is_interstate,
          subtotal_paise, discount_total_paise, tax_total_paise, total_paise,
          confirmed_at
        ) VALUES ($1, $2, $3, 'confirmed', $4, $5, $6, $7, $8, $9, $10, $11, 0, $12, $13, now())
        RETURNING id`,
        [
          invoiceNumber,
          sub.id,
          sub.customer_id,
          periodStart,
          periodEnd,
          asOf,
          dueDate,
          supplierState,
          sub.customer_state || "33",
          isInterstate,
          subtotalPaise,
          taxTotalPaise,
          totalPaise,
        ]
      );
      const invoiceId = invRes.rows[0].id;

      // 5. Insert Invoice Lines
      for (const cl of calculatedLines) {
        await client.query(
          `INSERT INTO invoice_lines (
            invoice_id, product_id, variant_id, description, sac_code, quantity,
            unit_price_paise, line_subtotal_paise, discount_paise, taxable_paise,
            tax_rule_id, tax_rate_percent, tax_paise, line_total_paise, breakdown
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            invoiceId,
            cl.productId,
            cl.variantId,
            cl.description,
            cl.sacCode,
            cl.quantity,
            cl.unitPricePaise,
            cl.lineSubtotalPaise,
            cl.discountPaise,
            cl.taxablePaise,
            cl.taxRuleId,
            cl.taxRatePercent,
            cl.taxPaise,
            cl.lineTotalPaise,
            JSON.stringify(cl.breakdown),
          ]
        );
      }

      // 6. Advance subscription to the next billing date
      await client.query(
        `UPDATE subscriptions
         SET next_invoice_date = $1,
             last_billed_through = $2,
             updated_at = now()
         WHERE id = $3`,
        [nextPeriodStart, periodEnd, sub.id]
      );

      generatedInvoices.push({
        invoiceId,
        invoiceNumber,
        subscriptionId: sub.id,
        customerId: sub.customer_id,
        customerName: sub.company_name,
        totalPaise,
        periodStart,
        periodEnd,
      });

      totalBilledPaise += totalPaise;
    }

    return {
      asOfDate: asOf,
      totalSubscriptionsChecked: dueSubs.length,
      invoicesGenerated: generatedInvoices.length,
      invoicesSkipped: skippedCount,
      totalBilledPaise,
      invoices: generatedInvoices,
    };
  });
}

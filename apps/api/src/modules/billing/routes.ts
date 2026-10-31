import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/pool.js";
import { authenticate, requirePermission } from "../../common/auth.js";
import { executeBillingRun } from "./engine.js";
import { AppError, toPaise, formatINR } from "@brightloop/shared";

export async function billingRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  /* =======================================================================
   * TRIGGER RECURRING BILLING ENGINE RUN
   * ======================================================================= */
  app.post(
    "/billing/run",
    { preHandler: [requirePermission("billing:run")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const querySchema = z.object({
        asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        dryRun: z.boolean().optional(),
      });
      const body = querySchema.parse(request.body || {});

      const result = await executeBillingRun({
        asOfDate: body.asOfDate,
        dryRun: body.dryRun,
        actorId: request.user!.id,
      });

      return reply.status(200).send({ data: result });
    }
  );

  /* =======================================================================
   * LIST INVOICES
   * ======================================================================= */
  app.get("/invoices", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const user = request.user!;
    const query = request.query as {
      status?: string;
      customerId?: string;
      subscriptionId?: string;
      search?: string;
    };

    let sql = `
      SELECT
        i.id,
        i.number,
        i.subscription_id as "subscriptionId",
        i.customer_id as "customerId",
        i.status,
        i.period_start as "periodStart",
        i.period_end as "periodEnd",
        i.issue_date as "issueDate",
        i.due_date as "dueDate",
        i.is_interstate as "isInterstate",
        i.currency,
        i.subtotal_paise as "subtotalPaise",
        i.tax_total_paise as "taxTotalPaise",
        i.total_paise as "totalPaise",
        i.amount_paid_paise as "amountPaidPaise",
        i.amount_due_paise as "amountDuePaise",
        i.confirmed_at as "confirmedAt",
        i.paid_at as "paidAt",
        i.created_at as "createdAt",
        c.company_name as "customerName",
        s.number as "subscriptionNumber"
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN subscriptions s ON i.subscription_id = s.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Customer Isolation Guard
    if (user.role === "customer") {
      params.push(user.customerId);
      sql += ` AND i.customer_id = $${params.length}`;
    } else if (query.customerId) {
      params.push(parseInt(query.customerId, 10));
      sql += ` AND i.customer_id = $${params.length}`;
    }

    if (query.subscriptionId) {
      params.push(parseInt(query.subscriptionId, 10));
      sql += ` AND i.subscription_id = $${params.length}`;
    }

    if (query.status) {
      params.push(query.status);
      sql += ` AND i.status = $${params.length}`;
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      sql += ` AND (i.number ILIKE $${params.length} OR c.company_name ILIKE $${params.length})`;
    }

    sql += ` ORDER BY i.id DESC`;

    const res = await db.query(sql, params);
    return reply.status(200).send({ data: res.rows });
  });

  /* =======================================================================
   * GET INVOICE BY ID (WITH FULL LINES & GST BREAKDOWN)
   * ======================================================================= */
  app.get("/invoices/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = await getDb();
    const user = request.user!;
    const invoiceId = parseInt(request.params.id, 10);

    const invRes = await db.query(
      `SELECT
        i.*,
        c.company_name,
        c.contact_name,
        c.contact_email,
        c.billing_address,
        c.gstin,
        s.number as subscription_number
      FROM invoices i
      JOIN customers c ON i.customer_id = c.id
      JOIN subscriptions s ON i.subscription_id = s.id
      WHERE i.id = $1`,
      [invoiceId]
    );

    if (invRes.rows.length === 0) {
      throw new AppError("NOT_FOUND", "Invoice not found");
    }

    const inv = invRes.rows[0];

    // Customer Isolation Check
    if (user.role === "customer" && user.customerId !== Number(inv.customer_id)) {
      throw new AppError("FORBIDDEN", "You do not have permission to view this invoice");
    }

    // Invoice Lines
    const linesRes = await db.query(
      `SELECT
        id,
        description,
        sac_code as "sacCode",
        quantity,
        unit_price_paise as "unitPricePaise",
        line_subtotal_paise as "lineSubtotalPaise",
        tax_rate_percent as "taxRatePercent",
        tax_paise as "taxPaise",
        line_total_paise as "lineTotalPaise",
        breakdown
      FROM invoice_lines
      WHERE invoice_id = $1
      ORDER BY id ASC`,
      [invoiceId]
    );

    // Associated Payments
    const payRes = await db.query(
      `SELECT
        id,
        amount_paise as "amountPaise",
        method,
        paid_on as "paidOn",
        reference,
        note,
        status,
        created_at as "createdAt"
      FROM payments
      WHERE invoice_id = $1
      ORDER BY id DESC`,
      [invoiceId]
    );

    return reply.status(200).send({
      data: {
        id: inv.id,
        number: inv.number,
        subscriptionId: inv.subscription_id,
        subscriptionNumber: inv.subscription_number,
        status: inv.status,
        periodStart: inv.period_start,
        periodEnd: inv.period_end,
        issueDate: inv.issue_date,
        dueDate: inv.due_date,
        supplierState: inv.supplier_state,
        placeOfSupply: inv.place_of_supply,
        isInterstate: inv.is_interstate,
        currency: inv.currency,
        subtotalPaise: Number(inv.subtotal_paise),
        taxTotalPaise: Number(inv.tax_total_paise),
        totalPaise: Number(inv.total_paise),
        amountPaidPaise: Number(inv.amount_paid_paise),
        amountDuePaise: Number(inv.amount_due_paise),
        confirmedAt: inv.confirmed_at,
        paidAt: inv.paid_at,
        customer: {
          id: inv.customer_id,
          name: inv.company_name,
          contactName: inv.contact_name,
          contactEmail: inv.contact_email,
          billingAddress: inv.billing_address,
          gstin: inv.gstin,
        },
        lines: linesRes.rows,
        payments: payRes.rows,
      },
    });
  });

  /* =======================================================================
   * RECORD PAYMENT AGAINST INVOICE
   * ======================================================================= */
  app.post(
    "/payments",
    { preHandler: [requirePermission("payments:create")] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const db = await getDb();
      const user = request.user!;

      const paymentSchema = z.object({
        invoiceId: z.number().int(),
        amount: z.number().positive(), // in rupees
        method: z.enum(["cash", "bank_transfer", "upi", "card", "cheque"]),
        paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
        reference: z.string().trim().optional(),
        note: z.string().trim().optional(),
        idempotencyKey: z.string().optional(),
      });

      const body = paymentSchema.parse(request.body);
      const amountPaise = toPaise(body.amount);

      const result = await db.withTransaction(async (client) => {
        // Fetch invoice with row lock
        const invRes = await client.query(
          `SELECT id, status, total_paise, amount_paid_paise, amount_due_paise
           FROM invoices
           WHERE id = $1 FOR UPDATE`,
          [body.invoiceId]
        );

        if (invRes.rows.length === 0) {
          throw new AppError("NOT_FOUND", "Invoice not found");
        }

        const inv = invRes.rows[0];

        if (inv.status === "cancelled") {
          throw new AppError("CONFLICT", "Cannot pay a cancelled invoice");
        }

        if (inv.status === "paid") {
          throw new AppError("CONFLICT", "Invoice is already fully paid");
        }

        const remainingDuePaise = Number(inv.amount_due_paise);
        if (amountPaise > remainingDuePaise) {
          throw new AppError(
            "VALIDATION_FAILED",
            `Payment amount (${formatINR(amountPaise)}) exceeds remaining due amount (${formatINR(remainingDuePaise)})`
          );
        }

        // Insert payment record
        const payRes = await client.query(
          `INSERT INTO payments (
            invoice_id, amount_paise, method, paid_on, reference, note,
            status, idempotency_key, recorded_by
          ) VALUES ($1, $2, $3, $4, $5, $6, 'posted', $7, $8)
          RETURNING *`,
          [
            body.invoiceId,
            amountPaise,
            body.method,
            body.paidOn,
            body.reference || null,
            body.note || null,
            body.idempotencyKey || null,
            user.id,
          ]
        );
        const payment = payRes.rows[0];

        // Update Invoice amount_paid_paise and status
        const newPaidPaise = Number(inv.amount_paid_paise) + amountPaise;
        const isFullyPaid = newPaidPaise >= Number(inv.total_paise);

        await client.query(
          `UPDATE invoices
           SET amount_paid_paise = $1,
               status = $2,
               paid_at = $3,
               updated_at = now()
           WHERE id = $4`,
          [
            newPaidPaise,
            isFullyPaid ? "paid" : inv.status,
            isFullyPaid ? new Date().toISOString() : null,
            body.invoiceId,
          ]
        );

        return {
          payment,
          isFullyPaid,
          amountPaidPaise: newPaidPaise,
          amountDuePaise: Number(inv.total_paise) - newPaidPaise,
        };
      });

      return reply.status(201).send({ data: result });
    }
  );

  /* =======================================================================
   * LIST PAYMENTS
   * ======================================================================= */
  app.get("/payments", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const user = request.user!;

    let sql = `
      SELECT
        p.id,
        p.amount_paise as "amountPaise",
        p.method,
        p.paid_on as "paidOn",
        p.reference,
        p.note,
        p.status,
        p.created_at as "createdAt",
        i.id as "invoiceId",
        i.number as "invoiceNumber",
        i.total_paise as "invoiceTotalPaise",
        c.company_name as "customerName"
      FROM payments p
      JOIN invoices i ON p.invoice_id = i.id
      JOIN customers c ON i.customer_id = c.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (user.role === "customer") {
      params.push(user.customerId);
      sql += ` AND i.customer_id = $${params.length}`;
    }

    sql += ` ORDER BY p.id DESC`;

    const res = await db.query(sql, params);
    return reply.status(200).send({ data: res.rows });
  });
}

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/pool.js";
import { authenticate } from "../../common/auth.js";
import {
  AppError,
  SubscriptionStatus,
  canTransitionSubscription,
  toPaise,
  formatINR,
  calculateGstBreakdown,
} from "@brightloop/shared";

export async function subscriptionRoutes(app: FastifyInstance) {
  app.addHook("preHandler", authenticate);

  /* =======================================================================
   * LIST SUBSCRIPTIONS & QUOTATIONS
   * ======================================================================= */
  app.get("/subscriptions", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const user = request.user!;
    const query = request.query as {
      status?: string;
      customerId?: string;
      search?: string;
    };

    let sql = `
      SELECT
        s.id,
        s.number,
        s.status,
        s.start_date as "startDate",
        s.expiry_date as "expiryDate",
        s.quote_valid_until as "quoteValidUntil",
        s.anchor_day as "anchorDay",
        s.next_invoice_date as "nextInvoiceDate",
        s.last_billed_through as "lastBilledThrough",
        s.paused_at as "pausedAt",
        s.closed_at as "closedAt",
        s.close_reason as "closeReason",
        s.version,
        s.created_at as "createdAt",
        c.id as "customerId",
        c.company_name as "customerName",
        p.id as "planId",
        p.name as "planName",
        p.billing_period as "billingPeriod",
        p.pausable,
        p.closable,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sl.id,
              'productId', sl.product_id,
              'productName', pr.name,
              'variantId', sl.variant_id,
              'variantName', concat(pv.attribute, ': ', pv.value),
              'quantity', sl.quantity,
              'unitPricePaise', sl.unit_price_paise,
              'taxRate', COALESCE(tr.rate_percent, 0)
            )
          ) FILTER (WHERE sl.id IS NOT NULL), '[]'
        ) as lines
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      JOIN plans p ON s.plan_id = p.id
      LEFT JOIN subscription_lines sl ON s.id = sl.subscription_id
      LEFT JOIN products pr ON sl.product_id = pr.id
      LEFT JOIN product_variants pv ON sl.variant_id = pv.id
      LEFT JOIN tax_rules tr ON sl.tax_rule_id = tr.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    // Strictly enforce Customer Isolation: Customers can ONLY see their own subscriptions
    if (user.role === "customer") {
      params.push(user.customerId);
      sql += ` AND s.customer_id = $${params.length}`;
    } else if (query.customerId) {
      params.push(parseInt(query.customerId, 10));
      sql += ` AND s.customer_id = $${params.length}`;
    }

    if (query.status) {
      params.push(query.status);
      sql += ` AND s.status = $${params.length}`;
    }

    if (query.search) {
      params.push(`%${query.search}%`);
      sql += ` AND (s.number ILIKE $${params.length} OR c.company_name ILIKE $${params.length} OR p.name ILIKE $${params.length})`;
    }

    sql += ` GROUP BY s.id, c.id, p.id ORDER BY s.id DESC`;

    const res = await db.query(sql, params);

    // Calculate subtotal, taxes, and totals for each subscription
    const formatted = res.rows.map((row) => {
      let subtotalPaise = 0;
      let taxPaise = 0;

      for (const line of row.lines) {
        const lineTotal = line.quantity * Number(line.unitPricePaise);
        subtotalPaise += lineTotal;
        taxPaise += Math.round((lineTotal * line.taxRate) / 100);
      }

      return {
        ...row,
        subtotalPaise,
        taxPaise,
        totalPaise: subtotalPaise + taxPaise,
      };
    });

    return reply.status(200).send({ data: formatted });
  });

  /* =======================================================================
   * GET SUBSCRIPTION BY ID (WITH TIMELINE EVENTS)
   * ======================================================================= */
  app.get("/subscriptions/:id", async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const db = await getDb();
    const user = request.user!;
    const subId = parseInt(request.params.id, 10);

    const subRes = await db.query(
      `SELECT
        s.*,
        c.id as customer_id,
        c.company_name as customer_name,
        c.billing_address,
        c.gstin,
        p.id as plan_id,
        p.name as plan_name,
        p.billing_period,
        p.pausable,
        p.closable,
        p.renewable
      FROM subscriptions s
      JOIN customers c ON s.customer_id = c.id
      JOIN plans p ON s.plan_id = p.id
      WHERE s.id = $1`,
      [subId]
    );

    if (subRes.rows.length === 0) {
      throw new AppError("NOT_FOUND", "Subscription not found");
    }

    const sub = subRes.rows[0];

    // Customer Isolation Check
    if (user.role === "customer" && user.customerId !== Number(sub.customer_id)) {
      throw new AppError("FORBIDDEN", "You do not have access to this subscription");
    }

    // Lines
    const linesRes = await db.query(
      `SELECT
        sl.id,
        sl.product_id as "productId",
        pr.name as "productName",
        sl.variant_id as "variantId",
        concat(pv.attribute, ': ', pv.value) as "variantName",
        sl.quantity,
        sl.unit_price_paise as "unitPricePaise",
        COALESCE(tr.rate_percent, 0) as "taxRate",
        tr.name as "taxName"
      FROM subscription_lines sl
      JOIN products pr ON sl.product_id = pr.id
      LEFT JOIN product_variants pv ON sl.variant_id = pv.id
      LEFT JOIN tax_rules tr ON sl.tax_rule_id = tr.id
      WHERE sl.subscription_id = $1
      ORDER BY sl.id ASC`,
      [subId]
    );

    // Audit Timeline Events
    const eventsRes = await db.query(
      `SELECT
        se.id,
        se.event_type as "eventType",
        se.mrr_before_paise as "mrrBeforePaise",
        se.mrr_after_paise as "mrrAfterPaise",
        se.occurred_at as "occurredAt",
        se.meta,
        u.full_name as "actorName"
      FROM subscription_events se
      LEFT JOIN users u ON se.actor_id = u.id
      WHERE se.subscription_id = $1
      ORDER BY se.occurred_at DESC`,
      [subId]
    );

    let subtotalPaise = 0;
    let taxPaise = 0;
    const lines = linesRes.rows.map((l) => {
      const lineTotal = l.quantity * Number(l.unitPricePaise);
      const lineTax = Math.round((lineTotal * l.taxRate) / 100);
      subtotalPaise += lineTotal;
      taxPaise += lineTax;
      return {
        ...l,
        lineTotalPaise: lineTotal,
        lineTaxPaise: lineTax,
        lineNetPaise: lineTotal + lineTax,
      };
    });

    return reply.status(200).send({
      data: {
        id: sub.id,
        number: sub.number,
        status: sub.status,
        startDate: sub.start_date,
        expiryDate: sub.expiry_date,
        quoteValidUntil: sub.quote_valid_until,
        anchorDay: sub.anchor_day,
        nextInvoiceDate: sub.next_invoice_date,
        lastBilledThrough: sub.last_billed_through,
        pausedAt: sub.paused_at,
        closedAt: sub.closed_at,
        closeReason: sub.close_reason,
        version: sub.version,
        customer: {
          id: sub.customer_id,
          name: sub.customer_name,
          billingAddress: sub.billing_address,
          gstin: sub.gstin,
        },
        plan: {
          id: sub.plan_id,
          name: sub.plan_name,
          billingPeriod: sub.billing_period,
          pausable: sub.pausable,
          closable: sub.closable,
          renewable: sub.renewable,
        },
        lines,
        subtotalPaise,
        taxPaise,
        totalPaise: subtotalPaise + taxPaise,
        events: eventsRes.rows,
      },
    });
  });

  /* =======================================================================
   * CREATE NEW SUBSCRIPTION / QUOTATION
   * ======================================================================= */
  app.post("/subscriptions", async (request: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const user = request.user!;

    const createSchema = z.object({
      customerId: z.number().int().optional(),
      planId: z.number().int(),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(() => new Date().toISOString().slice(0, 10)),
      quoteValidUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      anchorDay: z.number().int().min(1).max(31).optional(),
      lines: z
        .array(
          z.object({
            productId: z.number().int(),
            variantId: z.number().int().optional().nullable(),
            quantity: z.number().int().min(1).default(1),
            unitPrice: z.number().nonnegative().optional(), // In rupees, converted to paise
            taxRuleId: z.number().int().optional().nullable(),
          })
        )
        .min(1, "Subscription must have at least one product line"),
    });

    const body = createSchema.parse(request.body);

    // Resolve Customer ID
    let targetCustomerId = body.customerId;
    if (user.role === "customer") {
      targetCustomerId = user.customerId;
    }
    if (!targetCustomerId) {
      throw new AppError("VALIDATION_FAILED", "Customer ID is required");
    }

    // Default payment term (Immediate / 1)
    const ptRes = await db.query("SELECT id FROM payment_terms LIMIT 1");
    const paymentTermId = ptRes.rows[0]?.id || 1;

    // Anchor Day
    const startDay = parseInt(body.startDate.split("-")[2], 10);
    const anchorDay = body.anchorDay || startDay;

    const res = await db.withTransaction(async (client) => {
      // Create Subscription in 'draft' or 'quotation'
      const subRes = await client.query(
        `INSERT INTO subscriptions (
          customer_id, plan_id, payment_term_id, status, start_date,
          quote_valid_until, anchor_day, next_invoice_date, created_by
        ) VALUES ($1, $2, $3, 'draft', $4, $5, $6, $4, $7)
        RETURNING *`,
        [
          targetCustomerId,
          body.planId,
          paymentTermId,
          body.startDate,
          body.quoteValidUntil || null,
          anchorDay,
          user.id,
        ]
      );
      const newSub = subRes.rows[0];

      let initialSubtotalPaise = 0;

      // Insert Lines
      for (const line of body.lines) {
        let lineUnitPricePaise = line.unitPrice !== undefined ? toPaise(line.unitPrice) : 0;

        // Fetch price from catalog if not manually given
        if (line.unitPrice === undefined) {
          const prodRes = await client.query(
            "SELECT sales_price_paise FROM products WHERE id = $1",
            [line.productId]
          );
          let basePaise = Number(prodRes.rows[0]?.sales_price_paise || 0);

          if (line.variantId) {
            const varRes = await client.query(
              "SELECT extra_price_paise FROM product_variants WHERE id = $1",
              [line.variantId]
            );
            basePaise += Number(varRes.rows[0]?.extra_price_paise || 0);
          }
          lineUnitPricePaise = basePaise;
        }

        // Default Tax Rule (GST 18%) if not provided
        let taxRuleId = line.taxRuleId;
        if (!taxRuleId) {
          const trRes = await client.query("SELECT id FROM tax_rules LIMIT 1");
          taxRuleId = trRes.rows[0]?.id || null;
        }

        await client.query(
          `INSERT INTO subscription_lines (
            subscription_id, product_id, variant_id, quantity, unit_price_paise, tax_rule_id
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [newSub.id, line.productId, line.variantId || null, line.quantity, lineUnitPricePaise, taxRuleId]
        );

        initialSubtotalPaise += line.quantity * lineUnitPricePaise;
      }

      // Record Created Event in Audit Ledger
      await client.query(
        `INSERT INTO subscription_events (
          subscription_id, event_type, mrr_before_paise, mrr_after_paise, actor_id, meta
        ) VALUES ($1, 'created', 0, $2, $3, $4)`,
        [
          newSub.id,
          initialSubtotalPaise,
          user.id,
          JSON.stringify({ notes: "Quotation draft created" }),
        ]
      );

      return newSub;
    });

    return reply.status(201).send({ data: res });
  });

  /* =======================================================================
   * STATE TRANSITION ACTION (Draft -> Quotation -> Confirmed -> Active -> Closed)
   * ======================================================================= */
  app.post(
    "/subscriptions/:id/transition",
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const db = await getDb();
      const user = request.user!;
      const subId = parseInt(request.params.id, 10);

      const bodySchema = z.object({
        action: z.enum(["send_quotation", "confirm", "activate", "pause", "resume", "close"]),
        closeReason: z.string().optional(),
      });
      const body = bodySchema.parse(request.body);

      const res = await db.withTransaction(async (client) => {
        // Fetch current subscription
        const subRes = await client.query(
          `SELECT s.*, p.pausable, p.closable
           FROM subscriptions s
           JOIN plans p ON s.plan_id = p.id
           WHERE s.id = $1 FOR UPDATE`,
          [subId]
        );

        if (subRes.rows.length === 0) {
          throw new AppError("NOT_FOUND", "Subscription not found");
        }

        const sub = subRes.rows[0];
        const currentStatus = sub.status as SubscriptionStatus;

        let targetStatus: SubscriptionStatus;
        let eventType: string = "updated";

        switch (body.action) {
          case "send_quotation":
            if (currentStatus !== "draft") {
              throw new AppError("ILLEGAL_TRANSITION", `Cannot send quotation from status ${currentStatus}`);
            }
            targetStatus = "quotation";
            eventType = "quote_created";
            break;

          case "confirm":
            if (currentStatus !== "draft" && currentStatus !== "quotation") {
              throw new AppError("ILLEGAL_TRANSITION", `Cannot confirm subscription from status ${currentStatus}`);
            }
            targetStatus = "confirmed";
            eventType = "created";
            break;

          case "activate":
            if (currentStatus !== "confirmed") {
              throw new AppError("ILLEGAL_TRANSITION", `Cannot activate subscription from status ${currentStatus}`);
            }
            targetStatus = "active";
            eventType = "activated";
            break;

          case "pause":
            if (currentStatus !== "active") {
              throw new AppError("ILLEGAL_TRANSITION", "Only active subscriptions can be paused");
            }
            if (!sub.pausable) {
              throw new AppError("FORBIDDEN", "This plan does not permit pausing");
            }
            targetStatus = "paused";
            eventType = "paused";
            break;

          case "resume":
            if (currentStatus !== "paused") {
              throw new AppError("ILLEGAL_TRANSITION", "Only paused subscriptions can be resumed");
            }
            targetStatus = "active";
            eventType = "resumed";
            break;

          case "close":
            if (currentStatus === "closed") {
              throw new AppError("ILLEGAL_TRANSITION", "Subscription is already closed");
            }
            if (!sub.closable) {
              throw new AppError("FORBIDDEN", "This plan does not permit early closure");
            }
            targetStatus = "closed";
            eventType = "closed";
            break;

          default:
            throw new AppError("VALIDATION_FAILED", "Unknown transition action");
        }

        // Apply state transition
        const updates: string[] = ["status = $1", "version = version + 1", "updated_at = now()"];
        const params: unknown[] = [targetStatus];

        if (targetStatus === "paused") {
          updates.push("paused_at = now()");
        } else if (targetStatus === "active" && currentStatus === "paused") {
          updates.push("paused_at = NULL");
        }

        if (targetStatus === "closed") {
          params.push(new Date().toISOString());
          updates.push(`closed_at = $${params.length}`);
          params.push(body.closeReason || "Closed by operator");
          updates.push(`close_reason = $${params.length}`);
        }

        params.push(subId);
        const updateSql = `UPDATE subscriptions SET ${updates.join(", ")} WHERE id = $${params.length} RETURNING *`;
        const updatedRes = await client.query(updateSql, params);
        const updatedSub = updatedRes.rows[0];

        // Record Audit Event
        const subtotalRes = await client.query(
          `SELECT COALESCE(SUM(quantity * unit_price_paise), 0) as total
           FROM subscription_lines WHERE subscription_id = $1`,
          [subId]
        );
        const mrrPaise = Number(subtotalRes.rows[0].total);

        // Map eventType to enum
        let validEventType = "created";
        if (targetStatus === "active") validEventType = "activated";
        if (targetStatus === "paused") validEventType = "paused";
        if (targetStatus === "closed") validEventType = "closed";
        if (currentStatus === "paused" && targetStatus === "active") validEventType = "resumed";

        await client.query(
          `INSERT INTO subscription_events (
            subscription_id, event_type, mrr_before_paise, mrr_after_paise, actor_id, meta
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            subId,
            validEventType,
            currentStatus === "active" ? mrrPaise : 0,
            targetStatus === "active" ? mrrPaise : 0,
            user.id,
            JSON.stringify({
              action: body.action,
              fromStatus: currentStatus,
              toStatus: targetStatus,
              reason: body.closeReason,
            }),
          ]
        );

        return updatedSub;
      });

      return reply.status(200).send({ data: res });
    }
  );

  /* =======================================================================
   * LIST CUSTOMERS FOR OPERATIONS
   * ======================================================================= */
  app.get("/customers", async (_req: FastifyRequest, reply: FastifyReply) => {
    const db = await getDb();
    const res = await db.query(
      `SELECT id, company_name as "companyName", contact_name as "contactName",
              contact_email as "contactEmail", phone, gstin, billing_address as "billingAddress"
       FROM customers WHERE deleted_at IS NULL ORDER BY company_name ASC`
    );
    return reply.status(200).send({ data: res.rows });
  });
}

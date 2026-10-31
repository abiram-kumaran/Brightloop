import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { getDb } from "../../db/pool.js";
import { authenticate } from "../../common/auth.js";
import { AppError } from "../../common/errors.js";
import { formatINR } from "@brightloop/shared";

const chatInputSchema = z.object({
  sessionId: z.number().optional(),
  message: z.string().trim().min(1).max(500),
});

const ticketInputSchema = z.object({
  subject: z.string().min(2).max(200),
  message: z.string().min(2).max(4000),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  subscriptionId: z.number().optional(),
  invoiceId: z.number().optional(),
});

export async function supportRoutes(app: FastifyInstance) {
  // POST /api/v1/support/chat - Intelligent support assistant
  app.post("/support/chat", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authenticate(request);
    const body = chatInputSchema.parse(request.body);
    const db = await getDb();

    // Verify or create customer record
    let customerId = user.customerId;
    if (!customerId) {
      const custRes = await db.query(
        "SELECT id FROM customers WHERE user_id = $1 LIMIT 1",
        [user.id]
      );
      customerId = custRes.rows[0]?.id;
    }

    if (!customerId) {
      throw new AppError("BAD_REQUEST", "No associated customer record found");
    }

    // Get or start chat session
    let sessionId = body.sessionId;
    if (!sessionId) {
      const sessRes = await db.query(
        `INSERT INTO chat_sessions (customer_id) VALUES ($1) RETURNING id`,
        [customerId]
      );
      sessionId = sessRes.rows[0].id;
    }

    // Save user message
    await db.query(
      `INSERT INTO chat_messages (session_id, role, content) VALUES ($1, 'user', $2)`,
      [sessionId, body.message]
    );

    // Context analysis for the logged-in customer
    const text = body.message.toLowerCase();

    // 1. Fetch active subscriptions for customer
    const subsRes = await db.query(
      `SELECT s.id, p.name as plan_name, s.status, s.next_invoice_date, s.mrr_paise
       FROM subscriptions s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.customer_id = $1 AND s.deleted_at IS NULL
       ORDER BY s.id DESC`,
      [customerId]
    );

    // 2. Fetch pending invoices for customer
    const invRes = await db.query(
      `SELECT id, number, status, due_date, total_paise, amount_due_paise
       FROM invoices
       WHERE customer_id = $1 AND status <> 'cancelled'
       ORDER BY id DESC LIMIT 5`,
      [customerId]
    );

    let botResponse = "";
    let detectedIntent = "general_inquiry";
    let escalatedTicketId: number | null = null;

    if (text.includes("balance") || text.includes("due") || text.includes("pay") || text.includes("outstanding")) {
      detectedIntent = "check_balance";
      const totalDue = invRes.rows.reduce(
        (sum: number, r: any) => sum + Number(r.amount_due_paise || 0),
        0
      );
      if (totalDue === 0) {
        botResponse = `Good news! Your account is fully settled. You have ₹0.00 in outstanding balance across all subscriptions.`;
      } else {
        const pendingList = invRes.rows
          .filter((i: any) => i.amount_due_paise > 0)
          .map((i: any) => `Invoice ${i.number}: ${formatINR(i.amount_due_paise)} due on ${new Date(i.due_date).toLocaleDateString()}`)
          .join("\n- ");
        botResponse = `You currently have an outstanding balance of ${formatINR(totalDue)}.\n\nPending items:\n- ${pendingList}\n\nYou can pay via Bank Transfer, UPI, or Card from your 'Invoices & Receipts' tab!`;
      }
    } else if (text.includes("next bill") || text.includes("renewal") || text.includes("renew") || text.includes("when will i be billed")) {
      detectedIntent = "next_billing_date";
      const activeSubs = subsRes.rows.filter((s: any) => s.status === "active");
      if (activeSubs.length === 0) {
        botResponse = "You currently have no active recurring subscriptions. You can request a new quotation from your representative.";
      } else {
        const subDetails = activeSubs
          .map((s: any) => `${s.plan_name}: next billing cycle begins on ${new Date(s.next_invoice_date).toLocaleDateString()}`)
          .join("\n- ");
        botResponse = `Here is your upcoming billing schedule:\n- ${subDetails}\n\nInvoices are automatically generated on your billing anchor date.`;
      }
    } else if (text.includes("pause") || text.includes("cancel") || text.includes("resume")) {
      detectedIntent = "subscription_action_policy";
      botResponse = `Brightloop supports pausing and early closure depending on your plan's terms.\n\nTo pause or update your subscription, please submit a quick request ticket or speak with your account team. Would you like me to open a support ticket for your representative?`;
    } else if (text.includes("ticket") || text.includes("human") || text.includes("representative") || text.includes("support") || text.includes("help") || text.includes("complaint")) {
      detectedIntent = "escalate_to_ticket";
      const ticketRes = await db.query(
        `INSERT INTO support_tickets (customer_id, subject, priority, source)
         VALUES ($1, $2, 'normal', 'chat')
         RETURNING id, number`,
        [customerId, `Chat Assistant Request: ${body.message.slice(0, 50)}...`]
      );
      escalatedTicketId = ticketRes.rows[0].id;
      const ticketNumber = ticketRes.rows[0].number;

      // Save initial message to ticket
      await db.query(
        `INSERT INTO ticket_messages (ticket_id, author_type, author_user_id, body)
         VALUES ($1, 'customer', $2, $3)`,
        [escalatedTicketId, user.id, body.message]
      );

      // Link ticket to session
      await db.query(
        `UPDATE chat_sessions SET escalated_ticket_id = $1 WHERE id = $2`,
        [escalatedTicketId, sessionId]
      );

      botResponse = `I have logged a priority support ticket for you (#${ticketNumber}). Our operations team has been notified and will follow up with you promptly.`;
    } else {
      botResponse = `Hello! I am your Brightloop Virtual Assistant. I can help you check your account balance, view upcoming invoice dates, explain billing breakdown, or connect you directly with internal staff support. How can I help you today?`;
    }

    // Save bot response
    await db.query(
      `INSERT INTO chat_messages (session_id, role, content, intent) VALUES ($1, 'assistant', $2, $3)`,
      [sessionId, botResponse, detectedIntent]
    );

    return reply.status(200).send({
      data: {
        sessionId,
        role: "assistant",
        content: botResponse,
        intent: detectedIntent,
        ticketId: escalatedTicketId,
      },
    });
  });

  // GET /api/v1/support/tickets - Customer & Staff tickets
  app.get("/support/tickets", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authenticate(request);
    const db = await getDb();

    let sql = `
      SELECT
        t.id,
        t.number,
        t.customer_id,
        c.name as customer_name,
        c.email as customer_email,
        t.subject,
        t.status,
        t.priority,
        t.source,
        t.created_at,
        t.updated_at
      FROM support_tickets t
      JOIN customers c ON t.customer_id = c.id
    `;
    const params: any[] = [];

    if (user.role === "customer") {
      let custId = user.customerId;
      if (!custId) {
        const custRes = await db.query(
          "SELECT id FROM customers WHERE user_id = $1 LIMIT 1",
          [user.id]
        );
        custId = custRes.rows[0]?.id;
      }
      params.push(custId || -1);
      sql += ` WHERE t.customer_id = $1`;
    }

    sql += ` ORDER BY t.created_at DESC`;
    const res = await db.query(sql, params);

    return reply.status(200).send({ data: res.rows });
  });

  // POST /api/v1/support/tickets - Create new ticket
  app.post("/support/tickets", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authenticate(request);
    const body = ticketInputSchema.parse(request.body);
    const db = await getDb();

    let customerId = user.customerId;
    if (!customerId && user.role === "customer") {
      const custRes = await db.query(
        "SELECT id FROM customers WHERE user_id = $1 LIMIT 1",
        [user.id]
      );
      customerId = custRes.rows[0]?.id;
    }

    if (!customerId) {
      throw new AppError("BAD_REQUEST", "Customer record required to file a ticket");
    }

    const tktRes = await db.query(
      `INSERT INTO support_tickets (customer_id, subject, priority, subscription_id, invoice_id, source)
       VALUES ($1, $2, $3, $4, $5, 'portal')
       RETURNING id, number`,
      [customerId, body.subject, body.priority, body.subscriptionId || null, body.invoiceId || null]
    );

    const ticketId = tktRes.rows[0].id;

    // Add first message
    await db.query(
      `INSERT INTO ticket_messages (ticket_id, author_type, author_user_id, body)
       VALUES ($1, 'customer', $2, $3)`,
      [ticketId, user.id, body.message]
    );

    return reply.status(201).send({
      data: {
        id: ticketId,
        number: tktRes.rows[0].number,
        message: "Ticket opened successfully",
      },
    });
  });
}

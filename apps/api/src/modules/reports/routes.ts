import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { getDb } from "../../db/pool.js";
import { authenticate, requirePermission } from "../../common/auth.js";
import { AppError } from "../../common/errors.js";

export async function reportRoutes(app: FastifyInstance) {
  // GET /api/v1/reports/summary - Core KPIs
  app.get("/reports/summary", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authenticate(request);
    if (user.role === "customer") {
      throw new AppError("FORBIDDEN", "Customers cannot access business reports");
    }

    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    // 1. Active Subscriptions Count & MRR
    const activeSubsRes = await db.query(
      `SELECT
        COUNT(*)::int as active_count,
        COALESCE(SUM(s.mrr_paise), 0)::bigint as total_mrr_paise
       FROM subscriptions s
       WHERE s.status = 'active' AND s.deleted_at IS NULL`
    );

    // 2. Collected Revenue (Sum of all posted payments)
    const revRes = await db.query(
      `SELECT
        COALESCE(SUM(amount_paise), 0)::bigint as collected_revenue_paise,
        COUNT(*)::int as total_transactions
       FROM payments
       WHERE status = 'posted'`
    );

    // 3. Outstanding Balance (Confirmed Invoices remaining due)
    const outRes = await db.query(
      `SELECT
        COALESCE(SUM(amount_due_paise), 0)::bigint as outstanding_paise,
        COUNT(*)::int as pending_invoices_count
       FROM invoices
       WHERE status = 'confirmed'`
    );

    // 4. Overdue Invoices
    const overdueRes = await db.query(
      `SELECT
        COALESCE(SUM(amount_due_paise), 0)::bigint as overdue_paise,
        COUNT(*)::int as overdue_count
       FROM invoices
       WHERE status = 'confirmed' AND due_date < $1`,
      [today]
    );

    // 5. Total Invoiced Amount
    const totalInvRes = await db.query(
      `SELECT
        COALESCE(SUM(total_paise), 0)::bigint as total_invoiced_paise,
        COUNT(*)::int as total_invoices_count
       FROM invoices
       WHERE status <> 'cancelled'`
    );

    // 6. Recent Revenue Trend by Month
    const trendRes = await db.query(
      `SELECT
        to_char(paid_on, 'YYYY-MM') as month,
        SUM(amount_paise)::bigint as revenue_paise,
        COUNT(*)::int as count
       FROM payments
       WHERE status = 'posted'
       GROUP BY to_char(paid_on, 'YYYY-MM')
       ORDER BY month ASC
       LIMIT 12`
    );

    return reply.status(200).send({
      data: {
        asOfDate: today,
        kpi: {
          activeSubscriptions: activeSubsRes.rows[0]?.active_count || 0,
          currentMrrPaise: Number(activeSubsRes.rows[0]?.total_mrr_paise || 0),
          collectedRevenuePaise: Number(revRes.rows[0]?.collected_revenue_paise || 0),
          outstandingPaise: Number(outRes.rows[0]?.outstanding_paise || 0),
          overduePaise: Number(overdueRes.rows[0]?.overdue_paise || 0),
          overdueCount: overdueRes.rows[0]?.overdue_count || 0,
          totalInvoicedPaise: Number(totalInvRes.rows[0]?.total_invoiced_paise || 0),
          totalTransactions: revRes.rows[0]?.total_transactions || 0,
        },
        monthlyRevenueTrend: trendRes.rows.map((r: any) => ({
          month: r.month,
          revenuePaise: Number(r.revenue_paise),
          count: r.count,
        })),
      },
    });
  });

  // GET /api/v1/reports/overdue - Overdue Aging List
  app.get("/reports/overdue", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authenticate(request);
    if (user.role === "customer") {
      throw new AppError("FORBIDDEN", "Forbidden");
    }

    const db = await getDb();
    const today = new Date().toISOString().slice(0, 10);

    const res = await db.query(
      `SELECT
        i.id,
        i.number,
        i.customer_id,
        c.name as customer_name,
        c.email as customer_email,
        i.issue_date,
        i.due_date,
        i.total_paise,
        i.amount_due_paise,
        ($1::date - i.due_date) as days_overdue
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.status = 'confirmed' AND i.due_date < $1
       ORDER BY i.due_date ASC`,
      [today]
    );

    return reply.status(200).send({
      data: res.rows.map((r: any) => ({
        id: r.id,
        number: r.number,
        customerId: r.customer_id,
        customerName: r.customer_name,
        customerEmail: r.customer_email,
        issueDate: r.issue_date,
        dueDate: r.due_date,
        totalPaise: Number(r.total_paise),
        amountDuePaise: Number(r.amount_due_paise),
        daysOverdue: Number(r.days_overdue),
      })),
    });
  });

  // GET /api/v1/reports/mrr-waterfall
  app.get("/reports/mrr-waterfall", async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await authenticate(request);
    if (user.role === "customer") {
      throw new AppError("FORBIDDEN", "Forbidden");
    }

    const db = await getDb();

    // Query events from subscription_events
    const res = await db.query(
      `SELECT
        event_type,
        COALESCE(SUM(mrr_after_paise - mrr_before_paise), 0)::bigint as net_mrr_delta_paise,
        COUNT(*)::int as count
       FROM subscription_events
       GROUP BY event_type`
    );

    return reply.status(200).send({
      data: res.rows.map((r: any) => ({
        eventType: r.event_type,
        netMrrDeltaPaise: Number(r.net_mrr_delta_paise),
        count: r.count,
      })),
    });
  });
}

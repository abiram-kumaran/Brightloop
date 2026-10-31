import { z } from "zod";

export const reportFilterSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerId: z.coerce.number().int().optional(),
});

export type ReportFilter = z.infer<typeof reportFilterSchema>;

export interface DashboardSummary {
  activeSubscriptionsCount: number;
  totalCollectedRevenuePaise: number;
  totalOutstandingPaise: number;
  totalOverduePaise: number;
  overdueInvoicesCount: number;
  totalInvoicesCount: number;
  mrrPaise: number;
}

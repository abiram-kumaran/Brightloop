import { z } from "zod";

export const billingRunSchema = z.object({
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dryRun: z.boolean().default(false),
});

export type BillingRunInput = z.infer<typeof billingRunSchema>;

export const invoiceActionSchema = z.object({
  action: z.enum(["confirm", "cancel", "send"]),
  reason: z.string().trim().optional(),
});

export type InvoiceActionInput = z.infer<typeof invoiceActionSchema>;

export const creditNoteSchema = z.object({
  invoiceId: z.number().int(),
  amountPaise: z.number().int().positive("Credit note amount must be positive"),
  reason: z.string().trim().min(3, "Reason is required"),
});

export type CreditNoteInput = z.infer<typeof creditNoteSchema>;

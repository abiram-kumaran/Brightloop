import { z } from "zod";

export const recordPaymentSchema = z.object({
  invoiceId: z.number().int(),
  amountPaise: z.number().int().positive("Payment amount must be greater than zero"),
  method: z.enum(["cash", "bank_transfer", "upi", "card", "cheque", "other"]),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  note: z.string().trim().optional(),
  idempotencyKey: z.string().trim().optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

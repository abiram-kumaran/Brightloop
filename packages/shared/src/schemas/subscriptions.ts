import { z } from "zod";

export const subscriptionLineInputSchema = z.object({
  productId: z.number().int(),
  variantId: z.number().int().optional().nullable(),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
  unitPricePaise: z.number().int().nonnegative().optional(), // if omitted, resolved from product + variant
  taxRuleId: z.number().int().optional().nullable(),
});

export const createQuotationSchema = z.object({
  customerId: z.number().int(),
  planId: z.number().int(),
  templateId: z.number().int().optional().nullable(),
  validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD").optional(),
  lines: z.array(subscriptionLineInputSchema).min(1, "At least one product line is required"),
  notes: z.string().trim().optional(),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;

export const subscriptionActionSchema = z.object({
  action: z.enum(["send-quotation", "confirm", "activate", "pause", "resume", "close", "renew"]),
  reason: z.string().trim().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export type SubscriptionActionInput = z.infer<typeof subscriptionActionSchema>;

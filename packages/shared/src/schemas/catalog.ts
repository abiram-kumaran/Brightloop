import { z } from "zod";

export const productSchema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(160),
  type: z.enum(["service", "software", "addon", "physical"]),
  salesPricePaise: z.number().int().nonnegative("Sales price cannot be negative"),
  costPricePaise: z.number().int().nonnegative("Cost price cannot be negative").default(0),
  notes: z.string().trim().optional(),
  taxRuleId: z.number().int().optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export const productVariantSchema = z.object({
  attribute: z.string().trim().min(1, "Attribute name is required").max(60),
  value: z.string().trim().min(1, "Attribute value is required").max(80),
  extraPricePaise: z.number().int().nonnegative("Extra price cannot be negative").default(0),
});

export type ProductVariantInput = z.infer<typeof productVariantSchema>;

export const taxRuleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  ratePercent: z.number().min(0).max(100),
  isActive: z.boolean().default(true),
});

export type TaxRuleInput = z.infer<typeof taxRuleSchema>;

export const planSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().optional(),
  billingPeriod: z.enum(["daily", "weekly", "monthly", "yearly"]),
  pricePaise: z.number().int().nonnegative(),
  minQuantity: z.number().int().min(1).default(1),
  availableFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD"),
  availableUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD").optional().nullable(),
  autoClose: z.boolean().default(false),
  closable: z.boolean().default(true),
  pausable: z.boolean().default(true),
  renewable: z.boolean().default(true),
  productIds: z.array(z.number().int()).default([]),
});

export type PlanInput = z.infer<typeof planSchema>;

export const quotationTemplateLineSchema = z.object({
  productId: z.number().int(),
  variantId: z.number().int().optional().nullable(),
  defaultQuantity: z.number().int().min(1).default(1),
  unitPricePaise: z.number().int().nonnegative().optional(),
});

export const quotationTemplateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  planId: z.number().int(),
  validityDays: z.number().int().min(1).default(30),
  lines: z.array(quotationTemplateLineSchema).min(1, "Template must include at least one product line"),
});

export type QuotationTemplateInput = z.infer<typeof quotationTemplateSchema>;

export const discountSchema = z.object({
  name: z.string().trim().min(2).max(120),
  discountType: z.enum(["fixed", "percentage"]),
  value: z.number().positive("Value must be greater than zero"),
  scope: z.enum(["product", "subscription"]),
  minPurchasePaise: z.number().int().nonnegative().default(0),
  minQuantity: z.number().int().min(1).default(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  usageLimit: z.number().int().positive().optional().nullable(),
  productIds: z.array(z.number().int()).optional(),
});

export type DiscountInput = z.infer<typeof discountSchema>;

export const customerSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email().toLowerCase().optional(),
  phone: z.string().trim().max(20).optional(),
  gstin: z.string().trim().max(15).optional(),
  billingAddress: z.string().trim().optional(),
  stateCode: z.string().trim().length(2).default("33"),
});


// Schema aliases for flexible usage
export const createProductSchema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(160),
  type: z.enum(["service", "software", "addon", "physical"]),
  salesPrice: z.number().nonnegative(),
  costPrice: z.number().nonnegative().default(0),
  notes: z.string().trim().optional(),
  taxRuleId: z.number().int().optional(),
  variants: z
    .array(
      z.object({
        name: z.string().optional(),
        attribute: z.string().optional(),
        value: z.string().optional(),
        priceAdjustment: z.number().default(0),
      })
    )
    .optional(),
});

export const createPlanSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().optional(),
  billingFrequency: z.enum(["daily", "weekly", "monthly", "yearly"]),
  billingIntervalInteger: z.number().int().min(1).default(1),
  minQuantity: z.number().int().min(1).default(1),
  availableFrom: z.string().optional().nullable(),
  availableUntil: z.string().optional().nullable(),
  autoClose: z.boolean().default(false),
  allowEarlyClose: z.boolean().default(true),
  allowPause: z.boolean().default(true),
  allowRenewal: z.boolean().default(true),
  productIds: z.array(z.number().int()).default([]),
});

export const createTaxRuleSchema = taxRuleSchema;

export const createDiscountRuleSchema = z.object({
  code: z.string().trim().min(2).max(40),
  name: z.string().trim().min(2).max(120),
  type: z.enum(["fixed", "percentage"]),
  value: z.number().positive(),
  discountScope: z.enum(["product", "subscription"]),
  minAmount: z.number().nonnegative().optional(),
  isActive: z.boolean().default(true),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
});
export type CustomerInput = z.infer<typeof customerSchema>;

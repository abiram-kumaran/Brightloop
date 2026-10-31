export type SubscriptionStatus =
  | "draft"
  | "quotation"
  | "confirmed"
  | "active"
  | "paused"
  | "closed";

export type InvoiceStatus = "draft" | "confirmed" | "paid" | "cancelled";

export type CreditNoteStatus = "draft" | "submitted" | "approved" | "rejected" | "applied";

export const SUBSCRIPTION_TRANSITIONS: Record<
  SubscriptionStatus,
  { allowed: SubscriptionStatus[]; action: string }
> = {
  draft: { allowed: ["quotation"], action: "send-quotation" },
  quotation: { allowed: ["confirmed", "closed"], action: "confirm" },
  confirmed: { allowed: ["active"], action: "activate" },
  active: { allowed: ["paused", "closed"], action: "pause-or-close" },
  paused: { allowed: ["active", "closed"], action: "resume-or-close" },
  closed: { allowed: [], action: "none" },
};

export const INVOICE_TRANSITIONS: Record<
  InvoiceStatus,
  { allowed: InvoiceStatus[]; action: string }
> = {
  draft: { allowed: ["confirmed", "cancelled"], action: "confirm-or-cancel" },
  confirmed: { allowed: ["paid", "cancelled"], action: "pay-or-cancel" },
  paid: { allowed: ["confirmed"], action: "reverse-payment" },
  cancelled: { allowed: [], action: "none" },
};

export function assertValidSubscriptionTransition(
  from: SubscriptionStatus,
  to: SubscriptionStatus
): void {
  const transition = SUBSCRIPTION_TRANSITIONS[from];
  if (!transition || !transition.allowed.includes(to)) {
    throw new Error(
      `Illegal subscription transition from '${from}' to '${to}'. Allowed: [${transition?.allowed.join(", ") || "none"}]`
    );
  }
}

export function assertValidInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus
): void {
  const transition = INVOICE_TRANSITIONS[from];
  if (!transition || !transition.allowed.includes(to)) {
    throw new Error(
      `Illegal invoice transition from '${from}' to '${to}'. Allowed: [${transition?.allowed.join(", ") || "none"}]`
    );
  }
}

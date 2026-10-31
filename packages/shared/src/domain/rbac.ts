export type UserRole = "admin" | "manager" | "staff" | "customer";

export const PERMISSIONS = {
  USERS_MANAGE: "users.manage",
  CATALOG_READ: "catalog.read",
  CATALOG_WRITE: "catalog.write",
  PLANS_WRITE: "plans.write",
  TEMPLATES_WRITE: "templates.write",
  TAX_MANAGE: "tax.manage",
  DISCOUNTS_MANAGE: "discounts.manage",
  CUSTOMERS_READ: "customers.read",
  CUSTOMERS_WRITE: "customers.write",
  SUBSCRIPTIONS_READ: "subscriptions.read",
  SUBSCRIPTIONS_WRITE: "subscriptions.write",
  SUBSCRIPTIONS_TRANSITION: "subscriptions.transition",
  BILLING_RUN: "billing.run",
  INVOICES_READ: "invoices.read",
  INVOICES_WRITE: "invoices.write",
  INVOICES_CONFIRM: "invoices.confirm",
  INVOICES_CANCEL: "invoices.cancel",
  INVOICES_SEND: "invoices.send",
  PAYMENTS_RECORD: "payments.record",
  PAYMENTS_REVERSE: "payments.reverse",
  CREDIT_NOTES_RAISE: "credit_notes.raise",
  CREDIT_NOTES_APPROVE: "credit_notes.approve",
  REPORTS_READ: "reports.read",
  REPORTS_EXPORT: "reports.export",
  AUDIT_READ: "audit.read",
  TICKETS_READ: "tickets.read",
  TICKETS_WRITE: "tickets.write",
  TICKETS_ASSIGN: "tickets.assign",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface AuthUser {
  id: number;
  email: string;
  fullName: string;
  role: UserRole;
  customerId?: number;
  permissions: string[];
}

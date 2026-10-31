import React from "react";

export type BadgeVariant =
  | "active"
  | "paid"
  | "confirmed"
  | "draft"
  | "quotation"
  | "pending"
  | "overdue"
  | "cancelled"
  | "paused"
  | "closed"
  | "info";

export function Badge({
  children,
  variant = "draft",
  className = "",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  const variantStyles: Record<BadgeVariant, string> = {
    active: "bg-semantic-successBg text-semantic-success border-semantic-success/20",
    paid: "bg-semantic-successBg text-semantic-success border-semantic-success/20",
    confirmed: "bg-brand-creamDeep text-brand-forest border-brand-taupe",
    draft: "bg-brand-creamDeep text-text-secondary border-border-default",
    quotation: "bg-brand-creamDeep text-brand-forest border-brand-forest/30 font-medium",
    pending: "bg-semantic-warningBg text-semantic-warning border-semantic-warning/20",
    overdue: "bg-semantic-dangerBg text-semantic-danger border-semantic-danger/30 font-semibold",
    cancelled: "bg-brand-creamDeep text-text-muted border-border-default line-through",
    closed: "bg-brand-creamDeep text-text-muted border-border-default",
    paused: "bg-amber-100 text-amber-800 border-amber-300 font-medium",
    info: "bg-semantic-infoBg text-semantic-info border-semantic-info/20",
  };

  const style = (variant && variantStyles[variant]) || variantStyles.draft;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border uppercase tracking-wider ${style} ${className}`}
    >
      {children}
    </span>
  );
}

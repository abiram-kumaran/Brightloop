import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchApi } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Badge, BadgeVariant } from "../../components/ui/Badge.js";
import { Button } from "../../components/ui/Button.js";
import { ErrorBoundary } from "../../components/ErrorBoundary.js";
import {
  Layers,
  FileText,
  CreditCard,
  ArrowRight,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

interface PortalSubscription {
  id: number;
  number: string;
  planName: string;
  status: string;
  billingPeriod?: string;
  anchorDay?: number;
  nextInvoiceDate?: string | null;
  startDate?: string | null;
  mrrPaise?: number | string | null;
  totalPaise?: number | string | null;
  subtotalPaise?: number | string | null;
}

interface PortalInvoice {
  id: number;
  number: string;
  status: string;
  dueDate?: string | null;
  totalPaise?: number | string | null;
  amountDuePaise?: number | string | null;
  amountPaidPaise?: number | string | null;
}

interface PortalPayment {
  id: number;
  status: string;
  amountPaise?: number | string | null;
}

const safeFormatDate = (dateVal?: string | null): string => {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

export function PortalDashboardPage() {
  const [subscriptions, setSubscriptions] = useState<PortalSubscription[]>([]);
  const [invoices, setInvoices] = useState<PortalInvoice[]>([]);
  const [payments, setPayments] = useState<PortalPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [subRes, invRes, payRes] = await Promise.all([
          fetchApi<PortalSubscription[] | { data: PortalSubscription[] }>("/subscriptions"),
          fetchApi<PortalInvoice[] | { data: PortalInvoice[] }>("/invoices"),
          fetchApi<PortalPayment[] | { data: PortalPayment[] }>("/payments"),
        ]);

        if (!isMounted) return;

        const subsList = Array.isArray(subRes)
          ? subRes
          : subRes && typeof subRes === "object" && "data" in subRes && Array.isArray(subRes.data)
            ? subRes.data
            : [];
        const invsList = Array.isArray(invRes)
          ? invRes
          : invRes && typeof invRes === "object" && "data" in invRes && Array.isArray(invRes.data)
            ? invRes.data
            : [];
        const paysList = Array.isArray(payRes)
          ? payRes
          : payRes && typeof payRes === "object" && "data" in payRes && Array.isArray(payRes.data)
            ? payRes.data
            : [];

        setSubscriptions(subsList);
        setInvoices(invsList);
        setPayments(paysList);
      } catch (err: unknown) {
        if (!isMounted) return;
        const msg = err instanceof Error ? err.message : "Failed to load dashboard data";
        console.error("Failed to load portal data:", err);
        setLoadError(msg);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  const activeSubs = subscriptions.filter((s) => s && s.status === "active");
  const totalDuePaise = invoices
    .filter((i) => i && i.status === "confirmed")
    .reduce((sum, i) => sum + (Number(i.amountDuePaise) || 0), 0);
  const totalPaidPaise = payments
    .filter((p) => p && p.status === "posted")
    .reduce((sum, p) => sum + (Number(p.amountPaise) || 0), 0);

  return (
    <ErrorBoundary title="Customer Dashboard Error" message="Unable to load customer overview. Please refresh.">
      <div className="space-y-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-brand-forest to-brand-moss text-text-inverse p-8 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="max-w-2xl">
            <span className="text-brand-taupe text-xs uppercase font-bold tracking-widest">
              Customer Self-Service Hub
            </span>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold mt-1 tracking-tight">
              Welcome to Brightloop
            </h1>
            <p className="text-brand-cream/80 text-sm sm:text-base mt-2">
              Manage your active subscription plans, inspect detailed tax invoices, review payments, and connect directly with dedicated support.
            </p>
          </div>
        </div>

        {loadError && (
          <div className="bg-semantic-dangerBg border border-semantic-danger/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-semantic-danger">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span className="text-sm font-medium">{loadError}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
              className="flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
              <span>Active Subscriptions</span>
              <Layers className="w-4 h-4 text-brand-forest" />
            </div>
            <div className="mt-3 font-serif text-3xl font-bold text-text-primary">
              {isLoading ? "—" : activeSubs.length}
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              {isLoading ? "Loading..." : `${subscriptions.length} total lifetime subscriptions`}
            </div>
          </div>

          <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
              <span>Outstanding Balance</span>
              <FileText className="w-4 h-4 text-semantic-warning" />
            </div>
            <div className="mt-3 font-mono text-3xl font-bold text-semantic-danger">
              {isLoading ? "—" : formatINR(totalDuePaise)}
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              {isLoading
                ? "Loading..."
                : `${invoices.filter((i) => i.status === "confirmed").length} pending invoices`}
            </div>
          </div>

          <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
              <span>Lifetime Settled</span>
              <CreditCard className="w-4 h-4 text-semantic-success" />
            </div>
            <div className="mt-3 font-mono text-3xl font-bold text-semantic-success">
              {isLoading ? "—" : formatINR(totalPaidPaise)}
            </div>
            <div className="mt-2 text-xs text-text-secondary">
              {isLoading
                ? "Loading..."
                : `${payments.length} successful payment transactions`}
            </div>
          </div>
        </div>

        {/* Subscriptions Overview */}
        <div className="bg-surface-card border border-border-default rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold text-text-primary">
                Your Active Subscriptions
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Live recurring plans currently provisioned for your organization
              </p>
            </div>
            <Link
              to="/portal/subscriptions"
              className="text-xs font-semibold text-brand-forest hover:underline flex items-center gap-1"
            >
              View all ({subscriptions.length}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-text-secondary animate-pulse">
              Loading subscriptions...
            </div>
          ) : activeSubs.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">
              No active subscriptions found.
            </div>
          ) : (
            <div className="divide-y divide-border-default">
              {activeSubs.map((sub) => {
                const recurringPaise =
                  sub.mrrPaise || sub.totalPaise || sub.subtotalPaise || 0;
                return (
                  <div
                    key={sub.id}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-text-primary text-base">
                          {sub.planName || "Subscription Plan"}
                        </span>
                        <Badge variant={(sub.status || "draft") as BadgeVariant}>
                          {sub.status || "draft"}
                        </Badge>
                      </div>
                      <div className="text-xs text-text-secondary mt-1 font-mono">
                        Ref: {sub.number || `SUB-${sub.id}`} | Frequency:{" "}
                        {sub.billingPeriod || "monthly"} | Anchor: Day{" "}
                        {sub.anchorDay ?? 1}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        Next billing cycle: {safeFormatDate(sub.nextInvoiceDate)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono font-bold text-lg text-text-primary">
                        {formatINR(recurringPaise)} / mo
                      </div>
                      <Link
                        to="/portal/subscriptions"
                        className="text-xs font-medium text-brand-forest hover:underline"
                      >
                        Manage Subscription
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Invoices */}
        <div className="bg-surface-card border border-border-default rounded-xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-serif text-xl font-bold text-text-primary">
                Recent Invoices & Receipts
              </h2>
              <p className="text-xs text-text-secondary mt-0.5">
                Snapshot tax invoices issued with GST compliance
              </p>
            </div>
            <Link
              to="/portal/invoices"
              className="text-xs font-semibold text-brand-forest hover:underline flex items-center gap-1"
            >
              View all ({invoices.length}) <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-text-secondary animate-pulse">
              Loading invoices...
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-8 text-text-secondary text-sm">
              No invoices have been issued yet.
            </div>
          ) : (
            <div className="divide-y divide-border-default">
              {invoices.slice(0, 3).map((inv) => (
                <div key={inv.id} className="py-3.5 flex items-center justify-between">
                  <div>
                    <div className="font-mono font-semibold text-sm text-text-primary">
                      {inv.number || `INV-${inv.id}`}
                    </div>
                    <div className="text-xs text-text-secondary">
                      Due: {safeFormatDate(inv.dueDate)}
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono font-semibold text-sm text-text-primary">
                        {formatINR(inv.totalPaise || 0)}
                      </div>
                      <Badge variant={(inv.status || "draft") as BadgeVariant}>
                        {inv.status || "draft"}
                      </Badge>
                    </div>
                    <Link
                      to="/portal/invoices"
                      className="p-1.5 rounded bg-brand-cream hover:bg-brand-taupe/20 text-brand-forest transition"
                    >
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
}

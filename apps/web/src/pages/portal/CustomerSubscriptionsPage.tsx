import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchApi } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Badge, BadgeVariant } from "../../components/ui/Badge.js";
import { Button } from "../../components/ui/Button.js";
import { AlertCircle, RotateCcw } from "lucide-react";

interface SubscriptionItem {
  id: number;
  number: string;
  planName: string;
  status: string;
  billingPeriod?: string;
  anchorDay?: number;
  nextInvoiceDate?: string | null;
  startDate?: string | null;
  allowRenewal?: boolean;
  mrrPaise?: number | string | null;
  totalPaise?: number | string | null;
  subtotalPaise?: number | string | null;
}

const safeFormatDate = (dateVal?: string | null): string => {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

export function CustomerSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchApi<SubscriptionItem[] | { data: SubscriptionItem[] }>("/subscriptions")
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res)
          ? res
          : res && typeof res === "object" && "data" in res && Array.isArray(res.data)
            ? res.data
            : [];
        setSubscriptions(list);
      })
      .catch((e: unknown) => {
        if (!isMounted) return;
        const msg = e instanceof Error ? e.message : "Error loading subscriptions";
        console.error("Error loading subscriptions", e);
        setError(msg);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
            My Subscriptions
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review your enrolled recurring service plans, active terms, and billing renewal dates.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-semantic-dangerBg border border-semantic-danger/30 rounded-xl p-4 flex items-center justify-between gap-3 text-semantic-danger">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setReloadKey((k) => k + 1)}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Retry
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-text-secondary animate-pulse">
          Loading subscriptions...
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="text-center py-12 bg-surface-card border border-border-default rounded-lg">
          <p className="text-text-secondary">No subscriptions currently active.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subscriptions.map((sub) => {
            const recurringPaise =
              sub.mrrPaise || sub.totalPaise || sub.subtotalPaise || 0;
            return (
              <div
                key={sub.id}
                className="bg-surface-card border border-border-default rounded-xl p-6 shadow-sm space-y-4 hover:border-brand-forest/30 transition"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <Badge variant={(sub.status || "draft") as BadgeVariant}>
                      {sub.status || "draft"}
                    </Badge>
                    <h2 className="font-serif text-xl font-bold text-text-primary mt-2">
                      {sub.planName || "Subscription Plan"}
                    </h2>
                    <div className="font-mono text-xs text-text-secondary mt-0.5">
                      Ref: {sub.number || `SUB-${sub.id}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-xl text-text-primary">
                      {formatINR(recurringPaise)}
                    </div>
                    <div className="text-xs text-text-secondary uppercase">
                      per {sub.billingPeriod || "month"}
                    </div>
                  </div>
                </div>

                <div className="bg-brand-cream/60 p-3.5 rounded-lg border border-brand-taupe/30 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-text-secondary">Anchor Day:</span>
                    <div className="font-medium text-text-primary">
                      Day {sub.anchorDay ?? 1} of cycle
                    </div>
                  </div>
                  <div>
                    <span className="text-text-secondary">Next Invoice Date:</span>
                    <div className="font-medium text-text-primary font-mono">
                      {safeFormatDate(sub.nextInvoiceDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-text-secondary">Start Date:</span>
                    <div className="font-medium text-text-primary font-mono">
                      {safeFormatDate(sub.startDate)}
                    </div>
                  </div>
                  <div>
                    <span className="text-text-secondary">Renewal Policy:</span>
                    <div className="font-medium text-text-primary">
                      {sub.allowRenewal ? "Auto-renewable" : "Fixed term"}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-text-secondary">
                  To request plan upgrades, seat changes, or pause intervals, reach out directly through the{" "}
                  <Link to="/portal/support" className="text-brand-forest font-semibold hover:underline">
                    Support Assistant
                  </Link>.
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

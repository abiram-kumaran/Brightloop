import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Button } from "../../components/ui/Button.js";
import { Badge } from "../../components/ui/Badge.js";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  Send,
  Play,
  Pause,
  XCircle,
  FileText,
  ShieldCheck,
  Calendar,
  Layers,
  Receipt,
  User,
} from "lucide-react";

interface SubscriptionDetail {
  id: number;
  number: string;
  status: "draft" | "quotation" | "confirmed" | "active" | "paused" | "closed";
  startDate: string;
  expiryDate?: string;
  quoteValidUntil?: string;
  anchorDay: number;
  nextInvoiceDate?: string;
  lastBilledThrough?: string;
  pausedAt?: string;
  closedAt?: string;
  closeReason?: string;
  version: number;
  customer: {
    id: number;
    name: string;
    billingAddress?: string;
    gstin?: string;
  };
  plan: {
    id: number;
    name: string;
    billingPeriod: string;
    pausable: boolean;
    closable: boolean;
  };
  lines: {
    id: number;
    productName: string;
    variantName?: string;
    quantity: number;
    unitPricePaise: number;
    taxRate: number;
    taxName?: string;
    lineTotalPaise: number;
    lineTaxPaise: number;
    lineNetPaise: number;
  }[];
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  events: {
    id: number;
    eventType: string;
    mrrBeforePaise: number;
    mrrAfterPaise: number;
    occurredAt: string;
    actorName?: string;
    meta?: any;
  }[];
}

export function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [sub, setSub] = useState<SubscriptionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSubscription = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<SubscriptionDetail>(`/subscriptions/${id}`);
      setSub(data);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to load subscription details");
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscription();
  }, [id]);

  const handleTransition = async (action: string, reason?: string) => {
    try {
      await fetchApi(`/subscriptions/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action, closeReason: reason }),
      });
      loadSubscription();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-text-secondary text-sm animate-pulse">
        Loading subscription contract...
      </div>
    );
  }

  if (error || !sub) {
    return (
      <div className="p-8 text-center text-semantic-danger">
        {error || "Subscription not found"}
      </div>
    );
  }

  // Stepper stages
  const stages = ["draft", "quotation", "confirmed", "active", "closed"];
  const currentStageIdx = stages.indexOf(sub.status === "paused" ? "active" : sub.status);

  return (
    <div className="flex flex-col gap-8 max-w-5xl mx-auto">
      {/* Back button & Header */}
      <div className="flex flex-col gap-4 border-b border-border-subtle pb-6">
        <button
          onClick={() => navigate(-1)}
          className="self-start inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to List</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-text-primary">
              {sub.number}
            </h1>
            <Badge variant={sub.status}>{sub.status}</Badge>
            {sub.status === "paused" && (
              <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-medium">
                Billing Suspended
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {sub.status === "draft" && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleTransition("send_quotation")}
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                <span>Send Quotation</span>
              </Button>
            )}
            {sub.status === "quotation" && (
              <Button variant="primary" size="sm" onClick={() => handleTransition("confirm")}>
                <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                <span>Confirm Order</span>
              </Button>
            )}
            {sub.status === "confirmed" && (
              <Button variant="primary" size="sm" onClick={() => handleTransition("activate")}>
                <Play className="w-3.5 h-3.5 mr-1.5" />
                <span>Activate Subscription</span>
              </Button>
            )}
            {sub.status === "active" && sub.plan.pausable && (
              <Button variant="secondary" size="sm" onClick={() => handleTransition("pause")}>
                <Pause className="w-3.5 h-3.5 mr-1.5" />
                <span>Pause Billing</span>
              </Button>
            )}
            {sub.status === "paused" && (
              <Button variant="primary" size="sm" onClick={() => handleTransition("resume")}>
                <Play className="w-3.5 h-3.5 mr-1.5" />
                <span>Resume Billing</span>
              </Button>
            )}
            {["active", "paused", "confirmed"].includes(sub.status) && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  const reason = prompt("Enter reason for early termination:");
                  if (reason) handleTransition("close", reason);
                }}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                <span>Terminate</span>
              </Button>
            )}
          </div>
        </div>

        {/* Visual Lifecycle Stepper */}
        <div className="pt-4">
          <div className="relative flex items-center justify-between">
            {stages.map((stage, idx) => {
              const isCompleted = idx < currentStageIdx;
              const isCurrent = idx === currentStageIdx;

              return (
                <div key={stage} className="flex flex-col items-center relative z-10">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs uppercase border-2 transition-colors ${
                      isCompleted
                        ? "bg-brand-forest text-text-inverse border-brand-forest"
                        : isCurrent
                        ? "bg-surface-card text-brand-forest border-brand-forest ring-4 ring-brand-forest/20"
                        : "bg-surface-page text-text-muted border-border-default"
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider mt-2 capitalize ${
                      isCurrent ? "text-brand-forest font-bold" : "text-text-secondary"
                    }`}
                  >
                    {stage}
                  </span>
                </div>
              );
            })}

            {/* Connecting line */}
            <div className="absolute top-4 left-4 right-4 h-0.5 bg-border-default -z-0" />
          </div>
        </div>
      </div>

      {/* Contract Specs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface-card border border-border-default rounded-lg p-5 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Customer Information
          </span>
          <div className="text-base font-bold text-text-primary">{sub.customer.name}</div>
          {sub.customer.billingAddress && (
            <div className="text-xs text-text-secondary">{sub.customer.billingAddress}</div>
          )}
          {sub.customer.gstin && (
            <div className="text-xs font-mono text-brand-forest">
              GSTIN: {sub.customer.gstin}
            </div>
          )}
        </div>

        <div className="bg-surface-card border border-border-default rounded-lg p-5 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Billing Frequency & Anchor
          </span>
          <div className="text-base font-bold text-text-primary capitalize">
            {sub.plan.name}
          </div>
          <div className="text-xs font-mono text-brand-forest">
            Anchor Day: {sub.anchorDay} of {sub.plan.billingPeriod}
          </div>
          <div className="text-xs text-text-secondary">
            Next Invoicing: {sub.nextInvoiceDate || "N/A"}
          </div>
        </div>

        <div className="bg-surface-card border border-border-default rounded-lg p-5 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Recurring Contract Value
          </span>
          <div className="font-display text-2xl font-semibold text-text-primary">
            {formatINR(sub.totalPaise)}
          </div>
          <div className="text-xs text-text-secondary">
            Subtotal: {formatINR(sub.subtotalPaise)} + Tax: {formatINR(sub.taxPaise)}
          </div>
        </div>
      </div>

      {/* Contract Line Items */}
      <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden shadow-card">
        <div className="p-4 bg-surface-page border-b border-border-subtle font-display text-base font-medium">
          Contract Line Items & Agreed Pricing
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-page/50 border-b border-border-subtle text-xs uppercase tracking-wider text-text-secondary font-semibold">
            <tr>
              <th className="py-3 px-4 sm:px-6">Product & Selected Variant</th>
              <th className="py-3 px-4">Qty</th>
              <th className="py-3 px-4">Unit Price</th>
              <th className="py-3 px-4">Tax Rate</th>
              <th className="py-3 px-4 sm:px-6 text-right">Net Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {sub.lines.map((l) => (
              <tr key={l.id}>
                <td className="py-3.5 px-4 sm:px-6">
                  <div className="font-semibold text-text-primary">{l.productName}</div>
                  {l.variantName && (
                    <div className="text-xs font-mono text-brand-forest mt-0.5">
                      {l.variantName}
                    </div>
                  )}
                </td>
                <td className="py-3.5 px-4 font-mono">{l.quantity}</td>
                <td className="py-3.5 px-4 font-mono">{formatINR(l.unitPricePaise)}</td>
                <td className="py-3.5 px-4 font-mono text-xs">{l.taxRate}%</td>
                <td className="py-3.5 px-4 sm:px-6 text-right font-mono font-bold text-text-primary">
                  {formatINR(l.lineNetPaise)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Audit Trail & State Timeline */}
      <div className="bg-surface-card border border-border-default rounded-lg p-6 shadow-card flex flex-col gap-4">
        <div className="flex items-center gap-2 border-b border-border-subtle pb-3">
          <Clock className="w-4 h-4 text-brand-forest" />
          <h3 className="font-display text-lg font-medium text-text-primary">
            Subscription Audit Trail & MRR Ledger
          </h3>
        </div>

        <div className="flex flex-col gap-4">
          {sub.events.map((ev, i) => (
            <div key={ev.id || i} className="flex items-start gap-3.5">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-forest mt-1.5 shrink-0" />
              <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border-subtle/50 pb-3">
                <div>
                  <span className="font-semibold text-xs uppercase tracking-wider text-brand-forest mr-2">
                    {ev.eventType}
                  </span>
                  <span className="text-xs text-text-secondary">
                    {ev.meta?.notes || ev.meta?.action || "State updated"}
                  </span>
                  {ev.meta?.reason && (
                    <div className="text-xs text-text-muted mt-0.5 italic">
                      Reason: {ev.meta.reason}
                    </div>
                  )}
                </div>
                <div className="text-[11px] font-mono text-text-muted">
                  {new Date(ev.occurredAt).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

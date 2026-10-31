import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Button } from "../../components/ui/Button.js";
import { Badge } from "../../components/ui/Badge.js";
import { Layers, Search, Pause, Play, XCircle, ArrowRight, Clock, Plus } from "lucide-react";

interface SubscriptionItem {
  id: number;
  number: string;
  status: "draft" | "quotation" | "confirmed" | "active" | "paused" | "closed";
  startDate: string;
  nextInvoiceDate?: string;
  anchorDay: number;
  customerName: string;
  planName: string;
  billingPeriod: string;
  pausable: boolean;
  closable: boolean;
  totalPaise: number;
  lines: { id: number; productName: string; quantity: number }[];
}

export function SubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const loadSubscriptions = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<SubscriptionItem[]>("/subscriptions");
      setSubscriptions(data);
    } catch (err) {
      console.error("Failed to load subscriptions", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, []);

  const handleTransition = async (id: number, action: string, reason?: string) => {
    try {
      await fetchApi(`/subscriptions/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action, closeReason: reason }),
      });
      loadSubscriptions();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const filteredSubs = subscriptions
    .filter((s) => (filterStatus === "all" ? true : s.status === filterStatus))
    .filter(
      (s) =>
        s.number.toLowerCase().includes(search.toLowerCase()) ||
        s.customerName.toLowerCase().includes(search.toLowerCase()) ||
        s.planName.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-text-primary">
              All Subscriptions
            </h1>
            <Badge variant="active">{subscriptions.length} Total</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Monitor active recurring subscriptions, anchor-date schedules, pause states, and contract terminations.
          </p>
        </div>

        <Link to="/admin/quotations">
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4 mr-1.5" />
            <span>Create Subscription</span>
          </Button>
        </Link>
      </div>

      {/* Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-surface-card border border-border-default rounded-sm p-1">
          {["all", "active", "confirmed", "paused", "closed"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 text-xs font-semibold rounded capitalize transition-colors ${
                filterStatus === st
                  ? "bg-brand-forest text-text-inverse shadow-sm"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative max-w-sm w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search by ID, customer or plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm bg-surface-card border border-border-default rounded-sm focus:outline-none focus:border-brand-forest text-text-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-text-secondary text-sm animate-pulse">
          Loading subscriptions...
        </div>
      ) : filteredSubs.length === 0 ? (
        <div className="bg-surface-card border border-border-default rounded-lg p-12 text-center flex flex-col items-center gap-3">
          <Layers className="w-10 h-10 text-brand-forest/60" />
          <div className="text-base font-semibold text-text-primary">No subscriptions found</div>
          <p className="text-xs text-text-secondary max-w-sm">
            Confirm quotations into active subscriptions to begin recurring automated billing.
          </p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-page border-b border-border-subtle text-xs uppercase tracking-wider text-text-secondary font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Subscription</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Plan & Anchor</th>
                  <th className="py-3.5 px-4">Billing Schedule</th>
                  <th className="py-3.5 px-4">Contract Value</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredSubs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-brand-creamSoft/40 transition-colors">
                    <td className="py-4 px-4 sm:px-6">
                      <Link
                        to={`/admin/subscriptions/${sub.id}`}
                        className="font-mono font-bold text-brand-forest hover:underline"
                      >
                        {sub.number}
                      </Link>
                      <div className="text-xs text-text-muted mt-0.5">
                        Start: {sub.startDate}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-semibold text-text-primary">
                      {sub.customerName}
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm font-semibold">{sub.planName}</div>
                      <span className="text-[11px] font-mono text-brand-forest">
                        Anchor: Day {sub.anchorDay} of {sub.billingPeriod}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono text-xs text-text-secondary">
                      {sub.status === "active" ? (
                        <span>Next: {sub.nextInvoiceDate || "Pending Run"}</span>
                      ) : sub.status === "paused" ? (
                        <span className="text-amber-700 font-semibold">Billing Suspended</span>
                      ) : sub.status === "closed" ? (
                        <span className="text-text-muted">Terminated</span>
                      ) : (
                        <span>Not yet activated</span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-mono font-bold text-text-primary">
                      {formatINR(sub.totalPaise)}
                    </td>
                    <td className="py-4 px-4">
                      <Badge variant={sub.status}>{sub.status}</Badge>
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {sub.status === "active" && sub.pausable && (
                          <button
                            onClick={() => handleTransition(sub.id, "pause")}
                            title="Pause Subscription"
                            className="p-1.5 text-text-secondary hover:text-amber-700 rounded hover:bg-amber-50"
                          >
                            <Pause className="w-4 h-4" />
                          </button>
                        )}
                        {sub.status === "paused" && (
                          <button
                            onClick={() => handleTransition(sub.id, "resume")}
                            title="Resume Subscription"
                            className="p-1.5 text-text-secondary hover:text-emerald-700 rounded hover:bg-emerald-50"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                        )}
                        {["active", "paused", "confirmed"].includes(sub.status) && (
                          <button
                            onClick={() => {
                              const reason = prompt("Enter reason for early termination:");
                              if (reason) handleTransition(sub.id, "close", reason);
                            }}
                            title="Close Subscription"
                            className="p-1.5 text-text-secondary hover:text-semantic-danger rounded hover:bg-semantic-dangerBg/40"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <Link
                          to={`/admin/subscriptions/${sub.id}`}
                          className="text-xs text-brand-forest font-semibold hover:underline px-2 py-1"
                        >
                          Details &rarr;
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

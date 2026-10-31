import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Input.js";
import { Badge } from "../../components/ui/Badge.js";
import { Calendar, Plus, Check, X, Search, ShieldCheck } from "lucide-react";

interface Plan {
  id: number;
  name: string;
  pricePaise: number;
  billingFrequency: "daily" | "weekly" | "monthly" | "yearly";
  billingIntervalInteger: number;
  minQuantity: number;
  availableFrom: string;
  availableUntil?: string;
  autoClose: boolean;
  allowEarlyClose: boolean;
  allowPause: boolean;
  allowRenewal: boolean;
  isActive: boolean;
  products?: { productId: number; productName: string; defaultQuantity: number }[];
}

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [billingFrequency, setBillingFrequency] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [billingInterval, setBillingInterval] = useState("1");
  const [minQuantity, setMinQuantity] = useState("1");
  const [availableFrom, setAvailableFrom] = useState(new Date().toISOString().slice(0, 10));
  const [availableUntil, setAvailableUntil] = useState("");
  const [autoClose, setAutoClose] = useState(false);
  const [allowEarlyClose, setAllowEarlyClose] = useState(true);
  const [allowPause, setAllowPause] = useState(true);
  const [allowRenewal, setAllowRenewal] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPlans = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<Plan[]>("/plans");
      setPlans(data);
    } catch (err) {
      console.error("Failed to load plans", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await fetchApi("/plans", {
        method: "POST",
        body: JSON.stringify({
          name,
          billingFrequency,
          billingIntervalInteger: parseInt(billingInterval, 10),
          minQuantity: parseInt(minQuantity, 10),
          availableFrom: availableFrom || null,
          availableUntil: availableUntil || null,
          autoClose,
          allowEarlyClose,
          allowPause,
          allowRenewal,
        }),
      });

      setIsModalOpen(false);
      setName("");
      loadPlans();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create plan");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredPlans = plans.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-text-primary">
              Subscription Plans
            </h1>
            <Badge variant="active">{plans.length} Configured Plans</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Configure recurring billing intervals (daily, weekly, monthly, yearly) and granular lifecycle rules.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Subscription Plan</span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search plans by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm focus:outline-none focus:border-brand-forest focus:ring-1 focus:ring-brand-forest text-text-primary"
          />
        </div>
      </div>

      {/* Plans Table */}
      {isLoading ? (
        <div className="p-12 text-center text-text-secondary text-sm animate-pulse">
          Loading subscription plans...
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="bg-surface-card border border-border-default rounded-lg p-12 text-center flex flex-col items-center gap-3">
          <Calendar className="w-10 h-10 text-brand-forest/60" />
          <div className="text-base font-semibold text-text-primary">No plans configured yet</div>
          <p className="text-xs text-text-secondary max-w-sm">
            Set up daily, weekly, monthly or yearly recurring billing rules for your customers.
          </p>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
            Create First Plan
          </Button>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-page border-b border-border-subtle text-xs uppercase tracking-wider text-text-secondary font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Plan Name</th>
                  <th className="py-3.5 px-4">Frequency</th>
                  <th className="py-3.5 px-4">Min Qty</th>
                  <th className="py-3.5 px-4">Availability Window</th>
                  <th className="py-3.5 px-4">Lifecycle Controls</th>
                  <th className="py-3.5 px-4 sm:px-6">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredPlans.map((plan) => (
                  <tr key={plan.id} className="hover:bg-brand-creamSoft/40 transition-colors">
                    <td className="py-4 px-4 sm:px-6">
                      <div className="font-semibold text-text-primary">{plan.name}</div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-brand-creamDeep text-brand-forest border border-brand-taupe/40">
                        {plan.billingFrequency} (Every {plan.billingIntervalInteger || 1})
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono font-medium">
                      {plan.minQuantity} unit{plan.minQuantity > 1 ? "s" : ""}
                    </td>
                    <td className="py-4 px-4 text-xs font-mono text-text-secondary">
                      {plan.availableFrom ? plan.availableFrom : "Always"} &rarr;{" "}
                      {plan.availableUntil ? plan.availableUntil : "Ongoing"}
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            plan.allowPause
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          Pause: {plan.allowPause ? "Allowed" : "No"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            plan.allowEarlyClose
                              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                              : "bg-gray-100 text-gray-500 border-gray-200"
                          }`}
                        >
                          Early Close: {plan.allowEarlyClose ? "Allowed" : "No"}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded border ${
                            plan.autoClose
                              ? "bg-amber-50 text-amber-800 border-amber-200"
                              : "bg-emerald-50 text-emerald-800 border-emerald-200"
                          }`}
                        >
                          Auto-Close: {plan.autoClose ? "Yes" : "Auto-Renew"}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 sm:px-6">
                      <Badge variant="active">Active</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Plan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface-card border border-border-default rounded-lg max-w-xl w-full p-6 shadow-modal flex flex-col gap-5 my-8">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand-forest" />
                <h3 className="font-display text-xl font-medium text-text-primary">
                  Create Subscription Plan
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-semantic-dangerBg border border-semantic-danger/30 text-semantic-danger text-xs rounded-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreatePlan} className="flex flex-col gap-4">
              <Input
                label="Plan Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Standard Monthly Cloud Plan"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Billing Frequency
                  </label>
                  <select
                    value={billingFrequency}
                    onChange={(e) => setBillingFrequency(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm text-text-primary focus:outline-none focus:border-brand-forest"
                  >
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>

                <Input
                  label="Interval Integer"
                  type="number"
                  min="1"
                  required
                  value={billingInterval}
                  onChange={(e) => setBillingInterval(e.target.value)}
                  helperText="e.g. 1 = every 1 month"
                />

                <Input
                  label="Minimum Quantity"
                  type="number"
                  min="1"
                  required
                  value={minQuantity}
                  onChange={(e) => setMinQuantity(e.target.value)}
                  helperText="Minimum seats or licenses"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Available From"
                  type="date"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                />

                <Input
                  label="Available Until (Optional)"
                  type="date"
                  value={availableUntil}
                  onChange={(e) => setAvailableUntil(e.target.value)}
                />
              </div>

              {/* Lifecycle Rules Checkboxes */}
              <div className="p-4 bg-surface-page border border-border-subtle rounded-sm flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Lifecycle Policies (Problem Statement Plan-by-Plan Rule)
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowPause}
                      onChange={(e) => setAllowPause(e.target.checked)}
                      className="rounded text-brand-forest focus:ring-brand-forest"
                    />
                    <span>Allow Customer/Staff to Pause</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowEarlyClose}
                      onChange={(e) => setAllowEarlyClose(e.target.checked)}
                      className="rounded text-brand-forest focus:ring-brand-forest"
                    />
                    <span>Allow Early Cancellation</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoClose}
                      onChange={(e) => setAutoClose(e.target.checked)}
                      className="rounded text-brand-forest focus:ring-brand-forest"
                    />
                    <span>Auto-Close at Plan End (No auto-renewal)</span>
                  </label>

                  <label className="flex items-center gap-2 text-xs text-text-primary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowRenewal}
                      onChange={(e) => setAllowRenewal(e.target.checked)}
                      className="rounded text-brand-forest focus:ring-brand-forest"
                    />
                    <span>Permit Renewal Workflows</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-border-subtle pt-4 mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
                  Save Plan
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

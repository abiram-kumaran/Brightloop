import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Input.js";
import { Badge } from "../../components/ui/Badge.js";
import {
  FileSpreadsheet,
  Plus,
  Send,
  CheckCircle,
  Play,
  ArrowRight,
  Search,
  X,
  Layers,
  Clock,
} from "lucide-react";

interface Customer {
  id: number;
  companyName: string;
}

interface Plan {
  id: number;
  name: string;
  billingFrequency: string;
}

interface Product {
  id: number;
  name: string;
  salesPrice: number;
  variants: { id: number; name: string; priceAdjustment: number }[];
}

interface SubscriptionLine {
  id: number;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPricePaise: number;
  taxRate: number;
}

interface SubscriptionItem {
  id: number;
  number: string;
  status: "draft" | "quotation" | "confirmed" | "active" | "paused" | "closed";
  startDate: string;
  quoteValidUntil?: string;
  anchorDay: number;
  customerName: string;
  planName: string;
  billingPeriod: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  lines: SubscriptionLine[];
}

export function QuotationsPage() {
  const [quotations, setQuotations] = useState<SubscriptionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // New Quote Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [validUntil, setValidUntil] = useState(
    new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)
  );

  const [lines, setLines] = useState<
    { productId: number; variantId?: number; quantity: number; unitPrice?: number }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [subs, custs, pls, prods] = await Promise.all([
        fetchApi<SubscriptionItem[]>("/subscriptions"),
        fetchApi<Customer[]>("/customers"),
        fetchApi<Plan[]>("/plans"),
        fetchApi<Product[]>("/products"),
      ]);

      // Quotations are items in draft, quotation, or confirmed
      setQuotations(subs.filter((s) => ["draft", "quotation", "confirmed"].includes(s.status)));
      setCustomers(custs);
      setPlans(pls);
      setProducts(prods);

      if (custs.length > 0) setSelectedCustomerId(custs[0].id.toString());
      if (pls.length > 0) setSelectedPlanId(pls[0].id.toString());
      if (prods.length > 0) {
        setLines([{ productId: prods[0].id, quantity: 1, unitPrice: prods[0].salesPrice / 100 }]);
      }
    } catch (err) {
      console.error("Failed to load quotations data", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleTransition = async (id: number, action: string) => {
    try {
      await fetchApi(`/subscriptions/${id}/transition`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      loadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        alert(err.message);
      }
    }
  };

  const handleAddLine = () => {
    if (products.length > 0) {
      setLines([
        ...lines,
        { productId: products[0].id, quantity: 1, unitPrice: products[0].salesPrice / 100 },
      ]);
    }
  };

  const handleRemoveLine = (idx: number) => {
    setLines(lines.filter((_, i) => i !== idx));
  };

  const handleCreateQuotation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await fetchApi("/subscriptions", {
        method: "POST",
        body: JSON.stringify({
          customerId: parseInt(selectedCustomerId, 10),
          planId: parseInt(selectedPlanId, 10),
          startDate,
          quoteValidUntil: validUntil,
          lines: lines.map((l) => ({
            productId: l.productId,
            variantId: l.variantId || null,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
          })),
        }),
      });

      setIsModalOpen(false);
      loadData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create quotation");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredQuotes = quotations.filter(
    (q) =>
      q.number.toLowerCase().includes(search.toLowerCase()) ||
      q.customerName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-text-primary">
              Quotations & Orders
            </h1>
            <Badge variant="draft">{quotations.length} Pending</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Build custom quotations with product variants, discounts, and confirm subscriptions into active billing.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Quotation</span>
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="Search quotations by quote # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm focus:outline-none focus:border-brand-forest focus:ring-1 focus:ring-brand-forest text-text-primary"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-text-secondary text-sm animate-pulse">
          Loading quotations...
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="bg-surface-card border border-border-default rounded-lg p-12 text-center flex flex-col items-center gap-3">
          <FileSpreadsheet className="w-10 h-10 text-brand-forest/60" />
          <div className="text-base font-semibold text-text-primary">No open quotations</div>
          <p className="text-xs text-text-secondary max-w-sm">
            Create a custom quotation for a prospective or existing customer.
          </p>
          <Button variant="primary" size="sm" onClick={() => setIsModalOpen(true)}>
            Create First Quotation
          </Button>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-page border-b border-border-subtle text-xs uppercase tracking-wider text-text-secondary font-semibold">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Quote Number</th>
                  <th className="py-3.5 px-4">Customer</th>
                  <th className="py-3.5 px-4">Plan & Frequency</th>
                  <th className="py-3.5 px-4">Total Amount</th>
                  <th className="py-3.5 px-4">Lifecycle Stage</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filteredQuotes.map((q) => (
                  <tr key={q.id} className="hover:bg-brand-creamSoft/40 transition-colors">
                    <td className="py-4 px-4 sm:px-6">
                      <Link
                        to={`/admin/subscriptions/${q.id}`}
                        className="font-mono font-bold text-brand-forest hover:underline"
                      >
                        {q.number}
                      </Link>
                      <div className="text-xs text-text-muted mt-0.5">
                        Start: {q.startDate}
                      </div>
                    </td>
                    <td className="py-4 px-4 font-medium text-text-primary">
                      {q.customerName}
                    </td>
                    <td className="py-4 px-4">
                      <div className="text-sm font-semibold">{q.planName}</div>
                      <span className="text-[11px] uppercase tracking-wider font-mono text-text-secondary">
                        {q.billingPeriod} (Anchor: Day {q.anchorDay})
                      </span>
                    </td>
                    <td className="py-4 px-4 font-mono font-semibold text-text-primary">
                      {formatINR(q.totalPaise)}
                      <div className="text-[11px] text-text-muted font-normal">
                        (Tax: {formatINR(q.taxPaise)})
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {/* Stepper badge */}
                      <Badge
                        variant={
                          q.status === "confirmed"
                            ? "confirmed"
                            : q.status === "quotation"
                            ? "info"
                            : "draft"
                        }
                      >
                        {q.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {q.status === "draft" && (
                          <button
                            onClick={() => handleTransition(q.id, "send_quotation")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-brand-creamDeep text-brand-forest hover:bg-brand-taupe/40"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Send</span>
                          </button>
                        )}
                        {q.status === "quotation" && (
                          <button
                            onClick={() => handleTransition(q.id, "confirm")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-brand-forest text-text-inverse hover:bg-brand-forestDark"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            <span>Confirm</span>
                          </button>
                        )}
                        {q.status === "confirmed" && (
                          <button
                            onClick={() => handleTransition(q.id, "activate")}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Activate</span>
                          </button>
                        )}
                        <Link
                          to={`/admin/subscriptions/${q.id}`}
                          className="text-xs text-text-secondary hover:text-text-primary px-2 py-1"
                        >
                          View &rarr;
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

      {/* New Quotation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-surface-card border border-border-default rounded-lg max-w-2xl w-full p-6 shadow-modal flex flex-col gap-5 my-8">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-forest" />
                <h3 className="font-display text-xl font-medium text-text-primary">
                  Create New Quotation
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

            <form onSubmit={handleCreateQuotation} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Customer Account
                  </label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm text-text-primary focus:outline-none focus:border-brand-forest"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.companyName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Subscription Plan
                  </label>
                  <select
                    value={selectedPlanId}
                    onChange={(e) => setSelectedPlanId(e.target.value)}
                    required
                    className="w-full px-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm text-text-primary focus:outline-none focus:border-brand-forest"
                  >
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.billingFrequency})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="Start Date"
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />

                <Input
                  label="Quote Valid Until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </div>

              {/* Line Items Builder */}
              <div className="border-t border-border-subtle pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Line Items & Variants (with live pricing)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="text-xs text-brand-forest font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                {lines.map((line, idx) => {
                  const currentProd = products.find((p) => p.id === line.productId);
                  return (
                    <div
                      key={idx}
                      className="p-3 bg-surface-page border border-border-subtle rounded-sm grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end"
                    >
                      <div className="sm:col-span-5 flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary">
                          Product
                        </label>
                        <select
                          value={line.productId}
                          onChange={(e) => {
                            const newPid = parseInt(e.target.value, 10);
                            const p = products.find((prod) => prod.id === newPid);
                            const updated = [...lines];
                            updated[idx].productId = newPid;
                            updated[idx].variantId = undefined;
                            updated[idx].unitPrice = p ? p.salesPrice / 100 : 0;
                            setLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-surface-card border border-border-default rounded-sm text-text-primary"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-3 flex flex-col gap-1">
                        <label className="text-[11px] font-semibold text-text-secondary">
                          Variant
                        </label>
                        <select
                          value={line.variantId || ""}
                          onChange={(e) => {
                            const vid = e.target.value ? parseInt(e.target.value, 10) : undefined;
                            const updated = [...lines];
                            updated[idx].variantId = vid;
                            const v = currentProd?.variants.find((vr) => vr.id === vid);
                            if (v && currentProd) {
                              updated[idx].unitPrice =
                                (currentProd.salesPrice + v.priceAdjustment) / 100;
                            }
                            setLines(updated);
                          }}
                          className="w-full px-2.5 py-1.5 text-xs bg-surface-card border border-border-default rounded-sm text-text-primary"
                        >
                          <option value="">Standard Edition</option>
                          {currentProd?.variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.name} (+₹{(v.priceAdjustment / 100).toFixed(2)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <Input
                          label="Qty"
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => {
                            const updated = [...lines];
                            updated[idx].quantity = parseInt(e.target.value, 10) || 1;
                            setLines(updated);
                          }}
                        />
                      </div>

                      <div className="sm:col-span-1 flex items-center pb-2 font-mono text-xs font-semibold text-brand-forest">
                        ₹{line.unitPrice}
                      </div>

                      <div className="sm:col-span-1 flex justify-center pb-2">
                        <button
                          type="button"
                          onClick={() => handleRemoveLine(idx)}
                          className="text-text-muted hover:text-semantic-danger"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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
                  Create Quotation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

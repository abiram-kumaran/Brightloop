import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Input.js";
import { Badge } from "../../components/ui/Badge.js";
import { Percent, Plus, X } from "lucide-react";

interface Discount {
  id: number;
  name: string;
  type: "fixed" | "percentage";
  value: number;
  discountScope: "product" | "subscription";
  minAmount: number;
  isActive: boolean;
  validFrom: string;
  validUntil: string;
}

export function DiscountsPage() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<"fixed" | "percentage">("percentage");
  const [value, setValue] = useState("10");
  const [discountScope, setDiscountScope] = useState<"product" | "subscription">("product");
  const [minAmount, setMinAmount] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadDiscounts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<Discount[]>("/discounts");
      setDiscounts(data);
    } catch (err) {
      console.error("Failed to load discounts", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiscounts();
  }, []);

  const handleCreateDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await fetchApi("/discounts", {
        method: "POST",
        body: JSON.stringify({
          code: code || name.toUpperCase().replace(/\s+/g, ""),
          name,
          type,
          value: parseFloat(value),
          discountScope,
          minAmount: parseFloat(minAmount) || 0,
          isActive: true,
        }),
      });

      setIsModalOpen(false);
      setName("");
      setCode("");
      loadDiscounts();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create discount");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-display text-2xl sm:text-3xl font-medium text-text-primary">
              Discount Rules
            </h1>
            <Badge variant="active">{discounts.length} Rules</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Configure line-item product discounts and whole-subscription percentage or fixed deductions.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Discount</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-text-secondary text-sm animate-pulse">
          Loading discount rules...
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-page border-b border-border-subtle text-xs uppercase tracking-wider text-text-secondary font-semibold">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Discount Name</th>
                <th className="py-3.5 px-4">Scope</th>
                <th className="py-3.5 px-4">Value</th>
                <th className="py-3.5 px-4">Min Spend</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {discounts.map((d) => (
                <tr key={d.id} className="hover:bg-brand-creamSoft/40 transition-colors">
                  <td className="py-4 px-4 sm:px-6 font-semibold text-text-primary">
                    {d.name}
                  </td>
                  <td className="py-4 px-4">
                    <span className="capitalize text-xs font-mono px-2 py-0.5 rounded bg-brand-creamDeep text-brand-forest">
                      {d.discountScope}
                    </span>
                  </td>
                  <td className="py-4 px-4 font-mono font-semibold text-brand-forest">
                    {d.type === "percentage" ? `${d.value}%` : formatINR(d.value)}
                  </td>
                  <td className="py-4 px-4 font-mono text-xs text-text-secondary">
                    {d.minAmount > 0 ? formatINR(d.minAmount) : "None"}
                  </td>
                  <td className="py-4 px-4 sm:px-6">
                    <Badge variant={d.isActive ? "active" : "draft"}>
                      {d.isActive ? "Active" : "Disabled"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-surface-card border border-border-default rounded-lg max-w-md w-full p-6 shadow-modal flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div className="flex items-center gap-2">
                <Percent className="w-5 h-5 text-brand-forest" />
                <h3 className="font-display text-xl font-medium text-text-primary">
                  New Discount Rule
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

            <form onSubmit={handleCreateDiscount} className="flex flex-col gap-4">
              <Input
                label="Discount Code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. WELCOME10"
              />

              <Input
                label="Campaign / Rule Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 10% Off New Subscriber"
              />

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Discount Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm text-text-primary focus:outline-none focus:border-brand-forest"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                    Scope
                  </label>
                  <select
                    value={discountScope}
                    onChange={(e) => setDiscountScope(e.target.value as any)}
                    className="w-full px-3 py-2 text-sm bg-surface-card border border-border-default rounded-sm text-text-primary focus:outline-none focus:border-brand-forest"
                  >
                    <option value="product">Line-Item Product</option>
                    <option value="subscription">Total Subscription</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Discount Value"
                  type="number"
                  step="0.01"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  helperText={type === "percentage" ? "% discount" : "Rupees in ₹"}
                />

                <Input
                  label="Min Spend (₹)"
                  type="number"
                  step="0.01"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="md" isLoading={isSubmitting}>
                  Save Discount
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

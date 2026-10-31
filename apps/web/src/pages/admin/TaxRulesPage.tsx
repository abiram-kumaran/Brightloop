import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { Button } from "../../components/ui/Button.js";
import { Input } from "../../components/ui/Input.js";
import { Badge } from "../../components/ui/Badge.js";
import { Receipt, Plus, X } from "lucide-react";

interface TaxRule {
  id: number;
  name: string;
  ratePercent: number;
  isActive: boolean;
  createdAt: string;
}

export function TaxRulesPage() {
  const [taxes, setTaxes] = useState<TaxRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [ratePercent, setRatePercent] = useState("18");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadTaxes = async () => {
    setIsLoading(true);
    try {
      const data = await fetchApi<TaxRule[]>("/taxes");
      setTaxes(data);
    } catch (err) {
      console.error("Failed to load taxes", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTaxes();
  }, []);

  const handleCreateTax = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await fetchApi("/taxes", {
        method: "POST",
        body: JSON.stringify({
          name,
          ratePercent: parseFloat(ratePercent),
          isActive: true,
        }),
      });

      setIsModalOpen(false);
      setName("");
      loadTaxes();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Failed to create tax rule");
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
              Tax Rates & GST Rules
            </h1>
            <Badge variant="active">{taxes.length} Rules</Badge>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            Configure GST rates (e.g. 18% split into CGST 9% + SGST 9% for intra-state sales).
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          onClick={() => setIsModalOpen(true)}
          className="self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>New Tax Rule</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-text-secondary text-sm animate-pulse">
          Loading tax rules...
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-hidden shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-page border-b border-border-subtle text-xs uppercase tracking-wider text-text-secondary font-semibold">
              <tr>
                <th className="py-3.5 px-4 sm:px-6">Tax Name</th>
                <th className="py-3.5 px-4">Rate Percentage</th>
                <th className="py-3.5 px-4">Intra-State GST Split</th>
                <th className="py-3.5 px-4 sm:px-6">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {taxes.map((tax) => (
                <tr key={tax.id} className="hover:bg-brand-creamSoft/40 transition-colors">
                  <td className="py-4 px-4 sm:px-6 font-semibold text-text-primary">
                    {tax.name}
                  </td>
                  <td className="py-4 px-4 font-mono font-semibold text-brand-forest">
                    {tax.ratePercent}%
                  </td>
                  <td className="py-4 px-4 text-xs font-mono text-text-secondary">
                    CGST {(tax.ratePercent / 2).toFixed(1)}% + SGST {(tax.ratePercent / 2).toFixed(1)}%
                  </td>
                  <td className="py-4 px-4 sm:px-6">
                    <Badge variant={tax.isActive ? "active" : "draft"}>
                      {tax.isActive ? "Active" : "Disabled"}
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
                <Receipt className="w-5 h-5 text-brand-forest" />
                <h3 className="font-display text-xl font-medium text-text-primary">
                  New Tax Rule
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

            <form onSubmit={handleCreateTax} className="flex flex-col gap-4">
              <Input
                label="Rule Name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. GST 18% Standard"
              />

              <Input
                label="Rate Percentage (%)"
                type="number"
                step="0.01"
                min="0"
                max="100"
                required
                value={ratePercent}
                onChange={(e) => setRatePercent(e.target.value)}
              />

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
                  Save Tax Rule
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

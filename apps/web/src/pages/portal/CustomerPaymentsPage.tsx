import React, { useEffect, useState } from "react";
import { fetchApi } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Badge } from "../../components/ui/Badge.js";
import { Button } from "../../components/ui/Button.js";
import { AlertCircle, RotateCcw } from "lucide-react";

interface PaymentRow {
  id: number;
  invoiceId?: number;
  invoiceNumber?: string;
  paidOn?: string | null;
  method?: string;
  reference?: string | null;
  amountPaise?: number | string | null;
  status: string;
}

const safeFormatDate = (dateVal?: string | null): string => {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

export function CustomerPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    fetchApi<PaymentRow[] | { data: PaymentRow[] }>("/payments")
      .then((res) => {
        if (!isMounted) return;
        const list = Array.isArray(res)
          ? res
          : res && typeof res === "object" && "data" in res && Array.isArray(res.data)
            ? res.data
            : [];
        setPayments(list);
      })
      .catch((e: unknown) => {
        if (!isMounted) return;
        const msg = e instanceof Error ? e.message : "Failed to load payment history";
        console.error("Failed to load payments:", e);
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
            Payment History
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Complete ledger of recorded settlement payments and allocations against your invoices.
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
          Loading payment records...
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 bg-surface-card border border-border-default rounded-lg">
          <p className="text-text-secondary">No payments recorded yet.</p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-creamDeep border-b border-border-default text-text-secondary font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Receipt #</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-right">Settled Amount</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-brand-cream/50 transition">
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    RCPT-{p.id}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-brand-forest">
                    {p.invoiceNumber || (p.invoiceId ? `INV-${p.invoiceId}` : "—")}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    {safeFormatDate(p.paidOn)}
                  </td>
                  <td className="py-3.5 px-4 uppercase text-xs font-mono">
                    {(p.method || "manual").replace(/_/g, " ")}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    {p.reference || "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-semantic-success">
                    {formatINR(p.amountPaise || 0)}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={p.status === "posted" ? "paid" : "draft"}>
                      {p.status || "draft"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

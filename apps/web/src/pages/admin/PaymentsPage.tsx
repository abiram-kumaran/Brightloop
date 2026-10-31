import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Badge } from "../../components/ui/Badge.js";

interface Payment {
  id: number;
  invoiceId: number;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  amountPaise: number;
  method: string;
  paidOn: string;
  reference?: string;
  note?: string;
  status: string;
  recordedByName?: string;
}

export function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPayments = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchApi<Payment[] | { data: Payment[] }>("/payments");
      const list = Array.isArray(res)
        ? res
        : res && typeof res === "object" && "data" in res && Array.isArray(res.data)
          ? res.data
          : [];
      setPayments(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load payments");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, []);

  const totalCollectedPaise = payments.reduce(
    (sum, p) => (p.status === "posted" ? sum + Number(p.amountPaise) : sum),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
            Payments Ledger
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Reconciled payments ledger tracking settled transactions against customer invoices.
          </p>
        </div>
        <div className="bg-surface-card border border-brand-taupe px-4 py-2.5 rounded-lg text-right shadow-sm">
          <div className="text-xs uppercase font-semibold text-text-secondary">
            Total Collected Revenue
          </div>
          <div className="text-2xl font-mono font-bold text-semantic-success">
            {formatINR(totalCollectedPaise)}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-semantic-dangerBg border border-semantic-danger/20 text-semantic-danger text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">Loading payments...</div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12 bg-surface-card border border-border-default rounded-lg">
          <p className="text-text-secondary">No payments recorded yet.</p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-creamDeep border-b border-border-default text-text-secondary font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Payment ID</th>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4">Reference</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-brand-cream/50 transition">
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    PAY-{p.id}
                  </td>
                  <td className="py-3.5 px-4 font-mono font-medium text-brand-forest">
                    {p.invoiceNumber}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-text-primary">{p.customerName}</div>
                    <div className="text-xs text-text-secondary">{p.customerEmail}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    {new Date(p.paidOn).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 uppercase text-xs font-mono">
                    {p.method.replace("_", " ")}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    {p.reference || "—"}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-semantic-success">
                    {formatINR(p.amountPaise)}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={p.status === "posted" ? "paid" : "draft"}>
                      {p.status}
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

import React, { useEffect, useState } from "react";
import { fetchApi } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Badge, BadgeVariant } from "../../components/ui/Badge.js";
import { Button } from "../../components/ui/Button.js";
import { AlertCircle, RotateCcw } from "lucide-react";

interface InvoiceLine {
  id?: number;
  productName: string;
  variantName?: string;
  quantity: number;
  unitPricePaise: number | string;
  taxAmountPaise?: number | string;
  lineTotalPaise: number | string;
}

interface InvoiceDetail {
  id: number;
  number: string;
  issueDate?: string | null;
  dueDate?: string | null;
  status: string;
  isInterstate?: boolean;
  igstPaise?: number | string | null;
  cgstPaise?: number | string | null;
  sgstPaise?: number | string | null;
  totalPaise?: number | string | null;
  lines?: InvoiceLine[];
}

interface InvoiceRow {
  id: number;
  number: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  dueDate?: string | null;
  totalPaise?: number | string | null;
  amountPaidPaise?: number | string | null;
  amountDuePaise?: number | string | null;
  status: string;
}

const safeFormatDate = (dateVal?: string | null): string => {
  if (!dateVal) return "—";
  const d = new Date(dateVal);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
};

export function CustomerInvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<InvoiceDetail | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const loadInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchApi<InvoiceRow[] | { data: InvoiceRow[] }>("/invoices");
      const list = Array.isArray(res)
        ? res
        : res && typeof res === "object" && "data" in res && Array.isArray(res.data)
          ? res.data
          : [];
      setInvoices(list);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to load invoices";
      console.error("Failed to load invoices", e);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, [reloadKey]);

  const openInvoice = async (id: number) => {
    try {
      const res = await fetchApi<InvoiceDetail | { data: InvoiceDetail }>(`/invoices/${id}`);
      const detail =
        res && typeof res === "object" && "data" in res && res.data
          ? (res.data as InvoiceDetail)
          : (res as InvoiceDetail);
      setViewInvoice(detail);
    } catch (e: unknown) {
      console.error("Failed to fetch invoice details", e);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
            Invoices & Receipts
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Review GST-compliant tax invoices and track payment statuses.
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
          Loading invoices...
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 bg-surface-card border border-border-default rounded-lg">
          <p className="text-text-secondary">No invoices available.</p>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-creamDeep border-b border-border-default text-text-secondary font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Billing Period</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Outstanding</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {invoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-brand-cream/50 transition">
                  <td className="py-3.5 px-4 font-mono font-medium text-brand-forest">
                    {inv.number || `INV-${inv.id}`}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    {safeFormatDate(inv.periodStart)} – {safeFormatDate(inv.periodEnd)}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    {safeFormatDate(inv.dueDate)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-text-primary">
                    {formatINR(inv.totalPaise || 0)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-semantic-success">
                    {formatINR(inv.amountPaidPaise || 0)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-text-primary">
                    {formatINR(inv.amountDuePaise || 0)}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={(inv.status || "draft") as BadgeVariant}>
                      {inv.status || "draft"}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openInvoice(inv.id)}>
                      View Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Invoice modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-card border border-border-default rounded-xl max-w-2xl w-full p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start border-b border-border-default pb-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-text-primary">
                  Invoice {viewInvoice.number || `INV-${viewInvoice.id}`}
                </h2>
                <div className="text-xs text-text-secondary mt-1">
                  Issued: {safeFormatDate(viewInvoice.issueDate)} | Due:{" "}
                  {safeFormatDate(viewInvoice.dueDate)}
                </div>
              </div>
              <Badge variant={(viewInvoice.status || "draft") as BadgeVariant}>
                {viewInvoice.status || "draft"}
              </Badge>
            </div>

            <div className="bg-brand-cream/60 p-4 rounded-lg border border-brand-taupe/40 text-xs grid grid-cols-2 gap-4">
              <div>
                <div className="font-semibold uppercase text-text-secondary">Supplier</div>
                <div className="font-medium text-text-primary">Brightloop Software Inc.</div>
                <div className="text-text-secondary">Tamil Nadu (State Code: 33)</div>
              </div>
              <div>
                <div className="font-semibold uppercase text-text-secondary">GST Breakdown</div>
                <div className="font-medium text-text-primary">
                  {viewInvoice.isInterstate
                    ? `IGST 18%: ${formatINR(viewInvoice.igstPaise || 0)}`
                    : `CGST 9%: ${formatINR(viewInvoice.cgstPaise || 0)} + SGST 9%: ${formatINR(viewInvoice.sgstPaise || 0)}`}
                </div>
              </div>
            </div>

            <table className="w-full text-left text-xs">
              <thead className="bg-brand-creamDeep border-b border-border-default uppercase">
                <tr>
                  <th className="py-2 px-3">Description</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3 text-right">Unit Price</th>
                  <th className="py-2 px-3 text-right">Tax</th>
                  <th className="py-2 px-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {viewInvoice.lines && viewInvoice.lines.length > 0 ? (
                  viewInvoice.lines.map((line, idx) => (
                    <tr key={line.id ?? idx}>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-text-primary">{line.productName}</div>
                        {line.variantName && (
                          <div className="text-text-secondary">{line.variantName}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">{line.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatINR(line.unitPricePaise)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono">
                        {formatINR(line.taxAmountPaise || 0)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium">
                        {formatINR(line.lineTotalPaise)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-text-secondary">
                      No line items recorded on this invoice.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="flex justify-between items-center pt-4 border-t border-border-default">
              <div className="text-xs text-text-secondary">
                Payment Details: Please transfer to account #092819381 (IFSC: BRIGHT0001)
              </div>
              <Button variant="secondary" onClick={() => setViewInvoice(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

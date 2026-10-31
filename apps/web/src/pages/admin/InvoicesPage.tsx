import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Button } from "../../components/ui/Button.js";
import { Badge, BadgeVariant } from "../../components/ui/Badge.js";
import { Input } from "../../components/ui/Input.js";

interface Invoice {
  id: number;
  number: string;
  customerName: string;
  customerEmail: string;
  periodStart: string;
  periodEnd: string;
  issueDate: string;
  dueDate: string;
  totalPaise: number;
  amountPaidPaise: number;
  amountDuePaise: number;
  status: "draft" | "confirmed" | "paid" | "cancelled";
  isInterstate: boolean;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lines?: any[];
  payments?: any[];
}

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Billing Run Modal State
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [billingAsOfDate, setBillingAsOfDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isBillingRunning, setIsBillingRunning] = useState(false);
  const [billingResult, setBillingResult] = useState<any | null>(null);

  // Payment Recording Modal State
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] =
    useState<Invoice | null>(null);
  const [paymentAmountRupees, setPaymentAmountRupees] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Invoice Details Modal
  const [viewInvoice, setViewInvoice] = useState<Invoice | null>(null);

  const loadInvoices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchApi<Invoice[] | { data: Invoice[] }>("/invoices");
      const list = Array.isArray(res)
        ? res
        : res && typeof res === "object" && "data" in res && Array.isArray(res.data)
          ? res.data
          : [];
      setInvoices(list);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load invoices");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  const handleRunBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsBillingRunning(true);
    setError(null);
    try {
      const res = await fetchApi<{ data: any }>("/billing/run", {
        method: "POST",
        body: JSON.stringify({ asOfDate: billingAsOfDate }),
      });
      setBillingResult(res.data);
      await loadInvoices();
    } catch (err: any) {
      setError(
        err instanceof ApiError ? err.message : "Failed to execute billing run"
      );
    } finally {
      setIsBillingRunning(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceForPayment) return;
    setIsRecordingPayment(true);
    setPaymentError(null);
    try {
      const amountPaise = Math.round(Number(paymentAmountRupees) * 100);
      await fetchApi("/payments", {
        method: "POST",
        body: JSON.stringify({
          invoiceId: selectedInvoiceForPayment.id,
          amountPaise,
          method: paymentMethod,
          reference: paymentReference || undefined,
          note: paymentNote || undefined,
        }),
      });
      setSelectedInvoiceForPayment(null);
      setPaymentAmountRupees("");
      setPaymentReference("");
      setPaymentNote("");
      await loadInvoices();
    } catch (err: any) {
      setPaymentError(
        err instanceof ApiError ? err.message : "Failed to record payment"
      );
    } finally {
      setIsRecordingPayment(false);
    }
  };

  const openPaymentModal = (inv: Invoice) => {
    setSelectedInvoiceForPayment(inv);
    setPaymentAmountRupees((inv.amountDuePaise / 100).toFixed(2));
    setPaymentError(null);
  };

  const openInvoiceDetails = async (inv: Invoice) => {
    try {
      const res = await fetchApi<Invoice | { data: Invoice }>(`/invoices/${inv.id}`);
      const detail =
        res && typeof res === "object" && "data" in res && res.data
          ? (res.data as Invoice)
          : (res as Invoice);
      setViewInvoice(detail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load invoice details");
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
            Invoices & Billing Runs
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Track snapshot customer invoices, GST tax breakdowns, and automated recurring billing runs.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              setBillingResult(null);
              setIsBillingModalOpen(true);
            }}
          >
            ⚡ Run Billing Job
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-semantic-dangerBg border border-semantic-danger/20 text-semantic-danger text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-text-secondary">Loading invoices...</div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-12 bg-surface-card border border-border-default rounded-lg">
          <p className="text-text-secondary mb-4">No invoices generated yet.</p>
          <Button variant="secondary" onClick={() => setIsBillingModalOpen(true)}>
            Run Billing Engine
          </Button>
        </div>
      ) : (
        <div className="bg-surface-card border border-border-default rounded-lg overflow-x-auto shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-creamDeep border-b border-border-default text-text-secondary font-mono text-xs uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
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
                    {inv.number || `DRAFT-${inv.id}`}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="font-medium text-text-primary">{inv.customerName}</div>
                    <div className="text-xs text-text-secondary">{inv.customerEmail}</div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    {new Date(inv.periodStart).toLocaleDateString()} –{" "}
                    {new Date(inv.periodEnd).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                    {new Date(inv.dueDate).toLocaleDateString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-text-primary">
                    {formatINR(inv.totalPaise)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-semantic-success">
                    {formatINR(inv.amountPaidPaise)}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-text-primary">
                    {formatINR(inv.amountDuePaise)}
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant={inv.status as BadgeVariant}>{inv.status}</Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-2">
                    <Button variant="ghost" size="sm" onClick={() => openInvoiceDetails(inv)}>
                      View
                    </Button>
                    {inv.status !== "paid" && inv.status !== "cancelled" && (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openPaymentModal(inv)}
                      >
                        Record Pay
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Billing Run Modal */}
      {isBillingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-card border border-border-default rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h2 className="font-serif text-xl font-bold text-text-primary">
              Execute Recurring Billing Run
            </h2>
            <p className="text-sm text-text-secondary">
              The billing engine scans all active subscriptions due on or before the selected as-of date and generates gapless, idempotently checked invoices.
            </p>

            {billingResult ? (
              <div className="bg-brand-cream p-4 rounded-lg border border-brand-taupe space-y-2 text-sm">
                <div className="font-semibold text-brand-forest">Billing Run Summary:</div>
                <div className="flex justify-between">
                  <span>Subscriptions evaluated:</span>
                  <span className="font-mono">{billingResult.totalSubscriptionsChecked}</span>
                </div>
                <div className="flex justify-between">
                  <span>Invoices generated:</span>
                  <span className="font-mono font-bold text-semantic-success">
                    {billingResult.invoicesGenerated}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Invoices skipped (already billed):</span>
                  <span className="font-mono text-text-secondary">
                    {billingResult.invoicesSkipped}
                  </span>
                </div>
                <div className="flex justify-between border-t border-brand-taupe pt-2">
                  <span>Total billed amount:</span>
                  <span className="font-mono font-bold">
                    {formatINR(billingResult.totalBilledPaise)}
                  </span>
                </div>
                <div className="pt-2">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={() => {
                      setIsBillingModalOpen(false);
                      setBillingResult(null);
                    }}
                  >
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleRunBilling} className="space-y-4">
                <Input
                  label="Billing As-Of Date"
                  type="date"
                  value={billingAsOfDate}
                  onChange={(e) => setBillingAsOfDate(e.target.value)}
                  required
                />
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="ghost"
                    type="button"
                    onClick={() => setIsBillingModalOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" isLoading={isBillingRunning}>
                    Execute Billing
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {selectedInvoiceForPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-card border border-border-default rounded-xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h2 className="font-serif text-xl font-bold text-text-primary">
              Record Payment
            </h2>
            <div className="text-sm text-text-secondary">
              Invoice: <span className="font-mono font-semibold">{selectedInvoiceForPayment.number}</span>
              <br />
              Customer: {selectedInvoiceForPayment.customerName}
              <br />
              Outstanding:{" "}
              <span className="font-mono font-bold text-semantic-danger">
                {formatINR(selectedInvoiceForPayment.amountDuePaise)}
              </span>
            </div>

            {paymentError && (
              <div className="p-3 bg-semantic-dangerBg text-semantic-danger text-xs rounded border border-semantic-danger/20">
                {paymentError}
              </div>
            )}

            <form onSubmit={handleRecordPayment} className="space-y-4">
              <Input
                label="Payment Amount (₹)"
                type="number"
                step="0.01"
                min="0.01"
                value={paymentAmountRupees}
                onChange={(e) => setPaymentAmountRupees(e.target.value)}
                required
              />

              <div className="space-y-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Payment Method
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-card border border-border-default rounded-md text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-forest"
                >
                  <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="upi">UPI</option>
                  <option value="card">Credit / Debit Card</option>
                  <option value="cheque">Cheque</option>
                  <option value="other">Cash / Other</option>
                </select>
              </div>

              <Input
                label="Reference / Transaction ID"
                placeholder="e.g. UTR / UPI Ref / Cheque No."
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
              />

              <Input
                label="Internal Note"
                placeholder="Optional payment notes"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  type="button"
                  onClick={() => setSelectedInvoiceForPayment(null)}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit" isLoading={isRecordingPayment}>
                  Confirm Payment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Details Modal */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-surface-card border border-border-default rounded-xl max-w-2xl w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
            <div className="flex justify-between items-start border-b border-border-default pb-4">
              <div>
                <h2 className="font-serif text-2xl font-bold text-text-primary">
                  Invoice {viewInvoice.number}
                </h2>
                <div className="text-sm text-text-secondary mt-1">
                  Issued: {new Date(viewInvoice.issueDate).toLocaleDateString()} | Due:{" "}
                  {new Date(viewInvoice.dueDate).toLocaleDateString()}
                </div>
              </div>
              <Badge variant={viewInvoice.status as BadgeVariant}>{viewInvoice.status}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm bg-brand-cream p-4 rounded-lg border border-brand-taupe">
              <div>
                <div className="text-xs uppercase font-semibold text-text-secondary">Customer</div>
                <div className="font-medium text-text-primary">{viewInvoice.customerName}</div>
                <div className="text-text-secondary text-xs">{viewInvoice.customerEmail}</div>
              </div>
              <div>
                <div className="text-xs uppercase font-semibold text-text-secondary">Tax Context</div>
                <div className="font-medium text-text-primary">
                  {viewInvoice.isInterstate ? "Inter-State (IGST 18%)" : "Intra-State (CGST 9% + SGST 9%)"}
                </div>
              </div>
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <h3 className="font-serif text-base font-semibold text-text-primary">Snapshot Line Items</h3>
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
                  {viewInvoice.lines?.map((line, idx) => (
                    <tr key={idx}>
                      <td className="py-2 px-3">
                        <div className="font-medium text-text-primary">{line.productName}</div>
                        {line.variantName && (
                          <div className="text-text-secondary">{line.variantName}</div>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{line.quantity}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatINR(line.unitPricePaise)}</td>
                      <td className="py-2 px-3 text-right font-mono">{formatINR(line.taxAmountPaise)}</td>
                      <td className="py-2 px-3 text-right font-mono font-medium">
                        {formatINR(line.lineTotalPaise)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total summary */}
            <div className="flex justify-end">
              <div className="w-64 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Tax:</span>
                  <span className="font-mono">
                    {formatINR(
                      viewInvoice.isInterstate
                        ? viewInvoice.igstPaise
                        : viewInvoice.cgstPaise + viewInvoice.sgstPaise
                    )}
                  </span>
                </div>
                <div className="flex justify-between border-t border-border-default pt-1 font-semibold text-sm">
                  <span>Grand Total:</span>
                  <span className="font-mono">{formatINR(viewInvoice.totalPaise)}</span>
                </div>
                <div className="flex justify-between text-semantic-success">
                  <span>Amount Paid:</span>
                  <span className="font-mono">{formatINR(viewInvoice.amountPaidPaise)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-brand-forest">
                  <span>Outstanding Due:</span>
                  <span className="font-mono">{formatINR(viewInvoice.amountDuePaise)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-border-default">
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

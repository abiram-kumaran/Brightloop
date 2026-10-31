import React, { useEffect, useState } from "react";
import { fetchApi, ApiError } from "../../api/client.js";
import { formatINR } from "@brightloop/shared";
import { Badge } from "../../components/ui/Badge.js";
import { Button } from "../../components/ui/Button.js";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, AlertTriangle, CheckCircle, Clock, DollarSign } from "lucide-react";

export function ReportsPage() {
  const [summary, setSummary] = useState<any | null>(null);
  const [overdueList, setOverdueList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReportData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sumRes, overRes] = await Promise.all([
        fetchApi<Record<string, unknown> | { data: Record<string, unknown> }>("/reports/summary"),
        fetchApi<unknown[] | { data: unknown[] }>("/reports/overdue"),
      ]);
      const sumPayload =
        sumRes && typeof sumRes === "object" && "data" in sumRes && sumRes.data
          ? sumRes.data
          : sumRes;
      const overPayload = Array.isArray(overRes)
        ? overRes
        : overRes && typeof overRes === "object" && "data" in overRes && Array.isArray(overRes.data)
          ? overRes.data
          : [];
      setSummary(sumPayload);
      setOverdueList(overPayload);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load report data");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReportData();
  }, []);

  const kpi = summary?.kpi;
  const chartData = (summary?.monthlyRevenueTrend || []).map((m: any) => ({
    month: m.month,
    revenue: m.revenuePaise / 100,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
            Financial Analytics & Executive Reports
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Reconciled accounting metrics, cash collected, overdue aging analysis, and recurring revenue.
          </p>
        </div>
        <Button variant="secondary" onClick={loadReportData} isLoading={isLoading}>
          ↻ Refresh Data
        </Button>
      </div>

      {error && (
        <div className="p-4 rounded-md bg-semantic-dangerBg border border-semantic-danger/20 text-semantic-danger text-sm">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Active Subscriptions */}
        <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
            <span>Active Subs</span>
            <CheckCircle className="w-4 h-4 text-brand-forest" />
          </div>
          <div className="mt-3 font-serif text-3xl font-bold text-text-primary">
            {kpi?.activeSubscriptions ?? "—"}
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Billed on anchor schedule
          </div>
        </div>

        {/* Current MRR */}
        <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
            <span>Current MRR</span>
            <TrendingUp className="w-4 h-4 text-brand-forest" />
          </div>
          <div className="mt-3 font-mono text-2xl font-bold text-brand-forest">
            {kpi ? formatINR(kpi.currentMrrPaise) : "—"}
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Normalized monthly revenue
          </div>
        </div>

        {/* Collected Revenue */}
        <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
            <span>Collected Cash</span>
            <DollarSign className="w-4 h-4 text-semantic-success" />
          </div>
          <div className="mt-3 font-mono text-2xl font-bold text-semantic-success">
            {kpi ? formatINR(kpi.collectedRevenuePaise) : "—"}
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Settled bank/UPI transactions
          </div>
        </div>

        {/* Outstanding Invoices */}
        <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
            <span>Outstanding</span>
            <Clock className="w-4 h-4 text-semantic-warning" />
          </div>
          <div className="mt-3 font-mono text-2xl font-bold text-text-primary">
            {kpi ? formatINR(kpi.outstandingPaise) : "—"}
          </div>
          <div className="mt-1 text-xs text-text-secondary">
            Unsettled confirmed invoices
          </div>
        </div>

        {/* Overdue Debt */}
        <div className="bg-surface-card border border-border-default rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-text-secondary text-xs uppercase font-semibold">
            <span>Overdue Amount</span>
            <AlertTriangle className="w-4 h-4 text-semantic-danger" />
          </div>
          <div className="mt-3 font-mono text-2xl font-bold text-semantic-danger">
            {kpi ? formatINR(kpi.overduePaise) : "—"}
          </div>
          <div className="mt-1 text-xs text-semantic-danger font-medium">
            {kpi?.overdueCount ?? 0} invoices past due date
          </div>
        </div>
      </div>

      {/* Chart Section */}
      <div className="bg-surface-card border border-border-default rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-text-primary">
            Revenue Collections Over Time
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Cash collected through settled payment transactions per billing period (INR ₹)
          </p>
        </div>

        <div className="h-72 w-full pt-4">
          {chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-text-secondary text-sm">
              No historical payment trends yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0dcd1" />
                <XAxis dataKey="month" stroke="#686256" fontSize={12} tickLine={false} />
                <YAxis
                  stroke="#686256"
                  fontSize={12}
                  tickLine={false}
                  tickFormatter={(val) => `₹${val.toLocaleString("en-IN")}`}
                />
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString("en-IN")}`, "Collected Revenue"]}
                  contentStyle={{
                    backgroundColor: "#f7f2ea",
                    borderColor: "#d8d0c0",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="revenue" fill="#1b3b2b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Overdue Aging Table */}
      <div className="bg-surface-card border border-border-default rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-text-primary">
            Overdue Invoices & Aging Report
          </h2>
          <p className="text-xs text-text-secondary mt-0.5">
            Confirmed invoices past their specified due dates requiring dunning follow-ups
          </p>
        </div>

        {overdueList.length === 0 ? (
          <div className="text-center py-8 text-sm text-semantic-success font-medium">
            ✓ Excellent! Zero overdue invoices across all accounts.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-creamDeep border-b border-border-default text-text-secondary font-mono text-xs uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Issue Date</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Days Overdue</th>
                  <th className="py-3 px-4 text-right">Outstanding Amount</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {overdueList.map((inv) => (
                  <tr key={inv.id} className="hover:bg-brand-cream/50 transition">
                    <td className="py-3.5 px-4 font-mono font-medium text-brand-forest">
                      {inv.number}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-medium text-text-primary">{inv.customerName}</div>
                      <div className="text-xs text-text-secondary">{inv.customerEmail}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-text-secondary">
                      {new Date(inv.issueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-semantic-danger font-semibold">
                      {new Date(inv.dueDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-semantic-dangerBg text-semantic-danger border border-semantic-danger/20 font-mono">
                        +{inv.daysOverdue} days
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-semantic-danger">
                      {formatINR(inv.amountDuePaise)}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge variant="overdue">Overdue</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

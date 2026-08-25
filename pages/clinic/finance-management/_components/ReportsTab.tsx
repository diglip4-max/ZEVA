import React from "react";
import {
  Loader2,
  Inbox,
  AlertTriangle,
  BarChart3,
  Wallet,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import useFinanceReports, {
  REPORT_OPTIONS,
  ReportType,
} from "../_hooks/useFinanceReports";
import StatCard from "./StatCard";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney } from "@/lib/currencyHelper";
import { UseFinancePermissionReturn } from "../_hooks/useFinancePermission";

const formatDate = (d?: string): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PIE_COLORS = [
  "#14b8a6",
  "#f59e0b",
  "#6366f1",
  "#ef4444",
  "#8b5cf6",
  "#0ea5e9",
];

// ============================================================
// EMPTY / LOADING / ERROR shells (shared)
// ============================================================
const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
    {children}
  </div>
);

const EmptyState = ({
  label = "No data for this range.",
}: {
  label?: string;
}) => (
  <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
    <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
    <span className="text-sm">{label}</span>
  </div>
);

// ============================================================
// GENERIC BILL TABLE — used by outstanding / paid / upcoming
// ============================================================
function BillTable({ rows, currency }: { rows: any[]; currency: string }) {
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="divide-y divide-stone-100 dark:divide-stone-800">
      {rows.map((b) => (
        <div
          key={b._id}
          className="px-5 py-3 flex items-center justify-between"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
              {b.supplierId?.name || "—"}
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500 zfm-mono">
              {b.invoiceNumber}
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500">
              {b.category}
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500">
              Due {formatDate(b.dueDate)}
            </span>
          </div>
          <span className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-100 shrink-0">
            {formatMoney(b.amount - (b.paidAmount || 0), currency)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// MAIN TAB
// ============================================================
const ReportsTab: React.FC<UseFinancePermissionReturn> = ({
  // permissions,
  permissionsLoaded,
  AccessDenied,
  PermissionLoading,
  canAccessPage,
}) => {
  const { currency } = useCurrency();
  const {
    reportType,
    setReportType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    year,
    setYear,
    loading,
    error,
    result,
  } = useFinanceReports();

  const renderBody = () => {
    if (loading) {
      return (
        <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600 dark:text-teal-400" />
          <span className="text-sm">Loading report…</span>
        </div>
      );
    }
    if (error) {
      return (
        <div className="px-5 py-16 text-center text-rose-500 dark:text-rose-400 text-sm">
          <AlertTriangle className="w-5 h-5 mx-auto mb-2" />
          {error}
        </div>
      );
    }
    if (!result) return <EmptyState />;

    switch (reportType as ReportType) {
      case "expense": {
        const rows = result.data || [];
        if (rows.length === 0) return <EmptyState />;
        return (
          <>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={rows}>
                  <CartesianGrid stroke="#e7e5e4" vertical={false} />
                  <XAxis
                    dataKey="category"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v / 1000}k`}
                  />
                  <Tooltip
                    formatter={(value: any) =>
                      formatMoney(
                        Array.isArray(value) ? value[0] : value,
                        currency,
                      )
                    }
                  />
                  <Bar
                    dataKey="totalSpent"
                    fill="#14b8a6"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="divide-y divide-stone-100 dark:divide-stone-800 border-t border-stone-100 dark:border-stone-800">
              {rows.map((r: any) => (
                <div
                  key={r.category}
                  className="px-5 py-3 flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
                    {r.category}
                  </span>
                  <div className="flex items-center gap-6">
                    <span className="text-xs text-stone-400 dark:text-stone-500">
                      {r.count} entries
                    </span>
                    <span className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-100">
                      {formatMoney(r.totalSpent, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      }

      case "outstandingBills":
      case "paidBills":
      case "upcomingBills":
        return <BillTable rows={result.data || []} currency={currency} />;

      case "paymentHistory": {
        const rows = result.data || [];
        if (rows.length === 0) return <EmptyState />;
        return (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {rows.map((p: any) => (
              <div
                key={p._id}
                className="px-5 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-stone-800 dark:text-stone-100 zfm-mono">
                    {p.paymentNumber}
                  </span>
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    {p.supplierId?.name || "—"}
                  </span>
                  <span className="text-xs text-stone-400 dark:text-stone-500 capitalize">
                    {p.method?.replace("_", " ")}
                  </span>
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    {formatDate(p.date)}
                  </span>
                  {p.reversed && (
                    <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full">
                      Reversed
                    </span>
                  )}
                </div>
                <span
                  className={`font-mono text-sm font-semibold shrink-0 ${
                    p.reversed
                      ? "text-stone-400 dark:text-stone-500 line-through"
                      : "text-teal-600 dark:text-teal-400"
                  }`}
                >
                  {formatMoney(p.amount, currency)}
                </span>
              </div>
            ))}
          </div>
        );
      }

      case "pettyCash": {
        const daily = result.daily || [];
        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
              <StatCard
                label="Cash In"
                value={formatMoney(result.summary.cashIn, currency)}
                icon={<TrendingUp />}
                fromColor="#0d9488"
                toColor="#14b8a6"
                iconColor="text-white"
                trend="This selection"
                trendPositive={true}
              />
              <StatCard
                label="Cash Out"
                value={formatMoney(result.summary.cashOut, currency)}
                icon={<TrendingDown />}
                fromColor="#dc2626"
                toColor="#ef4444"
                iconColor="text-white"
                trend="This selection"
                trendPositive={false}
              />
              <StatCard
                label="Net"
                value={formatMoney(result.summary.net, currency)}
                icon={<BarChart3 />}
                fromColor="#7c3aed"
                toColor="#8b5cf6"
                iconColor="text-white"
                trend="In minus out"
                trendPositive={result.summary.net >= 0}
              />
              <StatCard
                label="Current Balance"
                value={formatMoney(result.summary.currentBalance, currency)}
                icon={<Wallet />}
                fromColor="#4f46e5"
                toColor="#6366f1"
                iconColor="text-white"
                trend="All-time"
                trendPositive={true}
              />
            </div>
            {daily.length > 0 ? (
              <div className="px-5 pb-5">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={daily}>
                    <CartesianGrid stroke="#e7e5e4" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `${v / 1000}k`}
                    />
                    <Tooltip
                      formatter={(value: any) =>
                        formatMoney(
                          Array.isArray(value) ? value[0] : value,
                          currency,
                        )
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="cashIn"
                      stroke="#14b8a6"
                      strokeWidth={2}
                      dot={false}
                      name="Cash In"
                    />
                    <Line
                      type="monotone"
                      dataKey="cashOut"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                      name="Cash Out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState />
            )}
          </>
        );
      }

      case "cheques": {
        const rows = result.data || [];
        if (rows.length === 0) return <EmptyState />;
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-5">
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={rows}
                  dataKey="totalAmount"
                  nameKey="status"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {rows.map((_: any, i: number) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: any) =>
                    formatMoney(
                      Array.isArray(value) ? value[0] : value,
                      currency,
                    )
                  }
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="divide-y divide-stone-100 dark:divide-stone-800 self-center">
              {rows.map((r: any, i: number) => (
                <div
                  key={r.status}
                  className="py-2.5 flex items-center justify-between"
                >
                  <span className="flex items-center gap-2 text-sm capitalize text-stone-700 dark:text-stone-200">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {r.status}{" "}
                    <span className="text-xs text-stone-400">({r.count})</span>
                  </span>
                  <span className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {formatMoney(r.totalAmount, currency)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        );
      }

      case "supplier": {
        const rows = result.data || [];
        if (rows.length === 0) return <EmptyState />;
        return (
          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {rows.map((s: any) => (
              <div
                key={s.supplierId}
                className="px-5 py-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
                    {s.supplierName}
                  </span>
                  <span className="text-xs text-stone-400 dark:text-stone-500">
                    {s.billCount} bills
                  </span>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  <div className="text-right">
                    <div className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                      Billed
                    </div>
                    <div className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-100">
                      {formatMoney(s.totalBilled, currency)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                      Paid
                    </div>
                    <div className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-100">
                      {formatMoney(s.totalPaid, currency)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                      Balance
                    </div>
                    <div className="font-mono text-sm font-semibold text-rose-500 dark:text-rose-400">
                      {formatMoney(s.totalBalance, currency)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        );
      }

      case "yearlySummary": {
        const chartData = result.months
          ? result.months.map((m: any) => ({
              label: MONTH_NAMES[m.month - 1],
              expense: m.expense,
              income: m.income,
            }))
          : (result.data || []).map((y: any) => ({
              label: String(y.year),
              expense: y.expense,
              income: y.income,
            }));
        if (chartData.length === 0) return <EmptyState />;
        return (
          <div className="p-5">
            {result.summary && (
              <div className="grid grid-cols-3 gap-4 mb-5">
                <StatCard
                  label="Total Expense"
                  value={formatMoney(result.summary.totalExpense, currency)}
                  icon={<TrendingDown />}
                  fromColor="#dc2626"
                  toColor="#ef4444"
                  iconColor="text-white"
                  trend={`Year ${result.year}`}
                  trendPositive={false}
                />
                <StatCard
                  label="Total Income"
                  value={formatMoney(result.summary.totalIncome, currency)}
                  icon={<TrendingUp />}
                  fromColor="#0d9488"
                  toColor="#14b8a6"
                  iconColor="text-white"
                  trend={`Year ${result.year}`}
                  trendPositive={true}
                />
                <StatCard
                  label="Net"
                  value={formatMoney(result.summary.net, currency)}
                  icon={<BarChart3 />}
                  fromColor="#7c3aed"
                  toColor="#8b5cf6"
                  iconColor="text-white"
                  trend="Income minus expense"
                  trendPositive={result.summary.net >= 0}
                />
              </div>
            )}
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData}>
                <CartesianGrid stroke="#e7e5e4" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${v / 1000}k`}
                />
                <Tooltip
                  formatter={(value: any) =>
                    formatMoney(
                      Array.isArray(value) ? value[0] : value,
                      currency,
                    )
                  }
                />
                <Bar
                  dataKey="expense"
                  fill="#ef4444"
                  radius={[6, 6, 0, 0]}
                  name="Expense"
                />
                <Bar
                  dataKey="income"
                  fill="#14b8a6"
                  radius={[6, 6, 0, 0]}
                  name="Income"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }

      default:
        return <EmptyState />;
    }
  };

  // ----------------------------------------------------------
  //  STEP 2: Early returns — loading aur access denied gates
  //  Important: ye sab hooks ke niche aur return se pehle
  // ----------------------------------------------------------
  if (!permissionsLoaded) {
    return <PermissionLoading />;
  }

  if (!canAccessPage) {
    return <AccessDenied />;
  }

  return (
    <div className="space-y-7">
      <div>
        <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
          Reports
        </h2>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
          Expense, vendor, cheque and payment history reports
        </p>
      </div>

      {/* Report picker */}
      <div className="flex flex-wrap gap-2">
        {REPORT_OPTIONS.map((r) => (
          <button
            key={r.value}
            onClick={() => setReportType(r.value)}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap border ${
              reportType === r.value
                ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 border-stone-900 dark:border-stone-100"
                : "bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4 flex flex-wrap items-center gap-2.5">
        {reportType === "yearlySummary" ? (
          <>
            <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
              Year
            </span>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
            />
            <button
              onClick={() => setYear("")}
              className="text-xs font-semibold text-stone-400 dark:text-stone-500 hover:text-teal-600 dark:hover:text-teal-400"
            >
              Clear (show all years)
            </button>
          </>
        ) : (
          <>
            <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
              From
            </span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
            />
            <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
              To
            </span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
            />
          </>
        )}
      </div>

      <Shell>{renderBody()}</Shell>
    </div>
  );
};

export default ReportsTab;

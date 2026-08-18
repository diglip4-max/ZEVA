// components/finance/OverviewTab.tsx
import React, { useMemo, useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  ShieldCheck,
  DollarSign,
  ShoppingBag,
  Receipt,
  PieChart,
  Calendar,
  Filter,
  X,
  BarChart3,
  LineChart as LineChartIcon,
  Activity,
  CreditCard,
  Percent,
  ChevronDown,
  ChevronRight,
  Wallet,
  Stethoscope,
  FileText,
  Package,
  Inbox,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
  LineChart,
  Line,
} from "recharts";
import useOverview, { OverviewFilters } from "../_hooks/useOverview";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney } from "@/lib/currencyHelper";
import {
  getPatientInitials,
  getPatientDisplayName,
  getAvatarColor,
} from "../_hooks/useBilling";

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,650&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.zfm-display { font-family: 'Fraunces', serif; letter-spacing: -0.01em; }
.zfm-body { font-family: 'Manrope', sans-serif; }
.zfm-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
`;

// ============================================================
// SUB-COMPONENTS
// ============================================================

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactElement;
  trend?: string;
  trendPositive?: boolean;
  fromColor: string;
  toColor: string;
  iconColor: string;
}

function StatCard({
  label,
  value,
  icon,
  trend,
  trendPositive,
  fromColor,
  toColor,
  iconColor,
}: StatCardProps) {
  return (
    <div className="group bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
          {label}
        </span>
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundImage: `linear-gradient(135deg, ${fromColor}, ${toColor})`,
          }}
        >
          {React.cloneElement(icon, {
            className: `w-4 h-4 ${iconColor}`,
          } as React.HTMLAttributes<SVGElement>)}
        </div>
      </div>
      <div className="zfm-display text-[27px] font-semibold text-stone-900 dark:text-stone-50">
        {value}
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 mt-2 text-xs font-semibold ${trendPositive ? "text-teal-600 dark:text-teal-400" : "text-rose-500 dark:text-rose-400"}`}
        >
          {trendPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {trend}
        </div>
      )}
    </div>
  );
}

interface SectionHeadingProps {
  children: React.ReactNode;
  action?: React.ReactNode;
}

function SectionHeading({ children, action }: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between mb-5">
      <h3 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50 flex items-center gap-2.5">
        <span
          className="w-1 h-5 rounded-full inline-block"
          style={{ backgroundImage: "linear-gradient(180deg,#2dd4bf,#0f766e)" }}
        />
        {children}
      </h3>
      {action}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { dot: string; text: string; bg: string }> = {
    Active: {
      dot: "bg-blue-500",
      text: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
    },
    Completed: {
      dot: "bg-teal-500",
      text: "text-teal-700 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/50",
    },
    Paid: {
      dot: "bg-teal-500",
      text: "text-teal-700 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/50",
    },
    Partial: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    },
    Pending: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    },
    Overdue: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/50",
    },
    Cancelled: {
      dot: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/50",
    },
    Rejected: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/50",
    },
    Released: {
      dot: "bg-purple-500",
      text: "text-purple-700 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/50",
    },
  };
  const s = map[status] || map.Active;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function ServiceBadge({ service }: { service: string }) {
  const map: Record<
    string,
    { icon: React.ReactNode; bg: string; text: string }
  > = {
    Package: {
      icon: <Package className="w-3 h-3" />,
      bg: "bg-purple-50 dark:bg-purple-950/50",
      text: "text-purple-700 dark:text-purple-400",
    },
    Treatment: {
      icon: <Stethoscope className="w-3 h-3" />,
      bg: "bg-blue-50 dark:bg-blue-950/50",
      text: "text-blue-700 dark:text-blue-400",
    },
    Service: {
      icon: <FileText className="w-3 h-3" />,
      bg: "bg-teal-50 dark:bg-teal-950/50",
      text: "text-teal-700 dark:text-teal-400",
    },
    Product: {
      icon: <CreditCard className="w-3 h-3" />,
      bg: "bg-amber-50 dark:bg-amber-950/50",
      text: "text-amber-700 dark:text-amber-400",
    },
  };
  const s = map[service] || map.Service;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${s.bg} ${s.text}`}
    >
      {s.icon}
      {service}
    </span>
  );
}

const formatDate = (d?: string | Date): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatDateTime = (d?: string | Date): string =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const getInvoicedByName = (item: any): string => {
  if (!item.invoicedById) return "—";
  if (typeof item.invoicedById === "string")
    return `User #${item.invoicedById.slice(-6)}`;
  return (
    item.invoicedById.name ||
    item.invoicedById.email ||
    `User #${item.invoicedById._id.slice(-6)}`
  );
};

function PaymentBreakdown({ item }: { item: any }) {
  const { currency } = useCurrency();
  const hasMultiplePayments =
    item.multiplePayments && item.multiplePayments.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-500 dark:text-stone-400">Amount</span>
        <span className="font-semibold text-stone-800 dark:text-stone-100">
          {formatMoney(item.amount, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-500 dark:text-stone-400">Paid</span>
        <span className="font-semibold text-teal-600 dark:text-teal-400">
          {formatMoney(item.paid, currency)}
        </span>
      </div>
      {item.pending > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-500 dark:text-stone-400">Pending</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {formatMoney(item.pending, currency)}
          </span>
        </div>
      )}
      {item.advance && item.advance > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-500 dark:text-stone-400">Advance</span>
          <span className="font-semibold text-purple-600 dark:text-purple-400">
            {formatMoney(item.advance, currency)}
          </span>
        </div>
      )}
      {hasMultiplePayments && (
        <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
            Split Payments
          </div>
          {item.multiplePayments?.map((payment: any, idx: number) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-stone-500 dark:text-stone-400">
                {payment.paymentMethod}
              </span>
              <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">
                {formatMoney(payment.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================
// FILTER BAR
// ============================================================

interface FilterBarProps {
  filters: OverviewFilters;
  onFiltersChange: (filters: OverviewFilters) => void;
  onRefresh: () => void;
  loading: boolean;
}

function FilterBar({
  filters,
  onFiltersChange,
  onRefresh,
  loading,
}: FilterBarProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [localFilters, setLocalFilters] = useState<OverviewFilters>(filters);

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    const cleared = { period: "monthly" } as OverviewFilters;
    setLocalFilters(cleared);
    onFiltersChange(cleared);
    setShowFilters(false);
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
            <Calendar className="w-4 h-4" />
            <span className="font-medium">
              {filters.startDate && filters.endDate
                ? `${new Date(filters.startDate).toLocaleDateString()} - ${new Date(filters.endDate).toLocaleDateString()}`
                : filters.startDate
                  ? `From ${new Date(filters.startDate).toLocaleDateString()}`
                  : filters.endDate
                    ? `Until ${new Date(filters.endDate).toLocaleDateString()}`
                    : "All Time"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest">
              Period:
            </span>
            <select
              value={filters.period || "monthly"}
              onChange={(e) => {
                const newFilters = {
                  ...filters,
                  period: e.target.value as any,
                };
                setLocalFilters(newFilters);
                onFiltersChange(newFilters);
              }}
              className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all"
          >
            <Filter className="w-4 h-4" />
            Filters
            {(filters.startDate || filters.endDate) && (
              <span className="w-2 h-2 rounded-full bg-teal-500" />
            )}
          </button>
          <button
            onClick={onRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-full bg-teal-600 hover:bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Activity className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Start Date
              </label>
              <input
                type="date"
                value={localFilters.startDate || ""}
                onChange={(e) =>
                  setLocalFilters({
                    ...localFilters,
                    startDate: e.target.value,
                  })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                End Date
              </label>
              <input
                type="date"
                value={localFilters.endDate || ""}
                onChange={(e) =>
                  setLocalFilters({ ...localFilters, endDate: e.target.value })
                }
                className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-lg transition-all"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                className="rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHART COMPONENTS
// ============================================================

interface MonthlyTrendChartProps {
  data: any[];
  currency: string;
  isDark?: boolean;
}

function MonthlyTrendChart({
  data,
  currency,
  isDark = false,
}: MonthlyTrendChartProps) {
  const chartGrid = isDark ? "#292524" : "#f0efed";
  const chartAxis = isDark ? "#78716c" : "#a8a29e";
  const chartAxisMuted = isDark ? "#57534e" : "#c4c1bd";

  const formatCurrency = (value: any) => formatMoney(Number(value), currency);

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 p-6">
      <SectionHeading>
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          Monthly Billing Trend
        </div>
      </SectionHeading>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={chartGrid}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: chartAxis }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: chartAxisMuted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatCurrency}
          />
          <Tooltip
            formatter={(v) => formatMoney(Number(v), currency)}
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${isDark ? "#292524" : "#f0efed"}`,
              fontSize: 12,
              backgroundColor: isDark ? "#1c1917" : "#ffffff",
              color: isDark ? "#e7e5e4" : "#1c1917",
            }}
          />
          <Legend />
          <Bar
            dataKey="totalAmount"
            name="Total Billed"
            fill="#0f766e"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="totalPaid"
            name="Paid"
            fill="#14b8a6"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="totalPending"
            name="Pending"
            fill="#d97706"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ServiceDistributionChartProps {
  data: any[];
  currency: string;
  isDark?: boolean;
}

function ServiceDistributionChart({
  data,
  currency,
  isDark = false,
}: ServiceDistributionChartProps) {
  const COLORS = [
    "#0f766e",
    "#14b8a6",
    "#5eead4",
    "#d97706",
    "#f59e0b",
    "#e11d48",
  ];

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 p-6">
      <SectionHeading>
        <div className="flex items-center gap-2">
          <PieChart className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          Revenue by Service
        </div>
      </SectionHeading>
      <ResponsiveContainer width="100%" height={250}>
        <RePieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="_id"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent = 0 }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => formatMoney(Number(v), currency)}
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${isDark ? "#292524" : "#f0efed"}`,
              fontSize: 12,
              backgroundColor: isDark ? "#1c1917" : "#ffffff",
              color: isDark ? "#e7e5e4" : "#1c1917",
            }}
          />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface PaymentMethodChartProps {
  data: any[];
  currency: string;
  isDark?: boolean;
}

function PaymentMethodChart({
  data,
  currency,
  isDark = false,
}: PaymentMethodChartProps) {
  const COLORS = [
    "#0f766e",
    "#14b8a6",
    "#5eead4",
    "#d97706",
    "#f59e0b",
    "#e11d48",
  ];

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 p-6">
      <SectionHeading>
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          Payment Methods
        </div>
      </SectionHeading>
      <ResponsiveContainer width="100%" height={200}>
        <RePieChart>
          <Pie
            data={data}
            dataKey="total"
            nameKey="_id"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => formatMoney(Number(v), currency)}
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${isDark ? "#292524" : "#f0efed"}`,
              fontSize: 12,
              backgroundColor: isDark ? "#1c1917" : "#ffffff",
              color: isDark ? "#e7e5e4" : "#1c1917",
            }}
          />
        </RePieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-3 justify-center">
        {data.map((item, index) => (
          <div key={index} className="flex items-center gap-1.5 text-xs">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-stone-600 dark:text-stone-400">
              {item._id || "Unknown"}
            </span>
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              ({formatMoney(item.total, currency)})
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface StatusDistributionChartProps {
  data: any[];
  currency: string;
  isDark?: boolean;
}

function StatusDistributionChart({
  data,
  isDark = false,
}: StatusDistributionChartProps) {
  const COLORS = ["#0f766e", "#d97706", "#e11d48"];

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 p-6">
      <SectionHeading>
        <div className="flex items-center gap-2">
          <Percent className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          Status Breakdown
        </div>
      </SectionHeading>
      <ResponsiveContainer width="100%" height={200}>
        <RePieChart>
          <Pie
            data={data}
            dataKey="count"
            nameKey="_id"
            cx="50%"
            cy="50%"
            innerRadius={40}
            outerRadius={70}
            label={({ percent = 0 }) => `${(percent * 100).toFixed(0)}%`}
          >
            {data.map((_entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(v, name) => [`${Number(v) || 0} invoices`, name]}
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${isDark ? "#292524" : "#f0efed"}`,
              fontSize: 12,
              backgroundColor: isDark ? "#1c1917" : "#ffffff",
              color: isDark ? "#e7e5e4" : "#1c1917",
            }}
          />
        </RePieChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ManualPettyCashTrendChartProps {
  data: any[];
  currency: string;
  isDark?: boolean;
}

function ManualPettyCashTrendChart({
  data,
  currency,
  isDark = false,
}: ManualPettyCashTrendChartProps) {
  const chartGrid = isDark ? "#292524" : "#f0efed";
  const chartAxis = isDark ? "#78716c" : "#a8a29e";
  const chartAxisMuted = isDark ? "#57534e" : "#c4c1bd";

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 p-6">
      <SectionHeading>
        <div className="flex items-center gap-2">
          <LineChartIcon className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          Manual Petty Cash Trend
        </div>
      </SectionHeading>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={data}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={chartGrid}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: chartAxis }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: chartAxisMuted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatMoney(Number(v), currency)}
          />
          <Tooltip
            formatter={(v) => formatMoney(Number(v), currency)}
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${isDark ? "#292524" : "#f0efed"}`,
              fontSize: 12,
              backgroundColor: isDark ? "#1c1917" : "#ffffff",
              color: isDark ? "#e7e5e4" : "#1c1917",
            }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="totalIncome"
            name="Income"
            stroke="#0f766e"
            strokeWidth={2.5}
          />
          <Line
            type="monotone"
            dataKey="totalExpenses"
            name="Expenses"
            stroke="#e11d48"
            strokeWidth={2.5}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ProductSalesTrendChartProps {
  data: any[];
  currency: string;
  isDark?: boolean;
}

function ProductSalesTrendChart({
  data,
  currency,
  isDark = false,
}: ProductSalesTrendChartProps) {
  const chartGrid = isDark ? "#292524" : "#f0efed";
  const chartAxis = isDark ? "#78716c" : "#a8a29e";
  const chartAxisMuted = isDark ? "#57534e" : "#c4c1bd";

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 p-6">
      <SectionHeading>
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          Product Sales Trend
        </div>
      </SectionHeading>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0f766e" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#0f766e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={chartGrid}
            vertical={false}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: chartAxis }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: chartAxisMuted }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => formatMoney(Number(v), currency)}
          />
          <Tooltip
            formatter={(v) => formatMoney(Number(v), currency)}
            contentStyle={{
              borderRadius: 12,
              border: `1px solid ${isDark ? "#292524" : "#f0efed"}`,
              fontSize: 12,
              backgroundColor: isDark ? "#1c1917" : "#ffffff",
              color: isDark ? "#e7e5e4" : "#1c1917",
            }}
          />
          <Legend />
          <Area
            type="monotone"
            dataKey="totalSales"
            name="Total Sales"
            stroke="#0f766e"
            fill="url(#salesGrad)"
            strokeWidth={2.5}
          />
          <Area
            type="monotone"
            dataKey="totalPaid"
            name="Paid"
            stroke="#14b8a6"
            fill="none"
            strokeWidth={2}
            strokeDasharray="5 5"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// RECENT BILLINGS TABLE
// ============================================================

interface RecentBillingsProps {
  billings: any[];
  currency: string;
  onViewAll: () => void;
}

function RecentBillings({
  billings,
  currency,
  onViewAll,
}: RecentBillingsProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden">
      <div className="p-6 border-b border-stone-100 dark:border-stone-800">
        <SectionHeading
          action={
            <button
              onClick={onViewAll}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300"
            >
              View All →
            </button>
          }
        >
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            Recent Billings
          </div>
        </SectionHeading>
      </div>

      {billings.length === 0 ? (
        <div className="text-center py-16 text-stone-400 dark:text-stone-500">
          <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
          <p className="text-sm">No recent billings found.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-stone-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-widest font-bold border-b border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30">
                <th className="px-5 py-3.5 font-bold w-10"></th>
                <th className="px-5 py-3.5 font-bold">Invoice</th>
                <th className="px-5 py-3.5 font-bold">Patient</th>
                <th className="px-5 py-3.5 font-bold">Service</th>
                <th className="px-5 py-3.5 font-bold text-right">Amount</th>
                <th className="px-5 py-3.5 font-bold text-right">Paid</th>
                <th className="px-5 py-3.5 font-bold text-right">Pending</th>
                <th className="px-5 py-3.5 font-bold text-right">
                  Payment Method
                </th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Date</th>
                <th className="px-5 py-3.5 font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {billings.map((item, idx) => {
                const expanded = expandedIds.has(item._id);
                const status = item.status || "Active";
                const isFullyPaid = item.pending === 0 && item.paid > 0;

                return (
                  <React.Fragment key={item._id || idx}>
                    <tr
                      className={`${
                        idx % 2 === 1
                          ? "bg-stone-50/50 dark:bg-stone-800/30"
                          : "bg-white dark:bg-stone-900"
                      } hover:bg-teal-50/50 dark:hover:bg-teal-950/30 transition-colors duration-150`}
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => toggleExpand(item._id)}
                          className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors shadow-sm dark:shadow-stone-900/20"
                          aria-label={expanded ? "Collapse" : "Expand"}
                        >
                          {expanded ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="font-mono font-semibold text-stone-800 dark:text-stone-100 text-xs">
                          {item.invoiceNumber}
                        </div>
                        <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                          {getInvoicedByName(item)}
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(item.patientId)}`}
                          >
                            {getPatientInitials(item.patientId)}
                          </div>
                          <div>
                            <div className="text-stone-800 dark:text-stone-100 font-medium text-sm">
                              {getPatientDisplayName(item.patientId)}
                            </div>
                            {item.patientId &&
                              typeof item.patientId !== "string" &&
                              item.patientId.emrNumber && (
                                <div className="text-[10px] text-stone-400 dark:text-stone-500">
                                  EMR: {item.patientId.emrNumber}
                                </div>
                              )}
                            {item.doctorName && (
                              <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                                Dr. {item.doctorName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-1">
                          <ServiceBadge service={item.service} />
                          {(item.treatment || item.package) && (
                            <span className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[120px]">
                              {item.treatment || item.package}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-stone-800 dark:text-stone-100">
                        {formatMoney(item.amount, currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-teal-600 dark:text-teal-400">
                        {formatMoney(item.paid, currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                        {formatMoney(item.pending, currency)}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400 text-xs">
                        {item.paymentMethod}
                      </td>
                      <td className="px-5 py-3.5">
                        <StatusPill status={status} />
                        {isFullyPaid && item.pending === 0 && (
                          <div className="text-[9px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">
                            Fully Paid
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-stone-400 dark:text-stone-500 font-mono text-xs whitespace-nowrap">
                        {formatDate(item.invoicedDate)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          onClick={() => toggleExpand(item._id)}
                          className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 whitespace-nowrap hover:underline"
                        >
                          {expanded ? "Hide" : "Details"}
                        </button>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="bg-stone-50/70 dark:bg-stone-800/40">
                        <td
                          colSpan={10}
                          className="px-5 py-5 border-t border-stone-200 dark:border-stone-700"
                        >
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Payment Details */}
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                <Wallet className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                Payment Details
                              </div>
                              <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm dark:shadow-stone-900/20">
                                <PaymentBreakdown item={item} />
                              </div>
                            </div>

                            {/* Treatment/Service Details */}
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                <Stethoscope className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                Treatment Details
                              </div>
                              <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm dark:shadow-stone-900/20 space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-stone-500 dark:text-stone-400">
                                    Service
                                  </span>
                                  <span className="font-medium text-stone-800 dark:text-stone-100">
                                    {item.service}
                                  </span>
                                </div>
                                {item.treatment && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Treatment
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.treatment}
                                    </span>
                                  </div>
                                )}
                                {item.package && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Package
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.package}
                                    </span>
                                  </div>
                                )}
                                {item.quantity && item.quantity > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Quantity
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.quantity}
                                    </span>
                                  </div>
                                )}
                                {item.sessions && item.sessions > 0 && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Sessions
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.sessions}
                                    </span>
                                  </div>
                                )}
                                {item.doctorName && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Doctor
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.doctorName}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Additional Info */}
                            <div>
                              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                Additional Info
                              </div>
                              <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm dark:shadow-stone-900/20 space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-stone-500 dark:text-stone-400">
                                    Created
                                  </span>
                                  <span className="font-medium text-stone-800 dark:text-stone-100 text-xs">
                                    {formatDateTime(item.createdAt)}
                                  </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-stone-500 dark:text-stone-400">
                                    Invoiced By
                                  </span>
                                  <span className="font-medium text-stone-800 dark:text-stone-100">
                                    {getInvoicedByName(item)}
                                  </span>
                                </div>
                                {item.invoicedByRole && (
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Role
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.invoicedByRole}
                                    </span>
                                  </div>
                                )}
                                {item.notes && (
                                  <div className="text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Notes
                                    </span>
                                    <p className="text-stone-700 dark:text-stone-300 mt-1 text-sm bg-stone-50 dark:bg-stone-800 rounded-lg px-3 py-2 border border-stone-100 dark:border-stone-700">
                                      {item.notes}
                                    </p>
                                  </div>
                                )}
                                {item.pendingBalanceImage &&
                                  item.pendingBalanceImage.length > 0 && (
                                    <div>
                                      <span className="text-xs text-stone-500 dark:text-stone-400">
                                        Pending Balance Images
                                      </span>
                                      <div className="flex gap-1 mt-1">
                                        {item.pendingBalanceImage.map(
                                          (url: string, i: number) => (
                                            <a
                                              key={i}
                                              href={url}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                                            >
                                              📎 #{i + 1}
                                            </a>
                                          ),
                                        )}
                                      </div>
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// MAIN OVERVIEW TAB
// ============================================================

interface OverviewTabProps {
  isDark?: boolean;
  onTabChange?: (tab: string) => void;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  isDark = false,
  onTabChange,
}) => {
  const { currency } = useCurrency();
  const { loading, error, data, filters, setFilters, refresh } = useOverview();

  const inr = (n: number): string => formatMoney(n, currency);

  const handleViewAllBillings = () => {
    if (onTabChange) {
      onTabChange("billing");
    }
  };

  // Format chart data
  const formattedMonthlyBilling = useMemo(() => {
    if (!data?.charts?.monthlyBillingTrend) return [];
    return data.charts.monthlyBillingTrend.map((item) => ({
      month: item.month || `M${item._id?.month}/${item._id?.year}`,
      totalAmount: item.totalAmount || 0,
      totalPaid: item.totalPaid || 0,
      totalPending: item.totalPending || 0,
      count: item.count || 0,
    }));
  }, [data]);

  const formattedManualPettyCash = useMemo(() => {
    if (!data?.charts?.monthlyManualPettyCash) return [];
    return data.charts.monthlyManualPettyCash.map((item) => ({
      month: item.month || `M${item._id?.month}/${item._id?.year}`,
      totalIncome: item.totalIncome || 0,
      totalExpenses: item.totalExpenses || 0,
      count: item.count || 0,
    }));
  }, [data]);

  const formattedProductSales = useMemo(() => {
    if (!data?.charts?.monthlyProductSales) return [];
    return data.charts.monthlyProductSales.map((item) => ({
      month: item.month || `M${item._id?.month}/${item._id?.year}`,
      totalSales: item.totalSales || 0,
      totalPaid: item.totalPaid || 0,
      count: item.count || 0,
    }));
  }, [data]);

  const isLoading = loading || !data;

  return (
    <div className="zfm-body">
      <style>{FONTS}</style>

      {/* Filter Bar */}
      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refresh}
        loading={loading}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6 animate-pulse"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-3 w-20 bg-stone-200 dark:bg-stone-700 rounded"></div>
                <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700"></div>
              </div>
              <div className="h-8 w-24 bg-stone-200 dark:bg-stone-700 rounded"></div>
            </div>
          ))}
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 mb-8 text-center">
          <p className="text-rose-600 dark:text-rose-400 font-medium">
            {error}
          </p>
          <button
            onClick={refresh}
            className="mt-3 text-sm font-semibold text-teal-600 dark:text-teal-400 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Summary Cards */}
      {!isLoading && !error && data?.overview && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Revenue"
            value={inr(data.overview.totalRevenue)}
            icon={<TrendingUp />}
            trend="From billing, sales & manual income"
            trendPositive
            fromColor="#ccfbf1"
            toColor="#5eead4"
            iconColor="text-teal-700"
          />
          <StatCard
            label="Total Expenses"
            value={inr(data.overview.totalExpenses)}
            icon={<TrendingDown />}
            trend="Petty cash & manual expenses"
            trendPositive={false}
            fromColor="#ffe4e6"
            toColor="#fda4af"
            iconColor="text-rose-700"
          />

          {/* Net Balance Card */}
          <div
            className="relative overflow-hidden rounded-2xl p-6 text-white shadow-xl hover:shadow-2xl hover:-translate-y-0.5 transition-all duration-300"
            style={{
              backgroundImage:
                "linear-gradient(135deg, #14b8a6 0%, #0f766e 45%, #0a4a44 100%)",
            }}
          >
            <div
              className="absolute -right-10 -top-12 w-40 h-40 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            />
            <div
              className="absolute right-10 bottom-0 w-24 h-24 rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.06)" }}
            />
            <div
              className="absolute top-0 left-0 w-1/2 h-full pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(115deg, rgba(255,255,255,0.14) 0%, transparent 40%)",
              }}
            />
            <div className="relative flex items-center justify-between mb-5">
              <div
                className="w-8 h-6 rounded-[4px]"
                style={{
                  backgroundImage: "linear-gradient(135deg, #fde68a, #d97706)",
                }}
              />
              <ShieldCheck className="w-4 h-4 text-amber-200" />
            </div>
            <span className="relative text-[11px] font-bold text-teal-100 uppercase tracking-widest block mb-1.5">
              Net Balance
            </span>
            <div className="relative zfm-display text-[27px] font-semibold text-amber-200">
              {inr(data.overview.netBalance)}
            </div>
            <div className="relative mt-6 flex items-center justify-between">
              <span className="zfm-mono text-[10px] text-teal-200 tracking-[0.2em]">
                ZEVA •••• FIN01
              </span>
              <span className="text-[10px] text-teal-200">
                {new Date().toLocaleDateString("en-IN", {
                  month: "short",
                  day: "2-digit",
                  year: "numeric",
                })}
              </span>
            </div>
          </div>

          <StatCard
            label="Pending Dues"
            value={inr(data.overview.pendingDues)}
            icon={<Clock />}
            trend={`${data.billing.count || 0} invoices pending`}
            trendPositive={false}
            fromColor="#fef3c7"
            toColor="#fcd34d"
            iconColor="text-amber-700"
          />
        </div>
      )}

      {/* Detailed Stats Grid */}
      {!isLoading && !error && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
              <Receipt className="w-3.5 h-3.5" />
              Billing
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">Paid</span>
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  {inr(data.billing.totalPaid)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Pending
                </span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  {inr(data.billing.totalPending)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Invoices
                </span>
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  {data.billing.count}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
              <DollarSign className="w-3.5 h-3.5" />
              Petty Cash
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Allocated
                </span>
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  {inr(data.pettyCash.totalAllocated)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Spent
                </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {inr(data.pettyCash.totalSpent)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Balance
                </span>
                <span
                  className={`font-semibold ${data.pettyCash?.totalBalance > 0 ? "text-teal-600 dark:text-teal-400" : "text-rose-600 dark:text-rose-400"}`}
                >
                  {inr(data.pettyCash.totalBalance)}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
              <PieChart className="w-3.5 h-3.5" />
              Manual Petty Cash
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Income
                </span>
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  {inr(data.manualPettyCash.totalIncome)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Expenses
                </span>
                <span className="font-semibold text-rose-600 dark:text-rose-400">
                  {inr(data.manualPettyCash.totalExpenses)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Records
                </span>
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  {data.manualPettyCash.totalRecords}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-5 hover:shadow-md transition-all">
            <div className="flex items-center gap-2 text-xs font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-widest mb-2">
              <ShoppingBag className="w-3.5 h-3.5" />
              Product Sales
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Total Sales
                </span>
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  {inr(data.productSales.totalSales)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">Paid</span>
                <span className="font-semibold text-teal-600 dark:text-teal-400">
                  {inr(data.productSales.totalPaid)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-500 dark:text-stone-400">
                  Completed
                </span>
                <span className="font-semibold text-stone-700 dark:text-stone-300">
                  {data.productSales.completedCount}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Section */}
      {!isLoading && !error && data && (
        <div className="space-y-6">
          {/* Monthly Billing Trend */}
          {formattedMonthlyBilling.length > 0 && (
            <MonthlyTrendChart
              data={formattedMonthlyBilling}
              currency={currency}
              isDark={isDark}
            />
          )}

          {/* Two Column Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.charts.billingByService &&
              data.charts.billingByService.length > 0 && (
                <ServiceDistributionChart
                  data={data.charts.billingByService}
                  currency={currency}
                  isDark={isDark}
                />
              )}
            {data.charts.paymentMethodBreakdown &&
              data.charts.paymentMethodBreakdown.length > 0 && (
                <PaymentMethodChart
                  data={data.charts.paymentMethodBreakdown}
                  currency={currency}
                  isDark={isDark}
                />
              )}
          </div>

          {/* Another Two Column Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.charts.statusBreakdown &&
              data.charts.statusBreakdown.length > 0 && (
                <StatusDistributionChart
                  data={data.charts.statusBreakdown}
                  currency={currency}
                  isDark={isDark}
                />
              )}
            {formattedManualPettyCash.length > 0 && (
              <ManualPettyCashTrendChart
                data={formattedManualPettyCash}
                currency={currency}
                isDark={isDark}
              />
            )}
          </div>

          {/* Product Sales Trend */}
          {formattedProductSales.length > 0 && (
            <ProductSalesTrendChart
              data={formattedProductSales}
              currency={currency}
              isDark={isDark}
            />
          )}

          {/* Recent Billings */}
          <RecentBillings
            billings={data.recentBillings || []}
            currency={currency}
            onViewAll={handleViewAllBillings}
          />
        </div>
      )}
    </div>
  );
};

export default OverviewTab;

// components/finance/DashboardTab.tsx
import React, { useState, useContext, useCallback, createContext } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Info,
  Clock,
  FileCheck2,
  ChevronRight,
  Sparkles,
  Wallet,
  Landmark,
  Receipt,
  Building2,
  Filter,
  Calendar,
  Tag,
  CreditCard,
} from "lucide-react";
import useDashboard, {
  DashboardData,
  DashboardFilters,
  FiltersMeta,
} from "../_hooks/useDashboard";
import { UseFinancePermissionReturn } from "../_hooks/useFinancePermission";
import { useRouter } from "next/router";

// ============================================================
// CURRENCY — dynamic, comes from clinic.currency via the API.
// Every subcomponent reads it through this context instead of a
// hard-coded "AED" string.
// ============================================================

const CurrencyContext = createContext<string>("USD");

const useFormatMoney = () => {
  const currency = useContext(CurrencyContext);
  return useCallback(
    (n: number) => `${currency} ${Math.round(n || 0).toLocaleString("en-IN")}`,
    [currency],
  );
};

// ============================================================
// STYLE HELPERS
// ============================================================

const ACCENT: Record<string, { bg: string; text: string }> = {
  teal: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-600 dark:text-teal-400",
  },
  rose: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-600 dark:text-rose-400",
  },
  amber: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-600 dark:text-amber-400",
  },
  sky: {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-600 dark:text-sky-400",
  },
  violet: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-600 dark:text-violet-400",
  },
  stone: {
    bg: "bg-[#F1ECE0] dark:bg-[#1a2622]",
    text: "text-stone-500 dark:text-stone-400",
  },
};

const BILL_STATUS_META: Record<
  string,
  { bg: string; text: string; dot: string }
> = {
  Paid: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    dot: "bg-teal-500",
  },
  Partial: {
    bg: "bg-violet-50 dark:bg-violet-950/40",
    text: "text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
  },
  Upcoming: {
    bg: "bg-sky-50 dark:bg-sky-950/40",
    text: "text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
  },
  Overdue: {
    bg: "bg-rose-50 dark:bg-rose-950/40",
    text: "text-rose-700 dark:text-rose-300",
    dot: "bg-rose-500",
  },
  Presented: {
    bg: "bg-amber-50 dark:bg-amber-950/40",
    text: "text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
  },
  Cleared: {
    bg: "bg-teal-50 dark:bg-teal-950/40",
    text: "text-teal-700 dark:text-teal-300",
    dot: "bg-teal-500",
  },
};

// ============================================================
// FILTER BAR
// ============================================================

interface FilterBarProps {
  filters: DashboardFilters;
  setFilters: (f: Partial<DashboardFilters>) => void;
  resetFilters: () => void;
  meta: FiltersMeta | null;
  metaLoading: boolean;
}

const selectClass =
  "appearance-none bg-white dark:bg-[#0f1a16] border border-[#EDE7DA] dark:border-[#1a2622] rounded-xl pl-9 pr-8 py-2 text-sm font-medium text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30 cursor-pointer min-w-[150px]";

const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  resetFilters,
  meta,
  metaLoading,
}) => {
  const hasActiveFilters =
    filters.period !== "thisMonth" ||
    filters.category !== "all" ||
    filters.supplierId !== "all" ||
    filters.method !== "all";

  return (
    <div className="bg-white dark:bg-[#0f1a16] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm p-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-stone-400 dark:text-stone-500 mr-1">
        <Filter className="w-4 h-4" />
        <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">
          Filters
        </span>
      </div>

      {/* Period / date range */}
      <div className="relative">
        <Calendar className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          className={selectClass}
          value={filters.period}
          onChange={(e) =>
            setFilters({ period: e.target.value as DashboardFilters["period"] })
          }
        >
          {(
            meta?.periods || [
              { value: "today", label: "Today" },
              { value: "yesterday", label: "Yesterday" },
              { value: "last7", label: "Last 7 Days" },
              { value: "last30", label: "Last 30 Days" },
              { value: "thisMonth", label: "This Month" },
              { value: "lastMonth", label: "Last Month" },
              { value: "thisQuarter", label: "This Quarter" },
              { value: "thisYear", label: "This Year" },
              { value: "allTime", label: "All Time" },
              { value: "custom", label: "Custom" },
            ]
          ).map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {filters.period === "custom" && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="bg-white dark:bg-[#0f1a16] border border-[#EDE7DA] dark:border-[#1a2622] rounded-xl px-3 py-2 text-sm text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            value={filters.startDate || ""}
            onChange={(e) => setFilters({ startDate: e.target.value })}
          />
          <span className="text-stone-400 dark:text-stone-500 text-sm">to</span>
          <input
            type="date"
            className="bg-white dark:bg-[#0f1a16] border border-[#EDE7DA] dark:border-[#1a2622] rounded-xl px-3 py-2 text-sm text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
            value={filters.endDate || ""}
            onChange={(e) => setFilters({ endDate: e.target.value })}
          />
        </div>
      )}

      {/* Category */}
      <div className="relative">
        <Tag className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          className={selectClass}
          value={filters.category}
          onChange={(e) => setFilters({ category: e.target.value })}
          disabled={metaLoading}
        >
          <option value="all">All Categories</option>
          {(meta?.categories || []).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Supplier */}
      <div className="relative">
        <Building2 className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          className={selectClass}
          value={filters.supplierId}
          onChange={(e) => setFilters({ supplierId: e.target.value })}
          disabled={metaLoading}
        >
          <option value="all">All Suppliers</option>
          {(meta?.suppliers || []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* Payment method */}
      <div className="relative">
        <CreditCard className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <select
          className={selectClass}
          value={filters.method}
          onChange={(e) => setFilters({ method: e.target.value })}
          disabled={metaLoading}
        >
          <option value="all">All Methods</option>
          {(meta?.paymentMethods || []).map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {hasActiveFilters && (
        <button
          onClick={resetFilters}
          className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline ml-auto"
        >
          Reset filters
        </button>
      )}
    </div>
  );
};

// ============================================================
// COMPONENTS
// ============================================================

interface SectionCardProps {
  title: string;
  icon?: React.ReactNode;
  action?: { label: string; onClick?: () => void };
  subtitle?: string;
  children: React.ReactNode;
  accent?: keyof typeof ACCENT;
}

const SectionCard: React.FC<SectionCardProps> = ({
  title,
  icon,
  action,
  subtitle,
  children,
  accent = "stone",
}) => {
  const a = ACCENT[accent];
  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0f1a16] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDE7DA] dark:border-[#1a2622] flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            {icon && (
              <div
                className={`w-7 h-7 rounded-lg ${a.bg} flex items-center justify-center shrink-0`}
              >
                {React.cloneElement(icon as any, {
                  className: `w-3.5 h-3.5 ${a.text}`,
                })}
              </div>
            )}
            <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
              {title}
            </h3>
          </div>
          {subtitle && (
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 pl-[38px]">
              {subtitle}
            </p>
          )}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline shrink-0 whitespace-nowrap"
          >
            {action.label}
          </button>
        )}
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  );
};

interface BarRowProps {
  label: string;
  value: number;
  pct: number;
  color?: string;
}

const BarRow: React.FC<BarRowProps> = ({
  label,
  value,
  pct,
  color = "bg-teal-500",
}) => {
  const formatMoney = useFormatMoney();
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5 gap-2">
        <span className="text-sm text-stone-600 dark:text-stone-300 truncate">
          {label}
        </span>
        <span className="text-sm font-semibold font-mono text-stone-800 dark:text-stone-100 shrink-0">
          {formatMoney(value)}
        </span>
      </div>
      <div className="relative w-full h-1.5 rounded-full bg-[#F1ECE0] dark:bg-[#1a2622] overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${color}`}
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
    </div>
  );
};

interface StatusPillProps {
  status: string;
}

const StatusPill: React.FC<StatusPillProps> = ({ status }) => {
  const m = BILL_STATUS_META[status] || BILL_STATUS_META.Upcoming;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.bg} ${m.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {status}
    </span>
  );
};

// ============================================================
// DASHBOARD SECTIONS - Using real data from API
// ============================================================

interface SignalRowProps {
  data: DashboardData["signalStats"];
}

const SignalRow: React.FC<SignalRowProps> = ({ data }) => {
  const formatMoney = useFormatMoney();
  const signals = [
    {
      label: "MONEY RECEIVED",
      value: formatMoney(data.moneyReceived),
      trend: `↑ ${data.moneyReceivedTrend}% this period`,
      trendUp: data.moneyReceivedTrend > 0,
      note: "BASED ON ZEVA DATA",
      tone: "text-stone-800 dark:text-stone-100",
      borderColor: "before:bg-teal-500",
    },
    {
      label: "MONEY SPENT",
      value: formatMoney(data.moneySpent),
      trend: `↑ ${data.moneySpentTrend}% this period`,
      trendUp: false,
      tone: "text-stone-800 dark:text-stone-100",
      borderColor: "before:bg-amber-500",
    },
    {
      label: "OUTSTANDING BILLS",
      value: formatMoney(data.outstandingBills),
      note: `${data.outstandingCount} bills`,
      tone: "text-stone-800 dark:text-stone-100",
      borderColor: "before:bg-teal-500",
    },
    {
      label: "OVERDUE",
      value: formatMoney(data.overdue),
      note: `${data.overdueCount} bills`,
      tone: "text-rose-600 dark:text-rose-400",
      borderColor: "before:bg-rose-500",
    },
    {
      label: "UPCOMING PAYMENTS",
      value: formatMoney(data.upcoming),
      note: "Next 30 days",
      tone: "text-amber-600 dark:text-amber-400",
      borderColor: "before:bg-amber-500",
    },
    {
      label: "AVAILABLE CASH",
      value: formatMoney(data.availableCash),
      note: "Petty cash + bank",
      tone: "text-teal-600 dark:text-teal-400",
      borderColor: "before:bg-teal-500",
    },
  ];

  return (
    <div className="flex w-full border border-[#EDE7DA] dark:border-[#1a2622] rounded-2xl overflow-hidden bg-white dark:bg-[#0f1a16] flex-wrap">
      {signals.map((s, index) => (
        <div
          key={s.label}
          className={`relative flex-1 min-w-[140px] px-5 py-4 ${
            index < signals.length - 1
              ? "border-r border-[#EDE7DA] dark:border-[#1a2622]"
              : ""
          } ${s.borderColor} before:content-[''] before:absolute before:left-0 before:top-4 before:bottom-4 before:w-[2px] before:rounded-full`}
        >
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-2">
            {s.label}
          </div>
          <div className={`text-xl font-bold font-mono ${s.tone} mb-1`}>
            {s.value}
          </div>
          {s.trend && (
            <div
              className={`flex items-center gap-1 text-xs font-semibold ${
                s.trendUp
                  ? "text-teal-600 dark:text-teal-400"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              {s.trend}
            </div>
          )}
          {s.note && (
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500 mt-1.5">
              {s.note}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

interface FinancialPositionCardProps {
  data: DashboardData["financialPosition"];
}

const FinancialPositionCard: React.FC<FinancialPositionCardProps> = ({
  data,
}) => {
  const isCritical = data.status === "critical";
  const isWarn = data.status === "warn";
  const color = isCritical ? "#e11d48" : isWarn ? "#f59e0b" : "#14b8a6";

  return (
    <div className="bg-white dark:bg-[#0f1a16] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm p-6 flex items-center gap-8 flex-wrap">
      <div className="relative w-[168px] h-[96px] shrink-0">
        <svg viewBox="0 0 200 108" className="w-full h-full overflow-visible">
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            stroke="#E8E3D8"
            strokeWidth="13"
            strokeLinecap="round"
          />
          <path
            d="M20 100 A80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="13"
            strokeLinecap="round"
            strokeDasharray={`${(Math.min(data.cashCoverage / 400, 1) * Math.PI * 80).toFixed(1)} ${(Math.PI * 80).toFixed(1)}`}
          />
        </svg>
        <div className="absolute left-0 right-0 bottom-0 text-center">
          <div className="text-2xl font-extrabold text-stone-800 dark:text-stone-100 leading-none">
            {data.cashCoverage}%
          </div>
          <div className="text-[10px] font-bold uppercase tracking-wide text-stone-400 dark:text-stone-500 mt-1">
            Cash Coverage
          </div>
        </div>
      </div>

      <div className="flex-1 min-w-[200px]">
        <div className="flex items-start gap-3">
          <div
            className={`w-9 h-9 rounded-lg ${
              isCritical
                ? "bg-rose-50 dark:bg-rose-950/40"
                : isWarn
                  ? "bg-amber-50 dark:bg-amber-950/40"
                  : "bg-teal-50 dark:bg-teal-950/40"
            } flex items-center justify-center shrink-0 mt-0.5`}
          >
            <AlertTriangle
              className={`w-4.5 h-4.5 ${
                isCritical
                  ? "text-rose-500 dark:text-rose-400"
                  : isWarn
                    ? "text-amber-500 dark:text-amber-400"
                    : "text-teal-500 dark:text-teal-400"
              }`}
            />
          </div>
          <div>
            <h3 className="text-base font-bold text-stone-900 dark:text-stone-50 leading-tight">
              {data.headline}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
              {data.description}
            </p>
            <button className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline mt-2 inline-flex items-center gap-0.5">
              Why?
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface AttentionCardProps {
  items: DashboardData["attention"];
}

const AttentionCard: React.FC<AttentionCardProps> = ({ items }) => {
  const router = useRouter();
  if (!items || items.length === 0) {
    return (
      <SectionCard
        title="What Needs My Attention"
        icon={<AlertTriangle />}
        subtitle="Only meaningful exceptions are shown here."
        accent="rose"
      >
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center mx-auto mb-3">
              <FileCheck2 className="w-5 h-5 text-teal-500 dark:text-teal-400" />
            </div>
            <p className="text-sm font-medium text-stone-700 dark:text-stone-200">
              You're clear.
            </p>
            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">
              No bills, cheques or thresholds currently require attention.
            </p>
          </div>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title="What Needs My Attention"
      icon={<AlertTriangle />}
      subtitle="Only meaningful exceptions are shown here."
      accent="rose"
    >
      <div className="p-5 space-y-3 flex-1">
        {items.map((item, index) => {
          const a = ACCENT[item.severity === "red" ? "rose" : "amber"];
          const Icon = item.severity === "red" ? AlertTriangle : Info;
          return (
            <div
              key={`${item.title}-${index}`}
              className="rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613] p-4 flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center shrink-0`}
                >
                  <Icon className={`w-4 h-4 ${a.text}`} />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {item.title}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    {item.description}
                  </p>
                  <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                    {item.impact}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (item?.link) {
                    router.push(item?.link, undefined, {
                      shallow: true, // Prevents re-fetching if data is already loaded
                    });
                  }
                }}
                className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline shrink-0 inline-flex items-center gap-0.5 whitespace-nowrap"
              >
                {item.action}
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
};

interface CashPositionCardProps {
  data: DashboardData["cashPosition"];
}

const CashPositionCard: React.FC<CashPositionCardProps> = ({ data }) => {
  const formatMoney = useFormatMoney();
  return (
    <SectionCard title="Cash Position" icon={<Wallet />} accent="teal">
      <div className="p-5 flex-1 flex flex-col">
        {data.bankAccounts && data.bankAccounts.length > 0 ? (
          data.bankAccounts.map((account) => (
            <div
              key={account.name}
              className="flex items-center justify-between py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                <Landmark className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                {account.name}
              </span>
              <span className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-100">
                {formatMoney(account.balance)}{" "}
                <span className="text-[10px] font-normal text-stone-400 dark:text-stone-500">
                  Manual balance
                </span>
              </span>
            </div>
          ))
        ) : (
          <div className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
            No bank accounts linked
          </div>
        )}
        <div className="flex items-center justify-between py-2.5 border-b border-[#EDE7DA] dark:border-[#1a2622]">
          <span className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <Wallet className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
            Petty Cash
          </span>
          <span className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-100">
            {formatMoney(data.pettyCash)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-teal-50 dark:bg-teal-950/30 px-3.5 py-3 my-2">
          <span className="text-sm font-bold text-teal-700 dark:text-teal-300">
            Total Available
          </span>
          <span className="text-base font-mono font-bold text-teal-700 dark:text-teal-300">
            {formatMoney(data.totalAvailable)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 text-sm">
          <span className="text-stone-500 dark:text-stone-400">
            Upcoming obligations
          </span>
          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
            {formatMoney(data.upcomingObligations)}
          </span>
        </div>
        <div className="flex items-center justify-between py-2 text-sm mt-auto">
          <span className="font-semibold text-stone-700 dark:text-stone-200">
            Available after obligations
          </span>
          <span className="font-mono font-bold text-stone-800 dark:text-stone-100">
            {formatMoney(data.availableAfterObligations)}
          </span>
        </div>
      </div>
    </SectionCard>
  );
};

interface BillsPayableCardProps {
  bills: DashboardData["bills"];
}

const BillsPayableCard: React.FC<BillsPayableCardProps> = ({ bills }) => {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  return (
    <SectionCard
      title="Bills & Payables"
      icon={<Receipt />}
      action={{
        label: "Open Bills & Payables",
        onClick: () =>
          router.push(
            "/clinic/finance-management/?view=billsPayable",
            undefined,
            {
              shallow: true, // Prevents re-fetching if data is already loaded
            },
          ),
      }}
      accent="sky"
    >
      <div className="flex-1 flex flex-col">
        <div className="hidden sm:grid grid-cols-[1.4fr_0.9fr_0.7fr_0.8fr_0.8fr] gap-2 px-5 pt-3 pb-1">
          {["Supplier", "Bill", "Due", "Amount", "Status"].map((h) => (
            <span
              key={h}
              className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500"
            >
              {h}
            </span>
          ))}
        </div>
        <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622] px-5 pb-2">
          {bills && bills.length > 0 ? (
            bills.map((b, i) => (
              <div
                key={`${b.id}-${i}`}
                className="grid grid-cols-2 sm:grid-cols-[1.4fr_0.9fr_0.7fr_0.8fr_0.8fr] gap-2 py-3 items-center"
              >
                <span className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate col-span-2 sm:col-span-1">
                  {b.supplier}
                </span>
                <span className="text-sm text-stone-600 dark:text-stone-300 font-mono">
                  {b.id}
                </span>
                <span className="text-sm text-stone-500 dark:text-stone-400">
                  {b.dueDate
                    ? new Date(b.dueDate).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                      })
                    : "—"}
                </span>
                <span className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-100">
                  {formatMoney(b.amount)}
                </span>
                <StatusPill status={b.status} />
              </div>
            ))
          ) : (
            <div className="py-4 text-sm text-stone-400 dark:text-stone-500 text-center">
              No bills found
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

interface ChequeManagerCardProps {
  data: DashboardData["cheques"];
}

const ChequeManagerCard: React.FC<ChequeManagerCardProps> = ({ data }) => {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  return (
    <SectionCard
      title="Cheque Manager"
      icon={<FileCheck2 />}
      action={{
        label: "Open",
        onClick: () =>
          router.push("/clinic/finance-management/?view=cheques", undefined, {
            shallow: true, // Prevents re-fetching if data is already loaded
          }),
      }}
      accent="violet"
    >
      <div className="flex-1 flex flex-col">
        <div className="grid grid-cols-3 divide-x divide-[#EDE7DA] dark:divide-[#1a2622] border-b border-[#EDE7DA] dark:border-[#1a2622]">
          {[
            { label: "Issued", value: data.issued },
            { label: "Presented", value: data.presented },
            { label: "Cleared", value: data.cleared },
          ].map((s) => (
            <div key={s.label} className="p-4">
              <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                {s.label}
              </div>
              <div className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-100">
                {formatMoney(s.value)}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 pt-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          Upcoming cheques
        </div>
        <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622] px-5 pb-3">
          {data.upcoming && data.upcoming.length > 0 ? (
            data.upcoming.map((c) => (
              <div
                key={c.number}
                className="flex items-center justify-between py-2.5 gap-2"
              >
                <span className="text-sm text-stone-700 dark:text-stone-200 truncate font-mono">
                  #{c.number} · {c.payee}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-100">
                    {formatMoney(c.amount)}
                  </span>
                  <StatusPill status={c.status} />
                </div>
              </div>
            ))
          ) : (
            <div className="py-3 text-sm text-stone-400 dark:text-stone-500 text-center">
              No upcoming cheques
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

interface OverdueControlCardProps {
  data: DashboardData["overdueAging"];
}

const OverdueControlCard: React.FC<OverdueControlCardProps> = ({ data }) => {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  const buckets = [
    { label: "1–7 days", value: data.d1to7, color: "bg-teal-500" },
    { label: "8–30 days", value: data.d8to30, color: "bg-amber-500" },
    { label: "31+ days", value: data.d31plus, color: "bg-rose-500" },
  ];

  const maxValue = Math.max(data.d1to7, data.d8to30, data.d31plus, 1);

  return (
    <SectionCard
      title="Overdue Control"
      icon={<AlertTriangle />}
      subtitle={`${formatMoney(data.total)} · ${data.count} bills`}
      action={{
        label: "Review overdue",
        onClick: () =>
          router.push(
            "/clinic/finance-management/?view=billsPayable",
            undefined,
            {
              shallow: true, // Prevents re-fetching if data is already loaded
            },
          ),
      }}
      accent="rose"
    >
      <div className="p-5 space-y-4 flex-1 flex flex-col">
        {buckets.map((b) => (
          <BarRow
            key={b.label}
            label={b.label}
            value={b.value}
            pct={(b.value / maxValue) * 100}
            color={b.color}
          />
        ))}
        <div className="flex items-center justify-between rounded-xl bg-[#F8F5EF] dark:bg-[#1a2622]/60 px-3.5 py-2.5 text-sm mt-auto">
          <span className="text-stone-500 dark:text-stone-400">
            Highest-risk supplier
          </span>
          <span className="font-semibold text-stone-800 dark:text-stone-100">
            {data.highestRisk?.name || "None"} ·{" "}
            {data.highestRisk ? formatMoney(data.highestRisk.amount) : "—"}
          </span>
        </div>
      </div>
    </SectionCard>
  );
};

interface SupplierControlCardProps {
  suppliers: DashboardData["suppliers"];
}

const SupplierControlCard: React.FC<SupplierControlCardProps> = ({
  suppliers,
}) => {
  const router = useRouter();
  const maxAmount = Math.max(...suppliers.map((s) => s.amount), 1);

  return (
    <SectionCard
      title="Supplier Control"
      icon={<Building2 />}
      action={{
        label: "All suppliers",
        onClick: () =>
          router.push(
            "/clinic/finance-management/?view=vendorHistory",
            undefined,
            {
              shallow: true, // Prevents re-fetching if data is already loaded
            },
          ),
      }}
      accent="violet"
    >
      <div className="p-5 space-y-4 flex-1">
        {suppliers && suppliers.length > 0 ? (
          suppliers.map((s) => (
            <BarRow
              key={s.name}
              label={s.name}
              value={s.amount}
              pct={(s.amount / maxAmount) * 100}
              color={s.amount > 10000 ? "bg-rose-500" : "bg-teal-500"}
            />
          ))
        ) : (
          <div className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
            No supplier data
          </div>
        )}
      </div>
    </SectionCard>
  );
};

interface MoneyFlowCardProps {
  data: DashboardData["moneyFlow"];
  onRangeChange?: (range: string) => void;
}

const MoneyFlowCard: React.FC<MoneyFlowCardProps> = ({
  data,
  onRangeChange,
}) => {
  const formatMoney = useFormatMoney();
  const [range, setRange] = useState<string>("Weekly");
  const ranges = ["Daily", "Weekly", "Monthly", "Yearly"];

  const handleRangeClick = (r: string) => {
    setRange(r);
    onRangeChange?.(r.toLowerCase());
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#0f1a16] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#EDE7DA] dark:border-[#1a2622] flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
          Money Flow
        </h3>
        <div className="flex items-center gap-4 text-xs">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeClick(r)}
              className={`font-semibold ${
                range === r
                  ? "text-stone-800 dark:text-stone-100 border-b-2 border-teal-500 pb-1"
                  : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 rounded-xl bg-teal-50 dark:bg-teal-950/30 p-3.5 text-center border border-teal-100 dark:border-teal-900/30">
            <div className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 mb-1">
              Received
            </div>
            <div className="text-sm font-mono font-bold text-teal-700 dark:text-teal-300">
              {formatMoney(data.received)}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-stone-300 dark:text-stone-600 shrink-0" />

          <div className="flex-1 rounded-xl bg-rose-50 dark:bg-rose-950/30 p-3.5 text-center border border-rose-100 dark:border-rose-900/30">
            <div className="text-[10px] font-bold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1">
              Spent
            </div>
            <div className="text-sm font-mono font-bold text-rose-700 dark:text-rose-300">
              {formatMoney(data.spent)}
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-stone-300 dark:text-stone-600 shrink-0" />

          <div className="flex-1 rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3.5 text-center border border-amber-100 dark:border-amber-900/30">
            <div className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">
              Net Movement
            </div>
            <div className="text-sm font-mono font-bold text-amber-700 dark:text-amber-300">
              {formatMoney(data.net)}
            </div>
          </div>
        </div>

        <div className="mt-auto">
          <div className="relative w-full h-2 rounded-full bg-[#F1ECE0] dark:bg-[#1a2622] overflow-hidden flex">
            <div
              className="h-full bg-teal-500"
              style={{ width: `${data.receivedPct}%` }}
            />
            <div
              className="h-full bg-rose-400"
              style={{ width: `${data.spentPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between mt-2 text-xs font-semibold">
            <span className="text-teal-600 dark:text-teal-400">
              Received {data.receivedPct}%
            </span>
            <span className="text-rose-500 dark:text-rose-400">
              Spent {data.spentPct}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

interface Next30DaysCardProps {
  data: DashboardData["next30Days"];
}

const Next30DaysCard: React.FC<Next30DaysCardProps> = ({ data }) => {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  return (
    <SectionCard
      title="Next 30 Days"
      icon={<Clock />}
      action={{
        label: "Full schedule",
        onClick: () =>
          router.push(
            "/clinic/finance-management/?view=billsPayable",
            undefined,
            {
              shallow: true, // Prevents re-fetching if data is already loaded
            },
          ),
      }}
      accent="amber"
    >
      <div className="flex-1 flex flex-col">
        <div className="relative px-5 pt-4 pb-3 flex-1">
          <div className="absolute left-[25px] top-6 bottom-6 w-px bg-gradient-to-b from-teal-300 via-[#EDE7DA] dark:from-teal-800 dark:via-[#1a2622] to-transparent" />

          <div className="relative flex items-center gap-2.5 pb-4">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 ring-4 ring-teal-50 dark:ring-teal-950/40 shrink-0 z-10" />
            <span className="text-sm font-semibold text-stone-700 dark:text-stone-200">
              Today
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500">
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>

          {data.items && data.items.length > 0 ? (
            data.items.map((item, i) => (
              <div
                key={`${item.name}-${i}`}
                className="relative flex items-start gap-2.5 pb-4 last:pb-0"
              >
                <span className="w-2.5 h-2.5 rounded-full bg-white dark:bg-[#0f1a16] border-2 border-stone-300 dark:border-stone-600 mt-0.5 shrink-0 z-10" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-stone-700 dark:text-stone-200 truncate">
                    {item.name}
                  </div>
                  <div className="text-xs text-stone-400 dark:text-stone-500">
                    {new Date(item.date).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </div>
                </div>
                <div className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-100 shrink-0">
                  {formatMoney(item.amount)}
                </div>
              </div>
            ))
          ) : (
            <div className="py-4 text-sm text-stone-400 dark:text-stone-500 text-center">
              No upcoming bills
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[#EDE7DA] dark:border-[#1a2622] flex items-center justify-between">
          <span className="text-sm font-bold text-stone-700 dark:text-stone-200">
            Total upcoming
          </span>
          <span className="text-sm font-mono font-bold text-stone-800 dark:text-stone-100">
            {formatMoney(data.total)}
          </span>
        </div>
      </div>
    </SectionCard>
  );
};

interface WhereMoneyGoingCardProps {
  categories: DashboardData["expenseCategories"];
}

const WhereMoneyGoingCard: React.FC<WhereMoneyGoingCardProps> = ({
  categories,
}) => {
  const max = Math.max(...categories.map((r) => r.amount), 1);

  return (
    <SectionCard
      title="Where Is The Money Going?"
      icon={<TrendingDown />}
      accent="rose"
    >
      <div className="p-5 space-y-4 flex-1">
        {categories && categories.length > 0 ? (
          categories.map((r) => (
            <BarRow
              key={r.label}
              label={r.label}
              value={r.amount}
              pct={(r.amount / max) * 100}
            />
          ))
        ) : (
          <div className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
            No expense data
          </div>
        )}
      </div>
    </SectionCard>
  );
};

interface PettyCashCardProps {
  data: DashboardData["pettyCash"];
}

const PettyCashCard: React.FC<PettyCashCardProps> = ({ data }) => {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  return (
    <SectionCard
      title="Petty Cash"
      icon={<Wallet />}
      action={{
        label: "Open",
        onClick: () =>
          router.push("/clinic/finance-management/?view=pettyCash", undefined, {
            shallow: true, // Prevents re-fetching if data is already loaded
          }),
      }}
      accent="teal"
    >
      <div className="p-5 flex-1 flex flex-col">
        <div
          className={`flex items-center justify-between rounded-xl ${data.balance >= 0 ? "bg-teal-50 dark:bg-teal-950/30" : "bg-red-50 dark:bg-red-950/30"}  px-3.5 py-3 mb-4`}
        >
          <span
            className={`text-sm font-semibold ${data.balance >= 0 ? "text-teal-700 dark:text-teal-300" : "text-red-700 dark:text-red-300"} `}
          >
            Current Balance
          </span>
          <span
            className={`text-base font-mono font-bold ${data.balance >= 0 ? "text-teal-700 dark:text-teal-300" : "text-red-700 dark:text-red-300"} `}
          >
            {formatMoney(data.balance)}
          </span>
        </div>
        <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-2">
          Today's activity
        </div>
        <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622]">
          {data.todayActivity && data.todayActivity.length > 0 ? (
            data.todayActivity.map((a) => (
              <div
                key={a.label}
                className="flex items-center justify-between py-2 text-sm"
              >
                <span className="text-stone-600 dark:text-stone-300">
                  {a.label}
                </span>
                <span className="font-mono font-semibold text-stone-800 dark:text-stone-100">
                  {formatMoney(a.amount)}
                </span>
              </div>
            ))
          ) : (
            <div className="py-2 text-sm text-stone-400 dark:text-stone-500 text-center">
              No activity today
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

interface BankAccountsCardProps {
  accounts: DashboardData["bankAccounts"];
}

const BankAccountsCard: React.FC<BankAccountsCardProps> = ({ accounts }) => {
  const router = useRouter();
  const formatMoney = useFormatMoney();
  return (
    <SectionCard
      title="Bank Accounts"
      icon={<Landmark />}
      action={{
        label: "Open",
        onClick: () =>
          router.push(
            "/clinic/finance-management/?view=bankAccounts",
            undefined,
            {
              shallow: true, // Prevents re-fetching if data is already loaded
            },
          ),
      }}
      accent="sky"
    >
      <div className="p-5 space-y-1 flex-1">
        {accounts && accounts.length > 0 ? (
          accounts.map((a) => (
            <div
              key={a.name}
              className="flex items-center justify-between py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-200">
                <Landmark className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                {a.name}
              </span>
              <span className="text-sm font-mono font-semibold text-stone-800 dark:text-stone-100">
                {formatMoney(a.balance)}{" "}
                {a.manual && (
                  <span className="text-[10px] font-normal text-stone-400 dark:text-stone-500">
                    Manual
                  </span>
                )}
              </span>
            </div>
          ))
        ) : (
          <div className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
            No bank accounts
          </div>
        )}
      </div>
    </SectionCard>
  );
};

interface ExpenseTrendCardProps {
  data: DashboardData["expenseTrend"];
  onTabChange?: (mode: "expenses" | "payments" | "bills") => void;
}

const TREND_TABS: { label: string; mode: "expenses" | "payments" | "bills" }[] =
  [
    { label: "Expenses", mode: "expenses" },
    { label: "Payments", mode: "payments" },
    { label: "Bills", mode: "bills" },
  ];

const ExpenseTrendCard: React.FC<ExpenseTrendCardProps> = ({
  data,
  onTabChange,
}) => {
  const formatMoney = useFormatMoney();
  const [tab, setTab] = useState<"expenses" | "payments" | "bills">("bills");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const max = Math.max(...data.values, 1);

  const handleTabClick = (mode: "expenses" | "payments" | "bills") => {
    setTab(mode);
    onTabChange?.(mode);
  };

  return (
    <SectionCard title="Expense Trend" icon={<Receipt />} accent="violet">
      <div className="flex-1 flex flex-col">
        <div className="px-5 pt-3 flex items-center gap-4 text-xs">
          {TREND_TABS.map((t) => (
            <button
              key={t.mode}
              onClick={() => handleTabClick(t.mode)}
              className={`font-semibold pb-2 ${
                tab === t.mode
                  ? "text-stone-800 dark:text-stone-100 border-b-2 border-teal-500"
                  : "text-stone-400 dark:text-stone-500"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="px-5 pb-2 pt-4 flex-1">
          <div className="flex items-end gap-2 h-32">
            {data.months && data.months.length > 0 ? (
              data.months.map((m, i) => {
                const v = data.values[i] || 0;
                const h = v > 0 ? Math.max(6, (v / max) * 100) : 4;
                const isHovered = hoverIndex === i;
                return (
                  <div
                    key={m}
                    className="relative flex-1 flex flex-col items-center justify-end h-full gap-1.5"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                  >
                    {isHovered && (
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap rounded-lg bg-stone-800 dark:bg-stone-100 text-white dark:text-stone-900 text-[11px] font-semibold px-2.5 py-1.5 shadow-lg pointer-events-none">
                        {formatMoney(v)}
                        <span className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-stone-800 dark:border-t-stone-100" />
                      </div>
                    )}
                    <div
                      className={`w-full rounded-t-md cursor-pointer transition-colors ${
                        v > 0
                          ? isHovered
                            ? "bg-teal-600"
                            : "bg-teal-500"
                          : "bg-[#F1ECE0] dark:bg-[#1a2622]"
                      }`}
                      style={{ height: `${h}%` }}
                    />
                    <span
                      className={`text-[10px] ${isHovered ? "text-stone-700 dark:text-stone-200 font-semibold" : "text-stone-400 dark:text-stone-500"}`}
                    >
                      {m}
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="text-sm text-stone-400 dark:text-stone-500 text-center w-full py-8">
                No trend data available
              </div>
            )}
          </div>
        </div>
        <div className="px-5 pb-5 pt-1 flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
          <span>{data.note || "No data available"}</span>
        </div>
      </div>
    </SectionCard>
  );
};

interface WhatChangedCardProps {
  data: DashboardData["whatChanged"];
}

const WhatChangedCard: React.FC<WhatChangedCardProps> = ({ data }) => {
  const formatMoney = useFormatMoney();
  return (
    <SectionCard title="What Changed?" icon={<Sparkles />} accent="amber">
      <div className="p-5 space-y-1 flex-1 flex flex-col">
        {data && data.length > 0 ? (
          data.map((c) => (
            <div
              key={c.label}
              className="flex items-center justify-between py-2 text-sm"
            >
              <span className="text-stone-600 dark:text-stone-300">
                {c.label}
              </span>
              <span
                className={`inline-flex items-center gap-1 font-semibold ${
                  c.up
                    ? "text-teal-600 dark:text-teal-400"
                    : "text-rose-500 dark:text-rose-400"
                }`}
              >
                {c.up ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {c.change}%
              </span>
            </div>
          ))
        ) : (
          <div className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
            No changes to show
          </div>
        )}
        {data && data.length > 0 && (
          <div className="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400 pt-3 mt-auto border-t border-[#EDE7DA] dark:border-[#1a2622]">
            <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
            <span>
              {data[0]?.label} changed by {formatMoney(data[0]?.amount || 0)}{" "}
              compared with last month.{" "}
              <button className="text-teal-600 dark:text-teal-400 font-semibold hover:underline">
                View details
              </button>
            </span>
          </div>
        )}
      </div>
    </SectionCard>
  );
};

interface FinanceInsightsCardProps {
  insights: string[];
}

const FinanceInsightsCard: React.FC<FinanceInsightsCardProps> = ({
  insights,
}) => {
  return (
    <SectionCard
      title="ZEVA Finance Insights"
      icon={<Sparkles />}
      accent="amber"
    >
      <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622] px-5 pb-2 flex-1">
        {insights && insights.length > 0 ? (
          insights.map((line, i) => (
            <div
              key={i}
              className="flex items-start gap-2 py-2.5 text-sm text-stone-600 dark:text-stone-300"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
              <span>{line}</span>
            </div>
          ))
        ) : (
          <div className="py-4 text-sm text-stone-400 dark:text-stone-500 text-center">
            No insights available
          </div>
        )}
      </div>
    </SectionCard>
  );
};

interface RecurringCommitmentsCardProps {
  data: DashboardData["recurring"];
}

const RecurringCommitmentsCard: React.FC<RecurringCommitmentsCardProps> = ({
  data,
}) => {
  const formatMoney = useFormatMoney();
  return (
    <SectionCard title="Recurring Commitments" icon={<Clock />} accent="teal">
      <div className="p-5 flex-1">
        <div className="flex items-center justify-between rounded-xl bg-teal-50 dark:bg-teal-950/30 px-3.5 py-3 mb-3">
          <span className="text-sm font-semibold text-teal-700 dark:text-teal-300">
            Monthly recurring total
          </span>
          <span className="text-base font-mono font-bold text-teal-700 dark:text-teal-300">
            {formatMoney(data.monthlyTotal)}/mo
          </span>
        </div>
        <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622]">
          {data.items && data.items.length > 0 ? (
            data.items.map((r) => (
              <div
                key={r.name}
                className="flex items-center justify-between py-2.5 text-sm"
              >
                <span className="text-stone-600 dark:text-stone-300">
                  {r.name}
                </span>
                <span className="font-mono font-semibold text-stone-800 dark:text-stone-100">
                  {formatMoney(r.amount)}
                  <span className="text-[10px] font-normal text-stone-400 dark:text-stone-500">
                    {" "}
                    {r.frequency}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className="py-4 text-sm text-stone-400 dark:text-stone-500 text-center">
              No recurring commitments
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  );
};

interface QuickReportsCardProps {
  reports: string[];
}

const QuickReportsCard: React.FC<QuickReportsCardProps> = ({ reports }) => {
  const router = useRouter();
  return (
    <SectionCard title="Quick Reports" icon={<Receipt />} accent="sky">
      <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622] px-5 pb-2 flex-1">
        {reports && reports.length > 0 ? (
          reports.map((label) => (
            <div key={label} className="flex items-center justify-between py-3">
              <span className="text-sm text-stone-700 dark:text-stone-200">
                {label}
              </span>
              <div className="flex items-center gap-3 text-xs font-semibold">
                <button
                  onClick={() => {
                    router.push(
                      `/clinic/finance-management?view=reports`,
                      undefined,
                      {
                        shallow: true, // Prevents re-fetching if data is already loaded
                      },
                    );
                  }}
                  className="text-stone-500 dark:text-stone-400 hover:text-teal-600 dark:hover:text-teal-400"
                >
                  View
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-4 text-sm text-stone-400 dark:text-stone-500 text-center">
            No reports available
          </div>
        )}
      </div>
    </SectionCard>
  );
};

interface FinancialRisksCardProps {
  data: DashboardData["risks"];
}

const FinancialRisksCard: React.FC<FinancialRisksCardProps> = ({ data }) => {
  const formatMoney = useFormatMoney();
  const toneMap: Record<string, string> = {
    "Overdue bills": "bg-rose-500",
    "Cheque exposure": "bg-amber-500",
    "Upcoming commitments": "bg-amber-500",
    "Unusual expense increase": "bg-stone-400",
  };

  return (
    <SectionCard title="Financial Risks" icon={<AlertTriangle />} accent="rose">
      <div className="p-5 space-y-3 flex-1 flex flex-col">
        {data.items && data.items.length > 0 ? (
          data.items.map((r) => (
            <div
              key={r.label}
              className="flex items-center justify-between text-sm"
            >
              <span className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                <span
                  className={`w-2.5 h-2.5 rounded-sm ${toneMap[r.label] || "bg-stone-400"} shrink-0`}
                />
                {r.label}
              </span>
              <span className="font-mono font-semibold text-stone-800 dark:text-stone-100">
                {formatMoney(r.amount)}
              </span>
            </div>
          ))
        ) : (
          <div className="text-sm text-stone-400 dark:text-stone-500 text-center py-4">
            No risks detected
          </div>
        )}
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold mt-1 w-fit ${
            data.riskLevel === "critical"
              ? "bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
              : data.riskLevel === "warn"
                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400"
                : "bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-teal-400"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              data.riskLevel === "critical"
                ? "bg-rose-500"
                : data.riskLevel === "warn"
                  ? "bg-amber-500"
                  : "bg-teal-500"
            }`}
          />
          {data.status || "Financial Control: Healthy"}
        </span>
      </div>
    </SectionCard>
  );
};

interface UpcomingPressureCardProps {
  data: DashboardData["pressure"];
}

const UpcomingPressureCard: React.FC<UpcomingPressureCardProps> = ({
  data,
}) => {
  const formatMoney = useFormatMoney();
  const metrics = [
    { label: "Expected Payments (30D)", value: data.expectedPayments },
    { label: "Recurring Obligations", value: data.recurringObligations },
    { label: "Known Outstanding", value: data.knownOutstanding },
    { label: "Potential Additional", value: data.potential },
  ];

  return (
    <SectionCard
      title="Upcoming Financial Pressure"
      icon={<Sparkles />}
      accent="amber"
    >
      <div className="p-5 flex-1 flex flex-col">
        <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 bg-[#F1ECE0] dark:bg-[#1a2622] rounded-full px-2.5 py-1 mb-4 w-fit">
          Projected
        </span>
        <div className="grid grid-cols-2 gap-4 mb-4">
          {metrics.map((m) => (
            <div key={m.label}>
              <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
                {m.label}
              </div>
              <div className="text-sm font-mono font-bold text-stone-800 dark:text-stone-100">
                {formatMoney(m.value)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400 pt-3 mt-auto border-t border-[#EDE7DA] dark:border-[#1a2622]">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0" />
          <span>{data.note || "No forecast data available"}</span>
        </div>
      </div>
    </SectionCard>
  );
};

// ============================================================
// LOADING SKELETON
// ============================================================

const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-16 bg-white dark:bg-[#0f1a16] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622]" />
      <div className="flex w-full border border-[#EDE7DA] dark:border-[#1a2622] rounded-2xl overflow-hidden bg-white dark:bg-[#0f1a16]">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className={`flex-1 min-w-[140px] px-5 py-4 ${
              i < 5 ? "border-r border-[#EDE7DA] dark:border-[#1a2622]" : ""
            }`}
          >
            <div className="h-3 w-20 bg-[#F1ECE0] dark:bg-[#1a2622] rounded mb-2" />
            <div className="h-7 w-28 bg-[#F1ECE0] dark:bg-[#1a2622] rounded mb-1" />
            <div className="h-3 w-16 bg-[#F1ECE0] dark:bg-[#1a2622] rounded" />
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-[#0f1a16] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm p-6 flex items-center gap-8 flex-wrap">
        <div className="w-[168px] h-[96px] bg-[#F1ECE0] dark:bg-[#1a2622] rounded" />
        <div className="flex-1 min-w-[200px] space-y-2">
          <div className="h-6 w-48 bg-[#F1ECE0] dark:bg-[#1a2622] rounded" />
          <div className="h-4 w-64 bg-[#F1ECE0] dark:bg-[#1a2622] rounded" />
          <div className="h-3 w-12 bg-[#F1ECE0] dark:bg-[#1a2622] rounded mt-2" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-white dark:bg-[#0f1a16] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622]" />
        <div className="h-64 bg-white dark:bg-[#0f1a16] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622]" />
      </div>
    </div>
  );
};

// ============================================================
// MAIN DASHBOARD
// ============================================================

interface DashboardTabProps {
  permissionData: UseFinancePermissionReturn;
}

const DashboardTab: React.FC<DashboardTabProps> = ({ permissionData }) => {
  const { permissionsLoaded, canAccessPage, AccessDenied, PermissionLoading } =
    permissionData;
  const {
    data,
    loading,
    error,
    refetch,
    currency,
    filters,
    setFilters,
    resetFilters,
    filtersMeta,
    filtersMetaLoading,
    fetchMoneyFlow,
    fetchExpenseTrend,
  } = useDashboard();

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-[#F8F5EF] dark:bg-[#0d1613]">
        <div className="flex-1 min-w-0">
          <main className="p-4 md:p-6 max-w-7xl mx-auto">
            <DashboardSkeleton />
          </main>
        </div>
      </div>
    );
  }

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

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#F8F5EF] dark:bg-[#0d1613] flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-stone-800 dark:text-stone-100">
            Failed to load dashboard
          </h3>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {error || "An unexpected error occurred"}
          </p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <CurrencyContext.Provider value={currency}>
      <div className="min-h-screen bg-[#F8F5EF] dark:bg-[#0d1613]">
        <div className="flex-1 min-w-0">
          <div className="space-y-6">
            <FilterBar
              filters={filters}
              setFilters={setFilters}
              resetFilters={resetFilters}
              meta={filtersMeta}
              metaLoading={filtersMetaLoading}
            />

            {loading && (
              <div className="text-xs font-semibold text-teal-600 dark:text-teal-400 -mt-3">
                Updating with selected filters…
              </div>
            )}

            <div>
              <SignalRow data={data.signalStats} />
            </div>

            <FinancialPositionCard data={data.financialPosition} />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <div className="lg:col-span-2">
                <AttentionCard items={data.attention} />
              </div>
              <CashPositionCard data={data.cashPosition} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <BillsPayableCard bills={data.bills} />
              <ChequeManagerCard data={data.cheques} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <OverdueControlCard data={data.overdueAging} />
              <SupplierControlCard suppliers={data.suppliers} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <MoneyFlowCard
                data={data.moneyFlow}
                onRangeChange={(r) => fetchMoneyFlow(r)}
              />
              <Next30DaysCard data={data.next30Days} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <WhereMoneyGoingCard categories={data.expenseCategories} />
              <PettyCashCard data={data.pettyCash} />
              <BankAccountsCard accounts={data.bankAccounts} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <ExpenseTrendCard
                data={data.expenseTrend}
                onTabChange={(mode) => fetchExpenseTrend(mode)}
              />
              <WhatChangedCard data={data.whatChanged} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              <FinanceInsightsCard insights={data.insights} />
              <RecurringCommitmentsCard data={data.recurring} />
              <QuickReportsCard reports={data.quickReports} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <FinancialRisksCard data={data.risks} />
              <UpcomingPressureCard data={data.pressure} />
            </div>
          </div>
        </div>
      </div>
    </CurrencyContext.Provider>
  );
};

export default DashboardTab;

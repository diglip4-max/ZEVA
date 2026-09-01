// components/finance/OverviewTab.tsx
import React, { useMemo, useState } from "react";
import {
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertTriangle,
  Wallet,
  Landmark,
  Receipt,
  PieChart,
  Calendar,
  X,
  BarChart3,
  Activity,
  CreditCard,
  Percent,
  Users,
  FileText,
  Inbox,
  ChevronRight,
  ChevronDown,
  Banknote,
  Paperclip,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from "recharts";
import useOverview, {
  OverviewFilters,
  RecentActivityItem,
  BillDetails,
  PaymentDetails,
  ChequeDetails,
} from "../_hooks/useOverview";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney } from "@/lib/currencyHelper";
import { UseFinancePermissionReturn } from "../_hooks/useFinancePermission";

// ============================================================
// FONTS / SHARED TOKENS
// ============================================================

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,450;9..144,560;9..144,650&family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
.zfm-display { font-family: 'Fraunces', serif; letter-spacing: -0.01em; }
.zfm-body { font-family: 'Manrope', sans-serif; }
.zfm-mono { font-family: 'IBM Plex Mono', monospace; font-variant-numeric: tabular-nums; }
`;

const COLORS = [
  "#0f766e",
  "#14b8a6",
  "#5eead4",
  "#d97706",
  "#f59e0b",
  "#e11d48",
  "#7c3aed",
  "#3b82f6",
];

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
  onClick?: () => void;
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
  onClick,
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`group bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 p-6 ${onClick ? "cursor-pointer" : ""}`}
    >
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
      <div className="zfm-display text-[25px] font-semibold text-stone-900 dark:text-stone-50">
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

function MiniStat({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ReactElement;
  tone: "amber" | "rose" | "blue" | "purple";
}) {
  const toneMap = {
    amber: {
      bg: "bg-amber-50 dark:bg-amber-950/40",
      text: "text-amber-700 dark:text-amber-400",
    },
    rose: {
      bg: "bg-rose-50 dark:bg-rose-950/40",
      text: "text-rose-700 dark:text-rose-400",
    },
    blue: {
      bg: "bg-blue-50 dark:bg-blue-950/40",
      text: "text-blue-700 dark:text-blue-400",
    },
    purple: {
      bg: "bg-purple-50 dark:bg-purple-950/40",
      text: "text-purple-700 dark:text-purple-400",
    },
  }[tone];

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-4 flex items-center gap-3 hover:shadow-md transition-all">
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${toneMap.bg}`}
      >
        {React.cloneElement(icon, {
          className: `w-4 h-4 ${toneMap.text}`,
        } as React.HTMLAttributes<SVGElement>)}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest truncate">
          {label}
        </div>
        <div className="text-sm font-bold text-stone-800 dark:text-stone-100 zfm-mono">
          {value}
        </div>
      </div>
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

const STATUS_MAP: Record<string, { dot: string; text: string; bg: string }> = {
  paid: {
    dot: "bg-teal-500",
    text: "text-teal-700 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/50",
  },
  cleared: {
    dot: "bg-teal-500",
    text: "text-teal-700 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-950/50",
  },
  partial: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
  },
  pending: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
  },
  presented: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/50",
  },
  upcoming: {
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
  },
  issued: {
    dot: "bg-blue-500",
    text: "text-blue-700 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/50",
  },
  draft: {
    dot: "bg-stone-400",
    text: "text-stone-600 dark:text-stone-400",
    bg: "bg-stone-100 dark:bg-stone-800",
  },
  overdue: {
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/50",
  },
  bounced: {
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/50",
  },
  returned: {
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/50",
  },
  cancelled: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
    bg: "bg-red-50 dark:bg-red-950/50",
  },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS_MAP[status] || STATUS_MAP.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold capitalize ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

const ACTIVITY_ICON: Record<RecentActivityItem["type"], React.ReactElement> = {
  bill: <Receipt className="w-3.5 h-3.5" />,
  payment: <CreditCard className="w-3.5 h-3.5" />,
  cheque: <Banknote className="w-3.5 h-3.5" />,
};

const ACTIVITY_LABEL: Record<RecentActivityItem["type"], string> = {
  bill: "Bill created",
  payment: "Payment made",
  cheque: "Cheque issued",
};

const formatDate = (d?: string | Date | null): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatDateTime = (d?: string | Date | null): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

interface DetailRowProps {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
}

function DetailRow({ label, value, mono }: DetailRowProps) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="w-36 shrink-0 text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest pt-1">
        {label}
      </div>
      <div
        className={`text-sm text-stone-700 dark:text-stone-200 break-words ${
          mono ? "font-mono font-semibold" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function BillDetailsView({
  details,
  inr,
}: {
  details: BillDetails;
  inr: (n: number) => string;
}) {
  const progress =
    details.totalAmount && details.totalAmount > 0
      ? Math.round(((details.paidAmount || 0) / details.totalAmount) * 100)
      : 0;
  return (
    <div className="space-y-0.5">
      <DetailRow label="Invoice #" value={details.invoiceNumber} mono />
      <DetailRow
        label="Supplier Inv#"
        value={details.supplierInvoiceNumber || "—"}
      />
      <DetailRow label="Supplier" value={details.supplierName || "—"} />
      <DetailRow label="Category" value={details.category || "—"} />
      <DetailRow label="Invoice Date" value={formatDate(details.invoiceDate)} />
      <DetailRow label="Due Date" value={formatDate(details.dueDate)} />
      <DetailRow
        label="Total Amount"
        value={inr(details.totalAmount || 0)}
        mono
      />
      <div className="flex items-start gap-3 py-1.5">
        <div className="w-36 shrink-0 text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest pt-3">
          Paid Progress
        </div>
        <div className="flex-1 pt-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 font-mono">
              {inr(details.paidAmount || 0)} paid
            </span>
            <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 font-mono">
              {progress}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                backgroundImage: "linear-gradient(90deg,#14b8a6,#0f766e)",
              }}
            />
          </div>
          <div className="mt-1 text-[11px] font-semibold text-rose-500 dark:text-rose-400 font-mono">
            {inr(details.balance || 0)} balance due
          </div>
        </div>
      </div>
      <DetailRow
        label="Status"
        value={
          details.status ? <StatusPill status={details.status} /> : undefined
        }
      />
      <DetailRow
        label="Attachments"
        value={
          details.attachments && details.attachments > 0 ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Paperclip className="w-3 h-3" />
              {details.attachments} file{details.attachments === 1 ? "" : "s"}
            </span>
          ) : undefined
        }
      />
      {details.notes && <DetailRow label="Notes" value={details.notes} />}
      <DetailRow label="Created" value={formatDateTime(details.createdAt)} />
    </div>
  );
}

function PaymentDetailsView({
  details,
  inr,
}: {
  details: PaymentDetails;
  inr: (n: number) => string;
}) {
  return (
    <div className="space-y-0.5">
      <DetailRow label="Payment #" value={details.paymentNumber} mono />
      <DetailRow label="Supplier" value={details.supplierName || "—"} />
      <DetailRow
        label="Bill Invoice"
        value={details.billInvoiceNumber || "—"}
        mono
      />
      <DetailRow label="Bill Category" value={details.billCategory || "—"} />
      <DetailRow label="Amount Paid" value={inr(details.amount || 0)} mono />
      <DetailRow label="Payment Date" value={formatDate(details.paymentDate)} />
      <DetailRow
        label="Method"
        value={
          details.method ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-950/40 px-3 py-1 text-xs font-semibold capitalize text-blue-700 dark:text-blue-400">
              {details.method.replace("_", " ")}
            </span>
          ) : undefined
        }
      />
      <DetailRow
        label="Attachment"
        value={
          details.hasAttachment ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <Paperclip className="w-3 h-3" /> Attached
            </span>
          ) : undefined
        }
      />
      <DetailRow
        label="Status"
        value={
          details.reversed ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 px-3 py-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
              Reversed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 dark:bg-teal-950/40 px-3 py-1 text-xs font-semibold text-teal-700 dark:text-teal-400">
              Completed
            </span>
          )
        }
      />
      {details.notes && <DetailRow label="Notes" value={details.notes} />}
      <DetailRow label="Created" value={formatDateTime(details.createdAt)} />
    </div>
  );
}

function ChequeDetailsView({
  details,
  inr,
}: {
  details: ChequeDetails;
  inr: (n: number) => string;
}) {
  return (
    <div className="space-y-0.5">
      <DetailRow label="Cheque #" value={details.chequeNumber} mono />
      <DetailRow label="Supplier" value={details.supplierName || "—"} />
      <DetailRow label="Payee" value={details.payee || "—"} />
      <DetailRow label="Bank" value={details.bank || "—"} />
      <DetailRow label="Amount" value={inr(details.amount || 0)} mono />
      <DetailRow label="Cheque Date" value={formatDate(details.chequeDate)} />
      <DetailRow
        label="Status"
        value={
          details.status ? <StatusPill status={details.status} /> : undefined
        }
      />
      <DetailRow label="Created" value={formatDateTime(details.createdAt)} />
    </div>
  );
}

// ============================================================
// FILTER BAR
// ============================================================

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

const buildQuickRanges = () => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisYearStart = new Date(now.getFullYear(), 0, 1);
  return [
    { label: "Last 6 Months", get: () => ({}) as OverviewFilters },
    {
      label: "This Month",
      get: () =>
        ({
          startDate: dateStr(thisMonthStart),
          endDate: dateStr(now),
        }) as OverviewFilters,
    },
    {
      label: "This Year",
      get: () =>
        ({
          startDate: dateStr(thisYearStart),
          endDate: dateStr(now),
        }) as OverviewFilters,
    },
  ];
};

function matchQuickRange(
  f: OverviewFilters,
  ranges: ReturnType<typeof buildQuickRanges>,
): string {
  if (!f.startDate && !f.endDate) return "Last 6 Months";
  for (const r of ranges) {
    const expected = r.get();
    if (expected.startDate === f.startDate && expected.endDate === f.endDate) {
      return r.label;
    }
  }
  return "Custom Range";
}

function FilterBar({
  filters,
  onFiltersChange,
  onRefresh,
  loading,
}: {
  filters: OverviewFilters;
  onFiltersChange: (f: OverviewFilters) => void;
  onRefresh: () => void;
  loading: boolean;
}) {
  const quickRanges = useMemo(buildQuickRanges, []);

  const [showCustom, setShowCustom] = useState(false);
  const [local, setLocal] = useState<OverviewFilters>(filters);
  const [activeRange, setActiveRange] = useState<string>(() =>
    matchQuickRange(filters, buildQuickRanges()),
  );

  React.useEffect(() => {
    setLocal(filters);
    setActiveRange((prev) => {
      const matched = matchQuickRange(filters, quickRanges);
      if (
        matched === "Custom Range" &&
        !filters.startDate &&
        !filters.endDate
      ) {
        return prev;
      }
      return matched;
    });
    if (
      (filters.startDate || filters.endDate) &&
      matchQuickRange(filters, quickRanges) === "Custom Range"
    ) {
      setShowCustom(true);
    }
  }, [filters, quickRanges]);

  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-stone-400" />
          {quickRanges.map((r) => {
            const isActive = activeRange === r.label;
            return (
              <button
                key={r.label}
                onClick={() => {
                  const next = r.get();
                  setLocal(next);
                  onFiltersChange(next);
                  setActiveRange(r.label);
                  setShowCustom(false);
                }}
                className={`text-sm rounded-full border px-3.5 py-1.5 font-medium transition-all ${
                  isActive
                    ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                    : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700"
                }`}
              >
                {r.label}
              </button>
            );
          })}
          <button
            onClick={() => {
              setShowCustom(!showCustom);
              if (!showCustom) setActiveRange("Custom Range");
            }}
            className={`text-sm rounded-full border px-3.5 py-1.5 font-medium transition-all ${
              activeRange === "Custom Range"
                ? "border-teal-500 bg-teal-600 text-white shadow-sm"
                : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700"
            }`}
          >
            Custom Range
          </button>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 rounded-full bg-teal-600 hover:bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50"
        >
          <Activity className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {showCustom && (
        <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
              Start Date
            </label>
            <input
              type="date"
              value={local.startDate || ""}
              onChange={(e) =>
                setLocal({ ...local, startDate: e.target.value })
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
              value={local.endDate || ""}
              onChange={(e) => setLocal({ ...local, endDate: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => {
                onFiltersChange(local);
                setShowCustom(false);
              }}
              className="flex-1 rounded-xl bg-teal-600 hover:bg-teal-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-lg transition-all"
            >
              Apply
            </button>
            <button
              onClick={() => {
                setLocal({});
                onFiltersChange({});
                setShowCustom(false);
                setActiveRange("Last 6 Months");
              }}
              className="rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-2 text-sm font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHART CARDS
// ============================================================

function ChartCard({
  title,
  icon,
  children,
  action,
}: {
  title: string;
  icon: React.ReactElement;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm hover:shadow-md transition-all duration-300 p-6">
      <SectionHeading action={action}>
        <div className="flex items-center gap-2">
          {React.cloneElement(icon, {
            className: "w-4 h-4 text-teal-600 dark:text-teal-400",
          } as React.HTMLAttributes<SVGElement>)}
          {title}
        </div>
      </SectionHeading>
      {children}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[220px] flex flex-col items-center justify-center text-stone-400 dark:text-stone-500">
      <Inbox className="w-6 h-6 mb-2 text-stone-300 dark:text-stone-600" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

function tooltipStyle(isDark: boolean) {
  return {
    borderRadius: 12,
    border: `1px solid ${isDark ? "#292524" : "#f0efed"}`,
    fontSize: 12,
    backgroundColor: isDark ? "#1c1917" : "#ffffff",
    color: isDark ? "#e7e5e4" : "#1c1917",
  };
}

// ============================================================
// MAIN OVERVIEW TAB
// ============================================================

interface OverviewTabProps {
  isDark?: boolean;
  onTabChange?: (tab: string) => void;
  permissionData: UseFinancePermissionReturn;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  isDark = false,
  onTabChange,
  permissionData,
}) => {
  const { permissionsLoaded, canAccessPage, AccessDenied, PermissionLoading } =
    permissionData;
  const { currency } = useCurrency();
  const { loading, error, data, filters, setFilters, refresh } = useOverview();

  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(
    null,
  );

  const inr = (n: number): string => formatMoney(n || 0, currency);
  const isLoading = loading || !data;

  const chartGrid = isDark ? "#292524" : "#f0efed";
  const chartAxis = isDark ? "#78716c" : "#a8a29e";

  const goTo = (tab: string) => () => onTabChange && onTabChange(tab);

  const billStatusData = useMemo(
    () =>
      (data?.bills.statusBreakdown || []).map((s) => ({
        name: s.status,
        value: s.amount,
        count: s.count,
      })),
    [data],
  );
  const billCategoryData = useMemo(
    () =>
      (data?.bills.categoryBreakdown || [])
        .slice(0, 6)
        .map((c) => ({ name: c.category, value: c.amount, count: c.count })),
    [data],
  );
  const paymentMethodData = useMemo(
    () =>
      (data?.payments.methodBreakdown || []).map((m) => ({
        name: m.method?.replace("_", " "),
        value: m.amount,
        count: m.count,
      })),
    [data],
  );
  const chequeStatusData = useMemo(
    () =>
      (data?.cheques.statusBreakdown || []).map((s) => ({
        name: s.status,
        value: s.amount,
        count: s.count,
      })),
    [data],
  );

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
    <div className="zfm-body">
      <style>{FONTS}</style>

      <FilterBar
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={refresh}
        loading={loading}
      />

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6 animate-pulse"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="h-3 w-20 bg-stone-200 dark:bg-stone-700 rounded" />
                <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700" />
              </div>
              <div className="h-8 w-24 bg-stone-200 dark:bg-stone-700 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
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

      {!isLoading && !error && data && (
        <>
          {/* ===== HERO KPI ROW ===== */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <StatCard
              label="Outstanding Bills"
              value={inr(data.kpis.outstandingBills.amount)}
              icon={<Receipt />}
              trend={`${data.kpis.outstandingBills.count} bills unpaid`}
              trendPositive={false}
              fromColor="#fef3c7"
              toColor="#fcd34d"
              iconColor="text-amber-700"
              onClick={goTo("bills")}
            />
            <StatCard
              label="This Month Expenses"
              value={inr(data.kpis.thisMonthExpenses)}
              icon={<TrendingDown />}
              trend={`Year to date: ${inr(data.kpis.thisYearExpenses)}`}
              trendPositive={false}
              fromColor="#ffe4e6"
              toColor="#fda4af"
              iconColor="text-rose-700"
            />
            <StatCard
              label="Petty Cash Balance"
              value={inr(data.kpis.pettyCashBalance)}
              icon={<Wallet />}
              trend={`${inr(data.pettyCash.totalAllocated)} allocated`}
              trendPositive={data.kpis.pettyCashBalance >= 0}
              fromColor="#ccfbf1"
              toColor="#5eead4"
              iconColor="text-teal-700"
              onClick={goTo("pettycash")}
            />
            <StatCard
              label="Bank Balance"
              value={inr(data.kpis.bankBalance)}
              icon={<Landmark />}
              trend={`${data.bankAccounts.accounts.length} active account${data.bankAccounts.accounts.length === 1 ? "" : "s"}`}
              trendPositive
              fromColor="#dbeafe"
              toColor="#93c5fd"
              iconColor="text-blue-700"
              onClick={goTo("bank")}
            />
          </div>

          {/* ===== SECONDARY KPI STRIP ===== */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <MiniStat
              label="Overdue Bills"
              value={inr(data.kpis.overdueBills.amount)}
              icon={<AlertTriangle />}
              tone="rose"
            />
            <MiniStat
              label="Upcoming Bills"
              value={inr(data.kpis.upcomingBills.amount)}
              icon={<Clock />}
              tone="blue"
            />
            <MiniStat
              label="Upcoming Cheques"
              value={inr(data.kpis.upcomingCheques.amount)}
              icon={<Banknote />}
              tone="purple"
            />
            <MiniStat
              label="Unpaid Suppliers"
              value={String(data.kpis.unpaidSuppliers)}
              icon={<Users />}
              tone="amber"
            />
          </div>

          {/* ===== CHARTS ===== */}
          <div className="space-y-6">
            {/* Monthly bills billed vs paid */}
            <ChartCard
              title="Bills — Billed vs Paid"
              icon={<BarChart3 />}
              action={
                <button
                  onClick={goTo("bills")}
                  className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  View All →
                </button>
              }
            >
              {data.bills.monthlyTrend.length === 0 ? (
                <EmptyChart label="No bills in this period." />
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={data.bills.monthlyTrend}>
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
                      tick={{ fontSize: 11, fill: chartAxis }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => inr(Number(v))}
                    />
                    <Tooltip
                      formatter={(v) => inr(Number(v))}
                      contentStyle={tooltipStyle(isDark)}
                    />
                    <Legend />
                    <Bar
                      dataKey="billed"
                      name="Billed"
                      fill="#0f766e"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="paid"
                      name="Paid"
                      fill="#14b8a6"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Bill status + category */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Bill Status Breakdown" icon={<Percent />}>
                {billStatusData.length === 0 ? (
                  <EmptyChart label="No bills yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <RePieChart>
                      <Pie
                        data={billStatusData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={80}
                        label={({ name, percent = 0 }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {billStatusData.map((_e, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => inr(Number(v))}
                        contentStyle={tooltipStyle(isDark)}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Expenses by Category" icon={<PieChart />}>
                {billCategoryData.length === 0 ? (
                  <EmptyChart label="No categorized bills yet." />
                ) : (
                  <ResponsiveContainer width="100%" height={230}>
                    <RePieChart>
                      <Pie
                        data={billCategoryData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        label={({ name, percent = 0 }) =>
                          `${name} ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine={false}
                      >
                        {billCategoryData.map((_e, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => inr(Number(v))}
                        contentStyle={tooltipStyle(isDark)}
                      />
                    </RePieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            {/* Payment method + cheque status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard
                title="Payment Methods"
                icon={<CreditCard />}
                action={
                  <button
                    onClick={goTo("payments")}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    View All →
                  </button>
                }
              >
                {paymentMethodData.length === 0 ? (
                  <EmptyChart label="No payments recorded yet." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={190}>
                      <RePieChart>
                        <Pie
                          data={paymentMethodData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          label={({ percent = 0 }) =>
                            `${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {paymentMethodData.map((_e, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => inr(Number(v))}
                          contentStyle={tooltipStyle(isDark)}
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 mt-3 justify-center">
                      {paymentMethodData.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                          <span className="text-stone-600 dark:text-stone-400 capitalize">
                            {item.name || "Unknown"}
                          </span>
                          <span className="font-semibold text-stone-800 dark:text-stone-200">
                            ({inr(item.value)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ChartCard>

              <ChartCard
                title="Cheque Status"
                icon={<Banknote />}
                action={
                  <button
                    onClick={goTo("cheques")}
                    className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                  >
                    View All →
                  </button>
                }
              >
                {chequeStatusData.length === 0 ? (
                  <EmptyChart label="No cheques issued yet." />
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={190}>
                      <RePieChart>
                        <Pie
                          data={chequeStatusData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          label={({ percent = 0 }) =>
                            `${(percent * 100).toFixed(0)}%`
                          }
                        >
                          {chequeStatusData.map((_e, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v) => inr(Number(v))}
                          contentStyle={tooltipStyle(isDark)}
                        />
                      </RePieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 mt-3 justify-center">
                      {chequeStatusData.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-1.5 text-xs"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                          <span className="text-stone-600 dark:text-stone-400 capitalize">
                            {item.name}
                          </span>
                          <span className="font-semibold text-stone-800 dark:text-stone-200">
                            ({item.count})
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </ChartCard>
            </div>

            {/* Petty cash trend */}
            <ChartCard
              title="Petty Cash — Allocated vs Spent"
              icon={<Wallet />}
              action={
                <button
                  onClick={goTo("pettycash")}
                  className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                >
                  View All →
                </button>
              }
            >
              {data.pettyCash.monthlyTrend.length === 0 ? (
                <EmptyChart label="No petty cash activity in this period." />
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.pettyCash.monthlyTrend}>
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
                      tick={{ fontSize: 11, fill: chartAxis }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => inr(Number(v))}
                    />
                    <Tooltip
                      formatter={(v) => inr(Number(v))}
                      contentStyle={tooltipStyle(isDark)}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="allocated"
                      name="Allocated"
                      stroke="#0f766e"
                      strokeWidth={2.5}
                    />
                    <Line
                      type="monotone"
                      dataKey="spent"
                      name="Spent"
                      stroke="#e11d48"
                      strokeWidth={2.5}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            {/* Top unpaid suppliers + Bank accounts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-6">
                <SectionHeading>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Top Unpaid Suppliers
                  </div>
                </SectionHeading>
                {data.topUnpaidSuppliers.length === 0 ? (
                  <EmptyChart label="Every supplier is paid up." />
                ) : (
                  <div className="space-y-3">
                    {data.topUnpaidSuppliers.map((s, i) => {
                      const max = data.topUnpaidSuppliers[0].outstanding || 1;
                      const pct = Math.max(
                        6,
                        Math.round((s.outstanding / max) * 100),
                      );
                      return (
                        <div key={s.supplierId || i}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="font-medium text-stone-700 dark:text-stone-300 truncate">
                              {s.name}
                            </span>
                            <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                              {inr(s.outstanding)}
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${pct}%`,
                                backgroundImage:
                                  "linear-gradient(90deg,#f59e0b,#e11d48)",
                              }}
                            />
                          </div>
                          <div className="text-[11px] text-stone-400 dark:text-stone-500 mt-0.5">
                            {s.billCount} bill{s.billCount === 1 ? "" : "s"}{" "}
                            pending
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-6">
                <SectionHeading
                  action={
                    <button
                      onClick={goTo("bank")}
                      className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      Manage →
                    </button>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Bank Accounts
                  </div>
                </SectionHeading>
                {data.bankAccounts.accounts.length === 0 ? (
                  <EmptyChart label="No bank accounts added yet." />
                ) : (
                  <div className="space-y-3">
                    {data.bankAccounts.accounts.map((a) => (
                      <div
                        key={a._id}
                        className="flex items-center justify-between rounded-xl border border-stone-100 dark:border-stone-800 p-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center shrink-0">
                            <Landmark className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
                              {a.bankName}
                            </div>
                            <div className="text-xs text-stone-400 dark:text-stone-500 truncate">
                              {a.accountName || "—"}{" "}
                              {a.accountNumber
                                ? `•••• ${a.accountNumber.slice(-4)}`
                                : ""}
                            </div>
                          </div>
                        </div>
                        <span className="font-mono font-semibold text-stone-800 dark:text-stone-100 shrink-0">
                          {inr(a.currentBalance)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Upcoming cheques */}
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-stone-100 dark:border-stone-800">
                <SectionHeading
                  action={
                    <button
                      onClick={goTo("cheques")}
                      className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
                    >
                      View All →
                    </button>
                  }
                >
                  <div className="flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Upcoming Cheques
                  </div>
                </SectionHeading>
              </div>
              {data.cheques.upcoming.length === 0 ? (
                <div className="text-center py-14 text-stone-400 dark:text-stone-500">
                  <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                  <p className="text-sm">No cheques due soon.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-widest font-bold border-b border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30">
                        <th className="px-5 py-3 font-bold">Cheque #</th>
                        <th className="px-5 py-3 font-bold">Payee</th>
                        <th className="px-5 py-3 font-bold">Bank</th>
                        <th className="px-5 py-3 font-bold text-right">
                          Amount
                        </th>
                        <th className="px-5 py-3 font-bold">Due Date</th>
                        <th className="px-5 py-3 font-bold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                      {data.cheques.upcoming.map((c) => (
                        <tr
                          key={c._id}
                          className="hover:bg-teal-50/50 dark:hover:bg-teal-950/30 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-mono font-semibold text-stone-800 dark:text-stone-100 text-xs">
                            {c.chequeNumber}
                          </td>
                          <td className="px-5 py-3.5 text-stone-700 dark:text-stone-300">
                            {c.payee || "—"}
                          </td>
                          <td className="px-5 py-3.5 text-stone-500 dark:text-stone-400 text-xs">
                            {c.bank || "—"}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono font-semibold text-stone-800 dark:text-stone-100">
                            {inr(c.amount)}
                          </td>
                          <td className="px-5 py-3.5 text-stone-500 dark:text-stone-400 text-xs">
                            {formatDate(c.chequeDate)}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusPill status={c.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-sm p-6">
              <SectionHeading
                action={
                  data.recentActivity.length > 0 ? (
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-400 dark:text-stone-500">
                      <Info className="w-3.5 h-3.5" />
                      Click row to expand
                    </div>
                  ) : undefined
                }
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  Recent Activity
                </div>
              </SectionHeading>
              {data.recentActivity.length === 0 ? (
                <EmptyChart label="Nothing recorded yet." />
              ) : (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {data.recentActivity.map((item) => {
                    const rowKey = `${item.type}-${item.id}`;
                    const isOpen = expandedActivityId === rowKey;
                    return (
                      <div key={rowKey}>
                        <button
                          onClick={() =>
                            setExpandedActivityId(isOpen ? null : rowKey)
                          }
                          className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-2 -mx-2 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
                            {ACTIVITY_ICON[item.type]}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
                              {ACTIVITY_LABEL[item.type]} · {item.title}
                            </div>
                            <div className="text-xs text-stone-400 dark:text-stone-500 truncate">
                              {item.subtitle}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-semibold text-stone-800 dark:text-stone-100 text-sm">
                              {inr(item.amount)}
                            </div>
                            <div className="text-[10px] text-stone-400 dark:text-stone-500">
                              {formatDate(item.date)}
                            </div>
                          </div>
                          <div
                            className={`shrink-0 transition-transform duration-200 ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          >
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-teal-500 dark:text-teal-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600" />
                            )}
                          </div>
                        </button>
                        <div
                          className={`grid transition-all duration-300 ease-in-out ${
                            isOpen
                              ? "grid-rows-[1fr] opacity-100"
                              : "grid-rows-[0fr] opacity-0"
                          }`}
                        >
                          <div className="overflow-hidden">
                            <div className="pt-2 pb-5 pl-13 ml-13 relative">
                              <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-teal-200 dark:from-teal-900 to-transparent" />
                              <div className="ml-9 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-5">
                                {item.type === "bill" && item.details && (
                                  <BillDetailsView
                                    details={item.details as BillDetails}
                                    inr={inr}
                                  />
                                )}
                                {item.type === "payment" && item.details && (
                                  <PaymentDetailsView
                                    details={item.details as PaymentDetails}
                                    inr={inr}
                                  />
                                )}
                                {item.type === "cheque" && item.details && (
                                  <ChequeDetailsView
                                    details={item.details as ChequeDetails}
                                    inr={inr}
                                  />
                                )}
                                {!item.details && (
                                  <div className="text-xs text-stone-400 dark:text-stone-500 py-2">
                                    No additional details available.
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default OverviewTab;

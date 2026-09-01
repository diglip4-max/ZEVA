import React, { useState } from "react";
import {
  Loader2,
  Inbox,
  AlertTriangle,
  BarChart3,
  Wallet,
  TrendingUp,
  TrendingDown,
  ChevronRight,
  ChevronDown,
  Receipt,
  CalendarClock,
  Clock,
  FileText,
  Info,
  Users,
  CreditCard,
  Landmark,
  Banknote,
  Smartphone,
  CheckCircle2,
  Percent,
  DollarSign,
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
// REPORT METADATA — icon / label / description per report type
// Drives the picker pills + the premium card header
// ============================================================
const REPORT_META: Record<
  string,
  { description: string; icon: React.ReactNode; accent: string }
> = {
  expense: {
    description: "Where money left the clinic, broken down by category",
    icon: <TrendingDown className="w-3.5 h-3.5" />,
    accent: "rose",
  },
  outstandingBills: {
    description: "Bills that are still owed to suppliers",
    icon: <Clock className="w-3.5 h-3.5" />,
    accent: "amber",
  },
  paidBills: {
    description: "Bills that have been fully settled",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    accent: "teal",
  },
  upcomingBills: {
    description: "Bills coming due soon",
    icon: <CalendarClock className="w-3.5 h-3.5" />,
    accent: "sky",
  },
  paymentHistory: {
    description: "Every payment made out to suppliers",
    icon: <Receipt className="w-3.5 h-3.5" />,
    accent: "teal",
  },
  pettyCash: {
    description: "Cash movement in and out of the petty cash box",
    icon: <Wallet className="w-3.5 h-3.5" />,
    accent: "indigo",
  },
  cheques: {
    description: "Cheques grouped by their current status",
    icon: <Landmark className="w-3.5 h-3.5" />,
    accent: "violet",
  },
  supplier: {
    description: "Spend and balance broken down by supplier",
    icon: <Users className="w-3.5 h-3.5" />,
    accent: "indigo",
  },
  yearlySummary: {
    description: "Income vs. expense trend across the year",
    icon: <BarChart3 className="w-3.5 h-3.5" />,
    accent: "violet",
  },
};

const DEFAULT_META = {
  description: "Clinic finance report",
  icon: <BarChart3 className="w-3.5 h-3.5" />,
  accent: "teal",
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
  upi: "UPI",
  card: "Card",
};

const METHOD_ICON: Record<string, React.ReactNode> = {
  cash: <Banknote className="w-4 h-4" />,
  bank_transfer: <Landmark className="w-4 h-4" />,
  cheque: <FileText className="w-4 h-4" />,
  upi: <Smartphone className="w-4 h-4" />,
  card: <CreditCard className="w-4 h-4" />,
};

// ============================================================
// SHELL / EMPTY STATE (shared, premium styled)
// ============================================================
const Shell: React.FC<{
  header?: React.ReactNode;
  children: React.ReactNode;
}> = ({ header, children }) => (
  <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
    {header}
    {children}
  </div>
);

const EmptyState = ({
  label = "No data for this range.",
}: {
  label?: string;
}) => (
  <div className="px-5 py-20 text-center">
    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-stone-50 dark:bg-stone-800/60 flex items-center justify-center">
      <Inbox className="w-6 h-6 text-stone-300 dark:text-stone-600" />
    </div>
    <span className="text-sm text-stone-400 dark:text-stone-500">{label}</span>
  </div>
);

// ============================================================
// REPORT CARD HEADER — premium hero strip matching the
// New Bill modal's gradient icon-block treatment
// ============================================================
function ReportCardHeader({ reportType }: { reportType: ReportType }) {
  const meta = REPORT_META[reportType as string] || DEFAULT_META;
  const option = REPORT_OPTIONS.find((r) => r.value === reportType);
  return (
    <div
      className="relative px-5 sm:px-6 py-5 border-b border-stone-100 dark:border-stone-800 overflow-hidden"
      style={{
        backgroundImage:
          "linear-gradient(135deg, rgba(20,184,166,0.10), rgba(15,118,110,0.03) 60%, rgba(255,255,255,0) 100%)",
      }}
    >
      <div
        className="absolute -right-14 -top-16 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-70"
        style={{
          background:
            "radial-gradient(circle, rgba(20,184,166,0.18), transparent 65%)",
        }}
      />
      <div className="relative flex items-center gap-3.5">
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 rounded-2xl blur-md opacity-40"
            style={{
              backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
            }}
          />
          <div
            className="relative w-11 h-11 rounded-2xl flex items-center justify-center shadow-md ring-1 ring-white/40"
            style={{
              backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
            }}
          >
            <span className="text-white">
              {React.cloneElement(
                meta.icon as React.ReactElement<{ className?: string }>,
                { className: "w-5 h-5" },
              )}
            </span>
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="zfm-display text-base font-semibold text-stone-900 dark:text-stone-50 truncate">
            {option?.label || "Report"}
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">
            {meta.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SETTLEMENT PROGRESS BAR — shared visual for bill/supplier rows
// ============================================================
function SettlementBar({
  paid,
  total,
  currency,
}: {
  paid: number;
  total: number;
  currency: string;
}) {
  const safeTotal = total > 0 ? total : 0;
  const paidPct = safeTotal > 0 ? Math.min((paid / safeTotal) * 100, 100) : 0;
  const balance = Math.max(safeTotal - paid, 0);
  const balancePct =
    safeTotal > 0 ? Math.min((balance / safeTotal) * 100, 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Settlement progress
        </span>
        <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
          <span className="text-teal-600 dark:text-teal-400">
            {formatMoney(paid, currency)} paid
          </span>
          <span className="text-stone-300 dark:text-stone-600">of</span>
          <span className="text-stone-700 dark:text-stone-200">
            {formatMoney(safeTotal, currency)}
          </span>
        </div>
      </div>
      <div className="relative w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${paidPct}%`,
            backgroundImage:
              "linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf)",
          }}
        />
        {balance > 0 && (
          <div
            className="absolute inset-y-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500 ease-out"
            style={{ left: `${paidPct}%`, width: `${balancePct}%` }}
          />
        )}
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
        <span className="text-teal-600 dark:text-teal-400">
          {paidPct.toFixed(1)}% settled
        </span>
        {balance > 0 && (
          <span className="text-orange-500 dark:text-orange-400">
            {balancePct.toFixed(1)}% due
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================
// DETAIL FIELD — small icon + label + value card used inside
// every expanded row body
// ============================================================
function DetailField({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br ${
        accent || "from-stone-50 to-white dark:from-stone-800/40"
      } p-3.5`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-5 h-5 rounded-md bg-white dark:bg-stone-800/70 flex items-center justify-center text-stone-500 dark:text-stone-400 shadow-sm">
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          {label}
        </span>
      </div>
      <div className="text-sm font-medium text-stone-700 dark:text-stone-200 pl-[26px]">
        {value}
      </div>
    </div>
  );
}

// ============================================================
// EXPANDABLE ROW — generic accordion row, same interaction
// pattern as BillsPayableTab's BillRow (one open at a time,
// smooth grid-rows expand/collapse)
// ============================================================
function ExpandableRow({
  isOpen,
  onToggle,
  icon,
  iconBg,
  iconColor,
  title,
  meta,
  badge,
  trailing,
  children,
}: {
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  title: React.ReactNode;
  meta?: React.ReactNode;
  badge?: React.ReactNode;
  trailing: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-3 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center ${iconColor} shrink-0`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
            {title}
          </div>
          {meta && (
            <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2 flex-wrap">
              {meta}
            </div>
          )}
        </div>
        {badge}
        <div className="text-right shrink-0 min-w-[108px]">{trailing}</div>
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
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2 pb-5 pl-13 ml-13 relative">
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-teal-200 dark:from-teal-900 to-transparent" />
            <div className="ml-9 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-5">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BILL TABLE — outstanding / paid / upcoming, now expandable
// ============================================================
function BillRowExpandable({
  bill,
  currency,
  isOpen,
  onToggle,
}: {
  bill: any;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const supplierName = bill.supplierId?.name || "—";
  const balance = bill.amount - (bill.paidAmount || 0);

  return (
    <ExpandableRow
      isOpen={isOpen}
      onToggle={onToggle}
      icon={<Receipt className="w-4 h-4" />}
      iconBg="bg-teal-50 dark:bg-teal-950/50"
      iconColor="text-teal-600 dark:text-teal-400"
      title={supplierName}
      meta={
        <>
          <span className="font-mono">{bill.invoiceNumber}</span>
          <span>·</span>
          <span>{bill.category}</span>
          <span>·</span>
          <span>Due {formatDate(bill.dueDate)}</span>
        </>
      }
      trailing={
        <>
          <div className="font-mono font-semibold text-stone-800 dark:text-stone-100 text-sm">
            {formatMoney(balance, currency)}
          </div>
          <div className="text-[10px] text-stone-400 dark:text-stone-500">
            of {formatMoney(bill.amount, currency)}
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <SettlementBar
          paid={bill.paidAmount || 0}
          total={bill.amount}
          currency={currency}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailField
            icon={<CalendarClock className="w-3.5 h-3.5" />}
            label="Invoice date"
            value={formatDate(bill.invoiceDate)}
            accent="from-sky-50 to-white dark:from-sky-950/40"
          />
          <DetailField
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Due date"
            value={formatDate(bill.dueDate)}
            accent="from-rose-50 to-white dark:from-rose-950/40"
          />
          {bill.supplierInvoiceNumber && (
            <DetailField
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Supplier invoice #"
              value={
                <span className="font-mono">{bill.supplierInvoiceNumber}</span>
              }
              accent="from-violet-50 to-white dark:from-violet-950/40"
            />
          )}
          {bill.status && (
            <DetailField
              icon={<Info className="w-3.5 h-3.5" />}
              label="Status"
              value={<span className="capitalize">{bill.status}</span>}
              accent="from-amber-50 to-white dark:from-amber-950/40"
            />
          )}
        </div>
        {bill.notes && (
          <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-slate-50 to-white dark:from-stone-800/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Notes
              </span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed pl-[32px]">
              {bill.notes}
            </p>
          </div>
        )}
      </div>
    </ExpandableRow>
  );
}

function BillTable({ rows, currency }: { rows: any[]; currency: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="divide-y divide-stone-100 dark:divide-stone-800 px-2 py-1">
      {rows.map((b) => {
        const isOpen = expandedId === b._id;
        return (
          <BillRowExpandable
            key={b._id}
            bill={b}
            currency={currency}
            isOpen={isOpen}
            onToggle={() => setExpandedId(isOpen ? null : b._id)}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// PAYMENT HISTORY — expandable rows
// ============================================================
function PaymentRowExpandable({
  payment,
  currency,
  isOpen,
  onToggle,
}: {
  payment: any;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const p = payment;
  const supplierName = p.supplierId?.name || "—";
  const icon = METHOD_ICON[p.method] || <CreditCard className="w-4 h-4" />;
  const methodLabel =
    METHOD_LABEL[p.method] || p.method?.replace("_", " ") || "—";

  return (
    <ExpandableRow
      isOpen={isOpen}
      onToggle={onToggle}
      icon={icon}
      iconBg={
        p.reversed
          ? "bg-stone-100 dark:bg-stone-800"
          : "bg-teal-50 dark:bg-teal-950/50"
      }
      iconColor={
        p.reversed
          ? "text-stone-400 dark:text-stone-500"
          : "text-teal-600 dark:text-teal-400"
      }
      title={supplierName}
      meta={
        <>
          <span className="font-mono">{p.paymentNumber}</span>
          <span>·</span>
          <span className="capitalize">{methodLabel}</span>
          <span>·</span>
          <span>{formatDate(p.date)}</span>
        </>
      }
      badge={
        p.reversed && (
          <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full shrink-0">
            Reversed
          </span>
        )
      }
      trailing={
        <div
          className={`font-mono font-semibold text-sm ${
            p.reversed
              ? "text-stone-400 dark:text-stone-500 line-through"
              : "text-teal-600 dark:text-teal-400"
          }`}
        >
          {formatMoney(p.amount, currency)}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <DetailField
            icon={<CalendarClock className="w-3.5 h-3.5" />}
            label="Date"
            value={formatDate(p.date)}
            accent="from-sky-50 to-white dark:from-sky-950/40"
          />
          <DetailField
            icon={icon}
            label="Method"
            value={<span className="capitalize">{methodLabel}</span>}
            accent="from-teal-50 to-white dark:from-teal-950/40"
          />
          {p.chequeNumber && (
            <DetailField
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Cheque #"
              value={<span className="font-mono">{p.chequeNumber}</span>}
              accent="from-violet-50 to-white dark:from-violet-950/40"
            />
          )}
          {p.bankName && (
            <DetailField
              icon={<Landmark className="w-3.5 h-3.5" />}
              label="Bank"
              value={p.bankName}
              accent="from-indigo-50 to-white dark:from-indigo-950/40"
            />
          )}
          {p.reference && (
            <DetailField
              icon={<Info className="w-3.5 h-3.5" />}
              label="Reference"
              value={p.reference}
              accent="from-amber-50 to-white dark:from-amber-950/40"
            />
          )}
        </div>
        {p.reversed && (
          <div className="rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/30 p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                Reversed
              </span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300 pl-[22px]">
              {p.reversedReason || "This payment was reversed."}
              {p.reversedAt ? ` · ${formatDate(p.reversedAt)}` : ""}
            </p>
          </div>
        )}
        {p.notes && (
          <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-slate-50 to-white dark:from-stone-800/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                Notes
              </span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed pl-[32px]">
              {p.notes}
            </p>
          </div>
        )}
      </div>
    </ExpandableRow>
  );
}

function PaymentHistoryTable({
  rows,
  currency,
}: {
  rows: any[];
  currency: string;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="divide-y divide-stone-100 dark:divide-stone-800 px-2 py-1">
      {rows.map((p) => {
        const isOpen = expandedId === p._id;
        return (
          <PaymentRowExpandable
            key={p._id}
            payment={p}
            currency={currency}
            isOpen={isOpen}
            onToggle={() => setExpandedId(isOpen ? null : p._id)}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// SUPPLIER REPORT — expandable rows
// ============================================================
function SupplierRowExpandable({
  row,
  currency,
  isOpen,
  onToggle,
}: {
  row: any;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const avg = row.billCount > 0 ? row.totalBilled / row.billCount : 0;
  return (
    <ExpandableRow
      isOpen={isOpen}
      onToggle={onToggle}
      icon={<Users className="w-4 h-4" />}
      iconBg="bg-indigo-50 dark:bg-indigo-950/40"
      iconColor="text-indigo-600 dark:text-indigo-400"
      title={row.supplierName}
      meta={<span>{row.billCount} bills</span>}
      trailing={
        <>
          <div className="font-mono font-semibold text-rose-500 dark:text-rose-400 text-sm">
            {formatMoney(row.totalBalance, currency)}
          </div>
          <div className="text-[10px] text-stone-400 dark:text-stone-500">
            balance due
          </div>
        </>
      }
    >
      <div className="space-y-4">
        <SettlementBar
          paid={row.totalPaid}
          total={row.totalBilled}
          currency={currency}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <DetailField
            icon={<Receipt className="w-3.5 h-3.5" />}
            label="Total billed"
            value={formatMoney(row.totalBilled, currency)}
            accent="from-sky-50 to-white dark:from-sky-950/40"
          />
          <DetailField
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Total paid"
            value={formatMoney(row.totalPaid, currency)}
            accent="from-teal-50 to-white dark:from-teal-950/40"
          />
          <DetailField
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label="Average bill"
            value={formatMoney(avg, currency)}
            accent="from-violet-50 to-white dark:from-violet-950/40"
          />
        </div>
      </div>
    </ExpandableRow>
  );
}

function SupplierTable({ rows, currency }: { rows: any[]; currency: string }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="divide-y divide-stone-100 dark:divide-stone-800 px-2 py-1">
      {rows.map((s) => {
        const isOpen = expandedId === s.supplierId;
        return (
          <SupplierRowExpandable
            key={s.supplierId}
            row={s}
            currency={currency}
            isOpen={isOpen}
            onToggle={() => setExpandedId(isOpen ? null : s.supplierId)}
          />
        );
      })}
    </div>
  );
}

// ============================================================
// EXPENSE REPORT — chart + expandable category breakdown
// ============================================================
function ExpenseRowExpandable({
  row,
  currency,
  totalAll,
  isOpen,
  onToggle,
}: {
  row: any;
  currency: string;
  totalAll: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const share = totalAll > 0 ? (row.totalSpent / totalAll) * 100 : 0;
  const avg = row.count > 0 ? row.totalSpent / row.count : 0;
  return (
    <ExpandableRow
      isOpen={isOpen}
      onToggle={onToggle}
      icon={<TrendingDown className="w-4 h-4" />}
      iconBg="bg-rose-50 dark:bg-rose-950/40"
      iconColor="text-rose-600 dark:text-rose-400"
      title={row.category}
      meta={<span>{row.count} entries</span>}
      trailing={
        <div className="font-mono font-semibold text-stone-800 dark:text-stone-100 text-sm">
          {formatMoney(row.totalSpent, currency)}
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <DetailField
          icon={<Percent className="w-3.5 h-3.5" />}
          label="Share of spend"
          value={`${share.toFixed(1)}%`}
          accent="from-amber-50 to-white dark:from-amber-950/40"
        />
        <DetailField
          icon={<Receipt className="w-3.5 h-3.5" />}
          label="Entries"
          value={row.count}
          accent="from-sky-50 to-white dark:from-sky-950/40"
        />
        <DetailField
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="Average per entry"
          value={formatMoney(avg, currency)}
          accent="from-teal-50 to-white dark:from-teal-950/40"
        />
      </div>
    </ExpandableRow>
  );
}

function ExpenseReport({ rows, currency }: { rows: any[]; currency: string }) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  if (rows.length === 0) return <EmptyState />;
  const totalAll = rows.reduce(
    (sum: number, r: any) => sum + (r.totalSpent || 0),
    0,
  );

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
                formatMoney(Array.isArray(value) ? value[0] : value, currency)
              }
            />
            <Bar dataKey="totalSpent" fill="#14b8a6" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="divide-y divide-stone-100 dark:divide-stone-800 border-t border-stone-100 dark:border-stone-800 px-2 py-1">
        {rows.map((r: any) => {
          const isOpen = expandedCategory === r.category;
          return (
            <ExpenseRowExpandable
              key={r.category}
              row={r}
              currency={currency}
              totalAll={totalAll}
              isOpen={isOpen}
              onToggle={() => setExpandedCategory(isOpen ? null : r.category)}
            />
          );
        })}
      </div>
    </>
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
        <div className="px-5 py-20 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-teal-600 dark:text-teal-400" />
          <span className="text-sm text-stone-400 dark:text-stone-500">
            Loading report…
          </span>
        </div>
      );
    }
    if (error) {
      return (
        <div className="px-5 py-20 text-center">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6 text-rose-500 dark:text-rose-400" />
          </div>
          <span className="text-sm text-rose-500 dark:text-rose-400">
            {error}
          </span>
        </div>
      );
    }
    if (!result) return <EmptyState />;

    switch (reportType as ReportType) {
      case "expense":
        return <ExpenseReport rows={result.data || []} currency={currency} />;

      case "outstandingBills":
      case "paidBills":
      case "upcomingBills":
        return <BillTable rows={result.data || []} currency={currency} />;

      case "paymentHistory":
        return (
          <PaymentHistoryTable rows={result.data || []} currency={currency} />
        );

      case "pettyCash": {
        const daily = result.daily || [];
        return (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-5">
              <StatCard
                label="Cash In"
                value={formatMoney(result.summary?.cashIn || 0, currency)}
                icon={<TrendingUp />}
                fromColor="#0d9488"
                toColor="#14b8a6"
                iconColor="text-white"
                trend="This selection"
                trendPositive={true}
              />
              <StatCard
                label="Cash Out"
                value={formatMoney(result.summary?.cashOut || 0, currency)}
                icon={<TrendingDown />}
                fromColor="#dc2626"
                toColor="#ef4444"
                iconColor="text-white"
                trend="This selection"
                trendPositive={false}
              />
              <StatCard
                label="Net"
                value={formatMoney(result.summary?.net || 0, currency)}
                icon={<BarChart3 />}
                fromColor="#7c3aed"
                toColor="#8b5cf6"
                iconColor="text-white"
                trend="In minus out"
                trendPositive={result.summary?.net || 0 >= 0}
              />
              <StatCard
                label="Current Balance"
                value={formatMoney(
                  result.summary?.currentBalance || 0,
                  currency,
                )}
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
        const totalAll = rows.reduce(
          (sum: number, r: any) => sum + (r.totalAmount || 0),
          0,
        );
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
            <div className="flex flex-col gap-2 self-center">
              {rows.map((r: any, i: number) => {
                const share =
                  totalAll > 0 ? (r.totalAmount / totalAll) * 100 : 0;
                return (
                  <div
                    key={r.status}
                    className="flex items-center justify-between rounded-xl border border-stone-100 dark:border-stone-700/60 bg-stone-50/60 dark:bg-stone-800/40 px-3.5 py-2.5"
                  >
                    <span className="flex items-center gap-2 text-sm capitalize text-stone-700 dark:text-stone-200">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{
                          background: PIE_COLORS[i % PIE_COLORS.length],
                        }}
                      />
                      {r.status}
                      <span className="text-xs text-stone-400 dark:text-stone-500">
                        ({r.count})
                      </span>
                    </span>
                    <div className="text-right">
                      <div className="font-mono text-sm font-semibold text-stone-800 dark:text-stone-100">
                        {formatMoney(r.totalAmount, currency)}
                      </div>
                      <div className="text-[10px] text-stone-400 dark:text-stone-500">
                        {share.toFixed(1)}% of total
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      }

      case "supplier":
        return <SupplierTable rows={result.data || []} currency={currency} />;

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
      <div className="flex items-center gap-3.5">
        <div
          className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-md ring-1 ring-white/40 shrink-0"
          style={{ backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)" }}
        >
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
            Reports
          </h2>
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
            Expense, vendor, cheque and payment history reports
          </p>
        </div>
      </div>

      {/* Report picker */}
      <div className="flex flex-wrap gap-2">
        {REPORT_OPTIONS.map((r) => {
          const meta = REPORT_META[r.value as string] || DEFAULT_META;
          const active = reportType === r.value;
          return (
            <button
              key={r.value}
              onClick={() => setReportType(r.value)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold transition-all whitespace-nowrap border ${
                active
                  ? "text-white border-transparent shadow-md"
                  : "bg-white dark:bg-stone-900 text-stone-500 dark:text-stone-400 border-stone-200 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"
              }`}
              style={
                active
                  ? {
                      backgroundImage:
                        "linear-gradient(135deg,#14b8a6,#0f766e)",
                    }
                  : undefined
              }
            >
              <span
                className={
                  active ? "text-white" : "text-stone-400 dark:text-stone-500"
                }
              >
                {meta.icon}
              </span>
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-4 sm:p-5 flex flex-wrap items-center gap-3">
        {reportType === "yearlySummary" ? (
          <>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              </div>
              <span className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                Year
              </span>
            </div>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
            />
            <button
              onClick={() => setYear("")}
              className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline ml-auto"
            >
              Clear (show all years)
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center">
                <CalendarClock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              </div>
              <span className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                From
              </span>
            </div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
            />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-900/40 flex items-center justify-center">
                <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              </div>
              <span className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                To
              </span>
            </div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
            />
          </>
        )}
      </div>

      <Shell header={<ReportCardHeader reportType={reportType} />}>
        {renderBody()}
      </Shell>
    </div>
  );
};

export default ReportsTab;

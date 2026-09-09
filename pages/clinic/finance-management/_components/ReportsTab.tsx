import React, { useEffect, useRef, useState } from "react";
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
  Download,
  X,
  Eye,
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
// Drives the report card grid + the modal header
// ============================================================
const REPORT_META: Record<
  string,
  { description: string; icon: React.ReactNode; accent: string }
> = {
  expense: {
    description: "Spending by category, supplier and period.",
    icon: <TrendingDown className="w-3.5 h-3.5" />,
    accent: "rose",
  },
  outstandingBills: {
    description: "Every unpaid bill and its balance.",
    icon: <Clock className="w-3.5 h-3.5" />,
    accent: "amber",
  },
  paidBills: {
    description: "Full payment history across all bills.",
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    accent: "teal",
  },
  upcomingBills: {
    description: "What is due, and when.",
    icon: <CalendarClock className="w-3.5 h-3.5" />,
    accent: "sky",
  },
  paymentHistory: {
    description: "Every payment transaction, by method and reference.",
    icon: <Receipt className="w-3.5 h-3.5" />,
    accent: "teal",
  },
  pettyCash: {
    description: "Daily petty cash ledger and reconciliation.",
    icon: <Wallet className="w-3.5 h-3.5" />,
    accent: "indigo",
  },
  cheques: {
    description: "Cheque lifecycle and current exposure.",
    icon: <Landmark className="w-3.5 h-3.5" />,
    accent: "violet",
  },
  supplier: {
    description: "Outstanding, overdue and payment history per supplier.",
    icon: <Users className="w-3.5 h-3.5" />,
    accent: "indigo",
  },
  yearlySummary: {
    description: "Full-year spending distribution by category.",
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

const EmptyState = ({
  label = "No data for this range.",
}: {
  label?: string;
}) => (
  <div className="px-5 py-20 text-center">
    <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-[#F8F5EF] dark:bg-[#16231f] flex items-center justify-center">
      <Inbox className="w-6 h-6 text-stone-300 dark:text-stone-600" />
    </div>
    <span className="text-sm text-stone-400 dark:text-stone-500">{label}</span>
  </div>
);

// ============================================================
// REPORT CARD HEADER — flat, solid icon block (no gradient)
// used at the top of the view modal / export sheet
// ============================================================
function ReportCardHeader({ reportType }: { reportType: ReportType }) {
  const meta = REPORT_META[reportType as string] || DEFAULT_META;
  const option = REPORT_OPTIONS.find((r) => r.value === reportType);
  return (
    <div
      className="flex items-center px-6 sm:px-8 border-b border-[#EDE7DA] dark:border-[#1a2622]"
      style={{ gap: 16, paddingTop: 24, paddingBottom: 24 }}
    >
      <div
        className="rounded-2xl flex items-center justify-center bg-teal-600 dark:bg-teal-500 shrink-0"
        style={{ width: 48, height: 48, minWidth: 48, lineHeight: 0 }}
      >
        <span
          className="text-white"
          style={{ display: "block", width: 22, height: 22 }}
        >
          {React.cloneElement(
            meta.icon as React.ReactElement<{ className?: string }>,
            { className: "w-full h-full" },
          )}
        </span>
      </div>
      <div className="min-w-0" style={{ lineHeight: 1.4 }}>
        <h3
          className="zfm-display font-semibold text-stone-900 dark:text-stone-50"
          style={{ fontSize: 18, margin: 0, lineHeight: 1.3 }}
        >
          {option?.label || "Report"}
        </h3>
        <p
          className="text-stone-500 dark:text-stone-400"
          style={{ fontSize: 12.5, margin: "4px 0 0 0", lineHeight: 1.4 }}
        >
          {meta.description}
        </p>
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
      <div className="relative w-full h-2 rounded-full bg-[#F1ECE0] dark:bg-[#16231f] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-teal-500 transition-all duration-500 ease-out"
          style={{ width: `${paidPct}%` }}
        />
        {balance > 0 && (
          <div
            className="absolute inset-y-0 rounded-full bg-amber-400 transition-all duration-500 ease-out"
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
      className={`rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-gradient-to-br ${
        accent ||
        "from-[#F8F5EF] to-white dark:from-[#16231f]/60 dark:to-[#111d19]"
      } p-3.5`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-5 h-5 rounded-md bg-white dark:bg-[#1c2a25] flex items-center justify-center text-stone-500 dark:text-stone-400 shadow-sm">
          {icon}
        </div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
          {label}
        </span>
      </div>
      <div className="text-sm font-medium text-stone-700 dark:text-stone-200 pl-[26px] break-words">
        {value}
      </div>
    </div>
  );
}

// ============================================================
// EXPANDABLE ROW — generic accordion row
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
  forceOpen = false,
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
  // When true (export mode) the row always renders expanded and isn't
  // clickable — every section is fully visible in the exported PDF.
  forceOpen?: boolean;
}) {
  const open = forceOpen || isOpen;
  const Header = forceOpen ? "div" : "button";
  return (
    <div className="border-b border-[#EDE7DA] dark:border-[#1a2622] last:border-0">
      <Header
        onClick={forceOpen ? undefined : onToggle}
        className={`w-full text-left flex items-center gap-4 py-3.5 rounded-xl px-3 transition-colors ${
          forceOpen ? "" : "hover:bg-[#F8F5EF] dark:hover:bg-[#16231f]/60"
        }`}
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
        {!forceOpen && (
          <div
            className={`shrink-0 transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          >
            {open ? (
              <ChevronDown className="w-4 h-4 text-teal-500 dark:text-teal-400" />
            ) : (
              <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600" />
            )}
          </div>
        )}
      </Header>

      <div
        className={
          forceOpen
            ? "grid grid-rows-[1fr] opacity-100"
            : `grid transition-all duration-300 ease-in-out ${
                open
                  ? "grid-rows-[1fr] opacity-100"
                  : "grid-rows-[0fr] opacity-0"
              }`
        }
      >
        <div className="overflow-hidden">
          <div className="pt-2 pb-5 pl-13 ml-13 relative">
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-teal-200 dark:from-teal-900 to-transparent" />
            <div className="ml-9 rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613] p-5">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// BILL TABLE — outstanding / paid / upcoming, expandable
// ============================================================
function BillRowExpandable({
  bill,
  currency,
  isOpen,
  onToggle,
  forceOpen,
}: {
  bill: any;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
  forceOpen?: boolean;
}) {
  const supplierName = bill.supplierId?.name || "—";
  const balance = bill.amount - (bill.paidAmount || 0);

  return (
    <ExpandableRow
      isOpen={isOpen}
      onToggle={onToggle}
      forceOpen={forceOpen}
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
            accent="from-sky-50 to-white dark:from-sky-950/30 dark:to-[#111d19]"
          />
          <DetailField
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Due date"
            value={formatDate(bill.dueDate)}
            accent="from-rose-50 to-white dark:from-rose-950/30 dark:to-[#111d19]"
          />
          {bill.supplierInvoiceNumber && (
            <DetailField
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Supplier invoice #"
              value={
                <span className="font-mono">{bill.supplierInvoiceNumber}</span>
              }
              accent="from-violet-50 to-white dark:from-violet-950/30 dark:to-[#111d19]"
            />
          )}
          {bill.status && (
            <DetailField
              icon={<Info className="w-3.5 h-3.5" />}
              label="Status"
              value={<span className="capitalize">{bill.status}</span>}
              accent="from-amber-50 to-white dark:from-amber-950/30 dark:to-[#111d19]"
            />
          )}
        </div>
        {bill.notes && (
          <div className="rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] p-4">
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

function BillTable({
  rows,
  currency,
  exportMode,
}: {
  rows: any[];
  currency: string;
  exportMode?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622] px-2 py-1">
      {rows.map((b) => {
        const isOpen = expandedId === b._id;
        return (
          <BillRowExpandable
            key={b._id}
            bill={b}
            currency={currency}
            isOpen={isOpen}
            onToggle={() => setExpandedId(isOpen ? null : b._id)}
            forceOpen={exportMode}
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
  forceOpen,
}: {
  payment: any;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
  forceOpen?: boolean;
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
      forceOpen={forceOpen}
      icon={icon}
      iconBg={
        p.reversed
          ? "bg-[#F1ECE0] dark:bg-[#16231f]"
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
          <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-full shrink-0">
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
            accent="from-sky-50 to-white dark:from-sky-950/30 dark:to-[#111d19]"
          />
          <DetailField
            icon={icon}
            label="Method"
            value={<span className="capitalize">{methodLabel}</span>}
            accent="from-teal-50 to-white dark:from-teal-950/30 dark:to-[#111d19]"
          />
          {p.chequeNumber && (
            <DetailField
              icon={<FileText className="w-3.5 h-3.5" />}
              label="Cheque #"
              value={<span className="font-mono">{p.chequeNumber}</span>}
              accent="from-violet-50 to-white dark:from-violet-950/30 dark:to-[#111d19]"
            />
          )}
          {p.bankName && (
            <DetailField
              icon={<Landmark className="w-3.5 h-3.5" />}
              label="Bank"
              value={p.bankName}
              accent="from-indigo-50 to-white dark:from-indigo-950/30 dark:to-[#111d19]"
            />
          )}
          {p.reference && (
            <DetailField
              icon={<Info className="w-3.5 h-3.5" />}
              label="Reference"
              value={p.reference}
              accent="from-amber-50 to-white dark:from-amber-950/30 dark:to-[#111d19]"
            />
          )}
        </div>
        {p.reversed && (
          <div className="rounded-xl border border-rose-100 dark:border-rose-900/50 bg-rose-50/60 dark:bg-rose-950/20 p-4">
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
          <div className="rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] p-4">
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
  exportMode,
}: {
  rows: any[];
  currency: string;
  exportMode?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622] px-2 py-1">
      {rows.map((p) => {
        const isOpen = expandedId === p._id;
        return (
          <PaymentRowExpandable
            key={p._id}
            payment={p}
            currency={currency}
            isOpen={isOpen}
            onToggle={() => setExpandedId(isOpen ? null : p._id)}
            forceOpen={exportMode}
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
  forceOpen,
}: {
  row: any;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
  forceOpen?: boolean;
}) {
  const avg = row.billCount > 0 ? row.totalBilled / row.billCount : 0;
  return (
    <ExpandableRow
      isOpen={isOpen}
      onToggle={onToggle}
      forceOpen={forceOpen}
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
            accent="from-sky-50 to-white dark:from-sky-950/30 dark:to-[#111d19]"
          />
          <DetailField
            icon={<CheckCircle2 className="w-3.5 h-3.5" />}
            label="Total paid"
            value={formatMoney(row.totalPaid, currency)}
            accent="from-teal-50 to-white dark:from-teal-950/30 dark:to-[#111d19]"
          />
          <DetailField
            icon={<DollarSign className="w-3.5 h-3.5" />}
            label="Average bill"
            value={formatMoney(avg, currency)}
            accent="from-violet-50 to-white dark:from-violet-950/30 dark:to-[#111d19]"
          />
        </div>
      </div>
    </ExpandableRow>
  );
}

function SupplierTable({
  rows,
  currency,
  exportMode,
}: {
  rows: any[];
  currency: string;
  exportMode?: boolean;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (rows.length === 0) return <EmptyState />;
  return (
    <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622] px-2 py-1">
      {rows.map((s) => {
        const isOpen = expandedId === s.supplierId;
        return (
          <SupplierRowExpandable
            key={s.supplierId}
            row={s}
            currency={currency}
            isOpen={isOpen}
            onToggle={() => setExpandedId(isOpen ? null : s.supplierId)}
            forceOpen={exportMode}
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
  forceOpen,
}: {
  row: any;
  currency: string;
  totalAll: number;
  isOpen: boolean;
  onToggle: () => void;
  forceOpen?: boolean;
}) {
  const share = totalAll > 0 ? (row.totalSpent / totalAll) * 100 : 0;
  const avg = row.count > 0 ? row.totalSpent / row.count : 0;
  return (
    <ExpandableRow
      isOpen={isOpen}
      onToggle={onToggle}
      forceOpen={forceOpen}
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
          accent="from-amber-50 to-white dark:from-amber-950/30 dark:to-[#111d19]"
        />
        <DetailField
          icon={<Receipt className="w-3.5 h-3.5" />}
          label="Entries"
          value={row.count}
          accent="from-sky-50 to-white dark:from-sky-950/30 dark:to-[#111d19]"
        />
        <DetailField
          icon={<DollarSign className="w-3.5 h-3.5" />}
          label="Average per entry"
          value={formatMoney(avg, currency)}
          accent="from-teal-50 to-white dark:from-teal-950/30 dark:to-[#111d19]"
        />
      </div>
    </ExpandableRow>
  );
}

function ExpenseReport({
  rows,
  currency,
  exportMode,
}: {
  rows: any[];
  currency: string;
  exportMode?: boolean;
}) {
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
            <CartesianGrid stroke="#EDE7DA" vertical={false} />
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
      <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622] border-t border-[#EDE7DA] dark:border-[#1a2622] px-2 py-1">
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
              forceOpen={exportMode}
            />
          );
        })}
      </div>
    </>
  );
}

// ============================================================
// REPORT CARD — grid tile with View / Export actions
// ============================================================
function ReportCard({
  reportType,
  label,
  onView,
  onExport,
  exporting,
}: {
  reportType: ReportType;
  label: string;
  onView: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const meta = REPORT_META[reportType as string] || DEFAULT_META;
  return (
    <div className="bg-white dark:bg-[#111d19] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm p-5 flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-stone-400 dark:text-stone-500">
            {meta.icon}
          </span>
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-50">
            {label}
          </h3>
        </div>
        <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
          {meta.description}
        </p>
      </div>
      <div className="flex items-center gap-2.5 mt-auto">
        <button
          onClick={onView}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold py-2.5 transition-colors"
        >
          <Eye className="w-3.5 h-3.5" />
          View
        </button>
        <button
          onClick={onExport}
          disabled={exporting}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#E8E3D8] dark:border-[#1f2e29] text-stone-600 dark:text-stone-300 text-sm font-semibold py-2.5 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] transition-colors disabled:opacity-50 disabled:pointer-events-none"
        >
          {exporting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Download className="w-3.5 h-3.5" />
          )}
          Export
        </button>
      </div>
    </div>
  );
}

// ============================================================
// FILTER BAR — shared between the modal and the export sheet
// ============================================================
function ReportFilterBar({
  reportType,
  year,
  setYear,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
}: {
  reportType: ReportType;
  year: string;
  setYear: (v: string) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-5 sm:px-6 py-4 border-b border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613]">
      {reportType === "yearlySummary" ? (
        <>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center">
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
            className="text-sm rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] bg-white dark:bg-[#0d1613] px-4 py-2 w-28 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
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
            <div className="w-8 h-8 rounded-xl bg-sky-50 dark:bg-sky-950/40 flex items-center justify-center">
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
            className="text-sm rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] bg-white dark:bg-[#0d1613] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
          />
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center">
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
            className="text-sm rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] bg-white dark:bg-[#0d1613] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-stone-600 dark:text-stone-300 font-medium"
          />
        </>
      )}
    </div>
  );
}

// ============================================================
// VIEW MODAL — full report, opened from a card's "View" button
// ============================================================
function ReportViewModal({
  reportType,
  onClose,
  onExport,
  exporting,
  filterBar,
  children,
}: {
  reportType: ReportType;
  onClose: () => void;
  onExport: () => void;
  exporting: boolean;
  filterBar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        backgroundColor: "rgba(19,42,39,0.55)",
        backdropFilter: "blur(3px)",
      }}
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#111d19] rounded-3xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl border border-transparent dark:border-[#1f2e29] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <ReportCardHeader reportType={reportType} />
          </div>
          <div className="flex items-center gap-2.5 px-6 shrink-0">
            <button
              onClick={onExport}
              disabled={exporting}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E8E3D8] dark:border-[#1f2e29] text-stone-600 dark:text-stone-300 text-xs font-semibold px-4 py-2.5 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] transition-colors disabled:opacity-50"
            >
              {exporting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Export
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full flex items-center justify-center text-stone-400 dark:text-stone-500 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {filterBar}
        <div className="overflow-y-auto">{children}</div>
      </div>
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

  const [viewModal, setViewModal] = useState<ReportType | null>(null);
  const [pendingExport, setPendingExport] = useState<ReportType | null>(null);
  const [exporting, setExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  const renderBody = (exportMode = false) => {
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
        return (
          <ExpenseReport
            rows={result.data || []}
            currency={currency}
            exportMode={exportMode}
          />
        );

      case "outstandingBills":
      case "paidBills":
      case "upcomingBills":
        return (
          <BillTable
            rows={result.data || []}
            currency={currency}
            exportMode={exportMode}
          />
        );

      case "paymentHistory":
        return (
          <PaymentHistoryTable
            rows={result.data || []}
            currency={currency}
            exportMode={exportMode}
          />
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
                    <CartesianGrid stroke="#EDE7DA" vertical={false} />
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
                    className="flex items-center justify-between rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-[#FBF9F4] dark:bg-[#0d1613] px-3.5 py-2.5"
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
        return (
          <SupplierTable
            rows={result.data || []}
            currency={currency}
            exportMode={exportMode}
          />
        );

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
                <CartesianGrid stroke="#EDE7DA" vertical={false} />
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

  // ------------------------------------------------------------
  // EXPORT — renders the report off-screen, rasterizes it with
  // html2canvas, and drops it into a jsPDF document that gets
  // saved to the user's downloads. Requires `html2canvas` and
  // `jspdf` to be installed in the project.
  // ------------------------------------------------------------
  useEffect(() => {
    if (
      pendingExport &&
      reportType === pendingExport &&
      !loading &&
      result &&
      !exporting
    ) {
      void runExport(pendingExport);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingExport, reportType, loading, result]);

  const runExport = async (type: ReportType) => {
    setExporting(true);
    try {
      const node = exportRef.current;
      if (!node) return;

      // Wait for the custom webfonts (Fraunces/Manrope) to finish loading —
      // capturing before they swap in is what causes the header text to
      // overlap the icon, since the fallback font has different metrics.
      if (typeof document !== "undefined" && (document as any).fonts?.ready) {
        try {
          await (document as any).fonts.ready;
        } catch {
          // ignore — fall through to the fixed delay below
        }
      }
      // Extra settle time for recharts to measure + paint every chart
      // inside the off-screen container before we rasterize it.
      await new Promise((resolve) => setTimeout(resolve, 500));

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      // Note: html2canvas's `foreignObjectRendering: true` mode (which
      // renders through an SVG <foreignObject> for correct RTL/ligature
      // text shaping) was tried here but produces a *blank* canvas in
      // this app — likely because the external Google Fonts @import in
      // the page <style> tag gets silently dropped/blocked inside the
      // foreignObject instead of throwing an error we could catch. A
      // blank export is worse than a slightly imperfect Arabic currency
      // symbol, so we use the default (manual glyph) renderer here.
      const canvas = await html2canvas(node, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "pt",
        format: "a4",
      });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      const option = REPORT_OPTIONS.find((r) => r.value === type);
      const filename = `${(option?.label || "report")
        .toLowerCase()
        .replace(
          /[^a-z0-9]+/g,
          "-",
        )}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error("Failed to export report PDF:", err);
    } finally {
      setExporting(false);
      setPendingExport(null);
    }
  };

  const handleView = (type: ReportType) => {
    setReportType(type);
    setViewModal(type);
  };

  const handleExport = (type: ReportType) => {
    setReportType(type);
    setPendingExport(type);
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

  const filterBarNode = (
    <ReportFilterBar
      reportType={reportType}
      year={year}
      setYear={setYear}
      startDate={startDate}
      setStartDate={setStartDate}
      endDate={endDate}
      setEndDate={setEndDate}
    />
  );

  return (
    <div className="space-y-7">
      <div>
        <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
          Reports
        </h2>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
          Quick access to Finance Manager's standard reports.
        </p>
      </div>

      {/* Report card grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {REPORT_OPTIONS.map((r) => (
          <ReportCard
            key={r.value}
            reportType={r.value}
            label={r.label}
            onView={() => handleView(r.value)}
            onExport={() => handleExport(r.value)}
            exporting={exporting && pendingExport === r.value}
          />
        ))}
      </div>

      {/* View modal — opened from a card's "View" button */}
      {viewModal && (
        <ReportViewModal
          reportType={viewModal}
          onClose={() => setViewModal(null)}
          onExport={() => handleExport(viewModal)}
          exporting={exporting && pendingExport === viewModal}
          filterBar={filterBarNode}
        >
          {renderBody()}
        </ReportViewModal>
      )}

      {/* Off-screen export sheet — rasterized to PDF, never shown to the user */}
      {(pendingExport || exporting) && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: "-10000px",
            width: 860,
            pointerEvents: "none",
          }}
          aria-hidden
        >
          <div ref={exportRef} className="bg-white" style={{ width: 860 }}>
            <ReportCardHeader reportType={reportType} />
            <div className="bg-white">{renderBody(true)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReportsTab;

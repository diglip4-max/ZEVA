import React, { useState } from "react";
import {
  Loader2,
  Inbox,
  Receipt,
  DollarSign,
  FileCheck2,
  CheckCircle2,
  Clock,
  Banknote,
  Landmark,
  CreditCard,
  Globe,
  Wallet,
  Building2,
  Phone,
  Mail,
  ChevronRight,
  ChevronDown,
  CalendarClock,
  TrendingUp,
  FileText,
  User,
} from "lucide-react";
import useSupplierLedger, {
  LedgerBill,
  LedgerPayment,
  LedgerCheque,
} from "../_hooks/useSupplierLedger";
import useSuppliers from "@/hooks/useSuppliers";
import useClinic from "@/hooks/useClinic";
import StatCard from "./StatCard";
import SearchableSelect from "@/components/shared/SearchableSelect";
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

// ============================================================
// STATUS META — shared across bills/payments/cheques rows
// ============================================================
const BILL_STATUS_META: Record<
  string,
  { text: string; bg: string; dot: string }
> = {
  draft: {
    text: "text-stone-600 dark:text-stone-300",
    bg: "bg-stone-100 dark:bg-stone-800",
    dot: "bg-stone-400",
  },
  pending: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950",
    dot: "bg-amber-500",
  },
  upcoming: {
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950",
    dot: "bg-sky-500",
  },
  partial: {
    text: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-50 dark:bg-violet-950",
    dot: "bg-violet-500",
  },
  paid: {
    text: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950",
    dot: "bg-teal-500",
  },
  overdue: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950",
    dot: "bg-rose-500",
  },
  cancelled: {
    text: "text-stone-400 dark:text-stone-500",
    bg: "bg-stone-100 dark:bg-stone-800",
    dot: "bg-stone-300",
  },
  issued: {
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950",
    dot: "bg-sky-500",
  },
  presented: {
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950",
    dot: "bg-amber-500",
  },
  cleared: {
    text: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950",
    dot: "bg-teal-500",
  },
  returned: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950",
    dot: "bg-rose-500",
  },
  bounced: {
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950",
    dot: "bg-rose-500",
  },
};

function StatusDot({ status }: { status: string }) {
  const s = BILL_STATUS_META[status] || BILL_STATUS_META.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const METHOD_ICON: Record<string, React.ElementType> = {
  cash: Banknote,
  bank_transfer: Landmark,
  cheque: FileCheck2,
  card: CreditCard,
  online: Globe,
  petty_cash: Wallet,
};

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  bank_transfer: "Bank Transfer",
  cheque: "Cheque",
  card: "Card",
  online: "Online",
  petty_cash: "Petty Cash",
};

function InfoCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value?: React.ReactNode;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div
      className={`rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br ${accent} p-3.5`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="w-5 h-5 rounded-md bg-white/80 dark:bg-stone-900/60 flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <div className="pl-[26px] text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
        {value || <span className="text-stone-300 dark:text-stone-600">—</span>}
      </div>
    </div>
  );
}

// ============================================================
// BILL DETAILS + ROW — violet/teal theme (bills)
// ============================================================
function BillDetailsView({
  bill,
  currency,
}: {
  bill: LedgerBill;
  currency: string;
}) {
  const paidPct = bill.amount > 0 ? (bill.paidAmount / bill.amount) * 100 : 0;
  const balancePct = bill.amount > 0 ? (bill.balance / bill.amount) * 100 : 0;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Settlement progress
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            <span className="text-teal-600 dark:text-teal-400">
              {formatMoney(bill.paidAmount, currency)} paid
            </span>
            <span className="text-stone-300 dark:text-stone-600">of</span>
            <span className="text-stone-700 dark:text-stone-200">
              {formatMoney(bill.amount, currency)}
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
          {bill.balance > 0 && (
            <div
              className="absolute inset-y-0 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-500 ease-out"
              style={{
                left: `${paidPct}%`,
                width: `${balancePct}%`,
              }}
            />
          )}
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
            <CheckCircle2 className="w-3 h-3" />
            {paidPct.toFixed(1)}% settled
          </span>
          {bill.balance > 0 && (
            <span className="text-orange-500 dark:text-orange-400">
              {balancePct.toFixed(1)}% due
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard
          label="Invoice #"
          value={<span className="font-mono">{bill.invoiceNumber}</span>}
          icon={
            <Receipt className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          }
          accent="from-violet-50 to-white dark:from-violet-950/40"
        />
        <InfoCard
          label="Category"
          value={bill.category}
          icon={
            <TrendingUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
          }
          accent="from-amber-50 to-white dark:from-amber-950/40"
        />
        <InfoCard
          label="Due date"
          value={formatDate(bill.dueDate)}
          icon={
            <CalendarClock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
          }
          accent="from-rose-50 to-white dark:from-rose-950/40"
        />
        <InfoCard
          label="Status"
          value={<span className="capitalize">{bill.status || "—"}</span>}
          icon={
            <Clock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          }
          accent="from-sky-50 to-white dark:from-sky-950/40"
        />
      </div>
    </div>
  );
}

function BillRow({
  bill,
  currency,
  isOpen,
  onToggle,
}: {
  bill: LedgerBill;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
          <Receipt className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
            {bill.category}
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span className="font-mono">{bill.invoiceNumber}</span>
            <span>·</span>
            <span>Due {formatDate(bill.dueDate)}</span>
          </div>
        </div>
        <StatusDot status={bill.status} />
        <div className="text-right shrink-0 min-w-[108px]">
          <div className="font-mono font-semibold text-stone-800 dark:text-stone-100 text-sm">
            {formatMoney(bill.amount, currency)}
          </div>
          {bill.balance > 0 ? (
            <div className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 zfm-mono">
              {formatMoney(bill.balance, currency)} due
            </div>
          ) : (
            <div className="text-[10px] text-teal-600 dark:text-teal-400 zfm-mono font-semibold">
              Fully paid
            </div>
          )}
        </div>
        <div
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-violet-500 dark:text-violet-400" />
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
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-violet-200 dark:from-violet-900 to-transparent" />
            <div className="ml-9 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-5">
              <BillDetailsView bill={bill} currency={currency} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAYMENT DETAILS + ROW — emerald/teal theme (payments)
// ============================================================
function PaymentDetailsView({
  payment,
  currency,
}: {
  payment: LedgerPayment;
  currency: string;
}) {
  const invoiceNumber =
    typeof payment.transactionId === "string"
      ? payment.transactionId
      : payment.transactionId?.invoiceNumber;
  const invoiceCategory =
    typeof payment.transactionId === "string"
      ? null
      : payment.transactionId?.category || null;
  const Icon = METHOD_ICON[payment.method] || Banknote;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Payment status
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            {payment.reversed ? (
              <span className="text-rose-500 dark:text-rose-400 inline-flex items-center gap-1">
                {formatMoney(payment.amount, currency)} reversed
              </span>
            ) : (
              <span className="text-teal-600 dark:text-teal-400 inline-flex items-center gap-1">
                {formatMoney(payment.amount, currency)} settled
              </span>
            )}
          </div>
        </div>
        <div className="relative w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
              payment.reversed ? "" : ""
            }`}
            style={{
              width: "100%",
              backgroundImage: payment.reversed
                ? "linear-gradient(90deg, #f43f5e, #ef4444, #dc2626)"
                : "linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf)",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span
            className={`inline-flex items-center gap-1 ${
              payment.reversed
                ? "text-rose-500 dark:text-rose-400"
                : "text-teal-600 dark:text-teal-400"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            {payment.reversed ? "Reversed" : "Paid in full"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard
          label="Payment #"
          value={<span className="font-mono">{payment.paymentNumber}</span>}
          icon={
            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          }
          accent="from-emerald-50 to-white dark:from-emerald-950/40"
        />
        <InfoCard
          label="Date"
          value={formatDate(payment.date)}
          icon={
            <CalendarClock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          }
          accent="from-sky-50 to-white dark:from-sky-950/40"
        />
        <InfoCard
          label="Method"
          value={METHOD_LABEL[payment.method] || payment.method}
          icon={
            <Icon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          }
          accent="from-teal-50 to-white dark:from-teal-950/40"
        />
        <InfoCard
          label="Linked invoice"
          value={
            invoiceNumber ? (
              <div className="truncate">
                <span className="font-mono">{invoiceNumber}</span>
                {invoiceCategory && (
                  <span className="text-[11px] text-stone-400 dark:text-stone-500 ml-2">
                    · {invoiceCategory}
                  </span>
                )}
              </div>
            ) : null
          }
          icon={
            <FileText className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          }
          accent="from-violet-50 to-white dark:from-violet-950/40"
        />
      </div>
    </div>
  );
}

function PaymentRow({
  payment,
  currency,
  isOpen,
  onToggle,
}: {
  payment: LedgerPayment;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const Icon = METHOD_ICON[payment.method] || Banknote;
  const invoiceNumber =
    typeof payment.transactionId === "string"
      ? payment.transactionId
      : payment.transactionId?.invoiceNumber;

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-3 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            payment.reversed
              ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
              : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate flex items-center gap-2">
            <span className="zfm-mono">{payment.paymentNumber}</span>
            {payment.reversed && (
              <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full">
                Reversed
              </span>
            )}
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            {invoiceNumber && (
              <>
                <span>→</span>
                <span className="zfm-mono">{invoiceNumber}</span>
                <span>·</span>
              </>
            )}
            <span>{formatDate(payment.date)}</span>
            <span>·</span>
            <span>{METHOD_LABEL[payment.method] || payment.method}</span>
          </div>
        </div>
        <span
          className={`font-mono text-sm font-semibold shrink-0 text-right min-w-[108px] ${
            payment.reversed
              ? "text-stone-400 dark:text-stone-500 line-through"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {formatMoney(payment.amount, currency)}
        </span>
        <div
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          {isOpen ? (
            <ChevronDown
              className={`w-4 h-4 ${
                payment.reversed
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-emerald-500 dark:text-emerald-400"
              }`}
            />
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
            <div
              className={`absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b to-transparent ${
                payment.reversed
                  ? "from-rose-200 dark:from-rose-900"
                  : "from-emerald-200 dark:from-emerald-900"
              }`}
            />
            <div className="ml-9 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-5">
              <PaymentDetailsView payment={payment} currency={currency} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CHEQUE DETAILS + ROW — indigo/blue theme (cheques)
// ============================================================
function ChequeDetailsView({
  cheque,
  currency,
}: {
  cheque: LedgerCheque;
  currency: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Cheque status
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            <span className="text-indigo-600 dark:text-indigo-400">
              {formatMoney(cheque.amount, currency)}
            </span>
            <StatusDot status={cheque.status} />
          </div>
        </div>
        <div className="relative w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            style={{
              width: "100%",
              backgroundImage:
                cheque.status === "cleared"
                  ? "linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf)"
                  : cheque.status === "bounced" || cheque.status === "returned"
                    ? "linear-gradient(90deg, #f43f5e, #ef4444, #dc2626)"
                    : "linear-gradient(90deg, #6366f1, #818cf8, #6366f1)",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
            <CheckCircle2 className="w-3 h-3" />
            {cheque.status
              ? cheque.status.charAt(0).toUpperCase() + cheque.status.slice(1)
              : "—"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoCard
          label="Cheque #"
          value={<span className="font-mono">#{cheque.chequeNumber}</span>}
          icon={
            <FileCheck2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          }
          accent="from-indigo-50 to-white dark:from-indigo-950/40"
        />
        <InfoCard
          label="Cheque date"
          value={formatDate(cheque.chequeDate)}
          icon={
            <CalendarClock className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
          }
          accent="from-sky-50 to-white dark:from-sky-950/40"
        />
        <InfoCard
          label="Bank"
          value={cheque.bank}
          icon={
            <Landmark className="w-3.5 h-3.5 text-stone-600 dark:text-stone-400" />
          }
          accent="from-stone-50 to-white dark:from-stone-800/40"
        />
        <InfoCard
          label="Payee"
          value={cheque.payee}
          icon={
            <User className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
          }
          accent="from-violet-50 to-white dark:from-violet-950/40"
        />
      </div>
    </div>
  );
}

function ChequeRow({
  cheque,
  currency,
  isOpen,
  onToggle,
}: {
  cheque: LedgerCheque;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const themeBadge =
    cheque.status === "cleared"
      ? "bg-teal-50 dark:bg-teal-950/50 text-teal-600 dark:text-teal-400"
      : cheque.status === "bounced" || cheque.status === "returned"
        ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
        : "bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400";
  const themeChevron =
    cheque.status === "cleared"
      ? "text-teal-500 dark:text-teal-400"
      : cheque.status === "bounced" || cheque.status === "returned"
        ? "text-rose-500 dark:text-rose-400"
        : "text-indigo-500 dark:text-indigo-400";
  const themeConnector =
    cheque.status === "cleared"
      ? "from-teal-200 dark:from-teal-900"
      : cheque.status === "bounced" || cheque.status === "returned"
        ? "from-rose-200 dark:from-rose-900"
        : "from-indigo-200 dark:from-indigo-900";

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-3 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${themeBadge}`}
        >
          <FileCheck2 className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
            <span className="zfm-mono">#{cheque.chequeNumber}</span>
            <span className="ml-2 text-xs text-stone-400 dark:text-stone-500 font-medium">
              {cheque.bank}
            </span>
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span>{formatDate(cheque.chequeDate)}</span>
            <span>·</span>
            <span>Payable to {cheque.payee}</span>
          </div>
        </div>
        <StatusDot status={cheque.status} />
        <div className="text-right shrink-0 min-w-[108px]">
          <div className="font-mono font-semibold text-stone-800 dark:text-stone-100 text-sm">
            {formatMoney(cheque.amount, currency)}
          </div>
        </div>
        <div
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          {isOpen ? (
            <ChevronDown className={`w-4 h-4 ${themeChevron}`} />
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
            <div
              className={`absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b to-transparent ${themeConnector}`}
            />
            <div className="ml-9 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-5">
              <ChequeDetailsView cheque={cheque} currency={currency} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUPPLIER PICKER
// ============================================================
function SupplierPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const { clinic } = useClinic();
  const [search, setSearch] = useState("");
  const { suppliers, loading } = useSuppliers({
    branchId: clinic?._id || "",
    search,
  }) as {
    suppliers: {
      _id: string;
      name: string;
      code: string;
      mobile?: string;
      telephone?: string;
      totalBalance?: number;
    }[];
    loading: boolean;
  };

  const options = suppliers.map((s) => ({
    value: s._id,
    label: s.name,
    sublabel: [
      s.code,
      s.mobile || s.telephone,
      s.totalBalance ? `Balance ${formatMoney(s.totalBalance, "INR")}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  return (
    <div className="max-w-md">
      <SearchableSelect
        label="Supplier"
        icon={<Building2 className="w-3.5 h-3.5 text-stone-400" />}
        options={options}
        value={value}
        onChange={onChange}
        onSearchChange={setSearch}
        loading={loading}
        placeholder="Search and choose a supplier"
        searchPlaceholder="Search by name, code, phone…"
        emptyText="No suppliers found"
      />
    </div>
  );
}

// ============================================================
// MAIN TAB
// ============================================================
const SupplierLedgerTab: React.FC<UseFinancePermissionReturn> = ({
  // permissions,
  permissionsLoaded,
  AccessDenied,
  PermissionLoading,
  canAccessPage,
}) => {
  const { currency } = useCurrency();
  const [supplierId, setSupplierId] = useState<string>("");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const { supplier, bills, payments, cheques, summary, loading, error } =
    useSupplierLedger(supplierId || null);

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
          Vendor History
        </h2>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
          Every bill, payment, and cheque for a single supplier — in one place
        </p>
      </div>

      <SupplierPicker value={supplierId} onChange={setSupplierId} />

      {!supplierId && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm px-5 py-16 text-center text-stone-400 dark:text-stone-500">
          <Building2 className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
          <span className="text-sm">
            Choose a supplier above to see their full ledger.
          </span>
        </div>
      )}

      {supplierId && loading && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm px-5 py-16 text-center text-stone-400 dark:text-stone-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600 dark:text-teal-400" />
          <span className="text-sm">Loading ledger…</span>
        </div>
      )}

      {supplierId && !loading && error && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm px-5 py-16 text-center text-rose-500 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {supplierId && !loading && !error && supplier && (
        <>
          {/* Supplier header card */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0"
                style={{
                  backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
                }}
              >
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
                  {supplier.name}
                </div>
                <div className="flex items-center gap-3 text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                  <span className="zfm-mono">{supplier.code}</span>
                  {(supplier.mobile || supplier.telephone) && (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="w-3 h-3" />{" "}
                      {supplier.mobile || supplier.telephone}
                    </span>
                  )}
                  {supplier.email && (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="w-3 h-3" /> {supplier.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {supplier.creditDays !== undefined && (
              <div className="text-right">
                <div className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wide">
                  Credit Days
                </div>
                <div className="zfm-mono text-lg font-semibold text-stone-800 dark:text-stone-100">
                  {supplier.creditDays}
                </div>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Total Billed"
              value={formatMoney(summary.totalBilled, currency)}
              icon={<Receipt />}
              fromColor="#7c3aed"
              toColor="#8b5cf6"
              iconColor="text-white"
              trend={`${summary.billCount} bills`}
              trendPositive={true}
            />
            <StatCard
              label="Total Paid"
              value={formatMoney(summary.totalPaid, currency)}
              icon={<CheckCircle2 />}
              fromColor="#0d9488"
              toColor="#14b8a6"
              iconColor="text-white"
              trend={`${summary.totalPayments} payments`}
              trendPositive={true}
            />
            <StatCard
              label="Balance Due"
              value={formatMoney(summary.totalBalance, currency)}
              icon={<Clock />}
              fromColor="#d97706"
              toColor="#f59e0b"
              iconColor="text-white"
              trend={`${summary.overdueCount} overdue`}
              trendPositive={summary.overdueCount === 0}
            />
            <StatCard
              label="Cheques"
              value={summary.totalCheques}
              icon={<FileCheck2 />}
              fromColor="#4f46e5"
              toColor="#6366f1"
              iconColor="text-white"
              trend={
                summary.bouncedCheques > 0
                  ? `${summary.bouncedCheques} bounced`
                  : `${summary.pendingCheques} pending`
              }
              trendPositive={summary.bouncedCheques === 0}
            />
          </div>

          {/* Bills */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-2">
              <Receipt className="w-4 h-4 text-stone-400 dark:text-stone-500" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
                Bills
              </h3>
            </div>
            {bills.length === 0 ? (
              <div className="px-5 py-10 text-center text-stone-400 dark:text-stone-500 text-sm">
                <Inbox className="w-5 h-5 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                No bills yet
              </div>
            ) : (
              <div>
                {bills.map((b) => (
                  <BillRow
                    key={b._id}
                    bill={b}
                    currency={currency}
                    isOpen={expandedRowId === b._id}
                    onToggle={() =>
                      setExpandedRowId(expandedRowId === b._id ? null : b._id)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Payments */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-stone-400 dark:text-stone-500" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
                Payments
              </h3>
            </div>
            {payments.length === 0 ? (
              <div className="px-5 py-10 text-center text-stone-400 dark:text-stone-500 text-sm">
                <Inbox className="w-5 h-5 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                No payments yet
              </div>
            ) : (
              <div>
                {payments.map((p) => (
                  <PaymentRow
                    key={p._id}
                    payment={p}
                    currency={currency}
                    isOpen={expandedRowId === p._id}
                    onToggle={() =>
                      setExpandedRowId(expandedRowId === p._id ? null : p._id)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Cheques */}
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-100 dark:border-stone-800 flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-stone-400 dark:text-stone-500" />
              <h3 className="text-sm font-bold text-stone-700 dark:text-stone-200">
                Cheques
              </h3>
            </div>
            {cheques.length === 0 ? (
              <div className="px-5 py-10 text-center text-stone-400 dark:text-stone-500 text-sm">
                <Inbox className="w-5 h-5 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                No cheques yet
              </div>
            ) : (
              <div>
                {cheques.map((c) => (
                  <ChequeRow
                    key={c._id}
                    cheque={c}
                    currency={currency}
                    isOpen={expandedRowId === c._id}
                    onToggle={() =>
                      setExpandedRowId(expandedRowId === c._id ? null : c._id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierLedgerTab;

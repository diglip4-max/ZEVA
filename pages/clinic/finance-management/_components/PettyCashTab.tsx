import React, { useState, useRef } from "react";
import axios from "axios";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Inbox,
  Paperclip,
  Image as ImageIcon,
  Users,
  DollarSign,
  TrendingDown,
  Wallet,
  PieChart,
  CreditCard,
  Receipt,
  Coins,
  Plus,
  X,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  FileText,
  Building2,
  Tag,
  Trash2,
  Upload,
  CalendarClock,
  Clock,
  File,
  Info,
} from "lucide-react";
import { getTokenByPath, handleUpload } from "@/lib/helper";
import usePettyCash, {
  AllocationData,
  ExpenseData,
  CashIncomeData,
} from "../_hooks/usePettyCash";
import useManualPettyCash, {
  ManualPettyCashItem,
} from "../_hooks/useManualPettyCash";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney, getCurrencySymbol } from "@/lib/currencyHelper";
import SearchableSelect from "@/components/shared/SearchableSelect";
import useSuppliers from "@/hooks/useSuppliers";
import useClinic from "@/hooks/useClinic";
import { UseFinancePermissionReturn } from "../_hooks/useFinancePermission";

const formatDate = (d?: string): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatDateTime = (d?: string): string =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const getStaffName = (staff: any): string => {
  if (!staff) return "Global Pool";
  if (typeof staff === "string") return `Staff #${staff.slice(-6)}`;
  return staff.name || staff.email || `Staff #${staff._id?.slice(-6)}`;
};

const getAddedByLabel = (item: ManualPettyCashItem): string => {
  if (!item.addedBy) return "Unknown User";
  if (typeof item.addedBy === "string")
    return `User #${item.addedBy.slice(-6)}`;
  const user = item.addedBy;
  return user.name || user.email || `User #${user._id.slice(-6)}`;
};

const getVendorLabel = (item: ManualPettyCashItem): string => {
  if (item.vendorName) return item.vendorName;
  if (!item.vendorId) return "—";
  if (typeof item.vendorId === "string")
    return `Vendor #${item.vendorId.slice(-6)}`;
  return item.vendorId.name || `Vendor #${item.vendorId._id.slice(-6)}`;
};

const getManualType = (item: ManualPettyCashItem): "Income" | "Expense" =>
  item.isExpense ? "Expense" : "Income";

type TabType = "all" | "allocations" | "expenses" | "income" | "manual";
type ManualTypeFilter = "all" | "Income" | "Expense";

const TABS: { value: TabType; label: string; icon: React.ReactNode }[] = [
  {
    value: "all",
    label: "All Activity",
    icon: <PieChart className="w-4 h-4" />,
  },
  // {
  //   value: "allocations",
  //   label: "Allocations",
  //   icon: <ArrowUpRight className="w-4 h-4" />,
  // },
  {
    value: "expenses",
    label: "Expenses",
    icon: <ArrowDownRight className="w-4 h-4" />,
  },
  {
    value: "income",
    label: "Cash Income",
    icon: <Coins className="w-4 h-4" />,
  },
  {
    value: "manual",
    label: "Manual Petty Cash",
    icon: <Building2 className="w-4 h-4" />,
  },
];

// ============================================================
// RECEIPT / IMAGE LINKS COMPONENT
// ============================================================
function AttachmentLinks({
  urls,
  emptyLabel,
  icon,
}: {
  urls: string[];
  emptyLabel: string;
  icon: React.ReactNode;
}) {
  if (!urls || urls.length === 0) {
    return (
      <span className="text-[11px] text-stone-300 dark:text-stone-600">
        {emptyLabel}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {icon}
      {urls.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
        >
          #{i + 1}
        </a>
      ))}
    </div>
  );
}

function ReceiptLinks({ receipts }: { receipts: string[] }) {
  return (
    <AttachmentLinks
      urls={receipts}
      emptyLabel="No receipts"
      icon={
        <Paperclip className="w-3 h-3 text-stone-400 dark:text-stone-500" />
      }
    />
  );
}

function ImageLinks({ images }: { images: string[] }) {
  return (
    <AttachmentLinks
      urls={images}
      emptyLabel="No images"
      icon={
        <ImageIcon className="w-3 h-3 text-stone-400 dark:text-stone-500" />
      }
    />
  );
}

function TypePill({ type }: { type: "Income" | "Expense" }) {
  const map: Record<
    "Income" | "Expense",
    { dot: string; text: string; bg: string }
  > = {
    Income: {
      dot: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/50",
    },
    Expense: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/50",
    },
  };
  const s = map[type];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {type}
    </span>
  );
}

// ============================================================
// SHARED: Attachment grid (reusable for all 4 row types)
// ============================================================
function AttachmentsGrid({ urls }: { urls: string[] }) {
  if (!urls || urls.length === 0) return null;
  return (
    <div className="rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
          <Paperclip className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
          Attachments · {urls.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {urls.map((url, i) => {
          const isImg =
            /\.(png|jpe?g|gif|webp|bmp)$/i.test(url) ||
            url.startsWith("data:image");
          const fname =
            url.split("/").pop()?.slice(0, 40) || `Attachment ${i + 1}`;
          return (
            <a
              key={i}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-2 rounded-lg border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-[#F8F5EF] dark:bg-[#16231f]/60 hover:bg-white dark:hover:bg-[#16231f] p-2.5 transition-colors"
            >
              <div className="w-9 h-9 rounded-md bg-white dark:bg-[#111d19] flex items-center justify-center shrink-0 border border-[#EDE7DA] dark:border-[#1f2e29]/60 overflow-hidden">
                {isImg ? (
                  <img
                    src={url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <File className="w-4 h-4 text-stone-400" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-stone-700 dark:text-stone-200 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400">
                  #{i + 1}
                </div>
                <div className="text-[10px] text-stone-400 dark:text-stone-500 truncate">
                  {fname}
                </div>
              </div>
              <ChevronRight className="w-3 h-3 text-stone-300 dark:text-stone-600 shrink-0 group-hover:text-teal-500 transition-colors" />
            </a>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// SHARED: Info field card
// ============================================================
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
      className={`rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-gradient-to-br ${accent} p-3.5`}
    >
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className="w-5 h-5 rounded-md bg-white dark:bg-[#1c2a25] flex items-center justify-center text-stone-500 dark:text-stone-400 shadow-sm">
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
// SHARED: Void info block (allocations + expenses have void)
// ============================================================
function VoidBlock({
  reason,
  by,
  at,
}: {
  reason?: string;
  by?: any;
  at?: string;
}) {
  if (!reason) return null;
  const byLabel = !by
    ? "Unknown"
    : typeof by === "string"
      ? by?.slice(-6)
      : by?.name || by?.email;
  return (
    <div className="rounded-xl border border-rose-100 dark:border-rose-900/40 bg-gradient-to-br from-rose-50 to-white dark:from-rose-950/40 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/50 flex items-center justify-center">
          <X className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
          Voided
        </span>
      </div>
      <div className="space-y-1.5 pl-[32px] text-sm">
        <div>
          <span className="text-stone-400 dark:text-stone-500 text-xs">
            Reason:{" "}
          </span>
          <span className="text-stone-700 dark:text-stone-200">{reason}</span>
        </div>
        {byLabel && (
          <div>
            <span className="text-stone-400 dark:text-stone-500 text-xs">
              By:{" "}
            </span>
            <span className="text-stone-700 dark:text-stone-200">
              {byLabel}
            </span>
          </div>
        )}
        {at && (
          <div>
            <span className="text-stone-400 dark:text-stone-500 text-xs">
              At:{" "}
            </span>
            <span className="text-stone-700 dark:text-stone-200">
              {formatDateTime(at)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// ALLOCATION ROW + DETAILS
// ============================================================
function AllocationDetailsView({
  allocation,
  currency,
}: {
  allocation: AllocationData;
  currency: string;
}) {
  const pettyCash = allocation.pettyCashId as any;
  const fields = [
    {
      label: "Staff",
      value: getStaffName(allocation.staffId),
      icon: <Users className="w-3.5 h-3.5" />,
      accent: "from-sky-50 to-white dark:from-sky-950/40",
    },
    {
      label: "Allocation date",
      value: formatDate(allocation.date),
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      accent: "from-violet-50 to-white dark:from-violet-950/40",
    },
    {
      label: "Allocated by",
      value: allocation.createdBy?.name || "Unknown",
      icon: <CreditCard className="w-3.5 h-3.5" />,
      accent: "from-amber-50 to-white dark:from-amber-950/40",
    },
    {
      label: "Petty Cash ID",
      value: (
        <span className="font-mono">
          {allocation.pettyCashId?._id?.slice(-8) || "N/A"}
        </span>
      ),
      icon: <Wallet className="w-3.5 h-3.5" />,
      accent: "from-teal-50 to-white dark:from-teal-950/40",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Allocation
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            <span className="text-teal-600 dark:text-teal-400">
              +{formatMoney(allocation.amount, currency)} allocated
            </span>
            {allocation.isVoided && (
              <span className="text-rose-500 line-through opacity-70">
                Voided
              </span>
            )}
          </div>
        </div>
        <div className="relative w-full h-2 rounded-full bg-[#F1ECE0] dark:bg-[#16231f] overflow-hidden">
          <div
            className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out ${
              allocation.isVoided ? "bg-stone-300 dark:bg-stone-600" : ""
            }`}
            style={{
              width: "100%",
              backgroundImage: allocation.isVoided
                ? undefined
                : "linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf)",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          {pettyCash?.patient?.name || pettyCash?.note ? (
            <span className="text-stone-500 dark:text-stone-400">
              For: {pettyCash.patient?.name || pettyCash.note}
            </span>
          ) : (
            <span />
          )}
          <span
            className={`inline-flex items-center gap-1 ${
              allocation.isVoided
                ? "text-stone-400 dark:text-stone-500"
                : "text-teal-600 dark:text-teal-400"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            {allocation.isVoided ? "Voided" : "Active allocation"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <InfoCard
            key={f.label}
            label={f.label}
            value={f.value}
            icon={f.icon}
            accent={f.accent}
          />
        ))}
        <div className="sm:col-span-2">
          <InfoCard
            label="Recorded at"
            value={formatDateTime(allocation.createdAt)}
            icon={<Clock className="w-3.5 h-3.5" />}
            accent="from-[#F8F5EF] to-white dark:from-[#16231f]/60 dark:to-[#111d19]"
          />
        </div>
      </div>

      <AttachmentsGrid urls={allocation.receipts || []} />

      {allocation.isVoided && (
        <VoidBlock
          reason={allocation.voidReason}
          by={allocation.voidedBy}
          at={allocation.voidedAt}
        />
      )}
    </div>
  );
}

function AllocationRow({
  allocation,
  currency,
  isOpen,
  onToggle,
}: {
  allocation: AllocationData;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const pettyCash = allocation.pettyCashId as any;
  return (
    <div className="border-b border-[#EDE7DA] dark:border-[#1a2622] last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f]/60 rounded-xl px-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
          <ArrowUpRight className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
            {getStaffName(allocation.staffId)}
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            {pettyCash?.patient?.name || pettyCash?.note ? (
              <>
                <span>{pettyCash.patient?.name || pettyCash.note}</span>
                <span>·</span>
              </>
            ) : null}
            <span>{formatDate(allocation.date)}</span>
            <span>·</span>
            <span>By: {allocation.createdBy?.name || "Unknown"}</span>
            {allocation.isVoided && (
              <span className="text-rose-500 dark:text-rose-400 font-semibold">
                (Voided)
              </span>
            )}
          </div>
        </div>
        <ReceiptLinks receipts={allocation.receipts || []} />
        <div className="text-right shrink-0 min-w-[108px]">
          <div
            className={`font-mono font-semibold text-sm ${
              allocation.isVoided
                ? "text-stone-400 dark:text-stone-500 line-through"
                : "text-teal-600 dark:text-teal-400"
            }`}
          >
            +{formatMoney(allocation.amount, currency)}
          </div>
          <div
            className={`text-[10px] zfm-mono font-semibold ${
              allocation.isVoided
                ? "text-stone-400 dark:text-stone-500"
                : "text-teal-600 dark:text-teal-400"
            }`}
          >
            {allocation.isVoided ? "Voided" : "Allocated"}
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
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2 pb-5 pl-13 ml-13 relative">
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-teal-200 dark:from-teal-900 to-transparent" />
            <div className="ml-9 rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613] p-5">
              <AllocationDetailsView
                allocation={allocation}
                currency={currency}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// EXPENSE ROW + DETAILS
// ============================================================
function ExpenseDetailsView({
  expense,
  currency,
}: {
  expense: ExpenseData;
  currency: string;
}) {
  const isPettyCashExpense = expense.usedFromPettyCash === true;
  const fields = [
    {
      label: "Vendor",
      value: expense.vendorName || expense.vendor?.name || "—",
      icon: <Building2 className="w-3.5 h-3.5" />,
      accent: "from-violet-50 to-white dark:from-violet-950/40",
    },
    {
      label: "Expense date",
      value: formatDate(expense.date),
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      accent: "from-sky-50 to-white dark:from-sky-950/40",
    },
    {
      label: "Created by",
      value: expense.createdBy?.name || "Unknown",
      icon: <Users className="w-3.5 h-3.5" />,
      accent: "from-amber-50 to-white dark:from-amber-950/40",
    },
    {
      label: "Source",
      value: isPettyCashExpense ? (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-semibold">
          Petty Cash
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F1ECE0] dark:bg-[#16231f] text-stone-500 dark:text-stone-400 text-xs font-semibold">
          Informational
        </span>
      ),
      icon: <Wallet className="w-3.5 h-3.5" />,
      accent: isPettyCashExpense
        ? "from-rose-50 to-white dark:from-rose-950/40"
        : "from-[#F8F5EF] to-white dark:from-[#16231f]/60 dark:to-[#111d19]",
    },
    {
      label: "Petty Cash ID",
      value: (
        <span className="font-mono">
          {expense.pettyCashId?._id?.slice(-8) || "N/A"}
        </span>
      ),
      icon: <Tag className="w-3.5 h-3.5" />,
      accent: "from-teal-50 to-white dark:from-teal-950/40",
    },
    {
      label: "Recorded at",
      value: formatDateTime(expense.createdAt),
      icon: <Clock className="w-3.5 h-3.5" />,
      accent: "from-indigo-50 to-white dark:from-indigo-950/40",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            {isPettyCashExpense ? "Petty Cash Spend" : "Info Entry"}
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            <span
              className={
                isPettyCashExpense
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-stone-500 dark:text-stone-400"
              }
            >
              −{formatMoney(expense.spentAmount, currency)} spent
            </span>
            {expense.isVoided && (
              <span className="text-rose-500 line-through opacity-70">
                Voided
              </span>
            )}
          </div>
        </div>
        <div className="relative w-full h-2 rounded-full bg-[#F1ECE0] dark:bg-[#16231f] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            style={{
              width: "100%",
              backgroundImage: expense.isVoided
                ? undefined
                : isPettyCashExpense
                  ? "linear-gradient(90deg, #dc2626, #ef4444, #f87171)"
                  : "linear-gradient(90deg, #6b7280, #9ca3af, #d1d5db)",
              backgroundColor: expense.isVoided ? "#d1d5db" : undefined,
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="text-stone-500 dark:text-stone-400 truncate max-w-[60%]">
            {expense.description}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${
              expense.isVoided
                ? "text-stone-400 dark:text-stone-500"
                : isPettyCashExpense
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-stone-500 dark:text-stone-400"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            {expense.isVoided
              ? "Voided"
              : isPettyCashExpense
                ? "Deducted"
                : "Informational"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <InfoCard
            key={f.label}
            label={f.label}
            value={f.value}
            icon={f.icon}
            accent={f.accent}
          />
        ))}
      </div>

      {expense.items && expense.items.length > 0 && (
        <div className="rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
              <Tag className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Line Items · {expense.items.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-[32px]">
            {expense.items.map((item, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-[#F8F5EF] dark:bg-[#16231f]/60 px-3 py-2 border border-[#EDE7DA] dark:border-[#1f2e29]/60"
              >
                <span className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">
                  {item.itemName || `Item ${i + 1}`}
                </span>
                <span className="text-xs font-mono font-semibold text-stone-600 dark:text-stone-300 ml-2 shrink-0">
                  {formatMoney(item.amount || 0, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AttachmentsGrid urls={expense.receipts || []} />

      {expense.isVoided && (
        <VoidBlock
          reason={expense.voidReason}
          by={expense.voidedBy}
          at={expense.voidedAt}
        />
      )}
    </div>
  );
}

function ExpenseRow({
  expense,
  currency,
  isOpen,
  onToggle,
}: {
  expense: ExpenseData;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const isPettyCashExpense = expense.usedFromPettyCash === true;
  return (
    <div className="border-b border-[#EDE7DA] dark:border-[#1a2622] last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f]/60 rounded-xl px-3 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isPettyCashExpense
              ? "bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400"
              : "bg-[#F1ECE0] dark:bg-[#16231f] text-stone-500 dark:text-stone-400"
          }`}
        >
          {isPettyCashExpense ? (
            <ArrowDownRight className="w-4 h-4" />
          ) : (
            <Info className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
              {expense.description}
            </span>
            {expense.vendorName && (
              <span className="text-xs text-stone-400 dark:text-stone-500 truncate">
                {expense.vendorName}
              </span>
            )}
            {!isPettyCashExpense && (
              <span className="text-xs font-semibold text-stone-500 dark:text-stone-400 bg-[#F1ECE0] dark:bg-[#16231f] px-2 py-0.5 rounded-full">
                Info Only
              </span>
            )}
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span>{formatDate(expense.date)}</span>
            <span>·</span>
            <span>By: {expense.createdBy?.name || "Unknown"}</span>
            {expense.isVoided && (
              <span className="text-rose-500 dark:text-rose-400 font-semibold">
                (Voided)
              </span>
            )}
          </div>
        </div>
        <ReceiptLinks receipts={expense.receipts || []} />
        <div className="text-right shrink-0 min-w-[108px]">
          <div
            className={`font-mono font-semibold text-sm ${
              expense.isVoided
                ? "text-stone-400 dark:text-stone-500 line-through"
                : isPettyCashExpense
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-stone-400 dark:text-stone-500"
            }`}
          >
            {isPettyCashExpense ? "−" : ""}
            {formatMoney(expense.spentAmount, currency)}
          </div>
          <div
            className={`text-[10px] zfm-mono font-semibold ${
              expense.isVoided
                ? "text-stone-400 dark:text-stone-500"
                : isPettyCashExpense
                  ? "text-rose-500 dark:text-rose-400"
                  : "text-stone-400 dark:text-stone-500"
            }`}
          >
            {expense.isVoided
              ? "Voided"
              : isPettyCashExpense
                ? "Deducted"
                : "Info entry"}
          </div>
        </div>
        <div
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          {isOpen ? (
            <ChevronDown
              className={
                isPettyCashExpense
                  ? "w-4 h-4 text-rose-500 dark:text-rose-400"
                  : "w-4 h-4 text-stone-500 dark:text-stone-400"
              }
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
              className={`absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b ${
                isPettyCashExpense
                  ? "from-rose-200 dark:from-rose-900 to-transparent"
                  : "from-stone-200 dark:from-[#1f2e29] to-transparent"
              }`}
            />
            <div className="ml-9 rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613] p-5">
              <ExpenseDetailsView expense={expense} currency={currency} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// INCOME ROW + DETAILS
// ============================================================
function IncomeDetailsView({
  income,
  currency,
}: {
  income: CashIncomeData;
  currency: string;
}) {
  const fields = [
    {
      label: "Patient",
      value: income.patientName || "Unknown",
      icon: <Users className="w-3.5 h-3.5" />,
      accent: "from-emerald-50 to-white dark:from-emerald-950/40",
    },
    {
      label: "Invoice #",
      value: <span className="font-mono">{income.invoiceNumber}</span>,
      icon: <Receipt className="w-3.5 h-3.5" />,
      accent: "from-violet-50 to-white dark:from-violet-950/40",
    },
    {
      label: "Mobile",
      value: income.mobileNumber || "N/A",
      icon: <CreditCard className="w-3.5 h-3.5" />,
      accent: "from-sky-50 to-white dark:from-sky-950/40",
    },
    {
      label: "EMR #",
      value: income.emrNumber || "N/A",
      icon: <FileText className="w-3.5 h-3.5" />,
      accent: "from-amber-50 to-white dark:from-amber-950/40",
    },
    {
      label: "Service",
      value: income.service || "N/A",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      accent: "from-teal-50 to-white dark:from-teal-950/40",
    },
    {
      label: "Invoiced date",
      value: formatDate(income.invoicedDate),
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      accent: "from-indigo-50 to-white dark:from-indigo-950/40",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Cash Income
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            <span className="text-emerald-600 dark:text-emerald-400">
              +{formatMoney(income.cashAmount, currency)} received
            </span>
            <span className="text-stone-400 dark:text-stone-500 text-[10px]">
              of {formatMoney(income.amount, currency)}
            </span>
          </div>
        </div>
        <div className="relative w-full h-2 rounded-full bg-[#F1ECE0] dark:bg-[#16231f] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            style={{
              width:
                income.amount > 0
                  ? `${Math.min((income.cashAmount / income.amount) * 100, 100)}%`
                  : "100%",
              backgroundImage:
                "linear-gradient(90deg, #059669, #10b981, #34d399)",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="text-emerald-600 dark:text-emerald-400">
            Paid via {income.paymentMethod}
          </span>
          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-3 h-3" />
            {income.status || "Processed"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <InfoCard
            key={f.label}
            label={f.label}
            value={f.value}
            icon={f.icon}
            accent={f.accent}
          />
        ))}
      </div>

      {income.multiplePayments && income.multiplePayments.length > 0 && (
        <div className="rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-950/40 flex items-center justify-center">
              <Wallet className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Payment Breakdown · {income.multiplePayments.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-[32px]">
            {income.multiplePayments.map((payment, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-[#F8F5EF] dark:bg-[#16231f]/60 px-3 py-2 border border-[#EDE7DA] dark:border-[#1f2e29]/60"
              >
                <span className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">
                  {payment.paymentMethod || `Payment ${i + 1}`}
                </span>
                <span className="text-xs font-mono font-semibold text-emerald-600 dark:text-emerald-400 ml-2 shrink-0">
                  +{formatMoney(payment.amount || 0, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function IncomeRow({
  income,
  currency,
  isOpen,
  onToggle,
}: {
  income: CashIncomeData;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-[#EDE7DA] dark:border-[#1a2622] last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f]/60 rounded-xl px-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0">
          <Coins className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
              {income.patientName || "Unknown Patient"}
            </span>
            <span className="text-xs text-stone-400 dark:text-stone-500 zfm-mono">
              #{income.invoiceNumber}
            </span>
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span>{formatDate(income.invoicedDate)}</span>
            <span>·</span>
            <span>{income.service || "Service"}</span>
            <span>·</span>
            <span>{income.paymentMethod}</span>
          </div>
        </div>
        <div className="text-right shrink-0 min-w-[108px]">
          <div className="font-mono font-semibold text-sm text-emerald-600 dark:text-emerald-400">
            +{formatMoney(income.cashAmount, currency)}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 zfm-mono font-semibold">
            {income.status || "Received"}
          </div>
        </div>
        <div
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
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
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-emerald-200 dark:from-emerald-900 to-transparent" />
            <div className="ml-9 rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613] p-5">
              <IncomeDetailsView income={income} currency={currency} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MANUAL PETTY CASH ROW + DETAILS
// ============================================================
function ManualDetailsView({
  item,
  currency,
}: {
  item: ManualPettyCashItem;
  currency: string;
}) {
  const type = getManualType(item);
  const isExpense = item.isExpense;
  const fields = [
    {
      label: "Type",
      value: <TypePill type={type} />,
      icon: <Tag className="w-3.5 h-3.5" />,
      accent: isExpense
        ? "from-rose-50 to-white dark:from-rose-950/40"
        : "from-emerald-50 to-white dark:from-emerald-950/40",
    },
    {
      label: "Vendor",
      value: getVendorLabel(item),
      icon: <Building2 className="w-3.5 h-3.5" />,
      accent: "from-violet-50 to-white dark:from-violet-950/40",
    },
    {
      label: "Added by",
      value: getAddedByLabel(item),
      icon: <Users className="w-3.5 h-3.5" />,
      accent: "from-sky-50 to-white dark:from-sky-950/40",
    },
    {
      label: "Created",
      value: formatDateTime(item.createdAt),
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      accent: "from-amber-50 to-white dark:from-amber-950/40",
    },
    {
      label: "Used from Petty Cash",
      value: item.usedFromPettyCash ? "Yes" : "No",
      icon: <Wallet className="w-3.5 h-3.5" />,
      accent: "from-teal-50 to-white dark:from-teal-950/40",
    },
    {
      label: "Entry name",
      value: item.name || "—",
      icon: <FileText className="w-3.5 h-3.5" />,
      accent: "from-indigo-50 to-white dark:from-indigo-950/40",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            {isExpense ? "Manual Expense" : "Manual Income"}
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            <span
              className={
                isExpense
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-emerald-600 dark:text-emerald-400"
              }
            >
              {isExpense ? "−" : "+"}
              {formatMoney(item.amount, currency)}
            </span>
            {item.note && (
              <span className="text-stone-400 dark:text-stone-500 text-[10px] truncate max-w-[200px]">
                · {item.note}
              </span>
            )}
          </div>
        </div>
        <div className="relative w-full h-2 rounded-full bg-[#F1ECE0] dark:bg-[#16231f] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500 ease-out"
            style={{
              width: "100%",
              backgroundImage: isExpense
                ? "linear-gradient(90deg, #dc2626, #ef4444, #f87171)"
                : "linear-gradient(90deg, #059669, #10b981, #34d399)",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="text-stone-500 dark:text-stone-400 truncate max-w-[60%]">
            {item.name}
          </span>
          <span
            className={`inline-flex items-center gap-1 ${
              isExpense
                ? "text-rose-600 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            Manual entry · {type}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <InfoCard
            key={f.label}
            label={f.label}
            value={f.value}
            icon={f.icon}
            accent={f.accent}
          />
        ))}
      </div>

      {item.items && item.items.length > 0 && (
        <div className="rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-950/40 flex items-center justify-center">
              <Tag className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Line Items · {item.items.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pl-[32px]">
            {item.items.map((it, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-lg bg-[#F8F5EF] dark:bg-[#16231f]/60 px-3 py-2 border border-[#EDE7DA] dark:border-[#1f2e29]/60"
              >
                <span className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">
                  {it.itemName || `Item ${i + 1}`}
                </span>
                <span className="text-xs font-mono font-semibold text-stone-600 dark:text-stone-300 ml-2 shrink-0">
                  {formatMoney(it.amount || 0, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <AttachmentsGrid urls={item.images || []} />

      {item.note && (
        <div className="rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-gradient-to-br from-[#F8F5EF] to-white dark:from-[#16231f]/60 dark:to-[#111d19] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center">
              <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Note
            </span>
          </div>
          <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed pl-[32px]">
            {item.note}
          </p>
        </div>
      )}
    </div>
  );
}

function ManualPettyCashRow({
  item,
  currency,
  isOpen,
  onToggle,
}: {
  item: ManualPettyCashItem;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const type = getManualType(item);
  const isExpense = item.isExpense;
  return (
    <div className="border-b border-[#EDE7DA] dark:border-[#1a2622] last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f]/60 rounded-xl px-3 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
            isExpense
              ? "bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400"
              : "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-500 dark:text-emerald-400"
          }`}
        >
          {isExpense ? (
            <ArrowDownRight className="w-4 h-4" />
          ) : (
            <ArrowUpRight className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
              {item.name}
            </span>
            {item.vendorName || item.vendorId ? (
              <span className="text-xs text-stone-400 dark:text-stone-500 truncate">
                {getVendorLabel(item)}
              </span>
            ) : null}
            <TypePill type={type} />
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span>{formatDate(item.createdAt)}</span>
            <span>·</span>
            <span>By: {getAddedByLabel(item)}</span>
            {item.note && (
              <>
                <span>·</span>
                <span className="truncate max-w-[200px]">{item.note}</span>
              </>
            )}
          </div>
        </div>
        <ImageLinks images={item.images || []} />
        <div className="text-right shrink-0 min-w-[108px]">
          <div
            className={`font-mono font-semibold text-sm ${
              isExpense
                ? "text-rose-500 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {isExpense ? "−" : "+"}
            {formatMoney(item.amount, currency)}
          </div>
          <div
            className={`text-[10px] zfm-mono font-semibold ${
              isExpense
                ? "text-rose-500 dark:text-rose-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {type}
          </div>
        </div>
        <div
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          {isOpen ? (
            <ChevronDown
              className={
                isExpense
                  ? "w-4 h-4 text-rose-500 dark:text-rose-400"
                  : "w-4 h-4 text-emerald-500 dark:text-emerald-400"
              }
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
              className={`absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b ${
                isExpense
                  ? "from-rose-200 dark:from-rose-900 to-transparent"
                  : "from-emerald-200 dark:from-emerald-900 to-transparent"
              }`}
            />
            <div className="ml-9 rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613] p-5">
              <ManualDetailsView item={item} currency={currency} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NEW PETTY CASH MODAL
// ============================================================
function NewPettyCashModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (input: {
    name: string;
    amount: number;
    note?: string;
  }) => Promise<{ ok: boolean; warning?: string }>;
  saving: boolean;
}) {
  const { currency } = useCurrency();
  const symbol = getCurrencySymbol(currency);

  const [form, setForm] = useState({
    name: "",
    amount: "",
    note: "",
  });
  const [warning, setWarning] = useState<string | null>(null);

  const amountNum = Number(form.amount);
  const canSave = !!form.name.trim() && amountNum > 0 && !saving;

  const submit = async () => {
    setWarning(null);
    if (!canSave) {
      setWarning("Fill in the required fields to add petty cash");
      return;
    }
    const result = await onSave({
      name: form.name.trim(),
      amount: amountNum,
      note: form.note.trim() || undefined,
    });
    if (!result.ok) {
      setWarning(result.warning || "Could not add petty cash entry");
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 z-50"
      style={{
        backgroundColor: "rgba(19,42,39,0.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="relative bg-white dark:bg-[#111d19] rounded-3xl w-full max-w-2xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)] border border-[#EDE7DA] dark:border-[#1a2622] max-h-[92vh] flex flex-col overflow-hidden">
        {/* STICKY HEADER */}
        <div className="relative px-6 sm:px-8 py-6 shrink-0 border-b border-[#EDE7DA]/60 dark:border-[#1a2622]/60">
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[20px] flex items-center justify-center shadow-sm shrink-0 bg-teal-600 dark:bg-teal-500">
                <Wallet className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-[0.14em] mb-1.5">
                  <Coins className="w-3 h-3" />
                  Manual Addition
                </div>
                <h3 className="zfm-display text-2xl sm:text-[28px] font-semibold text-stone-900 dark:text-stone-50 leading-[1.1]">
                  Add Petty Cash
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
                  Add a manual cash inflow to the petty cash pool.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-stone-400 dark:text-stone-500 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] hover:text-stone-700 dark:hover:text-stone-200 transition-all border border-[#E8E3D8]/60 dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] shadow-sm"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 sm:py-7 bg-[#FBF9F4] dark:bg-[#0d1613]">
          {warning && (
            <div className="mb-6 px-4 py-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5 shadow-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16231f] border border-[#EDE7DA] dark:border-[#1f2e29] shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  What is it for?
                </h4>
              </div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Office supplies, Snacks, Petrol..."
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all"
              />
            </div>

            <div className="p-4 sm:p-5 rounded-2xl border border-teal-200/60 dark:border-teal-900/40 bg-teal-50/40 dark:bg-teal-950/20">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Amount
                </h4>
              </div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Total ({symbol}) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 zfm-mono font-semibold text-lg pointer-events-none">
                  {symbol}
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full pl-9 pr-4 py-3.5 text-2xl rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono font-bold transition-all shadow-inner"
                />
              </div>
            </div>
          </div>

          {/* CARD: Notes */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16231f] border border-[#EDE7DA] dark:border-[#1f2e29] shadow-sm">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center">
                <FileText className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Notes
              </h4>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto">
                Optional
              </span>
            </div>
            <textarea
              value={form.note}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
              placeholder="Any additional notes..."
              rows={2}
              className="w-full px-4 py-3 text-sm rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all resize-none"
            />
          </div>
        </div>

        {/* STICKY FOOTER */}
        <div className="shrink-0 px-6 sm:px-8 py-4 sm:py-5 border-t border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#111d19]">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex flex-col gap-1">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                Added to petty cash pool instantly.
              </div>
              {!canSave && !saving && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Fill name and amount to add.
                </div>
              )}
            </div>
            <div className="flex gap-3 ml-auto w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-5 sm:px-6 py-3 rounded-full text-sm font-semibold border border-[#EDE7DA] dark:border-[#1a2622] text-stone-600 dark:text-stone-300 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] transition-all shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!canSave}
                className="relative flex-1 sm:flex-none px-6 sm:px-8 py-3 rounded-full text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm hover:shadow transition-all duration-200 disabled:grayscale disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add Petty Cash
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NEW EXPENSE MODAL
// ============================================================
function NewExpenseModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (input: {
    vendor: string;
    vendorName: string;
    description: string;
    spentAmount: number;
    items: { itemName: string; amount: number }[];
    receipts: string[];
    usedFromPettyCash: boolean;
  }) => Promise<{ ok: boolean; warning?: string }>;
  saving: boolean;
}) {
  const { clinic } = useClinic();
  const { currency } = useCurrency();
  const symbol = getCurrencySymbol(currency);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [supplierSearch, setSupplierSearch] = useState("");
  const { suppliers, loading: suppliersLoading } = useSuppliers({
    branchId: clinic?._id || "",
    search: supplierSearch,
  }) as { suppliers: any[]; loading: boolean };

  const supplierOptions = suppliers.map((s) => ({
    value: s._id,
    label: s.name,
    sublabel: [
      s.code,
      s.mobile || s.telephone,
      s.totalBalance
        ? `Balance ${formatMoney(s.totalBalance, currency)}`
        : null,
    ]
      .filter(Boolean)
      .join(" · "),
  }));

  const [expenseVendor, setExpenseVendor] = useState("");
  const [expenseItems, setExpenseItems] = useState([
    { itemName: "", amount: "" },
  ]);
  const [expenseImages, setExpenseImages] = useState<string[]>([]);
  const [deductFromPettyCash, setDeductFromPettyCash] = useState(true);
  const [warning, setWarning] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const totalExpenseAmount = expenseItems.reduce(
    (sum, item) => sum + (parseFloat(item.amount) || 0),
    0,
  );

  const updateExpenseItem = (
    index: number,
    field: "itemName" | "amount",
    value: string,
  ) => {
    const newItems = [...expenseItems];
    (newItems[index] as any)[field] = value;
    setExpenseItems(newItems);
  };

  const addExpenseItem = () => {
    setExpenseItems([...expenseItems, { itemName: "", amount: "" }]);
  };

  const removeExpenseItem = (index: number) => {
    if (expenseItems.length > 1) {
      setExpenseItems(expenseItems.filter((_, i) => i !== index));
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const filesArr = Array.from(files);
      const urls: string[] = [];
      for (const file of filesArr) {
        const data = await handleUpload(file);
        const url = data?.url || data?.data?.url || data?.data?.data?.url;
        if (url) urls.push(url);
      }
      if (urls.length > 0) setExpenseImages((prev) => [...prev, ...urls]);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    setExpenseImages((prev) => prev.filter((_, i) => i !== index));
  };

  const canSave =
    !!expenseVendor &&
    !expenseItems.some(
      (item) => !item.itemName.trim() || !parseFloat(item.amount),
    ) &&
    totalExpenseAmount > 0 &&
    !saving;

  const submit = async () => {
    setWarning(null);
    if (!canSave) {
      setWarning("Fill in vendor and all item names + amounts to save");
      return;
    }
    const vendorName =
      suppliers.find((s) => s._id === expenseVendor)?.name || "";
    const result = await onSave({
      vendor: expenseVendor,
      vendorName,
      description: `Expense: ${vendorName}`,
      spentAmount: totalExpenseAmount,
      items: expenseItems.map((i) => ({
        itemName: i.itemName,
        amount: parseFloat(i.amount),
      })),
      receipts: expenseImages,
      usedFromPettyCash: deductFromPettyCash,
    });
    if (!result.ok) {
      setWarning(result.warning || "Could not record expense");
      return;
    }
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 z-50"
        style={{
          backgroundColor: "rgba(19,42,39,0.55)",
          backdropFilter: "blur(6px)",
        }}
      >
        <div className="relative bg-white dark:bg-[#111d19] rounded-3xl w-full max-w-4xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)] border border-[#EDE7DA] dark:border-[#1a2622] max-h-[92vh] flex flex-col overflow-hidden">
          {/* STICKY HEADER */}
          <div className="relative px-6 sm:px-8 py-6 shrink-0 border-b border-[#EDE7DA]/60 dark:border-[#1a2622]/60">
            <div className="relative flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-[20px] flex items-center justify-center shadow-sm shrink-0 bg-rose-600 dark:bg-rose-500">
                  <Receipt className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-[10px] font-bold text-rose-700 dark:text-rose-300 uppercase tracking-[0.14em] mb-1.5">
                    <TrendingDown className="w-3 h-3" />
                    Expense Record
                  </div>
                  <h3 className="zfm-display text-2xl sm:text-[28px] font-semibold text-stone-900 dark:text-stone-50 leading-[1.1]">
                    Add Expense
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
                    Record vendor expense — optionally deduct from petty cash.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-stone-400 dark:text-stone-500 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] hover:text-stone-700 dark:hover:text-stone-200 transition-all border border-[#E8E3D8]/60 dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] shadow-sm"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>

          {/* SCROLLABLE BODY */}
          <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 sm:py-7 bg-[#FBF9F4] dark:bg-[#0d1613]">
            {warning && (
              <div className="mb-6 px-4 py-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-100 dark:border-rose-900/40 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5 shadow-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{warning}</span>
              </div>
            )}

            {/* Vendor Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16231f] border border-[#EDE7DA] dark:border-[#1f2e29] shadow-sm mb-5">
              <div className="flex items-center gap-1.5 mb-4">
                <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-900/40 flex items-center justify-center">
                  <Building2 className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Vendor
                </h4>
              </div>
              <SearchableSelect
                label="Supplier"
                required
                icon={<Receipt className="w-3.5 h-3.5 text-stone-400" />}
                options={supplierOptions}
                value={expenseVendor}
                onChange={(v) => setExpenseVendor(v)}
                onSearchChange={setSupplierSearch}
                loading={suppliersLoading}
                placeholder="Choose a supplier"
                searchPlaceholder="Search suppliers by name, code, phone…"
                emptyText="No suppliers found"
              />
            </div>

            {/* Items Card */}
            <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16231f] border border-[#EDE7DA] dark:border-[#1f2e29] shadow-sm mb-5">
              <div className="flex items-center gap-1.5 mb-4">
                <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-900/40 flex items-center justify-center">
                  <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Line Items
                </h4>
              </div>
              <div className="space-y-2.5">
                {expenseItems.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-start">
                    <div className="flex-1 flex flex-col gap-1">
                      <input
                        type="text"
                        placeholder="Item name"
                        value={item.itemName}
                        onChange={(e) =>
                          updateExpenseItem(idx, "itemName", e.target.value)
                        }
                        className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-rose-500/10 dark:focus:ring-rose-400/10 focus:border-rose-500 dark:focus:border-rose-400 transition-all"
                      />
                    </div>
                    <div className="w-32 flex flex-col gap-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 zfm-mono text-xs pointer-events-none">
                        {symbol}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={item.amount}
                        onChange={(e) =>
                          updateExpenseItem(idx, "amount", e.target.value)
                        }
                        className="w-full pl-8 pr-3 py-2.5 text-sm rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-rose-500/10 dark:focus:ring-rose-400/10 focus:border-rose-500 dark:focus:border-rose-400 transition-all zfm-mono text-right"
                      />
                    </div>
                    {expenseItems.length > 1 && (
                      <button
                        onClick={() => removeExpenseItem(idx)}
                        type="button"
                        className="p-2.5 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                onClick={addExpenseItem}
                type="button"
                className="mt-3 text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add more items
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              {/* Receipts Upload */}
              <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16231f] border border-[#EDE7DA] dark:border-[#1f2e29] shadow-sm">
                <div className="flex items-center gap-1.5 mb-4">
                  <div className="w-6 h-6 rounded-lg bg-sky-50 dark:bg-sky-900/40 flex items-center justify-center">
                    <ImageIcon className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Receipts
                  </h4>
                  <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto">
                    Optional
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e.target.files)}
                  className="hidden"
                />

                <div className="flex flex-wrap gap-2">
                  {expenseImages.map((url, idx) => (
                    <div
                      key={idx}
                      className="relative w-16 h-16 rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] overflow-hidden group shadow-sm"
                    >
                      <img
                        src={url}
                        alt="receipt"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeImage(idx)}
                        className="absolute top-0 right-0 p-1 bg-rose-500 text-white opacity-0 group-hover:opacity-100 transition-opacity rounded-bl-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-16 h-16 rounded-xl border-2 border-dashed border-[#EDE7DA] dark:border-[#1a2622] bg-[#F8F5EF]/70 dark:bg-[#16231f]/40 flex flex-col items-center justify-center cursor-pointer hover:border-rose-400/60 dark:hover:border-rose-500/50 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all disabled:opacity-60"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    ) : (
                      <Upload className="w-4 h-4 text-stone-400" />
                    )}
                    <span className="text-[9px] text-stone-400 mt-0.5">
                      Add
                    </span>
                  </button>
                </div>
              </div>

              {/* Deduct Toggle + Total */}
              <div className="p-4 sm:p-5 rounded-2xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20">
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/60 flex items-center justify-center">
                    <DollarSign className="w-3.5 h-3.5 text-rose-700 dark:text-rose-300" />
                  </div>
                  <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Total
                  </h4>
                </div>
                <label className="flex items-center gap-2.5 mb-4 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={deductFromPettyCash}
                    onChange={(e) => setDeductFromPettyCash(e.target.checked)}
                    className="w-4 h-4 text-rose-600 border-[#E8E3D8] dark:border-[#1f2e29] rounded focus:ring-rose-500"
                  />
                  <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 leading-tight">
                    Deduct from Petty Cash
                  </span>
                </label>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-stone-400 dark:text-stone-500 text-base zfm-mono">
                    {symbol}
                  </span>
                  <span className="text-3xl font-bold zfm-mono text-stone-900 dark:text-stone-50 leading-none">
                    {totalExpenseAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-[10px]">
                  {deductFromPettyCash ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      Affects balance
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#F1ECE0] dark:bg-[#16231f] text-stone-500 dark:text-stone-400 font-semibold">
                      <Receipt className="w-3 h-3" />
                      Info only
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* STICKY FOOTER */}
          <div className="shrink-0 px-6 sm:px-8 py-4 sm:py-5 border-t border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#111d19]">
            <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
              <div className="flex flex-col gap-1">
                <div className="hidden sm:flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-rose-500" />
                  {deductFromPettyCash
                    ? "Deducted from petty cash balance on save."
                    : "Saved as informational only — no balance impact."}
                </div>
                {!canSave && !saving && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Choose vendor and add items with amounts to save.
                  </div>
                )}
              </div>
              <div className="flex gap-3 ml-auto w-full sm:w-auto">
                <button
                  onClick={onClose}
                  className="flex-1 sm:flex-none px-5 sm:px-6 py-3 rounded-full text-sm font-semibold border border-[#EDE7DA] dark:border-[#1a2622] text-stone-600 dark:text-stone-300 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] transition-all shadow-sm hover:shadow"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!canSave}
                  className="relative flex-1 sm:flex-none px-6 sm:px-8 py-3 rounded-full text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm hover:shadow transition-all duration-200 disabled:grayscale disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Save Expense
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* <AddSupplierModal

        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        onSuccess={(newSupplier) => {
          onAddSupplier(newSupplier);
          setExpenseVendor(newSupplier._id);
          fetchSuppliers();
        }}
      /> */}
    </>
  );
}

// ============================================================
// STATS CARDS SECTION
// ============================================================
interface StatsSectionProps {
  viewType: TabType;
  allocationSummary: any;
  expenseSummary: any;
  incomeSummary: any;
  manualSummary: any;
  loading: boolean;
}

const StatsSection: React.FC<StatsSectionProps> = ({
  viewType,
  allocationSummary,
  expenseSummary,
  incomeSummary,
  manualSummary,
  loading,
}) => {
  const { currency } = useCurrency();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#EDE7DA] dark:divide-[#1a2622] bg-white dark:bg-[#111d19] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="p-5 animate-pulse">
            <div className="h-3 w-16 bg-[#F1ECE0] dark:bg-[#1c2a25] rounded mb-3" />
            <div className="h-6 w-20 bg-[#F1ECE0] dark:bg-[#1c2a25] rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Flat divided-row stat card — same treatment used across the Finance
  // Manager (Cheque Manager, Vendor History, etc). `tone` colors just the
  // value text; the row itself stays neutral.
  const StatRow = ({
    stats,
  }: {
    stats: { label: string; value: React.ReactNode; tone?: string }[];
  }) => (
    <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-[#EDE7DA] dark:divide-[#1a2622] bg-white dark:bg-[#111d19] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm overflow-hidden">
      {stats.map((s) => (
        <div key={s.label} className="p-5">
          <div className="text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
            {s.label}
          </div>
          <div
            className={`text-lg font-semibold zfm-mono ${
              s.tone || "text-stone-800 dark:text-stone-100"
            }`}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>
  );

  if (viewType === "manual") {
    const net = manualSummary?.globalBalance || 0;
    return (
      <StatRow
        stats={[
          {
            label: "Manual Income",
            value: formatMoney(manualSummary?.totalIncome || 0, currency),
            tone: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Manual Expenses",
            value: formatMoney(manualSummary?.totalExpenses || 0, currency),
            tone: "text-rose-600 dark:text-rose-400",
          },
          {
            label: "Net Balance",
            value: formatMoney(net, currency),
            tone:
              net >= 0
                ? "text-teal-600 dark:text-teal-400"
                : "text-rose-600 dark:text-rose-400",
          },
          {
            label: "Total Items",
            value: String(manualSummary?.totalItems || 0),
          },
        ]}
      />
    );
  }

  if (viewType === "income") {
    return (
      <StatRow
        stats={[
          {
            label: "Total Cash Income",
            value: formatMoney(incomeSummary?.totalCashIn || 0, currency),
            tone: "text-emerald-600 dark:text-emerald-400",
          },
          {
            label: "Average Transaction",
            value: formatMoney(
              (incomeSummary?.totalCashIn || 0) /
                (incomeSummary?.totalTransactions || 1),
              currency,
            ),
          },
          {
            label: "Total Transactions",
            value: incomeSummary?.totalTransactions || 0,
          },
          { label: "Status", value: "Active" },
        ]}
      />
    );
  }

  if (viewType === "allocations") {
    return (
      <StatRow
        stats={[
          {
            label: "Total Allocated",
            value: formatMoney(
              allocationSummary?.totalAllocated || 0,
              currency,
            ),
            tone: "text-teal-600 dark:text-teal-400",
          },
          {
            label: "Average Allocation",
            value: formatMoney(allocationSummary?.averageAmount || 0, currency),
          },
          {
            label: "Min Allocation",
            value: formatMoney(allocationSummary?.minAmount || 0, currency),
          },
          {
            label: "Max Allocation",
            value: formatMoney(allocationSummary?.maxAmount || 0, currency),
          },
        ]}
      />
    );
  }

  if (viewType === "expenses") {
    return (
      <StatRow
        stats={[
          {
            label: "Total All Spent", // 🔥 NAYA CARD
            value: formatMoney(expenseSummary?.totalAllSpent || 0, currency),
            tone: "text-orange-600 dark:text-orange-400",
          },
          {
            label: "Total Spent (Petty Cash)",
            value: formatMoney(expenseSummary?.totalSpent || 0, currency),
            tone: "text-rose-600 dark:text-rose-400",
          },
          {
            label: "Informational Entries",
            value: expenseSummary?.infoExpenseCount || 0,
          },
          {
            label: "Unique Vendors",
            value: expenseSummary?.uniqueVendors || 0,
          },
        ]}
      />
    );
  }

  // Combined "all" view
  const totalAllocated = allocationSummary?.totalAllocated || 0;
  const totalSpent = expenseSummary?.totalSpent || 0;
  const balance = totalAllocated - totalSpent;
  // const totalVoided =
  //   (allocationSummary?.totalVoided || 0) + (expenseSummary?.totalVoided || 0);

  return (
    <StatRow
      stats={[
        {
          label: "Total All Spent", // 🔥 NAYA CARD
          value: formatMoney(expenseSummary?.totalAllSpent || 0, currency),
          tone: "text-orange-600 dark:text-orange-400",
        },
        {
          label: "Total Spent (Petty Cash)",
          value: formatMoney(totalSpent, currency),
          tone: "text-rose-600 dark:text-rose-400",
        },
        {
          label: "Total Allocated",
          value: formatMoney(totalAllocated, currency),
          tone: "text-teal-600 dark:text-teal-400",
        },
        {
          label: "Balance",
          value: formatMoney(balance, currency),
          tone:
            balance >= 0
              ? "text-teal-600 dark:text-teal-400"
              : "text-rose-600 dark:text-rose-400",
        },
      ]}
    />
  );
};

// ============================================================
// MAIN PETTY CASH TAB
// ============================================================
const PettyCashTab: React.FC<UseFinancePermissionReturn> = ({
  permissions,
  permissionsLoaded,
  AccessDenied,
  PermissionLoading,
  canAccessPage,
}) => {
  const { currency } = useCurrency();
  const {
    loading,
    error,
    allocations,
    expenses,
    incomeData,
    allocationSummary,
    expenseSummary,
    incomeSummary,
    // viewType: pcViewType,
    setViewType: setPcViewType,
    search: pcSearch,
    setSearch: setPcSearch,
    page: pcPage,
    limit: pcLimit,
    pagination: pcPagination,
    nextPage: pcNextPage,
    prevPage: pcPrevPage,
    fetchPettyCash,
    // fetchIncome,
  } = usePettyCash();

  const {
    loading: manualLoading,
    error: manualError,
    manualPettyCash,
    summary: manualSummary,
    search: manualSearch,
    setSearch: setManualSearch,
    page: manualPage,
    limit: manualLimit,
    pagination: manualPagination,
    nextPage: manualNextPage,
    prevPage: manualPrevPage,
    fetchManualPettyCash,
  } = useManualPettyCash();

  // top-level active tab drives what is rendered; kept separate from the
  // underlying hooks so switching to "manual" doesn't disturb their state
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [manualTypeFilter, setManualTypeFilter] =
    useState<ManualTypeFilter>("all");

  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [showVoided, setShowVoided] = React.useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  // keep the underlying petty-cash hook's viewType in sync for the tabs it owns
  React.useEffect(() => {
    if (activeTab === "manual") return;
    setPcViewType(activeTab as any);
  }, [activeTab]);

  const isManual = activeTab === "manual";
  const isIncome = activeTab === "income";

  const activeLoading = isManual ? manualLoading : loading;
  const activeError = isManual ? manualError : error;
  const activePagination = isManual ? manualPagination : pcPagination;
  const activePage = isManual ? manualPage : pcPage;
  const activeLimit = isManual ? manualLimit : pcLimit;
  const activeNextPage = isManual ? manualNextPage : pcNextPage;
  const activePrevPage = isManual ? manualPrevPage : pcPrevPage;
  const activeSearch = isManual ? manualSearch : pcSearch;

  const handleSearchChange = (value: string) => {
    setPcSearch(value);
    setManualSearch(value);
  };

  const from =
    (activePagination?.totalResults || 0) === 0
      ? 0
      : (activePage - 1) * activeLimit + 1;
  const to = Math.min(
    activePage * activeLimit,
    activePagination?.totalResults || 0,
  );

  // Filter data based on date and voided status (client-side filtering)
  const filteredAllocations = React.useMemo(() => {
    return allocations.filter((alloc) => {
      if (showVoided && !alloc.isVoided) return false;
      if (!showVoided && alloc.isVoided) return false;
      if (startDate && new Date(alloc.date) < new Date(startDate)) return false;
      if (endDate && new Date(alloc.date) > new Date(endDate)) return false;
      return true;
    });
  }, [allocations, showVoided, startDate, endDate]);

  const filteredExpenses = React.useMemo(() => {
    return expenses.filter((exp) => {
      if (showVoided && !exp.isVoided) return false;
      if (!showVoided && exp.isVoided) return false;
      if (startDate && new Date(exp.date) < new Date(startDate)) return false;
      if (endDate && new Date(exp.date) > new Date(endDate)) return false;
      return true;
    });
  }, [expenses, showVoided, startDate, endDate]);

  const filteredManual = React.useMemo(() => {
    return manualPettyCash.filter((item) => {
      if (
        manualTypeFilter !== "all" &&
        getManualType(item) !== manualTypeFilter
      )
        return false;
      if (startDate && new Date(item.createdAt) < new Date(startDate))
        return false;
      if (endDate && new Date(item.createdAt) > new Date(endDate)) return false;
      return true;
    });
  }, [manualPettyCash, manualTypeFilter, startDate, endDate]);

  const handleAddPettyCash = async (input: {
    name: string;
    amount: number;
    note?: string;
  }): Promise<{ ok: boolean; warning?: string }> => {
    const token = getTokenByPath();
    if (!token) {
      return { ok: false, warning: "Unauthorized. Please log in again." };
    }
    setSaving(true);
    try {
      await axios.post(
        "/api/clinic/manual-pettycash",
        { name: input.name, amount: input.amount, note: input.note },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        },
      );
      // refresh both — the entry affects the manual ledger and the
      // combined petty cash pool balance shown on other tabs
      await Promise.all([fetchPettyCash(), fetchManualPettyCash()]);
      return { ok: true };
    } catch (e: any) {
      return {
        ok: false,
        warning: e?.response?.data?.message || "Failed to add entry",
      };
    } finally {
      setSaving(false);
    }
  };

  const handleAddExpense = async (input: {
    vendor: string;
    vendorName: string;
    description: string;
    spentAmount: number;
    items: { itemName: string; amount: number }[];
    receipts: string[];
    usedFromPettyCash: boolean;
  }): Promise<{ ok: boolean; warning?: string }> => {
    const token = getTokenByPath();
    if (!token) {
      return { ok: false, warning: "Unauthorized. Please log in again." };
    }
    setExpenseSaving(true);
    try {
      const payload = {
        description: input.description,
        spentAmount: input.spentAmount,
        vendor: input.vendor,
        vendorName: input.vendorName,
        items: input.items,
        receipts: input.receipts,
        usedFromPettyCash: input.usedFromPettyCash,
      };
      await axios.post("/api/pettycash/add-expense", payload, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      await Promise.all([fetchPettyCash(), fetchManualPettyCash()]);
      return { ok: true };
    } catch (e: any) {
      return {
        ok: false,
        warning: e?.response?.data?.message || "Failed to add expense",
      };
    } finally {
      setExpenseSaving(false);
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
      {/* Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
            Petty Cash
          </h2>
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
            Every petty cash entry in the clinic has — now or later
          </p>
        </div>

        {permissions.canCreate && (
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setShowAddExpenseModal(true)}
              disabled={expenseSaving}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 shadow-sm hover:shadow transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
            >
              {expenseSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              Add Expense
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm hover:shadow transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
              disabled={saving}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Add Petty Cash
            </button>
          </div>
        )}
      </div>

      {/* Stats Cards Section */}
      <StatsSection
        viewType={activeTab}
        allocationSummary={allocationSummary}
        expenseSummary={expenseSummary}
        incomeSummary={incomeSummary}
        manualSummary={manualSummary}
        loading={activeLoading}
      />

      <div className="bg-white dark:bg-[#111d19] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm dark:shadow-black/20 overflow-hidden transition-colors duration-300">
        {/* Tabs + Add Petty Cash (top-right of the card) */}
        <div className="border-b border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613]">
          <div className="flex items-center justify-between gap-2 p-1">
            <div className="flex items-center gap-1 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
                    ${
                      activeTab === tab.value
                        ? "bg-white dark:bg-[#16231f] text-stone-800 dark:text-stone-100 shadow-sm dark:shadow-black/20"
                        : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-white/50 dark:hover:bg-[#16231f]/60"
                    }
                  `}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-5 border-b border-[#EDE7DA] dark:border-[#1a2622] flex flex-wrap items-center gap-2.5 bg-white dark:bg-[#111d19]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={activeSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={
                isIncome
                  ? "Search by patient name or invoice..."
                  : isManual
                    ? "Search by name, vendor, note or items…"
                    : "Search…"
              }
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-full border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 transition-all shadow-sm dark:shadow-black/20"
            />
          </div>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm rounded-full border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-black/20"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm rounded-full border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-black/20"
          />

          {isManual && (
            <select
              value={manualTypeFilter}
              onChange={(e) =>
                setManualTypeFilter(e.target.value as ManualTypeFilter)
              }
              className="text-sm rounded-full border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-black/20"
            >
              <option value="all">All Types</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          )}

          {!isManual && !isIncome && (
            <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
                className="rounded border-[#E8E3D8] dark:border-[#1f2e29] text-teal-600 focus:ring-teal-500"
              />
              Show voided
            </label>
          )}
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-[#111d19]">
          {activeLoading && (
            <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600 dark:text-teal-400" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {!activeLoading && activeError && (
            <div className="px-5 py-16 text-center text-rose-500 dark:text-rose-400 text-sm">
              {activeError}
            </div>
          )}

          {!activeLoading && !activeError && (
            <>
              {isIncome && (
                <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622]">
                  {incomeData.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">No cash income found.</span>
                    </div>
                  ) : (
                    incomeData.map((income) => (
                      <IncomeRow
                        key={income._id}
                        income={income}
                        currency={currency}
                        isOpen={expandedRowId === income._id}
                        onToggle={() =>
                          setExpandedRowId(
                            expandedRowId === income._id ? null : income._id,
                          )
                        }
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "allocations" && (
                <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622]">
                  {filteredAllocations.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">No allocations found.</span>
                    </div>
                  ) : (
                    filteredAllocations.map((alloc) => (
                      <AllocationRow
                        key={alloc._id}
                        allocation={alloc}
                        currency={currency}
                        isOpen={expandedRowId === alloc._id}
                        onToggle={() =>
                          setExpandedRowId(
                            expandedRowId === alloc._id ? null : alloc._id,
                          )
                        }
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "expenses" && (
                <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622]">
                  {filteredExpenses.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">No expenses found.</span>
                    </div>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <ExpenseRow
                        key={exp._id}
                        expense={exp}
                        currency={currency}
                        isOpen={expandedRowId === exp._id}
                        onToggle={() =>
                          setExpandedRowId(
                            expandedRowId === exp._id ? null : exp._id,
                          )
                        }
                      />
                    ))
                  )}
                </div>
              )}

              {isManual && (
                <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622]">
                  {filteredManual.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">
                        No manual petty cash entries found.
                      </span>
                    </div>
                  ) : (
                    filteredManual.map((item) => (
                      <ManualPettyCashRow
                        key={item._id}
                        item={item}
                        currency={currency}
                        isOpen={expandedRowId === item._id}
                        onToggle={() =>
                          setExpandedRowId(
                            expandedRowId === item._id ? null : item._id,
                          )
                        }
                      />
                    ))
                  )}
                </div>
              )}

              {activeTab === "all" && (
                <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622]">
                  {filteredAllocations.length === 0 &&
                  filteredExpenses.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">No activity found.</span>
                    </div>
                  ) : (
                    <>
                      {/* Expenses first (recent) */}
                      {filteredExpenses.slice(0, 10).map((exp) => (
                        <ExpenseRow
                          key={exp._id}
                          expense={exp}
                          currency={currency}
                          isOpen={expandedRowId === exp._id}
                          onToggle={() =>
                            setExpandedRowId(
                              expandedRowId === exp._id ? null : exp._id,
                            )
                          }
                        />
                      ))}
                      {/* Then allocations */}
                      {filteredAllocations.slice(0, 5).map((alloc) => (
                        <AllocationRow
                          key={alloc._id}
                          allocation={alloc}
                          currency={currency}
                          isOpen={expandedRowId === alloc._id}
                          onToggle={() =>
                            setExpandedRowId(
                              expandedRowId === alloc._id ? null : alloc._id,
                            )
                          }
                        />
                      ))}
                      {filteredAllocations.length > 5 && (
                        <div className="px-5 py-3 text-center">
                          <button
                            onClick={() => setActiveTab("allocations")}
                            className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            View all {filteredAllocations.length} allocations →
                          </button>
                        </div>
                      )}
                      {filteredExpenses.length > 10 && (
                        <div className="px-5 py-3 text-center border-t border-[#EDE7DA] dark:border-[#1a2622]">
                          <button
                            onClick={() => setActiveTab("expenses")}
                            className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            View all {filteredExpenses.length} expenses →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Pagination footer */}
        {!activeLoading &&
          !activeError &&
          activePagination &&
          activePagination.totalResults > 0 && (
            <div className="px-5 py-4 border-t border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#111d19] flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">
                Showing{" "}
                <span className="text-stone-600 dark:text-stone-300 font-semibold">
                  {from}–{to}
                </span>{" "}
                of{" "}
                <span className="text-stone-600 dark:text-stone-300 font-semibold">
                  {activePagination.totalResults}
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={activePrevPage}
                  disabled={activePage <= 1}
                  className="w-8 h-8 rounded-full border border-[#EDE7DA] dark:border-[#1a2622] flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm dark:shadow-black/20"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 px-2">
                  Page {activePagination.currentPage || 1} of{" "}
                  {activePagination.totalPages || 1}
                </span>

                <button
                  onClick={activeNextPage}
                  disabled={!activePagination.hasMore}
                  className="w-8 h-8 rounded-full border border-[#EDE7DA] dark:border-[#1a2622] flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm dark:shadow-black/20"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
      </div>

      {showAddModal && (
        <NewPettyCashModal
          onClose={() => setShowAddModal(false)}
          onSave={handleAddPettyCash}
          saving={saving}
        />
      )}

      {showAddExpenseModal && (
        <NewExpenseModal
          onClose={() => setShowAddExpenseModal(false)}
          onSave={handleAddExpense}
          saving={expenseSaving}
        />
      )}
    </div>
  );
};

export default PettyCashTab;

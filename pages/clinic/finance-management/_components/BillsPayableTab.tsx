import React, { useState } from "react";
import {
  Search,
  Plus,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Inbox,
  Paperclip,
  Receipt,
  Clock,
  CalendarClock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Ban,
  FileText,
  DollarSign,
} from "lucide-react";
import useBillsPayable, {
  BillData,
  BillStatus,
  BillStatusFilter,
} from "../_hooks/useBillsPayable";
import StatCard from "./StatCard";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney } from "@/lib/currencyHelper";

const formatDate = (d?: string): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

// ============================================================
// STATUS PILL — bill-specific (draft/pending/upcoming/partial/paid/overdue/cancelled)
// Kept local to this file — doesn't touch the 3-state StatusPill in FinanceManager.tsx
// ============================================================
const STATUS_META: Record<
  BillStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  draft: {
    label: "Draft",
    dot: "bg-stone-400",
    text: "text-stone-600 dark:text-stone-300",
    bg: "bg-stone-100 dark:bg-stone-800",
  },
  pending: {
    label: "Pending",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950",
  },
  partial: {
    label: "Partial",
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-50 dark:bg-violet-950",
  },
  paid: {
    label: "Paid",
    dot: "bg-teal-500",
    text: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950",
  },
  overdue: {
    label: "Overdue",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-stone-300",
    text: "text-stone-400 dark:text-stone-500",
    bg: "bg-stone-100 dark:bg-stone-800",
  },
};

function BillStatusPill({ status }: { status: BillStatus }) {
  const s = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ============================================================
// STATUS FILTER PILLS
// ============================================================
const STATUS_TABS: { value: BillStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "upcoming", label: "Upcoming" },
  { value: "partial", label: "Partial" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

// ============================================================
// BILL ROW — expandable, mirrors AllocationRow/ExpenseRow pattern
// ============================================================
function BillRow({
  bill,
  currency,
  onCancel,
}: {
  bill: BillData;
  currency: string;
  onCancel: (bill: BillData) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const supplierName =
    typeof bill.supplierId === "string" ? "—" : bill.supplierId?.name || "—";

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <div
        className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
            <Receipt className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
                {supplierName}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-500 zfm-mono">
                {bill.invoiceNumber}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
              <span>{bill.category}</span>
              <span>•</span>
              <span>Due {formatDate(bill.dueDate)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <BillStatusPill status={bill.status} />
          <div className="text-right">
            <div className="font-mono font-semibold text-sm text-stone-800 dark:text-stone-100">
              {formatMoney(bill.amount, currency)}
            </div>
            {bill.balance > 0 && (
              <div className="text-[11px] text-rose-500 dark:text-rose-400 zfm-mono">
                {formatMoney(bill.balance, currency)} due
              </div>
            )}
          </div>
          <ChevronRight
            className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </div>
      {expanded && (
        <div className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-stone-400 dark:text-stone-500">
                Supplier invoice #:
              </span>
              <span className="ml-2 font-mono text-stone-600 dark:text-stone-300">
                {bill.supplierInvoiceNumber || "—"}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">
                Invoice date:
              </span>
              <span className="ml-2 text-stone-600 dark:text-stone-300">
                {formatDate(bill.invoiceDate)}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">
                Paid so far:
              </span>
              <span className="ml-2 font-mono text-teal-600 dark:text-teal-400">
                {formatMoney(bill.paidAmount, currency)}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">
                Attachments:
              </span>
              {bill.attachments && bill.attachments.length > 0 ? (
                <span className="ml-2 inline-flex items-center gap-1">
                  <Paperclip className="w-3 h-3 text-stone-400 dark:text-stone-500" />
                  {bill.attachments.map((url, i) => (
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
                </span>
              ) : (
                <span className="ml-2 text-[11px] text-stone-300 dark:text-stone-600">
                  None
                </span>
              )}
            </div>
            {bill.notes && (
              <div className="col-span-2">
                <span className="text-stone-400 dark:text-stone-500">
                  Notes:
                </span>
                <span className="ml-2 text-stone-600 dark:text-stone-300">
                  {bill.notes}
                </span>
              </div>
            )}
          </div>
          {bill.status !== "paid" && bill.status !== "cancelled" && (
            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel(bill);
                }}
                className="text-xs font-semibold text-rose-500 dark:text-rose-400 hover:underline"
              >
                Cancel bill
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// NEW BILL MODAL
// ============================================================
function NewBillModal({
  onClose,
  onSave,
  categories,
  saving,
}: {
  onClose: () => void;
  onSave: (input: any) => Promise<{ ok: boolean; warning?: string }>;
  categories: string[];
  saving: boolean;
}) {
  const [form, setForm] = useState({
    supplierId: "",
    category: categories.find((c) => c !== "All") || "Rent",
    supplierInvoiceNumber: "",
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    amount: "",
    notes: "",
  });
  const [warning, setWarning] = useState<string | null>(null);

  const submit = async () => {
    setWarning(null);
    const amountNum = Number(form.amount);
    if (!form.supplierId || !amountNum || amountNum <= 0) {
      setWarning("Supplier and a valid amount are required");
      return;
    }
    const result = await onSave({
      ...form,
      amount: amountNum,
    });
    if (!result.ok) {
      setWarning(result.warning || "Could not save the bill");
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 z-50"
      style={{
        backgroundColor: "rgba(19,42,39,0.5)",
        backdropFilter: "blur(3px)",
      }}
    >
      <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-md p-8 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-sm"
              style={{
                backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
              }}
            >
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-teal-600 dark:text-teal-400 uppercase tracking-widest mb-0.5">
                New Payable
              </div>
              <h3 className="zfm-display text-xl font-semibold text-stone-900 dark:text-stone-50">
                Add Bill
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-600 dark:hover:text-stone-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {warning && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 text-xs font-medium">
            {warning}
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
              Supplier ID
            </label>
            <input
              value={form.supplierId}
              onChange={(e) =>
                setForm((f) => ({ ...f, supplierId: e.target.value }))
              }
              placeholder="Paste supplier ID"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 transition-all"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
              Amount (₹)
            </label>
            <input
              type="number"
              value={form.amount}
              onChange={(e) =>
                setForm((f) => ({ ...f, amount: e.target.value }))
              }
              placeholder="0"
              className="w-full px-4 py-3 text-lg rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 zfm-mono font-semibold transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Category
              </label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value }))
                }
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400"
              >
                {categories
                  .filter((c) => c !== "All")
                  .map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Supplier invoice #
              </label>
              <input
                value={form.supplierInvoiceNumber}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    supplierInvoiceNumber: e.target.value,
                  }))
                }
                placeholder="e.g. INV1025"
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Invoice date
              </label>
              <input
                type="date"
                value={form.invoiceDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, invoiceDate: e.target.value }))
                }
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 zfm-mono"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Due date
              </label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, dueDate: e.target.value }))
                }
                className="w-full px-3 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 zfm-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
              Notes
            </label>
            <input
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Optional"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 transition-all"
            />
          </div>
        </div>

        <div className="flex gap-2.5 mt-7">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 py-3 rounded-full text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
            }}
          >
            {saving ? "Saving…" : "Save bill"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// STATS SECTION
// ============================================================
function StatsSection({
  summary,
  loading,
  currency,
}: {
  summary: {
    totalOutstanding: number;
    overdueCount: number;
    paidThisMonth: number;
    totalBills: number;
  };
  loading: boolean;
  currency: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Outstanding"
        value={formatMoney(summary.totalOutstanding, currency)}
        icon={<Clock />}
        fromColor="#d97706"
        toColor="#f59e0b"
        iconColor="text-white"
        trend="Payable now"
        trendPositive={false}
      />
      <StatCard
        label="Overdue Bills"
        value={summary.overdueCount}
        icon={<AlertTriangle />}
        fromColor="#dc2626"
        toColor="#ef4444"
        iconColor="text-white"
        trend="Needs attention"
        trendPositive={false}
      />
      <StatCard
        label="Paid This Month"
        value={formatMoney(summary.paidThisMonth, currency)}
        icon={<CheckCircle2 />}
        fromColor="#0d9488"
        toColor="#14b8a6"
        iconColor="text-white"
        trend="Settled"
        trendPositive={true}
      />
      <StatCard
        label="Total Bills"
        value={summary.totalBills}
        icon={<FileText />}
        fromColor="#7c3aed"
        toColor="#8b5cf6"
        iconColor="text-white"
        trend="All time"
        trendPositive={true}
      />
    </div>
  );
}

// ============================================================
// MAIN TAB
// ============================================================
const BillsPayableTab: React.FC = () => {
  const { currency } = useCurrency();
  const {
    bills,
    summary,
    categories,
    loading,
    saving,
    error,
    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    pagination,
    nextPage,
    prevPage,
    createBill,
    cancelBill,
  } = useBillsPayable();

  const [showAddModal, setShowAddModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<BillData | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const from = pagination?.totalResults === 0 ? 0 : (page - 1) * 15 + 1;
  const to = Math.min(page * 15, pagination?.totalResults || 0);

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    await cancelBill(cancelTarget._id, cancelReason.trim());
    setCancelTarget(null);
    setCancelReason("");
  };

  return (
    <div className="space-y-7">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
            Bills & Payables
          </h2>
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
            Every invoice the clinic owes — now or later
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-[1.03] active:scale-95 transition-all duration-200"
          style={{
            backgroundImage: "linear-gradient(135deg, #14b8a6, #0f766e)",
          }}
        >
          <Plus className="w-4 h-4" />
          New Bill
        </button>
      </div>

      <StatsSection summary={summary} loading={loading} currency={currency} />

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm dark:shadow-stone-900/20 overflow-hidden transition-colors duration-300">
        {/* Status pill tabs */}
        <div className="border-b border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30">
          <div className="flex items-center gap-1 p-1 overflow-x-auto">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setStatusFilter(t.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  statusFilter === t.value
                    ? "bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 shadow-sm dark:shadow-stone-900/20"
                    : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-white/50 dark:hover:bg-stone-800/50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center gap-2.5 bg-white dark:bg-stone-900">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice or supplier invoice #…"
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 transition-all shadow-sm dark:shadow-stone-900/20"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-stone-900/20"
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-stone-900/20"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-stone-900/20"
          />
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-stone-900">
          {loading && (
            <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600 dark:text-teal-400" />
              <span className="text-sm">Loading…</span>
            </div>
          )}

          {!loading && error && (
            <div className="px-5 py-16 text-center text-rose-500 dark:text-rose-400 text-sm">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="divide-y divide-stone-100 dark:divide-stone-800">
              {bills.length === 0 ? (
                <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                  <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                  <span className="text-sm">No bills found.</span>
                </div>
              ) : (
                bills.map((bill) => (
                  <BillRow
                    key={bill._id}
                    bill={bill}
                    currency={currency}
                    onCancel={setCancelTarget}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {!loading && !error && pagination && pagination.totalResults > 0 && (
          <div className="px-5 py-4 border-t border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-stone-400 dark:text-stone-500 font-medium">
              Showing{" "}
              <span className="text-stone-600 dark:text-stone-300 font-semibold">
                {from}–{to}
              </span>{" "}
              of{" "}
              <span className="text-stone-600 dark:text-stone-300 font-semibold">
                {pagination.totalResults}
              </span>
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={prevPage}
                disabled={page <= 1}
                className="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm dark:shadow-stone-900/20"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-semibold text-stone-600 dark:text-stone-300 px-2">
                Page {pagination.currentPage || 1} of{" "}
                {pagination.totalPages || 1}
              </span>
              <button
                onClick={nextPage}
                disabled={!pagination.hasMore}
                className="w-8 h-8 rounded-full border border-stone-200 dark:border-stone-700 flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm dark:shadow-stone-900/20"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <NewBillModal
          onClose={() => setShowAddModal(false)}
          onSave={createBill}
          categories={categories}
          saving={saving}
        />
      )}

      {cancelTarget && (
        <div
          className="fixed inset-0 flex items-center justify-center p-4 z-50"
          style={{
            backgroundColor: "rgba(19,42,39,0.5)",
            backdropFilter: "blur(3px)",
          }}
        >
          <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-sm p-7 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                <Ban className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              </div>
              <h3 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
                Cancel bill
              </h3>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
              {cancelTarget.invoiceNumber} won't be deleted — it stays in
              history as cancelled.
            </p>
            <input
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason (required)"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900 focus:border-rose-400 transition-all mb-5"
            />
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setCancelTarget(null);
                  setCancelReason("");
                }}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Keep bill
              </button>
              <button
                onClick={handleCancel}
                disabled={!cancelReason.trim()}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Cancel bill
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillsPayableTab;

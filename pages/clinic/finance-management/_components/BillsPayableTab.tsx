import React, { useMemo, useRef, useState } from "react";
import {
  Search,
  Plus,
  X,
  Upload,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
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
  File,
  Image as ImageIcon,
  Info,
} from "lucide-react";
import useBillsPayable, {
  BillData,
  BillStatus,
  BillStatusFilter,
} from "../_hooks/useBillsPayable";
import StatCard from "./StatCard";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney, getCurrencySymbol } from "@/lib/currencyHelper";
import useClinic from "@/hooks/useClinic";
import useSuppliers from "@/hooks/useSuppliers";
import { handleUpload, formatFileSize } from "@/lib/helper";
import { UseFinancePermissionReturn } from "../_hooks/useFinancePermission";

type SupplierStatus = "Active" | "Inactive";

export type Supplier = {
  _id: string;
  code: string;
  clinicId: string;
  branch: any;
  name: string;
  vatRegNo: string;
  telephone: string;
  mobile: string;
  email: string;
  url: string;
  creditDays: number;
  address: string;
  notes: string;
  status: SupplierStatus;
  openingBalance: number;
  openingBalanceType: "Debit" | "Credit";
  invoiceTotal: number;
  totalPaid: number;
  totalBalance: number;
  invoiceCount: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

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
// DETAILS VIEW — mirrors OverviewTab's BillDetailsView style
// ============================================================
function BillDetailsView({
  bill,
  currency,
}: {
  bill: BillData;
  currency: string;
}) {
  const supplierName =
    typeof bill.supplierId === "string" ? "—" : bill.supplierId?.name || "—";
  const paidPct = bill.amount > 0 ? (bill.paidAmount / bill.amount) * 100 : 0;
  const balancePct = bill.amount > 0 ? (bill.balance / bill.amount) * 100 : 0;

  const fields: Array<{
    label: string;
    value?: React.ReactNode;
    icon: React.ReactNode;
    accent?: string;
    span?: 1 | 2;
  }> = [
    {
      label: "Supplier invoice #",
      value: bill.supplierInvoiceNumber ? (
        <span className="font-mono">{bill.supplierInvoiceNumber}</span>
      ) : (
        <span className="text-stone-300 dark:text-stone-600">—</span>
      ),
      icon: <Receipt className="w-3.5 h-3.5" />,
      accent: "from-violet-50 to-white dark:from-violet-950/40",
    },
    {
      label: "Invoice date",
      value: formatDate(bill.invoiceDate),
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      accent: "from-sky-50 to-white dark:from-sky-950/40",
    },
    {
      label: "Category",
      value: bill.category || "—",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      accent: "from-amber-50 to-white dark:from-amber-950/40",
    },
    {
      label: "Due date",
      value: formatDate(bill.dueDate),
      icon: <Clock className="w-3.5 h-3.5" />,
      accent: "from-rose-50 to-white dark:from-rose-950/40",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Amount bar — structured like OverviewTab */}
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
          <span className="text-teal-600 dark:text-teal-400">
            {paidPct.toFixed(1)}% settled
          </span>
          {bill.balance > 0 && (
            <span className="text-orange-500 dark:text-orange-400">
              {balancePct.toFixed(1)}% due
            </span>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div
            key={f.label}
            className={`rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br ${f.accent} p-3.5`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-white dark:bg-stone-800/70 flex items-center justify-center text-stone-500 dark:text-stone-400 shadow-sm">
                {f.icon}
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                {f.label}
              </span>
            </div>
            <div className="text-sm font-medium text-stone-700 dark:text-stone-200 pl-[26px]">
              {f.value}
            </div>
          </div>
        ))}

        {/* Supplier — spans full width */}
        <div className="sm:col-span-2 rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/30 p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-white dark:bg-stone-800/70 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
              <Receipt className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              Supplier
            </span>
          </div>
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 pl-[26px]">
            {supplierName}
          </div>
        </div>
      </div>

      {/* Attachments */}
      {bill.attachments && bill.attachments.length > 0 && (
        <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-white dark:bg-stone-800/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
              <Paperclip className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Attachments · {bill.attachments.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {bill.attachments.map((url, i) => {
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
                  className="group flex items-center gap-2 rounded-lg border border-stone-100 dark:border-stone-700/60 bg-stone-50 dark:bg-stone-800/40 hover:bg-white dark:hover:bg-stone-800 p-2.5 transition-colors"
                >
                  <div className="w-9 h-9 rounded-md bg-white dark:bg-stone-900 flex items-center justify-center shrink-0 border border-stone-100 dark:border-stone-700/60 overflow-hidden">
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
      )}

      {/* Notes */}
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
  );
}

// ============================================================
// BILL ROW — expandable, mirrors OverviewTab Recent Activity pattern
// Accordion: parent controls expandedId → ONE row open at a time
// ============================================================
function BillRow({
  bill,
  currency,
  isOpen,
  onToggle,
  onCancel,
}: {
  bill: BillData;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
  onCancel: (bill: BillData) => void;
}) {
  const supplierName =
    typeof bill.supplierId === "string" ? "—" : bill.supplierId?.name || "—";

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-3  transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
          <Receipt className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
            {supplierName}
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span className="font-mono">{bill.invoiceNumber}</span>
            <span>·</span>
            <span>{bill.category}</span>
            <span>·</span>
            <span>Due {formatDate(bill.dueDate)}</span>
          </div>
        </div>
        <BillStatusPill status={bill.status} />
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
            <ChevronDown className="w-4 h-4 text-teal-500 dark:text-teal-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600" />
          )}
        </div>
      </button>

      {/* Smooth expand/collapse — identical to OverviewTab */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2 pb-5 pl-13 ml-13 relative">
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-teal-200 dark:from-teal-900 to-transparent" />
            <div className="ml-9 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-5">
              <BillDetailsView bill={bill} currency={currency} />

              {/* Cancel bill CTA */}
              {bill.status !== "paid" && bill.status !== "cancelled" && (
                <div className="mt-5 pt-4 border-t border-stone-100 dark:border-stone-700/60 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-stone-500">
                    <Info className="w-3.5 h-3.5" />
                    Cancelling keeps history — it doesn&apos;t delete the
                    record.
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel(bill);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3.5 py-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 transition-colors"
                  >
                    <Ban className="w-3 h-3" />
                    Cancel bill
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NEW BILL MODAL — premium, wide, searchable-select driven
// ============================================================
const todayStr = () => new Date().toISOString().slice(0, 10);

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
  const { clinic } = useClinic();
  const { currency } = useCurrency();
  const symbol = getCurrencySymbol(currency);
  const [supplierSearch, setSupplierSearch] = useState("");
  const { suppliers, loading: suppliersLoading } = useSuppliers({
    branchId: clinic?._id || "",
    search: supplierSearch,
  }) as { suppliers: Supplier[]; loading: boolean };

  const [form, setForm] = useState({
    supplierId: "",
    category: categories.find((c) => c !== "All") || "Rent",
    supplierInvoiceNumber: "",
    invoiceDate: todayStr(),
    dueDate: "",
    amount: "",
    notes: "",
    attachments: [] as string[],
  });
  const [warning, setWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<
    Array<{ id: string; name: string; progress: number; size: number }>
  >([]);

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

  const categoryOptions = categories
    .filter((c) => c !== "All")
    .map((c) => ({ value: c, label: c }));

  const amountNum = Number(form.amount);
  const canSave = useMemo(() => {
    return (
      !!form.supplierId &&
      !!form.category &&
      !!form.invoiceDate &&
      !!form.dueDate &&
      amountNum > 0 &&
      new Date(form.dueDate) >= new Date(form.invoiceDate) &&
      !saving
    );
  }, [form, amountNum, saving]);

  const handleAttachFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    // Create temp trackers
    const trackers = list.map((f) => ({
      id: `${Date.now()}-${f.name}-${Math.random().toString(36).slice(2, 8)}`,
      name: f.name,
      progress: 5,
      size: f.size,
    }));
    setUploadingFiles((prev) => [...prev, ...trackers]);

    const results: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      const trackerId = trackers[i].id;
      try {
        const data = await handleUpload(file);
        const url = data?.url || data?.data?.url || data?.data?.data?.url;
        if (url) results.push(url);
        setUploadingFiles((prev) =>
          prev.map((t) => (t.id === trackerId ? { ...t, progress: 100 } : t)),
        );
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        // remove tracker after small delay so user sees "100%"
        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((t) => t.id !== trackerId));
        }, 400);
      }
    }

    if (results.length > 0) {
      setForm((f) => ({
        ...f,
        attachments: [...f.attachments, ...results],
      }));
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setForm((f) => ({
      ...f,
      attachments: f.attachments.filter((_, i) => i !== index),
    }));
  };

  const submit = async () => {
    setWarning(null);
    if (!canSave) {
      setWarning(
        "Supplier, category, amount, invoice date and due date are required",
      );
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
      className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 z-50"
      style={{
        backgroundColor: "rgba(19,42,39,0.55)",
        backdropFilter: "blur(6px)",
      }}
    >
      <div className="relative bg-white dark:bg-stone-900 rounded-3xl w-full max-w-5xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)] border border-stone-100 dark:border-stone-800 max-h-[92vh] flex flex-col overflow-hidden">
        {/* ============ STICKY HEADER ============ */}
        <div
          className="relative px-6 sm:px-8 py-6 shrink-0 overflow-hidden border-b border-stone-100/60 dark:border-stone-800/60"
          style={{
            backgroundImage:
              "linear-gradient(135deg, rgba(20,184,166,0.14), rgba(15,118,110,0.05) 55%, rgba(255,255,255,0) 100%)",
          }}
        >
          <div
            className="absolute -right-20 -top-24 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-80"
            style={{
              background:
                "radial-gradient(circle, rgba(20,184,166,0.22), transparent 65%)",
            }}
          />
          <div
            className="absolute -left-16 bottom-0 w-56 h-56 rounded-full blur-3xl pointer-events-none opacity-60"
            style={{
              background:
                "radial-gradient(circle, rgba(99,102,241,0.16), transparent 70%)",
            }}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div
                  className="absolute inset-0 rounded-[20px] blur-md opacity-50"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
                  }}
                />
                <div
                  className="relative w-14 h-14 rounded-[20px] flex items-center justify-center shadow-lg shrink-0 ring-1 ring-white/40"
                  style={{
                    backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
                  }}
                >
                  <Receipt className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/80 dark:bg-teal-900/40 px-2.5 py-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-[0.14em] mb-1.5">
                  <DollarSign className="w-3 h-3" />
                  New Payable
                </div>
                <h3 className="zfm-display text-2xl sm:text-[28px] font-semibold text-stone-900 dark:text-stone-50 leading-[1.1]">
                  Add a Bill
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
                  Record a supplier invoice — the clinic will pay it on or
                  before the due date.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center text-stone-400 dark:text-stone-500 hover:bg-white dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200 transition-all border border-stone-200/60 dark:border-stone-700/60 bg-white/50 dark:bg-stone-800/40 backdrop-blur shadow-sm hover:shadow-md"
              title="Close"
            >
              <X className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* ============ SCROLLABLE BODY ============ */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 sm:py-7 bg-gradient-to-b from-stone-50/40 via-white to-white dark:from-stone-900 dark:via-stone-900 dark:to-stone-900">
          {warning && (
            <div className="mb-6 px-4 py-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5 shadow-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {/* CARD: Supplier & Amount — hero row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Who is it from?
                </h4>
              </div>
              <SearchableSelect
                label="Supplier"
                required
                icon={<Receipt className="w-3.5 h-3.5 text-stone-400" />}
                options={supplierOptions}
                value={form.supplierId}
                onChange={(v) => setForm((f) => ({ ...f, supplierId: v }))}
                onSearchChange={setSupplierSearch}
                loading={suppliersLoading}
                placeholder="Choose a supplier"
                searchPlaceholder="Search suppliers by name, code, phone…"
                emptyText="No suppliers found"
              />
            </div>

            <div
              className="p-4 sm:p-5 rounded-2xl border shadow-sm relative overflow-hidden"
              style={{
                backgroundImage:
                  "linear-gradient(160deg, rgba(20,184,166,0.08), rgba(20,184,166,0.02) 60%)",
                borderColor: "rgba(20,184,166,0.25)",
              }}
            >
              <div
                className="absolute -right-8 -bottom-10 w-40 h-40 rounded-full blur-2xl opacity-60 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(20,184,166,0.25), transparent 60%)",
                }}
              />
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-100 dark:bg-teal-900/60 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-teal-700 dark:text-teal-300" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Amount Due
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
                  value={form.amount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, amount: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full pl-9 pr-4 py-3.5 text-2xl rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono font-bold transition-all shadow-inner"
                />
              </div>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2">
                Enter the total on the supplier invoice — including taxes.
              </p>
            </div>
          </div>

          {/* CARD: Invoice Details */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm mb-5">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-900/40 flex items-center justify-center">
                <CalendarClock className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Invoice Details
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <SearchableSelect
                  label="Category"
                  required
                  options={categoryOptions}
                  value={form.category}
                  onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  placeholder="Choose a category"
                  searchPlaceholder="Search categories…"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Supplier invoice #
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={form.supplierInvoiceNumber}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        supplierInvoiceNumber: e.target.value,
                      }))
                    }
                    placeholder="e.g. INV1025"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Invoice date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <CalendarClock className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={form.invoiceDate}
                    max={todayStr()}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        invoiceDate: e.target.value,
                        dueDate:
                          f.dueDate && f.dueDate < e.target.value
                            ? ""
                            : f.dueDate,
                      }))
                    }
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono transition-all"
                  />
                </div>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                  When the supplier raised it — today or earlier.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Due date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Clock className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    required
                    value={form.dueDate}
                    min={form.invoiceDate || todayStr()}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dueDate: e.target.value }))
                    }
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono transition-all"
                  />
                </div>
                <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                  On or after the invoice date.
                </p>
              </div>
            </div>
          </div>

          {/* CARD: Attachments */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm mb-5">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-900/40 flex items-center justify-center">
                <Paperclip className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Attachments
              </h4>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto">
                Optional · Scanned bill, PO, signed challan…
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={(e) => handleAttachFiles(e.target.files)}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full group relative p-5 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/30 hover:bg-stone-50 dark:hover:bg-stone-800/60 hover:border-teal-400/60 dark:hover:border-teal-500/50 transition-all flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-stone-400 hover:text-teal-600 dark:hover:text-teal-400"
            >
              <div className="w-10 h-10 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 group-hover:border-teal-200 dark:group-hover:border-teal-800 flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
                <Upload className="w-5 h-5" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold">
                  Click to upload bill copy
                </div>
                <div className="text-[11px] mt-0.5 text-stone-400 dark:text-stone-500 group-hover:text-stone-500 dark:group-hover:text-stone-400">
                  Drop or select PDFs, images, docs — multiple files allowed
                </div>
              </div>
            </button>

            {/* Uploading progress rows */}
            {uploadingFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadingFiles.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700"
                  >
                    <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
                      <Loader2 className="w-4 h-4 text-teal-600 dark:text-teal-400 animate-spin" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate">
                        {t.name}
                      </div>
                      <div className="mt-1 h-1 w-full rounded-full bg-stone-200 dark:bg-stone-700 overflow-hidden">
                        <div
                          className="h-full bg-teal-500 transition-all"
                          style={{ width: `${t.progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-stone-400 dark:text-stone-500 shrink-0">
                      {formatFileSize(t.size)}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Uploaded attachments */}
            {form.attachments.length > 0 && (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {form.attachments.map((url, idx) => {
                  const name =
                    decodeURIComponent(
                      (url.split("/").pop() || `attachment-${idx + 1}`)
                        .split("?")[0]
                        .replace(/^[a-f0-9]+_?/i, ""),
                    ) || `Attachment ${idx + 1}`;
                  const isImage =
                    /\.(jpg|jpeg|png|gif|webp|bmp|svg|heic|heif)$/i.test(name);
                  return (
                    <div
                      key={`${url}-${idx}`}
                      className="group flex items-center gap-3 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 hover:border-teal-300 dark:hover:border-teal-700/60 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 transition-all"
                    >
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          isImage
                            ? "bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                            : "bg-stone-100 dark:bg-stone-700/60 text-stone-500 dark:text-stone-400"
                        }`}
                      >
                        {isImage ? (
                          <ImageIcon className="w-4 h-4" />
                        ) : (
                          <File className="w-4 h-4" />
                        )}
                      </div>
                      <a
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 min-w-0 text-xs font-medium text-stone-700 dark:text-stone-200 hover:text-teal-600 dark:hover:text-teal-400 hover:underline truncate"
                      >
                        {name.length > 38 ? name.slice(0, 36) + "…" : name}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="w-7 h-7 rounded-lg opacity-70 group-hover:opacity-100 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-stone-400 hover:text-rose-500 dark:text-stone-500 dark:hover:text-rose-400 flex items-center justify-center transition-all shrink-0"
                        title="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* CARD: Notes */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm">
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
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="Any context the finance team should know — partial payment terms, PO reference, approval note, etc."
              rows={3}
              className="w-full px-4 py-3 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* ============ STICKY FOOTER ============ */}
        <div className="shrink-0 px-6 sm:px-8 py-4 sm:py-5 border-t border-stone-100 dark:border-stone-800 bg-gradient-to-t from-stone-50 via-white to-white dark:from-stone-900 dark:via-stone-900 dark:to-stone-900">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex flex-col gap-1">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                Saved bills appear under{" "}
                <span className="font-semibold text-stone-500 dark:text-stone-400">
                  Pending
                </span>{" "}
                by default.
              </div>
              {!canSave && !saving && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Fill all required fields to save the bill.
                </div>
              )}
            </div>
            <div className="flex gap-3 ml-auto w-full sm:w-auto">
              <button
                onClick={onClose}
                className="flex-1 sm:flex-none px-5 sm:px-6 py-3 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-all shadow-sm hover:shadow"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={!canSave || saving}
                className="relative flex-1 sm:flex-none px-6 sm:px-8 py-3 rounded-full text-sm font-semibold text-white shadow-[0_10px_30px_-10px_rgba(20,184,166,0.6)] hover:shadow-[0_16px_36px_-12px_rgba(20,184,166,0.7)] hover:scale-[1.02] active:scale-95 transition-all duration-200 disabled:grayscale disabled:opacity-50 disabled:pointer-events-none disabled:hover:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
                style={{
                  backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
                }}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Save bill
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
const BillsPayableTab: React.FC<UseFinancePermissionReturn> = ({
  permissions,
  permissionsLoaded,
  AccessDenied,
  PermissionLoading,
  canAccessPage,
}) => {
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
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  const from = pagination?.totalResults === 0 ? 0 : (page - 1) * 15 + 1;
  const to = Math.min(page * 15, pagination?.totalResults || 0);

  const handleCancel = async () => {
    if (!cancelTarget || !cancelReason.trim()) return;
    await cancelBill(cancelTarget._id, cancelReason.trim());
    setCancelTarget(null);
    setCancelReason("");
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
            Bills & Payables
          </h2>
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
            Every invoice the clinic owes — now or later
          </p>
        </div>
        {permissions.canCreate && (
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
        )}
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
                bills.map((bill) => {
                  const isOpen = expandedBillId === bill._id;
                  return (
                    <BillRow
                      key={bill._id}
                      bill={bill}
                      currency={currency}
                      isOpen={isOpen}
                      onToggle={() =>
                        setExpandedBillId(isOpen ? null : bill._id)
                      }
                      onCancel={setCancelTarget}
                    />
                  );
                })
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

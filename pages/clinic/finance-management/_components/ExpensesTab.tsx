import React, { useRef, useState } from "react";
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
  Coins,
  CalendarClock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Banknote,
  Landmark,
  FileCheck2,
  CreditCard,
  Globe,
  Wallet,
  File,
  Clock,
  Receipt,
  Sparkles,
} from "lucide-react";
import useExpenses, { ExpenseData, ExpenseMethod } from "../_hooks/useExpenses";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney, getCurrencySymbol } from "@/lib/currencyHelper";
// import useBankAccounts from "@/hooks/useBankAccounts";
import { handleUpload } from "@/lib/helper";
import { UseFinancePermissionReturn } from "../_hooks/useFinancePermission";

const formatDate = (d?: string): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const todayStr = () => new Date().toISOString().slice(0, 10);

const PAYMENT_METHODS: { value: ExpenseMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online" },
  { value: "petty_cash", label: "Petty Cash" },
];

const METHOD_META: Record<
  ExpenseMethod,
  { label: string; icon: React.ElementType; text: string; bg: string }
> = {
  cash: {
    label: "Cash",
    icon: Banknote,
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
  },
  bank_transfer: {
    label: "Bank Transfer",
    icon: Landmark,
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950/40",
  },
  cheque: {
    label: "Cheque",
    icon: FileCheck2,
    text: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-50 dark:bg-violet-950/40",
  },
  card: {
    label: "Card",
    icon: CreditCard,
    text: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-950/40",
  },
  online: {
    label: "Online",
    icon: Globe,
    text: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950/40",
  },
  petty_cash: {
    label: "Petty Cash",
    icon: Wallet,
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950/40",
  },
};

function MethodPill({ method }: { method: ExpenseMethod }) {
  const m = METHOD_META[method];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${m.bg} ${m.text}`}
    >
      <Icon className="w-3 h-3" />
      {m.label}
    </span>
  );
}

// ============================================================
// DETAILS VIEW — mirrors BillDetailsView style for Expenses
// ============================================================
function ExpenseDetailsView({
  expense,
  currency,
}: {
  expense: ExpenseData;
  currency: string;
}) {
  const methodLabel = expense.payment
    ? METHOD_META[expense.payment.method].label
    : "—";
  const methodIcon = expense.payment
    ? METHOD_META[expense.payment.method].icon
    : Wallet;

  const allAttachments: string[] = [];
  if (expense.payment?.attachment)
    allAttachments.push(expense.payment.attachment);
  if (expense.attachments?.length) allAttachments.push(...expense.attachments);

  const fields: Array<{
    label: string;
    value?: React.ReactNode;
    icon: React.ReactNode;
    accent?: string;
    span?: 1 | 2;
  }> = [
    {
      label: "Payment #",
      value: expense.payment?.paymentNumber ? (
        <span className="font-mono">{expense.payment.paymentNumber}</span>
      ) : (
        <span className="text-stone-300 dark:text-stone-600">—</span>
      ),
      icon: <Receipt className="w-3.5 h-3.5" />,
      accent:
        "from-violet-50 to-white dark:from-violet-950/30 dark:to-[#111d19]",
    },
    {
      label: "Payment date",
      value: formatDate(expense.invoiceDate),
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      accent: "from-sky-50 to-white dark:from-sky-950/30 dark:to-[#111d19]",
    },
    {
      label: "Category",
      value: expense.category || "—",
      icon: <TrendingUp className="w-3.5 h-3.5" />,
      accent: "from-amber-50 to-white dark:from-amber-950/30 dark:to-[#111d19]",
    },
    {
      label: "Payment method",
      value: (
        <span className="inline-flex items-center gap-1.5 font-medium text-stone-700 dark:text-stone-200">
          {React.createElement(methodIcon, { className: "w-3.5 h-3.5" })}
          {methodLabel}
        </span>
      ),
      icon: <Wallet className="w-3.5 h-3.5" />,
      accent: "from-rose-50 to-white dark:from-rose-950/30 dark:to-[#111d19]",
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Settlement
          </span>
          <div className="flex items-center gap-3 text-[11px] font-mono font-semibold">
            <span className="text-teal-600 dark:text-teal-400">
              {formatMoney(expense.paidAmount, currency)} paid
            </span>
            <span className="text-stone-300 dark:text-stone-600">of</span>
            <span className="text-stone-700 dark:text-stone-200">
              {formatMoney(expense.amount, currency)}
            </span>
          </div>
        </div>
        <div className="relative w-full h-2 rounded-full bg-[#F1ECE0] dark:bg-[#16231f] overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-teal-500"
            style={{ width: "100%" }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span className="text-teal-600 dark:text-teal-400">
            100.0% settled · Paid instantly
          </span>
          <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400">
            <CheckCircle2 className="w-3 h-3" /> No balance due
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields.map((f) => (
          <div
            key={f.label}
            className={`rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-gradient-to-br ${f.accent} p-3.5`}
          >
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-white dark:bg-[#1c2a25] flex items-center justify-center text-stone-500 dark:text-stone-400 shadow-sm">
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

        <div className="sm:col-span-2 rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/20 dark:to-[#111d19] p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-white dark:bg-[#1c2a25] flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
              <Clock className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              Recorded at
            </span>
          </div>
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 pl-[26px]">
            {expense.createdAt
              ? new Date(expense.createdAt).toLocaleString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : "—"}
          </div>
        </div>
      </div>

      {allAttachments.length > 0 && (
        <div className="rounded-xl border border-[#EDE7DA] dark:border-[#1f2e29]/60 bg-white dark:bg-[#111d19] p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
              <Paperclip className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Attachments · {allAttachments.length}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {allAttachments.map((url, i) => {
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
      )}

      {expense.notes && (
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
            {expense.notes}
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// EXPENSE ROW — flexible icon-row layout, same shape as
// Bills/Petty Cash rows (not a strict column grid)
// ============================================================
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
  const attachmentCount =
    (expense.payment?.attachment ? 1 : 0) + (expense.attachments?.length || 0);

  return (
    <div className="border-b border-[#EDE7DA] dark:border-[#1a2622] last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f]/60 rounded-xl px-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-rose-50 dark:bg-rose-950/40 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
          <Coins className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
            {expense.category}
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span>{formatDate(expense.invoiceDate)}</span>
            {expense.notes && (
              <>
                <span>·</span>
                <span className="truncate">{expense.notes}</span>
              </>
            )}
            {attachmentCount > 0 && (
              <span className="inline-flex items-center gap-0.5 shrink-0">
                <Paperclip className="w-3 h-3" />
                {attachmentCount}
              </span>
            )}
          </div>
        </div>
        {expense.payment ? (
          <MethodPill method={expense.payment.method} />
        ) : (
          <span className="text-xs text-stone-400 dark:text-stone-500">—</span>
        )}
        <div className="text-right shrink-0 min-w-[108px]">
          <div className="font-mono font-semibold text-rose-600 dark:text-rose-400 text-sm">
            −{formatMoney(expense.amount, currency)}
          </div>
          <div className="text-[10px] text-teal-600 dark:text-teal-400 zfm-mono font-semibold">
            Paid instantly
          </div>
        </div>
        <div
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-90" : ""
          }`}
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-rose-500 dark:text-rose-400" />
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
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-rose-200 dark:from-rose-900 to-transparent" />
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
// NEW EXPENSE MODAL — premium, wide, same shape as NewPaymentModal
// ============================================================
function NewExpenseModal({
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
  const { currency } = useCurrency();
  const symbol = getCurrencySymbol(currency);
  //   const { bankAccounts, loading: banksLoading } = useBankAccounts() as {
  //     bankAccounts: { _id: string; bankName: string; accountNumber?: string }[];
  //     loading: boolean;
  //   };
  const bankAccounts: any[] = [];
  const banksLoading = false;

  const [form, setForm] = useState({
    category: categories.find((c) => c !== "All") || "Office",
    amount: "",
    method: "cash" as ExpenseMethod,
    bankAccountId: "",
    chequeNumber: "",
    payee: "",
    chequeDate: todayStr(),
    date: todayStr(),
    notes: "",
    attachment: "",
  });
  const [warning, setWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const categoryOptions = categories
    .filter((c) => c !== "All")
    .map((c) => ({ value: c, label: c }));
  const methodOptions = PAYMENT_METHODS.map((m) => ({
    value: m.value,
    label: m.label,
  }));
  const bankOptions = bankAccounts.map((a) => ({
    value: a._id,
    label: a.bankName,
    sublabel: a.accountNumber,
  }));

  const needsBank = form.method === "bank_transfer" || form.method === "cheque";
  const needsCheque = form.method === "cheque";

  const amountNum = Number(form.amount);
  const canSave =
    !!form.category &&
    amountNum > 0 &&
    !!form.date &&
    (!needsBank || !!form.bankAccountId) &&
    (!needsCheque || (!!form.chequeNumber && !!form.chequeDate)) &&
    !saving;

  const handleAttach = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const data = await handleUpload(files[0]);
      const url = data?.url || data?.data?.url || data?.data?.data?.url;
      if (url) setForm((f) => ({ ...f, attachment: url }));
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const submit = async () => {
    setWarning(null);
    if (!canSave) {
      setWarning("Fill in the required fields to record this expense");
      return;
    }
    const result = await onSave({
      category: form.category,
      amount: amountNum,
      method: form.method,
      bankAccountId: needsBank ? form.bankAccountId : undefined,
      chequeDetails: needsCheque
        ? {
            chequeNumber: form.chequeNumber,
            payee: form.payee || undefined,
            chequeDate: form.chequeDate,
          }
        : undefined,
      date: form.date,
      notes: form.notes || undefined,
      attachment: form.attachment || undefined,
    });
    if (!result.ok) {
      setWarning(result.warning || "Could not record the expense");
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
      <div className="relative bg-white dark:bg-[#111d19] rounded-3xl w-full max-w-4xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)] border border-[#EDE7DA] dark:border-[#1a2622] max-h-[92vh] flex flex-col overflow-hidden">
        {/* STICKY HEADER */}
        <div className="relative px-6 sm:px-8 py-6 shrink-0 border-b border-[#EDE7DA]/60 dark:border-[#1a2622]/60">
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-[20px] flex items-center justify-center shadow-sm shrink-0 bg-teal-600 dark:bg-teal-500">
                <Coins className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 dark:bg-teal-950/40 px-2.5 py-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-[0.14em] mb-1.5">
                  <DollarSign className="w-3 h-3" />
                  Instant Expense
                </div>
                <h3 className="zfm-display text-2xl sm:text-[28px] font-semibold text-stone-900 dark:text-stone-50 leading-[1.1]">
                  Add Expense
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
                  No due date — this is paid the moment you save it.
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

          {/* CARD: Category & Amount */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16231f] border border-[#EDE7DA] dark:border-[#1f2e29] shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  What was it for?
                </h4>
              </div>
              <SearchableSelect
                label="Category"
                required
                options={categoryOptions}
                value={form.category}
                onChange={(v) => setForm((f) => ({ ...f, category: v }))}
                placeholder="Choose a category"
                searchPlaceholder="Search categories…"
              />
              <div className="mt-4">
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Date
                </label>
                <div className="relative">
                  <CalendarClock className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="date"
                    value={form.date}
                    max={todayStr()}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, date: e.target.value }))
                    }
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono transition-all"
                  />
                </div>
              </div>
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

          {/* CARD: Method & Bank */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16231f] border border-[#EDE7DA] dark:border-[#1f2e29] shadow-sm mb-5">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-900/40 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                How was it paid?
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <SearchableSelect
                label="Payment method"
                required
                options={methodOptions}
                value={form.method}
                onChange={(v) =>
                  setForm((f) => ({ ...f, method: v as ExpenseMethod }))
                }
                placeholder="Choose a method"
                searchPlaceholder="Search methods…"
              />

              {needsBank && (
                <SearchableSelect
                  label="Bank account"
                  required
                  icon={<Landmark className="w-3.5 h-3.5 text-stone-400" />}
                  options={bankOptions}
                  value={form.bankAccountId}
                  onChange={(v) => setForm((f) => ({ ...f, bankAccountId: v }))}
                  loading={banksLoading}
                  placeholder="Choose a bank account"
                  searchPlaceholder="Search bank accounts…"
                  emptyText="No bank accounts found"
                />
              )}
            </div>

            {needsCheque && (
              <div className="mt-5 pt-5 border-t border-dashed border-[#E8E3D8] dark:border-[#1f2e29]">
                <div className="flex items-center gap-1.5 mb-4">
                  <FileCheck2 className="w-3.5 h-3.5 text-violet-500" />
                  <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                    Cheque details
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                      Cheque number <span className="text-rose-500">*</span>
                    </label>
                    <input
                      value={form.chequeNumber}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, chequeNumber: e.target.value }))
                      }
                      placeholder="e.g. 458921"
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                      Payee
                    </label>
                    <input
                      value={form.payee}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, payee: e.target.value }))
                      }
                      placeholder="Who received it"
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                      Cheque date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.chequeDate}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, chequeDate: e.target.value }))
                      }
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613] text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono transition-all"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CARD: Attachment */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-[#16231f] border border-[#EDE7DA] dark:border-[#1f2e29] shadow-sm mb-5">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-900/40 flex items-center justify-center">
                <Paperclip className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Attachment
              </h4>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto">
                Optional · Receipt or bill photo
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleAttach(e.target.files)}
              className="hidden"
              accept="image/*,.pdf"
            />

            {!form.attachment ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full group relative p-5 rounded-2xl border-2 border-dashed border-[#EDE7DA] dark:border-[#1a2622] bg-[#F8F5EF]/70 dark:bg-[#16231f]/40 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] hover:border-teal-400/60 dark:hover:border-teal-500/50 transition-all flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-[#111d19] border border-[#EDE7DA] dark:border-[#1f2e29] flex items-center justify-center shadow-sm">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="text-sm font-semibold">
                  {uploading ? "Uploading…" : "Click to upload a receipt"}
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#0d1613]">
                <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <a
                  href={form.attachment}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 min-w-0 text-xs font-medium text-stone-700 dark:text-stone-200 hover:text-teal-600 dark:hover:text-teal-400 hover:underline truncate"
                >
                  Attached file
                </a>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, attachment: "" }))}
                  className="w-7 h-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-stone-400 hover:text-rose-500 dark:text-stone-500 dark:hover:text-rose-400 flex items-center justify-center transition-all shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
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
              value={form.notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, notes: e.target.value }))
              }
              placeholder="e.g. Taxi fare for supply pickup"
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
                Saved as{" "}
                <span className="font-semibold text-stone-500 dark:text-stone-400">
                  Paid
                </span>{" "}
                instantly — no due date.
              </div>
              {!canSave && !saving && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Fill all required fields to save the expense.
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
                    Save expense
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
// STATS SECTION — flat divided row
// ============================================================
function StatsSection({
  summary,
  loading,
  currency,
}: {
  summary: { totalSpend: number; totalCount: number; avgExpense: number };
  loading: boolean;
  currency: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-y sm:divide-y-0 divide-[#EDE7DA] dark:divide-[#1a2622] bg-white dark:bg-[#111d19] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm overflow-hidden">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-5 animate-pulse">
            <div className="h-3 w-16 bg-[#F1ECE0] dark:bg-[#1c2a25] rounded mb-3" />
            <div className="h-6 w-20 bg-[#F1ECE0] dark:bg-[#1c2a25] rounded" />
          </div>
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: "Total Spend",
      value: formatMoney(summary.totalSpend, currency),
      tone: "text-rose-600 dark:text-rose-400",
    },
    { label: "Total Expenses", value: summary.totalCount },
    {
      label: "Average Expense",
      value: formatMoney(summary.avgExpense, currency),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 divide-x divide-y sm:divide-y-0 divide-[#EDE7DA] dark:divide-[#1a2622] bg-white dark:bg-[#111d19] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm overflow-hidden">
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
}

// ============================================================
// MAIN TAB
// ============================================================
const ExpensesTab: React.FC<UseFinancePermissionReturn> = ({
  permissions,
  permissionsLoaded,
  AccessDenied,
  PermissionLoading,
  canAccessPage,
}) => {
  const { currency } = useCurrency();
  const {
    expenses,
    summary,
    categories,
    loading,
    saving,
    error,
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
    createExpense,
  } = useExpenses();

  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(
    null,
  );

  const from = pagination?.totalResults === 0 ? 0 : (page - 1) * 15 + 1;
  const to = Math.min(page * 15, pagination?.totalResults || 0);

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
      {/* Finance separation banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#111d19] px-5 py-4">
        <Sparkles className="w-4 h-4 mt-0.5 text-amber-500 dark:text-amber-400 shrink-0" />
        <div className="text-sm text-stone-600 dark:text-stone-300">
          <span className="font-bold text-stone-800 dark:text-stone-100">
            Finance separation
          </span>{" "}
          <span className="block sm:inline text-stone-500 dark:text-stone-400 mt-0.5 sm:mt-0">
            Expenses are immediate spending records. Amounts owed to suppliers
            live in Bills &amp; Payables, and payment transactions live in the
            Payment Center.
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
            Expenses
          </h2>
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
            Immediate clinic spending — distinct from supplier bills
          </p>
        </div>

        {permissions.canCreate && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 shadow-sm hover:shadow transition-all duration-200"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        )}
      </div>

      <StatsSection summary={summary} loading={loading} currency={currency} />

      <div className="bg-white dark:bg-[#111d19] rounded-2xl border border-[#EDE7DA] dark:border-[#1a2622] shadow-sm overflow-hidden transition-colors duration-300">
        {/* Category pill tabs */}
        <div className="border-b border-[#EDE7DA] dark:border-[#1a2622] bg-[#FBF9F4] dark:bg-[#0d1613]">
          <div className="flex items-center gap-1 p-1 overflow-x-auto">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategoryFilter(c)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  categoryFilter === c
                    ? "bg-white dark:bg-[#16231f] text-stone-800 dark:text-stone-100 shadow-sm dark:shadow-black/20"
                    : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-white/50 dark:hover:bg-[#16231f]/50"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div className="p-5 border-b border-[#EDE7DA] dark:border-[#1a2622] flex flex-wrap items-center gap-2.5 bg-white dark:bg-[#111d19]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] bg-white dark:bg-[#0d1613] text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 transition-all shadow-sm dark:shadow-black/20"
            />
          </div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="text-sm rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] bg-white dark:bg-[#0d1613] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-black/20"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="text-sm rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] bg-white dark:bg-[#0d1613] px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-black/20"
          />
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-[#111d19]">
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
            <div className="divide-y divide-[#EDE7DA] dark:divide-[#1a2622]">
              {expenses.length === 0 ? (
                <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                  <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                  <span className="text-sm">No expenses found.</span>
                </div>
              ) : (
                expenses.map((expense) => (
                  <ExpenseRow
                    key={expense._id}
                    expense={expense}
                    currency={currency}
                    isOpen={expandedExpenseId === expense._id}
                    onToggle={() =>
                      setExpandedExpenseId(
                        expandedExpenseId === expense._id ? null : expense._id,
                      )
                    }
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* Pagination footer */}
        {!loading && !error && pagination && pagination.totalResults > 0 && (
          <div className="px-5 py-4 border-t border-[#EDE7DA] dark:border-[#1a2622] bg-white dark:bg-[#111d19] flex flex-wrap items-center justify-between gap-3">
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
                className="w-8 h-8 rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm dark:shadow-black/20"
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
                className="w-8 h-8 rounded-full border border-[#E8E3D8] dark:border-[#1f2e29] flex items-center justify-center text-stone-500 dark:text-stone-400 hover:bg-[#F8F5EF] dark:hover:bg-[#16231f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm dark:shadow-black/20"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <NewExpenseModal
          onClose={() => setShowAddModal(false)}
          onSave={createExpense}
          categories={categories}
          saving={saving}
        />
      )}
    </div>
  );
};

export default ExpensesTab;

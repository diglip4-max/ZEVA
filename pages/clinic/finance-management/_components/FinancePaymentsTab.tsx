import React, { useEffect, useRef, useState } from "react";
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
  CalendarClock,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  FileText,
  DollarSign,
  File,
  Banknote,
  Landmark,
  FileCheck2,
  CreditCard,
  Globe,
  Wallet,
  Info,
} from "lucide-react";
import useFinancePayments, {
  PaymentData,
  PaymentMethod,
  MethodFilter,
  PAYMENT_METHODS,
} from "../_hooks/useFinancePayments";
import StatCard from "./StatCard";
import SearchableSelect from "@/components/shared/SearchableSelect";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney, getCurrencySymbol } from "@/lib/currencyHelper";
import { handleUpload, getTokenByPath } from "@/lib/helper";
import useBankAccounts from "../_hooks/useBankAccounts";
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

// ============================================================
// METHOD META — badge colours + icons per payment method
// ============================================================
const METHOD_META: Record<
  PaymentMethod,
  { label: string; icon: React.ElementType; text: string; bg: string }
> = {
  cash: {
    label: "Cash",
    icon: Banknote,
    text: "text-emerald-700 dark:text-emerald-300",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  bank_transfer: {
    label: "Bank Transfer",
    icon: Landmark,
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950",
  },
  cheque: {
    label: "Cheque",
    icon: FileCheck2,
    text: "text-violet-700 dark:text-violet-300",
    bg: "bg-violet-50 dark:bg-violet-950",
  },
  card: {
    label: "Card",
    icon: CreditCard,
    text: "text-indigo-700 dark:text-indigo-300",
    bg: "bg-indigo-50 dark:bg-indigo-950",
  },
  online: {
    label: "Online",
    icon: Globe,
    text: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950",
  },
  petty_cash: {
    label: "Petty Cash",
    icon: Wallet,
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
};

function MethodPill({ method }: { method: PaymentMethod }) {
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
// METHOD FILTER PILLS
// ============================================================
const METHOD_TABS: { value: MethodFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...PAYMENT_METHODS.map((m) => ({
    value: m.value as MethodFilter,
    label: m.label,
  })),
];

// ============================================================
// PAYMENT DETAILS VIEW — mirrors BillsPayableTab BillDetailsView
// ============================================================
function PaymentDetailsView({
  payment,
  currency,
  onReverse,
}: {
  payment: PaymentData;
  currency: string;
  onReverse: (payment: PaymentData) => void;
}) {
  const supplierName =
    typeof payment.supplierId === "string"
      ? "—"
      : payment.supplierId?.name || "—";
  const invoiceNumber =
    typeof payment.transactionId === "string"
      ? payment.transactionId
      : payment.transactionId?.invoiceNumber || "—";
  const bankName =
    typeof payment.bankAccountId === "string" || !payment.bankAccountId
      ? null
      : payment.bankAccountId?.bankName;
  const chequeNumber =
    typeof payment.chequeId === "string" || !payment.chequeId
      ? null
      : payment.chequeId?.chequeNumber;

  const methodMeta = METHOD_META[payment.method];
  const MethodIcon = methodMeta.icon;

  const isImg = (url: string) =>
    /\.(png|jpe?g|gif|webp|bmp)$/i.test(url) || url.startsWith("data:image");

  const fields: Array<{
    label: string;
    value?: React.ReactNode;
    icon: React.ReactNode;
    accent: string;
    span?: 1 | 2;
    skip?: boolean;
  }> = [
    {
      label: "Against Bill",
      value: <span className="font-mono">{invoiceNumber}</span>,
      icon: <Receipt className="w-3.5 h-3.5" />,
      accent: "from-violet-50 to-white dark:from-violet-950/40",
    },
    {
      label: "Payment Date",
      value: formatDate(payment.date),
      icon: <CalendarClock className="w-3.5 h-3.5" />,
      accent: "from-sky-50 to-white dark:from-sky-950/40",
    },
    {
      label: "Method",
      value: (
        <span className="inline-flex items-center gap-1.5">
          <MethodIcon className="w-3.5 h-3.5" />
          {methodMeta.label}
        </span>
      ),
      icon: <MethodIcon className="w-3.5 h-3.5" />,
      accent: "from-amber-50 to-white dark:from-amber-950/40",
    },
    {
      label: "Bank",
      value: bankName || "—",
      icon: <Landmark className="w-3.5 h-3.5" />,
      accent: "from-stone-50 to-white dark:from-stone-800/60",
      skip: !bankName,
    },
    {
      label: "Cheque #",
      value: chequeNumber ? (
        <span className="font-mono">{chequeNumber}</span>
      ) : (
        "—"
      ),
      icon: <FileCheck2 className="w-3.5 h-3.5" />,
      accent: "from-indigo-50 to-white dark:from-indigo-950/40",
      skip: !chequeNumber,
    },
    {
      label: "Supplier",
      value: supplierName,
      icon: <Receipt className="w-3.5 h-3.5" />,
      accent: "from-teal-50 to-white dark:from-teal-950/30",
      span: 2,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Payment record summary bar — 100% filled */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Payment record
          </span>
          <div className="text-[11px] font-mono font-semibold text-teal-600 dark:text-teal-400">
            Paid {formatMoney(payment.amount, currency)}
          </div>
        </div>
        <div className="relative w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
              width: "100%",
              backgroundImage:
                "linear-gradient(90deg, #0d9488, #14b8a6, #2dd4bf)",
            }}
          />
        </div>
        <div className="flex items-center justify-between mt-2 text-[10px] font-bold uppercase tracking-wider">
          <span
            className={
              payment.reversed
                ? "text-rose-500 dark:text-rose-400"
                : "text-teal-600 dark:text-teal-400"
            }
          >
            {payment.reversed ? "REVERSED" : "Settled"}
          </span>
          <span className="font-mono text-stone-500 dark:text-stone-400">
            {payment.paymentNumber}
          </span>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {fields
          .filter((f) => !f.skip)
          .map((f) => (
            <div
              key={f.label}
              className={`rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br ${f.accent} p-3.5 ${f.span === 2 ? "sm:col-span-2" : ""}`}
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
      </div>

      {/* Attachments */}
      {payment.attachment && (
        <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-white dark:bg-stone-800/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
              <Paperclip className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Attachments
            </span>
          </div>
          <a
            href={payment.attachment}
            target="_blank"
            rel="noreferrer"
            className="group flex items-center gap-2 rounded-lg border border-stone-100 dark:border-stone-700/60 bg-stone-50 dark:bg-stone-800/40 hover:bg-white dark:hover:bg-stone-800 p-2.5 transition-colors"
          >
            <div className="w-9 h-9 rounded-md bg-white dark:bg-stone-900 flex items-center justify-center shrink-0 border border-stone-100 dark:border-stone-700/60 overflow-hidden">
              {isImg(payment.attachment) ? (
                <img
                  src={payment.attachment}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <File className="w-4 h-4 text-stone-400" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-stone-700 dark:text-stone-200 truncate group-hover:text-teal-600 dark:group-hover:text-teal-400">
                Attached file
              </div>
              <div className="text-[10px] text-stone-400 dark:text-stone-500 truncate">
                Click to open in new tab
              </div>
            </div>
            <ChevronRight className="w-3 h-3 text-stone-300 dark:text-stone-600 shrink-0 group-hover:text-teal-500 transition-colors" />
          </a>
        </div>
      )}

      {/* Notes */}
      {payment.notes && (
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
            {payment.notes}
          </p>
        </div>
      )}

      {/* Reverse payment CTA bar */}
      {!payment.reversed && (
        <div className="pt-4 border-t border-stone-100 dark:border-stone-700/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-stone-500">
            <Info className="w-3.5 h-3.5" />
            Reversing keeps history — it doesn&apos;t delete the record.
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReverse(payment);
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 px-3.5 py-1.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Reverse payment
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================
// PAYMENT ROW — expandable accordion, mirrors BillRow pattern
// ============================================================
function PaymentRow({
  payment,
  currency,
  isOpen,
  onToggle,
  onReverse,
}: {
  payment: PaymentData;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
  onReverse: (payment: PaymentData) => void;
}) {
  const supplierName =
    typeof payment.supplierId === "string"
      ? "—"
      : payment.supplierId?.name || "—";
  const invoiceNumber =
    typeof payment.transactionId === "string"
      ? payment.transactionId
      : payment.transactionId?.invoiceNumber || "—";

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
          <DollarSign className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
              {supplierName}
            </div>
            {payment.reversed && (
              <span className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded-full">
                Reversed
              </span>
            )}
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span className="font-mono">{payment.paymentNumber}</span>
            <span>·</span>
            <span className="font-mono">{invoiceNumber}</span>
            <span>·</span>
            <span>{formatDate(payment.date)}</span>
          </div>
        </div>
        <MethodPill method={payment.method} />
        <div className="text-right shrink-0 min-w-[108px]">
          <div
            className={`font-mono font-semibold text-sm ${
              payment.reversed
                ? "text-stone-400 dark:text-stone-500 line-through"
                : "text-stone-800 dark:text-stone-100"
            }`}
          >
            {formatMoney(payment.amount, currency)}
          </div>
          {payment.reversed ? (
            <div className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 zfm-mono">
              Reversed
            </div>
          ) : (
            <div className="text-[10px] text-teal-600 dark:text-teal-400 zfm-mono font-semibold">
              Paid
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

      {/* Smooth expand/collapse — identical to BillsPayableTab */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2 pb-5 pl-13 ml-13 relative">
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-teal-200 dark:from-teal-900 to-transparent" />
            <div className="ml-9 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-5">
              <PaymentDetailsView
                payment={payment}
                currency={currency}
                onReverse={onReverse}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// NEW PAYMENT MODAL — premium, wide, searchable-select driven
// ============================================================
interface OpenBillOption {
  _id: string;
  invoiceNumber: string;
  category: string;
  supplierId: { _id: string; name: string } | string;
  amount: number;
  paidAmount: number;
  balance: number;
}

function NewPaymentModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (input: any) => Promise<{ ok: boolean; warning?: string }>;
  saving: boolean;
}) {
  const token = getTokenByPath();
  const { currency } = useCurrency();
  const symbol = getCurrencySymbol(currency);
  const [billSearch, setBillSearch] = useState("");
  const [bills, setBills] = useState<OpenBillOption[]>([]);
  const [billsLoading, setBillsLoading] = useState(false);
  const { bankAccounts, loading: banksLoading } = useBankAccounts() as {
    bankAccounts: { _id: string; bankName: string; accountNumber?: string }[];
    loading: boolean;
  };

  useEffect(() => {
    let active = true;
    setBillsLoading(true);
    const params = new URLSearchParams();
    if (billSearch) params.set("search", billSearch);
    params.set("limit", "20");
    fetch(`/api/finance/bills?${params.toString()}`, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        const open = (json.data || []).filter(
          (b: any) => b.status !== "paid" && b.status !== "cancelled",
        );
        setBills(open);
      })
      .finally(() => active && setBillsLoading(false));
    return () => {
      active = false;
    };
  }, [billSearch]);

  const [form, setForm] = useState({
    transactionId: "",
    amount: "",
    method: "bank_transfer" as PaymentMethod,
    bankAccountId: "",
    chequeNumber: "",
    payee: "",
    chequeDate: todayStr(),
    attachment: "",
    notes: "",
  });
  const [warning, setWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const selectedBill = bills.find((b) => b._id === form.transactionId);

  const billOptions = bills.map((b) => {
    const supplierName =
      typeof b.supplierId === "string" ? "" : b.supplierId?.name || "";
    return {
      value: b._id,
      label: `${b.invoiceNumber} — ${supplierName}`,
      sublabel: `${b.category} · Balance ${formatMoney(b.balance, currency)}`,
    };
  });

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
    !!form.transactionId &&
    amountNum > 0 &&
    (!selectedBill || amountNum <= selectedBill.balance) &&
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
      setWarning(
        "Fill in the required fields — amount cannot exceed the bill's balance",
      );
      return;
    }
    const supplierId =
      selectedBill && typeof selectedBill.supplierId !== "string"
        ? selectedBill.supplierId._id
        : undefined;

    const result = await onSave({
      transactionId: form.transactionId,
      supplierId,
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
      attachment: form.attachment || undefined,
      notes: form.notes || undefined,
    });
    if (!result.ok) {
      setWarning(result.warning || "Could not record the payment");
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
        {/* STICKY HEADER */}
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
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/80 dark:bg-teal-900/40 px-2.5 py-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-[0.14em] mb-1.5">
                  <Receipt className="w-3 h-3" />
                  Payment Center
                </div>
                <h3 className="zfm-display text-2xl sm:text-[28px] font-semibold text-stone-900 dark:text-stone-50 leading-[1.1]">
                  Record a Payment
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
                  Pay down an open bill — partial or full, by any method.
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

        {/* SCROLLABLE BODY */}
        <div className="flex-1 overflow-y-auto px-6 sm:px-8 py-6 sm:py-7 bg-gradient-to-b from-stone-50/40 via-white to-white dark:from-stone-900 dark:via-stone-900 dark:to-stone-900">
          {warning && (
            <div className="mb-6 px-4 py-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/50 text-rose-600 dark:text-rose-300 text-xs font-medium flex items-start gap-2.5 shadow-sm">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{warning}</span>
            </div>
          )}

          {/* CARD: Bill & Amount — hero row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Which bill is this for?
                </h4>
              </div>
              <SearchableSelect
                label="Bill / Invoice"
                required
                icon={<Receipt className="w-3.5 h-3.5 text-stone-400" />}
                options={billOptions}
                value={form.transactionId}
                onChange={(v) => setForm((f) => ({ ...f, transactionId: v }))}
                onSearchChange={setBillSearch}
                loading={billsLoading}
                placeholder="Choose an open bill"
                searchPlaceholder="Search invoice number or supplier…"
                emptyText="No open bills found"
              />
              {selectedBill && (
                <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2">
                  Balance remaining:{" "}
                  <span className="font-semibold text-rose-500 dark:text-rose-400">
                    {formatMoney(selectedBill.balance, currency)}
                  </span>
                </p>
              )}
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
                  Paying Now
                </h4>
              </div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Amount ({symbol}) <span className="text-rose-500">*</span>
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
                Cannot exceed the bill's remaining balance.
              </p>
            </div>
          </div>

          {/* CARD: Method & Bank */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm mb-5">
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
                  setForm((f) => ({ ...f, method: v as PaymentMethod }))
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
              <div className="mt-5 pt-5 border-t border-dashed border-stone-200 dark:border-stone-700">
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
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono transition-all"
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
                      placeholder="Defaults to supplier"
                      className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                      Cheque date <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <CalendarClock className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="date"
                        value={form.chequeDate}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, chequeDate: e.target.value }))
                        }
                        className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono transition-all"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* CARD: Attachment */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm mb-5">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-900/40 flex items-center justify-center">
                <Paperclip className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Attachment
              </h4>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto">
                Optional · Receipt, cheque copy, transfer slip…
              </span>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => handleAttach(e.target.files)}
              className="hidden"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            />

            {!form.attachment ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full group relative p-5 rounded-2xl border-2 border-dashed border-stone-200 dark:border-stone-700 bg-stone-50/60 dark:bg-stone-800/30 hover:bg-stone-50 dark:hover:bg-stone-800/60 hover:border-teal-400/60 dark:hover:border-teal-500/50 transition-all flex flex-col items-center justify-center gap-2 text-stone-500 dark:text-stone-400 hover:text-teal-600 dark:hover:text-teal-400 disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-2xl bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 group-hover:border-teal-200 dark:group-hover:border-teal-800 flex items-center justify-center shadow-sm group-hover:scale-105 transition-all">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Upload className="w-5 h-5" />
                  )}
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold">
                    {uploading
                      ? "Uploading…"
                      : "Click to upload proof of payment"}
                  </div>
                  <div className="text-[11px] mt-0.5 text-stone-400 dark:text-stone-500 group-hover:text-stone-500 dark:group-hover:text-stone-400">
                    PDF, image, or document
                  </div>
                </div>
              </button>
            ) : (
              <div className="flex items-center gap-3 px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800">
                <div className="w-9 h-9 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                  <File className="w-4 h-4" />
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
                  className="w-7 h-7 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/50 text-stone-400 hover:text-rose-500 dark:text-stone-500 dark:hover:text-rose-400 flex items-center justify-center transition-all shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
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
              placeholder="Any context — approval reference, partial settlement note, etc."
              rows={3}
              className="w-full px-4 py-3 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* STICKY FOOTER */}
        <div className="shrink-0 px-6 sm:px-8 py-4 sm:py-5 border-t border-stone-100 dark:border-stone-800 bg-gradient-to-t from-stone-50 via-white to-white dark:from-stone-900 dark:via-stone-900 dark:to-stone-900">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex flex-col gap-1">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                Payments made cannot be deleted — only{" "}
                <span className="font-semibold text-stone-500 dark:text-stone-400">
                  reversed
                </span>
                .
              </div>
              {!canSave && !saving && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Fill all required fields to record the payment.
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
                disabled={!canSave}
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
                    Record payment
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
    totalPaid: number;
    totalPayments: number;
    chequeCount: number;
    avgPayment: number;
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
        label="Total Paid"
        value={formatMoney(summary.totalPaid, currency)}
        icon={<DollarSign />}
        fromColor="#0d9488"
        toColor="#14b8a6"
        iconColor="text-white"
        trend="This selection"
        trendPositive={true}
      />
      <StatCard
        label="Total Payments"
        value={summary.totalPayments}
        icon={<Receipt />}
        fromColor="#7c3aed"
        toColor="#8b5cf6"
        iconColor="text-white"
        trend="All time"
        trendPositive={true}
      />
      <StatCard
        label="Cheque Payments"
        value={summary.chequeCount}
        icon={<FileCheck2 />}
        fromColor="#4f46e5"
        toColor="#6366f1"
        iconColor="text-white"
        trend="Via cheque"
        trendPositive={true}
      />
      <StatCard
        label="Average Payment"
        value={formatMoney(summary.avgPayment, currency)}
        icon={<TrendingUp />}
        fromColor="#059669"
        toColor="#10b981"
        iconColor="text-white"
        trend="Per transaction"
        trendPositive={true}
      />
    </div>
  );
}

// ============================================================
// MAIN TAB
// ============================================================
const FinancePaymentsTab: React.FC<UseFinancePermissionReturn> = ({
  permissions,
  permissionsLoaded,
  AccessDenied,
  PermissionLoading,
  canAccessPage,
}) => {
  const { currency } = useCurrency();
  const {
    payments,
    summary,
    loading,
    saving,
    error,
    methodFilter,
    setMethodFilter,
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
    createPayment,
    reversePayment,
  } = useFinancePayments();

  const [showAddModal, setShowAddModal] = useState(false);
  const [reverseTarget, setReverseTarget] = useState<PaymentData | null>(null);
  const [reverseReason, setReverseReason] = useState("");
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(
    null,
  );

  const from = pagination?.totalResults === 0 ? 0 : (page - 1) * 15 + 1;
  const to = Math.min(page * 15, pagination?.totalResults || 0);

  const handleReverse = async () => {
    if (!reverseTarget || !reverseReason.trim()) return;
    await reversePayment(reverseTarget._id, reverseReason.trim());
    setReverseTarget(null);
    setReverseReason("");
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
            Payment Center
          </h2>
          <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
            Every payment the clinic has made, by method
          </p>
        </div>

        {permissions?.canCreate && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:shadow-lg hover:scale-[1.03] active:scale-95 transition-all duration-200"
            style={{
              backgroundImage: "linear-gradient(135deg, #14b8a6, #0f766e)",
            }}
          >
            <Plus className="w-4 h-4" />
            Record Payment
          </button>
        )}
      </div>

      <StatsSection summary={summary} loading={loading} currency={currency} />

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm dark:shadow-stone-900/20 overflow-hidden transition-colors duration-300">
        {/* Method pill tabs */}
        <div className="border-b border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30">
          <div className="flex items-center gap-1 p-1 overflow-x-auto">
            {METHOD_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setMethodFilter(t.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
                  methodFilter === t.value
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
              placeholder="Search payment number, invoice, or supplier…"
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 transition-all shadow-sm dark:shadow-stone-900/20"
            />
          </div>
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
              {payments.length === 0 ? (
                <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                  <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                  <span className="text-sm">No payments found.</span>
                </div>
              ) : (
                payments.map((payment) => {
                  const isOpen = expandedPaymentId === payment._id;
                  return (
                    <PaymentRow
                      key={payment._id}
                      payment={payment}
                      currency={currency}
                      isOpen={isOpen}
                      onToggle={() =>
                        setExpandedPaymentId(isOpen ? null : payment._id)
                      }
                      onReverse={setReverseTarget}
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
        <NewPaymentModal
          onClose={() => setShowAddModal(false)}
          onSave={createPayment}
          saving={saving}
        />
      )}

      {reverseTarget && (
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
                <RotateCcw className="w-5 h-5 text-rose-500 dark:text-rose-400" />
              </div>
              <h3 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
                Reverse payment
              </h3>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 mb-4">
              {reverseTarget.paymentNumber} won't be deleted — the bill's
              balance is restored and this stays in history as reversed.
            </p>
            <input
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
              placeholder="Reason (required)"
              className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-rose-100 dark:focus:ring-rose-900 focus:border-rose-400 transition-all mb-5"
            />
            <div className="flex gap-2.5">
              <button
                onClick={() => {
                  setReverseTarget(null);
                  setReverseReason("");
                }}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
              >
                Keep payment
              </button>
              <button
                onClick={handleReverse}
                disabled={!reverseReason.trim()}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-colors disabled:opacity-50 disabled:pointer-events-none"
              >
                Reverse
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancePaymentsTab;

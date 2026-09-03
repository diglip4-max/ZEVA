import React, { useState, useMemo } from "react";
import {
  Plus,
  X,
  Building2,
  Landmark,
  Loader2,
  Inbox,
  Wallet,
  Banknote,
  FileCheck2,
  CreditCard,
  Globe,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  FileText,
  DollarSign,
  Pencil,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import useBankAccounts from "../_hooks/useBankAccounts";
import useBankAccountPayments from "../_hooks/useBankAccountPayments";
import StatCard from "./StatCard";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney, getCurrencySymbol } from "@/lib/currencyHelper";
import { BankAccountData } from "../_hooks/useBankAccounts";
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
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "—";

const methodLabel = (method?: string): string =>
  (method || "")
    .split("_")
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ") || "—";

const METHOD_ICON: Record<string, React.ElementType> = {
  cash: Banknote,
  bank_transfer: Landmark,
  cheque: FileCheck2,
  card: CreditCard,
  online: Globe,
  petty_cash: Wallet,
};

// Label/value row used inside an expanded payment card — same shape
// as OverviewTab's DetailRow so both sections read identically
function DetailRow({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value?: React.ReactNode;
  mono?: boolean;
  bold?: boolean;
}) {
  if (value === undefined || value === null || value === "") return null;
  return (
    <div className="flex items-start gap-3 py-1.5">
      <div className="w-32 shrink-0 text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-widest pt-1">
        {label}
      </div>
      <div
        className={`text-sm text-stone-700 dark:text-stone-200 break-words ${
          mono ? "zfm-mono" : ""
        } ${bold ? "font-semibold" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

// ============================================================
// NEW ACCOUNT MODAL — unchanged from original (not part of the
// screenshot you shared — ping me if you want this restyled too)
// ============================================================
function NewAccountModal({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (input: any) => Promise<{ ok: boolean; warning?: string }>;
  saving: boolean;
}) {
  const { currency } = useCurrency();
  const symbol = getCurrencySymbol(currency);

  const [form, setForm] = useState({
    bankName: "",
    accountName: "",
    accountNumber: "",
    ifscCode: "",
    currentBalance: "",
    notes: "",
  });
  const [warning, setWarning] = useState<string | null>(null);

  const canSave = useMemo(
    () => !!form.bankName.trim() && !saving,
    [form, saving],
  );

  const submit = async () => {
    setWarning(null);
    if (!canSave) {
      setWarning("Bank name is required");
      return;
    }
    const result = await onSave({
      ...form,
      currentBalance: Number(form.currentBalance) || 0,
    });
    if (!result.ok) {
      setWarning(result.warning || "Could not add the account");
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
      <div className="relative bg-white dark:bg-stone-900 rounded-3xl w-full max-w-4xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)] border border-stone-100 dark:border-stone-800 max-h-[92vh] flex flex-col overflow-hidden">
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
                  <Landmark className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-100/80 dark:bg-teal-900/40 px-2.5 py-1 text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase tracking-[0.14em] mb-1.5">
                  <Building2 className="w-3 h-3" />
                  New Account · Bank Account
                </div>
                <h3 className="zfm-display text-2xl sm:text-[28px] font-semibold text-stone-900 dark:text-stone-50 leading-[1.1]">
                  Add Bank Account
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
                  Register a bank or wallet — track balances and all payments
                  made through it.
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

          {/* CARD: Bank & Opening Balance — hero row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Where is it held?
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                    Bank name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Landmark className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={form.bankName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bankName: e.target.value }))
                      }
                      placeholder="e.g. HDFC Bank"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                    Account name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={form.accountName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, accountName: e.target.value }))
                      }
                      placeholder="Zeva Clinic — Current A/c"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all"
                    />
                  </div>
                </div>
              </div>
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
                  Starting Balance
                </h4>
              </div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Opening balance ({symbol})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 zfm-mono font-semibold text-lg pointer-events-none">
                  {symbol}
                </span>
                <input
                  type="number"
                  value={form.currentBalance}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currentBalance: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full pl-9 pr-4 py-3.5 text-2xl rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono font-bold transition-all shadow-inner"
                />
              </div>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2">
                Update this whenever you reconcile with the bank statement.
              </p>
            </div>
          </div>

          {/* CARD: Account Details */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm mb-5">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-900/40 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Account Details
              </h4>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto">
                Optional · For reference & bank transfers
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Account number
                </label>
                <div className="relative">
                  <FileCheck2 className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={form.accountNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accountNumber: e.target.value }))
                    }
                    placeholder="Account number"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-500/10 dark:focus:ring-violet-400/10 focus:border-violet-500 dark:focus:border-violet-400 zfm-mono transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                  IFSC / Sort code
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={form.ifscCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ifscCode: e.target.value }))
                    }
                    placeholder="e.g. HDFC0001234"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-500/10 dark:focus:ring-violet-400/10 focus:border-violet-500 dark:focus:border-violet-400 zfm-mono transition-all"
                  />
                </div>
              </div>
            </div>
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
              placeholder="Branch address, signatory info, purpose — e.g. 'Payroll account · Main branch, MG road'"
              rows={3}
              className="w-full px-4 py-3 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:focus:ring-sky-400/10 focus:border-sky-500 dark:focus:border-sky-400 transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* ============ STICKY FOOTER ============ */}
        <div className="shrink-0 px-6 sm:px-8 py-4 sm:py-5 border-t border-stone-100 dark:border-stone-800 bg-gradient-to-t from-stone-50 via-white to-white dark:from-stone-900 dark:via-stone-900 dark:to-stone-900">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex flex-col gap-1">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                Saved accounts appear in{" "}
                <span className="font-semibold text-stone-500 dark:text-stone-400">
                  Payment Center
                </span>{" "}
                dropdowns instantly.
              </div>
              {!canSave && !saving && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Enter the bank name to save the account.
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
                    Add account
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
// EDIT ACCOUNT MODAL — unchanged from original
// ============================================================
function EditAccountModal({
  account,
  onClose,
  onSave,
  saving,
}: {
  account: BankAccountData;
  onClose: () => void;
  onSave: (
    id: string,
    input: any,
  ) => Promise<{ ok: boolean; warning?: string }>;
  saving: boolean;
}) {
  const { currency } = useCurrency();
  const symbol = getCurrencySymbol(currency);

  const [form, setForm] = useState({
    bankName: account.bankName || "",
    accountName: account.accountName || "",
    accountNumber: account.accountNumber || "",
    ifscCode: account.ifscCode || "",
    currentBalance: String(account.currentBalance ?? 0),
    notes: account.notes || "",
  });
  const [warning, setWarning] = useState<string | null>(null);

  const canSave = useMemo(
    () => !!form.bankName.trim() && !saving,
    [form, saving],
  );

  const submit = async () => {
    setWarning(null);
    if (!canSave) {
      setWarning("Bank name is required");
      return;
    }
    const result = await onSave(account._id, {
      ...form,
      currentBalance: Number(form.currentBalance) || 0,
    });
    if (!result.ok) {
      setWarning(result.warning || "Could not update the account");
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
      <div className="relative bg-white dark:bg-stone-900 rounded-3xl w-full max-w-4xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.45)] border border-stone-100 dark:border-stone-800 max-h-[92vh] flex flex-col overflow-hidden">
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
                  <Pencil className="w-6 h-6 text-white" />
                </div>
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100/80 dark:bg-amber-900/40 px-2.5 py-1 text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase tracking-[0.14em] mb-1.5">
                  <Building2 className="w-3 h-3" />
                  Edit Account · {account.bankName}
                </div>
                <h3 className="zfm-display text-2xl sm:text-[28px] font-semibold text-stone-900 dark:text-stone-50 leading-[1.1]">
                  Edit Bank Account
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1.5 max-w-md">
                  Update account details and balance information.
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

          {/* CARD: Bank & Current Balance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
            <div className="md:col-span-2 p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm">
              <div className="flex items-center gap-1.5 mb-3">
                <div className="w-6 h-6 rounded-lg bg-teal-50 dark:bg-teal-900/40 flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                </div>
                <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                  Where is it held?
                </h4>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                <div>
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                    Bank name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <Landmark className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={form.bankName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, bankName: e.target.value }))
                      }
                      placeholder="e.g. HDFC Bank"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                    Account name
                  </label>
                  <div className="relative">
                    <Building2 className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      value={form.accountName}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, accountName: e.target.value }))
                      }
                      placeholder="Zeva Clinic — Current A/c"
                      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 transition-all"
                    />
                  </div>
                </div>
              </div>
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
                  Current Balance
                </h4>
              </div>
              <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                Balance ({symbol})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 zfm-mono font-semibold text-lg pointer-events-none">
                  {symbol}
                </span>
                <input
                  type="number"
                  value={form.currentBalance}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, currentBalance: e.target.value }))
                  }
                  placeholder="0"
                  className="w-full pl-9 pr-4 py-3.5 text-2xl rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-4 focus:ring-teal-500/10 dark:focus:ring-teal-400/10 focus:border-teal-500 dark:focus:border-teal-400 zfm-mono font-bold transition-all shadow-inner"
                />
              </div>
              <p className="text-[11px] text-stone-400 dark:text-stone-500 mt-2">
                Update this whenever you reconcile with the bank statement.
              </p>
            </div>
          </div>

          {/* CARD: Account Details */}
          <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-stone-800/50 border border-stone-100 dark:border-stone-700 shadow-sm mb-5">
            <div className="flex items-center gap-1.5 mb-4">
              <div className="w-6 h-6 rounded-lg bg-violet-50 dark:bg-violet-900/40 flex items-center justify-center">
                <CreditCard className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
              </div>
              <h4 className="text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
                Account Details
              </h4>
              <span className="text-[10px] text-stone-400 dark:text-stone-500 ml-auto">
                Optional · For reference & bank transfers
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                  Account number
                </label>
                <div className="relative">
                  <FileCheck2 className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={form.accountNumber}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, accountNumber: e.target.value }))
                    }
                    placeholder="Account number"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-500/10 dark:focus:ring-violet-400/10 focus:border-violet-500 dark:focus:border-violet-400 zfm-mono transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5 block">
                  IFSC / Sort code
                </label>
                <div className="relative">
                  <Globe className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    value={form.ifscCode}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, ifscCode: e.target.value }))
                    }
                    placeholder="e.g. HDFC0001234"
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-violet-500/10 dark:focus:ring-violet-400/10 focus:border-violet-500 dark:focus:border-violet-400 zfm-mono transition-all"
                  />
                </div>
              </div>
            </div>
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
              placeholder="Branch address, signatory info, purpose — e.g. 'Payroll account · Main branch, MG road'"
              rows={3}
              className="w-full px-4 py-3 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-sky-500/10 dark:focus:ring-sky-400/10 focus:border-sky-500 dark:focus:border-sky-400 transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* ============ STICKY FOOTER ============ */}
        <div className="shrink-0 px-6 sm:px-8 py-4 sm:py-5 border-t border-stone-100 dark:border-stone-800 bg-gradient-to-t from-stone-50 via-white to-white dark:from-stone-900 dark:via-stone-900 dark:to-stone-900">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
            <div className="flex flex-col gap-1">
              <div className="hidden sm:flex items-center gap-2 text-[11px] text-stone-400 dark:text-stone-500">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-500" />
                Updated accounts reflect instantly in{" "}
                <span className="font-semibold text-stone-500 dark:text-stone-400">
                  Payment Center
                </span>
                .
              </div>
              {!canSave && !saving && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Enter the bank name to save changes.
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
                    <Pencil className="w-4 h-4" />
                    Update account
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
// MAIN TAB — header + account grid restyled to match the
// reference screenshot (muted stone/teal, flat cards, dashed
// "add" tile instead of a header button)
// ============================================================
const BankAccountsTab: React.FC<UseFinancePermissionReturn> = ({
  permissions,
  permissionsLoaded,
  AccessDenied,
  PermissionLoading,
  canAccessPage,
}) => {
  const { currency } = useCurrency();
  const {
    bankAccounts,
    totalBalance,
    loading,
    saving,
    error,
    createAccount,
    editAccount,
  } = useBankAccounts();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editTarget, setEditTarget] = useState<BankAccountData | null>(null);
  const [expandedPaymentId, setExpandedPaymentId] = useState<string | null>(
    null,
  );

  const active =
    bankAccounts.find((a: BankAccountData) => a._id === activeId) ||
    bankAccounts[0] ||
    null;
  const { payments, loading: paymentsLoading } = useBankAccountPayments(
    active?._id || null,
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
    <div className="space-y-7">
      <div>
        <h2 className="zfm-display text-lg font-bold text-[#20291f] dark:text-[#f3f1e9]">
          Bank Accounts
        </h2>
        <p className="text-sm text-[#767061] dark:text-[#a6a08d] mt-0.5">
          Payments made through each bank account
        </p>
      </div>

      <StatCard
        label="Total Bank Balance"
        value={formatMoney(totalBalance, currency)}
        icon={<Wallet />}
        fromColor="#3f8066"
        toColor="#5fa688"
        iconColor="text-white"
        trend={`${bankAccounts.length} account${bankAccounts.length === 1 ? "" : "s"}`}
        trendPositive={true}
      />

      {loading && (
        <div className="bg-[#f2f0e8] dark:bg-[#1a1e15] rounded-2xl border border-[#e5e2d5] dark:border-[#2a2f22] px-5 py-16 text-center text-[#767061] dark:text-[#a6a08d]">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-[#3f8066] dark:text-[#5fa688]" />
          <span className="text-sm">Loading accounts…</span>
        </div>
      )}

      {!loading && error && (
        <div className="bg-[#f2f0e8] dark:bg-[#1a1e15] rounded-2xl border border-[#e5e2d5] dark:border-[#2a2f22] px-5 py-16 text-center text-rose-500 dark:text-rose-400 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {bankAccounts.length === 0 && !permissions.canCreate && (
            <div className="bg-[#f2f0e8] dark:bg-[#1a1e15] rounded-2xl border border-[#e5e2d5] dark:border-[#2a2f22] px-5 py-16 text-center text-[#767061] dark:text-[#a6a08d]">
              <Building2 className="w-6 h-6 mx-auto mb-2 opacity-60" />
              <span className="text-sm">No bank accounts yet.</span>
            </div>
          )}

          {(bankAccounts.length > 0 || permissions.canCreate) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {bankAccounts.map((a: BankAccountData) => {
                const isActive = active?._id === a._id;
                return (
                  <div
                    key={a._id}
                    onClick={() => setActiveId(a._id)}
                    className={`group relative p-5 rounded-2xl cursor-pointer border transition-colors ${
                      isActive
                        ? "border-[#3f8066]/50 dark:border-[#5fa688]/40 bg-white dark:bg-[#1f2419]"
                        : "border-[#e5e2d5] dark:border-[#2a2f22] bg-white dark:bg-[#1f2419] hover:border-[#3f8066]/30 dark:hover:border-[#5fa688]/30"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#e7f0ea] dark:bg-[#29392b] flex items-center justify-center mb-4">
                      <Building2 className="w-4 h-4 text-[#3f8066] dark:text-[#5fa688]" />
                    </div>

                    <div className="text-sm font-semibold text-[#20291f] dark:text-[#f3f1e9]">
                      {a.bankName}
                    </div>
                    {a.accountNumber && (
                      <div className="text-xs text-[#767061] dark:text-[#a6a08d] zfm-mono mt-0.5">
                        •••• {a.accountNumber.slice(-4)}
                      </div>
                    )}

                    <div className="zfm-display text-xl font-semibold text-[#20291f] dark:text-[#f3f1e9] mt-4">
                      {formatMoney(a.currentBalance, currency)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[#767061] dark:text-[#a6a08d]">
                        Current Balance
                      </span>
                      {a.accountName && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#efece2] dark:bg-[#232819] text-[#767061] dark:text-[#a6a08d]">
                          {a.accountName}
                        </span>
                      )}
                    </div>

                    {permissions.canUpdate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditTarget(a);
                        }}
                        className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-[#767061] dark:text-[#a6a08d] hover:bg-[#f2f0e8] dark:hover:bg-[#29392b] hover:text-[#3f8066] dark:hover:text-[#5fa688] transition-all opacity-0 group-hover:opacity-100"
                        title="Edit account"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}

              {permissions.canCreate && (
                <button
                  onClick={() => setShowAddModal(true)}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-[#d8d4c4] dark:border-[#33392a] bg-[#f2f0e8] dark:bg-[#1a1e15] py-10 text-[#767061] dark:text-[#a6a08d] hover:border-[#3f8066]/50 dark:hover:border-[#5fa688]/40 hover:text-[#3f8066] dark:hover:text-[#5fa688] transition-colors hover:bg-[#f2f0e8] dark:hover:bg-[#29392b]"
                >
                  <span className="w-9 h-9 rounded-lg bg-white dark:bg-[#232819] flex items-center justify-center">
                    <Plus className="w-4 h-4" />
                  </span>
                  <span className="text-sm font-medium">Add Bank Account</span>
                </button>
              )}
            </div>
          )}

          {active && (
            <div className="bg-white dark:bg-[#1f2419] rounded-2xl border border-[#e5e2d5] dark:border-[#2a2f22] overflow-hidden">
              <div className="px-5 py-4 border-b border-[#e5e2d5] dark:border-[#2a2f22] flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#20291f] dark:text-[#f3f1e9]">
                  Payment history — {active.bankName}
                </h3>
                {payments.length > 0 && (
                  <span className="text-[11px] font-semibold text-[#767061] dark:text-[#a6a08d]">
                    Click row to expand
                  </span>
                )}
              </div>
              {paymentsLoading ? (
                <div className="px-5 py-10 text-center text-[#767061] dark:text-[#a6a08d] text-sm">
                  <Loader2 className="w-4 h-4 animate-spin mx-auto mb-2" />
                  Loading…
                </div>
              ) : payments.length === 0 ? (
                <div className="px-5 py-10 text-center text-[#767061] dark:text-[#a6a08d] text-sm">
                  <Inbox className="w-5 h-5 mx-auto mb-2 opacity-60" />
                  No payments recorded through this account yet.
                </div>
              ) : (
                <div className="divide-y divide-[#e5e2d5] dark:divide-[#2a2f22] px-3 py-1">
                  {payments.map((p: any) => {
                    const Icon = METHOD_ICON[p.method] || Landmark;
                    const supplierName =
                      typeof p.supplierId === "string"
                        ? ""
                        : p.supplierId?.name;
                    const invoiceNumber =
                      typeof p.transactionId === "string"
                        ? ""
                        : p.transactionId?.invoiceNumber;
                    const billCategory =
                      typeof p.transactionId === "string"
                        ? ""
                        : p.transactionId?.category;
                    const isOpen = expandedPaymentId === p._id;
                    const isReversed = !!p.reversed;

                    return (
                      <div key={p._id}>
                        <button
                          onClick={() =>
                            setExpandedPaymentId(isOpen ? null : p._id)
                          }
                          className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-[#f2f0e8] dark:hover:bg-[#232819] rounded-xl px-2 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-full bg-[#e7f0ea] dark:bg-[#29392b] flex items-center justify-center text-[#3f8066] dark:text-[#5fa688] shrink-0">
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-[#20291f] dark:text-[#f3f1e9] truncate">
                              {supplierName || "—"}
                            </div>
                            <div className="text-xs text-[#767061] dark:text-[#a6a08d] zfm-mono truncate">
                              {p.paymentNumber}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-mono font-semibold text-[#20291f] dark:text-[#f3f1e9] text-sm">
                              {formatMoney(p.amount, currency)}
                            </div>
                            <div className="text-[10px] text-[#767061] dark:text-[#a6a08d]">
                              {formatDate(p.date)}
                            </div>
                          </div>
                          <div
                            className={`shrink-0 transition-transform duration-200 ${
                              isOpen ? "rotate-90" : ""
                            }`}
                          >
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4 text-[#3f8066] dark:text-[#5fa688]" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-[#767061]/60 dark:text-[#a6a08d]/60" />
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
                              <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-[#3f8066]/30 dark:from-[#5fa688]/30 to-transparent" />
                              <div className="ml-9 rounded-xl border border-[#e5e2d5] dark:border-[#2a2f22] bg-[#f8f7f3] dark:bg-[#171a14] p-5 space-y-0.5">
                                <DetailRow
                                  label="Payment #"
                                  value={p.paymentNumber}
                                  mono
                                />
                                <DetailRow
                                  label="Supplier"
                                  value={supplierName || "—"}
                                />
                                {invoiceNumber && (
                                  <DetailRow
                                    label="Bill Invoice"
                                    value={invoiceNumber}
                                    mono
                                  />
                                )}
                                {billCategory && (
                                  <DetailRow
                                    label="Bill Category"
                                    value={billCategory}
                                  />
                                )}
                                <DetailRow
                                  label="Amount Paid"
                                  value={formatMoney(p.amount, currency)}
                                  mono
                                  bold
                                />
                                <DetailRow
                                  label="Payment Date"
                                  value={formatDate(p.date)}
                                />
                                <DetailRow
                                  label="Method"
                                  value={
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize bg-[#efece2] dark:bg-[#232819] text-[#5c5747] dark:text-[#c9c4b3]">
                                      {methodLabel(p.method)}
                                    </span>
                                  }
                                />
                                <DetailRow
                                  label="Status"
                                  value={
                                    isReversed ? (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400">
                                        Reversed
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-[#e7f0ea] dark:bg-[#29392b] text-[#3f8066] dark:text-[#5fa688]">
                                        Completed
                                      </span>
                                    )
                                  }
                                />
                                {p.notes && (
                                  <DetailRow label="Notes" value={p.notes} />
                                )}
                                <DetailRow
                                  label="Created"
                                  value={formatDateTime(p.createdAt)}
                                />
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
          )}
        </>
      )}

      {showAddModal && (
        <NewAccountModal
          onClose={() => setShowAddModal(false)}
          onSave={createAccount}
          saving={saving}
        />
      )}

      {editTarget && (
        <EditAccountModal
          account={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={editAccount}
          saving={saving}
        />
      )}
    </div>
  );
};

export default BankAccountsTab;

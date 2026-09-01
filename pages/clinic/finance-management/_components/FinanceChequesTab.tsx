import React, { useState } from "react";
import {
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Loader2,
  Inbox,
  FileCheck2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  RotateCcw,
  Paperclip,
  File,
  Info,
  CalendarClock,
  Landmark,
  Receipt,
} from "lucide-react";
import useFinanceCheques, {
  ChequeData,
  ChequeStatus,
  ChequeStatusFilter,
  CHEQUE_STATUSES,
} from "../_hooks/useFinanceCheques";
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
// STATUS META
// ============================================================
const STATUS_META: Record<
  ChequeStatus,
  { label: string; dot: string; text: string; bg: string }
> = {
  issued: {
    label: "Issued",
    dot: "bg-sky-500",
    text: "text-sky-700 dark:text-sky-300",
    bg: "bg-sky-50 dark:bg-sky-950",
  },
  presented: {
    label: "Presented",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-300",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
  cleared: {
    label: "Cleared",
    dot: "bg-teal-500",
    text: "text-teal-700 dark:text-teal-300",
    bg: "bg-teal-50 dark:bg-teal-950",
  },
  returned: {
    label: "Returned",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-300",
    bg: "bg-rose-50 dark:bg-rose-950",
  },
  bounced: {
    label: "Bounced",
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

function ChequeStatusPill({ status }: { status: ChequeStatus }) {
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

const STATUS_TABS: { value: ChequeStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  ...CHEQUE_STATUSES.map((s) => ({
    value: s.value as ChequeStatusFilter,
    label: s.label,
  })),
];

// The natural next step per current status — shown as a one-click primary action.
// Anything else (returned/bounced/cancelled) goes through the "Change status" modal.
const NEXT_STEP: Partial<Record<ChequeStatus, ChequeStatus>> = {
  issued: "presented",
  presented: "cleared",
};

// ============================================================
// CHEQUE DETAILS VIEW — expanded card body
// ============================================================
function ChequeDetailsView({
  cheque,
  currency,
  onAdvance,
  onChangeStatus,
  permissions,
}: {
  cheque: ChequeData;
  currency: string;
  onAdvance: (cheque: ChequeData, next: ChequeStatus) => void;
  onChangeStatus: (cheque: ChequeData) => void;
  permissions: UseFinancePermissionReturn["permissions"];
}) {
  const supplierName =
    typeof cheque.supplierId === "string" || !cheque.supplierId
      ? null
      : cheque.supplierId?.name;
  const invoiceNumber =
    typeof cheque.transactionId === "string" || !cheque.transactionId
      ? null
      : cheque.transactionId?.invoiceNumber;
  const paymentNumber =
    typeof cheque.paymentId === "string" || !cheque.paymentId
      ? null
      : cheque.paymentId?.paymentNumber;

  const nextStep = NEXT_STEP[cheque.status];
  const isTerminal =
    cheque.status === "cleared" || cheque.status === "cancelled";

  const isFailure =
    cheque.status === "returned" ||
    cheque.status === "bounced" ||
    cheque.status === "cancelled";

  const lifecycleOrder: ChequeStatus[] = ["issued", "presented", "cleared"];

  const statusRank: Record<ChequeStatus, number> = {
    issued: 0,
    presented: 1,
    cleared: 2,
    returned: 3,
    bounced: 3,
    cancelled: 3,
  };

  const currentRank = statusRank[cheque.status];

  return (
    <div className="space-y-5">
      {/* Lifecycle progress */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
            Lifecycle
          </span>
          <ChequeStatusPill status={cheque.status} />
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2">
          {lifecycleOrder.map((s, idx) => {
            const reached = currentRank >= statusRank[s];
            const isLast = idx === lifecycleOrder.length - 1;
            return (
              <React.Fragment key={s}>
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={`w-3.5 h-3.5 rounded-full border-2 ${
                      reached
                        ? `${STATUS_META[s].dot} border-transparent`
                        : "bg-transparent border-stone-200 dark:border-stone-700"
                    }`}
                  />
                  <span className="text-[9px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                    {STATUS_META[s].label}
                  </span>
                </div>
                {!isLast && (
                  <div
                    className={`h-0.5 flex-1 mb-4 rounded-full ${
                      currentRank > statusRank[s]
                        ? STATUS_META[lifecycleOrder[idx + 1]].dot
                        : "bg-stone-100 dark:bg-stone-800"
                    }`}
                  />
                )}
              </React.Fragment>
            );
          })}
          {isFailure && (
            <>
              <div className="h-0.5 w-4 mb-4 rounded-full border-t-2 border-dashed border-rose-300 dark:border-rose-800" />
              <div className="flex flex-col items-center gap-1">
                <div className="w-3.5 h-3.5 rounded-full border-2 border-dashed border-rose-400 dark:border-rose-500 bg-rose-50 dark:bg-rose-950/40" />
                <span className="text-[9px] font-bold uppercase tracking-wider text-rose-500 dark:text-rose-400">
                  {STATUS_META[cheque.status].label}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-sky-50 to-white dark:from-sky-950/40 p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-white dark:bg-stone-800/70 flex items-center justify-center text-sky-600 dark:text-sky-400 shadow-sm">
              <Landmark className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              Bank
            </span>
          </div>
          <div className="text-sm font-medium text-stone-700 dark:text-stone-200 pl-[26px]">
            {cheque.bank}
          </div>
        </div>

        <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/40 p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-white dark:bg-stone-800/70 flex items-center justify-center text-amber-600 dark:text-amber-400 shadow-sm">
              <CalendarClock className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              Cheque date
            </span>
          </div>
          <div className="text-sm font-medium text-stone-700 dark:text-stone-200 pl-[26px]">
            {formatDate(cheque.chequeDate)}
          </div>
        </div>

        {supplierName && (
          <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-teal-50 to-white dark:from-teal-950/30 p-3.5">
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
        )}

        {invoiceNumber && (
          <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-violet-50 to-white dark:from-violet-950/40 p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-white dark:bg-stone-800/70 flex items-center justify-center text-violet-600 dark:text-violet-400 shadow-sm">
                <Receipt className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                Against Bill
              </span>
            </div>
            <div className="text-sm font-mono font-medium text-stone-700 dark:text-stone-200 pl-[26px]">
              {invoiceNumber}
            </div>
          </div>
        )}

        {paymentNumber && (
          <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/40 p-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="w-5 h-5 rounded-md bg-white dark:bg-stone-800/70 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                <File className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
                Payment ref
              </span>
            </div>
            <div className="text-sm font-mono font-medium text-stone-700 dark:text-stone-200 pl-[26px]">
              {paymentNumber}
            </div>
          </div>
        )}

        <div className="sm:col-span-2 rounded-xl border border-stone-100 dark:border-stone-700/60 bg-gradient-to-br from-stone-50 to-white dark:from-stone-800/40 p-3.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <div className="w-5 h-5 rounded-md bg-white dark:bg-stone-800/70 flex items-center justify-center text-stone-600 dark:text-stone-400 shadow-sm">
              <FileCheck2 className="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500">
              Amount
            </span>
          </div>
          <div className="text-lg font-mono font-bold text-stone-800 dark:text-stone-100 pl-[26px]">
            {formatMoney(cheque.amount, currency)}
          </div>
        </div>
      </div>

      {/* Status history */}
      {cheque.history?.length > 0 && (
        <div className="rounded-xl border border-stone-100 dark:border-stone-700/60 bg-white dark:bg-stone-800/30 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-6 h-6 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center">
              <Paperclip className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 dark:text-stone-500">
              Status History
            </span>
          </div>
          <div className="space-y-1.5">
            {cheque.history.map((h, i) => {
              const byName =
                typeof h.changedBy === "string"
                  ? null
                  : h.changedBy?.name || h.changedBy?.email;
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${STATUS_META[h.status].dot} shrink-0`}
                  />
                  <span className="font-medium text-stone-600 dark:text-stone-300">
                    {STATUS_META[h.status].label}
                  </span>
                  <span className="text-stone-400 dark:text-stone-500">
                    {formatDate(h.at)}
                  </span>
                  {byName && (
                    <span className="text-stone-400 dark:text-stone-500 ml-auto truncate">
                      by {byName}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Status-action bar */}
      {permissions.canUpdate && !isTerminal && (
        <div className="pt-4 border-t border-stone-100 dark:border-stone-700/60 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-stone-400 dark:text-stone-500">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>
              Mark cheque forward using next status, or change to any terminal
              state.
            </span>
          </div>
          <div className="flex items-center gap-2">
            {nextStep && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAdvance(cheque, nextStep);
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 border border-teal-200 dark:border-teal-900/60 px-3.5 py-1.5 text-[11px] font-bold text-teal-700 dark:text-teal-400 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" />
                Mark as {STATUS_META[nextStep].label}
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChangeStatus(cheque);
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-stone-50 dark:bg-stone-800/50 hover:bg-stone-100 dark:hover:bg-stone-700/60 border border-stone-200 dark:border-stone-700 px-3.5 py-1.5 text-[11px] font-bold text-stone-600 dark:text-stone-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Change status
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHEQUE ROW — accordion expandable row (BillsPayableTab pattern)
// ============================================================
function ChequeRow({
  cheque,
  currency,
  isOpen,
  onToggle,
  onAdvance,
  onChangeStatus,
  permissions,
}: {
  cheque: ChequeData;
  currency: string;
  isOpen: boolean;
  onToggle: () => void;
  onAdvance: (cheque: ChequeData, next: ChequeStatus) => void;
  onChangeStatus: (cheque: ChequeData) => void;
  permissions: UseFinancePermissionReturn["permissions"];
}) {
  let amountCaption: React.ReactNode = null;
  switch (cheque.status) {
    case "issued":
      amountCaption = (
        <div className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 zfm-mono">
          Awaiting presentation
        </div>
      );
      break;
    case "presented":
      amountCaption = (
        <div className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 zfm-mono">
          Awaiting clearance
        </div>
      );
      break;
    case "cleared":
      amountCaption = (
        <div className="text-[10px] text-teal-600 dark:text-teal-400 zfm-mono font-semibold">
          Cleared
        </div>
      );
      break;
    case "returned":
    case "bounced":
      amountCaption = (
        <div className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 zfm-mono">
          Returned / Bounced
        </div>
      );
      break;
    case "cancelled":
      amountCaption = (
        <div className="text-[10px] font-semibold text-stone-400 dark:text-stone-500 zfm-mono">
          Cancelled
        </div>
      );
      break;
  }

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <button
        onClick={onToggle}
        className="w-full text-left flex items-center gap-4 py-3.5 hover:bg-stone-50 dark:hover:bg-stone-800/50 rounded-xl px-3 transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-violet-50 dark:bg-violet-950/50 flex items-center justify-center text-violet-600 dark:text-violet-400 shrink-0">
          <FileCheck2 className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
            {cheque.payee}
          </div>
          <div className="text-xs text-stone-400 dark:text-stone-500 truncate flex items-center gap-2">
            <span className="font-mono">#{cheque.chequeNumber}</span>
            <span>·</span>
            <span>{cheque.bank}</span>
            <span>·</span>
            <span>{formatDate(cheque.chequeDate)}</span>
          </div>
        </div>
        <ChequeStatusPill status={cheque.status} />
        <div className="text-right shrink-0 min-w-[108px]">
          <div className="font-mono font-semibold text-stone-800 dark:text-stone-100 text-sm">
            {formatMoney(cheque.amount, currency)}
          </div>
          {amountCaption}
        </div>
        <div
          className={`shrink-0 transition-transform duration-200 ${
            isOpen ? "rotate-0" : ""
          }`}
        >
          {isOpen ? (
            <ChevronDown className="w-4 h-4 text-teal-500 dark:text-teal-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-stone-300 dark:text-stone-600" />
          )}
        </div>
      </button>

      {/* Smooth expand/collapse — identical to BillsPayableTab BillRow */}
      <div
        className={`grid transition-all duration-300 ease-in-out ${
          isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pt-2 pb-5 pl-13 ml-13 relative">
            <div className="absolute left-[22px] top-0 bottom-4 w-px bg-gradient-to-b from-teal-200 dark:from-teal-900 to-transparent" />
            <div className="ml-9 rounded-xl border border-stone-100 dark:border-stone-800 bg-stone-50/60 dark:bg-stone-800/40 p-5">
              <ChequeDetailsView
                cheque={cheque}
                currency={currency}
                onAdvance={onAdvance}
                onChangeStatus={onChangeStatus}
                permissions={permissions}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CHANGE STATUS MODAL
// ============================================================
function ChangeStatusModal({
  cheque,
  onClose,
  onSave,
  saving,
}: {
  cheque: ChequeData;
  onClose: () => void;
  onSave: (
    status: ChequeStatus,
    reason: string,
  ) => Promise<{ ok: boolean; warning?: string }>;
  saving: boolean;
}) {
  const [status, setStatus] = useState<ChequeStatus | "">("");
  const [reason, setReason] = useState("");
  const [warning, setWarning] = useState<string | null>(null);

  const options = CHEQUE_STATUSES.filter((s) => s.value !== cheque.status);
  const isFailure = status === "returned" || status === "bounced";
  const isRecovery =
    (cheque.status === "returned" || cheque.status === "bounced") &&
    (status === "presented" || status === "cleared");

  const submit = async () => {
    setWarning(null);
    if (!status) {
      setWarning("Choose a status");
      return;
    }
    const result = await onSave(status, reason);
    if (!result.ok) {
      setWarning(result.warning || "Could not update status");
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
      <div className="bg-white dark:bg-stone-900 rounded-3xl w-full max-w-sm p-7 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-50 dark:bg-violet-950 flex items-center justify-center">
              <FileCheck2 className="w-5 h-5 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
                Change status
              </h3>
              <p className="text-xs text-stone-400 dark:text-stone-500">
                #{cheque.chequeNumber}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {warning && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 text-xs font-medium">
            {warning}
          </div>
        )}

        <div className="mb-4">
          <SearchableSelect
            label="New status"
            required
            options={options}
            value={status}
            onChange={(v) => setStatus(v as ChequeStatus)}
            placeholder="Choose a status"
            searchPlaceholder="Search…"
          />
        </div>

        {isFailure && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
            <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              The linked payment will be reversed automatically — the bill's
              balance goes back up.
            </span>
          </div>
        )}

        {isRecovery && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 text-xs flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>
              This cheque had bounced — the linked payment will be reinstated
              automatically and the bill's balance will go back down.
            </span>
          </div>
        )}

        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="w-full px-4 py-2.5 text-sm rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-100 dark:focus:ring-teal-900 focus:border-teal-400 transition-all mb-5"
        />

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!status || saving}
            className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:pointer-events-none"
            style={{
              backgroundImage: "linear-gradient(135deg,#14b8a6,#0f766e)",
            }}
          >
            {saving ? "Saving…" : "Update status"}
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
    pendingAmount: number;
    pendingCount: number;
    clearedCount: number;
    bouncedCount: number;
    totalCheques: number;
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
        label="Pending Cheques"
        value={formatMoney(summary.pendingAmount, currency)}
        icon={<Clock />}
        fromColor="#d97706"
        toColor="#f59e0b"
        iconColor="text-white"
        trend={`${summary.pendingCount} cheques`}
        trendPositive={false}
      />
      <StatCard
        label="Cleared"
        value={summary.clearedCount}
        icon={<CheckCircle2 />}
        fromColor="#0d9488"
        toColor="#14b8a6"
        iconColor="text-white"
        trend="Settled"
        trendPositive={true}
      />
      <StatCard
        label="Bounced / Returned"
        value={summary.bouncedCount}
        icon={<XCircle />}
        fromColor="#dc2626"
        toColor="#ef4444"
        iconColor="text-white"
        trend="Needs follow-up"
        trendPositive={false}
      />
      <StatCard
        label="Total Cheques"
        value={summary.totalCheques}
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
const FinanceChequesTab: React.FC<UseFinancePermissionReturn> = ({
  permissions,
  permissionsLoaded,
  AccessDenied,
  PermissionLoading,
  canAccessPage,
}) => {
  const { currency } = useCurrency();
  const {
    cheques,
    summary,
    loading,
    saving,
    error,
    statusFilter,
    setStatusFilter,
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
    updateStatus,
  } = useFinanceCheques();

  const [statusTarget, setStatusTarget] = useState<ChequeData | null>(null);
  const [expandedChequeId, setExpandedChequeId] = useState<string | null>(null);

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
      <div>
        <h2 className="zfm-display text-lg font-semibold text-stone-900 dark:text-stone-50">
          Cheque Manager
        </h2>
        <p className="text-sm text-stone-400 dark:text-stone-500 mt-0.5">
          Track every cheque from issue to clearance
        </p>
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
              placeholder="Search cheque number or payee…"
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
              {cheques.length === 0 ? (
                <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                  <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                  <span className="text-sm">No cheques found.</span>
                </div>
              ) : (
                cheques.map((cheque) => {
                  const isOpen = expandedChequeId === cheque._id;
                  return (
                    <ChequeRow
                      key={cheque._id}
                      cheque={cheque}
                      currency={currency}
                      isOpen={isOpen}
                      onToggle={() =>
                        setExpandedChequeId(isOpen ? null : cheque._id)
                      }
                      onAdvance={(c, next) => updateStatus(c._id, next)}
                      onChangeStatus={setStatusTarget}
                      permissions={permissions}
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

      {statusTarget && (
        <ChangeStatusModal
          cheque={statusTarget}
          onClose={() => setStatusTarget(null)}
          onSave={(status, reason) =>
            updateStatus(statusTarget._id, status, reason)
          }
          saving={saving}
        />
      )}
    </div>
  );
};

export default FinanceChequesTab;

import React, { useState } from "react";
import {
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Inbox,
  FileCheck2,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileText,
  RotateCcw,
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
// CHEQUE ROW — expandable, mirrors PaymentRow pattern
// ============================================================
function ChequeRow({
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
  const [expanded, setExpanded] = useState(false);
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

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <div
        className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button className="w-6 h-6 rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500 dark:text-stone-400 shrink-0">
            <FileCheck2 className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
                {cheque.payee}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-500 zfm-mono">
                #{cheque.chequeNumber}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
              <span>{cheque.bank}</span>
              <span>•</span>
              <span>{formatDate(cheque.chequeDate)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ChequeStatusPill status={cheque.status} />
          <div className="font-mono font-semibold text-sm text-stone-800 dark:text-stone-100">
            {formatMoney(cheque.amount, currency)}
          </div>
          <ChevronRight
            className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </div>
      {expanded && (
        <div className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {supplierName && (
              <div>
                <span className="text-stone-400 dark:text-stone-500">
                  Supplier:
                </span>
                <span className="ml-2 text-stone-600 dark:text-stone-300">
                  {supplierName}
                </span>
              </div>
            )}
            {invoiceNumber && (
              <div>
                <span className="text-stone-400 dark:text-stone-500">
                  Against bill:
                </span>
                <span className="ml-2 font-mono text-stone-600 dark:text-stone-300">
                  {invoiceNumber}
                </span>
              </div>
            )}
            {paymentNumber && (
              <div>
                <span className="text-stone-400 dark:text-stone-500">
                  Payment:
                </span>
                <span className="ml-2 font-mono text-stone-600 dark:text-stone-300">
                  {paymentNumber}
                </span>
              </div>
            )}
          </div>

          {cheque.history?.length > 0 && (
            <div className="mt-4">
              <div className="text-[11px] font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">
                Status history
              </div>
              <div className="space-y-1.5">
                {[...cheque.history]
                  // .sort(
                  //   (a, b) =>
                  //     new Date(b.at).getTime() - new Date(a.at).getTime(),
                  // )
                  .map((h, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${STATUS_META[h.status].dot}`}
                      />
                      <span className="font-medium text-stone-600 dark:text-stone-300">
                        {STATUS_META[h.status].label}
                      </span>
                      <span>{formatDate(h.at)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* User that has update permission so he can change status of cheque */}
          {permissions.canUpdate && !isTerminal && (
            <div className="mt-4 pt-3 border-t border-stone-100 dark:border-stone-800 flex items-center gap-4">
              {nextStep && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdvance(cheque, nextStep);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-600 dark:text-teal-400 hover:underline"
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-500 dark:text-stone-400 hover:text-rose-500 dark:hover:text-rose-400 hover:underline"
              >
                <RotateCcw className="w-3 h-3" />
                Change status
              </button>
            </div>
          )}
        </div>
      )}
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
                cheques.map((cheque) => (
                  <ChequeRow
                    key={cheque._id}
                    cheque={cheque}
                    currency={currency}
                    onAdvance={(c, next) => updateStatus(c._id, next)}
                    onChangeStatus={setStatusTarget}
                    permissions={permissions}
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

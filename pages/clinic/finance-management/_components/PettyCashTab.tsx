import React from "react";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Inbox,
  Paperclip,
  Users,
  DollarSign,
  TrendingDown,
  Wallet,
  PieChart,
} from "lucide-react";
import usePettyCash, { PettyCashItem, StaffRef } from "../_hooks/usePettyCash";
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

const getAssignedLabel = (item: PettyCashItem): string => {
  if (!item.staffId) return "Global Pool";
  if (typeof item.staffId === "string")
    return `Staff #${item.staffId.slice(-6)}`;
  const staff = item.staffId as StaffRef;
  return staff.name || staff.email || `Staff #${staff._id.slice(-6)}`;
};

type StatusValue = "Available" | "Overspent";

const getStatus = (item: PettyCashItem): StatusValue =>
  item.totalAmount >= 0 ? "Available" : "Overspent";

type StatusFilterValue = "all" | StatusValue;

const STATUS_FILTERS: { value: StatusFilterValue; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "Available", label: "Available" },
  { value: "Overspent", label: "Overspent" },
];

function StatusPill({ status }: { status: StatusValue }) {
  const map: Record<StatusValue, { dot: string; text: string; bg: string }> = {
    Available: {
      dot: "bg-teal-500",
      text: "text-teal-700 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/50",
    },
    Overspent: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/50",
    },
  };
  const s = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function ReceiptLinks({ receipts }: { receipts: string[] }) {
  if (!receipts || receipts.length === 0) {
    return (
      <span className="text-[11px] text-stone-300 dark:text-stone-600">
        No receipts
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Paperclip className="w-3 h-3 text-stone-400 dark:text-stone-500" />
      {receipts.map((url, i) => (
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

// ============================================================
// STATS CARDS SECTION
// ============================================================

interface StatsSectionProps {
  summary: {
    totalAllocated: number;
    totalSpent: number;
    totalBalance: number;
    totalRecords: number;
    availableCount: number;
    overspentCount: number;
    globalTotalAmount: number;
    globalSpentAmount: number;
    globalRemainingAmount: number;
  };
  loading: boolean;
}

const StatsSection: React.FC<StatsSectionProps> = ({ summary, loading }) => {
  const { currency } = useCurrency();
  if (loading || summary.totalRecords === 0) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm p-6 animate-pulse"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="h-3 w-20 bg-stone-200 dark:bg-stone-700 rounded"></div>
              <div className="w-10 h-10 rounded-full bg-stone-200 dark:bg-stone-700"></div>
            </div>
            <div className="h-8 w-24 bg-stone-200 dark:bg-stone-700 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Allocated"
        value={formatMoney(summary.totalAllocated, currency)}
        icon={<DollarSign />}
        fromColor="#0d9488"
        toColor="#14b8a6"
        iconColor="text-white"
        trend={`${summary.totalRecords} records`}
        trendPositive={true}
      />
      <StatCard
        label="Total Spent"
        value={formatMoney(summary.totalSpent, currency)}
        icon={<TrendingDown />}
        fromColor="#dc2626"
        toColor="#ef4444"
        iconColor="text-white"
        trend="From all allocations"
        trendPositive={false}
      />
      <StatCard
        label="Remaining Balance"
        value={formatMoney(summary.totalBalance, currency)}
        icon={<Wallet />}
        fromColor="#7c3aed"
        toColor="#8b5cf6"
        iconColor="text-white"
        trend={`${summary.availableCount} available, ${summary.overspentCount} overspent`}
        trendPositive={summary.totalBalance >= 0}
      />
      <StatCard
        label="Global Pool"
        value={formatMoney(summary.globalRemainingAmount, currency)}
        icon={<PieChart />}
        fromColor="#059669"
        toColor="#10b981"
        iconColor="text-white"
        trend={`${formatMoney(summary.globalTotalAmount, currency)}  total`}
        trendPositive={true}
      />
    </div>
  );
};

// ============================================================
// MAIN PETTY CASH TAB
// ============================================================

const PettyCashTab: React.FC = () => {
  const { currency } = useCurrency();
  const {
    loading,
    error,
    pettyCash,
    summary,
    search,
    setSearch,
    page,
    limit,
    pagination,
    nextPage,
    prevPage,
  } = usePettyCash();

  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilterValue>("all");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredRows = React.useMemo<PettyCashItem[]>(() => {
    if (statusFilter === "all") return pettyCash;
    return pettyCash.filter((item) => getStatus(item) === statusFilter);
  }, [pettyCash, statusFilter]);

  const from = pagination.totalResults === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, pagination.totalResults);

  return (
    <div className="space-y-7">
      {/* Stats Cards Section */}
      <StatsSection summary={summary} loading={loading} />
      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm dark:shadow-stone-900/20 overflow-hidden transition-colors duration-300">
        {/* Filter bar */}
        <div className="p-5 border-b border-stone-200 dark:border-stone-700 flex flex-wrap items-center gap-2.5 bg-white dark:bg-stone-900">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-stone-400 dark:text-stone-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient name, email or phone…"
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 transition-all shadow-sm dark:shadow-stone-900/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as StatusFilterValue)
            }
            className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-stone-900/20"
          >
            {STATUS_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto bg-white dark:bg-stone-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-widest font-bold border-b border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30">
                <th className="px-5 py-3.5 font-bold w-10"></th>
                <th className="px-5 py-3.5 font-bold">Assigned To</th>
                <th className="px-5 py-3.5 font-bold text-right">Allocated</th>
                <th className="px-5 py-3.5 font-bold text-right">Spent</th>
                <th className="px-5 py-3.5 font-bold text-right">Balance</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Updated</th>
                <th className="px-5 py-3.5 font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {loading && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-16 text-center text-stone-400 dark:text-stone-500"
                  >
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600 dark:text-teal-400" />
                    <span className="text-sm">Loading petty cash entries…</span>
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-16 text-center text-rose-500 dark:text-rose-400 text-sm"
                  >
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-16 text-center text-stone-400 dark:text-stone-500"
                  >
                    <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                    <span className="text-sm">
                      No petty cash entries found.
                    </span>
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                filteredRows.map((item, idx) => {
                  const status = getStatus(item);
                  const expanded = expandedIds.has(item._id);
                  const secondaryLabel = item.patientName || item.note || null;
                  const allocations = item.allocatedAmounts || [];
                  const expenses = item.expenses || [];

                  return (
                    <React.Fragment key={item._id || idx}>
                      <tr
                        className={`${
                          idx % 2 === 1
                            ? "bg-stone-50/50 dark:bg-stone-800/30"
                            : "bg-white dark:bg-stone-900"
                        } hover:bg-teal-50/50 dark:hover:bg-teal-950/30 transition-colors duration-150`}
                      >
                        <td className="px-5 py-3.5">
                          <button
                            onClick={() => toggleExpand(item._id)}
                            className="w-8 h-8 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors shadow-sm dark:shadow-stone-900/20"
                            aria-label={expanded ? "Collapse" : "Expand"}
                          >
                            {expanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2 text-stone-800 dark:text-stone-100 font-medium">
                            <Users className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                            {getAssignedLabel(item)}
                          </div>
                          {secondaryLabel && (
                            <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                              {secondaryLabel}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-teal-600 dark:text-teal-400">
                          +{formatMoney(item.totalAllocated, currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-rose-500 dark:text-rose-400">
                          −{formatMoney(item.totalSpent, currency)}
                        </td>
                        <td
                          className={`px-5 py-3.5 text-right font-mono font-semibold ${
                            status === "Available"
                              ? "text-stone-800 dark:text-stone-100"
                              : "text-rose-500 dark:text-rose-400"
                          }`}
                        >
                          {formatMoney(item.totalAmount, currency)}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill status={status} />
                        </td>
                        <td className="px-5 py-3.5 text-stone-400 dark:text-stone-500 font-mono text-xs whitespace-nowrap">
                          {formatDate(item.updatedAt)}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            onClick={() => toggleExpand(item._id)}
                            className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 whitespace-nowrap hover:underline"
                          >
                            {expanded ? "Hide" : "Details"}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="bg-stone-50/70 dark:bg-stone-800/40">
                          <td
                            colSpan={8}
                            className="px-5 py-5 border-t border-stone-200 dark:border-stone-700"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Allocations */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <ArrowUpRight className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                  Allocations ({allocations.length})
                                </div>
                                {allocations.length === 0 ? (
                                  <div className="text-xs text-stone-400 dark:text-stone-500">
                                    No allocations recorded yet.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {allocations.map((alloc, i) => (
                                      <div
                                        key={alloc._id || i}
                                        className="flex items-center justify-between bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-2.5 shadow-sm dark:shadow-stone-900/20"
                                      >
                                        <div className="flex items-center gap-3">
                                          <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center shrink-0">
                                            <ArrowUpRight className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                          </div>
                                          <div>
                                            <div className="text-xs font-mono text-stone-400 dark:text-stone-500">
                                              {formatDate(alloc.date)}
                                            </div>
                                            <ReceiptLinks
                                              receipts={alloc.receipts}
                                            />
                                          </div>
                                        </div>
                                        <span className="font-mono font-semibold text-sm text-teal-600 dark:text-teal-400">
                                          +{formatMoney(alloc.amount, currency)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Expenses */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                                  Expenses ({expenses.length})
                                </div>
                                {expenses.length === 0 ? (
                                  <div className="text-xs text-stone-400 dark:text-stone-500">
                                    No expenses recorded yet.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {expenses.map((exp, i) => (
                                      <div
                                        key={exp._id || i}
                                        className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-2.5 shadow-sm dark:shadow-stone-900/20"
                                      >
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="flex items-start gap-3">
                                            <div className="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-950/50 flex items-center justify-center shrink-0 mt-0.5">
                                              <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" />
                                            </div>
                                            <div>
                                              <div className="text-sm font-medium text-stone-800 dark:text-stone-100">
                                                {exp.description}
                                              </div>
                                              <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                                                {exp.vendorName || "No vendor"}{" "}
                                                · {formatDate(exp.date)}
                                              </div>
                                              {exp.items &&
                                                exp.items.length > 0 && (
                                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                                    {exp.items.map((it, ii) => (
                                                      <span
                                                        key={ii}
                                                        className="text-[10px] font-medium bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400 rounded-full px-2 py-0.5"
                                                      >
                                                        {it.itemName}{" "}
                                                        {it.amount
                                                          ? `· ${formatMoney(it.amount, currency)}`
                                                          : ""}
                                                      </span>
                                                    ))}
                                                  </div>
                                                )}
                                              <div className="mt-1.5">
                                                <ReceiptLinks
                                                  receipts={exp.receipts}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                          <span className="font-mono font-semibold text-sm text-rose-500 dark:text-rose-400 whitespace-nowrap">
                                            −
                                            {formatMoney(
                                              exp.spentAmount,
                                              currency,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        {!loading && !error && pagination.totalResults > 0 && (
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
                Page {pagination.currentPage} of {pagination.totalPages}
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
    </div>
  );
};

export default PettyCashTab;

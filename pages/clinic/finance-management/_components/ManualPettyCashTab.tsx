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
  Users,
  Wallet,
  Tag,
  Building2,
  Image,
} from "lucide-react";
import useManualPettyCash, {
  ManualPettyCashItem,
} from "../_hooks/useManualPettyCash";
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

type TransactionType = "Income" | "Expense";

const getTransactionType = (item: ManualPettyCashItem): TransactionType =>
  item.isExpense ? "Expense" : "Income";

type TypeFilterValue = "all" | TransactionType;

const TYPE_FILTERS: { value: TypeFilterValue; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "Income", label: "Income" },
  { value: "Expense", label: "Expense" },
];

function TypePill({ type }: { type: TransactionType }) {
  const map: Record<
    TransactionType,
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

function ReceiptLinks({ images }: { images: string[] }) {
  if (!images || images.length === 0) {
    return (
      <span className="text-[11px] text-stone-300 dark:text-stone-600">
        No images
      </span>
    );
  }
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <Image className="w-3 h-3 text-stone-400 dark:text-stone-500" />
      {images.map((url, i) => (
        <a
          key={i}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline"
        >
          Image #{i + 1}
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
    totalAmount: number;
    totalExpenses: number;
    totalIncome: number;
    totalRecords: number;
    expenseCount: number;
    incomeCount: number;
    totalItems: number;
    globalTotalAmount: number;
    globalTotalExpenses: number;
    globalTotalIncome: number;
    globalBalance: number;
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
        label="Total Income"
        value={formatMoney(summary.totalIncome, currency)}
        icon={<ArrowUpRight />}
        fromColor="#059669"
        toColor="#10b981"
        iconColor="text-white"
        trend={`${summary.incomeCount} transactions`}
        trendPositive={true}
      />
      <StatCard
        label="Total Expenses"
        value={formatMoney(summary.totalExpenses, currency)}
        icon={<ArrowDownRight />}
        fromColor="#dc2626"
        toColor="#ef4444"
        iconColor="text-white"
        trend={`${summary.expenseCount} transactions`}
        trendPositive={false}
      />
      <StatCard
        label="Net Balance"
        value={formatMoney(summary.globalBalance, currency)}
        icon={<Wallet />}
        fromColor="#7c3aed"
        toColor="#8b5cf6"
        iconColor="text-white"
        trend={`${summary.totalRecords} total records`}
        trendPositive={summary.globalBalance >= 0}
      />
      <StatCard
        label="Total Items"
        value={summary.totalItems.toString()}
        icon={<Tag />}
        fromColor="#0d9488"
        toColor="#14b8a6"
        iconColor="text-white"
        trend="Across all entries"
        trendPositive={true}
      />
    </div>
  );
};

// ============================================================
// MAIN MANUAL PETTY CASH TAB
// ============================================================

const ManualPettyCashTab: React.FC = () => {
  const { currency } = useCurrency();
  const {
    loading,
    error,
    manualPettyCash,
    summary,
    search,
    setSearch,
    page,
    limit,
    pagination,
    nextPage,
    prevPage,
  } = useManualPettyCash();

  const [typeFilter, setTypeFilter] = React.useState<TypeFilterValue>("all");
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredRows = React.useMemo<ManualPettyCashItem[]>(() => {
    if (typeFilter === "all") return manualPettyCash;
    return manualPettyCash.filter(
      (item) => getTransactionType(item) === typeFilter,
    );
  }, [manualPettyCash, typeFilter]);

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
              placeholder="Search by name, vendor, note or items…"
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 transition-all shadow-sm dark:shadow-stone-900/20"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as TypeFilterValue)}
            className="text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 text-stone-600 dark:text-stone-300 font-medium shadow-sm dark:shadow-stone-900/20"
          >
            {TYPE_FILTERS.map((f) => (
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
                <th className="px-5 py-3.5 font-bold">Name</th>
                <th className="px-5 py-3.5 font-bold text-right">Amount</th>
                <th className="px-5 py-3.5 font-bold">Type</th>
                <th className="px-5 py-3.5 font-bold">Vendor</th>
                <th className="px-5 py-3.5 font-bold">Added By</th>
                <th className="px-5 py-3.5 font-bold">Date</th>
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
                    <span className="text-sm">
                      Loading manual petty cash entries…
                    </span>
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
                      No manual petty cash entries found.
                    </span>
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                filteredRows.map((item, idx) => {
                  const type = getTransactionType(item);
                  const expanded = expandedIds.has(item._id);
                  const isExpense = item.isExpense;

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
                            {item.name}
                          </div>
                          {item.note && (
                            <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                              {item.note}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold">
                          <span
                            className={
                              isExpense
                                ? "text-rose-500 dark:text-rose-400"
                                : "text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {isExpense ? "−" : "+"}
                            {formatMoney(item.amount, currency)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <TypePill type={type} />
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5 text-stone-600 dark:text-stone-300 text-sm">
                            <Building2 className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                            {getVendorLabel(item)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="text-xs text-stone-500 dark:text-stone-400">
                            {getAddedByLabel(item)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-stone-400 dark:text-stone-500 font-mono text-xs whitespace-nowrap">
                          {formatDate(item.createdAt)}
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
                              {/* Left Column - Details */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                  Transaction Details
                                </div>
                                <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 space-y-3 shadow-sm dark:shadow-stone-900/20">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Name
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.name}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Amount
                                    </span>
                                    <span
                                      className={`font-mono font-semibold ${
                                        isExpense
                                          ? "text-rose-600 dark:text-rose-400"
                                          : "text-emerald-600 dark:text-emerald-400"
                                      }`}
                                    >
                                      {isExpense ? "−" : "+"}
                                      {formatMoney(item.amount, currency)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Type
                                    </span>
                                    <TypePill type={type} />
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Vendor
                                    </span>
                                    <span className="text-stone-800 dark:text-stone-100">
                                      {getVendorLabel(item)}
                                    </span>
                                  </div>
                                  {item.note && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Note
                                      </span>
                                      <span className="text-stone-800 dark:text-stone-100 max-w-[200px] truncate">
                                        {item.note}
                                      </span>
                                    </div>
                                  )}
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Added By
                                    </span>
                                    <span className="text-stone-800 dark:text-stone-100">
                                      {getAddedByLabel(item)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Created
                                    </span>
                                    <span className="text-stone-800 dark:text-stone-100 font-mono text-xs">
                                      {formatDateTime(item.createdAt)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Used from Petty Cash
                                    </span>
                                    <span className="text-stone-800 dark:text-stone-100">
                                      {item.usedFromPettyCash ? "Yes" : "No"}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Images
                                    </span>
                                    <ReceiptLinks images={item.images || []} />
                                  </div>
                                </div>
                              </div>

                              {/* Right Column - Items */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                  Items ({item.items?.length || 0})
                                </div>
                                {!item.items || item.items.length === 0 ? (
                                  <div className="text-xs text-stone-400 dark:text-stone-500 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm dark:shadow-stone-900/20">
                                    No items recorded for this transaction.
                                  </div>
                                ) : (
                                  <div className="space-y-2">
                                    {item.items.map((it, i) => (
                                      <div
                                        key={i}
                                        className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 px-4 py-3 shadow-sm dark:shadow-stone-900/20"
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                            <div className="w-7 h-7 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center shrink-0">
                                              <Tag className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                            </div>
                                            <div>
                                              <div className="text-sm font-medium text-stone-800 dark:text-stone-100">
                                                {it.itemName || "Unnamed Item"}
                                              </div>
                                            </div>
                                          </div>
                                          {it.amount && (
                                            <span
                                              className={`font-mono font-semibold text-sm ${
                                                isExpense
                                                  ? "text-rose-500 dark:text-rose-400"
                                                  : "text-emerald-600 dark:text-emerald-400"
                                              }`}
                                            >
                                              {isExpense ? "−" : "+"}
                                              {formatMoney(it.amount, currency)}
                                            </span>
                                          )}
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

export default ManualPettyCashTab;

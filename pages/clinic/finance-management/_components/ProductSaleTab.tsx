import React from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Inbox,
  FileText,
  Package,
  Filter,
  X,
  CheckCircle,
  Clock,
  ShoppingBag,
  Coins,
} from "lucide-react";
import useProductSale, { ProductSaleFilters } from "../_hooks/useProductSale";
import StatCard from "./StatCard";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney } from "@/lib/currencyHelper";

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

const formatDate = (d?: string | Date): string =>
  d
    ? new Date(d).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatDateTime = (d?: string | Date): string =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

// ============================================================
// PATIENT HELPER FUNCTIONS
// ============================================================

const getPatientInitials = (patient: any): string => {
  if (!patient) return "?";
  if (typeof patient === "string") return patient.slice(0, 2).toUpperCase();

  const firstName = patient.firstName || "";
  const lastName = patient.lastName || "";

  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (patient.name) {
    const nameParts = patient.name.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return patient.name.slice(0, 2).toUpperCase();
  }
  return patient.email?.slice(0, 2).toUpperCase() || "??";
};

const getPatientDisplayName = (patient: any): string => {
  if (!patient) return "Unknown Patient";
  if (typeof patient === "string") return `Patient #${patient.slice(-6)}`;

  const firstName = patient.firstName || "";
  const lastName = patient.lastName || "";
  const name = patient.name || "";

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  if (name) {
    return name;
  }
  if (patient.email) {
    return patient.email;
  }
  if (patient.mobileNumber) {
    return patient.mobileNumber;
  }
  return `Patient #${patient._id?.slice(-6) || "??"}`;
};

const getAvatarColor = (patient: any): string => {
  const colors = [
    "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300",
    "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
    "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300",
    "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300",
    "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
  ];

  const id = typeof patient === "string" ? patient : patient?._id || "";
  const index = id ? id.toString().length % colors.length : 0;
  return colors[index];
};

// ============================================================
// STATUS PILLS & BADGES
// ============================================================

type StatusValue =
  | "pending"
  | "completed"
  | "canceled"
  | "refunded"
  | "partially_refunded";
type PaymentStatusValue =
  | "pending"
  | "paid"
  | "partially_paid"
  | "failed"
  | "partially_refunded"
  | "refunded";

const STATUS_OPTIONS: { value: StatusValue | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "canceled", label: "Canceled" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially Refunded" },
];

const PAYMENT_STATUS_OPTIONS: {
  value: PaymentStatusValue | "all";
  label: string;
}[] = [
  { value: "all", label: "All Payment Status" },
  { value: "pending", label: "Pending" },
  { value: "paid", label: "Paid" },
  { value: "partially_paid", label: "Partially Paid" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially Refunded" },
];

function StatusPill({ status }: { status: StatusValue }) {
  const map: Record<StatusValue, { dot: string; text: string; bg: string }> = {
    pending: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    },
    completed: {
      dot: "bg-teal-500",
      text: "text-teal-700 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/50",
    },
    canceled: {
      dot: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/50",
    },
    refunded: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/50",
    },
    partially_refunded: {
      dot: "bg-purple-500",
      text: "text-purple-700 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/50",
    },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.replace("_", " ")}
    </span>
  );
}

function PaymentStatusPill({ status }: { status: PaymentStatusValue }) {
  const map: Record<
    PaymentStatusValue,
    { dot: string; text: string; bg: string }
  > = {
    pending: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    },
    paid: {
      dot: "bg-teal-500",
      text: "text-teal-700 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/50",
    },
    partially_paid: {
      dot: "bg-blue-500",
      text: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
    },
    failed: {
      dot: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/50",
    },
    refunded: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/50",
    },
    partially_refunded: {
      dot: "bg-purple-500",
      text: "text-purple-700 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/50",
    },
  };
  const s = map[status] || map.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.replace("_", " ")}
    </span>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 px-3 py-1 text-xs font-medium border border-teal-100 dark:border-teal-800/50">
      {label}
      <button
        onClick={onRemove}
        className="hover:text-teal-900 dark:hover:text-teal-100 transition-colors"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

// ============================================================
// STATS CARDS SECTION
// ============================================================

interface StatsSectionProps {
  summary: {
    totalSales: number;
    totalPaid: number;
    totalPending: number;
    totalCommission: number;
    totalItems: number;
    totalRecords: number;
    completedCount: number;
    pendingCount: number;
    canceledCount: number;
    refundedCount: number;
    paidCount: number;
    partiallyPaidCount: number;
    pendingPaymentCount: number;
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
        label="Total Sales"
        value={formatMoney(summary.totalSales, currency)}
        icon={<ShoppingBag />}
        fromColor="#0d9488"
        toColor="#14b8a6"
        iconColor="text-white"
        trend={`${summary.totalRecords} transactions`}
        trendPositive={true}
      />
      <StatCard
        label="Total Revenue"
        value={formatMoney(summary.totalPaid, currency)}
        icon={<CheckCircle />}
        fromColor="#059669"
        toColor="#10b981"
        iconColor="text-white"
        trend={`${summary.paidCount} paid`}
        trendPositive={true}
      />
      <StatCard
        label="Pending"
        value={formatMoney(summary.totalPending, currency)}
        icon={<Clock />}
        fromColor="#d97706"
        toColor="#f59e0b"
        iconColor="text-white"
        trend={`${summary.pendingPaymentCount} pending`}
        trendPositive={false}
      />
      <StatCard
        label="Commission"
        value={formatMoney(summary.totalCommission, currency)}
        icon={<Coins />}
        fromColor="#7c3aed"
        toColor="#8b5cf6"
        iconColor="text-white"
        trend="Total earned"
        trendPositive={true}
      />
    </div>
  );
};

// ============================================================
// MAIN PRODUCT SALE TAB
// ============================================================

const ProductSaleTab: React.FC = () => {
  const { currency } = useCurrency();

  const {
    loading,
    error,
    productSales,
    summary,
    search,
    setSearch,
    filters,
    applyFilters,
    clearFilters,
    page,
    limit,
    pagination,
    nextPage,
    prevPage,
  } = useProductSale();

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = React.useState<boolean>(false);
  const [localFilters, setLocalFilters] =
    React.useState<ProductSaleFilters>(filters);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApplyFilters = () => {
    applyFilters(localFilters);
    setShowFilters(false);
  };

  const handleClearFilters = () => {
    setLocalFilters({});
    clearFilters();
    setShowFilters(false);
  };

  const hasActiveFilters = Object.keys(filters).length > 0;

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
              placeholder="Search by invoice, patient, product name or code…"
              className="w-full pl-10 pr-3 py-2.5 text-sm rounded-full border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 transition-all shadow-sm dark:shadow-stone-900/20"
            />
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 text-sm rounded-full border px-4 py-2.5 font-medium transition-all shadow-sm dark:shadow-stone-900/20 ${
              hasActiveFilters
                ? "border-teal-300 dark:border-teal-700 bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300"
                : "border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-5 h-5 rounded-full bg-teal-600 dark:bg-teal-500 text-white text-[10px] font-bold flex items-center justify-center">
                {Object.keys(filters).length}
              </span>
            )}
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="p-5 border-b border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
                  Status
                </label>
                <select
                  value={localFilters.status || ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      status: e.target.value || undefined,
                    })
                  }
                  className="w-full text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 shadow-sm dark:shadow-stone-900/20 transition-colors"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
                  Payment Status
                </label>
                <select
                  value={localFilters.paymentStatus || ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      paymentStatus: e.target.value || undefined,
                    })
                  }
                  className="w-full text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 shadow-sm dark:shadow-stone-900/20 transition-colors"
                >
                  {PAYMENT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
                  Date Range
                </label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={localFilters.startDate || ""}
                    onChange={(e) =>
                      setLocalFilters({
                        ...localFilters,
                        startDate: e.target.value || undefined,
                      })
                    }
                    className="flex-1 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 shadow-sm dark:shadow-stone-900/20 transition-colors"
                    placeholder="From"
                  />
                  <input
                    type="date"
                    value={localFilters.endDate || ""}
                    onChange={(e) =>
                      setLocalFilters({
                        ...localFilters,
                        endDate: e.target.value || undefined,
                      })
                    }
                    className="flex-1 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 shadow-sm dark:shadow-stone-900/20 transition-colors"
                    placeholder="To"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white transition-colors shadow-sm dark:shadow-stone-900/20"
              >
                Apply Filters
              </button>
              <button
                onClick={handleClearFilters}
                className="px-4 py-2 text-sm font-semibold rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-stone-700 transition-colors shadow-sm dark:shadow-stone-900/20"
              >
                Clear All
              </button>
            </div>
          </div>
        )}

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="px-5 py-3 border-b border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 flex flex-wrap gap-1.5">
            {filters.status && (
              <FilterChip
                label={`Status: ${filters.status}`}
                onRemove={() => {
                  const newFilters = { ...filters };
                  delete newFilters.status;
                  applyFilters(newFilters);
                }}
              />
            )}
            {filters.paymentStatus && (
              <FilterChip
                label={`Payment: ${filters.paymentStatus}`}
                onRemove={() => {
                  const newFilters = { ...filters };
                  delete newFilters.paymentStatus;
                  applyFilters(newFilters);
                }}
              />
            )}
            {filters.startDate && (
              <FilterChip
                label={`From: ${formatDate(filters.startDate)}`}
                onRemove={() => {
                  const newFilters = { ...filters };
                  delete newFilters.startDate;
                  applyFilters(newFilters);
                }}
              />
            )}
            {filters.endDate && (
              <FilterChip
                label={`To: ${formatDate(filters.endDate)}`}
                onRemove={() => {
                  const newFilters = { ...filters };
                  delete newFilters.endDate;
                  applyFilters(newFilters);
                }}
              />
            )}
            {filters.minAmount !== undefined && filters.minAmount !== null && (
              <FilterChip
                label={`Min: ${formatMoney(filters.minAmount, currency)}`}
                onRemove={() => {
                  const newFilters = { ...filters };
                  delete newFilters.minAmount;
                  applyFilters(newFilters);
                }}
              />
            )}
            {filters.maxAmount !== undefined && filters.maxAmount !== null && (
              <FilterChip
                label={`Max: ${formatMoney(filters.maxAmount, currency)}`}
                onRemove={() => {
                  const newFilters = { ...filters };
                  delete newFilters.maxAmount;
                  applyFilters(newFilters);
                }}
              />
            )}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto bg-white dark:bg-stone-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] text-stone-500 dark:text-stone-400 uppercase tracking-widest font-bold border-b border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30">
                <th className="px-5 py-3.5 font-bold w-10"></th>
                <th className="px-5 py-3.5 font-bold">Invoice</th>
                <th className="px-5 py-3.5 font-bold">Patient</th>
                <th className="px-5 py-3.5 font-bold">Items</th>
                <th className="px-5 py-3.5 font-bold text-right">Total</th>
                <th className="px-5 py-3.5 font-bold text-right">Paid</th>
                <th className="px-5 py-3.5 font-bold">Status</th>
                <th className="px-5 py-3.5 font-bold">Payment</th>
                <th className="px-5 py-3.5 font-bold">Date</th>
                <th className="px-5 py-3.5 font-bold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
              {loading && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-16 text-center text-stone-400 dark:text-stone-500"
                  >
                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600 dark:text-teal-400" />
                    <span className="text-sm">Loading product sales…</span>
                  </td>
                </tr>
              )}

              {!loading && error && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-16 text-center text-rose-500 dark:text-rose-400 text-sm"
                  >
                    {error}
                  </td>
                </tr>
              )}

              {!loading && !error && productSales.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-16 text-center text-stone-400 dark:text-stone-500"
                  >
                    <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                    <span className="text-sm">No product sales found.</span>
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                productSales.map((item, idx) => {
                  const expanded = expandedIds.has(item._id);
                  const items = item.items || [];

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
                          <div className="font-mono font-semibold text-stone-800 dark:text-stone-100 text-xs">
                            {item.invoiceNo}
                          </div>
                          <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                            {typeof item.soldBy === "object" &&
                              item.soldBy?.name}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(item.patientId)}`}
                            >
                              {getPatientInitials(item.patientId)}
                            </div>
                            <div>
                              <div className="text-stone-800 dark:text-stone-100 font-medium text-sm">
                                {getPatientDisplayName(item.patientId)}
                              </div>
                              {typeof item.patientId === "object" &&
                                item.patientId?.emrNumber && (
                                  <div className="text-[10px] text-stone-400 dark:text-stone-500">
                                    EMR: {item.patientId.emrNumber}
                                  </div>
                                )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-stone-400 dark:text-stone-500" />
                            <span className="text-stone-700 dark:text-stone-300 text-sm">
                              {items.length}{" "}
                              {items.length === 1 ? "item" : "items"}
                            </span>
                          </div>
                          {items.length > 0 && (
                            <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5 truncate max-w-[120px]">
                              {items[0].name}
                              {items.length > 1 && ` +${items.length - 1} more`}
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-stone-800 dark:text-stone-100">
                          {formatMoney(item.totalPrice, currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-teal-600 dark:text-teal-400">
                          {formatMoney(item.totalPaidAmount, currency)}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill status={item.status as StatusValue} />
                        </td>
                        <td className="px-5 py-3.5">
                          <PaymentStatusPill
                            status={item.paymentStatus as PaymentStatusValue}
                          />
                        </td>
                        <td className="px-5 py-3.5 text-stone-400 dark:text-stone-500 font-mono text-xs whitespace-nowrap">
                          {formatDate(item.invoiceDate)}
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
                            colSpan={10}
                            className="px-5 py-5 border-t border-stone-200 dark:border-stone-700"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Items List */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <Package className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                  Items ({items.length})
                                </div>
                                <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 shadow-sm dark:shadow-stone-900/20 overflow-hidden">
                                  <table className="w-full text-xs">
                                    <thead className="bg-stone-50 dark:bg-stone-800/50">
                                      <tr className="text-stone-500 dark:text-stone-400">
                                        <th className="px-3 py-2 text-left font-semibold">
                                          Product
                                        </th>
                                        <th className="px-3 py-2 text-center font-semibold">
                                          Qty
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                          Price
                                        </th>
                                        <th className="px-3 py-2 text-right font-semibold">
                                          Total
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                                      {items.map((product, i) => (
                                        <tr
                                          key={i}
                                          className="hover:bg-stone-50 dark:hover:bg-stone-800/50 transition-colors"
                                        >
                                          <td className="px-3 py-2">
                                            <div className="font-medium text-stone-800 dark:text-stone-100">
                                              {product.name}
                                            </div>
                                            <div className="text-[10px] text-stone-400 dark:text-stone-500">
                                              {product.code} ·{" "}
                                              {product.description}
                                            </div>
                                          </td>
                                          <td className="px-3 py-2 text-center text-stone-600 dark:text-stone-400">
                                            {product.quantity} {product.uom}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono text-stone-600 dark:text-stone-400">
                                            {formatMoney(
                                              product.unitPrice,
                                              currency,
                                            )}
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono font-semibold text-stone-800 dark:text-stone-100">
                                            {formatMoney(
                                              product.totalPrice,
                                              currency,
                                            )}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                    <tfoot className="bg-stone-50 dark:bg-stone-800/50 border-t border-stone-200 dark:border-stone-700">
                                      <tr>
                                        <td
                                          colSpan={3}
                                          className="px-3 py-2 text-right font-bold text-stone-700 dark:text-stone-300"
                                        >
                                          Total
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-stone-800 dark:text-stone-100">
                                          {formatMoney(
                                            item.totalPrice,
                                            currency,
                                          )}
                                        </td>
                                      </tr>
                                      {item.totalCommission > 0 && (
                                        <tr>
                                          <td
                                            colSpan={3}
                                            className="px-3 py-2 text-right text-stone-500 dark:text-stone-400"
                                          >
                                            Commission
                                          </td>
                                          <td className="px-3 py-2 text-right font-mono text-purple-600 dark:text-purple-400">
                                            {formatMoney(
                                              item.totalCommission,
                                              currency,
                                            )}
                                          </td>
                                        </tr>
                                      )}
                                    </tfoot>
                                  </table>
                                </div>
                              </div>

                              {/* Additional Info */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  Details
                                </div>
                                <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm dark:shadow-stone-900/20 space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Invoice
                                    </span>
                                    <span className="font-mono font-medium text-stone-800 dark:text-stone-100">
                                      {item.invoiceNo}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Date
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {formatDateTime(item.invoiceDate)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Payment Method
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.paymentMethodName}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Sold By
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {typeof item.soldBy === "object"
                                        ? item.soldBy?.name
                                        : "Unknown"}
                                    </span>
                                  </div>
                                  {item.items.some((p) => p.notes) && (
                                    <div className="text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Notes
                                      </span>
                                      <div className="mt-1 space-y-1">
                                        {item.items
                                          .filter((p) => p.notes)
                                          .map((p, i) => (
                                            <p
                                              key={i}
                                              className="text-stone-700 dark:text-stone-300 text-xs bg-stone-50 dark:bg-stone-800 rounded-lg px-3 py-1.5 border border-stone-100 dark:border-stone-700"
                                            >
                                              <span className="font-medium">
                                                {p.name}:
                                              </span>{" "}
                                              {p.notes}
                                            </p>
                                          ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
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

export default ProductSaleTab;

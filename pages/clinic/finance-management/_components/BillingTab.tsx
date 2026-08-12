import React from "react";
import {
  Search,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Inbox,
  FileText,
  Stethoscope,
  Package,
  CreditCard,
  Wallet,
  Filter,
  X,
  DollarSign,
  CheckCircle,
  Clock,
  Coins,
} from "lucide-react";
import useBilling, {
  BillingItem,
  BillingFilters,
  getPatientInitials,
  getPatientDisplayName,
  getAvatarColor,
} from "../_hooks/useBilling";
import StatCard from "./StatCard";
import { useCurrency } from "@/context/CurrencyContext";
import { formatMoney } from "@/lib/currencyHelper";

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

const getInvoicedByName = (item: BillingItem): string => {
  if (!item.invoicedById) return "—";
  if (typeof item.invoicedById === "string")
    return `User #${item.invoicedById.slice(-6)}`;
  return (
    item.invoicedById.name ||
    item.invoicedById.email ||
    `User #${item.invoicedById._id.slice(-6)}`
  );
};

type StatusValue =
  | "Active"
  | "Cancelled"
  | "Completed"
  | "Rejected"
  | "Released"
  | "Partial";

const STATUS_OPTIONS: { value: StatusValue | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  { value: "Active", label: "Active" },
  { value: "Completed", label: "Completed" },
  { value: "Partial", label: "Partial" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Rejected", label: "Rejected" },
  { value: "Released", label: "Released" },
];

const SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All Services" },
  { value: "Package", label: "Package" },
  { value: "Treatment", label: "Treatment" },
  { value: "Service", label: "Service" },
  { value: "Product", label: "Product" },
];

function StatusPill({ status }: { status: StatusValue }) {
  const map: Record<StatusValue, { dot: string; text: string; bg: string }> = {
    Active: {
      dot: "bg-blue-500",
      text: "text-blue-700 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/50",
    },
    Completed: {
      dot: "bg-teal-500",
      text: "text-teal-700 dark:text-teal-400",
      bg: "bg-teal-50 dark:bg-teal-950/50",
    },
    Partial: {
      dot: "bg-amber-500",
      text: "text-amber-700 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/50",
    },
    Cancelled: {
      dot: "bg-red-500",
      text: "text-red-700 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/50",
    },
    Rejected: {
      dot: "bg-rose-500",
      text: "text-rose-700 dark:text-rose-400",
      bg: "bg-rose-50 dark:bg-rose-950/50",
    },
    Released: {
      dot: "bg-purple-500",
      text: "text-purple-700 dark:text-purple-400",
      bg: "bg-purple-50 dark:bg-purple-950/50",
    },
  };
  const s = map[status] || map.Active;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${s.bg} ${s.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status}
    </span>
  );
}

function ServiceBadge({ service }: { service: string }) {
  const map: Record<
    string,
    { icon: React.ReactNode; bg: string; text: string }
  > = {
    Package: {
      icon: <Package className="w-3 h-3" />,
      bg: "bg-purple-50 dark:bg-purple-950/50",
      text: "text-purple-700 dark:text-purple-400",
    },
    Treatment: {
      icon: <Stethoscope className="w-3 h-3" />,
      bg: "bg-blue-50 dark:bg-blue-950/50",
      text: "text-blue-700 dark:text-blue-400",
    },
    Service: {
      icon: <FileText className="w-3 h-3" />,
      bg: "bg-teal-50 dark:bg-teal-950/50",
      text: "text-teal-700 dark:text-teal-400",
    },
    Product: {
      icon: <CreditCard className="w-3 h-3" />,
      bg: "bg-amber-50 dark:bg-amber-950/50",
      text: "text-amber-700 dark:text-amber-400",
    },
  };
  const s = map[service] || map.Service;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold ${s.bg} ${s.text}`}
    >
      {s.icon}
      {service}
    </span>
  );
}

function PaymentBreakdown({ item }: { item: BillingItem }) {
  const { currency } = useCurrency();
  const hasMultiplePayments =
    item.multiplePayments && item.multiplePayments.length > 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-500 dark:text-stone-400">Amount</span>
        <span className="font-semibold text-stone-800 dark:text-stone-100">
          {formatMoney(item.amount, currency)}
        </span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-stone-500 dark:text-stone-400">Paid</span>
        <span className="font-semibold text-teal-600 dark:text-teal-400">
          {formatMoney(item.paid, currency)}
        </span>
      </div>
      {item.pending > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-500 dark:text-stone-400">Pending</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">
            {formatMoney(item.pending, currency)}
          </span>
        </div>
      )}
      {item.advance && item.advance > 0 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-stone-500 dark:text-stone-400">Advance</span>
          <span className="font-semibold text-purple-600 dark:text-purple-400">
            {formatMoney(item.advance, currency)}
          </span>
        </div>
      )}
      {hasMultiplePayments && (
        <div className="mt-2 pt-2 border-t border-stone-100 dark:border-stone-800">
          <div className="text-[10px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-1">
            Split Payments
          </div>
          {item.multiplePayments?.map((payment, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-stone-500 dark:text-stone-400">
                {payment.paymentMethod}
              </span>
              <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">
                {formatMoney(payment.amount, currency)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
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
    totalAmount: number;
    totalPaid: number;
    totalPending: number;
    totalAdvance: number;
    count: number;
  };
  loading: boolean;
}

const StatsSection: React.FC<StatsSectionProps> = ({ summary, loading }) => {
  const { currency } = useCurrency();

  if (loading || summary.count === 0) {
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
        label="Total Revenue"
        value={formatMoney(summary.totalAmount, currency)}
        icon={<DollarSign />}
        fromColor="#0d9488"
        toColor="#14b8a6"
        iconColor="text-white"
        trend="+12.5% from last month"
        trendPositive={true}
      />
      <StatCard
        label="Total Collected"
        value={formatMoney(summary.totalPaid, currency)}
        icon={<CheckCircle />}
        fromColor="#059669"
        toColor="#10b981"
        iconColor="text-white"
        trend="85% collection rate"
        trendPositive={true}
      />
      <StatCard
        label="Pending Amount"
        value={formatMoney(summary.totalPending, currency)}
        icon={<Clock />}
        fromColor="#d97706"
        toColor="#f59e0b"
        iconColor="text-white"
        trend={`${summary.count} invoices pending`}
        trendPositive={false}
      />
      <StatCard
        label="Total Advance"
        value={formatMoney(summary.totalAdvance, currency)}
        icon={<Coins />}
        fromColor="#7c3aed"
        toColor="#8b5cf6"
        iconColor="text-white"
        trend="Used for future payments"
        trendPositive={true}
      />
    </div>
  );
};

// ============================================================
// MAIN BILLING TAB
// ============================================================

const BillingTab: React.FC = () => {
  const { currency } = useCurrency();

  const {
    loading,
    error,
    billing,
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
  } = useBilling();

  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = React.useState<boolean>(false);

  const [localFilters, setLocalFilters] =
    React.useState<BillingFilters>(filters);

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
              placeholder="Search by invoice, patient, treatment, package…"
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  Service Type
                </label>
                <select
                  value={localFilters.service || ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      service: e.target.value || undefined,
                    })
                  }
                  className="w-full text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 shadow-sm dark:shadow-stone-900/20 transition-colors"
                >
                  {SERVICE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
                  Date From
                </label>
                <input
                  type="date"
                  value={localFilters.startDate || ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      startDate: e.target.value || undefined,
                    })
                  }
                  className="w-full text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 shadow-sm dark:shadow-stone-900/20 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-stone-500 dark:text-stone-400 mb-1.5">
                  Date To
                </label>
                <input
                  type="date"
                  value={localFilters.endDate || ""}
                  onChange={(e) =>
                    setLocalFilters({
                      ...localFilters,
                      endDate: e.target.value || undefined,
                    })
                  }
                  className="w-full text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 px-3 py-2 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:focus:ring-teal-400/20 focus:border-teal-500 dark:focus:border-teal-400 shadow-sm dark:shadow-stone-900/20 transition-colors"
                />
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
            {filters.service && (
              <FilterChip
                label={`Service: ${filters.service}`}
                onRemove={() => {
                  const newFilters = { ...filters };
                  delete newFilters.service;
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
                <th className="px-5 py-3.5 font-bold">Service</th>
                <th className="px-5 py-3.5 font-bold text-right">Amount</th>
                <th className="px-5 py-3.5 font-bold text-right">Paid</th>
                <th className="px-5 py-3.5 font-bold text-right">Pending</th>
                <th className="px-5 py-3.5 font-bold text-right">
                  Payment Method
                </th>
                <th className="px-5 py-3.5 font-bold">Status</th>
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
                    <span className="text-sm">Loading billing records…</span>
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

              {!loading && !error && billing.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-5 py-16 text-center text-stone-400 dark:text-stone-500"
                  >
                    <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                    <span className="text-sm">No billing records found.</span>
                  </td>
                </tr>
              )}

              {!loading &&
                !error &&
                billing.map((item, idx) => {
                  const expanded = expandedIds.has(item._id);
                  const status = item.status || "Active";
                  const isFullyPaid = item.pending === 0 && item.paid > 0;

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
                            {item.invoiceNumber}
                          </div>
                          <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                            {getInvoicedByName(item)}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            {/* Custom Avatar */}
                            <div
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${getAvatarColor(item.patientId)}`}
                            >
                              {getPatientInitials(item.patientId)}
                            </div>
                            <div>
                              <div className="text-stone-800 dark:text-stone-100 font-medium text-sm">
                                {getPatientDisplayName(item.patientId)}
                              </div>
                              {item.patientId &&
                                typeof item.patientId !== "string" &&
                                item.patientId.emrNumber && (
                                  <div className="text-[10px] text-stone-400 dark:text-stone-500">
                                    EMR: {item.patientId.emrNumber}
                                  </div>
                                )}
                              {item.doctorName && (
                                <div className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                                  Dr. {item.doctorName}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1">
                            <ServiceBadge service={item.service} />
                            {(item.treatment || item.package) && (
                              <span className="text-xs text-stone-500 dark:text-stone-400 truncate max-w-[120px]">
                                {item.treatment || item.package}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-stone-800 dark:text-stone-100">
                          {formatMoney(item.amount, currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-teal-600 dark:text-teal-400">
                          {formatMoney(item.paid, currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400">
                          {formatMoney(item.pending, currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-semibold text-amber-600 dark:text-amber-400 text-xs">
                          {item.paymentMethod}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusPill status={status} />
                          {isFullyPaid && item.pending === 0 && (
                            <div className="text-[9px] text-teal-600 dark:text-teal-400 font-medium mt-0.5">
                              Fully Paid
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-stone-400 dark:text-stone-500 font-mono text-xs whitespace-nowrap">
                          {formatDate(item.invoicedDate)}
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Payment Details */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <Wallet className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                                  Payment Details
                                </div>
                                <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm dark:shadow-stone-900/20">
                                  <PaymentBreakdown item={item} />
                                </div>
                              </div>

                              {/* Treatment/Service Details */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <Stethoscope className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                  Treatment Details
                                </div>
                                <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm dark:shadow-stone-900/20 space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Service
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {item.service}
                                    </span>
                                  </div>
                                  {item.treatment && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Treatment
                                      </span>
                                      <span className="font-medium text-stone-800 dark:text-stone-100">
                                        {item.treatment}
                                      </span>
                                    </div>
                                  )}
                                  {item.package && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Package
                                      </span>
                                      <span className="font-medium text-stone-800 dark:text-stone-100">
                                        {item.package}
                                      </span>
                                    </div>
                                  )}
                                  {item.quantity && item.quantity > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Quantity
                                      </span>
                                      <span className="font-medium text-stone-800 dark:text-stone-100">
                                        {item.quantity}
                                      </span>
                                    </div>
                                  )}
                                  {item.sessions && item.sessions > 0 && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Sessions
                                      </span>
                                      <span className="font-medium text-stone-800 dark:text-stone-100">
                                        {item.sessions}
                                      </span>
                                    </div>
                                  )}
                                  {item.doctorName && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Doctor
                                      </span>
                                      <span className="font-medium text-stone-800 dark:text-stone-100">
                                        {item.doctorName}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Additional Info */}
                              <div>
                                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-stone-400 dark:text-stone-500 mb-3">
                                  <FileText className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                                  Additional Info
                                </div>
                                <div className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 shadow-sm dark:shadow-stone-900/20 space-y-2">
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Created
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100 text-xs">
                                      {formatDateTime(item.createdAt)}
                                    </span>
                                  </div>
                                  <div className="flex justify-between text-sm">
                                    <span className="text-stone-500 dark:text-stone-400">
                                      Invoiced By
                                    </span>
                                    <span className="font-medium text-stone-800 dark:text-stone-100">
                                      {getInvoicedByName(item)}
                                    </span>
                                  </div>
                                  {item.invoicedByRole && (
                                    <div className="flex justify-between text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Role
                                      </span>
                                      <span className="font-medium text-stone-800 dark:text-stone-100">
                                        {item.invoicedByRole}
                                      </span>
                                    </div>
                                  )}
                                  {item.notes && (
                                    <div className="text-sm">
                                      <span className="text-stone-500 dark:text-stone-400">
                                        Notes
                                      </span>
                                      <p className="text-stone-700 dark:text-stone-300 mt-1 text-sm bg-stone-50 dark:bg-stone-800 rounded-lg px-3 py-2 border border-stone-100 dark:border-stone-700">
                                        {item.notes}
                                      </p>
                                    </div>
                                  )}
                                  {item.pendingBalanceImage &&
                                    item.pendingBalanceImage.length > 0 && (
                                      <div>
                                        <span className="text-xs text-stone-500 dark:text-stone-400">
                                          Pending Balance Images
                                        </span>
                                        <div className="flex gap-1 mt-1">
                                          {item.pendingBalanceImage.map(
                                            (url, i) => (
                                              <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-xs text-teal-600 dark:text-teal-400 hover:underline"
                                              >
                                                📎 #{i + 1}
                                              </a>
                                            ),
                                          )}
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

export default BillingTab;

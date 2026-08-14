import React from "react";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
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
  CreditCard,
  Receipt,
  Coins,
} from "lucide-react";
import usePettyCash, {
  AllocationData,
  ExpenseData,
  CashIncomeData,
} from "../_hooks/usePettyCash";
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

const getStaffName = (staff: any): string => {
  if (!staff) return "Global Pool";
  if (typeof staff === "string") return `Staff #${staff.slice(-6)}`;
  return staff.name || staff.email || `Staff #${staff._id?.slice(-6)}`;
};

type TabType = "all" | "allocations" | "expenses" | "income";

const TABS: { value: TabType; label: string; icon: React.ReactNode }[] = [
  {
    value: "all",
    label: "All Activity",
    icon: <PieChart className="w-4 h-4" />,
  },
  {
    value: "allocations",
    label: "Allocations",
    icon: <ArrowUpRight className="w-4 h-4" />,
  },
  {
    value: "expenses",
    label: "Expenses",
    icon: <ArrowDownRight className="w-4 h-4" />,
  },
  {
    value: "income",
    label: "Cash Income",
    icon: <Coins className="w-4 h-4" />,
  },
];

// ============================================================
// RECEIPT LINKS COMPONENT
// ============================================================
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
// ALLOCATION ROW COMPONENT
// ============================================================
function AllocationRow({
  allocation,
  currency,
}: {
  allocation: AllocationData;
  currency: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const pettyCash = allocation.pettyCashId as any;

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <div
        className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button className="w-6 h-6 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center text-teal-600 dark:text-teal-400 shrink-0">
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
                {getStaffName(allocation.staffId)}
              </span>
              {pettyCash && (
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  {pettyCash.patient?.name || pettyCash.note || ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
              <span>{formatDate(allocation.date)}</span>
              <span>•</span>
              <span>By: {allocation.createdBy?.name || "Unknown"}</span>
              {allocation.isVoided && (
                <span className="text-rose-500 dark:text-rose-400 font-semibold">
                  (Voided)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ReceiptLinks receipts={allocation.receipts || []} />
          <span
            className={`font-mono font-semibold text-sm ${
              allocation.isVoided
                ? "text-stone-400 dark:text-stone-500 line-through"
                : "text-teal-600 dark:text-teal-400"
            }`}
          >
            +{formatMoney(allocation.amount, currency)}
          </span>
          <ChevronRight
            className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </div>
      {expanded && (
        <div className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-stone-400 dark:text-stone-500">
                Petty Cash ID:
              </span>
              <span className="ml-2 font-mono text-stone-600 dark:text-stone-300">
                {allocation.pettyCashId?._id || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">
                Created:
              </span>
              <span className="ml-2 text-stone-600 dark:text-stone-300">
                {formatDateTime(allocation.createdAt)}
              </span>
            </div>
            {allocation.voidReason && (
              <div className="col-span-2">
                <span className="text-rose-500 dark:text-rose-400">
                  Void Reason:
                </span>
                <span className="ml-2 text-stone-600 dark:text-stone-300">
                  {allocation.voidReason}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// EXPENSE ROW COMPONENT
// ============================================================
function ExpenseRow({
  expense,
  currency,
}: {
  expense: ExpenseData;
  currency: string;
}) {
  const [expanded, setExpanded] = React.useState(false);
  // const pettyCash = expense.pettyCashId as any;
  const isPettyCashExpense = expense.usedFromPettyCash === true;

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <div
        className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              isPettyCashExpense
                ? "bg-rose-50 dark:bg-rose-950/50 text-rose-500 dark:text-rose-400"
                : "bg-stone-100 dark:bg-stone-800 text-stone-400 dark:text-stone-500"
            }`}
          >
            {isPettyCashExpense ? (
              <ArrowDownRight className="w-3.5 h-3.5" />
            ) : (
              <span className="text-xs font-bold">ℹ</span>
            )}
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
                {expense.description}
              </span>
              {expense.vendorName && (
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  {expense.vendorName}
                </span>
              )}
              {!isPettyCashExpense && (
                <span className="text-xs font-semibold text-stone-400 dark:text-stone-500 bg-stone-100 dark:bg-stone-800 px-2 py-0.5 rounded-full">
                  Info Only
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
              <span>{formatDate(expense.date)}</span>
              <span>•</span>
              <span>By: {expense.createdBy?.name || "Unknown"}</span>
              {expense.isVoided && (
                <span className="text-rose-500 dark:text-rose-400 font-semibold">
                  (Voided)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ReceiptLinks receipts={expense.receipts || []} />
          {isPettyCashExpense ? (
            <span
              className={`font-mono font-semibold text-sm ${
                expense.isVoided
                  ? "text-stone-400 dark:text-stone-500 line-through"
                  : "text-rose-500 dark:text-rose-400"
              }`}
            >
              -{formatMoney(expense.spentAmount, currency)}
            </span>
          ) : (
            <span className="font-mono text-sm text-stone-400 dark:text-stone-500">
              {formatMoney(expense.spentAmount, currency)}
            </span>
          )}
          <ChevronRight
            className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </div>
      {expanded && (
        <div className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-stone-400 dark:text-stone-500">
                Source:
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  isPettyCashExpense
                    ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                    : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"
                }`}
              >
                {isPettyCashExpense ? "Petty Cash" : "Informational"}
              </span>
              {!isPettyCashExpense && (
                <span className="text-xs text-stone-400 dark:text-stone-500">
                  (Does not affect balance)
                </span>
              )}
            </div>

            {expense.items && expense.items.length > 0 && (
              <div>
                <span className="text-stone-400 dark:text-stone-500">
                  Items:
                </span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {expense.items.map((item, i) => (
                    <span
                      key={i}
                      className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded text-xs"
                    >
                      {item.itemName} -{" "}
                      {formatMoney(item.amount || 0, currency)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-stone-400 dark:text-stone-500">
                  Petty Cash ID:
                </span>
                <span className="ml-2 font-mono text-stone-600 dark:text-stone-300">
                  {expense.pettyCashId?._id || "N/A"}
                </span>
              </div>
              <div>
                <span className="text-stone-400 dark:text-stone-500">
                  Created:
                </span>
                <span className="ml-2 text-stone-600 dark:text-stone-300">
                  {formatDateTime(expense.createdAt)}
                </span>
              </div>
              {expense.voidReason && (
                <div className="col-span-2">
                  <span className="text-rose-500 dark:text-rose-400">
                    Void Reason:
                  </span>
                  <span className="ml-2 text-stone-600 dark:text-stone-300">
                    {expense.voidReason}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// INCOME ROW COMPONENT
// ============================================================
function IncomeRow({
  income,
  currency,
}: {
  income: CashIncomeData;
  currency: string;
}) {
  const [expanded, setExpanded] = React.useState(false);

  return (
    <div className="border-b border-stone-100 dark:border-stone-800 last:border-0">
      <div
        className="px-4 py-3 flex items-center justify-between hover:bg-stone-50 dark:hover:bg-stone-800/50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button className="w-6 h-6 rounded-full bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500 dark:text-emerald-400 shrink-0">
            <Coins className="w-3.5 h-3.5" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-stone-800 dark:text-stone-100">
                {income.patientName || "Unknown Patient"}
              </span>
              <span className="text-xs text-stone-400 dark:text-stone-500">
                #{income.invoiceNumber}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500">
              <span>{formatDate(income.invoicedDate)}</span>
              <span>•</span>
              <span>{income.service || "Service"}</span>
              <span>•</span>
              <span>Payment: {income.paymentMethod}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono font-semibold text-sm text-emerald-600 dark:text-emerald-400">
            +{formatMoney(income.cashAmount, currency)}
          </span>
          <ChevronRight
            className={`w-4 h-4 text-stone-400 dark:text-stone-500 transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </div>
      </div>
      {expanded && (
        <div className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border-t border-stone-100 dark:border-stone-800">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-stone-400 dark:text-stone-500">Patient:</span>
              <span className="ml-2 text-stone-600 dark:text-stone-300">
                {income.patientName}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">Mobile:</span>
              <span className="ml-2 text-stone-600 dark:text-stone-300">
                {income.mobileNumber || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">EMR #:</span>
              <span className="ml-2 text-stone-600 dark:text-stone-300">
                {income.emrNumber || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">Service:</span>
              <span className="ml-2 text-stone-600 dark:text-stone-300">
                {income.service || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">Total Amount:</span>
              <span className="ml-2 text-stone-600 dark:text-stone-300">
                {formatMoney(income.amount, currency)}
              </span>
            </div>
            <div>
              <span className="text-stone-400 dark:text-stone-500">Cash Received:</span>
              <span className="ml-2 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {formatMoney(income.cashAmount, currency)}
              </span>
            </div>
            {income.multiplePayments && income.multiplePayments.length > 0 && (
              <div className="col-span-2">
                <span className="text-stone-400 dark:text-stone-500">Payment Breakdown:</span>
                <div className="mt-1 flex flex-wrap gap-2">
                  {income.multiplePayments.map((payment, i) => (
                    <span
                      key={i}
                      className="bg-stone-100 dark:bg-stone-800 px-2 py-1 rounded text-xs"
                    >
                      {payment.paymentMethod}: {formatMoney(payment.amount, currency)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// STATS CARDS SECTION
// ============================================================
interface StatsSectionProps {
  viewType: TabType;
  allocationSummary: any;
  expenseSummary: any;
  incomeSummary: any;
  loading: boolean;
}

const StatsSection: React.FC<StatsSectionProps> = ({
  viewType,
  allocationSummary,
  expenseSummary,
  incomeSummary,
  loading,
}) => {
  const { currency } = useCurrency();

  if (loading) {
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

  if (viewType === "income") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Cash Income"
          value={formatMoney(incomeSummary?.totalCashIn || 0, currency)}
          icon={<Coins />}
          fromColor="#059669"
          toColor="#10b981"
          iconColor="text-white"
          trend={`${incomeSummary?.totalTransactions || 0} transactions`}
          trendPositive={true}
        />
        <StatCard
          label="Average Transaction"
          value={formatMoney(
            (incomeSummary?.totalCashIn || 0) / (incomeSummary?.totalTransactions || 1),
            currency
          )}
          icon={<Wallet />}
          fromColor="#7c3aed"
          toColor="#8b5cf6"
          iconColor="text-white"
          trend="Per cash payment"
          trendPositive={true}
        />
        <StatCard
          label="Total Transactions"
          value={incomeSummary?.totalTransactions || 0}
          icon={<Receipt />}
          fromColor="#0d9488"
          toColor="#14b8a6"
          iconColor="text-white"
          trend="Cash payments"
          trendPositive={true}
        />
        <StatCard
          label="Status"
          value="Active"
          icon={<DollarSign />}
          fromColor="#059669"
          toColor="#10b981"
          iconColor="text-white"
          trend="All cash transactions"
          trendPositive={true}
        />
      </div>
    );
  }

  if (viewType === "allocations") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Allocated"
          value={formatMoney(allocationSummary?.totalAllocated || 0, currency)}
          icon={<DollarSign />}
          fromColor="#0d9488"
          toColor="#14b8a6"
          iconColor="text-white"
          trend={`${allocationSummary?.totalAllocations || 0} allocations`}
          trendPositive={true}
        />
        <StatCard
          label="Average Allocation"
          value={formatMoney(allocationSummary?.averageAmount || 0, currency)}
          icon={<Wallet />}
          fromColor="#7c3aed"
          toColor="#8b5cf6"
          iconColor="text-white"
          trend="Per allocation"
          trendPositive={true}
        />
        <StatCard
          label="Min Allocation"
          value={formatMoney(allocationSummary?.minAmount || 0, currency)}
          icon={<ArrowUpRight />}
          fromColor="#059669"
          toColor="#10b981"
          iconColor="text-white"
          trend="Smallest amount"
          trendPositive={true}
        />
        <StatCard
          label="Max Allocation"
          value={formatMoney(allocationSummary?.maxAmount || 0, currency)}
          icon={<ArrowUpRight />}
          fromColor="#dc2626"
          toColor="#ef4444"
          iconColor="text-white"
          trend="Largest amount"
          trendPositive={true}
        />
      </div>
    );
  }

  if (viewType === "expenses") {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Spent (Petty Cash)"
          value={formatMoney(expenseSummary?.totalSpent || 0, currency)}
          icon={<TrendingDown />}
          fromColor="#dc2626"
          toColor="#ef4444"
          iconColor="text-white"
          trend={`${expenseSummary?.pettyCashExpenseCount || 0} petty cash expenses`}
          trendPositive={false}
        />
        <StatCard
          label="Informational Entries"
          value={expenseSummary?.infoExpenseCount || 0}
          icon={<Receipt />}
          fromColor="#6b7280"
          toColor="#9ca3af"
          iconColor="text-white"
          trend="Does not affect balance"
          trendPositive={true}
        />
        <StatCard
          label="Average Petty Cash Expense"
          value={formatMoney(expenseSummary?.averageSpent || 0, currency)}
          icon={<Wallet />}
          fromColor="#7c3aed"
          toColor="#8b5cf6"
          iconColor="text-white"
          trend="Per expense"
          trendPositive={false}
        />
        <StatCard
          label="Unique Vendors"
          value={expenseSummary?.uniqueVendors || 0}
          icon={<Users />}
          fromColor="#059669"
          toColor="#10b981"
          iconColor="text-white"
          trend="Different suppliers"
          trendPositive={true}
        />
      </div>
    );
  }

  // Combined view
  const totalAllocated = allocationSummary?.totalAllocated || 0;
  const totalSpent = expenseSummary?.totalSpent || 0;
  const balance = totalAllocated - totalSpent;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Allocated"
        value={formatMoney(totalAllocated, currency)}
        icon={<DollarSign />}
        fromColor="#0d9488"
        toColor="#14b8a6"
        iconColor="text-white"
        trend={`${allocationSummary?.totalAllocations || 0} allocations`}
        trendPositive={true}
      />
      <StatCard
        label="Total Spent"
        value={formatMoney(totalSpent, currency)}
        icon={<TrendingDown />}
        fromColor="#dc2626"
        toColor="#ef4444"
        iconColor="text-white"
        trend={`${expenseSummary?.pettyCashExpenseCount || 0} petty cash expenses`}
        trendPositive={false}
      />
      <StatCard
        label="Balance"
        value={formatMoney(balance, currency)}
        icon={<Wallet />}
        fromColor={balance >= 0 ? "#059669" : "#dc2626"}
        toColor={balance >= 0 ? "#10b981" : "#ef4444"}
        iconColor="text-white"
        trend={balance >= 0 ? "Available" : "Overspent"}
        trendPositive={balance >= 0}
      />
      <StatCard
        label="Voided"
        value={
          (allocationSummary?.totalVoided || 0) +
          (expenseSummary?.totalVoided || 0)
        }
        icon={<CreditCard />}
        fromColor="#7c3aed"
        toColor="#8b5cf6"
        iconColor="text-white"
        trend="Total voided transactions"
        trendPositive={false}
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
    allocations,
    expenses,
    incomeData,
    allocationSummary,
    expenseSummary,
    incomeSummary,
    viewType,
    setViewType,
    search,
    setSearch,
    page,
    limit,
    pagination,
    nextPage,
    prevPage,
  } = usePettyCash();

  const [startDate, setStartDate] = React.useState<string>("");
  const [endDate, setEndDate] = React.useState<string>("");
  const [showVoided, setShowVoided] = React.useState<boolean>(false);

  const from = pagination?.totalResults === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, pagination?.totalResults || 0);

  // Filter data based on date and voided status (client-side filtering for now)
  const filteredAllocations = React.useMemo(() => {
    return allocations.filter((alloc) => {
      if (showVoided && !alloc.isVoided) return false;
      if (!showVoided && alloc.isVoided) return false;
      if (startDate && new Date(alloc.date) < new Date(startDate)) return false;
      if (endDate && new Date(alloc.date) > new Date(endDate)) return false;
      return true;
    });
  }, [allocations, showVoided, startDate, endDate]);

  const filteredExpenses = React.useMemo(() => {
    return expenses.filter((exp) => {
      if (showVoided && !exp.isVoided) return false;
      if (!showVoided && exp.isVoided) return false;
      if (startDate && new Date(exp.date) < new Date(startDate)) return false;
      if (endDate && new Date(exp.date) > new Date(endDate)) return false;
      return true;
    });
  }, [expenses, showVoided, startDate, endDate]);

  return (
    <div className="space-y-7">
      {/* Stats Cards Section */}
      <StatsSection
        viewType={viewType}
        allocationSummary={allocationSummary}
        expenseSummary={expenseSummary}
        incomeSummary={incomeSummary}
        loading={loading}
      />

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 shadow-sm dark:shadow-stone-900/20 overflow-hidden transition-colors duration-300">
        {/* Tabs */}
        <div className="border-b border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-800/30">
          <div className="flex items-center gap-1 p-1 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setViewType(tab.value)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap
                  ${
                    viewType === tab.value
                      ? "bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 shadow-sm dark:shadow-stone-900/20"
                      : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 hover:bg-white/50 dark:hover:bg-stone-800/50"
                  }
                `}
              >
                {tab.icon}
                {tab.label}
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
              placeholder={
                viewType === "income" 
                  ? "Search by patient name or invoice..." 
                  : "Search…"
              }
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

          {viewType !== "income" && (
            <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
              <input
                type="checkbox"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
                className="rounded border-stone-300 dark:border-stone-600 text-teal-600 focus:ring-teal-500"
              />
              Show voided
            </label>
          )}
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
            <>
              {viewType === "income" && (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {incomeData.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">No cash income found.</span>
                    </div>
                  ) : (
                    incomeData.map((income) => (
                      <IncomeRow
                        key={income._id}
                        income={income}
                        currency={currency}
                      />
                    ))
                  )}
                </div>
              )}

              {viewType === "allocations" && (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredAllocations.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">No allocations found.</span>
                    </div>
                  ) : (
                    filteredAllocations.map((alloc) => (
                      <AllocationRow
                        key={alloc._id}
                        allocation={alloc}
                        currency={currency}
                      />
                    ))
                  )}
                </div>
              )}

              {viewType === "expenses" && (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredExpenses.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">No expenses found.</span>
                    </div>
                  ) : (
                    filteredExpenses.map((exp) => (
                      <ExpenseRow
                        key={exp._id}
                        expense={exp}
                        currency={currency}
                      />
                    ))
                  )}
                </div>
              )}

              {viewType === "all" && (
                <div className="divide-y divide-stone-100 dark:divide-stone-800">
                  {filteredAllocations.length === 0 &&
                  filteredExpenses.length === 0 ? (
                    <div className="px-5 py-16 text-center text-stone-400 dark:text-stone-500">
                      <Inbox className="w-6 h-6 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                      <span className="text-sm">No activity found.</span>
                    </div>
                  ) : (
                    <>
                      {/* Expenses first (recent) */}
                      {filteredExpenses.slice(0, 10).map((exp) => (
                        <ExpenseRow
                          key={exp._id}
                          expense={exp}
                          currency={currency}
                        />
                      ))}
                      {/* Then allocations */}
                      {filteredAllocations.slice(0, 5).map((alloc) => (
                        <AllocationRow
                          key={alloc._id}
                          allocation={alloc}
                          currency={currency}
                        />
                      ))}
                      {filteredAllocations.length > 5 && (
                        <div className="px-5 py-3 text-center">
                          <button
                            onClick={() => setViewType("allocations")}
                            className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            View all {filteredAllocations.length} allocations →
                          </button>
                        </div>
                      )}
                      {filteredExpenses.length > 10 && (
                        <div className="px-5 py-3 text-center border-t border-stone-100 dark:border-stone-800">
                          <button
                            onClick={() => setViewType("expenses")}
                            className="text-sm text-teal-600 dark:text-teal-400 hover:underline"
                          >
                            View all {filteredExpenses.length} expenses →
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </>
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
                Page {pagination.currentPage || 1} of {pagination.totalPages || 1}
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
import React from "react";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";

export interface AllocationData {
  _id: string;
  pettyCashId: {
    _id: string;
    patient?: { name?: string; email?: string; phone?: string };
    note?: string;
  };
  clinicId: string;
  staffId: {
    _id: string;
    name?: string;
    email?: string;
    role?: string;
  };
  amount: number;
  receipts: string[];
  date: string;
  createdBy: { _id: string; name?: string; email?: string; role?: string };
  isVoided: boolean;
  voidedBy?: { _id: string; name?: string; email?: string };
  voidReason?: string;
  voidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseData {
  _id: string;
  pettyCashId: {
    _id: string;
    patient?: { name?: string; email?: string; phone?: string };
    note?: string;
  };
  clinicId: string;
  staffId: { _id: string; name?: string; email?: string; role?: string };
  description: string;
  spentAmount: number;
  vendor?: { _id: string; name?: string; email?: string; phone?: string };
  vendorName?: string;
  items?: { itemName?: string; amount?: number }[];
  receipts: string[];
  usedFromPettyCash: boolean;
  date: string;
  createdBy: { _id: string; name?: string; email?: string; role?: string };
  isVoided: boolean;
  voidedBy?: { _id: string; name?: string; email?: string };
  voidReason?: string;
  voidedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PettyCashResponse {
  success: boolean;
  viewType: "all" | "allocations" | "expenses";
  allocations: AllocationData[];
  expenses: ExpenseData[];
  allocationSummary: {
    totalAllocated: number;
    totalAllocations: number;
    totalVoided: number;
    averageAmount: number;
    minAmount: number;
    maxAmount: number;
  } | null;
  expenseSummary: {
    totalSpent: number;
    totalExpenses: number;
    totalVoided: number;
    averageSpent: number;
    minSpent: number;
    maxSpent: number;
    uniqueVendors: number;
    usedFromPettyCashCount: number;
    notUsedFromPettyCashCount: number;
  } | null;
  combinedSummary: {
    dailyBreakdown: { date: string; totalSpent: number; count: number }[];
    topVendors: { vendorId: string; vendorName: string; totalSpent: number; expenseCount: number; averageAmount: number }[];
  } | null;
  pagination: {
    totalResults: number;
    totalPages: number;
    currentPage: number;
    limit: number;
    hasMore: boolean;
    filters: {
      search: string | null;
      startDate: string | null;
      endDate: string | null;
      vendorId: string | null;
      showVoided: boolean;
      viewType: string;
    };
  };
}

export interface UsePettyCashReturn {
  loading: boolean;
  error: string | null;
  allocations: AllocationData[];
  expenses: ExpenseData[];
  allocationSummary: PettyCashResponse['allocationSummary'];
  expenseSummary: PettyCashResponse['expenseSummary'];
  combinedSummary: PettyCashResponse['combinedSummary'];
  viewType: "all" | "allocations" | "expenses";
  setViewType: (type: "all" | "allocations" | "expenses") => void;
  fetchPettyCash: () => Promise<void>;
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  page: number;
  limit: number;
  pagination: PettyCashResponse['pagination'];
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  changeLimit: (limit: number) => void;
}

const usePettyCash = (): UsePettyCashReturn => {
  const token = getTokenByPath();

  const [allocations, setAllocations] = React.useState<AllocationData[]>([]);
  const [expenses, setExpenses] = React.useState<ExpenseData[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [viewType, setViewType] = React.useState<"all" | "allocations" | "expenses">("all");
  const [allocationSummary, setAllocationSummary] = React.useState<PettyCashResponse['allocationSummary']>(null);
  const [expenseSummary, setExpenseSummary] = React.useState<PettyCashResponse['expenseSummary']>(null);
  const [combinedSummary, setCombinedSummary] = React.useState<PettyCashResponse['combinedSummary']>(null);

  // Filters
  const [search, setSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");

  // Pagination
  const [page, setPage] = React.useState<number>(1);
  const [limit, setLimit] = React.useState<number>(20);
  const [pagination, setPagination] = React.useState<PettyCashResponse['pagination']>({
    totalResults: 0,
    totalPages: 1,
    currentPage: 1,
    limit: 20,
    hasMore: false,
    filters: {
      search: null,
      startDate: null,
      endDate: null,
      vendorId: null,
      showVoided: false,
      viewType: "all"
    }
  });

  // Debounce search
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, viewType]);

  const fetchPettyCash = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<PettyCashResponse>(
        "/api/finance-management/pettycash",
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            viewType,
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            page,
            limit,
          },
        }
      );

      if (res.data.success) {
        setAllocations(res.data.allocations || []);
        setExpenses(res.data.expenses || []);
        setAllocationSummary(res.data.allocationSummary);
        setExpenseSummary(res.data.expenseSummary);
        setCombinedSummary(res.data.combinedSummary);
        setPagination(res.data.pagination);
      } else {
        setError("Failed to fetch data");
      }
    } catch (err: any) {
      console.error("Error fetching petty cash:", err);
      setError(err?.response?.data?.message || "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch, page, limit, viewType]);

  React.useEffect(() => {
    fetchPettyCash();
  }, [fetchPettyCash]);

  const goToPage = React.useCallback(
    (p: number) => {
      const target = Math.min(Math.max(1, p), pagination.totalPages || 1);
      setPage(target);
    },
    [pagination.totalPages]
  );

  const nextPage = React.useCallback(() => {
    if (pagination.hasMore) setPage((p) => p + 1);
  }, [pagination.hasMore]);

  const prevPage = React.useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const changeLimit = React.useCallback((newLimit: number) => {
    setLimit(newLimit);
    setPage(1);
  }, []);

  return {
    loading,
    error,
    allocations,
    expenses,
    allocationSummary,
    expenseSummary,
    combinedSummary,
    viewType,
    setViewType,
    fetchPettyCash,
    search,
    setSearch,
    page,
    limit,
    pagination,
    goToPage,
    nextPage,
    prevPage,
    changeLimit,
  };
};

export default usePettyCash;
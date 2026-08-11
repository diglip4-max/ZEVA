import React from "react";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";

export interface Allocation {
  _id?: string;
  amount: number;
  receipts: string[];
  date: string;
}

export interface ExpenseLineItem {
  itemName?: string;
  amount?: number;
}

export interface Expense {
  _id?: string;
  description: string;
  spentAmount: number;
  vendor?: string | null;
  vendorName?: string | null;
  items?: ExpenseLineItem[];
  receipts: string[];
  usedFromPettyCash?: boolean;
  date: string;
}

export interface StaffRef {
  _id: string;
  name?: string;
  email?: string;
}

export interface PettyCashItem {
  _id: string;
  clinicId?: string;
  staffId?: StaffRef | string | null;
  patientName?: string;
  patientEmail?: string;
  patientPhone?: string;
  note?: string;
  allocatedAmounts: Allocation[];
  expenses: Expense[];
  totalAllocated: number;
  totalSpent: number;
  totalAmount: number;
  globalTotalAmount?: number;
  globalSpentAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PettyCashSummary {
  totalAllocated: number;
  totalSpent: number;
  totalBalance: number;
  totalRecords: number;
  availableCount: number;
  overspentCount: number;
  globalTotalAmount: number;
  globalSpentAmount: number;
  globalRemainingAmount: number;
}

export interface Pagination {
  totalResults: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasMore: boolean;
}

interface PettyCashListResponse {
  success: boolean;
  message?: string;
  data: PettyCashItem[];
  summary: PettyCashSummary;
  pagination: Pagination;
}

const DEFAULT_PAGINATION: Pagination = {
  totalResults: 0,
  totalPages: 1,
  currentPage: 1,
  limit: 20,
  hasMore: false,
};

const DEFAULT_SUMMARY: PettyCashSummary = {
  totalAllocated: 0,
  totalSpent: 0,
  totalBalance: 0,
  totalRecords: 0,
  availableCount: 0,
  overspentCount: 0,
  globalTotalAmount: 0,
  globalSpentAmount: 0,
  globalRemainingAmount: 0,
};

export interface UsePettyCashReturn {
  loading: boolean;
  error: string | null;
  pettyCash: PettyCashItem[];
  setPettyCash: React.Dispatch<React.SetStateAction<PettyCashItem[]>>;
  summary: PettyCashSummary;
  fetchPettyCash: () => Promise<void>;

  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;

  page: number;
  limit: number;
  pagination: Pagination;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  changeLimit: (limit: number) => void;
}

const usePettyCash = (): UsePettyCashReturn => {
  const token = getTokenByPath();

  const [pettyCash, setPettyCash] = React.useState<PettyCashItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] =
    React.useState<PettyCashSummary>(DEFAULT_SUMMARY);

  // ---- Filters ----
  const [search, setSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");

  // ---- Pagination ----
  const [page, setPage] = React.useState<number>(1);
  const [limit, setLimit] = React.useState<number>(20);
  const [pagination, setPagination] =
    React.useState<Pagination>(DEFAULT_PAGINATION);

  // Debounce search input (400ms) so we don't hit the API on every keystroke
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever the effective search term changes
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchPettyCash = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<PettyCashListResponse>(
        "/api/finance-management/pettycash",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            page,
            limit,
          },
        },
      );
      const data = res.data;
      if (data.success) {
        setPettyCash(data.data || []);
        setSummary(data.summary || DEFAULT_SUMMARY);
        setPagination(data.pagination || DEFAULT_PAGINATION);
      } else {
        setError(data.message || "Failed to fetch petty cash");
      }
    } catch (err: any) {
      console.error("Error fetching petty cash:", err);
      setError(err?.response?.data?.message || "Failed to fetch petty cash");
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch, page, limit]);

  React.useEffect(() => {
    fetchPettyCash();
  }, [fetchPettyCash]);

  const goToPage = React.useCallback(
    (p: number) => {
      const target = Math.min(Math.max(1, p), pagination.totalPages || 1);
      setPage(target);
    },
    [pagination.totalPages],
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
    pettyCash,
    setPettyCash,
    summary,
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

import React from "react";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";

// ============================================================
// INTERFACES
// ============================================================

export interface ManualItem {
  itemName?: string;
  amount?: number;
}

export interface ManualPettyCashItem {
  _id: string;
  clinicId?: string;
  addedBy?: string | { _id: string; name?: string; email?: string };
  name: string;
  amount: number;
  note?: string;
  isExpense: boolean;
  vendorId?: string | { _id: string; name?: string };
  vendorName?: string;
  items?: ManualItem[];
  images?: string[];
  usedFromPettyCash?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ManualPettyCashSummary {
  totalAmount: number;
  totalExpenses: number;
  totalIncome: number;
  totalRecords: number;
  expenseCount: number;
  incomeCount: number;
  totalItems: number;
  // Global clinic totals
  globalTotalAmount: number;
  globalTotalExpenses: number;
  globalTotalIncome: number;
  globalBalance: number;
}

export interface Pagination {
  totalResults: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasMore: boolean;
}

interface ManualPettyCashListResponse {
  success: boolean;
  message?: string;
  data: ManualPettyCashItem[];
  summary: ManualPettyCashSummary;
  pagination: Pagination;
}

// ============================================================
// DEFAULTS
// ============================================================

const DEFAULT_PAGINATION: Pagination = {
  totalResults: 0,
  totalPages: 1,
  currentPage: 1,
  limit: 20,
  hasMore: false,
};

const DEFAULT_SUMMARY: ManualPettyCashSummary = {
  totalAmount: 0,
  totalExpenses: 0,
  totalIncome: 0,
  totalRecords: 0,
  expenseCount: 0,
  incomeCount: 0,
  totalItems: 0,
  globalTotalAmount: 0,
  globalTotalExpenses: 0,
  globalTotalIncome: 0,
  globalBalance: 0,
};

// ============================================================
// HOOK INTERFACE
// ============================================================

export interface UseManualPettyCashReturn {
  loading: boolean;
  error: string | null;
  manualPettyCash: ManualPettyCashItem[];
  setManualPettyCash: React.Dispatch<
    React.SetStateAction<ManualPettyCashItem[]>
  >;
  summary: ManualPettyCashSummary;
  fetchManualPettyCash: () => Promise<void>;

  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;

  page: number;
  limit: number;
  pagination: Pagination;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  changeLimit: (limit: number) => void;

  // Additional utilities
  totalBalance: number;
  totalExpenses: number;
  totalIncome: number;
}

// ============================================================
// HOOK
// ============================================================

const useManualPettyCash = (): UseManualPettyCashReturn => {
  const token = getTokenByPath();

  const [manualPettyCash, setManualPettyCash] = React.useState<
    ManualPettyCashItem[]
  >([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] =
    React.useState<ManualPettyCashSummary>(DEFAULT_SUMMARY);

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

  // ---- Fetch Function ----
  const fetchManualPettyCash = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<ManualPettyCashListResponse>(
        "/api/finance-management/manual-pettycash",
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
        setManualPettyCash(data.data || []);
        setSummary(data.summary || DEFAULT_SUMMARY);
        setPagination(data.pagination || DEFAULT_PAGINATION);
      } else {
        setError(data.message || "Failed to fetch manual petty cash");
      }
    } catch (err: any) {
      console.error("Error fetching manual petty cash:", err);
      setError(
        err?.response?.data?.message || "Failed to fetch manual petty cash",
      );
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch, page, limit]);

  // ---- Auto-fetch on dependency change ----
  React.useEffect(() => {
    fetchManualPettyCash();
  }, [fetchManualPettyCash]);

  // ---- Pagination Controls ----
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

  // ---- Computed Values ----
  const totalBalance = summary.globalBalance || 0;
  const totalExpenses = summary.totalExpenses || 0;
  const totalIncome = summary.totalIncome || 0;

  // ============================================================
  // RETURN
  // ============================================================

  return {
    loading,
    error,
    manualPettyCash,
    setManualPettyCash,
    summary,
    fetchManualPettyCash,

    search,
    setSearch,

    page,
    limit,
    pagination,
    goToPage,
    nextPage,
    prevPage,
    changeLimit,

    // Additional utilities
    totalBalance,
    totalExpenses,
    totalIncome,
  };
};

export default useManualPettyCash;

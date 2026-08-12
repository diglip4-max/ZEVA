import React from "react";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";

// ==================== Types ====================

export interface ProductSaleItem {
  _id: string;
  clinicId: string;
  invoiceNo: string;
  invoiceDate: Date | string;
  patientId:
    | {
        _id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        mobileNumber?: string;
        emrNumber?: string;
      }
    | string;
  paymentMethodId:
    | {
        _id: string;
        name: string;
      }
    | string;
  paymentMethodName: string;
  items: {
    allocatedItemId: string;
    name: string;
    code: string;
    description: string;
    quantity: number;
    uom: string;
    unitPrice: number;
    totalPrice: number;
    currency: "AED" | "USD";
    notes?: string;
    commission: number;
  }[];
  status:
    | "pending"
    | "completed"
    | "canceled"
    | "refunded"
    | "partially_refunded";
  paymentStatus:
    | "pending"
    | "paid"
    | "partially_paid"
    | "failed"
    | "partially_refunded"
    | "refunded";
  totalPrice: number;
  totalPaidAmount: number;
  totalCommission: number;
  soldBy:
    | {
        _id: string;
        name?: string;
        email?: string;
      }
    | string;
  createdAt: string;
  updatedAt: string;
}

export interface ProductSaleSummary {
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
}

export interface Pagination {
  totalResults: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasMore: boolean;
}

interface ProductSaleListResponse {
  success: boolean;
  message?: string;
  data: ProductSaleItem[];
  summary: ProductSaleSummary;
  pagination: Pagination;
}

const DEFAULT_PAGINATION: Pagination = {
  totalResults: 0,
  totalPages: 1,
  currentPage: 1,
  limit: 20,
  hasMore: false,
};

const DEFAULT_SUMMARY: ProductSaleSummary = {
  totalSales: 0,
  totalPaid: 0,
  totalPending: 0,
  totalCommission: 0,
  totalItems: 0,
  totalRecords: 0,
  completedCount: 0,
  pendingCount: 0,
  canceledCount: 0,
  refundedCount: 0,
  paidCount: 0,
  partiallyPaidCount: 0,
  pendingPaymentCount: 0,
};

export interface ProductSaleFilters {
  status?: string;
  paymentStatus?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface UseProductSaleReturn {
  loading: boolean;
  error: string | null;
  productSales: ProductSaleItem[];
  setProductSales: React.Dispatch<React.SetStateAction<ProductSaleItem[]>>;
  summary: ProductSaleSummary;
  fetchProductSales: () => Promise<void>;

  // Search
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;

  // Filters
  filters: ProductSaleFilters;
  setFilters: React.Dispatch<React.SetStateAction<ProductSaleFilters>>;
  applyFilters: (filters: ProductSaleFilters) => void;
  clearFilters: () => void;

  // Pagination
  page: number;
  limit: number;
  pagination: Pagination;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  changeLimit: (limit: number) => void;
}

const useProductSale = (): UseProductSaleReturn => {
  const token = getTokenByPath();

  const [productSales, setProductSales] = React.useState<ProductSaleItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] =
    React.useState<ProductSaleSummary>(DEFAULT_SUMMARY);

  // ---- Search ----
  const [search, setSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");

  // ---- Filters ----
  const [filters, setFilters] = React.useState<ProductSaleFilters>({});

  // ---- Pagination ----
  const [page, setPage] = React.useState<number>(1);
  const [limit, setLimit] = React.useState<number>(20);
  const [pagination, setPagination] =
    React.useState<Pagination>(DEFAULT_PAGINATION);

  // Debounce search input (400ms)
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(t);
  }, [search]);

  // Reset to page 1 whenever the effective search term changes
  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchProductSales = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {
        page,
        limit,
      };

      if (debouncedSearch) params.search = debouncedSearch;

      // Add filters
      if (filters.status) params.status = filters.status;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.minAmount !== undefined && filters.minAmount !== null) {
        params.minAmount = filters.minAmount;
      }
      if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
        params.maxAmount = filters.maxAmount;
      }

      const res = await axios.get<ProductSaleListResponse>(
        "/api/finance-management/product-sales",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params,
        },
      );

      const data = res.data;
      if (data.success) {
        setProductSales(data.data || []);
        setSummary(data.summary || DEFAULT_SUMMARY);
        setPagination(data.pagination || DEFAULT_PAGINATION);
      } else {
        setError(data.message || "Failed to fetch product sales");
      }
    } catch (err: any) {
      console.error("Error fetching product sales:", err);
      setError(err?.response?.data?.message || "Failed to fetch product sales");
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch, page, limit, filters]);

  React.useEffect(() => {
    fetchProductSales();
  }, [fetchProductSales]);

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

  const applyFilters = React.useCallback((newFilters: ProductSaleFilters) => {
    setFilters(newFilters);
    setPage(1);
  }, []);

  const clearFilters = React.useCallback(() => {
    setFilters({});
    setPage(1);
  }, []);

  return {
    loading,
    error,
    productSales,
    setProductSales,
    summary,
    fetchProductSales,

    // Search
    search,
    setSearch,

    // Filters
    filters,
    setFilters,
    applyFilters,
    clearFilters,

    // Pagination
    page,
    limit,
    pagination,
    goToPage,
    nextPage,
    prevPage,
    changeLimit,
  };
};

export default useProductSale;

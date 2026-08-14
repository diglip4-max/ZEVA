import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

export type BillStatus =
  | "draft"
  | "pending"
  | "upcoming"
  | "partial"
  | "paid"
  | "overdue"
  | "cancelled";

export interface SupplierRef {
  _id: string;
  name: string;
}

export interface BillData {
  _id: string;
  invoiceNumber: string;
  supplierInvoiceNumber?: string;
  supplierId: SupplierRef | string;
  category: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: BillStatus;
  notes?: string;
  attachments?: string[];
  createdAt: string;
}

export interface BillSummary {
  totalOutstanding: number;
  overdueCount: number;
  paidThisMonth: number;
  totalBills: number;
}

export interface PaginationInfo {
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

export type BillStatusFilter = "all" | BillStatus;

export interface NewBillInput {
  supplierId: string;
  category: string;
  supplierInvoiceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  amount: number;
  notes?: string;
  attachments?: string[];
}

const DEFAULT_SUMMARY: BillSummary = {
  totalOutstanding: 0,
  overdueCount: 0,
  paidThisMonth: 0,
  totalBills: 0,
};

export default function useBillsPayable() {
  const [bills, setBills] = useState<BillData[]>([]);
  const [summary, setSummary] = useState<BillSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<BillStatusFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (categoryFilter !== "All") params.set("category", categoryFilter);
    if (search) params.set("search", search);
    if (startDate) params.set("dueDateFrom", startDate);
    if (endDate) params.set("dueDateTo", endDate);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [statusFilter, categoryFilter, search, startDate, endDate, page, limit]);

  const fetchBills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(`/api/finance/bills?${buildQuery()}`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to load bills");
      }

      setBills(data.data || []);
      setSummary({ ...DEFAULT_SUMMARY, ...(data.summary || {}) });
      setPagination(
        data.pagination
          ? {
              totalResults: data.pagination.total,
              currentPage: data.pagination.page,
              totalPages: data.pagination.totalPages,
              hasMore: data.pagination.page < data.pagination.totalPages,
            }
          : null,
      );
    } catch (err: any) {
      setError(err.message || "Something went wrong while loading bills");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchBills();
  }, [fetchBills]);

  // reset to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, categoryFilter, search, startDate, endDate]);

  const nextPage = useCallback(() => {
    if (pagination?.hasMore) setPage((p) => p + 1);
  }, [pagination]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const createBill = useCallback(
    async (input: NewBillInput) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.post("/api/finance/bills", input, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!data.success) {
          if (data.warning === "DUPLICATE_INVOICE") {
            return { ok: false as const, warning: data.message as string };
          }
          throw new Error(data.message || "Failed to create bill");
        }

        await fetchBills();
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchBills],
  );

  const cancelBill = useCallback(
    async (id: string, _reason: string) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.patch(`/api/finance/bills/${id}/cancel`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        if (!data.success) {
          throw new Error(data.message || "Failed to cancel bill");
        }
        await fetchBills();
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchBills],
  );

  const categories = useMemo(
    () => [
      "All",
      "Medical Purchase",
      "Rent",
      "Utility",
      "Marketing",
      "Software",
      "Government",
      "Maintenance",
      "Office",
      "Equipment",
    ],
    [],
  );

  return {
    bills,
    summary,
    categories,
    loading,
    saving,
    error,

    statusFilter,
    setStatusFilter,
    categoryFilter,
    setCategoryFilter,
    search,
    setSearch,
    startDate,
    setStartDate,
    endDate,
    setEndDate,

    page,
    limit,
    pagination,
    nextPage,
    prevPage,

    createBill,
    cancelBill,
    refetch: fetchBills,
  };
}

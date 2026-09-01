// _hooks/useFinanceCheques.ts
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";

export type ChequeStatus =
  | "issued"
  | "presented"
  | "cleared"
  | "returned"
  | "bounced"
  | "cancelled";

export interface SupplierRef {
  _id: string;
  name: string;
}

export interface TransactionRef {
  _id: string;
  invoiceNumber: string;
  category?: string;
}

export interface PaymentRef {
  _id: string;
  paymentNumber: string;
}

export interface ChequeHistoryEntry {
  status: ChequeStatus;
  changedBy?: { _id: string; name?: string; email?: string } | string;
  at: string;
}

export interface ChequeData {
  _id: string;
  chequeNumber: string;
  bank: string;
  payee: string;
  amount: number;
  chequeDate: string;
  status: ChequeStatus;
  supplierId?: SupplierRef | string;
  transactionId?: TransactionRef | string;
  paymentId?: PaymentRef | string;
  history: ChequeHistoryEntry[];
  createdAt: string;
}

export interface ChequeSummary {
  totalCheques: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  clearedCount: number;
  bouncedCount: number;
}

export interface PaginationInfo {
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

export type ChequeStatusFilter = "all" | ChequeStatus;

export const CHEQUE_STATUSES: { value: ChequeStatus; label: string }[] = [
  { value: "issued", label: "Issued" },
  { value: "presented", label: "Presented" },
  { value: "cleared", label: "Cleared" },
  { value: "returned", label: "Returned" },
  { value: "bounced", label: "Bounced" },
  { value: "cancelled", label: "Cancelled" },
];

const DEFAULT_SUMMARY: ChequeSummary = {
  totalCheques: 0,
  totalAmount: 0,
  pendingCount: 0,
  pendingAmount: 0,
  clearedCount: 0,
  bouncedCount: 0,
};

export default function useFinanceCheques() {
  const [cheques, setCheques] = useState<ChequeData[]>([]);
  const [summary, setSummary] = useState<ChequeSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<ChequeStatusFilter>("all");
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (search) params.set("search", search);
    if (startDate) params.set("dateFrom", startDate);
    if (endDate) params.set("dateTo", endDate);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [statusFilter, search, startDate, endDate, page, limit]);

  const fetchCheques = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(`/api/finance/cheques?${buildQuery()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to load cheques");
      }

      setCheques(data.data || []);
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
      setError(err.message || "Something went wrong while loading cheques");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchCheques();
  }, [fetchCheques]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search, startDate, endDate]);

  const nextPage = useCallback(() => {
    if (pagination?.hasMore) setPage((p) => p + 1);
  }, [pagination]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const updateStatus = useCallback(
    async (id: string, status: ChequeStatus, reason?: string) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.patch(
          `/api/finance/cheques/${id}/status`,
          { status, reason },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!data.success) {
          return { ok: false as const, warning: data.message as string };
        }
        await fetchCheques();
        return {
          ok: true as const,
          paymentReversed: !!data.paymentReversed,
          paymentReinstated: !!data.paymentReinstated,
        };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchCheques],
  );

  return {
    cheques,
    summary,
    loading,
    saving,
    error,

    statusFilter,
    setStatusFilter,
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

    updateStatus,
    refetch: fetchCheques,
  };
}

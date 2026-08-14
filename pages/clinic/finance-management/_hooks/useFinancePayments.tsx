import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";

export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "cheque"
  | "card"
  | "online"
  | "petty_cash";

export interface SupplierRef {
  _id: string;
  name: string;
}

export interface TransactionRef {
  _id: string;
  invoiceNumber: string;
  category?: string;
  amount?: number;
  balance?: number;
}

export interface BankAccountRef {
  _id: string;
  bankName: string;
  accountNumber?: string;
}

export interface ChequeRef {
  _id: string;
  chequeNumber: string;
  status?: string;
}

export interface PaymentData {
  _id: string;
  paymentNumber: string;
  transactionId: TransactionRef | string;
  supplierId: SupplierRef | string;
  amount: number;
  date: string;
  method: PaymentMethod;
  bankAccountId?: BankAccountRef | string;
  chequeId?: ChequeRef | string;
  attachment?: string;
  notes?: string;
  reversed: boolean;
  createdAt: string;
}

export interface PaymentSummary {
  totalPaid: number;
  totalPayments: number;
  chequeCount: number;
  avgPayment: number;
}

export interface PaginationInfo {
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

export type MethodFilter = "all" | PaymentMethod;

export interface ChequeDetailsInput {
  chequeNumber: string;
  bank?: string;
  payee?: string;
  chequeDate: string;
}

export interface NewPaymentInput {
  transactionId: string;
  supplierId?: string;
  amount: number;
  method: PaymentMethod;
  bankAccountId?: string;
  chequeDetails?: ChequeDetailsInput;
  attachment?: string;
  notes?: string;
}

const DEFAULT_SUMMARY: PaymentSummary = {
  totalPaid: 0,
  totalPayments: 0,
  chequeCount: 0,
  avgPayment: 0,
};

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online" },
  { value: "petty_cash", label: "Petty Cash" },
];

export default function useFinancePayments() {
  const [payments, setPayments] = useState<PaymentData[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [methodFilter, setMethodFilter] = useState<MethodFilter>("all");
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (methodFilter !== "all") params.set("method", methodFilter);
    if (search) params.set("search", search);
    if (startDate) params.set("dateFrom", startDate);
    if (endDate) params.set("dateTo", endDate);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [methodFilter, search, startDate, endDate, page, limit]);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(
        `/api/finance/payments?${buildQuery()}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data.success) {
        throw new Error(data?.message || "Failed to load payments");
      }

      setPayments(data.data || []);
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
      setError(err.message || "Something went wrong while loading payments");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    setPage(1);
  }, [methodFilter, search, startDate, endDate]);

  const nextPage = useCallback(() => {
    if (pagination?.hasMore) setPage((p) => p + 1);
  }, [pagination]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const createPayment = useCallback(
    async (input: NewPaymentInput) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.post("/api/finance/payments", input, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!data.success) {
          return {
            ok: false as const,
            warning: data?.message || "Failed to create payment",
          };
        }

        await fetchPayments();
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchPayments],
  );

  const reversePayment = useCallback(
    async (id: string, reason: string) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.patch(
          `/api/finance/payments/${id}/reverse`,
          { reason },
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );
        if (!data.success) {
          throw new Error(data?.message || "Failed to reverse payment");
        }
        await fetchPayments();
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, message: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchPayments],
  );

  return {
    payments,
    summary,
    loading,
    saving,
    error,

    methodFilter,
    setMethodFilter,
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

    createPayment,
    reversePayment,
    refetch: fetchPayments,
  };
}

import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ExpenseMethod =
  | "cash"
  | "bank_transfer"
  | "cheque"
  | "card"
  | "online"
  | "petty_cash";

export interface ExpensePaymentInfo {
  _id: string;
  paymentNumber: string;
  method: ExpenseMethod;
  attachment?: string;
}

export interface ExpenseData {
  _id: string;
  category: string;
  invoiceDate: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: "paid";
  notes?: string;
  attachments?: string[];
  createdAt: string;
  payment: ExpensePaymentInfo | null;
}

export interface ExpenseSummary {
  totalSpend: number;
  totalCount: number;
  avgExpense: number;
}

export interface PaginationInfo {
  totalResults: number;
  currentPage: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ChequeDetailsInput {
  chequeNumber: string;
  bank?: string;
  payee?: string;
  chequeDate: string;
}

export interface NewExpenseInput {
  category: string;
  amount: number;
  method: ExpenseMethod;
  bankAccountId?: string;
  chequeDetails?: ChequeDetailsInput;
  date: string;
  notes?: string;
  attachment?: string;
}

const DEFAULT_SUMMARY: ExpenseSummary = {
  totalSpend: 0,
  totalCount: 0,
  avgExpense: 0,
};

export const EXPENSE_CATEGORIES = [
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
];

export default function useExpenses() {
  const [expenses, setExpenses] = useState<ExpenseData[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [categoryFilter, setCategoryFilter] = useState<string>("All");
  const [search, setSearch] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const [page, setPage] = useState<number>(1);
  const [limit] = useState<number>(15);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (categoryFilter !== "All") params.set("category", categoryFilter);
    if (search) params.set("search", search);
    if (startDate) params.set("dateFrom", startDate);
    if (endDate) params.set("dateTo", endDate);
    params.set("page", String(page));
    params.set("limit", String(limit));
    return params.toString();
  }, [categoryFilter, search, startDate, endDate, page, limit]);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(
        `/api/finance/expenses?${buildQuery()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Failed to load expenses");
      }

      setExpenses(data.data || []);
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
      setError(err.message || "Something went wrong while loading expenses");
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, search, startDate, endDate]);

  const nextPage = useCallback(() => {
    if (pagination?.hasMore) setPage((p) => p + 1);
  }, [pagination]);

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(1, p - 1));
  }, []);

  const createExpense = useCallback(
    async (input: NewExpenseInput) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.post("/api/finance/expenses", input, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!data.success) {
          return { ok: false as const, warning: data.message as string };
        }

        await fetchExpenses();
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchExpenses],
  );

  const categories = useMemo(() => EXPENSE_CATEGORIES, []);

  return {
    expenses,
    summary,
    categories,
    loading,
    saving,
    error,

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

    createExpense,
    refetch: fetchExpenses,
  };
}

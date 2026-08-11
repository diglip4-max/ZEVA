// hooks/useOverview.ts
import React from "react";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";

// ============================================================
// INTERFACES
// ============================================================

export interface BillingOverview {
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  totalAdvance: number;
  count: number;
}

export interface PettyCashOverview {
  totalAllocated: number;
  totalSpent: number;
  totalBalance: number;
  totalRecords: number;
  globalTotalAmount: number;
  globalSpentAmount: number;
  globalRemainingAmount: number;
}

export interface ManualPettyCashOverview {
  totalAmount: number;
  totalExpenses: number;
  totalIncome: number;
  totalRecords: number;
  expenseCount: number;
  incomeCount: number;
  totalItems: number;
}

export interface ProductSalesOverview {
  totalSales: number;
  totalPaid: number;
  totalCommission: number;
  totalRecords: number;
  completedCount: number;
  pendingCount: number;
  paidCount: number;
  pendingPaymentCount: number;
}

export interface OverviewSummary {
  totalRevenue: number;
  totalExpenses: number;
  netBalance: number;
  pendingDues: number;
}

export interface ChartDataPoint {
  month?: string;
  year?: number;
  week?: number;
  totalAmount?: number;
  totalPaid?: number;
  totalPending?: number;
  count?: number;
  totalIncome?: number;
  totalExpenses?: number;
  totalSales?: number;
  _id?: any;
}

export interface ChartsData {
  monthlyBillingTrend: ChartDataPoint[];
  weeklyBillingTrend: ChartDataPoint[];
  billingByService: Array<{ _id: string; total: number; count: number }>;
  monthlyManualPettyCash: ChartDataPoint[];
  monthlyProductSales: ChartDataPoint[];
  paymentMethodBreakdown: Array<{ _id: string; total: number; count: number }>;
  statusBreakdown: Array<{ _id: string; total: number; count: number }>;
}

export interface RecentBilling {
  _id: string;
  invoiceNumber: string;
  amount: number;
  paid: number;
  pending: number;
  status: string;
  patientId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    mobileNumber: string;
  };
  doctorName: string;
  service: string;
  invoicedDate: string;
  createdAt: string;
}

export interface OverviewData {
  billing: BillingOverview;
  pettyCash: PettyCashOverview;
  manualPettyCash: ManualPettyCashOverview;
  productSales: ProductSalesOverview;
  overview: OverviewSummary;
  charts: ChartsData;
  recentBillings: RecentBilling[];
}

interface OverviewResponse {
  success: boolean;
  message?: string;
  data: OverviewData;
}

export interface OverviewFilters {
  startDate?: string;
  endDate?: string;
  period?: "daily" | "weekly" | "monthly" | "yearly";
}

// ============================================================
// HOOK INTERFACE
// ============================================================

export interface UseOverviewReturn {
  loading: boolean;
  error: string | null;
  data: OverviewData | null;
  filters: OverviewFilters;
  setFilters: React.Dispatch<React.SetStateAction<OverviewFilters>>;
  fetchOverview: () => Promise<void>;
  refresh: () => Promise<void>;
}

// ============================================================
// HOOK
// ============================================================

const useOverview = (initialFilters?: OverviewFilters): UseOverviewReturn => {
  const token = getTokenByPath();

  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<OverviewData | null>(null);
  const [filters, setFilters] = React.useState<OverviewFilters>(
    initialFilters || { period: "monthly" },
  );

  const fetchOverview = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);
      if (filters.period) params.append("period", filters.period);

      const url = `/api/finance-management/overview${params.toString() ? `?${params.toString()}` : ""}`;

      const res = await axios.get<OverviewResponse>(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const response = res.data;
      if (response.success) {
        setData(response.data);
      } else {
        setError(response.message || "Failed to fetch overview data");
      }
    } catch (err: any) {
      console.error("Error fetching overview:", err);
      setError(err?.response?.data?.message || "Failed to fetch overview data");
    } finally {
      setLoading(false);
    }
  }, [token, filters]);

  const refresh = React.useCallback(async () => {
    await fetchOverview();
  }, [fetchOverview]);

  // Auto-fetch on mount and when filters change
  React.useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return {
    loading,
    error,
    data,
    filters,
    setFilters,
    fetchOverview,
    refresh,
  };
};

export default useOverview;

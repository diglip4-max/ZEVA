// hooks/useOverview.ts
import React from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";

// ============================================================
// INTERFACES — mirror /api/finance-management/overview response
// ============================================================

export interface AmountCount {
  amount: number;
  count: number;
}

export interface OverviewKpis {
  outstandingBills: AmountCount;
  overdueBills: AmountCount;
  upcomingBills: AmountCount;
  upcomingCheques: AmountCount;
  pettyCashBalance: number;
  bankBalance: number;
  thisMonthExpenses: number;
  thisYearExpenses: number;
  unpaidSuppliers: number;
  totalPaidAllTime: number;
  totalPaidThisMonth: number;
  totalPaidThisYear: number;
}

export interface StatusBreakdownItem {
  status: string;
  count: number;
  amount: number;
}

export interface CategoryBreakdownItem {
  category: string;
  amount: number;
  count: number;
}

export interface BillMonthlyTrendItem {
  month: string;
  billed: number;
  paid: number;
  count: number;
}

export interface BillsOverview {
  totalBillsAmount: number;
  totalPaidAmount: number;
  totalBills: number;
  totalOutstanding: number;
  statusBreakdown: StatusBreakdownItem[];
  categoryBreakdown: CategoryBreakdownItem[];
  monthlyTrend: BillMonthlyTrendItem[];
}

export interface PaymentMethodBreakdownItem {
  method: string;
  amount: number;
  count: number;
}

export interface PaymentMonthlyTrendItem {
  month: string;
  amount: number;
  count: number;
}

export interface PaymentsOverview {
  totalPaid: number;
  totalPayments: number;
  avgPayment: number;
  methodBreakdown: PaymentMethodBreakdownItem[];
  monthlyTrend: PaymentMonthlyTrendItem[];
}

export interface UpcomingCheque {
  _id: string;
  chequeNumber: string;
  payee: string;
  bank: string;
  amount: number;
  chequeDate: string;
  status: string;
}

export interface ChequesOverview {
  totalCheques: number;
  totalAmount: number;
  pendingCount: number;
  pendingAmount: number;
  clearedCount: number;
  clearedAmount: number;
  bouncedCount: number;
  bouncedAmount: number;
  statusBreakdown: StatusBreakdownItem[];
  upcoming: UpcomingCheque[];
}

export interface BankAccountSummary {
  _id: string;
  bankName: string;
  accountName?: string;
  accountNumber?: string;
  currentBalance: number;
}

export interface BankAccountsOverview {
  totalBalance: number;
  accounts: BankAccountSummary[];
}

export interface PettyCashMonthlyTrendItem {
  month: string;
  allocated: number;
  spent: number;
}

export interface PettyCashOverview {
  totalAllocated: number;
  totalSpent: number;
  balance: number;
  monthlyTrend: PettyCashMonthlyTrendItem[];
}

export interface TopUnpaidSupplier {
  supplierId: string;
  name: string;
  outstanding: number;
  billCount: number;
}

export interface BillDetails {
  invoiceNumber?: string;
  supplierName?: string | null;
  supplierInvoiceNumber?: string | null;
  category?: string | null;
  invoiceDate?: string | Date | null;
  dueDate?: string | Date | null;
  totalAmount?: number;
  paidAmount?: number;
  balance?: number;
  status?: string;
  notes?: string | null;
  attachments?: number;
  createdAt?: string | Date;
}

export interface PaymentDetails {
  paymentNumber?: string;
  supplierName?: string | null;
  billInvoiceNumber?: string | null;
  billCategory?: string | null;
  amount?: number;
  paymentDate?: string | Date | null;
  method?: string;
  hasAttachment?: boolean;
  notes?: string | null;
  reversed?: boolean;
  createdAt?: string | Date;
}

export interface ChequeDetails {
  chequeNumber?: string;
  supplierName?: string | null;
  payee?: string | null;
  bank?: string | null;
  amount?: number;
  chequeDate?: string | Date | null;
  status?: string;
  createdAt?: string | Date;
}

export interface RecentActivityItem {
  type: "bill" | "payment" | "cheque";
  id: string;
  title: string;
  subtitle: string;
  amount: number;
  status: string;
  date: string;
  details?: BillDetails | PaymentDetails | ChequeDetails;
}

export interface OverviewData {
  kpis: OverviewKpis;
  bills: BillsOverview;
  payments: PaymentsOverview;
  cheques: ChequesOverview;
  bankAccounts: BankAccountsOverview;
  pettyCash: PettyCashOverview;
  topUnpaidSuppliers: TopUnpaidSupplier[];
  recentActivity: RecentActivityItem[];
}

interface OverviewResponse {
  success: boolean;
  message?: string;
  data: OverviewData;
}

export interface OverviewFilters {
  startDate?: string;
  endDate?: string;
}

// ============================================================
// HOOK
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

const useOverview = (initialFilters?: OverviewFilters): UseOverviewReturn => {
  const token = getTokenByPath();

  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<OverviewData | null>(null);
  const [filters, setFilters] = React.useState<OverviewFilters>(
    initialFilters || {},
  );

  const fetchOverview = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const url = `/api/finance-management/overview${params.toString() ? `?${params.toString()}` : ""}`;

      const res = await axios.get<OverviewResponse>(url, {
        headers: { Authorization: `Bearer ${token}` },
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

  React.useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { loading, error, data, filters, setFilters, fetchOverview, refresh };
};

export default useOverview;

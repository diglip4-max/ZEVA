import React from "react";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";

// ==================== Types ====================

export interface MultiplePayment {
  paymentMethod: string;
  amount: number;
  paidAt?: Date;
  paidBy?: string;
  transactionType?:
    | "PAYMENT"
    | "ADVANCE_USAGE"
    | "CLAIM_USAGE"
    | "PENDING_CLEARANCE"
    | "CASHBACK_USAGE";
  notes?: string;
}

export interface PaymentHistory {
  amount: number;
  paid: number;
  pending: number;
  paymentMethod?: string;
  multiplePayments?: MultiplePayment[];
  status?:
    | "Active"
    | "Cancelled"
    | "Completed"
    | "Rejected"
    | "Released"
    | "Partial";
  updatedAt?: Date;
  transactionType?:
    | "PAYMENT"
    | "PENDING_CLEARANCE"
    | "REGULAR_PAYMENT"
    | "ADVANCE_USAGE"
    | "CLAIM_USAGE"
    | "FULL_PAYMENT"
    | "PARTIAL_PAYMENT";
  amountPaid?: number;
  advanceAmountUsed?: number;
  paidBy?: string;
  paidByName?: string;
  remainingPending?: number;
}

export interface SelectedTreatment {
  treatmentName?: string;
  treatmentSlug?: string;
  treatmentServiceId?: string;
  quantity?: number;
  price?: number;
  originalAppointmentQuantity?: number;
}

export interface SelectedPackageTreatment {
  treatmentName?: string;
  treatmentSlug?: string;
  sessions?: number;
}

export interface UnpaidPackagePaid {
  packageId?: string;
  packageSubId?: string;
  packageName?: string;
  amount?: number;
}

export interface PendingClearedBreakdown {
  ledgerId?: string;
  invoiceNumber?: string;
  service?: "Treatment" | "Package" | "Service";
  treatmentSlug?: string;
  treatmentName?: string;
  packageId?: string;
  packageName?: string;
  amountCleared?: number;
  newStatus?: string;
  newRemaining?: number;
}

export interface RefundedOffer {
  offerType: "instant_discount" | "cashback" | "bundle";
  offerId?: string;
  offerName?: string;
  amount?: number;
  freeSessionsRefunded?: string[];
  freeSessionsRestored?: string[];
  cashbackRefunded?: number;
  cashbackWalletUsageReversed?: number;
}

export interface BillingItem {
  _id: string;
  clinicId?: string;
  appointmentId?: string;
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
  productSaleId?: string;
  invoiceNumber: string;
  invoicedDate: Date;
  invoicedBy: string;
  invoicedById:
    | {
        _id: string;
        name?: string;
        email?: string;
      }
    | string;
  invoicedByRole?: string;
  invoicedByRate?: number;
  doctorId:
    | {
        _id: string;
        name?: string;
        email?: string;
      }
    | string;
  doctorName?: string;
  service: "Package" | "Treatment" | "Service" | "Product";
  treatment?: string;
  package?: string;
  packageId?: string;
  quantity?: number;
  sessions?: number;
  selectedPackageTreatments?: SelectedPackageTreatment[];
  selectedTreatments?: SelectedTreatment[];
  unpaidPackagesPaid?: UnpaidPackagePaid[];
  amount: number;
  paid: number;
  advanceUsed?: number;
  claimAmountUsed?: number;
  pendingUsed?: number;
  pendingClaimUsed?: number;
  pending: number;
  pendingLedgerCached?: number;
  pendingLedgerOpenCount?: number;
  pendingClearedBreakdown?: PendingClearedBreakdown[];
  advance?: number;
  pastAdvance?: number;
  pastAdvanceUsed?: number;
  pastAdvanceType?: "50% Offer" | "54% Offer" | "159 Flat" | "";
  paymentMethod?: string;
  multiplePayments?: MultiplePayment[];
  paymentHistory?: PaymentHistory[];
  notes?: string;
  isFreeConsultation?: boolean;
  freeConsultationCount?: number;
  membershipDiscountApplied?: number;
  isDoctorDiscountApplied?: boolean;
  doctorDiscountType?: string;
  doctorDiscountAmount?: number;
  isAgentDiscountApplied?: boolean;
  agentDiscountType?: string;
  agentDiscountAmount?: number;
  discountPercent?: number;
  originalAmount?: number;
  isAdvanceOnly?: boolean;
  pendingBalanceImage?: string[];
  offerApplied?: boolean;
  offerId?: string;
  offerName?: string;
  offerType?: "instant_discount" | "cashback" | "bundle";
  offerDiscountAmount?: number;
  cashbackEarned?: number;
  isCashbackApplied?: boolean;
  cashbackOfferId?: string;
  cashbackOfferName?: string;
  cashbackAmount?: number;
  cashbackStartDate?: Date;
  cashbackEndDate?: Date;
  cashbackWalletUsed?: number;
  bundleSessionsAdded?: number;
  offerOverrideUsed?: boolean;
  offerOverrideReason?: string;
  offerFreeSession?: string[];
  freeOfferSessionCount?: number;
  usedFreeSessions?: string[];
  usedFreeSessionCount?: number;
  isOfferRefunded?: boolean;
  refundedAt?: Date;
  refundedBy?: string;
  refundedAmount?: number;
  refundedOffers?: RefundedOffer[];
  status?:
    | "Active"
    | "Cancelled"
    | "Completed"
    | "Rejected"
    | "Released"
    | "Partial";
  createdAt: string;
  updatedAt: string;
}

export interface BillingSummary {
  totalAmount: number;
  totalPaid: number;
  totalPending: number;
  totalAdvance: number;
  count: number;
}

export interface Pagination {
  totalResults: number;
  totalPages: number;
  currentPage: number;
  limit: number;
  hasMore: boolean;
}

interface BillingListResponse {
  success: boolean;
  message?: string;
  data: BillingItem[];
  summary: BillingSummary;
  pagination: Pagination;
}

const DEFAULT_PAGINATION: Pagination = {
  totalResults: 0,
  totalPages: 1,
  currentPage: 1,
  limit: 20,
  hasMore: false,
};

const DEFAULT_SUMMARY: BillingSummary = {
  totalAmount: 0,
  totalPaid: 0,
  totalPending: 0,
  totalAdvance: 0,
  count: 0,
};

export interface BillingFilters {
  status?: string;
  service?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
}

export interface UseBillingReturn {
  loading: boolean;
  error: string | null;
  billing: BillingItem[];
  setBilling: React.Dispatch<React.SetStateAction<BillingItem[]>>;
  summary: BillingSummary;
  fetchBilling: () => Promise<void>;

  // Search
  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;

  // Filters
  filters: BillingFilters;
  setFilters: React.Dispatch<React.SetStateAction<BillingFilters>>;
  applyFilters: (filters: BillingFilters) => void;
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

export const getPatientInitials = (patient: any): string => {
  if (!patient) return "?";
  if (typeof patient === "string") return patient.slice(0, 2).toUpperCase();

  const firstName = patient.firstName || "";
  const lastName = patient.lastName || "";

  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) {
    return firstName.slice(0, 2).toUpperCase();
  }
  if (patient.name) {
    const nameParts = patient.name.split(" ");
    if (nameParts.length >= 2) {
      return `${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase();
    }
    return patient.name.slice(0, 2).toUpperCase();
  }
  return patient.email?.slice(0, 2).toUpperCase() || "??";
};

// Add this helper function to get patient display name
export const getPatientDisplayName = (patient: any): string => {
  if (!patient) return "Unknown Patient";
  if (typeof patient === "string") return `Patient #${patient.slice(-6)}`;

  const firstName = patient.firstName || "";
  const lastName = patient.lastName || "";
  const name = patient.name || "";

  if (firstName && lastName) {
    return `${firstName} ${lastName}`;
  }
  if (firstName) {
    return firstName;
  }
  if (name) {
    return name;
  }
  if (patient.email) {
    return patient.email;
  }
  return `Patient #${patient._id?.slice(-6) || "??"}`;
};

// Get avatar color based on patient name or ID
export const getAvatarColor = (patient: any): string => {
  const colors = [
    "bg-teal-100 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300",
    "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
    "bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300",
    "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
    "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    "bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300",
    "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300",
  ];

  const id = typeof patient === "string" ? patient : patient?._id || "";
  const index = id ? id.toString().length % colors.length : 0;
  return colors[index];
};

const useBilling = (): UseBillingReturn => {
  const token = getTokenByPath();

  const [billing, setBilling] = React.useState<BillingItem[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [summary, setSummary] = React.useState<BillingSummary>(DEFAULT_SUMMARY);

  // ---- Search ----
  const [search, setSearch] = React.useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = React.useState<string>("");

  // ---- Filters ----
  const [filters, setFilters] = React.useState<BillingFilters>({});

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

  const fetchBilling = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Build params
      const params: Record<string, any> = {
        page,
        limit,
      };

      if (debouncedSearch) params.search = debouncedSearch;

      // Add filters
      if (filters.status) params.status = filters.status;
      if (filters.service) params.service = filters.service;
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.minAmount !== undefined && filters.minAmount !== null) {
        params.minAmount = filters.minAmount;
      }
      if (filters.maxAmount !== undefined && filters.maxAmount !== null) {
        params.maxAmount = filters.maxAmount;
      }

      const res = await axios.get<BillingListResponse>(
        "/api/finance-management/billing",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params,
        },
      );

      const data = res.data;
      if (data.success) {
        setBilling(data.data || []);
        setSummary(data.summary || DEFAULT_SUMMARY);
        setPagination(data.pagination || DEFAULT_PAGINATION);
      } else {
        setError(data.message || "Failed to fetch billing records");
      }
    } catch (err: any) {
      console.error("Error fetching billing records:", err);
      setError(
        err?.response?.data?.message || "Failed to fetch billing records",
      );
    } finally {
      setLoading(false);
    }
  }, [token, debouncedSearch, page, limit, filters]);

  React.useEffect(() => {
    fetchBilling();
  }, [fetchBilling]);

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

  const applyFilters = React.useCallback((newFilters: BillingFilters) => {
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
    billing,
    setBilling,
    summary,
    fetchBilling,

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

export default useBilling;

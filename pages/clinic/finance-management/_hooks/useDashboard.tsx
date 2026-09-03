// hooks/useDashboard.ts
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";

// ============================================================
// FILTER TYPES
// ============================================================

export type DashboardPeriod =
  | "today"
  | "yesterday"
  | "last7"
  | "last30"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "thisYear"
  | "allTime"
  | "custom";

export interface DashboardFilters {
  period: DashboardPeriod;
  startDate?: string; // ISO date, only used when period === "custom"
  endDate?: string; // ISO date, only used when period === "custom"
  category: string; // category name, or "all"
  supplierId: string; // Supplier ObjectId, or "all"
  method: string; // payment method, or "all"
}

export const DEFAULT_FILTERS: DashboardFilters = {
  period: "thisMonth",
  category: "all",
  supplierId: "all",
  method: "all",
};

export interface FilterOption {
  value: string;
  label: string;
}

export interface SupplierOption {
  id: string;
  name: string;
}

export interface FiltersMeta {
  categories: string[];
  suppliers: SupplierOption[];
  paymentMethods: FilterOption[];
  periods: FilterOption[];
}

// ============================================================
// TYPES
// ============================================================

export interface SignalStats {
  moneyReceived: number;
  moneySpent: number;
  moneyReceivedTrend: number;
  moneySpentTrend: number;
  outstandingBills: number;
  outstandingCount: number;
  overdue: number;
  overdueCount: number;
  upcoming: number;
  upcomingCount: number;
  availableCash: number;
}

export interface FinancialPosition {
  cashCoverage: number;
  status: "healthy" | "warn" | "critical";
  headline: string;
  description: string;
  reasons: string[];
}

export interface AttentionItem {
  severity: "red" | "amber";
  title: string;
  description: string;
  impact: string;
  action: string;
  link: string;
}

export interface BankAccount {
  name: string;
  account?: string;
  balance: number;
  manual: boolean;
}

export interface CashPosition {
  bankAccounts: BankAccount[];
  pettyCash: number;
  totalAvailable: number;
  upcomingObligations: number;
  availableAfterObligations: number;
}

export interface Bill {
  id: string;
  supplier: string;
  amount: number;
  paid: number;
  dueDate: string;
  status: string;
  category?: string;
}

export interface Cheque {
  number: string;
  payee: string;
  amount: number;
  status: string;
}

export interface ChequeSummary {
  issued: number;
  presented: number;
  cleared: number;
  upcoming: Cheque[];
}

export interface OverdueAging {
  d1to7: number;
  d8to30: number;
  d31plus: number;
  total: number;
  count: number;
  highestRisk: { name: string; amount: number } | null;
}

export interface SupplierData {
  name: string;
  amount: number;
}

export interface MoneyFlow {
  received: number;
  spent: number;
  net: number;
  receivedPct: number;
  spentPct: number;
}

export interface Next30DayItem {
  name: string;
  date: string;
  amount: number;
}

export interface Next30Days {
  total: number;
  items: Next30DayItem[];
}

export interface ExpenseCategory {
  label: string;
  amount: number;
}

export interface PettyCashActivity {
  label: string;
  amount: number;
}

export interface PettyCash {
  balance: number;
  todayActivity: PettyCashActivity[];
  allocated?: number;
  spentFromAllocations?: number;
  manualIncome?: number;
  manualExpense?: number;
}

export interface ExpenseTrend {
  months: string[];
  values: number[];
  note: string;
  mode?: string;
}

export interface WhatChangedItem {
  label: string;
  change: number;
  up: boolean;
  amount: number;
}

export interface RecurringItem {
  name: string;
  amount: number;
  frequency: string;
  category: string;
}

export interface Recurring {
  monthlyTotal: number;
  items: RecurringItem[];
}

export interface RiskItem {
  label: string;
  amount: number;
}

export interface Risks {
  status: string;
  riskLevel: "low" | "warn" | "critical";
  items: RiskItem[];
}

export interface Pressure {
  expectedPayments: number;
  recurringObligations: number;
  knownOutstanding: number;
  potential: number;
  note: string;
}

export interface DashboardData {
  currency: string;
  signalStats: SignalStats;
  financialPosition: FinancialPosition;
  attention: AttentionItem[];
  cashPosition: CashPosition;
  bills: Bill[];
  cheques: ChequeSummary;
  overdueAging: OverdueAging;
  suppliers: SupplierData[];
  moneyFlow: MoneyFlow;
  next30Days: Next30Days;
  expenseCategories: ExpenseCategory[];
  pettyCash: PettyCash;
  bankAccounts: BankAccount[];
  expenseTrend: ExpenseTrend;
  whatChanged: WhatChangedItem[];
  insights: string[];
  recurring: Recurring;
  risks: Risks;
  pressure: Pressure;
  quickReports: string[];
}

export interface UseDashboardOptions {
  clinicId?: string;
  autoFetch?: boolean;
  initialFilters?: Partial<DashboardFilters>;
}

export interface UseDashboardReturn {
  data: DashboardData | null;
  loading: boolean;
  error: string | null;
  currency: string;
  filters: DashboardFilters;
  setFilters: (filters: Partial<DashboardFilters>) => void;
  resetFilters: () => void;
  filtersMeta: FiltersMeta | null;
  filtersMetaLoading: boolean;
  refetch: () => Promise<void>;
  fetchAttention: () => Promise<AttentionItem[]>;
  fetchCashPosition: () => Promise<CashPosition>;
  fetchMoneyFlow: (period?: string) => Promise<MoneyFlow>;
  fetchExpenseTrend: (mode?: string) => Promise<ExpenseTrend>;
  fetchWhatChanged: () => Promise<WhatChangedItem[]>;
  fetchInsights: () => Promise<string[]>;
  fetchRisks: () => Promise<Risks>;
  fetchPressure: () => Promise<Pressure>;
}

// ============================================================
// DEFAULTS — ensures every field has a sensible fallback so the
// UI never crashes on undefined / partial API responses.
// ============================================================

const DEFAULTS: DashboardData = {
  currency: "USD",
  signalStats: {
    moneyReceived: 0,
    moneySpent: 0,
    moneyReceivedTrend: 0,
    moneySpentTrend: 0,
    outstandingBills: 0,
    outstandingCount: 0,
    overdue: 0,
    overdueCount: 0,
    upcoming: 0,
    upcomingCount: 0,
    availableCash: 0,
  },
  financialPosition: {
    cashCoverage: 0,
    status: "healthy",
    headline: "Financial Position — Healthy",
    description: "All bills are on schedule.",
    reasons: [],
  },
  attention: [],
  cashPosition: {
    bankAccounts: [],
    pettyCash: 0,
    totalAvailable: 0,
    upcomingObligations: 0,
    availableAfterObligations: 0,
  },
  bills: [],
  cheques: {
    issued: 0,
    presented: 0,
    cleared: 0,
    upcoming: [],
  },
  overdueAging: {
    d1to7: 0,
    d8to30: 0,
    d31plus: 0,
    total: 0,
    count: 0,
    highestRisk: null,
  },
  suppliers: [],
  moneyFlow: {
    received: 0,
    spent: 0,
    net: 0,
    receivedPct: 0,
    spentPct: 0,
  },
  next30Days: {
    total: 0,
    items: [],
  },
  expenseCategories: [],
  pettyCash: {
    balance: 0,
    todayActivity: [],
  },
  bankAccounts: [],
  expenseTrend: {
    months: [],
    values: [],
    note: "No expense data yet.",
  },
  whatChanged: [],
  insights: [],
  recurring: {
    monthlyTotal: 0,
    items: [],
  },
  risks: {
    status: "Financial Control: Healthy",
    riskLevel: "low",
    items: [],
  },
  pressure: {
    expectedPayments: 0,
    recurringObligations: 0,
    knownOutstanding: 0,
    potential: 0,
    note: "",
  },
  quickReports: [
    "Expense Report",
    "Supplier Report",
    "Outstanding Bills",
    "Upcoming Bills",
    "Cheque Report",
  ],
};

const deepMerge = <T extends object>(base: T, patch: Partial<T>): T => {
  const out: any = Array.isArray(base)
    ? [...(base as any)]
    : { ...(base as any) };
  for (const k of Object.keys(patch as any)) {
    const v = (patch as any)[k];
    if (v === null || v === undefined) continue;
    if (
      typeof v === "object" &&
      !Array.isArray(v) &&
      typeof (base as any)[k] === "object" &&
      (base as any)[k] !== null
    ) {
      out[k] = deepMerge((base as any)[k], v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
};

const API_BASE = "/api/finance/dashboard";

// ============================================================
// LOW-LEVEL FETCH HELPERS
// ============================================================

const getHeaders = () => {
  const token = getTokenByPath();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const buildQS = (
  clinicId?: string,
  filters?: Partial<DashboardFilters>,
  extra?: Record<string, string>,
): string => {
  const p: Record<string, string> = {};
  if (clinicId) p.clinicId = clinicId;
  if (filters) {
    if (filters.period) p.period = filters.period;
    if (filters.period === "custom") {
      if (filters.startDate) p.startDate = filters.startDate;
      if (filters.endDate) p.endDate = filters.endDate;
    }
    if (filters.category && filters.category !== "all")
      p.category = filters.category;
    if (filters.supplierId && filters.supplierId !== "all")
      p.supplierId = filters.supplierId;
    if (filters.method && filters.method !== "all") p.method = filters.method;
  }
  if (extra) Object.assign(p, extra);
  const s = new URLSearchParams(p).toString();
  return s ? `?${s}` : "";
};

const get = async <T = any,>(path: string, qs: string): Promise<T> => {
  const res = await axios.get(`${API_BASE}${path}${qs}`, {
    headers: getHeaders(),
  });
  if (res.data?.success) return res.data.data as T;
  throw new Error(res.data?.message || `Request failed for ${path}`);
};

// ============================================================
// HOOK
// ============================================================

export default function useDashboard(
  options: UseDashboardOptions = {},
): UseDashboardReturn {
  const { clinicId, autoFetch = true, initialFilters } = options;

  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFiltersState] = useState<DashboardFilters>({
    ...DEFAULT_FILTERS,
    ...initialFilters,
  });
  const [filtersMeta, setFiltersMeta] = useState<FiltersMeta | null>(null);
  const [filtersMetaLoading, setFiltersMetaLoading] = useState<boolean>(false);
  const cancelledRef = useRef<boolean>(false);

  const setFilters = useCallback((next: Partial<DashboardFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({ ...DEFAULT_FILTERS, ...initialFilters });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDataSlice = useCallback(
    <K extends keyof DashboardData>(key: K, value: DashboardData[K]) => {
      if (cancelledRef.current) return;
      setData((prev) => {
        if (!prev) return { ...DEFAULTS, [key]: value };
        // prev is the base, { [key]: value } is the patch — the freshly
        // fetched value must win, not the stale one already in state.
        return deepMerge(prev as any, { [key]: value } as any);
      });
    },
    [],
  );

  // --------------------------------------------------------
  // Filter metadata (categories / suppliers / payment methods)
  // --------------------------------------------------------
  const fetchFiltersMeta = useCallback(async () => {
    if (typeof window === "undefined") return;
    setFiltersMetaLoading(true);
    try {
      const result = await get<FiltersMeta>("/filters-meta", buildQS(clinicId));
      if (!cancelledRef.current) setFiltersMeta(result);
    } catch {
      // Non-fatal: filter dropdowns just render with no options.
    } finally {
      if (!cancelledRef.current) setFiltersMetaLoading(false);
    }
  }, [clinicId]);

  const fetchAttention = useCallback(async (): Promise<AttentionItem[]> => {
    const result = await get<AttentionItem[]>(
      "/attention",
      buildQS(clinicId, filters),
    );
    updateDataSlice("attention", Array.isArray(result) ? result : []);
    return result;
  }, [clinicId, filters, updateDataSlice]);

  const fetchCashPosition = useCallback(async (): Promise<CashPosition> => {
    const result = await get<CashPosition>(
      "/cash-position",
      buildQS(clinicId, filters),
    );
    updateDataSlice("cashPosition", result || DEFAULTS.cashPosition);
    return result;
  }, [clinicId, filters, updateDataSlice]);

  const fetchMoneyFlow = useCallback(
    async (period: string = filters.period): Promise<MoneyFlow> => {
      const result = await get<MoneyFlow>(
        "/money-flow",
        buildQS(clinicId, filters, { period }),
      );
      updateDataSlice("moneyFlow", result || DEFAULTS.moneyFlow);
      return result;
    },
    [clinicId, filters, updateDataSlice],
  );

  const fetchExpenseTrend = useCallback(
    async (mode: string = "bills"): Promise<ExpenseTrend> => {
      const result = await get<ExpenseTrend>(
        "/expense-trend",
        buildQS(clinicId, filters, { mode }),
      );
      updateDataSlice("expenseTrend", result || DEFAULTS.expenseTrend);
      return result;
    },
    [clinicId, filters, updateDataSlice],
  );

  const fetchWhatChanged = useCallback(async (): Promise<WhatChangedItem[]> => {
    const result = await get<WhatChangedItem[]>(
      "/what-changed",
      buildQS(clinicId, filters),
    );
    updateDataSlice("whatChanged", Array.isArray(result) ? result : []);
    return result;
  }, [clinicId, filters, updateDataSlice]);

  const fetchInsights = useCallback(async (): Promise<string[]> => {
    const result = await get<string[]>("/insights", buildQS(clinicId, filters));
    updateDataSlice("insights", Array.isArray(result) ? result : []);
    return result;
  }, [clinicId, filters, updateDataSlice]);

  const fetchRisks = useCallback(async (): Promise<Risks> => {
    const result = await get<Risks>("/risks", buildQS(clinicId, filters));
    updateDataSlice("risks", result || DEFAULTS.risks);
    return result;
  }, [clinicId, filters, updateDataSlice]);

  const fetchPressure = useCallback(async (): Promise<Pressure> => {
    const result = await get<Pressure>("/pressure", buildQS(clinicId, filters));
    updateDataSlice("pressure", result || DEFAULTS.pressure);
    return result;
  }, [clinicId, filters, updateDataSlice]);

  // --------------------------------------------------------
  // Aggregate fetcher — fires ALL endpoints in parallel,
  // merges results with DEFAULTS. Re-runs whenever `filters` change.
  // --------------------------------------------------------

  const fetchDashboard = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined") return;

    setLoading(true);
    setError(null);

    const qs = buildQS(clinicId, filters);

    try {
      const results = await Promise.allSettled([
        get<any>("", qs), // Main index
        get<AttentionItem[]>("/attention", qs).catch(() => []),
        get<CashPosition>("/cash-position", qs).catch(
          () => DEFAULTS.cashPosition,
        ),
        get<MoneyFlow>(
          "/money-flow",
          buildQS(clinicId, filters, { period: filters.period }),
        ).catch(() => DEFAULTS.moneyFlow),
        get<ExpenseTrend>("/expense-trend", qs).catch(
          () => DEFAULTS.expenseTrend,
        ),
        get<WhatChangedItem[]>("/what-changed", qs).catch(() => []),
        get<string[]>("/insights", qs).catch(() => []),
        get<Risks>("/risks", qs).catch(() => DEFAULTS.risks),
        get<Pressure>("/pressure", qs).catch(() => DEFAULTS.pressure),
      ]);

      const unwrap = <T,>(r: PromiseSettledResult<T>, fallback: T): T =>
        r.status === "fulfilled" ? (r.value ?? fallback) : fallback;

      const [
        baseResult,
        attentionResult,
        cashPosResult,
        moneyFlowResult,
        expenseTrendResult,
        whatChangedResult,
        insightsResult,
        risksResult,
        pressureResult,
      ] = results;

      const base = unwrap(baseResult, {} as any);
      const attention = unwrap(attentionResult, [] as AttentionItem[]);
      const cashPos = unwrap(cashPosResult, DEFAULTS.cashPosition);
      const moneyFlow = unwrap(moneyFlowResult, DEFAULTS.moneyFlow);
      const expenseTrend = unwrap(expenseTrendResult, DEFAULTS.expenseTrend);
      const whatChanged = unwrap(whatChangedResult, [] as WhatChangedItem[]);
      const insights = unwrap(insightsResult, [] as string[]);
      const risks = unwrap(risksResult, DEFAULTS.risks);
      const pressure = unwrap(pressureResult, DEFAULTS.pressure);

      const currency: string = base.currency || DEFAULTS.currency;

      const normalizeBank = (arr: any[] = []): BankAccount[] =>
        arr.map((a) => ({
          name: a.name || a.bankName || "Unknown",
          account: a.account || a.accountNumber || undefined,
          balance:
            typeof a.balance === "number"
              ? a.balance
              : typeof a.amount === "number"
                ? a.amount
                : typeof a.currentBalance === "number"
                  ? a.currentBalance
                  : 0,
          manual: a.manual !== false,
        }));

      const buildAging = (baseAging: any): OverdueAging => {
        if (baseAging && typeof baseAging.total === "number") {
          return {
            d1to7: baseAging.d1to7 ?? 0,
            d8to30: baseAging.d8to30 ?? 0,
            d31plus: baseAging.d31plus ?? 0,
            total: baseAging.total,
            count: baseAging.count ?? 0,
            highestRisk: baseAging.highestRisk ?? null,
          };
        }
        const overdue = base.signalStats?.overdue ?? 0;
        const d1to7 = Math.round(overdue * 0.35);
        const d8to30 = Math.round(overdue * 0.4);
        const d31plus = overdue - d1to7 - d8to30;
        return {
          d1to7,
          d8to30,
          d31plus,
          total: overdue,
          count: base.signalStats?.overdueCount ?? 0,
          highestRisk: null,
        };
      };

      const allBills: Bill[] = Array.isArray(base.bills) ? base.bills : [];

      const buildNext30 = (): Next30Days => {
        const items: Next30DayItem[] = allBills
          .filter((b: Bill) => {
            const st = String(b.status || "").toLowerCase();
            return st === "upcoming" || st === "pending" || st === "overdue";
          })
          .sort((a, b) => {
            const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
            const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
            return da - db;
          })
          .slice(0, 5)
          .map((b: Bill) => ({
            name: b.supplier || "Unknown",
            date: b.dueDate
              ? new Date(b.dueDate).toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })
              : "—",
            amount: Math.max(0, (b.amount || 0) - (b.paid || 0)),
          }));
        const signalUpcoming = base.signalStats?.upcoming ?? 0;
        const itemsTotal = items.reduce((s, i) => s + i.amount, 0);
        return {
          total: signalUpcoming > 0 ? signalUpcoming : itemsTotal,
          items,
        };
      };

      const buildExpenseCats = (): ExpenseCategory[] => {
        const map = new Map<string, number>();
        for (const b of allBills) {
          const cat =
            String((b as any).category || "").trim() ||
            (b.amount > 10000 ? "Large Payments" : "General");
          const balance = Math.max(0, (b.amount || 0) - (b.paid || 0));
          map.set(cat, (map.get(cat) || 0) + balance);
        }
        if (map.size === 0) {
          const spent = base.signalStats?.moneySpent || 0;
          if (spent > 0) map.set("Total Spent", spent);
        }
        return Array.from(map.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([label, amount]) => ({ label, amount }));
      };

      const buildSuppliers = (): SupplierData[] => {
        const map = new Map<string, number>();
        for (const b of allBills) {
          const name = b.supplier || "Unknown";
          const balance = Math.max(0, (b.amount || 0) - (b.paid || 0));
          map.set(name, (map.get(name) || 0) + balance);
        }
        return Array.from(map.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, amount]) => ({ name, amount }));
      };

      const buildRecurring = (): Recurring => {
        const cats: RecurringItem[] = [];
        const rent = allBills.find(
          (b: any) => String(b.category || "").toLowerCase() === "rent",
        );
        if (rent) {
          cats.push({
            name: rent.supplier || "Rent",
            amount: rent.amount || 0,
            frequency: "/month",
            category: String((rent as any).category || "Rent"),
          });
        }
        const knownRecurringMap = new Map<string, string>();
        for (const b of allBills) {
          const cat = String((b as any).category || "");
          if (
            cat &&
            /rent|software|utility|subscription|maintenance|salary|lease/i.test(
              cat,
            )
          ) {
            if (!knownRecurringMap.has(cat)) {
              knownRecurringMap.set(cat, b.supplier || cat);
              if (cat !== String((rent as any)?.category || "")) {
                cats.push({
                  name: b.supplier || cat,
                  amount: b.amount || 0,
                  frequency: "/month",
                  category: cat,
                });
              }
            }
          }
        }
        return {
          monthlyTotal: cats.reduce((s, c) => s + c.amount, 0),
          items: cats.slice(0, 5),
        };
      };

      const mergedBanks = normalizeBank([
        ...(normalizeBank(base.bankAccounts || []) as any[]),
        ...(normalizeBank((cashPos as any)?.bankAccounts || []) as any[]),
      ]).filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i);

      const cash: CashPosition = {
        bankAccounts: normalizeBank((cashPos as any)?.bankAccounts || []),
        pettyCash:
          typeof (cashPos as any)?.pettyCash === "number"
            ? (cashPos as any).pettyCash
            : (base.pettyCash?.balance ?? 0),
        totalAvailable:
          typeof (cashPos as any)?.totalAvailable === "number"
            ? (cashPos as any).totalAvailable
            : (base.signalStats?.availableCash ?? 0),
        upcomingObligations:
          typeof (cashPos as any)?.upcomingObligations === "number"
            ? (cashPos as any).upcomingObligations
            : (base.signalStats?.upcoming ?? 0),
        availableAfterObligations:
          typeof (cashPos as any)?.availableAfterObligations === "number"
            ? (cashPos as any).availableAfterObligations
            : (base.signalStats?.availableCash ?? 0) -
              (base.signalStats?.upcoming ?? 0),
      };

      const pettyCash: PettyCash = {
        balance:
          typeof base.pettyCash?.balance === "number"
            ? base.pettyCash.balance
            : cash.pettyCash,
        todayActivity: Array.isArray((base.pettyCash as any)?.todayActivity)
          ? (base.pettyCash as any).todayActivity
          : [],
        allocated: base.pettyCash?.allocated,
        spentFromAllocations: base.pettyCash?.spentFromAllocations,
        manualIncome: base.pettyCash?.manualIncome,
        manualExpense: base.pettyCash?.manualExpense,
      };

      const next30 = buildNext30();
      const expenseCategories = buildExpenseCats();
      const suppliers = buildSuppliers();
      const recurring = buildRecurring();

      const merged: DashboardData = deepMerge(DEFAULTS, {
        currency,
        signalStats: base.signalStats || DEFAULTS.signalStats,
        financialPosition: base.financialPosition || DEFAULTS.financialPosition,
        attention: attention,
        cashPosition: cash,
        bills: Array.isArray(base.bills) ? base.bills : [],
        cheques: base.cheques || DEFAULTS.cheques,
        overdueAging: buildAging(base.overdueAging),
        suppliers,
        moneyFlow: moneyFlow,
        next30Days: next30,
        expenseCategories,
        pettyCash,
        bankAccounts: mergedBanks,
        expenseTrend: expenseTrend,
        whatChanged: whatChanged,
        insights: insights,
        recurring,
        risks: risks,
        pressure: pressure,
      });

      if (!cancelledRef.current) {
        setData(merged);
      }

      return;
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to load dashboard";
      if (!cancelledRef.current) {
        setError(errorMessage);
        setData(DEFAULTS);
      }
      throw err;
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
      }
    }
  }, [clinicId, filters]);

  // --------------------------------------------------------
  // Auto-fetch on mount and whenever filters change
  // --------------------------------------------------------

  useEffect(() => {
    cancelledRef.current = false;
    if (autoFetch && typeof window !== "undefined") {
      fetchDashboard();
    }
    return () => {
      cancelledRef.current = true;
    };
  }, [autoFetch, fetchDashboard]);

  useEffect(() => {
    fetchFiltersMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId]);

  const currency = useMemo(() => data?.currency || DEFAULTS.currency, [data]);

  return {
    data,
    loading,
    error,
    currency,
    filters,
    setFilters,
    resetFilters,
    filtersMeta,
    filtersMetaLoading,
    refetch: fetchDashboard,
    fetchAttention,
    fetchCashPosition,
    fetchMoneyFlow,
    fetchExpenseTrend,
    fetchWhatChanged,
    fetchInsights,
    fetchRisks,
    fetchPressure,
  };
}

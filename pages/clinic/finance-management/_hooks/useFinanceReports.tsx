import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";

export type ReportType =
  | "expense"
  | "outstandingBills"
  | "paidBills"
  | "upcomingBills"
  | "paymentHistory"
  | "pettyCash"
  | "cheques"
  | "supplier"
  | "yearlySummary";

export const REPORT_OPTIONS: {
  value: ReportType;
  label: string;
  route: string;
}[] = [
  {
    value: "expense",
    label: "Expense Report",
    route: "/api/finance/reports/expense",
  },
  {
    value: "outstandingBills",
    label: "Outstanding Bills",
    route: "/api/finance/reports/outstanding-bills",
  },
  {
    value: "paidBills",
    label: "Paid Bills",
    route: "/api/finance/reports/paid-bills",
  },
  {
    value: "upcomingBills",
    label: "Upcoming Bills",
    route: "/api/finance/reports/upcoming-bills",
  },
  {
    value: "paymentHistory",
    label: "Payment History",
    route: "/api/finance/reports/payment-history",
  },
  {
    value: "pettyCash",
    label: "Petty Cash Report",
    route: "/api/finance/reports/petty-cash",
  },
  {
    value: "cheques",
    label: "Cheque Report",
    route: "/api/finance/reports/cheques",
  },
  {
    value: "supplier",
    label: "Supplier Report",
    route: "/api/finance/reports/supplier",
  },
  {
    value: "yearlySummary",
    label: "Yearly Expense Summary",
    route: "/api/finance/reports/yearly-summary",
  },
];

export default function useFinanceReports() {
  const [reportType, setReportType] = useState<ReportType>("expense");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const activeReport = useMemo(
    () => REPORT_OPTIONS.find((r) => r.value === reportType)!,
    [reportType],
  );

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (reportType === "yearlySummary") {
      if (year) params.set("year", year);
    } else {
      if (startDate) params.set("dateFrom", startDate);
      if (endDate) params.set("dateTo", endDate);
    }
    return params.toString();
  }, [reportType, startDate, endDate, year]);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQuery();
      const token = getTokenByPath();
      const { data } = await axios.get(
        `${activeReport.route}${qs ? `?${qs}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data?.success) {
        throw new Error(data.message || "Failed to load report");
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || "Something went wrong while loading the report");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [activeReport, buildQuery]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  return {
    reportType,
    setReportType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    year,
    setYear,
    loading,
    error,
    result,
    refetch: fetchReport,
  };
}

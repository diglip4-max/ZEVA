import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";
import RevenueOpportunityDetailsModal from "./RevenueOpportunityDetailsModal";

const DEFAULT_DATA = {
  scope: "clinic",
  scopeNote: "",
  date: null,
  isToday: true,
  totalPotential: 0,
  recoveredSoFar: 0,
  progressPercent: 0,
  percentChangeVsYesterday: 0,
  highValueActions: 0,
  treatmentRevenue: 0,
  expiredPackageRevenue: 0,
  todaysAppointmentsCount: 0,
  expiredPackagesCount: 0,
  hotLeadsCount: 0,
  followUpsCount: 0,
  slotRecoveryCount: 0,
  categories: {
    hotLeads: 0,
    followUps: 0,
    packageRenewals: 0,
    slotRecovery: 0,
  },
};

const formatCurrency = (value, currency) => {
  const symbol = getCurrencySymbol(currency || "AED");
  const num = Number(value || 0);
  const formatted = num.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${symbol} ${formatted}`;
};

const formatLongDate = (iso) => {
  if (!iso) return "";
  // iso is a YYYY-MM-DD string. Treat it as a local date for display.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export default function RevenueOpportunity({ selectedDate, token: externalToken = null }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [data, setData] = useState(DEFAULT_DATA);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const fetchRevenueOpportunity = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = externalToken || (
        typeof window !== "undefined"
          ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken") ||
            localStorage.getItem("userToken") || sessionStorage.getItem("userToken") ||
            localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken")
          : null
      );

      if (!token) {
        setData(DEFAULT_DATA);
        setIsLoading(false);
        return;
      }

      // Build the request with the selected date (if any). Backend treats an
      // absent/missing/invalid `date` as "today", so we only forward when
      // the parent has actually picked a date.
      const params = {};
      if (selectedDate) {
        params.date = selectedDate;
      }

      const res = await axios.get("/api/agent/revenue-opportunity", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (res.data && res.data.success && res.data.data) {
        setData({ ...DEFAULT_DATA, ...res.data.data });
      } else {
        setData(DEFAULT_DATA);
      }
    } catch (err) {
      // console.error("RevenueOpportunity fetch error:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load");
      setData(DEFAULT_DATA);
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate, externalToken]);

  useEffect(() => {
    fetchRevenueOpportunity();
    // Refresh every 5 minutes to keep the card in sync with the live day
    const interval = setInterval(fetchRevenueOpportunity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchRevenueOpportunity]);

  const totalPotential = data.totalPotential;
  const recoveredSoFar = data.recoveredSoFar;
  const progressPercent = data.progressPercent;
  const percentChange = data.percentChangeVsYesterday;
  const categories = data.categories || DEFAULT_DATA.categories;
  const highValueActions = data.highValueActions;
  const isToday = data.isToday !== false;

  // Progress bar fallback when there's no potential but there is recovered revenue
  const progressWidth = `${Math.max(0, Math.min(100, progressPercent))}%`;
  const isPositiveChange = percentChange >= 0;
  const isInitialLoading = isLoading && totalPotential === 0 && !error;

  // Header label varies based on the selected date so users can see at a
  // glance whether they're looking at "today" or some other date.
  const dateLabel = data.date ? formatLongDate(data.date) : "";
  const headerTitle = isToday ? "Today's Revenue Opportunity" : "Revenue Opportunity";
  const vsLabel = isToday ? "vs yesterday" : "vs previous day";

  return (
    <div className="mb-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-5 shadow-sm relative overflow-hidden">
      <div className="absolute -right-32 -top-32 w-80 h-80 bg-indigo-50 dark:bg-indigo-500/5 rounded-full opacity-70 pointer-events-none" />
      <div className="absolute -right-20 bottom-0 w-72 h-72 bg-purple-50 dark:bg-purple-500/5 rounded-full opacity-60 pointer-events-none" />

      <div className="relative">
        {/* Top Row: Potential Revenue + Recovered So Far */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-[0.12em] mb-2">
              {headerTitle}
              {data.scope === "doctor" && data.scopeNote ? (
                <span
                  className="ml-2 inline-flex items-center gap-1 align-middle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                  title={data.scopeNote}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                  You
                </span>
              ) : null}
              {!isToday && dateLabel ? (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 align-middle">
                  {dateLabel}
                </span>
              ) : null}
            </p>
            <div className="flex flex-wrap items-baseline gap-4">
              <div className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                {isInitialLoading ? (
                  <span className="inline-block w-40 h-12 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
                ) : (
                  formatCurrency(totalPotential, currency)
                )}
              </div>
              {!isInitialLoading && totalPotential > 0 && (
                <div
                  className={`inline-flex items-center px-3.5 py-1.5 rounded-full ${isPositiveChange
                      ? "bg-emerald-100 dark:bg-emerald-500/15"
                      : "bg-red-100 dark:bg-red-500/15"
                    }`}
                >
                  <span
                    className={`font-bold text-sm ${isPositiveChange
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-red-700 dark:text-red-400"
                      }`}
                  >
                    {isPositiveChange ? "+" : ""}
                    {Number(percentChange || 0).toFixed(0)}% {vsLabel}
                  </span>
                </div>
              )}
            </div>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
              {isToday
                ? "Potential revenue ZEVA identified today"
                : "Potential revenue ZEVA identified for the selected date"}
            </p>
          </div>

          <div className="md:text-right">
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Recovered so far
            </p>
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tracking-tight">
              {isInitialLoading ? (
                <span className="inline-block w-32 h-9 bg-gray-200 dark:bg-white/10 rounded animate-pulse" />
              ) : (
                formatCurrency(recoveredSoFar, currency)
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {totalPotential > 0
                ? `${Math.round(progressPercent)}% of potential`
                : isToday
                  ? "Awaiting today's data"
                  : "No data for the selected date"}
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-gray-100 dark:bg-white/10 rounded-full mb-5 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-700"
            style={{ width: progressWidth }}
          />
        </div>

        {/* Category Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {/* Hot Leads (count) */}
          <CategoryCard
            color="bg-indigo-600"
            hoverBorder="hover:border-indigo-200 dark:hover:border-indigo-500/30"
            label="Hot Leads"
            value={Number(categories.hotLeads || 0)}
            formatValue={(v) => v.toLocaleString("en-US")}
            unit={Number(categories.hotLeads || 0) === 1 ? "lead" : "leads"}
            sublabel="in hot-lead segments"
          />

          {/* Follow-ups (count) */}
          <CategoryCard
            color="bg-purple-500"
            hoverBorder="hover:border-purple-200 dark:hover:border-purple-500/30"
            label="Follow-ups"
            value={Number(categories.followUps || 0)}
            formatValue={(v) => v.toLocaleString("en-US")}
            unit={Number(categories.followUps || 0) === 1 ? "due" : "due"}
            sublabel="scheduled for this date"
          />

          {/* Package Renewals (currency) */}
          <CategoryCard
            color="bg-sky-500"
            hoverBorder="hover:border-sky-200 dark:hover:border-sky-500/30"
            label="Package Renewals"
            value={Number(categories.packageRenewals || 0)}
            formatValue={(v) => formatCurrency(v, currency)}
            unit=""
            sublabel={`${data.expiredPackagesCount || 0} package${(data.expiredPackagesCount || 0) === 1 ? "" : "s"} expired`}
          />

          {/* Slot Recovery (count) — open doctor slots from the calendar */}
          <CategoryCard
            color="bg-emerald-500"
            hoverBorder="hover:border-emerald-200 dark:hover:border-emerald-500/30"
            label="Slot Recovery"
            value={Number(categories.slotRecovery || 0)}
            formatValue={(v) => v.toLocaleString("en-US")}
            unit={Number(categories.slotRecovery || 0) === 1 ? "open slot" : "open slots"}
            sublabel="unbooked + unblocked doctor slots in the calendar"
          />
        </div>

        {/* Start Revenue Recovery Button */}
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => setIsDetailsOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Start Revenue Recovery
          </button>
          <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">
            <span className="font-bold text-indigo-600 dark:text-indigo-400">
              {Number(highValueActions || 0)}
            </span>{" "}
            high-value action{Number(highValueActions || 0) === 1 ? "" : "s"} identified
          </p>
        </div>
      </div>

      <RevenueOpportunityDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
        selectedDate={selectedDate}
        token={externalToken}
      />
    </div>
  );
}

function CategoryCard({ color, hoverBorder, label, value, formatValue, unit, sublabel }) {
  return (
    <div
      className={`bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 ${hoverBorder} transition-all duration-200`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2.5 h-2.5 rounded-full ${color} flex-shrink-0`} />
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">
          {label}
        </p>
      </div>
      <div className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
        {formatValue(value)}
      </div>
      {unit ? (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 font-medium">
          {unit}
        </p>
      ) : null}
      {sublabel ? (
        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{sublabel}</p>
      ) : null}
    </div>
  );
}

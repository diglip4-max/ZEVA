import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * Modal that explains WHERE the "Today's Revenue Opportunity" total is
 * coming from. It pulls a per-line breakdown from
 *   GET /api/agent/revenue-opportunity-details
 * and renders two sections:
 *   1. Today's Appointments (treatment, patient, status, time, price)
 *   2. Expired Packages  (patient, package, expired date, price)
 */
export default function RevenueOpportunityDetailsModal({ isOpen, onClose, selectedDate }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [activeTab, setActiveTab] = useState("appointments");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({
    scope: "clinic",
    scopeNote: "",
    date: null,
    isToday: true,
    appointments: [],
    expiredPackages: [],
    totals: {
      appointmentCount: 0,
      appointmentTotal: 0,
      paidAppointmentCount: 0,
      paidAppointmentRevenue: 0,
      expiredPackageCount: 0,
      expiredPackageTotal: 0,
      recoveredPackageCount: 0,
      recoveredPackageRevenue: 0,
      totalRecovered: 0,
      grandTotal: 0,
    },
  });

  const formatCurrency = useCallback(
    (value) => {
      const symbol = getCurrencySymbol(currency || "AED");
      const num = Number(value || 0);
      const formatted = num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return `${symbol} ${formatted}`;
    },
    [currency],
  );

  const formatTime = (rawDate, hhmm) => {
    if (!hhmm) return "—";
    return hhmm;
  };

  const formatDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const fetchDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const agentToken =
        typeof window !== "undefined"
          ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken")
          : null;
      const userToken =
        typeof window !== "undefined"
          ? localStorage.getItem("userToken") || sessionStorage.getItem("userToken")
          : null;
      const token = agentToken || userToken;

      if (!token) {
        setError("Not authenticated");
        setIsLoading(false);
        return;
      }

      const params = {};
      if (selectedDate) {
        params.date = selectedDate;
      }

      const res = await axios.get("/api/agent/revenue-opportunity-details", {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      if (res.data && res.data.success && res.data.data) {
        setData({
          scope: res.data.data.scope || "clinic",
          scopeNote: res.data.data.scopeNote || "",
          date: res.data.data.date || null,
          isToday: res.data.data.isToday !== false,
          appointments: res.data.data.appointments || [],
          expiredPackages: res.data.data.expiredPackages || [],
          totals: res.data.data.totals || {
            appointmentCount: 0,
            appointmentTotal: 0,
            paidAppointmentCount: 0,
            paidAppointmentRevenue: 0,
            expiredPackageCount: 0,
            expiredPackageTotal: 0,
            recoveredPackageCount: 0,
            recoveredPackageRevenue: 0,
            totalRecovered: 0,
            grandTotal: 0,
          },
        });
      } else {
        setError(res.data?.message || "Failed to load");
      }
    } catch (err) {
      // console.error("RevenueOpportunityDetailsModal fetch error:", err);
      setError(err?.response?.data?.message || err.message || "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setActiveTab("appointments");
      fetchDetails();
    }
  }, [isOpen, fetchDetails, selectedDate]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  const { appointments, expiredPackages, totals } = data;
  const isEmpty = useMemo(
    () => appointments.length === 0 && expiredPackages.length === 0,
    [appointments, expiredPackages],
  );

  if (!isOpen) return null;

  const statusStyle = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "cancelled" || s === "rejected" || s === "no show") {
      return "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400";
    }
    if (s === "completed" || s === "approved" || s === "discharge") {
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    }
    if (s === "waiting" || s === "arrived") {
      return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    }
    return "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400";
  };

  const billingStatusStyle = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "paid" || s === "recovered") {
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-500/30";
    }
    if (s === "pending") {
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30";
    }
    if (s === "expired" || s === "not billed") {
      return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300 ring-1 ring-red-200 dark:ring-red-500/30";
    }
    return "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300 ring-1 ring-gray-200 dark:ring-white/10";
  };

  const packageStatusStyle = (status) => {
    const s = String(status || "").toLowerCase();
    if (s === "full") return "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
    if (s === "partial") return "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
    if (s === "unpaid") return "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400";
    return "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300";
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] border border-gray-200 dark:border-white/10">
        {/* Header */}
        <div className="px-5 py-4 flex justify-between items-center bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
          <div>
            <h2 className="text-lg sm:text-xl font-bold">
              {data.isToday ? "Today's Revenue Recovery" : "Revenue Recovery"}
            </h2>
            <p className="text-white/80 text-xs sm:text-sm mt-0.5">
              {data.isToday
                ? "See exactly which patients & appointments make up today's opportunity"
                : "See which patients & appointments make up the opportunity for the selected date"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white/90 hover:bg-white/20 rounded-lg p-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

                {/* Scope Banner (visible when filtered by doctor) */}
        {data.scope === "doctor" && data.scopeNote ? (
          <div className="px-5 py-2.5 bg-indigo-50 dark:bg-indigo-500/10 border-b border-indigo-100 dark:border-indigo-500/20 flex items-center gap-2 text-indigo-700 dark:text-indigo-300 text-sm">
            <svg
              className="w-4 h-4 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="font-medium">{data.scopeNote}</span>
          </div>
        ) : null}

        {/* Summary Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 px-5 py-4 bg-gray-50 dark:bg-white/5 border-b border-gray-200 dark:border-white/10">
          <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Appointments
            </p>
            <p className="text-2xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-1">
              {formatCurrency(totals.appointmentTotal)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {totals.appointmentCount} appointment
              {totals.appointmentCount === 1 ? "" : "s"} booked
            </p>
            {totals.paidAppointmentCount > 0 ? (
              <p className="text-[11px] mt-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                {totals.paidAppointmentCount} paid · {formatCurrency(totals.paidAppointmentRevenue)}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Expired Packages
            </p>
            <p className="text-2xl font-extrabold text-sky-600 dark:text-sky-400 mt-1">
              {formatCurrency(totals.expiredPackageTotal)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {totals.expiredPackageCount} package
              {totals.expiredPackageCount === 1 ? "" : "s"} expired
            </p>
            {totals.recoveredPackageCount > 0 ? (
              <p className="text-[11px] mt-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                {totals.recoveredPackageCount} recovered · {formatCurrency(totals.recoveredPackageRevenue)}
              </p>
            ) : null}
          </div>
          <div className="rounded-xl bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 p-4">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Total Opportunity
            </p>
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
              {formatCurrency(totals.grandTotal)}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Today's recovery potential
            </p>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-500/10 dark:to-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 p-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider">
              Recovered So Far
            </p>
            <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-1">
              {formatCurrency(totals.totalRecovered)}
            </p>
            <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
              {totals.grandTotal > 0
                ? `${Math.min(100, Math.round((totals.totalRecovered / totals.grandTotal) * 100))}% of opportunity`
                : "0% of opportunity"}
            </p>
            <div className="mt-2 w-full h-1.5 rounded-full bg-emerald-200/60 dark:bg-emerald-500/20 overflow-hidden">
              <div
                className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-500"
                style={{
                  width: `${
                    totals.grandTotal > 0
                      ? Math.min(100, (totals.totalRecovered / totals.grandTotal) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-5 pt-4 border-b border-gray-200 dark:border-white/10">
          <div className="flex gap-2 -mb-px">
            <button
              onClick={() => setActiveTab("appointments")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "appointments"
                  ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Today's Appointments
              <span
                className={`ml-2 inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-xs font-bold rounded-full ${
                  activeTab === "appointments"
                    ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
                    : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                }`}
              >
                {totals.appointmentCount}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("packages")}
              className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === "packages"
                  ? "border-sky-600 text-sky-600 dark:text-sky-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Expired Packages
              <span
                className={`ml-2 inline-flex items-center justify-center min-w-[24px] h-5 px-1.5 text-xs font-bold rounded-full ${
                  activeTab === "packages"
                    ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
                    : "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300"
                }`}
              >
                {totals.expiredPackageCount}
              </span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-10 text-center text-gray-500 dark:text-gray-400">
              <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-3 text-sm">Loading today's opportunity…</p>
            </div>
          ) : error ? (
            <div className="p-10 text-center">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
              <button
                onClick={fetchDetails}
                className="mt-3 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Retry
              </button>
            </div>
          ) : isEmpty ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-gray-700 dark:text-gray-200 font-semibold">
                No revenue opportunity for today
              </p>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                All today's appointments are recovered and no packages are expired.
              </p>
            </div>
          ) : activeTab === "appointments" ? (
            <AppointmentsTable
              rows={appointments}
              formatCurrency={formatCurrency}
              formatTime={formatTime}
              formatDate={formatDate}
              statusStyle={statusStyle}
              billingStatusStyle={billingStatusStyle}
            />
          ) : (
            <ExpiredPackagesTable
              rows={expiredPackages}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
              packageStatusStyle={packageStatusStyle}
              billingStatusStyle={billingStatusStyle}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-white/10 flex justify-end bg-gray-50 dark:bg-white/5">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-gray-200 dark:bg-white/10 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function AppointmentsTable({ rows, formatCurrency, formatTime, formatDate, statusStyle, billingStatusStyle }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/5 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Time
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Patient
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Doctor
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Treatment
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Status
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Recovery
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Price
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {rows.map((r) => (
            <tr
              key={r.id}
              className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="font-semibold text-gray-900 dark:text-white">
                  {formatTime(r.date, r.fromTime)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(r.date)}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900 dark:text-white">
                  {r.patientName || "Unknown"}
                </div>
                {r.patientMobile ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {r.patientMobile}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-200 whitespace-nowrap">
                {r.doctorName || "—"}
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                {r.treatment || "—"}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${statusStyle(
                    r.status,
                  )}`}
                >
                  {r.status || "—"}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${billingStatusStyle(
                    r.billingStatus,
                  )}`}
                >
                  {r.billingStatus === "Paid" ? (
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : null}
                  {r.billingStatus || "—"}
                </span>
                {r.billingStatus === "Paid" && r.paidAmount > 0 ? (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                    Paid {formatCurrency(r.paidAmount)}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                {formatCurrency(r.price)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-white/5 border-t-2 border-gray-200 dark:border-white/10">
            <td
              colSpan={6}
              className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider"
            >
              Subtotal
            </td>
            <td className="px-4 py-3 text-right text-base font-extrabold text-indigo-600 dark:text-indigo-400 whitespace-nowrap">
              {formatCurrency(rows.reduce((s, r) => s + Number(r.price || 0), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ExpiredPackagesTable({ rows, formatCurrency, formatDate, packageStatusStyle, billingStatusStyle }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 dark:bg-white/5 sticky top-0">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Patient
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Package
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Expired On
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Recovery
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Payment
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 dark:text-gray-300 uppercase text-xs tracking-wider">
              Price
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-white/5">
          {rows.map((r) => (
            <tr
              key={r.id}
              className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
            >
              <td className="px-4 py-3">
                <div className="font-medium text-gray-900 dark:text-white">
                  {r.patientName || "Unknown"}
                </div>
                {r.patientMobile ? (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {r.patientMobile}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                {r.packageName}
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-700 dark:text-gray-200">
                {formatDate(r.endDate)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${billingStatusStyle(
                    r.billingStatus,
                  )}`}
                >
                  {r.billingStatus === "Recovered" ? (
                    <svg
                      className="w-3 h-3 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  ) : null}
                  {r.billingStatus || "—"}
                </span>
                {r.billingStatus === "Recovered" && r.recoveredAmount > 0 ? (
                  <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                    Recovered {formatCurrency(r.recoveredAmount)}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${packageStatusStyle(
                    r.paymentStatus,
                  )}`}
                >
                  {r.paymentStatus}
                </span>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                <div>{formatCurrency(r.totalPrice)}</div>
                {r.paidAmount > 0 ? (
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 font-normal mt-0.5">
                    Paid {formatCurrency(r.paidAmount)}
                  </div>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-50 dark:bg-white/5 border-t-2 border-gray-200 dark:border-white/10">
            <td
              colSpan={5}
              className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider"
            >
              Subtotal
            </td>
            <td className="px-4 py-3 text-right text-base font-extrabold text-sky-600 dark:text-sky-400 whitespace-nowrap">
              {formatCurrency(rows.reduce((s, r) => s + Number(r.totalPrice || 0), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

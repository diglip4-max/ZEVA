import React, { useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * Renewals card — shows packages expiring within the next 30 days.
 *
 * Data shape (from /api/agent/priorities → packageRenewals):
 *   {
 *     count: 5,
 *     totalRevenue: 3500,
 *     list: [
 *       {
 *         patientId: "...",
 *         patientName: "Hassan Ali",
 *         packageName: "Physiotherapy Package",
 *         totalSessions: 10,
 *         remainingSessions: 2,
 *         treatmentNames: ["Physiotherapy", "Massage"],
 *         endDate: "2026-09-15T00:00:00.000Z",
 *         totalPrice: 900,
 *         paidAmount: 900,
 *         paymentStatus: "Paid",
 *       },
 *       ...
 *     ]
 *   }
 */

// Initials avatar colors
const initialsColors = [
  "bg-indigo-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-purple-500",
];

function colorForName(name) {
  if (!name) return initialsColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return initialsColors[Math.abs(hash) % initialsColors.length];
}

function buildInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatExpiryDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getExpiryBadge(isoDate) {
  if (!isoDate) return { label: "Expired", bg: "bg-red-50 dark:bg-red-500/10", color: "text-red-700 dark:text-red-400" };
  const now = new Date();
  const expiry = new Date(isoDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Expired", bg: "bg-red-50 dark:bg-red-500/10", color: "text-red-700 dark:text-red-400" };
  }
  if (diffDays === 0) {
    return { label: "Expires today", bg: "bg-red-50 dark:bg-red-500/10", color: "text-red-700 dark:text-red-400" };
  }
  if (diffDays <= 3) {
    return { label: `Expires in ${diffDays}d`, bg: "bg-red-50 dark:bg-red-500/10", color: "text-red-700 dark:text-red-400" };
  }
  if (diffDays <= 7) {
    return { label: `Expires in ${diffDays}d`, bg: "bg-amber-50 dark:bg-amber-500/10", color: "text-amber-700 dark:text-amber-400" };
  }
  return { label: `Expires in ${diffDays}d`, bg: "bg-emerald-50 dark:bg-emerald-500/10", color: "text-emerald-700 dark:text-emerald-400" };
}

const INITIAL_VISIBLE = 3;

export default function Renewals({ renewalsData }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [showModal, setShowModal] = useState(false);
  const data = renewalsData || {};
  const list = Array.isArray(data.list) ? data.list : [];
  const count = data.count || list.length;

  const visibleList = list.slice(0, INITIAL_VISIBLE);
  const hasMore = list.length > INITIAL_VISIBLE;

  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm md:col-span-2 xl:col-span-1">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-3">
        RENEWALS
      </p>
      <div className="flex items-baseline gap-2 mb-6">
        <span className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {count}
        </span>
        <span className="text-lg font-medium text-gray-500 dark:text-gray-400">
          expiring soon
        </span>
      </div>

      <div className="space-y-4">
        {list.length > 0 ? (
          <>
            {visibleList.map((renewal, idx) => {
            const badge = getExpiryBadge(renewal.endDate);
            const initials = buildInitials(renewal.patientName);
            const treatmentsStr = Array.isArray(renewal.treatmentNames) && renewal.treatmentNames.length > 0
              ? renewal.treatmentNames.join(", ")
              : "";

            // Build the detail line: sessions + treatment + expiry date
            const sessionDetail = renewal.remainingSessions != null && renewal.totalSessions
              ? `${renewal.remainingSessions} / ${renewal.totalSessions} sessions left`
              : "";
            const expiryDate = formatExpiryDate(renewal.endDate);
            const detailParts = [
              sessionDetail,
              treatmentsStr,
              expiryDate ? `Expires: ${expiryDate}` : "",
            ].filter(Boolean);
            const detail = detailParts.join(" · ");

            return (
              <div
                key={renewal.patientId || idx}
                className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-full ${colorForName(renewal.patientName)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <span className="text-white font-bold text-sm">{initials}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-0.5">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                          {renewal.patientName}
                        </h4>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${badge.bg} ${badge.color} flex-shrink-0`}>
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {renewal.packageName}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 ml-[3.375rem]">
                  <p className="text-sm md:text-base font-medium text-gray-600 dark:text-gray-300">
                    {detail}
                  </p>
                  {/* <button className="inline-flex items-center justify-center px-5 py-2.5 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-sm flex-shrink-0">
                    Contact
                  </button> */}
                </div>
              </div>
            );
          })}

          {/* View All button to open modal */}
          {hasMore && (
            <button
              onClick={() => setShowModal(true)}
              className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/15 shadow-sm transition-all duration-200 text-base"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              View All ({list.length} packages)
            </button>
          )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No packages expiring soon.
            </p>
          </div>
        )}
      </div>

      {/* Modal showing all renewals */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100 dark:border-white/10">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">All Renewals</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {count} package{count === 1 ? "" : "s"} expiring soon
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="p-5 overflow-y-auto">
              <div className="space-y-4">
                {list.map((renewal, idx) => {
                  const badge = getExpiryBadge(renewal.endDate);
                  const initials = buildInitials(renewal.patientName);
                  const treatmentsStr = Array.isArray(renewal.treatmentNames) && renewal.treatmentNames.length > 0
                    ? renewal.treatmentNames.join(", ")
                    : "";
                  const sessionDetail = renewal.remainingSessions != null && renewal.totalSessions
                    ? `${renewal.remainingSessions} / ${renewal.totalSessions} sessions left`
                    : "";
                  const expiryDate = formatExpiryDate(renewal.endDate);
                  const detailParts = [
                    sessionDetail,
                    treatmentsStr,
                    expiryDate ? `Expires: ${expiryDate}` : "",
                  ].filter(Boolean);
                  const detail = detailParts.join(" · ");

                  return (
                    <div
                      key={renewal.patientId || idx}
                      className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-full ${colorForName(renewal.patientName)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                            <span className="text-white font-bold text-sm">{initials}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                                {renewal.patientName}
                              </h4>
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${badge.bg} ${badge.color} flex-shrink-0`}>
                                {badge.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                              {renewal.packageName}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-[3.375rem]">
                        <p className="text-sm md:text-base font-medium text-gray-600 dark:text-gray-300">
                          {detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 dark:border-white/10 text-right">
              <button
                onClick={() => setShowModal(false)}
                className="inline-flex items-center px-4 py-2 rounded-lg bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-800 dark:text-white text-sm font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

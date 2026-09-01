import React, { useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * Win Back Patients card.
 *
 * Data shape (from /api/agent/appointment-timeline → winBack):
 *   {
 *     stats: [
 *       { label: "30 days", count: 18 },
 *       { label: "60 days", count: 42 },
 *       { label: "90 days", count: 68 },
 *     ],
 *     patients: [
 *       {
 *         patientId: "...",
 *         patientName: "Sarah Ahmed",
 *         initials: "SA",
 *         daysSince: 84,
 *         lastVisit: "2026-05-25T00:00:00.000Z",
 *       },
 *       ...
 *     ]
 *   }
 *
 * Patients are bucketed by days since their last appointment (any status).
 */

// Color mapping for stat buckets
const statColors = [
  "text-amber-500 dark:text-amber-400",
  "text-orange-500 dark:text-orange-400",
  "text-red-500 dark:text-red-400",
];

// Initials avatar colors
const initialsColors = [
  "bg-red-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-indigo-500",
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

function formatLastVisit(isoDate) {
  if (!isoDate) return "";
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function WinBack({ winBackData }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const data = winBackData || {};
  const stats = Array.isArray(data.stats) ? data.stats : [];
  const patients = Array.isArray(data.patients) ? data.patients : [];
  const [showModal, setShowModal] = useState(false);

  const INITIAL_COUNT = 3;
  const visiblePatients = patients.slice(0, INITIAL_COUNT);
  const hasMore = patients.length > INITIAL_COUNT;

  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-2.5">
        WIN BACK PATIENTS
      </p>
      <p className="text-base text-gray-600 dark:text-gray-300 font-medium mb-5">
        Patients who may be ready to return
      </p>

      <div className="grid grid-cols-3 gap-2 mb-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="text-center">
            <p className={`text-2xl md:text-3xl font-extrabold ${statColors[idx] || statColors[0]} tracking-tight`}>
              {stat.count}
            </p>
            <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {visiblePatients.length > 0 ? (
          <>
            {visiblePatients.map((patient) => (
              <div
                key={patient.patientId}
                className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
              >
                <div className="flex items-start gap-3.5 mb-3">
                  <div className={`w-10 h-10 rounded-full ${colorForName(patient.patientName)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-white font-bold text-sm">{patient.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                      {patient.patientName}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                      Last visit {patient.daysSince} days ago · {formatLastVisit(patient.lastVisit)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 ml-[3.375rem]">
                </div>
              </div>
            ))}
            {hasMore && (
              <button
                onClick={() => setShowModal(true)}
                className="w-full py-2.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl transition-all duration-200"
              >
                View All ({patients.length})
              </button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No win-back patients found.
            </p>
          </div>
        )}
      </div>

      {/* Modal showing all win-back patients */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-gray-100 dark:border-white/10">
              <div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">All Win-Back Patients</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {patients.length} patient{patients.length === 1 ? "" : "s"} who may be ready to return
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
              <div className="space-y-3">
                {patients.map((patient) => (
                  <div
                    key={patient.patientId}
                    className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className={`w-10 h-10 rounded-full ${colorForName(patient.patientName)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <span className="text-white font-bold text-sm">{patient.initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                          {patient.patientName}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                          Last visit {patient.daysSince} days ago · {formatLastVisit(patient.lastVisit)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
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

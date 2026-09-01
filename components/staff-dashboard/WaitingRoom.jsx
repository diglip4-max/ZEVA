import React, { useState } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * Waiting Room card.
 *
 * Data shape (from /api/agent/appointment-timeline → waitingRoom):
 *   [
 *     {
 *       _id: "...",
 *       patientName: "Sarah Ahmed",
 *       initials: "SA",
 *       doctorName: "Dr. Mehta",
 *       department: "Dermatology",
 *       fromTime: "9:30 AM",
 *       waitMinutes: 12,
 *       waitLabel: "12 min wait",
 *     },
 *     ...
 *   ]
 *
 * Doctor login  → only that doctor's waiting appointments.
 * Agent login   → all waiting appointments across the clinic,
 *                 with doctor name shown on each row.
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

export default function WaitingRoom({ waitingRoom }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const patients = Array.isArray(waitingRoom) ? waitingRoom : [];
  const count = patients.length;
  const [showModal, setShowModal] = useState(false);
  const visiblePatients = patients.slice(0, 3);
  const hasMore = count > 3;

  return (
    <>
    <div className="lg:col-span-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-2.5">
            WAITING ROOM
          </p>
          <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {count} {count === 1 ? "patient" : "patients"} waiting
          </h3>
        </div>
        <div className="w-11 h-11 bg-blue-50 dark:bg-blue-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        {visiblePatients.length > 0 ? (
          visiblePatients.map((patient, idx) => {
            // Highlight patients who have been waiting longer than 10 minutes
            const isLongWait = patient.waitMinutes > 10;
            const isOnTime = patient.waitMinutes === 0;

            return (
              <div
                key={patient._id || idx}
                className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-150 ${
                  isLongWait
                    ? "bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200 dark:border-amber-500/30"
                    : "bg-gray-50 dark:bg-white/5 border-2 border-transparent"
                }`}
              >
                <div className={`w-11 h-11 rounded-full ${colorForName(patient.patientName)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <span className="text-white font-bold text-sm">{patient.initials}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                    {patient.patientName}
                  </h4>
                  <p className="text-base text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
                    {patient.doctorName}
                    {patient.department ? ` · ${patient.department}` : ""}
                  </p>
                </div>

                <div className={`inline-flex items-center gap-1.5 font-bold text-base flex-shrink-0 ${
                  isLongWait
                    ? "text-amber-600 dark:text-amber-400"
                    : isOnTime
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-600 dark:text-gray-300"
                }`}>
                  {isLongWait && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                  {patient.waitLabel}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No patients waiting right now.
            </p>
          </div>
        )}
      </div>

      {hasMore && (
        <button
          onClick={() => setShowModal(true)}
          className="w-full inline-flex items-center justify-center px-5 py-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/15 shadow-sm transition-all duration-200 text-base"
        >
          {`Manage Waiting Room (${count - 3} more)`}
        </button>
      )}
    </div>

    {/* Manage Waiting Room Modal */}
    {showModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={() => setShowModal(false)}
      >
        <div className="absolute inset-0 z-0 bg-gray-900/60 backdrop-blur-sm" />
        <div
          className="relative z-10 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="px-6 py-5 border-b border-gray-200 dark:border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
                Waiting Room
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                {count} {count === 1 ? "patient" : "patients"} currently waiting
              </p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-5 h-5 text-gray-600 dark:text-gray-300"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-3" style={{ scrollbarGutter: "stable" }}>
            {patients.map((patient, idx) => {
              const isLongWait = patient.waitMinutes > 10;
              const isOnTime = patient.waitMinutes === 0;

              return (
                <div
                  key={patient._id || idx}
                  className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-150 ${
                    isLongWait
                      ? "bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200 dark:border-amber-500/30"
                      : "bg-gray-50 dark:bg-white/5 border-2 border-transparent"
                  }`}
                >
                  <div className={`w-11 h-11 rounded-full ${colorForName(patient.patientName)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                    <span className="text-white font-bold text-sm">{patient.initials}</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                      {patient.patientName}
                    </h4>
                    <p className="text-base text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
                      {patient.doctorName}
                      {patient.department ? ` · ${patient.department}` : ""}
                    </p>
                  </div>

                  <div className={`inline-flex items-center gap-1.5 font-bold text-base flex-shrink-0 ${
                    isLongWait
                      ? "text-amber-600 dark:text-amber-400"
                      : isOnTime
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-600 dark:text-gray-300"
                  }`}>
                    {isLongWait && (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                    {patient.waitLabel}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5">
            <button
              onClick={() => setShowModal(false)}
              className="w-full inline-flex items-center justify-center px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white font-semibold rounded-xl shadow-sm transition-colors text-base"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

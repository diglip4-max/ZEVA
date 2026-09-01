import React from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * ZEVA RECOMMENDS card.
 *
 * Data shape (from /api/agent/zeva-recommends):
 *   {
 *     doctorName: "Dr. Mehta" | null,
 *     departmentName: "Dermatology" | null,
 *     topPatient: { name, initials, visitCount, percentage, totalVisits } | null,
 *     hasFollowUpToday: boolean,
 *     followUpLeads: [{ name: "Maria Joseph" }, ...],
 *   }
 *
 * Role-aware rendering:
 *   - Doctor login  → doctorName + departmentName are populated → show them.
 *   - Agent login   → both are null → hide the doctor line entirely.
 *
 * Row logic:
 *   Row 1 — top patient (highest visit count) + % share.
 *   Row 2 — "Follow-up due today" when hasFollowUpToday is true,
 *           otherwise "Requested an earlier appointment" as a
 *           generic nudge. Hidden entirely when there is no top
 *           patient (nothing to recommend against).
 */

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

function formatTime() {
  const now = new Date();
  let h = now.getHours();
  const m = String(now.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

export default function ZevaRecommends({ zevaRecommendation }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const {
    doctorName,
    departmentName,
    topPatient,
    hasFollowUpToday,
    followUpLeads,
  } = zevaRecommendation || {};

  const showDoctorLine = !!doctorName;
  const currentTime = formatTime();
  const leadsList = Array.isArray(followUpLeads) ? followUpLeads : [];

  return (
    <div className="lg:col-span-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm relative overflow-hidden">
      {/* Gradient accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-orange-400 via-amber-400 to-emerald-400" />

      {/* Header badge */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg
            className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z" />
          </svg>
        </div>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
          ZEVA RECOMMENDS
        </p>
      </div>

      {/* Doctor info — only visible when a doctor is logged in */}
      {showDoctorLine && (
        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mb-1">
          {doctorName}
          {departmentName ? ` · ${departmentName}` : ""}
          {" · "}
          {currentTime}
        </p>
      )}

      {/* Slot recommendation title */}
      <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-snug mb-6">
        {topPatient
          ? `Most visited patient · ${topPatient.visitCount} visit${topPatient.visitCount === 1 ? "" : "s"}`
          : "No visits yet"}
      </h3>

      {/* Patient rows */}
      <div className="space-y-5 mb-6">
        {/* Row 1 — Top patient by visit count */}
        {topPatient ? (
          <div className="flex items-start gap-3.5">
            <span className="text-base font-semibold text-gray-400 dark:text-gray-500 mt-2 w-5 flex-shrink-0">
              1.
            </span>
            <div
              className={`w-10 h-10 rounded-full ${colorForName(topPatient.name)} flex items-center justify-center flex-shrink-0 shadow-sm`}
            >
              <span className="text-white font-bold text-sm">
                {topPatient.initials}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                  {topPatient.name}
                </h4>
                <span className="px-2.5 py-1 rounded-lg text-sm font-bold bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  {topPatient.percentage}%
                </span>
              </div>
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
                {topPatient.percentage}% of all visits · most visited patient
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3.5 py-2">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center flex-shrink-0">
              <span className="text-gray-400 dark:text-gray-500 text-sm font-bold">
                —
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No visits recorded yet.
            </p>
          </div>
        )}

        {/* Row 2+ — Follow-up leads today (hidden when none) */}
        {topPatient && hasFollowUpToday && leadsList.length > 0
          ? leadsList.map((lead, idx) => (
              <div key={lead.name + idx} className="flex items-start gap-3.5">
                <span className="text-base font-semibold text-gray-400 dark:text-gray-500 mt-2 w-5 flex-shrink-0">
                  {idx + 2}.
                </span>
                <div
                  className={`w-10 h-10 rounded-full ${colorForName(lead.name)} flex items-center justify-center flex-shrink-0 shadow-sm`}
                >
                  <span className="text-white font-bold text-sm">
                    {(lead.name || "?")
                      .trim()
                      .split(/\s+/)
                      .map((w) => w[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                    {lead.name}
                  </h4>
                  <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
                    Follow-up due today
                  </p>
                </div>
              </div>
            ))
          : null}
      </div>

      {/* Action buttons */}
      {/* <div className="flex flex-wrap items-center gap-3">
        <button className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-base">
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          View Schedule
        </button>
        <button className="inline-flex items-center justify-center px-5 py-3 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-800 dark:text-white font-bold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-base">
          View Patients
        </button>
      </div> */}
    </div>
  );
}

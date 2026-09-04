import React from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * Appointment Timeline card.
 *
 * Data shape (from /api/agent/appointment-timeline):
 *   {
 *     statusCounts: [
 *       { status: "booked", count: 12, label: "Booked" },
 *       { status: "Arrived", count: 5, label: "Arrived" },
 *       ...
 *     ],
 *     total: 38,
 *     appointments: [
 *       {
 *         _id: "...",
 *         time: "09:30 AM",
 *         patientName: "Sarah Ahmed",
 *         initials: "SA",
 *         department: "Dermatology",
 *         doctorName: "Dr. Mehta",
 *         status: "booked",
 *         statusLabel: "Booked",
 *       },
 *       ...
 *     ]
 *   }
 *
 * Only statuses with count > 0 are shown in the stats row.
 */

// Color mapping for each appointment status
const statusColorMap = {
  booked: {
    bg: "bg-blue-100 dark:bg-blue-500/15",
    text: "text-blue-700 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  enquiry: {
    bg: "bg-gray-100 dark:bg-gray-500/15",
    text: "text-gray-700 dark:text-gray-400",
    dot: "bg-gray-500",
  },
  Discharge: {
    bg: "bg-teal-100 dark:bg-teal-500/15",
    text: "text-teal-700 dark:text-teal-400",
    dot: "bg-teal-500",
  },
  Arrived: {
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  Consultation: {
    bg: "bg-indigo-100 dark:bg-indigo-500/15",
    text: "text-indigo-700 dark:text-indigo-400",
    dot: "bg-indigo-500",
  },
  Cancelled: {
    bg: "bg-red-100 dark:bg-red-500/15",
    text: "text-red-700 dark:text-red-400",
    dot: "bg-red-500",
  },
  Approved: {
    bg: "bg-green-100 dark:bg-green-500/15",
    text: "text-green-700 dark:text-green-400",
    dot: "bg-green-500",
  },
  Rescheduled: {
    bg: "bg-orange-100 dark:bg-orange-500/15",
    text: "text-orange-700 dark:text-orange-400",
    dot: "bg-orange-500",
  },
  Waiting: {
    bg: "bg-amber-100 dark:bg-amber-500/15",
    text: "text-amber-700 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  Rejected: {
    bg: "bg-rose-100 dark:bg-rose-500/15",
    text: "text-rose-700 dark:text-rose-400",
    dot: "bg-rose-500",
  },
  Completed: {
    bg: "bg-emerald-100 dark:bg-emerald-500/15",
    text: "text-emerald-700 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  invoice: {
    bg: "bg-purple-100 dark:bg-purple-500/15",
    text: "text-purple-700 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  "No Show": {
    bg: "bg-gray-100 dark:bg-gray-500/15",
    text: "text-gray-700 dark:text-gray-400",
    dot: "bg-gray-500",
  },
};

// Color for stat counter text based on status
const statColorMap = {
  booked: "text-blue-600 dark:text-blue-400",
  enquiry: "text-gray-600 dark:text-gray-400",
  Discharge: "text-teal-600 dark:text-teal-400",
  Arrived: "text-emerald-600 dark:text-emerald-400",
  Consultation: "text-indigo-600 dark:text-indigo-400",
  Cancelled: "text-red-600 dark:text-red-400",
  Approved: "text-green-600 dark:text-green-400",
  Rescheduled: "text-orange-600 dark:text-orange-400",
  Waiting: "text-amber-600 dark:text-amber-400",
  Rejected: "text-rose-600 dark:text-rose-400",
  Completed: "text-emerald-600 dark:text-emerald-400",
  invoice: "text-purple-600 dark:text-purple-400",
  "No Show": "text-gray-600 dark:text-gray-400",
};

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

export default function AppointmentTimeline({ appointmentData, modulePermissions }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const { statusCounts = [], total = 0, appointments = [] } = appointmentData || {};

  const perms = modulePermissions || {};
  const appointmentActions = perms["clinic_Appointment"] || perms["Appointment"] || {};
  const canCreateAppointment = appointmentActions.create !== false;

  // Filter to only show statuses with count > 0
  const activeStatuses = statusCounts.filter((s) => s.count > 0);

  return (
    <div className="lg:col-span-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-orange-400 via-amber-400 to-emerald-400" />

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-2">
        <div>
          <p className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-2">
            TODAY'S APPOINTMENTS
          </p>
          <h3 className="text-lg md:text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Appointment Timeline
          </h3>
        </div>

        {canCreateAppointment && (
          <button className="inline-flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-sm flex-shrink-0 self-start">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Booking
          </button>
        )}
      </div>

      {/* Stats Counters — only show statuses with count > 0 */}
      {activeStatuses.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-6 mt-3">
          {/* Total */}
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-extrabold text-gray-900 dark:text-white">{total}</span>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Total</span>
          </div>
          {/* Dynamic status counts */}
          {activeStatuses.map((s) => (
            <div key={s.status} className="flex items-baseline gap-1.5">
              <span className={`text-lg font-extrabold ${statColorMap[s.status] || "text-gray-600 dark:text-gray-400"}`}>
                {s.count}
              </span>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline Scrollable List */}
      <div className="max-h-[400px] overflow-y-auto pr-1 -mr-1 space-y-1.5 custom-scrollbar">
        {appointments.length > 0 ? (
          appointments.map((apt, idx) => {
            const style = statusColorMap[apt.status] || {
              bg: "bg-gray-100 dark:bg-gray-500/15",
              text: "text-gray-700 dark:text-gray-400",
              dot: "bg-gray-500",
            };
            return (
              <div
                key={apt._id || idx}
                className={`flex items-center gap-4 p-3.5 md:p-4 rounded-xl transition-all duration-150 ${
                  idx % 2 === 0
                    ? "bg-gray-50 dark:bg-white/5"
                    : "hover:bg-gray-50 dark:hover:bg-white/5"
                }`}
              >
                <span className="text-sm font-bold text-gray-500 dark:text-gray-400 w-12 md:w-14 flex-shrink-0 tabular-nums">
                  {apt.time}
                </span>

                <div className={`w-8 h-8 md:w-9 md:h-9 rounded-full ${colorForName(apt.patientName)} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <span className="text-white font-bold text-xs">{apt.initials}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm md:text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                    {apt.patientName}
                  </h4>
                  <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
                    {apt.department}{apt.department && apt.doctorName ? " · " : ""}{apt.doctorName}
                  </p>
                </div>

                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl ${style.bg} flex-shrink-0`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                  <span className={`text-xs font-bold ${style.text}`}>
                    {apt.statusLabel}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No appointments scheduled for this day.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

import React from "react";

export default function AppointmentTimeline({
  appointmentStats,
  appointmentTimeline,
}) {
  return (
    <div className="lg:col-span-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-orange-400 via-amber-400 to-emerald-400" />

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-2">
        <div>
          <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-3">
            TODAY'S APPOINTMENTS
          </p>
          <h3 className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            Appointment Timeline
          </h3>
        </div>

        <button className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-base flex-shrink-0 self-start">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Booking
        </button>
      </div>

      {/* Stats Counters */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-6 mt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-gray-900 dark:text-white">{appointmentStats.total}</span>
          <span className="text-base font-medium text-gray-500 dark:text-gray-400">Total</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{appointmentStats.confirmed}</span>
          <span className="text-base font-medium text-gray-500 dark:text-gray-400">Confirmed</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">{appointmentStats.pending}</span>
          <span className="text-base font-medium text-gray-500 dark:text-gray-400">Pending</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-red-600 dark:text-red-400">{appointmentStats.cancelled}</span>
          <span className="text-base font-medium text-gray-500 dark:text-gray-400">Cancelled</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{appointmentStats.waiting}</span>
          <span className="text-base font-medium text-gray-500 dark:text-gray-400">Waiting</span>
        </div>
      </div>

      {/* Timeline Scrollable List */}
      <div className="max-h-[400px] overflow-y-auto pr-1 -mr-1 space-y-1.5 custom-scrollbar">
        {appointmentTimeline.map((apt, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-4 p-3.5 md:p-4 rounded-xl transition-all duration-150 ${
              apt.highlight
                ? "bg-gray-50 dark:bg-white/5"
                : "hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
          >
            <span className="text-base md:text-lg font-bold text-gray-500 dark:text-gray-400 w-14 md:w-16 flex-shrink-0 tabular-nums">
              {apt.time}
            </span>

            <div className={`w-10 h-10 md:w-11 md:h-11 rounded-full ${apt.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <span className="text-white font-bold text-sm">{apt.initials}</span>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-base md:text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                {apt.name}
              </h4>
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
                {apt.department} · {apt.doctor}
              </p>
            </div>

            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${apt.statusStyle.bg} flex-shrink-0`}>
              <span className={`w-2 h-2 rounded-full ${apt.statusStyle.dot}`} />
              <span className={`text-sm font-bold ${apt.statusStyle.text}`}>
                {apt.status}
              </span>
            </div>

            <button className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-all flex-shrink-0">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

import React from "react";

export default function WaitingRoom({ waitingRoomPatients }) {
  return (
    <div className="lg:col-span-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-2.5">
            WAITING ROOM
          </p>
          <h3 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
            {waitingRoomPatients.length} patients waiting
          </h3>
        </div>
        <div className="w-11 h-11 bg-blue-50 dark:bg-blue-500/15 rounded-2xl flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
      </div>

      <div className="space-y-3 mb-5">
        {waitingRoomPatients.map((patient) => (
          <div
            key={patient.id}
            className={`flex items-center gap-3.5 p-4 rounded-2xl transition-all duration-150 ${
              patient.highlight
                ? "bg-amber-50 dark:bg-amber-500/10 border-2 border-amber-200 dark:border-amber-500/30"
                : "bg-gray-50 dark:bg-white/5 border-2 border-transparent"
            }`}
          >
            <div className={`w-11 h-11 rounded-full ${patient.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <span className="text-white font-bold text-sm">{patient.initials}</span>
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                {patient.name}
              </h4>
              <p className="text-base text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                {patient.doctor}
              </p>
            </div>

            <div className={`inline-flex items-center gap-1.5 font-bold text-base ${patient.timeColor} flex-shrink-0`}>
              {patient.showClockIcon && (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
              {patient.waitTime}
            </div>
          </div>
        ))}
      </div>

      <button className="w-full inline-flex items-center justify-center px-5 py-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/15 shadow-sm transition-all duration-200 text-base">
        Manage Waiting Room
      </button>
    </div>
  );
}

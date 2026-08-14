import React from "react";

export default function WinBack({ winBackStats, winBackPatients }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-2.5">
        WIN BACK PATIENTS
      </p>
      <p className="text-base text-gray-600 dark:text-gray-300 font-medium mb-5">
        Patients who may be ready to return
      </p>

      <div className="grid grid-cols-4 gap-2 mb-6">
        {winBackStats.map((stat, idx) => (
          <div key={idx} className="text-center">
            <p className={`text-2xl md:text-3xl font-extrabold ${stat.color} tracking-tight`}>
              {stat.count}
            </p>
            <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mt-0.5">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {winBackPatients.map((patient) => (
          <div
            key={patient.id}
            className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
          >
            <div className="flex items-start gap-3.5 mb-3">
              <div className={`w-10 h-10 rounded-full ${patient.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <span className="text-white font-bold text-sm">{patient.initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                  {patient.name}
                </h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                  {patient.detail}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 ml-[3.375rem]">
              <button className={`text-sm font-bold ${patient.actionColor} hover:underline transition-all`}>
                {patient.action}
              </button>
              <button className="inline-flex items-center gap-1.5 px-4 py-2 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-gray-200 font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                WhatsApp
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

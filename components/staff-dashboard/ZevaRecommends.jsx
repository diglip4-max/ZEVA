import React from "react";

export default function ZevaRecommends({ zevaRecommendation }) {
  return (
    <div className="lg:col-span-1 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-400 via-orange-400 via-amber-400 to-emerald-400" />

      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-7 h-7 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6L12 2z" />
          </svg>
        </div>
        <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
          ZEVA RECOMMENDS
        </p>
      </div>

      <h3 className="text-lg md:text-xl font-bold text-gray-900 dark:text-white leading-snug mb-2">
        {zevaRecommendation.slot.title}
      </h3>
      <p className="text-base text-gray-500 dark:text-gray-400 font-medium mb-7">
        {zevaRecommendation.slot.doctor} · {zevaRecommendation.slot.department} · {zevaRecommendation.slot.time}
      </p>

      <div className="space-y-5 mb-6">
        {zevaRecommendation.patients.map((patient) => (
          <div key={patient.rank} className="flex items-start gap-3.5">
            <span className="text-base font-semibold text-gray-400 dark:text-gray-500 mt-2 w-5 flex-shrink-0">
              {patient.rank}.
            </span>
            <div className={`w-10 h-10 rounded-full ${patient.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <span className="text-white font-bold text-sm">{patient.initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                  {patient.name}
                </h4>
                {patient.percent !== null && (
                  <span className={`px-2.5 py-1 rounded-lg text-sm font-bold ${patient.percentBg} ${patient.percentColor} flex-shrink-0`}>
                    {patient.percent}%
                  </span>
                )}
              </div>
              <p className="text-sm md:text-base text-gray-500 dark:text-gray-400 font-medium mt-0.5 truncate">
                {patient.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-base text-gray-500 dark:text-gray-400 font-medium mb-5">
        ZEVA found {zevaRecommendation.foundCount} potential patients for this slot
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <button className="inline-flex items-center gap-2 px-5 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-base">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Fill This Slot
        </button>
        <button className="inline-flex items-center justify-center px-5 py-3 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-800 dark:text-white font-bold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-base">
          View {zevaRecommendation.foundCount} Patients
        </button>
      </div>
    </div>
  );
}

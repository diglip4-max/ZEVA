import React from "react";

export default function Renewals({ renewalsData }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm md:col-span-2 xl:col-span-1">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-3">
        RENEWALS
      </p>
      <div className="flex items-baseline gap-2 mb-6">
        <span className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          2
        </span>
        <span className="text-lg font-medium text-gray-500 dark:text-gray-400">
          expiring soon
        </span>
      </div>

      <div className="space-y-4">
        {renewalsData.map((renewal) => (
          <div
            key={renewal.id}
            className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 md:p-5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full ${renewal.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <span className="text-white font-bold text-sm">{renewal.initials}</span>
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight truncate">
                      {renewal.name}
                    </h4>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${renewal.expireBg} ${renewal.expireColor} flex-shrink-0`}>
                      {renewal.expireBadge}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {renewal.package}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 ml-[3.375rem]">
              <p className="text-sm md:text-base font-medium text-gray-600 dark:text-gray-300">
                {renewal.detail}
              </p>
              <button className="inline-flex items-center justify-center px-5 py-2.5 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-sm flex-shrink-0">
                Contact
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

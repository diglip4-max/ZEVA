import React from "react";

export default function RevenueRescue({ revenueRescueStats }) {
  return (
    <div className="bg-white dark:bg-white/5 border-2 border-red-100 dark:border-red-500/20 rounded-2xl p-6 md:p-7 shadow-sm relative overflow-hidden">
      <div className="absolute -right-20 -top-20 w-64 h-64 bg-red-50 dark:bg-red-500/5 rounded-full opacity-70 pointer-events-none" />

      <div className="relative">
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-7 h-7 bg-red-50 dark:bg-red-500/15 rounded-lg flex items-center justify-center flex-shrink-0 border border-red-200 dark:border-red-500/30">
            <div className="w-3 h-3 rounded-full border-2 border-red-500" />
          </div>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
            REVENUE RESCUE
          </p>
        </div>
        <p className="text-base text-gray-600 dark:text-gray-300 font-medium mb-6">
          Opportunities that could otherwise be lost
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4 mb-6">
          {revenueRescueStats.map((stat) => (
            <div
              key={stat.id}
              className={`${stat.bg} rounded-2xl p-4 md:p-5`}
            >
              <p className="text-sm md:text-base font-semibold text-gray-600 dark:text-gray-300 mb-1.5">
                {stat.title}
              </p>
              <p className={`text-xl md:text-2xl font-extrabold ${stat.amountColor}`}>
                {stat.amount}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              Total at risk
            </p>
            <p className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              AED 11,100
            </p>
          </div>
          <button className="inline-flex items-center gap-2 px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-base flex-shrink-0 self-start sm:self-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Recover Revenue
          </button>
        </div>
      </div>
    </div>
  );
}

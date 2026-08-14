import React from "react";

export default function TodayPerformance({ todayPerformance }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-6">
        TODAY'S PERFORMANCE
      </p>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {todayPerformance.map((stat) => (
          <div
            key={stat.id}
            className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl p-4 md:p-5"
          >
            <div className="mb-3 min-h-[2.75rem]">
              {stat.titleLines.map((line, lineIdx) => (
                <p
                  key={lineIdx}
                  className="text-xs md:text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.08em] leading-snug"
                >
                  {line}
                </p>
              ))}
            </div>

            <p className="text-2xl md:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-1.5 leading-tight">
              {stat.value}
            </p>

            {stat.subText && (
              <p className="text-xs md:text-sm font-medium text-gray-500 dark:text-gray-400 mb-3 leading-tight">
                {stat.subText}
              </p>
            )}
            {!stat.subText && <div className="mb-3" />}

            <div className="w-full h-1.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full ${stat.progressColor} rounded-full transition-all duration-700`}
                style={{ width: `${stat.progressPercent}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

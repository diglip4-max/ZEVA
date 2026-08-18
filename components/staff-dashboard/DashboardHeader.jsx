import React from "react";
import { Calendar, ChevronDown } from "lucide-react";

export default function DashboardHeader({
  userInfo,
  selectedDate,
  setSelectedDate,
  showCalendar,
  setShowCalendar,
  timePeriod,
  setTimePeriod,
}) {
  return (
    <div className="mb-6">
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">
            Good morning, {userInfo.name || "Sarah"}
          </h1>
          <p className="mt-2 text-lg text-gray-500 dark:text-gray-400 font-medium">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
          <p className="mt-1.5 text-lg text-gray-600 dark:text-gray-300">
            Here's where you can make the biggest impact today.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Date Filter */}
          <div className="relative">
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="inline-flex items-center gap-2 px-4 py-3 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-800 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-base"
            >
              <Calendar className="w-5 h-5 text-indigo-500" />
              {new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${showCalendar ? "rotate-180" : ""}`} />
            </button>

            {showCalendar && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCalendar(false)} />
                <div className="absolute right-0 top-full mt-2 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/15 rounded-xl shadow-xl p-3 min-w-[200px]">
                  <div className="flex flex-col gap-1.5 mb-3">
                    <button
                      onClick={() => { setSelectedDate(new Date().toISOString().split("T")[0]); setShowCalendar(false); }}
                      className="w-full text-left px-3 py-2 text-sm font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setSelectedDate(yesterday.toISOString().split("T")[0]);
                        setShowCalendar(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      Yesterday
                    </button>
                    <button
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setSelectedDate(tomorrow.toISOString().split("T")[0]);
                        setShowCalendar(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm font-semibold rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      Tomorrow
                    </button>
                  </div>
                  <div className="border-t border-gray-200 dark:border-white/10 pt-3">
                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Pick a date</label>
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => { setSelectedDate(e.target.value); setShowCalendar(false); }}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-white/15 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </>
            )}
          </div>

          <button className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl shadow-sm transition-all duration-200 hover:shadow-md text-base">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Booking
          </button>

          <button className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-800 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-base">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Lead
          </button>

          <div className="inline-flex bg-gray-100 dark:bg-white/10 rounded-xl p-1 border border-gray-200 dark:border-white/10">
            <button
              onClick={() => setTimePeriod("morning")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                timePeriod === "morning"
                  ? "bg-white dark:bg-white/20 text-indigo-600 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Morning
            </button>
            <button
              onClick={() => setTimePeriod("afternoon")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                timePeriod === "afternoon"
                  ? "bg-white dark:bg-white/20 text-indigo-600 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Afternoon
            </button>
            <button
              onClick={() => setTimePeriod("evening")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                timePeriod === "evening"
                  ? "bg-white dark:bg-white/20 text-indigo-600 dark:text-indigo-300 shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              Evening
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

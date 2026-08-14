import React from "react";

export default function InboxOpportunities({ inboxOpportunities }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-7 h-7 bg-green-50 dark:bg-emerald-500/15 rounded-lg flex items-center justify-center flex-shrink-0 border border-green-200 dark:border-emerald-500/30">
          <svg className="w-4 h-4 text-green-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
          INBOX OPPORTUNITIES
        </p>
      </div>
      <p className="text-base text-gray-600 dark:text-gray-300 font-medium mb-6">
        Conversations where patients appear ready to book
      </p>

      <div className="space-y-5">
        {inboxOpportunities.map((opp) => (
          <div
            key={opp.id}
            className="border border-gray-200 dark:border-white/10 rounded-2xl p-5 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`w-10 h-10 rounded-full ${opp.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <span className="text-white font-bold text-sm">{opp.initials}</span>
                </div>
                <div className="min-w-0">
                  <h4 className="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">
                    {opp.name}
                  </h4>
                  <p className="text-base text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                    {opp.department}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center px-3 py-1.5 bg-indigo-100 dark:bg-indigo-500/15 rounded-xl text-indigo-600 dark:text-indigo-400 text-sm font-bold flex-shrink-0">
                {opp.likelyPercent}% likely
              </span>
            </div>

            <div className="space-y-3 mb-4">
              <div className="inline-block max-w-[85%] px-4 py-3 bg-gray-100 dark:bg-white/10 rounded-2xl rounded-bl-sm">
                <p className="text-base font-medium text-gray-700 dark:text-gray-200">
                  {opp.patientMessage}
                </p>
              </div>

              {opp.ourResponse && (
                <div className="flex justify-end">
                  <div className="inline-block max-w-[85%] px-4 py-3 bg-indigo-600 rounded-2xl rounded-br-sm">
                    <p className="text-base font-semibold text-white">
                      {opp.ourResponse}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl p-4 mb-5">
              <div className="flex items-start gap-2">
                <span className="text-indigo-600 dark:text-indigo-400 font-bold text-base leading-none mt-0.5">✦</span>
                <div>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-[0.12em] mb-1">
                    SUGGESTION
                  </p>
                  <p className="text-base font-semibold text-indigo-900 dark:text-indigo-200">
                    {opp.suggestion}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-base">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Suggested Reply
              </button>
              <button className="inline-flex items-center justify-center px-5 py-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-base">
                View Patient
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

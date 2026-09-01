import React from "react";
import { useRouter } from "next/router";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

export default function HotLeads({ hotLeads, modulePermissions }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const router = useRouter();

  const perms = modulePermissions || {};
  const appointmentActions = perms["clinic_Appointment"] || perms["Appointment"] || {};
  const canCreateAppointment = appointmentActions.create !== false;

  // Navigate to conversation for this hot lead
  // const handleWhatsApp = (lead) => {
  //   if (lead.conversationId) {
  //     router.push(`/conversations?conversationId=${lead.conversationId}`);
  //   }
  // };

  // Navigate to appointment booking for this lead
  const handleBook = (lead) => {
    router.push(`/appointments?leadId=${lead.leadId}&action=book`);
  };

  return (
    <div className="lg:col-span-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-2.5">
            HOT LEADS
          </p>
          <h3 className="text-lg md:text-xl font-semibold text-gray-600 dark:text-gray-300">
            Patients most likely to book now
          </h3>
        </div>
        <span className="inline-flex items-center px-3 py-1.5 bg-indigo-100 dark:bg-indigo-500/15 rounded-xl text-indigo-600 dark:text-indigo-400 text-base font-bold flex-shrink-0">
          {hotLeads.length} active
        </span>
      </div>

      {hotLeads.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            No hot leads right now
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            Leads with high buying intent will appear here
          </p>
        </div>
      ) : (
        <div className="max-h-[600px] overflow-y-auto pr-1 -mr-1 space-y-4 custom-scrollbar">
          {hotLeads.map((lead) => (
            <div
              key={lead.id}
              className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 md:p-6 hover:border-gray-300 dark:hover:border-white/20 transition-all duration-200"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className={`w-11 h-11 rounded-full ${lead.initialsBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                  <span className="text-white font-bold text-sm">{lead.initials}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white leading-tight truncate">
                      {lead.name}
                    </h4>
                    {lead.waitTime && (
                      <span className={`inline-flex items-center px-3 py-1 rounded-lg ${lead.waitTimeBg} ${lead.waitTimeColor} text-sm font-bold flex-shrink-0`}>
                        {lead.waitTime}
                      </span>
                    )}
                  </div>
                  <p className="text-base text-gray-500 dark:text-gray-400 font-medium">
                    {lead.details}
                  </p>
                </div>
              </div>

              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex-1" />
                  <span className={`text-sm font-bold ${lead.progressTextColor}`}>
                    {lead.progressPercent}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${lead.progressBarColor} rounded-full transition-all duration-700`}
                    style={{ width: `${lead.progressPercent}%` }}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {/* <button
                  onClick={() => handleWhatsApp(lead)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-white/10 hover:bg-gray-50 dark:hover:bg-white/15 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/20 shadow-sm transition-all duration-200 text-base"
                >
                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  WhatsApp
                </button> */}
                {/* {canCreateAppointment && (
                  <button
                    onClick={() => handleBook(lead)}
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-sm hover:shadow-md transition-all duration-200 text-base"
                  >
                    Book
                  </button>
                )} */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

export default function FrontDeskStatus({ frontDeskStatus }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-6">
        FRONT DESK STATUS
      </p>

      <div className="space-y-5 mb-7">
        {frontDeskStatus.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-3 h-3 rounded-full ${row.dotColor} flex-shrink-0`} />
              <span className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {row.label}
              </span>
            </div>
            <span className={`text-lg font-bold ${row.valueColor} flex-shrink-0 text-right`}>
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 mb-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <div>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
              Ready for
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white leading-tight">
              Tomorrow
            </p>
          </div>
          <p className="text-3xl md:text-4xl font-extrabold text-indigo-600 dark:text-indigo-400 tracking-tight">
            94%
          </p>
        </div>
        <div className="w-full h-2.5 bg-gray-200 dark:bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 rounded-full transition-all duration-700"
            style={{ width: "94%" }}
          />
        </div>
      </div>

      <button className="w-full inline-flex items-center justify-center px-5 py-3.5 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 text-gray-700 dark:text-white font-semibold rounded-xl border border-gray-200 dark:border-white/15 shadow-sm transition-all duration-200 text-base">
        Complete Remaining
      </button>
    </div>
  );
}

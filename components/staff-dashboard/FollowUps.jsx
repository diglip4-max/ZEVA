import React from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * Follow-Ups card.
 *
 * Data shape (from /api/agent/appointment-timeline → followUps):
 *   {
 *     highIntent: { patientName: "Sarah Ahmed", count: 12 },
 *     revisitDue: 5,
 *   }
 *
 * Plus packageRenewalsCount from the priorities API (same as RevenueRescue).
 *
 * Categories:
 *   - High Intent: patient name with the highest appointment count
 *   - Package Renewal: same count as RevenueRescue's packageRenewals
 *   - Revisit Due: all booked status appointment count
 */

const CATEGORIES = [
  { key: "highIntent", icon: "fire", label: "High intent" },
  { key: "packageRenewal", icon: "package", label: "Package renewal" },
  { key: "revisitDue", icon: "revisit", label: "Revisit due" },
];

function getIcon(icon) {
  if (icon === "fire") {
    return (
      <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2s-5 5-5 10a5 5 0 0010 0c0-2-1-3-1-3s1 1 1 3a5 5 0 01-10 0c0-3 2-5 2-5s-1 3 3 3c0-3-1-5-0-8z" />
      </svg>
    );
  }
  if (icon === "package") {
    return (
      <svg className="w-5 h-5 text-amber-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    );
  }
  if (icon === "revisit") {
    return (
      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    );
  }
  return (
    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

export default function FollowUps({ followUpsData, packageRenewalsCount }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const data = followUpsData || {};
  const highIntent = data.highIntent || { patientName: null, count: 0 };
  const revisitDue = data.revisitDue || 0;

  // Build the categories with dynamic values
  const categories = [
    {
      key: "highIntent",
      icon: "fire",
      label: "High intent",
      count: highIntent.count,
    },
    {
      key: "packageRenewal",
      icon: "package",
      label: "Package renewal",
      count: packageRenewalsCount || 0,
    },
    {
      key: "revisitDue",
      icon: "revisit",
      label: "Revisit due",
      count: revisitDue,
    },
  ];

  // Total follow-ups due = sum of all counts
  const totalDue = categories.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-3">
        FOLLOW-UPS
      </p>
      <div className="flex items-baseline gap-2 mb-6">
        <span className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight">
          {totalDue}
        </span>
        <span className="text-lg font-medium text-gray-500 dark:text-gray-400">
          due today
        </span>
      </div>

      <div className="space-y-2 mb-7">
        {categories.map((cat) => (
          <div
            key={cat.key}
            className="flex items-center justify-between gap-3 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/5 transition-all duration-150"
          >
            <div className="flex items-center gap-3">
              {getIcon(cat.icon)}
              <span className="text-base md:text-lg font-semibold text-gray-800 dark:text-gray-200 truncate max-w-[180px]">
                {cat.label}
              </span>
            </div>
            <span className="text-xl md:text-2xl font-extrabold text-gray-900 dark:text-white tabular-nums">
              {cat.count}
            </span>
          </div>
        ))}
      </div>

      <button className="w-full inline-flex items-center justify-center gap-2 px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 text-base">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
        </svg>
        Start Follow-ups
      </button>
    </div>
  );
}

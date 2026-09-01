import React from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

/**
 * Today's Performance card.
 *
 * Data shape (from /api/agent/today-performance):
 *   {
 *     bookings: { booked: 31, totalSlots: 40, percent: 77.5 },
 *     revenue: { amount: 18420 },
 *     leadBooking: { count: 5, totalLeads: 20, percent: 25 },
 *   }
 *
 * Plus recovered data (from /api/agent/revenue-opportunity):
 *   {
 *     recoveredSoFar: 18420,
 *     recoveredCount: 12,
 *   }
 */

function formatCurrency(amount, currencySymbol = "AED") {
  if (amount == null || isNaN(amount)) return `${currencySymbol} 0`;
  return `${currencySymbol} ${amount.toLocaleString("en-US")}`;
}

export default function TodayPerformance({ performanceData, recoveredData }) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const data = performanceData || {};
  const bookings = data.bookings || { booked: 0, totalSlots: 0, percent: 0 };
  const revenue = data.revenue || { amount: 0 };
  const leadBooking = data.leadBooking || { count: 0, totalLeads: 0, percent: 0 };
  const recovered = recoveredData || { recoveredSoFar: 0, recoveredCount: 0, treatmentRevenue: 0, expiredPackageRevenue: 0 };

  const cards = [
    {
      id: 1,
      titleLines: ["BOOKINGS"],
      value: `${bookings.booked} / ${bookings.totalSlots}`,
      subText: null,
      progressPercent: bookings.percent,
      progressColor: "bg-indigo-600",
    },
    {
      id: 2,
      titleLines: ["REVENUE", "BOOKED"],
      value: formatCurrency(revenue.amount, currencySymbol),
      subText: null,
      progressPercent: Math.min(bookings.percent, 100),
      progressColor: "bg-emerald-500",
    },
    {
      id: 3,
      titleLines: ["LEAD →", "BOOKING"],
      value: `${leadBooking.count}`,
      subText: `${leadBooking.percent}% conversion`,
      progressPercent: Math.min(leadBooking.percent, 100),
      progressColor: "bg-purple-500",
    },
    {
      id: 4,
      titleLines: ["RECOVERED Rescued"],
      value: formatCurrency(recovered.recoveredSoFar, currencySymbol),
      subText: `from ${recovered.recoveredCount} opportunities`,
      progressPercent: Math.min(bookings.percent, 100),
      progressColor: "bg-sky-500",
    },
  ];

  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em] mb-6">
        TODAY'S PERFORMANCE
      </p>

      <div className="grid grid-cols-2 gap-3 md:gap-4">
        {cards.map((stat) => (
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

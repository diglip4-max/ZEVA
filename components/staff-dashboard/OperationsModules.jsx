import React from "react";
import { Layers } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";

const CARD_COLORS = [
  { bg: "bg-indigo-600", hover: "hover:border-indigo-400", light: "bg-indigo-50 dark:bg-indigo-500/15", text: "text-indigo-600 dark:text-indigo-400", border: "border-indigo-200 dark:border-indigo-500/30" },
  { bg: "bg-teal-600", hover: "hover:border-teal-400", light: "bg-teal-50 dark:bg-teal-500/15", text: "text-teal-600 dark:text-teal-400", border: "border-teal-200 dark:border-teal-500/30" },
  { bg: "bg-purple-600", hover: "hover:border-purple-400", light: "bg-purple-50 dark:bg-purple-500/15", text: "text-purple-600 dark:text-purple-400", border: "border-purple-200 dark:border-purple-500/30" },
  { bg: "bg-amber-600", hover: "hover:border-amber-400", light: "bg-amber-50 dark:bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-500/30" },
  { bg: "bg-rose-600", hover: "hover:border-rose-400", light: "bg-rose-50 dark:bg-rose-500/15", text: "text-rose-600 dark:text-rose-400", border: "border-rose-200 dark:border-rose-500/30" },
  { bg: "bg-sky-600", hover: "hover:border-sky-400", light: "bg-sky-50 dark:bg-sky-500/15", text: "text-sky-600 dark:text-sky-400", border: "border-sky-200 dark:border-sky-500/30" },
  { bg: "bg-emerald-600", hover: "hover:border-emerald-400", light: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", border: "border-emerald-200 dark:border-emerald-500/30" },
  { bg: "bg-pink-600", hover: "hover:border-pink-400", light: "bg-pink-50 dark:bg-pink-500/15", text: "text-pink-600 dark:text-pink-400", border: "border-pink-200 dark:border-pink-500/30" },
];

const renderIcon = (iconString) => {
  if (!iconString) return null;
  if (typeof iconString === "string" && iconString.length <= 2) {
    return <span className="text-xl">{iconString}</span>;
  }
  return <span className="text-lg">{iconString}</span>;
};

export default function OperationsModules({
  isLoading,
  navigationItems,
  router,
}) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");

  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div className="w-7 h-7 bg-cyan-50 dark:bg-cyan-500/15 rounded-lg flex items-center justify-center flex-shrink-0 border border-cyan-200 dark:border-cyan-500/30">
          <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
        </div>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
          MODULES & OPERATIONS
        </p>
      </div>
      <p className="text-base text-gray-600 dark:text-gray-300 font-medium mb-6">
        Quick access to your clinic management modules
      </p>

      {isLoading ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-gray-300 dark:border-gray-600 border-t-cyan-500 rounded-full animate-spin" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            Loading modules...
          </p>
        </div>
      ) : navigationItems.length === 0 ? (
        <div className="text-center py-10">
          <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center">
            <Layers className="w-6 h-6 text-gray-400 dark:text-gray-500" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
            No modules available
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            You don't have permissions to view any dashboard modules yet
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {navigationItems.map((item, index) => {
            const color = CARD_COLORS[index % CARD_COLORS.length];
            const hasPath = !!item.path;
            const subCount = item.subModules?.length || 0;

            return (
              <div
                key={item.moduleKey || index}
                onClick={() => hasPath && router.push(item.path)}
                className={`
                  group relative rounded-2xl border p-5
                  flex flex-col justify-between min-h-[140px]
                  transition-all duration-200
                  ${hasPath
                    ? `cursor-pointer ${color.hover} hover:shadow-md hover:scale-[1.02]`
                    : "opacity-50 cursor-not-allowed border-gray-200 dark:border-white/10"
                  }
                  ${hasPath ? "border-gray-200 dark:border-white/10" : ""}
                `}
              >
                {/* Top row: Icon + submodule count */}
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-11 h-11 rounded-xl ${color.light} ${color.border} border flex items-center justify-center flex-shrink-0`}>
                    {renderIcon(item.icon)}
                  </div>
                  {subCount > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 ${color.light} ${color.text} text-xs font-bold rounded-lg border ${color.border}`}>
                      {subCount}
                    </span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 flex flex-col justify-end">
                  <h3 className="text-base font-bold text-gray-900 dark:text-white leading-tight mb-1">
                    {item.label}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                    {item.description}
                  </p>
                </div>

                {/* Hover arrow indicator */}
                {hasPath && (
                  <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-1 group-hover:translate-x-0">
                    <div className={`w-7 h-7 rounded-lg ${color.light} ${color.border} border flex items-center justify-center`}>
                      <svg className={`w-4 h-4 ${color.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import React from "react";
import { Calendar, TrendingUp, User as UserIcon } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useClinicTheme } from "@/context/ClinicThemeContext";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  AreaChart,
  Area,
} from "recharts";

export default function CommissionsSummary({
  chartView,
  setChartView,
  totalCommission,
  thisMonthCommission,
  commissions,
  monthlyData,
  dateWiseData,
  mounted,
}) {
  const { currency } = useCurrency();
  const { theme } = useClinicTheme();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 md:p-7 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-teal-50 dark:bg-teal-500/15 rounded-lg flex items-center justify-center flex-shrink-0 border border-teal-200 dark:border-teal-500/30">
            <span className="text-teal-600 dark:text-teal-400 font-bold text-sm">
              {getCurrencySymbol(currency)}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.15em]">
            COMMISSIONS SUMMARY
          </p>
        </div>
        <div className="flex bg-gray-100 dark:bg-white/10 p-0.5 rounded-xl border border-gray-200 dark:border-white/15">
          <button
            onClick={() => setChartView("month")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
              chartView === "month"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Month-wise
          </button>
          <button
            onClick={() => setChartView("date")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-200 ${
              chartView === "date"
                ? "bg-teal-600 text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Date-wise
          </button>
        </div>
      </div>
      <p className="text-base text-gray-600 dark:text-gray-300 font-medium mb-6">
        Track your earnings and commission milestones
      </p>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="border border-gray-200 dark:border-white/10 rounded-2xl p-5 hover:border-teal-300 dark:hover:border-teal-500/30 transition-all duration-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full bg-teal-600 flex-shrink-0" />
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">
              Total Commissions
            </p>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {currencySymbol} {Number(totalCommission || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">All-time earnings</p>
        </div>

        <div className="border border-gray-200 dark:border-white/10 rounded-2xl p-5 hover:border-cyan-300 dark:hover:border-cyan-500/30 transition-all duration-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full bg-cyan-500 flex-shrink-0" />
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">
              This Month
            </p>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {currencySymbol} {Number(thisMonthCommission || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Current month earnings</p>
        </div>

        <div className="border border-gray-200 dark:border-white/10 rounded-2xl p-5 hover:border-indigo-300 dark:hover:border-indigo-500/30 transition-all duration-200">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-3 h-3 rounded-full bg-indigo-500 flex-shrink-0" />
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.1em]">
              Milestones
            </p>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
            {commissions.length}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Commissions achieved</p>
        </div>
      </div>

      {/* Chart */}
      <div className="border border-gray-200 dark:border-white/10 rounded-2xl p-5 mb-6">
        {mounted ? (
          <ResponsiveContainer width="100%" height={260}>
            {chartView === "month" ? (
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.15)" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "13px",
                  }}
                  formatter={(value) => [`${currencySymbol} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Commission"]}
                />
                <Bar dataKey="amount" fill="#14b8a6" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={dateWiseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#14b8a6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.15)" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "12px",
                    color: "#fff",
                    fontSize: "13px",
                  }}
                  formatter={(value) => [`${currencySymbol} ${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2 })}`, "Commission"]}
                />
                <Area type="monotone" dataKey="amount" stroke="#14b8a6" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={2} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-[260px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading Analytics Graph...
          </div>
        )}
      </div>

      {/* Individual Commissions Cards */}
      <div>
        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-[0.12em] mb-4">
          Recent Commission Milestones
        </p>
        {commissions.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-gray-400 dark:text-gray-500" />
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
              No commissions approved yet
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Your milestones will appear here
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {commissions.map((item) => (
              <div
                key={item.commissionId}
                className="border border-gray-200 dark:border-white/10 rounded-2xl p-5 hover:border-teal-300 dark:hover:border-teal-500/30 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-teal-100 dark:bg-teal-500/15 flex items-center justify-center flex-shrink-0 shadow-sm">
                      <UserIcon className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
                        {item.patientName || "—"}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                        Invoice: <span className="font-mono text-gray-700 dark:text-gray-300">{item.invoiceNumber || "—"}</span>
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-3 py-1.5 bg-teal-100 dark:bg-teal-500/15 rounded-xl text-teal-600 dark:text-teal-400 text-sm font-bold flex-shrink-0">
                    {currencySymbol} {Number(item.commissionAmount || 0).toFixed(2)}
                  </span>
                </div>

                <div className="bg-teal-50 dark:bg-teal-500/10 rounded-2xl p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <div className="text-gray-600 dark:text-gray-300">
                      Paid: <span className="font-bold text-gray-900 dark:text-white">{currencySymbol} {Number(item.paidAmount || 0).toFixed(2)}</span>
                      <span className="ml-1.5 text-teal-600 dark:text-teal-400 font-semibold">({item.commissionPercent}%)</span>
                    </div>
                    {item.doctorName && (
                      <div className="text-gray-600 dark:text-gray-300">
                        Doctor: <span className="font-semibold text-gray-900 dark:text-white">{item.doctorName}</span>
                      </div>
                    )}
                  </div>
                  {item.invoicedDate && (
                    <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
                      {new Date(item.invoicedDate).toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

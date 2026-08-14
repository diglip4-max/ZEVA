import React from "react";
import { Calendar, TrendingUp, User as UserIcon } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currencyHelper";
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
  currency,
  chartView,
  setChartView,
  totalCommission,
  thisMonthCommission,
  commissions,
  monthlyData,
  dateWiseData,
  mounted,
}) {
  return (
    <div className="mb-6 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl p-4 shadow-sm backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span className="w-5 h-5 flex items-center justify-center font-bold text-teal-600 dark:text-teal-400 text-lg">
            {getCurrencySymbol(currency)}
          </span>
          Commissions Summary
        </h2>
        <div className="flex bg-gray-100 dark:bg-white/10 p-0.5 rounded-lg border border-gray-200 dark:border-white/15">
          <button
            onClick={() => setChartView("month")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              chartView === "month"
                ? "bg-teal-600 text-white shadow"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Month-wise
          </button>
          <button
            onClick={() => setChartView("date")}
            className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
              chartView === "date"
                ? "bg-teal-600 text-white shadow"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            Date-wise
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-teal-500/10 rounded-lg text-teal-600 dark:text-teal-400 font-bold text-lg w-11 h-11 flex items-center justify-center">
            {getCurrencySymbol(currency)}
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Total Commissions</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {getCurrencySymbol(currency)} {Number(totalCommission || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-cyan-500/10 rounded-lg text-cyan-600 dark:text-cyan-400">
            <Calendar className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">This Month</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {getCurrencySymbol(currency)} {Number(thisMonthCommission || 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3.5 flex items-center gap-3.5 shadow-sm">
          <div className="p-2.5 bg-indigo-500/10 rounded-lg text-indigo-600 dark:text-indigo-400">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">Milestones Reached</div>
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {commissions.length}
            </div>
          </div>
        </div>
      </div>

      {/* Recharts Graph */}
      <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3 mb-5 shadow-inner">
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
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(value) => [`${getCurrencySymbol(currency)} ${value}`, "Commission"]}
                />
                <Bar dataKey="amount" fill="#14b8a6" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <AreaChart data={dateWiseData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2D9AA5" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#2D9AA5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(107, 114, 128, 0.15)" />
                <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                <YAxis stroke="#6b7280" fontSize={11} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(17, 24, 39, 0.95)",
                    borderColor: "rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    color: "#fff",
                  }}
                  formatter={(value) => [`${getCurrencySymbol(currency)} ${value}`, "Commission"]}
                />
                <Area type="monotone" dataKey="amount" stroke="#2D9AA5" fillOpacity={1} fill="url(#colorAmt)" strokeWidth={2} />
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
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider">
          Recent Commission Milestones
        </h3>
        {commissions.length === 0 ? (
          <div className="text-center py-6 text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg">
            No commissions approved yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {commissions.map((item) => (
              <div
                key={item.commissionId}
                className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg p-3 flex flex-col justify-between hover:border-teal-500/30 transition-all duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                      <UserIcon className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                      {item.patientName || "—"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Invoice: <span className="font-mono text-gray-700 dark:text-gray-300">{item.invoiceNumber || "—"}</span>
                    </div>
                  </div>
                  <div className="bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-xs font-bold">
                    {getCurrencySymbol(currency)} {Number(item.commissionAmount || 0).toFixed(2)}
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-gray-200 dark:border-white/5 flex flex-wrap items-center justify-between text-[11px] text-gray-600 dark:text-gray-400 gap-2">
                  <div>
                    Paid: <span className="font-semibold text-gray-800 dark:text-gray-200">{getCurrencySymbol(currency)} {Number(item.paidAmount || 0).toFixed(2)}</span> ({item.commissionPercent}%)
                  </div>
                  {item.doctorName && (
                    <div>
                      Doctor: <span className="text-gray-800 dark:text-gray-300 font-medium">{item.doctorName}</span>
                    </div>
                  )}
                  {item.invoicedDate && (
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">
                      {new Date(item.invoicedDate).toLocaleDateString()}
                    </div>
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

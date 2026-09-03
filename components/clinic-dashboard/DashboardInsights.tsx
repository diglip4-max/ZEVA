import React from 'react';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

const DashboardInsights = ({ priorityData, winBackData, tomorrowBusinessData }: any) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const formatCurrencyK = (amount: number) => {
    if (amount >= 1000) {
      return `${currencySymbol} ${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  const reactivateCount = winBackData?.stats?.find((s: any) => s.label === "30 days")?.count || 0;
  const openSlotsCount = priorityData?.openSlots?.count || 0;
  const renewPackagesCount = priorityData?.packageRenewalsWeek?.count || 0;
  const warmLeadsCount = priorityData?.hotLeads?.count || 0;

  // Tomorrow's Business data
  const totalAppointments = tomorrowBusinessData?.totalAppointments || 0;
  const bookedCount = tomorrowBusinessData?.bookedCount || 0;
  const cancelledCount = tomorrowBusinessData?.cancelledCount || 0;
  const expectedRevenue = tomorrowBusinessData?.expectedRevenue || 0;
  const revenueAtRisk = tomorrowBusinessData?.revenueAtRisk || 0;
  const potentialOpportunity = tomorrowBusinessData?.potentialOpportunity || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-8 mt-8 font-sans">
      {/* Signature Insight Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-2">Signature Insight</h3>
          {/* <h2 className="text-xl font-bold text-gray-900 mb-6">Where is my next AED 10K?</h2> */}

          <div className="flex flex-col gap-5 mb-8">
            {/* Item 1 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Reactivate patients</h4>
                  <p className="text-xs text-gray-500">30-day win-back patients</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{reactivateCount}</span>
            </div>

            {/* Item 2 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Fill unused capacity</h4>
                  <p className="text-xs text-gray-500">Unfilled appointment slots</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{openSlotsCount}</span>
            </div>

            {/* Item 3 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Renew packages</h4>
                  <p className="text-xs text-gray-500">Package Expiry This Week</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{renewPackagesCount}</span>
            </div>

            {/* Item 4 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900"> Hot leads need follow-up</h4>
                  <p className="text-xs text-gray-500">Hot leads needing follow-up</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{warmLeadsCount}</span>
            </div>
          </div>
        </div>

        <div>
          {/* Progress Bar */}
          <div className="flex h-2 w-full rounded-full overflow-hidden mb-6">
            <div className="bg-[#427A5B]" style={{ width: '32%' }}></div>
            <div className="bg-[#D4A373]" style={{ width: '27%' }}></div>
            <div className="bg-[#5C7C99]" style={{ width: '24%' }}></div>
            <div className="bg-[#A3A3A3]" style={{ width: '17%' }}></div>
          </div>

          {/* <div className="flex items-end justify-between mb-6">
            <span className="text-sm font-medium text-gray-500">Total identified</span>
            <span className="text-2xl font-bold text-amber-700">AED 10,100</span>
          </div> */}

          <button className="w-full bg-[#3B7B5F] hover:bg-[#326950] text-white font-semibold py-3 rounded-xl transition-colors">
            growth plan
          </button>
        </div>
      </div>

      {/* Forward-Looking Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Forward-Looking</h3>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Tomorrow's Business</h2>

          <div className="grid grid-cols-3 gap-4 mb-8 pb-8 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Expected</p>
              <p className="text-2xl font-bold text-gray-900">{totalAppointments}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Confirmed</p>
              <p className="text-2xl font-bold text-emerald-600">{bookedCount}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cancelled</p>
              <p className="text-2xl font-bold text-red-600">{cancelledCount}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Expected revenue</span>
                <span className="text-[9px] font-bold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 uppercase tracking-wider">Projected</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{formatCurrencyK(expectedRevenue)}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-600">Revenue at risk</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(revenueAtRisk)}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-600">Unused prime-time slots</span>
              <span className="text-sm font-bold text-gray-900">{openSlotsCount}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-600">Potential opportunity</span>
              <span className="text-sm font-bold text-amber-700">{formatCurrency(potentialOpportunity)}</span>
            </div>
          </div>
        </div>

        <button className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-colors mt-6">
          Prepare tomorrow
        </button>
      </div>
    </div>
  );
};

export default DashboardInsights;

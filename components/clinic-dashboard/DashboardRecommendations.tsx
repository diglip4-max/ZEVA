import React from 'react';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface Props {
  businessIntelligenceData?: {
    noShowCount: number;
    noShowsChange: number;
    existingServiceCount: number;
    averageBill: number;
    [key: string]: any;
  };
  recommendationData?: {
    eveningServiceName: string | null;
    eveningServicePrice: number;
    eveningBookingCount: number;
    highValuePatientCount: number;
    highValuePatientRevenue: number;
  };
}

const DashboardRecommendations = ({ businessIntelligenceData, recommendationData }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");

  const noShowCount = businessIntelligenceData?.noShowCount || 0;
  const noShowsChange = businessIntelligenceData?.noShowsChange || 0;
  const totalAppointments = businessIntelligenceData?.existingServiceCount || 0;
  const averageBill = businessIntelligenceData?.averageBill || 0;

  const eveningServiceName = recommendationData?.eveningServiceName || null;
  const eveningServicePrice = recommendationData?.eveningServicePrice || 0;
  const eveningBookingCount = recommendationData?.eveningBookingCount || 0;
  const highValuePatientCount = recommendationData?.highValuePatientCount || 0;
  const highValuePatientRevenue = recommendationData?.highValuePatientRevenue || 0;

  // Calculate no-show rate
  const noShowRate = totalAppointments > 0 ? Math.round((noShowCount / totalAppointments) * 100) : 0;

  // Calculate recoverable revenue (no-show count * average bill)
  const recoverableRevenue = noShowCount * averageBill;

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  // Dynamic text based on no-show change
  const noShowChangeAbs = Math.abs(noShowsChange);
  const noShowDirection = noShowsChange >= 0 ? 'above' : 'below';
  return (
    <div className="mx-8 mt-8 mb-12 font-sans">
      <h3 className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-4">Zeva Recommends</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recommendation 1 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-[3px] border-l-[#D4A373] flex flex-col justify-between min-h-[160px]">
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">
              {eveningServiceName ? `Increase evening ${eveningServiceName} availability` : 'Increase evening service availability'}
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              {eveningBookingCount > 0
                ? `${eveningBookingCount} bookings in 5-8 PM slot — highest evening demand.`
                : 'Demand is high in the 5-8 PM window.'}
            </p>
          </div>
          <div className="mt-4">
            <div className="mb-2">
              <span className="block text-lg font-bold text-amber-700">{formatCurrency(eveningServicePrice)}</span>
              <span className="block text-xs font-semibold text-amber-700">opportunity</span>
            </div>
            {/* <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors">
              Review
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button> */}
          </div>
        </div>

        {/* Recommendation 2 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-[3px] border-l-[#D4A373] flex flex-col justify-between min-h-[160px]">
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">
              Reactivate {highValuePatientCount > 0 ? highValuePatientCount : 0} high-value patients
            </h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              {highValuePatientCount > 0
                ? `Total revenue captured from ${highValuePatientCount} repeat patients.`
                : 'No repeat patients identified yet.'}
            </p>
          </div>
          <div className="mt-4">
            <div className="mb-2">
              <span className="block text-lg font-bold text-amber-700">{formatCurrency(highValuePatientRevenue)}</span>
              <span className="block text-xs font-semibold text-amber-700">value</span>
            </div>
            {/* <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors">
              Start campaign
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button> */}
          </div>
        </div>

        {/* Recommendation 3 — Reduce appointment no-shows */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 border-l-[3px] border-l-[#D4A373] flex flex-col justify-between min-h-[160px]">
          <div>
            <h4 className="text-sm font-bold text-gray-900 mb-2">Reduce appointment no-shows</h4>
            <p className="text-xs text-gray-500 leading-relaxed">
              No-show rate is <span className="font-bold text-gray-700">{noShowRate}%</span> ({noShowCount} of {totalAppointments} appointments) — {noShowChangeAbs}% {noShowDirection} baseline.
            </p>
          </div>
          <div className="mt-4">
            <div className="mb-2">
              <span className="block text-lg font-bold text-amber-700">{formatCurrency(recoverableRevenue)}</span>
              <span className="block text-xs font-semibold text-amber-700">recoverable</span>
            </div>
            {/* <button className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors">
              Activate automation
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardRecommendations;

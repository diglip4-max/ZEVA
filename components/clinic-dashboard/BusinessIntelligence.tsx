import React, { useState } from 'react';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface Props {
  businessIntelligenceData?: {
    newPatientCount: number;
    returningPatientCount: number;
    totalPatientCount: number;
    newPatientRevenue: number;
    returningPatientRevenue: number;
    expiringPackageCount: number;
    expiringPackageRevenue: number;
    referralCount: number;
    referralRevenue: number;
    existingServiceCount: number;
    existingServiceRevenue: number;
    totalRevenue: number;
    completedVisitCount: number;
    completedVisitsChange: number;
    averageBill: number;
    averageBillChange: number;
    noShowCount: number;
    noShowsChange: number;
    packageSalesCount: number;
    packageSalesChange: number;
    returningPatientsChange: number;
  };
  revenueData?: {
    totalRevenue: number;
    cashCollection: number;
  };
}

const BusinessIntelligence = ({ businessIntelligenceData, revenueData }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [activeTab, setActiveTab] = useState<'revenue' | 'visits'>('revenue');
  const [isVisitsModalOpen, setVisitsModalOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const formatCurrencyK = (amount: number) => {
    if (amount >= 1000) {
      return `${currencySymbol} ${((amount || 0) / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  const newPatientRevenue = businessIntelligenceData?.newPatientRevenue || 0;
  const returningPatientRevenue = businessIntelligenceData?.returningPatientRevenue || 0;
  const expiringPackageRevenue = businessIntelligenceData?.expiringPackageRevenue || 0;
  const referralRevenue = businessIntelligenceData?.referralRevenue || 0;
  const existingServiceRevenue = businessIntelligenceData?.existingServiceRevenue || 0;
  const totalRevenue = businessIntelligenceData?.totalRevenue || revenueData?.totalRevenue || 0;

  const newPatientCount = businessIntelligenceData?.newPatientCount || 0;
  const returningPatientCount = businessIntelligenceData?.returningPatientCount || 0;
  const expiringPackageCount = businessIntelligenceData?.expiringPackageCount || 0;
  const referralCount = businessIntelligenceData?.referralCount || 0;
  const existingServiceCount = businessIntelligenceData?.existingServiceCount || 0;

  // Why Revenue Changed data
  const completedVisitCount = businessIntelligenceData?.completedVisitCount || 0;
  const completedVisitsChange = businessIntelligenceData?.completedVisitsChange || 0;
  const averageBill = businessIntelligenceData?.averageBill || 0;
  const averageBillChange = businessIntelligenceData?.averageBillChange || 0;
  const noShowCount = businessIntelligenceData?.noShowCount || 0;
  const noShowsChange = businessIntelligenceData?.noShowsChange || 0;
  const packageSalesCount = businessIntelligenceData?.packageSalesCount || 0;
  const packageSalesChange = businessIntelligenceData?.packageSalesChange || 0;
  const returningPatientsChange = businessIntelligenceData?.returningPatientsChange || 0;

  // Format change indicator
  const formatChange = (change: number, inverseGood?: boolean) => {
    const absChange = Math.abs(change);
    const isPositive = change >= 0;
    const arrow = isPositive ? '↑' : '↓';
    // For no-shows and returning(cancelled) patients, increase is bad
    const isGood = inverseGood ? !isPositive : isPositive;
    const color = isGood ? 'text-[#427A5B]' : 'text-red-600';
    return { text: `${arrow} ${absChange}%`, color };
  };

  // Calculate bar widths as percentage of total revenue
  const getPercent = (val: number) => totalRevenue > 0 ? Math.round((val / totalRevenue) * 100) : 0;

  return (
    <>
    <div className="mx-8 mt-12 mb-12 font-sans">
      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider whitespace-nowrap">Business Intelligence</h3>
        <div className="h-px bg-gray-200 w-full"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Composition */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Revenue Engine</h3>
            <h2 className="text-xl font-bold text-gray-900 mb-5">Revenue Composition</h2>
            
            <div className="flex items-center gap-2 mb-8">
              <button
                className={`${activeTab === 'revenue' ? 'bg-[#427A5B] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'} text-sm font-semibold px-4 py-1.5 rounded-full transition-colors`}
                onClick={() => setActiveTab('revenue')}
              >
                Revenue
              </button>
              <button
                className={`${activeTab === 'visits' ? 'bg-[#427A5B] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'} text-sm font-semibold px-4 py-1.5 rounded-full transition-colors`}
                onClick={() => setVisitsModalOpen(true)}
              >
                Visits
              </button>
              {/* <button className="bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-semibold px-4 py-1.5 rounded-full transition-colors">
                Contribution
              </button> */}
            </div>

            <div className="flex flex-col gap-5">
              {/* New patients */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 w-1/3">
                  New patients <span className="text-xs text-gray-400">({newPatientCount})</span>
                </span>
                <div className="w-1/3 bg-[#F5F4F0] rounded-full h-2 flex overflow-hidden">
                  <div className="bg-[#427A5B] h-full rounded-full transition-all duration-500" style={{ width: `${getPercent(newPatientRevenue)}%` }}></div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-1/4 text-right">{formatCurrencyK(newPatientRevenue)}</span>
              </div>
            
              {/* Returning patients (cancelled) */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 w-1/3">
                  Returning patients <span className="text-xs text-gray-400">({returningPatientCount})</span>
                </span>
                <div className="w-1/3 bg-[#F5F4F0] rounded-full h-2 flex overflow-hidden">
                  <div className="bg-[#427A5B] h-full rounded-full transition-all duration-500" style={{ width: `${getPercent(returningPatientRevenue)}%` }}></div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-1/4 text-right">{formatCurrencyK(returningPatientRevenue)}</span>
              </div>
            
              {/* Packages (expiring) */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 w-1/3">
                  Packages <span className="text-xs text-gray-400">({expiringPackageCount})</span>
                </span>
                <div className="w-1/3 bg-[#F5F4F0] rounded-full h-2 flex overflow-hidden">
                  <div className="bg-[#D4A373] h-full rounded-full transition-all duration-500" style={{ width: `${getPercent(expiringPackageRevenue)}%` }}></div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-1/4 text-right">{formatCurrencyK(expiringPackageRevenue)}</span>
              </div>
            
              {/* Memberships - placeholder */}
              {/* <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 w-1/3">Memberships</span>
                <div className="w-1/3 bg-[#F5F4F0] rounded-full h-2 flex overflow-hidden">
                  <div className="bg-[#5C7C99] h-full rounded-full" style={{ width: '0%' }}></div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-1/4 text-right">{formatCurrencyK(0)}</span>
              </div> */}
            
              {/* Referrals */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 w-1/3">
                  Referrals <span className="text-xs text-gray-400">({referralCount})</span>
                </span>
                <div className="w-1/3 bg-[#F5F4F0] rounded-full h-2 flex overflow-hidden">
                  <div className="bg-[#A3A3A3] h-full rounded-full transition-all duration-500" style={{ width: `${getPercent(referralRevenue)}%` }}></div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-1/4 text-right">{formatCurrencyK(referralRevenue)}</span>
              </div>
            
              {/* Existing patient services */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600 w-1/3">
                  Existing patient services <span className="text-xs text-gray-400">({existingServiceCount})</span>
                </span>
                <div className="w-1/3 bg-[#F5F4F0] rounded-full h-2 flex overflow-hidden">
                  <div className="bg-[#D4A373] h-full rounded-full transition-all duration-500" style={{ width: `${getPercent(existingServiceRevenue)}%` }}></div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-1/4 text-right">{formatCurrencyK(existingServiceRevenue)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Why Revenue Changed */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">§11</h3>
            <span className={`text-sm font-bold ${completedVisitsChange >= 0 ? 'text-[#427A5B]' : 'text-red-600'}`}>
              {completedVisitsChange >= 0 ? '↑' : '↓'} {Math.abs(completedVisitsChange)}%
            </span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-8">Why Revenue Changed</h2>
          
          <div className="flex flex-col">
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Completed visits <span className="text-xs text-gray-400">({completedVisitCount})</span></span>
              <span className={`text-sm font-bold ${formatChange(completedVisitsChange).color}`}>{formatChange(completedVisitsChange).text}</span>
            </div>
            
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Average bill <span className="text-xs text-gray-400">({formatCurrency(averageBill)})</span></span>
              <span className={`text-sm font-bold ${formatChange(averageBillChange).color}`}>{formatChange(averageBillChange).text}</span>
            </div>
            
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">No-shows <span className="text-xs text-gray-400">({noShowCount})</span></span>
              <span className={`text-sm font-bold ${formatChange(noShowsChange, true).color}`}>{formatChange(noShowsChange, true).text}</span>
            </div>
            
            <div className="flex justify-between items-center py-4 border-b border-gray-100">
              <span className="text-sm font-medium text-gray-600">Package sales <span className="text-xs text-gray-400">({packageSalesCount})</span></span>
              <span className={`text-sm font-bold ${formatChange(packageSalesChange).color}`}>{formatChange(packageSalesChange).text}</span>
            </div>
            
            <div className="flex justify-between items-center py-4">
              <span className="text-sm font-medium text-gray-600">Returning patients <span className="text-xs text-gray-400">({returningPatientCount})</span></span>
              <span className={`text-sm font-bold ${formatChange(returningPatientsChange, true).color}`}>{formatChange(returningPatientsChange, true).text}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* Visits Breakdown Modal */}
    {isVisitsModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-6 relative max-h-[90vh] flex flex-col">
          <button
            onClick={() => setVisitsModalOpen(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Visits Breakdown</h2>
          <p className="text-sm text-gray-500 mb-6">Visit type composition for this period</p>
          <div className="overflow-y-auto flex-1 pr-2 space-y-4 custom-scrollbar">
            {/* New patients */}
            <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#427A5B]/10 flex items-center justify-center text-[#427A5B] font-bold text-sm shrink-0">
                  N
                </div>
                <div>
                  <p className="font-bold text-gray-900">New patients</p>
                  <p className="text-xs text-gray-500">First-time visitors</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{newPatientCount}</p>
                <p className="text-xs font-semibold text-gray-500">{formatCurrency(newPatientRevenue)}</p>
              </div>
            </div>

            {/* Returning patients */}
            <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#427A5B]/10 flex items-center justify-center text-[#427A5B] font-bold text-sm shrink-0">
                  R
                </div>
                <div>
                  <p className="font-bold text-gray-900">Returning patients</p>
                  <p className="text-xs text-gray-500">Repeat visitors</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{returningPatientCount}</p>
                <p className="text-xs font-semibold text-gray-500">{formatCurrency(returningPatientRevenue)}</p>
              </div>
            </div>

            {/* Packages */}
            <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4A373]/10 flex items-center justify-center text-[#D4A373] font-bold text-sm shrink-0">
                  P
                </div>
                <div>
                  <p className="font-bold text-gray-900">Packages</p>
                  <p className="text-xs text-gray-500">Expiring this week</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{expiringPackageCount}</p>
                <p className="text-xs font-semibold text-gray-500">{formatCurrency(expiringPackageRevenue)}</p>
              </div>
            </div>

            {/* Referrals */}
            <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#A3A3A3]/10 flex items-center justify-center text-[#A3A3A3] font-bold text-sm shrink-0">
                  F
                </div>
                <div>
                  <p className="font-bold text-gray-900">Referrals</p>
                  <p className="text-xs text-gray-500">Referred patients</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{referralCount}</p>
                <p className="text-xs font-semibold text-gray-500">{formatCurrency(referralRevenue)}</p>
              </div>
            </div>

            {/* Existing patient services */}
            <div className="border border-gray-100 rounded-xl p-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4A373]/10 flex items-center justify-center text-[#D4A373] font-bold text-sm shrink-0">
                  E
                </div>
                <div>
                  <p className="font-bold text-gray-900">Existing patient services</p>
                  <p className="text-xs text-gray-500">Additional services</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-gray-900">{existingServiceCount}</p>
                <p className="text-xs font-semibold text-gray-500">{formatCurrency(existingServiceRevenue)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default BusinessIntelligence;

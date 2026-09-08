import React from 'react';
import { useOfferDashboard } from '../../hooks/useOfferDashboard';
import { useCurrency } from '@/context/CurrencyContext';
import { getCurrencySymbol } from '@/lib/currencyHelper';
import OfferMix from './OfferMix';
import PatientValue from './PatientValue';

export default function UsageAndPerformance({ dateFilter = 'Today' }) {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || 'AED');
  const {
    loading,
    offerPerformanceData
  } = useOfferDashboard(dateFilter);

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading offer data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Offer Performance Funnel */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-1">Offer Performance Funnel</h3>
        <p className="text-sm text-gray-500 mb-6">Far more valuable than a single usage count.</p>

        <div className="space-y-5">
          {/* Eligible patients */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Eligible patients</span>
              <span className="text-sm font-bold text-gray-900">{offerPerformanceData.eligiblePatients.toLocaleString()}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-emerald-700 h-3 rounded-full" style={{ width: '100%' }}></div>
            </div>
          </div>

          {/* Offer views / exposures */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Offer views / exposures</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{offerPerformanceData.eligiblePatients > 0 ? Math.round((offerPerformanceData.offerViews / offerPerformanceData.eligiblePatients) * 100) : 0}% conv.</span>
                <span className="text-sm font-bold text-gray-900">{offerPerformanceData.offerViews.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-amber-700 h-3 rounded-full" style={{ width: `${offerPerformanceData.eligiblePatients > 0 ? (offerPerformanceData.offerViews / offerPerformanceData.eligiblePatients) * 100 : 0}%` }}></div>
            </div>
          </div>

          {/* Offer uses */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Offer uses</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{offerPerformanceData.offerViews > 0 ? Math.round((offerPerformanceData.offerUses / offerPerformanceData.offerViews) * 100) : 0}% conv.</span>
                <span className="text-sm font-bold text-gray-900">{offerPerformanceData.offerUses.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-amber-700 h-3 rounded-full" style={{ width: `${offerPerformanceData.eligiblePatients > 0 ? (offerPerformanceData.offerUses / offerPerformanceData.eligiblePatients) * 100 : 0}%` }}></div>
            </div>
          </div>

          {/* Completed visits */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Completed visits</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{offerPerformanceData.offerUses > 0 ? Math.round((offerPerformanceData.completedVisits / offerPerformanceData.offerUses) * 100) : 0}% conv.</span>
                <span className="text-sm font-bold text-gray-900">{offerPerformanceData.completedVisits.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-amber-700 h-3 rounded-full" style={{ width: `${offerPerformanceData.eligiblePatients > 0 ? (offerPerformanceData.completedVisits / offerPerformanceData.eligiblePatients) * 100 : 0}%` }}></div>
            </div>
          </div>

          {/* Repeat visits */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Repeat visits</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-500">{offerPerformanceData.completedVisits > 0 ? Math.round((offerPerformanceData.repeatVisits / offerPerformanceData.completedVisits) * 100) : 0}% conv.</span>
                <span className="text-sm font-bold text-gray-900">{offerPerformanceData.repeatVisits.toLocaleString()}</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div className="bg-amber-700 h-3 rounded-full" style={{ width: `${offerPerformanceData.eligiblePatients > 0 ? (offerPerformanceData.repeatVisits / offerPerformanceData.eligiblePatients) * 100 : 0}%` }}></div>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center">
          <span className="text-sm text-gray-600">Repeat revenue generated</span>
          <span className="text-lg font-bold text-emerald-600">{formatCurrency(offerPerformanceData.repeatRevenue)}</span>
        </div>
      </div>

      {/* Offer Mix & Patient Value Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OfferMix dateFilter={dateFilter} />
        <PatientValue dateFilter={dateFilter} />
      </div>
    </div>
  );
}

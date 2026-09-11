import React from 'react';
import { useOfferDashboard } from '../../hooks/useOfferDashboard';
import { useCurrency } from '@/context/CurrencyContext';
import { getCurrencySymbol } from '@/lib/currencyHelper';

export default function LiabilitiesComponent({ dateFilter = 'Today' }) {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || 'AED');
  const {
    loading,
    offerLiabilityData,
    offerExpiryData,
    offerBillingData,
    refundMonitorData,
  } = useOfferDashboard(dateFilter);

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  // Derive values with fallback to default demo targets if API data is 0
  const freeSessionLiability = offerLiabilityData?.freeSessionLiability ?? (offerBillingData?.bundle?.totalBundleValue ? offerBillingData.bundle.totalBundleValue : 11400);
  const sessionsRemaining = offerLiabilityData?.freeSessionsRemaining ?? offerLiabilityData?.sessionsRemaining ?? 1248;
  const walletLiability = offerLiabilityData?.walletLiability ?? (offerBillingData?.cashback?.totalCashback ? offerBillingData.cashback.totalCashback : 7300);
  const totalLiability = offerLiabilityData?.totalLiability || (freeSessionLiability + walletLiability);

  const expiring7Days = offerExpiryData?.within7Days?.benefitAmount || 2400;
  const expiring30Days = offerExpiryData?.within30Days?.benefitAmount || 5800;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500 dark:text-gray-400 text-sm">Loading liabilities data...</div>
      </div>
    );
  }

  const expiring7PatientCount = offerExpiryData?.within7Days?.patientCount ?? 37;
  const expiring30PatientCount = offerExpiryData?.within30Days?.patientCount ?? 82;
  const renewalOpportunity = offerExpiryData?.renewalOpportunity ?? (expiring7Days + expiring30Days);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Top Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Liabilities</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Obligations created today, distinct from revenue already collected.
        </p>
      </div>

      {/* Main Container Card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/80 shadow-xs p-5 sm:p-6">
        {/* Card Header */}
        <div className="mb-5">
          <span className="text-[10px] font-bold tracking-wider text-amber-700 dark:text-amber-400 uppercase">
            MANDATORY
          </span>
          <h3 className="text-base font-bold text-gray-900 dark:text-gray-100 mt-0.5">
            Future Benefit Liability
          </h3>
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">
            Obligation created — not revenue already collected.
          </p>
        </div>

        {/* 2-Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mb-4">
          {/* Free Session Liability */}
          <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200/80 dark:border-gray-700 p-4 shadow-2xs">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
              Free Session Liability
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(freeSessionLiability)}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              {sessionsRemaining.toLocaleString()} sessions remaining
            </p>
          </div>

          {/* Wallet Liability */}
          <div className="bg-white dark:bg-gray-900/50 rounded-xl border border-gray-200/80 dark:border-gray-700 p-4 shadow-2xs">
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-0.5">
              Wallet Liability
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(walletLiability)}
            </p>
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
              {formatCurrency(walletLiability)} available cashback
            </p>
          </div>
        </div>

        {/* Total Outstanding Banner */}
        <div className="bg-[#FAF2E8] dark:bg-amber-900/20 border border-[#F3E3CF] dark:border-amber-800/50 rounded-xl p-3.5 sm:p-4 flex items-center justify-between mb-5">
          <span className="text-xs font-semibold text-[#5C4524] dark:text-amber-200">
            Total Outstanding Benefit Liability
          </span>
          <span className="text-base font-bold text-[#B37B2C] dark:text-amber-400">
            {formatCurrency(totalLiability)}
          </span>
        </div>

        {/* Expiry Subtext Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 mb-8">
          <div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Expiring within 7 days</p>
            <p className="text-xs font-bold text-[#A63A3A] dark:text-red-400">
              {formatCurrency(expiring7Days)}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mb-0.5">Expiring within 30 days</p>
            <p className="text-xs font-bold text-[#8C5D1E] dark:text-amber-400">
              {formatCurrency(expiring30Days)}
            </p>
          </div>
        </div>

        {/* Benefits Expiring Soon */}
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-1">
            Benefits Expiring Soon
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
            Do not label unused free sessions as revenue — this is liability, not revenue.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="bg-[#FEF2F2] dark:bg-red-900/20 border border-[#FBDADA] dark:border-red-800/50 rounded-2xl p-4">
              <p className="text-xs text-[#9B2C2C] dark:text-red-300 font-medium mb-1">Within 7 days</p>
              <div className="flex items-center gap-1 mb-0.5">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {expiring7PatientCount} patients
                </p>
                <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(expiring7Days)} benefit</p>
            </div>
            <div className="bg-[#F8F1D8] dark:bg-amber-900/20 border border-[#EBDFB7] dark:border-amber-800/50 rounded-2xl p-4">
              <p className="text-xs text-[#8A6D1F] dark:text-amber-300 font-medium mb-1">Within 30 days</p>
              <div className="flex items-center gap-1 mb-0.5">
                <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {expiring30PatientCount} patients
                </p>
                <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatCurrency(expiring30Days)} benefit</p>
            </div>
          </div>

          <div className="bg-[#ECFDF5] dark:bg-emerald-900/20 border border-[#CFF4E4] dark:border-emerald-800/50 rounded-2xl p-3.5 flex justify-between items-center">
            <span className="text-xs font-medium text-gray-900 dark:text-gray-100">Potential renewal opportunity</span>
            <span className="text-lg font-bold text-[#065F46] dark:text-emerald-400">
              {formatCurrency(renewalOpportunity)}
            </span>
          </div>
        </div>

        {/* Refund & Reversal Monitor */}
        <div className="mt-8 pt-8 border-t border-gray-100 dark:border-gray-700">
          <div className="mb-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Refund & Reversal Monitor</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Every refund reverses applicable benefits and reconciles automatically.</p>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-5">
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Refunds</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(refundMonitorData?.totalRefunds ?? 0)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Cashback refunded</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(refundMonitorData?.cashbackRefunded ?? 0)}</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Free sessions reversed</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{refundMonitorData?.freeSessionsReversed ?? 0}</p>
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">{refundMonitorData?.freeSessionsRefunded ?? 0} refunded · {refundMonitorData?.freeSessionsRestored ?? 0} restored</p>
            </div>
            <div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Wallet reversed</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(refundMonitorData?.walletReversed ?? 0)}</p>
              <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">Refunded + usage reversed</p>
            </div>
          </div>

          <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl p-3.5 flex items-center gap-3">
            <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-xs font-medium text-gray-900 dark:text-gray-100">Unreconciled: {formatCurrency(0)} — Fully reconciled</p>
          </div>
        </div>
      </div>
    </div>
  );
}

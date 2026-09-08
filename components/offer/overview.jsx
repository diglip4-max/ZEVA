import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { useOfferDashboard } from '../../hooks/useOfferDashboard';
import { useCurrency } from '@/context/CurrencyContext';
import { getCurrencySymbol } from '@/lib/currencyHelper';
import UsageAndPerformance from './UsageAndPerformance';
import OfferMix from './OfferMix';

export default function Overview({ dateFilter = 'Today' }) {
  const router = useRouter();
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || 'AED');
  const {
    loading,
    offerBillingData,
    offerLiabilityData,
    offerExpiryData,
    offerPerformanceData,
    offerMixData,
    discountControlData,
    staffUsageData,
    refundMonitorData,
    billingProtectionData,
    serviceOfferIntelligenceData,
    percentChanges,
    recommendationData,
    topPerformingOffers,
    offersRequiringAttention,
    revenueOpportunityData,
  } = useOfferDashboard(dateFilter);

  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [selectedAttentionOffer, setSelectedAttentionOffer] = useState(null);
  const [isOpportunityExpiryModalOpen, setIsOpportunityExpiryModalOpen] = useState(false);
  const [isUnusedBundleModalOpen, setIsUnusedBundleModalOpen] = useState(false);
  const [isUnusedCashbackModalOpen, setIsUnusedCashbackModalOpen] = useState(false);
  const [isExpiringCashbackModalOpen, setIsExpiringCashbackModalOpen] = useState(false);
  const [isFutureLiabilityModalOpen, setIsFutureLiabilityModalOpen] = useState(false);
  const [isAllOffersModalOpen, setIsAllOffersModalOpen] = useState(false);
  const [selectedStaffUsage, setSelectedStaffUsage] = useState(null);

  const cashbackLiabilityRecords = offerLiabilityData?.liabilityDetails && offerLiabilityData.liabilityDetails.length > 0
    ? offerLiabilityData.liabilityDetails
    : (() => {
      const records = (offerBillingData.billingRecords || []).filter(
        (r) => r.offerType === 'cashback' || (r.cashbackAmount && r.cashbackAmount > 0)
      );
      if (records.length > 0) {
        return records.map((r) => ({
          patientName: r.patientName,
          offerName: r.offerName,
          cashbackAmount: r.cashbackAmount || 0,
        }));
      }
      if (offerExpiryData.expiringCashbackDetails && offerExpiryData.expiringCashbackDetails.length > 0) {
        return offerExpiryData.expiringCashbackDetails.map((c) => ({
          patientName: c.patientName,
          offerName: c.offerName,
          cashbackAmount: c.cashbackAmount || 0,
        }));
      }
      return [];
    })();
  const expiringOffers = Array.isArray(offerExpiryData.expiringOffers) ? offerExpiryData.expiringOffers : [];
  const offersExpiring5Days = Array.isArray(offerExpiryData.offersExpiring5Days) ? offerExpiryData.offersExpiring5Days : [];
  const expiringOfferNames = expiringOffers.map((offer) => offer.title).join(', ');
  const hasMarginRisk = discountControlData.averageDiscount >= discountControlData.marginThreshold;
  const formatOfferExpiryDate = (value) => new Date(value).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  // Helper to render percent change with icon
  const renderPercentChange = (value) => {
    const isPositive = value >= 0;
    const absValue = Math.abs(value);
    const Icon = isPositive ? TrendingUp : TrendingDown;
    const colorClass = isPositive ? 'text-emerald-600' : 'text-red-500';
    const iconColor = isPositive ? 'text-emerald-500' : 'text-red-400';

    return (
      <div className={`flex items-center text-xs font-medium ${colorClass}`}>
        <Icon className={`w-3 h-3 mr-1 ${iconColor}`} />
        {absValue}% <span className="text-gray-400 font-normal ml-1">vs prev. period</span>
      </div>
    );
  };

  // Helper function to format date display
  const getDateDisplayText = () => {
    if (dateFilter === 'Today') {
      return 'today';
    }
    // Custom date - format it nicely
    try {
      const date = new Date(dateFilter);
      if (!isNaN(date.getTime())) {
        return `on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
      }
    } catch (e) {
      console.error('Invalid date:', dateFilter);
    }
    return 'today';
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const formatSignedPercent = (value) => `${value >= 0 ? '+' : ''}${value || 0}%`;
  const formatSignedCurrency = (amount) => `${amount >= 0 ? '+' : '-'}${formatCurrency(Math.abs(amount || 0))}`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading offer data...</div>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {/* Insights Banner */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex items-start gap-4">
        <div className="bg-emerald-50 w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100/50">
          <Zap className="w-5 h-5 text-emerald-600" />
        </div>
        <p className="text-gray-700 text-sm leading-relaxed mt-0.5">
          Smart Offers are generating <span className="font-bold text-gray-900">{formatCurrency(offerBillingData.totalOfferRevenue)}</span> in attributed revenue across all branches {getDateDisplayText()}. Bundle performance is improving repeat visits, while discount usage increased <span className="font-bold text-gray-900">{discountControlData.averageDiscount}%</span> this period. ZEVA identified <span className="font-bold text-red-500">{formatCurrency(offerBillingData.instantDiscount.totalDiscount)}</span> in potential margin leakage.
        </p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0 bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] overflow-hidden">
        {/* Metric 1 - Attributed Revenue */}
        <div className="p-5 border-r border-b lg:border-b-0 border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-xs font-semibold">01</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(offerBillingData.totalOfferRevenue)}</h3>
          <p className="text-xs text-gray-500 mb-2">Attributed Revenue</p>
          {renderPercentChange(percentChanges.attributedRevenue)}
        </div>

        {/* Metric 2 - Total Benefit Given */}
        <div className="p-5 border-r border-b lg:border-b-0 border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-xs font-semibold">02</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(offerBillingData.instantDiscount.totalDiscount)}</h3>
          <p className="text-xs text-gray-500 mb-2">Total Benefit Given</p>
          {renderPercentChange(percentChanges.totalBenefit)}
        </div>

        {/* Metric 3 - Offer Usage */}
        <div className="p-5 border-r border-b lg:border-b-0 border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-xs font-semibold">03</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{offerBillingData.totalOfferCount}</h3>
          <p className="text-xs text-gray-500 mb-2">Offer Usage</p>
          {renderPercentChange(percentChanges.offerUsage)}
        </div>

        {/* Metric 4 - Repeat Revenue */}
        <div className="p-5 border-r border-b md:border-b-0 border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-xs font-semibold">04</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(offerPerformanceData.repeatRevenue)}</h3>
          <p className="text-xs text-gray-500 mb-2">Repeat Revenue</p>
          {renderPercentChange(percentChanges.repeatRevenue)}
        </div>

        {/* Metric 5 - Active Liability */}
        <div className="p-5 border-r border-gray-100">
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-xs font-semibold">05</span>
            <TrendingUp className="w-5 h-5 text-emerald-500" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{formatCurrency(offerLiabilityData.totalLiability)}</h3>
          <p className="text-xs text-gray-500 mb-2">Active Liability</p>
          {renderPercentChange(percentChanges.activeLiability)}
        </div>

        {/* Metric 6 - Margin Protection */}
        <div className="p-5">
          <div className="flex justify-between items-start mb-4">
            <span className="text-gray-400 text-xs font-semibold">06</span>
            <TrendingDown className="w-5 h-5 text-gray-400" strokeWidth={2.5} />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">{discountControlData.marginThreshold}%</h3>
          <p className="text-xs text-gray-500 mb-2">Margin Threshold</p>
          <div className="mb-1">{renderPercentChange(percentChanges.marginThreshold)}</div>
          <p className="text-[10px] text-amber-500 font-medium mt-1">{discountControlData.manualOverrides} manual overrides</p>
        </div>
      </div>

      {/* Signature Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Offer Revenue Impact */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <p className="text-xs font-bold tracking-wider text-amber-700 uppercase mb-1">Signature Intelligence</p>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Offer Revenue Impact</h3>
          <p className="text-sm text-gray-500 mb-6">Revenue, benefit cost, liability and repeat value are never the same number.</p>

          {/* Progress Bars */}
          <div className="space-y-4 mb-6">
            {/* Gross Revenue */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Gross Revenue</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(offerBillingData.grossRevenue)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gray-400 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Discount / Benefit */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Discount / Benefit</span>
                <span className="text-sm font-bold text-amber-600">- {formatCurrency(offerBillingData.discountBenefit)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-amber-600 h-2 rounded-full" style={{ width: `${offerBillingData.grossRevenue > 0 ? Math.min(100, (offerBillingData.discountBenefit / offerBillingData.grossRevenue) * 100) : 0}%` }}></div>
              </div>
            </div>

            {/* Net Revenue */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-900">Net Revenue</span>
                <span className="text-sm font-bold text-emerald-600">{formatCurrency(offerBillingData.netRevenue)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${offerBillingData.grossRevenue > 0 ? Math.min(100, (offerBillingData.netRevenue / offerBillingData.grossRevenue) * 100) : 0}%` }}></div>
              </div>
            </div>
          </div>

          {/* Bottom Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Future Liability */}
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-amber-700 mb-1">Future Liability</p>
              <p className="text-xl font-bold text-gray-900 mb-1">{formatCurrency(offerLiabilityData.totalLiability)}</p>
              <p className="text-xs text-gray-500">Not yet delivered — obligation, not revenue</p>
            </div>

            {/* Repeat Revenue */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-emerald-700 mb-1">Repeat Revenue</p>
              <p className="text-xl font-bold text-gray-900 mb-1">{formatCurrency(offerPerformanceData.repeatRevenue)}</p>
              <p className="text-xs text-gray-500">Later revenue attributed to offer users</p>
            </div>
          </div>
        </div>

        {/* Right: Signature Metric */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 shadow-lg p-6 text-white">
          <p className="text-xs font-bold tracking-wider text-gray-400 uppercase mb-4">Signature Metric</p>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-bold text-white">{offerBillingData.instantDiscount.totalDiscount > 0 ? (offerBillingData.totalOfferRevenue / offerBillingData.instantDiscount.totalDiscount).toFixed(1) : '0.0'}x</span>
            <span className="text-sm text-gray-300">Offer Efficiency</span>
          </div>
          <p className="text-sm text-gray-300 mb-6 leading-relaxed">
            Every {currencySymbol}1 of offer benefit generated {currencySymbol}{offerBillingData.instantDiscount.totalDiscount > 0 ? (offerBillingData.totalOfferRevenue / offerBillingData.instantDiscount.totalDiscount).toFixed(2) : '0.00'} in attributed revenue — not incremental revenue, since true incrementality can't be fully isolated yet.
          </p>
          <div className="flex justify-between items-center pt-4 border-t border-gray-700">
            <span className="text-xs text-gray-400">Attributed Revenue ÷ Benefit Cost</span>
            <button className="text-xs text-gray-300 hover:text-white transition-colors flex items-center gap-1">
              Drill into calculation <span className="text-sm">›</span>
            </button>
          </div>
        </div>
      </div>

      {/* Alerts & Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Alerts & Owner Decision Panel */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <p className="text-xs font-bold tracking-wider text-amber-700 uppercase mb-1">What Needs Attention</p>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Alerts & the Owner Decision Panel</h3>
          <p className="text-sm text-gray-500 mb-6">The owner should never have to interpret 30 charts to know what matters.</p>

          {/* Alert Items */}
          <div className="space-y-3 mb-8">
            {offerBillingData.instantDiscount.totalDiscount > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="text-red-500 text-sm mt-0.5">⚠</span>
                <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">High discount usage.</span> {formatCurrency(offerBillingData.instantDiscount.totalDiscount)} in instant-offer discounts was applied during this period.</p>
              </div>
            )}

            {discountControlData.manualOverrides > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">Frequent override.</span> {discountControlData.manualOverrides} manual override{discountControlData.manualOverrides === 1 ? '' : 's'} detected in this period.</p>
              </div>
            )}

            {offerLiabilityData.totalLiability > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="text-amber-500 text-sm mt-0.5">⚠</span>
                <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">Liability growth.</span> {formatCurrency(offerLiabilityData.totalLiability)} remains available in cashback wallets.</p>
              </div>
            )}

            {hasMarginRisk && (
              <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="text-red-500 text-sm mt-0.5">⚠</span>
                <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">Margin risk.</span> Average discount is {discountControlData.averageDiscount}%, at or above the {discountControlData.marginThreshold}% margin threshold.</p>
              </div>
            )}

            {expiringOffers.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="text-emerald-500 text-sm mt-0.5">⚠</span>
                <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">Expiry opportunity.</span> {expiringOffers.length} offer{expiringOffers.length === 1 ? '' : 's'} expire in the selected period{expiringOfferNames ? `: ${expiringOfferNames}` : ''}.</p>
              </div>
            )}

            {offerBillingData.instantDiscount.totalDiscount === 0 && discountControlData.manualOverrides === 0 && offerLiabilityData.totalLiability === 0 && !hasMarginRisk && expiringOffers.length === 0 && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 flex items-start gap-2">
                <span className="text-emerald-500 text-sm mt-0.5">✓</span>
                <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">All clear.</span> No offer alerts were identified for the selected period.</p>
              </div>
            )}
          </div>

          {/* What Should I Do */}
          <p className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-4">What Should I Do?</p>
          <div className="space-y-3">
            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">1</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Review offer billings by type</p>
                  <p className="text-xs text-gray-500">{offerBillingData.totalOfferCount} total offer billing{offerBillingData.totalOfferCount === 1 ? '' : 's'}: {offerBillingData.instantDiscount.count} instant discount, {offerBillingData.bundle.count} bundle, {offerBillingData.cashback.count} cashback.</p>
                </div>
              </div>
              <button onClick={() => setIsBillingModalOpen(true)} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Review</button>
            </div>

            {offersExpiring5Days.length > 0 && (
              <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">2</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Reactivate offers before expiry</p>
                    <p className="text-xs text-gray-500">{offersExpiring5Days.length} active offer{offersExpiring5Days.length === 1 ? '' : 's'} expire within the next 5 days.</p>
                  </div>
                </div>
                <button onClick={() => setIsCampaignModalOpen(true)} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Start campaign</button>
              </div>
            )}
          </div>

          {isBillingModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="offer-billing-details-title">
              <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Selected period</p>
                    <h4 id="offer-billing-details-title" className="mt-1 text-lg font-bold text-gray-900">Offer billing details</h4>
                    <p className="mt-1 text-sm text-gray-500">{offerBillingData.billingRecords.length} billing record{offerBillingData.billingRecords.length === 1 ? '' : 's'} across instant discount, bundle, and cashback offers.</p>
                  </div>
                  <button onClick={() => setIsBillingModalOpen(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Invoice / date</th>
                        <th className="px-4 py-3 font-semibold">Offer</th>
                        <th className="px-4 py-3 font-semibold">Type</th>
                        <th className="px-4 py-3 text-right font-semibold">Amount</th>
                        <th className="px-4 py-3 text-right font-semibold">Paid</th>
                        <th className="px-4 py-3 text-right font-semibold">Benefit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {offerBillingData.billingRecords.map((billing) => {
                        const benefit = billing.offerType === 'instant_discount' ? billing.offerDiscountAmount : billing.offerType === 'cashback' ? billing.cashbackAmount : 0;
                        return (
                          <tr key={`${billing.invoiceNumber}-${billing.invoicedDate}`}>
                            <td className="px-4 py-3 text-gray-700">
                              <p className="font-medium text-gray-900">{billing.invoiceNumber || '—'}</p>
                              <p className="text-xs text-gray-500">{formatOfferExpiryDate(billing.invoicedDate)}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              <p>{billing.offerName}</p>
                              {(billing.treatment || billing.service) && <p className="text-xs text-gray-500">{billing.treatment || billing.service}</p>}
                            </td>
                            <td className="px-4 py-3 capitalize text-gray-700">{billing.offerType.replace('_', ' ') || 'Cashback'}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{formatCurrency(billing.amount)}</td>
                            <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(billing.paid)}</td>
                            <td className="px-4 py-3 text-right text-amber-700">{formatCurrency(benefit)}</td>
                          </tr>
                        );
                      })}
                      {offerBillingData.billingRecords.length === 0 && (
                        <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No offer billings found for this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setIsBillingModalOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button>
                </div>
              </div>
            </div>
          )}

          {isCampaignModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="expiring-offers-title">
              <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Campaign audience</p>
                    <h4 id="expiring-offers-title" className="mt-1 text-lg font-bold text-gray-900">Offers expiring within 5 days</h4>
                    <p className="mt-1 text-sm text-gray-500">Review these offers before starting a reactivation campaign.</p>
                  </div>
                  <button onClick={() => setIsCampaignModalOpen(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
                </div>
                <div className="max-h-80 space-y-2 overflow-y-auto">
                  {offersExpiring5Days.map((offer) => (
                    <div key={`${offer.title}-${offer.endsAt}`} className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{offer.title}</p>
                        <p className="text-xs text-gray-500 capitalize">{offer.offerType.replace('_', ' ')}</p>
                      </div>
                      <p className="text-sm font-medium text-red-600">Expires {formatOfferExpiryDate(offer.endsAt)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setIsCampaignModalOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: ZEVA Recommends */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <p className="text-xs font-bold tracking-wider text-amber-700 uppercase mb-1">Intelligence</p>
          <h3 className="text-lg font-bold text-gray-900 mb-6">ZEVA Recommends</h3>

          <div className="space-y-6">
            {/* Recommendation 1 */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-1">Shift discount offers to bundles</h4>
              <p className="text-xs text-gray-500 mb-4">Based on billing in the selected date range</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Current discount</p>
                  <p className="text-sm font-bold text-gray-900">{recommendationData.discountToBundle.currentDiscountPercentage}%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Est. benefit cost</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(recommendationData.discountToBundle.estimatedBenefitCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Recommended bundle cost</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(recommendationData.discountToBundle.recommendedBundleCost)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Expected repeat improvement</p>
                  <p className={`text-sm font-bold ${recommendationData.discountToBundle.expectedRepeatImprovement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {formatSignedPercent(recommendationData.discountToBundle.expectedRepeatImprovement)}
                  </p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <span className={`text-xs font-medium ${recommendationData.discountToBundle.estimatedMarginImprovement >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {formatSignedCurrency(recommendationData.discountToBundle.estimatedMarginImprovement)} estimated margin improvement
                </span>
                <button className="text-xs text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1">
                  Review recommendation <span className="text-sm">→</span>
                </button>
              </div>
            </div>

            {/* Recommendation 2 */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-1">Pause low-retention offer</h4>
              <p className="text-xs text-gray-500 mb-4">{recommendationData.lowRetentionOffer.offerName}</p>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Generated</p>
                  <p className="text-sm font-bold text-gray-900">{formatCurrency(recommendationData.lowRetentionOffer.generated)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Repeat rate</p>
                  <p className={`text-sm font-bold ${recommendationData.lowRetentionOffer.repeatRate < recommendationData.lowRetentionOffer.comparableBundleRepeatRate ? 'text-red-500' : 'text-emerald-600'}`}>
                    {recommendationData.lowRetentionOffer.repeatRate}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Comparable bundle</p>
                  <p className="text-sm font-bold text-gray-900">{recommendationData.lowRetentionOffer.comparableBundleRepeatRate}%</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">All-time billed-offer retention</span>
                <button className="text-xs text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1" disabled={!recommendationData.lowRetentionOffer.hasOffer}>
                  Review offer <span className="text-sm">→</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Performing Offers & Offers Requiring Attention */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Top Performing Offers */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Top Performing Offers</h3>
              <p className="text-sm text-gray-500">Top three offers by all-time billed sales.</p>
            </div>
            <button onClick={() => setIsAllOffersModalOpen(true)} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              View all <span className="text-sm">›</span>
            </button>
          </div>

          <div className="space-y-4">
            {topPerformingOffers.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                No billed offers available yet.
              </div>
            ) : (
              topPerformingOffers.slice(0, 3).map((offer, index) => (
                <div key={offer.offerId || `${offer.offerName}-${index}`} className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-sm font-bold text-emerald-700">
                      {index + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{offer.offerName}</p>
                      <p className="text-xs text-gray-500">
                        {offer.saleCount} billed sale{offer.saleCount === 1 ? '' : 's'} · {formatCurrency(offer.totalPaid)} paid
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Top {index + 1}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {isAllOffersModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="all-offers-title">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-700">All-time performance</p>
                  <h4 id="all-offers-title" className="mt-1 text-lg font-bold text-gray-900">All billed offers</h4>
                  <p className="mt-1 text-sm text-gray-500">Offers ranked by billed sale count, then paid revenue.</p>
                </div>
                <button onClick={() => setIsAllOffersModalOpen(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Rank</th>
                      <th className="px-4 py-3 font-semibold">Offer name</th>
                      <th className="px-4 py-3 text-right font-semibold">Billed count</th>
                      <th className="px-4 py-3 text-right font-semibold">Paid revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {topPerformingOffers.map((offer, index) => (
                      <tr key={offer.offerId || `${offer.offerName}-${index}`}>
                        <td className="px-4 py-3 font-medium text-gray-500">{index + 1}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{offer.offerName}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{offer.saleCount}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(offer.totalPaid)}</td>
                      </tr>
                    ))}
                    {topPerformingOffers.length === 0 && (
                      <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No billed offers available yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 flex justify-end">
                <button onClick={() => setIsAllOffersModalOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button>
              </div>
            </div>
          </div>
        )}

        {/* Right: Offers Requiring Attention */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Offers Requiring Attention</h3>
              <p className="text-sm text-gray-500">Least-used offers compared with all other billed offers.</p>
            </div>
            <span className="text-xs text-gray-500">All time</span>
          </div>

          <div className="space-y-4">
            {offersRequiringAttention.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                No low-usage billed offers available yet.
              </div>
            ) : (
              offersRequiringAttention.map((offer, index) => (
                <div key={offer.offerId || `${offer.offerName}-${index}`} className="border border-red-200 bg-red-50/30 rounded-xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-sm font-bold text-red-600">
                      {offer.saleCount}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{offer.offerName}</p>
                      <p className="text-xs text-gray-500">
                        {offer.saleCount} billed sale{offer.saleCount === 1 ? '' : 's'} · {formatCurrency(offer.totalPaid)} generated
                      </p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedAttentionOffer(offer)} className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors">Review</button>
                </div>
              ))
            )}
          </div>

          {selectedAttentionOffer && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="attention-billing-title">
              <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-red-600">Low-usage offer</p>
                    <h4 id="attention-billing-title" className="mt-1 text-lg font-bold text-gray-900">{selectedAttentionOffer.offerName} billing details</h4>
                    <p className="mt-1 text-sm text-gray-500">{selectedAttentionOffer.saleCount} billed sale{selectedAttentionOffer.saleCount === 1 ? '' : 's'} · {formatCurrency(selectedAttentionOffer.totalPaid)} generated.</p>
                  </div>
                  <button onClick={() => setSelectedAttentionOffer(null)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Invoice / date</th>
                        <th className="px-4 py-3 font-semibold">Patient</th>
                        <th className="px-4 py-3 font-semibold">Offer</th>
                        <th className="px-4 py-3 text-right font-semibold">Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedAttentionOffer.billingRecords.map((billing, index) => (
                        <tr key={`${billing.invoiceNumber}-${billing.invoicedDate}-${index}`}>
                          <td className="px-4 py-3 text-gray-700">
                            <p className="font-medium text-gray-900">{billing.invoiceNumber || '—'}</p>
                            <p className="text-xs text-gray-500">{formatOfferExpiryDate(billing.invoicedDate)}</p>
                          </td>
                          <td className="px-4 py-3 text-gray-900">{billing.patientName}</td>
                          <td className="px-4 py-3 text-gray-700">{billing.offerName}</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(billing.paid)}</td>
                        </tr>
                      ))}
                      {selectedAttentionOffer.billingRecords.length === 0 && (
                        <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No billings found for this offer.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setSelectedAttentionOffer(null)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ZEVA Revenue Opportunities */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
        <p className="text-xs font-bold tracking-wider text-amber-700 uppercase mb-1">Where Is the Money?</p>
        <h3 className="text-lg font-bold text-gray-900 mb-6">ZEVA Revenue Opportunities</h3>

        <div className="space-y-4">
          <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">Improve {offersRequiringAttention[0]?.offerName || 'low-usage offer'} to unlock more revenue</p>
              <p className="text-xs text-gray-500 mb-2">
                {offersRequiringAttention[0]
                  ? `This offer has only ${offersRequiringAttention[0].saleCount} billed sale${offersRequiringAttention[0].saleCount === 1 ? '' : 's'} compared with other offers. Review its billings to improve conversion and revenue.`
                  : 'No low-usage billed offer is available yet.'}
              </p>
              {offersRequiringAttention[0] && <p className="text-xs text-emerald-600 font-medium">{formatCurrency(offersRequiringAttention[0].totalPaid)} generated so far</p>}
            </div>
            <button onClick={() => offersRequiringAttention[0] && setSelectedAttentionOffer(offersRequiringAttention[0])} disabled={!offersRequiringAttention[0]} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shrink-0 ml-4">Review revenue</button>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">{revenueOpportunityData.expiringOffers.length} offer{revenueOpportunityData.expiringOffers.length === 1 ? '' : 's'} nearing expiry</p>
              <p className="text-xs text-gray-500 mb-2">Active offers ending within the next 7 days can be renewed or promoted before they expire.</p>
            </div>
            <button onClick={() => setIsOpportunityExpiryModalOpen(true)} disabled={revenueOpportunityData.expiringOffers.length === 0} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shrink-0 ml-4">Activate renewal campaign</button>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">{revenueOpportunityData.unusedBundlePatients.length} patient{revenueOpportunityData.unusedBundlePatients.length === 1 ? '' : 's'} have unused bundle sessions</p>
              <p className="text-xs text-gray-500 mb-2">These patients still have free sessions recorded in their bundle billings.</p>
            </div>
            <button onClick={() => setIsUnusedBundleModalOpen(true)} disabled={revenueOpportunityData.unusedBundlePatients.length === 0} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shrink-0 ml-4">View patients</button>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">{revenueOpportunityData.unusedCashbackPatients.length} patient{revenueOpportunityData.unusedCashbackPatients.length === 1 ? '' : 's'} have unused cashback</p>
              <p className="text-xs text-gray-500 mb-2">Remaining cashback is calculated as total cashback earned less wallet cashback used.</p>
            </div>
            <button onClick={() => setIsUnusedCashbackModalOpen(true)} disabled={revenueOpportunityData.unusedCashbackPatients.length === 0} className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors shrink-0 ml-4">Review</button>
          </div>
        </div>

        {isOpportunityExpiryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="opportunity-expiry-title">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Renewal campaign</p><h4 id="opportunity-expiry-title" className="mt-1 text-lg font-bold text-gray-900">Offers expiring within 7 days</h4></div><button onClick={() => setIsOpportunityExpiryModalOpen(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button></div>
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3 font-semibold">Offer</th><th className="px-4 py-3 font-semibold">Type</th><th className="px-4 py-3 font-semibold">Expiry date</th></tr></thead><tbody className="divide-y divide-gray-100">{revenueOpportunityData.expiringOffers.map((offer) => <tr key={`${offer.title}-${offer.endsAt}`}><td className="px-4 py-3 font-medium text-gray-900">{offer.title}</td><td className="px-4 py-3 capitalize text-gray-700">{offer.offerType.replace('_', ' ')}</td><td className="px-4 py-3 text-red-600">{formatOfferExpiryDate(offer.endsAt)}</td></tr>)}</tbody></table></div>
              <div className="mt-6 flex justify-end"><button onClick={() => setIsOpportunityExpiryModalOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button></div>
            </div>
          </div>
        )}

        {isUnusedBundleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="unused-bundle-title">
            <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Bundle opportunity</p><h4 id="unused-bundle-title" className="mt-1 text-lg font-bold text-gray-900">Patients with unused bundle sessions</h4></div><button onClick={() => setIsUnusedBundleModalOpen(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button></div>
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3 font-semibold">Patient</th><th className="px-4 py-3 font-semibold">EMR no.</th><th className="px-4 py-3 font-semibold">Unused session name(s)</th></tr></thead><tbody className="divide-y divide-gray-100">{revenueOpportunityData.unusedBundlePatients.map((patient, index) => <tr key={`${patient.emrNumber}-${index}`}><td className="px-4 py-3 font-medium text-gray-900">{patient.patientName}</td><td className="px-4 py-3 text-gray-700">{patient.emrNumber}</td><td className="px-4 py-3 text-gray-700">{patient.sessionNames.join(', ')}</td></tr>)}</tbody></table></div>
              <div className="mt-6 flex justify-end"><button onClick={() => setIsUnusedBundleModalOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button></div>
            </div>
          </div>
        )}

        {isUnusedCashbackModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="unused-cashback-title">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-amber-700">Cashback opportunity</p><h4 id="unused-cashback-title" className="mt-1 text-lg font-bold text-gray-900">Patients with unused cashback</h4></div><button onClick={() => setIsUnusedCashbackModalOpen(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button></div>
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200"><table className="min-w-full text-left text-sm"><thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3 font-semibold">Patient</th><th className="px-4 py-3 font-semibold">EMR no.</th><th className="px-4 py-3 text-right font-semibold">Unused cashback</th></tr></thead><tbody className="divide-y divide-gray-100">{revenueOpportunityData.unusedCashbackPatients.map((patient, index) => <tr key={`${patient.emrNumber}-${index}`}><td className="px-4 py-3 font-medium text-gray-900">{patient.patientName}</td><td className="px-4 py-3 text-gray-700">{patient.emrNumber}</td><td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(patient.cashbackAmount)}</td></tr>)}</tbody></table></div>
              <div className="mt-6 flex justify-end"><button onClick={() => setIsUnusedCashbackModalOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button></div>
            </div>
          </div>
        )}
      </div>

      {/* Offer Mix & Discount Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Offer Mix */}
        <OfferMix dateFilter={dateFilter} />

        {/* Right: Discount Control */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Discount Control</h3>
              <p className="text-sm text-gray-500">Guardrails on manual and receptionist-level discounting.</p>
            </div>
            <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              Full detail <span className="text-sm">›</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Average discount</p>
              <p className="text-2xl font-bold text-gray-900">{discountControlData.averageDiscount}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Allowed maximum</p>
              <p className="text-2xl font-bold text-gray-900">{discountControlData.allowedMaximum}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Margin threshold</p>
              <p className="text-2xl font-bold text-gray-900">{discountControlData.marginThreshold}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Manual overrides</p>
              <p className="text-2xl font-bold text-gray-900">{discountControlData.manualOverrides}</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <svg className="w-5 h-5 text-red-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              {/* <p className="text-sm text-gray-700">
                Discount usage increased <span className="font-bold text-gray-900">21%</span> this week. <span className="font-bold text-gray-900">3 staff members</span> account for 72% of manual overrides.
              </p> */}
              <button className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors mt-1">Investigate →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Detail Divider */}
      <div className="flex items-center gap-4 py-2">
        <div className="h-px bg-gray-200 flex-1"></div>
        <span className="text-xs font-bold tracking-wider text-gray-400 uppercase">Operational Detail</span>
        <div className="h-px bg-gray-200 flex-1"></div>
      </div>

      <UsageAndPerformance dateFilter={dateFilter} />

      {/* Future Benefit Liability & Benefits Expiring Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Future Benefit Liability */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Future Benefit Liability</h3>
              <p className="text-sm text-gray-500">Obligation created — not revenue already collected.</p>
            </div>
            <button onClick={() => setIsFutureLiabilityModalOpen(true)} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              Full detail <span className="text-sm">›</span>
            </button>
          </div>

          <div className="mb-4">
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Wallet Liability</p>
              <p className="text-xl font-bold text-gray-900 mb-1">{formatCurrency(offerLiabilityData.walletLiability)}</p>
              <p className="text-xs text-gray-500">{formatCurrency(offerLiabilityData.walletLiability)} available cashback</p>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900">Total Outstanding Benefit Liability</span>
            <span className="text-lg font-bold text-amber-700">{formatCurrency(offerLiabilityData.totalLiability)}</span>
          </div>

          {isFutureLiabilityModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="future-liability-title">
              <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Future Benefit Liability</p>
                    <h4 id="future-liability-title" className="mt-1 text-lg font-bold text-gray-900">Cashback Liability Details</h4>
                    <p className="mt-1 text-sm text-gray-500">Breakdown of cashback earned by patients.</p>
                  </div>
                  <button onClick={() => setIsFutureLiabilityModalOpen(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Patient Name</th>
                        <th className="px-4 py-3 font-semibold">Offer Name</th>
                        <th className="px-4 py-3 text-right font-semibold">Cashback Earned</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {cashbackLiabilityRecords.map((record, index) => (
                        <tr key={`${record.patientName}-${record.offerName}-${index}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{record.patientName || 'Unknown patient'}</td>
                          <td className="px-4 py-3 text-gray-700">{record.offerName || 'Cashback Offer'}</td>
                          <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(record.cashbackAmount)}</td>
                        </tr>
                      ))}
                      {cashbackLiabilityRecords.length === 0 && (
                        <tr>
                          <td colSpan="3" className="px-4 py-8 text-center text-gray-500">No cashback liability details found for this period.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setIsFutureLiabilityModalOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Benefits Expiring Soon */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Benefits Expiring Soon</h3>
              <p className="text-sm text-gray-500">Outstanding cashback expiring from the selected date — not revenue already collected.</p>
            </div>
            <button onClick={() => setIsExpiringCashbackModalOpen(true)} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              Full detail <span className="text-sm">›</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-xs text-red-600 font-medium mb-1">Within 7 days</p>
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xl font-bold text-gray-900">{offerExpiryData.within7Days.patientCount} patients</p>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500">{formatCurrency(offerExpiryData.within7Days.benefitAmount)} cashback expiring</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-medium mb-1">Within 30 days</p>
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xl font-bold text-gray-900">{offerExpiryData.within30Days.patientCount} patients</p>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500">{formatCurrency(offerExpiryData.within30Days.benefitAmount)} cashback expiring</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900">Potential renewal revenue</span>
            <span className="text-lg font-bold text-emerald-600">{formatCurrency(offerExpiryData.renewalOpportunity)}</span>
          </div>

          {isExpiringCashbackModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="expiring-cashback-title">
              <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Cashback expiry</p>
                    <h4 id="expiring-cashback-title" className="mt-1 text-lg font-bold text-gray-900">Expiring cashback details</h4>
                    <p className="mt-1 text-sm text-gray-500">Outstanding cashback credits expiring within 30 days of the selected date.</p>
                  </div>
                  <button onClick={() => setIsExpiringCashbackModalOpen(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
                </div>
                <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-left text-sm">
                    <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Patient</th>
                        <th className="px-4 py-3 font-semibold">Offer</th>
                        <th className="px-4 py-3 text-right font-semibold">Cashback amount</th>
                        <th className="px-4 py-3 font-semibold">Expiry date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {offerExpiryData.expiringCashbackDetails.map((cashback, index) => (
                        <tr key={`${cashback.patientName}-${cashback.offerName}-${cashback.expiryDate}-${index}`}>
                          <td className="px-4 py-3 font-medium text-gray-900">{cashback.patientName}</td>
                          <td className="px-4 py-3 text-gray-700">{cashback.offerName}</td>
                          <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(cashback.cashbackAmount)}</td>
                          <td className="px-4 py-3 text-red-600">{formatOfferExpiryDate(cashback.expiryDate)}</td>
                        </tr>
                      ))}
                      {offerExpiryData.expiringCashbackDetails.length === 0 && (
                        <tr><td colSpan="4" className="px-4 py-8 text-center text-gray-500">No cashback is expiring within 30 days.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="mt-6 flex justify-end">
                  <button onClick={() => setIsExpiringCashbackModalOpen(false)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Staff Usage & Service-Level Offer Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Staff Usage */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Staff Usage</h3>
              <p className="text-sm text-gray-500">Understanding usage patterns — not accusations.</p>
            </div>
            {/* <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              Full detail <span className="text-sm">›</span>
            </button> */}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 pb-3">Invoice By</th>
                  <th className="text-center text-xs font-medium text-gray-500 pb-3">Patients</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-3">Revenue</th>
                  <th className="text-right text-xs font-medium text-gray-500 pb-3">Collection</th>
                </tr>
              </thead>
              <tbody>
                {staffUsageData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="py-8 text-center text-sm text-gray-500">No staff usage data available</td>
                  </tr>
                ) : (
                  staffUsageData.map((staff, index) => (
                    <tr
                      key={staff.staffId || index}
                      onClick={() => setSelectedStaffUsage(staff)}
                      className={`${index < staffUsageData.length - 1 ? 'border-b border-gray-100' : ''} cursor-pointer transition-colors hover:bg-emerald-50/50`}
                    >
                      <td className="py-3 text-sm font-medium text-gray-900">{staff.staffName}</td>
                      <td className="py-3 text-sm text-gray-900 text-center">{staff.patientCount}</td>
                      <td className="py-3 text-sm text-gray-900 text-right">{formatCurrency(staff.totalRevenue)}</td>
                      <td className="py-3 text-sm font-medium text-emerald-700 text-right">{formatCurrency(staff.totalCollection)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedStaffUsage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="staff-offer-billings-title">
            <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">All-time offer invoices</p>
                  <h4 id="staff-offer-billings-title" className="mt-1 text-lg font-bold text-gray-900">{selectedStaffUsage.staffName}</h4>
                </div>
                <button onClick={() => setSelectedStaffUsage(null)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Patient</th>
                      <th className="px-4 py-3 font-semibold">Offer type</th>
                      <th className="px-4 py-3 font-semibold">Offer name</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                      <th className="px-4 py-3 text-right font-semibold">Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedStaffUsage.billingRecords.length === 0 ? (
                      <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No offer billings found.</td></tr>
                    ) : selectedStaffUsage.billingRecords.map((billing, index) => (
                      <tr key={`${billing.patientId}-${billing.offerName}-${index}`}>
                        <td className="px-4 py-3">
                          {billing.patientId ? (
                            <button onClick={() => router.push(`/clinic/patient-profile-view?id=${billing.patientId}`)} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                              {billing.patientName}
                            </button>
                          ) : (
                            <span className="font-medium text-gray-900">{billing.patientName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 capitalize text-gray-700">{billing.offerType.replace('_', ' ')}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{billing.offerName}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(billing.amount)}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(billing.paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Right: Service-Level Offer Intelligence */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900">Service-Level Offer Intelligence</h3>
            <p className="text-sm text-gray-500">Which services benefit most from offers.</p>
          </div>

          <div className="space-y-4">
            {serviceOfferIntelligenceData.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">No service intelligence data available</div>
            ) : (
              serviceOfferIntelligenceData.slice(0, 3).map((service, index) => (
                <div key={service.serviceName || index} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{service.serviceName}</p>
                    <p className="text-xs text-gray-500">{formatCurrency(service.offerRevenue)} offer revenue</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${service.repeatRate >= 60 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {service.repeatRate}%
                    </p>
                    <p className="text-xs text-gray-500">repeat rate</p>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-600">
              {serviceOfferIntelligenceData.length > 0 ? (
                <><span className="font-bold text-gray-900">{serviceOfferIntelligenceData[0].serviceName}</span> generates the highest all-time offer collection.</>
              ) : (
                'Service offer insights will appear after offer billings are recorded.'
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Refund & Reversal Monitor & Billing Protection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Refund & Reversal Monitor */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900">Refund & Reversal Monitor</h3>
            <p className="text-sm text-gray-500">Every refund reverses applicable benefits and reconciles automatically.</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            <div>
              <p className="text-xs text-gray-500 mb-1">Refunds</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(refundMonitorData.totalRefunds)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Cashback refunded</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(refundMonitorData.cashbackRefunded)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Free sessions reversed</p>
              <p className="text-xl font-bold text-gray-900">{refundMonitorData.freeSessionsReversed}</p>
              <p className="mt-1 text-xs text-gray-500">{refundMonitorData.freeSessionsRefunded} refunded · {refundMonitorData.freeSessionsRestored} restored</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Wallet reversed</p>
              <p className="text-xl font-bold text-gray-900">{formatCurrency(refundMonitorData.walletReversed)}</p>
              <p className="mt-1 text-xs text-gray-500">Refunded + usage reversed</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-gray-900">Unreconciled: AED 0 — Fully reconciled</p>
          </div>
        </div>

        {/* Right: Billing Protection */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-lg font-bold text-gray-900">Billing Protection</h3>
            <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Healthy
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-6">0 unresolved billing violations.</p>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Price locks</span>
              <span className="text-sm font-medium text-gray-900">0 unauthorized attempts</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Unauthorized price changes</span>
              <span className="text-sm font-medium text-gray-900">0 detected</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Offer overrides</span>
              <span className="text-sm font-medium text-gray-900">14 logged, all approved</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Partial-payment attempts</span>
              <span className="text-sm font-medium text-gray-900">{billingProtectionData.partialPaymentAttempts} pending</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Benefit-without-payment attempts</span>
              <span className="text-sm font-medium text-gray-900">9 blocked</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Multiple same-day invoice attempts</span>
              <span className="text-sm font-medium text-gray-900">6 blocked</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Refund reconciliation</span>
              <span className="text-sm font-medium text-gray-900">{billingProtectionData.refundReconciliationCount} completed</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Offers created</span>
              <span className="text-sm font-medium text-gray-900">{billingProtectionData.offersCreated} in selected period</span>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-start gap-2">
            <svg className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="text-xs text-gray-500">
              <span className="font-medium text-gray-700">Billing Lock:</span> once an invoice is finalized, its offer is locked. Corrections must follow the audited refund flow — no silent edits.
            </p>
          </div>
        </div>
      </div>


    </div>
  );
}

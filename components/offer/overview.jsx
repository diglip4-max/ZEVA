import React from 'react';
import { TrendingUp, TrendingDown, Zap } from 'lucide-react';
import { useOfferDashboard } from '../../hooks/useOfferDashboard';
import { useCurrency } from '@/context/CurrencyContext';
import { getCurrencySymbol } from '@/lib/currencyHelper';

export default function Overview({ dateFilter = 'Today' }) {
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
    serviceOfferIntelligenceData,
    percentChanges,
  } = useOfferDashboard(dateFilter);

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
                <span className="text-sm font-bold text-gray-900">{formatCurrency(offerBillingData.totalOfferRevenue + offerBillingData.instantDiscount.totalDiscount + offerBillingData.cashback.totalCashback)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gray-400 h-2 rounded-full" style={{ width: '100%' }}></div>
              </div>
            </div>

            {/* Discount / Benefit */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Discount / Benefit</span>
                <span className="text-sm font-bold text-amber-600">- {formatCurrency(offerBillingData.instantDiscount.totalDiscount + offerBillingData.cashback.totalCashback)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-amber-600 h-2 rounded-full" style={{ width: `${Math.min(100, ((offerBillingData.instantDiscount.totalDiscount + offerBillingData.cashback.totalCashback) / (offerBillingData.totalOfferRevenue + offerBillingData.instantDiscount.totalDiscount + offerBillingData.cashback.totalCashback || 1)) * 100)}%` }}></div>
              </div>
            </div>

            {/* Net Revenue */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-bold text-gray-900">Net Revenue</span>
                <span className="text-sm font-bold text-emerald-600">{formatCurrency(offerBillingData.totalOfferRevenue)}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${Math.min(100, (offerBillingData.totalOfferRevenue / (offerBillingData.totalOfferRevenue + offerBillingData.instantDiscount.totalDiscount + offerBillingData.cashback.totalCashback || 1)) * 100)}%` }}></div>
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
            <span className="text-4xl font-bold text-white">4.8x</span>
            <span className="text-sm text-gray-300">Offer Efficiency</span>
          </div>
          <p className="text-sm text-gray-300 mb-6 leading-relaxed">
            Every AED 1 of offer benefit generated AED 4.80 in attributed revenue — not incremental revenue, since true incrementality can't be fully isolated yet.
          </p>
          <div className="flex justify-between items-center pt-4 border-t border-gray-700">
            <span className="text-xs text-gray-400">Business value ÷ benefit cost</span>
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
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-start gap-2">
              <span className="text-red-500 text-sm mt-0.5">⚠</span>
              <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">High discount usage.</span> Discount usage increased 24% this week.</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex items-start gap-2">
              <span className="text-amber-500 text-sm mt-0.5">⚠</span>
              <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">Frequent override.</span> 9 manual overrides performed by one staff member.</p>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex items-start gap-2">
              <span className="text-amber-500 text-sm mt-0.5"></span>
              <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">Liability growth.</span> Future benefit liability increased 18% this month.</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-lg px-4 py-3 flex items-start gap-2">
              <span className="text-red-500 text-sm mt-0.5">⚠</span>
              <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">Margin risk.</span> 3 active offers are approaching the configured margin threshold.</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-4 py-3 flex items-start gap-2">
              <span className="text-emerald-500 text-sm mt-0.5">⚠</span>
              <p className="text-sm text-gray-700"><span className="font-bold text-gray-900">Expiry opportunity.</span> AED 9,600 of package benefits expire within 30 days.</p>
            </div>
          </div>

          {/* What Should I Do */}
          <p className="text-xs font-bold tracking-wider text-gray-500 uppercase mb-4">What Should I Do?</p>
          <div className="space-y-3">
            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">1</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Convert 30% Facial Discount into a bundle</p>
                  <p className="text-xs text-gray-500">AED 2,400/month potential improvement</p>
                </div>
              </div>
              <button className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Review</button>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">2</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Reactivate 37 package patients before expiry</p>
                  <p className="text-xs text-gray-500">AED 9,600 potential revenue</p>
                </div>
              </div>
              <button className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Start campaign</button>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-bold text-gray-600">3</div>
                <div>
                  <p className="text-sm font-medium text-gray-900">Review 9 manual overrides from Maria Santos</p>
                  <p className="text-xs text-gray-500">AED 1,800 potential leakage</p>
                </div>
              </div>
              <button className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Investigate</button>
            </div>
          </div>
        </div>

        {/* Right: ZEVA Recommends */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <p className="text-xs font-bold tracking-wider text-amber-700 uppercase mb-1">Intelligence</p>
          <h3 className="text-lg font-bold text-gray-900 mb-6">ZEVA Recommends</h3>

          <div className="space-y-6">
            {/* Recommendation 1 */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-1">Shift this offer from discount to bundle</h4>
              <p className="text-xs text-gray-500 mb-4">30% Facial Discount</p>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Current discount</p>
                  <p className="text-sm font-bold text-gray-900">15%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Est. benefit cost</p>
                  <p className="text-sm font-bold text-gray-900">AED 4,200</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Recommended bundle cost</p>
                  <p className="text-sm font-bold text-gray-900">AED 2,700</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Expected repeat improvement</p>
                  <p className="text-sm font-bold text-emerald-600">+12%</p>
                </div>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                <span className="text-xs font-medium text-emerald-600">+AED 1,500 margin improvement</span>
                <button className="text-xs text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1">
                  Review recommendation <span className="text-sm">→</span>
                </button>
              </div>
            </div>

            {/* Recommendation 2 */}
            <div className="border border-gray-200 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-1">Pause low-retention offer</h4>
              <p className="text-xs text-gray-500 mb-4">30% Weekend Discount</p>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Generated</p>
                  <p className="text-sm font-bold text-gray-900">AED 8,200</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Repeat rate</p>
                  <p className="text-sm font-bold text-red-500">31%</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Comparable bundle</p>
                  <p className="text-sm font-bold text-gray-900">68%</p>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-gray-100">
                <button className="text-xs text-gray-600 hover:text-gray-900 transition-colors flex items-center gap-1">
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
              <p className="text-sm text-gray-500">Ranked by business value, not usage.</p>
            </div>
            <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              View all <span className="text-sm">›</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Offer 1 */}
            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="2"/>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="91, 100" strokeLinecap="round"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">91</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Deep Wellness Bundle</p>
                  <p className="text-xs text-gray-500">AED 21,200 revenue · AED 14,300 repeat</p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Strong performer</span>
            </div>

            {/* Offer 2 */}
            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="2"/>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="87, 100" strokeLinecap="round"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">87</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Buy 5 Get 1 Wellness</p>
                  <p className="text-xs text-gray-500">AED 18,400 revenue · AED 11,200 repeat</p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Strong performer</span>
            </div>

            {/* Offer 3 */}
            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="2"/>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="83, 100" strokeLinecap="round"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">83</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Summer Detox Bundle</p>
                  <p className="text-xs text-gray-500">AED 15,600 revenue · AED 9,100 repeat</p>
                </div>
              </div>
              <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">Strong performer</span>
            </div>
          </div>
        </div>

        {/* Right: Offers Requiring Attention */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Offers Requiring Attention</h3>
              <p className="text-sm text-gray-500">Low repeat rate or margin concern.</p>
            </div>
            <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              View all <span className="text-sm">›</span>
            </button>
          </div>

          <div className="space-y-4">
            {/* Offer 1 */}
            <div className="border border-red-200 bg-red-50/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="2"/>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="52, 100" strokeLinecap="round"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">52</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">30% Facial Discount</p>
                  <p className="text-xs text-gray-500">AED 7,200 revenue · AED 3,100 benefit · Margin concern</p>
                </div>
              </div>
              <button className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors">Review</button>
            </div>

            {/* Offer 2 */}
            <div className="border border-red-200 bg-red-50/30 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="2"/>
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#dc2626" strokeWidth="2" strokeDasharray="58, 100" strokeLinecap="round"/>
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-gray-900">58</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">30% Weekend Discount</p>
                  <p className="text-xs text-gray-500">AED 6,100 revenue · AED 2,400 benefit · Margin concern</p>
                </div>
              </div>
              <button className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors">Review</button>
            </div>
          </div>
        </div>
      </div>

      {/* ZEVA Revenue Opportunities */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
        <p className="text-xs font-bold tracking-wider text-amber-700 uppercase mb-1">Where Is the Money?</p>
        <h3 className="text-lg font-bold text-gray-900 mb-6">ZEVA Revenue Opportunities</h3>

        <div className="space-y-4">
          {/* Opportunity 1 */}
          <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">Convert discount-heavy offers to bundles</p>
              <p className="text-xs text-gray-500 mb-2">3 discount offers show repeat rates under 40%.</p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-gray-500">AED 4,800 discount cost</span>
                <span className="text-emerald-600 font-medium">AED 2,900 bundle benefit cost</span>
              </div>
            </div>
            <button className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0 ml-4">Review recommendation</button>
          </div>

          {/* Opportunity 2 */}
          <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">18 packages nearing expiry</p>
              <p className="text-xs text-gray-500 mb-2">Unused bundle sessions across 4 offers expire within 30 days.</p>
              <p className="text-xs text-emerald-600 font-medium">AED 7,400 potential renewal</p>
            </div>
            <button className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0 ml-4">Activate renewal campaign</button>
          </div>

          {/* Opportunity 3 */}
          <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-gray-900 mb-1">32 patients have unused bundle sessions</p>
              <p className="text-xs text-gray-500 mb-2">These patients paid for sessions they haven't redeemed.</p>
              <p className="text-xs text-emerald-600 font-medium">AED 9,200 potential future visit value</p>
            </div>
            <button className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors shrink-0 ml-4">View patients</button>
          </div>
        </div>
      </div>

      {/* Offer Mix & Discount Control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Offer Mix */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Offer Mix</h3>
              <p className="text-sm text-gray-500">Usage share, benefit cost and repeat revenue by offer type.</p>
            </div>
            <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              Full breakdown <span className="text-sm">›</span>
            </button>
          </div>

          <div className="space-y-5">
            {/* Instant Discount */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-gray-600 text-sm">%</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Instant Discount</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{offerMixData.instantDiscount.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-gray-400 h-2 rounded-full" style={{ width: `${offerMixData.instantDiscount.percentage}%` }}></div>
              </div>
            </div>

            {/* Bundle / Package */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Bundle / Package</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{offerMixData.bundle.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full" style={{ width: `${offerMixData.bundle.percentage}%` }}></div>
              </div>
            </div>

            {/* Cashback / Wallet */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <span className="text-sm font-medium text-gray-900">Cashback / Wallet</span>
                </div>
                <span className="text-sm font-bold text-gray-900">{offerMixData.cashback.percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-amber-600 h-2 rounded-full" style={{ width: `${offerMixData.cashback.percentage}%` }}></div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              <p className="text-xs text-gray-600"><span className="font-bold text-gray-900">Bundle / Package</span> currently produces the strongest repeat revenue.</p>
            </div>
          </div>
        </div>

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
              <p className="text-sm text-gray-700">
                Discount usage increased <span className="font-bold text-gray-900">21%</span> this week. <span className="font-bold text-gray-900">3 staff members</span> account for 72% of manual overrides.
              </p>
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

      {/* Future Benefit Liability & Benefits Expiring Soon */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Future Benefit Liability */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Future Benefit Liability</h3>
              <p className="text-sm text-gray-500">Obligation created — not revenue already collected.</p>
            </div>
            <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              Full detail <span className="text-sm">›</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">Free Session Liability</p>
              <p className="text-xl font-bold text-gray-900 mb-1">{formatCurrency(offerLiabilityData.freeSessionLiability)}</p>
              <p className="text-xs text-gray-500">{offerLiabilityData.freeSessionsRemaining.toLocaleString()} sessions remaining</p>
            </div>
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
        </div>

        {/* Right: Benefits Expiring Soon */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Benefits Expiring Soon</h3>
              <p className="text-sm text-gray-500">Do not label unused free sessions as revenue — this is liability, not revenue.</p>
            </div>
            <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
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
              <p className="text-xs text-gray-500">{formatCurrency(offerExpiryData.within7Days.benefitAmount)} benefit</p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-medium mb-1">Within 30 days</p>
              <div className="flex items-center gap-1 mb-1">
                <p className="text-xl font-bold text-gray-900">{offerExpiryData.within30Days.patientCount} patients</p>
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
              <p className="text-xs text-gray-500">{formatCurrency(offerExpiryData.within30Days.benefitAmount)} benefit</p>
            </div>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-900">Potential renewal opportunity</span>
            <span className="text-lg font-bold text-emerald-600">{formatCurrency(offerExpiryData.renewalOpportunity)}</span>
          </div>
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
            <button className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
              Full detail <span className="text-sm">›</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-xs font-medium text-gray-500 pb-3">Staff</th>
                  <th className="text-center text-xs font-medium text-gray-500 pb-3">Offers</th>
                  <th className="text-center text-xs font-medium text-gray-500 pb-3">Avg Benefit</th>
                  <th className="text-center text-xs font-medium text-gray-500 pb-3">Overrides</th>
                  <th className="text-center text-xs font-medium text-gray-500 pb-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {staffUsageData.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-sm text-gray-500">No staff usage data available</td>
                  </tr>
                ) : (
                  staffUsageData.map((staff, index) => (
                    <tr key={staff.staffId || index} className={index < staffUsageData.length - 1 ? 'border-b border-gray-100' : ''}>
                      <td className="py-3 text-sm font-medium text-gray-900">{staff.staffName}</td>
                      <td className="py-3 text-sm text-gray-900 text-center">{staff.offers}</td>
                      <td className="py-3 text-sm text-gray-900 text-center">{staff.avgBenefit}%</td>
                      <td className="py-3 text-sm text-gray-900 text-center">{staff.overrides}</td>
                      <td className="py-3 text-center">
                        <span className={`text-xs font-medium px-3 py-1 rounded-full border ${
                          staff.status === 'Low' 
                            ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
                            : 'text-red-700 bg-red-50 border-red-100'
                        }`}>
                          {staff.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

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
              serviceOfferIntelligenceData.map((service, index) => (
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
            <p className="text-xs text-gray-600"><span className="font-bold text-gray-900">Bundles</span> perform best for Physiotherapy and Dental.</p>
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
              <p className="text-xl font-bold text-gray-900">AED 4,200</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Benefits reversed</p>
              <p className="text-xl font-bold text-gray-900">AED 1,300</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Free sessions reversed</p>
              <p className="text-xl font-bold text-gray-900">42</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Wallet reversed</p>
              <p className="text-xl font-bold text-gray-900">AED 480</p>
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
              <span className="text-sm font-medium text-gray-900">0 unresolved</span>
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
              <span className="text-sm font-medium text-gray-900">Fully reconciled</span>
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

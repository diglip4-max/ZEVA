import React, { useState } from 'react';
import { useOfferDashboard } from '../../hooks/useOfferDashboard';
import { useCurrency } from '@/context/CurrencyContext';
import { getCurrencySymbol } from '@/lib/currencyHelper';

export default function OfferMix({ dateFilter = 'Today' }) {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || 'AED');
  const { offerMixData, offerBillingData } = useOfferDashboard(dateFilter);
  const [isOfferMixModalOpen, setIsOfferMixModalOpen] = useState(false);

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Offer Mix</h3>
            <p className="text-sm text-gray-500">Usage share, benefit cost and repeat revenue by offer type.</p>
          </div>
          <button onClick={() => setIsOfferMixModalOpen(true)} className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1">
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

      {/* Offer Mix Full Breakdown Modal */}
      {isOfferMixModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm" onClick={() => setIsOfferMixModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-emerald-50 px-6 py-4 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-emerald-800">Offer Mix Breakdown</h2>
                  <p className="text-xs text-emerald-600">Top billing records by offer type</p>
                </div>
              </div>
              <button onClick={() => setIsOfferMixModalOpen(false)} className="w-8 h-8 rounded-full bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 hover:bg-emerald-50 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 p-6">
              {/* Instant Discount */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-gray-100 rounded-lg flex items-center justify-center">
                    <span className="text-gray-600 text-xs font-bold">%</span>
                  </div>
                  <h3 className="text-xs font-bold text-gray-900">Instant Discount</h3>
                  <span className="text-xs text-gray-500">({offerMixData.instantDiscount.percentage}% share)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Patient Name</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Offer Applied</th>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Paid Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {offerBillingData.billingRecords
                        .filter(r => r.offerType === 'instant_discount')
                        .slice(0, 3)
                        .map((record, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-900">{record.patientName || 'Unknown patient'}</td>
                            <td className="px-3 py-1.5 text-gray-600">{record.offerName || 'Offer'}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-900">{formatCurrency(record.paid)}</td>
                          </tr>
                        ))}
                      {offerBillingData.billingRecords.filter(r => r.offerType === 'instant_discount').length === 0 && (
                        <tr><td colSpan="3" className="px-3 py-3 text-center text-gray-400">No records found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Bundle / Package */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-emerald-50 rounded-lg flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-bold text-gray-900">Bundle / Package</h3>
                  <span className="text-xs text-gray-500">({offerMixData.bundle.percentage}% share)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Patient Name</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Offer Applied</th>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Paid Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {offerBillingData.billingRecords
                        .filter(r => r.offerType === 'bundle')
                        .slice(0, 3)
                        .map((record, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-900">{record.patientName || 'Unknown patient'}</td>
                            <td className="px-3 py-1.5 text-gray-600">{record.offerName || 'Offer'}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-900">{formatCurrency(record.paid)}</td>
                          </tr>
                        ))}
                      {offerBillingData.billingRecords.filter(r => r.offerType === 'bundle').length === 0 && (
                        <tr><td colSpan="3" className="px-3 py-3 text-center text-gray-400">No records found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Cashback / Wallet */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-amber-50 rounded-lg flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                  </div>
                  <h3 className="text-xs font-bold text-gray-900">Cashback / Wallet</h3>
                  <span className="text-xs text-gray-500">({offerMixData.cashback.percentage}% share)</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Patient Name</th>
                        <th className="px-3 py-1.5 text-left font-semibold text-gray-600">Offer Applied</th>
                        <th className="px-3 py-1.5 text-right font-semibold text-gray-600">Paid Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {offerBillingData.billingRecords
                        .filter(r => r.offerType === 'cashback')
                        .slice(0, 3)
                        .map((record, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-3 py-1.5 text-gray-900">{record.patientName || 'Unknown patient'}</td>
                            <td className="px-3 py-1.5 text-gray-600">{record.offerName || 'Offer'}</td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-900">{formatCurrency(record.paid)}</td>
                          </tr>
                        ))}
                      {offerBillingData.billingRecords.filter(r => r.offerType === 'cashback').length === 0 && (
                        <tr><td colSpan="3" className="px-3 py-3 text-center text-gray-400">No records found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-100 px-6 py-4 bg-gray-50 flex justify-end">
              <button onClick={() => setIsOfferMixModalOpen(false)} className="px-4 py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

import React, { useState } from 'react';
import { useOfferDashboard } from '../../hooks/useOfferDashboard';
import { useCurrency } from '@/context/CurrencyContext';
import { getCurrencySymbol } from '@/lib/currencyHelper';

export default function PatientValue({ dateFilter = 'Today' }) {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || 'AED');
  const { patientValueData } = useOfferDashboard(dateFilter);
  const [selectedModal, setSelectedModal] = useState(null);

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const pv = patientValueData || {
    higherPercent: 56,
    averageFirstTx: {
      offerUsers: 280,
      offerUsersCount: 0,
      offerRecords: [],
      nonOfferPatients: 250,
      nonOfferPatientsCount: 0,
      nonOfferRecords: [],
    },
    ninetyDayValue: {
      offerUsers: 640,
      offerUsersCount: 0,
      offerRecords: [],
      nonOfferPatients: 410,
      nonOfferPatientsCount: 0,
      nonOfferRecords: [],
    },
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between">
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Patient Value</h3>
        <p className="text-sm text-gray-500 mb-6">
          Offer users generate {pv.higherPercent}% higher 90-day value.
        </p>

        <div className="space-y-6">
          {/* Average first transaction */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">Average first transaction</p>
              <span className="text-[10px] text-gray-400">Click boxes for details</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setSelectedModal({
                  title: 'Average First Transaction — Offer Users',
                  subtitle: `${pv.averageFirstTx.offerUsersCount || 0} unique patient(s) with offer applied`,
                  records: pv.averageFirstTx.offerRecords || [],
                  cardAvg: pv.averageFirstTx.offerUsers,
                  uniquePatientsCount: pv.averageFirstTx.offerUsersCount || 0,
                })}
                className="bg-emerald-50/60 border border-emerald-100/80 rounded-xl p-4 cursor-pointer hover:bg-emerald-100/60 hover:shadow-sm transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-emerald-700">Offer users</p>
                  {pv.averageFirstTx.offerUsersCount > 0 && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                      {pv.averageFirstTx.offerUsersCount} unique pts
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(pv.averageFirstTx.offerUsers)}</p>
              </div>

              <div
                onClick={() => setSelectedModal({
                  title: 'Average First Transaction — Non-Offer Patients',
                  subtitle: `${pv.averageFirstTx.nonOfferPatientsCount || 0} unique patient(s) without offer applied`,
                  records: pv.averageFirstTx.nonOfferRecords || [],
                  cardAvg: pv.averageFirstTx.nonOfferPatients,
                  uniquePatientsCount: pv.averageFirstTx.nonOfferPatientsCount || 0,
                })}
                className="bg-stone-50/70 border border-stone-200/60 rounded-xl p-4 cursor-pointer hover:bg-stone-100/80 hover:shadow-sm transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-500">Non-offer patients</p>
                  {pv.averageFirstTx.nonOfferPatientsCount > 0 && (
                    <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded font-medium">
                      {pv.averageFirstTx.nonOfferPatientsCount} unique pts
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(pv.averageFirstTx.nonOfferPatients)}</p>
              </div>
            </div>
          </div>

          {/* 90-day value */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 font-medium">90-day value</p>
              <span className="text-[10px] text-gray-400">Click boxes for details</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div
                onClick={() => setSelectedModal({
                  title: '90-Day Cumulative Value — Offer Users',
                  subtitle: `${pv.ninetyDayValue.offerUsersCount || 0} unique patient(s) (${pv.ninetyDayValue.offerRecords?.length || 0} invoice(s)) with offer applied`,
                  records: pv.ninetyDayValue.offerRecords || [],
                  cardAvg: pv.ninetyDayValue.offerUsers,
                  uniquePatientsCount: pv.ninetyDayValue.offerUsersCount || 0,
                })}
                className="bg-emerald-50/60 border border-emerald-100/80 rounded-xl p-4 cursor-pointer hover:bg-emerald-100/60 hover:shadow-sm transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-emerald-700">Offer users</p>
                  {pv.ninetyDayValue.offerUsersCount > 0 && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-medium">
                      {pv.ninetyDayValue.offerUsersCount} unique pts
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(pv.ninetyDayValue.offerUsers)}</p>
              </div>

              <div
                onClick={() => setSelectedModal({
                  title: '90-Day Cumulative Value — Non-Offer Patients',
                  subtitle: `${pv.ninetyDayValue.nonOfferPatientsCount || 0} unique patient(s) (${pv.ninetyDayValue.nonOfferRecords?.length || 0} invoice(s)) without offer applied`,
                  records: pv.ninetyDayValue.nonOfferRecords || [],
                  cardAvg: pv.ninetyDayValue.nonOfferPatients,
                  uniquePatientsCount: pv.ninetyDayValue.nonOfferPatientsCount || 0,
                })}
                className="bg-stone-50/70 border border-stone-200/60 rounded-xl p-4 cursor-pointer hover:bg-stone-100/80 hover:shadow-sm transition-all active:scale-[0.99]"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-500">Non-offer patients</p>
                  {pv.ninetyDayValue.nonOfferPatientsCount > 0 && (
                    <span className="text-[10px] bg-stone-200 text-stone-700 px-1.5 py-0.5 rounded font-medium">
                      {pv.ninetyDayValue.nonOfferPatientsCount} unique pts
                    </span>
                  )}
                </div>
                <p className="text-xl font-bold text-gray-900">{formatCurrency(pv.ninetyDayValue.nonOfferPatients)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail Popup Modal */}
      {selectedModal && (() => {
        const totalPaid = (selectedModal.records || []).reduce((sum, r) => sum + Number(r.paid || 0), 0);
        const uniqueCount = selectedModal.uniquePatientsCount || 1;
        const averageVal = uniqueCount > 0 ? Math.round(totalPaid / uniqueCount) : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="patient-value-modal-title">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Patient Value Breakdown</p>
                  <h4 id="patient-value-modal-title" className="mt-1 text-lg font-bold text-gray-900">{selectedModal.title}</h4>
                  <p className="mt-1 text-sm text-gray-500">{selectedModal.subtitle}</p>
                </div>
                <button onClick={() => setSelectedModal(null)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
              </div>

              {/* Summary Stats Bar */}
              <div className="mb-5 grid grid-cols-3 gap-3 rounded-xl bg-gray-50 p-3.5 border border-gray-200/80 text-center">
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Total Paid Amount</p>
                  <p className="text-base font-bold text-gray-900">{formatCurrency(totalPaid)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Unique Patients</p>
                  <p className="text-base font-bold text-gray-900">{selectedModal.uniquePatientsCount || 0}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-0.5">Average Per Patient (Div Card)</p>
                  <p className="text-base font-bold text-emerald-700">{formatCurrency(selectedModal.cardAvg || averageVal)}</p>
                </div>
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Patient Name</th>
                      <th className="px-4 py-3 font-semibold">EMR No.</th>
                      <th className="px-4 py-3 font-semibold">Invoice / Date</th>
                      <th className="px-4 py-3 font-semibold">Offer Applied</th>
                      <th className="px-4 py-3 text-right font-semibold">Paid Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {selectedModal.records.map((record, index) => (
                      <tr key={`${record.invoiceNumber}-${record.invoicedDate}-${index}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-900">{record.patientName}</td>
                        <td className="px-4 py-3 text-gray-600">{record.emrNumber || '—'}</td>
                        <td className="px-4 py-3 text-gray-700">
                          <p className="font-medium text-gray-900">{record.invoiceNumber}</p>
                          <p className="text-xs text-gray-500">{new Date(record.invoicedDate).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          <span>{record.offerName || 'No Offer Applied'}</span>
                          {record.offerType && record.offerType !== 'None' && (
                            <span className="ml-2 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded capitalize">
                              {record.offerType.replace('_', ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(record.paid)}</td>
                      </tr>
                    ))}
                    {selectedModal.records.length === 0 && (
                      <tr>
                        <td colSpan="5" className="px-4 py-8 text-center text-gray-500">No patient billing records found for this selection.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={() => setSelectedModal(null)} className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800">Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

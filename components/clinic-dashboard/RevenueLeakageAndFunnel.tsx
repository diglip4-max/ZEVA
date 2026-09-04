import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface LeakageDetail {
  label: string;
  sublabel?: string;
  amount: number;
  tag?: string;
  patientId?: string;
}

interface Props {
  revenueLeakageData?: {
    unbilledAmount: number;
    unbilledCount: number;
    uncollectedAmount: number;
    uncollectedCount: number;
    missedRebookingCount: number;
    missedRebookingAmount: number;
    packageLeakageAmount: number;
    packageLeakageCount: number;
    totalLeakage: number;
    unbilledDetails: { appointmentId: string; patientId: string; patientName: string; services: string; amount: number; status: string }[];
    uncollectedDetails: { billingId: string; appointmentId: string; patientId: string; patientName: string; amount: number; paid: number; pending: number }[];
    missedRebookingPatients: string[];
    packageLeakageDetails: { patientId: string; patientName: string; mobile: string; packageName: string; masterPrice: number; paidAmount: number; leakage: number }[];
    funnel: {
      leadCount: number;
      bookingCount: number;
      visitCount: number;
      treatmentCount: number;
      packageCount: number;
      repeatVisitCount: number;
      leadPercent: number;
      bookingPercent: number;
      visitPercent: number;
      treatmentPercent: number;
      packagePercent: number;
      repeatPercent: number;
      statusCounts: Record<string, number>;
    };
  };
}

const RevenueLeakageAndFunnel = ({ revenueLeakageData }: Props) => {
  const router = useRouter();
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'unbilled' | 'uncollected' | 'missed' | 'package'>('unbilled');

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const unbilledAmount = revenueLeakageData?.unbilledAmount || 0;
  const unbilledCount = revenueLeakageData?.unbilledCount || 0;
  const uncollectedAmount = revenueLeakageData?.uncollectedAmount || 0;
  const uncollectedCount = revenueLeakageData?.uncollectedCount || 0;
  const missedRebookingCount = revenueLeakageData?.missedRebookingCount || 0;
  const missedRebookingAmount = revenueLeakageData?.missedRebookingAmount || 0;
  const packageLeakageAmount = revenueLeakageData?.packageLeakageAmount || 0;
  const packageLeakageCount = revenueLeakageData?.packageLeakageCount || 0;
  const totalLeakage = revenueLeakageData?.totalLeakage || 0;

  // Funnel data
  const funnel = revenueLeakageData?.funnel;
  const leadCount = funnel?.leadCount || 0;
  const bookingCount = funnel?.bookingCount || 0;
  const visitCount = funnel?.visitCount || 0;
  const treatmentCount = funnel?.treatmentCount || 0;
  const packageCount = funnel?.packageCount || 0;
  const repeatVisitCount = funnel?.repeatVisitCount || 0;
  const leadPercent = funnel?.leadPercent ?? 100;
  const bookingPercent = funnel?.bookingPercent ?? 0;
  const visitPercent = funnel?.visitPercent ?? 0;
  const treatmentPercent = funnel?.treatmentPercent ?? 0;
  const packagePercent = funnel?.packagePercent ?? 0;
  const repeatPercent = funnel?.repeatPercent ?? 0;
  const statusCounts = funnel?.statusCounts || {};

  // Build detail items for modal tabs
  const getTabDetails = (): LeakageDetail[] => {
    switch (activeTab) {
      case 'unbilled':
        return (revenueLeakageData?.unbilledDetails || []).map((d) => ({
          label: `${d.patientName || 'Unknown'} — ${d.services || 'Unknown Service'}`,
          sublabel: `Status: ${d.status}`,
          amount: d.amount,
          tag: 'Unbilled',
          patientId: d.patientId,
        }));
      case 'uncollected':
        return (revenueLeakageData?.uncollectedDetails || []).map((d) => ({
          label: `${d.patientName || 'Unknown'}`,
          sublabel: `Billed: ${formatCurrency(d.amount)} | Paid: ${formatCurrency(d.paid)}`,
          amount: d.pending,
          tag: 'Pending',
          patientId: d.patientId,
        }));
      case 'missed':
        return (revenueLeakageData?.missedRebookingPatients || []).map((pid) => ({
          label: `Patient ID: ${pid.substring(0, 8)}...`,
          amount: missedRebookingCount > 0 ? missedRebookingAmount / missedRebookingCount : 0,
          tag: 'Missed',
          patientId: pid,
        }));
      case 'package':
        return (revenueLeakageData?.packageLeakageDetails || []).map((d) => ({
          label: `${d.patientName} — ${d.packageName}`,
          sublabel: `Package: ${formatCurrency(d.masterPrice)} | Paid: ${formatCurrency(d.paidAmount)}`,
          amount: d.leakage,
          tag: 'Leakage',
          patientId: d.patientId,
        }));
      default:
        return [];
    }
  };

  const tabCounts = {
    unbilled: unbilledCount,
    uncollected: uncollectedCount,
    missed: missedRebookingCount,
    package: packageLeakageCount,
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-8 mt-6 font-sans">
        {/* Revenue Leakage */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-4">Revenue Leakage</h3>
            <h2 className="text-4xl font-bold text-amber-700 mb-8">{formatCurrency(totalLeakage)}</h2>
            
            <div className="flex flex-col mb-8">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Unbilled services <span className="text-xs text-gray-400">({unbilledCount})</span></span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(unbilledAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Uncollected balances <span className="text-xs text-gray-400">({uncollectedCount})</span></span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(uncollectedAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Missed rebooking <span className="text-xs text-gray-400">({missedRebookingCount})</span></span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(missedRebookingAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-600">Package leakage <span className="text-xs text-gray-400">({packageLeakageCount})</span></span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(packageLeakageAmount)}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-sm font-medium text-gray-600">Discount variance</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(0)}</span>
              </div>
            </div>
          </div>

          <button 
            onClick={() => { setModalOpen(true); setActiveTab('unbilled'); }}
            className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-colors"
          >
            Investigate leakage
          </button>
        </div>

        {/* Patient Journey Funnel */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">§13</h3>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Patient Journey Funnel</h2>
            
            <div className="flex flex-col gap-4 mb-8">
              {/* Lead */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700 w-24">Lead</span>
                <div className="flex-1 bg-[#F5F4F0] rounded-md h-6 relative overflow-hidden">
                  <div className="bg-[#427A5B] h-full flex items-center justify-end pr-2 rounded-md" style={{ width: `${Math.min(leadPercent, 100)}%` }}>
                    <span className="text-xs font-bold text-white">{leadCount.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-10 text-right">{leadPercent}%</span>
              </div>
              {/* Booking */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700 w-24">Booking</span>
                <div className="flex-1 bg-[#F5F4F0] rounded-md h-6 relative overflow-hidden">
                  <div className="bg-[#427A5B] h-full flex items-center justify-end pr-2 rounded-md" style={{ width: `${Math.min(bookingPercent, 100)}%` }}>
                    <span className="text-xs font-bold text-white">{bookingCount.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-10 text-right">{bookingPercent}%</span>
              </div>
              {Object.keys(statusCounts).length > 0 && (
                <div className="flex flex-wrap gap-2 ml-28 -mt-2 mb-1">
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <span key={status} className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {status}: {count}
                    </span>
                  ))}
                </div>
              )}
              {/* Visit */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700 w-24">Visit</span>
                <div className="flex-1 bg-[#F5F4F0] rounded-md h-6 relative overflow-hidden">
                  <div className="bg-[#427A5B] h-full flex items-center justify-end pr-2 rounded-md" style={{ width: `${Math.min(visitPercent, 100)}%` }}>
                    <span className="text-xs font-bold text-white">{visitCount.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-10 text-right">{visitPercent}%</span>
              </div>
              {/* Treatment */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700 w-24">Treatment</span>
                <div className="flex-1 bg-[#F5F4F0] rounded-md h-6 relative overflow-hidden">
                  <div className="bg-[#D4A373] h-full flex items-center justify-end pr-2 rounded-md" style={{ width: `${Math.min(treatmentPercent, 100)}%` }}>
                    <span className="text-xs font-bold text-white">{treatmentCount.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-amber-700 w-10 text-right">{treatmentPercent}%</span>
              </div>
              {/* Package */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700 w-24">Package</span>
                <div className="flex-1 bg-[#F5F4F0] rounded-md h-6 relative overflow-hidden">
                  <div className="bg-[#D4A373] h-full flex items-center justify-end pr-2 rounded-md" style={{ width: `${Math.min(packagePercent, 100)}%` }}>
                    <span className="text-xs font-bold text-white">{packageCount.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-10 text-right">{packagePercent}%</span>
              </div>
              {/* Repeat visit */}
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-gray-700 w-24">Repeat visit</span>
                <div className="flex-1 bg-[#F5F4F0] rounded-md h-6 relative overflow-hidden">
                  <div className="bg-[#427A5B] h-full flex items-center justify-end pr-2 rounded-md" style={{ width: `${Math.min(repeatPercent, 100)}%` }}>
                    <span className="text-xs font-bold text-white">{repeatVisitCount.toLocaleString()}</span>
                  </div>
                </div>
                <span className="text-sm font-bold text-gray-900 w-10 text-right">{repeatPercent}%</span>
              </div>
            </div>
          </div>

          {/* <div className="bg-[#FAF6EA] rounded-xl p-4 flex gap-3">
            <div className="text-amber-600 shrink-0 mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            {/* <p className="text-sm text-gray-700 leading-relaxed">
              <span className="font-bold text-gray-900">Biggest growth leak: Consultation → Treatment.</span> Conversion fell from 72% to 61% — estimated monthly impact AED 8,400.
            </p> */}
          </div> 
        {/* </div> */}
      </div>

      {/* Investigation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Revenue Leakage Investigation</h2>
                <p className="text-sm text-gray-500 mt-1">Total leakage: <span className="font-bold text-amber-700">{formatCurrency(totalLeakage)}</span></p>
              </div>
              <button onClick={() => setModalOpen(false)} className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 px-6">
              {([
                { key: 'unbilled' as const, label: 'Unbilled Services', amount: unbilledAmount, count: unbilledCount },
                { key: 'uncollected' as const, label: 'Uncollected', amount: uncollectedAmount, count: uncollectedCount },
                { key: 'missed' as const, label: 'Missed Rebooking', amount: missedRebookingAmount, count: missedRebookingCount },
                { key: 'package' as const, label: 'Package Leakage', amount: packageLeakageAmount, count: packageLeakageCount },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-amber-600 text-amber-700'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                  <span className={`ml-2 text-xs px-1.5 py-0.5 rounded-full ${
                    activeTab === tab.key ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Summary bar */}
              <div className="bg-[#FAF6EA] rounded-xl p-4 mb-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                    {activeTab === 'unbilled' && 'Services not yet billed'}
                    {activeTab === 'uncollected' && 'Billed but pending payment'}
                    {activeTab === 'missed' && 'Rescheduled but not rebooked'}
                    {activeTab === 'package' && 'Package price vs paid difference'}
                  </p>
                  <p className="text-2xl font-bold text-amber-700">{formatCurrency(
                    activeTab === 'unbilled' ? unbilledAmount :
                    activeTab === 'uncollected' ? uncollectedAmount :
                    activeTab === 'missed' ? missedRebookingAmount :
                    packageLeakageAmount
                  )}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Items</p>
                  <p className="text-2xl font-bold text-gray-900">{tabCounts[activeTab]}</p>
                </div>
              </div>

              {/* Detail list */}
              {getTabDetails().length > 0 ? (
                <div className="flex flex-col gap-3">
                  {getTabDetails().map((item, idx) => {
                    const patientName = item.label.split(' — ')[0] || item.label;
                    return (
                      <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">
                            {item.patientId ? (
                              <span
                                className="cursor-pointer hover:text-emerald-700 transition-colors"
                                onClick={() => router.push(`/clinic/patient-profile-view?id=${item.patientId}`)}
                              >
                                {patientName}
                              </span>
                            ) : (
                              patientName
                            )}
                            {item.label.includes(' — ') && <span className="text-gray-500"> — {item.label.split(' — ').slice(1).join(' — ')}</span>}
                          </p>
                          {item.sublabel && <p className="text-xs text-gray-500 mt-0.5">{item.sublabel}</p>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-4">
                          {item.tag && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">{item.tag}</span>
                          )}
                          <span className="text-sm font-bold text-gray-900">{formatCurrency(item.amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <svg className="w-12 h-12 mx-auto text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <p className="text-sm text-gray-400">No items found for this category</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <p className="text-xs text-gray-500">
                Showing {getTabDetails().length} item{getTabDetails().length !== 1 ? 's' : ''}
              </p>
              <button 
                onClick={() => setModalOpen(false)}
                className="bg-[#427A5B] hover:bg-[#366548] text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RevenueLeakageAndFunnel;

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useOfferDashboard } from '../../hooks/useOfferDashboard';
import { useCurrency } from '@/context/CurrencyContext';
import { getCurrencySymbol } from '@/lib/currencyHelper';

function formatOverrideTimestamp(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  const day = d.getDate();
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;

  return `${day} ${month} ${year} — ${hours}:${minutes} ${ampm}`;
}

const sampleManualOverrides = [
  {
    id: '1',
    staffName: 'Maria Santos',
    staffRole: 'agent',
    staffRoleLabel: 'Agent',
    timestamp: '2026-08-27T16:12:00',
    offerName: '30% Facial Discount',
    offerType: 'instant_discount',
    offerId: 'offer-001',
    invoiceNumber: 'INV-2026-08271',
    beforeValue: '20%',
    afterValue: '25%',
    reason: 'Patient loyalty gesture',
    approvedBy: 'Admin — Layla H.',
    patientId: 'pat-001',
    patientName: 'Fatima Al Ali',
    patientEmrNumber: 'EMR-1045',
  },
  {
    id: '2',
    staffName: 'Dr. Ahmed Khalil',
    staffRole: 'doctorStaff',
    staffRoleLabel: 'Doctor Staff',
    timestamp: '2026-08-26T11:05:00',
    offerName: 'Radiant Skin Cashback',
    offerType: 'cashback',
    offerId: 'offer-002',
    invoiceNumber: 'INV-2026-08269',
    beforeValue: 'AED 40',
    afterValue: 'AED 60',
    reason: 'Service delay compensation',
    approvedBy: 'Admin — Layla H.',
    patientId: 'pat-002',
    patientName: 'Noor Hassan',
    patientEmrNumber: 'EMR-2087',
  },
  {
    id: '3',
    staffName: 'Dr. Ahmed Khalil',
    staffRole: 'doctorStaff',
    staffRoleLabel: 'Doctor Staff',
    timestamp: '2026-08-24T14:40:00',
    offerName: 'Buy 5 Get 1 Wellness',
    offerType: 'bundle',
    offerId: 'offer-003',
    invoiceNumber: 'INV-2026-08242',
    beforeValue: 'Buy 5 Get 1',
    afterValue: 'Buy 5 Get 2',
    reason: 'Corporate group booking',
    approvedBy: 'Admin — Omar S.',
    patientId: 'pat-003',
    patientName: 'Salma Kareem',
    patientEmrNumber: 'EMR-3012',
  },
  {
    id: '4',
    staffName: 'Sarah Al Mansoori Clinic',
    staffRole: 'clinic',
    staffRoleLabel: 'Clinic Owner',
    timestamp: '2026-08-22T09:18:00',
    offerName: '30% Weekend Discount',
    offerType: 'instant_discount',
    offerId: 'offer-004',
    invoiceNumber: 'INV-2026-08225',
    beforeValue: '10% receptionist',
    afterValue: '20%',
    reason: 'Patient recovery case',
    approvedBy: 'Admin — Omar S.',
    patientId: 'pat-004',
    patientName: 'Khalid Mahmoud',
    patientEmrNumber: 'EMR-4560',
  },
];

export default function RulesAndControls({ dateFilter = 'Today' }) {
  const router = useRouter();
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || 'AED');
  const {
    loading,
    discountControlData,
    staffUsageData,
    usageProtectionData,
    benefitActivationData,
  } = useOfferDashboard(dateFilter);

  const [manualOverrideRecords, setManualOverrideRecords] = useState(sampleManualOverrides);
  const [selectedStaffUsage, setSelectedStaffUsage] = useState(null);
  const [showHighDiscountPatients, setShowHighDiscountPatients] = useState(false);
  const [selectedOverride, setSelectedOverride] = useState(null);
  const [showAttemptedBeforePaymentList, setShowAttemptedBeforePaymentList] = useState(false);
  const [showBlockedList, setShowBlockedList] = useState(false);
  const [selectedOfferStatus, setSelectedOfferStatus] = useState(null);

  const formatShortDate = (dateInput) => {
    if (!dateInput) return '—';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '—';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusBadge = (status) => {
    const base = 'text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full';
    switch (status) {
      case 'active':
        return `${base} bg-emerald-100 text-emerald-700`;
      case 'paused':
        return `${base} bg-amber-100 text-amber-700`;
      case 'expiry':
      case 'expired':
        return `${base} bg-rose-100 text-rose-700`;
      case 'draft':
        return `${base} bg-gray-100 text-gray-600`;
      default:
        return `${base} bg-gray-100 text-gray-600`;
    }
  };

  const getStatusLabel = (status) => {
    const map = { active: 'Active', paused: 'Paused', expiry: 'Expired', draft: 'Draft', expired: 'Expired' };
    return map[status] || status;
  };

  const formatCurrency = (amount) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const getDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();

    if (dateFilter === 'Today' || !dateFilter) {
      startDate.setHours(0, 0, 0, 0);
      return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
    }

    if (dateFilter === '7 Days') {
      startDate.setDate(startDate.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
    }

    if (dateFilter === '30 Days') {
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);
      return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
    }

    if (dateFilter === 'This Month') {
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
    }

    try {
      const customDate = new Date(dateFilter);
      if (!isNaN(customDate.getTime())) {
        startDate.setTime(customDate.getTime());
        startDate.setHours(0, 0, 0, 0);
        endDate.setTime(customDate.getTime());
        endDate.setHours(23, 59, 59, 999);
        return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
      }
    } catch (e) {
      console.error('Invalid custom date:', dateFilter);
    }

    startDate.setHours(0, 0, 0, 0);
    return { startDate: startDate.toISOString(), endDate: endDate.toISOString() };
  };

  useEffect(() => {
    const fetchManualOverrides = async () => {
      try {
        const token = typeof window !== 'undefined'
          ? localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken') || localStorage.getItem('agentToken') || sessionStorage.getItem('agentToken')
          : null;

        if (!token) return;

        const { startDate, endDate } = getDateRange();
        const clinicId = typeof window !== 'undefined' ? (localStorage.getItem('clinicId') || sessionStorage.getItem('clinicId') || '') : '';
        const queryParams = new URLSearchParams({ startDate, endDate });
        if (clinicId) queryParams.append('clinicId', clinicId);

        const res = await fetch(`/api/clinic/offer-manual-overrides?${queryParams.toString()}`, {
          headers: { Authorization: token ? `Bearer ${token}` : '' },
        }).catch(() => null);

        if (res?.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.records)) {
            setManualOverrideRecords(data.records);
          } else {
            setManualOverrideRecords([]);
          }
        } else {
          setManualOverrideRecords([]);
        }
      } catch (err) {
        setManualOverrideRecords([]);
      }
    };

    fetchManualOverrides();
  }, [dateFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading rules & controls data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-lg font-bold text-gray-900">Rules & Controls</h2>
        <p className="text-sm text-gray-500">Every guardrail protecting margin, billing integrity and fair staff use.</p>
      </div>

      {/* Discount Control - Full Width */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-900">Discount Control</h3>
          <p className="text-xs text-gray-500">Guardrails on manual and receptionist-level discounting.</p>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-5">
          <div>
            <p className="text-xs text-gray-500 mb-1">Average discount</p>
            <p className="text-xl font-bold text-gray-900">{discountControlData.averageDiscount}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Allowed maximum</p>
            <p className="text-xl font-bold text-gray-900">{discountControlData.allowedMaximum}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Margin threshold</p>
            <p className="text-xl font-bold text-gray-900">{discountControlData.marginThreshold}%</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Manual overrides</p>
            <p className="text-xl font-bold text-gray-900">{discountControlData.manualOverrides}</p>
          </div>
        </div>

        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-lg p-4 flex items-start gap-3">
          <svg className="w-4 h-4 text-[#B91C1C] shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {/* <p className="text-xs text-gray-700 leading-relaxed">
            Discount usage increased <span className="font-bold text-gray-900">21%</span> this week.{' '}
            <span className="font-bold text-gray-900">3 staff members</span> account for 72% of{' '}
            <span className="font-bold text-gray-900">manual overrides</span>.{' '}
            <button className="text-xs font-medium text-[#9B2C2C] hover:underline">Investigate →</button>
          </p> */}
        </div>
      </div>

      {/* Staff Usage & Manual Overrides - Two Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Staff Usage - Exact copy from Overview (useOfferDashboard staffUsageData + click modal) */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Staff Usage</h3>
              <p className="text-xs text-gray-500">Understanding usage patterns — not accusations.</p>
            </div>
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

        {/* Staff Usage Billing Modal - Exact copy from Overview */}
        {selectedStaffUsage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="rules-staff-offer-billings-title">
            <div className="w-full max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">All-time offer invoices</p>
                  <h4 id="rules-staff-offer-billings-title" className="mt-1 text-lg font-bold text-gray-900">{selectedStaffUsage.staffName}</h4>
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
                        <td className="px-4 py-3 capitalize text-gray-700">{(billing.offerType || '').replace('_', ' ')}</td>
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

        {/* Right: Manual Overrides */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-sm font-bold text-gray-900">Manual Overrides</h3>
              <p className="text-xs text-gray-500">{manualOverrideRecords.length} this month</p>
            </div>
            <button
              onClick={() => router.push('/audit-log')}
              className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors flex items-center gap-1"
            >
              View audit trail <span className="text-sm">›</span>
            </button>
          </div>

          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {manualOverrideRecords.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-500">No manual overrides recorded for this period.</div>
            ) : (
              manualOverrideRecords.map((record) => (
                <div
                  key={record.id}
                  onClick={() => setSelectedOverride(record)}
                  className="border border-gray-200 rounded-xl p-4 hover:border-gray-300 hover:bg-gray-50/50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-semibold text-gray-900">{record.staffName}</p>
                      {record.staffRoleLabel && (
                        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                          record.staffRole === 'clinic' ? 'bg-purple-100 text-purple-700' :
                          record.staffRole === 'agent' ? 'bg-blue-100 text-blue-700' :
                          record.staffRole === 'doctor' || record.staffRole === 'doctorStaff' ? 'bg-emerald-100 text-emerald-700' :
                          record.staffRole === 'admin' ? 'bg-gray-100 text-gray-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {record.staffRoleLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 font-medium">{formatOverrideTimestamp(record.timestamp)}</p>
                  </div>
                  <p className="text-xs text-gray-700 mb-1 font-medium">{record.offerName}</p>
                  <p className="text-xs mb-1.5">
                    <span className="text-gray-600">{record.beforeValue}</span>
                    <span className="mx-1.5 text-gray-400 font-semibold">→</span>
                    <span className="font-semibold text-amber-700">{record.afterValue}</span>
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Reason: {record.reason} · Approved by {record.approvedBy}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Usage Protection & Benefit Activation Rules - Two Columns (per Figma) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Usage Protection */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900">Usage Protection</h3>
            <p className="text-sm text-gray-500 mt-1">Actively preventing duplicate and exploitative offer use.</p>
          </div>

          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-sm text-gray-500 mb-2">Patient-level usage</p>
              <p className="text-2xl font-bold text-gray-900">{usageProtectionData.patientLevelUsage}</p>
              <p className="text-[10px] text-gray-400 mt-1">instant, bundle & cashback patients</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Blocked duplicate usage</p>
              <p className="text-2xl font-bold text-gray-900">{usageProtectionData.blockedDuplicateUsage}</p>
              <p className="text-[10px] text-gray-400 mt-1">patients with multi-offer multi-invoice</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Same-day duplicate attempts</p>
              <p className="text-2xl font-bold text-gray-900">{usageProtectionData.sameDayDuplicateAttempts}</p>
              <p className="text-[10px] text-gray-400 mt-1">extra offers on same patient-day</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Multiple-invoice attempts</p>
              <p className="text-2xl font-bold text-gray-900">{usageProtectionData.multipleInvoiceAttempts}</p>
              <p className="text-[10px] text-gray-400 mt-1">patients with discount &gt; 20%</p>
              {usageProtectionData.highDiscountPatients && usageProtectionData.highDiscountPatients.length > 0 && (
                <button
                  onClick={() => setShowHighDiscountPatients(true)}
                  className="mt-2 text-[10px] font-medium text-rose-700 hover:text-rose-800 underline"
                >
                  View {usageProtectionData.highDiscountPatients.length} patient{usageProtectionData.highDiscountPatients.length !== 1 ? 's' : ''} →
                </button>
              )}
            </div>
          </div>

          <div className="bg-[#FAFAF7] rounded-xl p-5">
            <p className="text-sm text-gray-600">
              Blocked reason: <span className="text-gray-900">"{usageProtectionData.topBlockedReason}"</span>
            </p>
          </div>
        </div>

        {/* High-discount patient list modal */}
        {showHighDiscountPatients && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="rules-highdiscount-title">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Multiple-invoice attempts · discount &gt; 20%</p>
                  <h4 id="rules-highdiscount-title" className="mt-1 text-lg font-bold text-gray-900">
                    {usageProtectionData.highDiscountPatients?.length || 0} patients flagged
                  </h4>
                </div>
                <button onClick={() => setShowHighDiscountPatients(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
              </div>
              <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Patient</th>
                      <th className="px-4 py-3 font-semibold">Offer</th>
                      <th className="px-4 py-3 text-right font-semibold">Discount %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {!usageProtectionData.highDiscountPatients || usageProtectionData.highDiscountPatients.length === 0 ? (
                      <tr><td colSpan="3" className="px-4 py-8 text-center text-gray-500">No patients above 20% discount.</td></tr>
                    ) : usageProtectionData.highDiscountPatients.map((p, idx) => (
                      <tr key={p.patientId || idx}>
                        <td className="px-4 py-3">
                          {p.patientId ? (
                            <button onClick={() => router.push(`/clinic/patient-profile-view?id=${p.patientId}`)} className="font-medium text-emerald-700 hover:text-emerald-800 hover:underline">
                              {p.patientName}
                            </button>
                          ) : (
                            <span className="font-medium text-gray-900">{p.patientName}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{p.offerName || '—'}</td>
                        <td className="px-4 py-3 text-right font-semibold text-rose-700">{p.discountPercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Right: Benefit Activation Rules */}
        <div className="bg-white rounded-2xl border border-gray-200/80 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] p-6">
          <div className="mb-8">
            <h3 className="text-lg font-bold text-gray-900">Offers Activation Rules</h3>
            <p className="text-sm text-gray-500 mt-1">Offers only activate after the configured payment condition.</p>
          </div>

          {/* <div className="bg-[#FAFAF7] rounded-xl p-5 mb-10 flex items-center gap-3">
            <svg className="w-5 h-5 text-gray-700 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            <p className="text-sm text-gray-900 font-semibold">
              Configured rule: {benefitActivationData.configuredRule}
            </p>
          </div> */}

          {/* Row 1: Attempted & Blocked - clickable */}
         

          {/* Protection Rate with status breakdown */}
          <div className="rounded-xl border border-gray-200 p-4">
            <div className="flex items-baseline justify-between mb-4">
              <p className="text-xs text-gray-500">Protection rate</p>
              {/* <p className="text-2xl font-bold text-[#047857]">{benefitActivationData.protectionRate}%</p> */}
            </div>

            <p className="text-[10px] font-medium uppercase tracking-wider text-gray-400 mb-3">Offer status overview</p>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Paused */}
              <div
                onClick={() => setSelectedOfferStatus('paused')}
                className="cursor-pointer rounded-lg border border-gray-100 bg-amber-50/40 p-3 hover:border-amber-300 hover:bg-amber-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`${getStatusBadge('paused')}`}>Paused</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-amber-700">{benefitActivationData.offerStatusBreakdown?.paused ?? 0}</p>
                  <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Expiry */}
              <div
                onClick={() => setSelectedOfferStatus('expiry')}
                className="cursor-pointer rounded-lg border border-gray-100 bg-rose-50/40 p-3 hover:border-rose-300 hover:bg-rose-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`${getStatusBadge('expiry')}`}>Expiry</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-rose-700">{benefitActivationData.offerStatusBreakdown?.expiry ?? 0}</p>
                  <svg className="w-3 h-3 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Active */}
              <div
                onClick={() => setSelectedOfferStatus('active')}
                className="cursor-pointer rounded-lg border border-gray-100 bg-emerald-50/40 p-3 hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`${getStatusBadge('active')}`}>Active</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-emerald-700">{benefitActivationData.offerStatusBreakdown?.active ?? 0}</p>
                  <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>

              {/* Draft */}
              <div
                onClick={() => setSelectedOfferStatus('draft')}
                className="cursor-pointer rounded-lg border border-gray-100 bg-gray-50/60 p-3 hover:border-gray-300 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`${getStatusBadge('draft')}`}>Draft</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <p className="text-xl font-bold text-gray-700">{benefitActivationData.offerStatusBreakdown?.draft ?? 0}</p>
                  <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Override Detail Modal */}
      {selectedOverride && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="override-detail-title">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-700">Manual Override</p>
                <h4 id="override-detail-title" className="mt-1 text-lg font-bold text-gray-900">
                  Offer Update Details
                </h4>
              </div>
              <button onClick={() => setSelectedOverride(null)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
            </div>

            <div className="space-y-5">
              {/* Who Updated */}
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Updated By</p>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold ${
                    selectedOverride.staffRole === 'clinic' ? 'bg-purple-600' :
                    selectedOverride.staffRole === 'agent' ? 'bg-blue-600' :
                    selectedOverride.staffRole === 'doctor' || selectedOverride.staffRole === 'doctorStaff' ? 'bg-emerald-600' :
                    selectedOverride.staffRole === 'admin' ? 'bg-gray-600' :
                    'bg-indigo-600'
                  }`}>
                    {selectedOverride.staffName?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-gray-900">{selectedOverride.staffName}</p>
                      {selectedOverride.staffRoleLabel && (
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          selectedOverride.staffRole === 'clinic' ? 'bg-purple-100 text-purple-700' :
                          selectedOverride.staffRole === 'agent' ? 'bg-blue-100 text-blue-700' :
                          selectedOverride.staffRole === 'doctor' || selectedOverride.staffRole === 'doctorStaff' ? 'bg-emerald-100 text-emerald-700' :
                          selectedOverride.staffRole === 'admin' ? 'bg-gray-100 text-gray-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {selectedOverride.staffRoleLabel}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{formatOverrideTimestamp(selectedOverride.timestamp)}</p>
                  </div>
                </div>
              </div>

              {/* Which Offer */}
              <div className="bg-gray-50 rounded-xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Offer Updated</p>
                <p className="text-sm font-bold text-gray-900">{selectedOverride.offerName}</p>
                <div className="flex flex-wrap gap-4 mt-3">
                  {selectedOverride.offerType && (
                    <div>
                      <p className="text-[10px] text-gray-500">Type</p>
                      <p className="text-xs font-medium capitalize text-gray-900 mt-0.5">{(selectedOverride.offerType || '').replace('_', ' ')}</p>
                    </div>
                  )}
                  {selectedOverride.offerId && (
                    <div>
                      <p className="text-[10px] text-gray-500">Offer ID</p>
                      <p className="text-xs font-mono text-gray-700 mt-0.5">{selectedOverride.offerId}</p>
                    </div>
                  )}
                  {selectedOverride.invoiceNumber && (
                    <div>
                      <p className="text-[10px] text-gray-500">Invoice</p>
                      <p className="text-xs font-mono text-gray-700 mt-0.5">{selectedOverride.invoiceNumber}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] text-gray-500">Updated Date</p>
                    <p className="text-xs font-medium text-gray-900 mt-0.5">{formatOverrideTimestamp(selectedOverride.timestamp)}</p>
                  </div>
                </div>
              </div>

              {/* Value Change */}
              <div className="bg-amber-50 rounded-xl p-5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-3">Value Change</p>
                <div className="flex items-center gap-6">
                  <div>
                    <p className="text-[10px] text-gray-500">Before</p>
                    <p className="text-lg font-bold text-gray-600 mt-1 line-through">{selectedOverride.beforeValue}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-amber-200 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] text-amber-700 font-semibold">After Override</p>
                    <p className="text-lg font-bold text-amber-800 mt-1">{selectedOverride.afterValue}</p>
                  </div>
                </div>
              </div>

              {/* Patient */}
              {selectedOverride.patientName && (
                <div className="bg-gray-50 rounded-xl p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3">Patient</p>
                  {selectedOverride.patientId ? (
                    <button
                      onClick={() => router.push(`/clinic/patient-profile-view?id=${selectedOverride.patientId}`)}
                      className="flex items-center gap-3 text-left hover:bg-gray-100 rounded-lg p-2 -m-2 transition-colors w-full"
                    >
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
                        {selectedOverride.patientName?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-emerald-700 hover:underline">{selectedOverride.patientName}</p>
                        {selectedOverride.patientEmrNumber && (
                          <p className="text-[10px] text-gray-500 mt-0.5">{selectedOverride.patientEmrNumber}</p>
                        )}
                      </div>
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  ) : (
                    <p className="text-sm font-medium text-gray-900">{selectedOverride.patientName}</p>
                  )}
                </div>
              )}

              {/* Reason & Approval */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-xl p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Reason</p>
                  <p className="text-xs font-medium text-gray-900 leading-relaxed">{selectedOverride.reason}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2">Approved By</p>
                  <p className="text-xs font-bold text-gray-900">{selectedOverride.approvedBy}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attempted Before Payment List Modal */}
      {showAttemptedBeforePaymentList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="attempted-payment-title">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-indigo-700">Benefit Activation</p>
                <h4 id="attempted-payment-title" className="mt-1 text-lg font-bold text-gray-900">
                  Attempted before payment · {benefitActivationData.attemptedBeforePayment} record{benefitActivationData.attemptedBeforePayment !== 1 ? 's' : ''}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Invoices with an offer applied but an outstanding pending balance (partial payment).
                </p>
              </div>
              <button onClick={() => setShowAttemptedBeforePaymentList(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Patient</th>
                    <th className="px-4 py-3 font-semibold">Offer</th>
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">Paid</th>
                    <th className="px-4 py-3 text-right font-semibold">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!benefitActivationData.attemptedBeforePaymentList || benefitActivationData.attemptedBeforePaymentList.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No records found.</td></tr>
                  ) : benefitActivationData.attemptedBeforePaymentList.map((rec, idx) => (
                    <tr key={`${rec.invoiceNumber}-${idx}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{rec.patientName}</td>
                      <td className="px-4 py-3 text-gray-700">{rec.offerName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                        {rec.invoiceNumber || '—'}
                        {rec.invoicedDate && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{formatShortDate(rec.invoicedDate)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(rec.amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatCurrency(rec.paid)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">{formatCurrency(rec.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Blocked List Modal */}
      {showBlockedList && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="blocked-list-title">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Benefit Activation Blocked</p>
                <h4 id="blocked-list-title" className="mt-1 text-lg font-bold text-gray-900">
                  Blocked activations · {benefitActivationData.blocked} record{benefitActivationData.blocked !== 1 ? 's' : ''}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Benefit activation blocked because full payment was not received.
                </p>
              </div>
              <button onClick={() => setShowBlockedList(false)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Patient</th>
                    <th className="px-4 py-3 font-semibold">Offer</th>
                    <th className="px-4 py-3 font-semibold">Invoice</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">Paid</th>
                    <th className="px-4 py-3 text-right font-semibold">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!benefitActivationData.blockedList || benefitActivationData.blockedList.length === 0 ? (
                    <tr><td colSpan="6" className="px-4 py-8 text-center text-gray-500">No records found.</td></tr>
                  ) : benefitActivationData.blockedList.map((rec, idx) => (
                    <tr key={`${rec.invoiceNumber}-${idx}`}>
                      <td className="px-4 py-3 font-medium text-gray-900">{rec.patientName}</td>
                      <td className="px-4 py-3 text-gray-700">{rec.offerName}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-mono">
                        {rec.invoiceNumber || '—'}
                        {rec.invoicedDate && (
                          <div className="text-[10px] text-gray-400 mt-0.5">{formatShortDate(rec.invoicedDate)}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(rec.amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatCurrency(rec.paid)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-700">{formatCurrency(rec.pending)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Offer Status List Modal */}
      {selectedOfferStatus && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="offer-status-title">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${selectedOfferStatus === 'active' ? 'text-emerald-700' : selectedOfferStatus === 'paused' ? 'text-amber-700' : selectedOfferStatus === 'expiry' ? 'text-rose-700' : 'text-gray-600'}`}>
                  {getStatusLabel(selectedOfferStatus)} offers
                </p>
                <h4 id="offer-status-title" className="mt-1 text-lg font-bold text-gray-900">
                  {getStatusLabel(selectedOfferStatus)} ·&nbsp;
                  {benefitActivationData.offersByStatusList?.[selectedOfferStatus]?.length ?? 0}
                  &nbsp;offer{(benefitActivationData.offersByStatusList?.[selectedOfferStatus]?.length ?? 0) !== 1 ? 's' : ''}
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  All offers with status &quot;{getStatusLabel(selectedOfferStatus)}&quot; across the clinic.
                </p>
              </div>
              <button onClick={() => setSelectedOfferStatus(null)} aria-label="Close" className="text-xl leading-none text-gray-500 hover:text-gray-900">×</button>
            </div>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-gray-200">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Offer Name</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Valid From</th>
                    <th className="px-4 py-3 font-semibold">Valid Until</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!benefitActivationData.offersByStatusList?.[selectedOfferStatus] || benefitActivationData.offersByStatusList[selectedOfferStatus].length === 0 ? (
                    <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-500">No {getStatusLabel(selectedOfferStatus).toLowerCase()} offers found.</td></tr>
                  ) : benefitActivationData.offersByStatusList[selectedOfferStatus].map((offer) => (
                    <tr key={offer.offerId}>
                      <td className="px-4 py-3 font-bold text-gray-900">{offer.offerName}</td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadge(offer.status)}>{getStatusLabel(offer.status)}</span>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-600 text-xs">
                        {(offer.offerType || '').replace(/_/g, ' ') || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatShortDate(offer.startsAt)}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatShortDate(offer.endsAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

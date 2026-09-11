import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

const DashboardInsights = ({ priorityData, winBackData, tomorrowBusinessData }: any) => {
  const router = useRouter();
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");

  const [isReactivateModalOpen, setReactivateModalOpen] = useState(false);
  const [isOpenSlotsModalOpen, setOpenSlotsModalOpen] = useState(false);
  const [isRenewPackagesModalOpen, setRenewPackagesModalOpen] = useState(false);
  const [isHotLeadsModalOpen, setHotLeadsModalOpen] = useState(false);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const formatCurrencyK = (amount: number) => {
    if (amount >= 1000) {
      return `${currencySymbol} ${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  const reactivateCount = winBackData?.stats?.find((s: any) => s.label === "30 days")?.count || 0;
  const openSlotsCount = priorityData?.openSlots?.count || 0;
  const renewPackagesCount = priorityData?.packageRenewalsWeek?.count || 0;
  const warmLeadsCount = priorityData?.hotLeads?.count || 0;

  const winBackPatients = winBackData?.patients || [];
  const openSlotsList = priorityData?.openSlots?.list || [];
  const renewPackagesList = priorityData?.packageRenewalsWeek?.list || [];
  const hotLeadsList = priorityData?.hotLeads?.list || [];

  // Tomorrow's Business data
  const totalAppointments = tomorrowBusinessData?.totalAppointments || 0;
  const bookedCount = tomorrowBusinessData?.bookedCount || 0;
  const cancelledCount = tomorrowBusinessData?.cancelledCount || 0;
  const expectedRevenue = tomorrowBusinessData?.expectedRevenue || 0;
  const revenueAtRisk = tomorrowBusinessData?.revenueAtRisk || 0;
  const potentialOpportunity = tomorrowBusinessData?.potentialOpportunity || 0;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mx-8 mt-8 font-sans">
      {/* Signature Insight Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-2">Signature Insight</h3>

          <div className="flex flex-col gap-5 mb-8">
            {/* Item 1: Reactivate patients */}
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
              onClick={() => setReactivateModalOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Reactivate patients</h4>
                  <p className="text-xs text-gray-500">30-day win-back patients</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{reactivateCount}</span>
            </div>

            {/* Item 2: Fill unused capacity */}
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
              onClick={() => setOpenSlotsModalOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Fill unused capacity</h4>
                  <p className="text-xs text-gray-500">Unfilled appointment slots</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{openSlotsCount}</span>
            </div>

            {/* Item 3: Renew packages */}
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
              onClick={() => setRenewPackagesModalOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Renew packages</h4>
                  <p className="text-xs text-gray-500">Package Expiry This Week</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{renewPackagesCount}</span>
            </div>

            {/* Item 4: Hot leads */}
            <div
              className="flex items-center justify-between cursor-pointer hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition-colors"
              onClick={() => setHotLeadsModalOpen(true)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center text-gray-500">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                </div>
                <div>
                  <h4 className="text-sm font-bold text-gray-900">Hot leads need follow-up</h4>
                  <p className="text-xs text-gray-500">Hot leads needing follow-up</p>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-700">{warmLeadsCount}</span>
            </div>
          </div>
        </div>

        <div>
          {/* Progress Bar */}
          <div className="flex h-2 w-full rounded-full overflow-hidden mb-6">
            <div className="bg-[#427A5B]" style={{ width: '32%' }}></div>
            <div className="bg-[#D4A373]" style={{ width: '27%' }}></div>
            <div className="bg-[#5C7C99]" style={{ width: '24%' }}></div>
            <div className="bg-[#A3A3A3]" style={{ width: '17%' }}></div>
          </div>

          <button className="w-full bg-[#3B7B5F] hover:bg-[#326950] text-white font-semibold py-3 rounded-xl transition-colors">
            growth plan
          </button>
        </div>
      </div>

      {/* Forward-Looking Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Forward-Looking</h3>
          <h2 className="text-xl font-bold text-gray-900 mb-6">Tomorrow's Business</h2>

          <div className="grid grid-cols-3 gap-4 mb-8 pb-8 border-b border-gray-100">
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Expected</p>
              <p className="text-2xl font-bold text-gray-900">{totalAppointments}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Confirmed</p>
              <p className="text-2xl font-bold text-emerald-600">{bookedCount}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Cancelled</p>
              <p className="text-2xl font-bold text-red-600">{cancelledCount}</p>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Expected revenue</span>
                <span className="text-[9px] font-bold text-gray-400 border border-gray-200 rounded px-1.5 py-0.5 uppercase tracking-wider">Projected</span>
              </div>
              <span className="text-sm font-bold text-gray-900">{formatCurrencyK(expectedRevenue)}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-600">Revenue at risk</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(revenueAtRisk)}</span>
            </div>

            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-sm font-medium text-gray-600">Unused prime-time slots</span>
              <span className="text-sm font-bold text-gray-900">{openSlotsCount}</span>
            </div>

            <div className="flex justify-between items-center py-2">
              <span className="text-sm font-medium text-gray-600">Potential opportunity</span>
              <span className="text-sm font-bold text-amber-700">{formatCurrency(potentialOpportunity)}</span>
            </div>
          </div>
        </div>

        <button className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold py-3 rounded-xl transition-colors mt-6">
          Prepare tomorrow
        </button>
      </div>
    </div>

    {/* Modal 1: Reactivate Patients (Win-back) */}
    {isReactivateModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl p-6 relative max-h-[90vh] flex flex-col">
          <button
            onClick={() => setReactivateModalOpen(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Reactivate Patients</h2>
          <p className="text-sm text-gray-500 mb-6">{winBackPatients.length} patient{winBackPatients.length === 1 ? "" : "s"} inactive for 30+ days</p>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
            {winBackPatients.length > 0 ? winBackPatients.map((patient: any, index: number) => (
              <div key={`${patient._id || patient.patientId}-${index}`} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                    {(patient.name || patient.patientName || "P")?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p
                      className="font-bold text-gray-900 cursor-pointer hover:text-emerald-700 transition-colors"
                      onClick={() => router.push(`/clinic/patient-profile-view?id=${patient._id || patient.patientId}`)}
                    >
                      {patient.name || patient.patientName || "Unknown"}
                    </p>
                    <p className="text-sm text-gray-500">{patient.phone || patient.mobile || "No contact"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-amber-50 text-amber-700 rounded-lg px-3 py-1 text-sm font-semibold shadow-sm">
                    {patient.lastVisit ? formatDate(patient.lastVisit) : "30+ days ago"}
                  </span>
                </div>
              </div>
            )) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-lg font-medium text-gray-900">All caught up!</p>
                <p className="text-gray-500 mt-1">No patients to reactivate.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Modal 2: Open Slots (Fill Capacity) */}
    {isOpenSlotsModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl p-6 relative max-h-[90vh] flex flex-col">
          <button
            onClick={() => setOpenSlotsModalOpen(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Unfilled Appointment Slots</h2>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
            {openSlotsList.length > 0 ? openSlotsList.map((slot: any, index: number) => (
              <div key={`${slot.doctorId}-${slot.fromTime}-${index}`} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{slot.doctorName || "Doctor"}</p>
                    <p className="text-sm text-gray-500">Available Slot</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-white border border-gray-200 rounded-lg px-4 py-2 font-bold text-gray-900 shadow-sm">
                    {slot.fromTimeDisplay || slot.fromTime}
                  </span>
                </div>
              </div>
            )) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-lg font-medium text-gray-900">Fully Booked!</p>
                <p className="text-gray-500 mt-1">No open slots available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Modal 3: Renew Packages */}
    {isRenewPackagesModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl p-6 relative max-h-[90vh] flex flex-col">
          <button
            onClick={() => setRenewPackagesModalOpen(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Package Expiry This Week</h2>
          <p className="text-sm text-gray-500 mb-6">{renewPackagesList.length} package{renewPackagesList.length === 1 ? "" : "s"} expiring soon</p>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
            {renewPackagesList.length > 0 ? renewPackagesList.map((pkg: any, index: number) => (
              <div key={`${pkg.patientId}-${pkg.packageId}-${index}`} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                    {(pkg.patientName || "P")?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{pkg.patientName || "Unknown"}</p>
                    <p className="text-sm text-gray-500">{pkg.packageName || "Package"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{formatCurrency(pkg.totalPrice || 0)}</p>
                  <span className="inline-block bg-red-50 text-red-700 rounded-lg px-3 py-1 text-xs font-semibold shadow-sm mt-1">
                    Expires {pkg.endDate ? formatDate(pkg.endDate) : "Soon"}
                  </span>
                </div>
              </div>
            )) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-lg font-medium text-gray-900">All clear!</p>
                <p className="text-gray-500 mt-1">No packages expiring this week.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}

    {/* Modal 4: Hot Leads */}
    {isHotLeadsModalOpen && (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl p-6 relative max-h-[90vh] flex flex-col">
          <button
            onClick={() => setHotLeadsModalOpen(false)}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Hot Leads Needing Follow-up</h2>
          <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
            {hotLeadsList.length > 0 ? hotLeadsList.map((lead: any, index: number) => (
              <div key={`${lead._id || lead.leadId}-${index}`} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold shrink-0">
                    {(lead.name || "L")?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{lead.name || "Unknown"}</p>
                    <p className="text-sm text-gray-500">{lead.phone || lead.email || "No contact info"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-block bg-red-50 text-red-700 rounded-lg px-3 py-1 text-sm font-semibold shadow-sm">
                    {lead.followUpAt ? formatDate(lead.followUpAt) : "Follow-up due"}
                  </span>
                </div>
              </div>
            )) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                </div>
                <p className="text-lg font-medium text-gray-900">All caught up!</p>
                <p className="text-gray-500 mt-1">No hot leads need follow-up.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default DashboardInsights;

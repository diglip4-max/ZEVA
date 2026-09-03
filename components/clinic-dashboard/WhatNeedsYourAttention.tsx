import React, { useState } from 'react';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface Props {
  priorityData?: any;
  outstandingBalanceData?: {
    totalPending: number;
    patientCount: number;
    billingCount: number;
    patients: { patientId: string; pendingAmount: number }[];
    billingList: {
      patientName: string;
      doctorName: string;
      appointmentTime: string;
      invoiceNumber: string;
      pendingAmount: number;
      treatment: string;
    }[];
  };
}

const WhatNeedsYourAttention = ({ priorityData, outstandingBalanceData }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");

  const [isAppointmentsModalOpen, setAppointmentsModalOpen] = useState(false);
  const [isOpenSlotsModalOpen, setOpenSlotsModalOpen] = useState(false);
  const [isLeadsModalOpen, setLeadsModalOpen] = useState(false);
  const [isFollowUpsModalOpen, setFollowUpsModalOpen] = useState(false);
  const [isCollectionsModalOpen, setCollectionsModalOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const appointmentsCount = priorityData?.appointments?.count || 0;
  const topAppointment = priorityData?.appointments?.list?.[0];

  const openSlotsCount = priorityData?.openSlots?.count || 0;
  const topSlot = priorityData?.openSlots?.list?.[0];

  const newLeadsCount = priorityData?.newLeads?.count || 0;
  const topLead = priorityData?.newLeads?.list?.[0];

  const followUpsCount = priorityData?.followUps?.count || 0;
  const topFollowUp = priorityData?.followUps?.list?.[0];

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 font-sans mt-8 mx-8">
        {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-1">What Needs Your Attention</h2>
          <p className="text-sm text-gray-500">Automatically prioritized by financial impact, urgency and risk</p>
        </div>
        <span className="text-xs font-semibold text-gray-500 border border-gray-200 rounded px-2 py-1 uppercase tracking-wider">
          5 Items
        </span>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {/* Item 1 */}
        <div className="bg-[#F5F4F0] rounded-xl p-4 flex justify-between items-center group">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-red-600 mt-2 shrink-0"></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {appointmentsCount} appointment{appointmentsCount === 1 ? "" : "s"} need confirmation
                </h3>
                <span className="text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded uppercase tracking-wider">Urgent</span>
              </div>
              <p className="text-sm text-gray-600">
                {topAppointment ? (
                  <>
                    <span className="font-semibold text-gray-900">
                      {topAppointment.patientName} · {topAppointment.fromTimeDisplay || topAppointment.fromTime}
                    </span>
                    {appointmentsCount > 1 && ` +${appointmentsCount - 1} more`}
                  </>
                ) : (
                  "No appointments need confirmation today yet."
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setAppointmentsModalOpen(true)}
            className="flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors shrink-0"
          >
            Review appointments
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Item 2 */}
        <div className="bg-[#F5F4F0] rounded-xl p-4 flex justify-between items-center group">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-red-600 mt-2 shrink-0"></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">{formatCurrency(outstandingBalanceData?.totalPending || 0)} outstanding</h3>
              </div>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{outstandingBalanceData?.patientCount || 0} patient{(outstandingBalanceData?.patientCount || 0) === 1 ? "" : "s"}</span> have unpaid balances.
              </p>
            </div>
          </div>
          <button 
            onClick={() => setCollectionsModalOpen(true)}
            className="flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors shrink-0"
          >
            Review collections
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Item 3 */}
        <div className="bg-[#F5F4F0] rounded-xl p-4 flex justify-between items-center group">
          <div className="flex items-start gap-3">
            <div className="w-2 h-2 rounded-full bg-amber-600 mt-2 shrink-0"></div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {openSlotsCount} open slot{openSlotsCount === 1 ? "" : "s"} unfilled
                </h3>
              </div>
              <p className="text-sm text-gray-600">
                {topSlot ? (
                  <>
                    <span className="font-semibold text-gray-900">
                      {topSlot.doctorName ? `${topSlot.doctorName} · ` : ""}{topSlot.fromTimeDisplay || topSlot.fromTime}
                    </span>
                    {openSlotsCount > 1 && ` +${openSlotsCount - 1} more`}
                  </>
                ) : (
                  "No unfilled slots for this date."
                )}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setOpenSlotsModalOpen(true)}
            className="flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors shrink-0"
          >
            Fill capacity
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>

        {/* Hidden items that show on "Show More" */}
        {showMore && (
          <>
            {/* Item 4: Unanswered Conversations (newLeads) */}
            <div className="bg-[#F5F4F0] rounded-xl p-4 flex justify-between items-center group">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {newLeadsCount} unanswered conversation{newLeadsCount === 1 ? "" : "s"}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {topLead ? (
                      <>
                        <span className="font-semibold text-gray-900">
                          {topLead.name}
                        </span>
                        {newLeadsCount > 1 && ` +${newLeadsCount - 1} more`} waiting on a reply.
                      </>
                    ) : (
                      "All leads have been responded to."
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setLeadsModalOpen(true)}
                className="flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors shrink-0"
              >
                View
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* Item 5: Follow-ups */}
            <div className="bg-[#F5F4F0] rounded-xl p-4 flex justify-between items-center group">
              <div className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-2 shrink-0"></div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {followUpsCount} follow-up{followUpsCount === 1 ? "" : "s"} due today
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600">
                    {topFollowUp ? (
                      <>
                        <span className="font-semibold text-gray-900">
                          {topFollowUp.name}
                        </span>
                        {followUpsCount > 1 && ` +${followUpsCount - 1} more`} to follow up with.
                      </>
                    ) : (
                      "No follow-ups scheduled for today."
                    )}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setFollowUpsModalOpen(true)}
                className="flex items-center gap-1 text-sm font-semibold text-emerald-700 bg-white border border-gray-200 px-4 py-2 rounded-full hover:bg-gray-50 transition-colors shrink-0"
              >
                Check
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      {!showMore && (
        <div className="mt-4 pt-4 border-t border-dashed border-gray-200 flex justify-center">
          <button 
            onClick={() => setShowMore(true)}
            className="text-sm font-semibold text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
          >
            Show 2 more
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      )}
    </div>

      {/* Appointments Modal */}
      {isAppointmentsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl p-6 relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setAppointmentsModalOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Appointments Booked Today</h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-4 custom-scrollbar">
              {priorityData?.appointments?.list?.map((apt: any) => (
                <div key={apt._id} className="border border-gray-100 rounded-xl p-5 hover:shadow-sm transition-shadow flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                        {apt.patientName?.charAt(0) || "P"}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-lg leading-tight">{apt.patientName}</p>
                        <p className="text-sm text-gray-500 font-medium">{apt.patientMobile || "No mobile"}</p>
                      </div>
                    </div>
                    <div className="mt-3 bg-gray-50 rounded-lg px-3 py-2 inline-block">
                      <p className="text-sm text-gray-700 font-medium">
                        {apt.treatmentNames?.length > 0 ? apt.treatmentNames.join(", ") : apt.treatmentName || "Consultation"}
                      </p>
                    </div>
                  </div>
                  <div className="sm:text-right bg-blue-50/50 p-3 rounded-xl min-w-[140px]">
                    <p className="text-sm text-gray-500 mb-1">Time & Doctor</p>
                    <p className="font-bold text-gray-900 text-lg">{apt.fromTimeDisplay || apt.fromTime}</p>
                    <p className="text-sm font-semibold text-emerald-600 mt-1">{apt.doctorName}</p>
                  </div>
                </div>
              ))}
              {(!priorityData?.appointments?.list || priorityData.appointments.list.length === 0) && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-lg font-medium text-gray-900">All caught up!</p>
                  <p className="text-gray-500 mt-1">No appointments booked today.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Open Slots Modal */}
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
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {priorityData?.openSlots?.list?.map((slot: any, index: number) => (
                <div key={`${slot.doctorId}-${slot.fromTime}-${index}`} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold shrink-0">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                     </div>
                     <div>
                       <p className="font-bold text-gray-900">{slot.doctorName}</p>
                       <p className="text-sm text-gray-500">Available Slot</p>
                     </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-white border border-gray-200 rounded-lg px-4 py-2 font-bold text-gray-900 shadow-sm">
                      {slot.fromTimeDisplay || slot.fromTime}
                    </span>
                  </div>
                </div>
              ))}
              {(!priorityData?.openSlots?.list || priorityData.openSlots.list.length === 0) && (
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

      {/* Leads Modal */}
      {isLeadsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl p-6 relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setLeadsModalOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Leads Needing Response</h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
              {priorityData?.newLeads?.list?.map((lead: any, index: number) => (
                <div key={`${lead.phone}-${index}`} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold shrink-0">
                       {lead.name?.charAt(0) || "L"}
                     </div>
                     <div>
                       <p className="font-bold text-gray-900">{lead.name}</p>
                       <p className="text-sm text-gray-500">{lead.phone || lead.email || "No contact info"}</p>
                     </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-blue-50 text-blue-700 rounded-lg px-3 py-1 text-sm font-semibold shadow-sm">
                      Waiting for reply
                    </span>
                  </div>
                </div>
              ))}
              {(!priorityData?.newLeads?.list || priorityData.newLeads.list.length === 0) && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-lg font-medium text-gray-900">Inbox Zero!</p>
                  <p className="text-gray-500 mt-1">All leads have been responded to.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Follow Ups Modal */}
      {isFollowUpsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-xl p-6 relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setFollowUpsModalOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Follow-ups Due Today</h2>
            <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
              {priorityData?.followUps?.list?.map((fu: any, index: number) => (
                <div key={`${fu._id}-${index}`} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-bold shrink-0">
                       <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                     </div>
                     <div>
                       <p className="font-bold text-gray-900">{fu.name}</p>
                       <p className="text-sm text-gray-500">{fu.phone || fu.email || "No contact info"}</p>
                     </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block bg-purple-50 text-purple-700 rounded-lg px-3 py-1 text-sm font-semibold shadow-sm">
                      {fu.followUpAtDisplay || "Today"}
                    </span>
                  </div>
                </div>
              ))}
              {(!priorityData?.followUps?.list || priorityData.followUps.list.length === 0) && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-lg font-medium text-gray-900">All caught up!</p>
                  <p className="text-gray-500 mt-1">No follow-ups due today.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Collections Modal */}
      {isCollectionsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-[100] flex justify-center items-center overflow-y-auto p-4 sm:p-6">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-xl p-6 relative max-h-[90vh] flex flex-col">
            <button 
              onClick={() => setCollectionsModalOpen(false)} 
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full p-2 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Outstanding Collections</h2>
            <p className="text-sm text-gray-500 mb-6">
              {outstandingBalanceData?.patientCount || 0} patient{(outstandingBalanceData?.patientCount || 0) === 1 ? "" : "s"} with unpaid balances totaling{" "}
              <span className="font-semibold text-red-600">{formatCurrency(outstandingBalanceData?.totalPending || 0)}</span>
            </p>
            <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar">
              {outstandingBalanceData?.billingList && outstandingBalanceData.billingList.length > 0 ? (
                <table className="w-full">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Patient</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Doctor</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Time</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Invoice #</th>
                      <th className="text-left py-3 px-2 text-sm font-semibold text-gray-600">Treatment</th>
                      <th className="text-right py-3 px-2 text-sm font-semibold text-gray-600">Pending</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outstandingBalanceData.billingList.map((item, index) => (
                      <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-bold text-xs shrink-0">
                              {item.patientName?.charAt(0) || "P"}
                            </div>
                            <span className="font-medium text-gray-900 text-sm">{item.patientName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-700">{item.doctorName || "-"}</td>
                        <td className="py-3 px-2 text-sm text-gray-700">{item.appointmentTime || "-"}</td>
                        <td className="py-3 px-2">
                          <span className="text-sm font-mono text-gray-600 bg-gray-100 px-2 py-1 rounded">{item.invoiceNumber || "-"}</span>
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-700 max-w-[150px] truncate">{item.treatment || "-"}</td>
                        <td className="py-3 px-2 text-right">
                          <span className="font-semibold text-red-600 text-sm">{formatCurrency(item.pendingAmount)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="sticky bottom-0 bg-white border-t-2 border-gray-200">
                    <tr>
                      <td colSpan={5} className="py-3 px-2 text-sm font-semibold text-gray-900">Total Outstanding</td>
                      <td className="py-3 px-2 text-right">
                        <span className="font-bold text-red-600 text-base">{formatCurrency(outstandingBalanceData?.totalPending || 0)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              ) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <p className="text-lg font-medium text-gray-900">All clear!</p>
                  <p className="text-gray-500 mt-1">No outstanding collections for this date.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default WhatNeedsYourAttention;

import React, { useState } from 'react';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface Props {
  clinicCapacityData?: {
    available: number;
    booked: number;
    utilized: number;
    unused: number;
    primeTime: {
      label: string;
      range: string;
      totalSlots: number;
      booked: number;
      open: number;
      utilization: number;
    }[];
  };
  opportunityData?: {
    totalPotential: number;
    recoveredSoFar: number;
    percentChangeVsYesterday: number;
  };
  liveClinicData?: {
    patientsWaiting: number;
    inTreatment: number;
    delayedAppointments: number;
    practitionersAvailable: number;
    pendingCheckout: number;
    appointmentsHappeningNow: number;
    incompletePatientJourneys: number;
  };
}

const ClinicCapacity = ({ clinicCapacityData, opportunityData, liveClinicData }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");
  const [activeView, setActiveView] = useState<'business' | 'live'>('business');

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const available = clinicCapacityData?.available || 0;
  const booked = clinicCapacityData?.booked || 0;
  const utilized = clinicCapacityData?.utilized || 0;
  const unused = clinicCapacityData?.unused || 0;
  const primeTime = clinicCapacityData?.primeTime || [];
  const totalPotential = opportunityData?.totalPotential || 0;

  // Live Clinic data
  const patientsWaiting = liveClinicData?.patientsWaiting || 0;
  const inTreatment = liveClinicData?.inTreatment || 0;
  const delayedAppointments = liveClinicData?.delayedAppointments || 0;
  const practitionersAvailable = liveClinicData?.practitionersAvailable || 0;
  const pendingCheckout = liveClinicData?.pendingCheckout || 0;
  const appointmentsHappeningNow = liveClinicData?.appointmentsHappeningNow || 0;
  const incompletePatientJourneys = liveClinicData?.incompletePatientJourneys || 0;

  // Color for prime-time bars based on utilization
  const getBarColor = (index: number) => {
    const colors = ['bg-[#427A5B]', 'bg-[#D4A373]', 'bg-[#5C7C99]'];
    return colors[index % colors.length];
  };

  return (
    <div className="mx-8 mt-8 font-sans">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Right Now</h3>
            <h2 className="text-xl font-bold text-gray-900">Clinic Now & Capacity</h2>
          </div>
          <div className="flex items-center bg-[#F5F4F0] rounded-full p-1 border border-gray-200">
            <button
              className={`${activeView === 'business' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'} text-sm font-semibold px-4 py-1.5 rounded-full transition-colors`}
              onClick={() => setActiveView('business')}
            >
              Business View
            </button>
            <button
              className={`${activeView === 'live' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'} text-sm font-semibold px-4 py-1.5 rounded-full transition-colors`}
              onClick={() => setActiveView('live')}
            >
              Live Clinic
            </button>
          </div>
        </div>

        {/* Business View Content */}
        {activeView === 'business' && (
          <>
            {/* Stats Row */}
            <div className="flex items-center gap-8 mb-8 pb-6 border-b border-gray-100">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Available</p>
                <p className="text-2xl font-bold text-gray-900">{available} slots</p>
              </div>
              <div className="h-10 w-px bg-gray-200"></div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Booked</p>
                <p className="text-2xl font-bold text-gray-900">{booked}</p>
              </div>
              <div className="h-10 w-px bg-gray-200"></div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Utilized</p>
                <p className="text-2xl font-bold text-gray-900">{utilized}%</p>
              </div>
              <div className="h-10 w-px bg-gray-200"></div>
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">Unused</p>
                <p className="text-2xl font-bold text-amber-700">{unused}</p>
              </div>
              <div className="h-10 w-px bg-gray-200"></div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Opportunity</p>
                  <span className="text-[9px] font-bold text-gray-400 border border-gray-200 rounded px-1 py-0.5 uppercase tracking-wider">Estimated</span>
                </div>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalPotential)}</p>
              </div>
            </div>

            {/* Prime-time availability */}
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Prime-Time Availability</h4>
              
              <div className="flex flex-col gap-4 mb-6">
                {primeTime.length > 0 ? (
                  primeTime.map((period, index) => (
                    <div key={period.label} className="flex items-center gap-4">
                      <span className="text-sm font-semibold text-gray-600 w-32">{period.range}</span>
                      <div className="flex-1 bg-[#F5F4F0] rounded-full h-3 flex overflow-hidden">
                        <div
                          className={`${getBarColor(index)} h-full rounded-full transition-all duration-500`}
                          style={{ width: `${period.utilization}%` }}
                        ></div>
                      </div>
                      <span className={`text-sm font-bold w-16 text-right ${period.open === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                        {period.open} open
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-400">No prime-time data available for this date.</p>
                  </div>
                )}
              </div>

              {primeTime.length > 0 && unused > 0 && (
                <div className="bg-[#F5F4F0] rounded-lg p-3 px-4">
                  <p className="text-sm text-gray-600">
                    {unused} slot{unused === 1 ? "" : "s"} available across all doctors — see opportunities to fill capacity.
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {/* Live Clinic Content */}
        {activeView === 'live' && (
          <>
            {/* Live Stats Row */}
            <div className="grid grid-cols-4 gap-6 mb-8 pb-6 border-b border-gray-100">
              <div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{patientsWaiting}</p>
                <p className="text-sm text-gray-500">Patients waiting</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{inTreatment}</p>
                <p className="text-sm text-gray-500">In treatment</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-amber-700 mb-1">{delayedAppointments}</p>
                <p className="text-sm text-gray-500">Delayed appointments</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900 mb-1">{practitionersAvailable}</p>
                <p className="text-sm text-gray-500">Practitioners available</p>
              </div>
            </div>

            {/* Live List Items */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between py-4 border-b border-gray-100">
                <span className="text-sm text-gray-600">Pending checkout</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{pendingCheckout} patients</span>
                  <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Not Invoiced</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-4 border-b border-gray-100">
                <span className="text-sm text-gray-600">Appointments happening now</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">{appointmentsHappeningNow}</span>
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">Arrived</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-4">
                <span className="text-sm text-gray-600">Incomplete patient journeys</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-700">{incompletePatientJourneys}</span>
                  <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full"> Not Completed</span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClinicCapacity;

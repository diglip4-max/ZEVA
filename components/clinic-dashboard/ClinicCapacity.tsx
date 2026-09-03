import React from 'react';
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
}

const ClinicCapacity = ({ clinicCapacityData, opportunityData }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const available = clinicCapacityData?.available || 0;
  const booked = clinicCapacityData?.booked || 0;
  const utilized = clinicCapacityData?.utilized || 0;
  const unused = clinicCapacityData?.unused || 0;
  const primeTime = clinicCapacityData?.primeTime || [];
  const totalPotential = opportunityData?.totalPotential || 0;

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
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Right Now</h3>
            <h2 className="text-xl font-bold text-gray-900">Clinic Now & Capacity</h2>
          </div>
          <div className="flex items-center bg-[#F5F4F0] rounded-full p-1 border border-gray-200">
            <button className="bg-white text-gray-900 text-sm font-semibold px-4 py-1.5 rounded-full shadow-sm">
              Business View
            </button>
            {/* <button className="text-gray-500 hover:text-gray-700 text-sm font-semibold px-4 py-1.5 rounded-full transition-colors">
              Live Clinic
            </button> */}
          </div>
        </div>

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
      </div>
    </div>
  );
};

export default ClinicCapacity;

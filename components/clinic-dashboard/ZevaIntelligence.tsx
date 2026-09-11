import React from 'react';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface WeekMetric {
  currentWeek: number;
  previousWeek: number;
  changePercent: number;
}

interface Props {
  zevaIntelligenceData?: {
    revenue: WeekMetric;
    newPatients: WeekMetric;
    repeatVisits: WeekMetric;
    noShows: WeekMetric;
    appointmentBooked?: WeekMetric;
    demandExceeding?: WeekMetric;
    noShowAnomaly?: { trend: string; percent: number; currentCount: number; previousCount: number };
    topServiceAnomaly?: { serviceName: string | null; percent: number; trend: string; currentRevenue: number; previousRevenue: number; bookingCount: number };
    decreasingServiceAnomaly?: { serviceName: string | null; percent: number; currentAvg: number; previousAvg: number };
  };
}

const ZevaIntelligence = ({ zevaIntelligenceData }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || "AED");

  const revenue = zevaIntelligenceData?.revenue;
  const newPatients = zevaIntelligenceData?.newPatients;
  const repeatVisits = zevaIntelligenceData?.repeatVisits;
  const noShows = zevaIntelligenceData?.noShows;
  const appointmentBooked = zevaIntelligenceData?.appointmentBooked;
  const demandExceeding = zevaIntelligenceData?.demandExceeding;
  const noShowAnomaly = zevaIntelligenceData?.noShowAnomaly || { trend: "neutral", percent: 0, currentCount: 0, previousCount: 0 };
  const topServiceAnomaly = zevaIntelligenceData?.topServiceAnomaly || { serviceName: null, percent: 0, trend: "below", currentRevenue: 0, previousRevenue: 0, bookingCount: 0 };
  const decreasingServiceAnomaly = zevaIntelligenceData?.decreasingServiceAnomaly || { serviceName: null, percent: 0, currentAvg: 0, previousAvg: 0 };

  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const renderChange = (changePercent: number, invertColor?: boolean) => {
    const isPositive = changePercent >= 0;
    const arrow = isPositive ? '↑' : '↓';
    // For no-shows, increase is bad (red), decrease is good (green)
    const isGood = invertColor ? !isPositive : isPositive;
    const color = isGood ? 'text-emerald-700' : 'text-red-600';
    return { text: `${arrow} ${Math.abs(changePercent)}%`, color };
  };

  // For metrics where value > 0 = green ↑, value = 0 = red ↓
  const renderValueIndicator = (currentValue: number) => {
    if (currentValue > 0) {
      return { text: `↑ ${currentValue}%`, color: 'text-emerald-700' };
    }
    return { text: '↓ 0%', color: 'text-red-600' };
  };

  const revenueChange = renderChange(revenue?.changePercent || 0);
  const newPatientsChange = renderChange(newPatients?.changePercent || 0);
  const repeatVisitsChange = renderChange(repeatVisits?.changePercent || 0);
  const noShowsChange = renderChange(noShows?.changePercent || 0, true); // invert: up=bad, down=good
  const appointmentBookedIndicator = renderValueIndicator(appointmentBooked?.currentWeek || 0);
  const demandExceedingIndicator = renderValueIndicator(demandExceeding?.currentWeek || 0);
  return (
    <div className="mx-8 mt-12 mb-12 font-sans">
      {/* Divider */}
      <div className="flex items-center gap-4 mb-8">
        <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider whitespace-nowrap">ZEVA Intelligence</h3>
        <div className="h-px bg-gray-200 w-full"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* What Changed? */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Since Last Week</h3>
            <h2 className="text-xl font-bold text-gray-900 mb-8">What Changed?</h2>
            
            <div className="grid grid-cols-4 gap-y-8 gap-x-4 mb-8">
              {/* Row 1 */}
              <div>
                <p className={`text-lg font-bold mb-1 ${revenueChange.color}`}>{revenueChange.text}</p>
                <p className="text-[10px] text-gray-500">Revenue</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{formatCurrency(revenue?.currentWeek || 0)}</p>
              </div>
              <div>
                <p className={`text-lg font-bold mb-1 ${newPatientsChange.color}`}>{newPatientsChange.text}</p>
                <p className="text-[10px] text-gray-500">New patients</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{newPatients?.currentWeek || 0} this week</p>
              </div>
              <div>
                <p className={`text-lg font-bold mb-1 ${repeatVisitsChange.color}`}>{repeatVisitsChange.text}</p>
                <p className="text-[10px] text-gray-500">Repeat visits</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{repeatVisits?.currentWeek || 0} patients</p>
              </div>
              <div>
                <p className={`text-lg font-bold mb-1 ${noShowsChange.color}`}>{noShowsChange.text}</p>
                <p className="text-[10px] text-gray-500">No-shows</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{noShows?.currentWeek || 0} this week</p>
              </div>
              
              {/* Row 2 */}
              <div>
                <p className={`text-lg font-bold mb-1 ${appointmentBookedIndicator.color}`}>{appointmentBookedIndicator.text}</p>
                <p className="text-[10px] text-gray-500">Appointments booked</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{appointmentBooked?.currentWeek || 0}% this week</p>
              </div>
              <div>
                <p className={`text-lg font-bold mb-1 ${demandExceedingIndicator.color}`}>{demandExceedingIndicator.text}</p>
                <p className="text-[10px] text-gray-500">Demand exceeding</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{demandExceeding?.currentWeek || 0}% cancelled</p>
              </div>
              <div></div>
              <div></div>
            </div>
          </div>

          <div className="bg-[#EAF1EC] rounded-xl p-4 flex gap-3 items-center mt-2">
            <div className="text-emerald-700 shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
            </div>
            <p className="text-sm font-bold text-emerald-900">
              Revenue increased primarily because of higher new-patient volume, but retention and utilization weakened.
            </p>
          </div>
        </div>

        {/* Zeva Anomalies */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col">
          <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-6">ZEVA Anomalies</h3>
          
          <div className="flex flex-col">
            {/* Anomaly 1: No-show rate */}
            <div className="flex items-start gap-3 py-4 border-b border-gray-100">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 shrink-0"></div>
              <p className="text-sm text-gray-700">
                {noShowAnomaly.trend === "neutral" ? (
                  <>No-show rate is <span className="font-bold text-gray-900">stable</span> compared to last week ({noShowAnomaly.currentCount} today vs {noShowAnomaly.previousCount} previous week).</>
                ) : noShowAnomaly.trend === "higher" ? (
                  <>No-show rate is <span className="font-bold text-gray-900">{noShowAnomaly.percent}% higher</span> than your normal range ({noShowAnomaly.currentCount} today vs {noShowAnomaly.previousCount} previous week).</>
                ) : (
                  <>No-show rate is <span className="font-bold text-gray-900">{noShowAnomaly.percent}% lower</span> than your normal range ({noShowAnomaly.currentCount} today vs {noShowAnomaly.previousCount} previous week).</>
                )}
              </p>
            </div>
            
            {/* Anomaly 2: Top service revenue trend */}
            <div className="flex items-start gap-3 py-4 border-b border-gray-100">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 shrink-0"></div>
              <p className="text-sm text-gray-700">
                {topServiceAnomaly.serviceName ? (
                  <>{topServiceAnomaly.serviceName} revenue is <span className="font-bold text-gray-900">{topServiceAnomaly.percent}% {topServiceAnomaly.trend}</span> its 4-week trend ({topServiceAnomaly.bookingCount} bookings this week).</>
                ) : (
                  <>No top service identified this week.</>
                )}
              </p>
            </div>
            
            {/* Anomaly 3: Decreasing service average bill */}
            <div className="flex items-start gap-3 py-4 border-b border-gray-100">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 shrink-0"></div>
              <p className="text-sm text-gray-700">
                {decreasingServiceAnomaly.serviceName ? (
                  <>Average {decreasingServiceAnomaly.serviceName} bill decreased <span className="font-bold text-gray-900">{decreasingServiceAnomaly.percent}%</span> ({formatCurrency(decreasingServiceAnomaly.previousAvg)} → {formatCurrency(decreasingServiceAnomaly.currentAvg)}).</>
                ) : (
                  <>No service average decrease detected this week.</>
                )}
              </p>
            </div>
            
            {/* <div className="flex items-start gap-3 py-4">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-600 mt-2 shrink-0"></div>
              <p className="text-sm text-gray-700">
                WhatsApp response time increased from <span className="font-bold text-gray-900">8m → 31m</span>.
              </p>
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZevaIntelligence;

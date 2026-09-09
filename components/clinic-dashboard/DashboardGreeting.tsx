import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode';
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

interface Props {
  clinicInfo?: any;
  revenueData?: any;
  opportunityData?: any;
  revenueAtRiskData?: {
    totalAmount: number;
    appointmentCount: number;
    appointmentsWithServicesCount: number;
    statusBreakdown: Record<string, number>;
    currency: string;
  };
  selectedDate?: string;
  onDateChange?: (date: string) => void;
}

const DashboardGreeting = ({ clinicInfo, revenueData, opportunityData, revenueAtRiskData, selectedDate, onDateChange }: Props) => {
  const { currency } = useCurrency();
  const currencySymbol = getCurrencySymbol(currency || 'AED');
  const [userName, setUserName] = useState('Clinic Owner');
  const [greeting, setGreeting] = useState('Good evening');
  const [currentTimeStr, setCurrentTimeStr] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const dateValue = selectedDate || today;

  // Compute percentages dynamically from data
  const totalRevenue = revenueData?.totalRevenue || 0;
  const cashCollection = revenueData?.cashCollection || 0;
  const totalPotential = opportunityData?.totalPotential || 0;
  const recoveredSoFar = opportunityData?.recoveredSoFar || 0;

  // Contribution rate: recovered out of total potential
  const contributionRate = totalPotential > 0
    ? Math.round((recoveredSoFar / totalPotential) * 1000) / 10
    : 0;

  // Collection rate: cash collected out of total revenue
  const collectionRate = totalRevenue > 0
    ? Math.round((cashCollection / totalRevenue) * 1000) / 10
    : 0;

  // Revenue at risk: uncollected portion (used in Cash Collection card)
  const uncollectedAmount = Math.max(totalRevenue - cashCollection, 0);

  // Revenue change (week-over-week) — default to 0 when no prior data
  const revenueChangeRate = revenueData?.changePercent ?? 0;

  // Format currency with dynamic symbol
  const formatCurrency = (amount: number) => {
    return `${currencySymbol} ${(amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const renderPercentage = (value: number | undefined, fallbackText?: string | React.ReactNode) => {
    if (value === undefined) {
      if (fallbackText) {
        return (
          <div className="flex items-center text-emerald-600 text-sm font-medium">
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
            {fallbackText}
          </div>
        );
      }
      return null;
    }
    const isPositive = value >= 0;
    return (
      <div className={`flex items-center text-sm font-medium ${isPositive ? 'text-emerald-600' : 'text-red-600'}`}>
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isPositive ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          )}
        </svg>
        {Math.abs(value).toFixed(1)}%
      </div>
    );
  };

  useEffect(() => {
    // Set dynamic greeting and time
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      if (hour < 12) setGreeting('Good morning');
      else if (hour < 18) setGreeting('Good afternoon');
      else setGreeting('Good evening');

      setCurrentTimeStr(
        now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      );
    };

    updateTime();
    const timer = setInterval(updateTime, 60000); // update every minute

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (clinicInfo?.owner?.name) {
      setUserName(clinicInfo.owner.name);
    } else {
      // Fallback to token
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken') || localStorage.getItem('agentToken') || sessionStorage.getItem('agentToken')
        : null;

      if (token) {
        try {
          const decoded: any = jwtDecode(token);
          if (decoded.name) setUserName(decoded.name);
        } catch (err) {
          console.error('Error decoding token', err);
        }
      }
    }
  }, [clinicInfo]);

  const clinicAddress = clinicInfo?.address || '';

  return (
    <div className="bg-[#FCFBF8] px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 w-full font-sans">
      <div className="mb-4 sm:mb-6 lg:mb-8">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-gray-900 mb-1 sm:mb-2">
          {greeting}, {userName}.
        </h1>
        <div className="flex flex-wrap items-center gap-2 mb-3 sm:mb-4 lg:mb-6">
          <input
            type="date"
            value={dateValue}
            onChange={(e) => onDateChange?.(e.target.value)}
            className="text-xs sm:text-sm text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 outline-none focus:border-emerald-600 shadow-sm cursor-pointer"
          />
          <span className="text-xs sm:text-sm text-gray-500">
            · {currentTimeStr} {clinicAddress ? `· ${clinicAddress}` : ''}
          </span>
        </div>
        <p className="text-gray-700 text-xs sm:text-sm lg:text-base max-w-4xl leading-relaxed">
          Your clinic is performing well today. Revenue is <span className="font-semibold text-gray-900">{revenueChangeRate}% above last week</span>, but <span className="font-semibold text-gray-900">{formatCurrency(opportunityData?.totalPotential || 18700)}</span> remains recoverable from appointments, follow-ups and outstanding payments.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Card 1: Clinic Health */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] lg:min-h-[176px]">
          <div>
            <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Clinic Health</h3>
            <div className="flex items-baseline mb-1">
              <span className="text-2xl sm:text-3xl font-semibold text-gray-900">82</span>
              <span className="text-xs sm:text-sm text-gray-500 ml-1">/100</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500">Healthy</p>
          </div>
          {renderPercentage(3.4)}
        </div>

        {/* Card 2: Revenue */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] lg:min-h-[176px]">
          <div>
            <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Revenue</h3>
            <div className="mb-1">
              <span className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">{formatCurrency(revenueData?.totalRevenue)}</span>
            </div>
          </div>
          {renderPercentage(revenueChangeRate)}
        </div>

        {/* Card 3: Contribution */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] lg:min-h-[176px]">
          <div>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2 sm:mb-3">
              <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider">Contribution</h3>
              <span className="text-[8px] sm:text-[9px] font-semibold text-gray-400 border border-gray-200 rounded px-1 sm:px-1.5 py-0.5 whitespace-nowrap">ESTIMATED</span>
            </div>
            <div className="mb-1">
              <span className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">{formatCurrency(opportunityData?.recoveredSoFar)}</span>
            </div>
          </div>
          {renderPercentage(contributionRate)}
        </div>

        {/* Card 4: Revenue At Risk */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] lg:min-h-[176px]">
          <div>
            <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Revenue At Risk</h3>
            <div className="mb-1">
              <span className="text-lg sm:text-xl lg:text-2xl font-semibold text-red-600">{formatCurrency(revenueAtRiskData?.totalAmount || 0)}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1 leading-snug">
              {revenueAtRiskData?.appointmentCount || 0} appointment{((revenueAtRiskData?.appointmentCount || 0) !== 1) ? 's' : ''} (cancelled, no-show, booked)
            </p>
          </div>
          {renderPercentage((revenueAtRiskData?.totalAmount ?? 0) > 0 && totalRevenue > 0 ? -Math.round(((revenueAtRiskData?.totalAmount ?? 0) / totalRevenue) * 1000) / 10 : undefined)}
        </div>

        {/* Card 5: Revenue Opportunity */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] lg:min-h-[176px]">
          <div>
            <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Revenue Opportunity</h3>
            <div className="mb-1">
              <span className="text-lg sm:text-xl lg:text-2xl font-semibold text-amber-600">{formatCurrency(opportunityData?.totalPotential)}</span>
            </div>
            <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Identified by ZEVA</p>
            <div className="mt-1">
              <span className="text-[8px] sm:text-[9px] font-semibold text-gray-400 border border-gray-200 rounded px-1 sm:px-1.5 py-0.5">ESTIMATED</span>
            </div>
          </div>
          {renderPercentage(opportunityData?.percentChangeVsYesterday, "New today")}
        </div>

        {/* Card 6: Cash Collection */}
        <div className="bg-white rounded-2xl p-3 sm:p-4 lg:p-5 shadow-sm border border-gray-100 flex flex-col justify-between min-h-[140px] sm:min-h-[160px] lg:min-h-[176px]">
          <div>
            <h3 className="text-[10px] sm:text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-3">Cash Collection</h3>
            <div className="mb-1">
              <span className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-900">{formatCurrency(revenueData?.cashCollection)}</span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">Outstanding {formatCurrency(uncollectedAmount)}</p>
          </div>
          {renderPercentage(collectionRate)}
        </div>
      </div>
    </div>
  );
};

export default DashboardGreeting;

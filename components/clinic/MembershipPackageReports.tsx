import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getCurrencySymbol } from '../../lib/currencyHelper';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface MembershipPackageReportsProps {
  clinicId?: string;
  timeRange?: 'today' | 'week' | 'month' | 'overall';
  selectedDate?: Date;
}

interface SummaryStats {
  activeMemberships: { 
    count: number; 
    change: number; 
    items?: { id: string; name: string }[] 
  };
  expiredMemberships: { 
    count: number; 
    change: number; 
    items?: { id: string; name: string }[] 
  };
  activePackages: { 
    count: number; 
    change: number; 
    items?: { id: string; name: string }[] 
  };
  expiredPackages?: { 
    count: number; 
    change: number; 
    items?: { id: string; name: string }[] 
  };
}

interface RevenueData {
  month?: string;
  day?: string;
  date?: string;
  revenue: number;
}

interface PackageUsage {
  packageName: string;
  usagePercentage: number;
  revenue: number;
  sessionsUsed: number;
  color?: string;
}

const MembershipPackageReports: React.FC<MembershipPackageReportsProps> = ({ clinicId, timeRange = 'month', selectedDate }) => {
  const [loading, setLoading] = useState(true);
  const [summaryStats, setSummaryStats] = useState<SummaryStats | null>(null);
  const [membershipRevenue, setMembershipRevenue] = useState<RevenueData[]>([]);
  const [_packageUsage, setPackageUsage] = useState<PackageUsage[]>([]);
  const [packageRevenueMonthWise, setPackageRevenueMonthWise] = useState<RevenueData[]>([]);
  const [clinicCurrency, setClinicCurrency] = useState<string>('INR');
  const [selectedCard, setSelectedCard] = useState<string | null>(null);

  // Helper functions
  const pad2 = (n: number) => n.toString().padStart(2, '0');
  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  const getWeekRangeMondaySunday = (date: Date) => {
    const base = new Date(date);
    base.setHours(0, 0, 0, 0);
    const dayOfWeek = base.getDay();
    const diffToMonday = (dayOfWeek + 6) % 7;
    const start = new Date(base);
    start.setDate(start.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };
  const getMonthRange = (date: Date) => {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };
  const buildDateKeysInRange = (start: Date, end: Date) => {
    const keys: string[] = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(end);
    endDay.setHours(0, 0, 0, 0);
    while (cursor <= endDay) {
      keys.push(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return keys;
  };
  const normalizeRevenueTrendData = (raw: any[], keys: string[]) => {
    const map = new Map<string, any>();
    (raw || []).forEach((item) => {
      if (item?.name) map.set(String(item.name), item);
    });
    return keys.map((key) => ({
      name: key,
      revenue: Number(map.get(key)?.revenue ?? 0),
    }));
  };

  // Fetch clinic currency
  useEffect(() => {
    const fetchClinicCurrency = async () => {
      try {
        const token = 
          localStorage.getItem('clinicToken') || 
          sessionStorage.getItem('clinicToken') ||
          localStorage.getItem('userToken') || 
          sessionStorage.getItem('userToken');
        
        if (!token) return;
        
        const res = await axios.get('/api/clinics/myallClinic', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.data?.success && res.data.clinic?.currency) {
          setClinicCurrency(res.data.clinic.currency);
        }
      } catch (err) {
        console.error('Error fetching clinic currency:', err);
      }
    };
    fetchClinicCurrency();
  }, []);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        setLoading(true);
        // Check for multiple token types (clinicToken, userToken, agentToken, etc.)
        const token = 
          localStorage.getItem('clinicToken') || 
          sessionStorage.getItem('clinicToken') ||
          localStorage.getItem('userToken') || 
          sessionStorage.getItem('userToken') ||
          localStorage.getItem('agentToken') || 
          sessionStorage.getItem('agentToken') ||
          localStorage.getItem('doctorToken') || 
          sessionStorage.getItem('doctorToken') ||
          localStorage.getItem('token');
        
        const storedClinicId = localStorage.getItem('clinic_id') || localStorage.getItem('clinicId');
        
        if (!token) {
          console.warn('No authentication token found');
          setLoading(false);
          return;
        }
        
        // Calculate date range based on filter
        const now = new Date();
        const effectiveDate = selectedDate || now;
        let startDate = new Date(effectiveDate);
        let endDate = new Date(effectiveDate);

        if (timeRange === 'today') {
          // Today - set to start of day
          startDate.setHours(0, 0, 0, 0);
          console.log('📅 Today filter: Current day');
        } else if (timeRange === 'week') {
          const range = getWeekRangeMondaySunday(effectiveDate);
          startDate = range.start;
          endDate = range.end;
          console.log('📅 Week filter: Monday-Sunday calendar week');
        } else if (timeRange === 'month') {
          const range = getMonthRange(effectiveDate);
          startDate = range.start;
          endDate = range.end;
          console.log('📅 Month filter: Full calendar month');
        } else if (timeRange === 'overall') {
          // Overall - use start of year
          startDate = new Date(new Date().getFullYear(), 0, 1);
          startDate.setHours(0, 0, 0, 0);
          console.log('📅 Overall filter: Start of year');
        }

        // Set end time to end of day
        if (timeRange === 'today' || timeRange === 'overall') {
          endDate.setHours(23, 59, 59, 999);
        }

        const startDateParam = toDateKey(startDate);
        const endDateParam = toDateKey(endDate);

        const res = await axios.get('/api/clinic/membership-package-reports', {
          params: {
            clinicId: clinicId || storedClinicId,
            timeRange: timeRange,
            startDate: startDateParam,
            endDate: endDateParam,
          },
          headers: {
            Authorization: `Bearer ${token}`,
            'x-clinic-id': clinicId || storedClinicId || '',
          },
        });

        console.log('✅ Membership reports fetched for timeRange:', timeRange, res.data);

        if (res.data.success) {
          setSummaryStats(res.data.data.summaryStats);
          setMembershipRevenue(res.data.data.membershipRevenue);
          setPackageUsage(res.data.data.packageUsage);
          setPackageRevenueMonthWise(res.data.data.packageRevenueMonthWise || []);
        }
      } catch (error: any) {
        console.error('Error fetching membership and package reports:', error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchReports();
  }, [clinicId, timeRange, selectedDate]);

  // Debug: Log when timeRange changes
  useEffect(() => {
    console.log('📅 MembershipPackageReports - timeRange changed to:', timeRange);
  }, [timeRange]);

  // Create normalized chart data using same logic as Revenue Trend
  const membershipChartData = React.useMemo(() => {
    const raw = membershipRevenue;
    if (timeRange !== 'week' && timeRange !== 'month') return raw;
    const looksLikeDateKey = (v: any) =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const hasDateKeys = raw.some((d: any) => looksLikeDateKey(d?.name));
    if (!hasDateKeys && raw.length > 0) return raw;
    const range =
      timeRange === 'week'
        ? getWeekRangeMondaySunday(selectedDate || new Date())
        : getMonthRange(selectedDate || new Date());
    const keys = buildDateKeysInRange(range.start, range.end);
    return normalizeRevenueTrendData(raw, keys);
  }, [membershipRevenue, timeRange, selectedDate]);

  const packageChartData = React.useMemo(() => {
    const raw = packageRevenueMonthWise;
    if (timeRange !== 'week' && timeRange !== 'month') return raw;
    const looksLikeDateKey = (v: any) =>
      typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
    const hasDateKeys = raw.some((d: any) => looksLikeDateKey(d?.name));
    if (!hasDateKeys && raw.length > 0) return raw;
    const range =
      timeRange === 'week'
        ? getWeekRangeMondaySunday(selectedDate || new Date())
        : getMonthRange(selectedDate || new Date());
    const keys = buildDateKeysInRange(range.start, range.end);
    return normalizeRevenueTrendData(raw, keys);
  }, [packageRevenueMonthWise, timeRange, selectedDate]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mt-9">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          <p className="text-sm text-gray-500 mt-2">Loading membership and package reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-9">
      {/* Section Header */}
      <div className="mb-6">
        <h3 className="text-[18px] md:text-[20px] font-bold text-black">Membership & Package Reports</h3>
        <p className="text-xs md:text-sm text-gray-500 mt-1">Monitor subscriptions, packages, and recurring revenue</p>
      </div>

      {/* Summary Statistics Cards - First Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {/* Active Memberships Card */}
        <div className="relative">
          <div 
            onClick={() => setSelectedCard(prev => prev === 'activeMemberships' ? null : 'activeMemberships')}
            className={`relative overflow-hidden rounded-[20px] bg-gradient-to-br from-green-500 to-green-600 shadow-lg p-5 transition-all hover:shadow-xl cursor-pointer select-none hover:-translate-y-0.5 ${
              selectedCard === 'activeMemberships' ? 'ring-4 ring-green-300 ring-offset-2' : ''
            }`}
          >
            {/* Decorative circular shape in top-right */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              {/* Icon Container */}
              <div className="mb-3">
                <div className="w-11 h-11 rounded-xl bg-green-400/30 backdrop-blur-sm flex items-center justify-center border border-green-300/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-white/90 mb-1.5">Active Memberships</p>
              
              {/* Large Number */}
              <p className="text-[40px] font-bold text-white leading-tight mb-1.5">
                {summaryStats?.activeMemberships.count ?? 0}
              </p>
              
              {/* Growth Indicator */}
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  (summaryStats?.activeMemberships.change ?? 0) >= 0 
                    ? 'text-white' 
                    : 'text-white/80'
                }`}>
                  {(summaryStats?.activeMemberships.change ?? 0) >= 0 ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  )}
                  {Math.abs(summaryStats?.activeMemberships.change ?? 0)}%
                </span>
                <span className="text-xs text-white/80 font-medium">from last month</span>
              </div>
            </div>
          </div>

          {/* Active Memberships Dropdown Popover */}
          {selectedCard === 'activeMemberships' && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white text-black shadow-xl rounded-xl border border-gray-200 p-3 min-w-[260px]">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-800">Active Memberships</span>
                <span className="text-xs text-gray-500 font-semibold">{summaryStats?.activeMemberships.items?.length ?? 0} records</span>
              </div>
              <div className="overflow-y-auto max-h-48 custom-scrollbar pr-1 flex flex-col divide-y divide-gray-100 animate-fadeIn">
                {summaryStats?.activeMemberships.items && summaryStats.activeMemberships.items.length > 0 ? (
                  summaryStats.activeMemberships.items.map((item) => (
                    <div key={item.id} className="h-10 flex items-center text-sm font-semibold text-gray-700 hover:bg-gray-50 px-2 rounded transition-colors" title={item.name}>
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-gray-400">No records</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Expired Memberships Card */}
        <div className="relative">
          <div 
            onClick={() => setSelectedCard(prev => prev === 'expiredMemberships' ? null : 'expiredMemberships')}
            className={`relative overflow-hidden rounded-[20px] bg-gradient-to-br from-red-500 to-red-600 shadow-lg p-5 transition-all hover:shadow-xl cursor-pointer select-none hover:-translate-y-0.5 ${
              selectedCard === 'expiredMemberships' ? 'ring-4 ring-red-300 ring-offset-2' : ''
            }`}
          >
            {/* Decorative circular shape in top-right */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              {/* Icon Container */}
              <div className="mb-3">
                <div className="w-11 h-11 rounded-xl bg-red-400/30 backdrop-blur-sm flex items-center justify-center border border-red-300/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-white/90 mb-1.5">Expired Memberships</p>
              
              {/* Large Number */}
              <p className="text-[40px] font-bold text-white leading-tight mb-1.5">
                {summaryStats?.expiredMemberships.count ?? 0}
              </p>
              
              {/* Growth Indicator */}
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  (summaryStats?.expiredMemberships.change ?? 0) <= 0 
                    ? 'text-white' 
                    : 'text-white/80'
                }`}>
                  {(summaryStats?.expiredMemberships.change ?? 0) <= 0 ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  )}
                  {Math.abs(summaryStats?.expiredMemberships.change ?? 0)}%
                </span>
                <span className="text-xs text-white/80 font-medium">from last month</span>
              </div>
            </div>
          </div>

          {/* Expired Memberships Dropdown Popover */}
          {selectedCard === 'expiredMemberships' && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white text-black shadow-xl rounded-xl border border-gray-200 p-3 min-w-[260px]">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-800">Expired Memberships</span>
                <span className="text-xs text-gray-500 font-semibold">{summaryStats?.expiredMemberships.items?.length ?? 0} records</span>
              </div>
              <div className="overflow-y-auto max-h-48 custom-scrollbar pr-1 flex flex-col divide-y divide-gray-100 animate-fadeIn">
                {summaryStats?.expiredMemberships.items && summaryStats.expiredMemberships.items.length > 0 ? (
                  summaryStats.expiredMemberships.items.map((item) => (
                    <div key={item.id} className="h-10 flex items-center text-sm font-semibold text-gray-700 hover:bg-gray-50 px-2 rounded transition-colors" title={item.name}>
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-gray-400">No records</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Active Packages Card */}
        <div className="relative">
          <div 
            onClick={() => setSelectedCard(prev => prev === 'activePackages' ? null : 'activePackages')}
            className={`relative overflow-hidden rounded-[20px] bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg p-5 transition-all hover:shadow-xl cursor-pointer select-none hover:-translate-y-0.5 ${
              selectedCard === 'activePackages' ? 'ring-4 ring-purple-300 ring-offset-2' : ''
            }`}
          >
            {/* Decorative circular shape in top-right */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              {/* Icon Container */}
              <div className="mb-3">
                <div className="w-11 h-11 rounded-xl bg-purple-400/30 backdrop-blur-sm flex items-center justify-center border border-purple-300/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-white/90 mb-1.5">Active Packages</p>
              
              {/* Large Number */}
              <p className="text-[40px] font-bold text-white leading-tight mb-1.5">
                {summaryStats?.activePackages.count ?? 0}
              </p>
              
              {/* Growth Indicator */}
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  (summaryStats?.activePackages.change ?? 0) >= 0 
                    ? 'text-white' 
                    : 'text-white/80'
                }`}>
                  {(summaryStats?.activePackages.change ?? 0) >= 0 ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  )}
                  {Math.abs(summaryStats?.activePackages.change ?? 0)}%
                </span>
                <span className="text-xs text-white/80 font-medium">from last month</span>
              </div>
            </div>
          </div>

          {/* Active Packages Dropdown Popover */}
          {selectedCard === 'activePackages' && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white text-black shadow-xl rounded-xl border border-gray-200 p-3 min-w-[260px]">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-800">Active Packages</span>
                <span className="text-xs text-gray-500 font-semibold">{summaryStats?.activePackages.items?.length ?? 0} records</span>
              </div>
              <div className="overflow-y-auto max-h-48 custom-scrollbar pr-1 flex flex-col divide-y divide-gray-100 animate-fadeIn">
                {summaryStats?.activePackages.items && summaryStats.activePackages.items.length > 0 ? (
                  summaryStats.activePackages.items.map((item) => (
                    <div key={item.id} className="h-10 flex items-center text-sm font-semibold text-gray-700 hover:bg-gray-50 px-2 rounded transition-colors" title={item.name}>
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-gray-400">No records</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Expired Packages Card */}
        <div className="relative">
          <div 
            onClick={() => setSelectedCard(prev => prev === 'expiredPackages' ? null : 'expiredPackages')}
            className={`relative overflow-hidden rounded-[20px] bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg p-5 transition-all hover:shadow-xl cursor-pointer select-none hover:-translate-y-0.5 ${
              selectedCard === 'expiredPackages' ? 'ring-4 ring-orange-300 ring-offset-2' : ''
            }`}
          >
            {/* Decorative circular shape in top-right */}
            <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
            
            <div className="relative z-10">
              {/* Icon Container */}
              <div className="mb-3">
                <div className="w-11 h-11 rounded-xl bg-orange-400/30 backdrop-blur-sm flex items-center justify-center border border-orange-300/30">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              {/* Title */}
              <p className="text-sm font-medium text-white/90 mb-1.5">Expired Packages</p>
              
              {/* Large Number */}
              <p className="text-[40px] font-bold text-white leading-tight mb-1.5">
                {summaryStats?.expiredPackages?.count ?? 0}
              </p>
              
              {/* Growth Indicator */}
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                  (summaryStats?.expiredPackages?.change ?? 0) <= 0 
                    ? 'text-white' 
                    : 'text-white/80'
                }`}>
                  {(summaryStats?.expiredPackages?.change ?? 0) <= 0 ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  )}
                  {Math.abs(summaryStats?.expiredPackages?.change ?? 0)}%
                </span>
                <span className="text-xs text-white/80 font-medium">from last month</span>
              </div>
            </div>
          </div>

          {/* Expired Packages Dropdown Popover */}
          {selectedCard === 'expiredPackages' && (
            <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-white text-black shadow-xl rounded-xl border border-gray-200 p-3 min-w-[260px]">
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-gray-100">
                <span className="text-xs font-bold text-gray-800">Expired Packages</span>
                <span className="text-xs text-gray-500 font-semibold">{summaryStats?.expiredPackages?.count ?? 0} records</span>
              </div>
              <div className="overflow-y-auto max-h-48 custom-scrollbar pr-1 flex flex-col divide-y divide-gray-100 animate-fadeIn">
                {summaryStats?.expiredPackages?.items && summaryStats.expiredPackages.items.length > 0 ? (
                  summaryStats.expiredPackages.items.map((item) => (
                    <div key={item.id} className="h-10 flex items-center text-sm font-semibold text-gray-700 hover:bg-gray-50 px-2 rounded transition-colors" title={item.name}>
                      <span className="truncate">{item.name}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 text-xs text-gray-400">No records</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Second Row - Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Membership Revenue Chart */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="mb-4">
            <h4 className="text-base font-bold text-gray-800">Membership Revenue</h4>
            <p className="text-xs text-gray-500 mt-1">{timeRange === 'today' ? "Today's Revenue Trend" : timeRange === 'week' ? "Weekly Revenue Trend" : timeRange === 'month' ? "Monthly Revenue Trend" : "Overall Revenue Trend"}</p>
          </div>
          <div className="h-72">
            {membershipChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={membershipChartData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 10, fill: '#374151', fontWeight: '500' }}
                    stroke="#6b7280"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#374151' }}
                    stroke="#6b7280"
                    tickFormatter={(value) => `${getCurrencySymbol(clinicCurrency)}${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    labelStyle={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}
                    formatter={(value: any) => [`${getCurrencySymbol(clinicCurrency)}${value}`, 'Revenue']}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={{ fill: '#8b5cf6', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">No membership revenue data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Package Revenue */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
          <div className="mb-4">
            <h4 className="text-base font-bold text-gray-800">Package Revenue</h4>
            <p className="text-xs text-gray-500 mt-1">{timeRange === 'today' ? "Today's Revenue Trend" : timeRange === 'week' ? "Weekly Revenue Trend" : timeRange === 'month' ? "Monthly Revenue Trend" : "Overall Revenue Trend"}</p>
          </div>
          <div className="h-72">
            {packageChartData && packageChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={packageChartData} margin={{ top: 20, right: 20, left: 0, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="name"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    tick={{ fontSize: 10, fill: '#374151', fontWeight: '500' }}
                    stroke="#6b7280"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#374151' }}
                    stroke="#6b7280"
                    tickFormatter={(value) => `${getCurrencySymbol(clinicCurrency)}${value}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      fontSize: '12px',
                      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                    }}
                    labelStyle={{ fontWeight: 'bold', color: '#1f2937', marginBottom: '4px' }}
                    formatter={(value: any) => [`${getCurrencySymbol(clinicCurrency)}${value}`, 'Revenue']}
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    dot={{ fill: '#f59e0b', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p className="text-sm">No package revenue data available</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MembershipPackageReports;

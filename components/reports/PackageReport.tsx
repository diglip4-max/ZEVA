import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,

  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import ExportButtons from "./ExportButtons";
import usePaymentMethod from "../../hooks/usePaymentMethod";
// import { formatCurrency } from "@/lib/currencyHelper";

type HeadersRecord = Record<string, string>;

interface PackageRow {
  packageName: string;
  totalRevenue: number;
  totalBookings: number;
  totalAppointments: number;
}

interface Department {
  _id: string;
  name: string;
}

interface Doctor {
  _id: string;
  name: string;
  firstName?: string;
  lastName?: string;
}

interface Clinic {
  _id: string;
  name: string;
}

interface Props {
  startDate: string;
  endDate: string;
  headers: HeadersRecord;
}

export default function PackageReport({ startDate, endDate, headers }: Props) {
  const [rows, setRows] = useState<PackageRow[]>([]);
  const [topPackagesSummary, setTopPackagesSummary] = useState<any>(null);
  const [topPackagesPreviousSummary, setTopPackagesPreviousSummary] = useState<any>(null);
  const [soldRows, setSoldRows] = useState<any[]>([]);
  const [packagesSoldSummary, setPackagesSoldSummary] = useState<any>(null);
  const [packagesSoldPreviousSummary, setPackagesSoldPreviousSummary] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]); // New state for packages from services setup
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [detail, setDetail] = useState<{ open: boolean; patientId?: string; packageName?: string; data?: any }>(
    { open: false }
  );
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedDoctor, setSelectedDoctor] = useState<string | null>(null);
  const [selectedSalesStaff, setSelectedSalesStaff] = useState<string | null>(null);
  const [selectedClinic, setSelectedClinic] = useState<string | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [clinics, setClinics] = useState<Clinic[]>([]);
  const [salesStaff, setSalesStaff] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [combinedSummary, setCombinedSummary] = useState<any>(null); // Single source of truth for all metrics
  const [doctorLeaderboard, setDoctorLeaderboard] = useState<any[]>([]);
  const [departmentRevenueData, setDepartmentRevenueData] = useState<any[]>([]);
  // Default selected month to the month of startDate
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const date = new Date(startDate);
    return date.toLocaleString('default', { month: 'short' });
  });
  const { paymentMethods } = usePaymentMethod();

  // Update selectedMonth when startDate changes
  useEffect(() => {
    const date = new Date(startDate);
    setSelectedMonth(date.toLocaleString('default', { month: 'short' }));
  }, [startDate]);

  useEffect(() => {
    fetchDepartments();
    fetchDoctors();
    fetchClinics();
    fetchTopPackages();
    fetchPackagesSold(1);
    fetchPackages(); // Fetch packages from services setup
    fetchSalesStaff(); // Fetch all sales staff on initial load
  }, [startDate, endDate, selectedDepartment, selectedDoctor, selectedSalesStaff, selectedClinic, selectedPaymentMethod]);

  async function fetchSalesStaff() {
    try {
      // Fetch sales staff performance data
      const params: any = { startDate, endDate, limit: "10" };
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/clinic/reports/sales-staff-performance?${qs}`, { headers });
      const json = await res.json();
      
      // Fetch all agents for the clinic
      const allAgentsRes = await fetch(`/api/lead-ms/get-agents-options?role=agent`, { headers });
      const allAgentsJson = await allAgentsRes.json();
      
      if (res.ok && json.success && allAgentsRes.ok && allAgentsJson.success) {
        const performanceData = json.data || [];
        const allAgents = allAgentsJson.agents || [];
        
        // Combine both datasets: all agents, with performance data if available
        const combinedData = allAgents.map((agent: any) => {
          const performance = performanceData.find((p: any) => p.staffId === agent._id.toString());
          return {
            staffId: agent._id.toString(),
            name: agent.name,
            totalPackagesSold: performance?.totalPackagesSold || 0,
            totalRevenue: performance?.totalRevenue || 0,
            totalPaid: performance?.totalPaid || 0,
            totalPending: performance?.totalPending || 0,
            paidPackages: performance?.paidPackages || 0,
            partiallyPaidPackages: performance?.partiallyPaidPackages || 0,
            unpaidPackages: performance?.unpaidPackages || 0
          };
        });
        
        setSalesStaff(combinedData);
      }
    } catch (e) {
      console.error("Error fetching sales staff:", e);
    }
  }

  async function fetchClinics() {
    try {
      const res = await fetch(`/api/clinic/list`, { headers });
      const json = await res.json();
      if (res.ok && json.success) {
        setClinics(json.clinics || []);
      }
    } catch (e) {
      console.error("Error fetching clinics:", e);
    }
  }

  async function fetchDepartments() {
    try {
      const res = await fetch(`/api/clinic/departments?module=clinic_view_doctor`, { headers });
      const json = await res.json();
      if (res.ok && json.success) {
        setDepartments(json.departments || []);
      }
    } catch (e) {
      console.error("Error fetching departments:", e);
    }
  }

  async function fetchDoctors() {
    try {
      const res = await fetch(`/api/clinic/doctors`, { headers });
      const json = await res.json();
      if (res.ok && json.success) {
        setDoctors(json.data || []);
      }
    } catch (e) {
      console.error("Error fetching doctors:", e);
    }
  }

  async function fetchTopPackages() {
    const params: any = { startDate, endDate, limit: "10" };
    if (selectedDepartment) params.departmentId = selectedDepartment;
    if (selectedDoctor) params.doctorId = selectedDoctor;
    if (selectedSalesStaff) params.salesStaffId = selectedSalesStaff;
    if (selectedClinic) params.clinicId = selectedClinic;
    if (selectedPaymentMethod) params.paymentMethod = selectedPaymentMethod;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/clinic/reports/package-performance?${qs}`, {
      headers,
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setRows([]);
      setTopPackagesSummary(null);
      setTopPackagesPreviousSummary(null);
      setMonthlyRevenue([]);
      setCombinedSummary(null);
      setDoctorLeaderboard([]);
      setDepartmentRevenueData([]);
      setSalesStaff([]);
      return;
    }
    setRows(json.data || []);
    setTopPackagesSummary(json.summary || null);
    setTopPackagesPreviousSummary(json.previousSummary || null);
    setMonthlyRevenue(json.monthlyRevenue || []);
    setCombinedSummary(json.combinedSummary || null);
    setDoctorLeaderboard(json.doctorLeaderboard || []);
    setDepartmentRevenueData(json.departmentRevenueData || []);
    setSalesStaff(json.salesStaffLeaderboard || []);
  }

  async function fetchPackagesSold(p = 1) {
    const params: any = { startDate, endDate, page: String(p), limit: "20" };
    if (selectedDepartment) params.departmentId = selectedDepartment;
    if (selectedDoctor) params.doctorId = selectedDoctor;
    if (selectedSalesStaff) params.salesStaffId = selectedSalesStaff;
    if (selectedClinic) params.clinicId = selectedClinic;
    if (selectedPaymentMethod) params.paymentMethod = selectedPaymentMethod;
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/clinic/reports/packages-sold?${qs}`, { headers });
    const json = await res.json();
    if (!res.ok || !json.success) {
      setSoldRows([]);
      setPackagesSoldSummary(null);
      setPackagesSoldPreviousSummary(null);
      setHasNext(false);
      return;
    }
    setSoldRows(json.data || []);
    setPackagesSoldSummary(json.summary || null);
    setPackagesSoldPreviousSummary(json.previousSummary || null);
    setHasNext(Boolean(json.pagination?.hasNext));
    setPage(p);
  }

  async function fetchPackages() {
    try {
      const res = await fetch(`/api/clinic/packages`, { headers });
      const json = await res.json();
      if (res.ok && json.success) {
        setPackages(json.packages || []);
      }
    } catch (e) {
      console.error("Error fetching packages:", e);
    }
  }

  async function openUsage(patientId: string, packageName: string) {
    const qs = new URLSearchParams({ packageName }).toString();
    const res = await fetch(`/api/clinic/package-usage/${patientId}?${qs}`, { headers });
    const json = await res.json();
    if (res.ok && json.success) {
      setDetail({ open: true, patientId, packageName, data: json.packageUsage || [] });
    } else {
      setDetail({ open: true, patientId, packageName, data: { error: json.message || "Failed to load" } });
    }
  }

  // Smart currency formatter function - show actual number
  const formatCurrency = (amount: number): string => {
    return amount.toLocaleString();
  };

  // Helper to calculate trend percentage
  const calculateTrend = (current: number, previous: number) => {
    if (previous === 0 && current === 0) return { value: 0, up: true };
    if (previous === 0) return { value: 100, up: current > 0 };
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.round(change * 10) / 10,
      up: change > 0
    };
  };

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const summary = packagesSoldSummary;
    const prevSummary = packagesSoldPreviousSummary;
    const topSummary = topPackagesSummary;
    const prevTopSummary = topPackagesPreviousSummary;

    const totalPackagesSold = summary?.totalPackagesSold ?? soldRows.length;
    const prevTotalPackagesSold = prevSummary?.totalPackagesSold ?? 0;
    const totalRevenue = topSummary?.totalRevenue ?? rows.reduce((sum, r) => sum + (r.totalRevenue || 0), 0);
    const prevTotalRevenue = prevTopSummary?.totalRevenue ?? 0;
    
    // Calculate actual paid amounts from summary if available, else sold rows
    const totalPaid = summary?.totalPaid ?? soldRows.reduce((sum, r) => sum + (r.totalPaid || 0), 0);
    const prevTotalPaid = prevSummary?.totalPaid ?? 0;
    const totalPending = summary?.totalPending ?? soldRows.reduce((sum, r) => sum + (r.totalPending || 0), 0);
    const prevTotalPending = prevSummary?.totalPending ?? 0;
    
    // Calculate payment status counts from summary if available, else sold rows
    const paidPackages = summary?.paidPackages ?? soldRows.filter(r => (r.totalPending || 0) <= 0).length;
    const prevPaidPackages = prevSummary?.paidPackages ?? 0;
    const partiallyPaid = summary?.partiallyPaid ?? soldRows.filter(r => (r.totalPending || 0) > 0 && (r.totalPaid || 0) > 0).length;
    const prevPartiallyPaid = prevSummary?.partiallyPaid ?? 0;
    const unpaidPackages = summary?.unpaidPackages ?? soldRows.filter(r => (r.totalPaid || 0) <= 0).length;
    const prevUnpaidPackages = prevSummary?.unpaidPackages ?? 0;
    
    const prevActivePackages = prevSummary?.activePackages ?? 0;
    const completedPackages = summary?.completedPackages ?? soldRows.filter(r => (r.sessionsUsed || 0) >= (r.totalSessions || 1)).length;
    const prevCompletedPackages = prevSummary?.completedPackages ?? 0;
    const unusedPackages = summary?.unusedPackages ?? soldRows.filter(r => (r.sessionsUsed || 0) <= 0).length;
    const prevUnusedPackages = prevSummary?.unusedPackages ?? 0;
    
    // Use packages from services setup to calculate expiration counts
    function getPackageStatus(pkg: any) {
      if (!pkg || !pkg.endDate) return "Active";
      const endDate = new Date(pkg.endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      endDate.setHours(0, 0, 0, 0);

      if (today > endDate) {
        return "Expired";
      }

      const sevenDaysFromToday = new Date(today);
      sevenDaysFromToday.setDate(today.getDate() + 7);

      if (endDate <= sevenDaysFromToday) {
        return "Expiring Soon";
      }

      return "Active";
    }

    let activeCount = 0;
    let expiredCount = 0;
    let expiring7DaysCount = 0;
    let expiring30DaysCount = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromToday = new Date(today);
    sevenDaysFromToday.setDate(today.getDate() + 7);
    const thirtyDaysFromToday = new Date(today);
    thirtyDaysFromToday.setDate(today.getDate() + 30);

    packages.forEach((pkg) => {
      const status = getPackageStatus(pkg);
      if (status === "Active") activeCount++;
      if (status === "Expired") expiredCount++;
      if (status === "Expiring Soon") expiring7DaysCount++;
      if (pkg.endDate) {
        const endDate = new Date(pkg.endDate);
        endDate.setHours(0, 0, 0, 0);
        if (endDate > sevenDaysFromToday && endDate <= thirtyDaysFromToday) {
          expiring30DaysCount++;
        }
      }
    });

    return {
      totalPackagesSold,
      totalPackagesSoldTrend: calculateTrend(totalPackagesSold, prevTotalPackagesSold),
      totalRevenue,
      totalRevenueTrend: calculateTrend(totalRevenue, prevTotalRevenue),
      paidRevenue: totalPaid,
      paidRevenueTrend: calculateTrend(totalPaid, prevTotalPaid),
      outstanding: totalPending,
      outstandingTrend: calculateTrend(totalPending, prevTotalPending),
      paidPackages,
      paidPackagesTrend: calculateTrend(paidPackages, prevPaidPackages),
      partiallyPaid,
      partiallyPaidTrend: calculateTrend(partiallyPaid, prevPartiallyPaid),
      unpaidPackages,
      unpaidPackagesTrend: calculateTrend(unpaidPackages, prevUnpaidPackages),
      activePackages: activeCount, // Update to use service setup count
      activePackagesTrend: calculateTrend(activeCount, prevActivePackages),
      completedPackages,
      completedPackagesTrend: calculateTrend(completedPackages, prevCompletedPackages),
      expiredPackages: expiredCount, // Update to use service setup count
      expiring7Days: expiring7DaysCount, // Update to use service setup count
      expiring30Days: expiring30DaysCount, // Update to use service setup count
      unusedPackages,
      unusedPackagesTrend: calculateTrend(unusedPackages, prevUnusedPackages),
      renewalOpportunities: expiredCount + expiring7DaysCount + expiring30DaysCount, // Update
      avgPackageValue: totalPackagesSold > 0 ? totalRevenue / totalPackagesSold : 0,
    };
  }, [rows, soldRows, topPackagesSummary, topPackagesPreviousSummary, packagesSoldSummary, packagesSoldPreviousSummary, packages]);

  // Calculate total sales staff KPIs
  const salesStaffMetrics = useMemo(() => {
    const filtered = selectedSalesStaff 
      ? salesStaff.filter(s => s.staffId === selectedSalesStaff) 
      : salesStaff;
    const totals = filtered.reduce(
      (acc, staff) => ({
        totalPackagesSold: acc.totalPackagesSold + (staff.totalPackagesSold || 0),
        totalRevenue: acc.totalRevenue + (staff.totalRevenue || 0),
        totalPaid: acc.totalPaid + (staff.totalPaid || 0),
        totalPending: acc.totalPending + (staff.totalPending || 0),
        paidPackages: acc.paidPackages + (staff.paidPackages || 0),
        partiallyPaidPackages: acc.partiallyPaidPackages + (staff.partiallyPaidPackages || 0),
        unpaidPackages: acc.unpaidPackages + (staff.unpaidPackages || 0),
      }),
      {
        totalPackagesSold: 0,
        totalRevenue: 0,
        totalPaid: 0,
        totalPending: 0,
        paidPackages: 0,
        partiallyPaidPackages: 0,
        unpaidPackages: 0,
      }
    );

    return {
      totalPackagesSold: totals.totalPackagesSold,
      totalRevenue: totals.totalRevenue,
      paidRevenue: totals.totalPaid,
      outstanding: totals.totalPending,
      paidPackages: totals.paidPackages,
      partiallyPaid: totals.partiallyPaidPackages,
      unpaidPackages: totals.unpaidPackages,
    };
  }, [salesStaff, selectedSalesStaff]);

  // Mock data for charts (in real app, these would come from APIs)
  const monthlyRevenueData = [
    { month: "Jan", actual: 180000, target: 200000 },
    { month: "Feb", actual: 195000, target: 200000 },
    { month: "Mar", actual: 175000, target: 200000 },
    { month: "Apr", actual: 210000, target: 200000 },
    { month: "May", actual: 230000, target: 200000 },
    { month: "Jun", actual: 205000, target: 200000 },
    { month: "Jul", actual: 240000, target: 200000 },
    { month: "Aug", actual: 260000, target: 200000 },
    { month: "Sep", actual: 250000, target: 200000 },
    { month: "Oct", actual: 280000, target: 200000 },
    { month: "Nov", actual: 265000, target: 200000 },
    { month: "Dec", actual: 290000, target: 200000 },
  ];

  // Get selected month's data from monthlyRevenue
  const selectedMonthData = useMemo(() => {
    return monthlyRevenue.find(m => m.month === selectedMonth) || {
      totalPackages: 0,
      paidPackages: 0,
      partiallyPaidPackages: 0,
      unpaidPackages: 0,
      totalRevenue: 0,
      totalPaidRevenue: 0,
      totalOutstanding: 0,
    };
  }, [monthlyRevenue, selectedMonth]);

  // Dynamic payment status data from selected month's data
  const paymentStatusData = useMemo(() => {
    const paid = selectedMonthData.paidPackages ?? 0;
    const partial = selectedMonthData.partiallyPaidPackages ?? 0;
    const unpaid = selectedMonthData.unpaidPackages ?? 0;
    return [
      { name: "Paid", value: paid, color: "#00B42A" },
      { name: "Partial", value: partial, color: "#F7BA1E" },
      { name: "Unpaid", value: unpaid, color: "#F53F3F" },
    ];
  }, [selectedMonthData]);

  // Use real data from API, fall back to static data if empty
  const doctorLeaderboardData = doctorLeaderboard.length > 0 ? doctorLeaderboard : [
    { rank: 1, initials: "SA", name: "Dr. Sara Al-Rashid", packages: 142, revenue: 198000 },
    { rank: 2, initials: "OH", name: "Dr. Omar Hassan", packages: 118, revenue: 165000 },
    { rank: 3, initials: "LK", name: "Dr. Layla Khalid", packages: 96, revenue: 134000 },
    { rank: 4, initials: "AN", name: "Dr. Ahmed Nour", packages: 84, revenue: 118000 },
    { rank: 5, initials: "FS", name: "Dr. Fatima Saeed", packages: 71, revenue: 99000 },
  ];

  // Use real department revenue data from API, fall back to static data if empty
  const finalDepartmentRevenueData = departmentRevenueData.length > 0 ? departmentRevenueData : [
    { department: "Dermatology", revenue: 275000 },
    { department: "Aesthetics", revenue: 220000 },
    { department: "Orthopedics", revenue: 180000 },
    { department: "Dental", revenue: 145000 },
    { department: "Ophthalmology", revenue: 120000 },
    { department: "Cardiology", revenue: 95000 },
  ];

  const branchData = [
    { branch: "OK", revenue: 320000 },
    { branch: "Al Olaya", revenue: 285000 },
    { branch: "Al Malqa", revenue: 230000 },
    { branch: "Diplomatic", revenue: 210000 },
    { branch: "Al Nakheel", revenue: 185000 },
    { branch: "Hittin", revenue: 120000 },
  ];

  const topPackagesData = rows.length > 0 ? rows : [
    { packageName: "Skin Rejuvenation Pro", totalBookings: 184, totalRevenue: 276000, growth: 18 },
    { packageName: "Laser Hair Removal 6x", totalBookings: 156, totalRevenue: 234000, growth: 12 },
    { packageName: "Anti-Aging Platinum", totalBookings: 134, totalRevenue: 201000, growth: 24 },
    { packageName: "Derma Glow Premium", totalBookings: 118, totalRevenue: 177000, growth: 9 },
    { packageName: "HydraFacial Series", totalBookings: 96, totalRevenue: 144000, growth: 15 },
  ].map((p, i) => ({
    ...p,
    rank: i + 1,
    packageName: (p as any).packageName || `Package ${i + 1}`,
    totalBookings: (p as any).totalBookings || Math.floor(Math.random() * 200),
    totalRevenue: (p as any).totalRevenue || Math.floor(Math.random() * 300000),
    growth: (p as any).growth || Math.floor(Math.random() * 30),
  }));

  const outstandingAgingData = [
    { period: "0-30 Days", amount: 89000, accounts: 67, color: "#008891" },
    { period: "31-60 Days", amount: 54000, accounts: 41, color: "#F5A623" },
    { period: "61-90 Days", amount: 32000, accounts: 24, color: "#F78B2D" },
    { period: "90+ Days", amount: 22000, accounts: 16, color: "#F53F3F" },
  ];

  const expiringPackagesData = [
    { period: "Today", count: 8, color: "#F53F3F" },
    { period: "2-7 Days", count: 34, color: "#F53F3F" },
    { period: "8-14 Days", count: 78, color: "#008891" },
    { period: "15-30 Days", count: 142, color: "#008891" },
    { period: "31-60 Days", count: 198, color: "#008891" },
  ];

  const packageLifecycleData = [
    { label: "Sold", value: 1348, color: "#008891", total: 1348 },
    { label: "Active", value: 847, color: "#10B981", total: 1348, percentage: 63 },
    { label: "Completed", value: 412, color: "#3B82F6", total: 847, percentage: 49 },
    { label: "Renewed", value: 198, color: "#8B5CF6", total: 412, percentage: 48 },
  ];

  const isSalesStaffActive = activeFilter === "salesStaff";
  const currentMetrics = isSalesStaffActive ? salesStaffMetrics : metrics;

  const kpiCards = [
    { label: "Total Packages Sold", value: currentMetrics.totalPackagesSold.toLocaleString(), trend: isSalesStaffActive ? 0 : metrics.totalPackagesSoldTrend.value, trendUp: isSalesStaffActive ? false : metrics.totalPackagesSoldTrend.up, icon: "📦", subtitle: isSalesStaffActive ? "Sales Staff" : "All time" },
    { label: "Total Revenue", value: formatCurrency(currentMetrics.totalRevenue), trend: isSalesStaffActive ? 0 : metrics.totalRevenueTrend.value, trendUp: isSalesStaffActive ? false : metrics.totalRevenueTrend.up, icon: "💲", subtitle: isSalesStaffActive ? "Sales Staff" : "This year" },
    { label: "Paid Revenue", value: formatCurrency(currentMetrics.paidRevenue), trend: isSalesStaffActive ? 0 : metrics.paidRevenueTrend.value, trendUp: isSalesStaffActive ? false : metrics.paidRevenueTrend.up, icon: "✅", subtitle: isSalesStaffActive ? "Sales Staff" : "Collected" },
    { label: "Outstanding", value: formatCurrency(currentMetrics.outstanding), trend: isSalesStaffActive ? 0 : (metrics.outstandingTrend ? (metrics.outstandingTrend.up ? metrics.outstandingTrend.value : -metrics.outstandingTrend.value) : 0), trendUp: isSalesStaffActive ? false : (metrics.outstandingTrend ? !metrics.outstandingTrend.up : false), icon: "⚠️", subtitle: isSalesStaffActive ? "Sales Staff" : "Pending collection" },
    { label: "Paid Packages", value: currentMetrics.paidPackages.toLocaleString(), trend: isSalesStaffActive ? 0 : metrics.paidPackagesTrend.value, trendUp: isSalesStaffActive ? false : metrics.paidPackagesTrend.up, icon: "✅", subtitle: isSalesStaffActive ? "Sales Staff" : "Fully settled" },
    { label: "Partially Paid", value: currentMetrics.partiallyPaid.toLocaleString(), trend: isSalesStaffActive ? 0 : metrics.partiallyPaidTrend.value, trendUp: isSalesStaffActive ? false : metrics.partiallyPaidTrend.up, icon: "⏳", subtitle: isSalesStaffActive ? "Sales Staff" : "Partial payment" },
    { label: "Unpaid Packages", value: currentMetrics.unpaidPackages.toLocaleString(), trend: isSalesStaffActive ? 0 : (metrics.unpaidPackagesTrend ? (metrics.unpaidPackagesTrend.up ? metrics.unpaidPackagesTrend.value : -metrics.unpaidPackagesTrend.value) : 0), trendUp: isSalesStaffActive ? false : (metrics.unpaidPackagesTrend ? !metrics.unpaidPackagesTrend.up : false), icon: "�", subtitle: isSalesStaffActive ? "Sales Staff" : "No payment made" },
    { label: "Active Packages", value: metrics.activePackages.toLocaleString(), trend: isSalesStaffActive ? 0 : metrics.activePackagesTrend.value, trendUp: isSalesStaffActive ? false : metrics.activePackagesTrend.up, icon: "📈", subtitle: "In progress" },
    { label: "Expired Packages", value: metrics.expiredPackages.toLocaleString(), trend: 0, trendUp: false, icon: "⏰", subtitle: "Past expiry date" },
    { label: "Expiring in 7 Days", value: metrics.expiring7Days.toLocaleString(), trend: 0, trendUp: false, icon: "⏳", subtitle: "Urgent action needed" },
    { label: "Expiring in 30 Days", value: metrics.expiring30Days.toLocaleString(), trend: 0, trendUp: false, icon: "📅", subtitle: "Upcoming expirations" },
    { label: "Renewal Opportunities", value: metrics.renewalOpportunities.toLocaleString(), trend: 0, trendUp: true, icon: "🔄", subtitle: "Ready to renew" },
  ];

  const packageExportSections = useMemo(() => [
    {
      title: "Top Packages by Revenue",
      headers: ["Package Name", "Total Bookings", "Total Revenue (Rs)"],
      data: rows.map(r => ({
        "Package Name": r.packageName || "Unnamed",
        "Total Bookings": r.totalBookings || 0,
        "Total Revenue (Rs)": Math.round(r.totalRevenue || 0),
      })),
    },
    {
      title: "Packages Sold",
      headers: ["Package Name", "Patient Name", "Doctor Name", "Total Sessions", "Sessions Used", "Remaining Sessions", "Payment Status"],
      data: soldRows.map(r => ({
        "Package Name": r.packageName || "-",
        "Patient Name": r.patientName || "-",
        "Doctor Name": r.doctorName || "-",
        "Total Sessions": r.totalSessions ?? "-",
        "Sessions Used": r.sessionsUsed ?? 0,
        "Remaining Sessions": Math.max(0, (r.totalSessions || 0) - (r.sessionsUsed || 0)),
        "Payment Status": r.paymentStatus || "-",
      })),
    },
  ], [rows, soldRows]);

  const toggleFilter = (filter: string) => {
    setActiveFilter(activeFilter === filter ? null : filter);
    if (filter === "salesStaff") {
      fetchSalesStaff();
    }
  };

  return (
    <div className="space-y-6 p-4 bg-gray-100 min-h-screen">
      <div className="max-w-9xl mx-auto">
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-gray-900">Package Analytics Dashboard</h1>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">LIVE</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">ZEVA Healthcare ERP   </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white">
                📅 {new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - {new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </div>
              <button className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">
                📥 Export
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium text-gray-500">🔽 Filters</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {/* <div className="relative">
                <button
                  onClick={() => toggleFilter("clinic")}
                  className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
                    activeFilter === "clinic" || selectedClinic
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {selectedClinic
                    ? clinics.find(c => c._id === selectedClinic)?.name || "Clinic"
                    : "Clinic"}
                </button>
                {activeFilter === "clinic" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-56 max-h-64 overflow-y-auto">
                    <div className="p-1.5">
                     
                      {clinics.map((clinic) => (
                        <button
                          key={clinic._id}
                          onClick={() => {
                            setSelectedClinic(clinic._id);
                            setActiveFilter(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors ${
                            selectedClinic === clinic._id ? "bg-emerald-50 text-emerald-700" : ""
                          }`}
                        >
                          {clinic.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div> */}

              <div className="relative">
                <button
                  onClick={() => toggleFilter("department")}
                  className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
                    activeFilter === "department" || selectedDepartment
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {selectedDepartment
                    ? departments.find(d => d._id === selectedDepartment)?.name || "Department"
                    : "Department"}
                </button>
                {activeFilter === "department" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-56 max-h-64 overflow-y-auto">
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setSelectedDepartment(null);
                          setActiveFilter(null);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors"
                      >
                        All Departments
                      </button>
                      {departments.map((dept) => (
                        <button
                          key={dept._id}
                          onClick={() => {
                            setSelectedDepartment(dept._id);
                            setActiveFilter(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors ${
                            selectedDepartment === dept._id ? "bg-emerald-50 text-emerald-700" : ""
                          }`}
                        >
                          {dept.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => toggleFilter("doctor")}
                  className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
                    activeFilter === "doctor" || selectedDoctor
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {selectedDoctor
                    ? (() => {
                        const doc = doctors.find(d => d._id === selectedDoctor);
                        return doc?.name || (doc?.firstName && doc?.lastName ? `${doc.firstName} ${doc.lastName}` : "Doctor");
                      })()
                    : "Doctor"}
                </button>
                {activeFilter === "doctor" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-64 max-h-72 overflow-y-auto">
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setSelectedDoctor(null);
                          setActiveFilter(null);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors"
                      >
                        All Doctors
                      </button>
                      {doctors.map((doc) => (
                        <button
                          key={doc._id}
                          onClick={() => {
                            setSelectedDoctor(doc._id);
                            setActiveFilter(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors ${
                            selectedDoctor === doc._id ? "bg-emerald-50 text-emerald-700" : ""
                          }`}
                        >
                          {doc.name || (doc.firstName && doc.lastName ? `${doc.firstName} ${doc.lastName}` : "Doctor")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => toggleFilter("salesStaff")}
                  className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
                    activeFilter === "salesStaff" || selectedSalesStaff
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {selectedSalesStaff
                    ? salesStaff.find(s => s.staffId === selectedSalesStaff)?.name || "Sales Staff"
                    : "Sales Staff"}
                </button>
                {activeFilter === "salesStaff" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-64 max-h-72 overflow-y-auto">
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setSelectedSalesStaff(null);
                          setActiveFilter(null);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors"
                      >
                        All Sales Staff
                      </button>
                      {salesStaff.map((staff) => (
                        <button
                          key={staff.staffId || staff._id || staff.name}
                          onClick={() => {
                            setSelectedSalesStaff(staff.staffId);
                            setActiveFilter(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors ${
                            selectedSalesStaff === staff.staffId ? "bg-emerald-50 text-emerald-700" : ""
                          }`}
                        >
                          {staff.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <button
                  onClick={() => toggleFilter("paymentMethod")}
                  className={`px-3 py-1.5 border rounded-lg text-sm transition-all ${
                    activeFilter === "paymentMethod" || selectedPaymentMethod
                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {selectedPaymentMethod
                    ? paymentMethods.find(pm => pm.name === selectedPaymentMethod)?.name || "Payment Status"
                    : "Payment Status"}
                </button>
                {activeFilter === "paymentMethod" && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-56 max-h-64 overflow-y-auto">
                    <div className="p-1.5">
                      <button
                        onClick={() => {
                          setSelectedPaymentMethod(null);
                          setActiveFilter(null);
                        }}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors"
                      >
                        All Payment Statuses
                      </button>
                      {paymentMethods.map((pm) => (
                        <button
                          key={pm._id}
                          onClick={() => {
                            setSelectedPaymentMethod(pm.name);
                            setActiveFilter(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors ${
                            selectedPaymentMethod === pm.name ? "bg-emerald-50 text-emerald-700" : ""
                          }`}
                        >
                          {pm.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              

              {(selectedClinic || selectedDepartment || selectedDoctor || selectedSalesStaff || selectedPaymentMethod) && (
                <button
                  onClick={() => {
                    setSelectedClinic(null);
                    setSelectedDepartment(null);
                    setSelectedDoctor(null);
                    setSelectedSalesStaff(null);
                    setSelectedPaymentMethod(null);
                    setActiveFilter(null);
                  }}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-6">
          {kpiCards.map((card, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{card.icon}</span>
                    <span className="text-xs text-gray-500">{card.label}</span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-gray-900">{card.value}</span>
                    <span className={`text-xs font-medium mb-1 ${card.trendUp ? 'text-emerald-600' : 'text-red-500'}`}>
                      {card.trendUp ? '↗' : '↘'} {card.trend}%
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">{card.subtitle}</p>
                </div>
              </div>
              {/* Mini sparkline */}
              <div className="mt-2">
                <svg width="100%" height="30" viewBox="0 0 100 30">
                  <defs>
                    <linearGradient id={`grad${index}`} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor={card.trendUp ? "#10B981" : "#F53F3F"} stopOpacity="0.3"/>
                      <stop offset="100%" stopColor={card.trendUp ? "#10B981" : "#F53F3F"} stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <path 
                    d={`M0,25 Q10,20 20,22 T40,18 T60,20 T80,15 T100,18`} 
                    fill="none" 
                    stroke={card.trendUp ? "#10B981" : "#F53F3F"} 
                    strokeWidth="2"
                  />
                  <path 
                    d={`M0,30 L0,25 Q10,20 20,22 T40,18 T60,20 T80,15 T100,18 L100,30 Z`} 
                    fill={`url(#grad${index})`}
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Trend & Payment Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Revenue Trend</h3>
                <p className="text-xs text-gray-500">Monthly actual vs. target · {new Date(startDate).getFullYear()}</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 bg-teal-500"></div>
                  <span className="text-gray-600">Actual</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-0.5 border-t-2 border-dashed border-gray-400"></div>
                  <span className="text-gray-600">Target</span>
                </div>
              </div>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyRevenue}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#00B42A" stopOpacity="0.2"/>
                      <stop offset="100%" stopColor="#00B42A" stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis 
                    tick={{ fontSize: 12 }} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(value) => `${value / 1000}K`}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value, name) => {
                      const numValue = Number(value);
                      if (name === 'actual') {
                        return [`Rs ${(numValue / 1000).toFixed(0)}K`, 'Actual Revenue'];
                      }
                      if (name === 'target') {
                        return [`Rs ${(numValue / 1000).toFixed(0)}K`, 'Target Revenue'];
                      }
                      return value;
                    }}
                    labelFormatter={(label) => {
                      const data = monthlyRevenue.find((d) => d.month === label);
                      return `${label} · ${data?.packageCount || 0} packages`;
                    }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="target" 
                    stroke="#9CA3AF" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="none" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="actual" 
                    stroke="#008891" 
                    strokeWidth={3}
                    fill="url(#colorRevenue)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Payment Status</h3>
            <p className="text-xs text-gray-500 mb-4">{selectedMonthData.totalPackages.toLocaleString()} total packages</p>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={paymentStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={60}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {paymentStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {paymentStatusData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm text-gray-700">{item.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {item.value} ({Math.round((item.value / (selectedMonthData.totalPackages || 1)) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Next Row: Package Lifecycle, Revenue by Department, Doctor Leaderboard, Sales Staff */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Package Lifecycle</h3>
            <p className="text-xs text-gray-500 mb-4">Sold → Active → Completed → Renewed</p>
            <div className="space-y-4">
              {packageLifecycleData.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className="text-sm font-medium text-gray-700">{item.label}</span>
                      {item.percentage && (
                        <span className="text-xs text-gray-500">({item.percentage}% conv.)</span>
                      )}
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{item.value.toLocaleString()}</span>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(item.value / item.total) * 100}%`,
                        backgroundColor: item.color 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Revenue by Department</h3>
            <p className="text-xs text-gray-500 mb-4">Top performing departments</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={finalDepartmentRevenueData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" hide />
                  <YAxis 
                    className="overflow-hidden"
                    dataKey="department" 
                    type="category" 
                    width={90}
                    tick={{ fontSize: 11 }} 
                    tickLine={false} 
                    axisLine={false} 
                  />
                  <Tooltip 
                    formatter={(value) => typeof value === 'number' ? `Rs ${(value / 1000).toFixed(0)}K` : ''}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="#008891" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Doctor Leaderboard</h3>
                <p className="text-xs text-gray-500">By packages sold</p>
              </div>
              {/* <button className="text-xs text-teal-600 font-medium">View all</button> */}
            </div>
            <div className="space-y-3">
              {doctorLeaderboardData.map((doc, index) => (
                <div key={index} className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-gray-400 w-4">{doc.rank}</span>
                  <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-semibold">
                    {doc.initials}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.department || "Other"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{doc.packages}</p>
                    <p className="text-xs text-gray-500">Rs {doc.revenue / 1000}K</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Sales Staff</h3>
                <p className="text-xs text-gray-500">By packages sold</p>
              </div>
              {/* <button className="text-xs text-teal-600 font-medium">View all</button> */}
            </div>
            <div className="space-y-3">
              {salesStaff.slice(0, 5).map((staff, index) => {
                // Get initials from name
                const initials = staff.name
                  ? staff.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                  : 'SS';
                // Calculate percentage of total revenue
                const totalRevenue = salesStaff.reduce((sum: number, s: any) => sum + (s.totalRevenue || 0), 0);
                const percentage = totalRevenue > 0 ? Math.round((staff.totalRevenue / totalRevenue) * 100) : 0;
                
                return (
                  <div key={staff.staffId || index} className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-400 w-4">{index + 1}</span>
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-semibold">
                      {initials}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{staff.name || 'Unknown'}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${percentage}%` }}
                          ></div>
                        </div>
                        <span className="text-xs text-gray-500">{percentage}%</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{staff.totalPackagesSold}</p>
                      <p className="text-xs text-gray-500">Rs {Math.round(staff.totalRevenue / 1000)}K</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Next Row: Branch Comparison, Top Packages, Outstanding by Aging */}
        {/* <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Branch Comparison</h3>
            <p className="text-xs text-gray-500 mb-4">Revenue vs. target by location</p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branchData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="branch" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(value) => `${value / 1000}K`} />
                  <Tooltip 
                    formatter={(value) => typeof value === 'number' ? `Rs ${(value / 1000).toFixed(0)}K` : ''}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="revenue" fill="#D1D5DB" radius={[4, 4, 0, 0]} barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Top Packages</h3>
            <p className="text-xs text-gray-500 mb-4">Best performers this period</p>
            <div className="space-y-3">
              {topPackagesData.slice(0, 5).map((pkg: any, index) => (
                <div key={index} className="flex items-center justify-between pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-gray-400">{pkg.rank || index + 1}</span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{pkg.packageName}</p>
                      <p className="text-xs text-gray-500">
                        {pkg.totalBookings} sold · Rs {(pkg.totalRevenue / 1000).toFixed(0)}K
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">+{pkg.growth || 15}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Outstanding by Aging</h3>
            <p className="text-xs text-gray-500 mb-4">Rs 198K total outstanding</p>
            <div className="space-y-4">
              {outstandingAgingData.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.period}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">Rs {item.amount / 1000}K</span>
                      <span className="text-xs text-gray-500 ml-2">{item.accounts} accts</span>
                    </div>
                  </div>
                  <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full"
                      style={{ 
                        width: `${(item.amount / 197000) * 100}%`,
                        backgroundColor: item.color 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div> */}

        {/* Expiring Packages Timeline & Quick Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-1">Expiring Packages Timeline</h3>
            <p className="text-xs text-gray-500 mb-4">Packages expiring by period · red = urgent action</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={expiringPackagesData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="period" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar 
                    dataKey="count" 
                    radius={[4, 4, 0, 0]} 
                    barSize={40}
                  >
                    {expiringPackagesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
            <h3 className="text-base font-semibold text-gray-900 mb-4">Quick Metrics</h3>
            <p className="text-xs text-gray-500 mb-4">Key snapshot · this period</p>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Renewal Rate</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">62.4%</span>
                  <span className="text-xs text-emerald-600 ml-2">+4.2%</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Refund Rate</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">3.8%</span>
                  <span className="text-xs text-red-500 ml-2">-1.1%</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Avg Sessions Used</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-blue-600">6.2 / 10</span>
                  <span className="text-xs text-emerald-600 ml-2">+0.8</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Inactive Holders</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-amber-600">67 patients</span>
                  <span className="text-xs text-red-500 ml-2">+12</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-gray-600">Avg Package Value</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-emerald-600">Rs 1,834</span>
                  <span className="text-xs text-emerald-600 ml-2">+7.3%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Center */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 mt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Action Center</h3>
              <p className="text-xs text-gray-500">Items requiring immediate attention</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                💬 WhatsApp
              </button>
              <button className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                📱 SMS
              </button>
              <button className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                ✉️ Email
              </button>
              <button className="px-3 py-1.5 bg-teal-600 text-white rounded-lg text-sm hover:bg-teal-700">
                📥 Bulk Export
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">⏰</div>
                <span className="text-xl font-bold text-red-800">8</span>
              </div>
              <p className="text-sm font-semibold text-red-900 mb-3">Expiring Today</p>
              <button className="w-full py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600">
                Send Reminders
              </button>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">💲</div>
                <span className="text-xl font-bold text-amber-800">41</span>
              </div>
              <p className="text-sm font-semibold text-amber-900 mb-3">Overdue Payments</p>
              <button className="w-full py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600">
                Collect Now
              </button>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-700">👤</div>
                <span className="text-xl font-bold text-gray-800">67</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Inactive Patients</p>
              <button className="w-full py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700">
                Reach Out
              </button>
            </div>

            <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">🔄</div>
                <span className="text-xl font-bold text-teal-800">198</span>
              </div>
              <p className="text-sm font-semibold text-teal-900 mb-3">Renewal Ready</p>
              <button className="w-full py-1.5 bg-teal-600 text-white text-xs font-medium rounded-lg hover:bg-teal-700">
                Launch Campaign
              </button>
            </div>

            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-700">⚠️</div>
                <span className="text-xl font-bold text-purple-800">12</span>
              </div>
              <p className="text-sm font-semibold text-purple-900 mb-3">Refund Requests</p>
              <button className="w-full py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700">
                Review Now
              </button>
            </div>
          </div>
        </div>

        {/* Package Registry Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-gray-900">Package Registry</h3>
              <p className="text-xs text-gray-500">Showing {soldRows.length} results · Page {page}</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm">
                🔍 <input type="text" placeholder="Search patient/package/ID" className="border-0 outline-none text-sm w-40" />
              </div>
              <button className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                ⚙️ Columns
              </button>
              <ExportButtons
                sections={packageExportSections}
                filename={`package-report-${startDate}-to-${endDate}`}
                title="Package Report"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    <input type="checkbox" className="rounded" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Package ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Package Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Patient
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Doctor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Dept
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Branch
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Staff
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Value
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Outstanding
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Sessions
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Usage
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Start
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Expiry
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Last Visit
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {soldRows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" className="rounded" />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                      PKG-{String(2405000 + index).padStart(3, '0')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-bold">
                          SK
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{row.packageName || "Package"}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="text-amber-500">🔥</span> Popular
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-bold">
                          {(row.patientName || "NA").charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{row.patientName || "Patient"}</p>
                          <p className="text-xs text-gray-500">ID: MRN-{10000 + index}</p>
                        </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">+966 55 123 4567</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{row.doctorName || "Dr. Name"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full">DERM</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">Nadia Al-Amin</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Rs 1,500</td>
                  <td className="px-4 py-3 text-sm text-gray-900">Rs 1,500</td>
                  <td className="px-4 py-3 text-sm text-red-600 font-semibold">Rs 0</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded-full font-medium">
                      Paid
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-900">5/8</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: '63%' }}></div>
                      </div>
                      <span className="text-xs text-gray-500">63%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">2024-01-15</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-500">●</span>
                      <span className="text-sm text-gray-600">2025-07-15</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">2024-06-10</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openUsage(row.patientId || '123', row.packageName || 'Package')}
                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                      >
                        👁️
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded text-gray-500">📄</button>
                      <button className="p-1 hover:bg-gray-100 rounded text-gray-500">⋮</button>
                    </div>
                  </td>
                </tr>
              ))}
              {soldRows.length === 0 && (
                <tr>
                  <td colSpan={19} className="px-4 py-12 text-center text-gray-500">
                    No packages sold in the selected period
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Showing {soldRows.length} results · Page {page}
          </p>
          <div className="flex items-center gap-2">
            <button 
              disabled={page <= 1}
              onClick={() => fetchPackagesSold(Math.max(1, page - 1))}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              ← Prev
            </button>
            <div className="flex items-center gap-1">
              {[1, 2, 3, '...', 12].map((p, i) => (
                <button
                  key={i}
                  className={`w-8 h-8 rounded-lg text-sm ${p === page ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <button 
              disabled={!hasNext}
              onClick={() => fetchPackagesSold(page + 1)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
      </div>

      {/* Detail Modal */}
      {detail.open && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center">
          <div className="bg-white w-full md:max-w-3xl rounded-t-lg md:rounded-lg shadow-lg">
            <div className="p-4 border-b flex items-center justify-between">
              <div className="font-semibold">
                Package Usage — {detail.packageName} ({detail.patientId})
              </div>
              <button
                className="px-3 py-1.5 rounded border text-sm"
                onClick={() => setDetail({ open: false })}
              >
                Close
              </button>
            </div>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {Array.isArray(detail.data) ? (
                detail.data.map((pkg: any, idx: number) => (
                  <div key={idx} className="mb-4">
                    <div className="font-medium">{pkg.packageName || detail.packageName}</div>
                    {pkg.isTransferred && (
                      <div className="text-xs text-gray-700 mb-2">
                        Transferred: Yes
                        {pkg.transferredFrom && (
                          <span className="ml-2">
                            Transferred From Patient: {pkg.transferredFromName || String(pkg.transferredFrom)}
                          </span>
                        )}
                        {pkg.transferredPackageName && (
                          <span className="ml-2">
                            Transferred Package: {pkg.transferredPackageName}
                          </span>
                        )}
                        {pkg.transferredSessions !== undefined && (
                          <span className="ml-2">
                            Transferred Sessions: {pkg.transferredSessions}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-sm text-gray-600 mb-2">
                      Total Sessions Used: {pkg.totalSessions || 0}
                    </div>
                    <div className="text-sm text-gray-700 mb-2">Treatments:</div>
                    <div className="border rounded">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Treatment</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Used</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-600 uppercase">Max</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {(pkg.treatments || []).map((t: any, tIdx: number) => (
                            <tr key={tIdx}>
                              <td className="px-3 py-2 text-sm">{t.treatmentName}</td>
                              <td className="px-3 py-2 text-sm">{t.totalUsedSessions || 0}</td>
                              <td className="px-3 py-2 text-sm">{t.maxSessions || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-red-600">{detail.data?.error || "No data"}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

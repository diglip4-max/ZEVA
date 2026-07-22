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
import { useCurrency } from "@/context/CurrencyContext";
import { getCurrencySymbol } from "@/lib/currencyHelper";

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
  const [allSoldRows, setAllSoldRows] = useState<any[]>([]); // State to hold all packages sold data for export
  const [packagesSoldSummary, setPackagesSoldSummary] = useState<any>(null);
  const [packagesSoldPreviousSummary, setPackagesSoldPreviousSummary] = useState<any>(null);
  const [packages, setPackages] = useState<any[]>([]); // New state for packages from services setup
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [detail, setDetail] = useState<{ open: boolean; patientId?: string; packageName?: string; patientName?: string; data?: any }>(
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
  const [_clinics, setClinics] = useState<Clinic[]>([]);
  const [salesStaff, setSalesStaff] = useState<any[]>([]);
  const [salesStaffLeaderboard, setSalesStaffLeaderboard] = useState<any[]>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([]);
  const [combinedSummary, setCombinedSummary] = useState<any>(null); // Single source of truth for all metrics
  const [overviewCombinedSummary, setOverviewCombinedSummary] = useState<any>(null); // Unfiltered overview summary
  const [doctorLeaderboard, setDoctorLeaderboard] = useState<any[]>([]);
  const [departmentRevenueData, setDepartmentRevenueData] = useState<any[]>([]);
  const [lifecycleSummary, setLifecycleSummary] = useState<any>(null);
  // Overview data for sections that must stay independent of the dashboard's
  // Department/Doctor/Sales-Staff/Payment filters (Revenue Trend, Payment
  // Status, Doctor Leaderboard, Sales Staff). Fetched using the date range +
  // clinic scope only.
  const [overviewMonthlyRevenue, setOverviewMonthlyRevenue] = useState<any[]>([]);
  const [overviewDoctorLeaderboard, setOverviewDoctorLeaderboard] = useState<any[]>([]);
  const [overviewSalesStaffLeaderboard, setOverviewSalesStaffLeaderboard] = useState<any[]>([]);
  // Expiry KPI data from PatientRegistration (active/expired/expiring packages)
  const [expiryData, setExpiryData] = useState<any>(null);
  // KPI Detail Modal state
  const [kpiModal, setKpiModal] = useState<{ open: boolean; title: string; data: any[] }>({ open: false, title: '', data: [] });
  // Default selected month to the month of startDate
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const date = new Date(startDate);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('default', { month: 'short' });
  });
  const { paymentMethods } = usePaymentMethod();

  // Update selectedMonth when startDate changes
  useEffect(() => {
    const date = new Date(startDate);
    if (isNaN(date.getTime())) return;
    setSelectedMonth(date.toLocaleString('default', { month: 'short' }));
  }, [startDate]);

  useEffect(() => {
    fetchDepartments();
    fetchDoctors();
    fetchClinics();
    fetchTopPackages();
    fetchPackagesSold(1);
    fetchAllPackagesSold(); // Fetch all data for export
    fetchPackages(); // Fetch packages from services setup
    fetchSalesStaff(); // Fetch all sales staff on initial load
  }, [startDate, endDate, selectedDepartment, selectedDoctor, selectedSalesStaff, selectedClinic, selectedPaymentMethod]);

  // Overview sections (Revenue Trend, Payment Status, Doctor Leaderboard,
  // Sales Staff) depend ONLY on the selected date range (+ clinic scope) and
  // must NOT react to the Department/Doctor/Sales-Staff/Payment filters, which
  // apply only to the summary cards above.
  useEffect(() => {
    fetchOverview();
    fetchPackageExpiry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, selectedClinic]);

  async function fetchSalesStaff() {
    try {
      // Fetch sales staff performance data
      const params: any = { startDate, endDate, limit: "1000" };
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
        
        // Also include entries with null staffId (packages assigned by doctors or other means)
        // These are packages without packageSoldByUserId set
        const nullStaffEntries = performanceData.filter((p: any) => !p.staffId || p.staffId === null || p.staffId === "null");
        if (nullStaffEntries.length > 0) {
          const nullStaffTotals = nullStaffEntries.reduce((acc: any, entry: any) => ({
            totalPackagesSold: acc.totalPackagesSold + (entry.totalPackagesSold || 0),
            totalRevenue: acc.totalRevenue + (entry.totalRevenue || 0),
            totalPaid: acc.totalPaid + (entry.totalPaid || 0),
            totalPending: acc.totalPending + (entry.totalPending || 0),
            paidPackages: acc.paidPackages + (entry.paidPackages || 0),
            partiallyPaidPackages: acc.partiallyPaidPackages + (entry.partiallyPaidPackages || 0),
            unpaidPackages: acc.unpaidPackages + (entry.unpaidPackages || 0),
          }), {
            totalPackagesSold: 0,
            totalRevenue: 0,
            totalPaid: 0,
            totalPending: 0,
            paidPackages: 0,
            partiallyPaidPackages: 0,
            unpaidPackages: 0,
          });
          combinedData.push({
            staffId: "__null_staff__",
            name: "Other/Doctor Assigned",
            ...nullStaffTotals
          });
        }
        
        setSalesStaff(combinedData);
      }
    } catch (e) {
      console.error("Error fetching sales staff:", e);
    }
  }

  // Handle KPI card click to show package details
  async function handleKpiCardClick(kpiType: string) {
    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      let title = '';
      let data: any[] = [];
      
      // For expiry-related KPIs, use expiryData from PatientRegistration API
      const expiryKpiTypes = ['activePackages', 'expiredPackages', 'expiring7Days', 'expiring30Days', 'renewalOpportunities'];
      
      if (expiryKpiTypes.includes(kpiType)) {
        // Use expiryData from package-expiry API (PatientRegistration-based)
        // Falls back to package templates if expiryData is not available
        if (expiryData) {
          switch (kpiType) {
            case 'activePackages':
              title = 'Active Packages';
              data = expiryData.activePackagesData || [];
              break;
            case 'expiredPackages':
              title = 'Expired Packages';
              data = expiryData.expiredPackagesData || [];
              break;
            case 'expiring7Days':
              title = 'Expiring in 7 Days';
              data = expiryData.expiring7DaysData || [];
              break;
            case 'expiring30Days':
              title = 'Expiring in 30 Days';
              data = expiryData.expiring30DaysData || [];
              break;
            case 'renewalOpportunities':
              title = 'Renewal Opportunities';
              // Renewal = expiring in 7 days + expiring in 30 days
              data = [
                ...(expiryData.expiring7DaysData || []),
                ...(expiryData.expiring30DaysData || []),
              ];
              break;
          }
        } else {
          // Fallback: use packages state (package templates)
          switch (kpiType) {
            case 'activePackages':
              title = 'Active Packages';
              data = packages
                .filter((p: any) => {
                  if (!p.endDate) return true;
                  const endDate = new Date(p.endDate);
                  endDate.setHours(0, 0, 0, 0);
                  return endDate > now;
                })
                .map((p: any) => ({
                  packageName: p.name,
                  patientName: '-',
                  amount: p.totalPrice || 0,
                  expirationDate: p.endDate,
                  date: p.createdAt
                }));
              break;
            case 'expiredPackages':
              title = 'Expired Packages';
              data = packages
                .filter((p: any) => {
                  if (!p.endDate) return false;
                  const endDate = new Date(p.endDate);
                  endDate.setHours(0, 0, 0, 0);
                  return endDate <= now;
                })
                .map((p: any) => ({
                  packageName: p.name,
                  patientName: '-',
                  amount: p.totalPrice || 0,
                  expirationDate: p.endDate,
                  date: p.createdAt
                }));
              break;
            case 'expiring7Days':
              title = 'Expiring in 7 Days';
              data = packages
                .filter((p: any) => {
                  if (!p.endDate) return false;
                  const endDate = new Date(p.endDate);
                  endDate.setHours(0, 0, 0, 0);
                  return endDate > now && endDate <= sevenDaysFromNow;
                })
                .map((p: any) => ({
                  packageName: p.name,
                  patientName: '-',
                  amount: p.totalPrice || 0,
                  expirationDate: p.endDate,
                  date: p.createdAt
                }));
              break;
            case 'expiring30Days':
              title = 'Expiring in 30 Days';
              data = packages
                .filter((p: any) => {
                  if (!p.endDate) return false;
                  const endDate = new Date(p.endDate);
                  endDate.setHours(0, 0, 0, 0);
                  return endDate > sevenDaysFromNow && endDate <= thirtyDaysFromNow;
                })
                .map((p: any) => ({
                  packageName: p.name,
                  patientName: '-',
                  amount: p.totalPrice || 0,
                  expirationDate: p.endDate,
                  date: p.createdAt
                }));
              break;
            case 'renewalOpportunities':
              title = 'Renewal Opportunities';
              data = packages
                .filter((p: any) => {
                  if (!p.endDate) return false;
                  const endDate = new Date(p.endDate);
                  endDate.setHours(0, 0, 0, 0);
                  return endDate <= thirtyDaysFromNow;
                })
                .map((p: any) => ({
                  packageName: p.name,
                  patientName: '-',
                  amount: p.totalPrice || 0,
                  expirationDate: p.endDate,
                  date: p.createdAt
                }));
              break;
          }
        }
        
        setKpiModal({ open: true, title, data });
        return;
      }
      
      // For billing-related KPIs, fetch from packages-sold API
      // includeUnpaid=true asks the API to also include package records from
      // PatientRegistration that have no billing yet (unpaid / partially paid),
      // so the modal shows the SAME package set the dashboard cards are counting.
      // The main report and export flows do NOT pass this flag, so their default
      // behavior is preserved.
      const params: any = { startDate, endDate, limit: "1000", getAll: "true", includeUnpaid: "true" };
      if (selectedDoctor) {
        params.doctorId = selectedDoctor;
        // Pass doctor name so the PatientRegistration pipeline can filter by packageSoldBy
        const docObj = doctors.find((d: any) => d._id === selectedDoctor);
        const docName = docObj?.name || (docObj?.firstName && docObj?.lastName ? `${docObj.firstName} ${docObj.lastName}` : null);
        if (docName) params.doctorName = docName;
      }
      if (selectedSalesStaff) params.salesStaffId = selectedSalesStaff;
      if (selectedDepartment) params.departmentId = selectedDepartment;
      if (selectedClinic) params.clinicId = selectedClinic;
      if (selectedPaymentMethod) params.paymentMethod = selectedPaymentMethod;
      
      const qs = new URLSearchParams(params).toString();
      
      console.log('DEBUG KPI Click - Sales Staff Filter:', { 
        selectedSalesStaff, 
        selectedDoctor,
        params, 
        qs 
      });
      
      // Fetch packages sold data
      const res = await fetch(`/api/clinic/reports/packages-sold?${qs}`, { headers });
      const json = await res.json();
      
      console.log('DEBUG KPI Click - API Response:', { 
        ok: res.ok, 
        success: json.success, 
        dataLength: json.data?.length,
        error: json.error 
      });
      
      if (!res.ok || !json.success) {
        console.error('Failed to fetch packages sold data', json);
        // Show modal with empty data
        setKpiModal({ open: true, title: kpiType, data: [] });
        return;
      }
      
      const soldPackages = json.data || [];
      
      // When doctor filter is active with includeUnpaid=true, the API skips the
      // doctorId filter on the Billing pipeline (to avoid matching on treating
      // doctor instead of seller). So we filter Billing results on the frontend
      // by matching the doctor's name against the soldBy field.
      let filteredPackages = soldPackages;
      if (selectedDoctor) {
        const docObj = doctors.find((d: any) => d._id === selectedDoctor);
        const docName = docObj?.name || (docObj?.firstName && docObj?.lastName ? `${docObj.firstName} ${docObj.lastName}` : null);
        if (docName) {
          filteredPackages = soldPackages.filter((p: any) => {
            // Keep packages from PatientRegistration pipeline (doctorName filter applied server-side)
            // and packages from Billing pipeline where soldBy matches the doctor name
            const soldBy = p.soldBy || '';
            // PatientRegistration rows have doctorName = "Unknown" and no invoicedBy match
            // Billing rows have soldBy = invoicedBy name
            return soldBy === docName || !soldBy || soldBy === '';
          });
        }
      }
      
      console.log('DEBUG KPI Click - Sold Packages Count:', soldPackages.length);
      console.log('DEBUG KPI Click - First 3 packages:', soldPackages.slice(0, 3));
      
      console.log('DEBUG KPI Click - Sold Packages Count:', soldPackages.length);
      console.log('DEBUG KPI Click - Current Metrics:', { 
        totalRevenue: currentMetrics.totalRevenue,
        paidRevenue: currentMetrics.paidRevenue,
        outstanding: currentMetrics.outstanding 
      });
      
      // Filter out packages with no name or 0 total value (invalid data)
      const validPackages = filteredPackages.filter((p: any) => 
        p.packageName && p.packageName.trim() !== '' && (p.totalValue || 0) > 0
      );
      
      console.log('DEBUG KPI Click - Valid Packages Count:', validPackages.length);
      
      switch (kpiType) {
        case 'totalPackagesSold':
          title = 'Total Packages Sold';
          data = validPackages.map((p: any) => ({
            packageName: p.packageName,
            patientName: p.patientName,
            amount: p.totalValue || 0,
            paidAmount: p.totalPaid || 0,
            pending: p.totalPending || 0,
            paymentStatus: p.paymentStatus || 'Unknown',
            date: p.firstPurchaseDate
          }));
          console.log('DEBUG Total Packages - Data sum:', data.reduce((sum, d) => sum + d.amount, 0));
          break;
          
        case 'totalRevenue':
          title = 'Total Revenue';
          data = validPackages.map((p: any) => ({
            packageName: p.packageName,
            patientName: p.patientName,
            amount: p.totalValue || 0,
            paidAmount: p.totalPaid || 0,
            paymentStatus: p.paymentStatus || 'Unknown',
            date: p.firstPurchaseDate
          }));
          console.log('DEBUG Total Revenue - Data sum:', data.reduce((sum, d) => sum + d.amount, 0));
          console.log('DEBUG Total Revenue - Individual amounts:', data.map(d => ({ name: d.packageName, amount: d.amount })));
          break;
          
        case 'paidRevenue':
          title = 'Paid Revenue';
          data = validPackages
            .filter((p: any) => (p.totalPending || 0) === 0)
            .map((p: any) => ({
              packageName: p.packageName,
              patientName: p.patientName,
              amount: p.totalValue || 0,
              paidAmount: p.totalPaid || 0,
              date: p.firstPurchaseDate
            }));
          console.log('DEBUG Paid Revenue - Data sum:', data.reduce((sum, d) => sum + d.amount, 0));
          break;
          
        case 'outstanding':
          title = 'Outstanding';
          data = validPackages
            .filter((p: any) => (p.totalPending || 0) > 0)
            .map((p: any) => ({
              packageName: p.packageName,
              patientName: p.patientName,
              amount: p.totalValue || 0,
              paidAmount: p.totalPaid || 0,
              pending: p.totalPending || 0,
              date: p.firstPurchaseDate
            }));
          console.log('DEBUG Outstanding - Data sum:', data.reduce((sum, d) => sum + d.pending, 0));
          break;
          
        case 'paidPackages':
          title = 'Paid Packages';
          data = validPackages
            .filter((p: any) => (p.totalPending || 0) === 0)
            .map((p: any) => ({
              packageName: p.packageName,
              patientName: p.patientName,
              amount: p.totalValue || 0,
              date: p.firstPurchaseDate
            }));
          console.log('DEBUG Paid Packages - Count:', data.length);
          break;
          
        case 'partiallyPaid':
          title = 'Partially Paid';
          data = validPackages
            .filter((p: any) => (p.totalPaid || 0) > 0 && (p.totalPending || 0) > 0)
            .map((p: any) => ({
              packageName: p.packageName,
              patientName: p.patientName,
              amount: p.totalValue || 0,
              paidAmount: p.totalPaid || 0,
              pending: p.totalPending || 0,
              date: p.firstPurchaseDate
            }));
          console.log('DEBUG Partially Paid - Count:', data.length);
          break;
          
        case 'unpaidPackages':
          title = 'Unpaid Packages';
          data = validPackages
            .filter((p: any) => (p.totalPaid || 0) === 0)
            .map((p: any) => ({
              packageName: p.packageName,
              patientName: p.patientName,
              amount: p.totalValue || 0,
              date: p.firstPurchaseDate
            }));
          console.log('DEBUG Unpaid Packages - Count:', data.length);
          break;
          
        default:
          title = kpiType;
          data = [];
      }
      
      setKpiModal({ open: true, title, data });
    } catch (e) {
      console.error('Error fetching KPI details:', e);
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
      setSalesStaffLeaderboard([]);
      setLifecycleSummary(null);
      return;
    }
    setRows(json.data || []);
    setTopPackagesSummary(json.summary || null);
    setTopPackagesPreviousSummary(json.previousSummary || null);
    setMonthlyRevenue(json.monthlyRevenue || []);
    setCombinedSummary(json.combinedSummary || null);
    setDoctorLeaderboard(json.doctorLeaderboard || []);
    setDepartmentRevenueData(json.departmentRevenueData || []);
    setSalesStaffLeaderboard(json.salesStaffLeaderboard || []);
    setLifecycleSummary(json.lifecycleSummary || null);
  }

  // Fetch the overview data for all sections: Revenue Trend, Payment Status,
  // Doctor Leaderboard, Sales Staff, KPI cards, etc.
  // Uses the actual selected date range (startDate/endDate) so all sections
  // filter consistently based on the user's date selection.
  async function fetchOverview() {
    try {
      const startD = new Date(startDate);
      if (isNaN(startD.getTime())) return; // Guard against invalid startDate

      const params: any = { startDate, endDate, limit: "10" };
      if (selectedClinic) params.clinicId = selectedClinic;
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/clinic/reports/package-performance?${qs}`, { headers });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setOverviewMonthlyRevenue([]);
        setOverviewDoctorLeaderboard([]);
        setOverviewSalesStaffLeaderboard([]);
        setOverviewCombinedSummary(null);
        return;
      }
      setOverviewMonthlyRevenue(json.monthlyRevenue || []);
      setOverviewDoctorLeaderboard(json.doctorLeaderboard || []);
      setOverviewSalesStaffLeaderboard(json.salesStaffLeaderboard || []);
      setOverviewCombinedSummary(json.combinedSummary || null);
    } catch (e) {
      console.error("Error fetching overview:", e);
      setOverviewMonthlyRevenue([]);
      setOverviewDoctorLeaderboard([]);
      setOverviewSalesStaffLeaderboard([]);
      setOverviewCombinedSummary(null);
    }
  }

  // Fetch expiry KPI data from PatientRegistration (active/expired/expiring packages)
  // Only responds to date range filter, not doctor/sales staff/payment method filters
  async function fetchPackageExpiry() {
    try {
      const params: any = { startDate, endDate };
      if (selectedClinic) params.clinicId = selectedClinic;
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/clinic/reports/package-expiry?${qs}`, { headers });
      const json = await res.json();
      if (res.ok && json.success) {
        setExpiryData(json.data || null);
      } else {
        setExpiryData(null);
      }
    } catch (e) {
      console.error("Error fetching package expiry:", e);
      setExpiryData(null);
    }
  }

  async function fetchPackagesSold(p = 1) {
    const params: any = { startDate, endDate, page: String(p), limit: "1000" };
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
    console.log('fetchPackagesSold response:', { summary: json.summary, dataLength: json.data?.length });
    setPackagesSoldPreviousSummary(json.previousSummary || null);
    setHasNext(Boolean(json.pagination?.hasNext));
    setTotalPages(json.pagination?.totalPages || 1);
    setTotalResults(json.pagination?.total || 0);
    setPage(p);
  }

  // Fetch all packages sold data for export
  async function fetchAllPackagesSold() {
    let allData: any[] = [];
    let currentPage = 1;
    let hasMore = true;
    
    while (hasMore) {
      const params: any = { startDate, endDate, page: String(currentPage), limit: "1000" };
      if (selectedDepartment) params.departmentId = selectedDepartment;
      if (selectedDoctor) params.doctorId = selectedDoctor;
      if (selectedSalesStaff) params.salesStaffId = selectedSalesStaff;
      if (selectedClinic) params.clinicId = selectedClinic;
      if (selectedPaymentMethod) params.paymentMethod = selectedPaymentMethod;
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`/api/clinic/reports/packages-sold?${qs}`, { headers });
      const json = await res.json();
      
      if (res.ok && json.success && json.data) {
        allData = [...allData, ...json.data];
        hasMore = Boolean(json.pagination?.hasNext);
        currentPage++;
      } else {
        hasMore = false;
      }
    }
    
    setAllSoldRows(allData);
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

  async function openUsage(patientId: string, packageName: string, patientName?: string) {
    const qs = new URLSearchParams({ packageName }).toString();
    const res = await fetch(`/api/clinic/package-usage/${patientId}?${qs}`, { headers });
    const json = await res.json();
    if (res.ok && json.success) {
      setDetail({ open: true, patientId, packageName, patientName, data: json.packageUsage || [] });
    } else {
      setDetail({ open: true, patientId, packageName, patientName, data: { error: json.message || "Failed to load" } });
    }
  }

  const { currency } = useCurrency();
  
  const currencyFormatter = (n: number) => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  };
  
  const formatCurrency = (n: number) => currencyFormatter(n);
  
  const formatK = (value: number): string => {
    const symbol = getCurrencySymbol(currency);
    return `${symbol}${(value / 1000).toFixed(1)}K`;
  };

  // Formats a date value as YYYY-MM-DD for the Package Registry columns
  const formatDate = (value: any): string => {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("en-CA");
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
    // const topSummary = topPackagesSummary;
    const prevTopSummary = topPackagesPreviousSummary;

    // When NO filter is active, sum BOTH Doctor Leaderboard (Billing) and Sales Staff (PatientRegistration)
    // to show the total of all packages regardless of attribution.
    // When a filter IS active, use combinedSummary since filters apply to Billing data.
    const hasAnyFilter = selectedDoctor || selectedDepartment || selectedSalesStaff || selectedClinic || selectedPaymentMethod;
    
    // Calculate totals from Doctor Leaderboard (Billing collection, grouped by doctor)
    // Note: doctorLeaderboard has 'packages' and 'revenue' fields, but NOT payment status breakdown
    // Use overviewDoctorLeaderboard if available (matches what's shown in UI), else doctorLeaderboard
    // IMPORTANT: Only count packages for the SELECTED MONTH, not all months
    let doctorLeaderboardData = overviewDoctorLeaderboard.length > 0 ? overviewDoctorLeaderboard : doctorLeaderboard;
    
    // Filter by selected doctor if doctor filter is active
    if (selectedDoctor) {
      // Find the doctor name from the doctors array (selectedDoctor is an ID, not a name)
      const selectedDoctorObj = doctors.find(d => d._id === selectedDoctor);
      const selectedDoctorName = selectedDoctorObj?.name || (selectedDoctorObj?.firstName && selectedDoctorObj?.lastName ? `${selectedDoctorObj.firstName} ${selectedDoctorObj.lastName}` : null);
      
      if (selectedDoctorName) {
        doctorLeaderboardData = doctorLeaderboardData.filter(d => d.name === selectedDoctorName);
      } else {
        // If we can't find the name, filter by ID if available in the data
        doctorLeaderboardData = doctorLeaderboardData.filter(d => d._id === selectedDoctor || d.doctorId === selectedDoctor);
      }
    }
    
    console.log('DEBUG doctorLeaderboardData:', doctorLeaderboardData);
    console.log('DEBUG selectedDoctor:', selectedDoctor);
    console.log('DEBUG selectedMonth:', selectedMonth);
    console.log('DEBUG individual doctor revenues:', doctorLeaderboardData.map(d => {
      const monthEntry = (d.monthWiseData || []).find((m: any) => m.month === selectedMonth);
      return { name: d.name, monthRevenue: monthEntry?.revenue || 0, totalRevenue: d.revenue || 0 };
    }));
    
    // Use total values from overview data - API already filters by the selected
    // date range, so we must NOT further filter by selectedMonth (which would
    // restrict data to a single calendar month when the range spans multiple months).
    const doctorTotalPackages = doctorLeaderboardData.reduce((sum: number, d: any) => {
      return sum + (d.packages || 0);
    }, 0);
    const doctorTotalRevenue = doctorLeaderboardData.reduce((sum: number, d: any) => {
      return sum + (d.revenue || 0);
    }, 0);
    // Doctor leaderboard doesn't have paid/partially paid/unpaid breakdown, so these are 0
    const doctorPaidPackages = 0;
    // const doctorPartiallyPaid = 0;
    // const doctorUnpaidPackages = 0;
    // const doctorTotalPaid = 0; // Will use revenue as approximation
    // const doctorTotalPending = 0;
    
    // Calculate sales staff totals inline
    // Use overviewSalesStaffLeaderboard (from package-performance API) which matches the Sales Staff UI section
    // This includes all sales staff who have invoiced packages, not just registered agents
    const salesStaffData = overviewSalesStaffLeaderboard.length > 0 ? overviewSalesStaffLeaderboard : salesStaff;
    
    const salesStaffFiltered = selectedSalesStaff 
      ? salesStaffData.filter(s => s.staffId === selectedSalesStaff || s.name === selectedSalesStaff) 
      : salesStaffData;
    
    console.log('DEBUG salesStaffData:', salesStaffData);
    console.log('DEBUG salesStaffFiltered:', salesStaffFiltered);
    console.log('DEBUG individual sales staff revenues:', salesStaffFiltered.map(s => ({ name: s.name, totalRevenue: s.totalRevenue, totalPaid: s.totalPaid })));
    
    const salesStaffTotals = salesStaffFiltered.reduce(
      (acc, staff) => {
        // Use total values from overview data - API already filters by the
        // selected date range, so no need to filter by selectedMonth.
        return {
          totalPackagesSold: acc.totalPackagesSold + (staff.totalPackagesSold || 0),
          totalRevenue: acc.totalRevenue + (staff.totalRevenue || 0),
          totalPaid: acc.totalPaid + (staff.totalPaid || 0),
          totalPending: acc.totalPending + (staff.totalPending || 0),
          paidPackages: acc.paidPackages + (staff.paidPackages || 0),
          partiallyPaidPackages: acc.partiallyPaidPackages + (staff.partiallyPaidPackages || 0),
          unpaidPackages: acc.unpaidPackages + (staff.unpaidPackages || 0),
        };
      },
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
    
    console.log('Doctor Leaderboard totals:', { doctorTotalPackages, doctorTotalRevenue, doctorPaidPackages });
    console.log('Sales Staff totals:', salesStaffTotals);
    
    // Primary source depends on whether filters are active
    let primarySource: any = null;
    let useSalesStaffSum = true;
    
    if (!hasAnyFilter) {
      // No filter: calculate from soldRows (packages-sold API) which has correct
      // totalPending from Billing's pending field (includes advance/claim settlements).
      // salesStaffTotals uses totalPrice - paidAmount which doesn't account for advance,
      // causing Outstanding to show incorrect values when packages are paid via advance.
      const validRows = (soldRows || []).filter((p: any) => 
        p.packageName && p.packageName.trim() !== '' && (p.totalValue || 0) > 0
      );
      
      primarySource = {
        totalPackagesSold: validRows.length,
        totalRevenue: validRows.reduce((sum: number, p: any) => sum + (p.totalValue || 0), 0),
        totalPaid: validRows.reduce((sum: number, p: any) => sum + (p.totalPaid || 0), 0),
        totalPending: validRows.reduce((sum: number, p: any) => sum + (p.totalPending || 0), 0),
        paidPackages: validRows.filter((p: any) => (p.totalPending || 0) === 0).length,
        partiallyPaid: validRows.filter((p: any) => (p.totalPaid || 0) > 0 && (p.totalPending || 0) > 0).length,
        unpaidPackages: validRows.filter((p: any) => (p.totalPaid || 0) === 0).length,
      };
    } else if (selectedDoctor) {
      // Doctor filter: use filtered doctor sales staff data for all KPIs
      // Get doctor name for matching with sales staff data
      const selectedDoctorObj = doctors.find(d => d._id === selectedDoctor);
      const selectedDoctorName = selectedDoctorObj?.name || doctors.find(d => `${d.firstName || ''} ${d.lastName || ''}`.trim() === selectedDoctor)?.name || '';
      
      console.log('DEBUG doctor filter:', { 
        selectedDoctor, 
        selectedDoctorName, 
        doctorsList: doctors.map(d => ({ id: d._id, name: d.name })),
        salesStaffDataList: salesStaffData.map(s => ({ name: s.name, staffId: s.staffId, unpaidPackages: s.unpaidPackages, totalPending: s.totalPending }))
      });
      
      // Get sales staff data for this doctor to calculate ALL KPIs
      // Use salesStaffData (from overviewSalesStaffLeaderboard) which has correct names
      const doctorSalesStaffData = selectedDoctorName 
        ? salesStaffData.filter(s => s.name === selectedDoctorName)
        : [];
      
      console.log('DEBUG doctor sales staff data:', { doctorSalesStaffData });
      
      // Calculate full totals from doctorSalesStaffData, just like salesStaffTotals
      const doctorSalesStaffTotals = doctorSalesStaffData.reduce(
        (acc, staff) => {
          // Use total values from overview data - API already filters by the
          // selected date range, so no need to filter by selectedMonth.
          return {
            totalPackagesSold: acc.totalPackagesSold + (staff.totalPackagesSold || 0),
            totalRevenue: acc.totalRevenue + (staff.totalRevenue || 0),
            totalPaid: acc.totalPaid + (staff.totalPaid || 0),
            totalPending: acc.totalPending + (staff.totalPending || 0),
            paidPackages: acc.paidPackages + (staff.paidPackages || 0),
            partiallyPaidPackages: acc.partiallyPaidPackages + (staff.partiallyPaidPackages || 0),
            unpaidPackages: acc.unpaidPackages + (staff.unpaidPackages || 0),
          };
        },
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
      
      console.log('DEBUG doctor sales staff totals:', doctorSalesStaffTotals);
      
      // Use these totals for primary source, same as sales staff filter
      // Use total values from overview data - API already filters by the
      // selected date range, so no need to filter by selectedMonth.
      primarySource = {
        totalPackagesSold: doctorSalesStaffTotals.totalPackagesSold,
        totalRevenue: doctorSalesStaffTotals.totalRevenue,
        totalPaid: doctorSalesStaffTotals.totalPaid,
        totalPending: doctorSalesStaffTotals.totalPending,
        paidPackages: doctorSalesStaffTotals.paidPackages,
        partiallyPaid: doctorSalesStaffTotals.partiallyPaidPackages,
        unpaidPackages: doctorSalesStaffTotals.unpaidPackages,
      };
    } else if (selectedSalesStaff) {
      // Sales Staff filter: use filtered sales staff data (same as doctor filter)
      const salesStaffFiltered = salesStaffData.filter(s => s.staffId === selectedSalesStaff || s.name === selectedSalesStaff);
      
      // Calculate full totals from filtered salesStaffData, just like salesStaffTotals
      const filteredSalesStaffTotals = salesStaffFiltered.reduce(
        (acc, staff) => {
          // Use total values from overview data - API already filters by the
          // selected date range, so no need to filter by selectedMonth.
          return {
            totalPackagesSold: acc.totalPackagesSold + (staff.totalPackagesSold || 0),
            totalRevenue: acc.totalRevenue + (staff.totalRevenue || 0),
            totalPaid: acc.totalPaid + (staff.totalPaid || 0),
            totalPending: acc.totalPending + (staff.totalPending || 0),
            paidPackages: acc.paidPackages + (staff.paidPackages || 0),
            partiallyPaidPackages: acc.partiallyPaidPackages + (staff.partiallyPaidPackages || 0),
            unpaidPackages: acc.unpaidPackages + (staff.unpaidPackages || 0),
          };
        },
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
      
      console.log('DEBUG filtered sales staff totals:', filteredSalesStaffTotals);
      
      primarySource = {
        totalPackagesSold: filteredSalesStaffTotals.totalPackagesSold,
        totalRevenue: filteredSalesStaffTotals.totalRevenue,
        totalPaid: filteredSalesStaffTotals.totalPaid,
        totalPending: filteredSalesStaffTotals.totalPending,
        paidPackages: filteredSalesStaffTotals.paidPackages,
        partiallyPaid: filteredSalesStaffTotals.partiallyPaidPackages,
        unpaidPackages: filteredSalesStaffTotals.unpaidPackages,
      };
    } else {
      // Other filters (department, clinic, payment method): calculate from soldRows data
      // combinedSummary doesn't have correct paid/outstanding breakdown for payment method filter
      // soldRows comes from packages-sold API which has the correct structure
      console.log('DEBUG Payment Method Filter - soldRows data:', {
        soldRowsLength: soldRows?.length,
        firstRow: soldRows?.[0]
      });
      
      const validRows = (soldRows || []).filter((p: any) => 
        p.packageName && p.packageName.trim() !== '' && (p.totalValue || 0) > 0
      );
      
      primarySource = {
        totalPackagesSold: validRows.length,
        totalRevenue: validRows.reduce((sum: number, p: any) => sum + (p.totalValue || 0), 0),
        totalPaid: validRows.reduce((sum: number, p: any) => sum + (p.totalPaid || 0), 0),
        totalPending: validRows.reduce((sum: number, p: any) => sum + (p.totalPending || 0), 0),
        paidPackages: validRows.filter((p: any) => (p.totalPending || 0) === 0).length,
        partiallyPaid: validRows.filter((p: any) => (p.totalPaid || 0) > 0 && (p.totalPending || 0) > 0).length,
        unpaidPackages: validRows.filter((p: any) => (p.totalPaid || 0) === 0).length,
      };
      
      console.log('DEBUG Payment Method Filter - Calculated from soldRows:', primarySource);
    }
    
    console.log('DEBUG KPI metrics:', { 
      useSalesStaffSum, 
      totalPackagesSold: useSalesStaffSum ? salesStaffTotals.totalPackagesSold : (primarySource?.totalPackagesSold ?? 0),
      totalPending: useSalesStaffSum ? salesStaffTotals.totalPending : (primarySource?.totalPending ?? 0),
      unpaidPackages: useSalesStaffSum ? salesStaffTotals.unpaidPackages : (primarySource?.unpaidPackages ?? 0)
    });
    
    console.log('metrics calculation:', { hasAnyFilter, useSalesStaffSum, doctorTotalPackages, salesStaffTotalPackages: salesStaffTotals.totalPackagesSold });
    console.log('DEBUG revenue calculation:', { 
      doctorTotalRevenue, 
      salesStaffTotals: {
        totalRevenue: salesStaffTotals.totalRevenue,
        totalPaid: salesStaffTotals.totalPaid,
      },
      calculatedTotalRevenue: doctorTotalRevenue + salesStaffTotals.totalRevenue,
      calculatedTotalPaid: doctorTotalRevenue + salesStaffTotals.totalPaid,
    });
    
    // When no filter, use Sales Staff totals as single source of truth
    // This represents unique package sales by invoicer, preventing double-counting
    // when the same person is both doctor AND invoicer (e.g., prabhu)
    // Doctor Leaderboard shows breakdown by doctor for display only
    // When any filter is active, use primarySource instead
    const useFilteredSource = hasAnyFilter;
    
    const totalPackagesSold = !useFilteredSource && useSalesStaffSum 
      ? salesStaffTotals.totalPackagesSold
      : (primarySource?.totalPackagesSold ?? primarySource?.totalPackages ?? 0);
    
    const totalRevenue = !useFilteredSource && useSalesStaffSum
      ? salesStaffTotals.totalRevenue
      : (primarySource?.totalRevenue ?? primarySource?.totalPaid ?? 0);
    
    const prevTotalRevenue = prevTopSummary?.totalRevenue ?? 0;
    
    // Calculate actual paid amounts
    // Use Sales Staff totals to prevent double-counting
    const totalPaid = !useFilteredSource && useSalesStaffSum
      ? salesStaffTotals.totalPaid
      : (primarySource?.totalPaid ?? 0);
    
    const prevTotalPaid = prevSummary?.totalPaid ?? 0;
    
    const totalPending = !useFilteredSource && useSalesStaffSum
      ? salesStaffTotals.totalPending
      : (primarySource?.totalPending ?? 0);
    
    const prevTotalPending = prevSummary?.totalPending ?? 0;
    
    // Calculate payment status counts
    // Use Sales Staff totals to prevent double-counting
    const paidPackages = !useFilteredSource && useSalesStaffSum
      ? salesStaffTotals.paidPackages
      : (primarySource?.paidPackages ?? 0);
    
    const prevPaidPackages = prevSummary?.paidPackages ?? 0;
    
    const partiallyPaid = !useFilteredSource && useSalesStaffSum
      ? salesStaffTotals.partiallyPaidPackages
      : (primarySource?.partiallyPaid ?? 0);
    
    const prevPartiallyPaid = prevSummary?.partiallyPaid ?? 0;
    
    const unpaidPackages = !useFilteredSource && useSalesStaffSum
      ? salesStaffTotals.unpaidPackages
      : (primarySource?.unpaidPackages ?? 0);
    
    const prevUnpaidPackages = prevSummary?.unpaidPackages ?? 0;
    
    const prevTotalPackagesSold = prevSummary?.totalPackagesSold ?? 0;
    
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

    // Calculate average sessions used per package from API summary
    // (summary aggregates across ALL sold packages, not just the current page)
    const totalUsedSessions = summary?.totalUsedSessions ?? 0;
    const totalSessionsAll = summary?.totalSessions ?? 0;
    const avgSessionsUsed = totalPackagesSold > 0
      ? Number((totalUsedSessions / totalPackagesSold).toFixed(1))
      : 0;
    const avgTotalSessions = totalPackagesSold > 0
      ? Number((totalSessionsAll / totalPackagesSold).toFixed(1))
      : 0;
    
    // Calculate renewal rate from API summary (actual sold package data)
    const expiredPackagesCount = summary?.expiredPackages ?? 0;
    const expiring7DaysSum = summary?.expiring7Days ?? 0;
    const expiring30DaysSum = summary?.expiring30Days ?? 0;
    const totalAtRisk = expiredPackagesCount + expiring7DaysSum + expiring30DaysSum;
    const renewalRate = (completedPackages + totalAtRisk) > 0
      ? Number(((completedPackages / (completedPackages + totalAtRisk)) * 100).toFixed(1))
      : 0;

    // Use expiryData from PatientRegistration for expiry KPIs (active/expired/expiring)
    // Falls back to package template calculation if expiryData is not available
    const useExpiryData = expiryData !== null;
    const finalActiveCount = useExpiryData ? expiryData.activePackages : activeCount;
    const finalExpiredCount = useExpiryData ? expiryData.expiredPackages : expiredCount;
    const finalExpiring7Days = useExpiryData ? expiryData.expiring7Days : expiring7DaysCount;
    const finalExpiring30Days = useExpiryData ? expiryData.expiring30Days : expiring30DaysCount;
    const finalRenewalOpportunities = useExpiryData ? expiryData.renewalOpportunities : (expiredCount + expiring7DaysCount + expiring30DaysCount);

    if (!useExpiryData) {
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
    }

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
      activePackages: finalActiveCount,
      activePackagesTrend: calculateTrend(finalActiveCount, prevActivePackages),
      completedPackages,
      completedPackagesTrend: calculateTrend(completedPackages, prevCompletedPackages),
      expiredPackages: finalExpiredCount,
      expiring7Days: finalExpiring7Days,
      expiring30Days: finalExpiring30Days,
      unusedPackages,
      unusedPackagesTrend: calculateTrend(unusedPackages, prevUnusedPackages),
      renewalOpportunities: finalRenewalOpportunities,
      avgPackageValue: totalPackagesSold > 0 ? (totalPaid + totalPending) / totalPackagesSold : 0,
      avgSessionsUsed,
      avgTotalSessions,
      renewalRate,
      inactiveHolders: unusedPackages,
    };
  }, [rows, soldRows, topPackagesSummary, topPackagesPreviousSummary, packagesSoldSummary, packagesSoldPreviousSummary, packages, combinedSummary, overviewCombinedSummary, selectedDoctor, selectedDepartment, selectedSalesStaff, selectedClinic, selectedPaymentMethod, doctorLeaderboard, overviewDoctorLeaderboard, salesStaff, overviewSalesStaffLeaderboard, expiryData]);

  // Calculate total sales staff KPIs
  // const salesStaffMetrics = useMemo(() => {
  //   const filtered = selectedSalesStaff 
  //     ? salesStaff.filter(s => s.staffId === selectedSalesStaff) 
  //     : salesStaff;
  //   const totals = filtered.reduce(
  //     (acc, staff) => ({
  //       totalPackagesSold: acc.totalPackagesSold + (staff.totalPackagesSold || 0),
  //       totalRevenue: acc.totalRevenue + (staff.totalRevenue || 0),
  //       totalPaid: acc.totalPaid + (staff.totalPaid || 0),
  //       totalPending: acc.totalPending + (staff.totalPending || 0),
  //       paidPackages: acc.paidPackages + (staff.paidPackages || 0),
  //       partiallyPaidPackages: acc.partiallyPaidPackages + (staff.partiallyPaidPackages || 0),
  //       unpaidPackages: acc.unpaidPackages + (staff.unpaidPackages || 0),
  //     }),
  //     {
  //       totalPackagesSold: 0,
  //       totalRevenue: 0,
  //       totalPaid: 0,
  //       totalPending: 0,
  //       paidPackages: 0,
  //       partiallyPaidPackages: 0,
  //       unpaidPackages: 0,
  //     }
  //   );

  //   return {
  //     totalPackagesSold: totals.totalPackagesSold,
  //     totalRevenue: totals.totalRevenue,
  //     paidRevenue: totals.totalPaid,
  //     outstanding: totals.totalPending,
  //     paidPackages: totals.paidPackages,
  //     partiallyPaid: totals.partiallyPaidPackages,
  //     unpaidPackages: totals.unpaidPackages,
  //   };
  // }, [salesStaff, selectedSalesStaff]);

  // These sections must stay independent of the dashboard filters, so they use
  // the dedicated overview fetch (date range + clinic scope only), falling back
  // to the filtered response if the overview hasn't loaded yet.
  const revenueTrendData = overviewMonthlyRevenue.length > 0 ? overviewMonthlyRevenue : monthlyRevenue;
  const effectiveDoctorLeaderboard = overviewDoctorLeaderboard.length > 0 ? overviewDoctorLeaderboard : doctorLeaderboard;
  const effectiveSalesStaffLeaderboard = overviewSalesStaffLeaderboard.length > 0 ? overviewSalesStaffLeaderboard : salesStaffLeaderboard;

  // Dynamic payment status data from metrics (filtered by active filters)
  // Uses metrics data to match KPI cards, not overview data which is unfiltered
  const paymentStatusData = useMemo(() => {
    const paid = metrics.paidPackages ?? 0;
    const partial = metrics.partiallyPaid ?? 0;
    const unpaid = metrics.unpaidPackages ?? 0;
    return [
      { name: "Paid", value: paid, color: "#00B42A" },
      { name: "Partial", value: partial, color: "#F7BA1E" },
      { name: "Unpaid", value: unpaid, color: "#F53F3F" },
    ];
  }, [metrics]);

  // Build the Top 5 doctor leaderboard for the selected date range.
  //
  // Uses the total values from the API response, which already filters by
  // the selected date range.
  //
  // Sync rule: the Doctor Leaderboard must also include doctorStaff (role 'doctor' or
  // Doctor Leaderboard now includes doctorStaff entries from the API
  // (sourced from PatientRegistration, same calculation as Sales Staff).
  // No frontend backfill needed - API handles both doctors and doctorStaff.
  const topDoctorLeaderboardData = useMemo(() => {
    // Process doctor leaderboard data from API (includes both doctors and doctorStaff)
    // Use total values from the API which already filters by the selected date range.
    const monthData = (effectiveDoctorLeaderboard || [])
      .map((doc: any) => {
        return {
          ...doc,
          name: doc.name || "Unknown Doctor",
          packages: doc.packages || 0,
          revenue: doc.revenue || 0,
          monthWiseData: doc.monthWiseData || [],
        };
      })
      .filter((doc: any) => ((doc.packages || 0) > 0 || (doc.revenue || 0) > 0));

    return monthData
      .sort((a: any, b: any) => {
        const packagesDiff = (b.packages || 0) - (a.packages || 0);
        if (packagesDiff !== 0) return packagesDiff;
        return (b.revenue || 0) - (a.revenue || 0);
      })
      .slice(0, 5)
      .map((doc: any, index: number) => ({
        ...doc,
        rank: index + 1,
        initials: doc.name
          ? doc.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
          : "UD",
      }));
  }, [effectiveDoctorLeaderboard]);

  // Build the Top 5 sales staff leaderboard for the selected date range.
  //
  // Uses the total values from the API response, which already filters by
  // the selected date range. Previously this filtered monthWiseData by
  // selectedMonth, which only showed one month's data when the range spanned
  // multiple months.
  const topSalesStaffData = useMemo(() => {
    // Use total values from the API which already filters by the selected date range.
    const monthData = (effectiveSalesStaffLeaderboard || [])
      .map((s: any) => {
        return {
          ...s,
          name: s.name || "Unknown",
          totalPackagesSold: s.totalPackagesSold || 0,
          // Use totalPaid (paid amount) instead of totalRevenue (total package price)
          // to show only the collected amount, not the outstanding
          totalRevenue: s.totalPaid || 0,
          monthWiseData: s.monthWiseData || [],
        };
      })
      .filter((s: any) => ((s.totalPackagesSold || 0) > 0 || (s.totalRevenue || 0) > 0));
    
    return monthData
      .sort((a: any, b: any) => {
        const revenueDiff = (b.totalRevenue || 0) - (a.totalRevenue || 0);
        if (revenueDiff !== 0) return revenueDiff;
        return (b.totalPackagesSold || 0) - (a.totalPackagesSold || 0);
      })
      .slice(0, 5);
  }, [effectiveSalesStaffLeaderboard]);

  // Use real department revenue data from API, fall back to static data if empty
  const finalDepartmentRevenueData = departmentRevenueData.length > 0 ? departmentRevenueData : [
    { department: "Dermatology", revenue: 275000 },
    { department: "Aesthetics", revenue: 220000 },
    { department: "Orthopedics", revenue: 180000 },
    { department: "Dental", revenue: 145000 },
    { department: "Ophthalmology", revenue: 120000 },
    { department: "Cardiology", revenue: 95000 },
  ];

  // const branchData = [
  //   { branch: "OK", revenue: 320000 },
  //   { branch: "Al Olaya", revenue: 285000 },
  //   { branch: "Al Malqa", revenue: 230000 },
  //   { branch: "Diplomatic", revenue: 210000 },
  //   { branch: "Al Nakheel", revenue: 185000 },
  //   { branch: "Hittin", revenue: 120000 },
  // ];

  // const topPackagesData = rows.length > 0 ? rows : [
  //   { packageName: "Skin Rejuvenation Pro", totalBookings: 184, totalRevenue: 276000, growth: 18 },
  //   { packageName: "Laser Hair Removal 6x", totalBookings: 156, totalRevenue: 234000, growth: 12 },
  //   { packageName: "Anti-Aging Platinum", totalBookings: 134, totalRevenue: 201000, growth: 24 },
  //   { packageName: "Derma Glow Premium", totalBookings: 118, totalRevenue: 177000, growth: 9 },
  //   { packageName: "HydraFacial Series", totalBookings: 96, totalRevenue: 144000, growth: 15 },
  // ].map((p, i) => ({
  //   ...p,
  //   rank: i + 1,
  //   packageName: (p as any).packageName || `Package ${i + 1}`,
  //   totalBookings: (p as any).totalBookings || Math.floor(Math.random() * 200),
  //   totalRevenue: (p as any).totalRevenue || Math.floor(Math.random() * 300000),
  //   growth: (p as any).growth || Math.floor(Math.random() * 30),
  // }));

  // const outstandingAgingData = [
  //   { period: "0-30 Days", amount: 89000, accounts: 67, color: "#008891" },
  //   { period: "31-60 Days", amount: 54000, accounts: 41, color: "#F5A623" },
  //   { period: "61-90 Days", amount: 32000, accounts: 24, color: "#F78B2D" },
  //   { period: "90+ Days", amount: 22000, accounts: 16, color: "#F53F3F" },
  // ];

  // Dynamic expiring packages data using metrics from the cards
  const expiringPackagesData = useMemo(() => [
    { period: "Expired", count: metrics.expiredPackages, color: "#F53F3F" },
    { period: "Expiring in 7 Days", count: metrics.expiring7Days, color: "#F5A623" },
    { period: "Expiring in 30 Days", count: metrics.expiring30Days, color: "#008891" },
  ], [metrics]);

  // metrics useMemo now handles filter logic internally:
  // - No filter: uses packagesSoldSummary (Billing collection, ALL invoiced packages)
  // - Filter active: uses combinedSummary (filtered Billing data)
  const isSalesStaffActive = activeFilter === "salesStaff";
  const currentMetrics = metrics;

  const packageLifecycleData = useMemo(() => {
    // Use metrics values for Active and Renewed so they match the KPI cards
    // (metrics already reflects date range + all dashboard filters).
    const sold = currentMetrics.totalPackagesSold;
    const active = metrics.activePackages;
    const completed = lifecycleSummary?.completedPackages ?? metrics.completedPackages;
    const renewed = metrics.renewalOpportunities;
    return [
      { 
        label: "Sold", 
        value: sold, 
        color: "#008891", 
        total: sold 
      },
      { 
        label: "Active", 
        value: active, 
        color: "#10B981", 
        total: sold, 
        percentage: sold > 0 ? Math.round((active / sold) * 100) : 0 
      },
      { 
        label: "Completed", 
        value: completed, 
        color: "#3B82F6", 
        total: active, 
        percentage: active > 0 ? Math.round((completed / active) * 100) : 0 
      },
      { 
        label: "Renewed", 
        value: renewed, 
        color: "#8B5CF6", 
        total: completed, 
        percentage: completed > 0 ? Math.round((renewed / completed) * 100) : 0 
      },
    ];
  }, [currentMetrics, metrics, lifecycleSummary]);

  const kpiCards = [
    { label: "Total Packages Sold", kpiType: "totalPackagesSold", value: currentMetrics.totalPackagesSold.toLocaleString(), trend: isSalesStaffActive ? 0 : metrics.totalPackagesSoldTrend.value, trendUp: isSalesStaffActive ? false : metrics.totalPackagesSoldTrend.up, icon: "📦", subtitle: isSalesStaffActive ? "Sales Staff" : "All time" },
    { label: "Total Revenue", kpiType: "totalRevenue", value: formatCurrency(currentMetrics.totalRevenue), trend: isSalesStaffActive ? 0 : metrics.totalRevenueTrend.value, trendUp: isSalesStaffActive ? false : metrics.totalRevenueTrend.up, icon: "💲", subtitle: isSalesStaffActive ? "Sales Staff" : "This year" },
    { label: "Paid Revenue", kpiType: "paidRevenue", value: formatCurrency(currentMetrics.paidRevenue), trend: isSalesStaffActive ? 0 : metrics.paidRevenueTrend.value, trendUp: isSalesStaffActive ? false : metrics.paidRevenueTrend.up, icon: "✅", subtitle: isSalesStaffActive ? "Sales Staff" : "Collected" },
    { label: "Outstanding", kpiType: "outstanding", value: formatCurrency(currentMetrics.outstanding), trend: isSalesStaffActive ? 0 : (metrics.outstandingTrend ? (metrics.outstandingTrend.up ? metrics.outstandingTrend.value : -metrics.outstandingTrend.value) : 0), trendUp: isSalesStaffActive ? false : (metrics.outstandingTrend ? !metrics.outstandingTrend.up : false), icon: "⚠️", subtitle: isSalesStaffActive ? "Sales Staff" : "Pending collection" },
    { label: "Paid Packages", kpiType: "paidPackages", value: currentMetrics.paidPackages.toLocaleString(), trend: isSalesStaffActive ? 0 : metrics.paidPackagesTrend.value, trendUp: isSalesStaffActive ? false : metrics.paidPackagesTrend.up, icon: "✅", subtitle: isSalesStaffActive ? "Sales Staff" : "Fully settled" },
    { label: "Partially Paid", kpiType: "partiallyPaid", value: currentMetrics.partiallyPaid.toLocaleString(), trend: isSalesStaffActive ? 0 : metrics.partiallyPaidTrend.value, trendUp: isSalesStaffActive ? false : metrics.partiallyPaidTrend.up, icon: "⏳", subtitle: isSalesStaffActive ? "Sales Staff" : "Partial payment" },
    { label: "Unpaid Packages", kpiType: "unpaidPackages", value: currentMetrics.unpaidPackages.toLocaleString(), trend: isSalesStaffActive ? 0 : (metrics.unpaidPackagesTrend ? (metrics.unpaidPackagesTrend.up ? metrics.unpaidPackagesTrend.value : -metrics.unpaidPackagesTrend.value) : 0), trendUp: isSalesStaffActive ? false : (metrics.unpaidPackagesTrend ? !metrics.unpaidPackagesTrend.up : false), icon: "❌", subtitle: isSalesStaffActive ? "Sales Staff" : "No payment made" },
    { label: "Active Packages", kpiType: "activePackages", value: metrics.activePackages.toLocaleString(), trend: isSalesStaffActive ? 0 : metrics.activePackagesTrend.value, trendUp: isSalesStaffActive ? false : metrics.activePackagesTrend.up, icon: "📈", subtitle: "In progress" },
    { label: "Expired Packages", kpiType: "expiredPackages", value: metrics.expiredPackages.toLocaleString(), trend: 0, trendUp: false, icon: "⏰", subtitle: "Past expiry date" },
    { label: "Expiring in 7 Days", kpiType: "expiring7Days", value: metrics.expiring7Days.toLocaleString(), trend: 0, trendUp: false, icon: "⏳", subtitle: "Urgent action needed" },
    { label: "Expiring in 30 Days", kpiType: "expiring30Days", value: metrics.expiring30Days.toLocaleString(), trend: 0, trendUp: false, icon: "📅", subtitle: "Upcoming expirations" },
    { label: "Renewal Opportunities", kpiType: "renewalOpportunities", value: metrics.renewalOpportunities.toLocaleString(), trend: 0, trendUp: true, icon: "🔄", subtitle: "Ready to renew" },
  ];

  const packageExportSections = useMemo(() => [
    {
      title: "Package Analytics Dashboard Summary",
      headers: ["Metric", "Value", "Trend"],
      data: [
        { "Metric": "Total Packages Sold", "Value": currentMetrics.totalPackagesSold.toLocaleString(), "Trend": metrics.totalPackagesSoldTrend ? (metrics.totalPackagesSoldTrend.up ? `+${metrics.totalPackagesSoldTrend.value}%` : `${metrics.totalPackagesSoldTrend.value}%`) : "" },
        { "Metric": "Total Revenue", "Value": formatCurrency(currentMetrics.totalRevenue), "Trend": metrics.totalRevenueTrend ? (metrics.totalRevenueTrend.up ? `+${metrics.totalRevenueTrend.value}%` : `${metrics.totalRevenueTrend.value}%`) : "" },
        { "Metric": "Paid Revenue", "Value": formatCurrency(currentMetrics.paidRevenue), "Trend": metrics.paidRevenueTrend ? (metrics.paidRevenueTrend.up ? `+${metrics.paidRevenueTrend.value}%` : `${metrics.paidRevenueTrend.value}%`) : "" },
        { "Metric": "Outstanding", "Value": formatCurrency(currentMetrics.outstanding), "Trend": metrics.outstandingTrend ? (metrics.outstandingTrend.up ? `+${metrics.outstandingTrend.value}%` : `${metrics.outstandingTrend.value}%`) : "" },
        { "Metric": "Paid Packages", "Value": currentMetrics.paidPackages.toLocaleString(), "Trend": metrics.paidPackagesTrend ? (metrics.paidPackagesTrend.up ? `+${metrics.paidPackagesTrend.value}%` : `${metrics.paidPackagesTrend.value}%`) : "" },
        { "Metric": "Partially Paid", "Value": currentMetrics.partiallyPaid.toLocaleString(), "Trend": metrics.partiallyPaidTrend ? (metrics.partiallyPaidTrend.up ? `+${metrics.partiallyPaidTrend.value}%` : `${metrics.partiallyPaidTrend.value}%`) : "" },
        { "Metric": "Unpaid Packages", "Value": currentMetrics.unpaidPackages.toLocaleString(), "Trend": metrics.unpaidPackagesTrend ? (metrics.unpaidPackagesTrend.up ? `+${metrics.unpaidPackagesTrend.value}%` : `${metrics.unpaidPackagesTrend.value}%`) : "" },
        { "Metric": "Active Packages", "Value": metrics.activePackages.toLocaleString(), "Trend": metrics.activePackagesTrend ? (metrics.activePackagesTrend.up ? `+${metrics.activePackagesTrend.value}%` : `${metrics.activePackagesTrend.value}%`) : "" },
        { "Metric": "Expired Packages", "Value": metrics.expiredPackages.toLocaleString(), "Trend": "" },
        { "Metric": "Expiring in 7 Days", "Value": metrics.expiring7Days.toLocaleString(), "Trend": "" },
        { "Metric": "Expiring in 30 Days", "Value": metrics.expiring30Days.toLocaleString(), "Trend": "" },
        { "Metric": "Renewal Opportunities", "Value": metrics.renewalOpportunities.toLocaleString(), "Trend": "" },
      ],
    },
    {
      title: "Revenue Trend",
      headers: ["Month", "Actual Revenue", "Target Revenue"],
      data: revenueTrendData.map(m => ({
        "Month": m.month,
        "Actual Revenue": formatCurrency(m.actual || 0),
        "Target Revenue": formatCurrency(m.target || 0),
      })),
    },
    {
      title: "Payment Status",
      headers: ["Status", "Count"],
      data: paymentStatusData.map(p => ({
        "Status": p.name,
        "Count": p.value,
      })),
    },
    {
      title: "Expiring Packages Timeline",
      headers: ["Period", "Count"],
      data: expiringPackagesData.map(e => ({
        "Period": e.period,
        "Count": e.count,
      })),
    },
    {
      title: "Quick Metrics",
      headers: ["Metric", "Value"],
      data: [
        { "Metric": "Renewal Rate", "Value": `${metrics.renewalRate}%` },
        { "Metric": "Avg Sessions Used", "Value": `${metrics.avgSessionsUsed} / ${metrics.avgTotalSessions}` },
        { "Metric": "Inactive Holders", "Value": metrics.inactiveHolders.toLocaleString() },
        { "Metric": "Avg Package Value", "Value": formatCurrency(metrics.avgPackageValue) },
      ],
    },
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
      title: "Package Registry",
      headers: ["Package Name", "Patient Name", "Doctor Name", "Total Sessions", "Sessions Used", "Remaining Sessions", "Payment Status"],
      data: allSoldRows.map(r => ({
        "Package Name": r.packageName || "-",
        "Patient Name": r.patientName || "-",
        "Doctor Name": r.doctorName || "-",
        "Total Sessions": r.totalSessions ?? "-",
        "Sessions Used": r.sessionsUsed ?? 0,
        "Remaining Sessions": Math.max(0, (r.totalSessions || 0) - (r.sessionsUsed || 0)),
        "Payment Status": r.paymentStatus || "-",
      })),
    },
  ], [rows, allSoldRows, currentMetrics, metrics, revenueTrendData, paymentStatusData, expiringPackagesData]);

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
                📅 {!isNaN(new Date(startDate).getTime()) ? new Date(startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'Invalid Date'} - {!isNaN(new Date(endDate).getTime()) ? new Date(endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'Invalid Date'}
              </div>
              <ExportButtons 
                sections={packageExportSections} 
                filename="package-report" 
                title="Package Report"
              />
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
                        Select Departments
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
                        Select Doctors
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
                    ? salesStaff.find(s => s.name === selectedSalesStaff)?.name || selectedSalesStaff
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
                        Select Sales Staff
                      </button>
                      {salesStaff.map((staff) => (
                        <button
                          key={staff.staffId || staff._id || staff.name}
                          onClick={() => {
                            // Use name for filtering (matches overviewSalesStaffLeaderboard format)
                            setSelectedSalesStaff(staff.name);
                            setActiveFilter(null);
                          }}
                          className={`w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 rounded-md transition-colors ${
                            selectedSalesStaff === staff.name ? "bg-emerald-50 text-emerald-700" : ""
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
                        Select Payment Status
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mt-6">
          {kpiCards.map((card, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 cursor-pointer hover:shadow-md transition-shadow" onClick={() => card.kpiType && handleKpiCardClick(card.kpiType)}>
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
                <p className="text-xs text-gray-500">Monthly actual vs. target · {!isNaN(new Date(startDate).getTime()) ? new Date(startDate).getFullYear() : 'N/A'}</p>
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
                <AreaChart data={revenueTrendData}>
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
                    tickFormatter={(value) => formatCurrency(Number(value))}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value, name) => {
                      const numValue = Number(value);
                      if (name === 'actual') {
                        return [formatCurrency(numValue), 'Actual Revenue'];
                      }
                      if (name === 'target') {
                        return [formatCurrency(numValue), 'Target Revenue'];
                      }
                      return value;
                    }}
                    labelFormatter={(label) => {
                      const data = revenueTrendData.find((d) => d.month === label);
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
            <p className="text-xs text-gray-500 mb-4">{metrics.totalPackagesSold.toLocaleString()} total packages</p>
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
                    {item.value} ({Math.round((item.value / (metrics.totalPackagesSold || 1)) * 100)}%)
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
                    formatter={(value) => typeof value === 'number' ? formatK(value) : ''}
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
            </div>
            <div className="space-y-3">
              {topDoctorLeaderboardData.map((doc: any, index) => (
                <div key={index}>
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                    const details = document.getElementById(`doctor-details-${index}`);
                    if (details) {
                      details.classList.toggle('hidden');
                    }
                  }}>
                    <span className="text-xs font-semibold text-gray-400 w-4">{doc.rank}</span>
                    <div className="w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-semibold">
                      {doc.initials}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                      {/* <p className="text-xs text-gray-500">{doc.packagename || "Other"}</p> */}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{doc.packages}</p>
                      <p className="text-xs text-gray-500">{formatCurrency(doc.revenue || 0)}</p>
                    </div>
                  </div>
                  {doc.monthWiseData && doc.monthWiseData.length > 0 && (
                    <div id={`doctor-details-${index}`} className="hidden mt-2 ml-12 border-l-2 border-teal-100 pl-3">
                      <div className="space-y-1">
                        {doc.monthWiseData.map((m: any, i: number) => (
                          <div key={i} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">{m.month} {m.year}</span>
                            <span className="font-medium text-gray-900">{m.packages} · {formatCurrency(m.revenue || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
            </div>
            <div className="space-y-3">
              {topSalesStaffData.map((staff: any, index) => {
                // Get initials from name
                const initials = staff.name
                  ? staff.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                  : 'SS';
                // Calculate percentage of total revenue
                const totalRevenue = topSalesStaffData.reduce((sum: number, s: any) => sum + (s.totalRevenue || 0), 0);
                const percentage = totalRevenue > 0 ? Math.round((staff.totalRevenue / totalRevenue) * 100) : 0;
                
                return (
                  <div key={staff.staffId || index}>
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                      const details = document.getElementById(`sales-details-${index}`);
                      if (details) {
                        details.classList.toggle('hidden');
                      }
                    }}>
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
                        <p className="text-xs text-gray-500">{formatCurrency(Math.round(staff.totalRevenue || 0))}</p>
                      </div>
                    </div>
                    {staff.monthWiseData && staff.monthWiseData.length > 0 && (
                      <div id={`sales-details-${index}`} className="hidden mt-2 ml-12 border-l-2 border-emerald-100 pl-3">
                        <div className="space-y-1">
                          {staff.monthWiseData.map((m: any, i: number) => (
                            <div key={i} className="flex items-center justify-between text-xs">
                              <span className="text-gray-600">{m.month} {m.year}</span>
                              <span className="font-medium text-gray-900">{m.totalPackagesSold} · {formatCurrency(m.totalRevenue || 0)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                    formatter={(value) => typeof value === 'number' ? formatK(value) : ''}
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
                        {pkg.totalBookings} sold · {formatK(pkg.totalRevenue)}
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
            <p className="text-xs text-gray-500 mb-4">{formatK(198000)} total outstanding</p>
            <div className="space-y-4">
              {outstandingAgingData.map((item, index) => (
                <div key={index}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{item.period}</span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-gray-900">{formatK(item.amount)}</span>
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
            <p className="text-xs text-gray-500 mb-4">Packages expiring by period </p>
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
                  <span className="text-sm font-semibold text-gray-900">{metrics.renewalRate}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Avg Sessions Used</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-blue-600">{metrics.avgSessionsUsed} / {metrics.avgTotalSessions}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Inactive Holders</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-amber-600">{metrics.inactiveHolders} patients</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                {/* <span className="text-sm text-gray-600">Avg Package Value</span> */}
                {/* <div className="text-right">
                  <span className="text-sm font-semibold text-emerald-600">{formatCurrency(metrics.avgPackageValue)}</span>
                </div> */}
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
             
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-red-50 rounded-xl p-4 border border-red-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">⏰</div>
                <span className="text-xl font-bold text-red-800">{metrics.expiring7Days}</span>
              </div>
              <p className="text-sm font-semibold text-red-900 mb-3">Expiring Soon</p>
              
            </div>

            <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">⏰</div>
                <span className="text-xl font-bold text-orange-800">{metrics.expiredPackages}</span>
              </div>
              <p className="text-sm font-semibold text-orange-900 mb-3">Expired Packages</p>
              
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-700">💲</div>
                <span className="text-xl font-bold text-amber-800">{metrics.unpaidPackages}</span>
              </div>
              <p className="text-sm font-semibold text-amber-900 mb-3">Unpaid Packages</p>
              
            </div>

            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center text-gray-700">👤</div>
                <span className="text-xl font-bold text-gray-800">{metrics.inactiveHolders}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 mb-3">Inactive Patients</p>
             
            </div>

            <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
              <div className="flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center text-teal-700">🔄</div>
                <span className="text-xl font-bold text-teal-800">{metrics.renewalOpportunities}</span>
              </div>
              <p className="text-sm font-semibold text-teal-900 mb-3">Renewal Ready</p>
              
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
                        <div>
                          <p className="text-sm font-medium text-gray-900">{row.packageName || "Package"}</p>
                          <div className="flex items-center gap-1 text-xs text-gray-500">
                            {/* <span className="text-amber-500">🔥</span> Popular */}
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
                          <p className="text-xs text-gray-500">ID: {row.emrNumber || (row.patientId ? String(row.patientId).slice(-6) : "-")}</p>
                        </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.phone || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{row.doctorName || "Dr. Name"}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.branch || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{row.soldBy || "-"}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(Number(row.totalValue) || 0)}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{formatCurrency(Number(row.totalPaid) || 0)}</td>
                  <td className="px-4 py-3 text-sm text-red-600 font-semibold">{formatCurrency(Number(row.totalPending) || 0)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${(row.paymentStatus || "Paid") === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                      {row.paymentStatus || "Paid"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-900">{row.sessionsUsed || 0}/{row.totalSessions || 0}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${row.totalSessions > 0 ? Math.min(100, Math.round(((row.sessionsUsed || 0) / row.totalSessions) * 100)) : 0}%` }}></div>
                      </div>
                      <span className="text-xs text-gray-500">{row.totalSessions > 0 ? Math.min(100, Math.round(((row.sessionsUsed || 0) / row.totalSessions) * 100)) : 0}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-gray-600">{formatDate(row.firstPurchaseDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-emerald-500">●</span>
                      <span className="text-xs whitespace-nowrap text-gray-600">{formatDate(row.expirationDate)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap text-gray-600">{formatDate(row.lastActivityDate)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => openUsage(row.patientId || '123', row.packageName || 'Package', row.patientName || 'Patient')}
                        className="p-1 hover:bg-gray-100 rounded text-gray-500"
                      >
                        👁️
                      </button>
                      {/* <button className="p-1 hover:bg-gray-100 rounded text-gray-500">📄</button> */}
                      {/* <button className="p-1 hover:bg-gray-100 rounded text-gray-500">⋮</button> */}
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
            Showing {soldRows.length} of {totalResults} results · Page {page} of {totalPages}
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
              {(() => {
                const pages = [];
                if (totalPages <= 7) {
                  // If total pages are small, show all
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                  }
                } else {
                  // Show first 2 pages, then current-2, current, current+2, then last 2
                  pages.push(1);
                  if (page > 3) {
                    pages.push('...');
                  }
                  const start = Math.max(2, page - 2);
                  const end = Math.min(totalPages - 1, page + 2);
                  for (let i = start; i <= end; i++) {
                    pages.push(i);
                  }
                  if (page < totalPages - 2) {
                    pages.push('...');
                  }
                  pages.push(totalPages);
                }
                return pages.map((p, i) => (
                  typeof p === 'number' ? (
                    <button
                      key={i}
                      onClick={() => fetchPackagesSold(p)}
                      className={`w-8 h-8 rounded-lg text-sm ${p === page ? 'bg-teal-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                    >
                      {p}
                    </button>
                  ) : (
                    <span
                      key={i}
                      className="w-8 h-8 rounded-lg text-sm flex items-center justify-center text-gray-500"
                    >
                      {p}
                    </span>
                  )
                ));
              })()}
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
                Package Usage — {detail.packageName} ({detail.patientName || detail.patientId})
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
                    <div className="text-sm text-gray-600 mb-1">
                      Total Sessions Used: {(pkg.treatments || []).reduce((sum: number, t: any) => sum + (t.totalUsedSessions || 0), 0)}
                    </div>
                    <div className="text-sm text-gray-600 mb-1">
                      Total Allowed Sessions: {pkg.totalAllowedSessions ?? 0}
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      Remaining Sessions: {pkg.remainingSessions ?? Math.max(0, (pkg.totalAllowedSessions ?? 0) - (pkg.treatments || []).reduce((sum: number, t: any) => sum + (t.totalUsedSessions || 0), 0))}
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

      {/* KPI Detail Modal */}
      {kpiModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={() => setKpiModal({ open: false, title: '', data: [] })}>
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">{kpiModal.title}</h3>
              <button
                onClick={() => setKpiModal({ open: false, title: '', data: [] })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)]">
              {kpiModal.data.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No packages found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient Name</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                        {kpiModal.data[0]?.paidAmount !== undefined && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                        )}
                        {kpiModal.data[0]?.pending !== undefined && (
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Pending</th>
                        )}
                        {kpiModal.data[0]?.expirationDate && (
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {kpiModal.data.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.packageName || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{item.patientName || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">{formatCurrency(item.amount || 0)}</td>
                          {item.paidAmount !== undefined && (
                            <td className="px-4 py-3 text-sm text-right text-emerald-600">{formatCurrency(item.paidAmount || 0)}</td>
                          )}
                          {item.pending !== undefined && (
                            <td className="px-4 py-3 text-sm text-right text-red-500">{formatCurrency(item.pending)}</td>
                          )}
                          {item.expirationDate && (
                            <td className="px-4 py-3 text-sm text-gray-600">{new Date(item.expirationDate).toLocaleDateString()}</td>
                          )}
                          <td className="px-4 py-3 text-sm text-gray-600">{item.date ? new Date(item.date).toLocaleDateString() : 'N/A'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total: {kpiModal.data.length} package(s)</span>
                <button
                  onClick={() => setKpiModal({ open: false, title: '', data: [] })}
                  className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


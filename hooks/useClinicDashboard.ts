import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface ClinicInfo {
  name?: string;
  address?: string;
  owner?: { name?: string };
}

interface RevenueData {
  totalRevenue: number;
  cashCollection: number;
}

interface OpportunityData {
  totalPotential: number;
  recoveredSoFar: number;
  percentChangeVsYesterday: number;
}

interface PriorityData {
  appointments?: { count: number; list: any[] };
  openSlots?: { count: number; list: any[] };
  newLeads?: { count: number; list: any[] };
  followUps?: { count: number; list: any[] };
  hotLeads?: { count: number; list: any[] };
  packageRenewalsWeek?: { count: number; list: any[] };
}

interface RevenueAtRiskData {
  totalAmount: number;
  appointmentCount: number;
  appointmentsWithServicesCount: number;
  statusBreakdown: Record<string, number>;
  currency: string;
}

interface OutstandingBalanceData {
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
}

interface WinBackData {
  stats: { label: string; count: number }[];
  patients: any[];
}

interface TomorrowBusinessData {
  totalAppointments: number;
  bookedCount: number;
  cancelledCount: number;
  expectedRevenue: number;
  revenueAtRisk: number;
  potentialOpportunity: number;
  currency: string;
}

interface ClinicCapacityData {
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
}

interface BusinessIntelligenceData {
  newPatientCount: number;
  returningPatientCount: number;
  totalPatientCount: number;
  newPatientRevenue: number;
  returningPatientRevenue: number;
  expiringPackageCount: number;
  expiringPackageRevenue: number;
  referralCount: number;
  referralRevenue: number;
  existingServiceCount: number;
  existingServiceRevenue: number;
  totalRevenue: number;
  completedVisitCount: number;
  completedVisitsChange: number;
  averageBill: number;
  averageBillChange: number;
  noShowCount: number;
  noShowsChange: number;
  packageSalesCount: number;
  packageSalesChange: number;
  returningPatientsChange: number;
}

interface PatientDetail {
  patientName: string;
  patientType?: string;
  phone?: string;
  registeredDate?: string;
  appointmentCount?: number;
  totalRevenue?: number;
}

interface PatientRetentionData {
  newPatients: number;
  returningPatients: number;
  repeatVisitRate: number;
  inactivePatients: number;
  highValuePatients: number;
  avgPatientLTV: number;
  newPatientDetails: PatientDetail[];
  inactivePatientDetails: PatientDetail[];
  highValuePatientDetails: PatientDetail[];
}

interface StaffIntelligenceData {
  inClinic: number;
  available: number;
  withPatients: number;
  capacityAlerts: {
    doctorId: string;
    name: string;
    initials: string;
    appointmentCount: number;
    utilization: number;
  }[];
  roomData: {
    roomId: string;
    name: string;
    appointmentCount: number;
    utilization: number;
  }[];
  servicePerformance: {
    serviceId: string;
    name: string;
    count: number;
    rank: number;
  }[];
}

interface RecentOffer {
  id: string;
  title: string;
  offerType: string;
  status: string;
  code: string | null;
  detail: string;
  discountValue: number;
  cashbackAmount: number;
  usesCount: number;
  maxUses: number | null;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

interface ReferralData {
  referralPatients: number;
  referralRevenue: number;
}

interface PackageMembershipData {
  activePackageCount: number;
  totalRemainingSessions: number;
  expiringSoonCount: number;
  renewalOpportunityCount: number;
  renewalOpportunityValue: number;
  membershipRenewalsDueCount: number;
  membershipRenewalValue: number;
  discount: {
    todayAvgPercent: number;
    yesterdayAvgPercent: number;
    changePercent: number;
    todayTotalDiscount: number;
    todayBillingCount: number;
    todayOfferCount: number;
    estimatedMarginImpact: number;
  };
}

interface JourneyDetail {
  patientName: string;
  treatment: string;
  status: string;
  paid: number;
  amount: number;
  pending: number;
}

interface ExpiredStockItem {
  name: string;
  expiryDate: string;
  quantity: number;
}

interface ControlExceptionsData {
  collectedRevenue: number;
  outstandingAmount: number;
  incompleteJourneys: number;
  pendingDischarge: number;
  billingIncomplete: number;
  incompleteJourneyDetails: JourneyDetail[];
  pendingDischargeDetails: JourneyDetail[];
  billingIncompleteDetails: JourneyDetail[];
  criticalItems: number;
  belowReorderLevel: number;
  highCostItems: number;
  expiredStockDetails: ExpiredStockItem[];
  expensesAmount: number;
  payableWithin7Days: number;
}

interface RecommendationData {
  eveningServiceName: string | null;
  eveningServicePrice: number;
  eveningBookingCount: number;
  highValuePatientCount: number;
  highValuePatientRevenue: number;
}

interface WeekMetric {
  currentWeek: number;
  previousWeek: number;
  changePercent: number;
}

interface ZevaIntelligenceData {
  revenue: WeekMetric;
  newPatients: WeekMetric;
  repeatVisits: WeekMetric;
  noShows: WeekMetric;
  noShowAnomaly: { trend: string; percent: number; currentCount: number; previousCount: number };
  topServiceAnomaly: { serviceName: string | null; percent: number; trend: string; currentRevenue: number; previousRevenue: number; bookingCount: number };
  decreasingServiceAnomaly: { serviceName: string | null; percent: number; currentAvg: number; previousAvg: number };
}

interface RevenueLeakageData {
  unbilledAmount: number;
  unbilledCount: number;
  uncollectedAmount: number;
  uncollectedCount: number;
  missedRebookingCount: number;
  missedRebookingAmount: number;
  packageLeakageAmount: number;
  packageLeakageCount: number;
  totalLeakage: number;
  unbilledDetails: { appointmentId: string; patientId: string; patientName: string; services: string; amount: number; status: string }[];
  uncollectedDetails: { billingId: string; appointmentId: string; patientId: string; patientName: string; amount: number; paid: number; pending: number }[];
  missedRebookingPatients: string[];
  packageLeakageDetails: { patientId: string; patientName: string; mobile: string; packageName: string; masterPrice: number; paidAmount: number; leakage: number }[];
  funnel: {
    leadCount: number;
    bookingCount: number;
    visitCount: number;
    treatmentCount: number;
    packageCount: number;
    repeatVisitCount: number;
    leadPercent: number;
    bookingPercent: number;
    visitPercent: number;
    treatmentPercent: number;
    packagePercent: number;
    repeatPercent: number;
    statusCounts: Record<string, number>;
  };
}

export function useClinicDashboard(selectedDate: string) {
  const [loading, setLoading] = useState(true);
  const [clinicInfo, setClinicInfo] = useState<ClinicInfo>({});
  const [revenueData, setRevenueData] = useState<RevenueData>({ totalRevenue: 0, cashCollection: 0 });
  const [opportunityData, setOpportunityData] = useState<OpportunityData>({ totalPotential: 0, recoveredSoFar: 0, percentChangeVsYesterday: 0 });
  const [priorityData, setPriorityData] = useState<PriorityData>({});
  const [revenueAtRiskData, setRevenueAtRiskData] = useState<RevenueAtRiskData>({
    totalAmount: 0,
    appointmentCount: 0,
    appointmentsWithServicesCount: 0,
    statusBreakdown: {},
    currency: 'AED',
  });
  const [outstandingBalanceData, setOutstandingBalanceData] = useState<OutstandingBalanceData>({
    totalPending: 0,
    patientCount: 0,
    billingCount: 0,
    patients: [],
    billingList: [],
  });
  const [winBackData, setWinBackData] = useState<WinBackData>({ stats: [], patients: [] });
  const [tomorrowBusinessData, setTomorrowBusinessData] = useState<TomorrowBusinessData>({
    totalAppointments: 0,
    bookedCount: 0,
    cancelledCount: 0,
    expectedRevenue: 0,
    revenueAtRisk: 0,
    potentialOpportunity: 0,
    currency: 'AED',
  });
  const [clinicCapacityData, setClinicCapacityData] = useState<ClinicCapacityData>({
    available: 0,
    booked: 0,
    utilized: 0,
    unused: 0,
    primeTime: [],
  });
  const [businessIntelligenceData, setBusinessIntelligenceData] = useState<BusinessIntelligenceData>({
    newPatientCount: 0,
    returningPatientCount: 0,
    totalPatientCount: 0,
    newPatientRevenue: 0,
    returningPatientRevenue: 0,
    expiringPackageCount: 0,
    expiringPackageRevenue: 0,
    referralCount: 0,
    referralRevenue: 0,
    existingServiceCount: 0,
    existingServiceRevenue: 0,
    totalRevenue: 0,
    completedVisitCount: 0,
    completedVisitsChange: 0,
    averageBill: 0,
    averageBillChange: 0,
    noShowCount: 0,
    noShowsChange: 0,
    packageSalesCount: 0,
    packageSalesChange: 0,
    returningPatientsChange: 0,
  });
  const [patientRetentionData, setPatientRetentionData] = useState<PatientRetentionData>({
    newPatients: 0,
    returningPatients: 0,
    repeatVisitRate: 0,
    inactivePatients: 0,
    highValuePatients: 0,
    avgPatientLTV: 0,
    newPatientDetails: [],
    inactivePatientDetails: [],
    highValuePatientDetails: [],
  });
  const [staffIntelligenceData, setStaffIntelligenceData] = useState<StaffIntelligenceData>({
    inClinic: 0,
    available: 0,
    withPatients: 0,
    capacityAlerts: [],
    roomData: [],
    servicePerformance: [],
  });
  const [recentOffers, setRecentOffers] = useState<RecentOffer[]>([]);
  const [referralData, setReferralData] = useState<ReferralData>({
    referralPatients: 0,
    referralRevenue: 0,
  });
  const [packageMembershipData, setPackageMembershipData] = useState<PackageMembershipData>({
    activePackageCount: 0,
    totalRemainingSessions: 0,
    expiringSoonCount: 0,
    renewalOpportunityCount: 0,
    renewalOpportunityValue: 0,
    membershipRenewalsDueCount: 0,
    membershipRenewalValue: 0,
    discount: {
      todayAvgPercent: 0,
      yesterdayAvgPercent: 0,
      changePercent: 0,
      todayTotalDiscount: 0,
      todayBillingCount: 0,
      todayOfferCount: 0,
      estimatedMarginImpact: 0,
    },
  });
  const [controlExceptionsData, setControlExceptionsData] = useState<ControlExceptionsData>({
    collectedRevenue: 0,
    outstandingAmount: 0,
    incompleteJourneys: 0,
    pendingDischarge: 0,
    billingIncomplete: 0,
    incompleteJourneyDetails: [],
    pendingDischargeDetails: [],
    billingIncompleteDetails: [],
    criticalItems: 0,
    belowReorderLevel: 0,
    highCostItems: 0,
    expiredStockDetails: [],
    expensesAmount: 0,
    payableWithin7Days: 0,
  });
  const [recommendationData, setRecommendationData] = useState<RecommendationData>({
    eveningServiceName: null,
    eveningServicePrice: 0,
    eveningBookingCount: 0,
    highValuePatientCount: 0,
    highValuePatientRevenue: 0,
  });
  const [zevaIntelligenceData, setZevaIntelligenceData] = useState<ZevaIntelligenceData>({
    revenue: { currentWeek: 0, previousWeek: 0, changePercent: 0 },
    newPatients: { currentWeek: 0, previousWeek: 0, changePercent: 0 },
    repeatVisits: { currentWeek: 0, previousWeek: 0, changePercent: 0 },
    noShows: { currentWeek: 0, previousWeek: 0, changePercent: 0 },
    noShowAnomaly: { trend: "neutral", percent: 0, currentCount: 0, previousCount: 0 },
    topServiceAnomaly: { serviceName: null, percent: 0, trend: "below", currentRevenue: 0, previousRevenue: 0, bookingCount: 0 },
    decreasingServiceAnomaly: { serviceName: null, percent: 0, currentAvg: 0, previousAvg: 0 },
  });
  const [revenueLeakageData, setRevenueLeakageData] = useState<RevenueLeakageData>({
    unbilledAmount: 0,
    unbilledCount: 0,
    uncollectedAmount: 0,
    uncollectedCount: 0,
    missedRebookingCount: 0,
    missedRebookingAmount: 0,
    packageLeakageAmount: 0,
    packageLeakageCount: 0,
    totalLeakage: 0,
    unbilledDetails: [],
    uncollectedDetails: [],
    missedRebookingPatients: [],
    packageLeakageDetails: [],
    funnel: {
      leadCount: 0,
      bookingCount: 0,
      visitCount: 0,
      treatmentCount: 0,
      packageCount: 0,
      repeatVisitCount: 0,
      leadPercent: 100,
      bookingPercent: 0,
      visitPercent: 0,
      treatmentPercent: 0,
      packagePercent: 0,
      repeatPercent: 0,
      statusCounts: {},
    },
  });

  const fetchDashboardData = useCallback(async () => {
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken') || localStorage.getItem('agentToken') || sessionStorage.getItem('agentToken')
      : null;

    if (!token) return;

    setLoading(true);

    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Fetch Clinic Info
      const clinicRes = await axios.get('/api/clinics/myallClinic', { headers }).catch(() => null);
      if (clinicRes?.data?.success && clinicRes.data.clinic) {
        setClinicInfo(clinicRes.data.clinic);
      }

      // 2. Fetch Revenue Data (same logic as RevenueReport)
      // Since it works date wise, we pass selectedDate as both start and end to match today or selected day.
      const revenueParams = new URLSearchParams({
        startDate: selectedDate,
        endDate: selectedDate
      });
      const revenueRes = await axios.get(`/api/clinic/reports/revenue?${revenueParams.toString()}`, { headers }).catch(() => null);
      if (revenueRes?.data?.success) {
        const treatmentRev = revenueRes.data.data?.treatmentRevenue || 0;
        const packageRev = revenueRes.data.data?.packageRevenue || 0;
        const revenueByPaymentMethod = revenueRes.data.data?.revenueByPaymentMethod || [];

        let cashCollection = 0;
        const cashObj = revenueByPaymentMethod.find((m: any) => m.method && m.method.toLowerCase() === 'cash');
        if (cashObj) {
          cashCollection = cashObj.amount || 0;
        }

        setRevenueData({
          totalRevenue: treatmentRev + packageRev,
          cashCollection
        });
      }

      // 3. Fetch Revenue Opportunity
      const oppParams = { date: selectedDate };
      const oppRes = await axios.get('/api/agent/revenue-opportunity', { headers, params: oppParams }).catch(() => null);
      if (oppRes?.data?.success && oppRes.data.data) {
        setOpportunityData({
          totalPotential: oppRes.data.data.totalPotential || 0,
          recoveredSoFar: oppRes.data.data.recoveredSoFar || 0,
          percentChangeVsYesterday: oppRes.data.data.percentChangeVsYesterday || 0
        });
      }

      // 4. Fetch Priorities Data
      const morningParams = { timePeriod: 'morning', date: selectedDate };
      const afternoonParams = { timePeriod: 'afternoon', date: selectedDate };

      const [morningRes, afternoonRes] = await Promise.all([
        axios.get('/api/agent/priorities', { headers, params: morningParams }).catch(() => null),
        axios.get('/api/agent/priorities', { headers, params: afternoonParams }).catch(() => null),
      ]);

      const priorities: PriorityData = {};
      if (afternoonRes?.data?.success && afternoonRes.data.data) {
        priorities.openSlots = afternoonRes.data.data.openSlots;
        priorities.hotLeads = afternoonRes.data.data.hotLeads;
        priorities.packageRenewalsWeek = afternoonRes.data.data.packageRenewalsWeek;
      }
      if (morningRes?.data?.success && morningRes.data.data) {
        priorities.appointments = morningRes.data.data.appointments;
        priorities.newLeads = morningRes.data.data.newLeads;
        priorities.followUps = morningRes.data.data.followUps;
      }
      setPriorityData(priorities);

      // 5. Fetch Revenue At Risk (Cancelled, No Show, booked appointments with services)
      const riskRes = await axios.get('/api/clinic/revenue-at-risk', {
        headers,
        params: { date: selectedDate },
      }).catch(() => null);
      if (riskRes?.data?.success && riskRes.data.data) {
        setRevenueAtRiskData({
          totalAmount: riskRes.data.data.totalAmount || 0,
          appointmentCount: riskRes.data.data.appointmentCount || 0,
          appointmentsWithServicesCount: riskRes.data.data.appointmentsWithServicesCount || 0,
          statusBreakdown: riskRes.data.data.statusBreakdown || {},
          currency: riskRes.data.data.currency || 'AED',
        });
      }

      // 6. Fetch Outstanding Balance (billing pending > 0 for selected date appointments)
      const outstandingRes = await axios.get('/api/clinic/outstanding-balance', {
        headers,
        params: { date: selectedDate },
      }).catch(() => null);
      if (outstandingRes?.data?.success && outstandingRes.data.data) {
        setOutstandingBalanceData({
          totalPending: outstandingRes.data.data.totalPending || 0,
          patientCount: outstandingRes.data.data.patientCount || 0,
          billingCount: outstandingRes.data.data.billingCount || 0,
          patients: outstandingRes.data.data.patients || [],
          billingList: outstandingRes.data.data.billingList || [],
        });
      }

      // 7. Fetch Win Back Data (from appointment-timeline)
      const winBackRes = await axios.get('/api/agent/appointment-timeline', {
        headers,
        params: { date: selectedDate },
      }).catch(() => null);
      if (winBackRes?.data?.success && winBackRes.data.data?.winBack) {
        setWinBackData(winBackRes.data.data.winBack);
      }

      // 8. Fetch Tomorrow's Business Data
      const tomorrowRes = await axios.get('/api/clinic/tomorrow-business', {
        headers,
        params: { date: selectedDate },
      }).catch(() => null);
      if (tomorrowRes?.data?.success && tomorrowRes.data.data) {
        setTomorrowBusinessData({
          totalAppointments: tomorrowRes.data.data.totalAppointments || 0,
          bookedCount: tomorrowRes.data.data.bookedCount || 0,
          cancelledCount: tomorrowRes.data.data.cancelledCount || 0,
          expectedRevenue: tomorrowRes.data.data.expectedRevenue || 0,
          revenueAtRisk: tomorrowRes.data.data.revenueAtRisk || 0,
          potentialOpportunity: tomorrowRes.data.data.potentialOpportunity || 0,
          currency: tomorrowRes.data.data.currency || 'AED',
        });
      }

      // 9. Fetch Clinic Capacity Data
      const capacityRes = await axios.get('/api/clinic/clinic-capacity', {
        headers,
        params: { date: selectedDate },
      }).catch(() => null);
      if (capacityRes?.data?.success && capacityRes.data.data) {
        setClinicCapacityData({
          available: capacityRes.data.data.available || 0,
          booked: capacityRes.data.data.booked || 0,
          utilized: capacityRes.data.data.utilized || 0,
          unused: capacityRes.data.data.unused || 0,
          primeTime: capacityRes.data.data.primeTime || [],
        });
      }

      // 10. Fetch Business Intelligence Data (new vs returning patients + revenue)
      const biRes = await axios.get('/api/clinic/business-intelligence', {
        headers,
        params: { date: selectedDate },
      }).catch(() => null);
      if (biRes?.data?.success && biRes.data.data) {
        setBusinessIntelligenceData({
          newPatientCount: biRes.data.data.newPatientCount || 0,
          returningPatientCount: biRes.data.data.returningPatientCount || 0,
          totalPatientCount: biRes.data.data.totalPatientCount || 0,
          newPatientRevenue: biRes.data.data.newPatientRevenue || 0,
          returningPatientRevenue: biRes.data.data.returningPatientRevenue || 0,
          expiringPackageCount: biRes.data.data.expiringPackageCount || 0,
          expiringPackageRevenue: biRes.data.data.expiringPackageRevenue || 0,
          referralCount: biRes.data.data.referralCount || 0,
          referralRevenue: biRes.data.data.referralRevenue || 0,
          existingServiceCount: biRes.data.data.existingServiceCount || 0,
          existingServiceRevenue: biRes.data.data.existingServiceRevenue || 0,
          totalRevenue: biRes.data.data.totalRevenue || 0,
          completedVisitCount: biRes.data.data.completedVisitCount || 0,
          completedVisitsChange: biRes.data.data.completedVisitsChange || 0,
          averageBill: biRes.data.data.averageBill || 0,
          averageBillChange: biRes.data.data.averageBillChange || 0,
          noShowCount: biRes.data.data.noShowCount || 0,
          noShowsChange: biRes.data.data.noShowsChange || 0,
          packageSalesCount: biRes.data.data.packageSalesCount || 0,
          packageSalesChange: biRes.data.data.packageSalesChange || 0,
          returningPatientsChange: biRes.data.data.returningPatientsChange || 0,
        });
      }

      // 11. Fetch Patient Retention Data
      const retentionRes = await axios.get('/api/clinic/patient-retention', {
        headers,
        params: { date: selectedDate },
      }).catch(() => null);
      if (retentionRes?.data?.success && retentionRes.data.data) {
        setPatientRetentionData({
          newPatients: retentionRes.data.data.newPatients || 0,
          returningPatients: retentionRes.data.data.returningPatients || 0,
          repeatVisitRate: retentionRes.data.data.repeatVisitRate || 0,
          inactivePatients: retentionRes.data.data.inactivePatients || 0,
          highValuePatients: retentionRes.data.data.highValuePatients || 0,
          avgPatientLTV: retentionRes.data.data.avgPatientLTV || 0,
          newPatientDetails: retentionRes.data.data.newPatientDetails || [],
          inactivePatientDetails: retentionRes.data.data.inactivePatientDetails || [],
          highValuePatientDetails: retentionRes.data.data.highValuePatientDetails || [],
        });
      }

      // 12. Fetch Staff Intelligence Data
      const staffRes = await axios.get('/api/clinic/staff-intelligence', {
        headers,
        params: { date: selectedDate },
      }).catch(() => null);
      if (staffRes?.data?.success && staffRes.data.data) {
        setStaffIntelligenceData({
          inClinic: staffRes.data.data.inClinic || 0,
          available: staffRes.data.data.available || 0,
          withPatients: staffRes.data.data.withPatients || 0,
          capacityAlerts: staffRes.data.data.capacityAlerts || [],
          roomData: staffRes.data.data.roomData || [],
          servicePerformance: staffRes.data.data.servicePerformance || [],
        });
      }

      // 13. Fetch Recent Offers
      const offersRes = await axios.get('/api/clinic/recent-offers', { headers }).catch(() => null);
      if (offersRes?.data?.success && offersRes.data.data) {
        setRecentOffers(offersRes.data.data);
      }

      // 14. Fetch Referral Data
      const referralRes = await axios.get('/api/clinic/referral-data', { headers }).catch(() => null);
      if (referralRes?.data?.success && referralRes.data.data) {
        setReferralData({
          referralPatients: referralRes.data.data.referralPatients || 0,
          referralRevenue: referralRes.data.data.referralRevenue || 0,
        });
      }

      // 15. Fetch Revenue Leakage Data
      const leakageRes = await axios.get('/api/clinic/revenue-leakage', { headers, params: { date: selectedDate } }).catch(() => null);
      if (leakageRes?.data?.success && leakageRes.data.data) {
        const ld = leakageRes.data.data;
        setRevenueLeakageData({
          unbilledAmount: ld.unbilledAmount || 0,
          unbilledCount: ld.unbilledCount || 0,
          uncollectedAmount: ld.uncollectedAmount || 0,
          uncollectedCount: ld.uncollectedCount || 0,
          missedRebookingCount: ld.missedRebookingCount || 0,
          missedRebookingAmount: ld.missedRebookingAmount || 0,
          packageLeakageAmount: ld.packageLeakageAmount || 0,
          packageLeakageCount: ld.packageLeakageCount || 0,
          totalLeakage: ld.totalLeakage || 0,
          unbilledDetails: ld.unbilledDetails || [],
          uncollectedDetails: ld.uncollectedDetails || [],
          missedRebookingPatients: ld.missedRebookingPatients || [],
          packageLeakageDetails: ld.packageLeakageDetails || [],
          funnel: ld.funnel || {
            leadCount: 0,
            bookingCount: 0,
            visitCount: 0,
            treatmentCount: 0,
            packageCount: 0,
            repeatVisitCount: 0,
            leadPercent: 100,
            bookingPercent: 0,
            visitPercent: 0,
            treatmentPercent: 0,
            packagePercent: 0,
            repeatPercent: 0,
            statusCounts: {},
          },
        });
      }

      // 16. Fetch Package & Membership Intelligence
      const pkgRes = await axios.get('/api/clinic/package-membership-intelligence', { headers, params: { date: selectedDate } }).catch(() => null);
      if (pkgRes?.data?.success && pkgRes.data.data) {
        const pd = pkgRes.data.data;
        setPackageMembershipData({
          activePackageCount: pd.activePackageCount || 0,
          totalRemainingSessions: pd.totalRemainingSessions || 0,
          expiringSoonCount: pd.expiringSoonCount || 0,
          renewalOpportunityCount: pd.renewalOpportunityCount || 0,
          renewalOpportunityValue: pd.renewalOpportunityValue || 0,
          membershipRenewalsDueCount: pd.membershipRenewalsDueCount || 0,
          membershipRenewalValue: pd.membershipRenewalValue || 0,
          discount: pd.discount || {
            todayAvgPercent: 0,
            yesterdayAvgPercent: 0,
            changePercent: 0,
            todayTotalDiscount: 0,
            todayBillingCount: 0,
            todayOfferCount: 0,
            estimatedMarginImpact: 0,
          },
        });
      }

      // 17. Fetch Control & Exceptions Data
      const ctrlRes = await axios.get('/api/clinic/control-exceptions', { headers, params: { date: selectedDate } }).catch(() => null);
      if (ctrlRes?.data?.success && ctrlRes.data.data) {
        setControlExceptionsData({
          collectedRevenue: ctrlRes.data.data.collectedRevenue || 0,
          outstandingAmount: ctrlRes.data.data.outstandingAmount || 0,
          incompleteJourneys: ctrlRes.data.data.incompleteJourneys || 0,
          pendingDischarge: ctrlRes.data.data.pendingDischarge || 0,
          billingIncomplete: ctrlRes.data.data.billingIncomplete || 0,
          incompleteJourneyDetails: ctrlRes.data.data.incompleteJourneyDetails || [],
          pendingDischargeDetails: ctrlRes.data.data.pendingDischargeDetails || [],
          billingIncompleteDetails: ctrlRes.data.data.billingIncompleteDetails || [],
          criticalItems: ctrlRes.data.data.criticalItems || 0,
          belowReorderLevel: ctrlRes.data.data.belowReorderLevel || 0,
          highCostItems: ctrlRes.data.data.highCostItems || 0,
          expiredStockDetails: ctrlRes.data.data.expiredStockDetails || [],
          expensesAmount: ctrlRes.data.data.expensesAmount || 0,
          payableWithin7Days: ctrlRes.data.data.payableWithin7Days || 0,
        });
      }

      // 18. Fetch Zeva Intelligence Data
      const ziRes = await axios.get('/api/clinic/zeva-intelligence', { headers, params: { date: selectedDate } }).catch(() => null);
      if (ziRes?.data?.success && ziRes.data.data) {
        const zd = ziRes.data.data;
        setZevaIntelligenceData({
          revenue: { currentWeek: zd.revenue?.currentWeek || 0, previousWeek: zd.revenue?.previousWeek || 0, changePercent: zd.revenue?.changePercent || 0 },
          newPatients: { currentWeek: zd.newPatients?.currentWeek || 0, previousWeek: zd.newPatients?.previousWeek || 0, changePercent: zd.newPatients?.changePercent || 0 },
          repeatVisits: { currentWeek: zd.repeatVisits?.currentWeek || 0, previousWeek: zd.repeatVisits?.previousWeek || 0, changePercent: zd.repeatVisits?.changePercent || 0 },
          noShows: { currentWeek: zd.noShows?.currentWeek || 0, previousWeek: zd.noShows?.previousWeek || 0, changePercent: zd.noShows?.changePercent || 0 },
          noShowAnomaly: zd.noShowAnomaly || { trend: "neutral", percent: 0, currentCount: 0, previousCount: 0 },
          topServiceAnomaly: zd.topServiceAnomaly || { serviceName: null, percent: 0, trend: "below", currentRevenue: 0, previousRevenue: 0, bookingCount: 0 },
          decreasingServiceAnomaly: zd.decreasingServiceAnomaly || { serviceName: null, percent: 0, currentAvg: 0, previousAvg: 0 },
        });
      }

      // 19. Fetch Zeva Recommends (evening service + high-value patients)
      const zrRes = await axios.get('/api/agent/zeva-recommends', { headers, params: { date: selectedDate } }).catch(() => null);
      if (zrRes?.data?.success && zrRes.data.data) {
        const zd = zrRes.data.data;
        setRecommendationData({
          eveningServiceName: zd.eveningServiceName || null,
          eveningServicePrice: zd.eveningServicePrice || 0,
          eveningBookingCount: zd.eveningBookingCount || 0,
          highValuePatientCount: zd.highValuePatientCount || 0,
          highValuePatientRevenue: zd.highValuePatientRevenue || 0,
        });
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return {
    loading,
    clinicInfo,
    revenueData,
    opportunityData,
    priorityData,
    revenueAtRiskData,
    outstandingBalanceData,
    winBackData,
    tomorrowBusinessData,
    clinicCapacityData,
    businessIntelligenceData,
    patientRetentionData,
    staffIntelligenceData,
    recentOffers,
    referralData,
    revenueLeakageData,
    packageMembershipData,
    controlExceptionsData,
    zevaIntelligenceData,
    recommendationData,
    refreshData: fetchDashboardData
  };
}

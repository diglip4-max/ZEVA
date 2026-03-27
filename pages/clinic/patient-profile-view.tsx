import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import {
  Calendar, User, DollarSign, FileText, AlertCircle, Activity,
  CreditCard, TrendingUp, Package, Phone,
  Mail, Clock, Shield, X, CheckCircle, XCircle,
  AlertTriangle, Info, Plus, FileImage, Wallet, ClipboardList, Send
} from 'lucide-react';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import AddPatientAdvancePaymentModal from '@/components/patient/AddPatientAdvancePaymentModal';
import AddPatientPastAdvancePaymentModal from '@/components/patient/AddPatientPastAdvancePaymentModal';

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
  "adminToken",
];

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

// Modern Patient Profile Dashboard Component
const PatientProfileDashboard = ({ patientData, onClose }: { patientData: any; onClose: () => void }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showBeforeAfterModal, setShowBeforeAfterModal] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [appointmentFilter, setAppointmentFilter] = useState('all');
  const [loadingAppointments, setLoadingAppointments] = useState(false);
    const [packages, setPackages] = useState([]);
  const [memberships, setMemberships] = useState([]);
  const [transferredInPackages, setTransferredInPackages] = useState<any[]>([]);
  const [transferredOutPackages, setTransferredOutPackages] = useState<any[]>([]);
  const [transferredInMemberships, setTransferredInMemberships] = useState<any[]>([]);
  const [transferredOutMemberships, setTransferredOutMemberships] = useState<any[]>([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [billingHistory, setBillingHistory] = useState<any>(null);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [mediaDocuments, setMediaDocuments] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  
  // Consent Form Status States
  const [consentStatuses, setConsentStatuses] = useState<any[]>([]);
  const [loadingConsentStatus, setLoadingConsentStatus] = useState(false);
  
  // Stats state - fetched on mount
  const [statsData, setStatsData] = useState({
    totalVisits: 0,
    completedVisits: 0,
    completedInvoices: 0,
    cancelledNoShow: 0,
    activePackages: 0,
    pendingSessions: 0,
    insuranceClaimsPending: 0,
  });
  const [loadingStats, setLoadingStats] = useState(false);
  
  // Financial snapshot state
  const [financialData, setFinancialData] = useState({
    totalSpent: 0,
    pendingPayment: 0,
    advanceBalance: 0
  });

  // Advance & Pending balance state
  const [balance, setBalance] = useState({
    pendingBalance: 0,
    advanceBalance: 0,
    pastAdvanceBalance: 0,
    pastAdvance50PercentBalance: 0,
    pastAdvance54PercentBalance: 0,
    pastAdvance159FlatBalance: 0,
  });
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showAddAdvancePaymentModal, setShowAddAdvancePaymentModal] = useState(false);
  const [showAddPastAdvancePayment50PercentModal, setShowAddPastAdvancePayment50PercentModal] = useState(false);
  const [showAddPastAdvancePayment54PercentModal, setShowAddPastAdvancePayment54PercentModal] = useState(false);
  const [showAddPastAdvancePayment159FlatModal, setShowAddPastAdvancePayment159FlatModal] = useState(false);
  const [treatmentFilter, setTreatmentFilter] = useState<'all' | 'ongoing' | 'completed'>('all');

  if (!patientData) return null;

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'treatments', label: 'Treatments' },
    { id: 'billing', label: 'Billing' },
    { id: 'appointments', label: 'Appointments' },
    { id: 'packages-memberships', label: 'Packages & Memberships' },
    { id: 'insurance', label: 'Insurance' },
    { id: 'media', label: 'Media & Documents' },
    { id: 'communication', label: 'Communication Log' },
    { id: 'advance', label: 'Advance & Pending Balance' }
  ];

  // Mock data for demonstration (can be replaced with real API calls later)
  const stats = [
    {
      label: 'Total Visits',
      value: loadingStats ? '...' : statsData.totalVisits,
      icon: Activity,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Completed Invoices',
      value: loadingStats ? '...' : statsData.completedInvoices,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Cancelled/No Show',
      value: loadingStats ? '...' : statsData.cancelledNoShow,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-100'
    },
    {
      label: 'Active Packages',
      value: loadingStats ? '...' : statsData.activePackages,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'Pending Sessions',
      value: loadingStats ? '...' : statsData.pendingSessions,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      label: 'Insurance Claims Pending',
      value: loadingStats ? '...' : statsData.insuranceClaimsPending,
      icon: FileText,
      color: 'text-teal-600',
      bgColor: 'bg-teal-100'
    }
  ];

  // Activity Timeline — built from real appointments + billing data
  const timelineItems = (() => {
    const items: { icon: any; title: string; subtitle: string; date: string; color: string }[] = [];

    // From appointments (sorted newest first)
    const sortedApts = [...(appointments || [])].sort(
      (a: any, b: any) => new Date(b.startDate || b.createdAt).getTime() - new Date(a.startDate || a.createdAt).getTime()
    ).slice(0, 5);

    sortedApts.forEach((apt: any) => {
      const status = (apt.status || apt.appointmentStatus || '').toLowerCase();
      const dateStr = apt.registeredDate ||
        (apt.startDate ? new Date(apt.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
      const time = apt.fromTime ? ` at ${apt.fromTime}` : '';
      const doctor = apt.doctorName ? `with ${apt.doctorName}` : '';

      if (status === 'completed' || status === 'discharge') {
        items.push({ icon: Activity, title: 'Treatment Completed', subtitle: `${apt.treatmentName || apt.serviceName || 'Appointment'}${doctor ? ' ' + doctor : ''}`, date: dateStr + time, color: 'bg-purple-500' });
      } else if (status === 'rescheduled') {
        items.push({ icon: AlertTriangle, title: 'Appointment Rescheduled', subtitle: `${apt.treatmentName || 'Appointment'}${doctor ? ' ' + doctor : ''}`, date: dateStr + time, color: 'bg-yellow-500' });
      } else if (status === 'cancelled' || status === 'rejected') {
        items.push({ icon: XCircle, title: 'Appointment Cancelled', subtitle: `${apt.treatmentName || 'Appointment'}${doctor ? ' ' + doctor : ''}`, date: dateStr + time, color: 'bg-red-500' });
      } else {
        items.push({ icon: Calendar, title: `Appointment ${apt.status || 'Scheduled'}`, subtitle: `${apt.treatmentName || apt.serviceName || 'Appointment'}${doctor ? ' ' + doctor : ''}`, date: dateStr + time, color: 'bg-blue-500' });
      }
    });

    // From billing — add payment entries
    const billings = Array.isArray(billingHistory) ? billingHistory : [];
    billings.slice(0, 3).forEach((b: any) => {
      if (b.paid > 0) {
        const dateStr = b.invoicedDate || (b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
        items.push({ icon: DollarSign, title: 'Payment Received', subtitle: `د.إ${b.paid.toLocaleString()} — ${b.invoiceNumber || ''}`, date: dateStr, color: 'bg-green-500' });
      }
    });

    // Sort all by date desc, keep top 8
    return items.slice(0, 8);
  })();

  // Alerts — computed from real data
  const alerts = (() => {
    const list: { type: string; icon: any; message: string }[] = [];

    // Outstanding payment alert
    const outstanding = patientData?.outstanding || 0;
    if (outstanding > 0) {
      list.push({ type: 'danger', icon: AlertCircle, message: `Outstanding payment of د.إ${Number(outstanding).toLocaleString()}` });
    }

    // Rescheduled appointment alert
    const hasRescheduled = (appointments || []).some(
      (a: any) => (a.status || a.appointmentStatus || '').toLowerCase() === 'rescheduled'
    );
    if (hasRescheduled) {
      list.push({ type: 'warning', icon: AlertTriangle, message: 'Appointment reschedule requested' });
    }

    // Pending invoice alert
    const hasPendingInvoice = Array.isArray(billingHistory) && billingHistory.some(
      (b: any) => (b.status || '').toLowerCase() === 'pending' || (b.pending > 0)
    );
    if (hasPendingInvoice) {
      list.push({ type: 'warning', icon: AlertTriangle, message: 'Pending invoice payment' });
    }

    // Membership expiry
    if (patientData?.membershipEndDate) {
      try {
        const end = new Date(patientData.membershipEndDate);
        const now = new Date();
        const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft > 0 && daysLeft <= 30) {
          list.push({ type: 'info', icon: Info, message: `Membership expires in ${daysLeft} days` });
        } else if (daysLeft <= 0) {
          list.push({ type: 'danger', icon: AlertCircle, message: 'Membership has expired' });
        }
      } catch {}
    }

    // Insurance active
    if (patientData?.insurance === 'Yes') {
      list.push({ type: 'info', icon: Info, message: `Insurance: ${patientData?.insuranceType || 'Active'}` });
    }

    if (list.length === 0) {
      list.push({ type: 'info', icon: Info, message: 'No active alerts for this patient' });
    }

    return list;
  })();

  // Patient Behavior — using statsData (from Total Visits card) for accuracy
  const behaviorMetrics = (() => {
    const total = statsData.totalVisits;                    // from Total Visits card
    const completedCount = statsData.completedVisits;       // actual completed/discharge/approved
    const cancelled = statsData.cancelledNoShow;            // from Cancelled/No Show card

    // Visit bar fills based on totalVisits (every visit = 10%, max 100%)
    const visitBarValue = Math.min(100, total * 10);

    const noShowRate = total > 0 ? Math.min(100, Math.round((cancelled / total) * 100)) : 0;

    // Engagement score
    let engagementScore = 0;
    if (patientData?.email) engagementScore += 20;
    if (patientData?.mobile) engagementScore += 20;
    if (total > 0) engagementScore += 30;
    if (completedCount > 0) engagementScore += 20;
    if (patientData?.membership === 'Yes') engagementScore += 10;

    return [
      { label: `Visit Completion Rate`, value: visitBarValue, displayValue: total, color: 'bg-green-500' },
      { label: 'No-Show Rate', value: noShowRate, displayValue: null, color: 'bg-red-500' },
    ];
  })();

  const getInitials = (first: string, last: string) => {
    return `${first?.charAt(0) || ''}${last?.charAt(0) || ''}`.toUpperCase();
  };

  // Fetch appointments when appointments tab is active
  useEffect(() => {
    if (activeTab === 'appointments' && patientData?._id) {
      fetchAppointments();
    }
  }, [activeTab, appointmentFilter]);

  // Fetch appointments + billing for Treatments tab
  useEffect(() => {
    if (activeTab === 'treatments' && patientData?._id) {
      fetchAppointments();
      fetchBillingHistory();
    }
  }, [activeTab]);

  // Fetch packages and memberships when packages-memberships tab is active
  useEffect(() => {
    if (activeTab === 'packages-memberships' && patientData?._id) {
      fetchPackagesAndMemberships();
    }
  }, [activeTab]);

  // Fetch billing history when billing tab is active
  useEffect(() => {
    if (activeTab === 'billing' && patientData?._id) {
      fetchBillingHistory();
    }
  }, [activeTab]);

  // Fetch media and documents when media tab is active
  useEffect(() => {
    if (activeTab === 'media' && patientData?._id) {
      fetchMediaDocuments();
    }
  }, [activeTab]);

  // Fetch consent form statuses when communication tab is active
  useEffect(() => {
    if (activeTab === 'communication' && patientData?._id) {
      fetchConsentStatuses();
    }
  }, [activeTab]);

  // Fetch notes and communication when notes tab is active (commented out - replaced by Advance & Pending)
  // useEffect(() => {
  //   if (activeTab === 'notes' && patientData?._id) {
  //     fetchNotesAndCommunication();
  //   }
  // }, [activeTab]);

  // Fetch patient balance when advance tab is active
  useEffect(() => {
    if (activeTab === 'advance' && patientData?._id) {
      setBalanceLoading(true);
      fetchPatientBalance(patientData._id).then((data) => {
        if (data) setBalance(data as typeof balance);
      }).finally(() => setBalanceLoading(false));
    }
  }, [activeTab]);

  // Fetch stats on mount
  useEffect(() => {
    if (patientData?._id) {
      fetchOverviewData();
      fetchAppointments();   // also load appointments for Overview timeline
      fetchBillingHistory(); // also load billing for Overview financial/timeline
      // Fetch real advance & pending balances for Financial Snapshot
      fetchPatientBalance(patientData._id).then((data: any) => {
        if (data) {
          setFinancialData((prev: any) => ({
            ...prev,
            advanceBalance: data.advanceBalance || 0,
            pendingPayment: data.pendingBalance || prev.pendingPayment,
          }));
        }
      });
    }
  }, [patientData?._id]);

  const fetchAppointments = async () => {
    try {
      setLoadingAppointments(true);
      const headers = getAuthHeaders();
      if (!headers) return;

      const today = new Date().toISOString().split('T')[0];
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const response = await axios.get(
        `/api/clinic/all-appointments?page=1&limit=1000&fromDate=${oneYearAgo.toISOString().split('T')[0]}&toDate=${today}`,
        { headers }
      );
      
      if (response.data.success) {
        const patientAppointments = response.data.appointments?.filter(
          (apt: any) => apt.patientId === patientData._id
        ) || [];
        setAppointments(patientAppointments);
      }
    } catch (error: any) {
      console.error('Error fetching appointments:', error.message);
      // Set empty appointments on error to prevent continuous loading
      setAppointments([]);
    } finally {
      setLoadingAppointments(false);
    }
  };

  const fetchPackagesAndMemberships = async () => {
    try {
      setLoadingPackages(true);
      const headers = getAuthHeaders();
      if (!headers || !patientData?._id) return;

      // Fetch all clinic packages and memberships first
      const [mRes, pRes] = await Promise.all([
        axios.get('/api/clinic/memberships', { headers }),
        axios.get('/api/clinic/packages', { headers })
      ]);
      
      const allMemberships = mRes.data?.memberships || [];
      const allPackages = pRes.data?.packages || [];
      
      // Get patient's assigned package IDs and membership IDs
      let patientPackageIds = (patientData?.packages || []).map((p: any) => p.packageId);
      let patientMembershipIds = (patientData?.memberships || []).map((m: any) => m.membershipId);
      
      // Fetch package usage data for this patient
      let packageUsageData = [];
      let packageTransferredOutData: any[] = [];
      try {
        const usageRes = await axios.get(`/api/clinic/package-usage/${patientData._id}`, { headers });
        if (usageRes.data.success) {
          packageUsageData = usageRes.data.packageUsage || [];
          packageTransferredOutData = usageRes.data.transferredOut || [];
        }
      } catch (err: any) {
        console.error('Error fetching package usage:', err.message);
      }
      
      // Fetch membership usage data for this patient
      let membershipUsageData: any = null;
      let membershipTransferredOutData: any = null;
      try {
        const membershipUsageRes = await axios.get(`/api/clinic/membership-usage/${patientData._id}`, { headers });
        if (membershipUsageRes.data.success && membershipUsageRes.data.hasMembership) {
          membershipUsageData = membershipUsageRes.data;
        } else if (membershipUsageRes.data.success && membershipUsageRes.data.transferredOut) {
          membershipTransferredOutData = membershipUsageRes.data;
        }
      } catch (err: any) {
        console.error('Error fetching membership usage:', err.message);
      }
      
      // Process packages with usage data - separate active, transferred-in, and transferred-out
      const transferredOutPackageIds = new Set(packageTransferredOutData.map(p => String(p.packageId)));
      
      // Filter patientPackageIds to exclude transferred-out packages
      patientPackageIds = patientPackageIds.filter((pkgId: any) => 
        !transferredOutPackageIds.has(String(pkgId))
      );
      
      const patientPackages = allPackages.filter((pkg: any) => 
        patientPackageIds.includes(pkg._id)
      ).map((pkg: any) => {
        const calculatedTotalSessions = pkg.treatments?.reduce((sum: number, t: any) => sum + (parseInt(t.sessions) || 0), 0) || 0;
        
        // Find the patient's package assignment to get assigned date
        const patientPackage = patientData?.packages?.find((p: any) => p.packageId === pkg._id);
        
        // Find usage data for this package
        const usage = packageUsageData.find((u: any) => u.packageName === pkg.name);
        
        // Calculate used sessions from usage data
        let usedSessions = 0;
        let treatmentsWithUsage = pkg.treatments || [];
        
        if (usage) {
          usedSessions = usage.totalSessions || 0;
          // Enrich treatments with usage details
          treatmentsWithUsage = (pkg.treatments || []).map((treatment: any) => {
            const treatmentUsage = usage.treatments?.find((t: any) => t.treatmentSlug === treatment.treatmentSlug);
            return {
              ...treatment,
              usedSessions: treatmentUsage?.totalUsedSessions || 0,
              maxSessions: treatmentUsage?.maxSessions || treatment.sessions || 0,
              usageDetails: treatmentUsage?.usageDetails || []
            };
          });
        }
        
        return {
          ...pkg,
          totalSessions: pkg.totalSessions || calculatedTotalSessions || 0,
          usedSessions: usedSessions,
          status: 'active',
          assignedDate: patientPackage?.assignedDate || pkg.createdAt,
          treatments: treatmentsWithUsage,
          billingHistory: usage?.billingHistory || [],
          isTransferred: usage?.isTransferred || false,
          transferredFrom: usage?.transferredFrom || null,
          transferredFromName: usage?.transferredFromName || null,
          transferredPackageName: usage?.transferredPackageName || (usage?.isTransferred ? usage?.packageName : null) || null,
          totalAllowedSessions: usage?.totalAllowedSessions || null,
          remainingSessions: usage?.remainingSessions || null
        };
      });
      
      // Separate transferred-in packages from usage data
      const transferredInPkgs = packageUsageData
        .filter((u: any) => u.isTransferred && u.transferredFrom)
        .map((u: any) => ({
          packageName: u.packageName,
          transferredFromName: u.transferredFromName,
          transferredSessions: u.transferredSessions || 0,
          totalAllowedSessions: u.totalAllowedSessions || 0,
          remainingSessions: u.remainingSessions || 0,
          treatments: u.treatments || [],
          billingHistory: u.billingHistory || []
        }));
      
      // Process memberships with usage data - separate active, transferred-in, and transferred-out
      // Filter patientMembershipIds to exclude transferred-out memberships
      const transferredOutMembershipIds = new Set(
        (patientData?.membershipTransfers || [])
          .filter((t: any) => t.type === 'out')
          .map((t: any) => String(t.membershipId))
      );
      patientMembershipIds = patientMembershipIds.filter((membershipId: any) => 
        !transferredOutMembershipIds.has(String(membershipId))
      );
      
      const patientMemberships = allMemberships.filter((membership: any) => 
        patientMembershipIds.includes(membership._id)
      ).map((membership: any) => {
        // Find the patient's membership assignment to get dates
        const patientMembership = patientData?.memberships?.find((m: any) => m.membershipId === membership._id);
        
        // Enrich with usage data
        const enrichedMembership = {
          ...membership,
          startDate: patientMembership?.startDate || membership.startDate,
          endDate: patientMembership?.endDate || membership.endDate,
          status: 'active'
        };
        
        // Add usage data if available
        if (membershipUsageData) {
          (enrichedMembership as any).usageData = membershipUsageData;
        }
        
        return enrichedMembership;
      });
      
      // Separate transferred-in memberships from usage data
      const transferredInMembs = membershipUsageData && membershipUsageData.isTransferred ? [{
        membershipName: membershipUsageData.membershipName,
        transferredFromName: membershipUsageData.transferredFromName,
        transferredFreeConsultations: membershipUsageData.transferredFreeConsultations || 0,
        totalFreeConsultations: membershipUsageData.totalFreeConsultations || 0,
        remainingFreeConsultations: membershipUsageData.remainingFreeConsultations || 0,
        discountPercentage: membershipUsageData.discountPercentage || 0,
        isExpired: false,
        hasFreeConsultations: membershipUsageData.hasFreeConsultations || false
      }] : [];
      
      setPackages(patientPackages);
      setMemberships(patientMemberships);
      setTransferredInPackages(transferredInPkgs);
      setTransferredOutPackages(packageTransferredOutData);
      setTransferredInMemberships(transferredInMembs);
      setTransferredOutMemberships(membershipTransferredOutData ? [membershipTransferredOutData] : []);
    } catch (error: any) {
      console.error('Error fetching packages and memberships:', error.message);
      setPackages([]);
      setMemberships([]);
    } finally {
      setLoadingPackages(false);
    }
  };

  const fetchBillingHistory = async () => {
    try {
      setLoadingBilling(true);
      const headers = getAuthHeaders();
      if (!headers) return;

      const response = await axios.get(`/api/clinic/billing-history/${patientData._id}`, { headers });
      
      if (response.data.success) {
        const billings = response.data.billings || [];
        setBillingHistory(billings);
        
        // Calculate financial snapshot from billing data
        calculateFinancialSnapshot(billings);
      }
    } catch (error: any) {
      console.error('Error fetching billing history:', error.message);
      setBillingHistory(null);
    } finally {
      setLoadingBilling(false);
    }
  };

  const calculateFinancialSnapshot = (billings: any[]) => {
    let totalSpent = 0;

    billings.forEach((billing: any) => {
      // Use `billing.paid` — the actual paid field from Billing model
      const paid = parseFloat(billing.paid) || 0;
      totalSpent += paid;
    });

    setFinancialData((prev: any) => ({
      ...prev,
      totalSpent: Math.round(totalSpent),
      // pendingPayment and advanceBalance come from /api/clinic/patient-balance on mount
    }));
  };

  const fetchOverviewData = async () => {
    try {
      setLoadingStats(true);
      const headers = getAuthHeaders();
      if (!headers) return;

      const today = new Date().toISOString().split('T')[0];
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      // Fetch appointments + package-usage + billing in parallel
      const [appointmentsRes, packageUsageRes, billingRes] = await Promise.all([
        axios.get(
          `/api/clinic/all-appointments?page=1&limit=1000&fromDate=${oneYearAgo.toISOString().split('T')[0]}&toDate=${today}`,
          { headers }
        ),
        axios.get(`/api/clinic/package-usage/${patientData._id}`, { headers }).catch(() => ({ data: { success: false } })),
        axios.get(`/api/clinic/billing-history/${patientData._id}`, { headers }).catch(() => ({ data: { success: false } }))
      ]);

      let totalVisits = 0;
      let completedVisits = 0;
      let completedInvoices = 0;
      let cancelledNoShow = 0;
      let activePackages = 0;
      let pendingSessions = 0;
      let insuranceClaimsPending = 0;

      // Calculate from appointments
      if (appointmentsRes.data.success) {
        const patientAppointments = appointmentsRes.data.appointments?.filter(
          (apt: any) => apt.patientId === patientData._id
        ) || [];
        totalVisits = patientAppointments.length;
        patientAppointments.forEach((apt: any) => {
          const status = (apt.status || apt.appointmentStatus || '').toLowerCase();
          if (['cancelled', 'rejected', 'no show', 'no-show'].includes(status)) {
            cancelledNoShow += 1;
          }
          if (['completed', 'discharge', 'approved'].includes(status)) {
            completedVisits += 1;
          }
        });
      }

      // Calculate active packages from patientData.packages (one entry per assigned package)
      // and pending sessions from package-usage API (sums remaining across all name-groups)
      const assignedPackages: any[] = patientData?.packages || [];
      activePackages = assignedPackages.length;
      if (packageUsageRes.data.success) {
        const packageUsage: any[] = packageUsageRes.data.packageUsage || [];
        packageUsage.forEach((pkg: any) => {
          pendingSessions += pkg.remainingSessions ?? 0;
        });
      }

      // Completed invoices + Total Spent — from billing-history API
      if (billingRes.data.success) {
        const billings: any[] = billingRes.data.billings || [];
        completedInvoices = billings.filter(
          (b: any) => (b.status || '').toLowerCase() === 'paid' || (b.paid >= b.amount && b.amount > 0)
        ).length;

        // Total Spent = sum of all paid amounts (same as "Total Paid" in Billing tab)
        const totalSpent = billings.reduce((sum: number, b: any) => sum + (Number(b.paid) || 0), 0);
        setFinancialData((prev: any) => ({
          ...prev,
          totalSpent: Math.round(totalSpent),
        }));
      }

      // Insurance
      insuranceClaimsPending = patientData?.insurance === 'Yes' ? 1 : 0;

      setStatsData({
        totalVisits,
        completedVisits,
        completedInvoices,
        cancelledNoShow,
        activePackages,
        pendingSessions,
        insuranceClaimsPending,
      });
    } catch (error: any) {
      console.error('Error fetching stats data:', error.message);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchMediaDocuments = async () => {
    try {
      setLoadingMedia(true);
      const headers = getAuthHeaders();
      if (!headers) return;

      // Fetch before/after images from patient-complaints API
      const response = await axios.get('/api/clinic/patient-complaints', {
        headers,
        params: { patientId: patientData._id }
      });

      if (response.data.success) {
        // Map complaints that have before/after images
        const mediaItems = (response.data.complaints || [])
          .filter((c: any) => c.beforeImage || c.afterImage)
          .map((c: any) => ({
            _id: c._id,
            complaints: c.complaints,
            beforeImage: c.beforeImage || null,
            afterImage: c.afterImage || null,
            doctorName: c.doctorId?.name || 'Doctor',
            appointmentDate: c.appointmentId?.startDate || c.createdAt,
            visitId: c.appointmentId?.visitId || null,
            createdAt: c.createdAt,
          }));
        setMediaDocuments(mediaItems);
      }
    } catch (error: any) {
      console.error('Error fetching before/after images:', error.message);
      setMediaDocuments([]);
    } finally {
      setLoadingMedia(false);
    }
  };

  // Fetch consent form statuses
  const fetchConsentStatuses = async () => {
    setLoadingConsentStatus(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;

      // Fetch both signed consents and sent logs
      const [signaturesRes, logsRes] = await Promise.all([
        axios.get('/api/clinic/consent-status', {
          headers,
          params: { patientId: patientData._id },
        }),
        axios.get('/api/clinic/consent-log', {
          headers,
          params: { patientId: patientData._id },
        }),
      ]);

      const signatures = signaturesRes.data?.consentStatuses || [];
      const logs = logsRes.data?.consentLogs || [];

      // Merge logs and signatures
      const logMap = new Map();

      // Add all logs first (sent forms)
      logs.forEach((log: any) => {
        logMap.set(log.consentFormId, {
          _id: log._id,
          consentFormId: log.consentFormId,
          consentFormName: log.consentFormName,
          description: log.description || "",
          patientName: log.patientName,
          date: new Date(log.createdAt).toLocaleDateString('en-GB'),
          hasSignature: false,
          status: 'sent',
          signedAt: null,
        });
      });

      // Update with signatures if they exist (signed forms)
      signatures.forEach((sig: any) => {
        logMap.set(sig.consentFormId, {
          ...sig,
          status: 'signed',
        });
      });

      const merged = Array.from(logMap.values());
      setConsentStatuses(merged);
    } catch (error: any) {
      console.error('Error fetching consent statuses:', error.message);
      setConsentStatuses([]);
    } finally {
      setLoadingConsentStatus(false);
    }
  };

  const fetchPatientBalance = async (patientId: string) => {
    const headers = getAuthHeaders();
    if (!headers) return;
    try {
      const res = await axios.get(`/api/clinic/patient-balance/${patientId}`, { headers });
      const data = res?.data?.balances || {};
      return {
        pendingBalance: Number(data.pendingBalance || 0),
        advanceBalance: Number(data.advanceBalance || 0),
        pastAdvanceBalance: Number(data.pastAdvanceBalance || 0),
        pastAdvance50PercentBalance: Number(data.pastAdvance50PercentBalance || 0),
        pastAdvance54PercentBalance: Number(data.pastAdvance54PercentBalance || 0),
        pastAdvance159FlatBalance: Number(data.pastAdvance159FlatBalance || 0),
      };
    } catch {
      return { pendingBalance: 0, advanceBalance: 0, pastAdvanceBalance: 0, pastAdvance50PercentBalance: 0, pastAdvance54PercentBalance: 0, pastAdvance159FlatBalance: 0 };
    }
  };

  const formatAED = (v: number) => {
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    try { return `د.إ${v.toLocaleString()}`; } catch { return `د.إ${v}`; }
  };

  const filterAppointments = (appointmentsList: any[], filter: string) => {
    if (filter === 'all') return appointmentsList;
    return appointmentsList.filter((apt: any) => {
      const status = (apt.status || apt.appointmentStatus || '').toLowerCase();
      return status === filter.toLowerCase();
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      'booked':        { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Booked' },
      'enquiry':       { bg: 'bg-gray-100',   text: 'text-gray-700',   label: 'Enquiry' },
      'scheduled':     { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Scheduled' },
      'confirmed':     { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Confirmed' },
      'arrived':       { bg: 'bg-cyan-100',   text: 'text-cyan-700',   label: 'Arrived' },
      'waiting':       { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Waiting' },
      'consultation':  { bg: 'bg-indigo-100', text: 'text-indigo-700', label: 'Consultation' },
      'rescheduled':   { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Rescheduled' },
      'invoice':       { bg: 'bg-teal-100',   text: 'text-teal-700',   label: 'Invoice' },
      'approved':      { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Approved' },
      'completed':     { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Completed' },
      'discharge':     { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Discharged' },
      'cancelled':     { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Cancelled' },
      'rejected':      { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Rejected' },
      'no show':       { bg: 'bg-orange-100', text: 'text-orange-700', label: 'No-Show' },
      'no-show':       { bg: 'bg-orange-100', text: 'text-orange-700', label: 'No-Show' },
    };
    const key = (status || '').toLowerCase();
    const config = statusConfig[key] || { bg: 'bg-gray-100', text: 'text-gray-600', label: status || 'Unknown' };
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const filteredAppointments = filterAppointments(appointments, appointmentFilter);

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      {/* Top Header Bar */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm w-full">
        <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-gray-900 truncate">Patient Profile</h1>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors flex-shrink-0 ml-2"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        
        {/* Patient Profile Header Card */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-4 mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Left: Avatar + Info */}
            <div className="flex items-start gap-3">
              {/* Avatar */}
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-teal-400 to-cyan-500 flex items-center justify-center text-white text-xl font-bold shadow-lg flex-shrink-0">
                {getInitials(patientData.firstName, patientData.lastName)}
              </div>
              
              {/* Patient Info */}
              <div className="flex-1 min-w-0">
                <h2 className="text-base sm:text-xl font-bold text-gray-900 truncate">
                  {`${patientData.firstName || ''} ${patientData.lastName || ''}`.trim()}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 mt-1.5 text-xs">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Mail className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500 font-medium flex-shrink-0">Email:</span>
                    <span className="text-gray-800 truncate">{patientData.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <Phone className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500 font-medium flex-shrink-0">Mobile:</span>
                    <span className="text-gray-800">{patientData.countryCode || '+91'} {patientData.mobileNumber || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500 font-medium flex-shrink-0">Gender:</span>
                    <span className="text-gray-800">{patientData.gender || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="text-gray-500 font-medium flex-shrink-0">EMR:</span>
                    <span className="text-gray-800 font-semibold">{patientData.emrNumber || 'N/A'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Last Visit + Add Payment */}
            <div className="flex items-center gap-4 flex-shrink-0">
              {/* Last Visit */}
              <div className="text-center">
                <div className="text-[12px] font-semibold text-gray-800 font-medium mb-0.5">Last Visit</div>
                <div className="flex items-center gap-1 text-sm sm:text-base font-bold text-gray-900">
                  <Calendar className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  {(() => {
                    if (!appointments || appointments.length === 0) return 'N/A';
                    const sorted = [...appointments].sort((a: any, b: any) => {
                      const da = new Date(a.startDate || a.createdAt).getTime();
                      const db = new Date(b.startDate || b.createdAt).getTime();
                      return db - da;
                    });
                    const last: any = sorted[0];
                    if (last.startDate) return new Date(last.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    if (last.createdAt) return new Date(last.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                    return 'N/A';
                  })()}
                </div>
              </div>

              {/* Add Payment Button — teal gradient, opens Advance & Pending tab */}
              <button
                onClick={() => setActiveTab('advance')}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-lg hover:from-teal-600 hover:to-cyan-700 transition-all shadow-md font-medium text-xs whitespace-nowrap"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Add Payment
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards Row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className={`w-7 h-7 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                </div>
              </div>
              <div className="text-xl font-bold text-gray-900">{stat.value}</div>
              <div className="text-[10px] sm:text-xs text-gray-600">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200 mb-4">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-gray-200 px-2 py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap rounded-lg ${
                  activeTab === tab.id
                    ? 'border-b-0 border-transparent text-teal-600 bg-white underline-offset-4 transition-all underline '
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 underline-offset-4 transition-all'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area - No Container */}
        {activeTab === 'appointments' ? (
              /* Appointments Tab Content */
              <div className="space-y-4">
                {/* Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                  {[
                    { key: 'all',          label: 'All' },
                    { key: 'booked',       label: 'Booked' },
                    { key: 'enquiry',      label: 'Enquiry' },
                    { key: 'Arrived',      label: 'Arrived' },
                    { key: 'Waiting',      label: 'Waiting' },
                    { key: 'Consultation', label: 'Consultation' },
                    { key: 'Approved',     label: 'Approved' },
                    { key: 'Rescheduled',  label: 'Rescheduled' },
                    { key: 'Completed',    label: 'Completed' },
                    { key: 'Discharge',    label: 'Discharge' },
                    { key: 'invoice',      label: 'Invoice' },
                    { key: 'Cancelled',    label: 'Cancelled' },
                    { key: 'Rejected',     label: 'Rejected' },
                    { key: 'No Show',      label: 'No Show' },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setAppointmentFilter(filter.key)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                        appointmentFilter === filter.key
                          ? 'bg-green-600 text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
            
                {/* Appointments Table Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {loadingAppointments ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                    </div>
                  ) : filteredAppointments.length === 0 ? (
                    <div className="text-center py-12">
                      <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">No appointments found</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Service</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Doctor</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date & Time</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Duration</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredAppointments.map((appointment: any, index: number) => (
                            <tr key={index} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center flex-shrink-0">
                                    <Activity className="w-5 h-5 text-teal-600" />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-gray-900 text-sm">
                                      {appointment.treatmentName || appointment.serviceName || 'Consultation'}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      {appointment.doctorSlotId ? `Slot: ${appointment.doctorSlotId}` : ''}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                                    <User className="w-4 h-4 text-blue-600" />
                                  </div>
                                  <span className="text-sm font-medium text-gray-900">
                                    {appointment.doctorName || 'Dr. Not Assigned'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex flex-col gap-1">
                                  <span className="text-sm font-semibold text-gray-900">
                                    {appointment.registeredDate
                                      ? appointment.registeredDate
                                      : appointment.startDate
                                      ? new Date(appointment.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                      : 'N/A'}
                                  </span>
                                  <span className="text-xs text-gray-600">
                                    {appointment.registeredTime
                                      ? appointment.registeredTime
                                      : appointment.fromTime && appointment.toTime
                                      ? `${appointment.fromTime} - ${appointment.toTime}`
                                      : appointment.fromTime || 'Time not set'}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm text-gray-700">
                                  {(() => {
                                    if (appointment.duration) return `${appointment.duration} mins`;
                                    if (appointment.fromTime && appointment.toTime) {
                                      const [fh, fm] = appointment.fromTime.split(':').map(Number);
                                      const [th, tm] = appointment.toTime.split(':').map(Number);
                                      const diff = (th * 60 + tm) - (fh * 60 + fm);
                                      return diff > 0 ? `${diff} mins` : 'N/A';
                                    }
                                    return 'N/A';
                                  })()}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(appointment.status || appointment.appointmentStatus)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            ) : activeTab === 'packages-memberships' ? (
              /* Packages & Memberships Tab Content - Modern Combined Cards */
              <div className="space-y-4">
                {/* Packages Section */}
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-teal-600" />
                    Packages
                  </h3>
                  
                  {loadingPackages ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                    </div>
                  ) : packages.length === 0 ? (
                    <div className="space-y-4">
                      {/* Transferred Out Packages */}
                      {transferredOutPackages && transferredOutPackages.length > 0 ? (
                        transferredOutPackages.map((pkg: any, idx: number) => (
                          <div key={idx} className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Package className="w-5 h-5 text-amber-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-bold text-amber-900">
                                    {pkg.packageName || 'Package'}
                                  </h3>
                                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">
                                    Transferred Out
                                  </span>
                                </div>
                                <p className="text-xs text-amber-700 mb-3">
                                  This package was transferred to another patient.
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {pkg.transferredToName && (
                                    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2">
                                      <div className="text-[10px] text-gray-500 mb-0.5">Transferred To</div>
                                      <div className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-amber-600" />
                                        <span className="text-xs font-bold text-amber-900">
                                          {pkg.transferredToName}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {pkg.transferredSessions > 0 && (
                                    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2">
                                      <div className="text-[10px] text-gray-500 mb-0.5">Sessions Transferred</div>
                                      <span className="text-xs font-bold text-amber-900">
                                        {pkg.transferredSessions}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-600 font-medium">No packages assigned to this patient</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {packages.map((pkg: any, index: number) => {
                      const packageId = pkg.packageId || pkg._id;
                      const packageName = pkg.packageName || pkg.name || 'Package';
                      const assignedDate = pkg.assignedDate || pkg.createdAt;
                      
                      // Session calculations - use actual data from API
                      const totalSessions = pkg.totalSessions || 0;
                      const usedSessions = pkg.usedSessions || 0;
                      const remainingSessions = Math.max(0, totalSessions - usedSessions);
                      const progressPercent = totalSessions > 0 ? Math.min(100, Math.round((usedSessions / totalSessions) * 100)) : 0;
                      
                      // Price calculation
                      const price = pkg.price || pkg.totalPrice || 0;
                      const formattedPrice = typeof price === 'number' ? `د.إ${price.toFixed(2)}` : `د.إ${price || 0}`;

                      return (
                        <div key={pkg._id || packageId || index} className="bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300">
                          {/* Header Section */}
                          <div className="px-5 py-4 bg-gradient-to-r from-teal-50 to-cyan-50 border-b border-gray-200">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3 flex-1">
                                {/* Package Icon */}
                                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-teal-100 to-cyan-100 flex items-center justify-center flex-shrink-0 shadow-sm">
                                  <Package className="w-7 h-7 text-teal-600" />
                                </div>
                                
                                {/* Package Info */}
                                <div className="flex-1">
                                  <h3 className="text-lg font-bold text-gray-900 mb-1">{packageName}</h3>
                                  <div className="flex items-center gap-3 text-sm">
                                    <span className="font-semibold text-gray-900">{formattedPrice}</span>
                                    {assignedDate && (
                                      <div className="flex items-center gap-1.5 text-gray-600">
                                        <Calendar className="w-3.5 h-3.5" />
                                        <span>Purchased: {new Date(assignedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Sessions Progress Section */}
                          <div className="px-5 py-4">
                            <div className="mb-4">
                              <div className="flex items-center justify-between text-sm mb-2">
                                <span className="font-medium text-gray-700">Sessions Progress</span>
                                <span className="font-bold text-gray-900">{usedSessions} / {totalSessions} used</span>
                              </div>
                              {/* Progress Bar */}
                              <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-teal-500 to-cyan-500 rounded-full transition-all duration-500 ease-out"
                                  style={{ width: `${progressPercent}%` }}
                                ></div>
                              </div>
                            </div>

                            {/* Three Info Boxes */}
                            <div className="grid grid-cols-3 gap-3 mb-4">
                              {/* Total Sessions */}
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-blue-700">{totalSessions}</div>
                                <div className="text-xs text-blue-600 mt-1 font-medium">Total Sessions</div>
                              </div>
                              
                              {/* Used Sessions */}
                              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-700">{usedSessions}</div>
                                <div className="text-xs text-green-600 mt-1 font-medium">Used Sessions</div>
                              </div>
                              
                              {/* Remaining Sessions */}
                              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-orange-700">{remainingSessions}</div>
                                <div className="text-xs text-orange-600 mt-1 font-medium">Remaining</div>
                              </div>
                            </div>
                            
                            {/* Treatment Breakdown */}
                            {pkg.treatments && pkg.treatments.length > 0 && (
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <h5 className="text-xs font-bold text-gray-800 mb-2.5 flex items-center gap-1.5">
                                  <Activity className="w-3.5 h-3.5 text-teal-600" />
                                  Treatment Sessions
                                </h5>
                                <div className="space-y-2">
                                  {pkg.treatments.map((treatment: any, tIdx: number) => {
                                    const used = treatment.usedSessions || 0;
                                    const max = treatment.maxSessions || treatment.sessions || 0;
                                    const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
                                    const remaining = max - used;
                                    const isComplete = used >= max;
                                    
                                    return (
                                      <div key={tIdx} className="bg-gray-50 rounded-lg px-3 py-2.5">
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="text-xs font-medium text-gray-700 truncate max-w-[180px]">{treatment.treatmentName || treatment.name}</span>
                                          <div className="flex items-center gap-1.5">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                              isComplete ? 'bg-green-100 text-green-700' :
                                              used > 0 ? 'bg-blue-100 text-blue-700' :
                                              'bg-gray-100 text-gray-600'
                                            }`}>
                                              {used}/{max} used
                                            </span>
                                          </div>
                                        </div>
                                        {/* Progress Bar */}
                                        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                                          <div 
                                            className={`h-full rounded-full transition-all duration-500 ${
                                              isComplete ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                                              used > 0 ? 'bg-gradient-to-r from-blue-500 to-cyan-500' :
                                              'bg-gray-400'
                                            }`}
                                            style={{ width: `${percent}%` }}
                                          />
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-gray-600">
                                          <span>Remaining: {remaining} sessions</span>
                                          <span>{percent}% complete</span>
                                        </div>
                                        
                                        {/* Billing Records Table - per treatment */}
                                        {treatment.usageDetails && treatment.usageDetails.length > 0 && (
                                          <div className="mt-3 pt-3 border-t border-gray-200">
                                            <h6 className="text-xs font-bold text-gray-700 mb-2.5 flex items-center gap-1.5">
                                              <ClipboardList className="w-3.5 h-3.5 text-cyan-600" />
                                              Billing Records ({treatment.usageDetails.length})
                                            </h6>
                                            <div className="overflow-x-auto">
                                              <table className="w-full text-xs">
                                                <thead>
                                                  <tr className="border-b-2 border-gray-200 bg-gray-50">
                                                    <th className="text-left py-2 px-2.5 font-semibold text-gray-700 rounded-tl-lg">Invoice</th>
                                                    <th className="text-left py-2 px-2.5 font-semibold text-gray-700">Date</th>
                                                    <th className="text-center py-2 px-2.5 font-semibold text-gray-700">Sessions</th>
                                                    <th className="text-right py-2 px-2.5 font-semibold text-gray-700">Amount</th>
                                                    <th className="text-right py-2 px-2.5 font-semibold text-gray-700 rounded-tr-lg">Paid</th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {treatment.usageDetails.map((detail: any, dIdx: number) => (
                                                    <tr key={dIdx} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                                                      <td className="py-2.5 px-2.5">
                                                        <span className="font-bold text-gray-900">{detail.invoiceNumber}</span>
                                                      </td>
                                                      <td className="py-2.5 px-2.5">
                                                        <span className="text-gray-600">{new Date(detail.date).toLocaleDateString()}</span>
                                                      </td>
                                                      <td className="py-2.5 px-2.5 text-center">
                                                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-teal-100 text-teal-700 font-bold text-[10px] shadow-sm">
                                                          {detail.sessions} Session{detail.sessions !== 1 ? 's' : ''}
                                                        </span>
                                                      </td>
                                                      <td className="py-2.5 px-2.5 text-right">
                                                        {detail.amount !== undefined && detail.amount !== null ? (
                                                          <span className="font-semibold text-gray-800">د.إ{Number(detail.amount).toLocaleString()}</span>
                                                        ) : (
                                                          <span className="text-gray-400">-</span>
                                                        )}
                                                      </td>
                                                      <td className="py-2.5 px-2.5 text-right">
                                                        {detail.paid !== undefined && detail.paid !== null ? (
                                                          <span className="font-bold text-green-600">د.إ{Number(detail.paid).toLocaleString()}</span>
                                                        ) : (
                                                          <span className="text-gray-400">-</span>
                                                        )}
                                                      </td>
                                                    </tr>
                                                  ))}
                                                </tbody>
                                              </table>
                                            </div>
                                            {pkg.isTransferred && treatment.usageDetails.some((d: any) => d.isFromSourcePatient) && (
                                              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-center gap-1.5">
                                                  <CheckCircle className="w-3 h-3 text-green-600" />
                                                  <span className="text-[9px] font-medium text-green-800">
                                                    From transferred package (Source: {pkg.transferredFromName || 'Unknown Patient'})
                                                  </span>
                                                </div>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                            
                            {/* Transfer Information */}
                            {pkg.isTransferred && (
                              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3 mt-3">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                  <h5 className="text-xs font-bold text-green-800">Transferred Package</h5>
                                </div>
                                <div className="space-y-1.5 text-[10px]">
                                  {pkg.transferredPackageName && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-700">Package Name:</span>
                                      <span className="font-semibold text-green-900">{pkg.transferredPackageName}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between items-center">
                                    <span className="text-gray-700">Transferred From:</span>
                                    <span className="font-semibold text-green-900">{pkg.transferredFromName || 'Unknown Patient'}</span>
                                  </div>
                                  {pkg.totalAllowedSessions && (
                                    <div className="flex justify-between items-center pt-1.5 border-t border-green-200">
                                      <span className="text-gray-700">Total Allowed Sessions:</span>
                                      <span className="font-bold text-green-900">{pkg.totalAllowedSessions}</span>
                                    </div>
                                  )}
                                  {typeof pkg.remainingSessions === 'number' && (
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-700">Remaining Sessions:</span>
                                      <span className="font-bold text-green-900">{pkg.remainingSessions}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Footer with Expiry and Action Button */}
                          <div className="px-5 py-4 bg-gray-50 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                             
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

                {/* Memberships Section */}
                <div className="mt-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-purple-600" />
                    Memberships
                  </h3>
                              
                  {memberships.length === 0 ? (
                    <div className="space-y-4">
                      {/* Transferred Out Memberships */}
                      {transferredOutMemberships && transferredOutMemberships.length > 0 ? (
                        transferredOutMemberships.map((membership: any, idx: number) => (
                          <div key={idx} className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                                <Shield className="w-5 h-5 text-amber-600" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-base font-bold text-amber-900">
                                    {membership.membershipName || 'Membership'}
                                  </h3>
                                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">
                                    Transferred Out
                                  </span>
                                </div>
                                <p className="text-xs text-amber-700 mb-3">
                                  This membership was transferred to another patient.
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {membership.transferredToName && (
                                    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2">
                                      <div className="text-[10px] text-gray-500 mb-0.5">Transferred To</div>
                                      <div className="flex items-center gap-1.5">
                                        <User className="w-3.5 h-3.5 text-amber-600" />
                                        <span className="text-xs font-bold text-amber-900">
                                          {membership.transferredToName}
                                        </span>
                                      </div>
                                    </div>
                                  )}
                                  {membership.transferredFreeConsultations > 0 && (
                                    <div className="bg-white border border-amber-200 rounded-lg px-3 py-2">
                                      <div className="text-[10px] text-gray-500 mb-0.5">Consultations Transferred</div>
                                      <span className="text-xs font-bold text-amber-900">
                                        {membership.transferredFreeConsultations}
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
                          <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-600 font-medium">No memberships assigned to this patient</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {memberships.map((membership: any, index: number) => {
                        const membershipId = membership.membershipId || membership._id;
                        const membershipName = membership.membershipName || membership.name || 'Membership';
                        const assignedDate = membership.assignedDate || membership.startDate;
                        const endDate = membership.endDate;
                        const plan: any = memberships.find((m: any) => m._id === membershipId);
              
                        return (
                          <div key={membership._id || membershipId || index} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
                            {/* Card Header */}
                            <div className="flex items-start mb-4">
                              <div className="flex items-start gap-3 flex-1">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                                  <Shield className="w-5 h-5 text-purple-600" />
                                </div>
                                <div className="flex-1">
                                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{membershipName}</h3>
                                  <div className="flex items-center gap-3 text-sm">
                                    {assignedDate && (
                                      <span className="text-gray-500 text-xs">
                                        Start: {new Date(assignedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    )}
                                    {endDate && (
                                      <span className="text-gray-500 text-xs">
                                        End: {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      </span>
                                    )}
                                  </div>
                                  {(membership as any).usageData?.isTransferred && (membership as any).usageData?.transferredFromName && (
                                    <div className="flex items-center gap-1.5 mt-1.5">
                                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                      <span className="text-xs text-green-700">Transferred from: <span className="font-bold">{(membership as any).usageData.transferredFromName}</span></span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
              
                            {/* Membership Details */}
                            <div className="mb-4 space-y-3">
                              {/* Membership Info Card */}
                              <div className="bg-gradient-to-br from-purple-50 via-white to-blue-50 border-2 border-purple-300 rounded-xl p-4">
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <div className="text-[10px] text-gray-600 mb-0.5">Status</div>
                                    <div className="flex items-center gap-1.5">
                                      <div className={`w-2 h-2 rounded-full ${
                                        (membership as any).usageData?.isTransferred ? 'bg-blue-500' : 'bg-green-500'
                                      }`}></div>
                                      <span className="text-xs font-bold text-gray-800">
                                        {(membership as any).usageData?.isTransferred ? 'Transferred' : 'Active'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <div className="text-[10px] text-gray-600 mb-0.5">Priority Booking</div>
                                    <div className="flex items-center gap-1">
                                      <Shield className="w-3.5 h-3.5 text-purple-600" />
                                      <span className="text-xs font-bold text-green-700">Active</span>
                                    </div>
                                  </div>

                                  {(membership as any).usageData?.isTransferred && (membership as any).usageData?.transferredFromName && (
                                    <div className="col-span-2">
                                      <div className="text-[10px] text-gray-600 mb-0.5">Transferred From</div>
                                      <div className="flex items-center gap-1.5">
                                        <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                        <span className="text-xs font-bold text-green-700">{(membership as any).usageData.transferredFromName}</span>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div>
                                    <div className="text-[10px] text-gray-600 mb-0.5">Start Date</div>
                                    <div className="text-xs font-semibold text-gray-800">{new Date(membership.startDate).toLocaleDateString()}</div>
                                  </div>
                                  
                                  <div>
                                    <div className="text-[10px] text-gray-600 mb-0.5">End Date</div>
                                    <div className="text-xs font-semibold text-gray-800">{new Date(membership.endDate).toLocaleDateString()}</div>
                                  </div>
                                  
                                  <div>
                                    <div className="text-[10px] text-gray-600 mb-0.5">Price</div>
                                    <div className="text-xs font-bold text-purple-700">د.إ{plan.price?.toLocaleString() || 0}</div>
                                  </div>
                                  
                                  <div>
                                    <div className="text-[10px] text-gray-600 mb-0.5">Duration</div>
                                    <div className="text-xs font-semibold text-gray-800">{plan.durationMonths} months</div>
                                  </div>
                                </div>
                                
                                {(membership as any).usageData?.isTransferred && (
                                  <div className="mt-3 pt-3 border-t-2 border-purple-300 bg-gradient-to-r from-purple-100 to-blue-50 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                      <CheckCircle className="w-4 h-4 text-green-600" />
                                      <h5 className="text-xs font-bold text-purple-900">Transferred Membership</h5>
                                    </div>
                                    <div className="space-y-2">
                                      <div className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-purple-200">
                                        <span className="text-[10px] text-gray-700 font-medium">Transferred From:</span>
                                        <span className="text-sm font-bold text-purple-700">{(membership as any).usageData.transferredFromName || 'Unknown Patient'}</span>
                                      </div>
                                      {(membership as any).usageData.transferredFreeConsultations !== null && (
                                        <div className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-purple-200">
                                          <span className="text-[10px] text-gray-700 font-medium">Transferred Consultations:</span>
                                          <span className="text-sm font-bold text-green-700">{(membership as any).usageData.transferredFreeConsultations}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-purple-200">
                                        <span className="text-[10px] text-gray-700 font-medium">Total Available Consultations:</span>
                                        <span className="text-sm font-bold text-blue-700">{(membership as any).usageData.totalFreeConsultations || 0}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                              
                              {/* Membership Benefits Section */}
                              {plan?.benefits && (
                                <div className="bg-white rounded-lg border border-gray-200 p-3">
                                  <h5 className="text-xs font-bold text-gray-800 mb-2.5 flex items-center gap-1.5">
                                    <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                                    Membership Benefits
                                  </h5>
                                  <div className="space-y-2">
                                    {/* Free Consultations with Usage */}
                                    {plan.benefits.freeConsultations > 0 && (
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        <div className="flex items-center justify-between mb-2">
                                          <div className="flex items-center gap-1.5">
                                            <User className="w-4 h-4 text-blue-600" />
                                            <span className="text-sm font-bold text-blue-900">Free Consultations Used</span>
                                          </div>
                                          <div className="text-right">
                                            <span className="text-sm font-black text-blue-700">
                                              {(membership as any).usageData?.usedFreeConsultations || 0}/
                                              {(membership as any).usageData?.totalFreeConsultations || plan.benefits.freeConsultations}
                                            </span>
                                          </div>
                                        </div>
                                        {(membership as any).usageData && (membership as any).usageData.totalFreeConsultations > 0 && (
                                          <>
                                            <div className="w-full h-3 bg-blue-200 rounded-full overflow-hidden mb-2">
                                              <div 
                                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full transition-all duration-500"
                                                style={{ width: `${Math.min(100, (((membership as any).usageData.usedFreeConsultations || 0) / (membership as any).usageData.totalFreeConsultations) * 100)}%` }}
                                              />
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-blue-700">
                                              <span>Remaining: <strong>{(membership as any).usageData.remainingFreeConsultations || 0}</strong></span>
                                              {(membership as any).usageData.isTransferred && (
                                                <span className="text-xs text-blue-600">
                                                  Transferred: <strong>{(membership as any).usageData.transferredFreeConsultations || 0}</strong>
                                                </span>
                                              )}
                                            </div>
                                          </>
                                        )}
                                      </div>
                                    )}
                                    
                                    {/* Discount Percentage */}
                                    {plan.benefits.discountPercentage > 0 && (
                                      <div className="bg-green-50 border border-green-200 rounded-lg p-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <TrendingUp className="w-3.5 h-3.5 text-green-600" />
                                          <span className="text-xs font-bold text-green-900">
                                            {plan.benefits.discountPercentage * 100}% Discount
                                          </span>
                                        </div>
                                        <div className="text-[9px] text-green-700 mt-1 ml-5">
                                          On all treatments & services
                                        </div>
                                      </div>
                                    )}
                                    
                                    {/* Priority Booking */}
                                    {plan.benefits.priorityBooking && (
                                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <Activity className="w-3.5 h-3.5 text-amber-600" />
                                          <span className="text-xs font-bold text-amber-900">Priority Booking</span>
                                        </div>
                                        <div className="text-[9px] text-amber-700 mt-1 ml-5">
                                          Get priority appointment scheduling
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                              
                              {/* Transfer Information */}
                              {(membership as any).usageData?.isTransferred && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4">
                                  <div className="flex items-center gap-2 mb-3">
                                    <CheckCircle className="w-4 h-4 text-green-600" />
                                    <h5 className="text-sm font-bold text-green-800">Transferred Membership Details</h5>
                                  </div>
                                  <div className="space-y-2.5">
                                    <div className="flex justify-between items-center bg-white rounded-lg px-3 py-2.5 border border-green-200 shadow-sm">
                                      <div className="flex items-center gap-2">
                                        <User className="w-3.5 h-3.5 text-green-600" />
                                        <span className="text-xs font-semibold text-gray-700">Transferred From:</span>
                                      </div>
                                      <span className="text-base font-bold text-green-900">{(membership as any).usageData.transferredFromName || 'Unknown Patient'}</span>
                                    </div>
                                    {(membership as any).usageData.transferredFreeConsultations !== null && (
                                      <div className="flex justify-between items-center bg-white rounded-lg px-3 py-2.5 border border-green-200 shadow-sm">
                                        <div className="flex items-center gap-2">
                                          <Activity className="w-3.5 h-3.5 text-green-600" />
                                          <span className="text-xs font-semibold text-gray-700">Transferred Consultations:</span>
                                        </div>
                                        <span className="text-base font-bold text-green-700">{(membership as any).usageData.transferredFreeConsultations}</span>
                                      </div>
                                    )}
                                    <div className="flex justify-between items-center bg-white rounded-lg px-3 py-2.5 border border-green-200 shadow-sm">
                                      <div className="flex items-center gap-2">
                                        <Shield className="w-3.5 h-3.5 text-green-600" />
                                        <span className="text-xs font-semibold text-gray-700">Total Available Consultations:</span>
                                      </div>
                                      <span className="text-base font-bold text-blue-700">{(membership as any).usageData.totalFreeConsultations || 0}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                              
                              {/* Usage History */}
                              {(membership as any).usageData?.freeConsultationDetails && (membership as any).usageData.freeConsultationDetails.length > 0 && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                  <h5 className="text-xs font-bold text-gray-800 mb-2.5 flex items-center gap-1.5">
                                    <ClipboardList className="w-3.5 h-3.5 text-gray-600" />
                                    Usage History ({(membership as any).usageData.freeConsultationDetails.length})
                                  </h5>
                                  <div className="max-h-40 overflow-y-auto space-y-1.5">
                                    {((membership as any).usageData.freeConsultationDetails || []).map((detail: any, idx: number) => (
                                      <div key={idx} className="text-[9px] bg-white rounded border border-gray-200 p-2">
                                        <div className="flex justify-between items-center">
                                          <span className="font-medium text-gray-800">{detail.service}: {detail.treatment}</span>
                                          <span className="text-gray-600">{new Date(detail.date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-1">
                                          <span className="text-gray-600">Invoice: {detail.invoiceNumber}</span>
                                          <span className="font-semibold text-blue-700">{detail.sessions} session(s)</span>
                                        </div>
                                        {detail.isFromSourcePatient && (
                                          <div className="mt-1 text-[8px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                                            From transfer: {(membership as any).usageData.transferredFromName || 'Unknown'}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
              
                            {/* Footer with Action Button */}
                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                             
                              
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Transferred In Packages Section */}
                {transferredInPackages && transferredInPackages.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-green-600" />
                      Transferred In Packages
                    </h3>
                    <div className="space-y-4">
                      {transferredInPackages.map((pkg: any, idx: number) => (
                        <div key={idx} className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-bold text-green-900">
                                  {pkg.packageName || 'Package'}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-[10px] font-bold">
                                  Transferred In
                                </span>
                              </div>
                              <p className="text-xs text-green-700 mb-3">
                                This package was transferred from another patient.
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {pkg.transferredFromName && (
                                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Transferred From</div>
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3.5 h-3.5 text-green-600" />
                                      <span className="text-xs font-bold text-green-900">
                                        {pkg.transferredFromName}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {pkg.transferredSessions > 0 && (
                                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Transferred Sessions</div>
                                    <span className="text-xs font-bold text-green-900">
                                      {pkg.transferredSessions}
                                    </span>
                                  </div>
                                )}
                                {pkg.totalAllowedSessions && (
                                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Total Allowed Sessions</div>
                                    <span className="text-xs font-bold text-green-900">
                                      {pkg.totalAllowedSessions}
                                    </span>
                                  </div>
                                )}
                                {typeof pkg.remainingSessions === 'number' && (
                                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Remaining Sessions</div>
                                    <span className="text-xs font-bold text-green-900">
                                      {pkg.remainingSessions}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transferred Out Packages Section */}
                {transferredOutPackages && transferredOutPackages.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-amber-600" />
                      Transferred Out Packages
                    </h3>
                    <div className="space-y-4">
                      {transferredOutPackages.map((pkg: any, idx: number) => (
                        <div key={idx} className="bg-gradient-to-r from-amber-50 to-orange-50 border-2 border-amber-300 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-bold text-amber-900">
                                  {pkg.packageName || 'Package'}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 text-[10px] font-bold">
                                  Transferred Out
                                </span>
                              </div>
                              <p className="text-xs text-amber-700 mb-3">
                                This package was transferred to another patient.
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {pkg.transferredToName && (
                                  <div className="bg-white border border-amber-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Transferred To</div>
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3.5 h-3.5 text-amber-600" />
                                      <span className="text-xs font-bold text-amber-900">
                                        {pkg.transferredToName}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {pkg.transferredSessions > 0 && (
                                  <div className="bg-white border border-amber-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Sessions Transferred</div>
                                    <span className="text-xs font-bold text-amber-900">
                                      {pkg.transferredSessions}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transferred In Memberships Section */}
                {transferredInMemberships && transferredInMemberships.length > 0 && (
                  <div className="mt-6">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-green-600" />
                      Transferred In Memberships
                    </h3>
                    <div className="space-y-4">
                      {transferredInMemberships.map((membership: any, idx: number) => (
                        <div key={idx} className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0">
                              <Shield className="w-5 h-5 text-green-600" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-bold text-green-900">
                                  {membership.membershipName || 'Membership'}
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-green-200 text-green-800 text-[10px] font-bold">
                                  Transferred In
                                </span>
                              </div>
                              <p className="text-xs text-green-700 mb-3">
                                This membership was transferred from another patient.
                              </p>
                              <div className="grid grid-cols-2 gap-2">
                                {membership.transferredFromName && (
                                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Transferred From</div>
                                    <div className="flex items-center gap-1.5">
                                      <User className="w-3.5 h-3.5 text-green-600" />
                                      <span className="text-xs font-bold text-green-900">
                                        {membership.transferredFromName}
                                      </span>
                                    </div>
                                  </div>
                                )}
                                {membership.transferredFreeConsultations !== null && (
                                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Transferred Consultations</div>
                                    <span className="text-xs font-bold text-green-900">
                                      {membership.transferredFreeConsultations}
                                    </span>
                                  </div>
                                )}
                                {membership.totalFreeConsultations && (
                                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Total Available Consultations</div>
                                    <span className="text-xs font-bold text-green-900">
                                      {membership.totalFreeConsultations}
                                    </span>
                                  </div>
                                )}
                                {membership.remainingFreeConsultations !== null && (
                                  <div className="bg-white border border-green-200 rounded-lg px-3 py-2">
                                    <div className="text-[10px] text-gray-500 mb-0.5">Remaining Consultations</div>
                                    <span className="text-xs font-bold text-green-900">
                                      {membership.remainingFreeConsultations}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : activeTab === 'billing' ? (
              /* Billing Tab Content - Modern Two-Column Dashboard */
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {loadingBilling ? (
                  <div className="col-span-1 lg:col-span-3 flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                  </div>
                ) : !billingHistory || billingHistory.length === 0 ? (
                  <div className="col-span-1 lg:col-span-3">
                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                      {/* Top gradient banner */}
                      <div className="h-2 bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-400" />
                      <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                        {/* Icon circle */}
                        <div className="relative mb-6">
                          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 border-2 border-teal-200 flex items-center justify-center shadow-inner">
                            <DollarSign className="w-10 h-10 text-teal-400" />
                          </div>
                          <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center">
                            <FileText className="w-3.5 h-3.5 text-orange-500" />
                          </div>
                        </div>
                        {/* Text */}
                        <h3 className="text-xl font-bold text-gray-800 mb-2">No Billing Records Yet</h3>
                        <p className="text-gray-500 text-sm max-w-xs mb-8">
                          This patient doesn't have any billing history. Invoices will appear here once a session is billed.
                        </p>
                        {/* Info pills */}
                        <div className="flex items-center gap-3 flex-wrap justify-center">
                          <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full text-xs font-semibold text-teal-700">
                            <CheckCircle className="w-3.5 h-3.5" />
                            Invoices
                          </div>
                          <div className="flex items-center gap-2 px-4 py-2 bg-purple-50 border border-purple-200 rounded-full text-xs font-semibold text-purple-700">
                            <Package className="w-3.5 h-3.5" />
                            Payments
                          </div>
                          <div className="flex items-center gap-2 px-4 py-2 bg-orange-50 border border-orange-200 rounded-full text-xs font-semibold text-orange-700">
                            <Clock className="w-3.5 h-3.5" />
                            Pending
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Left Column - Invoices Table (2 columns width) */}
                    <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                      <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <FileText className="w-5 h-5 text-teal-600" />
                          Invoices
                        </h3>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Treatment</th>
                              <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                              <th className="px-5 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-100">
                            {billingHistory.map((billing: any, index: number) => {
                              // Determine invoice status
                              let statusLabel = 'Pending';
                              let statusColor = 'bg-red-100 text-red-700';
                              
                              if (billing.paid >= billing.amount && billing.amount > 0) {
                                statusLabel = 'Paid';
                                statusColor = 'bg-green-100 text-green-700';
                              } else if (billing.paid > 0 && billing.pending > 0) {
                                statusLabel = 'Partial';
                                statusColor = 'bg-yellow-100 text-yellow-700';
                              }

                              return (
                                <tr key={billing._id || index} className="hover:bg-gray-50 transition-colors">
                                  <td className="px-5 py-4 whitespace-nowrap">
                                    <div className="text-sm font-semibold text-gray-900">{billing.invoiceNumber || `INV-${String(index + 1).padStart(4, '0')}`}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">{billing.service || 'Treatment'}</div>
                                  </td>
                                  <td className="px-5 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-700">
                                      {billing.invoicedDate ? new Date(billing.invoicedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A'}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-700 max-w-xs truncate" title={billing.treatment}>
                                      {billing.treatment || '-'}
                                    </div>
                                  </td>
                                  <td className="px-5 py-4 whitespace-nowrap text-right">
                                    <div className="text-sm font-bold text-gray-900">${billing.amount || 0}</div>
                                    <div className="text-xs text-gray-500 mt-0.5">Qty: {billing.quantity || 0}</div>
                                  </td>
                                  <td className="px-5 py-4 whitespace-nowrap text-center">
                                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusColor}`}>
                                      {statusLabel}
                                    </span>
                                  </td>
                                  <td className="px-5 py-4 whitespace-nowrap text-center">
                                    <button 
                                      className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors" 
                                      title="Download Invoice"
                                      onClick={() => alert('Download invoice: ' + billing.invoiceNumber)}
                                    >
                                      <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                      </svg>
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Right Column - Payment History & Summary */}
                    <div className="lg:col-span-1">
                      {/* Payment History Card */}
                      <div className="bg-white rounded-xl border border-gray-200 shadow-lg p-5">
                        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <CreditCard className="w-5 h-5 text-green-600" />
                          Payment History
                        </h3>
                        
                        <div className="space-y-0">
                          {(() => {
                            const allPayments = billingHistory.flatMap((billing: any) => 
                              (billing.paymentHistory || []).map((payment: any, idx: number) => ({
                                ...payment,
                                invoiceNumber: billing.invoiceNumber,
                                billingId: billing._id,
                                originalIndex: idx
                              }))
                            );

                            if (allPayments.length === 0) {
                              return (
                                <div className="flex flex-col items-center justify-center py-8">
                                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                    <DollarSign className="w-8 h-8 text-gray-400" />
                                  </div>
                                  <p className="text-sm text-gray-500 font-medium">No payment history</p>
                                  <p className="text-xs text-gray-400 mt-1">Payments will appear here</p>
                                </div>
                              );
                            }

                            return allPayments.map((payment: any, index: number) => (
                              <div key={`${payment.billingId}-${payment.originalIndex}-${index}`}>
                                <div className="flex items-start gap-3 py-3">
                                  {/* Circular Green Icon */}
                                  <div className="w-10 h-10 rounded-full bg-green-50 border border-green-200 flex items-center justify-center flex-shrink-0">
                                    <DollarSign className="w-5 h-5 text-green-600" />
                                  </div>
                                  
                                  {/* Payment Details */}
                                  <div className="flex-1 min-w-0">
                                    <div className="text-base font-bold text-gray-900">
                                      ${payment.amount || payment.paid || 0}
                                    </div>
                                    <div className="text-sm text-gray-600 mt-0.5">
                                      {payment.paymentMethod ? (
                                        <>
                                          {payment.paymentMethod === 'Card' ? 'Card ending 4242' : 
                                           payment.paymentMethod === 'Wallet' ? 'Wallet Balance' :
                                           payment.paymentMethod}
                                        </>
                                      ) : 'Payment'}
                                    </div>
                                    {payment.invoiceNumber && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        {payment.invoiceNumber}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Right-aligned Date */}
                                  <div className="text-right flex-shrink-0">
                                    <div className="text-sm text-gray-500">
                                      {payment.updatedAt 
                                        ? new Date(payment.updatedAt).toLocaleDateString('en-US', { 
                                            month: 'short', 
                                            day: 'numeric',
                                            year: 'numeric'
                                          }) 
                                        : 'N/A'}
                                    </div>
                                    {payment.status && (
                                      <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs font-medium ${
                                        payment.status === 'Active' ? 'bg-green-100 text-green-700' :
                                        payment.status === 'Refunded' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {payment.status}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                {/* Thin Divider */}
                                {index < allPayments.length - 1 && (
                                  <div className="h-px bg-gray-100 ml-13"></div>
                                )}
                              </div>
                            ));
                          })()}
                        </div>

                        {/* Divider before Summary */}
                        {billingHistory.length > 0 && (
                          <div className="h-px bg-gray-200 my-4"></div>
                        )}

                        {/* Summary Section */}
                        {billingHistory.length > 0 && (
                          <div className="pt-4 space-y-3">
                            {(() => {
                              const totalAmount = billingHistory.reduce((sum: number, b: any) => sum + (b.amount || 0), 0);
                              const totalPaid = billingHistory.reduce((sum: number, b: any) => sum + (b.paid || 0), 0);
                              const totalPending = billingHistory.reduce((sum: number, b: any) => sum + (b.pending || 0), 0);

                              return (
                                <>
                                  {/* Total Paid */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-600">Total Paid</span>
                                    <span className="text-lg font-bold text-gray-900">
                                      ${totalPaid.toFixed(2)}
                                    </span>
                                  </div>
                                  
                                  {/* Outstanding */}
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-gray-600">Outstanding</span>
                                    <span className="text-lg font-bold text-red-600">
                                      ${totalPending.toFixed(2)}
                                    </span>
                                  </div>
                                  
                                  {/* Total Amount */}
                                  <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                    <span className="text-sm font-semibold text-gray-700">Total Amount</span>
                                    <span className="text-xl font-bold text-gray-900">
                                      ${totalAmount.toFixed(2)}
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : activeTab === 'insurance' ? (
              /* Insurance Tab Content */
              <div className="space-y-4">

                {/* Insurance Details Card */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  {/* Card Header */}
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-teal-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">Insurance Details</h3>
                    {patientData?.insurance === 'Yes' ? (
                      <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Not Enrolled</span>
                    )}
                  </div>

                  {patientData?.insurance === 'Yes' ? (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Insurance Type</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Advance Given</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Co-Pay %</th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Need to Pay</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          <tr className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800">
                                <FileText className="w-3.5 h-3.5" />
                                {patientData?.insuranceType || '-'}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className="text-base font-bold text-green-700">
                                {patientData?.advanceGivenAmount != null ? `د.إ${Number(patientData.advanceGivenAmount).toLocaleString()}` : '-'}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-purple-100 text-purple-800">
                                <TrendingUp className="w-3.5 h-3.5" />
                                {patientData?.coPayPercent != null ? `${patientData.coPayPercent}%` : '-'}
                              </span>
                            </td>
                            <td className="px-6 py-5 whitespace-nowrap">
                              <span className="text-base font-bold text-orange-700">
                                {patientData?.needToPay != null ? `د.إ${Number(patientData.needToPay).toLocaleString()}` : '-'}
                              </span>
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                        <Shield className="w-8 h-8 text-gray-300" />
                      </div>
                      <p className="text-gray-600 font-medium">No insurance enrolled</p>
                      <p className="text-gray-400 text-sm mt-1">This patient is not enrolled in any insurance plan.</p>
                    </div>
                  )}
                </div>

              </div>
            ) : activeTab === 'media' ? (
              /* Media & Documents - Before/After Images */
              <div className="space-y-4">
                {loadingMedia ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                  </div>
                ) : mediaDocuments.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-teal-400 to-cyan-400" />
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-teal-50 to-cyan-100 border-2 border-teal-200 flex items-center justify-center mb-4">
                        <FileImage className="w-9 h-9 text-teal-400" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2">No Before/After Images</h3>
                      <p className="text-gray-500 text-sm max-w-xs">
                        Before and after images will appear here once added via the appointment complaint form.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-5">
                    <div className="flex items-center gap-2 mb-2">
                      <FileImage className="w-5 h-5 text-teal-600" />
                      <h3 className="text-base font-bold text-gray-900">Before & After Images</h3>
                      <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-teal-100 text-teal-700">
                        {mediaDocuments.length} Record{mediaDocuments.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {mediaDocuments.map((item: any, index: number) => (
                      <div key={item._id || index} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        {/* Card Header */}
                        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                            <Activity className="w-4 h-4 text-teal-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {item.complaints || 'Complaint Record'}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                              {item.doctorName && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {item.doctorName}
                                </span>
                              )}
                              {item.appointmentDate && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" />
                                  {new Date(item.appointmentDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Before / After Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
                          {/* Before */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">BEFORE</span>
                            </div>
                            {item.beforeImage ? (
                              <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video group">
                                <img
                                  src={item.beforeImage}
                                  alt="Before"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e: any) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                />
                                <div className="hidden absolute inset-0 items-center justify-center bg-gray-100 text-gray-400 text-xs">
                                  Image not available
                                </div>
                                <a
                                  href={item.beforeImage}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2.5 py-1 rounded-full hover:bg-opacity-80 transition-all"
                                >
                                  View Full
                                </a>
                              </div>
                            ) : (
                              <div className="aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                                <div className="text-center">
                                  <FileImage className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                                  <span className="text-xs text-gray-400">No before image</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* After */}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">AFTER</span>
                            </div>
                            {item.afterImage ? (
                              <div className="relative rounded-xl overflow-hidden bg-gray-100 aspect-video group">
                                <img
                                  src={item.afterImage}
                                  alt="After"
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                  onError={(e: any) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                                />
                                <div className="hidden absolute inset-0 items-center justify-center bg-gray-100 text-gray-400 text-xs">
                                  Image not available
                                </div>
                                <a
                                  href={item.afterImage}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2.5 py-1 rounded-full hover:bg-opacity-80 transition-all"
                                >
                                  View Full
                                </a>
                              </div>
                            ) : (
                              <div className="aspect-video rounded-xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center">
                                <div className="text-center">
                                  <FileImage className="w-8 h-8 text-gray-300 mx-auto mb-1" />
                                  <span className="text-xs text-gray-400">No after image</span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : activeTab === 'treatments' ? (
              /* Treatments Tab — derived from appointments + billing */
              (() => {
                // Build treatment list from appointments, cross-ref with billing for status
                const paidInvoiceAptIds = new Set(
                  (billingHistory || [])
                    .filter((b: any) => b.paid >= b.amount && b.amount > 0)
                    .map((b: any) => b.appointmentId?._id || b.appointmentId)
                    .filter(Boolean)
                );

                const treatmentItems = (appointments || []).map((apt: any) => {
                  const isPaid = paidInvoiceAptIds.has(apt._id);
                  const treatmentStatus = isPaid ? 'completed' : 'ongoing';
                  const treatmentName =
                    (Array.isArray(apt.serviceNames) && apt.serviceNames.length > 0
                      ? apt.serviceNames.join(', ')
                      : null) ||
                    apt.serviceName ||
                    apt.treatmentName ||
                    apt.treatment ||
                    'Consultation';
                  const doctorName =
                    apt.doctorName ||
                    apt.doctorId?.name ||
                    apt.doctor ||
                    'Doctor';
                  const date =
                    apt.registeredDate ||
                    (apt.startDate ? new Date(apt.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null) ||
                    (apt.createdAt ? new Date(apt.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A');

                  return { apt, treatmentName, doctorName, date, treatmentStatus };
                });

                const filtered = treatmentItems.filter((t: any) =>
                  treatmentFilter === 'all' ? true : t.treatmentStatus === treatmentFilter
                );

                return (
                  <div className="space-y-4">
                    {/* Filter Chips */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {(['all', 'ongoing', 'completed'] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setTreatmentFilter(f)}
                          className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors capitalize ${
                            treatmentFilter === f
                              ? 'bg-teal-600 text-white'
                              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Loading state */}
                    {loadingAppointments ? (
                      <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16">
                        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                          <Package className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-500">No treatments found</p>
                        <p className="text-xs text-gray-400 mt-1">
                          {treatmentFilter === 'all' ? 'No appointments booked yet' : `No ${treatmentFilter} treatments`}
                        </p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {filtered.map((item: any, index: number) => {
                          const isCompleted = item.treatmentStatus === 'completed';
                          return (
                            <div
                              key={item.apt._id || index}
                              className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow"
                            >
                              {/* Header */}
                              <div className="flex items-start justify-between mb-3">
                                <div>
                                  <h4 className="text-base font-bold text-gray-900">{item.treatmentName}</h4>
                                  <p className="text-sm text-gray-500 mt-0.5">{item.doctorName}</p>
                                </div>
                                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                                  isCompleted
                                    ? 'bg-green-50 text-green-700 border border-green-200'
                                    : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {isCompleted ? (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  ) : (
                                    <Clock className="w-3.5 h-3.5" />
                                  )}
                                  {isCompleted ? 'Completed' : 'Ongoing'}
                                </span>
                              </div>

                              {/* Date */}
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                                <span>Started: {item.date}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()
            ) : activeTab === 'communication' ? (
              /* Communication Log - Consent Form Status */
              <div className="space-y-4">
                {loadingConsentStatus ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                  </div>
                ) : consentStatuses.length === 0 ? (
                  <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-blue-400 to-indigo-400" />
                    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 flex items-center justify-center mb-4">
                        <FileText className="w-9 h-9 text-blue-400" />
                      </div>
                      <h3 className="text-lg font-bold text-gray-800 mb-2">No Consent Forms Sent</h3>
                      <p className="text-gray-500 text-sm max-w-xs">
                        Consent form communication will appear here once sent to the patient.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="w-5 h-5 text-blue-600" />
                      <h3 className="text-base font-bold text-gray-900">Consent Form Status</h3>
                      <span className="ml-auto px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        {consentStatuses.length} Record{consentStatuses.length !== 1 ? 's' : ''}
                      </span>
                    </div>

                    {consentStatuses.map((consent: any, index: number) => {
                      // Generate the consent form URL using patient data from props
                      const patient = patientData as any;
                      const patientName = patient?.fullName || `${patient?.firstName || ''} ${patient?.lastName || ''}`.trim();
                      const patientInfo = {
                        firstName: patient?.firstName || patientName.split(" ")[0] || "",
                        lastName: patient?.lastName || patientName.split(" ").slice(1).join(" ") || "",
                        mobileNumber: patient?.mobileNumber || "",
                        email: patient?.email || "",
                      };
                      const encodedPatientData = encodeURIComponent(JSON.stringify(patientInfo));
                      const consentUrl = `https://zeva360.com/consent-form/${consent.consentFormId}?patient=${encodedPatientData}`;
                      
                      return (
                        <div
                          key={consent._id || index}
                          className={`flex items-center justify-between p-4 rounded-lg border ${
                            consent.status === 'signed'
                              ? 'border-green-200 bg-green-50'
                              : 'border-blue-200 bg-blue-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-gray-800 truncate">
                                {consent.consentFormName}
                              </p>
                              {consent.status === 'signed' ? (
                                <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                              ) : (
                                <Send className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-xs text-gray-400">
                                Date: {consent.date}
                              </span>
                            </div>
                            <div className="flex items-center gap-1 mt-1">
                              <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                consent.status === 'signed'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {consent.status === 'signed' ? 'SIGNED' : 'SENT'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            {/* Open Form Button */}
                            <a
                              href={consentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-all border border-blue-200"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Open Form
                            </a>
                            {consent.status === 'signed' && consent.hasSignature && (
                              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : activeTab === 'advance' ? (
              /* Advance & Pending Tab Content */
              <div className="space-y-5">
                {/* Balance Cards Row */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-teal-400 to-cyan-400" />
                  <div className="p-5">
                    <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-teal-600" />
                      Balance Summary
                    </h3>
                    {balanceLoading ? (
                      <div className="flex items-center gap-2 py-4">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600" />
                        <span className="text-sm text-gray-500">Loading balances...</span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-3">
                        {/* Pending */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                          <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700">Pending: {formatAED(balance.pendingBalance)}</span>
                        </div>
                        {/* Advance */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-xs font-bold text-emerald-700">Advance: {formatAED(balance.advanceBalance)}</span>
                        </div>
                        {/* Past Advance 50% */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                          <DollarSign className="w-3.5 h-3.5 text-amber-600" />
                          <span className="text-xs font-bold text-amber-700">Past Advance 50%: {formatAED(balance.pastAdvance50PercentBalance)}</span>
                        </div>
                        {/* Past Advance 54% */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200">
                          <DollarSign className="w-3.5 h-3.5 text-blue-600" />
                          <span className="text-xs font-bold text-blue-700">Past Advance 54%: {formatAED(balance.pastAdvance54PercentBalance)}</span>
                        </div>
                        {/* Past Advance 159 Flat */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200">
                          <DollarSign className="w-3.5 h-3.5 text-purple-600" />
                          <span className="text-xs font-bold text-purple-700">Past Advance 159 Flat: {formatAED(balance.pastAdvance159FlatBalance)}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
                  <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Plus className="w-5 h-5 text-teal-600" />
                    Add Payment
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setShowAddAdvancePaymentModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-green-700 hover:shadow-lg active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      Add Advance Balance
                    </button>
                    <button
                      onClick={() => setShowAddPastAdvancePayment50PercentModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-amber-700 hover:shadow-lg active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      Add 50% Past Advance Balance
                    </button>
                    <button
                      onClick={() => setShowAddPastAdvancePayment54PercentModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-blue-700 hover:shadow-lg active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      Add 54% Past Advance Balance
                    </button>
                    <button
                      onClick={() => setShowAddPastAdvancePayment159FlatModal(true)}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 hover:bg-purple-700 hover:shadow-lg active:scale-95"
                    >
                      <Plus className="w-4 h-4" />
                      Add 159 Flat Past Advance Balance
                    </button>
                  </div>
                </div>

                {/* Modals */}
                <AddPatientAdvancePaymentModal
                  isOpen={showAddAdvancePaymentModal}
                  onClose={() => setShowAddAdvancePaymentModal(false)}
                  patientId={patientData._id}
                  patientName={`${patientData.firstName} ${patientData.lastName}`}
                  onSuccess={async () => {
                    const updated = await fetchPatientBalance(patientData._id);
                    if (updated) setBalance(updated as typeof balance);
                  }}
                />
                <AddPatientPastAdvancePaymentModal
                  isOpen={showAddPastAdvancePayment50PercentModal}
                  onClose={() => setShowAddPastAdvancePayment50PercentModal(false)}
                  patientId={patientData._id}
                  patientName={`${patientData.firstName} ${patientData.lastName}`}
                  onSuccess={async () => {
                    const updated = await fetchPatientBalance(patientData._id);
                    if (updated) setBalance(updated as typeof balance);
                  }}
                  pastAdvanceType="50% Offer"
                  primaryColor="amber"
                />
                <AddPatientPastAdvancePaymentModal
                  isOpen={showAddPastAdvancePayment54PercentModal}
                  onClose={() => setShowAddPastAdvancePayment54PercentModal(false)}
                  patientId={patientData._id}
                  patientName={`${patientData.firstName} ${patientData.lastName}`}
                  onSuccess={async () => {
                    const updated = await fetchPatientBalance(patientData._id);
                    if (updated) setBalance(updated as typeof balance);
                  }}
                  pastAdvanceType="54% Offer"
                  primaryColor="blue"
                />
                <AddPatientPastAdvancePaymentModal
                  isOpen={showAddPastAdvancePayment159FlatModal}
                  onClose={() => setShowAddPastAdvancePayment159FlatModal(false)}
                  patientId={patientData._id}
                  patientName={`${patientData.firstName} ${patientData.lastName}`}
                  onSuccess={async () => {
                    const updated = await fetchPatientBalance(patientData._id);
                    if (updated) setBalance(updated as typeof balance);
                  }}
                  pastAdvanceType="159 Flat"
                  primaryColor="purple"
                />
              </div>
            ) : (
              /* Default Overview Tab - Compact Professional Dashboard */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                              
                {/* Left Column - Activity Timeline (Compact) - Reduced Width */}
                <div className="lg:col-span-1">
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 h-full">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-teal-600 flex-shrink-0" />
                      <span className="truncate">Activity Timeline</span>
                    </h3>
                                    
                    <div className="space-y-2 max-h-[850px] overflow-y-auto scrollbar-hide pr-2">
                      {timelineItems.map((item, index) => (
                        <div key={index} className="relative flex gap-2 pb-3 last:pb-0">
                          {/* Timeline Line */}
                          {index < timelineItems.length - 1 && (
                            <div className="absolute left-2.5 top-6 bottom-0 w-px bg-gray-200" />
                          )}
                                              
                          {/* Icon - Smaller */}
                          <div className={`relative w-5 h-5 rounded-full ${item.color} flex items-center justify-center flex-shrink-0 shadow-sm z-10`}>
                            <item.icon className="w-2.5 h-2.5 text-white flex-shrink-0" />
                          </div>
                                              
                          {/* Content - More Compact */}
                          <div className="flex-1 min-w-0 bg-gray-50 rounded-md p-2 border border-gray-100">
                            <h4 className="font-medium text-gray-900 text-sm truncate">{item.title}</h4>
                            <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{item.subtitle}</p>
                            <p className="text-[10px] text-gray-500 mt-1">{item.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              
                {/* Right Column - Stacked Cards (Compact) - Increased Width */}
                <div className="lg:col-span-1 space-y-3">
                                
                  {/* Financial Snapshot - Compact Row Layout */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600 flex-shrink-0" />
                      Financial Snapshot
                    </h3>
                                        
                    <div className="space-y-2">
                      {/* Total Spent */}
                      <div className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded-md">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                            <TrendingUp className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-600 font-medium">Total Spent</div>
                            <div className="text-lg font-bold text-gray-900">د.إ{financialData.totalSpent.toLocaleString()}</div>
                          </div>
                        </div>
                      </div>
                                          
                      {/* Pending Payment */}
                      <div className="flex items-center p-2 bg-red-50 border border-red-100 rounded-md">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                            <CreditCard className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-700 font-medium">Pending Payment</div>
                            <div className="text-lg font-bold text-red-600">{formatAED(balance.pendingBalance)}</div>
                          </div>
                        </div>
                      </div>
                                          
                      {/* Advance Balance */}
                      <div className="flex items-center justify-between p-2 bg-teal-50 border border-teal-100 rounded-md">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center">
                            <Wallet className="w-3.5 h-3.5 text-teal-600 flex-shrink-0" />
                          </div>
                          <div>
                            <div className="text-xs text-gray-700 font-medium">Advance Balance</div>
                            <div className="text-lg font-bold text-teal-600">{formatAED(balance.advanceBalance)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
              
                  {/* Alerts - Compact Card Style */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                      Alerts
                    </h3>
                                        
                    <div className="space-y-1.5">
                      {alerts.map((alert, index) => (
                        <div key={index} className={`p-2 rounded-md border-l-2 ${
                          alert.type === 'warning' ? 'bg-yellow-50 border-yellow-400' :
                          alert.type === 'danger' ? 'bg-red-50 border-red-400' :
                          'bg-blue-50 border-blue-400'
                        }`}>
                          <div className="flex items-start gap-2">
                            <alert.icon className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                              alert.type === 'warning' ? 'text-yellow-600' :
                              alert.type === 'danger' ? 'text-red-600' :
                              'text-blue-600'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold text-gray-900 mb-0.5">
                                {alert.type === 'warning' ? 'Warning' :
                                 alert.type === 'danger' ? 'Critical' :
                                 'Info'}
                              </div>
                              <div className="text-[10px] text-gray-700 leading-tight">
                                {alert.message}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
              
                  {/* Patient Behavior - Compact with Right-Aligned Values */}
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2.5 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      Patient Behavior
                    </h3>
                                        
                    <div className="space-y-2">
                      {behaviorMetrics.map((metric: any, index: number) => (
                        <div key={index}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-600 font-medium">{metric.label}</span>
                            <span className="text-sm font-bold text-gray-900">
                              {metric.displayValue !== null && metric.displayValue !== undefined
                                ? `${metric.displayValue}%`
                                : `${metric.value}%`}
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-1.5 rounded-full ${metric.color} transition-all duration-500`}
                              style={{ width: `${Math.min(100, metric.value)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
              
                </div>
              </div>
            )}
        </div>

        {/* Before/After Modal */}
        {showBeforeAfterModal && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowBeforeAfterModal(false)}
          >
            <div 
              className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">Laser Hair Removal – Before & After</h2>
                <button
                  onClick={() => setShowBeforeAfterModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-600" />
                </button>
              </div>
              
              {/* Modal Content - Images */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Before Image */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 text-center">Before</h3>
                    <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center border-2 border-gray-300">
                      <div className="text-center p-6">
                        <FileImage className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Before Treatment Image</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* After Image */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-3 text-center">After</h3>
                    <div className="aspect-square bg-gradient-to-br from-teal-100 to-cyan-100 rounded-xl flex items-center justify-center border-2 border-teal-300">
                      <div className="text-center p-6">
                        <FileImage className="w-16 h-16 text-teal-600 mx-auto mb-3" />
                        <p className="text-teal-700 text-sm">After Treatment Image</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Modal Footer - Close Button */}
              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => setShowBeforeAfterModal(false)}
                  className="w-full py-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 text-white font-semibold rounded-lg transition-all shadow-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

// Main Page Component
function PatientProfileView() {
  const router = useRouter();
  const { id } = router.query;
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchPatientData();
    }
  }, [id]);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const headers = getAuthHeaders();
      if (!headers) {
        router.push('/clinic/login-clinic');
        return;
      }

      // Fetch patient data from API
      const response = await axios.get(`/api/clinic/patient-registration?id=${id}`, { headers });
      if (response.data.success && response.data.patient) {
        setPatient(response.data.patient);
      }
    } catch (error) {
      console.error('Error fetching patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-teal-600"></div>
      </div>
    );
  }

  return (
    <PatientProfileDashboard patientData={patient} onClose={handleClose} />
  );
}

PatientProfileView.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedPatientProfileView = withClinicAuth(PatientProfileView) as typeof PatientProfileView;
ProtectedPatientProfileView.getLayout = PatientProfileView.getLayout;

export default ProtectedPatientProfileView;

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  FileText, CheckCircle, Wallet, Activity, BadgeCheck, Hourglass,
  ShieldAlert, X, RefreshCw, Search, Users, AlertCircle, Eye, Trash2,
  ChevronDown, Loader2, FileImage, CalendarClock, User, Clock, Shield, Stethoscope,
  ArrowLeftRight, MoveRight, ChevronLeft, ChevronRight, AlertTriangle, Send, Calendar, XCircle
} from 'lucide-react';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { getCurrencySymbol } from '@/lib/currencyHelper';
import { useCurrency } from '@/context/CurrencyContext';

const TOKEN_PRIORITY = ["clinicToken", "doctorToken", "agentToken", "staffToken", "userToken", "adminToken"];

const getAuthHeaders = () => {
  let token =
    localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken") ||
    localStorage.getItem("doctorToken") || sessionStorage.getItem("doctorToken");
  if (!token) token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
  if (!token) {
    for (const key of TOKEN_PRIORITY) {
      token = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (token) break;
    }
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ===== Permission constants for the clinic_claim_management module =====
const CLAIM_MGMT_MODULE_KEY = "clinic_claim_management";
// The permission can live as a standalone top-level module OR as a submodule
// inside the "claims" parent module — match both possible parents.
const CLAIM_MGMT_PARENT_MODULE_KEYS = ["claims", "clinic_claim_management"];

// Helper: URL-based role detection
const getUserRole = () => {
  if (typeof window === 'undefined') return null;
  const pathname = window.location.pathname;
  if (pathname.startsWith('/clinic/')) return 'clinic';
  if (pathname.startsWith('/staff/') || pathname.startsWith('/agent/')) {
    try {
      const token = localStorage.getItem('agentToken') || sessionStorage.getItem('agentToken') ||
                    localStorage.getItem('userToken') || sessionStorage.getItem('userToken');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload?.role || null;
      }
    } catch (e) { /* ignore */ }
  }
  return null;
};

// Helper: get first available token from storage
const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    try {
      const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (value) return value;
    } catch (error) { continue; }
  }
  return null;
};

// Permission helper functions
const isTruthy = (val: any) =>
  val === true || val === "true" || String(val || "").toLowerCase() === "true";

const findClaimMgmtModule = (permissionsList: any[]) =>
  permissionsList.find((p: any) => {
    if (!p?.module) return false;
    const mod = String(p.module).toLowerCase();
    return CLAIM_MGMT_PARENT_MODULE_KEYS.includes(mod);
  });

const findSubModulePermission = (parentModule: any, subModuleKey: string) => {
  if (!parentModule?.subModules || !Array.isArray(parentModule.subModules)) return null;
  return parentModule.subModules.find(
    (sm: any) => String(sm.moduleKey || "").toLowerCase() === subModuleKey.toLowerCase()
  );
};

const parsePermissionActions = (actions: any = {}) => {
  const moduleAll = isTruthy(actions.all);
  return {
    canRead: moduleAll || isTruthy(actions.read),
    canCreate: moduleAll || isTruthy(actions.create),
    canUpdate: moduleAll || isTruthy(actions.update),
    canDelete: moduleAll || isTruthy(actions.delete),
  };
};

type StatKey =
  | "total"
  | "paid"
  | "advance"
  | "ongoing"
  | "released"
  | "readyToRelease"
  | "waitingApproval";

interface ClaimRow {
  _id: string;
  patientId: string;
  patientName: string;
  patientGender: string;
  patientPhone: string;
  emrNumber: string;
  insuranceProvider: string;
  policyNumber: string;
  doctorName: string;
  departmentName: string;
  claimType: string;
  status: string;
  createdByName: string;
  createdByRole: string;
  coPayPercent: number;
  claimAmount: number;
  advanceAmount: number;
  finalClaimAmount: number | null;
  createdAt: string;
  amount: number;
  rejectionReason?: string;
  rejectedFromReleaseRequested?: boolean;
}

interface StatBucket {
  count: number;
  amount: number;
  claims: ClaimRow[];
}

type DashboardData = Record<StatKey, StatBucket>;

interface StatCardDef {
  key: StatKey;
  label: string;
  description: string;
  amountLabel: string;
  icon: any;
  chip: string;   // icon chip classes
  bar: string;    // top accent bar
  pill: string;   // count pill classes
}

const STAT_CARDS: StatCardDef[] = [
  {
    key: "total",
    label: "Total Claims",
    description: "Every insurance claim raised by the clinic",
    amountLabel: "Claim amount",
    icon: FileText,
    chip: "bg-teal-50 text-teal-600",
    bar: "bg-teal-500",
    pill: "bg-teal-50 text-teal-700",
  },
  {
    key: "paid",
    label: "Paid Claims",
    description: "Fully settled — paid amount matches final amount",
    amountLabel: "Paid amount",
    icon: CheckCircle,
    chip: "bg-green-50 text-green-600",
    bar: "bg-green-500",
    pill: "bg-green-50 text-green-700",
  },
  {
    key: "advance",
    label: "Advance Claims",
    description: "Claims raised with advance payment",
    amountLabel: "Advance amount",
    icon: Wallet,
    chip: "bg-amber-50 text-amber-600",
    bar: "bg-amber-500",
    pill: "bg-amber-50 text-amber-700",
  },
  {
    key: "ongoing",
    label: "Ongoing Claims",
    description: "Under review, finance checked or completed — not released",
    amountLabel: "Claim amount",
    icon: Activity,
    chip: "bg-blue-50 text-blue-600",
    bar: "bg-blue-500",
    pill: "bg-blue-50 text-blue-700",
  },
  {
    key: "released",
    label: "Released Claims",
    description: "Claims released to the insurer",
    amountLabel: "Paid amount",
    icon: BadgeCheck,
    chip: "bg-violet-50 text-violet-600",
    bar: "bg-violet-500",
    pill: "bg-violet-50 text-violet-700",
  },
  {
    key: "readyToRelease",
    label: "Ready to Release",
    description: "Finance completed, awaiting release",
    amountLabel: "Paid amount",
    icon: Hourglass,
    chip: "bg-cyan-50 text-cyan-600",
    bar: "bg-cyan-500",
    pill: "bg-cyan-50 text-cyan-700",
  },
  {
    key: "waitingApproval",
    label: "Waiting Approval",
    description: "Under review by the doctor",
    amountLabel: "Paid amount",
    icon: ShieldAlert,
    chip: "bg-orange-50 text-orange-600",
    bar: "bg-orange-500",
    pill: "bg-orange-50 text-orange-700",
  },
];

const PAGE_SIZE = 10;

function ClaimManagementPage() {
  const { currency } = useCurrency();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeStat, setActiveStat] = useState<StatKey | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ===== Search & filter (mirrors create-claim All Claims behaviour) =====
  const [filterQ, setFilterQ] = useState("");
  const [filterDoctor, setFilterDoctor] = useState("");
  const [filterInsurance, setFilterInsurance] = useState("");
  const [filterPatient, setFilterPatient] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [openFilter, setOpenFilter] = useState<null | "doctor" | "insurance" | "patient" | "department">(null);
  const [filterOptions, setFilterOptions] = useState<{ doctors: any[]; departments: any[]; patients: any[] }>({
    doctors: [],
    departments: [],
    patients: [],
  });
  const [providers, setProviders] = useState<string[]>([]);
  const [patientQuery, setPatientQuery] = useState("");
  const [patientSearchLoading, setPatientSearchLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [userRole, setUserRole] = useState("");

  // Permission state — same two-tier resolution as create-claim
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Claim view / tracking / preview state (ports of the create-claim modals)
  const [claimViewModal, setClaimViewModal] = useState<any>(null);
  const [claimTrackingModal, setClaimTrackingModal] = useState<any>(null);
  const [textPreview, setTextPreview] = useState<any>(null);
  const [docViewerUrl, setDocViewerUrl] = useState<string | null>(null);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [patientHistoryLoading, setPatientHistoryLoading] = useState(false);
  // Remaining claim credit per patient (from patient-balance API) for the
  // Available Amount column — reflects billing usage AND credit transfers.
  const [availableByPatient, setAvailableByPatient] = useState<Record<string, number>>({});

  // ===== Release verification state (ported from release-requested-claims) =====
  const [releaseModal, setReleaseModal] = useState<any>(null);
  const [releaseVerificationLoading, setReleaseVerificationLoading] = useState(false);
  const [releaseActionLoading, setReleaseActionLoading] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [progressStatus, setProgressStatus] = useState<any>(null);
  const [consentStatus, setConsentStatus] = useState<any>(null);
  const [releaseSuccessMsg, setReleaseSuccessMsg] = useState("");

  // Reject state
  const [rejectModal, setRejectModal] = useState<any>(null);
  const [rejectionNote, setRejectionNote] = useState("");
  const [rejectActionLoading, setRejectActionLoading] = useState(false);

  // Role from the stored token — used to gate the delete action
  const getTokenRole = () => {
    try {
      let token: string | null = null;
      for (const key of TOKEN_PRIORITY) {
        token = localStorage.getItem(key) || sessionStorage.getItem(key);
        if (token) break;
      }
      if (!token) return "";
      const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      return payload?.role || "";
    } catch {
      return "";
    }
  };

  // Expected-release SLA tag (same state machine as the claims pages)
  const getExpectedReleaseTag = (claim: any) => {
    if (!claim.expectedReleaseDate) return null;
    const isReleased = claim.status === "Released" || claim.status === "Completed" || !!claim.releasedAt;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const expected = new Date(claim.expectedReleaseDate); expected.setHours(0, 0, 0, 0);
    const diffDays = Math.round((expected.getTime() - today.getTime()) / 86400000);
    const dateStr = expected.toLocaleDateString();
    if (isReleased) return { label: `Achieved Expected Release · ${dateStr}`, cls: "border-green-300 text-green-700", Icon: CheckCircle };
    if (diffDays < 0) return { label: `Overdue Expected Release · ${dateStr}`, cls: "border-red-300 text-red-600", Icon: CalendarClock };
    if (diffDays === 0) return { label: "Expected Release Today", cls: "border-orange-300 text-orange-600", Icon: CalendarClock };
    if (diffDays === 1) return { label: "Expected Release Tomorrow", cls: "border-red-300 text-red-600", Icon: CalendarClock };
    if (diffDays <= 5) return { label: `Expected in ${diffDays} Days · ${dateStr}`, cls: "border-amber-300 text-amber-700", Icon: CalendarClock };
    return { label: `Ongoing Release · ${dateStr}`, cls: "border-blue-300 text-blue-600", Icon: CalendarClock };
  };

  // Fetch sibling claims for the View modal's Claim history section
  const fetchPatientHistory = async (claim: any) => {
    setPatientHistory([]);
    setPatientHistoryLoading(true);
    try {
      const res = await axios.get("/api/clinic/insurance-claims", { params: { patientId: claim.patientId }, headers: getAuthHeaders() });
      const list = res.data?.data || res.data || [];
      setPatientHistory((Array.isArray(list) ? list : []).filter((c: any) => String(c._id) !== String(claim._id)));
    } catch {
      setPatientHistory([]);
    } finally {
      setPatientHistoryLoading(false);
    }
  };

  const handleViewClaim = (claim: any) => {
    setClaimViewModal(claim);
    setTextPreview(null);
    if (claim.patientId) fetchPatientHistory(claim);
    else { setPatientHistory([]); setPatientHistoryLoading(false); }
  };

  const runSearch = useCallback(async () => {
    const params: any = {};
    const text = filterQ.trim();
    if (text) params.q = text;
    if (filterDoctor) params.doctorId = filterDoctor;
    if (filterInsurance) params.insuranceProvider = filterInsurance;
    if (filterPatient) params.patientId = filterPatient;
    if (filterDepartment) params.departmentId = filterDepartment;
    setResultsLoading(true);
    setPage(1);
    try {
      const res = await axios.get("/api/clinic/claim-management/search", { params, headers: getAuthHeaders() });
      const list = res.data?.data || [];
      setResults(Array.isArray(list) ? list : []);
      // Available Amount column — per-patient remaining claim credit
      const pids = [...new Set((Array.isArray(list) ? list : []).map((c: any) => c.patientId).filter(Boolean).map(String))].slice(0, 100);
      if (pids.length > 0) {
        const entries = await Promise.all(
          pids.map(async (pid) => {
            try {
              const r = await axios.get(`/api/clinic/patient-balance/${pid}`, { headers: getAuthHeaders() });
              return [pid, Number(r?.data?.balances?.claimAmount || 0)] as const;
            } catch {
              return [pid, 0] as const;
            }
          })
        );
        setAvailableByPatient(Object.fromEntries(entries));
      } else {
        setAvailableByPatient({});
      }
    } catch {
      setResults([]);
      setAvailableByPatient({});
    } finally {
      setResultsLoading(false);
    }
  }, [filterQ, filterDoctor, filterInsurance, filterPatient, filterDepartment]);

  // ===== Permission fetching — same two-tier resolution as create-claim:
  // clinic/doctor use sidebar-permissions; agent/doctorStaff/staff use
  // get-module-permissions with the clinic_claim_management module key =====
  useEffect(() => {
    let isMounted = true;

    const role = getUserRole();
    const authToken = getStoredToken();
    const clinicToken =
      typeof window !== "undefined"
        ? localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken")
        : null;
    const doctorToken =
      typeof window !== "undefined"
        ? localStorage.getItem("doctorToken") || sessionStorage.getItem("doctorToken")
        : null;
    const agentToken =
      typeof window !== "undefined"
        ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken")
        : null;
    const staffToken =
      typeof window !== "undefined"
        ? localStorage.getItem("staffToken") || sessionStorage.getItem("staffToken")
        : null;
    const userToken =
      typeof window !== "undefined"
        ? localStorage.getItem("userToken") || sessionStorage.getItem("userToken")
        : null;

    // Admin gets full permissions
    if (role === "admin") {
      if (!isMounted) return;
      setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
      setPermissionsLoaded(true);
      return () => { isMounted = false; };
    }

    // Clinic/Doctor role - use sidebar-permissions API
    if (role === "clinic" || role === "doctor") {
      const fetchClinicPermissions = async () => {
        try {
          const clinicAuthToken = clinicToken || doctorToken || authToken;
          if (!clinicAuthToken) {
            if (!isMounted) return;
            setPermissions({ canRead: false, canCreate: false, canUpdate: false, canDelete: false });
            setPermissionsLoaded(true);
            return;
          }

          const res = await axios.get("/api/clinic/sidebar-permissions", {
            headers: { Authorization: `Bearer ${clinicAuthToken}` },
          });

          if (!isMounted) return;

          if (
            res.data.success &&
            (res.data.permissions === null ||
              !Array.isArray(res.data.permissions) ||
              res.data.permissions.length === 0)
          ) {
            // No permissions configured - grant full access (backward compatibility)
            setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
          } else if (res.data.success) {
            const parentModule = findClaimMgmtModule(res.data.permissions);

            if (parentModule) {
              const subModule = findSubModulePermission(parentModule, CLAIM_MGMT_MODULE_KEY);
              if (subModule) {
                setPermissions(parsePermissionActions(subModule.actions || {}));
              } else {
                // No submodule entry - fall back to the parent module actions
                setPermissions(parsePermissionActions(parentModule.actions || {}));
              }
            } else {
              // Parent claims module not found - read-only default
              setPermissions({ canRead: true, canCreate: false, canUpdate: false, canDelete: false });
            }
          } else {
            setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
          }
        } catch (err) {
          console.error("Error fetching clinic sidebar permissions:", err);
          if (isMounted) {
            setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
          }
        } finally {
          if (isMounted) setPermissionsLoaded(true);
        }
      };

      fetchClinicPermissions();
      return () => { isMounted = false; };
    }

    // Agent/DoctorStaff/Staff role - use get-module-permissions API
    const agentStaffToken = getStoredToken();
    if (!agentStaffToken) {
      setPermissions({ canRead: false, canCreate: false, canUpdate: false, canDelete: false });
      setPermissionsLoaded(true);
      return () => { isMounted = false; };
    }

    if (
      agentToken || staffToken || userToken ||
      role === "agent" || role === "doctorStaff" || role === "staff"
    ) {
      const fetchAgentPermissions = async () => {
        try {
          setPermissionsLoaded(false);
          let permissionToken = agentStaffToken;
          if (role === "agent") {
            permissionToken = agentToken || agentStaffToken;
          } else if (role === "doctorStaff" || role === "staff") {
            permissionToken = userToken || staffToken || agentStaffToken;
          }
          const res = await axios.get("/api/agent/get-module-permissions", {
            params: { moduleKey: "claims" },
            headers: { Authorization: `Bearer ${permissionToken}` },
          });

          if (!isMounted) return;

          if (
            !res.data?.permissions &&
            res.data?.error?.includes("not found in agent permissions")
          ) {
            // Module not configured for this agent - full access (backward compatibility)
            setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
            setPermissionsLoaded(true);
            return;
          }

          if (res.data?.success && res.data?.permissions) {
            setPermissions(parsePermissionActions(res.data.permissions.actions || {}));
          } else {
            setPermissions({ canRead: false, canCreate: false, canUpdate: false, canDelete: false });
          }
        } catch (err) {
          console.error("Error fetching agent permissions:", err);
          if (isMounted) {
            setPermissions({ canRead: false, canCreate: false, canUpdate: false, canDelete: false });
          }
        } finally {
          if (isMounted) setPermissionsLoaded(true);
        }
      };

      fetchAgentPermissions();
    } else {
      setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
      setPermissionsLoaded(true);
    }

    return () => { isMounted = false; };
  }, []);

  // Debounced search — also fires once on mount for the initial full list,
  // but only after permissions resolve and only when read is allowed
  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!permissions.canRead) {
      setResults([]);
      setAvailableByPatient({});
      setResultsLoading(false);
      return;
    }
    const t = setTimeout(() => runSearch(), 350);
    return () => clearTimeout(t);
  }, [runSearch, permissionsLoaded, permissions.canRead]);

  // Dropdown data — doctors/departments/patients are all clinic-scoped endpoints
  useEffect(() => {
    setUserRole(getTokenRole());
    const load = async () => {
      const headers = getAuthHeaders();
      try {
        const [docRes, deptRes, patRes] = await Promise.all([
          axios.get("/api/clinic/doctors", { headers }),
          axios.get("/api/clinic/departments", { headers }),
          axios.get("/api/clinic/patient-registration", { headers }),
        ]);
        setFilterOptions({
          doctors: docRes.data?.data || [],
          departments: deptRes.data?.departments || [],
          patients: patRes.data?.data || [],
        });
      } catch {
        // leave dropdowns empty rather than blocking the page
      }
    };
    load();
  }, []);

  // Server-side patient search inside the patient dropdown
  useEffect(() => {
    if (openFilter !== "patient") return;
    const t = setTimeout(async () => {
      setPatientSearchLoading(true);
      try {
        const res = await axios.get(`/api/clinic/patient-registration?name=${encodeURIComponent(patientQuery)}`, { headers: getAuthHeaders() });
        setFilterOptions((o) => ({ ...o, patients: res.data?.data || [] }));
      } catch {
        // keep current list
      } finally {
        setPatientSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [patientQuery, openFilter]);

  // Distinct insurance providers come from the dashboard's total bucket
  useEffect(() => {
    if (!data?.total?.claims) return;
    setProviders(
      [...new Set(data.total.claims.map((c) => c.insuranceProvider).filter(Boolean))].sort()
    );
  }, [data]);

  const hasActiveFilters = Boolean(
    filterQ.trim() || filterDoctor || filterInsurance || filterPatient || filterDepartment
  );

  // Pagination over the filtered result set (10 per page)
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = results.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const clearFilters = () => {
    setFilterQ("");
    setFilterDoctor("");
    setFilterInsurance("");
    setFilterPatient("");
    setFilterDepartment("");
    setOpenFilter(null);
  };

  const deleteClaim = async (id: string) => {
    if (!window.confirm("Delete this claim? This cannot be undone.")) return;
    try {
      await axios.delete(`/api/clinic/insurance-claims/${id}`, { headers: getAuthHeaders() });
      runSearch();
      fetchDashboard(true);
    } catch (err: any) {
      window.alert(err?.response?.data?.message || "Failed to delete claim");
    }
  };

  // ===== Release verification & handlers (ported from release-requested-claims) =====
  const fetchReleaseVerificationData = async (claim: any) => {
    setReleaseVerificationLoading(true);
    setReleaseModal(claim);
    setExistingAppointments([]);
    setProgressStatus(null);
    setConsentStatus(null);
    try {
      const headers = getAuthHeaders();
      if (claim.patientId) {
        const aptRes = await axios.get(`/api/clinic/patient-appointment-history/${claim.patientId}`, { headers });
        if (aptRes.data.success && aptRes.data.appointments) {
          const claimCreatedAt = new Date(claim.createdAt);
          const postClaimAppointments = aptRes.data.appointments
            .filter((apt: any) => new Date(apt.createdAt) > claimCreatedAt)
            .sort((a: any, b: any) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
          setExistingAppointments(postClaimAppointments);

          if (postClaimAppointments.length > 0) {
            const notesRes = await axios.get(`/api/clinic/progress-notes?patientId=${claim.patientId}`, { headers });
            if (notesRes.data.success) {
              const allNotes = notesRes.data.notes || [];
              const postClaimAptIds = postClaimAppointments.map((a: any) => a._id);
              const relevantNotes = allNotes.filter((n: any) => postClaimAptIds.includes(n.appointmentId?.toString() || n.appointmentId));
              setProgressStatus({
                hasProgress: relevantNotes.length > 0,
                count: relevantNotes.length,
                notes: relevantNotes,
                appointments: postClaimAppointments,
              });
            }

            const [logRes, statusRes] = await Promise.all([
              axios.get(`/api/clinic/consent-log?patientId=${claim.patientId}`, { headers }),
              axios.get(`/api/clinic/consent-status?patientId=${claim.patientId}`, { headers }),
            ]);
            const consentLogs = logRes.data.success ? (logRes.data.consentLogs || []) : [];
            const consentStatuses = statusRes.data.success ? (statusRes.data.consentStatuses || []) : [];

            const consentByAppointment = postClaimAppointments.map((apt: any) => {
              const aptId = apt._id;
              const aptLogs = consentLogs.filter((l: any) => l.appointmentId === aptId);
              const aptConsentFormIds = aptLogs.map((l: any) => l.consentFormId?.toString() || l.consentFormId);
              const aptSignatures = consentStatuses.filter((s: any) => aptConsentFormIds.includes(s.consentFormId?.toString() || s.consentFormId));
              const hasSigned = aptSignatures.some((s: any) => s.status === "signed" || s.hasSignature);
              const hasSent = aptLogs.length > 0;
              return {
                appointmentId: aptId,
                appointmentDate: apt.startDate,
                appointmentStatus: apt.status,
                hasConsent: hasSent || aptSignatures.length > 0,
                isSigned: hasSigned,
                logs: aptLogs,
                signatures: aptSignatures,
                consentFormName: aptLogs[0]?.consentFormName || aptSignatures[0]?.consentFormName || null,
              };
            });

            const allSigned = consentByAppointment.every((c: any) => c.isSigned);
            const allHaveConsent = consentByAppointment.every((c: any) => c.hasConsent);
            setConsentStatus({
              status: allSigned ? "signed" : allHaveConsent ? "sent" : "not_sent",
              consentByAppointment,
              allSigned,
              allHaveConsent,
              count: consentByAppointment.filter((c: any) => c.hasConsent).length,
            });
          }
        }
      }
    } catch (err) {
      console.error("Error fetching release verification data:", err);
    } finally {
      setReleaseVerificationLoading(false);
    }
  };

  const handleReleaseClaim = async () => {
    if (!permissions.canUpdate) return;
    setReleaseActionLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await axios.patch(
        "/api/clinic/insurance-claims/release-request",
        { claimId: releaseModal._id, action: "release" },
        { headers }
      );
      if (res.data.success) {
        setReleaseModal(null);
        setReleaseSuccessMsg("Claim released successfully!");
        setTimeout(() => setReleaseSuccessMsg(""), 3000);
        runSearch();
        fetchDashboard(true);
      }
    } catch (err: any) {
      window.alert(err.response?.data?.message || "Failed to release claim");
    } finally {
      setReleaseActionLoading(false);
    }
  };

  const handleRejectClaim = async () => {
    if (!permissions.canDelete) return;
    if (!rejectionNote.trim()) { alert("Please provide a rejection note"); return; }
    setRejectActionLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await axios.patch(
        "/api/clinic/insurance-claims/release-request",
        { claimId: rejectModal._id, action: "reject", rejectionNote },
        { headers }
      );
      if (res.data.success) {
        setRejectModal(null);
        setRejectionNote("");
        setReleaseSuccessMsg("Claim rejected successfully!");
        setTimeout(() => setReleaseSuccessMsg(""), 3000);
        runSearch();
        fetchDashboard(true);
      }
    } catch (err: any) {
      window.alert(err.response?.data?.message || "Failed to reject claim");
    } finally {
      setRejectActionLoading(false);
    }
  };

  // ==================== CLAIM CREDIT TRANSFER (ported from create-claim) ====================
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditStep, setCreditStep] = useState(1); // 1=search source, 2=source details, 3=search dest, 4=summary
  const [creditSearchQuery, setCreditSearchQuery] = useState("");
  const [creditSearchResults, setCreditSearchResults] = useState<any[]>([]);
  const [creditSearching, setCreditSearching] = useState(false);
  const [sourcePatient, setSourcePatient] = useState<any>(null);
  const [destPatient, setDestPatient] = useState<any>(null);
  const [sourceUsage, setSourceUsage] = useState<any>(null);
  const [destUsage, setDestUsage] = useState<any>(null);
  const [usageLoading, setUsageLoading] = useState(false);

  // Claim Credit Transfer — amount popup + confirmation popup
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferError, setTransferError] = useState("");
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<any>(null);

  const formatAED = (v: number) => {
    if (typeof v !== 'number' || Number.isNaN(v)) return '—';
    try { return `${getCurrencySymbol(currency)}${v.toLocaleString()}`; } catch { return `${getCurrencySymbol(currency)}${v}`; }
  };

  const resetCreditModal = () => {
    setCreditStep(1);
    setCreditSearchQuery("");
    setCreditSearchResults([]);
    setCreditSearching(false);
    setSourcePatient(null);
    setDestPatient(null);
    setSourceUsage(null);
    setDestUsage(null);
    setUsageLoading(false);
    setTransferModalOpen(false);
    setTransferAmount("");
    setTransferError("");
    setConfirmModalOpen(false);
    setTransferring(false);
    setTransferSuccess(null);
  };

  const openCreditModal = () => { resetCreditModal(); setCreditModalOpen(true); };
  const closeCreditModal = () => { setCreditModalOpen(false); resetCreditModal(); };

  // Search patients for credit transfer (clinic-scoped via search-patients API)
  const searchCreditPatients = async (query: string) => {
    setCreditSearchQuery(query);
    if (!query.trim()) { setCreditSearchResults([]); return; }
    try {
      setCreditSearching(true);
      const res = await axios.get(`/api/clinic/search-patients?search=${encodeURIComponent(query)}`, { headers: getAuthHeaders() });
      if (res.data.success) setCreditSearchResults(res.data.patients || []);
    } catch (err) { console.error("Error searching patients:", err); }
    finally { setCreditSearching(false); }
  };

  // Fetch claim usage (released total, billing used, remaining) for a patient
  const fetchClaimUsage = async (patientId: string) => {
    const res = await axios.get(`/api/clinic/claim-usage?patientId=${patientId}`, { headers: getAuthHeaders() });
    if (res.data.success) return res.data.data;
    return null;
  };

  // Step 1 → 2: pick the SOURCE patient, load usage + insurance claims
  const selectSourcePatient = async (p: any) => {
    setSourcePatient(p);
    setUsageLoading(true);
    try {
      const usage = await fetchClaimUsage(p._id);
      setSourceUsage(usage);
    } catch (err) {
      console.error("Error fetching source claim usage:", err);
      setSourceUsage(null);
    } finally {
      setUsageLoading(false);
    }
    setCreditStep(2);
  };

  // Step 2 → 3: user chose to transfer — search destination patient
  const startTransfer = () => {
    setCreditSearchQuery("");
    setCreditSearchResults([]);
    setCreditStep(3);
  };

  // ===== Transfer amount popup + confirmation popup =====
  const openTransferModal = () => {
    setTransferAmount("");
    setTransferError("");
    setTransferSuccess(null);
    setConfirmModalOpen(false);
    setTransferModalOpen(true);
  };

  const closeTransferModal = () => {
    if (transferring) return;
    setTransferModalOpen(false);
    setTransferError("");
  };

  // Validate the entered amount locally, then open the confirmation popup
  const goToConfirm = () => {
    const amt = Number(transferAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      setTransferError("Enter a valid amount greater than 0");
      return;
    }
    const max = Number(sourceUsage?.remainingClaimAmount || 0);
    if (amt > max) {
      setTransferError(`Amount exceeds available claim credit (${formatAED(max)})`);
      return;
    }
    setTransferError("");
    setConfirmModalOpen(true);
  };

  // Submit the transfer — the API recomputes balances server-side and
  // records the transfer in the ClaimCreditTransfer ledger
  const submitTransfer = async () => {
    if (!sourcePatient?._id || !destPatient?._id) return;
    setTransferring(true);
    setTransferError("");
    try {
      const res = await axios.post(
        "/api/clinic/claim-transfer/execute",
        {
          sourcePatientId: sourcePatient._id,
          destPatientId: destPatient._id,
          amount: Number(transferAmount),
        },
        { headers: getAuthHeaders() }
      );
      if (res.data.success) {
        setTransferSuccess(res.data);
        // Refresh balances shown in the wizard so they are current
        setSourceUsage((u: any) => u ? { ...u, remainingClaimAmount: res.data.sourceRemaining } : u);
        setDestUsage((u: any) => u ? { ...u, remainingClaimAmount: res.data.destRemaining } : u);
        // Refresh the table + dashboard so Available Amount reflects the new balances
        runSearch();
        fetchDashboard(true);
      } else {
        setTransferError(res.data.message || "Transfer failed");
      }
    } catch (err: any) {
      setTransferError(err.response?.data?.message || "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  const closeAllTransferModals = () => {
    setConfirmModalOpen(false);
    setTransferModalOpen(false);
    setTransferAmount("");
    setTransferError("");
    setTransferSuccess(null);
  };

  // Step 3 → 4: pick the DESTINATION patient, load usage + insurance claims
  const selectDestPatient = async (p: any) => {
    setDestPatient(p);
    setUsageLoading(true);
    try {
      const usage = await fetchClaimUsage(p._id);
      setDestUsage(usage);
    } catch (err) {
      console.error("Error fetching destination claim usage:", err);
      setDestUsage(null);
    } finally {
      setUsageLoading(false);
    }
    setCreditStep(4);
  };

  // Lock body scroll when the credit-transfer modal is open
  useEffect(() => {
    if (creditModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [creditModalOpen]);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const res = await axios.get("/api/clinic/claim-management", { headers: getAuthHeaders() });
      if (res.data?.success) {
        setData(res.data.data);
        setLastUpdated(new Date());
      } else {
        setError(res.data?.message || "Failed to load claim dashboard");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Failed to load claim dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch the dashboard only after permissions resolve and read is allowed
  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!permissions.canRead) {
      setData(null);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    fetchDashboard();
  }, [fetchDashboard, permissionsLoaded, permissions.canRead]);

  const fmt = (n: number) =>
    Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const activeCard = STAT_CARDS.find((c) => c.key === activeStat) || null;
  const activeBucket: StatBucket | null = activeStat && data ? data[activeStat] : null;

  const query = search.trim().toLowerCase();
  const filteredRows: ClaimRow[] = (activeBucket?.claims || []).filter((r) =>
    !query ||
    r.patientName.toLowerCase().includes(query) ||
    r.emrNumber.toLowerCase().includes(query) ||
    r.insuranceProvider.toLowerCase().includes(query)
  );

  // ==================== RENDER ====================

  // Full-page Access Denied — only when BOTH read and create are denied.
  // (read=false + create=true shows only the Claim Credit button instead)
  if (permissionsLoaded && !permissions.canRead && !permissions.canCreate) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to view Claim Management. Please contact your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Claim Management</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Insurance claim overview · click any card to view its claims
              {lastUpdated && !loading && (
                <span className="text-gray-400">
                  {" "}· updated {lastUpdated.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          {permissions.canRead && (
          <button
            onClick={() => fetchDashboard(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 hover:text-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed self-start sm:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          )}
        </div>

        {permissions.canRead ? (
        <>
        {/* Error banner */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium">{error}</p>
          </div>
        )}

        {/* Stat cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {STAT_CARDS.map((card) => (
              <div key={card.key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100" />
                  <div className="h-3 w-24 bg-gray-100 rounded" />
                </div>
                <div className="h-7 w-16 bg-gray-100 rounded mt-4" />
                <div className="h-3 w-28 bg-gray-100 rounded mt-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {STAT_CARDS.map((card) => {
              const bucket = data?.[card.key];
              const Icon = card.icon;
              return (
                <button
                  key={card.key}
                  onClick={() => { setActiveStat(card.key); setSearch(""); }}
                  className="group relative text-left bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                >
                  <div className={`h-1 w-full ${card.bar}`} />
                  <div className="p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.chip}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${card.pill}`}>
                        {bucket?.count ?? 0} {bucket?.count === 1 ? "claim" : "claims"}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-gray-900 mt-4">{card.label}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 leading-snug">{card.description}</p>
                    <div className="flex items-end justify-between mt-4 pt-3 border-t border-gray-50">
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">{card.amountLabel}</p>
                        <p className="text-lg font-extrabold text-gray-900 tracking-tight">
                          {getCurrencySymbol(currency)} {fmt(bucket?.amount ?? 0)}
                        </p>
                      </div>
                      <span className="text-[10px] font-semibold text-teal-600 opacity-0 group-hover:opacity-100 transition-opacity">
                        View details →
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        </>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
            <div className="text-center max-w-md mx-auto">
              <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Access Denied</h3>
              <p className="text-sm text-gray-600">You don't have permission to view claims. Please contact your administrator to request access.</p>
            </div>
          </div>
        )}

        {/* Claim Credit Transfer — opens the ported create-claim wizard */}
        {permissions.canCreate && (
        <div className="flex justify-end mt-4">
          <button
            onClick={openCreditModal}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 rounded-lg text-xs font-semibold transition-colors shadow-sm"
          >
            <ArrowLeftRight className="w-4 h-4" /> Claim Credit
          </button>
        </div>
        )}

        {/* ===== Search + filters + All Claims table (same columns/actions as create-claim) ===== */}
        {permissions.canRead && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-4">
          <div className="px-4 py-2.5 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <div className="w-7 h-7 rounded-lg bg-teal-100 flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-teal-600" /></div>
            <h3 className="text-sm font-semibold text-gray-900">All Claims</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{results.length} total</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 transition-colors"
              >
                <X className="w-3 h-3" /> Clear filters
              </button>
            )}
          </div>

          <div className="px-4 pt-2.5">
            {/* Free-text search: doctor / insurance / patient / department */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="Search by doctor name, insurance name, patient name or department…"
                className="w-full pl-9 pr-4 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
              />
              {resultsLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400 absolute right-3 top-1/2 -translate-y-1/2" />}
            </div>

            {/* Dropdown filters */}
            {openFilter && <div className="fixed inset-0 z-20" onClick={() => setOpenFilter(null)} />}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2 relative">
              {/* Doctor */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter(openFilter === "doctor" ? null : "doctor")}
                  className={`w-full inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors ${filterDoctor ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"}`}
                >
                  <Stethoscope className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{filterDoctor ? filterOptions.doctors.find((d) => String(d._id) === filterDoctor)?.name || "Doctor" : "All doctors"}</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-auto text-gray-400" />
                </button>
                {openFilter === "doctor" && (
                  <div className="absolute z-30 mt-1 w-full min-w-44 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    <button onClick={() => { setFilterDoctor(""); setOpenFilter(null); }} className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50">All doctors</button>
                    {filterOptions.doctors.map((d: any) => (
                      <button
                        key={d._id}
                        onClick={() => { setFilterDoctor(String(d._id)); setOpenFilter(null); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-50 ${filterDoctor === String(d._id) ? "font-bold text-teal-700 bg-teal-50" : "text-gray-700"}`}
                      >
                        {d.name}{d.role === "doctorStaff" ? " (Staff)" : ""}
                      </button>
                    ))}
                    {filterOptions.doctors.length === 0 && <p className="px-3 py-2 text-[11px] text-gray-400">No doctors found</p>}
                  </div>
                )}
              </div>

              {/* Insurance provider */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter(openFilter === "insurance" ? null : "insurance")}
                  className={`w-full inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors ${filterInsurance ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"}`}
                >
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{filterInsurance || "All insurance"}</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-auto text-gray-400" />
                </button>
                {openFilter === "insurance" && (
                  <div className="absolute z-30 mt-1 w-full min-w-44 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    <button onClick={() => { setFilterInsurance(""); setOpenFilter(null); }} className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50">All insurance</button>
                    {providers.map((p: string) => (
                      <button
                        key={p}
                        onClick={() => { setFilterInsurance(p); setOpenFilter(null); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-50 ${filterInsurance === p ? "font-bold text-teal-700 bg-teal-50" : "text-gray-700"}`}
                      >
                        {p}
                      </button>
                    ))}
                    {providers.length === 0 && <p className="px-3 py-2 text-[11px] text-gray-400">No providers found</p>}
                  </div>
                )}
              </div>

              {/* Patient (clinic-scoped, server-side name search) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter(openFilter === "patient" ? null : "patient")}
                  className={`w-full inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors ${filterPatient ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"}`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {filterPatient
                      ? (() => { const p = filterOptions.patients.find((x: any) => String(x._id) === filterPatient); return p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Patient" : "Patient"; })()
                      : "All patients"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-auto text-gray-400" />
                </button>
                {openFilter === "patient" && (
                  <div className="absolute z-30 mt-1 w-full min-w-56 bg-white border border-gray-200 rounded-xl shadow-lg">
                    <div className="p-2 border-b border-gray-100 sticky top-0 bg-white rounded-t-xl">
                      <div className="relative">
                        <Search className="w-3 h-3 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={patientQuery}
                          onChange={(e) => setPatientQuery(e.target.value)}
                          placeholder="Search patient…"
                          className="w-full pl-7 pr-6 py-1.5 border border-gray-200 rounded-lg text-[11px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                        />
                        {patientSearchLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400 absolute right-2 top-1/2 -translate-y-1/2" />}
                      </div>
                    </div>
                    <div className="max-h-56 overflow-y-auto">
                      <button onClick={() => { setFilterPatient(""); setOpenFilter(null); }} className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50">All patients</button>
                      {filterOptions.patients.map((p: any) => (
                        <button
                          key={p._id}
                          onClick={() => { setFilterPatient(String(p._id)); setOpenFilter(null); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-50 ${filterPatient === String(p._id) ? "font-bold text-teal-700 bg-teal-50" : "text-gray-700"}`}
                        >
                          {p.firstName} {p.lastName}
                          <span className="block text-[10px] text-gray-400 font-mono">EMR {p.emrNumber || "—"}</span>
                        </button>
                      ))}
                      {filterOptions.patients.length === 0 && !patientSearchLoading && <p className="px-3 py-2 text-[11px] text-gray-400">No patients found</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Department */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenFilter(openFilter === "department" ? null : "department")}
                  className={`w-full inline-flex items-center gap-1.5 px-2.5 py-1.5 border rounded-lg text-xs font-medium transition-colors ${filterDepartment ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"}`}
                >
                  <Activity className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{filterDepartment ? filterOptions.departments.find((d) => String(d._id) === filterDepartment)?.name || "Department" : "All departments"}</span>
                  <ChevronDown className="w-3.5 h-3.5 shrink-0 ml-auto text-gray-400" />
                </button>
                {openFilter === "department" && (
                  <div className="absolute z-30 mt-1 w-full min-w-44 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                    <button onClick={() => { setFilterDepartment(""); setOpenFilter(null); }} className="w-full text-left px-3 py-2 text-xs text-gray-500 hover:bg-gray-50">All departments</button>
                    {filterOptions.departments.map((d: any) => (
                      <button
                        key={d._id}
                        onClick={() => { setFilterDepartment(String(d._id)); setOpenFilter(null); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-teal-50 ${filterDepartment === String(d._id) ? "font-bold text-teal-700 bg-teal-50" : "text-gray-700"}`}
                      >
                        {d.name}
                      </button>
                    ))}
                    {filterOptions.departments.length === 0 && <p className="px-3 py-2 text-[11px] text-gray-400">No departments found</p>}
                  </div>
                )}
              </div>
            </div>

            {/* Active filter chips + combined paid summary — every applied filter is
                shown here individually and combines with AND on the backend */}
            {(() => {
              const chips: { key: string; label: string; clear: () => void }[] = [];
              if (filterDoctor) chips.push({ key: "doctor", label: `Doctor: ${filterOptions.doctors.find((d) => String(d._id) === filterDoctor)?.name || "selected"}`, clear: () => setFilterDoctor("") });
              if (filterInsurance) chips.push({ key: "insurance", label: `Insurance: ${filterInsurance}`, clear: () => setFilterInsurance("") });
              if (filterPatient) chips.push({ key: "patient", label: `Patient: ${(() => { const p = filterOptions.patients.find((x: any) => String(x._id) === filterPatient); return p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : "selected"; })()}`, clear: () => setFilterPatient("") });
              if (filterDepartment) chips.push({ key: "department", label: `Department: ${filterOptions.departments.find((d) => String(d._id) === filterDepartment)?.name || "selected"}`, clear: () => setFilterDepartment("") });
              if (filterQ.trim()) chips.push({ key: "q", label: `Search: "${filterQ.trim()}"`, clear: () => setFilterQ("") });
              if (chips.length === 0) return null;
              const paidTotal = results.reduce((acc, c) => acc + (c.claimType === "Advance" ? Number(c.claimAmount || 0) : Number(c.advanceAmount || 0)), 0);
              return (
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  {chips.map((c) => (
                    <span key={c.key} className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-[10px] font-semibold text-teal-700">
                      {c.label}
                      <button onClick={c.clear} className="p-0.5 hover:bg-teal-100 rounded-full transition-colors"><X className="w-2.5 h-2.5" /></button>
                    </span>
                  ))}
                  <span className="ml-auto text-[10px] font-medium text-gray-400">
                    {results.length} {results.length === 1 ? "claim" : "claims"} · Paid {getCurrencySymbol(currency)} {fmt(paidTotal)} under selected filters
                  </span>
                </div>
              );
            })()}
          </div>

          <div className="px-4 pb-3 pt-2.5">
            {resultsLoading ? (
              <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-teal-600"></div></div>
            ) : results.length === 0 ? (
              <div className="text-center py-6">
                <Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">{hasActiveFilters ? "No claims match the selected filters" : "No claims found"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Patient</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">EMR #</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Insurance Provider</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Claim Type</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Doctor</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Claim Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Final Claim Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Paid</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pending</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Co-Pay %</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Available Amount</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {pageRows.map((claim: any) => (
                      <tr key={claim._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-gray-500">{claim.invoiceNumber || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{claim.patientFirstName} {claim.patientLastName}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs font-mono text-teal-700">{claim.patientEmrNumber || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{claim.insuranceProvider || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${claim.claimType === 'Advance' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{claim.claimType}</span></td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{claim.departmentName || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">{claim.doctorName || '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-gray-900">{getCurrencySymbol(currency)} {Number(claim.claimAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-gray-900">{getCurrencySymbol(currency)} {(claim.finalClaimAmount || claim.claimAmount)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-green-700">{claim.advanceAmount ? `${getCurrencySymbol(currency)} ${claim.advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-orange-700">{claim.pendingClaim > 0 ? `${getCurrencySymbol(currency)} ${claim.pendingClaim.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-purple-700">{claim.coPayPercent ? `${claim.coPayPercent}%` : '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm font-semibold text-teal-700">{claim.patientId && availableByPatient[String(claim.patientId)] !== undefined ? `${getCurrencySymbol(currency)} ${Number(availableByPatient[String(claim.patientId)]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{(() => { const events: { date: string; status: string }[] = []; if (claim.rejectedFromReleaseRequestedAt) events.push({ date: claim.rejectedFromReleaseRequestedAt, status: 'Rejected' }); if (claim.rejectedFromPassClaimsAt) events.push({ date: claim.rejectedFromPassClaimsAt, status: 'Rejected' }); if (claim.approvedAt) events.push({ date: claim.approvedAt, status: 'Approved' }); if (claim.rejectedAt) events.push({ date: claim.rejectedAt, status: 'Rejected' }); if (claim.releasedAt) events.push({ date: claim.releasedAt, status: 'Released' }); if (claim.completedAt) events.push({ date: claim.completedAt, status: 'Completed' }); if (claim.readyAt) events.push({ date: claim.readyAt, status: 'Ready' }); events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); const s = events.length > 0 ? events[0].status : (claim.status || 'Under Review'); return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s === 'Under Review' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : s === 'Approved' ? 'bg-green-100 text-green-800 border-green-300' : s === 'Rejected' ? 'bg-red-100 text-red-800 border-red-300' : s === 'Ready' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : s === 'Completed' ? 'bg-purple-100 text-purple-800 border-purple-300' : s === 'Released' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>{s}</span>; })()}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500">{new Date(claim.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2 whitespace-nowrap"><div className="flex items-center gap-1">
                          <button onClick={() => handleViewClaim(claim)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Review"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => setClaimTrackingModal(claim)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Track"><Activity className="w-4 h-4" /></button>
                          {permissions.canDelete && ["clinic", "admin"].includes(userRole) && ['Under Review', 'Rejected'].includes(claim.status) && <button onClick={() => deleteClaim(claim._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!resultsLoading && results.length > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-3 pt-2.5 mt-1 border-t border-gray-100">
                <p className="text-[10px] text-gray-400">
                  Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, results.length)} of {results.length}
                </p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={safePage <= 1}
                    className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span className="text-[11px] font-semibold text-gray-500 px-1">
                    {safePage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={safePage >= totalPages}
                    className="px-2.5 py-1 border border-gray-200 rounded-lg text-[11px] font-semibold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Grand summary strip */}
        {/* {!loading && data && (
          <div className="mt-6 bg-[#0d3b33] rounded-2xl px-5 py-4 flex flex-wrap items-center gap-x-8 gap-y-3 text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-teal-300" />
              </div>
              <div>
                <p className="text-[10px] text-teal-200/70 uppercase tracking-wider">Portfolio</p>
                <p className="text-sm font-bold">{data.total.count} claims</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] text-teal-200/70 uppercase tracking-wider">Total claimed</p>
              <p className="text-sm font-bold">{getCurrencySymbol(currency)} {fmt(data.total.amount)}</p>
            </div>
            <div>
              <p className="text-[10px] text-teal-200/70 uppercase tracking-wider">Released</p>
              <p className="text-sm font-bold">{getCurrencySymbol(currency)} {fmt(data.released.amount)}</p>
            </div>
            <div>
              <p className="text-[10px] text-teal-200/70 uppercase tracking-wider">In pipeline</p>
              <p className="text-sm font-bold">{getCurrencySymbol(currency)} {fmt(data.ongoing.amount)}</p>
            </div>
          </div>
        )} */}
      </div>

      {/* Detail modal */}
      {activeStat && activeCard && activeBucket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-[#0d3b33] px-5 py-4 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${activeCard.chip}`}>
                  <activeCard.icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-white leading-tight">{activeCard.label}</h2>
                  <p className="text-[10px] text-teal-200/70 mt-0.5 truncate">{activeCard.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/10 text-teal-100">
                  {activeBucket.count} {activeBucket.count === 1 ? "claim" : "claims"}
                </span>
                <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-white text-[#0d3b33]">
                  {getCurrencySymbol(currency)} {fmt(activeBucket.amount)}
                </span>
                <button
                  onClick={() => setActiveStat(null)}
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="px-5 pt-4 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by patient, EMR or insurance provider…"
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500/40 focus:border-teal-500"
                />
              </div>
            </div>

            {/* Table */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {filteredRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-10 h-10 text-gray-200 mb-3" />
                  <p className="text-sm font-semibold text-gray-500">
                    {query ? "No claims match your search" : "No claims in this bucket yet"}
                  </p>
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100">
                      <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">#</th>
                      <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Patient</th>
                      <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">EMR</th>
                      <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pr-3">Insurance provider</th>
                      <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 text-right">{activeCard.amountLabel}</th>
                      <th className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pb-2 pl-2 text-right w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredRows.map((row, idx) => {
                      const isExpanded = expandedRow === row._id;
                      return (
                        <React.Fragment key={row._id}>
                          <tr className={`hover:bg-gray-50/70 transition-colors cursor-pointer ${(row.rejectionReason || row.rejectedFromReleaseRequested) ? 'border-2 border-red-500 bg-red-100/60' : ''}`} onClick={() => setExpandedRow(isExpanded ? null : row._id)}>
                            <td className="py-2.5 pr-3 text-[10px] text-gray-400">{idx + 1}</td>
                            <td className="py-2.5 pr-3 text-xs font-semibold text-gray-900">{row.patientName}</td>
                            <td className="py-2.5 pr-3">
                              {row.emrNumber ? (
                                <span className="text-[11px] font-mono font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">{row.emrNumber}</span>
                              ) : (
                                <span className="text-[11px] text-gray-300">—</span>
                              )}
                            </td>
                            <td className="py-2.5 pr-3 text-[11px] text-gray-600">{row.insuranceProvider}</td>
                            <td className="py-2.5 pr-3 text-right text-xs font-bold text-gray-900 whitespace-nowrap">
                              {getCurrencySymbol(currency)} {fmt(row.amount)}
                            </td>
                            <td className="py-2.5 pl-2 text-right">
                              <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full transition-all ${isExpanded ? 'bg-teal-100 text-teal-700 rotate-90' : 'bg-gray-100 text-gray-400'}`}>
                                <ChevronDown className="w-3.5 h-3.5" />
                              </div>
                            </td>
                          </tr>
                          {isExpanded && (
                            <tr className={(row.rejectionReason || row.rejectedFromReleaseRequested) ? 'bg-red-50' : ''}>
                              <td colSpan={6} className="p-0">
                                <div className={`border-t border-b px-5 py-4 ${(row.rejectionReason || row.rejectedFromReleaseRequested) ? 'bg-red-50/80 border-red-200' : 'bg-gradient-to-br from-gray-50 to-white border-gray-100'}`}>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Patient Info */}
                                    <div className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-teal-50 flex items-center justify-center">
                                          <User className="w-3.5 h-3.5 text-teal-600" />
                                        </div>
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Patient Information</h4>
                                      </div>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Full Name</p>
                                          <p className="text-xs font-semibold text-gray-900">{row.patientName}</p>
                                        </div>
                                        {row.patientGender && (
                                          <div>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Gender</p>
                                            <p className="text-xs font-medium text-gray-700">{row.patientGender}</p>
                                          </div>
                                        )}
                                        {row.patientPhone && (
                                          <div>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Phone</p>
                                            <p className="text-xs font-medium text-gray-700">{row.patientPhone}</p>
                                          </div>
                                        )}
                                        {row.emrNumber && (
                                          <div>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-wider">EMR Number</p>
                                            <p className="text-xs font-mono font-semibold text-teal-700">{row.emrNumber}</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>

                                    {/* Insurance Info */}
                                    <div className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                          <Shield className="w-3.5 h-3.5 text-blue-600" />
                                        </div>
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Insurance Details</h4>
                                      </div>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Provider</p>
                                          <p className="text-xs font-semibold text-gray-900">{row.insuranceProvider}</p>
                                        </div>
                                        {row.policyNumber && (
                                          <div>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Policy Number</p>
                                            <p className="text-xs font-mono font-medium text-gray-700">{row.policyNumber}</p>
                                          </div>
                                        )}
                                        <div>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Co-Pay</p>
                                          <p className="text-xs font-medium text-gray-700">{row.coPayPercent}%</p>
                                        </div>
                                        <div>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Claim Type</p>
                                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${row.claimType === 'Advance' ? 'bg-amber-100 text-amber-800' : 'bg-teal-100 text-teal-800'}`}>
                                            {row.claimType}
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Claim Info */}
                                    <div className="bg-white rounded-xl border border-gray-100 p-3.5 shadow-sm">
                                      <div className="flex items-center gap-2 mb-3">
                                        <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
                                          <FileText className="w-3.5 h-3.5 text-violet-600" />
                                        </div>
                                        <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Claim Details</h4>
                                      </div>
                                      <div className="space-y-2">
                                        <div>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Doctor</p>
                                          <p className="text-xs font-medium text-gray-700">{row.doctorName}</p>
                                        </div>
                                        {row.departmentName && (
                                          <div>
                                            <p className="text-[9px] text-gray-400 uppercase tracking-wider">Department</p>
                                            <p className="text-xs font-medium text-gray-700">{row.departmentName}</p>
                                          </div>
                                        )}
                                        <div>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Status</p>
                                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            (row.rejectionReason || row.rejectedFromReleaseRequested) ? 'bg-red-100 text-red-800' :
                                            row.status === 'Released' ? 'bg-green-100 text-green-800' :
                                            row.status === 'Completed' ? 'bg-teal-100 text-teal-800' :
                                            row.status === 'Under Review' ? 'bg-amber-100 text-amber-800' :
                                            row.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                            row.status === 'Ready' ? 'bg-blue-100 text-blue-800' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {(row.rejectionReason || row.rejectedFromReleaseRequested) ? 'Rejected' : row.status}
                                          </span>
                                        </div>
                                        <div>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Created By</p>
                                          <p className="text-xs font-medium text-gray-700">{row.createdByName} {row.createdByRole && <span className="text-gray-400 text-[10px]">· {row.createdByRole}</span>}</p>
                                        </div>
                                        <div>
                                          <p className="text-[9px] text-gray-400 uppercase tracking-wider">Created</p>
                                          <p className="text-xs font-medium text-gray-700">{row.createdAt}</p>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Amount Summary Bar */}
                                  <div className="mt-4 flex items-center gap-3 flex-wrap">
                                    <div className="bg-teal-50 border border-teal-100 rounded-lg px-3 py-2">
                                      <p className="text-[9px] text-teal-600 uppercase font-bold tracking-wider">Claim Amount</p>
                                      <p className="text-sm font-bold text-teal-900">{getCurrencySymbol(currency)} {fmt(row.claimAmount)}</p>
                                    </div>
                                    {row.claimType === 'Paid' && (
                                      <div className="bg-green-50 border border-green-100 rounded-lg px-3 py-2">
                                        <p className="text-[9px] text-green-600 uppercase font-bold tracking-wider">Paid Amount</p>
                                        <p className="text-sm font-bold text-green-900">{getCurrencySymbol(currency)} {fmt(row.advanceAmount)}</p>
                                      </div>
                                    )}
                                    {row.finalClaimAmount != null && (
                                      <div className="bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                                        <p className="text-[9px] text-violet-600 uppercase font-bold tracking-wider">Final Amount</p>
                                        <p className="text-sm font-bold text-violet-900">{getCurrencySymbol(currency)} {fmt(row.finalClaimAmount)}</p>
                                      </div>
                                    )}
                                    {activeStat === 'advance' && permissions.canUpdate && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); if (row.status !== 'Released') fetchReleaseVerificationData(row); }}
                                        disabled={row.status === 'Released' || releaseVerificationLoading}
                                        className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-lg transition-all shadow-sm uppercase tracking-tight ${
                                          row.status === 'Released'
                                            ? 'bg-green-600 text-white cursor-default opacity-80'
                                            : 'bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50'
                                        }`}
                                      >
                                        {row.status === 'Released' ? (
                                          <><CheckCircle className="w-3.5 h-3.5" /> Released</>
                                        ) : (
                                          <><Send className="w-3.5 h-3.5" /> Release</>
                                        )}
                                      </button>
                                    )}
                                    {activeStat === 'advance' && permissions.canDelete && row.status !== 'Released' && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); if (!(row.rejectionReason || row.rejectedFromReleaseRequested)) setRejectModal(row); }}
                                        disabled={!!(row.rejectionReason || row.rejectedFromReleaseRequested)}
                                        className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-bold rounded-lg transition-all shadow-sm uppercase tracking-tight ${
                                          (row.rejectionReason || row.rejectedFromReleaseRequested)
                                            ? 'bg-red-400 text-white cursor-default opacity-80'
                                            : 'bg-red-600 text-white hover:bg-red-700'
                                        }`}
                                      >
                                        {(row.rejectionReason || row.rejectedFromReleaseRequested) ? (
                                          <><XCircle className="w-3.5 h-3.5" /> Rejected</>
                                        ) : (
                                          <><XCircle className="w-3.5 h-3.5" /> Reject</>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-5 py-3 flex items-center justify-between shrink-0">
              <p className="text-[10px] text-gray-400">
                Showing {filteredRows.length} of {activeBucket.count}
              </p>
              <button
                onClick={() => setActiveStat(null)}
                className="px-5 py-2 bg-[#0d3b33] text-white rounded-lg hover:bg-[#0a2e27] text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ==================== CLAIM REVIEW MODAL (same as create-claim) ==================== */}
      {claimViewModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ margin: '1rem' }}>
            <div className="sticky top-0 bg-[#0d3b33] px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center"><Eye className="w-4 h-4 text-teal-200" /></div>
                <h2 className="text-base font-bold text-white">Claim Review</h2>
                {claimViewModal.invoiceNumber && <span className="text-[10px] font-mono text-teal-200/80 bg-white/10 px-2 py-0.5 rounded-full">{claimViewModal.invoiceNumber}</span>}
              </div>
              <div className="flex items-center gap-3">
                {(() => { const tag = getExpectedReleaseTag(claimViewModal); return tag ? (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold bg-white ${tag.cls}`}>
                    <tag.Icon className="w-3 h-3" />
                    {tag.label}
                  </span>
                ) : null; })()}
                <button onClick={() => { setClaimViewModal(null); setTextPreview(null); }} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              {/* Left sidebar */}
              <div className="w-full md:w-72 bg-[#0d3b33] text-white p-5 flex flex-col shrink-0 md:overflow-y-auto">
                <p className="text-xl font-bold truncate">{claimViewModal.patientFirstName} {claimViewModal.patientLastName}</p>
                <p className="text-xs text-teal-100/60 mt-0.5">{claimViewModal.patientMobileNumber || '-'}</p>
                <div className="mt-4 space-y-2 text-[11px]">
                  <div className="flex justify-between gap-2"><span className="text-teal-100/50">EMIR</span><span className="font-medium text-right truncate">{claimViewModal.emirNumber || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-teal-100/50">Department</span><span className="font-medium text-right truncate">{claimViewModal.departmentName || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-teal-100/50">Attending</span><span className="font-medium text-right truncate">{claimViewModal.doctorName || '-'}</span></div>
                  <div className="flex justify-between gap-2 items-center"><span className="text-teal-100/50">Urgency</span><span className="inline-flex items-center gap-1.5 font-medium"><span className={`w-1.5 h-1.5 rounded-full ${claimViewModal.urgency === 'High' ? 'bg-red-400' : claimViewModal.urgency === 'Priority' ? 'bg-amber-400' : 'bg-teal-400'}`} />{claimViewModal.urgency || 'Normal'}</span></div>
                </div>
                <div className="mt-5">
                  <p className="text-[10px] text-teal-100/50 uppercase tracking-wider">Claim amount</p>
                  <p className="text-2xl font-bold mt-0.5">{getCurrencySymbol(currency)} {(claimViewModal.finalClaimAmount || claimViewModal.claimAmount)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  {claimViewModal.coPayPercent != null && (
                    <>
                      <div className="h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
                        <div className="h-1.5 bg-teal-400 rounded-full" style={{ width: `${claimViewModal.coPayType === 'Insurer Pays' ? claimViewModal.coPayPercent : 100 - claimViewModal.coPayPercent}%` }} />
                      </div>
                      <p className="text-[10px] text-teal-300 mt-1.5">Patient {claimViewModal.coPayType === 'Insurer Pays' ? 100 - claimViewModal.coPayPercent : claimViewModal.coPayPercent}% · Insurer {claimViewModal.coPayType === 'Insurer Pays' ? claimViewModal.coPayPercent : 100 - claimViewModal.coPayPercent}%</p>
                    </>
                  )}
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded text-[10px] font-semibold ${claimViewModal.claimType === 'Advance' ? 'bg-amber-400/20 text-amber-300' : 'bg-blue-400/20 text-blue-300'}`}>{claimViewModal.claimType}</span>
                </div>
                <div className="my-4 border-t border-white/10" />
                <div className="space-y-2 text-[11px]">
                  <div className="flex justify-between gap-2"><span className="text-teal-100/50">Settlement</span><span className="font-medium text-right">{claimViewModal.advanceStatus || '-'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-teal-100/50">Paid to date</span><span className="font-medium text-right">{claimViewModal.advanceAmount ? `${getCurrencySymbol(currency)} ${claimViewModal.advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</span></div>
                  <div className="flex justify-between gap-2"><span className="text-teal-100/50">Available</span><span className="font-bold text-teal-300 text-right">{claimViewModal.patientId && availableByPatient[String(claimViewModal.patientId)] !== undefined ? `${getCurrencySymbol(currency)} ${Number(availableByPatient[String(claimViewModal.patientId)]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</span></div>
                  {claimViewModal.paymentMethod && <div className="flex justify-between gap-2"><span className="text-teal-100/50">Method</span><span className="font-medium text-right">{claimViewModal.paymentMethod}</span></div>}
                  {claimViewModal.transactionId && <div className="flex justify-between gap-2"><span className="text-teal-100/50">Trans ID</span><span className="font-mono text-[10px] text-teal-300 text-right truncate">{claimViewModal.transactionId}</span></div>}
                </div>
                <div className="my-4 border-t border-white/10" />
                <p className="text-[10px] text-teal-100/50">Created by {claimViewModal.createdByName || '-'}{claimViewModal.createdByRole ? ` · ${claimViewModal.createdByRole}` : ''}</p>
                <div className="flex-1" />
                <p className="text-[10px] text-teal-100/40 mt-3">Last updated {new Date(claimViewModal.updatedAt).toLocaleString()}</p>
              </div>
              {/* Right content */}
              <div className="flex-1 p-5 space-y-5 overflow-y-auto bg-white">

                {/* Insurance */}
                <section>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Insurance</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div><p className="text-[10px] text-gray-400">Provider</p><p className="text-[11px] font-semibold text-gray-900 truncate mt-0.5">{claimViewModal.insuranceProvider || '-'}</p></div>
                    <div><p className="text-[10px] text-gray-400">Policy number</p><p className="text-[11px] font-semibold text-gray-900 truncate mt-0.5">{claimViewModal.policyNumber || '-'}</p></div>
                    <div><p className="text-[10px] text-gray-400">Cover ends</p><p className="text-[11px] font-semibold text-gray-900 mt-0.5">{claimViewModal.expiryDate ? <>{new Date(claimViewModal.expiryDate).toLocaleDateString()}<span className="text-gray-400 font-medium"> · {(() => { const d = Math.round((new Date(claimViewModal.expiryDate).getTime() - Date.now()) / 86400000); return d > 0 ? `in ${d} day${d !== 1 ? "s" : ""}` : d === 0 ? "today" : "expired"; })()}</span></> : '-'}</p></div>
                  </div>
                </section>

                {/* Care given */}
                {(claimViewModal.diagnosis || claimViewModal.treatmentPlan || claimViewModal.services?.length > 0) && (
                  <section>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Care given</h4>
                    <div className="flex flex-wrap gap-2">
                      {claimViewModal.diagnosis && (
                        <button onClick={() => setTextPreview({ title: "Diagnosis", text: claimViewModal.diagnosis })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-teal-300 text-teal-700 text-[11px] font-medium hover:bg-teal-50 transition-colors">
                          <FileText className="w-3 h-3" /> Open diagnosis
                        </button>
                      )}
                      {claimViewModal.treatmentPlan && (
                        <button onClick={() => setTextPreview({ title: "Treatment Plan", text: claimViewModal.treatmentPlan })} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-purple-300 text-purple-700 text-[11px] font-medium hover:bg-purple-50 transition-colors">
                          <Activity className="w-3 h-3" /> Open treatment plan
                        </button>
                      )}
                    </div>
                    {claimViewModal.services?.length > 0 && (
                      <div className="mt-2.5">
                        <span className="text-[10px] text-gray-400">Services billed:</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {claimViewModal.services.map((s: any, i: number) => <span key={i} className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 text-[10px] font-medium">{s.serviceName}</span>)}
                        </div>
                      </div>
                    )}
                  </section>
                )}

                {/* Doctor adjustment */}
                {(claimViewModal.doctorAddedClaimAmount != null || claimViewModal.doctorAddedClaimNotes) && (
                  <section>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Doctor adjustment</h4>
                    <div className="border border-teal-100 bg-teal-50/60 rounded-xl p-3">
                      {claimViewModal.doctorAddedClaimAmount != null && (
                        <div className="flex justify-between text-[11px]"><span className="text-gray-500">Extra amount approved</span><span className="font-bold text-teal-700">{getCurrencySymbol(currency)} {Number(claimViewModal.doctorAddedClaimAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                      )}
                      {claimViewModal.doctorAddedClaimNotes && (
                        <p className={`text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap ${claimViewModal.doctorAddedClaimAmount != null ? "mt-1.5 border-t border-teal-100 pt-1.5" : ""}`}>{claimViewModal.doctorAddedClaimNotes}</p>
                      )}
                    </div>
                  </section>
                )}

                {/* Claim history */}
                {(patientHistoryLoading || patientHistory.length > 0) && (
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Claim history</h4>
                      <span className="text-[10px] text-gray-400">{patientHistoryLoading ? "Loading…" : `${patientHistory.length} earlier claim${patientHistory.length !== 1 ? "s" : ""}`}</span>
                    </div>
                    {patientHistoryLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-teal-600" /></div>
                    ) : (
                      <div className="divide-y divide-gray-100 max-h-56 overflow-y-auto border border-gray-100 rounded-xl p-3 bg-gray-50">
                        {patientHistory.map((prev) => (
                          <div key={prev._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${prev.status === "Approved" ? "bg-green-500" : prev.status === "Rejected" ? "bg-red-500" : prev.status === "Released" ? "bg-blue-500" : prev.status === "Ready" ? "bg-indigo-500" : prev.status === "Completed" ? "bg-purple-500" : "bg-yellow-400"}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${prev.status === "Approved" ? "bg-green-50 text-green-700" : prev.status === "Rejected" ? "bg-red-50 text-red-700" : prev.status === "Released" ? "bg-blue-50 text-blue-700" : prev.status === "Ready" ? "bg-indigo-50 text-indigo-700" : prev.status === "Completed" ? "bg-purple-50 text-purple-700" : "bg-yellow-50 text-yellow-700"}`}>{prev.status}</span>
                                <span className="text-[10px] font-medium text-gray-400 uppercase">{prev.claimType}</span>
                              </div>
                              <p className="text-[11px] font-medium text-gray-700 mt-0.5 truncate">{prev.insuranceProvider}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5 truncate">{prev.doctorName || "—"} · {prev.departmentName || "—"} · {getCurrencySymbol(currency)}{prev.claimAmount?.toLocaleString()}</p>
                            </div>
                            <p className="text-[10px] text-gray-400 shrink-0">{new Date(prev.createdAt).toLocaleDateString()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Attachments */}
                <section>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Attachments</h4>
                  {(() => {
                    const rows: { label: string; url: string }[] = [];
                    if (claimViewModal.insuranceCardFile) rows.push({ label: "Insurance card", url: claimViewModal.insuranceCardFile });
                    if (claimViewModal.tableOfBenefitsFile) rows.push({ label: "Benefits table", url: claimViewModal.tableOfBenefitsFile });
                    if (claimViewModal.emriFrontPhoto) rows.push({ label: "EMIR front", url: claimViewModal.emriFrontPhoto });
                    if (claimViewModal.emriBackPhoto) rows.push({ label: "EMIR back", url: claimViewModal.emriBackPhoto });
                    if (claimViewModal.attachment) rows.push({ label: "Payment attachment", url: claimViewModal.attachment });
                    (claimViewModal.documentFiles || []).forEach((f: string, i: number) => rows.push({ label: `Doc ${i + 1}`, url: f }));
                    if (rows.length === 0) return <p className="text-[11px] text-gray-400">No files uploaded</p>;
                    const isImg = (url: string) => ["jpg", "jpeg", "png", "webp", "gif"].includes((url.split("?")[0].split(".").pop() || "").toLowerCase());
                    const uploaded = new Date(claimViewModal.createdAt).toLocaleDateString();
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {rows.map((r, i) => (
                          <div key={i} className="flex items-center gap-2.5 bg-white rounded-xl p-2.5 border border-gray-200">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">{isImg(r.url) ? <FileImage className="w-4 h-4 text-gray-500" /> : <FileText className="w-4 h-4 text-gray-500" />}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-gray-800 truncate">{r.label}</p>
                              <p className="text-[10px] text-gray-400">Uploaded {uploaded}</p>
                            </div>
                            <button onClick={() => setDocViewerUrl(r.url)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg shrink-0"><Eye className="w-3.5 h-3.5" /></button>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </section>

                {claimViewModal.notes && (
                  <section>
                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Notes</h4>
                    <p className="text-[11px] text-gray-600 leading-relaxed border border-gray-100 rounded-xl p-3 bg-gray-50">{claimViewModal.notes}</p>
                  </section>
                )}

                {/* Administrative */}
                <section>
                  <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Administrative</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-[10px]">
                    <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Created</span><span className="font-medium">{new Date(claimViewModal.createdAt).toLocaleString()}</span></div>
                    <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Status</span><span className="font-medium">{claimViewModal.status || 'Under Review'}</span></div>
                    <div className="flex justify-between border-b border-gray-100 pb-1"><span className="text-gray-500">Claim type</span><span className="font-medium">{claimViewModal.claimType}</span></div>
                  </div>
                </section>
              </div>
            </div>
            {/* Footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-end flex-shrink-0">
              <button onClick={() => { setClaimViewModal(null); setTextPreview(null); }} className="px-5 py-2 bg-[#0d3b33] text-white rounded-lg hover:bg-[#0a2e27] text-xs font-semibold transition-colors">Close</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ==================== CLAIM TRACKING MODAL (same as create-claim) ==================== */}
      {claimTrackingModal && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" style={{ margin: '1rem' }}>
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Activity className="w-5 h-5 text-white" /></div>
                <div><h2 className="text-lg font-bold text-white">Claim Tracking</h2><p className="text-xs text-white/80">Approval & rejection history</p></div>
              </div>
              <button onClick={() => setClaimTrackingModal(null)} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="relative">
                <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-100"></div>
                <div className="space-y-6">
                  {(() => {
                    const ctm = claimTrackingModal || {};
                    const steps: any[] = [];
                    if (ctm.createdAt) steps.push({ type: "created", date: ctm.createdAt, title: "Claim Created", reviewer: ctm.createdByName, role: ctm.createdByRole || "Staff", content: <p className="text-xs text-purple-700">Amount: <strong>{ctm.claimAmount?.toLocaleString()}</strong> · Type: {ctm.claimType}</p> });
                    if (ctm.rejectedFromPassClaims) steps.push({ type: "rejectPass", date: ctm.rejectedFromPassClaimsAt, title: "Rejected from Pass Claims", reviewer: ctm.rejectedFromPassClaimsByName, role: ctm.rejectedFromPassClaimsByRole });
                    if (ctm.approvedAt) steps.push({ type: "approved", date: ctm.approvedAt, title: "Approved by Doctor", reviewer: ctm.approvedByName, role: ctm.approvedByRole });
                    if (ctm.rejectedAt) steps.push({ type: "rejected", date: ctm.rejectedAt, title: "Rejected", reviewer: ctm.rejectedByName, role: ctm.rejectedByRole });
                    if (ctm.readyAt) steps.push({ type: "ready", date: ctm.readyAt, title: "Checked by Finance", reviewer: ctm.readyByName, role: ctm.readyByRole });
                    if (ctm.completedAt) steps.push({ type: "completed", date: ctm.completedAt, title: "Completed", reviewer: ctm.completedByName, role: ctm.completedByRole });
                    if (ctm.releasedAt) steps.push({ type: "released", date: ctm.releasedAt, title: "Released", reviewer: ctm.releasedByName, role: ctm.releasedByRole });
                    if (ctm.rejectedFromReleaseRequested) steps.push({ type: "rejectRelease", date: ctm.rejectedFromReleaseRequestedAt, title: "Rejected from Release", reviewer: ctm.rejectedFromReleaseRequestedByName, role: ctm.rejectedFromReleaseRequestedByRole });
                    steps.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    const iconMap: Record<string, React.ReactNode> = { approved: <CheckCircle className="w-4 h-4 text-green-600" />, rejected: <X className="w-4 h-4 text-red-600" />, rejectPass: <AlertCircle className="w-4 h-4 text-orange-600" />, rejectRelease: <AlertCircle className="w-4 h-4 text-orange-600" />, ready: <CheckCircle className="w-4 h-4 text-indigo-600" />, released: <CheckCircle className="w-4 h-4 text-blue-600" />, completed: <CheckCircle className="w-4 h-4 text-purple-600" />, created: <FileText className="w-4 h-4 text-purple-600" /> };
                    const bgMap: Record<string, string> = { approved: "bg-green-100", rejected: "bg-red-100", rejectPass: "bg-orange-100", rejectRelease: "bg-orange-100", ready: "bg-indigo-100", released: "bg-blue-100", completed: "bg-purple-100", created: "bg-purple-100" };
                    const badgeMap: Record<string, string> = { approved: "text-green-600 bg-green-50", rejected: "text-red-600 bg-red-50", rejectPass: "text-orange-600 bg-orange-50", rejectRelease: "text-orange-600 bg-orange-50", ready: "text-indigo-600 bg-indigo-50", released: "text-blue-600 bg-blue-50", completed: "text-purple-600 bg-purple-50", created: "text-purple-600 bg-purple-50" };
                    return steps.length === 0 ? (<div className="flex flex-col items-center py-12 text-center"><Activity className="w-12 h-12 text-gray-200 mb-4" /><p className="text-gray-500">No tracking history</p></div>) : (steps.map((step, idx) => (
                      <div key={step.type} className="flex gap-4 group">
                        <div className={`relative z-10 w-8 h-8 rounded-full ${bgMap[step.type]} border-4 border-white flex items-center justify-center shadow-sm`}>{iconMap[step.type]}</div>
                        <div className="flex-1 pt-0.5">
                          <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-2"><h4 className="text-sm font-bold text-gray-900">{step.title}</h4><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${badgeMap[step.type]}`}>Step {idx + 1}</span></div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className="flex items-center gap-1.5"><User className="w-3 h-3 text-gray-400" /><span className="text-gray-500">By:</span> <span className="font-semibold">{step.reviewer || "N/A"}</span></div>
                              <div className="flex items-center gap-1.5"><Clock className="w-3 h-3 text-gray-400" /><span className="text-gray-500">Date:</span> <span className="font-semibold">{step.date ? new Date(step.date).toLocaleString() : "N/A"}</span></div>
                            </div>
                            {step.content}
                          </div>
                        </div>
                      </div>
                    )));
                  })()}
                  <div className="relative flex items-start gap-4">
                    <div className="relative z-10 w-12 h-12 rounded-full bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center shadow-lg"><AlertCircle className="w-5 h-5 text-white" /></div>
                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 ml-2">
                      <h3 className="text-sm font-bold text-gray-900 mb-2">Current Status</h3>
                      {(() => { const ctm = claimTrackingModal || {}; const events: { date: string; status: string }[] = []; if (ctm.rejectedFromReleaseRequestedAt) events.push({ date: ctm.rejectedFromReleaseRequestedAt, status: 'Rejected' }); if (ctm.rejectedFromPassClaimsAt) events.push({ date: ctm.rejectedFromPassClaimsAt, status: 'Rejected' }); if (ctm.approvedAt) events.push({ date: ctm.approvedAt, status: 'Approved' }); if (ctm.rejectedAt) events.push({ date: ctm.rejectedAt, status: 'Rejected' }); if (ctm.releasedAt) events.push({ date: ctm.releasedAt, status: 'Released' }); if (ctm.completedAt) events.push({ date: ctm.completedAt, status: 'Completed' }); if (ctm.readyAt) events.push({ date: ctm.readyAt, status: 'Ready' }); events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); const s = events.length > 0 ? events[0].status : (ctm.status || 'Under Review'); return <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold border ${s === 'Under Review' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : s === 'Approved' ? 'bg-green-100 text-green-800 border-green-300' : s === 'Rejected' ? 'bg-red-100 text-red-800 border-red-300' : s === 'Ready' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : s === 'Completed' ? 'bg-purple-100 text-purple-800 border-purple-300' : s === 'Released' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>{s}</span>; })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end flex-shrink-0"><button onClick={() => setClaimTrackingModal(null)} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-sm font-medium">Close</button></div>
          </div>
        </div>
      , document.body)}

      {/* Text Preview Modal (Diagnosis / Treatment Plan) */}
      {textPreview && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col" style={{ margin: '1rem' }}>
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center"><FileText className="w-4 h-4 text-teal-700" /></div>
                <div><h2 className="text-base font-bold text-gray-900">{textPreview.title}</h2><p className="text-[10px] text-gray-400">Clinical details</p></div>
              </div>
              <button onClick={() => setTextPreview(null)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{textPreview.text || "No details provided."}</p>
            </div>
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-3 flex justify-end flex-shrink-0">
              <button onClick={() => setTextPreview(null)} className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 text-xs font-medium">Close</button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ==================== CLAIM CREDIT TRANSFER MODAL (ported from create-claim) ==================== */}
      {creditModalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" style={{ margin: '1rem' }}>
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center"><ArrowLeftRight className="w-4 h-4 text-teal-700" /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Claim Credit Transfer</h2>
                  <p className="text-[10px] text-gray-400">
                    {creditStep === 1 && "Step 1 of 4 — Search source patient"}
                    {creditStep === 2 && "Step 2 of 4 — Source patient details"}
                    {creditStep === 3 && "Step 3 of 4 — Search destination patient"}
                    {creditStep === 4 && "Step 4 of 4 — Transfer summary"}
                  </p>
                </div>
              </div>
              <button onClick={closeCreditModal} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {/* Progress bar */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center">
                {[1, 2, 3, 4].map((s, idx) => (
                  <React.Fragment key={s}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${creditStep > s ? 'bg-teal-600 text-white' : creditStep === s ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                      {creditStep > s ? <CheckCircle className="w-3.5 h-3.5" /> : s}
                    </div>
                    {idx < 3 && <div className={`flex-1 h-0.5 mx-1 ${creditStep > s ? 'bg-teal-600' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* ===== STEP 1 & 3: Search patient (source / destination) ===== */}
              {(creditStep === 1 || creditStep === 3) && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{creditStep === 1 ? "Find the source patient" : "Find the destination patient"}</h3>
                    <p className="text-sm text-gray-500">{creditStep === 1 ? "Search and select the patient whose claim credit you want to review." : "Search and select the patient to whom the credit will be transferred."}</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={creditSearchQuery} onChange={(e) => searchCreditPatients(e.target.value)} placeholder="Search by patient name, MRN or phone..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900" />
                    {creditSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                  {creditSearchResults.length > 0 && (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {creditSearchResults
                        .filter((p: any) => creditStep === 3 ? p._id !== sourcePatient?._id : true)
                        .map((p: any) => {
                          const initials = `${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase();
                          return (
                            <button key={p._id} onClick={() => creditStep === 1 ? selectSourcePatient(p) : selectDestPatient(p)} className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center text-sm font-bold">{initials}</div>
                                <div>
                                  <div className="text-sm font-semibold text-gray-900">{p.firstName} {p.lastName}</div>
                                  <div className="text-xs text-gray-500">MRN-{p.emrNumber || 'N/A'} · {p.mobileNumber || 'No phone'}</div>
                                </div>
                              </div>
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </button>
                          );
                        })}
                    </div>
                  )}
                  {creditSearchQuery && !creditSearching && creditSearchResults.filter((p: any) => creditStep === 3 ? p._id !== sourcePatient?._id : true).length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No patients found</p>
                  )}
                </div>
              )}

              {/* ===== STEP 2: Source patient details + usage ===== */}
              {creditStep === 2 && sourcePatient && (
                <div className="space-y-4">
                  {/* Patient detail — full */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><User className="w-4 h-4 text-teal-600" /> Patient Details</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Name</p><p className="text-sm font-semibold text-gray-900">{sourcePatient.firstName} {sourcePatient.lastName}</p></div>
                      <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Gender</p><p className="text-sm font-semibold text-gray-900">{sourcePatient.gender || 'N/A'}</p></div>
                      <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">EMR Number</p><p className="text-sm font-semibold text-gray-900">{sourcePatient.emrNumber || 'N/A'}</p></div>
                      <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Phone</p><p className="text-sm font-semibold text-gray-900">{sourcePatient.mobileNumber || 'N/A'}</p></div>
                      <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Email</p><p className="text-sm font-semibold text-gray-900">{sourcePatient.email || 'N/A'}</p></div>
                    </div>
                  </div>

                  {/* Insurance detail — from released claims */}
                  {usageLoading ? (
                    <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-teal-600"></div></div>
                  ) : (
                    <>
                      {sourceUsage?.claims?.length > 0 ? (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Shield className="w-4 h-4 text-teal-600" /> Insurance Details</h4>
                          <div className="space-y-3">
                            {sourceUsage.claims.map((c: any) => (
                              <div key={c._id} className="bg-white rounded-lg p-3 border border-gray-100">
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Provider</p><p className="text-xs font-semibold text-gray-900">{c.insuranceProvider || '-'}</p></div>
                                  <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Department</p><p className="text-xs font-semibold text-gray-900">{c.departmentName || '-'}</p></div>
                                  <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Doctor</p><p className="text-xs font-semibold text-gray-900">{c.doctorName || '-'}</p></div>
                                  <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Claim Amount</p><p className="text-xs font-bold text-teal-700">{formatAED(c.claimAmount || 0)}</p></div>
                                  <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Type</p><p className="text-xs font-semibold text-gray-900">{c.claimType || '-'}</p></div>
                                  <div><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Released</p><p className="text-xs font-semibold text-gray-900">{c.releasedAt ? new Date(c.releasedAt).toLocaleDateString() : '-'}</p></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <p className="text-sm text-amber-800">No released insurance claims found for this patient.</p>
                        </div>
                      )}

                      {/* Claim usage — from Billing model */}
                      {sourceUsage && (
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                          <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><Wallet className="w-4 h-4 text-teal-600" /> Claim Credit Usage</h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white rounded-lg p-3 border border-gray-100 text-center"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Total Released</p><p className="text-sm font-bold text-gray-900">{formatAED(sourceUsage.totalReleasedClaimAmount || 0)}</p></div>
                            <div className="bg-white rounded-lg p-3 border border-gray-100 text-center"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Used (Billings)</p><p className="text-sm font-bold text-orange-600">{formatAED(sourceUsage.totalClaimAmountUsed || 0)}</p></div>
                            <div className="bg-white rounded-lg p-3 border border-teal-200 text-center"><p className="text-[10px] font-bold text-teal-600 uppercase mb-1">Remaining</p><p className="text-sm font-bold text-teal-700">{formatAED(sourceUsage.remainingClaimAmount || 0)}</p></div>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ===== STEP 4: Transfer summary ===== */}
              {creditStep === 4 && sourcePatient && destPatient && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Transfer Summary</h3>
                    <p className="text-sm text-gray-500">Review the credit usage and destination details below.</p>
                  </div>

                  {/* Source patient — credit usage */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><ArrowLeftRight className="w-4 h-4 text-teal-600" /> Source — {sourcePatient.firstName} {sourcePatient.lastName}</h4>
                    {usageLoading ? (
                      <div className="flex justify-center py-4"><div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-teal-600"></div></div>
                    ) : sourceUsage ? (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white rounded-lg p-3 border border-gray-100 text-center"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Current Paid</p><p className="text-sm font-bold text-gray-900">{formatAED(sourceUsage.totalReleasedClaimAmount || 0)}</p></div>
                        <div className="bg-white rounded-lg p-3 border border-gray-100 text-center"><p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Used</p><p className="text-sm font-bold text-orange-600">{formatAED(sourceUsage.totalClaimAmountUsed || 0)}</p></div>
                        <div className="bg-white rounded-lg p-3 border border-teal-200 text-center"><p className="text-[10px] font-bold text-teal-600 uppercase mb-1">Remaining</p><p className="text-sm font-bold text-teal-700">{formatAED(sourceUsage.remainingClaimAmount || 0)}</p></div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500">Unable to load claim usage.</p>
                    )}
                  </div>

                  {/* Destination patient — gender first letter, dept/doctor of insurance, remaining */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2"><User className="w-4 h-4 text-teal-600" /> Destination — {destPatient.firstName} {destPatient.lastName}</h4>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold">{(destPatient.gender || 'N/A').charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{destPatient.firstName} {destPatient.lastName}</p>
                        <p className="text-xs text-gray-500">MRN-{destPatient.emrNumber || 'N/A'}</p>
                      </div>
                    </div>
                    {destUsage?.claims?.length > 0 ? (
                      <div className="space-y-2 mb-3">
                        {destUsage.claims.map((c: any) => (
                          <div key={c._id} className="bg-white rounded-lg p-3 border border-gray-100 flex flex-wrap items-center gap-x-6 gap-y-1">
                            <span className="text-xs font-semibold text-gray-900">{c.insuranceProvider || '-'}</span>
                            <span className="text-xs text-gray-500">Dept: <span className="font-medium text-gray-800">{c.departmentName || '-'}</span></span>
                            <span className="text-xs text-gray-500">Doctor: <span className="font-medium text-gray-800">{c.doctorName || '-'}</span></span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-500 mb-3">No released insurance claims found for the destination patient.</p>
                    )}
                    {destUsage && (
                      <div className="bg-white rounded-lg p-3 border border-teal-200 inline-block">
                        <p className="text-[10px] font-bold text-teal-600 uppercase mb-1">Remaining Claim Amount</p>
                        <p className="text-sm font-bold text-teal-700">{formatAED(destUsage.remainingClaimAmount || 0)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
              {creditStep === 1 && (
                <button onClick={closeCreditModal} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /> Cancel</button>
              )}
              {creditStep === 2 && (
                <button onClick={() => setCreditStep(1)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /> Back</button>
              )}
              {creditStep === 3 && (
                <button onClick={() => setCreditStep(2)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /> Back</button>
              )}
              {creditStep === 4 && (
                <button onClick={() => setCreditStep(3)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors"><ChevronLeft className="w-4 h-4" /> Back</button>
              )}

              <div className="flex items-center gap-2">
                {creditStep === 2 && (
                  <button onClick={startTransfer} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {creditStep === 4 && (
                  <button onClick={openTransferModal} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                    <ArrowLeftRight className="w-4 h-4" /> Transfer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ===== TRANSFER AMOUNT POPUP (source → destination) ===== */}
      {transferModalOpen && sourcePatient && destPatient && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ margin: '1rem' }}>
            {/* Popup header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center"><ArrowLeftRight className="w-4 h-4 text-teal-700" /></div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Transfer Claim Credit</h2>
                  <p className="text-[10px] text-gray-400">Enter the amount to move from source to destination</p>
                </div>
              </div>
              <button onClick={closeTransferModal} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            <div className="p-6 space-y-5">
              {/* Source → arrow → Destination (remaining balances as plain text, no background/border) */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Source</p>
                  <p className="text-sm font-semibold text-gray-900">{sourcePatient.firstName} {sourcePatient.lastName}</p>
                  <p className="text-xs text-gray-500 mb-1">MRN-{sourcePatient.emrNumber || 'N/A'}</p>
                  <p className="text-xl font-bold text-gray-900">{formatAED(sourceUsage?.remainingClaimAmount || 0)}</p>
                  <p className="text-[10px] text-gray-400">remaining claim balance</p>
                </div>
                <div className="flex-shrink-0 pt-6 text-gray-400">
                  <MoveRight className="w-12 h-12" />
                </div>
                <div className="flex-1 text-right">
                  <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">Destination</p>
                  <p className="text-sm font-semibold text-gray-900">{destPatient.firstName} {destPatient.lastName}</p>
                  <p className="text-xs text-gray-500 mb-1">MRN-{destPatient.emrNumber || 'N/A'}</p>
                  <p className="text-xl font-bold text-gray-900">{formatAED(destUsage?.remainingClaimAmount || 0)}</p>
                  <p className="text-[10px] text-gray-400">remaining claim balance</p>
                </div>
              </div>

              {/* Amount input */}
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Amount to transfer</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.00"
                  className="w-full px-4 py-3 text-lg font-semibold border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900"
                />
                <button
                  type="button"
                  onClick={() => setTransferAmount(String(sourceUsage?.remainingClaimAmount || ""))}
                  className="mt-1 text-xs text-teal-600 hover:text-teal-700 font-medium"
                >
                  Transfer full balance
                </button>
              </div>

              {transferError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{transferError}</p>
                </div>
              )}
            </div>

            {/* Popup footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
              <button onClick={closeTransferModal} disabled={transferring} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"><X className="w-4 h-4" /> Cancel</button>
              <button onClick={goToConfirm} disabled={!transferAmount || transferring} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <ArrowLeftRight className="w-4 h-4" /> Transfer
              </button>
            </div>
          </div>
        </div>
      , document.body)}

      {/* ===== TRANSFER CONFIRMATION POPUP ===== */}
      {confirmModalOpen && sourcePatient && destPatient && createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" style={{ margin: '1rem' }}>
            {/* Popup header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
                  {transferSuccess ? <CheckCircle className="w-4 h-4 text-teal-700" /> : <AlertTriangle className="w-4 h-4 text-teal-700" />}
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">{transferSuccess ? "Transfer Completed" : "Confirm Transfer"}</h2>
                  <p className="text-[10px] text-gray-400">{transferSuccess ? `Reference ${transferSuccess.transferNumber || ""}` : "Review the details before submitting"}</p>
                </div>
              </div>
              {!transferring && (
                <button onClick={() => transferSuccess ? closeAllTransferModals() : setConfirmModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
              )}
            </div>

            <div className="p-6 space-y-4">
              {transferSuccess ? (
                /* ----- Success state ----- */
                <div className="space-y-4">
                  <div className="text-center py-2">
                    <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center mx-auto mb-3"><CheckCircle className="w-7 h-7 text-teal-600" /></div>
                    <p className="text-sm text-gray-600">{formatAED(Number(transferAmount))} has been transferred successfully.</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm border-b border-gray-100 pb-2"><span className="text-gray-500">Source — {sourcePatient.firstName} {sourcePatient.lastName}</span><span className="font-bold text-gray-900">{formatAED(transferSuccess.sourceRemaining)}</span></div>
                    <div className="flex justify-between text-sm pb-1"><span className="text-gray-500">Destination — {destPatient.firstName} {destPatient.lastName}</span><span className="font-bold text-gray-900">{formatAED(transferSuccess.destRemaining)}</span></div>
                  </div>
                </div>
              ) : (
                /* ----- Confirmation form ----- */
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                    <div>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Source Patient</p>
                      <p className="text-sm font-semibold text-gray-900">{sourcePatient.firstName} {sourcePatient.lastName}</p>
                      <p className="text-xs text-gray-500">MRN-{sourcePatient.emrNumber || 'N/A'}</p>
                    </div>
                    <MoveRight className="w-6 h-6 text-gray-400 flex-shrink-0" />
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-gray-400 uppercase">Destination Patient</p>
                      <p className="text-sm font-semibold text-gray-900">{destPatient.firstName} {destPatient.lastName}</p>
                      <p className="text-xs text-gray-500">MRN-{destPatient.emrNumber || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-gray-50 rounded-lg px-4 py-3">
                    <span className="text-sm text-gray-500">Transfer claim amount</span>
                    <span className="text-lg font-bold text-gray-900">{formatAED(Number(transferAmount) || 0)}</span>
                  </div>
                  {transferError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-sm text-red-700">{transferError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Popup footer */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
              {transferSuccess ? (
                <button onClick={closeAllTransferModals} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-gray-700 hover:bg-gray-800 rounded-lg transition-colors ml-auto">
                  <CheckCircle className="w-4 h-4" /> Done
                </button>
              ) : (
                <>
                  <button onClick={() => { if (!transferring) setConfirmModalOpen(false); }} disabled={transferring} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"><ChevronLeft className="w-4 h-4" /> Back</button>
                  <button onClick={submitTransfer} disabled={transferring} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {transferring ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Submit
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Document Viewer */}
      {docViewerUrl && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/90 backdrop-blur-md" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="absolute top-4 right-4 z-20"><button onClick={() => setDocViewerUrl(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"><X className="w-6 h-6" /></button></div>
          <div className="w-full max-w-5xl h-[85vh] flex items-center justify-center">
            {docViewerUrl.toLowerCase().endsWith('.pdf') ? <iframe src={docViewerUrl} className="w-full h-full rounded-lg shadow-2xl bg-white" title="Document Preview" /> : <img src={docViewerUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />}
          </div>
        </div>
      , document.body)}

      {/* Release Success Message */}
      {releaseSuccessMsg && createPortal(
        <div className="fixed top-4 right-4 z-[10000] animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2 bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm font-semibold">{releaseSuccessMsg}</span>
            <button onClick={() => setReleaseSuccessMsg("")} className="ml-2 p-0.5 hover:bg-white/20 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      , document.body)}

      {/* Release Verification Modal */}
      {releaseModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-3 sm:p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-200">
            <div className="px-4 sm:px-5 py-3 border-b border-teal-100 bg-teal-50/50 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-base font-bold text-teal-900 flex items-center gap-2">
                <Send className="w-5 h-5" /> Release Claim Verification
              </h2>
              <button onClick={() => setReleaseModal(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {releaseVerificationLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-4"></div>
                  <p className="text-sm text-gray-500 font-medium">Fetching verification data...</p>
                </div>
              ) : (
                <>
                  {/* Claim Summary */}
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Patient</p>
                        <p className="text-sm font-bold text-gray-900">{releaseModal.patientName}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Amount</p>
                        <p className="text-sm font-bold text-teal-600">{getCurrencySymbol(currency)}{Number(releaseModal.claimAmount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Insurance</p>
                        <p className="text-xs font-semibold text-gray-900">{releaseModal.insuranceProvider}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Policy #</p>
                        <p className="text-xs font-semibold text-gray-900">{releaseModal.policyNumber || '—'}</p>
                      </div>
                    </div>
                  </div>

                  {/* Appointments with Progress Notes & Consent */}
                  {existingAppointments.length === 0 ? (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs font-bold text-yellow-800 flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> No appointments found after claim creation
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {existingAppointments.map((apt: any, idx: number) => {
                        const aptNotes = (progressStatus?.notes || []).filter(
                          (n: any) => (n.appointmentId?.toString() || n.appointmentId) === apt._id
                        );
                        const aptConsent = consentStatus?.consentByAppointment?.find((c: any) => c.appointmentId === apt._id);

                        return (
                          <div key={apt._id || idx} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                            <p className="text-[11px] font-bold text-gray-900 mb-2 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-blue-600" />
                              Appointment: {new Date(apt.startDate).toLocaleDateString()} ({apt.status})
                            </p>
                            {/* Progress Notes */}
                            <div className="ml-2 mb-2">
                              <p className="text-[10px] font-semibold text-gray-700 mb-1">Progress Notes:</p>
                              {aptNotes.length > 0 ? (
                                aptNotes.map((note: any, nIdx: number) => (
                                  <p key={nIdx} className="text-[10px] text-gray-600 ml-2">
                                    ✓ {note.note || note.description || "Progress note recorded"}
                                  </p>
                                ))
                              ) : (
                                <p className="text-[10px] text-yellow-700 ml-2 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> No progress note
                                </p>
                              )}
                            </div>
                            {/* Consent Form */}
                            <div className="ml-2">
                              <p className="text-[10px] font-semibold text-gray-700 mb-1">Consent Form:</p>
                              {aptConsent ? (
                                <div className="flex items-center justify-between ml-2">
                                  <p className="text-[10px] text-gray-600">{aptConsent.consentFormName || "Consent Form"}</p>
                                  {aptConsent.isSigned ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-800">
                                      <CheckCircle className="w-3 h-3" /> Signed
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-800">
                                      <XCircle className="w-3 h-3" /> Missing
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[10px] text-red-700 ml-2 flex items-center gap-1">
                                  <AlertCircle className="w-3 h-3" /> No consent form
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Warnings */}
                  {existingAppointments.length > 0 && (
                    <div className="space-y-2">
                      {progressStatus && !progressStatus.hasProgress && (
                        <div className="p-2 rounded-lg bg-yellow-50 border border-yellow-200">
                          <p className="text-[11px] font-medium text-yellow-800 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> Progress note missing for some appointments
                          </p>
                        </div>
                      )}
                      {consentStatus && !consentStatus.allSigned && (
                        <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                          <p className="text-[11px] font-medium text-red-800 flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" /> Consent form missing or not signed for some appointments
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setReleaseModal(null)} className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">Cancel</button>
                    <button onClick={handleReleaseClaim} disabled={releaseActionLoading} className="flex-1 px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50">
                      {releaseActionLoading ? "Processing..." : "Confirm Release"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      , document.body)}

      {/* Reject Claim Modal */}
      {rejectModal && createPortal(
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[10000] p-3 sm:p-4" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200">
            <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-red-100 bg-red-50 flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-red-900 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Reject Claim
              </h2>
              <button onClick={() => { setRejectModal(null); setRejectionNote(""); }} className="p-2 hover:bg-red-100/50 rounded-xl transition-colors">
                <X className="w-5 h-5 text-red-600" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-gray-50 rounded-xl p-3 sm:p-4 border border-gray-100">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Patient</p>
                  <p className="text-sm font-bold text-gray-900">{rejectModal.patientName}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase">Doctor</p>
                  <p className="text-sm font-bold text-gray-900">{rejectModal.doctorName || '—'}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-900 mb-2">Rejection Note <span className="text-red-600">*</span></label>
                <textarea
                  value={rejectionNote}
                  onChange={(e) => setRejectionNote(e.target.value)}
                  placeholder="Explain why this claim is being rejected..."
                  rows={4}
                  className="w-full px-4 py-3 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent outline-none transition-all resize-none bg-gray-50/50"
                  required
                />
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button onClick={() => { setRejectModal(null); setRejectionNote(""); }} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition-all">Cancel</button>
                <button onClick={handleRejectClaim} disabled={rejectActionLoading || !rejectionNote.trim()} className="flex-[2] px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50">
                  {rejectActionLoading ? "Processing..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          </div>
        </div>
      , document.body)}
    </div>
  );
}

ClaimManagementPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedClaimManagementPage = withClinicAuth(ClaimManagementPage) as typeof ClaimManagementPage;
ProtectedClaimManagementPage.getLayout = ClaimManagementPage.getLayout;

export default ProtectedClaimManagementPage;

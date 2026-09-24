import React, { useState, useEffect } from 'react';
// import { useRouter } from 'next/router';
import { createPortal } from 'react-dom';
import axios from 'axios';
import {
  Shield, X, FileImage, FileText, Loader2, Paperclip,
  Calculator, Info, CheckCircle, Eye, Activity, Trash2,
  User, Clock, AlertCircle, ClipboardList, ChevronRight, ChevronLeft,
  Search, Upload, AlertTriangle, Plus, ArrowLeftRight, Wallet, MoveRight,
  CalendarClock, Filter
} from 'lucide-react';
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { getCurrencySymbol } from '@/lib/currencyHelper';
import { useCurrency } from '@/context/CurrencyContext';

const TOKEN_PRIORITY = ["clinicToken", "doctorToken", "agentToken", "staffToken", "userToken", "adminToken"];

// Permission constants for create_claim module
const CLAIM_MODULE_KEY = "create_claim";
// The create_claim permission can live as a standalone top-level module OR as a
// submodule inside the "claims" parent module — match both possible parents.
const CLAIM_PARENT_MODULE_KEYS = ["claims", "create_claim"];

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

const findClaimModule = (permissionsList: any[]) =>
  permissionsList.find((p: any) => {
    if (!p?.module) return false;
    const mod = String(p.module).toLowerCase();
    return CLAIM_PARENT_MODULE_KEYS.includes(mod);
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

const getNormalizedEntityId = (value: any) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return String(value._id || value.id || "");
  return String(value);
};

const STEPS = [
  { id: 1, label: "Patient & Insurance" },
  { id: 2, label: "Insurance Details" },
  { id: 3, label: "Confirmation" },
  { id: 4, label: "Claim Source" },
  { id: 5, label: "Payment Details" },
  { id: 6, label: "Submit" },
];

function CreateClaimPage() {
  // const router = useRouter();
  const { currency } = useCurrency();

  // Modal & step state
  const [modalOpen, setModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Patient search (Step 1)
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [prefilledFromClaim, setPrefilledFromClaim] = useState<any>(null);
  const [prefillLoading, setPrefillLoading] = useState(false);

  // Insurance details (Step 2)
  const [insuranceForm, setInsuranceForm] = useState<any>({
    insuranceProvider: "",
    policyNumber: "",
    expiryDate: "",
    insuranceCardFile: "",
    tableOfBenefitsFile: "",
    emriFrontPhoto: "",
    emriBackPhoto: "",
    urgency: "Normal",
    emirNumber: "",
    diagnosis: "",
  });

  // Claim source (Step 4)
  const [claimSourceForm, setClaimSourceForm] = useState<any>({
    departmentId: "",
    departmentName: "",
    serviceId: "",
    serviceName: "",
    services: [],
    doctorId: "",
    doctorName: "",
  });

  // Payment details (Step 5)
  const [paymentForm, setPaymentForm] = useState<any>({
    claimAmount: "",
    claimType: "Paid",
    coPayPercent: "",
    coPayType: "Patient Pays",
    notes: "",
    documentFiles: [],
    advanceStatus: "Full Pay",
    advanceAmount: 0,
    transactionId: "",
    attachment: "",
    paymentMethod: "",
    paymentMethods: [] as Array<{ method: string; amount: number }>,
  });

  // Dropdowns
  const [departments, setDepartments] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);

  // File upload state
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Document viewer
  const [docViewerUrl, setDocViewerUrl] = useState<string | null>(null);

  // Claims list
  const [insuranceClaims, setInsuranceClaims] = useState<any[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);
  const [claimViewModal, setClaimViewModal] = useState<any>(null);
  const [claimTrackingModal, setClaimTrackingModal] = useState<any>(null);
  const [textPreview, setTextPreview] = useState<any>(null);
  const [patientHistory, setPatientHistory] = useState<any[]>([]);
  const [patientHistoryLoading, setPatientHistoryLoading] = useState(false);

  // Agent claim filter
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loggedInUserId, setLoggedInUserId] = useState<string>("");
  const [agentClaimFilter, setAgentClaimFilter] = useState<"all" | "my">("all");
  const [claimsSearchQuery, setClaimsSearchQuery] = useState("");

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

  // Fetch sibling claims for the View modal's Previous Claims section
  const fetchPatientHistory = async (claim: any) => {
    setPatientHistory([]);
    setPatientHistoryLoading(true);
    try {
      const headers = getAuthHeaders();
      const res = await axios.get("/api/clinic/insurance-claims", { params: { patientId: claim.patientId }, headers });
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

  // Balance
  const [balance, setBalance] = useState({ pendingClaim: 0 });
  // Remaining claim credit per patient (from patient-balance API) for the
  // Available Amount column — reflects billing usage AND credit transfers.
  const [availableByPatient, setAvailableByPatient] = useState<Record<string, number>>({});

  // Claim Credit Transfer modal
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

  // Permission state
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Permission fetching - Clinic level (sidebar-permissions) + Agent/DoctorStaff level (get-module-permissions)
  useEffect(() => {
    let isMounted = true;

    const userRole = getUserRole();
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

    // Extract logged-in user ID from token payload
    let currentUserId = "";
    try {
      const tokenForPayload = authToken || agentToken || clinicToken || doctorToken || staffToken || userToken;
      if (tokenForPayload) {
        const payload = JSON.parse(atob(tokenForPayload.split('.')[1]));
        currentUserId = payload?._id || payload?.id || payload?.userId || "";
      }
    } catch (e) { /* ignore */ }

    if (isMounted) {
      setUserRole(userRole);
      setLoggedInUserId(currentUserId);
    }

    // Admin gets full permissions
    if (userRole === "admin") {
      if (!isMounted) return;
      setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
      setPermissionsLoaded(true);
      return () => { isMounted = false; };
    }

    // Clinic/Doctor role - use sidebar-permissions API
    if (userRole === "clinic" || userRole === "doctor") {
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
            // No permissions set - grant full access (backward compatibility)
            setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
          } else if (res.data.success) {
            const parentModule = findClaimModule(res.data.permissions);

            if (parentModule) {
              const subModule = findSubModulePermission(parentModule, CLAIM_MODULE_KEY);
              if (subModule) {
                console.log("[create-claim] Submodule permission found:", subModule);
                setPermissions(parsePermissionActions(subModule.actions || {}));
              } else {
                console.log("[create-claim] No submodule found, using parent module actions");
                setPermissions(parsePermissionActions(parentModule.actions || {}));
              }
            } else {
              console.log("[create-claim] No parent create_claim module found");
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
      userRole === "agent" || userRole === "doctorStaff" || userRole === "staff"
    ) {
      const fetchAgentPermissions = async () => {
        try {
          setPermissionsLoaded(false);
          let permissionToken = agentStaffToken;
          if (userRole === "agent") {
            permissionToken = agentToken || agentStaffToken;
          } else if (userRole === "doctorStaff" || userRole === "staff") {
            permissionToken = userToken || staffToken || agentStaffToken;
          }
          const res = await axios.get("/api/agent/get-module-permissions", {
            params: { moduleKey: CLAIM_MODULE_KEY },
            headers: { Authorization: `Bearer ${permissionToken}` },
          });

          if (!isMounted) return;

          if (
            !res.data?.permissions &&
            res.data?.error?.includes("not found in agent permissions")
          ) {
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

  // Fetch dropdowns
  const fetchDropdowns = async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const [deptRes, svcRes, docRes] = await Promise.all([
        axios.get("/api/clinic/departments", { headers }),
        axios.get("/api/clinic/services", { headers }),
        axios.get("/api/clinic/doctors", { headers }),
      ]);
      if (deptRes.data.success) setDepartments(deptRes.data.departments || []);
      if (svcRes.data.success) setServices(svcRes.data.services || []);
      if (docRes.data.success) {
        const allDocs = docRes.data.data || [];
        setDoctors(allDocs.filter((d: any) => d.role === "doctorStaff"));
      }
    } catch (err) {
      console.error("Error fetching dropdowns:", err);
    }
  };

  // Fetch the patient's most recent claim and prefill insurance fields
  const prefillFromPreviousClaim = async (patientId: string) => {
    setPrefilledFromClaim(null);
    if (!patientId) return;
    setPrefillLoading(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const res = await axios.get(`/api/clinic/insurance-claims?patientId=${patientId}`, { headers });
      if (res.data.success && res.data.data && res.data.data.length > 0) {
        // Take the most recent claim (last in array = most recent createdAt)
        const latest = res.data.data.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        setInsuranceForm((prev: any) => ({
          ...prev,
          insuranceProvider: latest.insuranceProvider || prev.insuranceProvider,
          policyNumber: latest.policyNumber || prev.policyNumber,
          expiryDate: latest.expiryDate ? latest.expiryDate.split('T')[0] : prev.expiryDate,
          insuranceCardFile: latest.insuranceCardFile || prev.insuranceCardFile,
          tableOfBenefitsFile: latest.tableOfBenefitsFile || prev.tableOfBenefitsFile,
          emriFrontPhoto: latest.emriFrontPhoto || prev.emriFrontPhoto,
          emriBackPhoto: latest.emriBackPhoto || prev.emriBackPhoto,
        }));
        setPrefilledFromClaim(latest);
      }
    } catch (err) { console.error("Error fetching previous claim:", err); }
    finally { setPrefillLoading(false); }
  };

  // Fetch claims
  const fetchInsuranceClaims = async () => {
    setClaimsLoading(true);
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const res = await axios.get("/api/clinic/insurance-claims", { headers });
      if (res.data.success) {
        setInsuranceClaims(res.data.data || []);
        fetchAvailableAmounts(res.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching claims:", err);
    } finally {
      setClaimsLoading(false);
    }
  };

  // Fetch remaining claim credit (balances.claimAmount) for every distinct
  // patient in the claims list so the Available Amount column shows the true
  // remaining after billing usage and claim credit transfers.
  const fetchAvailableAmounts = async (claims: any[]) => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const patientIds = Array.from(
        new Set(
          (claims || [])
            .map((c: any) => String(c.patientId || ""))
            .filter(Boolean),
        ),
      );
      if (patientIds.length === 0) {
        setAvailableByPatient({});
        return;
      }
      const results = await Promise.all(
        patientIds.map(async (pid) => {
          try {
            const res = await axios.get(`/api/clinic/patient-balance/${pid}`, { headers });
            return [pid, Number(res?.data?.balances?.claimAmount || 0)] as const;
          } catch {
            return [pid, 0] as const;
          }
        }),
      );
      setAvailableByPatient(Object.fromEntries(results));
    } catch (err) {
      console.error("Error fetching available claim amounts:", err);
    }
  };

  useEffect(() => {
    fetchDropdowns();
  }, []);

  // Fetch claims only after permissions are loaded and canRead is true
  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!permissions.canRead) {
      setInsuranceClaims([]);
      setClaimsLoading(false);
      return;
    }
    fetchInsuranceClaims();
  }, [permissionsLoaded, permissions.canRead]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (modalOpen || creditModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [modalOpen, creditModalOpen]);

  // Fetch balance for selected patient
  useEffect(() => {
    if (!selectedPatient?._id) return;
    const fetchBalance = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await axios.get(`/api/clinic/patient-balance/${selectedPatient._id}`, { headers });
        if (res.data.success) {
          const b = res.data.balances || res.data.data || {};
          setBalance({ pendingClaim: Number(b.pendingClaim || 0) });
        }
      } catch (err) { console.error("Error fetching balance:", err); }
    };
    fetchBalance();
  }, [selectedPatient]);

  // Sync multiple payment methods total to Paid Amount
  useEffect(() => {
    if (paymentForm.paymentMethod === "Multiple" && paymentForm.paymentMethods && paymentForm.paymentMethods.length > 0) {
      const total = paymentForm.paymentMethods.reduce((sum: number, pm: { method: string; amount: number }) => sum + (pm.amount || 0), 0);
      const roundedTotal = Math.round(total * 100) / 100;
      setPaymentForm((prev: any) => {
        if (prev.advanceAmount !== roundedTotal) {
          return { ...prev, advanceAmount: roundedTotal };
        }
        return prev;
      });
    }
  }, [paymentForm.paymentMethod, paymentForm.paymentMethods]);

  // Search patients
  const searchPatients = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) { setSearchResults([]); return; }
    try {
      setSearching(true);
      const headers = getAuthHeaders();
      const res = await axios.get(`/api/clinic/patient-registration?name=${encodeURIComponent(query)}`, { headers });
      if (res.data.success) setSearchResults((res.data.patients || res.data.data || []).slice(0, 10));
    } catch (err) { console.error("Error searching patients:", err); }
    finally { setSearching(false); }
  };

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingFiles(true);
      const headers = getAuthHeaders();
      const formData = new FormData();
      formData.append(field, file);
      const res = await fetch("/api/clinic/insurance-claims/upload", {
        method: "POST",
        headers: { Authorization: (headers as any)?.Authorization || "" },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        if (field === "insuranceCard") setInsuranceForm((p: any) => ({ ...p, insuranceCardFile: data.data.insuranceCardFile }));
        else if (field === "tableOfBenefits") setInsuranceForm((p: any) => ({ ...p, tableOfBenefitsFile: data.data.tableOfBenefitsFile }));
        else if (field === "emriFront") setInsuranceForm((p: any) => ({ ...p, emriFrontPhoto: data.data.emriFrontPhoto }));
        else if (field === "emriBack") setInsuranceForm((p: any) => ({ ...p, emriBackPhoto: data.data.emriBackPhoto }));
        else if (field === "documents") setPaymentForm((p: any) => ({ ...p, documentFiles: [...p.documentFiles, ...data.data.documentFiles] }));
        else if (field === "attachment") setPaymentForm((p: any) => ({ ...p, attachment: data.data.attachment }));
      }
    } catch (err) { console.error("File upload error:", err); }
    finally { setUploadingFiles(false); }
  };

  // Co-pay calculation
  const calculateCoPay = (claimAmount: number, coPayPercent: number, coPayType: string, advanceStatus: string, paidAmount: number, claimType?: string) => {
    const coPayAmount = claimAmount * (coPayPercent / 100);
    let total = claimAmount;
    if (coPayType === 'Patient Pays') total = claimAmount + coPayAmount;
    let pending = 0;
    if (claimType === "Advance") {
      // Advance claim: full amount is pending (service given now, paid later)
      pending = total;
    } else if (advanceStatus === 'Partial Pay') {
      pending = total - paidAmount;
    }
    return { coPayAmount: Math.round(coPayAmount * 100) / 100, totalClaimAmount: Math.round(total * 100) / 100, pendingClaimAmount: Math.round(Math.max(0, pending) * 100) / 100 };
  };

  const handlePaymentChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setPaymentForm((prev: any) => {
      let updated = { ...prev, [name]: value };
      if (name === "advanceAmount") updated.advanceAmount = parseFloat(value) || 0;
      if (name === "claimType") { updated.advanceStatus = "Full Pay"; updated.advanceAmount = 0; updated.transactionId = ""; updated.attachment = ""; }
      const claimAmt = name === "claimAmount" ? parseFloat(value) || 0 : parseFloat(updated.claimAmount) || 0;
      const copPct = name === "coPayPercent" ? parseFloat(value) || 0 : parseFloat(updated.coPayPercent) || 0;
      const copType = name === "coPayType" ? value : updated.coPayType;
      const advStatus = name === "advanceStatus" ? value : updated.advanceStatus;
      let advAmt = name === "advanceAmount" ? parseFloat(value) || 0 : (updated.advanceAmount || 0);
      if (name === "advanceStatus" && updated.claimType === "Paid") {
        if (value === "Partial Pay") { const c = calculateCoPay(claimAmt, copPct, copType, "Partial Pay", 0, updated.claimType); advAmt = c.totalClaimAmount / 2; updated.advanceAmount = Math.round(advAmt * 100) / 100; }
        else if (value === "Full Pay") { const c = calculateCoPay(claimAmt, copPct, copType, "Full Pay", 0, updated.claimType); advAmt = c.totalClaimAmount; updated.advanceAmount = Math.round(advAmt * 100) / 100; }
      }
      // For Advance claims: advanceAmount always stays 0 (no payment made yet)
      if (updated.claimType === "Advance") {
        updated.advanceAmount = 0;
      }
      const calc = calculateCoPay(claimAmt, copPct, copType, advStatus, advAmt, updated.claimType);
      updated.totalClaimAmount = calc.totalClaimAmount;
      updated.pendingClaimAmount = calc.pendingClaimAmount;
      updated.coPayAmount = calc.coPayAmount;
      // Auto-prefill Paid Amount with Co-Pay Total when Paid + Full Pay
      const curClaimType = name === "claimType" ? value : updated.claimType;
      const curAdvStatus = name === "advanceStatus" ? value : updated.advanceStatus;
      if (curClaimType === "Paid" && curAdvStatus === "Full Pay") {
        updated.advanceAmount = calc.totalClaimAmount;
      }
      return updated;
    });
  };

  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const deptId = e.target.value;
    const dept = departments.find((d: any) => getNormalizedEntityId(d?._id) === deptId);
    setClaimSourceForm((p: any) => ({ ...p, departmentId: deptId, departmentName: dept ? dept.name : "", serviceId: "", serviceName: "", services: [] }));
  };

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const serviceId = e.target.value;
    if (!serviceId) return;
    const svc = services.find((s: any) => s._id === serviceId);
    if (!svc) return;
    setClaimSourceForm((p: any) => {
      const exists = p.services.some((s: any) => s.serviceId === serviceId);
      const updatedServices = exists ? p.services : [...p.services, { serviceId, serviceName: svc.name }];
      return { ...p, services: updatedServices, serviceId, serviceName: svc.name };
    });
  };

  const handleDoctorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const docId = e.target.value;
    const doc = doctors.find((d: any) => d._id === docId);
    setClaimSourceForm((p: any) => ({ ...p, doctorId: docId, doctorName: doc ? doc.name : "" }));
  };

  // Submit claim
  const submitClaim = async () => {
    if (balance.pendingClaim > 0) { alert(`Cannot create claim. Patient has pending claim of ${formatAED(balance.pendingClaim)}.`); return; }
    if (paymentForm.claimType === "Paid") {
      if (!paymentForm.transactionId?.trim()) { alert("Transaction ID is required for Paid claims."); return; }
      if (!paymentForm.attachment) { alert("Payment Attachment is required for Paid claims."); return; }
    }
    try {
      setSubmitting(true);
      const headers = getAuthHeaders();
      const res = await fetch("/api/clinic/insurance-claims", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers as any) },
        body: JSON.stringify({
          patientId: selectedPatient._id,
          insuranceProvider: insuranceForm.insuranceProvider,
          policyNumber: insuranceForm.policyNumber,
          expiryDate: insuranceForm.expiryDate,
          insuranceCardFile: insuranceForm.insuranceCardFile,
          tableOfBenefitsFile: insuranceForm.tableOfBenefitsFile,
          emriFrontPhoto: insuranceForm.emriFrontPhoto,
          emriBackPhoto: insuranceForm.emriBackPhoto,
          urgency: insuranceForm.urgency,
          departmentId: claimSourceForm.departmentId,
          departmentName: claimSourceForm.departmentName,
          serviceId: claimSourceForm.serviceId,
          serviceName: claimSourceForm.serviceName,
          services: claimSourceForm.services,
          doctorId: claimSourceForm.doctorId,
          doctorName: claimSourceForm.doctorName,
          claimAmount: paymentForm.claimAmount,
          claimType: paymentForm.claimType,
          coPayPercent: paymentForm.coPayPercent,
          coPayType: paymentForm.coPayType,
          notes: paymentForm.notes,
          documentFiles: paymentForm.documentFiles,
          advanceStatus: paymentForm.advanceStatus,
          advanceAmount: paymentForm.advanceAmount,
          transactionId: paymentForm.transactionId,
          attachment: paymentForm.attachment,
          paymentMethod: paymentForm.paymentMethod,
          paymentMethods: paymentForm.paymentMethods || [],
          emirNumber: insuranceForm.emirNumber,
          diagnosis: insuranceForm.diagnosis,
          finalClaimAmount: paymentForm.totalClaimAmount || parseFloat(paymentForm.claimAmount) || 0,
          pendingClaim: paymentForm.pendingClaimAmount || 0,
          coPayAmount: paymentForm.coPayAmount || 0,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setModalOpen(false);
        resetForm();
        fetchInsuranceClaims();
      } else { alert(data.message || "Failed to create claim"); }
    } catch (err) { console.error("Submit error:", err); alert("Failed to create claim"); }
    finally { setSubmitting(false); }
  };

  const resetForm = () => {
    setCurrentStep(1);
    setSelectedPatient(null);
    setPrefilledFromClaim(null);
    setSearchQuery("");
    setSearchResults([]);
    setInsuranceForm({ insuranceProvider: "", policyNumber: "", expiryDate: "", insuranceCardFile: "", tableOfBenefitsFile: "", emriFrontPhoto: "", emriBackPhoto: "", urgency: "Normal", emirNumber: "", diagnosis: "" });
    setClaimSourceForm({ departmentId: "", departmentName: "", serviceId: "", serviceName: "", services: [], doctorId: "", doctorName: "" });
    setPaymentForm({ claimAmount: "", claimType: "Paid", coPayPercent: "", coPayType: "Patient Pays", notes: "", documentFiles: [], advanceStatus: "Full Pay", advanceAmount: 0, transactionId: "", attachment: "", paymentMethod: "", paymentMethods: [] });
  };

  const openModal = () => { setModalOpen(true); setCurrentStep(1); resetForm(); };
  const closeModal = () => { setModalOpen(false); resetForm(); };
  const nextStep = () => setCurrentStep((s) => Math.min(s + 1, 6));
  const prevStep = () => setCurrentStep((s) => Math.max(s - 1, 1));

  // ==================== CLAIM CREDIT TRANSFER ====================
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
      const headers = getAuthHeaders();
      const res = await axios.get(`/api/clinic/search-patients?search=${encodeURIComponent(query)}`, { headers });
      if (res.data.success) setCreditSearchResults(res.data.patients || []);
    } catch (err) { console.error("Error searching patients:", err); }
    finally { setCreditSearching(false); }
  };

  // Fetch claim usage (released total, billing used, remaining) for a patient
  const fetchClaimUsage = async (patientId: string) => {
    const headers = getAuthHeaders();
    const res = await axios.get(`/api/clinic/claim-usage?patientId=${patientId}`, { headers });
    if (res.data.success) {
      const d = res.data.data;
      console.log("===== CLAIM USAGE API RESPONSE =====");
      console.log("totalReleasedClaimAmount:", d.totalReleasedClaimAmount);
      console.log("totalClaimAmountUsed:", d.totalClaimAmountUsed);
      console.log("remainingClaimAmount:", d.remainingClaimAmount);
      console.log("pendingClaim:", d.pendingClaim);
      console.log("claims:", JSON.stringify(d.claims, null, 2));
      console.log("====================================");
      return d;
    }
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
      const headers = getAuthHeaders();
      const res = await axios.post(
        "/api/clinic/claim-transfer/execute",
        {
          sourcePatientId: sourcePatient._id,
          destPatientId: destPatient._id,
          amount: Number(transferAmount),
        },
        { headers }
      );
      if (res.data.success) {
        setTransferSuccess(res.data);
        // Refresh balances shown in the wizard so they are current
        setSourceUsage((u: any) => u ? { ...u, remainingClaimAmount: res.data.sourceRemaining } : u);
        setDestUsage((u: any) => u ? { ...u, remainingClaimAmount: res.data.destRemaining } : u);
        // Refresh the claims table so the Available Amount column reflects
        // the new remaining balances for source and destination patients
        fetchInsuranceClaims();
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

  const canProceedStep1 = !!selectedPatient;
  const canProceedStep2 = insuranceForm.insuranceProvider && insuranceForm.policyNumber && insuranceForm.expiryDate;
  const canProceedStep4 = claimSourceForm.doctorId && claimSourceForm.departmentId;
  const canProceedStep5 = (() => {
    if (!paymentForm.claimAmount || parseFloat(paymentForm.claimAmount) <= 0) return false;
    if (paymentForm.claimType === "Paid") {
      if (!paymentForm.transactionId?.trim()) return false;
      if (!paymentForm.attachment) return false;
    }
    return true;
  })();

  const deleteClaim = async (claimId: string) => {
    if (!confirm("Delete this claim?")) return;
    try {
      const headers = getAuthHeaders();
      const res = await axios.delete(`/api/clinic/insurance-claims/${claimId}`, { headers });
      if (res.data.success) fetchInsuranceClaims();
      else alert(res.data.message || "Failed to delete");
    } catch (err: any) { alert(err.response?.data?.message || "Failed to delete"); }
  };

  // Filter claims for agent role and search query
  const filteredClaims = React.useMemo(() => {
    let result = insuranceClaims;
    // Agent role filter
    if (userRole === "agent" && agentClaimFilter === "my") {
      result = result.filter((c: any) => String(c.createdBy || "") === loggedInUserId);
    }
    // Search filter
    if (claimsSearchQuery.trim()) {
      const q = claimsSearchQuery.toLowerCase().trim();
      result = result.filter((c: any) => {
        const patientName = `${c.patientFirstName || ''} ${c.patientLastName || ''}`.toLowerCase();
        const emr = (c.emrNumber || '').toLowerCase();
        const insurance = (c.insuranceProvider || '').toLowerCase();
        const invoice = (c.invoiceNumber || '').toLowerCase();
        return patientName.includes(q) || emr.includes(q) || insurance.includes(q) || invoice.includes(q);
      });
    }
    return result;
  }, [insuranceClaims, userRole, agentClaimFilter, loggedInUserId, claimsSearchQuery]);

  // ==================== RENDER ====================

  // Access Denied screen — only when both read and create are denied
  if (permissionsLoaded && !permissions.canRead && !permissions.canCreate) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to view Insurance Claims. Please contact your administrator to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header with Create Claim Button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Claims</h1>
          <p className="text-sm text-gray-500 mt-1">Create and manage insurance claims</p>
        </div>
        {permissions.canCreate && (
          <div className="flex items-center gap-3">
            <button onClick={openCreditModal} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-teal-600 text-teal-700 hover:bg-teal-50 rounded-lg font-semibold text-sm transition-colors shadow-sm">
              <ArrowLeftRight className="w-4 h-4" /> Claim Credit
            </button>
            <button onClick={openModal} className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-semibold text-sm transition-colors shadow-sm">
              <Plus className="w-4 h-4" /> Create Claim
            </button>
          </div>
        )}
      </div>

      {/* Claims Table — hidden when read permission is denied */}
      {!permissions.canRead ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <div className="text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Access Denied</h3>
            <p className="text-sm text-gray-600">You don't have permission to view claims. Please contact your administrator to request access.</p>
          </div>
        </div>
      ) : (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center"><Shield className="w-4 h-4 text-teal-600" /></div>
            <h3 className="text-base font-semibold text-gray-900">All Claims</h3>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{filteredClaims.length} total</span>
          </div>
          {/* Agent claim filter */}
          {userRole === "agent" && (
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-gray-400" />
              <button
                onClick={() => setAgentClaimFilter("all")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  agentClaimFilter === "all"
                    ? "bg-teal-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All Claims
              </button>
              <button
                onClick={() => setAgentClaimFilter("my")}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  agentClaimFilter === "my"
                    ? "bg-teal-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                My Claims
              </button>
            </div>
          )}
        </div>
        {/* Search bar */}
        <div className="px-6 py-3 border-b border-gray-50 bg-gray-50/50">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={claimsSearchQuery}
              onChange={(e) => setClaimsSearchQuery(e.target.value)}
              placeholder="Search by patient name, EMR, insurance, invoice..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 bg-white"
            />
            {claimsSearchQuery && (
              <button
                onClick={() => setClaimsSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="px-6 pb-6">
          {claimsLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-teal-600"></div></div>
          ) : filteredClaims.length === 0 ? (
            <div className="text-center py-8"><Shield className="w-10 h-10 text-gray-300 mx-auto mb-2" /><p className="text-gray-500 text-sm">{agentClaimFilter === "my" ? "No claims found created by you" : "No claims created yet"}</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Invoice #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Patient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">EMR #</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Insurance Provider</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Claim Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Department</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Doctor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Claim Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Final Claim Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Paid</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Pending</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Co-Pay %</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Available Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Created</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredClaims.map((claim: any) => (
                    <tr key={claim._id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-gray-500">{claim.invoiceNumber || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {claim.patientFirstName} {claim.patientLastName}
                        {claim.patientGenderAge && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold">{claim.patientGenderAge}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs font-mono text-teal-700">{claim.patientEmrNumber || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{claim.insuranceProvider || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${claim.claimType === 'Advance' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'}`}>{claim.claimType}</span></td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{claim.departmentName || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{claim.doctorName || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{getCurrencySymbol(currency)} {Number(claim.claimAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{getCurrencySymbol(currency)} {(claim.finalClaimAmount || claim.claimAmount)?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-green-700">{claim.advanceAmount ? `${getCurrencySymbol(currency)} ${claim.advanceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-orange-700">{claim.pendingClaim > 0 ? `${getCurrencySymbol(currency)} ${claim.pendingClaim.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-purple-700">{claim.coPayPercent ? `${claim.coPayPercent}%` : '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-teal-700">{claim.patientId && availableByPatient[String(claim.patientId)] !== undefined ? `${getCurrencySymbol(currency)} ${Number(availableByPatient[String(claim.patientId)]).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{(() => { const events: { date: string; status: string }[] = []; if (claim.rejectedFromReleaseRequestedAt) events.push({ date: claim.rejectedFromReleaseRequestedAt, status: 'Rejected' }); if (claim.rejectedFromPassClaimsAt) events.push({ date: claim.rejectedFromPassClaimsAt, status: 'Rejected' }); if (claim.approvedAt) events.push({ date: claim.approvedAt, status: 'Approved' }); if (claim.rejectedAt) events.push({ date: claim.rejectedAt, status: 'Rejected' }); if (claim.releasedAt) events.push({ date: claim.releasedAt, status: 'Released' }); if (claim.completedAt) events.push({ date: claim.completedAt, status: 'Completed' }); if (claim.readyAt) events.push({ date: claim.readyAt, status: 'Ready' }); events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()); const s = events.length > 0 ? events[0].status : (claim.status || 'Under Review'); return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s === 'Under Review' ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : s === 'Approved' ? 'bg-green-100 text-green-800 border-green-300' : s === 'Rejected' ? 'bg-red-100 text-red-800 border-red-300' : s === 'Ready' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' : s === 'Completed' ? 'bg-purple-100 text-purple-800 border-purple-300' : s === 'Released' ? 'bg-blue-100 text-blue-800 border-blue-300' : 'bg-gray-100 text-gray-800 border-gray-300'}`}>{s}</span>; })()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500">{new Date(claim.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap"><div className="flex items-center gap-1">
                        <button onClick={() => handleViewClaim(claim)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-lg transition-colors" title="Review"><Eye className="w-4 h-4" /></button>
                        <button onClick={() => setClaimTrackingModal(claim)} className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Track"><Activity className="w-4 h-4" /></button>
                        {permissions.canDelete && ['Under Review', 'Rejected'].includes(claim.status) && <button onClick={() => deleteClaim(claim._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ==================== CREATE CLAIM MODAL ==================== */}
      {modalOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col" style={{ margin: '1rem' }}>
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
              <h2 className="text-lg font-bold text-gray-900">Create Insurance Claim</h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            {/* Step Indicator */}
            <div className="px-6 py-4 border-b border-gray-100">
              <div className="flex items-center justify-between">
                {STEPS.map((step, idx) => (
                  <React.Fragment key={step.id}>
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${currentStep >= step.id ? 'bg-teal-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                      </div>
                      <span className={`text-xs font-medium hidden sm:block ${currentStep >= step.id ? 'text-teal-700' : 'text-gray-400'}`}>{step.label}</span>
                    </div>
                    {idx < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-teal-600' : 'bg-gray-200'}`} />}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* ===== STEP 1: Find Patient ===== */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Find the patient</h3>
                    <p className="text-sm text-gray-500">Select a patient profile to check eligibility and insurance before a claim can be created.</p>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" value={searchQuery} onChange={(e) => searchPatients(e.target.value)} placeholder="Search by patient name..." className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900" />
                    {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {searchResults.map((p: any) => {
                        const initials = `${p.firstName?.[0] || ''}${p.lastName?.[0] || ''}`.toUpperCase();
                        const isSelected = selectedPatient?._id === p._id;
                        return (
                          <button key={p._id} onClick={() => { setSelectedPatient(p); prefillFromPreviousClaim(p._id); }} className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center justify-between ${isSelected ? 'border-teal-500 bg-teal-50 ring-1 ring-teal-500' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gray-800 text-white flex items-center justify-center text-sm font-bold">{initials}</div>
                              <div>
                                <div className="text-sm font-semibold text-gray-900">{p.firstName} {p.lastName}</div>
                                <div className="text-xs text-gray-500">MRN-{p.emrNumber || 'N/A'} · {p.mobileNumber || p.phone || 'No phone'}</div>
                              </div>
                            </div>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${p.insurance === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{p.insurance === 'Yes' ? 'Eligible' : 'No Insurance'}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {searchQuery && !searching && searchResults.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No patients found</p>}
                  {selectedPatient && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">Eligible for claim creation</p>
                        <p className="text-xs text-green-700">{selectedPatient.firstName} {selectedPatient.lastName} · {selectedPatient.gender || 'N/A'} · {selectedPatient.mobileNumber || selectedPatient.phone || 'N/A'}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== STEP 2: Insurance Details ===== */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Insurance Details</h3>
                    <p className="text-sm text-gray-500">Enter the patient's insurance information.</p>
                  </div>
                  {/* Prefilled from previous claim banner */}
                  {prefilledFromClaim && (
                    <div className="flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-lg p-3">
                      <CheckCircle className="w-5 h-5 text-teal-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-teal-800">Insurance details prefilled from previous claim</p>
                        <p className="text-xs text-teal-700 mt-0.5">
                          Provider: <span className="font-semibold">{prefilledFromClaim.insuranceProvider}</span>
                          {prefilledFromClaim.policyNumber && <> · Policy: <span className="font-semibold">{prefilledFromClaim.policyNumber}</span></>}
                          {prefilledFromClaim.createdAt && <> · Created: <span className="font-semibold">{new Date(prefilledFromClaim.createdAt).toLocaleDateString()}</span></>}
                        </p>
                        <p className="text-[11px] text-teal-600 mt-1">You can edit any field below if the information has changed.</p>
                      </div>
                      <button onClick={() => setPrefilledFromClaim(null)} className="text-teal-500 hover:text-teal-700 flex-shrink-0"><X className="w-4 h-4" /></button>
                    </div>
                  )}
                  {prefillLoading && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking for previous claims...
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Insurance Provider <span className="text-red-500">*</span></label>
                      <input type="text" value={insuranceForm.insuranceProvider} onChange={(e) => setInsuranceForm((p: any) => ({ ...p, insuranceProvider: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900" placeholder="Provider name" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Policy Number <span className="text-red-500">*</span></label>
                      <input type="text" value={insuranceForm.policyNumber} onChange={(e) => setInsuranceForm((p: any) => ({ ...p, policyNumber: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900" placeholder="Policy number" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Expiry Date <span className="text-red-500">*</span></label>
                      <input type="date" value={insuranceForm.expiryDate} onChange={(e) => setInsuranceForm((p: any) => ({ ...p, expiryDate: e.target.value }))} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Urgency</label>
                      <select value={insuranceForm.urgency} onChange={(e) => setInsuranceForm((p: any) => ({ ...p, urgency: e.target.value }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900 bg-white">
                        <option value="Normal">Normal</option>
                        <option value="High">High</option>
                        <option value="Priority">Priority</option>
                      </select>
                    </div>
                  </div>
                  {/* File uploads */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Insurance Card</label>
                      <div className="relative">
                        <input id="ins-card" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'insuranceCard')} className="hidden" disabled={uploadingFiles} />
                        <label htmlFor="ins-card" className={`w-full flex items-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded-lg cursor-pointer transition-all ${insuranceForm.insuranceCardFile ? 'bg-teal-50 border-teal-400' : 'bg-white hover:border-teal-400'}`}>
                          {insuranceForm.insuranceCardFile ? <FileText className="w-4 h-4 text-teal-600" /> : <FileImage className="w-4 h-4 text-gray-400" />}
                          <span className={`truncate flex-1 ${insuranceForm.insuranceCardFile ? 'text-teal-700 font-semibold' : 'text-gray-400'}`}>{insuranceForm.insuranceCardFile ? 'File selected' : 'No file chosen'}</span>
                          {insuranceForm.insuranceCardFile && <button type="button" onClick={(e) => { e.preventDefault(); setInsuranceForm((p: any) => ({ ...p, insuranceCardFile: "" })); }} className="text-teal-600"><X className="w-3 h-3" /></button>}
                          {uploadingFiles && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Table of Benefits</label>
                      <div className="relative">
                        <input id="ins-benefits" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'tableOfBenefits')} className="hidden" disabled={uploadingFiles} />
                        <label htmlFor="ins-benefits" className={`w-full flex items-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded-lg cursor-pointer transition-all ${insuranceForm.tableOfBenefitsFile ? 'bg-teal-50 border-teal-400' : 'bg-white hover:border-teal-400'}`}>
                          {insuranceForm.tableOfBenefitsFile ? <FileText className="w-4 h-4 text-teal-600" /> : <FileImage className="w-4 h-4 text-gray-400" />}
                          <span className={`truncate flex-1 ${insuranceForm.tableOfBenefitsFile ? 'text-teal-700 font-semibold' : 'text-gray-400'}`}>{insuranceForm.tableOfBenefitsFile ? 'File selected' : 'No file chosen'}</span>
                          {insuranceForm.tableOfBenefitsFile && <button type="button" onClick={(e) => { e.preventDefault(); setInsuranceForm((p: any) => ({ ...p, tableOfBenefitsFile: "" })); }} className="text-teal-600"><X className="w-3 h-3" /></button>}
                          {uploadingFiles && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">EMRI Front Photo</label>
                      <div className="relative">
                        <input id="emri-front" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'emriFront')} className="hidden" disabled={uploadingFiles} />
                        <label htmlFor="emri-front" className={`w-full flex items-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded-lg cursor-pointer transition-all ${insuranceForm.emriFrontPhoto ? 'bg-teal-50 border-teal-400' : 'bg-white hover:border-teal-400'}`}>
                          {insuranceForm.emriFrontPhoto ? <FileText className="w-4 h-4 text-teal-600" /> : <Upload className="w-4 h-4 text-gray-400" />}
                          <span className={`truncate flex-1 ${insuranceForm.emriFrontPhoto ? 'text-teal-700 font-semibold' : 'text-gray-400'}`}>{insuranceForm.emriFrontPhoto ? 'File selected' : 'Upload front photo'}</span>
                          {uploadingFiles && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">EMRI Back Photo</label>
                      <div className="relative">
                        <input id="emri-back" type="file" accept="image/*,.pdf" onChange={(e) => handleFileUpload(e, 'emriBack')} className="hidden" disabled={uploadingFiles} />
                        <label htmlFor="emri-back" className={`w-full flex items-center gap-2 px-3 py-2 text-xs border border-gray-300 rounded-lg cursor-pointer transition-all ${insuranceForm.emriBackPhoto ? 'bg-teal-50 border-teal-400' : 'bg-white hover:border-teal-400'}`}>
                          {insuranceForm.emriBackPhoto ? <FileText className="w-4 h-4 text-teal-600" /> : <Upload className="w-4 h-4 text-gray-400" />}
                          <span className={`truncate flex-1 ${insuranceForm.emriBackPhoto ? 'text-teal-700 font-semibold' : 'text-gray-400'}`}>{insuranceForm.emriBackPhoto ? 'File selected' : 'Upload back photo'}</span>
                          {uploadingFiles && <Loader2 className="w-3 h-3 animate-spin text-teal-600" />}
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== STEP 3: Confirmation ===== */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Confirmation</h3>
                    <p className="text-sm text-gray-500">Review patient and insurance details before proceeding.</p>
                  </div>

                  {/* Single document-style card */}
                  <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {/* Document header */}
                    <div className="bg-gray-50 border-b border-gray-200 px-5 py-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {((selectedPatient?.firstName?.[0] || '') + (selectedPatient?.lastName?.[0] || '')).toUpperCase() || '—'}
                        </div>
                        <div>
                          <p className="text-base font-bold text-gray-900 leading-tight">{selectedPatient?.firstName} {selectedPatient?.lastName}</p>
                          <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                            {selectedPatient?.emrNumber && <span className="font-mono">EMR: {selectedPatient.emrNumber}</span>}
                            {selectedPatient?.gender && <span>· {selectedPatient.gender}</span>}
                            {(selectedPatient?.mobileNumber || selectedPatient?.phone) && <span>· {selectedPatient.mobileNumber || selectedPatient.phone}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Submitted</p>
                        <p className="text-xs font-medium text-gray-700">{new Date().toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Patient details rows */}
                    <div className="px-5 py-3 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Patient Information</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6">
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Full Name</span>
                          <span className="text-sm font-medium text-gray-900">{selectedPatient?.firstName} {selectedPatient?.lastName}</span>
                        </div>
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Gender</span>
                          <span className="text-sm font-medium text-gray-900">{selectedPatient?.gender || '—'}</span>
                        </div>
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Phone</span>
                          <span className="text-sm font-medium text-gray-900">{selectedPatient?.mobileNumber || selectedPatient?.phone || '—'}</span>
                        </div>
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Email</span>
                          <span className="text-sm font-medium text-gray-900">{selectedPatient?.email || '—'}</span>
                        </div>
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">EMR Number</span>
                          <span className="text-sm font-medium font-mono text-gray-900">{selectedPatient?.emrNumber || '—'}</span>
                        </div>
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Insurance</span>
                          <span className={`text-sm font-medium ${selectedPatient?.insurance === 'Yes' ? 'text-gray-900' : 'text-gray-400'}`}>{selectedPatient?.insurance === 'Yes' ? 'Yes' : 'No'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Insurance details rows */}
                    <div className="px-5 py-3 border-b border-gray-100">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Insurance Details</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-6">
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Provider</span>
                          <span className="text-sm font-medium text-gray-900">{insuranceForm.insuranceProvider || '—'}</span>
                        </div>
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Policy Number</span>
                          <span className="text-sm font-medium font-mono text-gray-900">{insuranceForm.policyNumber || '—'}</span>
                        </div>
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Expiry Date</span>
                          <span className="text-sm font-medium text-gray-900">{insuranceForm.expiryDate ? new Date(insuranceForm.expiryDate).toLocaleDateString() : '—'}</span>
                        </div>
                        <div className="flex justify-between sm:flex-col sm:gap-0.5">
                          <span className="text-[11px] text-gray-400">Urgency</span>
                          <span className={`text-sm font-medium ${insuranceForm.urgency === 'High' ? 'text-amber-700' : insuranceForm.urgency === 'Priority' ? 'text-amber-600' : 'text-gray-900'}`}>
                            {insuranceForm.urgency === 'High' && '⚠ '}{insuranceForm.urgency || 'Normal'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Attached files */}
                    {(insuranceForm.insuranceCardFile || insuranceForm.tableOfBenefitsFile || insuranceForm.emriFrontPhoto || insuranceForm.emriBackPhoto) && (
                      <div className="px-5 py-3 bg-gray-50/50">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Attached Documents</p>
                        <div className="flex flex-wrap gap-2">
                          {insuranceForm.insuranceCardFile && (
                            <button onClick={() => setDocViewerUrl(insuranceForm.insuranceCardFile)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors">
                              <Shield className="w-3.5 h-3.5" /> Insurance Card
                            </button>
                          )}
                          {insuranceForm.tableOfBenefitsFile && (
                            <button onClick={() => setDocViewerUrl(insuranceForm.tableOfBenefitsFile)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors">
                              <FileText className="w-3.5 h-3.5" /> Benefits Table
                            </button>
                          )}
                          {insuranceForm.emriFrontPhoto && (
                            <button onClick={() => setDocViewerUrl(insuranceForm.emriFrontPhoto)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors">
                              <FileText className="w-3.5 h-3.5" /> EMRI Front
                            </button>
                          )}
                          {insuranceForm.emriBackPhoto && (
                            <button onClick={() => setDocViewerUrl(insuranceForm.emriBackPhoto)} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 hover:border-gray-400 hover:text-gray-900 transition-colors">
                              <FileText className="w-3.5 h-3.5" /> EMRI Back
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ===== STEP 4: Claim Source ===== */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Claim Source</h3>
                    <p className="text-sm text-gray-500">Select department, services, and doctor for this claim.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Department</label>
                      <select value={claimSourceForm.departmentId} onChange={handleDepartmentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900 bg-white">
                        <option value="">Select Department</option>
                        {departments.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Doctor <span className="text-red-500">*</span></label>
                      <select value={claimSourceForm.doctorId} onChange={handleDoctorChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900 bg-white">
                        <option value="">Select Doctor</option>
                        {doctors.map((d: any) => <option key={d._id} value={d._id}>{d.name}</option>)}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Services <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <div className="relative w-full flex items-center p-0.5 border border-gray-300 rounded-lg bg-white shadow-sm focus-within:ring-2 focus-within:ring-teal-500 min-h-[38px]">
                        <div className="flex flex-wrap items-center gap-1 flex-1 px-1 py-0.5">
                          {claimSourceForm.services.map((svc: any, idx: number) => (
                            <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-xs font-bold">
                              {svc.serviceName}
                              <button type="button" onClick={() => setClaimSourceForm((p: any) => ({ ...p, services: p.services.filter((_: any, i: number) => i !== idx) }))} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                            </span>
                          ))}
                          <select value="" onChange={handleServiceChange} className="min-w-[120px] bg-transparent border-none outline-none text-sm text-gray-900 cursor-pointer h-full py-1 flex-1 appearance-none">
                            <option value="" disabled>{claimSourceForm.services.length > 0 ? "Add More..." : "Select Services"}</option>
                            {services.filter((s: any) => !claimSourceForm.departmentId || getNormalizedEntityId(s.departmentId) === getNormalizedEntityId(claimSourceForm.departmentId)).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ===== STEP 5: Payment Details ===== */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Payment Details</h3>
                    <p className="text-sm text-gray-500">Enter claim amount, type, and payment information.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Claim Amount <span className="text-red-500">*</span></label>
                      <input type="number" name="claimAmount" value={paymentForm.claimAmount} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900" placeholder="0" min="0" step="0.01" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Type <span className="text-red-500">*</span></label>
                      <select name="claimType" value={paymentForm.claimType} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900 bg-white">
                        <option value="Paid">Paid</option>
                        <option value="Advance">Advance</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Co-Pay %</label>
                      <input type="number" name="coPayPercent" value={paymentForm.coPayPercent} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900" placeholder="0-100" min="0" max="100" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Co-Pay Type</label>
                      <select name="coPayType" value={paymentForm.coPayType} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900 bg-white">
                        <option value="Patient Pays">Patient Pays</option>
                        <option value="Deduct from Claim">Deduct from Claim</option>
                        <option value="Clinic Adjusts">Clinic Adjusts</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                      <input type="text" name="notes" value={paymentForm.notes} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-900" placeholder="Notes..." />
                    </div>
                  </div>

                  {/* Paid/Advance specific fields */}
                  {paymentForm.claimType === 'Paid' && (
                    <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 space-y-4">
                      <h4 className="text-sm font-semibold text-purple-800">Paid Claim Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Paid Status</label>
                          <select name="advanceStatus" value={paymentForm.advanceStatus} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white">
                            <option value="Full Pay">Full Pay</option>
                            <option value="Partial Pay">Partial Pay</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Payment Method</label>
                          <select value={paymentForm.paymentMethod} onChange={(e) => setPaymentForm((p: any) => ({ ...p, paymentMethod: e.target.value, paymentMethods: e.target.value !== "Multiple" ? [] : p.paymentMethods }))} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white">
                            <option value="">Select Method</option>
                            <option value="Cash">Cash</option>
                            <option value="Card">Card</option>
                            <option value="UPI">UPI</option>
                            <option value="Bank Transfer">Bank Transfer</option>
                            <option value="Cheque">Cheque</option>
                            <option value="Multiple">Multiple</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Paid Amount</label>
                          <input type="number" name="advanceAmount" value={paymentForm.advanceAmount} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 font-semibold" placeholder="0.00" min="0" step="0.01" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Transaction ID <span className="text-red-500">*</span></label>
                          <input type="text" value={paymentForm.transactionId} onChange={(e) => setPaymentForm((p: any) => ({ ...p, transactionId: e.target.value }))} className={`w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 text-gray-900 ${!paymentForm.transactionId?.trim() ? 'border-red-300 bg-red-50/40' : 'border-gray-300'}`} placeholder="Enter transaction ID" />
                        </div>
                      </div>

                      {/* Multiple Payment Methods */}
                      {paymentForm.paymentMethod === "Multiple" && (
                        <div className="bg-white rounded-lg p-4 border border-purple-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <h5 className="text-xs font-semibold text-purple-800">Multiple Payment Methods</h5>
                            <button
                              type="button"
                              onClick={() => setPaymentForm((p: any) => ({ ...p, paymentMethods: [...(p.paymentMethods || []), { method: "Cash", amount: 0 }] }))}
                              className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-700 bg-purple-100 rounded hover:bg-purple-200 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> Add Method
                            </button>
                          </div>
                          {(paymentForm.paymentMethods || []).length === 0 && (
                            <p className="text-xs text-gray-500 text-center py-2">No payment methods added. Click "Add Method" to add one.</p>
                          )}
                          <div className="space-y-2">
                            {(paymentForm.paymentMethods || []).map((pm: { method: string; amount: number }, idx: number) => (
                              <div key={idx} className="flex items-center gap-2">
                                <select
                                  value={pm.method}
                                  onChange={(e) => setPaymentForm((p: any) => {
                                    const updated = [...(p.paymentMethods || [])];
                                    updated[idx] = { ...updated[idx], method: e.target.value };
                                    return { ...p, paymentMethods: updated };
                                  })}
                                  className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 text-gray-900 bg-white"
                                >
                                  <option value="Cash">Cash</option>
                                  <option value="Card">Card</option>
                                  <option value="UPI">UPI</option>
                                  <option value="Bank Transfer">Bank Transfer</option>
                                  <option value="Cheque">Cheque</option>
                                </select>
                                <input
                                  type="number"
                                  value={pm.amount}
                                  onChange={(e) => setPaymentForm((p: any) => {
                                    const updated = [...(p.paymentMethods || [])];
                                    updated[idx] = { ...updated[idx], amount: parseFloat(e.target.value) || 0 };
                                    return { ...p, paymentMethods: updated };
                                  })}
                                  className="w-28 px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-purple-500 text-gray-900"
                                  placeholder="Amount"
                                  min="0"
                                  step="0.01"
                                />
                                <button
                                  type="button"
                                  onClick={() => setPaymentForm((p: any) => ({ ...p, paymentMethods: (p.paymentMethods || []).filter((_: any, i: number) => i !== idx) }))}
                                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                          {(paymentForm.paymentMethods || []).length > 0 && (
                            <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                              <span className="text-xs font-medium text-gray-600">Total:</span>
                              <span className="text-sm font-bold text-purple-800">{formatAED((paymentForm.paymentMethods || []).reduce((sum: number, pm: { method: string; amount: number }) => sum + (pm.amount || 0), 0))}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Co-Pay Summary */}
                      {paymentForm.claimAmount && parseFloat(paymentForm.claimAmount) > 0 && paymentForm.coPayPercent && (
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 border border-indigo-200">
                          <div className="text-xs font-bold text-indigo-800 mb-2 flex items-center gap-1"><Calculator className="w-3 h-3" /> Co-Pay Summary</div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className="bg-white rounded p-1.5 shadow-sm"><span className="text-gray-500">Base:</span> <span className="font-semibold">{formatAED(parseFloat(paymentForm.claimAmount) || 0)}</span></div>
                            {paymentForm.coPayType === 'Patient Pays' && <div className="bg-white rounded p-1.5 shadow-sm"><span className="text-gray-500">Co-Pay ({paymentForm.coPayPercent}%):</span> <span className="font-semibold text-orange-600">+{formatAED(paymentForm.coPayAmount || 0)}</span></div>}
                            <div className={`rounded p-1.5 shadow-sm ${paymentForm.coPayType === 'Patient Pays' ? 'bg-indigo-100' : 'bg-white'}`}><span className={paymentForm.coPayType === 'Patient Pays' ? 'text-indigo-700' : 'text-gray-500'}>Total:</span> <span className={`font-bold ${paymentForm.coPayType === 'Patient Pays' ? 'text-indigo-800' : 'text-gray-800'}`}>{formatAED(paymentForm.totalClaimAmount || parseFloat(paymentForm.claimAmount) || 0)}</span></div>
                            {paymentForm.advanceStatus === 'Full Pay' && <div className="bg-green-100 rounded p-1.5 shadow-sm"><span className="text-green-700">Paid:</span> <span className="font-semibold text-green-800">{formatAED(paymentForm.totalClaimAmount || parseFloat(paymentForm.claimAmount) || 0)}</span></div>}
                            {paymentForm.advanceStatus === 'Partial Pay' && <><div className="bg-green-100 rounded p-1.5 shadow-sm"><span className="text-green-700">Paid:</span> <span className="font-semibold text-green-800">{formatAED(paymentForm.advanceAmount || 0)}</span></div><div className="bg-orange-100 rounded p-1.5 shadow-sm"><span className="text-orange-700">Pending:</span> <span className="font-semibold text-orange-800">{formatAED(paymentForm.pendingClaimAmount || 0)}</span></div></>}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {paymentForm.claimType === 'Advance' && (
                    <div className="bg-orange-50 rounded-lg p-4 border border-orange-200 space-y-4">
                      <h4 className="text-sm font-semibold text-orange-800">Advance Claim Details</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Advance Status</label>
                          <select name="advanceStatus" value={paymentForm.advanceStatus} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900 bg-white">
                            <option value="Full Pay">Full Pay</option>
                            <option value="Partial Pay">Partial Pay</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">Advance Amount</label>
                          <input type="number" name="advanceAmount" value={paymentForm.advanceAmount} onChange={handlePaymentChange} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 text-gray-900 font-semibold" placeholder="0.00" min="0" step="0.01" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-orange-700 bg-orange-100 px-3 py-2 rounded-lg">
                        <Info className="w-3.5 h-3.5" /> No transaction ID or attachment required for advance claims.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ===== STEP 6: Review & Submit ===== */}
              {currentStep === 6 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Review & Submit</h3>
                    <p className="text-sm text-gray-500">Confirm all details before submitting the claim.</p>
                  </div>

                  {/* Patient & Insurance - Combined Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Patient */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-800">Patient</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Name</span>
                          <span className="font-medium text-gray-900">{selectedPatient?.firstName} {selectedPatient?.lastName}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Gender</span>
                          <span className="font-medium text-gray-900">{selectedPatient?.gender || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Phone</span>
                          <span className="font-medium text-gray-900">{selectedPatient?.mobileNumber || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">EMR</span>
                          <span className="font-medium text-gray-900">{selectedPatient?.emrNumber || 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Insurance */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                          <Shield className="w-4 h-4 text-gray-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-800">Insurance</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Provider</span>
                          <span className="font-medium text-gray-900">{insuranceForm.insuranceProvider}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Policy</span>
                          <span className="font-medium text-gray-900">{insuranceForm.policyNumber}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Expiry</span>
                          <span className="font-medium text-gray-900">{insuranceForm.expiryDate ? new Date(insuranceForm.expiryDate).toLocaleDateString() : '-'}</span>
                        </div>
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-gray-500">Urgency</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${insuranceForm.urgency === 'High' ? 'bg-red-50 text-red-700 border border-red-200' : insuranceForm.urgency === 'Priority' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-gray-100 text-gray-700 border border-gray-200'}`}>{insuranceForm.urgency}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Claim Source & Payment - Combined Row */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Claim Source */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                          <ClipboardList className="w-4 h-4 text-gray-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-800">Claim Source</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Department</span>
                          <span className="font-medium text-gray-900">{claimSourceForm.departmentName || '-'}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Doctor</span>
                          <span className="font-medium text-gray-900">{claimSourceForm.doctorName || '-'}</span>
                        </div>
                        <div className="text-xs">
                          <span className="text-gray-500">Services</span>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {claimSourceForm.services.length > 0 ? claimSourceForm.services.map((s: any, i: number) => (
                              <span key={i} className="px-2 py-0.5 rounded bg-gray-200 text-gray-700 text-[10px] font-medium">{s.serviceName}</span>
                            )) : <span className="font-medium text-gray-400">-</span>}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Payment */}
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                          <Calculator className="w-4 h-4 text-gray-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-800">Payment</h4>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Amount</span>
                          <span className="font-bold text-gray-900">{formatAED(parseFloat(paymentForm.claimAmount) || 0)}</span>
                        </div>
                        <div className="flex justify-between text-xs items-center">
                          <span className="text-gray-500">Type</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${paymentForm.claimType === 'Advance' ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>{paymentForm.claimType}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Co-Pay</span>
                          <span className="font-medium text-gray-900">{paymentForm.coPayPercent || 0}% ({paymentForm.coPayType})</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Status</span>
                          <span className="font-medium text-gray-900">{paymentForm.advanceStatus}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Paid Amount</span>
                          <span className="font-bold text-gray-900">{formatAED(paymentForm.advanceAmount || 0)}</span>
                        </div>
                        {paymentForm.claimType === 'Paid' && paymentForm.transactionId && (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Trans ID</span>
                            <span className="font-mono font-medium text-gray-900 text-[10px]">{paymentForm.transactionId}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Documents & Files */}
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                        <Paperclip className="w-4 h-4 text-gray-600" />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-800">Documents & Files</h4>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Insurance Card */}
                      <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileImage className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">Insurance Card</p>
                            <p className="text-[10px] text-gray-400 truncate">{insuranceForm.insuranceCardFile ? 'Uploaded' : 'Not uploaded'}</p>
                          </div>
                        </div>
                        {insuranceForm.insuranceCardFile && (
                          <button onClick={() => setDocViewerUrl(insuranceForm.insuranceCardFile)} className="flex-shrink-0 p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Table of Benefits */}
                      <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">Table of Benefits</p>
                            <p className="text-[10px] text-gray-400 truncate">{insuranceForm.tableOfBenefitsFile ? 'Uploaded' : 'Not uploaded'}</p>
                          </div>
                        </div>
                        {insuranceForm.tableOfBenefitsFile && (
                          <button onClick={() => setDocViewerUrl(insuranceForm.tableOfBenefitsFile)} className="flex-shrink-0 p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* EMRI Front */}
                      <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileImage className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">EMRI Front Photo</p>
                            <p className="text-[10px] text-gray-400 truncate">{insuranceForm.emriFrontPhoto ? 'Uploaded' : 'Not uploaded'}</p>
                          </div>
                        </div>
                        {insuranceForm.emriFrontPhoto && (
                          <button onClick={() => setDocViewerUrl(insuranceForm.emriFrontPhoto)} className="flex-shrink-0 p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* EMRI Back */}
                      <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileImage className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">EMRI Back Photo</p>
                            <p className="text-[10px] text-gray-400 truncate">{insuranceForm.emriBackPhoto ? 'Uploaded' : 'Not uploaded'}</p>
                          </div>
                        </div>
                        {insuranceForm.emriBackPhoto && (
                          <button onClick={() => setDocViewerUrl(insuranceForm.emriBackPhoto)} className="flex-shrink-0 p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors" title="View">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Claim Documents */}
                      <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100 sm:col-span-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700">Claim Documents</p>
                            <p className="text-[10px] text-gray-400">{paymentForm.documentFiles.length > 0 ? `${paymentForm.documentFiles.length} file(s) uploaded` : 'Not uploaded'}</p>
                          </div>
                        </div>
                        {paymentForm.documentFiles.length > 0 && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {paymentForm.documentFiles.map((f: string, i: number) => (
                              <button key={i} onClick={() => setDocViewerUrl(f)} className="p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors" title={`View doc ${i + 1}`}>
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Payment Attachment */}
                      {paymentForm.claimType === 'Paid' && (
                        <div className="flex items-center justify-between bg-white rounded-lg p-2.5 border border-gray-100 sm:col-span-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Paperclip className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-gray-700">Payment Attachment</p>
                              <p className="text-[10px] text-gray-400">{paymentForm.attachment ? 'Uploaded' : 'Not uploaded'}</p>
                            </div>
                          </div>
                          {paymentForm.attachment && (
                            <button onClick={() => setDocViewerUrl(paymentForm.attachment)} className="flex-shrink-0 p-1.5 text-teal-600 hover:bg-teal-50 rounded-md transition-colors" title="View">
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {paymentForm.notes && (
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center">
                          <Info className="w-4 h-4 text-gray-600" />
                        </div>
                        <h4 className="text-sm font-semibold text-gray-800">Notes</h4>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed pl-10">{paymentForm.notes}</p>
                    </div>
                  )}

                  {balance.pendingClaim > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <p className="text-sm text-amber-800">This patient has a pending claim of <strong>{formatAED(balance.pendingClaim)}</strong>. Clear it first before creating a new claim.</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Navigation Buttons - Outside scrollable area */}
            <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-b-2xl">
              <button onClick={currentStep === 1 ? closeModal : prevStep} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" /> {currentStep === 1 ? 'Cancel' : 'Back'}
              </button>
              <div className="flex items-center gap-2">
                {currentStep < 6 && (
                  <button onClick={nextStep} disabled={
                    (currentStep === 1 && !canProceedStep1) ||
                    (currentStep === 2 && !canProceedStep2) ||
                    (currentStep === 4 && !canProceedStep4) ||
                    (currentStep === 5 && !canProceedStep5)
                  } className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                )}
                {currentStep === 6 && (
                  <button onClick={submitClaim} disabled={submitting || balance.pendingClaim > 0} className="flex items-center gap-1.5 px-6 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</> : <><CheckCircle className="w-4 h-4" /> Submit Claim</>}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body)}

      {/* Claim View Modal */}
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

      {/* Claim Tracking Modal */}
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
                              <div className="flex items-center gap-1.5"><User className="w-3 h-3 text-gray-400" /><span className="text-gray-500">{step.type === 'released' ? 'By' : step.type === 'approved' ? 'By' : 'By'}:</span> <span className="font-semibold">{step.reviewer || "N/A"}</span></div>
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

      {/* ==================== CLAIM CREDIT TRANSFER MODAL ==================== */}
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
                  <>
                    <button onClick={startTransfer} className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">
                      Continue <ChevronRight className="w-4 h-4" />
                    </button>
                  </>
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

      {/* Document Viewer Modal */}
      {docViewerUrl && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/90 backdrop-blur-md" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh' }}>
          <div className="absolute top-4 right-4 z-20"><button onClick={() => setDocViewerUrl(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white"><X className="w-6 h-6" /></button></div>
          <div className="w-full max-w-5xl h-[85vh] flex items-center justify-center">
            {docViewerUrl.toLowerCase().endsWith('.pdf') ? <iframe src={docViewerUrl} className="w-full h-full rounded-lg shadow-2xl bg-white" title="Document Preview" /> : <img src={docViewerUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />}
          </div>
        </div>
      , document.body)}
    </div>
  );
}

CreateClaimPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedCreateClaimPage = withClinicAuth(CreateClaimPage) as typeof CreateClaimPage;
ProtectedCreateClaimPage.getLayout = CreateClaimPage.getLayout;

export default ProtectedCreateClaimPage;

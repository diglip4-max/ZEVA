"use client";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import ClinicLayout from "../../components/ClinicLayout";
import AgentLayout from "../../components/AgentLayout";
import withClinicAuth from "../../components/withClinicAuth";
import withAgentAuth from "../../components/withAgentAuth";
import { Search, Filter, CheckCircle, XCircle, Eye, FileText, Upload, X, AlertCircle, Clock, Shield, Calendar, Clock as ClockIcon, CheckSquare, Square, Activity, User, Stethoscope, Wallet, Paperclip, ClipboardList, CalendarClock, BadgeCheck, Building2, PlusCircle, Phone, ArrowRight } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currencyHelper";

const TOKEN_PRIORITY = ["clinicToken", "doctorToken", "agentToken", "staffToken", "userToken", "adminToken"];

// Helper function to get user role — URL-based, no cross-role token scanning
const getUserRole = () => {
  if (typeof window === 'undefined') return null;
  const pathname = window.location.pathname;
  // /clinic/ paths are always clinic context
  if (pathname.startsWith('/clinic/')) return 'clinic';
  // /staff/ and /agent/ paths — decode role from agent/user token
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

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    try {
      const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (value) return value;
    } catch (error) {
      continue;
    }
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

// Determine access level based on current route AND token
// Route takes precedence - if route is /clinic/* use clinic logic, if /staff/* or /agent/* use staff logic
const getAccessLevel = () => {
  if (typeof window === 'undefined') return null;

  const currentPath = window.location.pathname;

  // Determine access level based on route prefix
  if (currentPath.startsWith('/clinic/')) {
    // Clinic route - show all doctor staff claims for the clinic
    return 'clinic';
  } else if (currentPath.startsWith('/staff/') || currentPath.startsWith('/agent/')) {
    // Staff/Agent route - show all doctor staff claims for the clinic (staff can see all)
    return 'staff';
  }

  // Fallback to token-based logic if route doesn't match
  const role = getUserRole();
  if (role === 'doctorStaff') {
    return 'doctorStaff';
  }

  // Default to clinic level if no specific route match
  return 'clinic';
};

// Get the appropriate token for the current access level
const getAccessLevelToken = () => {
  if (typeof window === 'undefined') return null;

  const accessLevel = getAccessLevel();

  if (accessLevel === 'clinic') {
    // Clinic route - use clinic token
    return localStorage.getItem('clinicToken') || sessionStorage.getItem('clinicToken') || getStoredToken();
  } else if (accessLevel === 'staff') {
    // Staff/Agent route - prefer staff/agent token
    return localStorage.getItem('staffToken') ||
      sessionStorage.getItem('staffToken') ||
      localStorage.getItem('agentToken') ||
      sessionStorage.getItem('agentToken') ||
      getStoredToken();
  }

  // Default - use stored token
  return getStoredToken();
};

// Permission constants for doctor_claim submodule
const CLAIM_MODULE_KEY = "doctor_claim";
const CLAIM_PARENT_MODULE_KEY = "claims";

// Permission helper functions
const isTruthy = (val) =>
  val === true || val === "true" || String(val || "").toLowerCase() === "true";

const findClaimModule = (permissionsList) =>
  permissionsList.find((p) => {
    if (!p?.module) return false;
    const mod = String(p.module).toLowerCase();
    return mod === CLAIM_PARENT_MODULE_KEY;
  });

const findSubModulePermission = (parentModule, subModuleKey) => {
  if (!parentModule?.subModules || !Array.isArray(parentModule.subModules)) return null;
  return parentModule.subModules.find(
    (sm) => String(sm.moduleKey || "").toLowerCase() === subModuleKey.toLowerCase()
  );
};

const parsePermissionActions = (actions = {}) => {
  const moduleAll = isTruthy(actions.all);
  return {
    canRead: moduleAll || isTruthy(actions.read),
    canCreate: moduleAll || isTruthy(actions.create),
    canUpdate: moduleAll || isTruthy(actions.update),
    canDelete: moduleAll || isTruthy(actions.delete),
  };
};

const maskMobileNumber = (mobile) => {
  if (!mobile || mobile.length < 4) return mobile;
  const firstTwo = mobile.slice(0, 2);
  const lastTwo = mobile.slice(-2);
  const middleLength = mobile.length - 4;
  return `${firstTwo}${'*'.repeat(middleLength)}${lastTwo}`;
};

const getInitials = (first, last) => {
  const initials = `${(first || "").charAt(0)}${(last || "").charAt(0)}`.trim().toUpperCase();
  return initials || "–";
};

// Shared modal section card — clean, shadow-based instead of hard borders
const ModalSection = ({ icon, title, subtitle, children }) => (
  <section className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
    <div className="px-5 py-3.5 flex items-center gap-3">
      <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-gray-900 leading-tight">{title}</h3>
        {subtitle && <p className="text-[11px] text-gray-400 leading-tight mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="px-5 pb-5">{children}</div>
  </section>
);

// Clean label/value tile — no borders, just typography
const InfoTile = ({ label, value, className }) => (
  <div className={`py-1.5 ${className || ""}`}>
    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
    <div className="text-sm font-semibold text-gray-900 break-words">{value}</div>
  </div>
);

const ITEMS_PER_PAGE = 10;

function AllClaimsPage() {
  const [claims, setClaims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Under Review");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewModal, setViewModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [showTracking, setShowTracking] = useState(false);
  const [claimDetails, setClaimDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [textPreview, setTextPreview] = useState(null); // { title: string, text: string }
  const [rejectedNotifications, setRejectedNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [approvalModal, setApprovalModal] = useState(null);
  const [approvalStep, setApprovalStep] = useState(1);
  const [appointmentData, setAppointmentData] = useState({ startDate: "", fromTime: "", toTime: "" });
  const [bookedAppointment, setBookedAppointment] = useState(null);
  const [existingAppointments, setExistingAppointments] = useState([]);
  const [loadingExistingAppointments, setLoadingExistingAppointments] = useState(false);
  const [progressStatus, setProgressStatus] = useState(null);
  const [consentStatus, setConsentStatus] = useState(null);
  const [addTreatmentPlan, setAddTreatmentPlan] = useState(false);
  const [treatmentPlanText, setTreatmentPlanText] = useState("");
  const [userRole, setUserRole] = useState(null);
  const [currency, setCurrency] = useState("INR");
  // Approve claim confirmation modal (expected release date is compulsory)
  const [approveClaimModal, setApproveClaimModal] = useState(null);
  const [expectedReleaseDate, setExpectedReleaseDate] = useState("");
  // Doctor claim amount adjustment (Same Amount / Add Extra)
  const [amountOption, setAmountOption] = useState("same");
  const [doctorAddedAmount, setDoctorAddedAmount] = useState("");
  const [doctorAddedNotes, setDoctorAddedNotes] = useState("");
  const [adjustmentSaving, setAdjustmentSaving] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState("");
  // Patient's previous claims (shown in View modal)
  const [patientHistory, setPatientHistory] = useState([]);
  const [patientHistoryLoading, setPatientHistoryLoading] = useState(false);
  // Create-plan flow fields (Steps 1-3 of the multi-step approval modal)
  const [planEmirNumber, setPlanEmirNumber] = useState("");
  const [planInvoiceNumber, setPlanInvoiceNumber] = useState("");
  const [planPaymentMethod, setPlanPaymentMethod] = useState("");
  const [planDiagnosis, setPlanDiagnosis] = useState("");
  const [planSaving, setPlanSaving] = useState(false);
    const [confirmChecklist, setConfirmChecklist] = useState({ appointment: false, treatmentPlan: false, consentForm: false, progressNotes: false });

  // Set user role on mount
  useEffect(() => {
    const role = getUserRole();
    setUserRole(role);
  }, []);

  useEffect(() => {
    const fetchClinicCurrency = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;
        const res = await axios.get('/api/clinics/myallClinic', { headers: authHeaders });
        if (res.data.success && res.data.clinic?.currency) {
          setCurrency(res.data.clinic.currency);
        }
      } catch (e) {
        console.error('Error fetching clinic currency:', e);
      }
    };
    fetchClinicCurrency();
  }, []);

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

    // Admin gets full permissions
    if (userRole === "admin") {
      if (!isMounted) return;
      setPermissions({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      });
      setPermissionsLoaded(true);
      return () => {
        isMounted = false;
      };
    }

    // Clinic/Doctor role - use sidebar-permissions API
    if (userRole === "clinic" || userRole === "doctor") {
      const fetchClinicPermissions = async () => {
        try {
          const clinicAuthToken = clinicToken || doctorToken || authToken;
          if (!clinicAuthToken) {
            if (!isMounted) return;
            setPermissions({
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
            });
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
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
          } else if (res.data.success) {
            const parentModule = findClaimModule(res.data.permissions);

            if (parentModule) {
              const subModule = findSubModulePermission(parentModule, CLAIM_MODULE_KEY);
              if (subModule) {
                console.log("[all-claims] Submodule permission found:", subModule);
                setPermissions(parsePermissionActions(subModule.actions || {}));
              } else {
                console.log("[all-claims] No submodule found, using parent module actions");
                setPermissions(parsePermissionActions(parentModule.actions || {}));
              }
            } else {
              console.log("[all-claims] No parent claims module found");
              setPermissions({
                canRead: true,
                canCreate: false,
                canUpdate: false,
                canDelete: false,
              });
            }
          } else {
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
          }
        } catch (err) {
          console.error("Error fetching clinic sidebar permissions:", err);
          if (isMounted) {
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
          }
        } finally {
          if (isMounted) setPermissionsLoaded(true);
        }
      };

      fetchClinicPermissions();
      return () => {
        isMounted = false;
      };
    }

    // Agent/DoctorStaff/Staff role - use get-module-permissions API
    const agentStaffToken = getStoredToken();
    if (!agentStaffToken) {
      setPermissions({
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      });
      setPermissionsLoaded(true);
      return () => {
        isMounted = false;
      };
    }

    if (
      agentToken ||
      staffToken ||
      userToken ||
      userRole === "agent" ||
      userRole === "doctorStaff" ||
      userRole === "staff"
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
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
            return;
          }

          if (res.data?.success && res.data?.permissions) {
            setPermissions(parsePermissionActions(res.data.permissions.actions || {}));
          } else {
            setPermissions({
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
            });
          }
        } catch (err) {
          console.error("Error fetching agent permissions:", err);
          if (isMounted) {
            setPermissions({
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
            });
          }
        } finally {
          if (isMounted) setPermissionsLoaded(true);
        }
      };

      fetchAgentPermissions();
    } else {
      setPermissions({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      });
      setPermissionsLoaded(true);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch claims only after permissions are loaded and canRead is true
  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!permissions.canRead) {
      setClaims([]);
      setLoading(false);
      return;
    }
    fetchClaims();
  }, [permissionsLoaded, permissions.canRead]);

  const fetchClaims = async () => {
    setLoading(true);
    try {
      // Get token and access level based on route priority
      const accessLevel = getAccessLevel();
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;

      // Pass access level to API for proper filtering
      const res = await axios.get(`/api/clinic/insurance-claims?accessLevel=${accessLevel}`, { headers });
      if (res.data.success) {
        const allClaims = res.data.data || [];
        setClaims(allClaims);

        // Find claims for notifications:
        // 1. Claims rejected back from pass-claims (rejectedFromPassClaims flag)
        // 2. Claims with status "Rejected"
        // 3. Claims with rejectedFromReleaseRequested (shown in Rejected tab)
        // 4. Claims with status "Under Review" (newly created claims)
        const recentlyRejected = allClaims
          .filter(
            (c) =>
              c.status === "Under Review" ||
              c.status === "Rejected"
          )
          // Deduplicate by _id to prevent same claim appearing multiple times
          .filter((claim, index, self) =>
            index === self.findIndex((c) => c._id === claim._id)
          );
        setRejectedNotifications(recentlyRejected);
      }
    } catch (err) {
      console.error("Fetch error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchClaimDetails = async (claimId) => {
    setDetailLoading(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const res = await axios.get(`/api/clinic/insurance-claims/${claimId}`, { headers });
      if (res.data.success) {
        setClaimDetails(res.data.data);
      }
    } catch (err) {
      console.error("Fetch detail error:", err.response?.data || err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  // Fetch all claims belonging to a patient, excluding the currently viewed one
  const fetchPatientHistory = async (patientId, excludeId) => {
    setPatientHistoryLoading(true);
    setPatientHistory([]);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const res = await axios.get(`/api/clinic/insurance-claims?patientId=${patientId}`, { headers });
      if (res.data.success) {
        setPatientHistory((res.data.data || []).filter((c) => c._id !== excludeId));
      }
    } catch (err) {
      console.error("Error fetching patient claim history:", err);
      setPatientHistory([]);
    } finally {
      setPatientHistoryLoading(false);
    }
  };

  const handleViewClaim = (claim) => {
    setViewModal(claim);
    setShowTracking(false);
    setClaimDetails(null);
    // Initialise claim amount adjustment state from the stored doctor added values
    if (claim.doctorAddedClaimAmount !== null && claim.doctorAddedClaimAmount !== undefined) {
      setAmountOption("extra");
      setDoctorAddedAmount(String(claim.doctorAddedClaimAmount));
      setDoctorAddedNotes(claim.doctorAddedClaimNotes || "");
    } else {
      setAmountOption("same");
      setDoctorAddedAmount("");
      setDoctorAddedNotes("");
    }
    setAdjustmentError("");
    fetchClaimDetails(claim._id);
    if (claim.patientId) fetchPatientHistory(claim.patientId, claim._id);
  };

  const handleRemoveFile = async (field, fileUrl = null) => {
    if (!window.confirm("Are you sure you want to remove this document?")) return;

    setActionLoading(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      let updatedData = {};

      if (field === 'documentFiles') {
        const newFiles = viewModal.documentFiles.filter(f => f !== fileUrl);
        updatedData = { documentFiles: newFiles };
      } else {
        updatedData = { [field]: null };
      }

      const res = await axios.patch(`/api/clinic/insurance-claims/${viewModal._id}`, updatedData, { headers });

      if (res.data.success) {
        setViewModal({ ...viewModal, ...updatedData });
        setClaims(claims.map(c => c._id === viewModal._id ? { ...c, ...updatedData } : c));
        setPreviewFile(null); // Close preview after deletion
        setSuccessMsg("Document removed successfully");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      console.error("Remove file error:", err.response?.data || err.message);
      alert("Failed to remove documentd");
    } finally {
      setActionLoading(false);
    }
  };

  const filteredClaims = useMemo(() => {
    return claims
      .filter((c) => {
        if (activeTab === "Finance Checked Claims") return c.status === "Ready";
        if (activeTab === "Completed") return c.status === "Completed";
        if (activeTab === "Rejected") return c.status === "Rejected" || (c.status === "Under Review" && c.rejectedFromReleaseRequested === true);
        return c.status === activeTab;
      })
      .filter((c) => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return (
          c.patientFirstName?.toLowerCase().includes(term) ||
          c.patientLastName?.toLowerCase().includes(term) ||
          c.policyNumber?.toLowerCase().includes(term) ||
          c.insuranceProvider?.toLowerCase().includes(term) ||
          c.departmentName?.toLowerCase().includes(term) ||
          c.serviceName?.toLowerCase().includes(term) ||
          c.doctorName?.toLowerCase().includes(term)
        );
      });
  }, [claims, activeTab, searchTerm]);

  const paginatedClaims = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredClaims.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredClaims, currentPage]);

  const totalPages = Math.ceil(filteredClaims.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, searchTerm]);

  // Open the approve confirmation modal — expected release date is compulsory
  const openApproveClaimModal = (claim) => {
    if (!permissions.canUpdate) {
      alert("You don't have permission to approve claims");
      return;
    }
    setApproveClaimModal(claim);
    setExpectedReleaseDate("");
  };

  const confirmApproveClaim = async () => {
    if (!approveClaimModal) return;
    if (!expectedReleaseDate) {
      alert("Please select the expected release date");
      return;
    }
    setActionLoading(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const res = await axios.patch(
        "/api/clinic/insurance-claims/review",
        { claimId: approveClaimModal._id, action: "approve", expectedReleaseDate },
        { headers }
      );
      if (res.data.success) {
        setClaims((prev) => prev.map((c) => (c._id === res.data.data._id ? res.data.data : c)));
        setApproveClaimModal(null);
        setExpectedReleaseDate("");
        setSuccessMsg("Claim approved successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve claim");
    } finally {
      setActionLoading(false);
    }
  };

  // Save the doctor claim amount adjustment (Same Amount / Add Extra with compulsory notes)
  const handleSaveClaimAmountAdjustment = async () => {
    if (!viewModal) return;
    if (!permissions.canUpdate) {
      setAdjustmentError("You don't have permission to update claims");
      return;
    }
    const isExtra = amountOption === "extra";
    const parsedAmount = parseFloat(doctorAddedAmount);
    if (isExtra) {
      if (!doctorAddedAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
        setAdjustmentError("Please enter a valid extra amount greater than 0");
        return;
      }
      if (!doctorAddedNotes.trim()) {
        setAdjustmentError("Adjustment notes are required when adding an extra amount");
        return;
      }
    }
    setAdjustmentError("");
    setAdjustmentSaving(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const baseClaimAmount = Number(viewModal.claimAmount || 0);
      const payload = isExtra
        ? { doctorAddedClaimAmount: parsedAmount, doctorAddedClaimNotes: doctorAddedNotes.trim(), finalClaimAmount: Math.round((baseClaimAmount + parsedAmount) * 100) / 100 }
        : { doctorAddedClaimAmount: null, doctorAddedClaimNotes: "", finalClaimAmount: baseClaimAmount };
      const res = await axios.patch(`/api/clinic/insurance-claims/${viewModal._id}`, payload, { headers });
      if (res.data.success) {
        setViewModal((prev) => ({ ...prev, ...payload }));
        setClaims((prev) => prev.map((c) => (c._id === viewModal._id ? { ...c, ...payload } : c)));
        setSuccessMsg(isExtra ? "Extra claim amount saved successfully" : "Claim amount set to the original amount");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      setAdjustmentError(err.response?.data?.message || "Failed to save claim amount adjustment");
    } finally {
      setAdjustmentSaving(false);
    }
  };

  // Function to fetch existing appointments for a patient created after the claim
  const fetchExistingAppointments = async (claim) => {
    if (!claim?.patientId) return;
    setLoadingExistingAppointments(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const res = await axios.get(`/api/clinic/patient-appointment-history/${claim.patientId}`, { headers });
      if (res.data.success && res.data.appointments) {
        const claimCreatedAt = new Date(claim.createdAt);
        // Only show appointments created AFTER the insurance claim creation date
        const postClaimAppointments = res.data.appointments
          .filter((apt) => new Date(apt.createdAt) > claimCreatedAt)
          .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
        setExistingAppointments(postClaimAppointments);
      } else {
        setExistingAppointments([]);
      }
    } catch (err) {
      console.error("Failed to fetch existing appointments:", err);
      setExistingAppointments([]);
    } finally {
      setLoadingExistingAppointments(false);
    }
  };

  const openApprovalModal = async (claim) => {
    // Check permission before opening modal
    if (!permissions.canCreate) {
      alert("You don't have permission to create treatment plans");
      return;
    }
    setApprovalModal(claim);
    setApprovalStep(1);
    setAppointmentData({ startDate: "", fromTime: "", toTime: "" });
    setBookedAppointment(null);
    setProgressStatus(null);
    setConsentStatus(null);
    setAddTreatmentPlan(false);
    setTreatmentPlanText("");
    setConfirmChecklist({ appointment: false, treatmentPlan: false, consentForm: false, progressNotes: false });
    // Reset create-plan flow fields
    setPlanEmirNumber(approvalModal?.emirNumber || claim?.emirNumber || "");
    setPlanInvoiceNumber(approvalModal?.invoiceNumber || claim?.invoiceNumber || "");
    setPlanPaymentMethod(approvalModal?.paymentMethod || claim?.paymentMethod || "");
    setPlanDiagnosis(approvalModal?.diagnosis || claim?.diagnosis || "");
    setPlanSaving(false);

    // Fetch existing appointments for this patient
    await fetchExistingAppointments(claim);
  };

  const handleBookAppointment = async () => {
    if (!appointmentData.startDate || !appointmentData.fromTime || !appointmentData.toTime) {
      alert("Please fill in all appointment fields (start date, from time, to time)");
      return;
    }
    setActionLoading(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const res = await axios.post(
        "/api/clinic/appointments",
        {
          patientId: approvalModal.patientId,
          doctorId: approvalModal.doctorId,
          status: "booked",
          referral: "direct",
          emergency: "no",
          followType: "follow up",
          startDate: appointmentData.startDate,
          fromTime: appointmentData.fromTime,
          toTime: appointmentData.toTime,
        },
        { headers }
      );
      if (res.data?.success) {
        setBookedAppointment(res.data.appointment);
        setSuccessMsg("Appointment booked successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
        // Refresh appointments list to show the newly booked one
        await fetchExistingAppointments(approvalModal);
        // Reset form
        setAppointmentData({ startDate: "", fromTime: "", toTime: "" });
      } else {
        alert(res.data?.message || "Failed to book appointment");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to book appointment");
    } finally {
      setActionLoading(false);
    }
  };

  const checkProgressStatus = async (patientId) => {
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;

      // Fetch all progress notes for this patient
      const res = await axios.get(`/api/clinic/progress-notes?patientId=${patientId}`, { headers });

      if (res.data.success) {
        const allNotes = res.data.notes || [];
        // Filter to only notes linked to post-claim appointments
        const postClaimAptIds = existingAppointments.map((a) => a._id);
        const relevantNotes = allNotes.filter((n) => postClaimAptIds.includes(n.appointmentId?.toString() || n.appointmentId));

        setProgressStatus({
          hasProgress: relevantNotes.length > 0,
          count: relevantNotes.length,
          notes: relevantNotes,
          appointments: existingAppointments,
        });
      } else {
        setProgressStatus({ hasProgress: false, count: 0, notes: [], appointments: existingAppointments });
      }
    } catch (err) {
      console.error("Failed to check progress:", err);
      setProgressStatus({ hasProgress: false, count: 0, notes: [], appointments: existingAppointments });
    }
  };

  const checkConsentStatus = async () => {
    if (existingAppointments.length === 0) {
      alert("No appointments found after claim creation date");
      return;
    }
    setActionLoading(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const patientId = approvalModal.patientId;

      // Fetch consent logs and consent signatures for patient
      const [logRes, statusRes] = await Promise.all([
        axios.get(`/api/clinic/consent-log?patientId=${patientId}`, { headers }),
        axios.get(`/api/clinic/consent-status?patientId=${patientId}`, { headers }),
      ]);

      const consentLogs = logRes.data.success ? (logRes.data.consentLogs || []) : [];
      const consentStatuses = statusRes.data.success ? (statusRes.data.consentStatuses || []) : [];

      // Group consent data by appointment
      // Note: consent-status (ConsentSignature) does NOT have appointmentId,
      // so we link signatures to appointments via consentFormId through consent logs
      const consentByAppointment = existingAppointments.map((apt) => {
        const aptId = apt._id;
        const aptLogs = consentLogs.filter((l) => l.appointmentId === aptId);

        // Match signatures to this appointment via consentFormId from the consent logs
        const aptConsentFormIds = aptLogs.map((l) => l.consentFormId?.toString() || l.consentFormId);
        const aptSignatures = consentStatuses.filter((s) =>
          aptConsentFormIds.includes(s.consentFormId?.toString() || s.consentFormId)
        );

        const hasSigned = aptSignatures.some((s) => s.status === "signed" || s.hasSignature);
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

      // Overall validation: all appointments must have signed consent
      const allSigned = consentByAppointment.every((c) => c.isSigned);
      const allHaveConsent = consentByAppointment.every((c) => c.hasConsent);

      setConsentStatus({
        status: allSigned ? "signed" : allHaveConsent ? "sent" : "not_sent",
        consentByAppointment,
        allSigned,
        allHaveConsent,
        count: consentByAppointment.filter((c) => c.hasConsent).length,
        details: consentStatuses,
        logs: consentLogs,
      });

      setApprovalStep(7);
    } catch (err) {
      console.error("Failed to check consent status:", err);
      setConsentStatus({ status: "not_sent", count: 0, details: [], logs: [], consentByAppointment: [], allSigned: false, allHaveConsent: false });
      setApprovalStep(7);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalApproval = async () => {
    // Validate confirmation checklist
    if (!Object.values(confirmChecklist).every(Boolean)) {
      alert("Please tick all confirmation items before completing the claim.");
      return;
    }

    setActionLoading(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;

      // If treatment plan is added, save it to insurance claim
      if (addTreatmentPlan && treatmentPlanText.trim()) {
        await axios.patch(
          `/api/clinic/insurance-claims/${approvalModal._id}`,
          { treatmentPlan: treatmentPlanText },
          { headers }
        );
      }

      // Save create-plan flow fields (EMIR, invoice, payment method, diagnosis)
      const planPayload = {};
      if (planEmirNumber.trim()) planPayload.emirNumber = planEmirNumber.trim();
      if (planInvoiceNumber.trim()) planPayload.invoiceNumber = planInvoiceNumber.trim();
      if (planPaymentMethod) planPayload.paymentMethod = planPaymentMethod;
      if (planDiagnosis.trim()) planPayload.diagnosis = planDiagnosis.trim();
      if (Object.keys(planPayload).length > 0) {
        try {
          await axios.patch(
            `/api/clinic/insurance-claims/${approvalModal._id}`,
            planPayload,
            { headers }
          );
        } catch (planErr) {
          alert(planErr.response?.data?.message || "Failed to save plan details");
          return;
        }
      }

      // Complete the claim (new status)
      console.log("[handleFinalApproval] Plan fields saved. Calling complete-claim for claim:", approvalModal._id);
      try {
        const res = await axios.patch(
          "/api/clinic/insurance-claims/complete-claim",
          { claimId: approvalModal._id },
          { headers }
        );
        console.log("[handleFinalApproval] complete-claim response:", res.data);
        if (res.data.success) {
          setClaims((prev) => prev.map((c) => (c._id === res.data.data._id ? res.data.data : c)));
          setApprovalModal(null);
          setSuccessMsg("Claim completed successfully!");
          setTimeout(() => setSuccessMsg(""), 3000);
        }
      } catch (completeErr) {
        console.error("[handleFinalApproval] complete-claim failed:", completeErr.response?.data || completeErr.message);
        alert("Plan details saved, but failed to complete claim: " + (completeErr.response?.data?.message || completeErr.message));
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to complete claim");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    // Check permission before rejecting
    if (!permissions.canUpdate) {
      alert("You don't have permission to reject claims");
      return;
    }
    if (!rejectionReason.trim()) {
      alert("Please provide a rejection reason");
      return;
    }
    setActionLoading(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const res = await axios.patch(
        "/api/clinic/insurance-claims/review",
        { claimId: rejectModal._id, action: "reject", rejectionReason },
        { headers }
      );
      if (res.data.success) {
        setClaims((prev) => prev.map((c) => (c._id === res.data.data._id ? res.data.data : c)));
        setRejectModal(null);
        setRejectionReason("");
        setSuccessMsg("Claim rejected successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reject claim");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      "Under Review": "bg-yellow-100 text-yellow-800",
      "Approved": "bg-green-100 text-green-800",
      "Rejected": "bg-red-100 text-red-800",
      "Released": "bg-blue-100 text-blue-800",
      "Ready": "bg-indigo-100 text-indigo-800",
      "Completed": "bg-purple-100 text-purple-800",
    };
    return styles[status] || "bg-gray-100 text-gray-800";
  };

  // Expected release date tag — SLA state machine rendered as a standard
  // outlined tag (colored border + text, no heavy background) on every card.
  const getExpectedReleaseTag = (claim) => {
    if (!claim.expectedReleaseDate) return null;
    const isReleased =
      claim.status === "Released" ||
      claim.status === "Completed" ||
      !!claim.releasedAt;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expected = new Date(claim.expectedReleaseDate);
    expected.setHours(0, 0, 0, 0);
    const diffDays = Math.round((expected - today) / 86400000);
    const dateStr = expected.toLocaleDateString();
    if (isReleased) return { label: `Achieved Expected Release · ${dateStr}`, cls: "border-green-300 text-green-700", Icon: CheckCircle };
    if (diffDays < 0) return { label: `Overdue Expected Release · ${dateStr}`, cls: "border-red-300 text-red-600", Icon: CalendarClock };
    if (diffDays === 0) return { label: "Expected Release Today", cls: "border-orange-300 text-orange-600", Icon: CalendarClock };
    if (diffDays === 1) return { label: "Expected Release Tomorrow", cls: "border-red-300 text-red-600", Icon: CalendarClock };
    if (diffDays <= 5) return { label: `Expected in ${diffDays} Days · ${dateStr}`, cls: "border-amber-300 text-amber-700", Icon: CalendarClock };
    return { label: `Ongoing Release · ${dateStr}`, cls: "border-blue-300 text-blue-600", Icon: CalendarClock };
  };

  const tabs = ["Under Review", "Approved", "Rejected", "Released", "Finance Checked Claims", "Completed"];
  const tabCounts = {
    "Under Review": claims.filter((c) => c.status === "Under Review").length,
    "Approved": claims.filter((c) => c.status === "Approved").length,
    "Rejected": claims.filter((c) => c.status === "Rejected" || (c.status === "Under Review" && c.rejectedFromReleaseRequested === true)).length,
    "Released": claims.filter((c) => c.status === "Released").length,
    "Finance Checked Claims": claims.filter((c) => c.status === "Ready").length,
    "Completed": claims.filter((c) => c.status === "Completed").length,
  };

  // Show access denied if user doesn't have read permission
  if (permissionsLoaded && !permissions.canRead) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            You don't have permission to view Doctor's Claims. Please contact your administrator to request access.
          </p>

        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-3 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl flex items-center justify-center shadow-sm">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">All Claims</h1>
                <p className="text-sm text-gray-500">Review and manage insurance claims assigned to you</p>
              </div>
            </div>

            {/* Notification Bell */}
            {rejectedNotifications.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {rejectedNotifications.length}
                  </span>
                </button>

                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                    <div className="p-3 border-b border-gray-200 bg-red-50 rounded-t-lg">
                      <h3 className="text-sm font-semibold text-red-900 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                        </svg>
                        Claims Notifications ({rejectedNotifications.length})
                      </h3>
                      <p className="text-xs text-red-700 mt-1">Under Review & Rejected claims</p>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {rejectedNotifications.map((claim) => {
                        // Determine notification type label
                        let notifLabel = "";
                        let notifColor = "";
                        let dotColor = "bg-gray-400";
                        if (claim.rejectedFromPassClaims === true) {
                          notifLabel = "Rejected (Pass-Claims)";
                          notifColor = "text-red-600 bg-red-50";
                          dotColor = "bg-red-500";
                        } else if (claim.status === "Rejected") {
                          notifLabel = "Rejected";
                          notifColor = "text-red-600 bg-red-50";
                          dotColor = "bg-red-500";
                        } else if (claim.status === "Under Review" && claim.rejectedFromReleaseRequested === true) {
                          notifLabel = "Release Rejected";
                          notifColor = "text-orange-600 bg-orange-50";
                          dotColor = "bg-orange-500";
                        } else if (claim.status === "Under Review") {
                          notifLabel = "Under Review";
                          notifColor = "text-blue-600 bg-blue-50";
                          dotColor = "bg-blue-500";
                        }
                        return (
                          <button
                            key={claim._id}
                            onClick={() => {
                              setShowNotifications(false);
                              // Navigate to the correct tab based on claim type
                              if (claim.status === "Rejected") {
                                setActiveTab("Rejected");
                              } else {
                                setActiveTab("Under Review");
                              }
                              handleViewClaim(claim);
                            }}
                            className="w-full p-3 border-b border-gray-100 hover:bg-gray-50 transition-colors text-left"
                          >
                            <div className="flex items-start gap-2">
                              <div className={`w-2 h-2 ${dotColor} rounded-full mt-2 flex-shrink-0`}></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <p className="text-sm font-medium text-gray-900">
                                    {claim.patientFirstName} {claim.patientLastName}
                                  </p>
                                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${notifColor}`}>
                                    {notifLabel}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-500 truncate">
                                  {claim.insuranceProvider} - {getCurrencySymbol(currency)}{claim.claimAmount?.toFixed(2)}
                                </p>
                                {claim.reviewNotes && (
                                  <p className="text-xs text-red-600 mt-1 line-clamp-2">
                                    {claim.reviewNotes}
                                  </p>
                                )}
                                {claim.rejectionReason && (
                                  <p className="text-xs text-red-600 mt-1 line-clamp-2">
                                    {claim.rejectionReason}
                                  </p>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Success message */}
        {successMsg && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span className="text-sm text-green-700">{successMsg}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-4">
          <div className="flex overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab
                  ? "border-teal-600 text-teal-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                {tab}
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                  {tabCounts[tab]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by patient name, policy, provider, department, doctor..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white"
          />
        </div>

        {/* Claims Cards Grid */}
        {filteredClaims.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No claims found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm ? "Try adjusting your search" : `No ${activeTab.toLowerCase()} claims at the moment`}
            </p>
          </div>
        ) : (
          <div className={`grid gap-3 ${activeTab === "Finance Checked Claims" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"}`}>
            {paginatedClaims.map((claim) => {
              const isReleaseRejected = claim.status === "Under Review" && claim.rejectedFromReleaseRequested === true;
              const cardStatus = isReleaseRejected ? "Rejected" : claim.status;
              const compact = activeTab === "Finance Checked Claims";
              return (
              <div
                key={claim._id}
                className={`bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-lg hover:border-teal-300 transition-all overflow-hidden flex flex-col ${compact ? "text-[11px]" : ""}`}
              >
                {/* Card Header — Status */}
                <div className={`border-b border-gray-100 bg-gray-50/60 flex items-center justify-between ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${getStatusBadge(cardStatus)}`}>
                    {claim.status === "Under Review" && !claim.rejectedFromReleaseRequested && <Clock className="w-3 h-3" />}
                    {isReleaseRejected && <XCircle className="w-3 h-3" />}
                    {claim.status === "Approved" && <CheckCircle className="w-3 h-3" />}
                    {claim.status === "Rejected" && <XCircle className="w-3 h-3" />}
                    {claim.status === "Released" && <CheckCircle className="w-3 h-3" />}
                    {claim.status === "Ready" && <CheckSquare className="w-3 h-3" />}
                    {claim.status === "Completed" && <CheckCircle className="w-3 h-3" />}
                    {cardStatus}
                  </span>
                  <span className="text-[11px] text-gray-400 font-medium">{new Date(claim.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Card Body */}
                <div className={`flex-1 ${compact ? "p-3 space-y-2" : "p-4 space-y-3"}`}>
                  {/* Expected Release Tag — top of card, above patient name */}
                  {(() => {
                    const tag = getExpectedReleaseTag(claim);
                    if (!tag) return null;
                    const TagIcon = tag.Icon;
                    return (
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-white ${tag.cls} ${compact ? "self-start" : ""}`}>
                        <TagIcon className="w-3 h-3 shrink-0" />
                        {tag.label}
                      </span>
                    );
                  })()}

                  {/* Patient Info */}
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {getInitials(claim.patientFirstName, claim.patientLastName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {claim.patientFirstName} {claim.patientLastName}
                      </p>
                      {claim.patientEmrNumber && (
                        <p className="text-[10px] font-mono text-teal-600 font-semibold truncate mt-0.5">{claim.patientEmrNumber}</p>
                      )}
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 shrink-0" />
                        {userRole === "doctorStaff"
                          ? (claim.patientMobileNumber ? maskMobileNumber(claim.patientMobileNumber) : "—")
                          : (claim.patientMobileNumber || "—")}
                      </p>
                    </div>
                  </div>

                  {/* EMIR + Invoice reference */}
                  {(claim.emirNumber || claim.invoiceNumber) && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] font-mono text-gray-400">
                      {claim.emirNumber && <span className="truncate">EMIR: {claim.emirNumber}</span>}
                      {claim.invoiceNumber && <span className="truncate">INV: {claim.invoiceNumber}</span>}
                    </div>
                  )}

                  {/* Doctor Info */}
                  <div className="flex items-center gap-2.5 bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                    <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none">Doctor</p>
                      <p className="text-sm font-medium text-gray-900 truncate mt-0.5">{claim.doctorName || "N/A"}</p>
                    </div>
                  </div>

                  {/* Claim Amount & Final Amount */}
                  <div className="flex items-center justify-between gap-2 bg-teal-50 border border-teal-100 rounded-lg px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider leading-none">Claim Amount</p>
                        <p className="text-lg font-bold text-teal-900 mt-0.5">{getCurrencySymbol(currency)}{claim.claimAmount?.toLocaleString()}</p>
                      </div>
                      {claim.finalClaimAmount != null && claim.finalClaimAmount !== claim.claimAmount && (
                        <>
                          <ArrowRight className="w-4 h-4 text-amber-600 shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider leading-none">Final Amount</p>
                            <p className="text-lg font-bold text-amber-900 mt-0.5">{getCurrencySymbol(currency)}{claim.finalClaimAmount?.toLocaleString()}</p>
                          </div>
                        </>
                      )}
                    </div>
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${claim.claimType === "Advance" ? "bg-orange-100 text-orange-800" : "bg-teal-100 text-teal-800"}`}>
                      {claim.claimType}
                    </span>
                  </div>

                  {/* Doctor Added Extra Amount */}
                  {claim.doctorAddedClaimAmount != null && (
                    <div className="flex items-center gap-2 bg-white border border-teal-200 rounded-lg px-3 py-2">
                      <Wallet className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                      <p className="text-xs font-semibold text-teal-800">
                        Extra Amount Added: {getCurrencySymbol(currency)}{claim.doctorAddedClaimAmount?.toLocaleString()}
                      </p>
                    </div>
                  )}

                  {/* Status-specific Action Info */}
                  {claim.status === "Approved" && claim.approvedByName && (
                    <div className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-green-600" />
                        Approved By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.approvedByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.approvedByRole})</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {claim.approvedAt ? new Date(claim.approvedAt).toLocaleString() : ""}
                      </p>
                    </div>
                  )}

                  {claim.status === "Rejected" && claim.rejectedByName && (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <XCircle className="w-3 h-3 text-red-500" />
                        Rejected By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.rejectedByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.rejectedByRole})</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {claim.rejectedAt ? new Date(claim.rejectedAt).toLocaleString() : ""}
                      </p>
                      {claim.rejectionReason && (
                        <div className="mt-2 pt-2 border-t border-gray-200">
                          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-0.5">Rejection Notes</p>
                          <p className="text-[11px] text-red-700 bg-red-50 border border-red-100 rounded p-1.5 leading-relaxed">{claim.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {claim.status === "Released" && claim.releasedByName && (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-blue-600" />
                        Released By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.releasedByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.releasedByRole})</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {claim.releasedAt ? new Date(claim.releasedAt).toLocaleString() : ""}
                      </p>
                    </div>
                  )}

                  {claim.status === "Ready" && claim.readyByName && (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <CheckSquare className="w-3 h-3 text-indigo-600" />
                        Ready By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.readyByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.readyByRole})</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {claim.readyAt ? new Date(claim.readyAt).toLocaleString() : ""}
                      </p>
                    </div>
                  )}

                  {claim.status === "Completed" && claim.completedByName && (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <CheckCircle className="w-3 h-3 text-purple-600" />
                        Completed By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.completedByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.completedByRole})</span>
                      </p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {claim.completedAt ? new Date(claim.completedAt).toLocaleString() : ""}
                      </p>
                    </div>
                  )}

                  {claim.status === "Under Review" && claim.rejectedFromPassClaims === true && (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        Rejected Back from Finance Checking
                      </p>
                      <p className="text-[11px] text-red-700 leading-relaxed">{claim.reviewNotes}</p>
                      {claim.rejectedFromPassClaimsByName && (
                        <p className="text-[11px] text-gray-500 mt-1.5">
                          Rejected by: <span className="font-medium text-gray-700">{claim.rejectedFromPassClaimsByName}</span>
                          <span className="capitalize ml-1">({claim.rejectedFromPassClaimsByRole})</span>
                        </p>
                      )}
                    </div>
                  )}

                  {claim.status === "Under Review" && claim.rejectedFromReleaseRequested === true && (
                    <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                        <AlertCircle className="w-3 h-3 text-red-500" />
                        Rejected from Release
                      </p>
                      <p className="text-[11px] text-red-700 leading-relaxed">{claim.reviewNotes}</p>
                      {claim.rejectedFromReleaseRequestedByName && (
                        <p className="text-[11px] text-gray-500 mt-1.5">
                          Rejected by: <span className="font-medium text-gray-700">{claim.rejectedFromReleaseRequestedByName}</span>
                          <span className="capitalize ml-1">({claim.rejectedFromReleaseRequestedByRole})</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Claim Meta */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Department</p>
                      <p className="text-xs font-medium text-gray-800 truncate mt-0.5">{claim.departmentName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Co-Pay</p>
                      <p className="text-xs font-medium text-gray-800 mt-0.5">{claim.coPayPercent}%</p>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Insurance</p>
                      <p className="text-xs font-medium text-gray-800 truncate mt-0.5">{claim.insuranceProvider} — {claim.policyNumber}</p>
                    </div>
                  </div>
                </div>

                {/* Card Footer — Actions */}
                <div className={`border-t border-gray-100 bg-gray-50/60 flex items-center justify-between ${compact ? "px-3 py-2" : "px-4 py-3"}`}>
                  <span className="text-[11px] text-gray-400 font-medium">
                    #{claim._id?.slice(-6)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewClaim(claim)}
                      className="p-1 text-teal-600 hover:text-teal-700 transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-5 h-5" />
                    </button>
                    {claim.status === "Under Review" && !claim.rejectedFromReleaseRequested && (
                      <>
                        {permissions.canUpdate && (
                          <button
                            onClick={() => openApproveClaimModal(claim)}
                            disabled={actionLoading}
                            className="p-1 text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            <CheckCircle className="w-5 h-5" />
                          </button>
                        )}
                        {permissions.canUpdate && (
                          <button
                            onClick={() => { setRejectModal(claim); setRejectionReason(""); }}
                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    )}
                    {claim.status === "Approved" && permissions.canUpdate && (
                      <button
                        onClick={() => { setRejectModal(claim); setRejectionReason(""); }}
                        className="p-1 text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
                        title="Reject"
                      >
                        <XCircle className="w-5 h-5" />
                      </button>
                    )}
                    {(claim.status === "Rejected" || isReleaseRejected) && permissions.canUpdate && (
                      <button
                        onClick={() => openApproveClaimModal(claim)}
                        disabled={actionLoading}
                        className="p-1 text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <CheckCircle className="w-5 h-5" />
                      </button>
                    )}
                    {claim.status === "Ready" && (
                      <>
                        {permissions.canCreate && (
                          <button
                            onClick={() => openApprovalModal(claim)}
                            className="p-1 text-teal-600 hover:text-teal-700 transition-colors"
                            title="Create Plan"
                          >
                            <FileText className="w-5 h-5" />
                          </button>
                        )}
                        {permissions.canUpdate && (
                          <button
                            onClick={() => { setRejectModal(claim); setRejectionReason(""); }}
                            className="p-1 text-red-500 hover:text-red-700 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-5 h-5" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 mt-4 bg-white rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600">
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredClaims.length)} of {filteredClaims.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prev
              </button>
              <span className="px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-md">{currentPage}</span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* View Detail Modal */}
        {viewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
              {/* Rejection Notice Banner */}
              {viewModal.rejectedFromPassClaims === true && viewModal.reviewNotes && (
                <div className="bg-red-50 border-b border-red-200 px-6 py-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900">Claim Rejected Back from Pass-Claims</p>
                      <p className="text-xs text-red-700 mt-1">{viewModal.reviewNotes}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {getInitials(viewModal.patientFirstName, viewModal.patientLastName)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-900 truncate">
                        {viewModal.patientFirstName} {viewModal.patientLastName}
                      </h2>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${getStatusBadge(viewModal.status)}`}>
                        {viewModal.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span>Claim #{viewModal._id?.slice(-8)}</span>
                      <span className="text-gray-300">•</span>
                      <span>{viewModal.insuranceProvider}</span>
                      <span className="text-gray-300">•</span>
                      <span>Created {new Date(viewModal.createdAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowTracking(!showTracking)}
                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wide transition-all ${showTracking
                      ? "bg-teal-600 text-white shadow-sm"
                      : "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
                      }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    {showTracking ? "View Details" : "Track Claim"}
                  </button>
                  <button onClick={() => {
                    setViewModal(null);
                    setClaimDetails(null);
                  }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="overflow-y-auto bg-gray-50/60 p-5 sm:p-6 space-y-5">
                {showTracking ? (
                  <div className="space-y-8 py-4">
                    {detailLoading ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600 mb-4"></div>
                        <p className="text-sm text-gray-500 font-medium">Fetching tracking data...</p>
                      </div>
                    ) : (
                      <div className="relative">
                        {/* Vertical Line */}
                        <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-gray-100"></div>

                        {(() => {
                          const cd = claimDetails || {};
                          const vm = viewModal || {};
                          const allSteps = [];
                          if (cd.createdAt || vm.createdAt) allSteps.push({ type: "created", date: cd.createdAt || vm.createdAt, title: "Claim Created", name: cd.createdByName || vm.createdByName || "N/A", role: cd.createdByRole || vm.createdByRole || "Staff", label: "Created By" });
                          if (cd.approvedAt || vm.approvedAt) allSteps.push({ type: "approved", date: cd.approvedAt || vm.approvedAt, title: "Claim Approved by Doctor", badge: "Approved", name: cd.approvedByName || vm.approvedByName || vm.doctorName, role: cd.approvedByRole || vm.approvedByRole || "Doctor", label: "Reviewer" });
                          if (cd.rejectedAt || vm.rejectedAt) allSteps.push({ type: "rejected", date: cd.rejectedAt || vm.rejectedAt, title: "Claim Rejected", badge: "Rejected", name: cd.rejectedByName || vm.rejectedByName || vm.doctorName, role: cd.rejectedByRole || vm.rejectedByRole || "Doctor", label: "Reviewer", reason: cd.rejectionReason || vm.rejectionReason });
                          if (cd.rejectedFromPassClaims) allSteps.push({ type: "rejectPass", date: cd.rejectedFromPassClaimsAt, title: "Rejected from Pass Claims", badge: "Pass Reject", name: cd.rejectedFromPassClaimsByName, role: cd.rejectedFromPassClaimsByRole || "Clinic Admin", label: "Reviewer" });
                          if (cd.rejectedFromReleaseRequested) allSteps.push({ type: "rejectRelease", date: cd.rejectedFromReleaseRequestedAt, title: "Rejected from Release", badge: "Release Reject", name: cd.rejectedFromReleaseRequestedByName, role: cd.rejectedFromReleaseRequestedByRole || "Clinic Admin", label: "Reviewer" });
                          if (cd.readyAt || vm.readyAt) allSteps.push({ type: "ready", date: cd.readyAt || vm.readyAt, title: "Claim Checked by Financial Department", subtitle: "Ready", badge: "Ready", name: cd.readyByName || vm.readyByName, role: cd.readyByRole || vm.readyByRole || "Clinic Admin", label: "Checked By" });
                          if (cd.releasedAt || vm.releasedAt) allSteps.push({ type: "released", date: cd.releasedAt || vm.releasedAt, title: "Claim Released", badge: "Released", name: cd.releasedByName || vm.releasedByName, role: cd.releasedByRole || vm.releasedByRole || "Clinic Admin", label: "Released By" });
                          if (cd.completedAt || vm.completedAt) allSteps.push({ type: "completed", date: cd.completedAt || vm.completedAt, title: "Claim Completed with Treatment Plan by Doctor", badge: "Completed", name: cd.completedByName || vm.completedByName, role: cd.completedByRole || vm.completedByRole || "Staff", label: "Completed By" });
                          allSteps.sort((a, b) => new Date(a.date) - new Date(b.date));

                          const iconMap = { created: <FileText className="w-4 h-4 text-teal-600" />, approved: <CheckCircle className="w-4 h-4 text-teal-600" />, rejected: <XCircle className="w-4 h-4 text-red-600" />, rejectPass: <AlertCircle className="w-4 h-4 text-red-600" />, rejectRelease: <AlertCircle className="w-4 h-4 text-red-600" />, ready: <CheckCircle className="w-4 h-4 text-teal-600" />, released: <CheckCircle className="w-4 h-4 text-teal-600" />, completed: <CheckCircle className="w-4 h-4 text-teal-600" /> };
                          const bgMap = { created: "bg-teal-50", approved: "bg-teal-50", rejected: "bg-red-50", rejectPass: "bg-red-50", rejectRelease: "bg-red-50", ready: "bg-teal-50", released: "bg-teal-50", completed: "bg-teal-50" };
                          const badgeColorMap = { created: "text-teal-700 bg-teal-50", approved: "text-teal-700 bg-teal-50", rejected: "text-red-600 bg-red-50", rejectPass: "text-red-600 bg-red-50", rejectRelease: "text-red-600 bg-red-50", ready: "text-teal-700 bg-teal-50", released: "text-teal-700 bg-teal-50", completed: "text-teal-700 bg-teal-50" };

                          return allSteps.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                              <Activity className="w-12 h-12 text-gray-200 mb-4" />
                              <p className="text-gray-500 font-medium">No tracking history available for this claim</p>
                            </div>
                          ) : (
                            allSteps.map((step, idx) => (
                              <div key={step.type} className="flex gap-4 group">
                                <div className={`relative z-10 w-8 h-8 rounded-full ${bgMap[step.type]} border-4 border-white flex items-center justify-center shadow-sm`}>
                                  {iconMap[step.type]}
                                </div>
                                <div className="flex-1 pt-0.5">
                                  <div className="bg-white border border-gray-100 rounded-xl p-4 shadow-sm group-hover:shadow-md transition-shadow">
                                    <div className="flex items-center justify-between mb-2">
                                      <div>
                                        <h4 className="text-sm font-bold text-gray-900">{step.title}</h4>
                                        {step.subtitle && <p className="text-[10px] font-semibold text-teal-700 mt-0.5">Status: {step.subtitle}</p>}
                                      </div>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${badgeColorMap[step.type]}`}>Step {idx + 1}</span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center"><User className="w-3.5 h-3.5 text-gray-400" /></div>
                                        <div>
                                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">{step.label}</p>
                                          <p className="text-xs font-semibold text-gray-700">{step.name || "N/A"}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center"><Shield className="w-3.5 h-3.5 text-gray-400" /></div>
                                        <div>
                                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Role</p>
                                          <p className="text-xs font-semibold text-gray-700 capitalize">{step.role}</p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 col-span-full">
                                        <div className="w-7 h-7 rounded-lg bg-gray-50 flex items-center justify-center"><Clock className="w-3.5 h-3.5 text-gray-400" /></div>
                                        <div>
                                          <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tight">Date & Time</p>
                                          <p className="text-xs font-semibold text-gray-700">{new Date(step.date).toLocaleString()}</p>
                                        </div>
                                      </div>
                                    </div>
                                    {step.reason && (
                                      <div className="mt-4 p-3 bg-red-50/50 border border-red-100 rounded-lg">
                                        <p className="text-[10px] font-bold text-red-600 uppercase mb-1">Reason</p>
                                        <p className="text-xs text-red-800 leading-relaxed italic">"{step.reason}"</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Review History */}
                    {(viewModal.approvedByName || viewModal.rejectedByName || viewModal.releasedByName || viewModal.readyByName || viewModal.completedByName || viewModal.rejectedFromReleaseRequestedByName) && (
                      <ModalSection
                        icon={<ClockIcon className="w-4 h-4 text-teal-600" />}
                        title="Review History"
                        subtitle="Everyone who reviewed this claim and when"
                      >
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          {viewModal.approvedByName && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Approved</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{viewModal.approvedByName}</p>
                              <p className="text-[11px] text-gray-500 capitalize">{viewModal.approvedByRole}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{viewModal.approvedAt ? new Date(viewModal.approvedAt).toLocaleString() : ""}</p>
                            </div>
                          )}
                          {viewModal.rejectedByName && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rejected</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{viewModal.rejectedByName}</p>
                              <p className="text-[11px] text-gray-500 capitalize">{viewModal.rejectedByRole}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{viewModal.rejectedAt ? new Date(viewModal.rejectedAt).toLocaleString() : ""}</p>
                            </div>
                          )}
                          {viewModal.releasedByName && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Released</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{viewModal.releasedByName}</p>
                              <p className="text-[11px] text-gray-500 capitalize">{viewModal.releasedByRole}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{viewModal.releasedAt ? new Date(viewModal.releasedAt).toLocaleString() : ""}</p>
                            </div>
                          )}
                          {viewModal.readyByName && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ready</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{viewModal.readyByName}</p>
                              <p className="text-[11px] text-gray-500 capitalize">{viewModal.readyByRole}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{viewModal.readyAt ? new Date(viewModal.readyAt).toLocaleString() : ""}</p>
                            </div>
                          )}
                          {viewModal.completedByName && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Completed</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{viewModal.completedByName}</p>
                              <p className="text-[11px] text-gray-500 capitalize">{viewModal.completedByRole}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{viewModal.completedAt ? new Date(viewModal.completedAt).toLocaleString() : ""}</p>
                            </div>
                          )}
                          {viewModal.rejectedFromReleaseRequestedByName && (
                            <div className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Release Reject</span>
                              </div>
                              <p className="text-sm font-semibold text-gray-900">{viewModal.rejectedFromReleaseRequestedByName}</p>
                              <p className="text-[11px] text-gray-500 capitalize">{viewModal.rejectedFromReleaseRequestedByRole}</p>
                              <p className="text-[11px] text-gray-400 mt-1">{viewModal.rejectedFromReleaseRequestedAt ? new Date(viewModal.rejectedFromReleaseRequestedAt).toLocaleString() : ""}</p>
                            </div>
                          )}
                        </div>
                      </ModalSection>
                    )}

                    {/* Patient & Insurance Info */}
                    <ModalSection
                      icon={<User className="w-4 h-4 text-teal-600" />}
                      title="Patient & Insurance Information"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                        <div>
                          <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-2.5">Patient Details</p>
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2.5">
                              <User className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm text-gray-500">Name: <span className="font-semibold text-gray-900">{viewModal.patientFirstName} {viewModal.patientLastName}</span></p>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <Phone className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm text-gray-500">Mobile:{" "}
                                <span className="font-semibold text-gray-900">
                                  {userRole === "doctorStaff"
                                    ? (viewModal.patientMobileNumber ? maskMobileNumber(viewModal.patientMobileNumber) : "—")
                                    : (viewModal.patientMobileNumber || "—")}
                                </span>
                              </p>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <Stethoscope className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm text-gray-500">Doctor: <span className="font-semibold text-gray-900">{viewModal.doctorName || "—"}</span></p>
                            </div>
                            {viewModal.emirNumber && (
                              <div className="flex items-center gap-2.5">
                                <BadgeCheck className="w-4 h-4 text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-500">EMIR #: <span className="font-semibold font-mono text-gray-900">{viewModal.emirNumber}</span></p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-teal-700 uppercase tracking-wider mb-2.5">Insurance Details</p>
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2.5">
                              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm text-gray-500">Provider: <span className="font-semibold text-gray-900">{viewModal.insuranceProvider}</span></p>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <Shield className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm text-gray-500">Policy #: <span className="font-semibold text-gray-900">{viewModal.policyNumber}</span></p>
                            </div>
                            <div className="flex items-center gap-2.5">
                              <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                              <p className="text-sm text-gray-500">Expiry: <span className="font-semibold text-gray-900">{viewModal.expiryDate ? new Date(viewModal.expiryDate).toLocaleDateString() : "—"}</span></p>
                            </div>
                            {viewModal.invoiceNumber && (
                              <div className="flex items-center gap-2.5">
                                <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                                <p className="text-sm text-gray-500">Invoice #: <span className="font-semibold font-mono text-gray-900">{viewModal.invoiceNumber}</span></p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </ModalSection>

                    {/* Previous Claims — all prior claims belonging to this patient */}
                    <ModalSection
                      icon={<Clock className="w-4 h-4 text-teal-600" />}
                      title="Previous Claims"
                      subtitle={patientHistoryLoading ? "Loading…" : `${patientHistory.length} previous claim${patientHistory.length === 1 ? "" : "s"} found for this patient`}
                    >
                      {patientHistoryLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-teal-600" />
                        </div>
                      ) : patientHistory.length === 0 ? (
                        <div className="flex items-center gap-3 py-0.5">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                            <FileText className="w-3.5 h-3.5 text-gray-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-600 leading-tight">No previous claims</p>
                            <p className="text-[11px] text-gray-400 leading-snug">This is the first claim for this patient</p>
                          </div>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                          {patientHistory.map((prev) => (
                            <div
                              key={prev._id}
                              className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                            >
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                prev.status === "Approved" ? "bg-green-500" :
                                prev.status === "Rejected" ? "bg-red-500" :
                                prev.status === "Released" ? "bg-blue-500" :
                                prev.status === "Ready" ? "bg-indigo-500" :
                                prev.status === "Completed" ? "bg-purple-500" :
                                "bg-yellow-400"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${getStatusBadge(prev.status)}`}>
                                    {prev.status}
                                  </span>
                                  <span className="text-[10px] font-medium text-gray-400 uppercase">{prev.claimType}</span>
                                </div>
                                <p className="text-xs font-medium text-gray-700 mt-0.5 truncate">{prev.insuranceProvider}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5 truncate">
                                  {prev.doctorName || "—"} · {prev.departmentName || "—"} · {getCurrencySymbol(currency)}{prev.claimAmount?.toLocaleString()}
                                </p>
                              </div>
                              <p className="text-[11px] text-gray-400 shrink-0">{new Date(prev.createdAt).toLocaleDateString()}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </ModalSection>

                    {/* Uploaded files */}
                    {(viewModal.insuranceCardFile || viewModal.tableOfBenefitsFile || viewModal.emriFrontPhoto || viewModal.emriBackPhoto) && (
                      <ModalSection
                        icon={<Paperclip className="w-4 h-4 text-teal-600" />}
                        title="Uploaded Insurance Files"
                        subtitle="Click a file to preview it"
                      >
                        <div className="flex flex-wrap gap-2.5">
                          {viewModal.insuranceCardFile && (
                            <button
                              onClick={() => setPreviewFile({ url: viewModal.insuranceCardFile, name: "Insurance Card", field: "insuranceCardFile" })}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> Insurance Card
                            </button>
                          )}
                          {viewModal.tableOfBenefitsFile && (
                            <button
                              onClick={() => setPreviewFile({ url: viewModal.tableOfBenefitsFile, name: "Table of Benefits", field: "tableOfBenefitsFile" })}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> Table of Benefits
                            </button>
                          )}
                          {viewModal.emriFrontPhoto && (
                            <button
                              onClick={() => setPreviewFile({ url: viewModal.emriFrontPhoto, name: "EMRI Front", field: "emriFrontPhoto" })}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> EMRI Front
                            </button>
                          )}
                          {viewModal.emriBackPhoto && (
                            <button
                              onClick={() => setPreviewFile({ url: viewModal.emriBackPhoto, name: "EMRI Back", field: "emriBackPhoto" })}
                              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-50 rounded-lg text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> EMRI Back
                            </button>
                          )}
                        </div>
                      </ModalSection>
                    )}

                    {/* Claim Details */}
                    <ModalSection
                      icon={<ClipboardList className="w-4 h-4 text-teal-600" />}
                      title="Claim Details"
                      subtitle="Claim amount, services, co-pay and payment status"
                    >
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <InfoTile label="Claim Type" value={viewModal.claimType} />
                        <InfoTile
                          label="Urgency"
                          value={
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              viewModal.urgency === "High"
                                ? "bg-red-50 text-red-700"
                                : viewModal.urgency === "Priority"
                                ? "bg-amber-50 text-amber-700"
                                : "bg-teal-50 text-teal-700"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                viewModal.urgency === "High" ? "bg-red-500" : viewModal.urgency === "Priority" ? "bg-amber-500" : "bg-teal-500"
                              }`} />
                              {viewModal.urgency || "Normal"}
                            </span>
                          }
                        />
                        <InfoTile label="Claim Amount" value={`${getCurrencySymbol(currency)}${viewModal.claimAmount?.toLocaleString()}`} />
                        {(claimDetails?.finalClaimAmount || viewModal.finalClaimAmount) && (
                          <InfoTile
                            label="Final Claim Amount"
                            value={
                              <span className="text-teal-700 font-bold">
                                {getCurrencySymbol(currency)}{(claimDetails?.finalClaimAmount || viewModal.finalClaimAmount)?.toLocaleString()}
                              </span>
                            }
                          />
                        )}
                        <InfoTile label="Department" value={viewModal.departmentName || "—"} />
                        <InfoTile
                          label="Services"
                          className="col-span-2 sm:col-span-1"
                          value={
                            <div className="flex flex-wrap gap-1.5">
                              {viewModal.services && viewModal.services.length > 0 ? (
                                viewModal.services.map((svc, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-0.5 rounded bg-teal-50 text-teal-700 text-[10px] font-bold whitespace-nowrap"
                                  >
                                    {svc.serviceName}
                                  </span>
                                ))
                              ) : (
                                <span>{viewModal.serviceName || "—"}</span>
                              )}
                            </div>
                          }
                        />
                        <InfoTile label="Co-Pay %" value={`${viewModal.coPayPercent}%`} />
                        <InfoTile label="Co-Pay Type" value={viewModal.coPayType || "—"} />
                        {(claimDetails?.emirNumber || viewModal.emirNumber) && <InfoTile label="EMIR Number" value={claimDetails?.emirNumber || viewModal.emirNumber} />}
                        {(claimDetails?.invoiceNumber || viewModal.invoiceNumber) && <InfoTile label="Invoice Number" value={claimDetails?.invoiceNumber || viewModal.invoiceNumber} />}
                        {(viewModal.status === "Released" || viewModal.status === "Completed") && (claimDetails?.diagnosis || viewModal.diagnosis) && (
                          <div className="py-1.5">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Diagnosis</p>
                            <button
                              onClick={() => setTextPreview({ title: "Diagnosis", text: claimDetails?.diagnosis || viewModal.diagnosis })}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline underline-offset-2 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Details
                            </button>
                          </div>
                        )}
                        {(viewModal.status === "Released" || viewModal.status === "Completed") && (claimDetails?.treatmentPlan || viewModal.treatmentPlan) && (
                          <div className="py-1.5">
                            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Treatment Plan</p>
                            <button
                              onClick={() => setTextPreview({ title: "Treatment Plan", text: claimDetails?.treatmentPlan || viewModal.treatmentPlan })}
                              className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700 hover:text-teal-900 hover:underline underline-offset-2 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              View Details
                            </button>
                          </div>
                        )}
                        {(viewModal.claimType === "Advance" || viewModal.claimType === "Paid") && (
                          <>
                            <InfoTile label={`${viewModal.claimType} Status`} value={viewModal.advanceStatus || "—"} />
                            <InfoTile label="Paid Amount" value={`${getCurrencySymbol(currency)}${viewModal.advanceAmount?.toLocaleString() || "0"}`} />
                            {(claimDetails?.paymentMethod || viewModal.paymentMethod) && <InfoTile label="Payment Method" value={claimDetails?.paymentMethod || viewModal.paymentMethod} />}
                            {(claimDetails?.transactionId || viewModal.transactionId) && (
                              <InfoTile
                                label="Transaction ID"
                                value={
                                  <div className="space-y-1">
                                    <span className="font-mono text-[11px]">{claimDetails?.transactionId || viewModal.transactionId}</span>
                                    {(claimDetails?.attachment || viewModal.attachment) ? (
                                      <button
                                        onClick={() => setPreviewFile({ url: claimDetails?.attachment || viewModal.attachment, name: "Payment Attachment", field: "attachment" })}
                                        className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-600 hover:text-teal-700 hover:underline transition-colors"
                                      >
                                        <Paperclip className="w-3 h-3" /> Payment Attachment
                                      </button>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                                        <Paperclip className="w-3 h-3" /> No attachment
                                      </span>
                                    )}
                                  </div>
                                }
                              />
                            )}
                            {viewModal.pendingClaim > 0 && (
                              <InfoTile label="Pending Claim" value={<span className="text-orange-600">{getCurrencySymbol(currency)}{viewModal.pendingClaim?.toLocaleString()}</span>} />
                            )}
                          </>
                        )}
                        {viewModal.expectedReleaseDate && (
                          <InfoTile
                            label="Expected Release Date"
                            value={
                              <span className="inline-flex items-center gap-1.5 text-teal-700">
                                <CalendarClock className="w-3.5 h-3.5" />
                                {new Date(viewModal.expectedReleaseDate).toLocaleDateString()}
                              </span>
                            }
                          />
                        )}
                        <div className="py-1.5">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</p>
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusBadge(viewModal.status)}`}>
                            {viewModal.status}
                          </span>
                        </div>
                      </div>

                      {/* Claim Amount Adjustment — Same Amount / Add Extra (Under Review claims only) */}
                      {viewModal.status === "Under Review" && permissions.canUpdate ? (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <div className="flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-teal-600" />
                              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Claim Amount Adjustment</h4>
                            </div>
                            {viewModal.doctorAddedClaimAmount != null && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-700 bg-teal-50 rounded-full px-2.5 py-1">
                                <Wallet className="w-3 h-3" />
                                Saved: {getCurrencySymbol(currency)}{viewModal.doctorAddedClaimAmount?.toLocaleString()}
                              </span>
                            )}
                          </div>

                          {/* Option cards */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setAmountOption("same")}
                              className={`text-left rounded-xl p-3.5 transition-all ${amountOption === "same"
                                ? "bg-teal-50 shadow-[0_0_0_2px_rgb(20,184,166)]"
                                : "bg-gray-50 hover:bg-gray-100"
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${amountOption === "same" ? "bg-teal-600" : "bg-gray-100"}`}>
                                  <CheckCircle className={`w-4 h-4 ${amountOption === "same" ? "text-white" : "text-gray-400"}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-gray-900">Same Amount</p>
                                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Keep the original claim amount of {getCurrencySymbol(currency)}{viewModal.claimAmount?.toLocaleString()}</p>
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setAmountOption("extra")}
                              className={`text-left rounded-xl p-3.5 transition-all ${amountOption === "extra"
                                ? "bg-teal-50 shadow-[0_0_0_2px_rgb(20,184,166)]"
                                : "bg-gray-50 hover:bg-gray-100"
                                }`}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${amountOption === "extra" ? "bg-teal-600" : "bg-gray-100"}`}>
                                  <PlusCircle className={`w-4 h-4 ${amountOption === "extra" ? "text-white" : "text-gray-400"}`} />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-bold text-gray-900">Add Extra Amount</p>
                                  <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">Enter an additional amount with compulsory notes</p>
                                </div>
                              </div>
                            </button>
                          </div>

                          {/* Extra amount inputs */}
                          {amountOption === "extra" && (
                            <div className="mt-4 space-y-4 bg-gray-50 rounded-xl p-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                    Extra Amount <span className="text-red-500">*</span>
                                  </label>
                                  <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400 pointer-events-none">{getCurrencySymbol(currency)}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={doctorAddedAmount}
                                      onChange={(e) => setDoctorAddedAmount(e.target.value)}
                                      placeholder="0.00"
                                      className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-end">
                                  <p className="text-[11px] text-gray-400 leading-relaxed">
                                    The extra amount and notes are compulsory. They will be stored on the claim as the doctor added claim amount and notes.
                                  </p>
                                </div>
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                  Doctor Added Claim Notes <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                  rows={3}
                                  value={doctorAddedNotes}
                                  onChange={(e) => setDoctorAddedNotes(e.target.value)}
                                  placeholder="Explain the reason for adding the extra amount to this claim..."
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none"
                                />
                              </div>
                            </div>
                          )}

                          {adjustmentError && (
                            <div className="mt-3 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                              <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                              <p className="text-xs text-red-700 font-medium">{adjustmentError}</p>
                            </div>
                          )}

                          <div className="mt-4 flex items-center justify-end">
                            <button
                              onClick={handleSaveClaimAmountAdjustment}
                              disabled={adjustmentSaving}
                              className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-xs font-bold rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              {adjustmentSaving ? "Saving..." : "Save Adjustment"}
                            </button>
                          </div>
                        </div>
                      ) : (claimDetails?.doctorAddedClaimAmount != null || viewModal.doctorAddedClaimAmount != null) ? (
                        /* Read-only display for claims no longer under review */
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Wallet className="w-4 h-4 text-teal-600" />
                            <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Doctor Added Claim Amount</h4>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <InfoTile
                              label="Extra Amount Added"
                              value={<span className="text-teal-700">{getCurrencySymbol(currency)}{(claimDetails?.doctorAddedClaimAmount ?? viewModal.doctorAddedClaimAmount)?.toLocaleString()}</span>}
                            />
                            <div className="bg-gray-50 rounded-lg p-3">
                              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Doctor Added Claim Notes</p>
                              <p className="text-sm text-gray-800 mt-1 leading-relaxed">{claimDetails?.doctorAddedClaimNotes || viewModal.doctorAddedClaimNotes || "—"}</p>
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </ModalSection>

                    {/* Notes */}
                    {viewModal.notes && (
                      <ModalSection
                        icon={<ClipboardList className="w-4 h-4 text-teal-600" />}
                        title="Notes"
                        subtitle="Additional notes recorded with the claim"
                      >
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 leading-relaxed">{viewModal.notes}</p>
                      </ModalSection>
                    )}

                    {/* Claim Documents */}
                    {(viewModal.documentFiles && viewModal.documentFiles.length > 0) && (
                      <ModalSection
                        icon={<Paperclip className="w-4 h-4 text-teal-600" />}
                        title="Claim Documents"
                        subtitle={`${viewModal.documentFiles.length} document${viewModal.documentFiles.length > 1 ? "s" : ""} attached to this claim`}
                      >
                        <div className="flex flex-wrap gap-2">
                          {viewModal.documentFiles.map((file, idx) => (
                            <button
                              key={idx}
                              onClick={() => setPreviewFile({ url: file, name: `Document ${idx + 1}`, field: "documentFiles" })}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 rounded-lg text-xs font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" /> Document {idx + 1}
                            </button>
                          ))}
                        </div>
                      </ModalSection>
                    )}

                    {/* Rejection reason */}
                    {viewModal.status === "Rejected" && viewModal.rejectionReason && (
                      <ModalSection
                        icon={<AlertCircle className="w-4 h-4 text-red-500" />}
                        title="Rejection Reason"
                        subtitle="Recorded when this claim was rejected"
                      >
                        <p className="text-sm text-red-700 bg-red-50 rounded-lg p-3 leading-relaxed font-medium">{viewModal.rejectionReason}</p>
                      </ModalSection>
                    )}

                    {/* Review info */}
                    {viewModal.reviewedAt && (
                      <ModalSection
                        icon={<ClipboardList className="w-4 h-4 text-teal-600" />}
                        title="Review Information"
                        subtitle="Claim review record"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <InfoTile label="Reviewed On" value={new Date(viewModal.reviewedAt).toLocaleString()} />
                          {viewModal.reviewNotes && <InfoTile label="Review Notes" value={viewModal.reviewNotes} />}
                        </div>
                      </ModalSection>
                    )}

                    {/* Administrative Details */}
                    <ModalSection
                      icon={<BadgeCheck className="w-4 h-4 text-teal-600" />}
                      title="Administrative Details"
                      subtitle="Record ownership and timestamps"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <InfoTile label="Patient Name" value={`${viewModal.patientFirstName} ${viewModal.patientLastName}`} />
                        <InfoTile label="Doctor Name" value={viewModal.doctorName || "-"} />
                        <InfoTile label="Insurance Provider" value={viewModal.insuranceProvider} />
                        <InfoTile label="Claim Type" value={viewModal.claimType} />
                        <InfoTile label="Created At" value={new Date(viewModal.createdAt).toLocaleString()} />
                        <InfoTile label="Last Updated" value={new Date(viewModal.updatedAt).toLocaleString()} />
                      </div>
                    </ModalSection>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Approve Claim Modal — Expected Release Date is compulsory */}
        {approveClaimModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center shrink-0">
                  <BadgeCheck className="w-5 h-5 text-teal-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-gray-900 leading-tight">Approve Claim</h2>
                  <p className="text-xs text-gray-500 mt-0.5">Confirm approval and set the expected release date</p>
                </div>
                <button
                  onClick={() => { setApproveClaimModal(null); setExpectedReleaseDate(""); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg shrink-0"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-5">
                {/* Claim summary */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                      {getInitials(approveClaimModal.patientFirstName, approveClaimModal.patientLastName)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {approveClaimModal.patientFirstName} {approveClaimModal.patientLastName}
                      </p>
                      <p className="text-[11px] text-gray-500 truncate">
                        {approveClaimModal.insuranceProvider} · {approveClaimModal.claimType} Claim
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-100 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Claim Amount</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">
                        {getCurrencySymbol(currency)}{approveClaimModal.claimAmount?.toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-lg p-2.5">
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Current Status</p>
                      <p className="text-sm font-bold text-gray-900 mt-0.5">{approveClaimModal.status}</p>
                    </div>
                  </div>
                </div>

                {/* Expected Release Date */}
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                    Expected Release Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={expectedReleaseDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setExpectedReleaseDate(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                  <p className="text-[11px] text-gray-400 mt-1.5 flex items-center gap-1">
                    <CalendarClock className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                    The date when this claim is expected to be released. This field is compulsory.
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/60 flex items-center justify-end gap-3">
                <button
                  onClick={() => { setApproveClaimModal(null); setExpectedReleaseDate(""); }}
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmApproveClaim}
                  disabled={actionLoading || !expectedReleaseDate}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="w-4 h-4" />
                  {actionLoading ? "Approving..." : "Approve Claim"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reject Modal */}
        {rejectModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Reject Claim</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Claim for {rejectModal.patientFirstName} {rejectModal.patientLastName} - {rejectModal.claimType} ({rejectModal.claimAmount})
                </p>
              </div>
              <div className="p-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Please provide the reason for rejecting this claim..."
                />
              </div>
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  onClick={() => { setRejectModal(null); setRejectionReason(""); }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading ? "Rejecting..." : "Reject Claim"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Approval Modal with Multi-Step Progress */}
        {approvalModal && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="bg-white border-b border-gray-200 px-5 py-3 flex items-center justify-between">
                <h2 className="text-base font-bold text-gray-900">Complete Claim - Multi-Step Verification</h2>
                <button onClick={() => setApprovalModal(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>

              {/* Progress Bar */}
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  {["Insurance", "Details", "Plan", "Confirm", "Appointment", "Progress", "Consent"].map((step, idx) => (
                    <div key={idx} className="flex items-center flex-1 min-w-0">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${approvalStep > idx + 1 ? "bg-teal-600 text-white" :
                        approvalStep === idx + 1 ? "bg-teal-600 text-white" :
                          "bg-gray-200 text-gray-500"
                        }`}>
                        {approvalStep > idx + 1 ? "✓" : idx + 1}
                      </div>
                      <span className={`ml-1 text-[9px] font-semibold truncate ${approvalStep >= idx + 1 ? "text-gray-900" : "text-gray-400"
                        }`}>{step}</span>
                      {idx < 6 && <div className={`w-3 h-0.5 mx-0.5 shrink-0 ${approvalStep > idx + 1 ? "bg-teal-600" : "bg-gray-200"}`} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Content */}
              <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Step 1: Insurance Details (display only) */}
                {approvalStep === 1 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Shield className="w-4 h-4 text-teal-600" />
                      Step 1: Insurance Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="py-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Insurance Provider</p><p className="text-sm font-semibold text-gray-900">{approvalModal.insuranceProvider}</p></div>
                      <div className="py-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Policy Number</p><p className="text-sm font-semibold text-gray-900">{approvalModal.policyNumber}</p></div>
                      <div className="py-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Claim Amount</p><p className="text-sm font-bold text-teal-700">{getCurrencySymbol(currency)}{approvalModal.claimAmount?.toLocaleString()}</p></div>
                      <div className="py-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Claim Type</p><p className="text-sm font-semibold text-gray-900">{approvalModal.claimType}</p></div>
                      <div className="py-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Department</p><p className="text-sm font-semibold text-gray-900">{approvalModal.departmentName || "—"}</p></div>
                      <div className="py-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Doctor</p><p className="text-sm font-semibold text-gray-900">{approvalModal.doctorName || "—"}</p></div>
                      <div className="py-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Expiry Date</p><p className="text-sm font-semibold text-gray-900">{approvalModal.expiryDate ? new Date(approvalModal.expiryDate).toLocaleDateString() : "—"}</p></div>
                      <div className="py-1.5"><p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-0.5">Co-Pay</p><p className="text-sm font-semibold text-gray-900">{approvalModal.coPayPercent}%</p></div>
                      {approvalModal.doctorAddedClaimAmount != null && (
                        <div className="col-span-2 py-2 bg-teal-50 rounded-lg px-3">
                          <p className="text-[10px] font-semibold text-teal-600 uppercase tracking-wider mb-0.5">Extra Amount Added by Doctor</p>
                          <p className="text-sm font-bold text-teal-800">{getCurrencySymbol(currency)}{approvalModal.doctorAddedClaimAmount?.toLocaleString()}</p>
                          {approvalModal.doctorAddedClaimNotes && <p className="text-[11px] text-teal-700 mt-0.5">{approvalModal.doctorAddedClaimNotes}</p>}
                        </div>
                      )}
                      {(approvalModal.insuranceCardFile || approvalModal.tableOfBenefitsFile || approvalModal.emriFrontPhoto || approvalModal.emriBackPhoto) && (
                        <div className="col-span-2 py-1.5">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Uploaded Documents</p>
                          <div className="flex flex-wrap gap-2">
                            {approvalModal.insuranceCardFile && <button onClick={() => setPreviewFile({ url: approvalModal.insuranceCardFile, name: "Insurance Card", field: "insuranceCardFile" })} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 rounded-lg text-[11px] font-semibold text-teal-700 hover:bg-teal-100"><FileText className="w-3 h-3" />Insurance Card</button>}
                            {approvalModal.tableOfBenefitsFile && <button onClick={() => setPreviewFile({ url: approvalModal.tableOfBenefitsFile, name: "Table of Benefits", field: "tableOfBenefitsFile" })} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 rounded-lg text-[11px] font-semibold text-teal-700 hover:bg-teal-100"><FileText className="w-3 h-3" />Table of Benefits</button>}
                            {approvalModal.emriFrontPhoto && <button onClick={() => setPreviewFile({ url: approvalModal.emriFrontPhoto, name: "EMRI Front", field: "emriFrontPhoto" })} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 rounded-lg text-[11px] font-semibold text-teal-700 hover:bg-teal-100"><FileText className="w-3 h-3" />EMRI Front</button>}
                            {approvalModal.emriBackPhoto && <button onClick={() => setPreviewFile({ url: approvalModal.emriBackPhoto, name: "EMRI Back", field: "emriBackPhoto" })} className="inline-flex items-center gap-1 px-2.5 py-1 bg-teal-50 rounded-lg text-[11px] font-semibold text-teal-700 hover:bg-teal-100"><FileText className="w-3 h-3" />EMRI Back</button>}
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end pt-2">
                      <button onClick={() => setApprovalStep(2)} className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">Continue →</button>
                    </div>
                  </div>
                )}

                {/* Step 2: Add Details — EMIR, Invoice Number, Payment Method */}
                {approvalStep === 2 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-600" />
                      Step 2: Add Details
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">EMIR Number</label>
                        <input type="text" value={planEmirNumber} onChange={(e) => setPlanEmirNumber(e.target.value)} placeholder="Enter EMIR number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Invoice Number <span className="text-[10px] text-gray-400 font-normal">(must be unique)</span></label>
                        <input type="text" value={planInvoiceNumber} onChange={(e) => setPlanInvoiceNumber(e.target.value)} placeholder="Enter unique invoice number" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Payment Method</label>
                        <select value={planPaymentMethod} onChange={(e) => setPlanPaymentMethod(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                          <option value="">Select payment method</option>
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="UPI">UPI</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-between pt-2">
                      <button onClick={() => setApprovalStep(1)} className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">← Back</button>
                      <button onClick={() => setApprovalStep(3)} className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">Continue →</button>
                    </div>
                  </div>
                )}

                {/* Step 3: Plan — Diagnosis + Treatment */}
                {approvalStep === 3 && (
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                      <Activity className="w-4 h-4 text-teal-600" />
                      Step 3: Plan
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Diagnosis</label>
                        <textarea rows={5} value={planDiagnosis} onChange={(e) => setPlanDiagnosis(e.target.value)} placeholder="Enter diagnosis details..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">Treatment Plan</label>
                        <textarea rows={5} value={treatmentPlanText} onChange={(e) => { setTreatmentPlanText(e.target.value); setAddTreatmentPlan(true); }} placeholder="Enter treatment plan..." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 resize-none" />
                      </div>
                    </div>
                    <div className="flex justify-between pt-2">
                      <button onClick={() => setApprovalStep(2)} className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">← Back</button>
                      <button onClick={() => { setApprovalStep(4); }} className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors">Continue →</button>
                    </div>
                  </div>
                )}

                {/* Step 4: Confirmation — tick marks */}
                {approvalStep === 4 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-teal-600" />
                        Step 4: Confirmation
                      </h3>
                      <button onClick={() => setApprovalStep(3)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Back to Plan">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    </div>

                    <p className="text-[11px] text-gray-500">Tick all items to confirm and complete the claim.</p>

                    <div className="space-y-2">
                      {[
                        { key: "appointment", label: "Link Appointment", icon: Calendar },
                        { key: "treatmentPlan", label: "Treatment Plan", icon: FileText },
                        { key: "consentForm", label: "Consent Form", icon: Shield },
                        { key: "progressNotes", label: "Progress Notes", icon: Activity },
                      ].map(({ key, label, icon: Icon }) => (
                        <button
                          key={key}
                          onClick={() => setConfirmChecklist((prev) => ({ ...prev, [key]: !prev[key] }))}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-left ${
                            confirmChecklist[key]
                              ? "bg-teal-50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]"
                              : "bg-gray-50 hover:bg-gray-100"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            confirmChecklist[key] ? "bg-teal-600 text-white" : "bg-gray-200 text-gray-400"
                          }`}>
                            {confirmChecklist[key] ? (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                              <Icon className="w-3 h-3" />
                            )}
                          </div>
                          <span className={`text-sm font-semibold ${confirmChecklist[key] ? "text-teal-800" : "text-gray-700"}`}>{label}</span>
                          {confirmChecklist[key] && <span className="ml-auto text-[10px] font-bold text-teal-600 uppercase tracking-wider">Done</span>}
                        </button>
                      ))}
                    </div>

                    {/* Optional navigation to appointment / progress / consent steps */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] text-gray-400 font-medium">Optional:</span>
                      <button onClick={() => setApprovalStep(5)} className="text-[10px] font-semibold text-teal-600 hover:text-teal-800 underline underline-offset-2">Book Appointment</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setApprovalStep(6)} className="text-[10px] font-semibold text-teal-600 hover:text-teal-800 underline underline-offset-2">Check Progress</button>
                      <span className="text-gray-300">|</span>
                      <button onClick={() => setApprovalStep(7)} className="text-[10px] font-semibold text-teal-600 hover:text-teal-800 underline underline-offset-2">Consent Form</button>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setApprovalStep(3)}
                        className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handleFinalApproval}
                        disabled={actionLoading || !Object.values(confirmChecklist).every(Boolean)}
                        className="flex-1 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? "Completing..." : "Complete Claim"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 5: Book Appointment (optional) */}
                {approvalStep === 5 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        Step 5: Book Appointment
                      </h3>
                      <button onClick={() => setApprovalStep(4)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Back to Confirmation">
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                      </button>
                    </div>

                    {/* Existing Appointments After Claim Date */}
                    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                      <h4 className="text-xs font-semibold text-gray-800 mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        Appointments After Claim Date ({existingAppointments.length})
                      </h4>
                      {loadingExistingAppointments ? (
                        <div className="flex justify-center py-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 border-t-blue-600"></div>
                        </div>
                      ) : existingAppointments.length > 0 ? (
                        <div className="space-y-1.5 max-h-36 overflow-y-auto">
                          {existingAppointments.map((apt, idx) => (
                            <div key={apt._id || idx} className="bg-white rounded-lg p-2 border border-gray-200">
                              <div className="flex items-center justify-between">
                                <div className="grid grid-cols-2 gap-2 text-[11px] flex-1">
                                  <div>
                                    <p className="text-gray-500 text-[10px]">Date</p>
                                    <p className="font-medium text-gray-900">{new Date(apt.startDate).toLocaleDateString()}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500 text-[10px]">Status</p>
                                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${apt.status === 'booked' ? 'bg-green-100 text-green-800' :
                                      apt.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                        'bg-yellow-100 text-yellow-800'
                                      }`}>
                                      {apt.status}
                                    </span>
                                  </div>
                                  {apt.fromTime && (
                                    <div>
                                      <p className="text-gray-500 text-[10px]">Time</p>
                                      <p className="font-medium text-gray-900">{apt.fromTime} - {apt.toTime}</p>
                                    </div>
                                  )}
                                  {apt.followType && (
                                    <div>
                                      <p className="text-gray-500 text-[10px]">Type</p>
                                      <p className="font-medium text-gray-900">{apt.followType}</p>
                                    </div>
                                  )}
                                </div>
                                <CheckCircle className="w-4 h-4 text-green-600 ml-2" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 text-center py-2">No appointments found after claim creation date</p>
                      )}
                    </div>

                    {/* Book New Appointment Form */}
                    <div className="border border-gray-200 rounded-lg p-3">
                      <h4 className="text-xs font-semibold text-gray-800 mb-2">Book New Appointment</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">Start Date</label>
                          <input
                            type="date"
                            value={appointmentData.startDate}
                            onChange={(e) => setAppointmentData(prev => ({ ...prev, startDate: e.target.value }))}
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                            min={new Date().toISOString().split('T')[0]}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">From Time</label>
                          <input
                            type="time"
                            value={appointmentData.fromTime}
                            onChange={(e) => setAppointmentData(prev => ({ ...prev, fromTime: e.target.value }))}
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-gray-700 mb-1">To Time</label>
                          <input
                            type="time"
                            value={appointmentData.toTime}
                            onChange={(e) => setAppointmentData(prev => ({ ...prev, toTime: e.target.value }))}
                            className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleBookAppointment}
                        disabled={actionLoading || !appointmentData.startDate || !appointmentData.fromTime || !appointmentData.toTime}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? "Booking..." : "Book Appointment"}
                      </button>
                      {existingAppointments.length > 0 && (
                        <button
                          onClick={async () => {
                            setApprovalStep(6);
                            await checkProgressStatus(approvalModal.patientId);
                          }}
                          className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                        >
                          Next →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 6: Check Progress (optional) */}
                {approvalStep === 6 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-blue-600" />
                        Step 6: Progress Notes
                      </h3>
                      <button
                        onClick={() => setApprovalStep(4)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                        title="Back to Appointment"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                    {progressStatus !== null ? (
                      <div className="space-y-2">
                        <div className={`p-3 rounded-lg border ${progressStatus.hasProgress ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
                          }`}>
                          <div className="flex items-center gap-2">
                            {progressStatus.hasProgress ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-medium text-green-900">
                                  Progress notes found ({progressStatus.count || 0} note(s))
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-red-600" />
                                <span className="text-xs font-medium text-red-900">
                                  No progress notes recorded for post-claim appointments
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Progress Notes Grouped by Appointment */}
                        {progressStatus.appointments && progressStatus.appointments.length > 0 && (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {progressStatus.appointments.map((apt, idx) => {
                              const aptNotes = (progressStatus.notes || []).filter(
                                (n) => (n.appointmentId?.toString() || n.appointmentId) === apt._id
                              );
                              return (
                                <div key={apt._id || idx} className="bg-gray-50 rounded-lg p-2 border border-gray-200">
                                  <p className="text-[11px] font-semibold text-gray-700 mb-1">
                                    Appointment: {new Date(apt.startDate).toLocaleDateString()} ({apt.status})
                                  </p>
                                  {aptNotes.length > 0 ? (
                                    aptNotes.map((note, nIdx) => (
                                      <p key={nIdx} className="text-[11px] text-gray-600 ml-2">
                                        → {note.note || note.description || "Progress note recorded"}
                                      </p>
                                    ))
                                  ) : (
                                    <p className="text-[11px] text-yellow-700 ml-2 flex items-center gap-1">
                                      ⚠️ No progress note for this appointment
                                    </p>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => setApprovalStep(4)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={checkConsentStatus}
                        disabled={progressStatus === null}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Continue to Consent
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 7: Consent Form (optional) */}
                {approvalStep === 7 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Step 7: Consent Form Status
                      </h3>
                      <button
                        onClick={() => setApprovalStep(4)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                        title="Back to Confirmation"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                    {consentStatus ? (
                      <div className="space-y-2">
                        {/* Overall Status */}
                        <div className={`p-3 rounded-lg border ${consentStatus.allSigned ? "bg-green-50 border-green-200" :
                          consentStatus.allHaveConsent ? "bg-yellow-50 border-yellow-200" :
                            "bg-red-50 border-red-200"
                          }`}>
                          <div className="flex items-center gap-2">
                            {consentStatus.allSigned ? (
                              <>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-medium text-green-900">
                                  All consent forms signed
                                </span>
                              </>
                            ) : consentStatus.allHaveConsent ? (
                              <>
                                <ClockIcon className="w-4 h-4 text-yellow-600" />
                                <span className="text-xs font-medium text-yellow-900">
                                  Some consent forms pending signature
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-4 h-4 text-red-600" />
                                <span className="text-xs font-medium text-red-900">
                                  Missing consent forms for some appointments
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Per-Appointment Consent Details */}
                        {consentStatus.consentByAppointment && consentStatus.consentByAppointment.length > 0 && (
                          <div className="space-y-1.5 max-h-40 overflow-y-auto">
                            {consentStatus.consentByAppointment.map((aptConsent, idx) => (
                              <div key={aptConsent.appointmentId || idx} className={`rounded-lg p-2 border ${aptConsent.isSigned ? "bg-green-50 border-green-200" :
                                aptConsent.hasConsent ? "bg-yellow-50 border-yellow-200" :
                                  "bg-red-50 border-red-200"
                                }`}>
                                <div className="flex items-center justify-between">
                                  <p className="text-[11px] font-semibold text-gray-700">
                                    Appointment: {new Date(aptConsent.appointmentDate).toLocaleDateString()}
                                  </p>
                                  {aptConsent.isSigned ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-800">
                                      <CheckCircle className="w-3 h-3" /> Signed
                                    </span>
                                  ) : aptConsent.hasConsent ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-yellow-800">
                                      <ClockIcon className="w-3 h-3" /> Pending Signature
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-800">
                                      <XCircle className="w-3 h-3" /> Missing Consent ⚠️
                                    </span>
                                  )}
                                </div>
                                {aptConsent.consentFormName && (
                                  <p className="text-[11px] text-gray-600 mt-1 ml-2">
                                    Form: {aptConsent.consentFormName}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-blue-600"></div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => setApprovalStep(4)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={() => setApprovalStep(4)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                      >
                        Continue to Confirmation
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* File Preview Modal */}
        {previewFile && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl relative">
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{previewFile.name}</h2>
                  <p className="text-xs text-gray-500">Document Preview</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRemoveFile(previewFile.field, previewFile.url)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg text-xs font-bold hover:bg-red-100 transition-all"
                  >
                    <X className="w-3.5 h-3.5" /> Remove Document
                  </button>
                  <button onClick={() => setPreviewFile(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-4 flex justify-center items-center min-h-[400px] max-h-[80vh] overflow-auto">
                {previewFile.url.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={previewFile.url}
                    className="w-full h-[70vh] rounded-lg border border-gray-200"
                    title="PDF Preview"
                  />
                ) : (
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-sm"
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = 'https://via.placeholder.com/400x300?text=Preview+Not+Available';
                    }}
                  />
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-between items-center">
                <p className="text-[10px] text-gray-400 font-medium">Claim ID: {viewModal?._id}</p>
                <a
                  href={previewFile.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-bold text-teal-600 hover:text-teal-700"
                >
                  Open in New Tab
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Text Preview Modal — Diagnosis / Treatment Plan */}
        {textPreview && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="text-base font-bold text-gray-900">{textPreview.title}</h2>
                  <p className="text-xs text-gray-500">Full Details</p>
                </div>
                <button onClick={() => setTextPreview(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                <div className="bg-gray-50 rounded-xl p-5">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{textPreview.text}</p>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex justify-end">
                <button
                  onClick={() => setTextPreview(null)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

AllClaimsPage.getLayout = function PageLayout(page) {
  // URL-based layout detection — no token scanning
  const isStaffOrAgentPath = typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/staff/') || window.location.pathname.startsWith('/agent/'));

  if (isStaffOrAgentPath) {
    return <AgentLayout>{page}</AgentLayout>;
  }

  // Default: /clinic/ and all other paths use ClinicLayout
  return <ClinicLayout>{page}</ClinicLayout>;
};

// Create protected versions for both auth types
const ClinicProtectedAllClaimsPage = withClinicAuth(AllClaimsPage);
const AgentProtectedAllClaimsPage = withAgentAuth(AllClaimsPage);

// Main component that chooses which protected version to use — URL-based, not token-based
const ProtectedAllClaimsPage = (props) => {
  const isStaffOrAgentPath = typeof window !== 'undefined' &&
    (window.location.pathname.startsWith('/staff/') || window.location.pathname.startsWith('/agent/'));

  if (isStaffOrAgentPath) {
    return <AgentProtectedAllClaimsPage {...props} />;
  }

  // /clinic/ and all other paths use clinic auth
  return <ClinicProtectedAllClaimsPage {...props} />;
};

ProtectedAllClaimsPage.getLayout = AllClaimsPage.getLayout;

export default ProtectedAllClaimsPage;

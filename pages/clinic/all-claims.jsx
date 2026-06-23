"use client";
import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import ClinicLayout from "../../components/ClinicLayout";
import AgentLayout from "../../components/AgentLayout";
import withClinicAuth from "../../components/withClinicAuth";
import withAgentAuth from "../../components/withAgentAuth";
import { Search, Filter, CheckCircle, XCircle, Eye, FileText, Upload, X, AlertCircle, Clock, Shield, Calendar, Clock as ClockIcon, CheckSquare, Square, Activity, User } from "lucide-react";

const TOKEN_PRIORITY = ["clinicToken", "doctorToken", "agentToken", "staffToken", "userToken", "adminToken"];

// Helper function to get user role from token
// Priority: when on /clinic/ path, check clinicToken first; otherwise use original priority
const getUserRole = () => {
  if (typeof window === 'undefined') return null;
  try {
    // Determine token priority based on current path
    const isClinicPath = window.location.pathname.startsWith('/clinic/');
    let tokenKeys;
    if (isClinicPath) {
      tokenKeys = ['clinicToken', 'doctorToken', 'agentToken', 'staffToken', 'userToken', 'adminToken'];
    } else {
      tokenKeys = ['agentToken', 'doctorToken', 'clinicToken', 'staffToken', 'userToken', 'adminToken'];
    }
    
    for (const key of tokenKeys) {
      const token = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const role = payload.role || null;
          
          if (role && ['agent', 'doctorStaff', 'doctor', 'clinic', 'staff', 'admin'].includes(role)) {
            return role;
          }
        } catch (e) {
          continue;
        }
      }
    }
  } catch (error) {
    console.error('Error getting user role:', error);
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

  const handleViewClaim = (claim) => {
    setViewModal(claim);
    setShowTracking(false);
    fetchClaimDetails(claim._id);
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

  const handleApprove = async (claimId) => {
    // Check permission before approving
    if (!permissions.canUpdate) {
      alert("You don't have permission to approve claims");
      return;
    }
    setActionLoading(true);
    try {
      const token = getAccessLevelToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : null;
      const res = await axios.patch(
        "/api/clinic/insurance-claims/review",
        { claimId, action: "approve" },
        { headers }
      );
      if (res.data.success) {
        setClaims((prev) => prev.map((c) => (c._id === res.data.data._id ? res.data.data : c)));
        setSuccessMsg("Claim approved successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve claim");
    } finally {
      setActionLoading(false);
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
      
      setApprovalStep(3);
    } catch (err) {
      console.error("Failed to check consent status:", err);
      setConsentStatus({ status: "not_sent", count: 0, details: [], logs: [], consentByAppointment: [], allSigned: false, allHaveConsent: false });
      setApprovalStep(3);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalApproval = async () => {
    // Validate required steps
    const missingItems = [];
    if (existingAppointments.length === 0) missingItems.push("Appointments after claim date");
    if (!progressStatus?.hasProgress) missingItems.push("Progress Notes");
    if (!consentStatus || !consentStatus.allSigned) missingItems.push("All Consent Forms must be signed");

    if (missingItems.length > 0) {
      alert(`Cannot complete claim. The following items are missing:\n\n${missingItems.join("\n")}\n\nKindly clear these before completing.`);
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

      // Complete the claim (new status)
      const res = await axios.patch(
        "/api/clinic/insurance-claims/complete-claim",
        { claimId: approvalModal._id },
        { headers }
      );
      if (res.data.success) {
        setClaims((prev) => prev.map((c) => (c._id === res.data.data._id ? res.data.data : c)));
        setApprovalModal(null);
        setSuccessMsg("Claim completed successfully!");
        setTimeout(() => setSuccessMsg(""), 3000);
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
      "Under Review": "bg-yellow-100 text-yellow-800 border-yellow-300",
      "Approved": "bg-green-100 text-green-800 border-green-300",
      "Rejected": "bg-red-100 text-red-800 border-red-300",
      "Released": "bg-blue-100 text-blue-800 border-blue-300",
      "Ready": "bg-indigo-100 text-indigo-800 border-indigo-300",
      "Completed": "bg-purple-100 text-purple-800 border-purple-300",
    };
    return styles[status] || "bg-gray-100 text-gray-800 border-gray-300";
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
                              setViewModal(claim);
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
                                  {claim.insuranceProvider} - ₹{claim.claimAmount?.toFixed(2)}
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
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === tab
                  ? "bg-teal-600 text-white shadow-md"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {tab}
              <span
                className={`px-1.5 py-0.5 rounded-full text-xs ${
                  activeTab === tab ? "bg-white/20 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {tabCounts[tab]}
              </span>
            </button>
          ))}
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedClaims.map((claim) => (
              <div
                key={claim._id}
                className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Card Header - Status */}
                <div className={`px-4 py-2 border-b ${claim.status === "Under Review" && claim.rejectedFromReleaseRequested ? getStatusBadge("Rejected") : getStatusBadge(claim.status)}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1">
                      {claim.status === "Under Review" && !claim.rejectedFromReleaseRequested && <Clock className="w-3.5 h-3.5" />}
                      {claim.status === "Under Review" && claim.rejectedFromReleaseRequested && <XCircle className="w-3.5 h-3.5" />}
                      {claim.status === "Approved" && <CheckCircle className="w-3.5 h-3.5" />}
                      {claim.status === "Rejected" && <XCircle className="w-3.5 h-3.5" />}
                      {claim.status === "Released" && <CheckCircle className="w-3.5 h-3.5" />}
                      {claim.status === "Ready" && <CheckSquare className="w-3.5 h-3.5" />}
                      {claim.status === "Completed" && <CheckCircle className="w-3.5 h-3.5" />}
                      {claim.status === "Under Review" && claim.rejectedFromReleaseRequested ? "Rejected" : claim.status}
                    </span>
                    <span className="text-xs">{new Date(claim.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  {/* Patient Info */}
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">Patient</p>
                    <p className="text-sm font-medium text-gray-900">
                      {claim.patientFirstName} {claim.patientLastName}
                    </p>
                    <p className="text-xs text-gray-500">{claim.patientMobileNumber}</p>
                  </div>

                  {/* Doctor Info */}
                  <div className="bg-teal-50 rounded-md p-2 border border-teal-200">
                    <p className="text-xs text-teal-600 uppercase font-semibold flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Doctor
                    </p>
                    <p className="text-sm font-medium text-gray-900">
                      {claim.doctorName || "N/A"}
                    </p>
                  </div>

                  {/* Status-specific Action Info */}
                  {claim.status === "Approved" && claim.approvedByName && (
                    <div className="bg-green-50 rounded-md p-2 border border-green-200">
                      <p className="text-xs text-green-600 uppercase font-semibold mb-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Approved By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.approvedByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.approvedByRole})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {claim.approvedAt ? new Date(claim.approvedAt).toLocaleString() : ""}
                      </p>
                    </div>
                  )}

                  {claim.status === "Rejected" && claim.rejectedByName && (
                    <div className="bg-red-50 rounded-md p-2 border border-red-200">
                      <p className="text-xs text-red-600 uppercase font-semibold mb-1 flex items-center gap-1">
                        <XCircle className="w-3 h-3" />
                        Rejected By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.rejectedByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.rejectedByRole})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {claim.rejectedAt ? new Date(claim.rejectedAt).toLocaleString() : ""}
                      </p>
                      {claim.rejectionReason && (
                        <div className="mt-2 pt-2 border-t border-red-200">
                          <p className="text-xs text-red-600 font-semibold mb-0.5">Rejection Notes:</p>
                          <p className="text-xs text-red-800 bg-red-100 rounded p-1.5">{claim.rejectionReason}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {claim.status === "Released" && claim.releasedByName && (
                    <div className="bg-blue-50 rounded-md p-2 border border-blue-200">
                      <p className="text-xs text-blue-600 uppercase font-semibold mb-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Released By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.releasedByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.releasedByRole})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {claim.releasedAt ? new Date(claim.releasedAt).toLocaleString() : ""}
                      </p>
                    </div>
                  )}

                  {claim.status === "Ready" && claim.readyByName && (
                    <div className="bg-indigo-50 rounded-md p-2 border border-indigo-200">
                      <p className="text-xs text-indigo-600 uppercase font-semibold mb-1 flex items-center gap-1">
                        <CheckSquare className="w-3 h-3" />
                        Ready By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.readyByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.readyByRole})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {claim.readyAt ? new Date(claim.readyAt).toLocaleString() : ""}
                      </p>
                    </div>
                  )}

                  {claim.status === "Completed" && claim.completedByName && (
                    <div className="bg-purple-50 rounded-md p-2 border border-purple-200">
                      <p className="text-xs text-purple-600 uppercase font-semibold mb-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Completed By
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        {claim.completedByName}
                        <span className="text-gray-500 capitalize ml-1">({claim.completedByRole})</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {claim.completedAt ? new Date(claim.completedAt).toLocaleString() : ""}
                      </p>
                    </div>
                  )}

                  {claim.status === "Under Review" && claim.rejectedFromPassClaims === true && (
                    <div className="bg-red-50 rounded-md p-2 border border-red-200">
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Rejected Back from Finance checking
                      </p>
                      <p className="text-xs text-red-700 mt-1">{claim.reviewNotes}</p>
                      {claim.rejectedFromPassClaimsByName && (
                        <p className="text-xs text-gray-600 mt-2">
                          Rejected by: {claim.rejectedFromPassClaimsByName}
                          <span className="text-gray-500 capitalize ml-1">({claim.rejectedFromPassClaimsByRole})</span>
                        </p>
                      )}
                    </div>
                  )}

                  {claim.status === "Under Review" && claim.rejectedFromReleaseRequested === true && (
                    <div className="bg-red-50 rounded-md p-2 border border-red-200">
                      <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Rejected from Release
                      </p>
                      <p className="text-xs text-red-700 mt-1">{claim.reviewNotes}</p>
                      {claim.rejectedFromReleaseRequestedByName && (
                        <p className="text-xs text-gray-600 mt-2">
                          Rejected by: {claim.rejectedFromReleaseRequestedByName}
                          <span className="text-gray-500 capitalize ml-1">({claim.rejectedFromReleaseRequestedByRole})</span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* Claim Details */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-500">Claim Type</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        claim.claimType === "Advance" ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"
                      }`}>
                        {claim.claimType}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Amount</p>
                      <p className="text-sm font-semibold text-gray-900">₹{claim.claimAmount?.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-xs text-gray-500">Department</p>
                      <p className="text-sm text-gray-900 truncate">{claim.departmentName || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Co-Pay</p>
                      <p className="text-sm text-gray-900">{claim.coPayPercent}%</p>
                    </div>
                  </div>

                  {/* Insurance Info */}
                  <div>
                    <p className="text-xs text-gray-500">Insurance</p>
                    <p className="text-sm text-gray-900 truncate">{claim.insuranceProvider} - {claim.policyNumber}</p>
                  </div>
                </div>

                {/* Card Footer - Actions */}
                <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    #{claim._id?.slice(-6)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleViewClaim(claim)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-md hover:bg-gray-700 transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                    {claim.status === "Under Review" && !claim.rejectedFromReleaseRequested && (
                      <>
                        {permissions.canUpdate && (
                          <button
                            onClick={() => handleApprove(claim._id)}
                            disabled={actionLoading}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            Approve
                          </button>
                        )}
                        {permissions.canUpdate && (
                          <button
                            onClick={() => { setRejectModal(claim); setRejectionReason(""); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        )}
                      </>
                    )}
                    {claim.status === "Approved" && permissions.canUpdate && (
                      <button
                        onClick={() => { setRejectModal(claim); setRejectionReason(""); }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors"
                        title="Reject"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject
                      </button>
                    )}
                    {(claim.status === "Rejected" || (claim.status === "Under Review" && claim.rejectedFromReleaseRequested)) && permissions.canUpdate && (
                      <button
                        onClick={() => handleApprove(claim._id)}
                        disabled={actionLoading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                        title="Approve"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Approve
                      </button>
                    )}
                    {claim.status === "Ready" && (
                      <>
                        {permissions.canCreate && (
                          <button
                            onClick={() => openApprovalModal(claim)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-md hover:bg-indigo-700 transition-colors"
                            title="Create Plan"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            Create Plan
                          </button>
                        )}
                        {permissions.canUpdate && (
                          <button
                            onClick={() => { setRejectModal(claim); setRejectionReason(""); }}
                            className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-md hover:bg-red-700 transition-colors"
                            title="Reject"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
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
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
              {/* Rejection Notice Banner */}
              {viewModal.rejectedFromPassClaims === true && viewModal.reviewNotes && (
                <div className="bg-red-50 border-b border-red-200 px-6 py-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-red-900">Claim Rejected Back from Pass-Claims</p>
                      <p className="text-xs text-red-700 mt-1">{viewModal.reviewNotes}</p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-bold text-gray-900">Claim Details</h2>
                  <button
                    onClick={() => setShowTracking(!showTracking)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${
                      showTracking 
                        ? "bg-gray-900 text-white shadow-lg" 
                        : "bg-white/50 text-gray-700 hover:bg-white/80 border border-gray-200"
                    }`}
                  >
                    <Activity className="w-3 h-3" />
                    {showTracking ? "View Details" : "Track Claim"}
                  </button>
                </div>
                <button onClick={() => {
                  setViewModal(null);
                  setClaimDetails(null);
                }} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <div className="p-6 space-y-5">
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

                          const iconMap = { created: <FileText className="w-4 h-4 text-purple-600" />, approved: <CheckCircle className="w-4 h-4 text-green-600" />, rejected: <XCircle className="w-4 h-4 text-red-600" />, rejectPass: <AlertCircle className="w-4 h-4 text-orange-600" />, rejectRelease: <AlertCircle className="w-4 h-4 text-orange-600" />, ready: <CheckCircle className="w-4 h-4 text-indigo-600" />, released: <CheckCircle className="w-4 h-4 text-blue-600" />, completed: <CheckCircle className="w-4 h-4 text-purple-600" /> };
                          const bgMap = { created: "bg-purple-100", approved: "bg-green-100", rejected: "bg-red-100", rejectPass: "bg-orange-100", rejectRelease: "bg-orange-100", ready: "bg-indigo-100", released: "bg-blue-100", completed: "bg-purple-100" };
                          const badgeColorMap = { created: "text-purple-600 bg-purple-50", approved: "text-green-600 bg-green-50", rejected: "text-red-600 bg-red-50", rejectPass: "text-orange-600 bg-orange-50", rejectRelease: "text-orange-600 bg-orange-50", ready: "text-indigo-600 bg-indigo-50", released: "text-blue-600 bg-blue-50", completed: "text-purple-600 bg-purple-50" };

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
                                        {step.subtitle && <p className="text-[10px] font-semibold text-indigo-600 mt-0.5">Status: {step.subtitle}</p>}
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
                {/* Reviewer Tracking Section */}
                {(viewModal.approvedByName || viewModal.rejectedByName || viewModal.releasedByName || viewModal.readyByName || viewModal.completedByName || viewModal.rejectedFromReleaseRequestedByName) && (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Review History
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {viewModal.approvedByName && (
                        <div className="bg-white rounded-lg p-3 border border-green-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-xs font-semibold text-green-800 uppercase">Approved</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{viewModal.approvedByName}</p>
                          <p className="text-xs text-gray-600 capitalize">{viewModal.approvedByRole}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {viewModal.approvedAt ? new Date(viewModal.approvedAt).toLocaleString() : ""}
                          </p>
                        </div>
                      )}
                      {viewModal.rejectedByName && (
                        <div className="bg-white rounded-lg p-3 border border-red-200">
                          <div className="flex items-center gap-2 mb-2">
                            <XCircle className="w-4 h-4 text-red-600" />
                            <span className="text-xs font-semibold text-red-800 uppercase">Rejected</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{viewModal.rejectedByName}</p>
                          <p className="text-xs text-gray-600 capitalize">{viewModal.rejectedByRole}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {viewModal.rejectedAt ? new Date(viewModal.rejectedAt).toLocaleString() : ""}
                          </p>
                        </div>
                      )}
                      {viewModal.releasedByName && (
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-blue-600" />
                            <span className="text-xs font-semibold text-blue-800 uppercase">Released</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{viewModal.releasedByName}</p>
                          <p className="text-xs text-gray-600 capitalize">{viewModal.releasedByRole}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {viewModal.releasedAt ? new Date(viewModal.releasedAt).toLocaleString() : ""}
                          </p>
                        </div>
                      )}
                      {viewModal.readyByName && (
                        <div className="bg-white rounded-lg p-3 border border-indigo-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-indigo-600" />
                            <span className="text-xs font-semibold text-indigo-800 uppercase">Ready</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{viewModal.readyByName}</p>
                          <p className="text-xs text-gray-600 capitalize">{viewModal.readyByRole}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {viewModal.readyAt ? new Date(viewModal.readyAt).toLocaleString() : ""}
                          </p>
                        </div>
                      )}
                      {viewModal.completedByName && (
                        <div className="bg-white rounded-lg p-3 border border-purple-200">
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="w-4 h-4 text-purple-600" />
                            <span className="text-xs font-semibold text-purple-800 uppercase">Completed</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{viewModal.completedByName}</p>
                          <p className="text-xs text-gray-600 capitalize">{viewModal.completedByRole}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {viewModal.completedAt ? new Date(viewModal.completedAt).toLocaleString() : ""}
                          </p>
                        </div>
                      )}
                      {viewModal.rejectedFromReleaseRequestedByName && (
                        <div className="bg-white rounded-lg p-3 border border-orange-200">
                          <div className="flex items-center gap-2 mb-2">
                            <AlertCircle className="w-4 h-4 text-orange-600" />
                            <span className="text-xs font-semibold text-orange-800 uppercase">Release Reject</span>
                          </div>
                          <p className="text-sm font-medium text-gray-900">{viewModal.rejectedFromReleaseRequestedByName}</p>
                          <p className="text-xs text-gray-600 capitalize">{viewModal.rejectedFromReleaseRequestedByRole}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {viewModal.rejectedFromReleaseRequestedAt ? new Date(viewModal.rejectedFromReleaseRequestedAt).toLocaleString() : ""}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Patient & Insurance Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Patient Information</h3>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="text-gray-500">Name:</span> <span className="font-medium">{viewModal.patientFirstName} {viewModal.patientLastName}</span></p>
                      <p><span className="text-gray-500">Mobile:</span> <span className="font-medium">{viewModal.patientMobileNumber}</span></p>
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Insurance Details</h3>
                    <div className="space-y-1.5 text-sm">
                      <p><span className="text-gray-500">Provider:</span> <span className="font-medium">{viewModal.insuranceProvider}</span></p>
                      <p><span className="text-gray-500">Policy #:</span> <span className="font-medium">{viewModal.policyNumber}</span></p>
                      <p><span className="text-gray-500">Expiry:</span> <span className="font-medium">{viewModal.expiryDate ? new Date(viewModal.expiryDate).toLocaleDateString() : "-"}</span></p>
                    </div>
                  </div>
                </div>

                {/* Uploaded files */}
                {(viewModal.insuranceCardFile || viewModal.tableOfBenefitsFile) && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Uploaded Files</h3>
                    <div className="flex flex-wrap gap-3">
                      {viewModal.insuranceCardFile && (
                        <button 
                          onClick={() => setPreviewFile({ url: viewModal.insuranceCardFile, name: "Insurance Card", field: "insuranceCardFile" })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> Insurance Card
                        </button>
                      )}
                      {viewModal.tableOfBenefitsFile && (
                        <button 
                          onClick={() => setPreviewFile({ url: viewModal.tableOfBenefitsFile, name: "Table of Benefits", field: "tableOfBenefitsFile" })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> Table of Benefits
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Claim Details */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-800 mb-2">Claim Details</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Claim Type</p>
                      <p className="text-sm font-semibold text-gray-900">{viewModal.claimType}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Claim Amount</p>
                      <p className="text-sm font-semibold text-gray-900">{viewModal.claimAmount?.toLocaleString()}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Department</p>
                      <p className="text-sm font-semibold text-gray-900">{viewModal.departmentName || "-"}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 col-span-2 sm:col-span-1">
                      <p className="text-xs text-gray-500 mb-1">Services</p>
                      <div className="flex flex-wrap gap-1.5">
                        {viewModal.services && viewModal.services.length > 0 ? (
                          viewModal.services.map((svc, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[9px] font-bold whitespace-nowrap shadow-sm"
                            >
                              {svc.serviceName}
                            </span>
                          ))
                        ) : (
                          <p className="text-sm font-semibold text-gray-900">{viewModal.serviceName || "-"}</p>
                        )}
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Co-Pay %</p>
                      <p className="text-sm font-semibold text-gray-900">{viewModal.coPayPercent}%</p>
                    </div>
                    {(viewModal.claimType === "Advance" || viewModal.claimType === "Paid") && (
                      <>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">{viewModal.claimType} Status</p>
                          <p className="text-sm font-semibold text-gray-900">{viewModal.advanceStatus || "-"}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500">Paid Amount</p>
                          <p className="text-sm font-semibold text-gray-900">₹{viewModal.advanceAmount?.toLocaleString() || "0"}</p>
                        </div>
                        {viewModal.pendingClaim > 0 && (
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-xs text-gray-500">Pending Claim</p>
                            <p className="text-sm font-semibold text-orange-600">₹{viewModal.pendingClaim?.toLocaleString()}</p>
                          </div>
                        )}
                      </>
                    )}
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500">Status</p>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStatusBadge(viewModal.status)}`}>
                        {viewModal.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {viewModal.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Notes</h3>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{viewModal.notes}</p>
                  </div>
                )}

                {/* Treatment Plan */}
                {(viewModal.treatmentPlan || claimDetails?.treatmentPlan) && (String(viewModal.treatmentPlan || "").trim() !== "" || String(claimDetails?.treatmentPlan || "").trim() !== "") && (
                  <div className="mt-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Treatment Plan</h3>
                    <div className="text-sm text-gray-700 bg-purple-50 border border-purple-100 rounded-lg p-3 whitespace-pre-wrap leading-relaxed">
                      {claimDetails?.treatmentPlan || viewModal.treatmentPlan}
                    </div>
                  </div>
                )}

                {/* Document files */}
                {viewModal.documentFiles && viewModal.documentFiles.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800 mb-2">Claim Documents</h3>
                    <div className="flex flex-wrap gap-2">
                      {viewModal.documentFiles.map((file, idx) => (
                        <button 
                          key={idx} 
                          onClick={() => setPreviewFile({ url: file, name: `Document ${idx + 1}`, field: "documentFiles" })}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-lg text-xs font-medium text-purple-700 hover:bg-purple-100 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> Document {idx + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejection reason */}
                {viewModal.status === "Rejected" && viewModal.rejectionReason && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <h3 className="text-sm font-semibold text-red-800 mb-1">Rejection Reason</h3>
                    <p className="text-sm text-red-700">{viewModal.rejectionReason}</p>
                  </div>
                )}

                {/* Review info */}
                {viewModal.reviewedAt && (
                  <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
                    <p>Reviewed on: {new Date(viewModal.reviewedAt).toLocaleString()}</p>
                    {viewModal.reviewNotes && <p>Review notes: {viewModal.reviewNotes}</p>}
                  </div>
                )}

                {/* Administrative Details */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mt-4">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase mb-3 tracking-widest">Administrative Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-[10px]">
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span className="text-gray-500">Patient Name:</span>
                      <span className="font-semibold text-gray-700">{viewModal.patientFirstName} {viewModal.patientLastName}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span className="text-gray-500">Doctor Name:</span>
                      <span className="font-semibold text-gray-700">{viewModal.doctorName || "-"}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span className="text-gray-500">Insurance Provider:</span>
                      <span className="font-semibold text-gray-700">{viewModal.insuranceProvider}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span className="text-gray-500">Claim Type:</span>
                      <span className="font-semibold text-gray-700">{viewModal.claimType}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span className="text-gray-500">Created At:</span>
                      <span className="text-gray-700">{new Date(viewModal.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-1">
                      <span className="text-gray-500">Last Updated:</span>
                      <span className="text-gray-700">{new Date(viewModal.updatedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
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
                  {["Book Appointment", "Check Progress", "Consent Form", "Final Approval"].map((step, idx) => (
                    <div key={idx} className="flex items-center flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                        approvalStep > idx + 1 ? "bg-green-600 text-white" :
                        approvalStep === idx + 1 ? "bg-blue-600 text-white" :
                        "bg-gray-300 text-gray-600"
                      }`}>
                        {approvalStep > idx + 1 ? "✓" : idx + 1}
                      </div>
                      <span className={`ml-1.5 text-[10px] font-medium ${
                        approvalStep >= idx + 1 ? "text-gray-900" : "text-gray-500"
                      }`}>{step}</span>
                      {idx < 3 && <div className={`w-6 h-0.5 mx-1 ${approvalStep > idx + 1 ? "bg-green-600" : "bg-gray-300"}`} />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step Content */}
              <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)]">
                {/* Step 1: Book Appointment */}
                {approvalStep === 1 && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-blue-600" />
                      Step 1: Book Appointment
                    </h3>

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
                                    <span className={`inline-flex px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                      apt.status === 'booked' ? 'bg-green-100 text-green-800' :
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
                            setApprovalStep(2);
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

                {/* Step 2: Check Progress */}
                {approvalStep === 2 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-blue-600" />
                        Step 2: Progress Notes
                      </h3>
                      <button
                        onClick={() => setApprovalStep(1)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                        title="Back to Step 1"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                    {progressStatus !== null ? (
                      <div className="space-y-2">
                        <div className={`p-3 rounded-lg border ${
                          progressStatus.hasProgress ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
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
                        onClick={() => setApprovalStep(1)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={checkConsentStatus}
                        disabled={progressStatus === null}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Continue to Next Step
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Consent Form */}
                {approvalStep === 3 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        Step 3: Consent Form Status
                      </h3>
                      <button
                        onClick={() => setApprovalStep(2)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                        title="Back to Step 2"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                    {consentStatus ? (
                      <div className="space-y-2">
                        {/* Overall Status */}
                        <div className={`p-3 rounded-lg border ${
                          consentStatus.allSigned ? "bg-green-50 border-green-200" :
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
                              <div key={aptConsent.appointmentId || idx} className={`rounded-lg p-2 border ${
                                aptConsent.isSigned ? "bg-green-50 border-green-200" :
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
                        onClick={() => setApprovalStep(2)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={() => setApprovalStep(4)}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        Continue to Final Step
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Step 4: Final Approval */}
                {approvalStep === 4 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-blue-600" />
                        Step 4: Final Approval
                      </h3>
                      <button
                        onClick={() => setApprovalStep(3)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg"
                        title="Back to Step 3"
                      >
                        <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                    </div>
                
                    {/* Appointment Summary - Progress Notes & Consent Forms */}
                    {progressStatus?.appointments && consentStatus?.consentByAppointment && (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {progressStatus.appointments.map((apt, idx) => {
                          const aptNotes = (progressStatus.notes || []).filter(
                            (n) => (n.appointmentId?.toString() || n.appointmentId) === apt._id
                          );
                          const aptConsent = consentStatus.consentByAppointment.find(
                            (c) => c.appointmentId === apt._id
                          );
                
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
                                  aptNotes.map((note, nIdx) => (
                                    <p key={nIdx} className="text-[10px] text-gray-600 ml-2">
                                      ✓ {note.note || note.description || "Progress note recorded"}
                                    </p>
                                  ))
                                ) : (
                                  <p className="text-[10px] text-yellow-700 ml-2">⚠️ No progress note</p>
                                )}
                              </div>
                
                              {/* Consent Form */}
                              <div className="ml-2">
                                <p className="text-[10px] font-semibold text-gray-700 mb-1">Consent Form:</p>
                                {aptConsent ? (
                                  <div className="flex items-center justify-between ml-2">
                                    <p className="text-[10px] text-gray-600">
                                      {aptConsent.consentFormName || "Consent Form"}
                                    </p>
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
                                  <p className="text-[10px] text-red-700 ml-2">⚠️ No consent form</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                
                    {/* Warning if not all signed */}
                    {!consentStatus?.allSigned && (
                      <div className="p-2 rounded-lg bg-red-50 border border-red-200">
                        <p className="text-[11px] font-medium text-red-800">
                          ⚠️ All appointments must have signed consent forms.
                        </p>
                      </div>
                    )}
                
                    <div className="flex gap-2">
                      <button
                        onClick={() => setApprovalStep(3)}
                        className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                      >
                        ← Back
                      </button>
                      <button
                        onClick={handleFinalApproval}
                        disabled={actionLoading || !consentStatus?.allSigned}
                        className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {actionLoading ? "Completing..." : "Complete Claim"}
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
      </div>
    </div>
  );
}

AllClaimsPage.getLayout = function PageLayout(page) {
  // Always use ClinicLayout on /clinic/ paths
  const isClinicPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/clinic/');
  
  if (isClinicPath) {
    return <ClinicLayout>{page}</ClinicLayout>;
  }
  
  // Check user role and apply appropriate layout for non-clinic paths
  const role = getUserRole();
  
  // For agent and doctorStaff roles, use AgentLayout
  if (role === 'agent' || role === 'doctorStaff' || role === 'doctor') {
    return <AgentLayout>{page}</AgentLayout>;
  }
  
  // For clinic role, use ClinicLayout
  return <ClinicLayout>{page}</ClinicLayout>;
};

// Create protected versions for both auth types
const ClinicProtectedAllClaimsPage = withClinicAuth(AllClaimsPage);
const AgentProtectedAllClaimsPage = withAgentAuth(AllClaimsPage);

// Main component that chooses which protected version to use
const ProtectedAllClaimsPage = (props) => {
  // Always use clinic auth on /clinic/ paths
  const isClinicPath = typeof window !== 'undefined' && window.location.pathname.startsWith('/clinic/');
  
  if (isClinicPath) {
    return <ClinicProtectedAllClaimsPage {...props} />;
  }
  
  const role = getUserRole();
  
  // For agent and doctorStaff roles, use agent auth
  if (role === 'agent' || role === 'doctorStaff' || role === 'doctor') {
    return <AgentProtectedAllClaimsPage {...props} />;
  }
  
  // For clinic role, use clinic auth
  return <ClinicProtectedAllClaimsPage {...props} />;
};

ProtectedAllClaimsPage.getLayout = AllClaimsPage.getLayout;

export default ProtectedAllClaimsPage;

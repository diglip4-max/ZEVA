"use client";
  import React, { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import { Toaster, toast } from "react-hot-toast";
import { Loader2, Edit2, Trash2, CheckCircle, AlertCircle, Package, ChevronDown, X, Calendar, Search, User, Users, Plus, Save, Stethoscope, Percent, Clock, Star, Wrench, ArrowRight } from "lucide-react";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { useAgentPermissions } from "../../hooks/useAgentPermissions";

const MODULE_KEY = "Clinic_services_setup";
const TOKEN_PRIORITY = ["clinicToken", "agentToken", "doctorToken", "userToken", "staffToken", "adminToken"];

function getStoredToken() {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    try {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value) return value;
    } catch { }
  }
  return null;
}
function getAuthHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}
function slugify(text) {
  return (text || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function addMonths(dateString, months) {
  const d = new Date(dateString);
  if (isNaN(d)) return null;
  const copy = new Date(d.getTime());
  copy.setMonth(copy.getMonth() + (parseInt(months) || 0));
  return copy;
}

function isMembershipExpired(m) {
  if (!m || !m.createdAt || !m.durationMonths) return false;
  const expiry = addMonths(m.createdAt, m.durationMonths);
  if (!expiry) return false;
  return new Date() > expiry;
}

function getPackageStatus(pkg) {
  if (!pkg || !pkg.endDate) return 'Active';
  const endDate = new Date(pkg.endDate);
  const today = new Date();
  // Set today to start of day for accurate comparison
  today.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);

  if (today > endDate) {
    return 'Expired';
  }

  // Check if expiring within 7 days
  const sevenDaysFromToday = new Date(today);
  sevenDaysFromToday.setDate(today.getDate() + 7);

  if (endDate <= sevenDaysFromToday) {
    return 'Expiring Soon';
  }

  return 'Active';
}

// Time-based greeting for the overview header
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function ServicesSetupPage() {
  // Permission states
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [hasAgentToken, setHasAgentToken] = useState(false);
  const [isAgentRoute, setIsAgentRoute] = useState(false);
  const [userRole, setUserRole] = useState(null);

  // Multi-token role detection — checks all stored token types
  const getUserInfo = useCallback(() => {
    if (typeof window === "undefined") return { role: null, id: null };
    const tokenEntries = [
      ["clinicToken", "clinic"],
      ["doctorToken", "doctor"],
      ["agentToken", "agent"],
      ["staffToken", "staff"],
      ["userToken", "user"],
      ["adminToken", "admin"],
    ];
    for (const [tokenKey, defaultRole] of tokenEntries) {
      const token = localStorage.getItem(tokenKey) || sessionStorage.getItem(tokenKey);
      if (!token) continue;
      try {
        const base64Url = token.split(".")[1];
        if (!base64Url) return { role: defaultRole, id: null };
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const decoded = JSON.parse(
          decodeURIComponent(
            atob(base64)
              .split("")
              .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
              .join(""),
          ),
        );
        return { role: decoded.role || defaultRole, id: decoded.userId || decoded.id || null };
      } catch (e) {
        // Token decode failed — try next token
      }
    }
    return { role: null, id: null };
  }, []);

  // Helper function to get user role from token
  const getUserRole = useCallback(() => {
    return getUserInfo().role;
  }, [getUserInfo]);

  // Sync token state on mount and storage change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      const agentTok = localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken");
      setHasAgentToken(!!agentTok);
    };
    syncTokens();
    // Detect role once on mount for overview visibility gating
    setUserRole(getUserRole());
    window.addEventListener("storage", syncTokens);
    return () => window.removeEventListener("storage", syncTokens);
  }, []);

  // Determine if this is an agent route
  useEffect(() => {
    if (typeof window === "undefined") return;
    const agentPath = window.location.pathname?.startsWith("/agent/") || window.location.pathname?.startsWith("/staff/");
    setIsAgentRoute(agentPath && hasAgentToken);
  }, [hasAgentToken]);

  // Use agent permissions hook for agent routes
  const agentPermissionsHook = useAgentPermissions(
    isAgentRoute ? MODULE_KEY : null,
  );
  const agentPermissions = agentPermissionsHook?.permissions || {
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canAll: false,
  };
  const agentPermissionsLoading = agentPermissionsHook?.loading || false;

  // Handle agent permissions
  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;

    const newPermissions = {
      canRead: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canCreate: Boolean(agentPermissions.canAll || agentPermissions.canCreate),
      canUpdate: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDelete: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
    };

    setPermissions(newPermissions);
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  // Handle clinic permissions - clinic, doctor have admin-level permissions; agent/doctorStaff need checks
  useEffect(() => {
    if (isAgentRoute) return;
    let isMounted = true;

    // Check which token type is being used
    const clinicToken = typeof window !== "undefined" ? localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken") : null;
    const doctorToken = typeof window !== "undefined" ? localStorage.getItem("doctorToken") || sessionStorage.getItem("doctorToken") : null;
    const agentToken = typeof window !== "undefined" ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken") : null;
    const staffToken = typeof window !== "undefined" ? localStorage.getItem("staffToken") || sessionStorage.getItem("staffToken") : null;
    const userToken = typeof window !== "undefined" ? localStorage.getItem("userToken") || sessionStorage.getItem("userToken") : null;

    const userRole = getUserRole();
    const authToken = clinicToken || doctorToken || agentToken || staffToken || userToken;

    // For admin role, grant full access (bypass permission checks)
    if (userRole === "admin") {
      if (!isMounted) return;
      setPermissions({
        canRead: true,
        canCreate: true,
        canUpdate: true,
        canDelete: true,
      });
      setPermissionsLoaded(true);
      return;
    }

    // For clinic and doctor roles, fetch admin-level permissions from /api/clinic/sidebar-permissions
    if (userRole === "clinic" || userRole === "doctor") {
      const fetchClinicPermissions = async () => {
        try {
          if (!authToken) {
            if (!isMounted) return;
            setPermissions({
              canRead: false,
              canCreate: false,
              canUpdate: false,
              canDelete: false,
            });
            setPermissionsLoaded(true);
            return;
          }

          const res = await axios.get("/api/clinic/sidebar-permissions", {
            headers: { Authorization: `Bearer ${authToken}` },
          });

          if (!isMounted) return;

          if (res.data.success) {
            console.log("Sidebar permissions API response:", res.data);
            // Check if permissions array exists and is not null
            if (res.data.permissions === null || !Array.isArray(res.data.permissions) || res.data.permissions.length === 0) {
              // No admin restrictions set yet - default to full access for backward compatibility
              setPermissions({
                canRead: true,
                canCreate: true,
                canUpdate: true,
                canDelete: true,
              });
            } else {
              // Admin has set permissions - check the Clinic_services_setup module
              const modulePermission = res.data.permissions.find((p) => {
                if (!p?.module) return false;
                // Check for Clinic_services_setup module variations
                if (p.module === MODULE_KEY) return true;
                if (p.module === "clinic_services_setup") return true;
                if (p.module === "services_setup") return true;
                if (p.module === "Clinic_Services_Setup") return true;
                if (p.module === "clinic_Services_Setup") return true;
                return false;
              });

              if (modulePermission) {
                const actions = modulePermission.actions || {};

                console.log("Found module permission:", modulePermission);
                console.log("Actions:", actions);

                // Check if "all" is true, which grants all permissions
                const moduleAll = actions.all === true || actions.all === "true" || String(actions.all).toLowerCase() === "true";
                const moduleCreate = actions.create === true || actions.create === "true" || String(actions.create).toLowerCase() === "true";
                const moduleRead = actions.read === true || actions.read === "true" || String(actions.read).toLowerCase() === "true";
                const moduleUpdate = actions.update === true || actions.update === "true" || String(actions.update).toLowerCase() === "true";
                const moduleDelete = actions.delete === true || actions.delete === "true" || String(actions.delete).toLowerCase() === "true";

                console.log("Parsed permissions - all:", moduleAll, "create:", moduleCreate, "read:", moduleRead, "update:", moduleUpdate, "delete:", moduleDelete);

                setPermissions({
                  canRead: moduleAll || moduleRead,
                  canCreate: moduleAll || moduleCreate,
                  canUpdate: moduleAll || moduleUpdate,
                  canDelete: moduleAll || moduleDelete,
                });
              } else {
                // Module permission not found in the permissions array - default to read-only
                setPermissions({
                  canRead: true, // Clinic/doctor can always read their own data
                  canCreate: false,
                  canUpdate: false,
                  canDelete: false,
                });
              }
            }
          } else {
            // API response doesn't have permissions, default to full access (backward compatibility)
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
          }
        } catch (err) {
          console.error("Error fetching clinic sidebar permissions:", err);
          // On error, default to full access (backward compatibility)
          if (isMounted) {
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
          }
        } finally {
          if (isMounted) {
            setPermissionsLoaded(true);
          }
        }
      };

      fetchClinicPermissions();
      return;
    }

    // For agent/doctorStaff tokens (when not on agent route), check permissions
    const agentStaffToken = getStoredToken();
    if (!agentStaffToken) {
      setPermissions({
        canRead: false,
        canCreate: false,
        canUpdate: false,
        canDelete: false,
      });
      setPermissionsLoaded(true);
      return;
    }

    // Only check permissions for agent/doctorStaff roles when not on agent route
    if (agentToken || staffToken || userToken) {
      const fetchPermissions = async () => {
        try {
          console.log("Fetching Agent/Staff Permissions for", MODULE_KEY, "...");
          setPermissionsLoaded(false);
          // Use agent permissions API for agent/doctorStaff
          // Try Clinic_services_setup first
          let res = await axios.get("/api/agent/get-module-permissions", {
            params: { moduleKey: MODULE_KEY },
            headers: { Authorization: `Bearer ${agentStaffToken}` },
          });
          let data = res.data;

          // If not found, try other variations
          if (!data?.permissions && data?.error?.includes("not found")) {
            res = await axios.get("/api/agent/get-module-permissions", {
              params: { moduleKey: "clinic_services_setup" },
              headers: { Authorization: `Bearer ${agentStaffToken}` },
            });
            data = res.data;
          }

          console.log("Agent Permissions API Response:", data);

          if (!isMounted) return;

          // Default to true if module not found in permissions (matches backend logic)
          if (!data?.permissions && data?.error?.includes("not found in agent permissions")) {
            console.log("Module not found in permissions, granting full access by default");
            setPermissions({
              canRead: true,
              canCreate: true,
              canUpdate: true,
              canDelete: true,
            });
            return;
          }

          const actions = data?.permissions?.actions || data?.data?.moduleActions || {};
          const isTrue = (val) => val === true || val === "true" || String(val || "").toLowerCase() === "true";

          const canAll = isTrue(actions.all);

          const newPerms = {
            canRead: canAll || isTrue(actions.read),
            canCreate: canAll || isTrue(actions.create),
            canUpdate: canAll || isTrue(actions.update),
            canDelete: canAll || isTrue(actions.delete),
          };

          console.log("Final Agent/Staff Permissions:", newPerms);
          setPermissions(newPerms);
        } catch (err) {
          console.error("Error fetching agent permissions:", err);
          // Swallow agent permission errors; they will just result in no extra access
          setPermissions({
            canRead: false,
            canCreate: false,
            canUpdate: false,
            canDelete: false,
          });
        } finally {
          if (isMounted) {
            setPermissionsLoaded(true);
          }
        }
      };

      fetchPermissions();
    } else {
      // Unknown token type - default to full access (likely clinic/doctor)
      if (!isMounted) return;
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
  }, [isAgentRoute, getUserRole]);

  const [activeTab, setActiveTab] = useState("overview");
  const isClinicRole = userRole === "clinic" || userRole === "admin";

  // Non-clinic roles should never see the overview tab — redirect to services
  useEffect(() => {
    if (permissionsLoaded && !isClinicRole && activeTab === "overview") {
      setActiveTab("services");
    }
  }, [permissionsLoaded, isClinicRole, activeTab]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState('INR');
  const [clinicName, setClinicName] = useState("");
  // Guards one-time initial data load (all tabs' data is needed for counts + overview)
  const [dataInitialized, setDataInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "info", text: "" });

  const [departments, setDepartments] = useState([]);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [filterDepartmentId, setFilterDepartmentId] = useState("");
  const [servicesBatch, setServicesBatch] = useState([
    { name: "", price: "", durationMinutes: "", clinicPrice: "" },
  ]);

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingPrice, setEditingPrice] = useState("");
  const [editingDuration, setEditingDuration] = useState("");
  const [editingClinicPrice, setEditingClinicPrice] = useState("");
  const [editingDepartmentId, setEditingDepartmentId] = useState("");
  const [editingActive, setEditingActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Search states
  const [serviceSearchTerm, setServiceSearchTerm] = useState("");
  const [serviceStatusFilter, setServiceStatusFilter] = useState("all"); // all | active | inactive
  const [serviceViewMode, setServiceViewMode] = useState("list"); // list | grid
  const [membershipSearchTerm, setMembershipSearchTerm] = useState("");
  const [packageSearchTerm, setPackageSearchTerm] = useState("");

  const [memberships, setMemberships] = useState([]);
  const [memLoading, setMemLoading] = useState(true);
  const [memSubmitting, setMemSubmitting] = useState(false);
  const [memName, setMemName] = useState("");
  const [memPrice, setMemPrice] = useState("");
  const [memDurationMonths, setMemDurationMonths] = useState("");
  const [memFreeConsultations, setMemFreeConsultations] = useState("0");
  const [memDiscountPercentage, setMemDiscountPercentage] = useState("0");
  const [memPriorityBooking, setMemPriorityBooking] = useState(false);
  const [memEditingId, setMemEditingId] = useState(null);
  const [memEditingName, setMemEditingName] = useState("");
  const [memEditingPrice, setMemEditingPrice] = useState("");
  const [memEditingDurationMonths, setMemEditingDurationMonths] = useState("");
  const [memEditingFreeConsultations, setMemEditingFreeConsultations] = useState("0");
  const [memEditingDiscountPercentage, setMemEditingDiscountPercentage] = useState("0");
  const [memEditingPriorityBooking, setMemEditingPriorityBooking] = useState(false);
  const [memEditingActive, setMemEditingActive] = useState(true);
  const [memUpdating, setMemUpdating] = useState(false);
  const [memFilter, setMemFilter] = useState('all'); // all, active, expired, priority, upcoming-expiry

  // Packages state
  const [packages, setPackages] = useState([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [pkgSubmitting, setPkgSubmitting] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [pkgValidityInMonths, setPkgValidityInMonths] = useState("");
  const [pkgStartDate, setPkgStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [pkgEndDate, setPkgEndDate] = useState("");
  const [treatments, setTreatments] = useState([]);
  const [selectedTreatments, setSelectedTreatments] = useState([]); // Array of { treatmentName, treatmentSlug, sessions, allocatedPrice }
  const [treatmentDropdownOpen, setTreatmentDropdownOpen] = useState(false);
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState("");
  const [pkgEditingId, setPkgEditingId] = useState(null);
  const [pkgEditingName, setPkgEditingName] = useState("");
  const [pkgEditingPrice, setPkgEditingPrice] = useState("");
  const [pkgEditingValidityInMonths, setPkgEditingValidityInMonths] = useState("");
  const [pkgEditingStartDate, setPkgEditingStartDate] = useState("");
  const [pkgEditingEndDate, setPkgEditingEndDate] = useState("");
  const [pkgEditingActive, setPkgEditingActive] = useState(true);
  const [pkgUpdating, setPkgUpdating] = useState(false);
  const [pkgEditModalOpen, setPkgEditModalOpen] = useState(false);
  const [pkgEditTreatments, setPkgEditTreatments] = useState([]);
  const [pkgEditTreatmentDropdownOpen, setPkgEditTreatmentDropdownOpen] = useState(false);
  const [pkgEditTreatmentSearchQuery, setPkgEditTreatmentSearchQuery] = useState("");

  // Update end date based on validity months and start date (creation)
  useEffect(() => {
    if (pkgStartDate && pkgValidityInMonths && !isNaN(pkgValidityInMonths)) {
      const start = new Date(pkgStartDate);
      const months = parseInt(pkgValidityInMonths);
      const end = new Date(start);
      end.setMonth(start.getMonth() + months);
      setPkgEndDate(end.toISOString().split('T')[0]);
    } else {
      setPkgEndDate("");
    }
  }, [pkgStartDate, pkgValidityInMonths]);

  // Update end date based on validity months and start date (editing)
  useEffect(() => {
    if (pkgEditingStartDate && pkgEditingValidityInMonths && !isNaN(pkgEditingValidityInMonths)) {
      const start = new Date(pkgEditingStartDate);
      const months = parseInt(pkgEditingValidityInMonths);
      const end = new Date(start);
      end.setMonth(start.getMonth() + months);
      setPkgEditingEndDate(end.toISOString().split('T')[0]);
    } else {
      setPkgEditingEndDate("");
    }
  }, [pkgEditingStartDate, pkgEditingValidityInMonths]);

  // Fetch clinic currency preference
  useEffect(() => {
    const fetchClinicCurrency = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) return;
        const res = await axios.get('/api/clinics/myallClinic', { headers: authHeaders });
        if (res.data.success && res.data.clinic?.currency) {
          setCurrency(res.data.clinic.currency);
        }
        if (res.data.success && res.data.clinic?.name) {
          setClinicName(res.data.clinic.name);
        }
      } catch (e) {
        console.error('Error fetching clinic currency:', e);
      }
    };
    fetchClinicCurrency();
  }, []);

  const loadServices = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const params = {};
      if (filterDepartmentId) params.departmentId = filterDepartmentId;
      const res = await axios.get("/api/clinic/services", { headers, params });
      if (res.data.success) {
        setServices(res.data.services || []);
      } else {
        const errorMsg = res.data.message || "Failed to load services";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const status = error.response?.status;
      if (status !== 401 && status !== 403) {
        const errorMsg = error.response?.data?.message || "Failed to load services";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      setDepartmentsLoading(true);
      console.log("Loading departments with module:", MODULE_KEY);
      const res = await axios.get("/api/clinic/departments", {
        headers,
        params: { module: MODULE_KEY },
      });
      console.log("Departments API response:", res.data);
      if (res.data.success) {
        console.log("Departments loaded:", res.data.departments);
        setDepartments(res.data.departments || []);
      } else {
        const errorMsg = res.data.message || "Failed to load departments";
        console.error("Departments API error:", errorMsg);
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const status = error.response?.status;
      console.error("Departments load error - status:", status, error.response?.data);
      if (status === 403) {
        console.warn("403 Forbidden - departments may not be accessible");
        // Still set empty array to allow form to work
        setDepartments([]);
      } else if (status !== 401) {
        const errorMsg = error.response?.data?.message || "Failed to load departments";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } finally {
      setDepartmentsLoading(false);
    }
  };

  const handleAddRow = () => {
    setServicesBatch((prev) => [...prev, { name: "", price: "", durationMinutes: "", clinicPrice: "" }]);
  };

  const handleRemoveRow = (index) => {
    setServicesBatch((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRowChange = (index, field, value) => {
    setServicesBatch((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row))
    );
  };

  const handleCreateBatch = async (e) => {
    e.preventDefault();
    setMessage({ type: "info", text: "" });
    if (!selectedDepartmentId) {
      setMessage({ type: "error", text: "Please select a department" });
      return;
    }
    const prepared = servicesBatch
      .map((r) => ({
        name: (r.name || "").trim(),
        price: r.price,
        durationMinutes: r.durationMinutes,
        clinicPrice: r.clinicPrice === "" ? null : r.clinicPrice,
      }))
      .filter((r) => r.name);
    if (prepared.length === 0) {
      setMessage({ type: "error", text: "Please add at least one service" });
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(
        "/api/clinic/services",
        {
          departmentId: selectedDepartmentId,
          items: prepared,
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Services created";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setServicesBatch([{ name: "", price: "", durationMinutes: "", clinicPrice: "" }]);
        await loadServices();
      } else {
        const errorMsg = res.data.message || "Failed to create services";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to create services";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };



  const loadMemberships = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const res = await axios.get("/api/clinic/memberships", { headers });
      if (res.data.success) {
        setMemberships(res.data.memberships || []);
      } else {
        const errorMsg = res.data.message || "Failed to load memberships";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const status = error.response?.status;
      if (status !== 401 && status !== 403) {
        const errorMsg = error.response?.data?.message || "Failed to load memberships";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
      setMemberships([]);
    } finally {
      setMemLoading(false);
    }
  };

  useEffect(() => {
    if (!permissionsLoaded) return;
    // Always load departments (needed for create form even when canRead is false)
    loadDepartments();
    // Load every catalog dataset once so tab counts and the overview are accurate
    if (permissions.canRead && !dataInitialized) {
      setDataInitialized(true);
      loadServices();
      loadMemberships();
      loadPackages();
    }
  }, [permissionsLoaded, permissions.canRead]);

  useEffect(() => {
    // reload services on department filter change
    if (permissionsLoaded && permissions.canRead) {
      loadServices();
    }
  }, [filterDepartmentId, permissionsLoaded, permissions.canRead]);

  useEffect(() => {
    if (activeTab === "memberships") {
      const headers = getAuthHeaders();
      if (!headers) {
        setMessage({ type: "error", text: "Authentication required. Please log in again." });
        return;
      }
      (async () => {
        try {
          const res = await axios.get("/api/clinic/memberships", { headers });
          if (res.data.success) {
            setMemberships(res.data.memberships || []);
          } else {
            const errorMsg = res.data.message || "Failed to load memberships";
            setMessage({ type: "error", text: errorMsg });
            toast.error(errorMsg, { duration: 3000 });
          }
        } catch (error) {
          const status = error.response?.status;
          if (status !== 401 && status !== 403) {
            const errorMsg = error.response?.data?.message || "Failed to load memberships";
            setMessage({ type: "error", text: errorMsg });
            toast.error(errorMsg, { duration: 3000 });
          }
          setMemberships([]);
        } finally {
          setMemLoading(false);
        }
      })();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "packages") {
      const headers = getAuthHeaders();
      if (!headers) {
        setMessage({ type: "error", text: "Authentication required. Please log in again." });
        return;
      }
      (async () => {
        try {
          const res = await axios.get("/api/clinic/packages", { headers, params: { includeExpired: "true" } });
          if (res.data.success) {
            setPackages(res.data.packages || []);
          } else {
            const errorMsg = res.data.message || "Failed to load packages";
            setMessage({ type: "error", text: errorMsg });
            toast.error(errorMsg, { duration: 3000 });
          }
        } catch (error) {
          const status = error.response?.status;
          if (status !== 401 && status !== 403) {
            const errorMsg = error.response?.data?.message || "Failed to load packages";
            setMessage({ type: "error", text: errorMsg });
            toast.error(errorMsg, { duration: 3000 });
          }
          setPackages([]);
        } finally {
          setPkgLoading(false);
        }
      })();
    }
  }, [activeTab]);

  // Treatment selection functions
  const loadTreatments = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return [];
    }
    try {
      const res = await axios.get("/api/clinic/treatments", { headers });
      if (res.data.success) {
        const flattenedTreatments = [];
        const clinicTreatments = res.data.clinic?.treatments || [];

        clinicTreatments.forEach(mainTreatment => {
          if (mainTreatment.subTreatments && mainTreatment.subTreatments.length > 0) {
            mainTreatment.subTreatments.forEach(subTreatment => {
              flattenedTreatments.push({
                name: subTreatment.name,
                slug: subTreatment.slug,
                price: subTreatment.price,
                mainTreatment: mainTreatment.mainTreatment,
                type: "sub"
              });
            });
          } else {
            flattenedTreatments.push({
              name: mainTreatment.mainTreatment,
              slug: mainTreatment.mainTreatmentSlug,
              mainTreatment: null,
              type: "main"
            });
          }
        });

        // Also fetch Services and merge into the same list (without removing treatments)
        try {
          const servicesRes = await axios.get("/api/clinic/services", { headers });
          if (servicesRes.data?.success && Array.isArray(servicesRes.data.services)) {
            const services = servicesRes.data.services || [];
            services.forEach((svc) => {
              flattenedTreatments.push({
                name: svc.name,
                slug: svc.serviceSlug || svc._id,
                price: Number(svc.price) || 0,
                mainTreatment: "Service",
                type: "sub"
              });
            });
          }
        } catch {
          // Ignore services fetch errors and proceed with available treatments
        }

        setTreatments(flattenedTreatments);
        return flattenedTreatments;
      } else {
        const errorMsg = res.data.message || "Failed to load treatments";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
        return [];
      }
    } catch (error) {
      const status = error.response?.status;
      if (status !== 401 && status !== 403) {
        const errorMsg = error.response?.data?.message || "Failed to load treatments";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
      return [];
    }
  };

  const handleTreatmentToggle = (treatment) => {
    setSelectedTreatments((prev) => {
      const exists = prev.find((t) => t.treatmentSlug === treatment.slug);
      if (exists) {
        return prev.filter((t) => t.treatmentSlug !== treatment.slug);
      } else {
        setTreatmentDropdownOpen(false); // Close dropdown after selection
        return [...prev, { treatmentName: treatment.name, treatmentSlug: treatment.slug, sessions: 1, allocatedPrice: 0 }];
      }
    });
  };

  const handleRemoveTreatment = (treatmentSlug, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedTreatments((prev) => {
      return prev.filter((t) => t.treatmentSlug !== treatmentSlug);
    });
  };

  const handleSessionChange = (slug, sessions) => {
    setSelectedTreatments((prev) =>
      prev.map((t) => (t.treatmentSlug === slug ? { ...t, sessions: parseInt(sessions) || 1 } : t))
    );
  };

  const handleAllocatedPriceChange = (slug, allocatedPrice) => {
    setSelectedTreatments((prev) =>
      prev.map((t) => (t.treatmentSlug === slug ? { ...t, allocatedPrice: parseFloat(allocatedPrice) || 0 } : t))
    );
  };

  useEffect(() => {
    if (activeTab === "packages") {
      loadTreatments();
    }
  }, [activeTab]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setMessage({ type: "info", text: "" });
    if (!name.trim()) {
      setMessage({ type: "error", text: "Please enter a service name" });
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await axios.post(
        "/api/clinic/services",
        {
          name: name.trim(),
          serviceSlug: slugify(name),
          price: parseFloat(price),
          durationMinutes: parseInt(durationMinutes),
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Service created";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setName("");
        setPrice("");
        setDurationMinutes("");
        await loadServices();
      } else {
        const errorMsg = res.data.message || "Failed to create service";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to create service";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };



  const handleUpdate = async () => {
    if (!editingId) return;
    if (!editingName.trim()) {
      setMessage({ type: "error", text: "Service name cannot be empty" });
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setUpdating(true);
    try {
      const res = await axios.put(
        "/api/clinic/services",
        {
          serviceId: editingId,
          name: editingName.trim(),
          serviceSlug: slugify(editingName),
          price: parseFloat(editingPrice),
          durationMinutes: parseInt(editingDuration),
          clinicPrice: editingClinicPrice === "" ? null : parseFloat(editingClinicPrice),
          departmentId: editingDepartmentId || null,
          isActive: Boolean(editingActive),
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Service updated";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setEditingId(null);
        setEditingName("");
        setEditingPrice("");
        setEditingDuration("");
        await loadServices();
      } else {
        const errorMsg = res.data.message || "Failed to update service";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to update service";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setUpdating(false);
    }
  };



  const handleCreateMembership = async (e) => {
    e.preventDefault();
    setMessage({ type: "info", text: "" });
    if (!memName.trim()) {
      setMessage({ type: "error", text: "Please enter a name" });
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setMemSubmitting(true);
    try {
      const res = await axios.post(
        "/api/clinic/memberships",
        {
          name: memName.trim(),
          price: parseFloat(memPrice),
          durationMonths: parseInt(memDurationMonths),
          benefits: {
            freeConsultations: parseInt(memFreeConsultations),
            discountPercentage: parseFloat(memDiscountPercentage),
            priorityBooking: Boolean(memPriorityBooking),
          },
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Membership created";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setMemName("");
        setMemPrice("");
        setMemDurationMonths("");
        setMemFreeConsultations("0");
        setMemDiscountPercentage("0");
        setMemPriorityBooking(false);
        const reload = await axios.get("/api/clinic/memberships", { headers });
        setMemberships(reload.data.memberships || []);
      } else {
        const errorMsg = res.data.message || "Failed to create membership";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to create membership";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setMemSubmitting(false);
    }
  };

  const handleUpdateMembership = async () => {
    if (!memEditingId) return;
    if (!memEditingName.trim()) {
      setMessage({ type: "error", text: "Name cannot be empty" });
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setMemUpdating(true);
    try {
      const res = await axios.put(
        "/api/clinic/memberships",
        {
          itemId: memEditingId,
          name: memEditingName.trim(),
          price: parseFloat(memEditingPrice),
          durationMonths: parseInt(memEditingDurationMonths),
          benefits: {
            freeConsultations: parseInt(memEditingFreeConsultations),
            discountPercentage: parseFloat(memEditingDiscountPercentage),
            priorityBooking: Boolean(memEditingPriorityBooking),
          },
          isActive: Boolean(memEditingActive),
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Membership updated";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setMemEditingId(null);
        setMemEditingName("");
        setMemEditingPrice("");
        setMemEditingDurationMonths("");
        setMemEditingFreeConsultations("0");
        setMemEditingDiscountPercentage("0");
        setMemEditingPriorityBooking(false);
        const reload = await axios.get("/api/clinic/memberships", { headers });
        setMemberships(reload.data.memberships || []);
      } else {
        const errorMsg = res.data.message || "Failed to update membership";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to update membership";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setMemUpdating(false);
    }
  };

  const handleDeleteMembership = async (itemId) => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const res = await axios.delete(`/api/clinic/memberships`, { headers, data: { itemId } });
      if (res.data.success) {
        const successMsg = res.data.message || "Membership deleted";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        const reload = await axios.get("/api/clinic/memberships", { headers });
        setMemberships(reload.data.memberships || []);
      } else {
        const errorMsg = res.data.message || "Failed to delete membership";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete membership";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    }
  };

  // Packages API functions
  const loadPackages = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setPkgLoading(true);
    try {
      const res = await axios.get("/api/clinic/packages", { headers });
      if (res.data.success) {
        setPackages(res.data.packages || []);
      } else {
        const errorMsg = res.data.message || "Failed to load packages";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const status = error.response?.status;
      if (status !== 401 && status !== 403) {
        const errorMsg = error.response?.data?.message || "Failed to load packages";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
      setPackages([]);
    } finally {
      setPkgLoading(false);
    }
  };

  const handleCreatePackage = async (e) => {
    e.preventDefault();
    setMessage({ type: "info", text: "" });
    if (!pkgName.trim()) {
      setMessage({ type: "error", text: "Please enter a package name" });
      return;
    }
    if (!pkgPrice || parseFloat(pkgPrice) <= 0) {
      setMessage({ type: "error", text: "Please enter Total Package Price" });
      return;
    }
    if (!pkgStartDate || !pkgEndDate) {
      setMessage({ type: "error", text: "Please enter both Start Date and End Date" });
      return;
    }
    if (selectedTreatments.length === 0) {
      setMessage({ type: "error", text: "Please select at least one treatment" });
      return;
    }

    // Validate allocated prices
    const totalAllocated = selectedTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0);
    const packagePrice = parseFloat(pkgPrice);
    if (Math.abs(totalAllocated - packagePrice) > 0.01) {
      setMessage({
        type: "error",
        text: `Total allocated prices (${getCurrencySymbol(currency)}${totalAllocated.toFixed(2)}) must equal the package price (${getCurrencySymbol(currency)}${packagePrice.toFixed(2)})`
      });
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setPkgSubmitting(true);
    try {
      const res = await axios.post(
        "/api/clinic/packages",
        {
          name: pkgName.trim(),
          totalPrice: parseFloat(pkgPrice),
          validityInMonths: parseInt(pkgValidityInMonths) || 0,
          startDate: pkgStartDate,
          endDate: pkgEndDate,
          treatments: selectedTreatments,
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Package created successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setPkgName("");
        setPkgPrice("");
        setPkgValidityInMonths("");
        setPkgStartDate(new Date().toISOString().split('T')[0]);
        setPkgEndDate("");
        setSelectedTreatments([]);
        setTreatmentDropdownOpen(false); // Close dropdown
        await loadPackages();
      } else {
        const errorMsg = res.data.message || "Failed to create package";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to create package";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setPkgSubmitting(false);
    }
  };

  const handleUpdatePackage = async () => {
    if (!pkgEditingId) return;
    if (!pkgEditingName.trim()) {
      setMessage({ type: "error", text: "Package name cannot be empty" });
      return;
    }
    if (!pkgEditingPrice || parseFloat(pkgEditingPrice) < 0) {
      setMessage({ type: "error", text: "Please enter a valid price" });
      return;
    }
    if (pkgEditTreatments.length === 0) {
      setMessage({ type: "error", text: "Please select at least one treatment" });
      return;
    }

    // Validate allocated prices
    const totalAllocated = pkgEditTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0);
    const packagePrice = parseFloat(pkgEditingPrice);
    if (Math.abs(totalAllocated - packagePrice) > 0.01) {
      setMessage({
        type: "error",
        text: `Total allocated prices (${getCurrencySymbol(currency)}${totalAllocated.toFixed(2)}) must equal the package price (${getCurrencySymbol(currency)}${packagePrice.toFixed(2)})`
      });
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) return;

    setPkgUpdating(true);
    try {
      const res = await axios.put(
        "/api/clinic/packages",
        {
          packageId: pkgEditingId,
          name: pkgEditingName.trim(),
          totalPrice: parseFloat(pkgEditingPrice),
          validityInMonths: parseInt(pkgEditingValidityInMonths) || 0,
          startDate: pkgEditingStartDate,
          endDate: pkgEditingEndDate,
          isActive: pkgEditingActive,
          treatments: pkgEditTreatments,
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Package updated successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        closeEditModal();
        await loadPackages();
      } else {
        const errorMsg = res.data.message || "Failed to update package";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to update package";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setPkgUpdating(false);
    }
  };

  const openEditModal = (pkg) => {
    setPkgEditingId(pkg._id);
    setPkgEditingName(pkg.name);
    setPkgEditingPrice((pkg.totalPrice ?? pkg.price).toString());
    setPkgEditingValidityInMonths(pkg.validityInMonths ? pkg.validityInMonths.toString() : "");
    setPkgEditingStartDate(pkg.startDate ? new Date(pkg.startDate).toISOString().split('T')[0] : "");
    setPkgEditingEndDate(pkg.endDate ? new Date(pkg.endDate).toISOString().split('T')[0] : "");
    setPkgEditingActive(pkg.isActive !== false);
    if (pkg.treatments && Array.isArray(pkg.treatments)) {
      setPkgEditTreatments(
        pkg.treatments.map((t) => ({
          treatmentName: t.treatmentName || t.name || "",
          treatmentSlug: t.treatmentSlug || t.slug || "",
          sessions: t.sessions || 1,
          allocatedPrice: t.allocatedPrice || 0,
        }))
      );
    } else {
      setPkgEditTreatments([]);
    }
    setPkgEditModalOpen(true);
  };

  const closeEditModal = () => {
    setPkgEditingId(null);
    setPkgEditingName("");
    setPkgEditingPrice("");
    setPkgEditingValidityInMonths("");
    setPkgEditingStartDate("");
    setPkgEditingEndDate("");
    setPkgEditTreatments([]);
    setPkgEditTreatmentDropdownOpen(false);
    setPkgEditTreatmentSearchQuery("");
    setPkgEditModalOpen(false);
  };

  const handleEditTreatmentToggle = (treatment) => {
    setPkgEditTreatments((prev) => {
      const exists = prev.find((t) => t.treatmentSlug === treatment.slug);
      if (exists) {
        return prev.filter((t) => t.treatmentSlug !== treatment.slug);
      } else {
        setPkgEditTreatmentDropdownOpen(false);
        return [...prev, { treatmentName: treatment.name, treatmentSlug: treatment.slug, sessions: 1, allocatedPrice: 0 }];
      }
    });
  };

  const handleEditRemoveTreatment = (treatmentSlug, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setPkgEditTreatments((prev) => {
      return prev.filter((t) => t.treatmentSlug !== treatmentSlug);
    });
  };

  const handleEditSessionChange = (slug, sessions) => {
    setPkgEditTreatments((prev) =>
      prev.map((t) => (t.treatmentSlug === slug ? { ...t, sessions: parseInt(sessions) || 1 } : t))
    );
  };

  const handleEditAllocatedPriceChange = (slug, allocatedPrice) => {
    setPkgEditTreatments((prev) =>
      prev.map((t) => (t.treatmentSlug === slug ? { ...t, allocatedPrice: parseFloat(allocatedPrice) || 0 } : t))
    );
  };

  // ---- Package deletion confirmation state (for packages already sold to patients) ----
  const [pkgDeleteConfirm, setPkgDeleteConfirm] = useState(null);
  // pkgDeleteConfirm = { packageId, packageName, soldCount } when we need to ask user to confirm

  const handleDeletePackage = async (packageId, force = false) => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const url = force
        ? `/api/clinic/packages?packageId=${packageId}&force=true`
        : `/api/clinic/packages?packageId=${packageId}`;
      const res = await axios.delete(url, { headers });
      if (res.data.success) {
        const successMsg = res.data.message || "Package deleted successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setPkgDeleteConfirm(null);
        await loadPackages();
      } else {
        const errorMsg = res.data.message || "Failed to delete package";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      // 409 = package has been sold to patients — show confirmation prompt
      if (error.response?.status === 409 && error.response?.data?.soldToPatients) {
        const data = error.response.data;
        setPkgDeleteConfirm({
          packageId,
          packageName: data.packageName,
          soldCount: data.soldCount,
          message: data.message,
        });
        return;
      }
      const errorMessage = error.response?.data?.message || "Failed to delete package";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    }
  };
  const handleDelete = async (serviceId) => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const res = await axios.delete(`/api/clinic/services?serviceId=${serviceId}`, { headers });
      if (res.data.success) {
        const successMsg = res.data.message || "Service deleted";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        await loadServices();
      } else {
        const errorMsg = res.data.message || "Failed to delete service";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete service";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    }
  };



  // ---- Overview derived stats (computed from the loaded catalog data) ----
  // NOTE: these hooks must stay above the conditional Access-Denied return
  // below, otherwise the hook order changes between renders (React error).
  const activeServices = useMemo(() => services.filter((s) => s.isActive), [services]);
  const departmentCount = useMemo(
    () => new Set(services.map((s) => (s.departmentId && typeof s.departmentId === "object" ? String(s.departmentId._id) : String(s.departmentId || "unassigned")))).size,
    [services]
  );
  const avgServicePrice = useMemo(() => {
    if (services.length === 0) return 0;
    return services.reduce((sum, s) => sum + (Number(s.price) || 0), 0) / services.length;
  }, [services]);
  const activePackageCount = useMemo(
    () => packages.filter((p) => getPackageStatus(p) !== "Expired" && p.isActive !== false).length,
    [packages]
  );
  const liveMembershipCount = useMemo(
    () => memberships.filter((m) => m.isActive && !isMembershipExpired(m)).length,
    [memberships]
  );
  const totalEnrolled = useMemo(
    () => memberships.reduce((sum, m) => sum + (m.enrolledCount || 0), 0),
    [memberships]
  );

  // Catalog quality checks shown in the "Needs attention" card
  const discountInNameServices = useMemo(
    () => services.filter((s) => /\b\d{1,3}\s?%\b/i.test(s.name || "")),
    [services]
  );
  const noClinicPriceServices = useMemo(
    () => services.filter((s) => s.clinicPrice === undefined || s.clinicPrice === null || s.clinicPrice === ""),
    [services]
  );
  const inactiveServiceCount = services.length - activeServices.length;
  const expiringPackages = useMemo(
    () => packages.filter((p) => getPackageStatus(p) === "Expiring Soon"),
    [packages]
  );
  const catalogIssuesTotal =
    discountInNameServices.length + noClinicPriceServices.length + inactiveServiceCount + expiringPackages.length;
  const catalogHealthScore = services.length === 0
    ? 100
    : Math.max(0, Math.min(100, Math.round(((services.length - catalogIssuesTotal) / services.length) * 100)));

  const overviewTabs = [
    ...(isClinicRole ? [{ key: "overview", label: "Overview", count: null }] : []),
    { key: "services", label: "Services", count: services.length },
    { key: "memberships", label: "Memberships", count: memberships.length },
    { key: "packages", label: "Packages", count: packages.length },
  ];

  // Show access denied message only if BOTH read and create are false
  if (!permissions.canRead && !permissions.canCreate) {
    console.log("Rendering Access Denied - permissions:", permissions);
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Wrench className="w-8 h-8 text-yellow-600" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            Access Denied
          </h3>
          <p className="text-sm text-gray-700">
            You do not have permission to view or create services. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  // Helper to check if we should show list data (only when canRead is true)
  const shouldShowData = permissions.canRead;

  return (
    <>
      <Toaster position="top-right" />

      {/* ----------------------------------------------------------------
          Package Sold-To-Patients Delete Confirmation Modal
          Shown when clinic tries to delete a package that has already
          been sold to patients. Warns them but allows force-delete
          since patient benefits are preserved via snapshot data.
      ---------------------------------------------------------------- */}
      {pkgDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-orange-200 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Package Already Sold to Patients</h3>
                <p className="text-xs text-gray-500 mt-0.5">"{pkgDeleteConfirm.packageName}"</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-orange-800 leading-relaxed">
                This package has been sold to <span className="font-bold">{pkgDeleteConfirm.soldCount} patient(s)</span>.
              </p>
              <p className="text-xs text-orange-700 leading-relaxed mt-1.5">
                <span className="font-semibold">Important:</span> Deleting this package from the catalogue will <span className="font-bold underline">NOT</span> remove benefits from patients who already purchased it. They will retain full access to all sessions and treatments via stored package data.
              </p>
            </div>
            <p className="text-xs text-gray-600 mb-5">
              Do you want to proceed with removing this package from the clinic catalogue?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPkgDeleteConfirm(null)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeletePackage(pkgDeleteConfirm.packageId, true)}
                className="flex-1 px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                Yes, Remove from Catalogue
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 w-full lg:w-[95%] xl:w-[90%] mx-auto">
        {/* Tab navigation */}
        <div className="flex border-b border-[#E7E1D5] mb-2 overflow-x-auto scrollbar-hide">
          {overviewTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`px-5 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${activeTab === t.key
                ? "border-[#1F1D1A] text-[#1F1D1A] font-semibold"
                : "border-transparent text-[#6B6862] font-medium hover:text-[#1F1D1A]"
                }`}
            >
              {t.label}
              {t.count !== null && (
                <span className="ml-2 text-xs font-normal text-[#9B968D]">{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <div>
          {message.text && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded border ${message.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : message.type === "success"
                  ? "bg-[#F5F1E8] text-[#1F1D1A] border-[#E0D9C8]"
                  : "bg-sky-50 text-sky-800 border-sky-200"
                }`}
            >
              {message.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              <span className="text-sm">{message.text}</span>
            </div>
          )}
        </div>

        {activeTab === "overview" && isClinicRole && (
          <div className="bg-[#F7F5EF] rounded-xl border border-[#E7E1D5] px-6 py-8 lg:px-10 lg:py-10">
            {/* Greeting */}
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A98545]">Overview</p>
            <h1 className="mt-2 text-3xl lg:text-4xl font-bold text-[#1F1D1A] tracking-tight">
              {getGreeting()}{clinicName ? `, ${clinicName}` : ""}
            </h1>
            <p className="mt-3 text-lg text-[#6B6862]">
              Your catalog holds {services.length} services, {packages.length} packages and {memberships.length} membership tiers. Here is what needs a look.
            </p>

            {/* Stat tiles */}
            <div className="mt-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 border-t border-b border-[#E7E1D5] divide-x divide-[#E7E1D5]">
              {[
                { value: services.length, label: "Services", sub: `across ${departmentCount} ${departmentCount === 1 ? "department" : "departments"}` },
                { value: activeServices.length, label: "Active services", sub: services.length > 0 ? `${((activeServices.length / services.length) * 100).toFixed(1)}% of catalog` : "No services yet" },
                { value: avgServicePrice.toFixed(2), label: "Avg service price", sub: `${currency} · listed services` },
                { value: packages.length, label: "Packages", sub: `${activePackageCount} active` },
                { value: memberships.length, label: "Membership tiers", sub: `${liveMembershipCount} live` },
                { value: totalEnrolled, label: "Members enrolled", sub: "across all tiers" },
              ].map((tile) => (
                <div key={tile.label} className="px-5 py-6">
                  <div className="text-3xl font-bold text-[#1F1D1A] tracking-tight">{tile.value}</div>
                  <div className="mt-2 text-sm font-semibold text-[#1F1D1A]">{tile.label}</div>
                  <div className="mt-1 text-xs text-[#9B968D]">{tile.sub}</div>
                </div>
              ))}
            </div>

            {/* Signal + Needs attention cards */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Catalog health gauge */}
              <div className="bg-white border border-[#E7E1D5] rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A98545]">Signal</p>
                    <h2 className="mt-1 text-lg font-bold text-[#1F1D1A]">Catalog health</h2>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-[#F1EBDD] border border-[#E3DAC6] text-xs font-semibold text-[#6B5B37]">Based on ZEVA data</span>
                </div>
                {(() => {
                  const cx = 130, cy = 130, r = 100;
                  const score = catalogHealthScore;
                  const arc = (aDeg) => {
                    const rad = (aDeg * Math.PI) / 180;
                    return `${cx + r * Math.cos(rad)} ${cy - r * Math.sin(rad)}`;
                  };
                  const valueAngle = 180 - (score / 100) * 180;
                  const tickRad = (valueAngle * Math.PI) / 180;
                  const tickInner = { x: cx + (r - 9) * Math.cos(tickRad), y: cy - (r - 9) * Math.sin(tickRad) };
                  const tickOuter = { x: cx + (r + 9) * Math.cos(tickRad), y: cy - (r + 9) * Math.sin(tickRad) };
                  return (
                    <div className="mt-4 flex flex-col items-center">
                      <svg viewBox="0 0 260 150" className="w-full max-w-[320px]">
                        <path d={`M 30 130 A 100 100 0 0 1 230 130`} fill="none" stroke="#EDE8DD" strokeWidth="14" strokeLinecap="round" />
                        {score > 0 && (
                          <path d={`M 30 130 A 100 100 0 0 1 ${arc(valueAngle)}`} fill="none" stroke="#3E7A5E" strokeWidth="14" strokeLinecap="round" />
                        )}
                        <line x1={tickInner.x} y1={tickInner.y} x2={tickOuter.x} y2={tickOuter.y} stroke="#A98545" strokeWidth="4" strokeLinecap="round" />
                        <text x={cx} y={122} textAnchor="middle" fontSize="44" fontWeight="700" fill="#1F1D1A">{score}</text>
                      </svg>
                      <div className="w-full max-w-[320px] flex justify-between text-xs text-[#9B968D] -mt-1">
                        <span>0</span>
                        <span>100</span>
                      </div>
                    </div>
                  );
                })()}
                <p className="mt-3 text-xs text-[#9B968D] text-center">
                  Score drops for every catalog item flagged in “Needs attention”.
                </p>
              </div>

              {/* Catalog items to review */}
              <div className="bg-white border border-[#E7E1D5] rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A98545]">Needs Attention</p>
                    <h2 className="mt-1 text-lg font-bold text-[#1F1D1A]">Catalog items to review</h2>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-[#F1EBDD] border border-[#E3DAC6] text-xs font-semibold text-[#6B5B37]">Based on ZEVA data</span>
                </div>
                <div className="mt-4 border-t border-[#E7E1D5]" />
                {catalogIssuesTotal === 0 ? (
                  <div className="py-12 text-center">
                    <div className="w-12 h-12 mx-auto bg-[#EAF1EC] rounded-full flex items-center justify-center mb-3">
                      <CheckCircle className="w-6 h-6 text-[#3E7A5E]" />
                    </div>
                    <h3 className="text-base font-semibold text-[#1F1D1A]">Nothing needs a look</h3>
                    <p className="text-sm text-[#6B6862] mt-1">Your catalog is clean across services, packages and memberships.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[#E7E1D5]">
                    {discountInNameServices.length > 0 && (
                      <div className="py-5 flex items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-[#1F1D1A]">{discountInNameServices.length} {discountInNameServices.length === 1 ? "service has" : "services have"} a discount written into the name</h3>
                          {/* <div className="mt-3 space-y-2">
                            <div className="flex gap-4"><span className="text-xs font-bold uppercase tracking-wider text-[#A98545] w-16 shrink-0">Why</span><span className="text-sm text-[#6B6862]">Names like “Hydrafacial 30% 350” hide the pricing rule, so the discount can’t be tracked on its own.</span></div>
                            <div className="flex gap-4"><span className="text-xs font-bold uppercase tracking-wider text-[#A98545] w-16 shrink-0">Impact</span><span className="text-sm text-[#6B6862]">Offer reporting and margin checks undercount these services.</span></div>
                          </div> */}
                        </div>
                        <button onClick={() => setActiveTab("services")} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D9D2C2] bg-white text-sm font-semibold text-[#1F1D1A] hover:bg-[#F1EBDD] transition-colors">
                          Review services <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {noClinicPriceServices.length > 0 && (
                      <div className="py-5 flex items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-[#1F1D1A]">{noClinicPriceServices.length} {noClinicPriceServices.length === 1 ? "service has" : "services have"} no clinic price</h3>
                          {/* <div className="mt-3 space-y-2">
                            <div className="flex gap-4"><span className="text-xs font-bold uppercase tracking-wider text-[#A98545] w-16 shrink-0">Why</span><span className="text-sm text-[#6B6862]">Without a clinic price the listing falls back to the patient-facing rate for internal invoicing.</span></div>
                            <div className="flex gap-4"><span className="text-xs font-bold uppercase tracking-wider text-[#A98545] w-16 shrink-0">Impact</span><span className="text-sm text-[#6B6862]">Billing and margin reports may overstate revenue for these services.</span></div>
                          </div> */}
                        </div>
                        <button onClick={() => setActiveTab("services")} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D9D2C2] bg-white text-sm font-semibold text-[#1F1D1A] hover:bg-[#F1EBDD] transition-colors">
                          Review services <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {inactiveServiceCount > 0 && (
                      <div className="py-5 flex items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-[#1F1D1A]">{inactiveServiceCount} {inactiveServiceCount === 1 ? "service is" : "services are"} inactive</h3>
                          {/* <div className="mt-3 space-y-2">
                            <div className="flex gap-4"><span className="text-xs font-bold uppercase tracking-wider text-[#A98545] w-16 shrink-0">Why</span><span className="text-sm text-[#6B6862]">Inactive services stay in the catalog but can’t be booked or sold.</span></div>
                            <div className="flex gap-4"><span className="text-xs font-bold uppercase tracking-wider text-[#A98545] w-16 shrink-0">Impact</span><span className="text-sm text-[#6B6862]">Packages or memberships referencing them will show unavailable treatments.</span></div>
                          </div> */}
                        </div>
                        <button onClick={() => setActiveTab("services")} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D9D2C2] bg-white text-sm font-semibold text-[#1F1D1A] hover:bg-[#F1EBDD] transition-colors">
                          Review services <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {expiringPackages.length > 0 && (
                      <div className="py-5 flex items-start gap-4">
                        <div className="flex-1">
                          <h3 className="text-base font-bold text-[#1F1D1A]">{expiringPackages.length} {expiringPackages.length === 1 ? "package expires" : "packages expire"} within 7 days</h3>
                          {/* <div className="mt-3 space-y-2">
                            <div className="flex gap-4"><span className="text-xs font-bold uppercase tracking-wider text-[#A98545] w-16 shrink-0">Why</span><span className="text-sm text-[#6B6862]">Patients holding these packages lose access to remaining sessions once the end date passes.</span></div>
                            <div className="flex gap-4"><span className="text-xs font-bold uppercase tracking-wider text-[#A98545] w-16 shrink-0">Impact</span><span className="text-sm text-[#6B6862]">Unused sessions become unbilled liability and can trigger complaints.</span></div>
                          </div> */}
                        </div>
                        <button onClick={() => setActiveTab("packages")} className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#D9D2C2] bg-white text-sm font-semibold text-[#1F1D1A] hover:bg-[#F1EBDD] transition-colors">
                          Review packages <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Catalog Mix + Recently Added */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              {/* Services by department */}
              <div className="bg-white border border-[#E7E1D5] rounded-2xl p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A98545]">Catalog Mix</p>
                    <h2 className="mt-1 text-lg font-bold text-[#1F1D1A]">Services by department</h2>
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-[#F1EBDD] border border-[#E3DAC6] text-xs font-semibold text-[#6B5B37]">{services.length} services</span>
                </div>

                <div className="mt-6 space-y-5">
                  {(() => {
                    // Group services by department name
                    const deptMap = {};
                    services.forEach((s) => {
                      let deptName = "Unassigned";
                      if (s.departmentId && typeof s.departmentId === "object" && s.departmentId.name) {
                        deptName = s.departmentId.name;
                      } else {
                        const d = departments.find((dd) => dd._id === String(s.departmentId || ""));
                        if (d) deptName = d.name;
                      }
                      deptMap[deptName] = (deptMap[deptName] || 0) + 1;
                    });
                    const sorted = Object.entries(deptMap).sort((a, b) => b[1] - a[1]);
                    const barColors = ["#3E7A5E", "#A98545", "#3E7A5E", "#B5AE9F", "#B5AE9F", "#A98545", "#3E7A5E", "#B5AE9F"];

                    if (sorted.length === 0) {
                      return <p className="text-sm text-[#9B968D]">No services yet</p>;
                    }
                    return sorted.map(([name, count], idx) => {
                      const pct = services.length > 0 ? ((count / services.length) * 100) : 0;
                      const color = barColors[idx % barColors.length];
                      return (
                        <div key={name}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold text-[#1F1D1A]">{name}</span>
                            <span className="text-sm text-[#6B6862]">{count} · {pct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-[#EDE8DD] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Recently added */}
              <div className="bg-white border border-[#E7E1D5] rounded-2xl p-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A98545]">Activity</p>
                  <h2 className="mt-1 text-lg font-bold text-[#1F1D1A]">Recently added</h2>
                </div>

                <div className="mt-5 divide-y divide-[#E7E1D5]">
                  {(() => {
                    // Merge services + packages sorted by createdAt desc, take top 5
                    const items = [
                      ...services.map((s) => ({
                        type: "Service",
                        name: s.name,
                        sub: (() => {
                          let deptName = "";
                          if (s.departmentId && typeof s.departmentId === "object" && s.departmentId.name) deptName = s.departmentId.name;
                          else { const d = departments.find((dd) => dd._id === String(s.departmentId || "")); if (d) deptName = d.name; }
                          return `${deptName ? deptName + " · " : ""}${getCurrencySymbol(currency)}${Number(s.price || 0).toFixed(2)}`;
                        })(),
                        date: s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "",
                        createdAt: s.createdAt,
                      })),
                      ...packages.map((p) => ({
                        type: "Package",
                        name: p.name,
                        sub: `${p.totalSessions || (p.treatments ? p.treatments.reduce((s, t) => s + (t.sessions || 0), 0) : 0)} session${(p.totalSessions || (p.treatments ? p.treatments.reduce((s, t) => s + (t.sessions || 0), 0) : 0)) === 1 ? "" : "s"} · ${getCurrencySymbol(currency)}${Number(p.totalPrice || 0).toFixed(2)}`,
                        date: p.createdAt ? new Date(p.createdAt).toLocaleDateString() : "",
                        createdAt: p.createdAt,
                      })),
                    ].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 5);

                    if (items.length === 0) {
                      return <p className="text-sm text-[#9B968D] py-4">Nothing added yet</p>;
                    }
                    return items.map((item, idx) => (
                      <div key={idx} className="py-4 flex items-start gap-4">
                        <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${
                          item.type === "Service" ? "bg-[#E7EFE9] text-[#3E7A5E]" : "bg-[#F1EBDD] text-[#A98545]"
                        }`}>
                          {item.type}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1F1D1A] truncate">{item.name}</p>
                          <p className="text-xs text-[#9B968D] mt-0.5">{item.sub}</p>
                        </div>
                        <span className="shrink-0 text-xs text-[#9B968D]">{item.date}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "services" && (
          <>
            {/* Service Creation Form - Modern Healthcare UI */}
            {permissions.canCreate && (
              <div className="bg-gradient-to-br from-[#F7F5EF] to-[#F2EFE6] dark:from-transparent dark:to-transparent dark:bg-transparent border border-[#E3DDCE] rounded-xl p-4 mb-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#1F1D1A] flex items-center justify-center shadow-sm">
                    <Wrench className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#1F1D1A] dark:text-white tracking-tight">Create New Service</h2>
                    <p className="text-xs text-[#58544D] dark:text-gray-300">Add a new service offering for your clinic</p>
                  </div>
                </div>

                <form onSubmit={handleCreateBatch} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#3F3C36] dark:text-gray-200 mb-1.5">
                        Department
                      </label>
                      <select
                        value={selectedDepartmentId}
                        onChange={(e) => setSelectedDepartmentId(e.target.value)}
                        className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                        disabled={departmentsLoading}
                        required
                      >
                        <option value="" disabled>Select department</option>
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {servicesBatch.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
                        <div>
                          <label className="block text-xs font-medium text-[#3F3C36] dark:text-gray-200 mb-1.5">Service Name</label>
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => handleRowChange(idx, "name", e.target.value)}
                            placeholder="e.g., Dental Cleaning"
                            className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#3F3C36] dark:text-gray-200 mb-1.5">Price ({getCurrencySymbol(currency)})</label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8577] font-medium text-sm">{getCurrencySymbol(currency)}</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.price}
                              onChange={(e) => handleRowChange(idx, "price", e.target.value)}
                              placeholder="0.00"
                              className="w-full border border-[#E3DDCE] rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#3F3C36] dark:text-gray-200 mb-1.5">Duration (Minutes)</label>
                          <input
                            type="number"
                            min="5"
                            value={row.durationMinutes}
                            onChange={(e) => handleRowChange(idx, "durationMinutes", e.target.value)}
                            placeholder="30"
                            className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs"
                            required
                          />
                        </div>
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-[#3F3C36] dark:text-gray-200 mb-1.5">Clinic Price ({getCurrencySymbol(currency)})</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8577] font-medium text-sm">{getCurrencySymbol(currency)}</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={row.clinicPrice}
                                onChange={(e) => handleRowChange(idx, "clinicPrice", e.target.value)}
                                placeholder="0.00"
                                className="w-full border border-[#E3DDCE] rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs"
                              />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            disabled={servicesBatch.length === 1}
                            className="h-10 px-3 bg-rose-100 text-rose-700 text-xs font-medium rounded-md hover:bg-rose-200 disabled:opacity-50"
                            title="Remove row"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between">
                      <button
                        type="button"
                        onClick={handleAddRow}
                        className="px-3 py-2 bg-white text-[#3F3C36] border border-[#E3DDCE] rounded-lg text-xs font-medium hover:bg-[#F7F5EF]"
                      >
                        <Plus className="inline w-3 h-3 mr-1" />
                        Add Service Row
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="px-4 py-2 bg-[#1F1D1A] text-white text-xs font-medium rounded-lg hover:bg-[#3A362E] disabled:opacity-60 transition-all shadow-sm flex items-center gap-1.5"
                      >
                        {submitting ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            Create Services
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {/* Service Display Section */}
            {shouldShowData && (
              <div className="bg-white border border-[#E7E1D5] rounded-2xl shadow-sm overflow-hidden">
                {/* Card Header */}
                <div className="px-6 pt-6 pb-4">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#A98545]">Catalog</p>
                      <h2 className="mt-1 text-lg font-bold text-[#1F1D1A]">Service catalog</h2>
                      <p className="text-sm text-[#6B6862] mt-0.5">Manage your clinic's service offerings</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B5AE9F]" />
                        <input
                          type="text"
                          placeholder="Search services..."
                          value={serviceSearchTerm}
                          onChange={(e) => setServiceSearchTerm(e.target.value)}
                          className="pl-9 pr-4 py-2.5 text-sm bg-white border border-[#E3DDCE] rounded-xl focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] text-gray-700 w-full sm:w-56"
                        />
                      </div>
                      <select
                        value={filterDepartmentId}
                        onChange={(e) => setFilterDepartmentId(e.target.value)}
                        className="px-4 py-2.5 text-sm bg-white border border-[#E3DDCE] rounded-xl focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] text-gray-700"
                      >
                        <option value="">All departments</option>
                        {departments.map((d) => (
                          <option key={d._id} value={d._id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Filter tabs + View toggle */}
                  <div className="mt-5 flex items-center justify-between border-b border-[#E7E1D5]">
                    <div className="flex gap-6">
                      {[{ key: "all", label: "All" }, { key: "active", label: "Active" }, { key: "inactive", label: "Inactive" }].map((f) => (
                        <button
                          key={f.key}
                          onClick={() => setServiceStatusFilter(f.key)}
                          className={`pb-2.5 text-sm border-b-2 -mb-px transition-colors ${serviceStatusFilter === f.key ? "border-[#1F1D1A] text-[#1F1D1A] font-semibold" : "border-transparent text-[#6B6862] font-medium hover:text-[#1F1D1A]"}`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-4 pb-2.5">
                      <button onClick={() => setServiceViewMode("list")} className={`pb-0 text-sm border-b-2 -mb-px transition-colors ${serviceViewMode === "list" ? "border-[#1F1D1A] text-[#1F1D1A] font-semibold" : "border-transparent text-[#6B6862] font-medium hover:text-[#1F1D1A]"}`}>
                        List
                      </button>
                      <button onClick={() => setServiceViewMode("grid")} className={`pb-0 text-sm border-b-2 -mb-px transition-colors ${serviceViewMode === "grid" ? "border-[#1F1D1A] text-[#1F1D1A] font-semibold" : "border-transparent text-[#6B6862] font-medium hover:text-[#1F1D1A]"}`}>
                        Grid
                      </button>
                    </div>
                  </div>
                </div>

                {/* Filtered services list */}
                {(() => {
                  const filtered = services.filter((s) => {
                    const matchesSearch = s.name.toLowerCase().includes(serviceSearchTerm.toLowerCase());
                    const matchesStatus = serviceStatusFilter === "all" ? true : serviceStatusFilter === "active" ? s.isActive : !s.isActive;
                    return matchesSearch && matchesStatus;
                  });

                  if (loading) {
                    return (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-5 h-5 animate-spin text-[#6B6862]" />
                        <span className="ml-2 text-sm text-[#6B6862]">Loading services...</span>
                      </div>
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12">
                        <div className="w-12 h-12 mx-auto bg-[#F1EBDD] rounded-full flex items-center justify-center mb-3">
                          <Wrench className="w-6 h-6 text-[#B5AE9F]" />
                        </div>
                        <h3 className="text-base font-semibold text-[#1F1D1A] mb-1">No services found</h3>
                        <p className="text-sm text-[#6B6862]">Try adjusting your search or filter criteria</p>
                      </div>
                    );
                  }

                  // LIST VIEW (table)
                  if (serviceViewMode === "list") {
                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-t border-[#E7E1D5] bg-[#FAF8F4]">
                              <th className="text-left px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#6B6862]">Service</th>
                              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#6B6862]">Department</th>
                              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#6B6862]">Duration</th>
                              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#6B6862]">Price</th>
                              <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#6B6862]">Clinic Price</th>
                              <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider text-[#6B6862]">Created</th>
                              <th className="text-right px-6 py-3 text-xs font-bold uppercase tracking-wider text-[#6B6862]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#E7E1D5]">
                            {filtered.map((s) => {
                              const deptName = (() => {
                                if (s.departmentId && typeof s.departmentId === "object" && s.departmentId.name) return s.departmentId.name;
                                const d = departments.find((dd) => dd._id === String(s.departmentId || ""));
                                return d ? d.name : "—";
                              })();
                              return (
                                <tr key={s._id} className="hover:bg-[#FAF8F4] transition-colors">
                                  <td className="px-6 py-4">
                                    <p className="font-semibold text-[#1F1D1A]">{s.name}</p>
                                    <span className={`inline-flex items-center mt-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${s.isActive ? "bg-[#E7EFE9] text-[#3E7A5E]" : "bg-gray-100 text-gray-600"}`}>
                                      {s.isActive ? "Active" : "Inactive"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-4 text-[#6B6862]">{deptName}</td>
                                  <td className="px-4 py-4 text-[#6B6862]">{s.durationMinutes} min</td>
                                  <td className="px-4 py-4 text-right font-semibold text-[#1F1D1A]">{getCurrencySymbol(currency)} {Number(s.price || 0).toFixed(2)}</td>
                                  <td className="px-4 py-4 text-right text-[#6B6862]">{s.clinicPrice != null && s.clinicPrice !== "" ? `${getCurrencySymbol(currency)} ${Number(s.clinicPrice).toFixed(2)}` : "—"}</td>
                                  <td className="px-4 py-4 text-[#6B6862]">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="inline-flex items-center gap-2">
                                      {permissions.canUpdate && editingId !== s._id && (
                                        <button
                                          onClick={() => {
                                            setEditingId(s._id);
                                            setEditingName(s.name || "");
                                            setEditingPrice(String(s.price ?? ""));
                                            setEditingDuration(String(s.durationMinutes ?? ""));
                                            setEditingClinicPrice(s.clinicPrice !== undefined && s.clinicPrice !== null ? String(s.clinicPrice) : "");
                                            setEditingDepartmentId(s.departmentId ? (typeof s.departmentId === "object" ? String(s.departmentId._id || "") : String(s.departmentId)) : "");
                                            setEditingActive(Boolean(s.isActive));
                                          }}
                                          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#D9D2C2] rounded-lg text-xs font-semibold text-[#1F1D1A] hover:bg-[#F1EBDD] transition-colors"
                                        >
                                          <Edit2 className="w-3 h-3" /> Edit
                                        </button>
                                      )}
                                      {permissions.canDelete && (
                                        <button
                                          onClick={() => handleDelete(s._id)}
                                          className="inline-flex items-center justify-center w-8 h-8 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  }

                  // GRID VIEW (cards)
                  return (
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {filtered.map((s) => {
                        const deptName = (() => {
                          if (s.departmentId && typeof s.departmentId === "object" && s.departmentId.name) return s.departmentId.name;
                          const d = departments.find((dd) => dd._id === String(s.departmentId || ""));
                          return d ? d.name : "Unassigned";
                        })();
                        return (
                          <div key={s._id} className="border border-[#E7E1D5] rounded-xl p-4 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <h3 className="text-sm font-bold text-[#1F1D1A]">{s.name}</h3>
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${s.isActive ? "bg-[#E7EFE9] text-[#3E7A5E]" : "bg-gray-100 text-gray-600"}`}>
                                {s.isActive ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <div className="space-y-1.5 text-xs text-[#6B6862]">
                              <div className="flex justify-between"><span>Department</span><span className="font-medium text-[#1F1D1A]">{deptName}</span></div>
                              <div className="flex justify-between"><span>Duration</span><span className="font-medium text-[#1F1D1A]">{s.durationMinutes} min</span></div>
                              <div className="flex justify-between"><span>Price</span><span className="font-medium text-[#1F1D1A]">{getCurrencySymbol(currency)}{Number(s.price || 0).toFixed(2)}</span></div>
                              <div className="flex justify-between"><span>Clinic Price</span><span className="font-medium text-[#1F1D1A]">{s.clinicPrice != null && s.clinicPrice !== "" ? getCurrencySymbol(currency) + Number(s.clinicPrice).toFixed(2) : "—"}</span></div>
                              <div className="flex justify-between"><span>Created</span><span className="font-medium text-[#1F1D1A]">{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "—"}</span></div>
                            </div>
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#E7E1D5]">
                              {permissions.canUpdate && (
                                <button
                                  onClick={() => {
                                    setEditingId(s._id);
                                    setEditingName(s.name || "");
                                    setEditingPrice(String(s.price ?? ""));
                                    setEditingDuration(String(s.durationMinutes ?? ""));
                                    setEditingClinicPrice(s.clinicPrice !== undefined && s.clinicPrice !== null ? String(s.clinicPrice) : "");
                                    setEditingDepartmentId(s.departmentId ? (typeof s.departmentId === "object" ? String(s.departmentId._id || "") : String(s.departmentId)) : "");
                                    setEditingActive(Boolean(s.isActive));
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 border border-[#D9D2C2] rounded-lg text-xs font-semibold text-[#1F1D1A] hover:bg-[#F1EBDD] transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" /> Edit
                                </button>
                              )}
                              {permissions.canDelete && (
                                <button onClick={() => handleDelete(s._id)} className="flex items-center justify-center w-8 h-8 border border-red-200 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}

                {/* Inline Edit Panel (shown below table when editing) */}
                {editingId && (
                  <div className="border-t border-[#E7E1D5] p-6 bg-[#FAF8F4]">
                    <h3 className="text-sm font-bold text-[#1F1D1A] mb-4">Edit Service</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-[#6B6862] mb-1">Name</label>
                        <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white" autoFocus />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6B6862] mb-1">Price ({getCurrencySymbol(currency)})</label>
                        <input type="number" min="0" step="0.01" value={editingPrice} onChange={(e) => setEditingPrice(e.target.value)} className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6B6862] mb-1">Duration (min)</label>
                        <input type="number" min="5" value={editingDuration} onChange={(e) => setEditingDuration(e.target.value)} className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6B6862] mb-1">Department</label>
                        <select value={editingDepartmentId} onChange={(e) => setEditingDepartmentId(e.target.value)} className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white">
                          <option value="">Unassigned</option>
                          {departments.map((d) => (<option key={d._id} value={d._id}>{d.name}</option>))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6B6862] mb-1">Clinic Price ({getCurrencySymbol(currency)})</label>
                        <input type="number" min="0" step="0.01" value={editingClinicPrice} onChange={(e) => setEditingClinicPrice(e.target.value)} className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[#6B6862] mb-1">Status</label>
                        <select value={editingActive ? "active" : "inactive"} onChange={(e) => setEditingActive(e.target.value === "active")} className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white">
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-5">
                      <button onClick={handleUpdate} disabled={updating} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1F1D1A] text-white text-sm font-medium rounded-lg hover:bg-[#3A362E] disabled:opacity-60 transition-colors">
                        {updating ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</> : <><Save className="w-3.5 h-3.5" /> Save Changes</>}
                      </button>
                      <button onClick={() => { setEditingId(null); setEditingName(""); setEditingPrice(""); setEditingDuration(""); setEditingActive(true); }} className="px-4 py-2 border border-[#D9D2C2] rounded-lg text-sm font-medium text-[#6B6862] hover:bg-[#F1EBDD] transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {activeTab === "memberships" && (
          <>
            {/* Membership Creation Form - Compact Healthcare UI */}
            {permissions.canCreate && (
              <div className="bg-gradient-to-br from-[#F7F5EF] to-[#F2EFE6] border border-[#E3DDCE] rounded-xl p-4 mb-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="w-8 h-8 rounded-lg bg-[#1F1D1A] flex items-center justify-center shadow-sm">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-[#1F1D1A] tracking-tight">Create New Membership</h2>
                    <p className="text-xs text-[#58544D]">Set up membership plans for your patients</p>
                  </div>
                </div>
                <form onSubmit={handleCreateMembership} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#3F3C36] mb-1.5">
                        Membership Name
                      </label>
                      <input
                        type="text"
                        value={memName}
                        onChange={(e) => setMemName(e.target.value)}
                        placeholder="e.g., Premium Annual Plan"
                        className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#3F3C36] mb-1.5">
                        Price ({getCurrencySymbol(currency)})
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8C8577] font-medium text-sm">{getCurrencySymbol(currency)}</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={memPrice}
                          onChange={(e) => setMemPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full border border-[#E3DDCE] rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                          required
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#3F3C36] mb-1.5">
                        Duration (Months)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={memDurationMonths}
                        onChange={(e) => setMemDurationMonths(e.target.value)}
                        placeholder="12"
                        className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-[#3F3C36] mb-1.5">
                        Free Consultations
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={memFreeConsultations}
                        onChange={(e) => setMemFreeConsultations(e.target.value)}
                        placeholder="0 (0 = unlimited)"
                        className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#3F3C36] mb-1.5">
                        Discount Percentage
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={memDiscountPercentage}
                          onChange={(e) => setMemDiscountPercentage(e.target.value)}
                          placeholder="0.0"
                          className="w-full border border-[#E3DDCE] rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C8577] font-medium text-sm">%</span>
                      </div>
                    </div>
                    <div className="flex items-end">
                      <label className="flex items-center gap-2 text-xs font-medium text-[#3F3C36] cursor-pointer">
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={memPriorityBooking}
                            onChange={(e) => setMemPriorityBooking(e.target.checked)}
                            className="sr-only"
                          />
                          <div className={`w-9 h-5 rounded-full transition-colors ${memPriorityBooking ? 'bg-[#1F1D1A]' : 'bg-gray-300'}`}>
                            <div className={`absolute w-3 h-3 bg-white rounded-full shadow-xs transform transition-transform ${memPriorityBooking ? 'translate-x-5' : 'translate-x-1'} top-1`}></div>
                          </div>
                        </div>
                        Priority Booking
                      </label>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={memSubmitting}
                      className="px-4 py-2 bg-[#1F1D1A] text-white text-xs font-medium rounded-lg hover:bg-[#3A362E] disabled:opacity-60 transition-all shadow-sm flex items-center gap-1.5"
                    >
                      {memSubmitting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-3 h-3" />
                          Create Membership
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Membership Display Section - Compact Healthcare UI */}
            {shouldShowData && (
              <div className="bg-white border border-[#E3DDCE] rounded-xl p-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-[#F1EBDD] flex items-center justify-center">
                      <Users className="w-4 h-4 text-[#58544D]" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-[#1F1D1A] tracking-tight">Membership Plans</h2>
                      <p className="text-xs text-[#58544D]">Manage your clinic's membership offerings</p>
                    </div>
                  </div>

                  {/* Filter Controls */}
                  <div className="flex flex-wrap gap-2">
                    {/* Membership Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#B5AE9F]" />
                      <input
                        type="text"
                        placeholder="Search memberships..."
                        value={membershipSearchTerm}
                        onChange={(e) => setMembershipSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-1.5 text-xs font-medium bg-white border border-[#E3DDCE] rounded-lg focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] text-gray-700 w-full sm:w-64"
                      />
                    </div>
                    <select
                      value={memFilter}
                      onChange={(e) => setMemFilter(e.target.value)}
                      className="px-3 py-1.5 text-xs font-medium bg-white border border-[#E3DDCE] rounded-lg focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] text-gray-700 dark:bg-white dark:text-gray-900"
                    >
                      <option value="all">All Memberships</option>
                      <option value="active">Active</option>
                      <option value="expired">Expired</option>
                      <option value="priority">Priority Booking</option>
                      <option value="expiring-1-month">Expiring in 1 Month</option>
                      <option value="expiring-2-months">Expiring in 2 Months</option>
                      <option value="expiring-3-months">Expiring in 3 Months</option>
                      <option value="recent">Recent</option>
                    </select>
                  </div>
                </div>

                {memLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="flex items-center gap-2 text-[#58544D]">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-xs font-medium">Loading memberships...</span>
                    </div>
                  </div>
                ) : memberships.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto bg-[#F1EBDD] rounded-full flex items-center justify-center mb-3">
                      <Users className="w-6 h-6 text-[#B5AE9F]" />
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-1">No memberships created yet</h3>
                    <p className="text-xs text-gray-600">Create your first membership plan to get started</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {(() => {
                      // Filter memberships based on selected filter and search term
                      const filteredMemberships = memberships.filter(m => {
                        const isExpired = isMembershipExpired(m);
                        const isActive = m.isActive && !isExpired;

                        // Apply filter based on memFilter
                        let passesFilter = true;
                        switch (memFilter) {
                          case 'active':
                            passesFilter = isActive;
                            break;
                          case 'expired':
                            passesFilter = isExpired;
                            break;
                          case 'priority':
                            passesFilter = m.benefits?.priorityBooking === true;
                            break;
                          case 'expiring-soon':
                            // Show memberships that will expire soon (within 30 days)
                            if (!isActive) passesFilter = false; // Only consider active memberships
                            else {
                              const expirationDate = new Date(m.createdAt);
                              expirationDate.setMonth(expirationDate.getMonth() + m.durationMonths);
                              const today = new Date();
                              const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                              passesFilter = daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
                            }
                            break;
                          case 'expiring-1-month':
                            // Show memberships expiring within 1 month
                            if (!isActive) passesFilter = false; // Only consider active memberships
                            else {
                              const expDate1 = new Date(m.createdAt);
                              expDate1.setMonth(expDate1.getMonth() + m.durationMonths);
                              const today1 = new Date();
                              const daysUntilExpiry1 = Math.ceil((expDate1.getTime() - today1.getTime()) / (1000 * 60 * 60 * 24));
                              passesFilter = daysUntilExpiry1 <= 30 && daysUntilExpiry1 >= 0;
                            }
                            break;
                          case 'expiring-2-months':
                            // Show memberships expiring within 2 months
                            if (!isActive) passesFilter = false; // Only consider active memberships
                            else {
                              const expDate2 = new Date(m.createdAt);
                              expDate2.setMonth(expDate2.getMonth() + m.durationMonths);
                              const today2 = new Date();
                              const daysUntilExpiry2 = Math.ceil((expDate2.getTime() - today2.getTime()) / (1000 * 60 * 60 * 24));
                              passesFilter = daysUntilExpiry2 <= 60 && daysUntilExpiry2 >= 0;
                            }
                            break;
                          case 'expiring-3-months':
                            // Show memberships expiring within 3 months
                            if (!isActive) passesFilter = false; // Only consider active memberships
                            else {
                              const expDate3 = new Date(m.createdAt);
                              expDate3.setMonth(expDate3.getMonth() + m.durationMonths);
                              const today3 = new Date();
                              const daysUntilExpiry3 = Math.ceil((expDate3.getTime() - today3.getTime()) / (1000 * 60 * 60 * 24));
                              passesFilter = daysUntilExpiry3 <= 90 && daysUntilExpiry3 >= 0;
                            }
                            break;
                          case 'recent':
                            // Show recently created memberships (last 7 days)
                            const createdDate = new Date(m.createdAt);
                            const daysSinceCreation = Math.ceil((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                            passesFilter = daysSinceCreation <= 7;
                            break;
                          default: // 'all'
                            passesFilter = true;
                        }

                        // Apply search filter
                        const passesSearch = m.name.toLowerCase().includes(membershipSearchTerm.toLowerCase());

                        return passesFilter && passesSearch;
                      });

                      if (filteredMemberships.length === 0) {
                        return (
                          <div key="no-results" className="col-span-full text-center py-8">
                            <div className="w-12 h-12 mx-auto bg-[#F1EBDD] rounded-full flex items-center justify-center mb-3">
                              <Users className="w-6 h-6 text-[#A98545]" />
                            </div>
                            <h3 className="text-base font-medium text-gray-900 mb-1">No memberships found</h3>
                            <p className="text-xs text-gray-600">Try changing your filter criteria</p>
                          </div>
                        );
                      }
                      return filteredMemberships.map((m) => {
                        const isExpired = isMembershipExpired(m);
                        const isActive = m.isActive && !isExpired;
                        const statusColor = isActive ? 'bg-[#E7EFE9] text-[#3E7A5E]' : isExpired ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
                        const statusText = isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive';

                        return (
                          <div
                            key={m._id}
                            className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${isActive ? 'border-[#E0D9C8] shadow-sm' :
                              isExpired ? 'border-red-200 bg-red-50 shadow-sm' : 'border-gray-200 shadow-sm'
                              }`}
                            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                          >
                            {/* Membership Header */}
                            <div className={`px-4 py-3 ${isActive ? 'bg-gradient-to-r from-[#F7F5EF] to-[#F2EFE6]' :
                              isExpired ? 'bg-gradient-to-r from-red-50 to-pink-50' : 'bg-gradient-to-r from-gray-50 to-slate-50'
                              }`}>
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <h3 className="text-sm font-bold text-gray-900 mb-1 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>{m.name}</h3>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor} shadow-xs`}>
                                      {statusText}
                                    </span>
                                    {m.benefits?.priorityBooking && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 shadow-xs">
                                        <Star className="w-2.5 h-2.5 mr-1" />
                                        Priority
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-lg font-semibold text-[#3F3C36] tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>{getCurrencySymbol(currency)}{Number(m.price || 0).toFixed(2)}</div>
                                  <div className="text-[10px] text-gray-600">{m.durationMonths} months</div>
                                </div>
                              </div>
                            </div>

                            {/* Membership Benefits */}
                            <div className="p-3">
                              <div className="space-y-2">
                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 bg-[#F1EBDD] rounded-md">
                                      <Calendar className="w-3.5 h-3.5 text-[#58544D]" />
                                    </div>
                                    <span className="text-[10px] text-gray-600 font-medium">Duration</span>
                                  </div>
                                  <span className="text-xs font-medium text-gray-900">{m.durationMonths} months</span>
                                </div>

                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 bg-[#F1EBDD] rounded-md">
                                      <Stethoscope className="w-3.5 h-3.5 text-[#58544D]" />
                                    </div>
                                    <span className="text-[10px] text-gray-600 font-medium">Free Consultations</span>
                                  </div>
                                  <span className="text-xs font-medium text-gray-900">
                                    {m.benefits?.freeConsultations === 0 ? 'Unlim' : m.benefits?.freeConsultations || 0}
                                  </span>
                                </div>

                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 bg-[#F1EBDD] rounded-md">
                                      <Percent className="w-3.5 h-3.5 text-[#58544D]" />
                                    </div>
                                    <span className="text-[10px] text-gray-600 font-medium">Discount</span>
                                  </div>
                                  <span className="text-xs font-medium text-gray-900">{m.benefits?.discountPercentage || 0}%</span>
                                </div>

                                <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                  <div className="flex items-center gap-1.5">
                                    <div className="p-1.5 bg-[#F1EBDD] rounded-md">
                                      <Clock className="w-3.5 h-3.5 text-[#58544D]" />
                                    </div>
                                    <span className="text-[10px] text-gray-600 font-medium">Priority</span>
                                  </div>
                                  <span className={`text-xs font-medium ${m.benefits?.priorityBooking ? 'text-[#58544D]' : 'text-gray-400'}`}>
                                    {m.benefits?.priorityBooking ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>

                              {/* Action Buttons - EDIT FUNCTIONALITY FULLY PRESERVED */}
                              <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-100">
                                {memEditingId !== m._id ? (
                                  <>
                                    {permissions.canUpdate && (
                                      <button
                                        onClick={() => {
                                          setMemEditingId(m._id);
                                          setMemEditingName(m.name || "");
                                          setMemEditingPrice(String(m.price ?? ""));
                                          setMemEditingDurationMonths(String(m.durationMonths ?? ""));
                                          setMemEditingFreeConsultations(String(m.benefits?.freeConsultations ?? "0"));
                                          setMemEditingDiscountPercentage(String(m.benefits?.discountPercentage ?? "0"));
                                          setMemEditingPriorityBooking(Boolean(m.benefits?.priorityBooking));
                                          setMemEditingActive(Boolean(m.isActive));
                                        }}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#F1EBDD] text-[#1F1D1A] text-xs font-medium rounded-md hover:bg-[#E3DAC6] transition-colors"
                                      >
                                        <Edit2 className="w-3 h-3" />
                                        Edit
                                      </button>
                                    )}
                                    {permissions.canDelete && (
                                      <button
                                        onClick={() => handleDeleteMembership(m._id)}
                                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-md hover:bg-red-200 transition-colors"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <div className="space-y-3 p-3 bg-[#F5F1E8] rounded-lg border border-[#E0D9C8]">
                                    <h3 className="text-xs font-semibold text-[#1F1D1A] mb-2">Edit Membership</h3>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[10px] font-medium text-[#3F3C36] mb-1">
                                          Name
                                        </label>
                                        <input
                                          type="text"
                                          value={memEditingName}
                                          onChange={(e) => setMemEditingName(e.target.value)}
                                          className="w-full border border-[#E3DDCE] rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-[#3F3C36] mb-1">
                                          Price
                                        </label>
                                        <div className="relative">
                                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#A98545] font-medium text-xs">{getCurrencySymbol(currency)}</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={memEditingPrice}
                                            onChange={(e) => setMemEditingPrice(e.target.value)}
                                            className="w-full border border-[#E3DDCE] rounded-lg pl-6 pr-2 py-1.5 text-xs focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                          />
                                        </div>
                                      </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                      <div>
                                        <label className="block text-[10px] font-medium text-[#3F3C36] mb-1">
                                          Duration (Months)
                                        </label>
                                        <input
                                          type="number"
                                          min="1"
                                          value={memEditingDurationMonths}
                                          onChange={(e) => setMemEditingDurationMonths(e.target.value)}
                                          className="w-full border border-[#E3DDCE] rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-[#3F3C36] mb-1">
                                          Free Cons
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          value={memEditingFreeConsultations}
                                          onChange={(e) => setMemEditingFreeConsultations(e.target.value)}
                                          className="w-full border border-[#E3DDCE] rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-[10px] font-medium text-[#3F3C36] mb-1">
                                          Discount %
                                        </label>
                                        <input
                                          type="number"
                                          min="0"
                                          max="100"
                                          step="0.1"
                                          value={memEditingDiscountPercentage}
                                          onChange={(e) => setMemEditingDiscountPercentage(e.target.value)}
                                          className="w-full border border-[#E3DDCE] rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 hover:border-[#C9C2B1] transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between pt-2">
                                      <label className="flex items-center gap-2 text-[10px] font-medium text-[#3F3C36]">
                                        <input
                                          type="checkbox"
                                          checked={memEditingPriorityBooking}
                                          onChange={(e) => setMemEditingPriorityBooking(e.target.checked)}
                                          className="w-3 h-3 text-[#58544D] rounded focus:ring-[#A98545]"
                                        />
                                        Priority
                                      </label>

                                      <div className="flex items-center gap-2">
                                        <select
                                          value={memEditingActive ? "active" : "inactive"}
                                          onChange={(e) => setMemEditingActive(e.target.value === "active")}
                                          className="border border-[#E3DDCE] rounded-lg px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white text-gray-900 dark:bg-white dark:text-gray-900"
                                          style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                        >
                                          <option value="active">Active</option>
                                          <option value="inactive">Inactive</option>
                                        </select>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2 pt-3">
                                      <button
                                        onClick={handleUpdateMembership}
                                        disabled={memUpdating}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#1F1D1A] text-white text-xs font-medium rounded-md hover:bg-[#3A362E] disabled:opacity-60 transition-colors"
                                      >
                                        {memUpdating ? (
                                          <>
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            Saving...
                                          </>
                                        ) : (
                                          <>
                                            <Save className="w-3 h-3" />
                                            Save
                                          </>
                                        )}
                                      </button>
                                      <button
                                        onClick={() => {
                                          setMemEditingId(null);
                                          setMemEditingName("");
                                          setMemEditingPrice("");
                                          setMemEditingDurationMonths("");
                                          setMemEditingFreeConsultations("0");
                                          setMemEditingDiscountPercentage("0");
                                          setMemEditingPriorityBooking(false);
                                        }}
                                        className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-gray-100 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
                                      >
                                        <X className="w-3 h-3" />
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                )}
              </div>
            )}
          </>
        )}
        {activeTab === "packages" && (
          <>
            {permissions.canCreate && (
              <div className="bg-gradient-to-br from-[#F7F5EF] to-[#F2EFE6] border border-[#E3DDCE] rounded-xl p-5 mb-6 shadow-sm">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-lg bg-[#1F1D1A] flex items-center justify-center shadow-md">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-[#1F1D1A]">Create New Package</h2>
                    <p className="text-xs text-[#58544D]">Define package details and allocate treatments</p>
                  </div>
                </div>

                <form onSubmit={handleCreatePackage} className="space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#3F3C36] mb-1.5">Package Name</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={pkgName}
                            onChange={(e) => setPkgName(e.target.value)}
                            placeholder="Enter package name"
                            className="w-full px-3 py-2.5 text-sm border border-[#E3DDCE] rounded-lg focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400 shadow-sm transition-all"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-[#3F3C36] mb-1.5">Total Package Price</label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-base">{getCurrencySymbol(currency)}</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={pkgPrice}
                            onChange={(e) => setPkgPrice(e.target.value)}
                            placeholder=""
                            className="w-full pl-8 pr-3 py-2.5 text-sm border border-[#E3DDCE] rounded-lg focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400 shadow-sm transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                        <div>
                          <label className="block text-[10px] sm:text-xs font-semibold text-[#3F3C36] mb-1 sm:mb-1.5">Validity (Months)</label>
                          <input
                            type="number"
                            min="0"
                            value={pkgValidityInMonths}
                            onChange={(e) => setPkgValidityInMonths(e.target.value)}
                            placeholder="e.g. 12"
                            className="w-full px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm border border-[#E3DDCE] rounded-lg focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400 shadow-sm transition-all placeholder:text-[10px] sm:placeholder:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-semibold text-[#3F3C36] mb-1 sm:mb-1.5">Start Date</label>
                          <input
                            type="date"
                            value={pkgStartDate}
                            onChange={(e) => setPkgStartDate(e.target.value)}
                            className="w-full px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm border border-[#E3DDCE] rounded-lg focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400 shadow-sm transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] sm:text-xs font-semibold text-[#3F3C36] mb-1 sm:mb-1.5">End Date</label>
                          <input
                            type="date"
                            value={pkgEndDate}
                            readOnly
                            className="w-full px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm border border-[#E3DDCE] rounded-lg bg-[#F7F5EF] border-[#E3DDCE] text-[#3F3C36] cursor-not-allowed shadow-sm transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Treatment Selection Card */}
                    <div className="bg-white border border-[#E3DDCE] rounded-lg p-4 shadow-sm">
                      <div className="mb-3">
                        <h3 className="font-semibold text-[#3F3C36] mb-1">Select Treatments</h3>
                        <p className="text-xs text-[#58544D]">Choose treatments to include in this package</p>
                      </div>

                      <div className="relative treatment-dropdown-container">
                        <button
                          type="button"
                          onClick={() => setTreatmentDropdownOpen(!treatmentDropdownOpen)}
                          className="w-full flex items-center justify-between px-3 py-2.5 bg-[#F7F5EF] border border-[#E3DDCE] rounded-md text-sm text-slate-700 hover:bg-[#F1EBDD] focus:outline-none focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] dark:bg-white dark:border-slate-600 dark:text-slate-900 transition-all"
                        >
                          <span className="text-[#3F3C36] font-medium dark:text-slate-900">
                            {selectedTreatments.length > 0
                              ? `${selectedTreatments.length} treatment(s) selected`
                              : "Select treatments to add..."}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-[#8C8577] transition-transform ${treatmentDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {treatmentDropdownOpen && (
                          <div className="absolute z-20 w-full mt-1.5 bg-white border border-[#E3DDCE] rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                            {/* Search Input */}
                            <div className="p-2 border-b border-[#EAE4D6] sticky top-0 bg-white">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#B5AE9F]" />
                                <input
                                  type="text"
                                  placeholder="Search treatments..."
                                  value={treatmentSearchQuery}
                                  onChange={(e) => setTreatmentSearchQuery(e.target.value)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-[#E3DDCE] rounded-md focus:outline-none focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                  autoFocus
                                />
                              </div>
                            </div>

                            {/* Treatment List */}
                            <div className="overflow-y-auto max-h-40">
                              {(() => {
                                // Show all treatments when search box is empty
                                if (!treatmentSearchQuery.trim()) {
                                  return (
                                    <div className="p-1.5">
                                      {treatments.map((treatment) => {
                                        const isSelected = selectedTreatments.some((t) => t.treatmentSlug === treatment.slug);
                                        return (
                                          <button
                                            key={treatment.slug}
                                            type="button"
                                            onClick={() => {
                                              handleTreatmentToggle(treatment);
                                              setTreatmentSearchQuery(""); // Clear search after selection
                                            }}
                                            className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-all ${isSelected
                                              ? "bg-[#F7F5EF] text-[#1F1D1A] font-medium border border-[#E3DDCE]"
                                              : "text-[#3F3C36] hover:bg-[#F7F5EF] border border-transparent"
                                              }`}
                                          >
                                            <div className="flex items-center justify-between">
                                              <span>
                                                {treatment.name}
                                                {treatment.type === "sub" && (
                                                  <span className="text-[10px] text-[#8C8577] ml-1">({treatment.mainTreatment})</span>
                                                )}
                                              </span>
                                              {isSelected && (
                                                <span className="text-[#58544D] text-xs">✓</span>
                                              )}
                                            </div>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  );
                                }

                                const filteredTreatments = treatments.filter((treatment) => {
                                  const query = treatmentSearchQuery.toLowerCase();
                                  const nameMatch = treatment.name.toLowerCase().includes(query);
                                  const mainTreatmentMatch = treatment.mainTreatment?.toLowerCase().includes(query);
                                  return nameMatch || mainTreatmentMatch;
                                });

                                if (filteredTreatments.length === 0) {
                                  return (
                                    <div className="p-3 text-center text-xs text-[#8C8577]">
                                      No treatments found matching "{treatmentSearchQuery}"
                                    </div>
                                  );
                                }

                                return (
                                  <div className="p-1.5">
                                    {filteredTreatments.map((treatment) => {
                                      const isSelected = selectedTreatments.some((t) => t.treatmentSlug === treatment.slug);
                                      return (
                                        <button
                                          key={treatment.slug}
                                          type="button"
                                          onClick={() => {
                                            handleTreatmentToggle(treatment);
                                            setTreatmentSearchQuery(""); // Clear search after selection
                                          }}
                                          className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-all ${isSelected
                                            ? "bg-blue-50 text-slate-800 font-medium border border-slate-200"
                                            : "text-slate-700 hover:bg-blue-50 border border-transparent"
                                            }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span>
                                              {treatment.name}
                                              {treatment.type === "sub" && treatment.mainTreatment && (
                                                <span className="text-[10px] text-[#8C8577] ml-1">({treatment.mainTreatment})</span>
                                              )}
                                            </span>
                                            {isSelected && (
                                              <span className="text-slate-600 text-xs">✓</span>
                                            )}
                                          </div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Selected Treatments with Sessions and Price - Enhanced Card Design */}
                  {selectedTreatments.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-[#3F3C36] text-sm">Selected Treatments</h3>
                        <span className="px-2.5 py-0.5 bg-[#F1EBDD] text-[#3F3C36] rounded-full text-xs font-medium">
                          {selectedTreatments.length} treatment{selectedTreatments.length !== 1 ? 's' : ''}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {selectedTreatments.map((selectedTreatment) => {
                          const treatment = treatments.find((t) => t.slug === selectedTreatment.treatmentSlug);
                          const sessionPrice = selectedTreatment.sessions > 0
                            ? (selectedTreatment.allocatedPrice || 0) / selectedTreatment.sessions
                            : 0;
                          return (
                            <div
                              key={selectedTreatment.treatmentSlug}
                              className="bg-white border border-[#E3DDCE] rounded-lg p-3 shadow-sm transition-all"
                            >
                              <div className="flex items-start justify-between mb-2">
                                <h4 className="font-semibold text-[#3F3C36] text-xs">
                                  {selectedTreatment.treatmentName}
                                </h4>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleRemoveTreatment(selectedTreatment.treatmentSlug, e);
                                  }}
                                  className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                                  title="Remove treatment"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2">
                                <div className="space-y-0.5">
                                  <label className="block text-[10px] text-[#58544D] font-medium">Price</label>
                                  <div className="relative">
                                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[#8C8577] text-xs">{getCurrencySymbol(currency)}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={selectedTreatment.allocatedPrice || ""}
                                      onChange={(e) => handleAllocatedPriceChange(selectedTreatment.treatmentSlug, e.target.value)}
                                      className="w-full pl-5 pr-1.5 py-1.5 text-xs font-medium border border-[#E3DDCE] rounded-md focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-[#F7F5EF] dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                      placeholder="0.00"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-0.5">
                                  <label className="block text-[10px] text-[#58544D] font-medium">Sess</label>
                                  <input
                                    type="number"
                                    min="1"
                                    value={selectedTreatment.sessions || 1}
                                    onChange={(e) => {
                                      const value = parseInt(e.target.value) || 1;
                                      handleSessionChange(selectedTreatment.treatmentSlug, value);
                                    }}
                                    className="w-full px-1.5 py-1.5 text-xs font-medium text-center border border-[#E3DDCE] rounded-md focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-[#F7F5EF] dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                    placeholder="1"
                                  />
                                </div>

                                <div className="space-y-0.5">
                                  <label className="block text-[10px] text-[#58544D] font-medium">/Sess</label>
                                  <div className="px-1.5 py-1.5 text-xs font-bold text-center bg-[#F1EBDD] rounded-md text-[#3F3C36] border border-[#E3DDCE] dark:bg-white dark:border-slate-600 dark:text-slate-900">
                                    {getCurrencySymbol(currency)}{sessionPrice.toFixed(2)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Price Validation Summary Card */}
                      <div className="bg-gradient-to-r from-[#F7F5EF] to-[#F2EFE6] border border-[#E3DDCE] rounded-lg p-3">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="text-center p-2 bg-white rounded-md border border-[#E3DDCE]">
                            <p className="text-[10px] text-[#58544D] font-medium">Package Price</p>
                            <p className="font-bold text-sm text-[#3F3C36]">{getCurrencySymbol(currency)}{parseFloat(pkgPrice) || 0}</p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-md border border-[#E3DDCE]">
                            <p className="text-[10px] text-[#58544D] font-medium">Allocated Total</p>
                            <p className="font-bold text-sm text-[#3F3C36]">
                              {getCurrencySymbol(currency)}{selectedTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0).toFixed(2)}
                            </p>
                          </div>
                          <div className="text-center p-2 bg-white rounded-md border border-[#E3DDCE]">
                            <p className="text-[10px] text-[#58544D] font-medium">Remaining</p>
                            <p className={`font-bold text-sm ${Math.abs((parseFloat(pkgPrice) || 0) - selectedTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0)) < 0.01 ? 'text-[#58544D]' : 'text-amber-600'}`}>
                              {getCurrencySymbol(currency)}{((parseFloat(pkgPrice) || 0) - selectedTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0)).toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="pt-1.5">
                    <button
                      type="submit"
                      disabled={pkgSubmitting}
                      className="w-full py-3 bg-[#1F1D1A] text-white font-semibold rounded-lg hover:bg-[#3A362E] disabled:opacity-60 transition-all shadow-md text-sm"
                    >
                      {pkgSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                          <span className="sr-only">Creating package...</span>
                        </>
                      ) : "Create Package"}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {shouldShowData && (
              <div className="mt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#1F1D1A] flex items-center justify-center shadow-md">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-[#1F1D1A]">All Packages</h2>
                      <p className="text-xs text-[#58544D]">Manage your existing packages</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {/* Package Search Bar */}
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#B5AE9F]" />
                      <input
                        type="text"
                        placeholder="Search packages..."
                        value={packageSearchTerm}
                        onChange={(e) => setPackageSearchTerm(e.target.value)}
                        className="pl-8 pr-3 py-3.5 text-xs font-medium bg-white border border-[#E3DDCE] rounded-lg focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] text-gray-700 w-full sm:w-64"
                      />
                    </div>
                    <div className="px-3 py-1.5 bg-gradient-to-r from-[#F1EBDD] to-[#EDE5D3] rounded-lg border border-[#E3DDCE]">
                      <span className="text-xs font-bold text-[#3F3C36]">
                        {packages.length} {packages.length === 1 ? 'Package' : 'Packages'}
                      </span>
                    </div>
                  </div>
                </div>

                {pkgLoading ? (
                  <div className="flex items-center justify-center py-12 text-[#58544D]">
                    <div className="text-center">
                      <Loader2 className="w-6 h-6 mr-2 animate-spin mx-auto mb-2" />
                      <span className="text-sm font-medium">Loading packages...</span>
                    </div>
                  </div>
                ) : packages.filter(pkg =>
                  pkg.name.toLowerCase().includes(packageSearchTerm.toLowerCase())
                ).length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-[#F1EBDD] flex items-center justify-center">
                      <Package className="w-8 h-8 text-[#58544D]" />
                    </div>
                    <p className="text-base font-semibold text-gray-900 mb-1">No packages found</p>
                    <p className="text-sm text-gray-600 mb-4">Try adjusting your search criteria</p>
                    <div className="inline-block px-3 py-1.5 bg-gradient-to-r from-[#F1EBDD] to-[#EDE5D3] rounded-lg">
                      <span className="text-xs text-[#3F3C36] font-medium">Start building your service packages today!</span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {packages.filter(pkg =>
                      pkg.name.toLowerCase().includes(packageSearchTerm.toLowerCase())
                    ).map((pkg) => (
                      <div
                        key={pkg._id}
                        className="bg-white border border-[#E3DDCE] rounded-xl p-3 shadow-sm hover:shadow-md hover:border-[#C9C2B1] transition-all duration-200"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-10 h-10 rounded-lg bg-[#1F1D1A] flex items-center justify-center flex-shrink-0">
                              <Package className="w-5 h-5 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-bold text-[#1F1D1A] truncate">{pkg.name}</h3>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${getPackageStatus(pkg) === 'Expired'
                                ? 'bg-red-100 text-red-800'
                                : getPackageStatus(pkg) === 'Expiring Soon'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-[#F1EBDD] text-[#1F1D1A]'
                                }`}>
                                {getPackageStatus(pkg)}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2 flex-shrink-0">
                            {permissions.canUpdate && (
                              <button
                                onClick={() => openEditModal(pkg)}
                                className="p-1.5 text-[#58544D] hover:bg-[#F1EBDD] rounded-md transition-colors"
                                title="Edit package"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {permissions.canDelete && (
                              <button
                                onClick={() => handleDeletePackage(pkg._id)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete package"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Package Stats */}
                          <div className="grid grid-cols-3 gap-1.5">
                            <div className="bg-[#F7F5EF] rounded p-2 border border-[#E3DDCE]">
                              <p className="text-[10px] text-[#58544D] font-medium">Total</p>
                              <p className="text-xs font-bold text-[#3F3C36]">{getCurrencySymbol(currency)}{parseFloat(pkg.totalPrice).toFixed(2)}</p>
                            </div>
                            <div className="bg-[#F7F5EF] rounded p-2 border border-[#E3DDCE]">
                              <p className="text-[10px] text-[#58544D] font-medium">Sessions</p>
                              <p className="text-xs font-bold text-[#3F3C36]">{pkg.totalSessions || pkg.treatments.reduce((sum, t) => sum + (t.sessions || 0), 0)}</p>
                            </div>
                            <div className="bg-[#F7F5EF] rounded p-2 border border-[#E3DDCE]">
                              <p className="text-[10px] text-[#58544D] font-medium">Avg/Session</p>
                              <p className="text-xs font-bold text-[#3F3C36]">
                                {getCurrencySymbol(currency)}{pkg.sessionPrice ? parseFloat(pkg.sessionPrice).toFixed(2) : (pkg.totalPrice / (pkg.totalSessions || pkg.treatments.reduce((sum, t) => sum + (t.sessions || 0), 0))).toFixed(2)}
                              </p>
                            </div>
                          </div>

                          {/* Validity Info */}
                          {(pkg.validityInMonths || pkg.startDate || pkg.endDate) && (
                            <div className="bg-[#F7F5EF] rounded p-2 border border-[#E3DDCE]">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] text-[#58544D] font-medium flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  Validity: {pkg.validityInMonths || 0} Months
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-1">
                                <div>
                                  <p className="text-[9px] text-[#8C8577]">Start</p>
                                  <p className="text-[10px] font-bold text-[#3F3C36] truncate">
                                    {pkg.startDate ? new Date(pkg.startDate).toLocaleDateString() : '-'}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-[#8C8577]">End</p>
                                  <p className="text-[10px] font-bold text-[#3F3C36] truncate">
                                    {pkg.endDate ? new Date(pkg.endDate).toLocaleDateString() : '-'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Treatments */}
                          <div>
                            <p className="text-[10px] text-[#58544D] font-medium mb-1">Treatments</p>
                            <div className="space-y-1 max-h-24 overflow-y-auto">
                              {pkg.treatments && pkg.treatments.length > 0 && pkg.treatments.slice(0, 3).map((treatment, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-[#F7F5EF] border border-[#E3DDCE] rounded p-1.5">
                                  <span className="text-xs font-medium text-[#3F3C36] truncate flex-1 mr-1">{treatment.treatmentName || treatment.name}</span>
                                  <div className="text-[9px] bg-[#F1EBDD] text-[#1F1D1A] px-1.5 py-0.5 rounded">
                                    {treatment.sessions || 1} x {getCurrencySymbol(currency)}{((treatment.allocatedPrice || 0) / (treatment.sessions || 1)).toFixed(2)}
                                  </div>
                                </div>
                              ))}
                              {pkg.treatments && pkg.treatments.length > 3 && (
                                <div className="text-[10px] text-[#58544D] font-medium text-center pt-0.5">
                                  +{pkg.treatments.length - 3} more
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-[9px] text-slate-500 flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" />
                            {new Date(pkg.createdAt).toLocaleDateString()}
                          </span>
                          {pkg.createdByName && (
                            <span className="text-[9px] text-slate-500 flex items-center gap-0.5" title={`Created by ${pkg.createdByName} (${pkg.createdByRole || 'unknown'})`}>
                              <User className="w-2.5 h-2.5" />
                              {pkg.createdByName}
                            </span>
                          )}
                          <span className="text-[9px] bg-blue-100 text-slate-800 px-1.5 py-0.5 rounded-full">
                            {pkg.treatments && pkg.treatments.length} T
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Package Modal */}
      {pkgEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-[#E3DDCE] bg-gradient-to-r from-[#F7F5EF] to-[#F2EFE6]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#1F1D1A] flex items-center justify-center shadow-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-[#1F1D1A]">Edit Package</h2>
                    <p className="text-sm text-[#58544D] font-medium">Update package details and treatment allocations</p>
                  </div>
                </div>
                <button
                  onClick={closeEditModal}
                  className="p-2 text-[#58544D] hover:text-[#3F3C36] hover:bg-[#F1EBDD] rounded-xl transition-all duration-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Package Name & Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-[#3F3C36] mb-2">
                    Package Name
                  </label>
                  <input
                    type="text"
                    value={pkgEditingName}
                    onChange={(e) => setPkgEditingName(e.target.value)}
                    placeholder="Enter package name"
                    className="w-full border border-[#E3DDCE] rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white hover:border-[#C9C2B1] transition-all shadow-sm dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-[#3F3C36] mb-2">
                    Total Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8C8577] font-bold text-base">{getCurrencySymbol(currency)}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pkgEditingPrice}
                      onChange={(e) => setPkgEditingPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-[#E3DDCE] rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white hover:border-[#C9C2B1] transition-all shadow-sm dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Validity & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#3F3C36] mb-1.5 sm:mb-2">
                    Validity (Months)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={pkgEditingValidityInMonths}
                    onChange={(e) => setPkgEditingValidityInMonths(e.target.value)}
                    placeholder="e.g. 12"
                    className="w-full border border-[#E3DDCE] rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white hover:border-[#C9C2B1] transition-all shadow-sm dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400 placeholder:text-xs sm:placeholder:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#3F3C36] mb-1.5 sm:mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={pkgEditingStartDate}
                    onChange={(e) => setPkgEditingStartDate(e.target.value)}
                    className="w-full border border-[#E3DDCE] rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-white hover:border-[#C9C2B1] transition-all shadow-sm dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-[#3F3C36] mb-1.5 sm:mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={pkgEditingEndDate}
                    readOnly
                    className="w-full border border-[#E3DDCE] rounded-xl px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm bg-[#F7F5EF] border-[#E3DDCE] text-[#3F3C36] cursor-not-allowed shadow-sm transition-all"
                  />
                </div>
              </div>

              {/* Treatment Selection Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-[#1F1D1A] mb-2">
                  Select Treatments
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPkgEditTreatmentDropdownOpen(!pkgEditTreatmentDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-[#F7F5EF] border border-[#E3DDCE] rounded-xl text-sm text-[#3F3C36] hover:bg-[#F1EBDD] focus:outline-none focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] transition-all shadow-sm"
                  >
                    <span className="text-[#58544D] dark:text-[#3F3C36]">
                      {pkgEditTreatments.length > 0
                        ? `${pkgEditTreatments.length} treatment(s) selected`
                        : "Select treatments to add..."}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-[#8C8577] transition-transform ${pkgEditTreatmentDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {pkgEditTreatmentDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-[#E3DDCE] rounded-lg shadow-lg">
                      {/* Search */}
                      <div className="p-2 border-b border-[#EAE4D6]">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8C8577]" />
                          <input
                            type="text"
                            value={pkgEditTreatmentSearchQuery}
                            onChange={(e) => setPkgEditTreatmentSearchQuery(e.target.value)}
                            placeholder="Search treatments..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-[#E3DDCE] rounded-md focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                            autoFocus
                          />
                        </div>
                      </div>

                      {/* Treatment List */}
                      <div className="overflow-y-auto max-h-48">
                        {(() => {
                          if (!pkgEditTreatmentSearchQuery.trim()) {
                            return (
                              <div className="p-2">
                                {treatments.map((treatment) => {
                                  const isSelected = pkgEditTreatments.some((t) => t.treatmentSlug === treatment.slug);
                                  return (
                                    <button
                                      key={treatment.slug}
                                      type="button"
                                      onClick={() => {
                                        handleEditTreatmentToggle(treatment);
                                        setPkgEditTreatmentSearchQuery("");
                                      }}
                                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${isSelected
                                        ? "bg-[#F1EBDD] text-[#3F3C36] font-medium border border-[#E3DDCE]"
                                        : "text-[#3F3C36] hover:bg-[#F1EBDD]"
                                        }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span>
                                          {treatment.name}
                                          {treatment.type === "sub" && (
                                            <span className="text-xs text-[#8C8577] ml-1">({treatment.mainTreatment})</span>
                                          )}
                                        </span>
                                        {isSelected && (
                                          <span className="text-[#58544D] text-xs">✓</span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            );
                          }

                          const filteredTreatments = treatments.filter((t) =>
                            t.name.toLowerCase().includes(pkgEditTreatmentSearchQuery.toLowerCase()) ||
                            (t.mainTreatment && t.mainTreatment.toLowerCase().includes(pkgEditTreatmentSearchQuery.toLowerCase()))
                          );

                          if (filteredTreatments.length === 0) {
                            return (
                              <div className="p-4 text-center text-sm text-[#8C8577]">
                                No treatments found matching "{pkgEditTreatmentSearchQuery}"
                              </div>
                            );
                          }

                          return (
                            <div className="p-2">
                              {filteredTreatments.map((treatment) => {
                                const isSelected = pkgEditTreatments.some((t) => t.treatmentSlug === treatment.slug);
                                return (
                                  <button
                                    key={treatment.slug}
                                    type="button"
                                    onClick={() => {
                                      handleEditTreatmentToggle(treatment);
                                      setPkgEditTreatmentSearchQuery("");
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${isSelected
                                      ? "bg-[#F7F5EF] text-[#3F3C36] font-medium"
                                      : "text-[#3F3C36] hover:bg-[#F7F5EF]"
                                      }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>
                                        {treatment.name}
                                      </span>
                                      {isSelected && (
                                        <span className="text-[#58544D] text-xs">✓</span>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Treatments with Sessions and Price */}
              {pkgEditTreatments.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[#3F3C36] text-sm">Selected Treatments</h3>
                    <span className="px-2.5 py-0.5 bg-[#F1EBDD] text-[#3F3C36] rounded-full text-xs font-medium">
                      {pkgEditTreatments.length} treatment{pkgEditTreatments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pkgEditTreatments.map((selectedTreatment) => {
                      const sessionPrice = selectedTreatment.sessions > 0
                        ? (selectedTreatment.allocatedPrice || 0) / selectedTreatment.sessions
                        : 0;
                      return (
                        <div
                          key={selectedTreatment.treatmentSlug}
                          className="bg-white border border-[#E3DDCE] rounded-lg p-3 shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-[#3F3C36] text-xs">
                              {selectedTreatment.treatmentName}
                            </h4>
                            <button
                              type="button"
                              onClick={(e) => handleEditRemoveTreatment(selectedTreatment.treatmentSlug, e)}
                              className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                              title="Remove treatment"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <div className="space-y-0.5">
                              <label className="block text-[10px] text-[#58544D] font-medium">Price</label>
                              <div className="relative">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[#8C8577] text-xs">{getCurrencySymbol(currency)}</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={selectedTreatment.allocatedPrice || ""}
                                  onChange={(e) => handleEditAllocatedPriceChange(selectedTreatment.treatmentSlug, e.target.value)}
                                  className="w-full pl-5 pr-1.5 py-1.5 text-xs font-medium border border-[#E3DDCE] rounded-md focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-[#F7F5EF] dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>

                            <div className="space-y-0.5">
                              <label className="block text-[10px] text-[#58544D] font-medium">Sess</label>
                              <input
                                type="number"
                                min="1"
                                value={selectedTreatment.sessions || 1}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  handleEditSessionChange(selectedTreatment.treatmentSlug, value);
                                }}
                                className="w-full px-1.5 py-1.5 text-xs font-medium text-center border border-[#E3DDCE] rounded-md focus:ring-2 focus:ring-[#A98545] focus:border-[#A98545] bg-[#F7F5EF] dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                placeholder="1"
                              />
                            </div>

                            <div className="space-y-0.5">
                              <label className="block text-[10px] text-[#58544D] font-medium">/Sess</label>
                              <div className="px-1.5 py-1.5 text-xs font-bold text-center bg-[#F1EBDD] rounded-md text-[#3F3C36] border border-[#E3DDCE] dark:bg-white dark:border-slate-600 dark:text-slate-900">
                                {getCurrencySymbol(currency)}{sessionPrice.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Price Validation Summary */}
                  <div className="mt-3 p-3 bg-gradient-to-r from-[#F7F5EF] to-[#F2EFE6] rounded-lg border border-[#E3DDCE]">
                    <div className="flex justify-between text-sm">
                      <span className="text-[#3F3C36] font-semibold">Package Price:</span>
                      <span className="font-semibold text-[#3F3C36]">{getCurrencySymbol(currency)}{parseFloat(pkgEditingPrice) || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-[#3F3C36] font-semibold">Allocated Total:</span>
                      <span className="font-semibold text-[#3F3C36]">
                        {getCurrencySymbol(currency)}{pkgEditTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 border-t border-gray-200 pt-1">
                      <span className="text-[#3F3C36] font-semibold">Remaining:</span>
                      <span className={`font-semibold ${Math.abs((parseFloat(pkgEditingPrice) || 0) - pkgEditTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0)) < 0.01 ? 'text-[#58544D]' : 'text-amber-600'}`}>
                        {getCurrencySymbol(currency)}{((parseFloat(pkgEditingPrice) || 0) - pkgEditTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-[#E3DDCE] bg-gradient-to-r from-[#F7F5EF] to-[#F2EFE6] flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-5 py-2.5 bg-white border border-[#C9C2B1] text-[#3F3C36] text-sm font-medium rounded-xl hover:bg-[#F1EBDD] hover:border-[#B5AE9F] transition-all duration-200 shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePackage}
                disabled={pkgUpdating}
                className="px-5 py-2.5 bg-[#1F1D1A] text-white text-sm font-medium rounded-xl hover:bg-[#3A362E] disabled:opacity-60 transition-all shadow-md hover:shadow-lg"
              >
                {pkgUpdating ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating...
                  </span>
                ) : (
                  "Update Package"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Match clinic/patient-registration layout wrapping and protection
ServicesSetupPage.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedServicesSetup = withClinicAuth(ServicesSetupPage);
ProtectedServicesSetup.getLayout = ServicesSetupPage.getLayout;

export { ServicesSetupPage };
export default ProtectedServicesSetup;

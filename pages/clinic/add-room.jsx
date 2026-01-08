"use client";

import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import { Loader2, Trash2, AlertCircle, CheckCircle, X, Building2, DoorOpen, Plus, Edit2, Calendar, Package, ChevronDown } from "lucide-react";
import { useAgentPermissions } from "../../hooks/useAgentPermissions";
import { Toaster, toast } from "react-hot-toast";

const MODULE_KEY = "clinic_addRoom";
const SUBMODULE_NAME = "Add Room";

const TOKEN_PRIORITY = [
  "clinicToken",
  "agentToken",
  "doctorToken",
  "userToken",
  "staffToken",
  "adminToken",
];

function getStoredToken() {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    try {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value) return value;
    } catch (error) {
      // Ignore storage access errors (Safari private mode, etc.)
    }
  }
  return null;
}

function getAuthHeaders() {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
}

function getUserRole() {
  if (typeof window === 'undefined') return null;
  try {
    for (const key of TOKEN_PRIORITY) {
      const token = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.role || null;
        } catch (e) {
          continue;
        }
      }
    }
  } catch (error) {
    console.error('Error getting user role:', error);
  }
  return null;
}

const MessageBanner = ({ type, text }) => {
  if (!text) return null;

  const styles = {
    success: "bg-emerald-50 text-emerald-800 border-emerald-200",
    error: "bg-rose-50 text-rose-800 border-rose-200",
    info: "bg-sky-50 text-sky-800 border-sky-200",
  };

  const Icon = type === "error" ? AlertCircle : CheckCircle;

  return (
    <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border ${styles[type]}`} role="alert">
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
      <p className="text-xs sm:text-sm font-medium">{text}</p>
    </div>
  );
};

function AddRoomPage({ contextOverride = null }) {
  const router = useRouter();
  const [rooms, setRooms] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [packages, setPackages] = useState([]);
  const [roomName, setRoomName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [packageName, setPackageName] = useState("");
  const [packagePrice, setPackagePrice] = useState("");
  const [treatments, setTreatments] = useState([]);
  const [selectedTreatments, setSelectedTreatments] = useState([]); // Array of { treatmentName, treatmentSlug, sessions }
  const [treatmentDropdownOpen, setTreatmentDropdownOpen] = useState(false);
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingDept, setSubmittingDept] = useState(false);
  const [submittingPackage, setSubmittingPackage] = useState(false);
  const [message, setMessage] = useState({
    type: "info",
    text: "",
  });
  const [permissions, setPermissions] = useState({
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isClinicContext, setIsClinicContext] = useState(false);
  const [token, setToken] = useState("");
  const [hasAgentToken, setHasAgentToken] = useState(contextOverride === "agent");
  const [isAgentRoute, setIsAgentRoute] = useState(contextOverride === "agent");
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoomName, setEditingRoomName] = useState("");
  const [roomUpdateLoading, setRoomUpdateLoading] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editingDeptName, setEditingDeptName] = useState("");
  const [deptUpdateLoading, setDeptUpdateLoading] = useState(false);
  const [editingPackageId, setEditingPackageId] = useState(null);
  const [editingPackageName, setEditingPackageName] = useState("");
  const [editingPackagePrice, setEditingPackagePrice] = useState("");
  const [packageUpdateLoading, setPackageUpdateLoading] = useState(false);
  const [viewMode, setViewMode] = useState("room"); // "room", "department", or "package"
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "room",
  });
  const hasLoadedInitialData = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      const storedToken = getStoredToken();
      setToken(storedToken || "");
      const hasAgent =
        Boolean(localStorage.getItem("agentToken")) ||
        Boolean(sessionStorage.getItem("agentToken"));
      setHasAgentToken(contextOverride === "agent" ? true : hasAgent);
    };
    syncTokens();
    window.addEventListener("storage", syncTokens);
    return () => window.removeEventListener("storage", syncTokens);
  }, [contextOverride]);

  useEffect(() => {
    if (contextOverride) {
      setIsAgentRoute(contextOverride === "agent");
      return;
    }
    if (typeof window === "undefined") return;
    const agentPath =
      router?.pathname?.startsWith("/agent/") ||
      window.location.pathname?.startsWith("/agent/");
    setIsAgentRoute(Boolean(agentPath && hasAgentToken));
  }, [contextOverride, router.pathname, hasAgentToken]);

  // Check if we're in clinic context
  useEffect(() => {
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      setIsClinicContext(path.startsWith("/clinic/"));
    } else if (router?.pathname) {
      setIsClinicContext(router.pathname.startsWith("/clinic/"));
    }
  }, [router?.pathname]);

  const { permissions: agentPermissions, loading: agentPermissionsLoading } = useAgentPermissions(
    isAgentRoute ? MODULE_KEY : null
  );

  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;
    // Properly handle false values - if all is false, check individual permissions
    // If a permission is explicitly false, it should be false
    setPermissions({
      canCreate: agentPermissions.canAll ? true : (agentPermissions.canCreate === true),
      canRead: agentPermissions.canAll ? true : (agentPermissions.canRead === true),
      canUpdate: agentPermissions.canAll ? true : (agentPermissions.canUpdate === true),
      canDelete: agentPermissions.canAll ? true : (agentPermissions.canDelete === true),
    });
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  useEffect(() => {
    if (isAgentRoute) return;
    if (!isClinicContext) {
      setPermissionsLoaded(true);
      return;
    }
    let cancelled = false;
    
    const fetchPermissions = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
          });
          setPermissionsLoaded(true);
          return;
        }

        const userRole = getUserRole();
        
        // For clinic and doctor roles, fetch admin-level permissions from /api/clinic/sidebar-permissions
        if (userRole === 'clinic' || userRole === 'doctor') {
          try {
            const res = await axios.get('/api/clinic/sidebar-permissions', {
              headers: authHeaders,
            });
            
            if (cancelled) return;
            
            if (res.data.success) {
              // Check if permissions array exists and is not null
              // If permissions is null, admin hasn't set any restrictions yet - allow full access (backward compatibility)
              if (res.data.permissions === null || !Array.isArray(res.data.permissions) || res.data.permissions.length === 0) {
                // No admin restrictions set yet - default to full access for backward compatibility
                setPermissions({
                  canCreate: true,
                  canRead: true,
                  canUpdate: true,
                  canDelete: true,
                });
              } else {
                // Admin has set permissions - check the clinic_addRoom module
                const modulePermission = res.data.permissions.find((p) => {
                  if (!p?.module) return false;
                  // Check for clinic_addRoom module
                  if (p.module === 'clinic_addRoom') return true;
                  if (p.module === 'addRoom') return true;
                  if (p.module === 'add_room') return true;
                  if (p.module?.endsWith('addRoom')) return true;
                  if (p.module?.endsWith('add_room')) return true;
                  return false;
                });

                if (modulePermission) {
                  const actions = modulePermission.actions || {};
                  
                  // Check if "all" is true, which grants all permissions
                  const moduleAll = actions.all === true || actions.all === 'true' || String(actions.all).toLowerCase() === 'true';
                  const moduleCreate = actions.create === true || actions.create === 'true' || String(actions.create).toLowerCase() === 'true';
                  const moduleRead = actions.read === true || actions.read === 'true' || String(actions.read).toLowerCase() === 'true';
                  const moduleUpdate = actions.update === true || actions.update === 'true' || String(actions.update).toLowerCase() === 'true';
                  const moduleDelete = actions.delete === true || actions.delete === 'true' || String(actions.delete).toLowerCase() === 'true';

                  setPermissions({
                    canCreate: moduleAll || moduleCreate,
                    canRead: moduleAll || moduleRead,
                    canUpdate: moduleAll || moduleUpdate,
                    canDelete: moduleAll || moduleDelete,
                  });
                } else {
                  // Module permission not found in the permissions array - default to read-only
                  setPermissions({
                    canCreate: false,
                    canRead: true, // Clinic/doctor can always read their own data
                    canUpdate: false,
                    canDelete: false,
                  });
                }
              }
            } else {
              // API response doesn't have permissions, default to full access (backward compatibility)
              setPermissions({
                canCreate: true,
                canRead: true,
                canUpdate: true,
                canDelete: true,
              });
            }
          } catch (err) {
            console.error('Error fetching clinic sidebar permissions:', err);
            // On error, default to full access (backward compatibility)
            if (!cancelled) {
              setPermissions({
                canCreate: true,
                canRead: true,
                canUpdate: true,
                canDelete: true,
              });
            }
          }
          if (!cancelled) {
            setPermissionsLoaded(true);
          }
          return;
        }

        // For agents, staff, and doctorStaff, use existing agent permissions logic
        // (handled by useAgentPermissions hook)
        if (['agent', 'staff', 'doctorStaff'].includes(userRole || '')) {
          // Agent permissions are handled by useAgentPermissions hook
          // Set default permissions here (will be overridden by agent permissions)
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
          });
          setPermissionsLoaded(true);
          return;
        }

        // For admin or unknown roles, default to full access
        setPermissions({
          canCreate: true,
          canRead: true,
          canUpdate: true,
          canDelete: true,
        });
        setPermissionsLoaded(true);
      } catch (err) {
        console.error('Error fetching permissions:', err);
        // On error, default to full access (backward compatibility)
        if (!cancelled) {
          setPermissions({
            canCreate: true,
            canRead: true,
            canUpdate: true,
            canDelete: true,
          });
        }
        if (!cancelled) {
          setPermissionsLoaded(true);
        }
      }
    };

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, [isAgentRoute, isClinicContext, token]);

  const getHeadersOrNotify = () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({
        type: "error",
        text: "Authentication required. Please log in again.",
      });
    }
    return headers;
  };

  const loadRooms = async (showToast = true) => {
    const headers = getHeadersOrNotify();
    if (!headers) return;
    try {
      const res = await axios.get("/api/clinic/rooms", { headers });
      if (res.data.success) {
        setRooms(res.data.rooms || []);
        if (showToast) {
          toast.success(`Loaded ${res.data.rooms?.length || 0} room(s)`, { duration: 2000 });
        }
      } else {
        const errorMsg = res.data.message || "Failed to load rooms";
        setMessage({ type: "error", text: errorMsg });
        if (showToast) {
          toast.error(errorMsg, { duration: 3000 });
        }
      }
    } catch (error) {
      // Silently handle 403 (Forbidden) and other permission errors
      const status = error.response?.status;
      if (status === 403 || status === 401) {
        // Permission denied - silently handle without showing error
        setRooms([]);
        return;
      }
      // For other errors, log but don't show runtime error
      const errorMessage = error.response?.data?.message || "Failed to load rooms";
      // Only show error message if it's not a permission issue
      if (showToast && status !== 403 && status !== 401) {
        toast.error(errorMessage, { duration: 3000 });
      }
      setMessage({ type: "error", text: errorMessage });
    }
  };

  const loadDepartments = async (showToast = true) => {
    const headers = getHeadersOrNotify();
    if (!headers) return;
    try {
      const res = await axios.get("/api/clinic/departments", { headers });
      if (res.data.success) {
        setDepartments(res.data.departments || []);
        if (showToast) {
          toast.success(`Loaded ${res.data.departments?.length || 0} department(s)`, { duration: 2000 });
        }
      } else {
        const errorMsg = res.data.message || "Failed to load departments";
        setMessage({ type: "error", text: errorMsg });
        if (showToast) {
          toast.error(errorMsg, { duration: 3000 });
        }
      }
    } catch (error) {
      // Silently handle 403 (Forbidden) and other permission errors
      const status = error.response?.status;
      if (status === 403 || status === 401) {
        // Permission denied - silently handle without showing error
        setDepartments([]);
        return;
      }
      // For other errors, log but don't show runtime error
      const errorMessage = error.response?.data?.message || "Failed to load departments";
      // Only show error message if it's not a permission issue
      if (showToast && status !== 403 && status !== 401) {
        toast.error(errorMessage, { duration: 3000 });
      }
      setMessage({ type: "error", text: errorMessage });
    }
  };

  const loadPackages = async (showToast = true) => {
    const headers = getHeadersOrNotify();
    if (!headers) return;
    try {
      const res = await axios.get("/api/clinic/packages", { headers });
      if (res.data.success) {
        setPackages(res.data.packages || []);
        if (showToast) {
          toast.success(`Loaded ${res.data.packages?.length || 0} package(s)`, { duration: 2000 });
        }
      } else {
        const errorMsg = res.data.message || "Failed to load packages";
        setMessage({ type: "error", text: errorMsg });
        if (showToast) {
          toast.error(errorMsg, { duration: 3000 });
        }
      }
    } catch (error) {
      // Silently handle 403 (Forbidden) and other permission errors
      const status = error.response?.status;
      if (status === 403 || status === 401) {
        // Permission denied - silently handle without showing error
        setPackages([]);
        return;
      }
      // For other errors, log but don't show runtime error
      const errorMessage = error.response?.data?.message || "Failed to load packages";
      // Only show error message if it's not a permission issue
      if (showToast && status !== 403 && status !== 401) {
        toast.error(errorMessage, { duration: 3000 });
      }
      setMessage({ type: "error", text: errorMessage });
    }
  };

  const loadTreatments = async () => {
    const headers = getHeadersOrNotify();
    if (!headers) return;
    try {
      const res = await axios.get("/api/clinic/treatments", { headers });
      if (res.data.success) {
        // Flatten treatments to get all treatment names
        const allTreatments = [];
        if (res.data.clinic?.treatments) {
          res.data.clinic.treatments.forEach((treatment) => {
            // Add main treatment
            allTreatments.push({
              name: treatment.mainTreatment,
              slug: treatment.mainTreatmentSlug,
              type: "main",
            });
            // Add sub-treatments
            if (treatment.subTreatments && treatment.subTreatments.length > 0) {
              treatment.subTreatments.forEach((subTreatment) => {
                allTreatments.push({
                  name: subTreatment.name,
                  slug: subTreatment.slug,
                  type: "sub",
                  mainTreatment: treatment.mainTreatment,
                });
              });
            }
          });
        }
        setTreatments(allTreatments);
      }
    } catch (error) {
      // Silently handle 403 (Forbidden) and other permission errors
      const status = error.response?.status;
      if (status === 403 || status === 401) {
        // Permission denied - silently handle without showing error
        setTreatments([]);
        return;
      }
      // For other errors, silently handle without showing runtime error
      setTreatments([]);
    }
  };

  useEffect(() => {
    if (!permissionsLoaded) return;
      if (!permissions.canRead) {
      setRooms([]);
      setDepartments([]);
      setPackages([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      // Dismiss any existing toasts before loading
      toast.dismiss();
      try {
        await Promise.all([
          loadRooms(false), 
          loadDepartments(false), 
          loadPackages(false), 
          loadTreatments()
        ]);
        if (!cancelled) {
          // Only show success toast on initial load
          if (!hasLoadedInitialData.current) {
            toast.success("Data loaded successfully", { duration: 2000 });
            hasLoadedInitialData.current = true;
          }
          setLoading(false);
        }
      } catch (error) {
        if (!cancelled) {
          // Silently handle permission errors (403, 401)
          const status = error.response?.status;
          if (status !== 403 && status !== 401 && !hasLoadedInitialData.current) {
            toast.error("Failed to load some data", { duration: 3000 });
          }
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [permissionsLoaded, permissions.canRead]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (treatmentDropdownOpen && !event.target.closest('.treatment-dropdown-container')) {
        setTreatmentDropdownOpen(false);
        setTreatmentSearchQuery(""); // Clear search when closing
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [treatmentDropdownOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!permissions.canCreate) {
      setMessage({ type: "error", text: "You do not have permission to create rooms" });
      return;
    }
    if (!roomName.trim()) {
      setMessage({ type: "error", text: "Please enter a room name" });
      return;
    }

    const headers = getHeadersOrNotify();
    if (!headers) return;
    setSubmitting(true);
    setMessage({ type: "info", text: "" });

    try {
      const res = await axios.post(
        "/api/clinic/rooms",
        { name: roomName.trim() },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Room created successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setRoomName("");
        await loadRooms(false);
      } else {
        const errorMsg = res.data.message || "Failed to create room";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error creating room", error);
      const errorMessage = error.response?.data?.message || "Failed to create room";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoomUpdate = async () => {
    if (!editingRoomId) return;
    if (!permissions.canUpdate) {
      setMessage({ type: "error", text: "You do not have permission to update rooms" });
      return;
    }
    if (!editingRoomName.trim()) {
      setMessage({ type: "error", text: "Room name cannot be empty" });
      return;
    }

    const headers = getHeadersOrNotify();
    if (!headers) return;
    setRoomUpdateLoading(true);

    try {
      const res = await axios.put(
        "/api/clinic/rooms",
        { roomId: editingRoomId, name: editingRoomName.trim() },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Room updated successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setEditingRoomId(null);
        setEditingRoomName("");
        await loadRooms(false);
      } else {
        const errorMsg = res.data.message || "Failed to update room";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error updating room", error);
      const errorMessage = error.response?.data?.message || "Failed to update room";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setRoomUpdateLoading(false);
    }
  };

  const handleDelete = async (roomId) => {
    if (!permissions.canDelete) {
      const errorMsg = "You do not have permission to delete rooms";
      setMessage({ type: "error", text: errorMsg });
      toast.error(errorMsg, { duration: 3000 });
      return;
    }
    const room = rooms.find((r) => r._id === roomId);
    setConfirmModal({
      isOpen: true,
      title: "Delete Room",
      message: `Are you sure you want to delete "${room?.name || "this room"}"? This action cannot be undone.`,
      onConfirm: async () => {
        const headers = getHeadersOrNotify();
        if (!headers) return;

        try {
          const res = await axios.delete(`/api/clinic/rooms?roomId=${roomId}`, { headers });
          if (res.data.success) {
            const successMsg = res.data.message || "Room deleted successfully";
            setMessage({ type: "success", text: successMsg });
            toast.success(successMsg, { duration: 3000 });
            if (editingRoomId === roomId) {
              setEditingRoomId(null);
              setEditingRoomName("");
            }
            await loadRooms(false);
          } else {
            const errorMsg = res.data.message || "Failed to delete room";
            setMessage({ type: "error", text: errorMsg });
            toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error deleting room", error);
      const errorMessage = error.response?.data?.message || "Failed to delete room";
      setMessage({ type: "error", text: errorMessage });
          toast.error(errorMessage, { duration: 3000 });
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
      type: "room",
    });
  };

  const handleDepartmentSubmit = async (e) => {
    e.preventDefault();
    if (!permissions.canCreate) {
      setMessage({ type: "error", text: "You do not have permission to create departments" });
      return;
    }
    if (!departmentName.trim()) {
      setMessage({ type: "error", text: "Please enter a department name" });
      return;
    }

    const headers = getHeadersOrNotify();
    if (!headers) return;
    setSubmittingDept(true);
    setMessage({ type: "info", text: "" });

    try {
      const res = await axios.post(
        "/api/clinic/departments",
        { name: departmentName.trim() },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Department created successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setDepartmentName("");
        await loadDepartments();
      } else {
        const errorMsg = res.data.message || "Failed to create department";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error creating department", error);
      const errorMessage = error.response?.data?.message || "Failed to create department";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setSubmittingDept(false);
    }
  };

  const handleDepartmentUpdate = async () => {
    if (!editingDeptId) return;
    if (!permissions.canUpdate) {
      setMessage({ type: "error", text: "You do not have permission to update departments" });
      return;
    }
    if (!editingDeptName.trim()) {
      setMessage({ type: "error", text: "Department name cannot be empty" });
      return;
    }
    const headers = getHeadersOrNotify();
    if (!headers) return;

    setDeptUpdateLoading(true);
    try {
      const res = await axios.put(
        "/api/clinic/departments",
        { departmentId: editingDeptId, name: editingDeptName.trim() },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Department updated successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setEditingDeptId(null);
        setEditingDeptName("");
        await loadDepartments();
      } else {
        const errorMsg = res.data.message || "Failed to update department";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error updating department", error);
      const errorMessage = error.response?.data?.message || "Failed to update department";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setDeptUpdateLoading(false);
    }
  };

  const handleDeleteDepartment = async (departmentId) => {
    if (!permissions.canDelete) {
      const errorMsg = "You do not have permission to delete departments";
      setMessage({ type: "error", text: errorMsg });
      toast.error(errorMsg, { duration: 3000 });
      return;
    }
    const dept = departments.find((d) => d._id === departmentId);
    setConfirmModal({
      isOpen: true,
      title: "Delete Department",
      message: `Are you sure you want to delete "${dept?.name || "this department"}"? This action cannot be undone.`,
      onConfirm: async () => {
        const headers = getHeadersOrNotify();
        if (!headers) return;

        try {
          const res = await axios.delete(`/api/clinic/departments?departmentId=${departmentId}`, {
            headers,
          });
          if (res.data.success) {
            const successMsg = res.data.message || "Department deleted successfully";
            setMessage({ type: "success", text: successMsg });
            toast.success(successMsg, { duration: 3000 });
            if (editingDeptId === departmentId) {
              setEditingDeptId(null);
              setEditingDeptName("");
            }
            await loadDepartments();
          } else {
            const errorMsg = res.data.message || "Failed to delete department";
            setMessage({ type: "error", text: errorMsg });
            toast.error(errorMsg, { duration: 3000 });
          }
        } catch (error) {
          console.error("Error deleting department", error);
          const errorMessage = error.response?.data?.message || "Failed to delete department";
          setMessage({ type: "error", text: errorMessage });
          toast.error(errorMessage, { duration: 3000 });
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
      type: "department",
    });
  };

  const handleTreatmentToggle = (treatment) => {
    setSelectedTreatments((prev) => {
      const exists = prev.find((t) => t.slug === treatment.slug);
      if (exists) {
        return prev.filter((t) => t.slug !== treatment.slug);
      } else {
        setTreatmentDropdownOpen(false); // Close dropdown after selection
        return [...prev, { treatmentName: treatment.name, treatmentSlug: treatment.slug, sessions: 1 }];
      }
    });
  };

  const handleRemoveTreatment = (treatmentSlug, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setSelectedTreatments((prev) => {
      // Filter out the treatment by matching treatmentSlug (or slug for backward compatibility)
      return prev.filter((t) => t.treatmentSlug !== treatmentSlug && t.slug !== treatmentSlug);
    });
  };

  const handleSelectAllTreatments = () => {
    if (selectedTreatments.length === treatments.length) {
      setSelectedTreatments([]);
    } else {
      setSelectedTreatments(
        treatments.map((t) => ({ treatmentName: t.name, treatmentSlug: t.slug, sessions: 1 }))
      );
    }
  };

  const handleSessionChange = (slug, sessions) => {
    setSelectedTreatments((prev) =>
      prev.map((t) => (t.treatmentSlug === slug ? { ...t, sessions: parseInt(sessions) || 1 } : t))
    );
  };

  const handlePackageSubmit = async (e) => {
    e.preventDefault();
    if (!permissions.canCreate) {
      setMessage({ type: "error", text: "You do not have permission to create packages" });
      return;
    }
    if (!packageName.trim()) {
      setMessage({ type: "error", text: "Please enter a package name" });
      return;
    }
    if (!packagePrice || parseFloat(packagePrice) < 0) {
      setMessage({ type: "error", text: "Please enter a valid price" });
      return;
    }
    if (selectedTreatments.length === 0) {
      setMessage({ type: "error", text: "Please select at least one treatment" });
      return;
    }

    const headers = getHeadersOrNotify();
    if (!headers) return;
    setSubmittingPackage(true);
    setMessage({ type: "info", text: "" });

    try {
      const res = await axios.post(
        "/api/clinic/packages",
        {
          name: packageName.trim(),
          price: parseFloat(packagePrice),
          treatments: selectedTreatments,
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Package created successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setPackageName("");
        setPackagePrice("");
        setSelectedTreatments([]);
        setTreatmentDropdownOpen(false); // Close dropdown
        await loadPackages();
      } else {
        const errorMsg = res.data.message || "Failed to create package";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error creating package", error);
      const errorMessage = error.response?.data?.message || "Failed to create package";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setSubmittingPackage(false);
    }
  };

  const handlePackageUpdate = async () => {
    if (!editingPackageId) return;
    if (!permissions.canUpdate) {
      setMessage({ type: "error", text: "You do not have permission to update packages" });
      return;
    }
    if (!editingPackageName.trim()) {
      setMessage({ type: "error", text: "Package name cannot be empty" });
      return;
    }
    if (!editingPackagePrice || parseFloat(editingPackagePrice) < 0) {
      setMessage({ type: "error", text: "Please enter a valid price" });
      return;
    }
    if (selectedTreatments.length === 0) {
      setMessage({ type: "error", text: "Please select at least one treatment" });
      return;
    }
    const headers = getHeadersOrNotify();
    if (!headers) return;

    setPackageUpdateLoading(true);
    try {
      const res = await axios.put(
        "/api/clinic/packages",
        {
          packageId: editingPackageId,
          name: editingPackageName.trim(),
          price: parseFloat(editingPackagePrice),
          treatments: selectedTreatments,
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Package updated successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setEditingPackageId(null);
        setEditingPackageName("");
        setEditingPackagePrice("");
        setSelectedTreatments([]);
        setTreatmentDropdownOpen(false); // Close dropdown
        await loadPackages();
      } else {
        const errorMsg = res.data.message || "Failed to update package";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error updating package", error);
      const errorMessage = error.response?.data?.message || "Failed to update package";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setPackageUpdateLoading(false);
    }
  };

  const handleDeletePackage = async (packageId) => {
    if (!permissions.canDelete) {
      const errorMsg = "You do not have permission to delete packages";
      setMessage({ type: "error", text: errorMsg });
      toast.error(errorMsg, { duration: 3000 });
      return;
    }
    const pkg = packages.find((p) => p._id === packageId);
    setConfirmModal({
      isOpen: true,
      title: "Delete Package",
      message: `Are you sure you want to delete "${pkg?.name || "this package"}"? This action cannot be undone.`,
      onConfirm: async () => {
        const headers = getHeadersOrNotify();
        if (!headers) return;

        try {
          const res = await axios.delete(`/api/clinic/packages?packageId=${packageId}`, {
            headers,
          });
          if (res.data.success) {
            const successMsg = res.data.message || "Package deleted successfully";
            setMessage({ type: "success", text: successMsg });
            toast.success(successMsg, { duration: 3000 });
            if (editingPackageId === packageId) {
              setEditingPackageId(null);
              setEditingPackageName("");
              setEditingPackagePrice("");
            }
            await loadPackages();
          } else {
            const errorMsg = res.data.message || "Failed to delete package";
            setMessage({ type: "error", text: errorMsg });
            toast.error(errorMsg, { duration: 3000 });
          }
        } catch (error) {
          console.error("Error deleting package", error);
          const errorMessage = error.response?.data?.message || "Failed to delete package";
          setMessage({ type: "error", text: errorMessage });
          toast.error(errorMessage, { duration: 3000 });
        }
        setConfirmModal({ ...confirmModal, isOpen: false });
      },
      type: "package",
    });
  };

  const roomCreateDisabled = submitting || !permissions.canCreate;
  const deptCreateDisabled = submittingDept || !permissions.canCreate;

  return (
    <div className="min-h-screen bg-gray-50">
      <style dangerouslySetInnerHTML={{__html: `
        [data-hot-toast][data-type="error"] button[aria-label="Close"] {
          color: #fff !important;
          opacity: 0.9;
        }
        [data-hot-toast][data-type="error"] button[aria-label="Close"]:hover {
          opacity: 1;
          color: #fff !important;
        }
      `}} />
      <div className="p-3 sm:p-4 lg:p-5 space-y-3 lg:space-y-4">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#1f2937",
            color: "#f9fafb",
            fontSize: "12px",
            padding: "8px 12px",
            borderRadius: "6px",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#fff",
            },
            style: {
              background: "#10b981",
              color: "#fff",
            },
          },
          error: {
            iconTheme: {
              primary: "#fff",
              secondary: "#ef4444",
            },
            style: {
              background: "#ef4444",
              color: "#fff",
            },
          },
          warning: {
            iconTheme: {
              primary: "#f59e0b",
              secondary: "#fff",
            },
            style: {
              background: "#f59e0b",
              color: "#fff",
            },
          },
          info: {
            iconTheme: {
              primary: "#3b82f6",
              secondary: "#fff",
            },
            style: {
              background: "#3b82f6",
              color: "#fff",
            },
          },
        }}
      />
      {!permissionsLoaded ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center text-gray-700">
          <Loader2 className="w-5 h-5 mx-auto mb-2 animate-spin" />
          <p className="text-xs sm:text-sm">Checking your permissions...</p>
        </div>
      ) : !permissions.canRead ? (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg border border-red-200 p-8 text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-sm text-gray-700 mb-4">
              You do not have permission to view rooms, departments, and packages.
            </p>
            <p className="text-xs text-gray-600">
              Please contact your administrator to request access to the Add Room module.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Professional Header - Matching Dashboard Theme */}
          <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="w-5 h-5 text-gray-700" />
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                    Room, Department & Package Management
                  </h1>
                </div>
                <p className="text-xs sm:text-sm text-gray-600">
                  Create and manage rooms, departments, and packages for your clinic
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 bg-gray-100 rounded-lg p-1 border border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("room");
                    setMessage({ type: "info", text: "" }); // Clear message when switching view
                    setTreatmentDropdownOpen(false); // Close dropdown
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none justify-center ${
                    viewMode === "room"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <DoorOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="whitespace-nowrap">Rooms</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("department");
                    setMessage({ type: "info", text: "" }); // Clear message when switching view
                    setTreatmentDropdownOpen(false); // Close dropdown
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none justify-center ${
                    viewMode === "department"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="whitespace-nowrap">Departments</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("package");
                    setMessage({ type: "info", text: "" }); // Clear message when switching view
                    setTreatmentDropdownOpen(false); // Close dropdown
                  }}
                  className={`px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none justify-center ${
                    viewMode === "package"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <Package className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="whitespace-nowrap">Packages</span>
                </button>
              </div>
            </div>
          </div>

          {/* Stats Cards - Matching Dashboard Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <DoorOpen className="w-4 h-4 text-gray-700" />
                <span className="text-xs font-semibold text-gray-700">Total Rooms</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{rooms.length}</p>
              <p className="text-xs text-gray-600">Active rooms in your clinic</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-gray-700" />
                <span className="text-xs font-semibold text-gray-700">Total Departments</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{departments.length}</p>
              <p className="text-xs text-gray-600">Active departments in your clinic</p>
            </div>
            <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-4 h-4 text-gray-700" />
                <span className="text-xs font-semibold text-gray-700">Total Packages</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 mb-1">{packages.length}</p>
              <p className="text-xs text-gray-600">Active packages in your clinic</p>
            </div>
          </div>

          {/* Create Form Card */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">

            <div className="flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-gray-700" />
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">
                {viewMode === "room" ? "Create New Room" : viewMode === "department" ? "Create New Department" : "Create New Package"}
              </h2>
            </div>

            {message.text && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${
                message.type === "error" ? "bg-red-50 text-red-700 border border-red-200" :
                message.type === "success" ? "bg-green-50 text-green-700 border border-green-200" :
                "bg-blue-50 text-blue-700 border border-blue-200"
              }`}>
                {message.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                {message.text}
              </div>
            )}

            {/* Room Form */}
            {viewMode === "room" && permissions.canCreate && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Room Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    placeholder="e.g., Consultation Room 1, Operation Theater A"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={roomCreateDisabled}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 active:bg-gray-950 disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {submitting ? "Creating..." : "Create Room"}
                </button>
              </form>
            )}

            {/* Department Form */}
            {viewMode === "department" && permissions.canCreate && (
              <form onSubmit={handleDepartmentSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Department Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={departmentName}
                    onChange={(e) => setDepartmentName(e.target.value)}
                    placeholder="e.g., Cardiology, Pediatrics, Emergency"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={deptCreateDisabled}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 active:bg-gray-950 disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {submittingDept ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {submittingDept ? "Creating..." : "Create Department"}
                </button>
              </form>
            )}

            {/* Package Form */}
            {viewMode === "package" && permissions.canCreate && (
              <form onSubmit={handlePackageSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Package Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={packageName}
                    onChange={(e) => setPackageName(e.target.value)}
                    placeholder="e.g., Basic Health Package, Premium Wellness Package"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={packagePrice}
                    onChange={(e) => setPackagePrice(e.target.value)}
                    placeholder="e.g., 5000.00"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    required
                  />
                </div>

                {/* Treatment Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Treatment <span className="text-red-500">*</span>
                    </label>
                    {treatments.length === 0 ? (
                      <div className="text-sm text-gray-500 py-2">No treatments available. Please add treatments to your clinic first.</div>
                    ) : (
                      <div className="relative treatment-dropdown-container">
                        <button
                          type="button"
                          onClick={() => {
                            setTreatmentDropdownOpen(!treatmentDropdownOpen);
                            if (!treatmentDropdownOpen) {
                              setTreatmentSearchQuery(""); // Clear search when opening
                            }
                          }}
                          className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                        >
                          <span className="text-gray-500">Select a treatment to add...</span>
                          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${treatmentDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {treatmentDropdownOpen && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                            {/* Search Input */}
                            <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                              <input
                                type="text"
                                placeholder="Search treatments..."
                                value={treatmentSearchQuery}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  setTreatmentSearchQuery(e.target.value);
                                }}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                              />
                            </div>
                            {/* Treatment List */}
                            <div className="overflow-y-auto max-h-48">
                              {(() => {
                                // Only show treatments when user has typed something
                                if (!treatmentSearchQuery.trim()) {
                                  return (
                                    <div className="p-4 text-center text-sm text-gray-500">
                                      Start typing to search for treatments...
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
                                    <div className="p-4 text-center text-sm text-gray-500">
                                      No treatments found matching "{treatmentSearchQuery}"
                                    </div>
                                  );
                                }

                                return (
                                  <div className="p-2">
                                    {filteredTreatments.map((treatment) => {
                                      const isSelected = selectedTreatments.some((t) => t.treatmentSlug === treatment.slug || t.slug === treatment.slug);
                                      return (
                                        <button
                                          key={treatment.slug}
                                          type="button"
                                          onClick={() => {
                                            handleTreatmentToggle(treatment);
                                            setTreatmentSearchQuery(""); // Clear search after selection
                                          }}
                                          className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                            isSelected
                                              ? "bg-blue-50 text-blue-700 font-medium"
                                              : "text-gray-700 hover:bg-gray-50"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span>
                                              {treatment.name}
                                              {treatment.type === "sub" && (
                                                <span className="text-xs text-gray-500 ml-1">({treatment.mainTreatment})</span>
                                              )}
                                            </span>
                                            {isSelected && (
                                              <span className="text-blue-600 text-xs">✓</span>
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
                    )}
                  </div>

                  {/* Selected Treatments with Sessions - Compact Tile Design */}
                  {selectedTreatments.length > 0 && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Selected Treatments & Sessions <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {selectedTreatments.map((selectedTreatment) => {
                          const treatment = treatments.find((t) => t.slug === selectedTreatment.treatmentSlug);
                          return (
                            <div
                              key={selectedTreatment.treatmentSlug}
                              className="flex items-center justify-between p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-all"
                            >
                              <div className="flex-1 min-w-0 mr-2">
                                <span className="text-sm font-medium text-gray-900 block truncate">
                                  {selectedTreatment.treatmentName}
                                </span>
                                {treatment?.type === "sub" && (
                                  <span className="text-xs text-gray-500 truncate block">
                                    {treatment.mainTreatment}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <input
                                  type="number"
                                  min="1"
                                  value={selectedTreatment.sessions || 1}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 1;
                                    handleSessionChange(selectedTreatment.treatmentSlug, value);
                                  }}
                                  className="w-16 px-2 py-1.5 text-sm font-semibold text-center border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                                  placeholder="1"
                                />
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
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-2 text-xs text-gray-500 text-center">
                        {selectedTreatments.length} treatment(s) selected
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={submittingPackage || !permissions.canCreate}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 active:bg-gray-950 disabled:opacity-60 transition-all duration-200 shadow-sm hover:shadow-md"
                >
                  {submittingPackage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {submittingPackage ? "Creating..." : "Create Package"}
                </button>
              </form>
            )}
          </div>

          {/* Rooms List - Only show when viewMode is "room" */}
          {viewMode === "room" && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <DoorOpen className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">All Rooms</h2>
                <span className="ml-auto px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                  {rooms.length} {rooms.length === 1 ? 'Room' : 'Rooms'}
                </span>
              </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-600">
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            <span className="text-sm">Loading rooms...</span>
          </div>
        ) : rooms.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
              <DoorOpen className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 mb-1">No rooms created yet</p>
            <p className="text-xs text-gray-600">Use the form above to create your first room</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rooms.map((room) => (
              <div
                key={room._id}
                className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  {editingRoomId === room._id ? (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full">
                      <input
                        type="text"
                        value={editingRoomName}
                        onChange={(e) => setEditingRoomName(e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleRoomUpdate}
                          disabled={roomUpdateLoading}
                          className="flex-1 sm:flex-none px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors flex items-center justify-center"
                        >
                          {roomUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingRoomId(null);
                            setEditingRoomName("");
                          }}
                          className="flex-1 sm:flex-none px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <DoorOpen className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900">{room.name}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Calendar className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            Created {new Date(room.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                {editingRoomId !== room._id && (
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {permissions.canUpdate && (
                      <button
                        onClick={() => {
                          setEditingRoomId(room._id);
                          setEditingRoomName(room.name);
                        }}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Edit room"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {permissions.canDelete && (
                      <button
                        onClick={() => handleDelete(room._id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete room"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
          )}

          {/* Departments List - Only show when viewMode is "department" */}
          {viewMode === "department" && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">All Departments</h2>
                <span className="ml-auto px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                  {departments.length} {departments.length === 1 ? 'Department' : 'Departments'}
                </span>
              </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-600">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span className="text-sm">Loading departments...</span>
              </div>
            ) : departments.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No departments created yet</p>
                <p className="text-xs text-gray-600">Use the form above to create your first department</p>
              </div>
            ) : (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div
                    key={dept._id}
                    className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      {editingDeptId === dept._id ? (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            value={editingDeptName}
                            onChange={(e) => setEditingDeptName(e.target.value)}
                            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={handleDepartmentUpdate}
                              disabled={deptUpdateLoading}
                              className="flex-1 sm:flex-none px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
                            >
                              {deptUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingDeptId(null);
                                setEditingDeptName("");
                              }}
                              className="flex-1 sm:flex-none px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
                            <Building2 className="w-5 h-5 text-purple-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{dept.name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                Created {new Date(dept.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {editingDeptId !== dept._id && (
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {permissions.canUpdate && (
                          <button
                            onClick={() => {
                              setEditingDeptId(dept._id);
                              setEditingDeptName(dept.name);
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit department"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {permissions.canDelete && (
                          <button
                            onClick={() => handleDeleteDepartment(dept._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete department"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
      </div>
          )}

          {/* Packages List - Only show when viewMode is "package" */}
          {viewMode === "package" && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">All Packages</h2>
                <span className="ml-auto px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                  {packages.length} {packages.length === 1 ? 'Package' : 'Packages'}
                </span>
              </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-600">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span className="text-sm">Loading packages...</span>
              </div>
            ) : packages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                  <Package className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-900 mb-1">No packages created yet</p>
                <p className="text-xs text-gray-600">Use the form above to create your first package</p>
              </div>
            ) : (
              <div className="space-y-2">
                {packages.map((pkg) => (
                  <div
                    key={pkg._id}
                    className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all group"
                  >
                    <div className="flex-1 min-w-0">
                      {editingPackageId === pkg._id ? (
                        <div className="space-y-3">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <input
                              type="text"
                              value={editingPackageName}
                              onChange={(e) => setEditingPackageName(e.target.value)}
                              placeholder="Package Name"
                              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              autoFocus
                            />
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={editingPackagePrice}
                              onChange={(e) => setEditingPackagePrice(e.target.value)}
                              placeholder="Price"
                              className="w-full sm:w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            />
                          </div>
                          {/* Treatment Selection for Edit */}
                          <div className="space-y-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Select Treatment
                              </label>
                              {treatments.length === 0 ? (
                                <div className="text-sm text-gray-500 py-2">No treatments available.</div>
                              ) : (
                                <div className="relative treatment-dropdown-container">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setTreatmentDropdownOpen(!treatmentDropdownOpen);
                                      if (!treatmentDropdownOpen) {
                                        setTreatmentSearchQuery(""); // Clear search when opening
                                      }
                                    }}
                                    className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                  >
                                    <span className="text-gray-500">Select a treatment to add...</span>
                                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${treatmentDropdownOpen ? 'rotate-180' : ''}`} />
                                  </button>
                                  {treatmentDropdownOpen && (
                                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                                      {/* Search Input */}
                                      <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                                        <input
                                          type="text"
                                          placeholder="Search treatments..."
                                          value={treatmentSearchQuery}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setTreatmentSearchQuery(e.target.value);
                                          }}
                                          onClick={(e) => e.stopPropagation()}
                                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                          autoFocus
                                        />
                                      </div>
                                      {/* Treatment List */}
                                      <div className="overflow-y-auto max-h-48">
                                        {(() => {
                                          // Only show treatments when user has typed something
                                          if (!treatmentSearchQuery.trim()) {
                                            return (
                                              <div className="p-4 text-center text-sm text-gray-500">
                                                Start typing to search for treatments...
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
                                              <div className="p-4 text-center text-sm text-gray-500">
                                                No treatments found matching "{treatmentSearchQuery}"
                                              </div>
                                            );
                                          }

                                          return (
                                            <div className="p-2">
                                              {filteredTreatments.map((treatment) => {
                                                const isSelected = selectedTreatments.some((t) => t.treatmentSlug === treatment.slug || t.slug === treatment.slug);
                                                return (
                                                  <button
                                                    key={treatment.slug}
                                                    type="button"
                                                    onClick={() => {
                                                      handleTreatmentToggle(treatment);
                                                      setTreatmentSearchQuery(""); // Clear search after selection
                                                    }}
                                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                                      isSelected
                                                        ? "bg-blue-50 text-blue-700 font-medium"
                                                        : "text-gray-700 hover:bg-gray-50"
                                                    }`}
                                                  >
                                                    <div className="flex items-center justify-between">
                                                      <span>
                                                        {treatment.name}
                                                        {treatment.type === "sub" && (
                                                          <span className="text-xs text-gray-500 ml-1">({treatment.mainTreatment})</span>
                                                        )}
                                                      </span>
                                                      {isSelected && (
                                                        <span className="text-blue-600 text-xs">✓</span>
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
                              )}
                            </div>

                            {/* Selected Treatments with Sessions for Edit - Compact Tile Design */}
                            {selectedTreatments.length > 0 && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                  Selected Treatments & Sessions
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {selectedTreatments.map((selectedTreatment) => {
                                    const treatment = treatments.find((t) => t.slug === selectedTreatment.treatmentSlug);
                                    return (
                                      <div
                                        key={selectedTreatment.treatmentSlug}
                                        className="flex items-center justify-between p-2.5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 hover:border-blue-300 transition-all"
                                      >
                                        <div className="flex-1 min-w-0 mr-2">
                                          <span className="text-sm font-medium text-gray-900 block truncate">
                                            {selectedTreatment.treatmentName}
                                          </span>
                                          {treatment?.type === "sub" && (
                                            <span className="text-xs text-gray-500 truncate block">
                                              {treatment.mainTreatment}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                          <input
                                            type="number"
                                            min="1"
                                            value={selectedTreatment.sessions || 1}
                                            onChange={(e) => {
                                              const value = parseInt(e.target.value) || 1;
                                              handleSessionChange(selectedTreatment.treatmentSlug, value);
                                            }}
                                            className="w-16 px-2 py-1.5 text-sm font-semibold text-center border border-blue-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm"
                                            placeholder="1"
                                          />
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
                                            <X className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="mt-2 text-xs text-gray-500 text-center">
                                  {selectedTreatments.length} treatment(s) selected
                                </div>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                            <button
                              onClick={handlePackageUpdate}
                              disabled={packageUpdateLoading}
                              className="flex-1 sm:flex-none px-3 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-60 transition-colors"
                            >
                              {packageUpdateLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
                            </button>
                            <button
                              onClick={() => {
                                setEditingPackageId(null);
                                setEditingPackageName("");
                                setEditingPackagePrice("");
                                setSelectedTreatments([]);
                              }}
                              className="flex-1 sm:flex-none px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                            <Package className="w-5 h-5 text-green-600" />
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{pkg.name}</h3>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-xs text-gray-500 font-medium">
                                Price: ${parseFloat(pkg.price).toFixed(2)}
                              </span>
                              {pkg.treatments && pkg.treatments.length > 0 && (
                                <>
                                  <span className="text-xs text-gray-400">•</span>
                                  <span className="text-xs text-gray-500">
                                    {pkg.treatments.length} treatment(s)
                                  </span>
                                </>
                              )}
                              <span className="text-xs text-gray-400">•</span>
                              <Calendar className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                Created {new Date(pkg.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            {pkg.treatments && pkg.treatments.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {pkg.treatments.slice(0, 3).map((treatment, idx) => (
                                  <span
                                    key={idx}
                                    className="text-xs px-2 py-0.5 bg-blue-50 text-blue-700 rounded"
                                  >
                                    {treatment.treatmentName || treatment.name} ({treatment.sessions || 1} session{treatment.sessions !== 1 ? 's' : ''})
                                  </span>
                                ))}
                                {pkg.treatments.length > 3 && (
                                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                    +{pkg.treatments.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {editingPackageId !== pkg._id && (
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {permissions.canUpdate && (
                          <button
                            onClick={() => {
                              setEditingPackageId(pkg._id);
                              setEditingPackageName(pkg.name);
                              setEditingPackagePrice(pkg.price.toString());
                              // Load treatments for this package
                              if (pkg.treatments && Array.isArray(pkg.treatments)) {
                                setSelectedTreatments(
                                  pkg.treatments.map((t) => ({
                                    treatmentName: t.treatmentName || t.name || "",
                                    treatmentSlug: t.treatmentSlug || t.slug || "",
                                    sessions: t.sessions || 1,
                                  }))
                                );
                              } else {
                                setSelectedTreatments([]);
                              }
                            }}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Edit package"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {permissions.canDelete && (
                          <button
                            onClick={() => handleDeletePackage(pkg._id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete package"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
      </div>
          )}
        </>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm transition-opacity"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setConfirmModal({ ...confirmModal, isOpen: false });
              toast("Deletion cancelled", { duration: 2000, icon: "ℹ️" });
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-modal-title"
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col transform transition-all duration-200 scale-100 opacity-100 mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-red-50 border-b border-red-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <h2 id="confirm-modal-title" className="text-base sm:text-lg font-semibold text-gray-900">
                  {confirmModal.title}
                </h2>
              </div>
              <button
                onClick={() => {
                  setConfirmModal({ ...confirmModal, isOpen: false });
                  toast("Deletion cancelled", { duration: 2000, icon: "ℹ️" });
                }}
                className="p-1.5 hover:bg-red-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                aria-label="Close modal"
              >
                <X className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 sm:p-6">
              <p className="text-sm sm:text-base text-gray-700 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6">
              <button
                onClick={() => {
                  setConfirmModal({ ...confirmModal, isOpen: false });
                  toast("Deletion cancelled", { duration: 2000, icon: "ℹ️" });
                }}
                className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  confirmModal.onConfirm();
                }}
                className="flex-1 px-3 sm:px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

AddRoomPage.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

export const AddRoomPageBase = AddRoomPage;

const ProtectedAddRoomPage = withClinicAuth(AddRoomPage);
ProtectedAddRoomPage.getLayout = AddRoomPage.getLayout;

export default ProtectedAddRoomPage;


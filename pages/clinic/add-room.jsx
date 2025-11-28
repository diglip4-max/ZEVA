"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import { Loader2, Trash2, AlertCircle, CheckCircle, X } from "lucide-react";
import { useAgentPermissions } from "../../hooks/useAgentPermissions";
import { Toaster, toast } from "react-hot-toast";

const MODULE_KEY = "room_management";

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
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
  const [roomName, setRoomName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingDept, setSubmittingDept] = useState(false);
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
  const [token, setToken] = useState("");
  const [hasAgentToken, setHasAgentToken] = useState(contextOverride === "agent");
  const [isAgentRoute, setIsAgentRoute] = useState(contextOverride === "agent");
  const [editingRoomId, setEditingRoomId] = useState(null);
  const [editingRoomName, setEditingRoomName] = useState("");
  const [roomUpdateLoading, setRoomUpdateLoading] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState(null);
  const [editingDeptName, setEditingDeptName] = useState("");
  const [deptUpdateLoading, setDeptUpdateLoading] = useState(false);
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    type: "room",
  });

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
    let cancelled = false;
    const headers = getAuthHeaders();
    if (!headers) {
      setPermissions({
        canCreate: false,
        canRead: false,
        canUpdate: false,
        canDelete: false,
      });
      setPermissionsLoaded(true);
      return;
    }

    const fetchPermissions = async () => {
      try {
        setPermissionsLoaded(false);
        const { data } = await axios.get("/api/clinic/permissions", { headers });
        if (cancelled) return;

        if (data.success && data.data) {
          const modulePermission = data.data.permissions?.find((p) => {
            if (!p?.module) return false;
            const normalized = p.module.startsWith("clinic_")
              ? p.module.slice(7)
              : p.module.startsWith("admin_")
              ? p.module.slice(6)
              : p.module;
            // Check for both room_management and addRoom (clinic_addRoom)
            return normalized === MODULE_KEY || normalized === "addRoom";
          });

          if (modulePermission) {
            const actions = modulePermission.actions || {};
            const moduleAll = actions.all === true;
            // Properly handle false values - if all is false, check individual permissions
            // If a permission is explicitly false, it should be false
            setPermissions({
              canCreate: moduleAll ? true : (actions.create === true),
              canRead: moduleAll ? true : (actions.read === true),
              canUpdate: moduleAll ? true : (actions.update === true),
              canDelete: moduleAll ? true : (actions.delete === true),
            });
          } else {
            // If no permission entry exists for this module, deny all access by default
            setPermissions({
              canCreate: false,
              canRead: false,
              canUpdate: false,
              canDelete: false,
            });
          }
        } else {
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
          });
        }
      } catch (error) {
        console.error("Error fetching permissions:", error);
        if (!cancelled) {
          setPermissions({
            canCreate: false,
            canRead: false,
            canUpdate: false,
            canDelete: false,
          });
        }
      } finally {
        if (!cancelled) {
          setPermissionsLoaded(true);
        }
      }
    };

    fetchPermissions();

    return () => {
      cancelled = true;
    };
  }, [isAgentRoute, token]);

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

  const loadRooms = async () => {
    const headers = getHeadersOrNotify();
    if (!headers) return;
    try {
      const res = await axios.get("/api/clinic/rooms", { headers });
      if (res.data.success) {
        setRooms(res.data.rooms || []);
        toast.success(`Loaded ${res.data.rooms?.length || 0} room(s)`, { duration: 2000 });
      } else {
        const errorMsg = res.data.message || "Failed to load rooms";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error loading rooms", error);
      const errorMessage = error.response?.data?.message || "Failed to load rooms";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    }
  };

  const loadDepartments = async () => {
    const headers = getHeadersOrNotify();
    if (!headers) return;
    try {
      const res = await axios.get("/api/clinic/departments", { headers });
      if (res.data.success) {
        setDepartments(res.data.departments || []);
        toast.success(`Loaded ${res.data.departments?.length || 0} department(s)`, { duration: 2000 });
      } else {
        const errorMsg = res.data.message || "Failed to load departments";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      console.error("Error loading departments", error);
      const errorMessage = error.response?.data?.message || "Failed to load departments";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    }
  };

  useEffect(() => {
    if (!permissionsLoaded) return;
    if (!permissions.canRead) {
      setRooms([]);
      setDepartments([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadRooms(), loadDepartments()]);
      if (!cancelled) {
      setLoading(false);
    }
  };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [permissionsLoaded, permissions.canRead]);

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
        await loadRooms();
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
        await loadRooms();
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
            await loadRooms();
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

  const roomCreateDisabled = submitting || !permissions.canCreate;
  const deptCreateDisabled = submittingDept || !permissions.canCreate;

  return (
    <div className="p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-4 lg:space-y-5">
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
              primary: "#ef4444",
              secondary: "#fff",
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
        <div className="bg-white rounded-lg border border-red-200 shadow-sm p-6 text-center space-y-2">
          <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-red-50 text-red-600 text-2xl">
            !
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Access denied</h2>
          <p className="text-xs sm:text-sm text-gray-700">
            You do not have permission to view or manage rooms and departments. Please contact your
            administrator if you believe this is incorrect.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
            <div className="flex flex-col gap-1 mb-3 sm:mb-4">
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">Manage Rooms</h1>
              <p className="text-xs sm:text-sm text-gray-700">Create and manage rooms for your clinic.</p>
        </div>

        <MessageBanner type={message.type} text={message.text} />

            {permissions.canCreate && (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g., Consultation Room 1, Operation Theater A"
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              required
            />
          </div>

          <button
            type="submit"
                  disabled={roomCreateDisabled}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-medium shadow hover:bg-blue-700 disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {submitting ? "Creating..." : "Create Room"}
          </button>
        </form>
            )}
      </div>

          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div>
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">All Rooms</h2>
                <p className="text-xs sm:text-sm text-gray-700">List of all rooms in your clinic.</p>
          </div>
        </div>

        {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-700">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="text-xs sm:text-sm">Loading rooms...</span>
          </div>
        ) : rooms.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
              🏥
            </div>
                <p className="text-xs sm:text-sm text-gray-700">No rooms created yet.</p>
                <p className="text-[10px] sm:text-xs text-gray-700 mt-1">Use the form above to create your first room.</p>
          </div>
        ) : (
              <div className="space-y-2">
            {rooms.map((room) => (
              <div
                key={room._id}
                    className="border border-gray-200 rounded-lg p-2 sm:p-3 flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      {editingRoomId === room._id ? (
                        <>
                          <input
                            type="text"
                            value={editingRoomName}
                            onChange={(e) => setEditingRoomName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all"
                            aria-label="Edit room name"
                          />
                          <p className="text-[10px] sm:text-xs text-gray-700 mt-1">Editing room name</p>
                        </>
                      ) : (
                        <>
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{room.name}</h3>
                          <p className="text-xs text-gray-700">
                    Created {new Date(room.createdAt).toLocaleDateString()}
                  </p>
                        </>
                      )}
                </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {editingRoomId === room._id ? (
                        <>
                          <button
                            onClick={handleRoomUpdate}
                            disabled={roomUpdateLoading}
                            className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
                          >
                            {roomUpdateLoading ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingRoomId(null);
                              setEditingRoomName("");
                            }}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {permissions.canUpdate && (
                            <button
                              onClick={() => {
                                setEditingRoomId(room._id);
                                setEditingRoomName(room.name);
                              }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {permissions.canDelete && (
                <button
                  onClick={() => handleDelete(room._id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                  title="Delete room"
                              aria-label="Delete room"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {!permissions.canUpdate && !permissions.canDelete && (
                            <span className="text-[10px] text-gray-700">No actions available</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            </div>

            {/* All Departments List */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-3 sm:p-4">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900">All Departments</h2>
                  <p className="text-xs sm:text-sm text-gray-700">List of all departments in your clinic.</p>
                </div>
              </div>

            {loading ? (
              <div className="flex items-center justify-center py-8 text-gray-700">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                <span className="text-xs sm:text-sm">Loading departments...</span>
              </div>
            ) : departments.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
                  🏢
                </div>
                <p className="text-xs sm:text-sm text-gray-700">No departments created yet.</p>
                <p className="text-[10px] sm:text-xs text-gray-700 mt-1">
                  Use the form above to create your first department.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {departments.map((dept) => (
                  <div
                    key={dept._id}
                    className="border border-gray-200 rounded-lg p-2 sm:p-3 flex flex-col gap-2 sm:gap-3 md:flex-row md:items-center md:justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      {editingDeptId === dept._id ? (
                        <>
                          <input
                            type="text"
                            value={editingDeptName}
                            onChange={(e) => setEditingDeptName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all"
                            aria-label="Edit department name"
                          />
                          <p className="text-[10px] sm:text-xs text-gray-700 mt-1">Editing department name</p>
                        </>
                      ) : (
                        <>
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{dept.name}</h3>
                          <p className="text-xs text-gray-700">
                            Created {new Date(dept.createdAt).toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      {editingDeptId === dept._id ? (
                        <>
                          <button
                            onClick={handleDepartmentUpdate}
                            disabled={deptUpdateLoading}
                            className="px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg hover:bg-gray-800 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
                          >
                            {deptUpdateLoading ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingDeptId(null);
                              setEditingDeptName("");
                            }}
                            className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          {permissions.canUpdate && (
                            <button
                              onClick={() => {
                                setEditingDeptId(dept._id);
                                setEditingDeptName(dept.name);
                              }}
                              className="px-3 py-1.5 bg-gray-100 text-gray-700 text-xs rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          {permissions.canDelete && (
                            <button
                              onClick={() => handleDeleteDepartment(dept._id)}
                              className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                              title="Delete department"
                              aria-label="Delete department"
                            >
                              <Trash2 className="w-4 h-4" />
                </button>
                          )}
                          {!permissions.canUpdate && !permissions.canDelete && (
                            <span className="text-[10px] text-gray-700">No actions available</span>
                          )}
                        </>
                      )}
                    </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
            className="bg-white rounded-lg shadow-2xl max-w-md w-full overflow-hidden flex flex-col transform transition-all duration-200 scale-100 opacity-100"
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
  );
}

AddRoomPage.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

export const AddRoomPageBase = AddRoomPage;

const ProtectedAddRoomPage = withClinicAuth(AddRoomPage);
ProtectedAddRoomPage.getLayout = AddRoomPage.getLayout;

export default ProtectedAddRoomPage;


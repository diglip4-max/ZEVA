"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import { useRouter } from "next/router";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import type { NextPageWithLayout } from "../_app";
import { Loader2, Trash2, AlertCircle, CheckCircle } from "lucide-react";
import { useAgentPermissions } from "../../hooks/useAgentPermissions";

interface Room {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

interface Department {
  _id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

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

const MessageBanner = ({ type, text }: { type: "success" | "error" | "info"; text: string }) => {
  if (!text) return null;

  const styles = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    error: "bg-rose-50 text-rose-700 border-rose-200",
    info: "bg-sky-50 text-sky-700 border-sky-200",
  };

  const Icon = type === "error" ? AlertCircle : CheckCircle;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${styles[type]}`}>
      <Icon className="w-5 h-5" />
      <p className="text-sm font-medium">{text}</p>
    </div>
  );
};

function AddRoomPage() {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roomName, setRoomName] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingDept, setSubmittingDept] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error" | "info"; text: string }>({
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
  const [hasAgentToken, setHasAgentToken] = useState(false);
  const [isAgentRoute, setIsAgentRoute] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [editingRoomName, setEditingRoomName] = useState("");
  const [roomUpdateLoading, setRoomUpdateLoading] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [editingDeptName, setEditingDeptName] = useState("");
  const [deptUpdateLoading, setDeptUpdateLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      const storedToken = getStoredToken();
      setToken(storedToken || "");
      setHasAgentToken(Boolean(localStorage.getItem("agentToken")));
    };
    syncTokens();
    window.addEventListener("storage", syncTokens);
    return () => window.removeEventListener("storage", syncTokens);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const agentPath =
      router?.pathname?.startsWith("/agent/") ||
      window.location.pathname?.startsWith("/agent/");
    setIsAgentRoute(Boolean(agentPath && hasAgentToken));
  }, [router.pathname, hasAgentToken]);

  const { permissions: agentPermissions, loading: agentPermissionsLoading } = useAgentPermissions(
    isAgentRoute ? MODULE_KEY : null
  );

  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;
    setPermissions({
      canCreate: agentPermissions.canAll || agentPermissions.canCreate,
      canRead: agentPermissions.canAll || agentPermissions.canRead,
      canUpdate: agentPermissions.canAll || agentPermissions.canUpdate,
      canDelete: agentPermissions.canAll || agentPermissions.canDelete,
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
          const modulePermission = data.data.permissions?.find((p: any) => {
            if (!p?.module) return false;
            const normalized = p.module.startsWith("clinic_")
              ? p.module.slice(7)
              : p.module.startsWith("admin_")
              ? p.module.slice(6)
              : p.module;
            return normalized === MODULE_KEY;
          });

          if (modulePermission) {
            const actions = modulePermission.actions || {};
            const moduleAll = actions.all === true;
            setPermissions({
              canCreate: moduleAll || actions.create === true,
              canRead: moduleAll || actions.read === true,
              canUpdate: moduleAll || actions.update === true,
              canDelete: moduleAll || actions.delete === true,
            });
          } else {
            // If no permission entry exists for this module, keep previous behavior (full access)
            setPermissions({
              canCreate: true,
              canRead: true,
              canUpdate: true,
              canDelete: true,
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
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to load rooms" });
      }
    } catch (error: any) {
      console.error("Error loading rooms", error);
      const errorMessage = error.response?.data?.message || "Failed to load rooms";
      setMessage({ type: "error", text: errorMessage });
    }
  };

  const loadDepartments = async () => {
    const headers = getHeadersOrNotify();
    if (!headers) return;
    try {
      const res = await axios.get("/api/clinic/departments", { headers });
      if (res.data.success) {
        setDepartments(res.data.departments || []);
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to load departments" });
      }
    } catch (error: any) {
      console.error("Error loading departments", error);
      const errorMessage = error.response?.data?.message || "Failed to load departments";
      setMessage({ type: "error", text: errorMessage });
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

  const handleSubmit = async (e: React.FormEvent) => {
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
        setMessage({ type: "success", text: res.data.message || "Room created successfully" });
        setRoomName("");
        await loadRooms();
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to create room" });
      }
    } catch (error: any) {
      console.error("Error creating room", error);
      const errorMessage = error.response?.data?.message || "Failed to create room";
      setMessage({ type: "error", text: errorMessage });
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
        setMessage({ type: "success", text: res.data.message || "Room updated successfully" });
        setEditingRoomId(null);
        setEditingRoomName("");
        await loadRooms();
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to update room" });
      }
    } catch (error: any) {
      console.error("Error updating room", error);
      const errorMessage = error.response?.data?.message || "Failed to update room";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setRoomUpdateLoading(false);
    }
  };

  const handleDelete = async (roomId: string) => {
    if (!permissions.canDelete) {
      setMessage({ type: "error", text: "You do not have permission to delete rooms" });
      return;
    }
    if (!confirm("Are you sure you want to delete this room?")) {
      return;
    }
    const headers = getHeadersOrNotify();
    if (!headers) return;

    try {
      const res = await axios.delete(`/api/clinic/rooms?roomId=${roomId}`, { headers });
      if (res.data.success) {
        setMessage({ type: "success", text: res.data.message || "Room deleted successfully" });
        if (editingRoomId === roomId) {
          setEditingRoomId(null);
          setEditingRoomName("");
        }
        await loadRooms();
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to delete room" });
      }
    } catch (error: any) {
      console.error("Error deleting room", error);
      const errorMessage = error.response?.data?.message || "Failed to delete room";
      setMessage({ type: "error", text: errorMessage });
    }
  };

  const handleDepartmentSubmit = async (e: React.FormEvent) => {
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
        setMessage({
          type: "success",
          text: res.data.message || "Department created successfully",
        });
        setDepartmentName("");
        await loadDepartments();
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to create department" });
      }
    } catch (error: any) {
      console.error("Error creating department", error);
      const errorMessage = error.response?.data?.message || "Failed to create department";
      setMessage({ type: "error", text: errorMessage });
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
        setMessage({
          type: "success",
          text: res.data.message || "Department updated successfully",
        });
        setEditingDeptId(null);
        setEditingDeptName("");
        await loadDepartments();
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to update department" });
      }
    } catch (error: any) {
      console.error("Error updating department", error);
      const errorMessage = error.response?.data?.message || "Failed to update department";
      setMessage({ type: "error", text: errorMessage });
    } finally {
      setDeptUpdateLoading(false);
    }
  };

  const handleDeleteDepartment = async (departmentId: string) => {
    if (!permissions.canDelete) {
      setMessage({ type: "error", text: "You do not have permission to delete departments" });
      return;
    }
    if (!confirm("Are you sure you want to delete this department?")) {
      return;
    }
    const headers = getHeadersOrNotify();
    if (!headers) return;

    try {
      const res = await axios.delete(`/api/clinic/departments?departmentId=${departmentId}`, {
        headers,
      });
      if (res.data.success) {
        setMessage({
          type: "success",
          text: res.data.message || "Department deleted successfully",
        });
        if (editingDeptId === departmentId) {
          setEditingDeptId(null);
          setEditingDeptName("");
        }
        await loadDepartments();
      } else {
        setMessage({ type: "error", text: res.data.message || "Failed to delete department" });
      }
    } catch (error: any) {
      console.error("Error deleting department", error);
      const errorMessage = error.response?.data?.message || "Failed to delete department";
      setMessage({ type: "error", text: errorMessage });
    }
  };

  const roomCreateDisabled = submitting || !permissions.canCreate;
  const deptCreateDisabled = submittingDept || !permissions.canCreate;

  return (
    <div className="space-y-6">
      {!permissionsLoaded ? (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center text-gray-600">
          <Loader2 className="w-5 h-5 mx-auto mb-3 animate-spin" />
          Checking your permissions...
        </div>
      ) : !permissions.canRead ? (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center space-y-3">
          <div className="inline-flex w-16 h-16 items-center justify-center rounded-full bg-red-50 text-red-500 text-3xl">
            !
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Access denied</h2>
          <p className="text-sm text-gray-600">
            You do not have permission to view or manage rooms and departments. Please contact your
            administrator if you believe this is incorrect.
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col gap-1 mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Manage Rooms</h1>
              <p className="text-sm text-gray-500">Create and manage rooms for your clinic.</p>
            </div>

            <MessageBanner type={message.type} text={message.text} />

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
                  disabled={!permissions.canCreate}
                  required
                />
                {!permissions.canCreate && (
                  <p className="mt-2 text-xs text-gray-500">
                    You do not have permission to create new rooms.
                  </p>
                )}
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
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">All Rooms</h2>
                <p className="text-sm text-gray-500">List of all rooms in your clinic.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading rooms...
              </div>
            ) : rooms.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">
                  🏥
                </div>
                <p className="text-gray-600">No rooms created yet.</p>
                <p className="text-sm text-gray-500 mt-2">Use the form above to create your first room.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {rooms.map((room) => (
                  <div
                    key={room._id}
                    className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      {editingRoomId === room._id ? (
                        <>
                          <input
                            type="text"
                            value={editingRoomName}
                            onChange={(e) => setEditingRoomName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-2">Editing room name</p>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-gray-900">{room.name}</h3>
                          <p className="text-sm text-gray-500">
                            Created {new Date(room.createdAt).toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingRoomId === room._id ? (
                        <>
                          <button
                            onClick={handleRoomUpdate}
                            disabled={roomUpdateLoading}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {roomUpdateLoading ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingRoomId(null);
                              setEditingRoomName("");
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
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
                              className="px-4 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg hover:bg-blue-100"
                            >
                              Edit
                            </button>
                          )}
                          {permissions.canDelete && (
                            <button
                              onClick={() => handleDelete(room._id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete room"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                          {!permissions.canUpdate && !permissions.canDelete && (
                            <span className="text-xs text-gray-400">No actions available</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Departments Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex flex-col gap-1 mb-6">
              <h1 className="text-2xl font-semibold text-gray-900">Manage Departments</h1>
              <p className="text-sm text-gray-500">Create and manage departments for your clinic.</p>
            </div>

            <form onSubmit={handleDepartmentSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={departmentName}
                  onChange={(e) => setDepartmentName(e.target.value)}
                  placeholder="e.g., Cardiology, Dermatology"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                  disabled={!permissions.canCreate}
                  required
                />
                {!permissions.canCreate && (
                  <p className="mt-2 text-xs text-gray-500">
                    You do not have permission to create new departments.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={deptCreateDisabled}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-xl font-medium shadow hover:bg-green-700 disabled:opacity-60"
              >
                {submittingDept && <Loader2 className="w-4 h-4 animate-spin" />}
                {submittingDept ? "Creating..." : "Create Department"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">All Departments</h2>
                <p className="text-sm text-gray-500">List of all departments in your clinic.</p>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-gray-500">
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading departments...
              </div>
            ) : departments.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">
                  🏢
                </div>
                <p className="text-gray-600">No departments created yet.</p>
                <p className="text-sm text-gray-500 mt-2">
                  Use the form above to create your first department.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {departments.map((dept) => (
                  <div
                    key={dept._id}
                    className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1">
                      {editingDeptId === dept._id ? (
                        <>
                          <input
                            type="text"
                            value={editingDeptName}
                            onChange={(e) => setEditingDeptName(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <p className="text-xs text-gray-500 mt-2">Editing department name</p>
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-gray-900">{dept.name}</h3>
                          <p className="text-sm text-gray-500">
                            Created {new Date(dept.createdAt).toLocaleDateString()}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingDeptId === dept._id ? (
                        <>
                          <button
                            onClick={handleDepartmentUpdate}
                            disabled={deptUpdateLoading}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-60"
                          >
                            {deptUpdateLoading ? "Saving..." : "Save"}
                          </button>
                          <button
                            onClick={() => {
                              setEditingDeptId(null);
                              setEditingDeptName("");
                            }}
                            className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
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
                              className="px-4 py-2 bg-blue-50 text-blue-700 text-sm rounded-lg hover:bg-blue-100"
                            >
                              Edit
                            </button>
                          )}
                          {permissions.canDelete && (
                            <button
                              onClick={() => handleDeleteDepartment(dept._id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete department"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                          {!permissions.canUpdate && !permissions.canDelete && (
                            <span className="text-xs text-gray-400">No actions available</span>
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
    </div>
  );
}

AddRoomPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedAddRoomPage: NextPageWithLayout = withClinicAuth(AddRoomPage);
ProtectedAddRoomPage.getLayout = AddRoomPage.getLayout;

export default ProtectedAddRoomPage;


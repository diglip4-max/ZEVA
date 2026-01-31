"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import { Toaster, toast } from "react-hot-toast";
import { Loader2, Edit2, Trash2, CheckCircle, AlertCircle } from "lucide-react";

const MODULE_KEY = "Clinic_services_setup";
const TOKEN_PRIORITY = ["clinicToken", "agentToken", "doctorToken", "userToken", "staffToken", "adminToken"];

function getStoredToken() {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    try {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value) return value;
    } catch {}
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

function ServicesSetupPage() {
  const [activeTab, setActiveTab] = useState("services");
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "info", text: "" });

  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingPrice, setEditingPrice] = useState("");
  const [editingDuration, setEditingDuration] = useState("");
  const [editingActive, setEditingActive] = useState(true);
  const [updating, setUpdating] = useState(false);

  const [ppsItems, setPpsItems] = useState([]);
  const [ppsLoading, setPpsLoading] = useState(true);
  const [ppsSubmitting, setPpsSubmitting] = useState(false);
  const [ppsName, setPpsName] = useState("");
  const [ppsPrice, setPpsPrice] = useState("");
  const [ppsDurationMinutes, setPpsDurationMinutes] = useState("");
  const [ppsEditingId, setPpsEditingId] = useState(null);
  const [ppsEditingName, setPpsEditingName] = useState("");
  const [ppsEditingPrice, setPpsEditingPrice] = useState("");
  const [ppsEditingDuration, setPpsEditingDuration] = useState("");
  const [ppsEditingActive, setPpsEditingActive] = useState(true);
  const [ppsUpdating, setPpsUpdating] = useState(false);

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
  const loadServices = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const res = await axios.get("/api/clinic/services", { headers });
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

  const loadPayPerSession = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const res = await axios.get("/api/clinic/pay_per_session", { headers });
      if (res.data.success) {
        setPpsItems(res.data.items || []);
      } else {
        const errorMsg = res.data.message || "Failed to load pay-per-session services";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const status = error.response?.status;
      if (status !== 401 && status !== 403) {
        const errorMsg = error.response?.data?.message || "Failed to load pay-per-session services";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
      setPpsItems([]);
    } finally {
      setPpsLoading(false);
    }
  };

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    if (activeTab === "pay_per_session") {
      loadPayPerSession();
    }
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

  const handleCreatePps = async (e) => {
    e.preventDefault();
    setMessage({ type: "info", text: "" });
    if (!ppsName.trim()) {
      setMessage({ type: "error", text: "Please enter a name" });
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setPpsSubmitting(true);
    try {
      const res = await axios.post(
        "/api/clinic/pay_per_session",
        {
          name: ppsName.trim(),
          serviceSlug: slugify(ppsName),
          price: parseFloat(ppsPrice),
          durationMinutes: parseInt(ppsDurationMinutes),
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Created";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setPpsName("");
        setPpsPrice("");
        setPpsDurationMinutes("");
        await loadPayPerSession();
      } else {
        const errorMsg = res.data.message || "Failed to create";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to create";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setPpsSubmitting(false);
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

  const handleUpdatePps = async () => {
    if (!ppsEditingId) return;
    if (!ppsEditingName.trim()) {
      setMessage({ type: "error", text: "Name cannot be empty" });
      return;
    }
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    setPpsUpdating(true);
    try {
      const res = await axios.put(
        "/api/clinic/pay_per_session",
        {
          itemId: ppsEditingId,
          name: ppsEditingName.trim(),
          serviceSlug: slugify(ppsEditingName),
          price: parseFloat(ppsEditingPrice),
          durationMinutes: parseInt(ppsEditingDuration),
          isActive: Boolean(ppsEditingActive),
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Updated";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setPpsEditingId(null);
        setPpsEditingName("");
        setPpsEditingPrice("");
        setPpsEditingDuration("");
        await loadPayPerSession();
      } else {
        const errorMsg = res.data.message || "Failed to update";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to update";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setPpsUpdating(false);
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

  const handleDeletePps = async (itemId) => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const res = await axios.delete(`/api/clinic/pay_per_session`, { headers, data: { itemId } });
      if (res.data.success) {
        const successMsg = res.data.message || "Deleted";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        await loadPayPerSession();
      } else {
        const errorMsg = res.data.message || "Failed to delete";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Failed to delete";
      setMessage({ type: "error", text: errorMessage });
      toast.error(errorMessage, { duration: 3000 });
    }
  };

  return (
    <>
      <Toaster position="top-right" />
      <div className="p-4 space-y-4">
        <div className="flex border-b border-teal-200 mb-2">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "services"
                ? "border-teal-800 text-teal-900"
                : "border-transparent text-teal-500 hover:text-teal-700"
            }`}
          >
            Services
          </button>
          <button
            onClick={() => setActiveTab("pay_per_session")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "pay_per_session"
                ? "border-teal-800 text-teal-900"
                : "border-transparent text-teal-500 hover:text-teal-700"
            }`}
          >
            Pay-Per-Session
          </button>
          <button
            onClick={() => setActiveTab("memberships")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "memberships"
                ? "border-teal-800 text-teal-900"
                : "border-transparent text-teal-500 hover:text-teal-700"
            }`}
          >
            Memberships
          </button>
        </div>
        <div>
          {message.text && (
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded border ${
                message.type === "error"
                  ? "bg-rose-50 text-rose-800 border-rose-200"
                  : message.type === "success"
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-sky-50 text-sky-800 border-sky-200"
              }`}
            >
              {message.type === "error" ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
              <span className="text-sm">{message.text}</span>
            </div>
          )}
        </div>

        {activeTab === "services" ? (
          <>
            <div className="bg-white border border-teal-200 rounded-lg p-4 space-y-3">
              <h2 className="text-teal-900 font-semibold text-sm">Create Service</h2>
              <form onSubmit={handleCreate} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Service Name"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Price"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="5"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="Duration (minutes)"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 bg-teal-900 text-white text-sm rounded hover:bg-teal-800 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create"}
                </button>
              </form>
            </div>

            <div className="bg-white border border-teal-200 rounded-lg p-4">
              <h2 className="text-teal-900 font-semibold text-sm mb-2">Services</h2>
              {loading ? (
                <div className="text-teal-700 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading services…
                </div>
              ) : services.length === 0 ? (
                <div className="text-teal-500 text-sm">No services available</div>
              ) : (
                <div className="space-y-3">
                  {services.map((s) => (
                    <div key={s._id} className="p-3 border border-teal-200 rounded-lg flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingId === s._id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                placeholder="Service Name"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                                autoFocus
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                placeholder="Price"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="5"
                                value={editingDuration}
                                onChange={(e) => setEditingDuration(e.target.value)}
                                placeholder="Duration (minutes)"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              />
                              <select
                                value={editingActive ? "active" : "inactive"}
                                onChange={(e) => setEditingActive(e.target.value === "active")}
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleUpdate}
                                disabled={updating}
                                className="px-3 py-2 bg-teal-900 text-white text-sm rounded hover:bg-teal-800 disabled:opacity-60"
                              >
                                {updating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setEditingName("");
                                  setEditingPrice("");
                                  setEditingDuration("");
                                }}
                                className="px-3 py-2 bg-teal-100 text-teal-700 text-sm rounded hover:bg-teal-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-semibold text-teal-900">{s.name}</div>
                            <div className="text-xs text-teal-600 mt-0.5">
                              Price: ${Number(s.price || 0).toFixed(2)} • Duration: {s.durationMinutes} min •{" "}
                              {s.isActive ? "Active" : "Inactive"}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {editingId !== s._id && (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(s._id);
                                setEditingName(s.name || "");
                                setEditingPrice(String(s.price ?? ""));
                                setEditingDuration(String(s.durationMinutes ?? ""));
                                setEditingActive(Boolean(s.isActive));
                              }}
                              className="p-2 text-teal-600 hover:bg-teal-100 rounded-lg"
                              title="Edit service"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(s._id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete service"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="bg-white border border-teal-200 rounded-lg p-4 space-y-3">
              <h2 className="text-teal-900 font-semibold text-sm">Create Pay-Per-Session</h2>
              <form onSubmit={handleCreatePps} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={ppsName}
                    onChange={(e) => setPpsName(e.target.value)}
                    placeholder="Name"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ppsPrice}
                    onChange={(e) => setPpsPrice(e.target.value)}
                    placeholder="Price"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="5"
                    value={ppsDurationMinutes}
                    onChange={(e) => setPpsDurationMinutes(e.target.value)}
                    placeholder="Duration (minutes)"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={ppsSubmitting}
                  className="px-3 py-2 bg-teal-900 text-white text-sm rounded hover:bg-teal-800 disabled:opacity-60"
                >
                  {ppsSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create"}
                </button>
              </form>
            </div>

            <div className="bg-white border border-teal-200 rounded-lg p-4">
              <h2 className="text-teal-900 font-semibold text-sm mb-2">Pay-Per-Session Services</h2>
              {ppsLoading ? (
                <div className="text-teal-700 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              ) : ppsItems.length === 0 ? (
                <div className="text-teal-500 text-sm">No items available</div>
              ) : (
                <div className="space-y-3">
                  {ppsItems.map((s) => (
                    <div key={s._id} className="p-3 border border-teal-200 rounded-lg flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {ppsEditingId === s._id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={ppsEditingName}
                                onChange={(e) => setPpsEditingName(e.target.value)}
                                placeholder="Name"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                                autoFocus
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={ppsEditingPrice}
                                onChange={(e) => setPpsEditingPrice(e.target.value)}
                                placeholder="Price"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="5"
                                value={ppsEditingDuration}
                                onChange={(e) => setPpsEditingDuration(e.target.value)}
                                placeholder="Duration (minutes)"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              />
                              <select
                                value={ppsEditingActive ? "active" : "inactive"}
                                onChange={(e) => setPpsEditingActive(e.target.value === "active")}
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleUpdatePps}
                                disabled={ppsUpdating}
                                className="px-3 py-2 bg-teal-900 text-white text-sm rounded hover:bg-teal-800 disabled:opacity-60"
                              >
                                {ppsUpdating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
                              </button>
                              <button
                                onClick={() => {
                                  setPpsEditingId(null);
                                  setPpsEditingName("");
                                  setPpsEditingPrice("");
                                  setPpsEditingDuration("");
                                }}
                                className="px-3 py-2 bg-teal-100 text-teal-700 text-sm rounded hover:bg-teal-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-semibold text-teal-900">{s.name}</div>
                            <div className="text-xs text-teal-600 mt-0.5">
                              Price: ${Number(s.price || 0).toFixed(2)} • Duration: {s.durationMinutes} min •{" "}
                              {s.isActive ? "Active" : "Inactive"}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {ppsEditingId !== s._id && (
                          <>
                            <button
                              onClick={() => {
                                setPpsEditingId(s._id);
                                setPpsEditingName(s.name || "");
                                setPpsEditingPrice(String(s.price ?? ""));
                                setPpsEditingDuration(String(s.durationMinutes ?? ""));
                                setPpsEditingActive(Boolean(s.isActive));
                              }}
                              className="p-2 text-teal-600 hover:bg-teal-100 rounded-lg"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePps(s._id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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
        {activeTab === "memberships" && (
          <>
            <div className="bg-white border border-teal-200 rounded-lg p-4 space-y-3">
              <h2 className="text-teal-900 font-semibold text-sm">Create Membership</h2>
              <form onSubmit={handleCreateMembership} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={memName}
                    onChange={(e) => setMemName(e.target.value)}
                    placeholder="Name"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={memPrice}
                    onChange={(e) => setMemPrice(e.target.value)}
                    placeholder="Price"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    value={memDurationMonths}
                    onChange={(e) => setMemDurationMonths(e.target.value)}
                    placeholder="Duration (months)"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={memFreeConsultations}
                    onChange={(e) => setMemFreeConsultations(e.target.value)}
                    placeholder="Free Consultations (0 = unlimited)"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={memDiscountPercentage}
                    onChange={(e) => setMemDiscountPercentage(e.target.value)}
                    placeholder="Discount %"
                    className="border border-teal-300 rounded px-3 py-2 text-sm"
                  />
                  <label className="flex items-center gap-2 text-sm text-teal-700">
                    <input
                      type="checkbox"
                      checked={memPriorityBooking}
                      onChange={(e) => setMemPriorityBooking(e.target.checked)}
                    />
                    Priority Booking
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={memSubmitting}
                  className="px-3 py-2 bg-teal-900 text-white text-sm rounded hover:bg-teal-800 disabled:opacity-60"
                >
                  {memSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create"}
                </button>
              </form>
            </div>

            <div className="bg-white border border-teal-200 rounded-lg p-4">
              <h2 className="text-teal-900 font-semibold text-sm mb-2">Memberships</h2>
              {memLoading ? (
                <div className="text-teal-700 text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading memberships…
                </div>
              ) : memberships.length === 0 ? (
                <div className="text-teal-500 text-sm">No memberships available</div>
              ) : (
                <div className="space-y-3">
                  {memberships.map((m) => (
                    <div key={m._id} className="p-3 border border-teal-200 rounded-lg flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {memEditingId === m._id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                              <input
                                type="text"
                                value={memEditingName}
                                onChange={(e) => setMemEditingName(e.target.value)}
                                placeholder="Name"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                                autoFocus
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={memEditingPrice}
                                onChange={(e) => setMemEditingPrice(e.target.value)}
                                placeholder="Price"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="1"
                                value={memEditingDurationMonths}
                                onChange={(e) => setMemEditingDurationMonths(e.target.value)}
                                placeholder="Duration (months)"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="0"
                                value={memEditingFreeConsultations}
                                onChange={(e) => setMemEditingFreeConsultations(e.target.value)}
                                placeholder="Free Consultations"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={memEditingDiscountPercentage}
                                onChange={(e) => setMemEditingDiscountPercentage(e.target.value)}
                                placeholder="Discount %"
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <label className="flex items-center gap-2 text-sm text-teal-700">
                                <input
                                  type="checkbox"
                                  checked={memEditingPriorityBooking}
                                  onChange={(e) => setMemEditingPriorityBooking(e.target.checked)}
                                />
                                Priority Booking
                              </label>
                              <select
                                value={memEditingActive ? "active" : "inactive"}
                                onChange={(e) => setMemEditingActive(e.target.value === "active")}
                                className="border border-teal-300 rounded px-3 py-2 text-sm"
                              >
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                              </select>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={handleUpdateMembership}
                                disabled={memUpdating}
                                className="px-3 py-2 bg-teal-900 text-white text-sm rounded hover:bg-teal-800 disabled:opacity-60"
                              >
                                {memUpdating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
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
                                className="px-3 py-2 bg-teal-100 text-teal-700 text-sm rounded hover:bg-teal-200"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div className="text-sm font-semibold text-teal-900">{m.name}</div>
                            <div className="text-xs text-teal-600 mt-0.5">
                              Price: ${Number(m.price || 0).toFixed(2)} • Duration: {m.durationMonths} months •{" "}
                              {m.isActive ? "Active" : "Inactive"}
                            </div>
                            <div className="text-xs text-teal-600 mt-0.5">
                              Free Consultations: {m.benefits?.freeConsultations ?? 0} • Discount: {m.benefits?.discountPercentage ?? 0}% •{" "}
                              Priority Booking: {m.benefits?.priorityBooking ? "Yes" : "No"}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {memEditingId !== m._id && (
                          <>
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
                              className="p-2 text-teal-600 hover:bg-teal-100 rounded-lg"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteMembership(m._id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
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

"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import { Toaster, toast } from "react-hot-toast";
import { Loader2, Edit2, Trash2, CheckCircle, AlertCircle, Package, ChevronDown, X, Calendar } from "lucide-react";

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

  // Packages state
  const [packages, setPackages] = useState([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [pkgSubmitting, setPkgSubmitting] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [treatments, setTreatments] = useState([]);
  const [selectedTreatments, setSelectedTreatments] = useState([]); // Array of { treatmentName, treatmentSlug, sessions }
  const [treatmentDropdownOpen, setTreatmentDropdownOpen] = useState(false);
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState("");
  const [pkgEditingId, setPkgEditingId] = useState(null);
  const [pkgEditingName, setPkgEditingName] = useState("");
  const [pkgEditingPrice, setPkgEditingPrice] = useState("");
  const [pkgEditingActive, setPkgEditingActive] = useState(true);
  const [pkgUpdating, setPkgUpdating] = useState(false);
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



  useEffect(() => {
    loadServices();
  }, []);

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
        // Flatten the treatment structure from the API response
        const flattenedTreatments = [];
        const clinicTreatments = res.data.clinic?.treatments || [];
        
        clinicTreatments.forEach(mainTreatment => {
          // Add main treatment if it has sub-treatments or if we want to show main treatments too
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
            // Add main treatment if it has no sub-treatments
            flattenedTreatments.push({
              name: mainTreatment.mainTreatment,
              slug: mainTreatment.mainTreatmentSlug,
              mainTreatment: null,
              type: "main"
            });
          }
        });
        
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
      return prev.filter((t) => t.treatmentSlug !== treatmentSlug);
    });
  };

  const handleSessionChange = (slug, sessions) => {
    setSelectedTreatments((prev) =>
      prev.map((t) => (t.treatmentSlug === slug ? { ...t, sessions: parseInt(sessions) || 1 } : t))
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
    if (!pkgPrice || parseFloat(pkgPrice) < 0) {
      setMessage({ type: "error", text: "Please enter a valid price" });
      return;
    }
    if (selectedTreatments.length === 0) {
      setMessage({ type: "error", text: "Please select at least one treatment" });
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
    // Editing is restricted: only name can be changed
    const headers = getAuthHeaders();
    if (!headers) return;

    setPkgUpdating(true);
    try {
      const res = await axios.put(
        "/api/clinic/packages",
        {
          packageId: pkgEditingId,
          name: pkgEditingName.trim(),
        },
        { headers }
      );
      if (res.data.success) {
        const successMsg = res.data.message || "Package updated successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        setPkgEditingId(null);
        setPkgEditingName("");
        setPkgEditingPrice("");
        setSelectedTreatments([]);
        setTreatmentDropdownOpen(false); // Close dropdown
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

  const handleDeletePackage = async (packageId) => {
    const headers = getAuthHeaders();
    if (!headers) {
      setMessage({ type: "error", text: "Authentication required. Please log in again." });
      return;
    }
    try {
      const res = await axios.delete(`/api/clinic/packages?packageId=${packageId}`, {
        headers,
      });
      if (res.data.success) {
        const successMsg = res.data.message || "Package deleted successfully";
        setMessage({ type: "success", text: successMsg });
        toast.success(successMsg, { duration: 3000 });
        await loadPackages();
      } else {
        const errorMsg = res.data.message || "Failed to delete package";
        setMessage({ type: "error", text: errorMsg });
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (error) {
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



  return (
    <>
      <Toaster position="top-right" />
      <div className="p-4 space-y-4">
        <div className="flex border-b border-gray-200 mb-2">
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "services"
                ? "border-gray-800 text-teal-900"
                : "border-transparent text-teal-500 hover:text-teal-700"
            }`}
          >
            Services
          </button>
        
          <button
            onClick={() => setActiveTab("memberships")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "memberships"
                ? "border-gray-800 text-teal-900"
                : "border-transparent text-teal-500 hover:text-teal-700"
            }`}
          >
            Memberships
          </button>
          <button
            onClick={() => setActiveTab("packages")}
            className={`px-4 py-2 text-sm font-medium border-b-2 ${
              activeTab === "packages"
                ? "border-gray-800 text-teal-900"
                : "border-transparent text-teal-500 hover:text-teal-700"
            }`}
          >
            Packages
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

        {activeTab === "services" && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <h2 className="text-teal-900 font-semibold text-sm">Create Service</h2>
              <form onSubmit={handleCreate} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Service Name"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Price"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="5"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    placeholder="Duration (minutes)"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-3 py-2 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 disabled:opacity-60"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create"}
                </button>
              </form>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
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
                    <div key={s._id} className="p-3 border border-gray-200 rounded-lg flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {editingId === s._id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                placeholder="Service Name"
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
                                autoFocus
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                placeholder="Price"
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="5"
                                value={editingDuration}
                                onChange={(e) => setEditingDuration(e.target.value)}
                                placeholder="Duration (minutes)"
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
                              />
                              <select
                                value={editingActive ? "active" : "inactive"}
                                onChange={(e) => setEditingActive(e.target.value === "active")}
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
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
        )}
        {activeTab === "memberships" && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <h2 className="text-teal-900 font-semibold text-sm">Create Membership</h2>
              <form onSubmit={handleCreateMembership} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={memName}
                    onChange={(e) => setMemName(e.target.value)}
                    placeholder="Name"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={memPrice}
                    onChange={(e) => setMemPrice(e.target.value)}
                    placeholder="Price"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="1"
                    value={memDurationMonths}
                    onChange={(e) => setMemDurationMonths(e.target.value)}
                    placeholder="Duration (months)"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="number"
                    min="0"
                    value={memFreeConsultations}
                    onChange={(e) => setMemFreeConsultations(e.target.value)}
                    placeholder="Free Consultations (0 = unlimited)"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={memDiscountPercentage}
                    onChange={(e) => setMemDiscountPercentage(e.target.value)}
                    placeholder="Discount %"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
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
                  className="px-3 py-2 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 disabled:opacity-60"
                >
                  {memSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create"}
                </button>
              </form>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-4">
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
                    <div key={m._id} className="p-3 border border-gray-200 rounded-lg flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {memEditingId === m._id ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                              <input
                                type="text"
                                value={memEditingName}
                                onChange={(e) => setMemEditingName(e.target.value)}
                                placeholder="Name"
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
                                autoFocus
                              />
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={memEditingPrice}
                                onChange={(e) => setMemEditingPrice(e.target.value)}
                                placeholder="Price"
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="1"
                                value={memEditingDurationMonths}
                                onChange={(e) => setMemEditingDurationMonths(e.target.value)}
                                placeholder="Duration (months)"
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="0"
                                value={memEditingFreeConsultations}
                                onChange={(e) => setMemEditingFreeConsultations(e.target.value)}
                                placeholder="Free Consultations"
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
                              />
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={memEditingDiscountPercentage}
                                onChange={(e) => setMemEditingDiscountPercentage(e.target.value)}
                                placeholder="Discount %"
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
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
                                className="border border-gray-300 rounded px-3 py-2 text-sm"
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
        {activeTab === "packages" && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
              <h2 className="text-teal-900 font-semibold text-sm">Create Package</h2>
              <form onSubmit={handleCreatePackage} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={pkgName}
                    onChange={(e) => setPkgName(e.target.value)}
                    placeholder="Package Name"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={pkgPrice}
                    onChange={(e) => setPkgPrice(e.target.value)}
                    placeholder="Price"
                    className="border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
                
                {/* Treatment Selection */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-teal-700">
                    Select Treatments
                  </label>
                  <div className="relative treatment-dropdown-container">
                    <button
                      type="button"
                      onClick={() => setTreatmentDropdownOpen(!treatmentDropdownOpen)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-300 rounded-lg text-sm text-teal-700 hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    >
                      <span className="text-teal-500">
                        {selectedTreatments.length > 0
                          ? `${selectedTreatments.length} treatment(s) selected`
                          : "Select treatments to add..."}
                      </span>
                      <ChevronDown className={`w-4 h-4 text-teal-400 transition-transform ${treatmentDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {treatmentDropdownOpen && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                        {/* Search Input */}
                        <div className="p-2 border-b border-gray-200 sticky top-0 bg-white">
                          <input
                            type="text"
                            placeholder="Search treatments..."
                            value={treatmentSearchQuery}
                            onChange={(e) => setTreatmentSearchQuery(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            autoFocus
                          />
                        </div>
                        
                        {/* Treatment List */}
                        <div className="overflow-y-auto max-h-48">
                          {(() => {
                            // Show all treatments when search box is empty
                            if (!treatmentSearchQuery.trim()) {
                              return (
                                <div className="p-2">
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
                                        className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                          isSelected
                                            ? "bg-blue-50 text-blue-700 font-medium"
                                            : "text-teal-700 hover:bg-gray-50"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span>
                                            {treatment.name}
                                            {treatment.type === "sub" && (
                                              <span className="text-xs text-teal-500 ml-1">({treatment.mainTreatment})</span>
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
                            }
                            
                            const filteredTreatments = treatments.filter((treatment) => {
                              const query = treatmentSearchQuery.toLowerCase();
                              const nameMatch = treatment.name.toLowerCase().includes(query);
                              const mainTreatmentMatch = treatment.mainTreatment?.toLowerCase().includes(query);
                              return nameMatch || mainTreatmentMatch;
                            });
                            
                            if (filteredTreatments.length === 0) {
                              return (
                                <div className="p-4 text-center text-sm text-teal-500">
                                  No treatments found matching "{treatmentSearchQuery}"
                                </div>
                              );
                            }
                            
                            return (
                              <div className="p-2">
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
                                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                        isSelected
                                          ? "bg-blue-50 text-blue-700 font-medium"
                                          : "text-teal-700 hover:bg-gray-50"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span>
                                          {treatment.name}
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
                </div>
                
                {/* Selected Treatments with Sessions - Compact Tile Design */}
                {selectedTreatments.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-teal-700 mb-2">
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
                              <span className="text-sm font-medium text-teal-900 block truncate">
                                {selectedTreatment.treatmentName}
                              </span>
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
                    <div className="mt-2 text-xs text-teal-500 text-center">
                      {selectedTreatments.length} treatment(s) selected
                    </div>
                  </div>
                )}
                
                <button
                  type="submit"
                  disabled={pkgSubmitting}
                  className="px-3 py-2 bg-teal-600 text-white text-sm rounded hover:bg-teal-700 disabled:opacity-60"
                >
                  {pkgSubmitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Package"}
                </button>
              </form>
            </div>
            
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <Package className="w-5 h-5 text-teal-700" />
                <h2 className="text-lg sm:text-xl font-bold text-teal-900">All Packages</h2>
                <span className="ml-auto px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">
                  {packages.length} {packages.length === 1 ? 'Package' : 'Packages'}
                </span>
              </div>
              
              {pkgLoading ? (
                <div className="flex items-center justify-center py-12 text-teal-600">
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  <span className="text-sm">Loading packages...</span>
                </div>
              ) : packages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                    <Package className="w-8 h-8 text-teal-400" />
                  </div>
                  <p className="text-sm font-medium text-teal-900 mb-1">No packages created yet</p>
                  <p className="text-xs text-teal-600">Use the form above to create your first package</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {packages.map((pkg) => (
                    <div
                      key={pkg._id}
                      className="border border-gray-200 rounded-lg p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 hover:bg-gray-50 hover:border-gray-300 transition-all group"
                    >
                      <div className="flex-1 min-w-0">
                        {pkgEditingId === pkg._id ? (
                          <div className="space-y-3">
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <input
                                type="text"
                                value={pkgEditingName}
                                onChange={(e) => setPkgEditingName(e.target.value)}
                                placeholder="Package Name"
                                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                autoFocus
                              />
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={pkgEditingPrice}
                                onChange={() => {}}
                                placeholder="Total Price"
                                disabled
                                className="w-full sm:w-32 bg-gray-100 border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-not-allowed"
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              <button
                                onClick={handleUpdatePackage}
                                disabled={pkgUpdating}
                                className="flex-1 sm:flex-none px-3 py-2 bg-teal-600 text-white text-sm rounded-lg hover:bg-teal-700 disabled:opacity-60 transition-colors"
                              >
                                {pkgUpdating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Save"}
                              </button>
                              <button
                                onClick={() => {
                                  setPkgEditingId(null);
                                  setPkgEditingName("");
                                  setPkgEditingPrice("");
                                  setSelectedTreatments([]);
                                }}
                                className="flex-1 sm:flex-none px-3 py-2 bg-gray-100 text-teal-700 text-sm rounded-lg hover:bg-gray-200 transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center">
                              <Package className="w-5 h-5 text-teal-600" />
                            </div>
                            <div>
                              <h3 className="text-sm font-semibold text-teal-900">{pkg.name}</h3>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="text-xs text-teal-500 font-medium">
                                  Price: ${parseFloat(pkg.totalPrice).toFixed(2)}
                                </span>
                                {pkg.treatments && pkg.treatments.length > 0 && (
                                  <>
                                    <span className="text-xs text-teal-400">•</span>
                                    <span className="text-xs text-teal-500">
                                      {pkg.treatments.length} treatment(s)
                                    </span>
                                  </>
                                )}
                                <span className="text-xs text-teal-400">•</span>
                                <Calendar className="w-3 h-3 text-teal-400" />
                                <span className="text-xs text-teal-500">
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
                                    <span className="text-xs px-2 py-0.5 bg-gray-100 text-teal-600 rounded">
                                      +{pkg.treatments.length - 3} more
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {pkgEditingId !== pkg._id && (
                          <>
                            <button
                              onClick={() => {
                                setPkgEditingId(pkg._id);
                                setPkgEditingName(pkg.name);
                                setPkgEditingPrice((pkg.totalPrice ?? pkg.price).toString());
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
                              className="p-2 text-teal-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Edit package"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeletePackage(pkg._id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete package"
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

"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import { Toaster, toast } from "react-hot-toast";
import { Loader2, Edit2, Trash2, CheckCircle, AlertCircle, Package, ChevronDown, X, Calendar, Search, User, Users, Plus, Save, Stethoscope, Percent, Clock, Star, Wrench } from "lucide-react";

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
  const [memFilter, setMemFilter] = useState('all'); // all, active, expired, priority, upcoming-expiry

  // Packages state
  const [packages, setPackages] = useState([]);
  const [pkgLoading, setPkgLoading] = useState(true);
  const [pkgSubmitting, setPkgSubmitting] = useState(false);
  const [pkgName, setPkgName] = useState("");
  const [pkgPrice, setPkgPrice] = useState("");
  const [treatments, setTreatments] = useState([]);
  const [selectedTreatments, setSelectedTreatments] = useState([]); // Array of { treatmentName, treatmentSlug, sessions, allocatedPrice }
  const [treatmentDropdownOpen, setTreatmentDropdownOpen] = useState(false);
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState("");
  const [pkgEditingId, setPkgEditingId] = useState(null);
  const [pkgEditingName, setPkgEditingName] = useState("");
  const [pkgEditingPrice, setPkgEditingPrice] = useState("");
  const [pkgEditingActive, setPkgEditingActive] = useState(true);
  const [pkgUpdating, setPkgUpdating] = useState(false);
  const [pkgEditModalOpen, setPkgEditModalOpen] = useState(false);
  const [pkgEditTreatments, setPkgEditTreatments] = useState([]);
  const [pkgEditTreatmentDropdownOpen, setPkgEditTreatmentDropdownOpen] = useState(false);
  const [pkgEditTreatmentSearchQuery, setPkgEditTreatmentSearchQuery] = useState("");
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
    
    // Validate allocated prices
    const totalAllocated = selectedTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0);
    const packagePrice = parseFloat(pkgPrice);
    if (Math.abs(totalAllocated - packagePrice) > 0.01) {
      setMessage({ 
        type: "error", 
        text: `Total allocated prices ($${totalAllocated.toFixed(2)}) must equal the package price ($${packagePrice.toFixed(2)})` 
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
        text: `Total allocated prices ($${totalAllocated.toFixed(2)}) must equal the package price ($${packagePrice.toFixed(2)})` 
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
      <div className="p-4 space-y-4 w-full lg:w-[95%] xl:w-[90%] mx-auto">
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
                  ? "bg-[#2D9AA5]/5 text-[#2D9AA5] border-[#2D9AA5]/20"
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
            {/* Service Creation Form - Modern Healthcare UI */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4 mb-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shadow-sm">
                  <Wrench className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-teal-800 tracking-tight">Create New Service</h2>
                  <p className="text-xs text-teal-600">Add a new service offering for your clinic</p>
                </div>
              </div>
              
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-teal-700 mb-1.5">
                      Service Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Dental Cleaning"
                      className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-teal-700 mb-1.5">
                      Price (AED)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500 font-medium text-sm">د.إ</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-teal-200 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                        required
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-teal-700 mb-1.5">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      min="5"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(e.target.value)}
                      placeholder="30"
                      className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-xs font-medium rounded-lg hover:from-teal-700 hover:to-cyan-700 disabled:opacity-60 transition-all shadow-sm flex items-center gap-1.5"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3" />
                        Create Service
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
            
            {/* Service Display Section - Modern Healthcare UI */}
            <div className="bg-white border border-teal-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <Wrench className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-teal-800 tracking-tight">Service Catalog</h2>
                    <p className="text-xs text-teal-600">Manage your clinic's service offerings</p>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-lg border border-teal-200">
                  <span className="text-xs font-bold text-teal-700">
                    {services.length} {services.length === 1 ? 'Service' : 'Services'}
                  </span>
                </div>
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex items-center gap-2 text-teal-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium">Loading services...</span>
                  </div>
                </div>
              ) : services.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto bg-teal-100 rounded-full flex items-center justify-center mb-3">
                    <Wrench className="w-6 h-6 text-teal-400" />
                  </div>
                  <h3 className="text-base font-medium text-gray-900 mb-1">No services created yet</h3>
                  <p className="text-xs text-gray-600">Create your first service to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {services.map((s) => {
                    const statusColor = s.isActive ? 'bg-[#2D9AA5]/10 text-[#2D9AA5]' : 'bg-gray-100 text-gray-800';
                    const statusText = s.isActive ? 'Active' : 'Inactive';
                    
                    return (
                      <div
                        key={s._id}
                        className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${
                          s.isActive ? 'border-[#2D9AA5]/20 shadow-sm' : 'border-gray-200 shadow-sm'
                        }`}
                        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                      >
                        {/* Service Header */}
                        <div className={`px-4 py-3 ${
                          s.isActive ? 'bg-gradient-to-r from-[#2D9AA5]/5 to-[#2D9AA5]/10' : 'bg-gradient-to-r from-gray-50 to-slate-50'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h3 className="text-sm font-bold text-gray-900 mb-1 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>{s.name}</h3>
                              <div className="flex items-center gap-1.5">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColor} shadow-xs`}>
                                  {statusText}
                                </span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-semibold text-teal-700 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>د.إ{Number(s.price || 0).toFixed(2)}</div>
                              <div className="text-[10px] text-gray-600">{s.durationMinutes} min</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Service Details */}
                        <div className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1.5 bg-teal-100 rounded-md">
                                  <Package className="w-3.5 h-3.5 text-teal-600" />
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">Price</span>
                              </div>
                              <span className="text-xs font-medium text-gray-900">د.إ{Number(s.price || 0).toFixed(2)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1.5 bg-teal-100 rounded-md">
                                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">Duration</span>
                              </div>
                              <span className="text-xs font-medium text-gray-900">{s.durationMinutes} min</span>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1.5 bg-teal-100 rounded-md">
                                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">Created</span>
                              </div>
                              <span className="text-xs font-medium text-gray-900">{new Date(s.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          
                          {/* Action Buttons - EDIT FUNCTIONALITY FULLY PRESERVED */}
                          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-100">
                            {editingId !== s._id ? (
                              <>
                                <button
                                  onClick={() => {
                                    setEditingId(s._id);
                                    setEditingName(s.name || "");
                                    setEditingPrice(String(s.price ?? ""));
                                    setEditingDuration(String(s.durationMinutes ?? ""));
                                    setEditingActive(Boolean(s.isActive));
                                  }}
                                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-teal-100 text-teal-700 text-xs font-medium rounded-md hover:bg-teal-200 transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDelete(s._id)}
                                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-md hover:bg-red-200 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <div className="space-y-3 p-3 bg-teal-50 rounded-lg border border-teal-200">
                                <h3 className="text-xs font-semibold text-teal-800 mb-2">Edit Service</h3>
                                
                                <div className="space-y-2">
                                  <div>
                                    <label className="block text-[10px] font-medium text-teal-700 mb-1">
                                      Name
                                    </label>
                                    <input
                                      type="text"
                                      value={editingName}
                                      onChange={(e) => setEditingName(e.target.value)}
                                      className="w-full border border-teal-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                      autoFocus
                                    />
                                  </div>
                                  
                                  <div>
                                    <label className="block text-[10px] font-medium text-teal-700 mb-1">
                                      Price (AED)
                                    </label>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-teal-500 font-medium text-xs">د.إ</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={editingPrice}
                                        onChange={(e) => setEditingPrice(e.target.value)}
                                        className="w-full border border-teal-200 rounded-lg pl-6 pr-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                      />
                                    </div>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-[10px] font-medium text-teal-700 mb-1">
                                      Duration (min)
                                    </label>
                                    <input
                                      type="number"
                                      min="5"
                                      value={editingDuration}
                                      onChange={(e) => setEditingDuration(e.target.value)}
                                      className="w-full border border-teal-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                    />
                                  </div>
                                  
                                  <div className="flex items-center justify-between pt-2">
                                    <span className="text-[10px] font-medium text-teal-700">Status:</span>
                                    <select
                                      value={editingActive ? "active" : "inactive"}
                                      onChange={(e) => setEditingActive(e.target.value === "active")}
                                      className="border border-teal-200 rounded-lg px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 dark:bg-white dark:text-gray-900"
                                      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                    >
                                      <option value="active">Active</option>
                                      <option value="inactive">Inactive</option>
                                    </select>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 pt-3">
                                  <button
                                    onClick={handleUpdate}
                                    disabled={updating}
                                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-md hover:bg-teal-700 disabled:opacity-60 transition-colors"
                                  >
                                    {updating ? (
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
                                      setEditingId(null);
                                      setEditingName("");
                                      setEditingPrice("");
                                      setEditingDuration("");
                                      setEditingActive(true);
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
                  })}
                </div>
              )}
            </div>
          </>
        )}
               {activeTab === "memberships" && (
          <>
            {/* Membership Creation Form - Compact Healthcare UI */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-4 mb-5 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center shadow-sm">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-teal-800 tracking-tight">Create New Membership</h2>
                  <p className="text-xs text-teal-600">Set up membership plans for your patients</p>
                </div>
              </div>
              <form onSubmit={handleCreateMembership} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-teal-700 mb-1.5">
                      Membership Name
                    </label>
                    <input
                      type="text"
                      value={memName}
                      onChange={(e) => setMemName(e.target.value)}
                      placeholder="e.g., Premium Annual Plan"
                      className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-700 mb-1.5">
                      Price (AED)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-teal-500 font-medium text-sm">د.إ</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={memPrice}
                        onChange={(e) => setMemPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full border border-teal-200 rounded-lg pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-700 mb-1.5">
                      Duration (Months)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={memDurationMonths}
                      onChange={(e) => setMemDurationMonths(e.target.value)}
                      placeholder="12"
                      className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                      required
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-teal-700 mb-1.5">
                      Free Consultations
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={memFreeConsultations}
                      onChange={(e) => setMemFreeConsultations(e.target.value)}
                      placeholder="0 (0 = unlimited)"
                      className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-teal-700 mb-1.5">
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
                        className="w-full border border-teal-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-teal-500 font-medium text-sm">%</span>
                    </div>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-xs font-medium text-teal-700 cursor-pointer">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={memPriorityBooking}
                          onChange={(e) => setMemPriorityBooking(e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-9 h-5 rounded-full transition-colors ${memPriorityBooking ? 'bg-teal-600' : 'bg-gray-300'}`}>
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
                    className="px-4 py-2 bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-xs font-medium rounded-lg hover:from-teal-700 hover:to-cyan-700 disabled:opacity-60 transition-all shadow-sm flex items-center gap-1.5"
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

            {/* Membership Display Section - Compact Healthcare UI */}
            <div className="bg-white border border-teal-200 rounded-xl p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                    <Users className="w-4 h-4 text-teal-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-teal-800 tracking-tight">Membership Plans</h2>
                    <p className="text-xs text-teal-600">Manage your clinic's membership offerings</p>
                  </div>
                </div>
                
                {/* Filter Controls */}
                <div className="flex flex-wrap gap-2">
                  <select
                    value={memFilter}
                    onChange={(e) => setMemFilter(e.target.value)}
                    className="px-3 py-1.5 text-xs font-medium bg-white border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-700 dark:bg-white dark:text-gray-900"
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
                  <div className="flex items-center gap-2 text-teal-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-xs font-medium">Loading memberships...</span>
                  </div>
                </div>
              ) : memberships.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto bg-teal-100 rounded-full flex items-center justify-center mb-3">
                    <Users className="w-6 h-6 text-teal-400" />
                  </div>
                  <h3 className="text-base font-medium text-gray-900 mb-1">No memberships created yet</h3>
                  <p className="text-xs text-gray-600">Create your first membership plan to get started</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(() => {
                    // Filter memberships based on selected filter
                    const filteredMemberships = memberships.filter(m => {
                      const isExpired = isMembershipExpired(m);
                      const isActive = m.isActive && !isExpired;
                      
                      switch(memFilter) {
                        case 'active':
                          return isActive;
                        case 'expired':
                          return isExpired;
                        case 'priority':
                          return m.benefits?.priorityBooking === true;
                        case 'expiring-soon':
                          // Show memberships that will expire soon (within 30 days)
                          if (!isActive) return false; // Only consider active memberships
                          const expirationDate = new Date(m.createdAt);
                          expirationDate.setMonth(expirationDate.getMonth() + m.durationMonths);
                          const today = new Date();
                          const daysUntilExpiry = Math.ceil((expirationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                          return daysUntilExpiry <= 30 && daysUntilExpiry >= 0;
                        case 'expiring-1-month':
                          // Show memberships expiring within 1 month
                          if (!isActive) return false; // Only consider active memberships
                          const expDate1 = new Date(m.createdAt);
                          expDate1.setMonth(expDate1.getMonth() + m.durationMonths);
                          const today1 = new Date();
                          const daysUntilExpiry1 = Math.ceil((expDate1.getTime() - today1.getTime()) / (1000 * 60 * 60 * 24));
                          return daysUntilExpiry1 <= 30 && daysUntilExpiry1 >= 0;
                        case 'expiring-2-months':
                          // Show memberships expiring within 2 months
                          if (!isActive) return false; // Only consider active memberships
                          const expDate2 = new Date(m.createdAt);
                          expDate2.setMonth(expDate2.getMonth() + m.durationMonths);
                          const today2 = new Date();
                          const daysUntilExpiry2 = Math.ceil((expDate2.getTime() - today2.getTime()) / (1000 * 60 * 60 * 24));
                          return daysUntilExpiry2 <= 60 && daysUntilExpiry2 >= 0;
                        case 'expiring-3-months':
                          // Show memberships expiring within 3 months
                          if (!isActive) return false; // Only consider active memberships
                          const expDate3 = new Date(m.createdAt);
                          expDate3.setMonth(expDate3.getMonth() + m.durationMonths);
                          const today3 = new Date();
                          const daysUntilExpiry3 = Math.ceil((expDate3.getTime() - today3.getTime()) / (1000 * 60 * 60 * 24));
                          return daysUntilExpiry3 <= 90 && daysUntilExpiry3 >= 0;
                        case 'recent':
                          // Show recently created memberships (last 7 days)
                          const createdDate = new Date(m.createdAt);
                          const daysSinceCreation = Math.ceil((new Date().getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
                          return daysSinceCreation <= 7;
                        default: // 'all'
                          return true;
                      }
                    });
                    
                    if (filteredMemberships.length === 0) {
                      return (
                        <div key="no-results" className="col-span-full text-center py-8">
                          <div className="w-12 h-12 mx-auto bg-[#2D9AA5]/10 rounded-full flex items-center justify-center mb-3">
                            <Users className="w-6 h-6 text-[#2D9AA5]/60" />
                          </div>
                          <h3 className="text-base font-medium text-gray-900 mb-1">No memberships found</h3>
                          <p className="text-xs text-gray-600">Try changing your filter criteria</p>
                        </div>
                      );
                    }
                    return filteredMemberships.map((m) => {
                    const isExpired = isMembershipExpired(m);
                    const isActive = m.isActive && !isExpired;
                    const statusColor = isActive ? 'bg-[#2D9AA5]/10 text-[#2D9AA5]' : isExpired ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800';
                    const statusText = isActive ? 'Active' : isExpired ? 'Expired' : 'Inactive';
                    
                    return (
                      <div
                        key={m._id}
                        className={`bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md ${
                          isActive ? 'border-[#2D9AA5]/20 shadow-sm' :
                          isExpired ? 'border-red-200 bg-red-50 shadow-sm' : 'border-gray-200 shadow-sm'
                        }`}
                        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                      >
                        {/* Membership Header */}
                        <div className={`px-4 py-3 ${
                          isActive ? 'bg-gradient-to-r from-teal-50 to-cyan-50' :
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
                              <div className="text-lg font-semibold text-teal-700 tracking-tight" style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}>د.إ{Number(m.price || 0).toFixed(2)}</div>
                              <div className="text-[10px] text-gray-600">{m.durationMonths} months</div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Membership Benefits */}
                        <div className="p-3">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1.5 bg-teal-100 rounded-md">
                                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">Duration</span>
                              </div>
                              <span className="text-xs font-medium text-gray-900">{m.durationMonths} months</span>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1.5 bg-teal-100 rounded-md">
                                  <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">Free Consultations</span>
                              </div>
                              <span className="text-xs font-medium text-gray-900">
                                {m.benefits?.freeConsultations === 0 ? 'Unlim' : m.benefits?.freeConsultations || 0}
                              </span>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1.5 bg-teal-100 rounded-md">
                                  <Percent className="w-3.5 h-3.5 text-teal-600" />
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">Discount</span>
                              </div>
                              <span className="text-xs font-medium text-gray-900">{m.benefits?.discountPercentage || 0}%</span>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-1.5">
                                <div className="p-1.5 bg-teal-100 rounded-md">
                                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                                </div>
                                <span className="text-[10px] text-gray-600 font-medium">Priority</span>
                              </div>
                              <span className={`text-xs font-medium ${m.benefits?.priorityBooking ? 'text-teal-600' : 'text-gray-400'}`}>
                                {m.benefits?.priorityBooking ? 'Yes' : 'No'}
                              </span>
                            </div>
                          </div>
                          
                          {/* Action Buttons - EDIT FUNCTIONALITY FULLY PRESERVED */}
                          <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-gray-100">
                            {memEditingId !== m._id ? (
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
                                  className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-[#2D9AA5]/10 text-[#2D9AA5] text-xs font-medium rounded-md hover:bg-[#2D9AA5]/20 transition-colors"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteMembership(m._id)}
                                  className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-md hover:bg-red-200 transition-colors"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </>
                            ) : (
                              <div className="space-y-3 p-3 bg-[#2D9AA5]/5 rounded-lg border border-[#2D9AA5]/20">
                                <h3 className="text-xs font-semibold text-[#2D9AA5] mb-2">Edit Membership</h3>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-medium text-teal-700 mb-1">
                                      Name
                                    </label>
                                    <input
                                      type="text"
                                      value={memEditingName}
                                      onChange={(e) => setMemEditingName(e.target.value)}
                                      className="w-full border border-teal-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-teal-700 mb-1">
                                      Price (AED)
                                    </label>
                                    <div className="relative">
                                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[#2D9AA5]/70 font-medium text-xs">د.إ</span>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={memEditingPrice}
                                        onChange={(e) => setMemEditingPrice(e.target.value)}
                                        className="w-full border border-teal-200 rounded-lg pl-6 pr-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                        style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                      />
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                  <div>
                                    <label className="block text-[10px] font-medium text-teal-700 mb-1">
                                      Duration (Months)
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={memEditingDurationMonths}
                                      onChange={(e) => setMemEditingDurationMonths(e.target.value)}
                                      className="w-full border border-teal-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-teal-700 mb-1">
                                      Free Cons
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      value={memEditingFreeConsultations}
                                      onChange={(e) => setMemEditingFreeConsultations(e.target.value)}
                                      className="w-full border border-teal-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[10px] font-medium text-teal-700 mb-1">
                                      Discount %
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="100"
                                      step="0.1"
                                      value={memEditingDiscountPercentage}
                                      onChange={(e) => setMemEditingDiscountPercentage(e.target.value)}
                                      className="w-full border border-teal-200 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 hover:border-teal-300 transition-all shadow-xs dark:bg-white dark:text-gray-900"
                                      style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif' }}
                                    />
                                  </div>
                                </div>
                                
                                <div className="flex items-center justify-between pt-2">
                                  <label className="flex items-center gap-2 text-[10px] font-medium text-teal-700">
                                    <input
                                      type="checkbox"
                                      checked={memEditingPriorityBooking}
                                      onChange={(e) => setMemEditingPriorityBooking(e.target.checked)}
                                      className="w-3 h-3 text-teal-600 rounded focus:ring-teal-500"
                                    />
                                    Priority
                                  </label>
                                  
                                  <div className="flex items-center gap-2">
                                    <select
                                      value={memEditingActive ? "active" : "inactive"}
                                      onChange={(e) => setMemEditingActive(e.target.value === "active")}
                                      className="border border-teal-200 rounded-lg px-1.5 py-1 text-[10px] focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white text-gray-900 dark:bg-white dark:text-gray-900"
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
                                    className="flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 bg-teal-600 text-white text-xs font-medium rounded-md hover:bg-teal-700 disabled:opacity-60 transition-colors"
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
          </>
        )}
        {activeTab === "packages" && (
          <>
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 border border-teal-200 rounded-xl p-5 mb-6 shadow-sm">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center shadow-md">
                  <Package className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-teal-800">Create New Package</h2>
                  <p className="text-xs text-teal-600">Define package details and allocate treatments</p>
                </div>
              </div>
              
              <form onSubmit={handleCreatePackage} className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-teal-700 mb-1.5">Package Name</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={pkgName}
                          onChange={(e) => setPkgName(e.target.value)}
                          placeholder="Enter package name"
                          className="w-full px-3 py-2.5 text-sm border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400 shadow-sm transition-all"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-semibold text-teal-700 mb-1.5">Total Package Price</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 font-bold text-base">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pkgPrice}
                          onChange={(e) => setPkgPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full pl-8 pr-3 py-2.5 text-sm border border-teal-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400 shadow-sm transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Treatment Selection Card */}
                  <div className="bg-white border border-teal-200 rounded-lg p-4 shadow-sm">
                    <div className="mb-3">
                      <h3 className="font-semibold text-teal-700 mb-1">Select Treatments</h3>
                      <p className="text-xs text-teal-600">Choose treatments to include in this package</p>
                    </div>
                    
                    <div className="relative treatment-dropdown-container">
                      <button
                        type="button"
                        onClick={() => setTreatmentDropdownOpen(!treatmentDropdownOpen)}
                        className="w-full flex items-center justify-between px-3 py-2.5 bg-teal-50 border border-teal-200 rounded-md text-sm text-slate-700 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-white dark:border-slate-600 dark:text-slate-900 transition-all"
                      >
                        <span className="text-teal-700 font-medium dark:text-slate-900">
                          {selectedTreatments.length > 0
                            ? `${selectedTreatments.length} treatment(s) selected`
                            : "Select treatments to add..."}
                        </span>
                        <ChevronDown className={`w-4 h-4 text-teal-500 transition-transform ${treatmentDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      
                      {treatmentDropdownOpen && (
                        <div className="absolute z-20 w-full mt-1.5 bg-white border border-teal-200 rounded-lg shadow-lg max-h-60 overflow-hidden flex flex-col">
                          {/* Search Input */}
                          <div className="p-2 border-b border-teal-100 sticky top-0 bg-white">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-teal-400" />
                              <input
                                type="text"
                                placeholder="Search treatments..."
                                value={treatmentSearchQuery}
                                onChange={(e) => setTreatmentSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-teal-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
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
                                          className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-all ${
                                            isSelected
                                              ? "bg-teal-50 text-teal-800 font-medium border border-teal-200"
                                              : "text-teal-700 hover:bg-teal-50 border border-transparent"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span>
                                              {treatment.name}
                                              {treatment.type === "sub" && (
                                                <span className="text-[10px] text-teal-500 ml-1">({treatment.mainTreatment})</span>
                                              )}
                                            </span>
                                            {isSelected && (
                                              <span className="text-teal-600 text-xs">✓</span>
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
                                  <div className="p-3 text-center text-xs text-teal-500">
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
                                        className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-all ${
                                          isSelected
                                            ? "bg-blue-50 text-slate-800 font-medium border border-slate-200"
                                            : "text-slate-700 hover:bg-blue-50 border border-transparent"
                                        }`}
                                      >
                                        <div className="flex items-center justify-between">
                                          <span>
                                            {treatment.name}
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
                      <h3 className="font-semibold text-teal-700 text-sm">Selected Treatments</h3>
                      <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
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
                            className="bg-white border border-teal-200 rounded-lg p-3 shadow-sm transition-all"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-teal-700 text-xs">
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
                                <label className="block text-[10px] text-teal-600 font-medium">Price</label>
                                <div className="relative">
                                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-teal-500 text-xs">$</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={selectedTreatment.allocatedPrice || ""}
                                    onChange={(e) => handleAllocatedPriceChange(selectedTreatment.treatmentSlug, e.target.value)}
                                    className="w-full pl-5 pr-1.5 py-1.5 text-xs font-medium border border-teal-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-teal-50 dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                    placeholder="0.00"
                                  />
                                </div>
                              </div>
                              
                              <div className="space-y-0.5">
                                <label className="block text-[10px] text-teal-600 font-medium">Sess</label>
                                <input
                                  type="number"
                                  min="1"
                                  value={selectedTreatment.sessions || 1}
                                  onChange={(e) => {
                                    const value = parseInt(e.target.value) || 1;
                                    handleSessionChange(selectedTreatment.treatmentSlug, value);
                                  }}
                                  className="w-full px-1.5 py-1.5 text-xs font-medium text-center border border-teal-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-teal-50 dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                  placeholder="1"
                                />
                              </div>
                              
                              <div className="space-y-0.5">
                                <label className="block text-[10px] text-teal-600 font-medium">/Sess</label>
                                <div className="px-1.5 py-1.5 text-xs font-bold text-center bg-teal-100 rounded-md text-teal-700 border border-teal-200 dark:bg-white dark:border-slate-600 dark:text-slate-900">
                                  ${sessionPrice.toFixed(2)}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Price Validation Summary Card */}
                    <div className="bg-gradient-to-r from-teal-50 to-cyan-50 border border-teal-200 rounded-lg p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div className="text-center p-2 bg-white rounded-md border border-teal-200">
                          <p className="text-[10px] text-teal-600 font-medium">Package Price</p>
                          <p className="font-bold text-sm text-teal-700">${parseFloat(pkgPrice) || 0}</p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-md border border-teal-200">
                          <p className="text-[10px] text-teal-600 font-medium">Allocated Total</p>
                          <p className="font-bold text-sm text-teal-700">
                            ${selectedTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0).toFixed(2)}
                          </p>
                        </div>
                        <div className="text-center p-2 bg-white rounded-md border border-teal-200">
                          <p className="text-[10px] text-teal-600 font-medium">Remaining</p>
                          <p className={`font-bold text-sm ${Math.abs((parseFloat(pkgPrice) || 0) - selectedTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0)) < 0.01 ? 'text-teal-600' : 'text-amber-600'}`}>
                            ${((parseFloat(pkgPrice) || 0) - selectedTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0)).toFixed(2)}
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
                    className="w-full py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-semibold rounded-lg hover:from-teal-700 hover:to-cyan-700 disabled:opacity-60 transition-all shadow-md text-sm"
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
            
            <div className="mt-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center shadow-md">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-teal-800">All Packages</h2>
                    <p className="text-xs text-teal-600">Manage your existing packages</p>
                  </div>
                </div>
                <div className="px-3 py-1.5 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-lg border border-teal-200">
                  <span className="text-xs font-bold text-teal-700">
                    {packages.length} {packages.length === 1 ? 'Package' : 'Packages'}
                  </span>
                </div>
              </div>
              
              {pkgLoading ? (
                <div className="flex items-center justify-center py-12 text-teal-600">
                  <div className="text-center">
                    <Loader2 className="w-6 h-6 mr-2 animate-spin mx-auto mb-2" />
                    <span className="text-sm font-medium">Loading packages...</span>
                  </div>
                </div>
              ) : packages.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-teal-100 flex items-center justify-center">
                    <Package className="w-8 h-8 text-teal-600" />
                  </div>
                  <p className="text-base font-semibold text-gray-900 mb-1">No packages created yet</p>
                  <p className="text-sm text-gray-600 mb-4">Get started by creating your first package using the form above</p>
                  <div className="inline-block px-3 py-1.5 bg-gradient-to-r from-teal-100 to-cyan-100 rounded-lg">
                    <span className="text-xs text-teal-700 font-medium">Start building your service packages today!</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {packages.map((pkg) => (
                    <div
                      key={pkg._id}
                      className="bg-white border border-teal-200 rounded-xl p-3 shadow-sm hover:shadow-md hover:border-teal-300 transition-all duration-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center flex-shrink-0">
                            <Package className="w-5 h-5 text-white" />
                          </div>
                          <h3 className="text-sm font-bold text-teal-800 truncate flex-1">{pkg.name}</h3>
                        </div>
                        <div className="flex gap-1 ml-2 flex-shrink-0">
                          <button
                            onClick={() => openEditModal(pkg)}
                            className="p-1.5 text-teal-600 hover:bg-teal-100 rounded-md transition-colors"
                            title="Edit package"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeletePackage(pkg._id)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                            title="Delete package"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                                            
                      <div className="space-y-2">
                        {/* Package Stats */}
                        <div className="grid grid-cols-3 gap-1.5">
                          <div className="bg-teal-50 rounded p-2 border border-teal-200">
                            <p className="text-[10px] text-teal-600 font-medium">Total</p>
                            <p className="text-xs font-bold text-teal-700">${parseFloat(pkg.totalPrice).toFixed(2)}</p>
                          </div>
                          <div className="bg-teal-50 rounded p-2 border border-teal-200">
                            <p className="text-[10px] text-teal-600 font-medium">Sessions</p>
                            <p className="text-xs font-bold text-teal-700">{pkg.totalSessions || pkg.treatments.reduce((sum, t) => sum + (t.sessions || 0), 0)}</p>
                          </div>
                          <div className="bg-teal-50 rounded p-2 border border-teal-200">
                            <p className="text-[10px] text-teal-600 font-medium">Avg/Session</p>
                            <p className="text-xs font-bold text-teal-700">
                              ${pkg.sessionPrice ? parseFloat(pkg.sessionPrice).toFixed(2) : (pkg.totalPrice / (pkg.totalSessions || pkg.treatments.reduce((sum, t) => sum + (t.sessions || 0), 0))).toFixed(2)}
                            </p>
                          </div>
                        </div>
                        
                        {/* Treatments */}
                        <div>
                          <p className="text-[10px] text-teal-600 font-medium mb-1">Treatments</p>
                          <div className="space-y-1 max-h-24 overflow-y-auto">
                            {pkg.treatments && pkg.treatments.length > 0 && pkg.treatments.slice(0, 3).map((treatment, idx) => (
                              <div key={idx} className="flex justify-between items-center bg-teal-50 border border-teal-200 rounded p-1.5">
                                <span className="text-xs font-medium text-teal-700 truncate flex-1 mr-1">{treatment.treatmentName || treatment.name}</span>
                                <div className="text-[9px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded">
                                  {treatment.sessions || 1} x ${((treatment.allocatedPrice || 0) / (treatment.sessions || 1)).toFixed(2)}
                                </div>
                              </div>
                            ))}
                            {pkg.treatments && pkg.treatments.length > 3 && (
                              <div className="text-[10px] text-teal-600 font-medium text-center pt-0.5">
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
                        <span className="text-[9px] bg-blue-100 text-slate-800 px-1.5 py-0.5 rounded-full">
                          {pkg.treatments && pkg.treatments.length} T
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Edit Package Modal */}
      {pkgEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-teal-600 flex items-center justify-center shadow-lg">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-teal-800">Edit Package</h2>
                    <p className="text-sm text-teal-600 font-medium">Update package details and treatment allocations</p>
                  </div>
                </div>
                <button
                  onClick={closeEditModal}
                  className="p-2 text-teal-600 hover:text-teal-700 hover:bg-teal-100 rounded-xl transition-all duration-200"
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
                  <label className="block text-sm font-semibold text-teal-700 mb-2">
                    Package Name
                  </label>
                  <input
                    type="text"
                    value={pkgEditingName}
                    onChange={(e) => setPkgEditingName(e.target.value)}
                    placeholder="Enter package name"
                    className="w-full border border-teal-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white hover:border-teal-300 transition-all shadow-sm dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-teal-700 mb-2">
                    Total Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-teal-500 font-bold text-base">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={pkgEditingPrice}
                      onChange={(e) => setPkgEditingPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-teal-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-white hover:border-teal-300 transition-all shadow-sm dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* Treatment Selection Dropdown */}
              <div>
                <label className="block text-sm font-semibold text-[#2D9AA5] mb-2">
                  Select Treatments
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setPkgEditTreatmentDropdownOpen(!pkgEditTreatmentDropdownOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700 hover:bg-teal-100 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-sm"
                  >
                    <span className="text-teal-600 dark:text-teal-700">
                      {pkgEditTreatments.length > 0
                        ? `${pkgEditTreatments.length} treatment(s) selected`
                        : "Select treatments to add..."}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-teal-500 transition-transform ${pkgEditTreatmentDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {pkgEditTreatmentDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-teal-200 rounded-lg shadow-lg">
                      {/* Search */}
                      <div className="p-2 border-b border-teal-100">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-teal-500" />
                          <input
                            type="text"
                            value={pkgEditTreatmentSearchQuery}
                            onChange={(e) => setPkgEditTreatmentSearchQuery(e.target.value)}
                            placeholder="Search treatments..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-teal-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
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
                                      className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                        isSelected
                                          ? "bg-teal-100 text-teal-700 font-medium border border-teal-200"
                                          : "text-teal-700 hover:bg-teal-100"
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
                                          <span className="text-teal-600 text-xs">✓</span>
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
                              <div className="p-4 text-center text-sm text-teal-500">
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
                                    className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                                      isSelected
                                        ? "bg-teal-50 text-teal-700 font-medium"
                                        : "text-teal-700 hover:bg-teal-50"
                                    }`}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span>
                                        {treatment.name}
                                      </span>
                                      {isSelected && (
                                        <span className="text-teal-600 text-xs">✓</span>
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
                    <h3 className="font-semibold text-teal-700 text-sm">Selected Treatments</h3>
                    <span className="px-2.5 py-0.5 bg-teal-100 text-teal-700 rounded-full text-xs font-medium">
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
                          className="bg-white border border-teal-200 rounded-lg p-3 shadow-sm transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <h4 className="font-semibold text-teal-700 text-xs">
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
                              <label className="block text-[10px] text-teal-600 font-medium">Price</label>
                              <div className="relative">
                                <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-teal-500 text-xs">$</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={selectedTreatment.allocatedPrice || ""}
                                  onChange={(e) => handleEditAllocatedPriceChange(selectedTreatment.treatmentSlug, e.target.value)}
                                  className="w-full pl-5 pr-1.5 py-1.5 text-xs font-medium border border-teal-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-teal-50 dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                  placeholder="0.00"
                                />
                              </div>
                            </div>
                            
                            <div className="space-y-0.5">
                              <label className="block text-[10px] text-teal-600 font-medium">Sess</label>
                              <input
                                type="number"
                                min="1"
                                value={selectedTreatment.sessions || 1}
                                onChange={(e) => {
                                  const value = parseInt(e.target.value) || 1;
                                  handleEditSessionChange(selectedTreatment.treatmentSlug, value);
                                }}
                                className="w-full px-1.5 py-1.5 text-xs font-medium text-center border border-teal-200 rounded-md focus:ring-2 focus:ring-teal-500 focus:border-teal-500 bg-teal-50 dark:bg-white dark:border-slate-600 dark:text-slate-900 dark:placeholder-slate-400"
                                placeholder="1"
                              />
                            </div>
                            
                            <div className="space-y-0.5">
                              <label className="block text-[10px] text-teal-600 font-medium">/Sess</label>
                              <div className="px-1.5 py-1.5 text-xs font-bold text-center bg-teal-100 rounded-md text-teal-700 border border-teal-200 dark:bg-white dark:border-slate-600 dark:text-slate-900">
                                ${sessionPrice.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Price Validation Summary */}
                  <div className="mt-3 p-3 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-lg border border-teal-200">
                    <div className="flex justify-between text-sm">
                      <span className="text-teal-700 font-semibold">Package Price:</span>
                      <span className="font-semibold text-teal-700">${parseFloat(pkgEditingPrice) || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm mt-1">
                      <span className="text-teal-700 font-semibold">Allocated Total:</span>
                      <span className="font-semibold text-teal-700">
                        ${pkgEditTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm mt-1 border-t border-gray-200 pt-1">
                      <span className="text-teal-700 font-semibold">Remaining:</span>
                      <span className={`font-semibold ${Math.abs((parseFloat(pkgEditingPrice) || 0) - pkgEditTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0)) < 0.01 ? 'text-teal-600' : 'text-amber-600'}`}>
                        ${((parseFloat(pkgEditingPrice) || 0) - pkgEditTreatments.reduce((sum, t) => sum + (parseFloat(t.allocatedPrice) || 0), 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-teal-200 bg-gradient-to-r from-teal-50 to-cyan-50 flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-5 py-2.5 bg-white border border-teal-300 text-teal-700 text-sm font-medium rounded-xl hover:bg-teal-100 hover:border-teal-400 transition-all duration-200 shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdatePackage}
                disabled={pkgUpdating}
                className="px-5 py-2.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white text-sm font-medium rounded-xl hover:from-teal-700 hover:to-cyan-700 disabled:opacity-60 transition-all shadow-md hover:shadow-lg"
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

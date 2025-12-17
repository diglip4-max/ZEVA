"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { X, Search, ChevronDown, Loader2, AlertCircle, ClipboardList } from "lucide-react";

interface Appointment {
  _id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  patientNumber: string;
  patientEmail: string;
  emrNumber: string;
  gender: string;
  doctorId: string;
  doctorName: string;
  doctorEmail: string;
  roomId: string;
  roomName: string;
  status: string;
  followType: string;
  referral: string;
  startDate: string;
  fromTime: string;
  toTime: string;
}

interface Treatment {
  name: string; 
  slug: string;
  price: number;
  type: "main" | "sub";
  mainTreatment?: string;
  mainTreatmentSlug?: string;
}

interface Package {
  _id: string;
  name: string;
  price: number;
  treatments: Array<{
    treatmentName: string;
    treatmentSlug: string;
    sessions: number;
  }>;
}

interface SelectedTreatment {
  treatmentName: string;
  treatmentSlug: string;
  price: number;
  quantity: number;
  totalPrice: number;
}

interface PackageTreatmentSession {
  treatmentName: string;
  treatmentSlug: string;
  maxSessions: number;
  usedSessions: number;
  isSelected: boolean; // Checkbox to select if patient took this treatment
}

interface AppointmentBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  getAuthHeaders: () => Record<string, string>;
  onSuccess?: () => void;
}

const AppointmentBillingModal: React.FC<AppointmentBillingModalProps> = ({
  isOpen,
  onClose,
  appointment,
  getAuthHeaders,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [selectedService, setSelectedService] = useState<"Treatment" | "Package">("Treatment");
  const [selectedTreatments, setSelectedTreatments] = useState<SelectedTreatment[]>([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [packageTreatmentSessions, setPackageTreatmentSessions] = useState<PackageTreatmentSession[]>([]);
  const [treatmentDropdownOpen, setTreatmentDropdownOpen] = useState(false);
  const [packageDropdownOpen, setPackageDropdownOpen] = useState(false);
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState("");
  const [packageSearchQuery, setPackageSearchQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [totalPrice, setTotalPrice] = useState(0);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [activeTab, setActiveTab] = useState<"billing" | "history">("billing");

  // Form data
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    invoicedDate: new Date().toISOString().split("T")[0],
    firstName: "",
    lastName: "",
    email: "",
    mobileNumber: "",
    gender: "",
    doctor: "",
    service: "Treatment",
    treatment: "",
    package: "",
    patientType: "New",
    referredBy: "",
    amount: "",
    paid: "",
    pending: "0.00",
    advance: "0.00",
    paymentMethod: "Cash",
    insurance: "No",
    advanceGivenAmount: "",
    coPayPercent: "",
    advanceClaimStatus: "Pending",
    insuranceType: "Paid",
    membership: "No",
    membershipStartDate: "",
    membershipEndDate: "",
    notes: "",
    emrNumber: "",
  });

  const treatmentDropdownRef = useRef<HTMLDivElement>(null);
  const packageDropdownRef = useRef<HTMLDivElement>(null);

  // Generate invoice number
  const generateInvoiceNumber = useCallback(() => {
    const date = new Date();
    const seq = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const invoiceNum = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${seq}`;
    setFormData((prev) => ({ ...prev, invoiceNumber: invoiceNum }));
  }, []);

  // Fetch treatments and packages
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      const headers = getAuthHeaders();
      if (!headers.Authorization) return;

      try {
        // Fetch treatments
        const treatmentsRes = await axios.get("/api/clinic/treatments", { headers });
        if (treatmentsRes.data.success) {
          const clinicTreatments = treatmentsRes.data.clinic?.treatments || [];
          const allTreatments: Treatment[] = [];

          clinicTreatments.forEach((tr: any) => {
            // Add sub-treatments only (main treatments don't have prices)
            if (tr.subTreatments && tr.subTreatments.length > 0) {
              tr.subTreatments.forEach((sub: any) => {
                allTreatments.push({
                  name: sub.name,
                  slug: sub.slug,
                  price: sub.price || 0,
                  type: "sub",
                  mainTreatment: tr.mainTreatment,
                  mainTreatmentSlug: tr.mainTreatmentSlug,
                });
              });
            }
          });

          setTreatments(allTreatments);
        }

        // Fetch packages
        const packagesRes = await axios.get("/api/clinic/packages", { headers });
        if (packagesRes.data.success) {
          setPackages(packagesRes.data.packages || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    generateInvoiceNumber();
  }, [isOpen, getAuthHeaders, generateInvoiceNumber]);

  // Fetch billing history for the patient
  useEffect(() => {
    if (!isOpen || !appointment?.patientId) return;

    const fetchBillingHistory = async () => {
      setLoadingHistory(true);
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(`/api/clinic/billing-history/${appointment.patientId}`, { headers });
        if (response.data.success) {
          setBillingHistory(response.data.billings || []);
        }
      } catch (error) {
        console.error("Error fetching billing history:", error);
        setBillingHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchBillingHistory();
  }, [isOpen, appointment?.patientId, getAuthHeaders]);

  // Initialize form data from appointment
  useEffect(() => {
    if (appointment && isOpen) {
      const nameParts = appointment.patientName.split(" ");
      setFormData((prev) => ({
        ...prev,
        firstName: nameParts[0] || "",
        lastName: nameParts.slice(1).join(" ") || "",
        email: appointment.patientEmail || "",
        mobileNumber: appointment.patientNumber || "",
        gender: appointment.gender || "",
        doctor: appointment.doctorName || "",
        emrNumber: appointment.emrNumber || "",
        referredBy: appointment.referral || "",
        patientType: "Old",
      }));
    }
  }, [appointment, isOpen]);

  // Calculate total price
  useEffect(() => {
    if (selectedService === "Treatment") {
      const total = selectedTreatments.reduce((sum, t) => sum + t.totalPrice, 0);
      setTotalPrice(total);
      setFormData((prev) => ({ ...prev, amount: total.toFixed(2) }));
    } else if (selectedPackage) {
      setTotalPrice(selectedPackage.price);
      setFormData((prev) => ({ ...prev, amount: selectedPackage.price.toFixed(2) }));
    }
  }, [selectedTreatments, selectedPackage, selectedService]);

  // Auto-calculate advance and pending based on amount and paid
  useEffect(() => {
    const amount = parseFloat(formData.amount) || 0;
    const paid = parseFloat(formData.paid) || 0;

    if (paid >= amount) {
      // If paid is more than or equal to amount, calculate advance
      const calculatedAdvance = paid - amount;
      setFormData((prev) => ({
        ...prev,
        advance: calculatedAdvance.toFixed(2),
        pending: "0.00",
      }));
    } else {
      // If paid is less than amount, calculate pending
      const calculatedPending = amount - paid;
      setFormData((prev) => ({
        ...prev,
        pending: calculatedPending.toFixed(2),
        advance: "0.00",
      }));
    }
  }, [formData.amount, formData.paid]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (treatmentDropdownRef.current && !treatmentDropdownRef.current.contains(event.target as Node)) {
        setTreatmentDropdownOpen(false);
      }
      if (packageDropdownRef.current && !packageDropdownRef.current.contains(event.target as Node)) {
        setPackageDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle treatment selection
  const handleTreatmentToggle = (treatment: Treatment) => {
    const existingIndex = selectedTreatments.findIndex(
      (t) => t.treatmentSlug === treatment.slug
    );

    if (existingIndex >= 0) {
      // Remove treatment
      setSelectedTreatments((prev) => prev.filter((_, i) => i !== existingIndex));
    } else {
      // Add treatment with quantity 1
      // Initial total price = treatment price (not doubled)
      const newTreatment: SelectedTreatment = {
        treatmentName: treatment.name,
        treatmentSlug: treatment.slug,
        price: treatment.price, // Original price
        quantity: 1,
        totalPrice: treatment.price, // Initial total = price × 1 (not doubled)
      };
      setSelectedTreatments((prev) => [...prev, newTreatment]);
    }
    setTreatmentSearchQuery("");
    setTreatmentDropdownOpen(false);
  };

  // Handle treatment quantity change
  const handleQuantityChange = (slug: string, quantity: number) => {
    if (quantity < 1) return;
    setSelectedTreatments((prev) =>
      prev.map((t) =>
        t.treatmentSlug === slug
          ? { ...t, quantity, totalPrice: t.price * quantity } // Total = price × quantity (not doubled)
          : t
      )
    );
  };

  // Handle package selection
  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg);
    // Initialize package treatment sessions with isSelected = false by default
    const sessions: PackageTreatmentSession[] = pkg.treatments.map((t) => ({
      treatmentName: t.treatmentName,
      treatmentSlug: t.treatmentSlug,
      maxSessions: t.sessions,
      usedSessions: 0,
      isSelected: false, // Default: not selected
    }));
    setPackageTreatmentSessions(sessions);
    setPackageSearchQuery("");
    setPackageDropdownOpen(false);
  };

  // Handle package treatment selection toggle
  const handlePackageTreatmentToggle = (slug: string) => {
    setPackageTreatmentSessions((prev) =>
      prev.map((t) => {
        if (t.treatmentSlug === slug) {
          const newSelected = !t.isSelected;
          // If unselecting, reset sessions to 0
          return { ...t, isSelected: newSelected, usedSessions: newSelected ? t.usedSessions : 0 };
        }
        return t;
      })
    );
  };

  // Handle package treatment session change
  const handlePackageSessionChange = (slug: string, sessions: number) => {
    setPackageTreatmentSessions((prev) =>
      prev.map((t) => {
        if (t.treatmentSlug === slug) {
          if (sessions > t.maxSessions) {
            setErrors((prevErrors) => ({
              ...prevErrors,
              [`packageSession_${slug}`]: `Cannot be filled more than ${t.maxSessions}`,
            }));
            return t;
          } else {
            setErrors((prevErrors) => {
              const newErrors = { ...prevErrors };
              delete newErrors[`packageSession_${slug}`];
              return newErrors;
            });
            return { ...t, usedSessions: sessions };
          }
        }
        return t;
      })
    );
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        setErrors({ general: "Unauthorized. Please log in again." });
        setLoading(false);
        return;
      }

      // Validate required fields
      if (!formData.firstName || !formData.mobileNumber || !formData.doctor) {
        setErrors({ general: "Please fill all required fields" });
        setLoading(false);
        return;
      }

      if (selectedService === "Treatment" && selectedTreatments.length === 0) {
        setErrors({ general: "Please select at least one treatment" });
        setLoading(false);
        return;
      }

      if (selectedService === "Package" && !selectedPackage) {
        setErrors({ general: "Please select a package" });
        setLoading(false);
        return;
      }

      if (selectedService === "Package" && selectedPackage) {
        // Check if at least one treatment is selected
        const hasSelectedTreatment = packageTreatmentSessions.some((t) => t.isSelected);
        if (!hasSelectedTreatment) {
          setErrors({ general: "Please select at least one treatment from the package" });
          setLoading(false);
          return;
        }
        // Check if selected treatments have valid sessions
        const invalidSessions = packageTreatmentSessions.filter(
          (t) => t.isSelected && (t.usedSessions < 1 || t.usedSessions > t.maxSessions)
        );
        if (invalidSessions.length > 0) {
          setErrors({ general: "Please enter valid sessions for selected treatments" });
          setLoading(false);
          return;
        }
      }

      if (!appointment) {
        setErrors({ general: "Appointment not found" });
        setLoading(false);
        return;
      }

      // Prepare payload
      const payload: any = {
        invoiceNumber: formData.invoiceNumber,
        invoicedDate: formData.invoicedDate,
        appointmentId: appointment._id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        mobileNumber: formData.mobileNumber,
        gender: formData.gender,
        doctor: appointment.doctorName,
        service: selectedService,
        amount: parseFloat(formData.amount) || 0,
        paid: parseFloat(formData.paid) || 0,
        pending: parseFloat(formData.pending || "0") || 0,
        advance: parseFloat(formData.advance) || 0,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        emrNumber: formData.emrNumber,
        userId: appointment.patientId, // Pass patient ID from appointment
      };

      if (selectedService === "Treatment") {
        // For treatment, send all selected treatments with their quantities
        const totalQuantity = selectedTreatments.reduce((sum, t) => sum + t.quantity, 0);
        payload.treatment = selectedTreatments.map((t) => t.treatmentName).join(", ");
        payload.quantity = totalQuantity;
      } else {
        // For package, only send selected treatments and their sessions
        const selectedTreatmentsFromPackage = packageTreatmentSessions.filter((t) => t.isSelected);
        payload.package = selectedPackage?.name || "";
        payload.sessions = selectedTreatmentsFromPackage.reduce((sum, t) => sum + t.usedSessions, 0);
        // Store which treatments were selected
        payload.selectedPackageTreatments = selectedTreatmentsFromPackage.map((t) => ({
          treatmentName: t.treatmentName,
          treatmentSlug: t.treatmentSlug,
          sessions: t.usedSessions,
        }));
      }

      // Create billing
      const response = await axios.post("/api/clinic/create-patient-registration", payload, { headers });

      if (response.data.success) {
        // Refresh billing history after successful creation
        if (appointment?.patientId) {
          try {
            const headers = getAuthHeaders();
            const historyResponse = await axios.get(`/api/clinic/billing-history/${appointment.patientId}`, { headers });
            if (historyResponse.data.success) {
              setBillingHistory(historyResponse.data.billings || []);
            }
          } catch (error) {
            console.error("Error refreshing billing history:", error);
          }
        }
        
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setSelectedTreatments([]);
        setSelectedPackage(null);
        setPackageTreatmentSessions([]);
        setSelectedService("Treatment");
        generateInvoiceNumber();
      } else {
        setErrors({ general: response.data.message || "Failed to create billing" });
      }
    } catch (error: any) {
      console.error("Error creating billing:", error);
      setErrors({ general: error.response?.data?.message || "Failed to create billing" });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !appointment) return null;

  const filteredTreatments = treatments.filter((t) => {
    // If search query is empty, show all treatments
    if (!treatmentSearchQuery.trim()) {
      return t.type === "sub";
    }
    const query = treatmentSearchQuery.toLowerCase();
    if (t.type === "sub") {
      return t.name.toLowerCase().includes(query) || (t.mainTreatment?.toLowerCase().includes(query) || false);
    }
    return false;
  });

  const filteredPackages = packages.filter((pkg) => {
    if (!packageSearchQuery.trim()) return false;
    const query = packageSearchQuery.toLowerCase();
    return pkg.name.toLowerCase().includes(query);
  });

  return (
    <>
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-1 sm:p-2 bg-black/50 backdrop-blur-md transition-all duration-300 animate-in fade-in">
      <div className="bg-white dark:bg-gray-50 rounded shadow-2xl max-w-4xl w-full max-h-[98vh] sm:max-h-[95vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-in slide-in-from-bottom-4 zoom-in-95">
        {/* Header with Tabs */}
        <div className="sticky top-0 bg-gray-800 dark:bg-gray-700 border-b border-gray-700 dark:border-gray-600 z-10 shadow">
          <div className="px-1.5 sm:px-2 py-1 sm:py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <div className="p-0.5 bg-gray-700 dark:bg-gray-600 rounded">
                <Search className="w-3 h-3 text-white" />
              </div>
              <h2 className="text-[10px] sm:text-xs font-bold text-white">Billing</h2>
            </div>
            <button
              onClick={onClose}
              className="p-0.5 hover:bg-gray-700 dark:hover:bg-gray-600 rounded transition-all duration-200 focus:outline-none focus:ring-1 focus:ring-gray-500 text-white"
              aria-label="Close modal"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex border-t border-gray-700 dark:border-gray-600">
            <button
              onClick={() => setActiveTab("billing")}
              className={`flex-1 px-1.5 py-1 text-[9px] sm:text-[10px] font-medium transition-colors ${
                activeTab === "billing"
                  ? "bg-gray-700 dark:bg-gray-600 text-white border-b-2 border-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-700/50"
              }`}
            >
              Create Billing
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={`flex-1 px-1.5 py-1 text-[9px] sm:text-[10px] font-medium transition-colors ${
                activeTab === "history"
                  ? "bg-gray-700 dark:bg-gray-600 text-white border-b-2 border-white"
                  : "text-gray-300 hover:text-white hover:bg-gray-700/50"
              }`}
            >
              Payment History
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === "billing" ? (
        <form id="billing-form" onSubmit={handleSubmit} className="p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 overflow-y-auto flex-1 pb-1.5 sm:pb-2">
          {errors.general && (
            <div className="bg-red-50 dark:bg-red-100 border-l-2 border-red-500 dark:border-red-600 rounded p-1 flex items-start gap-1 text-red-700 dark:text-red-900 shadow-sm animate-in slide-in-from-top-2 fade-in" role="alert">
              <AlertCircle className="w-2.5 h-2.5 flex-shrink-0 mt-0.5 animate-pulse" />
              <p className="text-[9px] sm:text-[10px] font-medium">{errors.general}</p>
            </div>
          )}

          {/* First Row: Invoice Number, Invoice Date, Appointment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            <div>
              <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                className="w-full px-1.5 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.invoicedDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, invoicedDate: e.target.value }))}
                className="w-full px-1.5 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">Appointment Details</label>
              <div className="bg-gray-50 dark:bg-gray-100 rounded p-1 border border-gray-200 dark:border-gray-300">
                <div className="text-[8px] sm:text-[9px] text-gray-700 dark:text-gray-800">
                  <span className="text-gray-600 dark:text-gray-600">Dr:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{appointment?.doctorName || "-"}</span> | 
                  <span className="text-gray-600 dark:text-gray-600 ml-1">Date:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{appointment?.startDate || "-"}</span> | 
                  <span className="text-gray-600 dark:text-gray-600 ml-1">Time:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{appointment?.fromTime && appointment?.toTime ? `${appointment.fromTime}-${appointment.toTime}` : "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Second Row: Patient Information (Read-only display) - Single Line */}
          <div className="rounded border border-gray-200 dark:border-gray-300 bg-gray-50 dark:bg-gray-100 p-1">
            <label className="block text-[8px] sm:text-[9px] font-bold text-gray-800 dark:text-gray-900 mb-0.5 uppercase tracking-wider">Patient/Client Information</label>
            <div className="text-[8px] sm:text-[9px] text-gray-700 dark:text-gray-800 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">Name:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.firstName || (appointment?.patientName ? appointment.patientName.split(" ")[0] : "") || "-"} {formData.lastName || (appointment?.patientName ? appointment.patientName.split(" ").slice(1).join(" ") : "") || "-"}</span></span> |
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">Mobile:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.mobileNumber || appointment?.patientNumber || "-"}</span></span> |
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">Email:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.email || appointment?.patientEmail || "-"}</span></span> |
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">Gender:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.gender || appointment?.gender || "-"}</span></span> |
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">EMR:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.emrNumber || appointment?.emrNumber || "-"}</span></span>
            </div>
          </div>

          {/* Service Selection - Inline */}
          <div className="rounded border border-gray-200 dark:border-gray-300 bg-gray-50 dark:bg-gray-100 p-1">
            <label className="block text-[8px] sm:text-[9px] font-bold text-gray-800 dark:text-gray-900 mb-0.5 uppercase tracking-wider">
              Service Type <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-1.5">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  value="Treatment"
                  checked={selectedService === "Treatment"}
                  onChange={(e) => {
                    setSelectedService(e.target.value as "Treatment");
                    setFormData((prev) => ({ ...prev, service: "Treatment" }));
                  }}
                  className="w-4 h-4 text-gray-600 focus:ring-2 focus:ring-gray-500 cursor-pointer"
                />
                <span className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-800 group-hover:text-gray-900 transition-colors">Treatment</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input
                  type="radio"
                  value="Package"
                  checked={selectedService === "Package"}
                  onChange={(e) => {
                    setSelectedService(e.target.value as "Package");
                    setFormData((prev) => ({ ...prev, service: "Package" }));
                  }}
                  className="w-3.5 h-3.5 text-gray-600 focus:ring-1 focus:ring-gray-500 cursor-pointer"
                />
                <span className="text-[10px] sm:text-xs font-medium text-gray-700 dark:text-gray-800 group-hover:text-gray-900 transition-colors">Package</span>
              </label>
            </div>
          </div>

          {/* Treatment Selection */}
          {selectedService === "Treatment" && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Select Treatment <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={treatmentDropdownRef}>
                <button
                  type="button"
                  onClick={() => {
                    setTreatmentDropdownOpen(!treatmentDropdownOpen);
                    if (!treatmentDropdownOpen) {
                      setTreatmentSearchQuery(""); // Clear search when opening
                    }
                  }}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <span className="text-gray-500 text-xs">
                    {selectedTreatments.length > 0 
                      ? `${selectedTreatments.length} treatment(s) selected`
                      : "Click to select treatments or type to search..."}
                  </span>
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${treatmentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {treatmentDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-64 overflow-hidden flex flex-col">
                    <div className="p-1.5 border-b border-gray-200 sticky top-0 bg-white z-20">
                      <input
                        type="text"
                        placeholder="Type to search or scroll to select..."
                        value={treatmentSearchQuery}
                        onChange={(e) => {
                          e.stopPropagation();
                          setTreatmentSearchQuery(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === "Escape") {
                            setTreatmentDropdownOpen(false);
                          }
                        }}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-56">
                      {filteredTreatments.length === 0 ? (
                        <div className="p-2 text-center text-xs text-gray-500">
                          {treatmentSearchQuery.trim() ? `No treatments found` : "No treatments available"}
                        </div>
                      ) : (
                        <div className="p-1">
                          {filteredTreatments.map((treatment) => {
                            const isSelected = selectedTreatments.some((t) => t.treatmentSlug === treatment.slug);
                            return (
                              <button
                                key={treatment.slug}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTreatmentToggle(treatment);
                                }}
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent input blur
                                }}
                                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                  isSelected
                                    ? "bg-blue-50 text-blue-700 font-medium"
                                    : "text-gray-700 hover:bg-gray-50"
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs">
                                    {treatment.name}
                                    {treatment.mainTreatment && (
                                      <span className="text-xs text-gray-500 ml-1">({treatment.mainTreatment})</span>
                                    )}
                                  </span>
                                  {isSelected && <span className="text-blue-600 text-xs">✓</span>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Selected Treatments with Quantity - Compact inline */}
              {selectedTreatments.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Set Quantity <span className="text-red-500">*</span>
                  </label>
                  {selectedTreatments.map((treatment) => (
                    <div key={treatment.treatmentSlug} className="flex items-center justify-between p-2 bg-blue-50 rounded border border-blue-200">
                      <div className="flex-1 min-w-0 mr-2">
                        <span className="text-xs font-medium text-gray-900">{treatment.treatmentName}</span>
                        <span className="text-xs text-gray-600 ml-2">Price: {treatment.price.toFixed(2)}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <label className="text-xs text-gray-700">Qty:</label>
                        <input
                          type="number"
                          min="1"
                          value={treatment.quantity}
                          onChange={(e) => handleQuantityChange(treatment.treatmentSlug, parseInt(e.target.value) || 1)}
                          className="w-16 px-1.5 py-1 border border-blue-300 rounded text-xs font-semibold text-center focus:ring-1 focus:ring-blue-500 outline-none bg-white"
                        />
                        <span className="text-xs font-semibold text-gray-900 min-w-[60px]">Total: {treatment.totalPrice.toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                  <div className="text-xs text-gray-500 mt-1 text-center bg-gray-100 px-2 py-1 rounded">
                    Qty: {selectedTreatments.reduce((sum, t) => sum + t.quantity, 0)} | Total: {selectedTreatments.reduce((sum, t) => sum + t.totalPrice, 0).toFixed(2)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Package Selection */}
          {selectedService === "Package" && (
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Select Package <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={packageDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setPackageDropdownOpen(!packageDropdownOpen)}
                    className="w-full flex items-center justify-between px-2 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <span className="text-gray-500 text-xs">
                      {selectedPackage ? selectedPackage.name : "Start typing to search for packages..."}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${packageDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {packageDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-hidden flex flex-col">
                      <div className="p-1.5 border-b border-gray-200 sticky top-0 bg-white">
                        <input
                          type="text"
                          placeholder="Search packages..."
                          value={packageSearchQuery}
                          onChange={(e) => {
                            e.stopPropagation();
                            setPackageSearchQuery(e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-40">
                        {filteredPackages.length === 0 ? (
                          <div className="p-2 text-center text-xs text-gray-500">
                            {packageSearchQuery.trim() ? `No packages found` : "Start typing to search..."}
                          </div>
                        ) : (
                          <div className="p-1">
                            {filteredPackages.map((pkg) => (
                              <button
                                key={pkg._id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handlePackageSelect(pkg);
                                }}
                                className="w-full text-left px-2 py-1 rounded text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                {pkg.name} - {pkg.price}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Package Treatments with Checkboxes and Sessions - Compact */}
              {selectedPackage && packageTreatmentSessions.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    Select Treatments & Sessions <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-1.5">
                    {packageTreatmentSessions.map((treatment) => (
                      <div key={treatment.treatmentSlug} className={`flex items-center justify-between p-2 rounded border transition-all ${
                        treatment.isSelected 
                          ? "bg-green-50 border-green-300" 
                          : "bg-gray-50 border-gray-200"
                      }`}>
                        <div className="flex items-center gap-2 flex-1 min-w-0 mr-2">
                          <input
                            type="checkbox"
                            checked={treatment.isSelected}
                            onChange={() => handlePackageTreatmentToggle(treatment.treatmentSlug)}
                            className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500 cursor-pointer"
                          />
                          <span className={`text-xs ${treatment.isSelected ? "font-medium text-gray-900" : "text-gray-700"}`}>
                            {treatment.treatmentName}
                          </span>
                          <span className="text-xs text-gray-500">(Max: {treatment.maxSessions})</span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <label className={`text-xs ${treatment.isSelected ? "text-gray-700" : "text-gray-400"}`}>
                            Sessions:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={treatment.maxSessions}
                            value={treatment.usedSessions}
                            onChange={(e) => handlePackageSessionChange(treatment.treatmentSlug, parseInt(e.target.value) || 0)}
                            disabled={!treatment.isSelected}
                            className={`w-14 px-1.5 py-1 border rounded text-xs font-semibold text-center focus:ring-1 focus:ring-blue-500 outline-none ${
                              treatment.isSelected 
                                ? "border-green-300 bg-white" 
                                : "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                          />
                          {errors[`packageSession_${treatment.treatmentSlug}`] && (
                            <span className="text-xs text-red-600 whitespace-nowrap">{errors[`packageSession_${treatment.treatmentSlug}`]}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-1.5 text-xs text-gray-500 text-center bg-gray-100 px-2 py-1 rounded">
                    Selected: {packageTreatmentSessions.filter((t) => t.isSelected).length}/{packageTreatmentSessions.length} | 
                    Sessions: {packageTreatmentSessions.filter((t) => t.isSelected).reduce((sum, t) => sum + t.usedSessions, 0)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Payment Details - Inline */}
          <div className="rounded border border-gray-200 dark:border-gray-300 bg-gray-50 dark:bg-gray-100 p-1">
            <h4 className="text-[8px] sm:text-[9px] font-bold text-gray-800 dark:text-gray-900 mb-0.5 uppercase tracking-wider">Payment Details</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-1">
              <div>
                <label className="block text-[8px] sm:text-[9px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                  Total Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={totalPrice.toFixed(2)}
                  readOnly
                  className="w-full px-1 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-gray-100 dark:bg-gray-200 text-gray-900 dark:text-gray-900 font-semibold"
                />
              </div>
              <div>
                <label className="block text-[8px] sm:text-[9px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                  Paid <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.paid}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paid: e.target.value }))}
                  className="w-full px-1 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-[8px] sm:text-[9px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">Pending</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.pending || "0.00"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pending: e.target.value }))}
                  className="w-full px-1 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-[8px] sm:text-[9px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">Advance</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.advance}
                  onChange={(e) => setFormData((prev) => ({ ...prev, advance: e.target.value }))}
                  className="w-full px-1 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-[8px] sm:text-[9px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-1 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                  required
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="BT">BT</option>
                  <option value="Tabby">Tabby</option>
                  <option value="Tamara">Tamara</option>
                </select>
              </div>
            </div>
          </div>

          {/* Additional Fields - Inline - Smaller boxes - Same line */}
          <div className="flex gap-1.5 items-start">
            <div className="flex-1">
              <label className="block text-[8px] sm:text-[9px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">Referred By</label>
              <input
                type="text"
                value={formData.referredBy}
                onChange={(e) => setFormData((prev) => ({ ...prev, referredBy: e.target.value }))}
                className="w-full px-1 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none h-[22px] sm:h-[24px]"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[8px] sm:text-[9px] font-medium text-gray-700 dark:text-gray-800 mb-0.5">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-1 py-0.5 text-[9px] sm:text-[10px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all resize-none outline-none h-[22px] sm:h-[24px]"
                rows={1}
              />
            </div>
          </div>
        </form>
        ) : (
          /* Payment History Tab */
          <div className="p-1.5 sm:p-2 overflow-y-auto flex-1">
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <span className="ml-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-600">Loading history...</span>
              </div>
            ) : billingHistory.length === 0 ? (
              <div className="text-center py-8 text-[10px] sm:text-xs text-gray-500 dark:text-gray-600 bg-white dark:bg-gray-50 rounded border border-gray-200 dark:border-gray-300">
                No payment history found
              </div>
            ) : (
              <div className="overflow-x-auto rounded border border-gray-200 dark:border-gray-300 shadow-sm max-w-full">
                <table className="w-full border-collapse min-w-[600px] sm:min-w-[700px] md:min-w-full">
                  <thead>
                    <tr className="bg-gray-800 dark:bg-gray-700 border-b border-gray-700 dark:border-gray-600">
                      <th className="px-1 sm:px-1.5 py-2 text-left text-[9px] sm:text-[10px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Invoice ID</th>
                      <th className="px-1 sm:px-1.5 py-2 text-left text-[9px] sm:text-[10px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Treatment/Package</th>
                      <th className="px-1 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Total</th>
                      <th className="px-1 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Paid</th>
                      <th className="px-1 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Pending</th>
                      <th className="px-1 sm:px-1.5 py-2 text-right text-[9px] sm:text-[10px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Advance</th>
                      <th className="px-1 sm:px-1.5 py-2 text-center text-[9px] sm:text-[10px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Qty</th>
                      <th className="px-1 sm:px-1.5 py-2 text-center text-[9px] sm:text-[10px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Session</th>
                      <th className="px-1 sm:px-1.5 py-2 text-center text-[9px] sm:text-[10px] font-semibold text-white whitespace-nowrap">Method</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-50 divide-y divide-gray-200 dark:divide-gray-300">
                    {billingHistory.map((billing) => (
                      <tr key={billing._id} className="hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors">
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-900 dark:text-gray-900 border-r border-gray-200 dark:border-gray-300 font-medium">{billing.invoiceNumber}</td>
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-700 dark:text-gray-700 border-r border-gray-200 dark:border-gray-300 max-w-[120px] sm:max-w-[150px] truncate">
                          {billing.service === "Treatment" ? billing.treatment || "-" : billing.package || "-"}
                        </td>
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-900 dark:text-gray-900 text-right font-semibold border-r border-gray-200 dark:border-gray-300">
                          {billing.amount?.toFixed(2) || "0.00"}
                        </td>
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-900 dark:text-gray-900 text-right border-r border-gray-200 dark:border-gray-300">
                          {billing.paid?.toFixed(2) || "0.00"}
                        </td>
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-900 dark:text-gray-900 text-right border-r border-gray-200 dark:border-gray-300">
                          {billing.pending?.toFixed(2) || "0.00"}
                        </td>
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-900 dark:text-gray-900 text-right border-r border-gray-200 dark:border-gray-300">
                          {billing.advance?.toFixed(2) || "0.00"}
                        </td>
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-700 dark:text-gray-700 text-center border-r border-gray-200 dark:border-gray-300">
                          {billing.quantity || "-"}
                        </td>
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-700 dark:text-gray-700 text-center border-r border-gray-200 dark:border-gray-300">
                          {billing.sessions || "-"}
                        </td>
                        <td className="px-1 sm:px-1.5 py-2 text-[9px] sm:text-[10px] text-gray-700 dark:text-gray-700 text-center">
                          {billing.paymentMethod || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Submit Button - Fixed at bottom - Only show for billing tab */}
        {activeTab === "billing" && (
        <div className="sticky bottom-0 left-0 right-0 z-30 pt-1 pb-1 px-1.5 sm:px-2 border-t border-gray-200 dark:border-gray-300 bg-white dark:bg-gray-50 shadow-[0_-1px_2px_-1px_rgba(0,0,0,0.1)] dark:shadow-[0_-1px_2px_-1px_rgba(0,0,0,0.2)]">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-1">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto px-2 py-0.5 border border-gray-300 dark:border-gray-400 rounded text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-900 bg-white dark:bg-gray-100 hover:bg-gray-50 dark:hover:bg-gray-200 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-500 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="billing-form"
              disabled={loading}
              className="w-full sm:w-auto px-2.5 sm:px-3 py-0.5 sm:py-1 rounded text-[9px] sm:text-[10px] font-semibold bg-gray-800 dark:bg-gray-700 text-white hover:bg-gray-900 dark:hover:bg-gray-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-0.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Billing"
              )}
            </button>
          </div>
        </div>
        )}
      </div>
    </div>
    </>
  );
};

export default AppointmentBillingModal;


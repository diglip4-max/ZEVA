"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { X, Search, ChevronDown, Loader2, AlertCircle } from "lucide-react";

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
    if (!treatmentSearchQuery.trim()) return false;
    const query = treatmentSearchQuery.toLowerCase();
    if (t.type === "sub") {
      return t.name.toLowerCase().includes(query) || (t.mainTreatment?.toLowerCase().includes(query) || false);
    }
    return false; // Only show sub-treatments
  });

  const filteredPackages = packages.filter((pkg) => {
    if (!packageSearchQuery.trim()) return false;
    const query = packageSearchQuery.toLowerCase();
    return pkg.name.toLowerCase().includes(query);
  });

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-2 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Billing</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {errors.general && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-red-700 text-xs">{errors.general}</span>
            </div>
          )}

          {/* First Row: Invoice Number, Invoice Date, Appointment Details */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.invoicedDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, invoicedDate: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Appointment Details</label>
              <div className="bg-gray-50 rounded p-2 border border-gray-300">
                <div className="text-xs text-gray-700">
                  <span className="text-gray-600">Doctor:</span> <span className="font-medium">{appointment.doctorName}</span> | 
                  <span className="text-gray-600 ml-1">Date:</span> <span className="font-medium">{appointment.startDate}</span> | 
                  <span className="text-gray-600 ml-1">Time:</span> <span className="font-medium">{appointment.fromTime}-{appointment.toTime}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Second Row: Patient Information (Read-only display) */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Patient/Client</label>
            <div className="bg-gray-50 rounded p-2 border border-gray-300">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="text-gray-600">First Name:</span> <span className="font-medium text-gray-900">{formData.firstName || appointment.patientName.split(" ")[0] || "-"}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Last Name:</span> <span className="font-medium text-gray-900">{formData.lastName || appointment.patientName.split(" ").slice(1).join(" ") || "-"}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Mobile:</span> <span className="font-medium text-gray-900">{formData.mobileNumber || appointment.patientNumber || "-"}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Email:</span> <span className="font-medium text-gray-900">{formData.email || appointment.patientEmail || "-"}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">Gender:</span> <span className="font-medium text-gray-900">{formData.gender || appointment.gender || "-"}</span>
                <span className="text-gray-400">|</span>
                <span className="text-gray-600">EMR:</span> <span className="font-medium text-gray-900">{formData.emrNumber || appointment.emrNumber || "-"}</span>
              </div>
            </div>
          </div>

          {/* Service Selection - Inline */}
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-700">
              Service Type <span className="text-red-500">*</span>:
            </label>
            <div className="flex gap-3">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  value="Treatment"
                  checked={selectedService === "Treatment"}
                  onChange={(e) => {
                    setSelectedService(e.target.value as "Treatment");
                    setFormData((prev) => ({ ...prev, service: "Treatment" }));
                  }}
                  className="w-3 h-3"
                />
                <span className="text-xs">Treatment</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  value="Package"
                  checked={selectedService === "Package"}
                  onChange={(e) => {
                    setSelectedService(e.target.value as "Package");
                    setFormData((prev) => ({ ...prev, service: "Package" }));
                  }}
                  className="w-3 h-3"
                />
                <span className="text-xs">Package</span>
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
                  onClick={() => setTreatmentDropdownOpen(!treatmentDropdownOpen)}
                  className="w-full flex items-center justify-between px-2 py-1.5 bg-white border border-gray-300 rounded text-xs text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <span className="text-gray-500 text-xs">Start typing to search for treatments...</span>
                  <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${treatmentDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                {treatmentDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-hidden flex flex-col">
                    <div className="p-1.5 border-b border-gray-200 sticky top-0 bg-white">
                      <input
                        type="text"
                        placeholder="Search treatments..."
                        value={treatmentSearchQuery}
                        onChange={(e) => {
                          e.stopPropagation();
                          setTreatmentSearchQuery(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-40">
                      {filteredTreatments.length === 0 ? (
                        <div className="p-2 text-center text-xs text-gray-500">
                          {treatmentSearchQuery.trim() ? `No treatments found` : "Start typing to search..."}
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
                                className={`w-full text-left px-2 py-1 rounded text-xs transition-colors ${
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
          <div className="grid grid-cols-5 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Total Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={totalPrice.toFixed(2)}
                readOnly
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded bg-gray-50 text-gray-900 font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Paid <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.paid}
                onChange={(e) => setFormData((prev) => ({ ...prev, paid: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Pending</label>
              <input
                type="number"
                step="0.01"
                value={formData.pending || "0.00"}
                onChange={(e) => setFormData((prev) => ({ ...prev, pending: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Advance</label>
              <input
                type="number"
                step="0.01"
                value={formData.advance}
                onChange={(e) => setFormData((prev) => ({ ...prev, advance: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
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

          {/* Additional Fields - Inline */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Referred By</label>
              <input
                type="text"
                value={formData.referredBy}
                onChange={(e) => setFormData((prev) => ({ ...prev, referredBy: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-gray-900 focus:border-gray-900 outline-none"
                rows={2}
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 text-xs bg-gray-900 text-white rounded hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Creating...
                </>
              ) : (
                "Create Billing"
              )}
            </button>
          </div>
        </form>

        {/* Billing History Table */}
        <div className="border-t border-gray-200 p-4">
          <h3 className="text-xs font-semibold text-gray-900 mb-2">Payment History</h3>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="ml-2 text-xs text-gray-500">Loading history...</span>
            </div>
          ) : billingHistory.length === 0 ? (
            <div className="text-center py-4 text-xs text-gray-500">No payment history found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-blue-900 border-b border-blue-800">
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-white border-r border-blue-800">Invoice ID</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-white border-r border-blue-800">Treatment/Package</th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-white border-r border-blue-800">Total Amount</th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-white border-r border-blue-800">Paid</th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-white border-r border-blue-800">Pending</th>
                    <th className="px-2 py-1.5 text-right text-xs font-medium text-white border-r border-blue-800">Advance</th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-white border-r border-blue-800">Quantity</th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-white border-r border-blue-800">Session</th>
                    <th className="px-2 py-1.5 text-center text-xs font-medium text-white">Payment Method</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {billingHistory.map((billing) => (
                    <tr key={billing._id} className="hover:bg-gray-50">
                      <td className="px-2 py-1.5 text-xs text-gray-900 border-r border-gray-200">{billing.invoiceNumber}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-700 border-r border-gray-200">
                        {billing.service === "Treatment" ? billing.treatment || "-" : billing.package || "-"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-900 text-right font-medium border-r border-gray-200">
                        {billing.amount?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-900 text-right border-r border-gray-200">
                        {billing.paid?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-900 text-right border-r border-gray-200">
                        {billing.pending?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-900 text-right border-r border-gray-200">
                        {billing.advance?.toFixed(2) || "0.00"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-700 text-center border-r border-gray-200">
                        {billing.quantity || "-"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-700 text-center border-r border-gray-200">
                        {billing.sessions || "-"}
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-700 text-center">
                        {billing.paymentMethod || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentBillingModal;


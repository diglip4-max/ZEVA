"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import { X, Search, ChevronDown, Loader2, AlertCircle, CheckCircle, XCircle } from "lucide-react";

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
  price?: number;
  totalPrice: number;
  totalSessions: number;
  sessionPrice: number;
  treatments: Array<{
    treatmentName: string;
    treatmentSlug: string;
    sessions: number;
    allocatedPrice: number;
    sessionPrice: number;
    _id: string;
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
  previouslyUsedSessions: number; // Track sessions used in previous billings
  usageDetails?: Array<{invoiceNumber: string; sessions: number; date: string}>; // Detailed usage history
  isSelected: boolean; // Checkbox to select if patient took this treatment
  sessionPrice: number; // Price per session for this treatment
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
  const [memberships, setMemberships] = useState<any[]>([]);
  const [patientDetails, setPatientDetails] = useState<any>(null);
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
  const [packageUsageData, setPackageUsageData] = useState<any>(null);
  const [loadingPackageUsage, setLoadingPackageUsage] = useState(false);
  const [membershipUsage, setMembershipUsage] = useState<any>(null);
  const [loadingMembershipUsage, setLoadingMembershipUsage] = useState(false);

  // Balances and advance usage
  const [balances, setBalances] = useState<{ advanceBalance: number; pendingBalance: number }>({
    advanceBalance: 0,
    pendingBalance: 0,
  });
  const [applyAdvance, setApplyAdvance] = useState(false);

  // Multiple payment method support
  const [useMultiplePayments, setUseMultiplePayments] = useState(false);
  const [multiplePayments, setMultiplePayments] = useState<Array<{ paymentMethod: string; amount: string }>>([
    { paymentMethod: "Cash", amount: "" },
    { paymentMethod: "Card", amount: "" },
  ]);

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
    discountedAmount: "",
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
    originalAmount: "",
    advanceUsed: "0.00",
  });

  const treatmentDropdownRef = useRef<HTMLDivElement>(null);
  const packageDropdownRef = useRef<HTMLDivElement>(null);

  // Helper function to check if membership was transferred out
  const isMembershipTransferredOut = useCallback(() => {
    if (!membershipUsage?.membershipId || !patientDetails?.membershipTransfers) return false;
    return patientDetails.membershipTransfers.some(
      (t: any) => t.type === "out" && String(t.membershipId) === String(membershipUsage.membershipId)
    );
  }, [membershipUsage, patientDetails]);

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

        // Fetch memberships
        const membershipsRes = await axios.get("/api/clinic/memberships", { headers });
        if (membershipsRes.data.success) {
          setMemberships(membershipsRes.data.memberships || []);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
    generateInvoiceNumber();
  }, [isOpen, getAuthHeaders, generateInvoiceNumber]);

  // Fetch patient details (memberships/packages)
  useEffect(() => {
    if (!isOpen || !appointment?.patientId) return;
    const fetchPatient = async () => {
      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get(`/api/clinic/${appointment.patientId}`, { headers });
        setPatientDetails(res.data || null);
      } catch (e) {
        setPatientDetails(null);
      }
    };
    fetchPatient();
  }, [isOpen, appointment?.patientId, getAuthHeaders]);

  // Fetch patient balances (advance/pending)
  useEffect(() => {
    if (!isOpen || !appointment?.patientId) return;
    const fetchBalances = async () => {
      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get(`/api/clinic/patient-balance/${appointment.patientId}`, { headers });
        if (res.data?.success && res.data?.balances) {
          setBalances({
            advanceBalance: res.data.balances.advanceBalance || 0,
            pendingBalance: res.data.balances.pendingBalance || 0,
          });
        } else {
          setBalances({ advanceBalance: 0, pendingBalance: 0 });
        }
      } catch {
        setBalances({ advanceBalance: 0, pendingBalance: 0 });
      }
    };
    fetchBalances();
  }, [isOpen, appointment?.patientId, getAuthHeaders]);

  const monthsUntil = (endDate?: string | Date) => {
    if (!endDate) return null;
    try {
      const end = new Date(endDate);
      const now = new Date();
      let months = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
      if (end.getDate() < now.getDate()) months -= 1;
      return months;
    } catch {
      return null;
    }
  };

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

  // Fetch membership usage for the patient
  useEffect(() => {
    if (!isOpen || !appointment?.patientId) return;

    const fetchMembershipUsage = async () => {
      setLoadingMembershipUsage(true);
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(`/api/clinic/membership-usage/${appointment.patientId}`, { headers });
        if (response.data.success) {
          setMembershipUsage(response.data);
        }
      } catch (error) {
        console.error("Error fetching membership usage:", error);
        setMembershipUsage(null);
      } finally {
        setLoadingMembershipUsage(false);
      }
    };

    fetchMembershipUsage();
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

  // Fetch and override referredBy with patient's referral name when available
  useEffect(() => {
    const fetchReferralName = async () => {
      if (!isOpen || !appointment?.patientId) return;
      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get(`/api/staff/get-patient-data/${appointment.patientId}`, { headers });
        const patientReferral = res?.data?.referredBy || "";
        if (patientReferral && typeof patientReferral === "string") {
          setFormData((prev) => ({
            ...prev,
            referredBy: patientReferral,
          }));
        }
      } catch (err) {
        // Ignore errors, keep existing appointment.referral fallback
      }
    };
    fetchReferralName();
  }, [isOpen, appointment?.patientId, getAuthHeaders]);

  // Calculate total price with membership benefits
  useEffect(() => {
    let baseTotal = 0;
    
    if (selectedService === "Treatment") {
      baseTotal = selectedTreatments.reduce((sum, t) => sum + t.totalPrice, 0);
    } else if (selectedPackage) {
      // Calculate total based on each treatment's sessionPrice × usedSessions
      const computedTotal = packageTreatmentSessions
        .filter((t) => t.isSelected)
        .reduce((sum, t) => sum + (t.sessionPrice * (t.usedSessions || 0)), 0);
      
      // Round to 2 decimal places
      let finalTotal = Number(computedTotal.toFixed(2));
      
      // Check if all treatments are selected with their max sessions
      const allTreatmentsSelected = packageTreatmentSessions.every((t) => 
        t.isSelected && t.usedSessions === t.maxSessions
      );
      
      // If all treatments are selected with max sessions and there's a small difference
      // between computed total and package totalPrice, use the package totalPrice
      if (allTreatmentsSelected && selectedPackage.totalPrice) {
        const difference = Math.abs(finalTotal - selectedPackage.totalPrice);
        // If difference is small (<= ₹2), use the package's totalPrice
        if (difference > 0 && difference <= 2) {
          finalTotal = selectedPackage.totalPrice;
        }
      }
      
      baseTotal = finalTotal;
    }
    
    // Apply membership benefits (skip if membership was transferred out)
    let finalTotal = baseTotal;
    let membershipDiscount = 0;
    
    // Check if membership was transferred out
    const membershipTransferredOut = membershipUsage?.membershipId && patientDetails?.membershipTransfers?.some(
      (t: any) => t.type === "out" && String(t.membershipId) === String(membershipUsage.membershipId)
    );
    
    // Check if patient has active membership with free consultations
    if (membershipUsage?.hasMembership && !membershipUsage?.isExpired && !membershipTransferredOut) {
      const hasRemainingFreeConsultations = membershipUsage.remainingFreeConsultations > 0;
      const discountPercentage = membershipUsage.discountPercentage || 0;
      
      if (hasRemainingFreeConsultations) {
        // Free consultation applies - set total to 0
        finalTotal = 0;
      } else if (discountPercentage > 0 && baseTotal > 0) {
        // Apply discount percentage
        membershipDiscount = (baseTotal * discountPercentage) / 100;
        finalTotal = baseTotal - membershipDiscount;
      }
    }
    
    setTotalPrice(finalTotal);
    setFormData((prev) => ({
      ...prev,
      discountedAmount: finalTotal.toFixed(2),
      originalAmount: baseTotal.toFixed(2),
    }));
  }, [selectedTreatments, selectedPackage, selectedService, packageTreatmentSessions, membershipUsage]);

  // Override displayed invoice total to include previous pending
  useEffect(() => {
    const discountedTotal = parseFloat(formData.discountedAmount || "0") || 0;
    const invoiceTotal = Number((discountedTotal + (balances.pendingBalance || 0)).toFixed(2));
    setFormData((prev) => ({
      ...prev,
      amount: invoiceTotal.toFixed(2),
    }));
  }, [balances.pendingBalance, formData.discountedAmount]);

  // Auto-calc pending/advance considering applied advance, pending, and paid
  useEffect(() => {
    const amountNum = parseFloat(formData.amount) || 0;
    // If using multiple payments, sum all amounts as paid
    let paidNum: number;
    if (useMultiplePayments) {
      paidNum = multiplePayments.reduce((sum, mp) => sum + (parseFloat(mp.amount) || 0), 0);
    } else {
      paidNum = Math.max(0, parseFloat(formData.paid) || 0);
    }
    const appliedAdvance = applyAdvance ? Math.min(balances.advanceBalance || 0, amountNum) : 0;
    const effectiveDue = Math.max(0, amountNum - appliedAdvance);
    const pendingVal = Math.max(0, effectiveDue - paidNum);
    const advanceVal = Math.max(0, paidNum - effectiveDue);
    setFormData((prev) => {
      const updates: any = {
        pending: pendingVal.toFixed(2),
        advance: advanceVal.toFixed(2),
        advanceUsed: appliedAdvance.toFixed(2),
      };
      // Only update paid from multiplePayments when using multi-pay mode
      if (useMultiplePayments) {
        updates.paid = paidNum.toFixed(2);
      }
      return { ...prev, ...updates };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.amount, formData.paid, applyAdvance, balances.advanceBalance, useMultiplePayments, multiplePayments]);

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
  const handlePackageSelect = async (pkg: Package) => {
    setSelectedPackage(pkg);
    setLoadingPackageUsage(true);
    
    // Fetch package usage for this patient and package
    let fetchedUsageData = null;
    if (appointment?.patientId) {
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(
          `/api/clinic/package-usage/${appointment.patientId}?packageName=${encodeURIComponent(pkg.name)}`,
          { headers }
        );
        
        if (response.data.success && response.data.packageUsage.length > 0) {
          fetchedUsageData = response.data.packageUsage[0];
          setPackageUsageData(fetchedUsageData);
        } else {
          setPackageUsageData(null);
        }
      } catch (error) {
        console.error("Error fetching package usage:", error);
        setPackageUsageData(null);
      } finally {
        setLoadingPackageUsage(false);
      }
    } else {
      setLoadingPackageUsage(false);
    }
    
    // Initialize package treatment sessions with usage data
    const sessions: PackageTreatmentSession[] = pkg.treatments.map((t) => {
      // Find if this treatment has been used before
      let previouslyUsed = 0;
      let usageDetails: Array<{invoiceNumber: string; sessions: number; date: string}> = [];
      
      if (fetchedUsageData?.treatments) {
        const usageInfo = fetchedUsageData.treatments.find(
          (usage: any) => usage.treatmentSlug === t.treatmentSlug
        );
        if (usageInfo) {
          previouslyUsed = usageInfo.totalUsedSessions || 0;
          usageDetails = usageInfo.usageDetails || [];
        }
      }
      
      return {
        treatmentName: t.treatmentName,
        treatmentSlug: t.treatmentSlug,
        maxSessions: t.sessions,
        usedSessions: 0,
        previouslyUsedSessions: previouslyUsed,
        usageDetails: usageDetails,
        isSelected: false,
        sessionPrice: t.sessionPrice || 0,
      };
    });
    
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
          const availableSessions = t.maxSessions - t.previouslyUsedSessions;
          if (sessions > availableSessions) {
            setErrors((prevErrors) => ({
              ...prevErrors,
              [`packageSession_${slug}`]: `Only ${availableSessions} session(s) remaining (${t.previouslyUsedSessions} already used)`,
            }));
            return { ...t, usedSessions: availableSessions };
          }
          if (sessions < 1 && t.isSelected && availableSessions > 0) {
            setErrors((prevErrors) => ({
              ...prevErrors,
              [`packageSession_${slug}`]: `Enter at least 1 session (max ${availableSessions})`,
            }));
            return { ...t, usedSessions: 1 };
          }
          setErrors((prevErrors) => {
            const newErrors = { ...prevErrors };
            delete newErrors[`packageSession_${slug}`];
            return newErrors;
          });
          return { ...t, usedSessions: sessions };
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
      const fieldErrors: Record<string, string> = {};
      if (!formData.invoiceNumber) fieldErrors.invoiceNumber = "Required";
      if (!formData.firstName) fieldErrors.firstName = "Required";
      if (!formData.mobileNumber) fieldErrors.mobileNumber = "Required";
      if (!formData.doctor) fieldErrors.doctor = "Required";
      if (Object.keys(fieldErrors).length > 0) {
        const missingList = Object.keys(fieldErrors)
          .map((k) => {
            if (k === "invoiceNumber") return "Invoice Number";
            if (k === "firstName") return "Name";
            if (k === "mobileNumber") return "Mobile";
            if (k === "doctor") return "Doctor";
            return k;
          })
          .join(", ");
        setErrors({ general: `Please fill all required fields: ${missingList}`, ...fieldErrors });
        setLoading(false);
        return;
      }

      if (selectedService === "Treatment" && selectedTreatments.length === 0) {
        setErrors({ general: "Please select at least one treatment", treatment: "Select at least one treatment" });
        setLoading(false);
        return;
      }

      if (selectedService === "Package" && !selectedPackage) {
        setErrors({ general: "Please select a package", package: "Select a package" });
        setLoading(false);
        return;
      }

      if (selectedService === "Package" && selectedPackage) {
        // Check if at least one treatment is selected
        const hasSelectedTreatment = packageTreatmentSessions.some((t) => t.isSelected);
        if (!hasSelectedTreatment) {
          setErrors({ general: "Please select at least one treatment from the package", packageTreatments: "Select at least one treatment" });
          setLoading(false);
          return;
        }
        // Check if selected treatments have valid sessions
        const invalidSessions = packageTreatmentSessions.filter(
          (t) => {
            if (!t.isSelected) return false;
            const availableSessions = t.maxSessions - t.previouslyUsedSessions;
            return t.usedSessions < 1 || t.usedSessions > availableSessions;
          }
        );
        if (invalidSessions.length > 0) {
          const sessionErrors: Record<string, string> = {};
          invalidSessions.forEach((t) => {
            const availableSessions = t.maxSessions - t.previouslyUsedSessions;
            sessionErrors[`packageSession_${t.treatmentSlug}`] = `Enter 1–${availableSessions} (${t.previouslyUsedSessions} already used)`;
          });
          setErrors({ general: "Please enter valid sessions for selected treatments", ...sessionErrors });
          setLoading(false);
          return;
        }
      }

      if (!appointment) {
        setErrors({ general: "Appointment not found" });
        setLoading(false);
        return;
      }

      // Calculate membership benefits (skip if membership was transferred out)
      const baseAmount = parseFloat(formData.originalAmount || formData.amount) || 0;
      const finalAmount = parseFloat(formData.amount) || 0;
      let isFreeConsultation = false;
      let freeConsultationCount = 0;
      let membershipDiscountApplied = 0;
      
      // Check if membership was transferred out
      const membershipTransferredOut = membershipUsage?.membershipId && patientDetails?.membershipTransfers?.some(
        (t: any) => t.type === "out" && String(t.membershipId) === String(membershipUsage.membershipId)
      );
      
      if (membershipUsage?.hasMembership && !membershipUsage?.isExpired && !membershipTransferredOut) {
        const hasRemainingFreeConsultations = membershipUsage.remainingFreeConsultations > 0;
        const discountPercentage = membershipUsage.discountPercentage || 0;
        
        if (hasRemainingFreeConsultations) {
          // This is a free consultation
          isFreeConsultation = true;
          freeConsultationCount = selectedService === "Treatment" 
            ? selectedTreatments.reduce((sum, t) => sum + t.quantity, 0)
            : packageTreatmentSessions.filter((t) => t.isSelected).reduce((sum, t) => sum + t.usedSessions, 0);
        } else if (discountPercentage > 0 && baseAmount > 0) {
          // Calculate discount applied
          membershipDiscountApplied = (baseAmount * discountPercentage) / 100;
        }
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
        gender: formData.gender || "Unknown",
        doctor: appointment.doctorName,
        service: selectedService,
        referredBy: formData.referredBy,
        amount: finalAmount,
        paid: parseFloat(formData.paid) || 0,
        advanceUsed: parseFloat(formData.advanceUsed) || 0,
        pendingUsed: balances.pendingBalance > 0 ? balances.pendingBalance : 0,
        pending: parseFloat(formData.pending || "0") || 0,
        advance: parseFloat(formData.advance) || 0,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        emrNumber: formData.emrNumber,
        userId: appointment.patientId, // Pass patient ID from appointment
        // Multiple payment methods
        multiplePayments: useMultiplePayments
          ? multiplePayments
              .filter((mp) => parseFloat(mp.amount) > 0)
              .map((mp) => ({ paymentMethod: mp.paymentMethod, amount: parseFloat(mp.amount) || 0 }))
          : [],
        // Membership tracking fields
        isFreeConsultation,
        freeConsultationCount,
        membershipDiscountApplied,
        originalAmount: baseAmount,
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
        // Refresh billing history and balances after successful creation
        if (appointment?.patientId) {
          try {
            const headers = getAuthHeaders();
            const [historyResponse, balanceResponse] = await Promise.all([
              axios.get(`/api/clinic/billing-history/${appointment.patientId}`, { headers }),
              axios.get(`/api/clinic/patient-balance/${appointment.patientId}`, { headers }),
            ]);
            if (historyResponse.data.success) {
              setBillingHistory(historyResponse.data.billings || []);
            }
            if (balanceResponse.data?.success && balanceResponse.data?.balances) {
              setBalances({
                advanceBalance: balanceResponse.data.balances.advanceBalance || 0,
                pendingBalance: balanceResponse.data.balances.pendingBalance || 0,
              });
            }
          } catch (error) {
            console.error("Error refreshing history/balances:", error);
          }
        }
        
        if (onSuccess) onSuccess();
        onClose();
        // Reset form
        setSelectedTreatments([]);
        setSelectedPackage(null);
        setPackageTreatmentSessions([]);
        setSelectedService("Treatment");
        setUseMultiplePayments(false);
        setMultiplePayments([{ paymentMethod: "Cash", amount: "" }, { paymentMethod: "Card", amount: "" }]);
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
      <div className="bg-white mt-6 dark:bg-gray-50 rounded shadow-2xl max-w-4xl w-full max-h-[98vh] sm:max-h-[95vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-in slide-in-from-bottom-4 zoom-in-95" style={{ minHeight: '600px' }}>
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

        {/* Content - Fixed height container for equal sizing */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0" style={{ minHeight: '480px', height: '100%' }}>
        {activeTab === "billing" ? (
        <form id="billing-form" onSubmit={handleSubmit} className="p-1 sm:p-1.5 space-y-2 sm:space-y-2.5 overflow-y-auto flex-1 min-h-0 w-full h-full pb-1 sm:pb-1.5" style={{ height: '100%', width: '100%' }}>
          {errors.general && (
            <div className="bg-red-50 dark:bg-red-100 border-l-2 border-red-500 dark:border-red-600 rounded p-1.5 flex items-start gap-1.5 text-red-700 dark:text-red-900 shadow-sm animate-in slide-in-from-top-2 fade-in mb-2" role="alert">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5 animate-pulse" />
              <p className="text-[10px] sm:text-[11px] font-medium">{errors.general}</p>
            </div>
          )}

          {/* First Row: Invoice Number, Invoice Date, Appointment Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 mb-2">
            <div className="mt-1 mb-1">
              <label className="block text-[10px] sm:text-[11px] font-medium text-gray-700 dark:text-gray-800 mb-1">
                Invoice Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                className="w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                required
              />
            </div>
            <div className="mt-1 mb-1">
              <label className="block text-[10px] sm:text-[11px] font-medium text-gray-700 dark:text-gray-800 mb-1">
                Invoice Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.invoicedDate}
                onChange={(e) => setFormData((prev) => ({ ...prev, invoicedDate: e.target.value }))}
                className="w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                required
              />
            </div>
            <div className="mt-1 mb-1">
              <label className="block text-[10px] sm:text-[11px] font-medium text-gray-700 dark:text-gray-800 mb-1">Appointment Details</label>
              <div className="bg-gray-50 dark:bg-gray-100 rounded p-1.5 border border-gray-200 dark:border-gray-300">
                <div className="text-[9px] sm:text-[10px] text-gray-700 dark:text-gray-800">
                  <span className="text-gray-600 dark:text-gray-600">Dr:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{appointment?.doctorName || "-"}</span> | 
                  <span className="text-gray-600 dark:text-gray-600 ml-1">Date:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{appointment?.startDate || "-"}</span> | 
                  <span className="text-gray-600 dark:text-gray-600 ml-1">Time:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{appointment?.fromTime && appointment?.toTime ? `${appointment.fromTime}-${appointment.toTime}` : "-"}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Second Row: Patient Information (Read-only display) - Single Line */}
          <div className="rounded border border-gray-200 dark:border-gray-300 bg-gray-50 dark:bg-gray-100 p-1.5 mt-2 mb-2">
            <label className="block text-[9px] sm:text-[10px] font-bold text-gray-800 dark:text-gray-900 mb-1 uppercase tracking-wider">Patient/Client Information</label>
            <div className="text-[9px] sm:text-[10px] text-gray-700 dark:text-gray-800 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">Name:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.firstName || (appointment?.patientName ? appointment.patientName.split(" ")[0] : "") || "-"} {formData.lastName || (appointment?.patientName ? appointment.patientName.split(" ").slice(1).join(" ") : "") || "-"}</span></span> |
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">Mobile:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.mobileNumber || appointment?.patientNumber || "-"}</span></span> |
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">Email:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.email || appointment?.patientEmail || "-"}</span></span> |
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">Gender:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.gender || appointment?.gender || "-"}</span></span> |
              <span><span className="text-gray-600 dark:text-gray-600 font-medium">EMR:</span> <span className="font-semibold text-gray-900 dark:text-gray-900">{formData.emrNumber || appointment?.emrNumber || "-"}</span></span>
            </div>
            {(errors.firstName || errors.mobileNumber || errors.gender) && (
              <div className="mt-1 text-[10px] text-red-600 dark:text-red-700">
                {errors.firstName && <span className="mr-2">Name is required</span>}
                {errors.mobileNumber && <span className="mr-2">Mobile is required</span>}
                {errors.gender && <span className="mr-2">Gender is required</span>}
              </div>
            )}
            {/* Patient Plans: Memberships and Packages */}
            {patientDetails && (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="rounded border border-gray-200 bg-white p-1.5">
                  <div className="text-[10px] font-bold text-gray-900 mb-1">Memberships</div>
                  {loadingMembershipUsage && (
                    <div className="text-[10px] text-gray-500">Checking membership...</div>
                  )}
                  {/* Show memberships from patientDetails (filter out transferred ones based on membershipTransfers history) */}
                  {(Array.isArray(patientDetails.memberships) ? patientDetails.memberships : []).filter((m: any) => {
                    // Filter out memberships that were transferred out (check membershipTransfers history)
                    const transferredOut = patientDetails.membershipTransfers?.some(
                      (t: any) => t.type === "out" && String(t.membershipId) === String(m.membershipId)
                    );
                    return !transferredOut;
                  }).length > 0 ? (
                    <div className="space-y-1">
                      {patientDetails.memberships
                        .filter((m: any) => {
                          // Filter out memberships that were transferred out
                          const transferredOut = patientDetails.membershipTransfers?.some(
                            (t: any) => t.type === "out" && String(t.membershipId) === String(m.membershipId)
                          );
                          return !transferredOut;
                        })
                        .map((m: any, idx: number) => {
                          // Look up membership name from the memberships list
                          const membershipPlan = memberships.find((mem: any) => mem._id === m.membershipId);
                          const displayName = membershipPlan?.name || m.membershipName || m.membershipId;
                          return (
                            <div key={`${m.membershipId}-${idx}`} className="flex items-center justify-between px-2 py-1 rounded border bg-emerald-50 border-emerald-200">
                              <div className="flex items-center gap-1">
                                <div className="text-[10px] text-emerald-800 font-medium">
                                  {displayName}
                                </div>
                              </div>
                              <div className="text-[10px] text-emerald-700">
                                {m.startDate ? new Date(m.startDate).toLocaleDateString() : '-'} → {m.endDate ? new Date(m.endDate).toLocaleDateString() : '-'}
                                {m.endDate && (() => {
                                  const ml = monthsUntil(m.endDate);
                                  return typeof ml === "number" && ml >= 0 ? (
                                    <span className="ml-1 text-emerald-800">({ml} months left)</span>
                                  ) : null;
                                })()}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    (!membershipUsage || !membershipUsage.hasMembership) && (
                      <div className="text-[10px] text-gray-500">No memberships</div>
                    )
                  )}
                  {/* Also show active membership usage if available (hide if transferred out) */}
                  {!loadingMembershipUsage && membershipUsage && membershipUsage.hasMembership && !membershipUsage.isExpired && !isMembershipTransferredOut() && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-[10px] text-gray-600 mb-1">Active Membership Usage:</div>
                      <div className="text-[10px] text-gray-800">
                        <span className="font-semibold">{membershipUsage.membershipName || '-'}</span>
                        <span className="ml-1">• {membershipUsage.remainingFreeConsultations || 0} free consultations remaining</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="rounded border border-gray-200 bg-white p-1.5">
                  <div className="text-[10px] font-bold text-gray-900 mb-1">Packages</div>
                  {/* Show packages from patientDetails (filter out transferred ones based on packageTransfers history) */}
                  {(Array.isArray(patientDetails.packages) ? patientDetails.packages : []).filter((p: any) => {
                    // Filter out packages that were transferred out (check packageTransfers history)
                    const transferredOut = patientDetails.packageTransfers?.some(
                      (t: any) => t.type === "out" && String(t.packageId) === String(p.packageId)
                    );
                    return !transferredOut;
                  }).length > 0 ? (
                    <div className="space-y-1">
                      {patientDetails.packages
                        .filter((p: any) => {
                          // Filter out packages that were transferred out
                          const transferredOut = patientDetails.packageTransfers?.some(
                            (t: any) => t.type === "out" && String(t.packageId) === String(p.packageId)
                          );
                          return !transferredOut;
                        })
                        .map((p: any, idx: number) => {
                          const pkg = packages.find((x) => x._id === p.packageId);
                          return (
                            <div key={`${p.packageId}-${idx}`} className="flex items-center justify-between px-2 py-1 rounded border bg-gray-50 border-gray-200">
                              <div className="text-[10px] text-gray-800">{pkg?.name || p.packageId}</div>
                              {p.assignedDate && (
                                <div className="text-[10px] text-gray-700">{new Date(p.assignedDate).toLocaleDateString()}</div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="text-[10px] text-gray-500">No packages</div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Service Selection - Inline */}
          <div className="rounded border border-gray-200 dark:border-gray-300 bg-gray-50 dark:bg-gray-100 p-1.5 mt-2 mb-2">
            <label className="block text-[9px] sm:text-[10px] font-bold text-gray-800 dark:text-gray-900 mb-1 uppercase tracking-wider">
              Service Type <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
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
                <span className="text-[11px] sm:text-xs font-medium text-gray-700 dark:text-gray-800 group-hover:text-gray-900 transition-colors">Treatment</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="radio"
                  value="Package"
                  checked={selectedService === "Package"}
                  onChange={(e) => {
                    setSelectedService(e.target.value as "Package");
                    setFormData((prev) => ({ ...prev, service: "Package" }));
                  }}
                  className="w-4 h-4 text-gray-600 focus:ring-2 focus:ring-gray-500 cursor-pointer"
                />
                <span className="text-[11px] sm:text-xs font-medium text-gray-700 dark:text-gray-800 group-hover:text-gray-900 transition-colors">Package</span>
              </label>
            </div>
            {(errors.treatment || errors.package) && (
              <div className="mt-1 text-[10px] text-red-600 dark:text-red-700">
                {errors.treatment && <span className="mr-2">{errors.treatment}</span>}
                {errors.package && <span className="mr-2">{errors.package}</span>}
              </div>
            )}
          </div>

          {/* Membership Free Consultation Info (hide if transferred out) */}
          {loadingMembershipUsage && (
            <div className="rounded border p-2 mt-2 mb-2 bg-gray-50 border-gray-200 text-xs text-gray-600 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span>Loading membership usage...</span>
            </div>
          )}
          {membershipUsage?.hasMembership && !membershipUsage?.isExpired && membershipUsage?.hasFreeConsultations && !isMembershipTransferredOut() && (
            <div className={`rounded border p-2 mt-2 mb-2 ${
              membershipUsage.remainingFreeConsultations > 0 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-amber-50 border-amber-200'
            }`}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    membershipUsage.remainingFreeConsultations > 0 ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}>
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-[11px] sm:text-xs font-semibold text-gray-900">
                    {membershipUsage.membershipName} - Free Consultations
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  membershipUsage.remainingFreeConsultations > 0 
                    ? 'bg-emerald-100 text-emerald-700' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  {membershipUsage.remainingFreeConsultations > 0 
                    ? `${membershipUsage.remainingFreeConsultations} Remaining` 
                    : 'All Used'}
                </span>
              </div>
              
              {/* Progress Bar */}
              <div className="mb-2">
                <div className="flex justify-between text-[9px] sm:text-[10px] mb-1">
                  <span className="text-gray-600">Usage Progress</span>
                  <span className="font-medium text-gray-900">
                    {membershipUsage.usedFreeConsultations} / {membershipUsage.totalFreeConsultations} consultations
                  </span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      membershipUsage.remainingFreeConsultations > 0 ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ 
                      width: `${Math.min((membershipUsage.usedFreeConsultations / membershipUsage.totalFreeConsultations) * 100, 100)}%` 
                    }}
                  />
                </div>
              </div>

              {/* Free Consultation Message */}
              {membershipUsage.remainingFreeConsultations > 0 && (
                <div className="text-[10px] text-emerald-700 bg-emerald-100/50 rounded px-2 py-1.5">
                  <span className="font-medium">Good news!</span> This session will be counted as a free consultation from your membership. 
                  <span className="font-semibold"> No charge will be applied.</span>
                </div>
              )}
              
              {membershipUsage.remainingFreeConsultations === 0 && (
                <div className="text-[10px] text-amber-700 bg-amber-100/50 rounded px-2 py-1.5">
                  <span className="font-medium">Note:</span> All free consultations have been used. 
                  {membershipUsage.discountPercentage > 0 ? (
                    <span className="font-semibold"> {membershipUsage.discountPercentage}% discount will be applied to the total amount!</span>
                  ) : (
                    <span>Regular pricing will apply.</span>
                  )}
                </div>
              )}
            </div>
          )}
          
          {/* Expired Membership Warning */}
          {membershipUsage?.hasMembership && membershipUsage?.isExpired && (
            <div className="rounded border bg-red-50 border-red-200 p-2 mt-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] sm:text-xs font-semibold text-red-800">
                    {membershipUsage.membershipName} - Expired
                  </span>
                  <p className="text-[9px] sm:text-[10px] text-red-700">
                    Membership expired on {membershipUsage.membershipEndDate ? new Date(membershipUsage.membershipEndDate).toLocaleDateString() : 'N/A'}. 
                    Free consultations and discounts no longer apply. Regular pricing will be used.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Membership Discount Info (when free consultations are exhausted but discount exists) */}
          {membershipUsage?.hasMembership && !membershipUsage?.isExpired && !membershipUsage?.hasFreeConsultations && membershipUsage?.discountPercentage > 0 && (
            <div className="rounded border bg-blue-50 border-blue-200 p-2 mt-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <span className="text-[11px] sm:text-xs font-semibold text-gray-900">
                    {membershipUsage.membershipName} - {membershipUsage.discountPercentage}% Discount Applied
                  </span>
                  <p className="text-[9px] sm:text-[10px] text-blue-700">
                    Your membership discount will be automatically applied to the total amount.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Treatment Selection */}
          {selectedService === "Treatment" && (
            <div className="mt-2 mb-2 relative z-20">
              <label className="block text-[11px] sm:text-xs font-medium text-gray-700 dark:text-gray-800 mb-1">
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
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-64 overflow-hidden flex flex-col">
                    <div className="p-1.5 border-b border-gray-200 sticky top-0 bg-white z-50">
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
                        className="w-full px-2 py-1 text-[11px] sm:text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto max-h-56">
                      {filteredTreatments.length === 0 ? (
                        <div className="p-2 text-center text-[11px] sm:text-xs text-gray-500">
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
            <div className="space-y-2 mt-2 mb-2 relative z-20">
              <div>
                <label className="block text-[11px] sm:text-xs font-medium text-gray-700 dark:text-gray-800 mb-1">
                  Select Package <span className="text-red-500">*</span>
                </label>
                <div className="relative" ref={packageDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setPackageDropdownOpen(!packageDropdownOpen)}
                    className="w-full flex items-center justify-between px-2 py-1.5 bg-white border border-gray-300 rounded text-[11px] sm:text-xs text-gray-700 hover:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <span className="text-gray-500 text-[11px] sm:text-xs">
                      {selectedPackage ? selectedPackage.name : "Start typing to search for packages..."}
                    </span>
                    <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${packageDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {packageDropdownOpen && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded shadow-lg max-h-48 overflow-hidden flex flex-col">
                      <div className="p-1.5 border-b border-gray-200 sticky top-0 bg-white z-50">
                        <input
                          type="text"
                          placeholder="Search packages..."
                          value={packageSearchQuery}
                          onChange={(e) => {
                            e.stopPropagation();
                            setPackageSearchQuery(e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 text-[11px] sm:text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          autoFocus
                        />
                      </div>
                      <div className="overflow-y-auto max-h-40">
                        {filteredPackages.length === 0 ? (
                          <div className="p-2 text-center text-[11px] sm:text-xs text-gray-500">
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
                                className="w-full text-left px-2 py-1.5 rounded text-[11px] sm:text-xs text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                              >
                                <div className="font-medium">{pkg.name}</div>
                                <div className="text-[10px] text-gray-500 mt-0.5">
                                  Total: ₹{Number(pkg.totalPrice).toFixed(2)} | {pkg.totalSessions} sessions
                                </div>
                                <div className="text-[10px] text-teal-600 mt-0.5">
                                  {pkg.treatments.map(t => `${t.treatmentName} (₹${t.sessionPrice.toFixed(2)}/session)`).join(', ')}
                                </div>
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
                  {loadingPackageUsage ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                      <span className="text-xs text-gray-500">Loading package usage...</span>
                    </div>
                  ) : (
                    <>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Select Treatments & Sessions <span className="text-red-500">*</span>
                      </label>
                      {packageUsageData && packageUsageData.totalSessions > 0 && (
                        <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded text-[10px] sm:text-xs text-blue-800 animate-in fade-in slide-in-from-top-2">
                          <div className="flex items-center gap-1 mb-1">
                            <AlertCircle className="w-3 h-3 flex-shrink-0" />
                            <span className="font-semibold">Package Usage History</span>
                          </div>
                          <div className="text-[10px] text-blue-700">
                            Total sessions used: <span className="font-bold">{packageUsageData.totalSessions}</span> from previous billings
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {packageTreatmentSessions.map((treatment) => {
                          const remainingSessions = treatment.maxSessions - treatment.previouslyUsedSessions;
                          const isFullyUsed = remainingSessions <= 0;
                          
                          return (
                            <div 
                              key={treatment.treatmentSlug} 
                              className={`flex flex-col p-2 rounded border transition-all duration-200 ${
                                isFullyUsed
                                  ? "bg-red-50 border-red-300"
                                  : treatment.isSelected 
                                    ? "bg-green-50 border-green-300 shadow-sm" 
                                    : "bg-gray-50 border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              {/* Main Row */}
                              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={treatment.isSelected}
                                    onChange={() => handlePackageTreatmentToggle(treatment.treatmentSlug)}
                                    disabled={isFullyUsed}
                                    className="mt-0.5 w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={`text-xs font-medium ${
                                        isFullyUsed 
                                          ? "text-red-700"
                                          : treatment.isSelected 
                                            ? "text-gray-900" 
                                            : "text-gray-700"
                                      }`}>
                                        {treatment.treatmentName}
                                      </span>
                                      <span className="text-xs text-gray-500">
                                        (Total: {treatment.maxSessions} sessions)
                                      </span>
                                      <span className="text-xs text-teal-600 font-medium">
                                        ₹{treatment.sessionPrice.toFixed(2)}/session
                                      </span>
                                    </div>
                                    
                                    {/* Usage Status */}
                                    {treatment.previouslyUsedSessions > 0 ? (
                                      <div className="mt-1">
                                        <div className={`text-[10px] font-semibold flex items-center gap-1 ${
                                          isFullyUsed ? "text-red-700" : "text-orange-700"
                                        }`}>
                                          {isFullyUsed ? (
                                            <>
                                              <XCircle className="w-3 h-3" />
                                              <span>This treatment has already used all available sessions.</span>
                                            </>
                                          ) : (
                                            <>
                                              <AlertCircle className="w-3 h-3" />
                                              <span>{treatment.previouslyUsedSessions} of {treatment.maxSessions} sessions already used • {remainingSessions} sessions available for billing</span>
                                            </>
                                          )}
                                        </div>
                                        
                                        {/* Usage Details */}
                                        {treatment.usageDetails && treatment.usageDetails.length > 0 && (
                                          <div className="mt-1 pl-4 space-y-0.5">
                                            {treatment.usageDetails.map((detail, idx) => (
                                              <div key={idx} className="text-[9px] text-gray-600 flex items-center gap-1">
                                                <CheckCircle className="w-2.5 h-2.5 text-green-600" />
                                                <span className="font-medium">{detail.sessions} session(s)</span>
                                                <span>•</span>
                                                <span>Invoice: {detail.invoiceNumber}</span>
                                                <span>•</span>
                                                <span>{new Date(detail.date).toLocaleDateString()}</span>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="mt-1 text-[10px] text-green-600 font-medium flex items-center gap-1">
                                        <CheckCircle className="w-3 h-3" />
                                        <span>No sessions used yet - All {treatment.maxSessions} sessions available</span>
                                      </div>
                                    )}
                                    <div className="mt-1 text-[10px] text-gray-600">
                                      Total: <span className="font-semibold">{treatment.maxSessions}</span> • Used: <span className="font-semibold">{treatment.previouslyUsedSessions}</span> • Remaining: <span className="font-semibold">{Math.max(0, treatment.maxSessions - treatment.previouslyUsedSessions)}</span>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Session Input */}
                                <div className="flex items-center gap-2 flex-shrink-0 ml-7 sm:ml-0">
                                  <label className={`text-xs whitespace-nowrap font-medium ${
                                    treatment.isSelected && !isFullyUsed ? "text-gray-700" : "text-gray-400"
                                  }`}>
                                    New Sessions:
                                  </label>
                                  <input
                                    type="number"
                                    min="1"
                                    max={remainingSessions}
                                    value={treatment.usedSessions}
                                    onChange={(e) => handlePackageSessionChange(treatment.treatmentSlug, parseInt(e.target.value) || 0)}
                                    disabled={!treatment.isSelected || isFullyUsed}
                                    placeholder={isFullyUsed ? "0" : `Max ${remainingSessions}`}
                                    className={`w-16 px-2 py-1 border rounded text-xs font-semibold text-center focus:ring-2 focus:ring-blue-500 outline-none transition-all ${
                                      isFullyUsed
                                        ? "border-red-300 bg-red-100 text-red-500 cursor-not-allowed"
                                        : treatment.isSelected 
                                          ? "border-green-400 bg-white text-gray-900" 
                                          : "border-gray-300 bg-gray-100 text-gray-400 cursor-not-allowed"
                                    }`}
                                  />
                                  {treatment.isSelected && !isFullyUsed && remainingSessions > 0 && (
                                    <span className="text-[10px] text-gray-500 whitespace-nowrap">
                                      (of {remainingSessions})
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Error Message */}
                              {errors[`packageSession_${treatment.treatmentSlug}`] && (
                                <div className="mt-2 p-1.5 bg-red-100 border border-red-300 rounded text-[10px] text-red-700 font-medium animate-in fade-in slide-in-from-top-1 flex items-start gap-1">
                                  <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                                  <span>{errors[`packageSession_${treatment.treatmentSlug}`]}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      {errors.packageTreatments && (
                        <div className="mt-1 text-[10px] text-red-600">{errors.packageTreatments}</div>
                      )}
                      <div className="mt-2 p-2 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-300 rounded-lg">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <span className="text-gray-600 font-medium">Treatments Selected:</span>
                            <span className="font-bold text-blue-600">{packageTreatmentSessions.filter((t) => t.isSelected).length} of {packageTreatmentSessions.length}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <span className="text-gray-600 font-medium">New Sessions:</span>
                            <span className="font-bold text-green-600">{packageTreatmentSessions.filter((t) => t.isSelected).reduce((sum, t) => sum + t.usedSessions, 0)}</span>
                          </div>
                          <div className="flex items-center justify-between sm:justify-start gap-2">
                            <span className="text-gray-600 font-medium">Total Amount:</span>
                            <span className="font-bold text-teal-600">₹{totalPrice.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Payment Details - Inline */}
          <div className="rounded border border-gray-200 dark:border-gray-300 bg-gray-50 dark:bg-gray-100 p-1.5 mt-2 mb-2">
            <h4 className="text-[9px] sm:text-[10px] font-bold text-gray-800 dark:text-gray-900 mb-1 uppercase tracking-wider">Payment Details</h4>
            
            {/* Membership Discount Breakdown - Shows when discount is applied */}
            {membershipUsage?.hasMembership && !membershipUsage?.isExpired && 
             membershipUsage?.remainingFreeConsultations === 0 && 
             membershipUsage?.discountPercentage > 0 && 
             parseFloat(formData.originalAmount || '0') > 0 && (
              <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-gray-900">
                    {membershipUsage.membershipName} Discount Applied
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-[10px] sm:text-[11px]">
                  <div className="text-center">
                    <div className="text-gray-600">Original Amount</div>
                    <div className="font-semibold text-gray-900 line-through">₹{parseFloat(formData.originalAmount || '0').toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-blue-600">Discount ({membershipUsage.discountPercentage}%)</div>
                    <div className="font-semibold text-blue-700">
                      -₹{((parseFloat(formData.originalAmount || '0') * membershipUsage.discountPercentage) / 100).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-emerald-600">Final Amount</div>
                    <div className="font-bold text-emerald-700">₹{totalPrice.toFixed(2)}</div>
                  </div>
                </div>
                <div className="mt-1 text-[9px] text-blue-700 text-center">
                  Free consultations exhausted. {membershipUsage.discountPercentage}% membership discount applied.
                </div>
              </div>
            )}
            
            {/* Free Consultation Applied Message */}
            {membershipUsage?.hasMembership && !membershipUsage?.isExpired && 
             membershipUsage?.remainingFreeConsultations > 0 && 
             totalPrice === 0 && (
              <div className="mb-2 p-2 bg-emerald-50 border border-emerald-200 rounded">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <span className="text-[10px] sm:text-[11px] font-semibold text-emerald-800">
                      Free Consultation Applied
                    </span>
                    <p className="text-[9px] text-emerald-700">
                      No charge for this session. {membershipUsage.remainingFreeConsultations - 1} free consultation(s) remaining after this.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
              <div className="mt-1 mb-1">
                <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-1">
                  Total Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount || "0.00"}
                  readOnly
                  className="w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded bg-gray-100 dark:bg-gray-200 text-gray-900 dark:text-gray-900 font-semibold"
                />
                {(balances.pendingBalance > 0 || (applyAdvance && balances.advanceBalance > 0)) && (
                  <div className="mt-1 text-[9px]">
                    {balances.pendingBalance > 0 && (
                      <div className="text-red-600">
                        Includes previous pending ₹{balances.pendingBalance.toFixed(2)} added to total
                      </div>
                    )}
                    {applyAdvance && balances.advanceBalance > 0 && (
                      <div className="text-emerald-700">
                        Applying advance ₹{Math.min(balances.advanceBalance, parseFloat(formData.amount)||0).toFixed(2)} to this bill
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-1 mb-1">
                <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-1">
                  Paid <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.paid}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paid: e.target.value }))}
                  className={`w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none ${useMultiplePayments ? 'bg-gray-100 dark:bg-gray-200' : 'bg-white dark:bg-gray-100'}`}
                  required
                  readOnly={useMultiplePayments}
                />
                <div className="mt-1 text-[9px] text-gray-600">
                  Net due = ₹{(Math.max(0, (parseFloat(formData.amount)||0) - (applyAdvance ? Math.min(balances.advanceBalance, parseFloat(formData.amount)||0) : 0))).toFixed(2)}
                </div>
              </div>
              <div className="mt-1 mb-1">
                <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-1">Pending</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.pending || "0.00"}
                  onChange={(e) => setFormData((prev) => ({ ...prev, pending: e.target.value }))}
                  className="w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                />
              </div>
              <div className="mt-1 mb-1">
                <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-1">Advance</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.advance}
                  onChange={(e) => setFormData((prev) => ({ ...prev, advance: e.target.value }))}
                  className="w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
                />
              </div>
              {balances.advanceBalance > 0 && (
                <div className="mt-1 mb-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={applyAdvance}
                    onChange={(e) => setApplyAdvance(e.target.checked)}
                    className="w-3.5 h-3.5"
                  />
                  <label className="text-[9px] sm:text-[10px] text-gray-800">
                    Use advance balance now (₹{balances.advanceBalance.toFixed(2)})
                  </label>
                </div>
              )}
              <div className="mt-1 mb-1">
                <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-1">
                  Payment Method <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  className={`w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none ${useMultiplePayments ? 'opacity-50' : ''}`}
                  required
                  disabled={useMultiplePayments}
                >
                  <option value="Cash">Cash</option>
                  <option value="Card">Card</option>
                  <option value="BT">BT</option>
                  <option value="Tabby">Tabby</option>
                  <option value="Tamara">Tamara</option>
                </select>
              </div>
            </div>

            {/* Add Multiple Payment Method Link */}
            <div className="mt-2">
              <button
                type="button"
                onClick={() => {
                  setUseMultiplePayments(!useMultiplePayments);
                  if (!useMultiplePayments) {
                    // Reset multiple payments when enabling
                    setMultiplePayments([
                      { paymentMethod: "Cash", amount: "" },
                      { paymentMethod: "Card", amount: "" },
                    ]);
                  }
                }}
                className="text-[10px] sm:text-[11px] text-blue-600 hover:text-blue-800 underline font-medium transition-colors"
              >
                {useMultiplePayments ? "← Use single payment method" : "+ Add multiple payment method"}
              </button>
            </div>

            {/* Multiple Payment Methods UI */}
            {useMultiplePayments && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] sm:text-[10px] font-bold text-gray-800 uppercase tracking-wider">Split Payment Methods</label>
                  <span className="text-[9px] sm:text-[10px] font-semibold text-blue-700">
                    Total Paid: ₹{multiplePayments.reduce((sum, mp) => sum + (parseFloat(mp.amount) || 0), 0).toFixed(2)}
                  </span>
                </div>
                {multiplePayments.map((mp, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={mp.paymentMethod}
                      onChange={(e) => {
                        const updated = [...multiplePayments];
                        updated[idx] = { ...updated[idx], paymentMethod: e.target.value };
                        setMultiplePayments(updated);
                      }}
                      className="px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 rounded bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none min-w-[90px]"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="BT">BT</option>
                      <option value="Tabby">Tabby</option>
                      <option value="Tamara">Tamara</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Amount"
                      value={mp.amount}
                      onChange={(e) => {
                        const updated = [...multiplePayments];
                        updated[idx] = { ...updated[idx], amount: e.target.value };
                        setMultiplePayments(updated);
                      }}
                      className="flex-1 px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 rounded bg-white text-gray-900 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    {multiplePayments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setMultiplePayments(multiplePayments.filter((_, i) => i !== idx));
                        }}
                        className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
                        title="Remove"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setMultiplePayments([...multiplePayments, { paymentMethod: "Cash", amount: "" }]);
                  }}
                  className="text-[9px] sm:text-[10px] text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  + Add another payment method
                </button>
                {/* Validation hint */}
                {(() => {
                  const totalMultiPaid = multiplePayments.reduce((sum, mp) => sum + (parseFloat(mp.amount) || 0), 0);
                  const netDue = Math.max(0, (parseFloat(formData.amount) || 0) - (applyAdvance ? Math.min(balances.advanceBalance, parseFloat(formData.amount) || 0) : 0));
                  const diff = totalMultiPaid - netDue;
                  if (diff > 0) {
                    return <div className="text-[9px] text-emerald-700 font-medium">Excess ₹{diff.toFixed(2)} will be stored as advance balance.</div>;
                  } else if (diff < 0) {
                    return <div className="text-[9px] text-red-600 font-medium">Remaining ₹{Math.abs(diff).toFixed(2)} will be pending.</div>;
                  }
                  return <div className="text-[9px] text-emerald-700 font-medium">Exact amount covered. No pending or advance.</div>;
                })()}
              </div>
            )}
          </div>

          {/* Additional Fields - Inline - Smaller boxes - Same line */}
          <div className="flex gap-2 items-start mt-2 mb-2">
            <div className="flex-1 mt-1 mb-1">
              <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-1">Referred By</label>
              <input
                type="text"
                value={formData.referredBy}
                onChange={(e) => setFormData((prev) => ({ ...prev, referredBy: e.target.value }))}
                className="w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all outline-none"
              />
            </div>
            <div className="flex-1 mt-1 mb-1">
              <label className="block text-[9px] sm:text-[10px] font-medium text-gray-700 dark:text-gray-800 mb-1">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="w-full px-2 py-1 text-[10px] sm:text-[11px] border border-gray-300 dark:border-gray-300 rounded bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-600 focus:border-gray-500 dark:focus:border-gray-600 transition-all resize-none outline-none min-h-[36px]"
                rows={2}
              />
            </div>
          </div>

          {/* Action Buttons - Create and Cancel */}
          <div className="flex items-center justify-end gap-2 mt-4 mb-2 pt-2 border-t border-gray-200 dark:border-gray-300">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[11px] sm:text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-[11px] sm:text-xs font-medium text-white bg-gray-900 dark:bg-blue-600 rounded hover:bg-black dark:hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Billing'}
            </button>
          </div>
        </form>
        ) : (
          /* Payment History Tab */
          <div className="p-1 sm:p-1.5 overflow-y-auto flex-1 min-h-0 w-full h-full flex flex-col" style={{ height: '100%', width: '100%' }}>
            {loadingHistory ? (
              <div className="flex-1 flex items-center justify-center min-h-0 mt-2 mb-2">
                <div className="text-center">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto mb-2" />
                  <span className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-600">Loading history...</span>
                </div>
              </div>
            ) : billingHistory.length === 0 ? (
              <div className="flex-1 flex items-center justify-center min-h-0 mt-2 mb-2">
                <div className="text-center py-8 px-4 text-[11px] sm:text-xs text-gray-500 dark:text-gray-600 bg-white dark:bg-gray-50 rounded border border-gray-200 dark:border-gray-300 w-full">
                  No payment history found
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-auto rounded border border-gray-200 dark:border-gray-300 shadow-sm min-h-0 w-full h-full mt-2 mb-2" style={{ height: '100%', width: '100%' }}>
                <table className="w-full border-collapse text-[10px] sm:text-[11px]">
               {/* <table className="w-full border-collapse min-w-[600px] sm:min-w-[700px] md:min-w-full"> */}
                  <thead>
                    <tr className="bg-gray-800 dark:bg-gray-700 border-b border-gray-700 dark:border-gray-600">
                      <th className="px-2 py-2.5 text-left text-[10px] sm:text-[11px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Invoice ID</th>
                      <th className="px-2 py-2.5 text-left text-[10px] sm:text-[11px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Treatment/Package</th>
                      <th className="px-2 py-2.5 text-right text-[10px] sm:text-[11px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Total</th>
                      <th className="px-2 py-2.5 text-right text-[10px] sm:text-[11px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Paid</th>
                      <th className="px-2 py-2.5 text-right text-[10px] sm:text-[11px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Pending</th>
                      <th className="px-2 py-2.5 text-right text-[10px] sm:text-[11px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Advance</th>
                      <th className="px-2 py-2.5 text-center text-[10px] sm:text-[11px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Qty</th>
                      <th className="px-2 py-2.5 text-center text-[10px] sm:text-[11px] font-semibold text-white border-r border-gray-700 dark:border-gray-600 whitespace-nowrap">Session</th>
                      <th className="px-2 py-2.5 text-center text-[10px] sm:text-[11px] font-semibold text-white whitespace-nowrap">Method</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-50 divide-y divide-gray-200 dark:divide-gray-300">
                    {billingHistory.map((billing) => (
                      <React.Fragment key={billing._id}>
                        <tr className="hover:bg-gray-50 dark:hover:bg-gray-100 transition-colors">
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-gray-900 dark:text-gray-900 border-r border-gray-200 dark:border-gray-300 font-medium">{billing.invoiceNumber}</td>
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-gray-700 dark:text-gray-700 border-r border-gray-200 dark:border-gray-300">
                            <div>
                              <div className="font-medium">
                                {billing.service === "Treatment" ? billing.treatment || "-" : billing.package || "-"}
                              </div>
                              {billing.service === "Package" && billing.selectedPackageTreatments && billing.selectedPackageTreatments.length > 0 && (
                                <div className="mt-0.5 text-[9px] text-gray-600 space-y-0.5">
                                  {billing.selectedPackageTreatments.map((treatment: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-1">
                                      <span className="text-green-600">✓</span>
                                      <span>{treatment.treatmentName}: {treatment.sessions} session(s)</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-gray-900 dark:text-gray-900 text-right font-semibold border-r border-gray-200 dark:border-gray-300">
                            {billing.amount?.toFixed(2) || "0.00"}
                          </td>
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-gray-900 dark:text-gray-900 text-right border-r border-gray-200 dark:border-gray-300">
                            {billing.paid?.toFixed(2) || "0.00"}
                          </td>
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-right border-r border-gray-200 dark:border-gray-300">
                            <span className={`${Number(billing.pending || 0) > 0 ? "text-red-600 font-semibold" : "text-gray-900 dark:text-gray-900"}`}>
                              {billing.pending?.toFixed(2) || "0.00"}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-gray-900 dark:text-gray-900 text-right border-r border-gray-200 dark:border-gray-300">
                            {billing.advance?.toFixed(2) || "0.00"}
                          </td>
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-gray-700 dark:text-gray-700 text-center border-r border-gray-200 dark:border-gray-300">
                            {billing.quantity || "-"}
                          </td>
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-gray-700 dark:text-gray-700 text-center border-r border-gray-200 dark:border-gray-300">
                            {billing.sessions || "-"}
                          </td>
                          <td className="px-2 py-2.5 text-[10px] sm:text-[11px] text-gray-700 dark:text-gray-700 text-center">
                            {billing.multiplePayments && billing.multiplePayments.length > 0 ? (
                              <div className="space-y-0.5">
                                {billing.multiplePayments.map((mp: any, idx: number) => (
                                  <div key={idx} className="text-[9px]">
                                    <span className="font-medium">{mp.paymentMethod}</span>: ₹{Number(mp.amount || 0).toFixed(2)}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              billing.paymentMethod || "-"
                            )}
                          </td>
                        </tr>
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        </div>

        {/* Submit Button - Fixed at bottom - Only show for billing tab */}
      
      </div>
    </div>
    </>
  );
};

export default AppointmentBillingModal;


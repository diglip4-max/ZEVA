"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  X,
  ChevronDown,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Package,
  ChevronUp,
  Send,
  FileText,
} from "lucide-react";

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
  serviceId?: string | { _id: string } | null;
  serviceName?: string | null;
  serviceIds?: string[] | Array<{ _id: string }>;
  serviceNames?: string[];
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
  sessionPrice?: number;
  isUserPackage?: boolean;
  remainingSessions?: number;
  patientPackageId?: string;
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
  usesFreeConsultation?: boolean;
  usesMembershipDiscount?: boolean;
}

interface PackageTreatmentSession {
  treatmentName: string;
  treatmentSlug: string;
  maxSessions: number;
  usedSessions: number;
  previouslyUsedSessions: number; // Track sessions used in previous billings
  usageDetails?: Array<{
    invoiceNumber: string;
    sessions: number;
    date: string;
  }>; // Detailed usage history
  isSelected: boolean;
  sessionPrice: number;
  usesFreeConsultation?: boolean;
  usesMembershipDiscount?: boolean;
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
  const [userPackages, setUserPackages] = useState<any[]>([]);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [patientDetails, setPatientDetails] = useState<any>(null);
  const [selectedService, setSelectedService] = useState<
    "Treatment" | "Package"
  >("Treatment");
  const [selectedTreatments, setSelectedTreatments] = useState<
    SelectedTreatment[]
  >([]);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [packageTreatmentSessions, setPackageTreatmentSessions] = useState<
    PackageTreatmentSession[]
  >([]);
  const [treatmentDropdownOpen, setTreatmentDropdownOpen] = useState(false);
  const [packageDropdownOpen, setPackageDropdownOpen] = useState(false);
  const [treatmentSearchQuery, setTreatmentSearchQuery] = useState("");
  const [packageSearchQuery, setPackageSearchQuery] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [totalPrice, setTotalPrice] = useState(0);
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [packageUsageData, setPackageUsageData] = useState<any>(null);
  const [loadingPackageUsage, setLoadingPackageUsage] = useState(false);
  const [membershipUsage, setMembershipUsage] = useState<any>(null);
  const [loadingMembershipUsage, setLoadingMembershipUsage] = useState(false);
  const [activePackageUsage, setActivePackageUsage] = useState<any[]>([]);
  const [loadingActivePackageUsage, setLoadingActivePackageUsage] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [expandedPackages, setExpandedPackages] = useState<Record<string, boolean>>({});

  // Smart Recommendations state
  interface SmartService { _id: string; name: string; price: number; clinicPrice?: number | null; durationMinutes?: number; departmentId?: string; serviceSlug?: string; }
  interface SmartDepartment { _id: string; name: string; services: SmartService[]; }
  const [smartDepartments, setSmartDepartments] = useState<SmartDepartment[]>([]);
  const [loadingSmartRec, setLoadingSmartRec] = useState(false);
  const [justAddedServiceName, setJustAddedServiceName] = useState<string | null>(null);

  // Doctor discount state
  const [doctorDiscount, setDoctorDiscount] = useState<{
    discountType: string;
    discountAmount: number;
  } | null>(null);
  const [isDoctorDiscountApplied, setIsDoctorDiscountApplied] =
    useState(false);

  // Balances and advance usage
  const [balances, setBalances] = useState<{
    advanceBalance: number;
    pendingBalance: number;
    pastAdvanceBalance: number;
    pastAdvance50PercentBalance: number;
    pastAdvance54PercentBalance: number;
    pastAdvance159FlatBalance: number;
  }>({
    advanceBalance: 0,
    pendingBalance: 0,
    pastAdvanceBalance: 0,
    pastAdvance50PercentBalance: 0,
    pastAdvance54PercentBalance: 0,
    pastAdvance159FlatBalance: 0,
  });
  const [applyAdvance, setApplyAdvance] = useState(false);
  const [applyPastAdvance50Percent, setApplyPastAdvance50Percent] = useState(false);
  const [applyPastAdvance54Percent, setApplyPastAdvance54Percent] = useState(false);
  const [applyPastAdvance159Flat, setApplyPastAdvance159Flat] = useState(false);

  // Consent Form States
  const [consentForms, setConsentForms] = useState<any[]>([]);
  const [selectedConsentId, setSelectedConsentId] = useState("");
  const [sendingConsent, setSendingConsent] = useState(false);
  const [consentSent, setConsentSent] = useState(false);
  const [consentStatuses, setConsentStatuses] = useState<any[]>([]);
  const [loadingConsentStatus, setLoadingConsentStatus] = useState(false);

  // Multiple payment method support
  const [useMultiplePayments, setUseMultiplePayments] = useState(false);
  const [multiplePayments, setMultiplePayments] = useState<
    Array<{ paymentMethod: string; amount: string }>
  >([
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
    pastAdvance: "0.00",
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
    pastAdvanceUsed: "0.00",
    pastAdvanceUsed50Percent: "0.00",
    pastAdvanceUsed54Percent: "0.00",
    pastAdvanceUsed159Flat: "0.00",
    pendingUsed: "0.00",
  });

  const treatmentDropdownRef = useRef<HTMLDivElement>(null);
  const packageDropdownRef = useRef<HTMLDivElement>(null);

  // Helper function to check if membership was transferred out
  const isMembershipTransferredOut = useCallback(() => {
    if (!membershipUsage?.membershipId || !patientDetails?.membershipTransfers)
      return false;
    return patientDetails.membershipTransfers.some(
      (t: any) =>
        t.type === "out" &&
        String(t.membershipId) === String(membershipUsage.membershipId),
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
        const treatmentsRes = await axios.get("/api/clinic/treatments", {
          headers,
        });
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

          // Also include clinic Services as selectable treatments
          try {
            const servicesRes = await axios.get("/api/clinic/services", {
              headers,
            });
            if (
              servicesRes.data?.success &&
              Array.isArray(servicesRes.data.services)
            ) {
              servicesRes.data.services.forEach((svc: any) => {
                if (!svc || !svc.name) return;
                allTreatments.push({
                  name: svc.name,
                  slug: svc.serviceSlug || svc._id, // unique key for selection
                  price: Number(svc.price) || 0,
                  type: "sub", // keep as 'sub' so existing filters include it
                  mainTreatment: "Service",
                  mainTreatmentSlug: "service",
                });
              });
            }
          } catch {
            // Ignore services fetch errors and proceed with available treatments
          }

          setTreatments(allTreatments);
        }

        // Fetch packages
        const packagesRes = await axios.get("/api/clinic/packages", {
          headers,
        });
        if (packagesRes.data.success) {
          setPackages(packagesRes.data.packages || []);
        }

        // Fetch userPackages (packages created via public form) for this patient
        if (appointment?.patientId) {
          try {
            const userPkgRes = await axios.get(`/api/clinic/patient-registration?id=${appointment.patientId}`, { headers });
            if (userPkgRes.data.success && userPkgRes.data.patient?.userPackages) {
              const approvedUserPackages = userPkgRes.data.patient.userPackages.filter(
                (pkg: any) => pkg.approvalStatus === 'approved'
              );
              // Fetch full package details for each userPackage from UserPackage model
              const fullUserPackages: any[] = [];
              for (const pkg of approvedUserPackages) {
                try {
                  const pkgDetailsRes = await axios.get(
                    `/api/clinic/public-package?patientId=${appointment.patientId}`,
                    { headers }
                  );
                  if (pkgDetailsRes.data.success && pkgDetailsRes.data.existingPackages) {
                    const fullPkg = pkgDetailsRes.data.existingPackages.find(
                      (p: any) => p._id === pkg.packageId
                    );
                    if (fullPkg) {
                      fullUserPackages.push({
                        ...fullPkg,
                        assignedDate: pkg.assignedDate,
                        patientPackageId: pkg._id,
                        isUserPackage: true,
                      });
                    }
                  }
                } catch (e) {
                  console.error(`Error fetching userPackage ${pkg.packageId}:`, e);
                }
              }
              setUserPackages(fullUserPackages);
            }
          } catch (e) {
            console.error("Error fetching userPackages:", e);
          }
        }

        // Fetch memberships
        const membershipsRes = await axios.get("/api/clinic/memberships", {
          headers,
        });
        if (membershipsRes.data.success) {
          setMemberships(membershipsRes.data.memberships || []);
        }

        // Fetch Smart Recommendations (departments & services) based on doctor
        try {
          if (appointment?.doctorId) {
            setLoadingSmartRec(true);
            const deptRes = await axios.get("/api/clinic/doctor-departments", {
              headers,
              params: { doctorStaffId: appointment.doctorId },
            });
            if (deptRes.data?.success && Array.isArray(deptRes.data.departments)) {
              const departments = deptRes.data.departments;
              if (departments.length > 0) {
                // Fetch services for each department
                const results = await Promise.allSettled(
                  departments.map((dept: any) =>
                    axios.get("/api/clinic/services", {
                      headers,
                      params: { departmentId: dept.clinicDepartmentId || dept._id },
                    })
                  )
                );

                const enriched = departments.map((dept: any, i: number) => {
                  const res = results[i];
                  const services: SmartService[] =
                    res.status === "fulfilled" && res.value?.data?.success
                      ? (res.value.data.services || []).map((s: any) => ({
                          _id: s._id,
                          name: s.name,
                          price: s.price,
                          clinicPrice: s.clinicPrice,
                          durationMinutes: s.durationMinutes,
                          departmentId: dept._id,
                          serviceSlug: s.serviceSlug,
                        }))
                      : [];
                  return { _id: dept._id, name: dept.name, services };
                }).filter((d: any) => d.services.length > 0);

                setSmartDepartments(enriched);
              }
            }
          }
        } catch (error) {
          console.log("Smart Rec fetch error:", error);
          // Ignore smart rec errors
        } finally {
          setLoadingSmartRec(false);
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
        const res = await axios.get(`/api/clinic/${appointment.patientId}`, {
          headers,
        });
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
        const res = await axios.get(
          `/api/clinic/patient-balance/${appointment.patientId}`,
          { headers },
        );
        if (res.data?.success && res.data?.balances) {
          setBalances({
            advanceBalance: res.data.balances.advanceBalance || 0,
            pendingBalance: res.data.balances.pendingBalance || 0,
            pastAdvanceBalance: res.data.balances.pastAdvanceBalance || 0,
            pastAdvance50PercentBalance:
              res.data.balances.pastAdvance50PercentBalance || 0,
            pastAdvance54PercentBalance:
              res.data.balances.pastAdvance54PercentBalance || 0,
            pastAdvance159FlatBalance:
              res.data.balances.pastAdvance159FlatBalance || 0,
          });
        } else {
          setBalances({
            advanceBalance: 0,
            pendingBalance: 0,
            pastAdvanceBalance: 0,
            pastAdvance50PercentBalance: 0,
            pastAdvance54PercentBalance: 0,
            pastAdvance159FlatBalance: 0,
          });
        }
      } catch {
        setBalances({
          advanceBalance: 0,
          pendingBalance: 0,
          pastAdvanceBalance: 0,
          pastAdvance50PercentBalance: 0,
          pastAdvance54PercentBalance: 0,
          pastAdvance159FlatBalance: 0,
        });
      }
    };
    fetchBalances();
  }, [isOpen, appointment?.patientId, getAuthHeaders]);

  // Fetch consent forms
  useEffect(() => {
    if (!isOpen) return;
    const fetchConsentForms = async () => {
      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get("/api/clinic/consent", { headers });
        if (res.data?.success) setConsentForms(res.data.consents || []);
      } catch (err) {
        console.error("Error fetching consent forms:", err);
      }
    };
    fetchConsentForms();
  }, [isOpen, getAuthHeaders]);

  // Fetch consent statuses
  useEffect(() => {
    if (!isOpen || !appointment?.patientId || !appointment?._id) return;
    const fetchConsentStatuses = async () => {
      setLoadingConsentStatus(true);
      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return;
        
        const [signaturesRes, logsRes] = await Promise.all([
          axios.get("/api/clinic/consent-status", {
            headers,
            params: { patientId: appointment.patientId, appointmentId: appointment._id },
          }),
          axios.get("/api/clinic/consent-log", {
            headers,
            params: { patientId: appointment.patientId, appointmentId: appointment._id },
          }),
        ]);

        const signatures = signaturesRes.data?.consentStatuses || [];
        const logs = logsRes.data?.consentLogs || [];

        const logMap = new Map();
        logs.forEach((log: any) => {
          logMap.set(log.consentFormId, {
            _id: log._id,
            consentFormId: log.consentFormId,
            consentFormName: log.consentFormName,
            description: log.description || "",
            patientName: log.patientName,
            date: new Date(log.createdAt).toLocaleDateString("en-GB"),
            hasSignature: false,
            status: "sent",
            signedAt: null,
          });
        });

        signatures.forEach((sig: any) => {
          logMap.set(sig.consentFormId, {
            ...sig,
            status: "signed",
          });
        });

        setConsentStatuses(Array.from(logMap.values()));
      } catch (err) {
        console.error("Error fetching consent statuses:", err);
      } finally {
        setLoadingConsentStatus(false);
      }
    };
    fetchConsentStatuses();
  }, [isOpen, appointment?.patientId, appointment?._id, getAuthHeaders]);

  // Send Consent Form on WhatsApp
  const handleSendConsentMsgOnWhatsapp = async () => {
    if (!selectedConsentId || !appointment) return;
 
    try {
      setSendingConsent(true);
      
      const patientData = {
        firstName: appointment.patientName?.split(" ")[0] || "",
        lastName: appointment.patientName?.split(" ").slice(1).join(" ") || "",
        mobileNumber: appointment.patientNumber || "",
        email: appointment.patientEmail || "",
        appointmentId: appointment._id,
      };
      
      const encodedPatientData = encodeURIComponent(JSON.stringify(patientData));
      const consentUrl = `https://zeva360.com/consent-form/${selectedConsentId}?patient=${encodedPatientData}`;
 
      await axios.post(
        "/api/messages/send-message",
        {
          patientId: appointment.patientId,
          providerId: "6952256c4a46b2f1eb01be86",
          channel: "whatsapp",
          content: `Please review and sign the consent form by clicking the link below:\n\n ${consentUrl}\n\n Thank you.`,
          mediaUrl: "",
          mediaType: "",
          source: "Zeva",
          messageType: "conversational",
          templateId: "69c38b4d26b8217e1ba78f8a",
          headerParameters: [],
          bodyParameters: [{ type: "text", text: consentUrl }],
          attachments: [],
        },
        { headers: getAuthHeaders() }
      );
 
      setConsentSent(true);
      
      // Log the sent consent form
      try {
        const selectedForm = consentForms.find((f) => f._id === selectedConsentId);
        await axios.post(
          "/api/clinic/consent-log",
          {
            consentFormId: selectedConsentId,
            consentFormName: selectedForm?.formName || "",
            patientId: appointment.patientId,
            patientName: appointment.patientName || "",
            appointmentId: appointment._id,
            sentVia: "whatsapp",
          },
          { headers: getAuthHeaders() }
        );
        
        // Refresh consent statuses
        setTimeout(() => {
          const headers = getAuthHeaders();
          axios.get("/api/clinic/consent-log", {
            headers,
            params: { patientId: appointment.patientId, appointmentId: appointment._id },
          }).then((logsRes) => {
            const logs = logsRes.data?.consentLogs || [];
            const logMap = new Map();
            
            logs.forEach((log: any) => {
              logMap.set(log.consentFormId, {
                _id: log._id,
                consentFormId: log.consentFormId,
                consentFormName: log.consentFormName,
                description: log.description || "",
                patientName: log.patientName,
                date: new Date(log.createdAt).toLocaleDateString("en-GB"),
                hasSignature: false,
                status: "sent",
                signedAt: null,
              });
            });
            
            setConsentStatuses(Array.from(logMap.values()));
          });
        }, 100);
      } catch (logError) {
        console.error("Error logging consent form sent:", logError);
      }
    } catch (error: any) {
      console.error("Error sending consent form:", error?.response?.data || error.message);
    } finally {
      setSendingConsent(false);
    }
  };

  const monthsUntil = (endDate?: string | Date) => {
    if (!endDate) return null;
    try {
      const end = new Date(endDate);
      const now = new Date();
      let months =
        (end.getFullYear() - now.getFullYear()) * 12 +
        (end.getMonth() - now.getMonth());
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
        const response = await axios.get(
          `/api/clinic/billing-history/${appointment.patientId}`,
          { headers },
        );
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

  // Visit count state
  const [visitCount, setVisitCount] = useState<number | null>(null);

  // Fetch membership usage for the patient
  useEffect(() => {
    if (!isOpen || !appointment?.patientId) return;

    const fetchMembershipUsage = async () => {
      setLoadingMembershipUsage(true);
      try {
        const headers = getAuthHeaders();
        const response = await axios.get(
          `/api/clinic/membership-usage/${appointment.patientId}`,
          { headers },
        );
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

  // Fetch visit count from patient-emr-stats
  useEffect(() => {
    if (!isOpen || !appointment?.patientId) return;
    const fetchVisitCount = async () => {
      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get(`/api/clinic/patient-emr-stats/${appointment.patientId}`, { headers });
        if (res.data?.success) {
          setVisitCount(res.data.totalVisits ?? null);
        }
      } catch {
        setVisitCount(null);
      }
    };
    fetchVisitCount();
  }, [isOpen, appointment?.patientId, getAuthHeaders]);

  // Initialize form data from appointment
  useEffect(() => {
    if (appointment && isOpen) {
      const nameParts = appointment.patientName.split(" ");
      setIsDoctorDiscountApplied(false);
      setDoctorDiscount(null);
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

  // Initialize selected treatments from appointment when both are available
  useEffect(() => {
    if (isOpen && appointment && treatments.length > 0 && selectedTreatments.length === 0) {
      const initialTreatments: SelectedTreatment[] = [];
      
      // Handle multiple services (serviceNames / serviceIds)
      if (appointment.serviceNames && appointment.serviceNames.length > 0) {
        appointment.serviceNames.forEach((name, index) => {
          const serviceIdItem = appointment.serviceIds?.[index];
          const slug = typeof serviceIdItem === 'string' ? serviceIdItem : serviceIdItem?._id;
          if (name && slug) {
            // Find matching treatment in the loaded treatments list to get the correct price
            const matchingTreatment = treatments.find(t => t.slug === slug || t.name === name);
            initialTreatments.push({
              treatmentName: name,
              treatmentSlug: slug,
              price: matchingTreatment?.price || 0,
              quantity: 1,
              totalPrice: matchingTreatment?.price || 0,
            });
          }
        });
      } 
      // Fallback to single service (serviceName / serviceId)
      else if (appointment.serviceName && appointment.serviceId) {
   
        const slug = typeof appointment.serviceId === 'string' ? appointment.serviceId : (appointment.serviceId as { _id: string })._id;
        const matchingTreatment = treatments.find(t => t.slug === slug || t.name === appointment.serviceName);
        initialTreatments.push({
          treatmentName: appointment.serviceName,
          treatmentSlug: slug,
          price: matchingTreatment?.price || 0,
          quantity: 1,
          totalPrice: matchingTreatment?.price || 0,
        });
      }

      if (initialTreatments.length > 0) {
        setSelectedTreatments(initialTreatments);
      }
    }
  }, [isOpen, appointment, treatments]);

  // Fetch and override referredBy with patient's referral name when available
  useEffect(() => {
    const fetchReferralName = async () => {
      if (!isOpen || !appointment?.patientId) return;
      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get(
          `/api/staff/get-patient-data/${appointment.patientId}`,
          { headers },
        );
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

  // Fetch doctor's discount information
  useEffect(() => {
    const fetchDoctorDiscount = async () => {
      if (!isOpen || !appointment?.doctorId) return;
      try {
        const headers = getAuthHeaders();
        if (!headers.Authorization) return;
        const res = await axios.get(
          `/api/lead-ms/get-agents?agentId=${appointment.doctorId}`,
          { headers },
        );
        if (res.data.success && res.data.profile) {
          const profile = res.data.profile;
          if (profile.discountType && profile.discountAmount) {
            setDoctorDiscount({
              discountType: profile.discountType,
              discountAmount: parseFloat(profile.discountAmount) || 0,
            });
          }
        }
      } catch (err) {
        console.error("Error fetching doctor discount:", err);
      }
    };
    fetchDoctorDiscount();
  }, [isOpen, appointment?.doctorId, getAuthHeaders]);

  // Smart recommendations fetch disabled
  useEffect(() => {
    // Smart recommendations section removed from UI
  }, [isOpen, appointment?.doctorId, getAuthHeaders]);

  // Fetch active package usage for patient
  useEffect(() => {
    const fetchActivePackageUsage = async () => {
      if (!isOpen || !appointment?.patientId) return;
      const headers = getAuthHeaders();
      if (!headers.Authorization) return;
      
      setLoadingActivePackageUsage(true);
      try {
        const response = await axios.get(
          `/api/clinic/package-usage/${appointment.patientId}`,
          { headers }
        );
        
        if (response.data.success && response.data.packageUsage) {
          setActivePackageUsage(response.data.packageUsage);
          
          // Auto-expand first package
          const firstPkg = response.data.packageUsage[0]?.packageName;
          if (firstPkg) {
            setExpandedPackages({ [firstPkg]: true });
          }
        } else {
          setActivePackageUsage([]);
        }
      } catch (error) {
        console.error("Error fetching active package usage:", error);
        setActivePackageUsage([]);
      } finally {
        setLoadingActivePackageUsage(false);
      }
    };
    
    fetchActivePackageUsage();
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
        .reduce((sum, t) => sum + t.sessionPrice * (t.usedSessions || 0), 0);

      // Round to 2 decimal places
      let finalTotal = Number(computedTotal.toFixed(2));

      // Check if all treatments are selected with their max sessions
      const allTreatmentsSelected = packageTreatmentSessions.every(
        (t) => t.isSelected && t.usedSessions === t.maxSessions,
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
    const membershipTransferredOut =
      membershipUsage?.membershipId &&
      patientDetails?.membershipTransfers?.some(
        (t: any) =>
          t.type === "out" &&
          String(t.membershipId) === String(membershipUsage.membershipId),
      );

    // Check if patient has active membership with free consultations
    if (
      membershipUsage?.hasMembership &&
      !membershipUsage?.isExpired &&
      !membershipTransferredOut
    ) {
      const remainingFreeConsultations = membershipUsage.remainingFreeConsultations || 0;
      const discountPercentage = membershipUsage.discountPercentage || 0;

      // Treatment service
      if (selectedService === "Treatment" && selectedTreatments.length > 0) {
        const sortedTreatments = [...selectedTreatments].sort((a, b) => a.price - b.price);
        let freeAvailable = remainingFreeConsultations;
        let totalFree = 0;
        let totalDiscount = 0;

        const updated = sortedTreatments.map((t) => {
          let usesFree = false;
          let usesDiscount = false;
          
          if (freeAvailable > 0 && t.quantity > 0) {
            const qtyFree = Math.min(t.quantity, freeAvailable);
            if (qtyFree > 0) {
              usesFree = true;
              totalFree += t.price * qtyFree;
              freeAvailable -= qtyFree;
              const remainingQty = t.quantity - qtyFree;
              if (remainingQty > 0 && discountPercentage > 0) {
                usesDiscount = true;
                totalDiscount += (t.price * remainingQty * discountPercentage) / 100;
              }
            }
          } else if (discountPercentage > 0 && t.totalPrice > 0) {
            usesDiscount = true;
            totalDiscount += (t.totalPrice * discountPercentage) / 100;
          }
          return { ...t, usesFreeConsultation: usesFree, usesMembershipDiscount: usesDiscount };
        });

        const map = new Map(updated.map((t: any) => [t.treatmentSlug, t]));
        setSelectedTreatments(prev => prev.map((t: any) => map.get(t.treatmentSlug) || t));
        membershipDiscount = totalDiscount;
        finalTotal = Math.max(0, baseTotal - totalFree - totalDiscount);
      } 
      // Package service - process sessions only when sessions > 0
      else if (selectedService === "Package" && packageTreatmentSessions.some(t => t.isSelected)) {
        const hasSessions = packageTreatmentSessions.some(t => t.isSelected && (t.usedSessions || 0) > 0);
        
        if (hasSessions) {
          const selectedSessions = packageTreatmentSessions
            .filter((t: any) => t.isSelected && (t.usedSessions || 0) > 0)
            .sort((a, b) => a.sessionPrice - b.sessionPrice);
          
          let freeAvailable = remainingFreeConsultations;
          let totalFree = 0;
          let totalDiscount = 0;

          const withFreeInfo = selectedSessions.map((t: any) => {
            const sessions = t.usedSessions || 0;
            let sessionsFree = 0;
            if (freeAvailable > 0 && sessions > 0) {
              sessionsFree = Math.min(sessions, freeAvailable);
              freeAvailable -= sessionsFree;
            }
            return { ...t, sessionsFree, remainingSessions: sessions - sessionsFree };
          });

          // Create a map of updated flags by treatmentSlug
          const sessionUpdates = new Map();
          withFreeInfo.forEach((t: any) => {
            const sf = t.sessionsFree || 0;
            const rs = t.remainingSessions || 0;
            let usesFree = sf > 0;
            let usesDiscount = false;
            
            if (sf > 0) totalFree += t.sessionPrice * sf;
            
            if (rs > 0 && discountPercentage > 0) {
              usesDiscount = true;
              totalDiscount += (t.sessionPrice * rs * discountPercentage) / 100;
            }
            
            sessionUpdates.set(t.treatmentSlug, { usesFreeConsultation: usesFree, usesMembershipDiscount: usesDiscount });
          });

          // Update only the flags in the existing state (don't replace the array)
          setPackageTreatmentSessions(prev => prev.map((t: any) => {
            const update = sessionUpdates.get(t.treatmentSlug);
            if (update) {
              return { ...t, ...update };
            }
            return { ...t, usesFreeConsultation: false, usesMembershipDiscount: false };
          }));

          membershipDiscount = totalDiscount;
          finalTotal = Math.max(0, baseTotal - totalFree - totalDiscount);
        }
      } else if (remainingFreeConsultations > 0 && baseTotal > 0) {
        finalTotal = 0;
      } else if (discountPercentage > 0 && baseTotal > 0) {
        membershipDiscount = (baseTotal * discountPercentage) / 100;
        finalTotal = baseTotal - membershipDiscount;
      }
    }

    // Apply doctor discount if applicable
    if (isDoctorDiscountApplied && doctorDiscount && finalTotal > 0) {
      if (doctorDiscount.discountType === "percentage") {
        const discountVal = (finalTotal * doctorDiscount.discountAmount) / 100;
        finalTotal = Math.max(0, finalTotal - discountVal);
      } else if (doctorDiscount.discountType === "fixed_amount") {
        finalTotal = Math.max(0, finalTotal - doctorDiscount.discountAmount);
      }
    }

    setTotalPrice(finalTotal);
    setFormData((prev) => ({
      ...prev,
      discountedAmount: finalTotal.toFixed(2),
      originalAmount: baseTotal.toFixed(2),
      // Auto-set paid to 0.00 if total is 0 (free consultation)
      paid: finalTotal === 0 ? "0.00" : prev.paid,
    }));
  }, [
    selectedTreatments,
    selectedPackage,
    selectedService,
    packageTreatmentSessions,
    membershipUsage,
    isDoctorDiscountApplied,
    doctorDiscount,
  ]);

  // Override displayed invoice total to include previous pending
  useEffect(() => {
    const discountedTotal = parseFloat(formData.discountedAmount || "0") || 0;
    
    // Always ensure amount has a value - either with previous pending or just the discounted total
    const invoiceTotal = Number(
      (discountedTotal + (balances.pendingBalance || 0)).toFixed(2),
    );
    
    console.log("Adding previous pending:", {
      discountedTotal,
      previousPending: balances.pendingBalance,
      invoiceTotal,
      currentAmount: formData.amount
    });
    
    // Only update if the amount has changed to avoid infinite loops
    if (Math.abs(parseFloat(formData.amount || "0") - invoiceTotal) > 0.001) {
      setFormData((prev) => ({
        ...prev,
        amount: invoiceTotal.toFixed(2),
      }));
    }
  }, [balances.pendingBalance, formData.discountedAmount]);

  // Auto-calc pending/advance considering applied advance balances
  useEffect(() => {
    const amountNum = parseFloat(formData.amount) || 0;
    const discountedAmount = parseFloat(formData.discountedAmount || "0") || 0;
    
    // Calculate how much previous pending is being rolled into this billing
    const pendingBeingRolledIn = Math.max(0, amountNum - discountedAmount);

    // Calculate applied credits
    const appliedAdvance = applyAdvance
      ? Math.min(balances.advanceBalance || 0, amountNum)
      : 0;
    const appliedPastAdvance50Percent = applyPastAdvance50Percent
      ? Math.min(balances.pastAdvance50PercentBalance || 0, amountNum - appliedAdvance)
      : 0;
    const appliedPastAdvance54Percent = applyPastAdvance54Percent
      ? Math.min(balances.pastAdvance54PercentBalance || 0, amountNum - appliedAdvance - appliedPastAdvance50Percent)
      : 0;
    const appliedPastAdvance159Flat = applyPastAdvance159Flat
      ? Math.min(balances.pastAdvance159FlatBalance || 0, amountNum - appliedAdvance - appliedPastAdvance50Percent - appliedPastAdvance54Percent)
      : 0;

    const totalPastAdvanceUsed =
      appliedPastAdvance50Percent +
      appliedPastAdvance54Percent +
      appliedPastAdvance159Flat;

    // 2. Net Due (Remaining amount to be paid after credits)
    const netDue = Math.max(
      0,
      amountNum - appliedAdvance - totalPastAdvanceUsed,
    );

    // 3. Determine how much is actually being paid today (Cash/Card etc)
    let paidNum: number;
    if (useMultiplePayments) {
      paidNum = multiplePayments.reduce(
        (sum, mp) => sum + (parseFloat(mp.amount) || 0),
        0,
      );
    } else {
      // If we just toggled an advance checkbox, we usually set paid to 0
      // because the bill is covered by credit.
      // But if the user types a value, we respect it.
      paidNum = Math.max(0, parseFloat(formData.paid) || 0);
    }

    // 4. Calculate Pending and New Advance
    let pendingVal = 0;
    let advanceVal = 0;

    if (paidNum > netDue) {
      advanceVal = paidNum - netDue;
      pendingVal = 0;
    } else {
      advanceVal = 0;
      pendingVal = netDue - paidNum;
    }

    setFormData((prev) => {
      const updates: any = {
        pending: pendingVal.toFixed(2),
        advance: advanceVal.toFixed(2),
        advanceUsed: appliedAdvance.toFixed(2),
        pastAdvanceUsed: totalPastAdvanceUsed.toFixed(2),
        pastAdvanceUsed50Percent: appliedPastAdvance50Percent.toFixed(2),
        pastAdvanceUsed54Percent: appliedPastAdvance54Percent.toFixed(2),
        pastAdvanceUsed159Flat: appliedPastAdvance159Flat.toFixed(2),
        // Track previous pending being rolled into this billing
        pendingUsed: pendingBeingRolledIn.toFixed(2),
      };

      // Auto-set paid when advance is applied
      if (
        applyAdvance ||
        applyPastAdvance50Percent ||
        applyPastAdvance54Percent ||
        applyPastAdvance159Flat
      ) {
        if (prev.paid === prev.amount || prev.paid === "" || prev.paid === "0.00") {
          if (netDue === 0) {
            updates.paid = "0.00";
          } else {
            updates.paid = netDue.toFixed(2);
          }
        }
      }

      // Sync multi-pay paid amount if applicable
      if (useMultiplePayments) {
        updates.paid = paidNum.toFixed(2);
      }

      // Check if we need to update to avoid infinite loops
      const hasChanges =
        updates.pending !== prev.pending ||
        updates.advance !== prev.advance ||
        updates.advanceUsed !== prev.advanceUsed ||
        updates.pastAdvanceUsed !== prev.pastAdvanceUsed ||
        updates.pastAdvanceUsed50Percent !== prev.pastAdvanceUsed50Percent ||
        updates.pastAdvanceUsed54Percent !== prev.pastAdvanceUsed54Percent ||
        updates.pastAdvanceUsed159Flat !== prev.pastAdvanceUsed159Flat ||
        (updates.paid !== undefined && updates.paid !== prev.paid);

      if (!hasChanges) return prev;
      return { ...prev, ...updates };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    formData.amount,
    formData.paid,
    applyAdvance,
    applyPastAdvance50Percent,
    applyPastAdvance54Percent,
    applyPastAdvance159Flat,
    balances.advanceBalance,
    balances.pastAdvanceBalance,
    balances.pastAdvance50PercentBalance,
    balances.pastAdvance54PercentBalance,
    balances.pastAdvance159FlatBalance,
    useMultiplePayments,
    multiplePayments,
  ]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        treatmentDropdownRef.current &&
        !treatmentDropdownRef.current.contains(event.target as Node)
      ) {
        setTreatmentDropdownOpen(false);
      }
      if (
        packageDropdownRef.current &&
        !packageDropdownRef.current.contains(event.target as Node)
      ) {
        setPackageDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle treatment selection
  const handleTreatmentToggle = (treatment: Treatment, showNotification = false) => {
    const existingIndex = selectedTreatments.findIndex(
      (t) => t.treatmentSlug === treatment.slug,
    );

    if (existingIndex >= 0) {
      // Remove treatment
      setSelectedTreatments((prev) =>
        prev.filter((_, i) => i !== existingIndex),
      );
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
      
      // Show notification if requested (e.g., from Smart Recommendations)
      if (showNotification) {
        setJustAddedServiceName(treatment.name);
        setTimeout(() => setJustAddedServiceName(null), 3000);
      }
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
          : t,
      ),
    );
  };

  // Remove a selected treatment
  const handleRemoveSelectedTreatment = (slug: string) => {
    setSelectedTreatments((prev) =>
      prev.filter((t) => t.treatmentSlug !== slug),
    );
  };

  // Toggle package expansion
  const togglePackageExpansion = (pkgName: string) => {
    setExpandedPackages(prev => ({
      ...prev,
      [pkgName]: !prev[pkgName]
    }));
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
          { headers },
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
      let usageDetails: Array<{
        invoiceNumber: string;
        sessions: number;
        date: string;
      }> = [];

      if (fetchedUsageData?.treatments) {
        const usageInfo = fetchedUsageData.treatments.find(
          (usage: any) => usage.treatmentSlug === t.treatmentSlug,
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
          return {
            ...t,
            isSelected: newSelected,
            usedSessions: newSelected ? t.usedSessions : 0,
          };
        }
        return t;
      }),
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
      }),
    );
  };

  // Handle form submission
  const generateInvoicePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(20, 184, 166); // teal-600
      doc.setFont("helvetica", "bold");
      doc.text("ZEVA CLINIC", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("helvetica", "normal");
      doc.text("Billing Statement / Invoice", 14, 26);

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("INVOICE", pageWidth - 14, 20, { align: "right" });

      const today = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      doc.setFontSize(9);
      doc.text(`Date: ${today}`, pageWidth - 14, 26, { align: "right" });
      doc.text(
        `Invoice #: ${formData.invoiceNumber || "-"}`,
        pageWidth - 14,
        31,
        { align: "right" },
      );

      // Patient Details
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(14, 36, pageWidth - 14, 36);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("PATIENT INFORMATION", 14, 44);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(
        `Name: ${appointment?.patientName || "-"}`,
        14,
        50,
      );
      doc.text(`Patient ID: ${appointment?.patientId || "-"}`, 14, 55);
      doc.text(`EMR No: ${appointment?.emrNumber || "-"}`, 14, 60);

      doc.text(
        `Mobile: ${appointment?.patientNumber || "-"}`,
        pageWidth / 2,
        50,
      );
      doc.text(`Email: ${appointment?.patientEmail || "-"}`, pageWidth / 2, 55);
      doc.text(`Gender: ${appointment?.gender || "-"}`, pageWidth / 2, 60);

      // Billing Details Table
      const tableRows = [];
      if (selectedService === "Treatment") {
        selectedTreatments.forEach((t) => {
          tableRows.push([
            t.treatmentName,
            "Treatment",
            t.quantity.toString(),
            `AED ${t.price.toFixed(2)}`,
            `AED ${t.totalPrice.toFixed(2)}`,
          ]);
        });
      } else if (selectedService === "Package") {
        const selectedPackageTreatments = packageTreatmentSessions.filter(
          (t) => t.isSelected,
        );
        tableRows.push([
          selectedPackage?.name || "-",
          "Package",
          "1",
          `AED ${selectedPackage?.totalPrice.toFixed(2) || "0.00"}`,
          `AED ${selectedPackage?.totalPrice.toFixed(2) || "0.00"}`,
        ]);
        selectedPackageTreatments.forEach((t) => {
          tableRows.push([
            `  • ${t.treatmentName}`,
            "Session",
            t.usedSessions.toString(),
            "-",
            "-",
          ]);
        });
      }

      autoTable(doc, {
        startY: 70,
        head: [["Description", "Type", "Qty/Sessions", "Unit Price", "Total"]],
        body: tableRows,
        theme: "striped",
        headStyles: {
          fillColor: [31, 41, 55], // Gray-800
          fontSize: 9,
          fontStyle: "bold",
        },
        bodyStyles: { fontSize: 9 },
        columnStyles: {
          3: { halign: "right" },
          4: { halign: "right" },
        },
      });

      // Split Payment Details (if any)
      let currentY = (doc as any).lastAutoTable.finalY + 10;
      const effectivePayments = useMultiplePayments 
        ? multiplePayments.filter(p => parseFloat(p.amount) > 0)
        : [{ paymentMethod: formData.paymentMethod, amount: formData.paid }];

      if (effectivePayments.length > 0) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(31, 41, 55);
        doc.text("PAYMENT BREAKDOWN", 14, currentY);
        currentY += 6;

        const paymentRows = effectivePayments.map((p: any) => [
          p.paymentMethod, 
          `AED ${parseFloat(p.amount || "0").toFixed(2)}`
        ]);

        autoTable(doc, {
          startY: currentY,
          head: [["Payment Method", "Amount"]],
          body: paymentRows,
          theme: "plain",
          headStyles: { fontSize: 8, fontStyle: "bold", fillColor: [243, 244, 246] },
          bodyStyles: { fontSize: 8 },
          margin: { left: 14 },
          tableWidth: 80,
        });
        currentY = (doc as any).lastAutoTable.finalY + 10;
      }

      // Summary Section
      const finalY = currentY;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.text("SUMMARY", pageWidth - 70, finalY);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Total Amount:", pageWidth - 70, finalY + 6);
      doc.text(
        `AED ${parseFloat(formData.amount || "0").toFixed(2)}`,
        pageWidth - 14,
        finalY + 6,
        { align: "right" },
      );

      doc.text("Paid Amount:", pageWidth - 70, finalY + 11);
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text(
        `AED ${parseFloat(formData.paid || "0").toFixed(2)}`,
        pageWidth - 14,
        finalY + 11,
        { align: "right" },
      );

      doc.setTextColor(220, 38, 38); // red-600
      doc.setFont("helvetica", "bold");
      doc.text("Outstanding:", pageWidth - 70, finalY + 16);
      doc.text(
        `AED ${parseFloat(formData.pending || "0").toFixed(2)}`,
        pageWidth - 14,
        finalY + 16,
        { align: "right" },
      );

      // Notes
      if (formData.notes) {
        doc.setTextColor(71, 85, 105); // slate-600
        doc.setFont("helvetica", "bold");
        doc.text("NOTES", 14, finalY + 30);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        const splitNotes = doc.splitTextToSize(formData.notes, pageWidth - 28);
        doc.text(splitNotes, 14, finalY + 35);
      }

      // Footer
      const pageCount = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          `Page ${i} of ${pageCount} | ZEVA Clinic Management System`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: "center" },
        );
      }

      doc.save(
        `Invoice_${appointment?.patientName || "Patient"}_${new Date().getTime()}.pdf`,
      );
    } catch (err) {
      console.error("PDF generation error:", err);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    console.log("Submitting billing with formData:", {
      amount: formData.amount,
      discountedAmount: formData.discountedAmount,
      paid: formData.paid,
      pending: formData.pending,
      pendingUsed: formData.pendingUsed,
    });

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
        setErrors({
          general: `Please fill all required fields: ${missingList}`,
          ...fieldErrors,
        });
        setLoading(false);
        return;
      }

      if (selectedService === "Treatment" && selectedTreatments.length === 0) {
        setErrors({
          general: "Please select at least one treatment",
          treatment: "Select at least one treatment",
        });
        setLoading(false);
        return;
      }

      if (selectedService === "Package" && !selectedPackage) {
        setErrors({
          general: "Please select a package",
          package: "Select a package",
        });
        setLoading(false);
        return;
      }

      if (selectedService === "Package" && selectedPackage) {
        // Check if at least one treatment is selected
        const hasSelectedTreatment = packageTreatmentSessions.some(
          (t) => t.isSelected,
        );
        if (!hasSelectedTreatment) {
          setErrors({
            general: "Please select at least one treatment from the package",
            packageTreatments: "Select at least one treatment",
          });
          setLoading(false);
          return;
        }
        // Check if selected treatments have valid sessions
        const invalidSessions = packageTreatmentSessions.filter((t) => {
          if (!t.isSelected) return false;
          const availableSessions = t.maxSessions - t.previouslyUsedSessions;
          return t.usedSessions < 1 || t.usedSessions > availableSessions;
        });
        if (invalidSessions.length > 0) {
          const sessionErrors: Record<string, string> = {};
          invalidSessions.forEach((t) => {
            const availableSessions = t.maxSessions - t.previouslyUsedSessions;
            sessionErrors[`packageSession_${t.treatmentSlug}`] =
              `Enter 1–${availableSessions} (${t.previouslyUsedSessions} already used)`;
          });
          setErrors({
            general: "Please enter valid sessions for selected treatments",
            ...sessionErrors,
          });
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
      const baseAmount =
        parseFloat(formData.originalAmount || formData.amount) || 0;
      const finalAmount = parseFloat(formData.amount) || 0;
      let isFreeConsultation = false;
      let freeConsultationCount = 0;
      let membershipDiscountApplied = 0;

      // Check if membership was transferred out
      const membershipTransferredOut =
        membershipUsage?.membershipId &&
        patientDetails?.membershipTransfers?.some(
          (t: any) =>
            t.type === "out" &&
            String(t.membershipId) === String(membershipUsage.membershipId),
        );

      if (
        membershipUsage?.hasMembership &&
        !membershipUsage?.isExpired &&
        !membershipTransferredOut
      ) {
        const hasRemainingFreeConsultations =
          membershipUsage.remainingFreeConsultations > 0;
        const discountPercentage = membershipUsage.discountPercentage || 0;

        if (hasRemainingFreeConsultations) {
          // This is a free consultation
          isFreeConsultation = true;
          freeConsultationCount =
            selectedService === "Treatment"
              ? selectedTreatments.reduce((sum, t) => sum + t.quantity, 0)
              : packageTreatmentSessions
                  .filter((t) => t.isSelected)
                  .reduce((sum, t) => sum + t.usedSessions, 0);
        } else if (discountPercentage > 0 && baseAmount > 0) {
          // Calculate discount applied
          membershipDiscountApplied = (baseAmount * discountPercentage) / 100;
        }
      }

      // Calculate doctor discount applied
      let doctorDiscountApplied = 0;
      if (isDoctorDiscountApplied && doctorDiscount) {
        const amountAfterMembership =
          baseAmount - (membershipDiscountApplied || 0);
        if (doctorDiscount.discountType === "percentage") {
          doctorDiscountApplied =
            (amountAfterMembership * doctorDiscount.discountAmount) / 100;
        } else if (doctorDiscount.discountType === "fixed_amount") {
          doctorDiscountApplied = doctorDiscount.discountAmount;
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
        pastAdvanceUsed: parseFloat(formData.pastAdvanceUsed) || 0,
        pastAdvanceUsed50Percent:
          parseFloat(formData.pastAdvanceUsed50Percent) || 0,
        pastAdvanceUsed54Percent:
          parseFloat(formData.pastAdvanceUsed54Percent) || 0,
        pastAdvanceUsed159Flat:
          parseFloat(formData.pastAdvanceUsed159Flat) || 0,
        pendingUsed: parseFloat(formData.pendingUsed || "0") || 0,
        pending: parseFloat(formData.pending || "0") || 0,
        advance: parseFloat(formData.advance) || 0,
        pastAdvance: parseFloat(formData.pastAdvance) || 0,
        pastAdvanceType: applyPastAdvance50Percent
          ? "50% Offer"
          : applyPastAdvance54Percent
            ? "54% Offer"
            : applyPastAdvance159Flat
              ? "159 Flat"
              : "",
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        emrNumber: formData.emrNumber,
        userId: appointment.patientId, // Pass patient ID from appointment
        // Multiple payment methods
        multiplePayments: useMultiplePayments
          ? multiplePayments
              .filter((mp) => parseFloat(mp.amount) > 0)
              .map((mp) => ({
                paymentMethod: mp.paymentMethod,
                amount: parseFloat(mp.amount) || 0,
              }))
          : [],
        // Membership tracking fields
        isFreeConsultation,
        freeConsultationCount,
        membershipDiscountApplied,
        doctorDiscountApplied,
        isDoctorDiscountApplied,
        originalAmount: baseAmount,
      };

      if (selectedService === "Treatment") {
        // For treatment, send all selected treatments with their quantities
        const totalQuantity = selectedTreatments.reduce(
          (sum, t) => sum + t.quantity,
          0,
        );
        payload.treatment = selectedTreatments
          .map((t) => t.treatmentName)
          .join(", ");
        payload.quantity = totalQuantity;
      } else {
        // For package, only send selected treatments and their sessions
        const selectedTreatmentsFromPackage = packageTreatmentSessions.filter(
          (t) => t.isSelected,
        );
        payload.package = selectedPackage?.name || "";
        payload.sessions = selectedTreatmentsFromPackage.reduce(
          (sum, t) => sum + t.usedSessions,
          0,
        );
        // Store which treatments were selected
        payload.selectedPackageTreatments = selectedTreatmentsFromPackage.map(
          (t) => ({
            treatmentName: t.treatmentName,
            treatmentSlug: t.treatmentSlug,
            sessions: t.usedSessions,
          }),
        );
        // For user packages, also send the patientPackageId
        if (selectedPackage?.isUserPackage && selectedPackage?.patientPackageId) {
          payload.patientPackageId = selectedPackage.patientPackageId;
          payload.isUserPackage = true;
        }
      }

      const response = await axios.post(
        "/api/clinic/create-patient-registration",
        payload,
        { headers },
      );

      if (response.data.success) {
        // Refresh billing history and balances after successful creation
        if (appointment?.patientId) {
          try {
            const headers = getAuthHeaders();
            const [historyResponse, balanceResponse] = await Promise.all([
              axios.get(
                `/api/clinic/billing-history/${appointment.patientId}`,
                { headers },
              ),
              axios.get(
                `/api/clinic/patient-balance/${appointment.patientId}`,
                { headers },
              ),
            ]);
            if (historyResponse.data.success) {
              setBillingHistory(historyResponse.data.billings || []);
            }
            if (
              balanceResponse.data?.success &&
              balanceResponse.data?.balances
            ) {
              setBalances({
                advanceBalance:
                  balanceResponse.data.balances.advanceBalance || 0,
                pendingBalance:
                  balanceResponse.data.balances.pendingBalance || 0,
                pastAdvanceBalance:
                  balanceResponse.data.balances.pastAdvanceBalance || 0,
                pastAdvance50PercentBalance:
                  balanceResponse.data.balances.pastAdvance50PercentBalance ||
                  0,
                pastAdvance54PercentBalance:
                  balanceResponse.data.balances.pastAdvance54PercentBalance ||
                  0,
                pastAdvance159FlatBalance:
                  balanceResponse.data.balances.pastAdvance159FlatBalance || 0,
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
        setMultiplePayments([
          { paymentMethod: "Cash", amount: "" },
          { paymentMethod: "Card", amount: "" },
        ]);
        generateInvoiceNumber();
      } else {
        setErrors({
          general: response.data.message || "Failed to create billing",
        });
      }
    } catch (error: any) {
      console.error("Error creating billing:", error);
      setErrors({
        general: error.response?.data?.message || "Failed to create billing",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !appointment) return null;

  const filteredTreatments = treatments.filter((t) => {
    if (!treatmentSearchQuery.trim()) {
      return t.type === "sub";
    }
    const query = treatmentSearchQuery.toLowerCase();
    if (t.type === "sub") {
      return (
        t.name.toLowerCase().includes(query) ||
        t.mainTreatment?.toLowerCase().includes(query) ||
        false
      );
    }
    return false;
  });

  // Combine regular packages with userPackages for the dropdown
  const allPackagesForDropdown: Package[] = [
    ...packages.map((pkg: any) => ({ ...pkg, isUserPackage: false })),
    ...userPackages.map((pkg: any) => ({
      _id: pkg._id,
      name: pkg.packageName,
      totalPrice: pkg.totalPrice,
      totalSessions: pkg.totalSessions,
      sessionPrice: pkg.sessionPrice || (pkg.totalSessions > 0 ? pkg.totalPrice / pkg.totalSessions : 0),
      treatments: pkg.treatments || [],
      isUserPackage: true,
      remainingSessions: pkg.remainingSessions,
      patientPackageId: pkg.patientPackageId,
    })),
  ];

  const filteredAllPackages = allPackagesForDropdown.filter((pkg) => {
    if (!packageSearchQuery.trim()) return false;
    const query = packageSearchQuery.toLowerCase();
    return pkg.name.toLowerCase().includes(query);
  });

  // Last 3 billing invoices for Payment History section
  const last3Billings = billingHistory.slice(0, 3);

  // Use API values for pending and advance balance display at top
  const apiPendingBalance = balances.pendingBalance || 0;
  const apiAdvanceBalance = (balances.advanceBalance || 0) + 
                            (balances.pastAdvance50PercentBalance || 0) + 
                            (balances.pastAdvance54PercentBalance || 0) + 
                            (balances.pastAdvance159FlatBalance || 0);
  


  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-1 sm:p-2 bg-black/50 backdrop-blur-md transition-all duration-300 animate-in fade-in">
        <div
          className="bg-white rounded-xl shadow-2xl w-full  max-h-[96vh] overflow-hidden flex flex-col transform transition-all duration-300 scale-100 opacity-100 animate-in slide-in-from-bottom-4 zoom-in-95"
          style={{ minHeight: "600px" }}
        >
          {/* ── NEW HEADER ── */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-start justify-between gap-4">
              {/* Left: Patient Info */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-base flex-shrink-0">
                  {appointment.patientName?.charAt(0)?.toUpperCase() || "P"}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900 leading-tight">
                    {appointment.patientName || "-"}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{appointment.emrNumber && `MRN: ${appointment.emrNumber}`}</div>
                </div>
              </div>
          
              {/* Center: Invoice + Appointment Details */}
              <div className="flex items-center gap-6 text-center flex-shrink-0">
                <div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider">Invoice Number</div>
                  <div className="text-xs font-bold text-gray-800">{formData.invoiceNumber || "-"}</div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider">Date</div>
                  <div className="text-xs font-semibold text-gray-800">
                    {formData.invoicedDate ? new Date(formData.invoicedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-"}
                  </div>
                </div>
                <div>
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider">Doctor</div>
                  <div className="text-xs font-semibold text-gray-800">{appointment.doctorName || "-"}</div>
                </div>
                {appointment.startDate && (
                  <div>
                    <div className="text-[9px] text-gray-400 uppercase tracking-wider">Apt. Date</div>
                    <div className="text-xs font-semibold text-gray-800">
                      {new Date(appointment.startDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </div>
                  </div>
                )}
                {(appointment.fromTime || appointment.toTime) && (
                  <div>
                    <div className="text-[9px] text-gray-400 uppercase tracking-wider">Time</div>
                    <div className="text-xs font-semibold text-gray-800">
                      {appointment.fromTime}{appointment.toTime ? `–${appointment.toTime}` : ""}
                    </div>
                  </div>
                )}
                
                {/* Send Consent Form Option */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedConsentId}
                    onChange={(e) => { setSelectedConsentId(e.target.value); setConsentSent(false); }}
                    disabled={sendingConsent}
                    className="text-[10px] border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-300 max-w-[120px]"
                  >
                    <option value="">Select Consent</option>
                    {consentForms.map((form) => (
                      <option key={form._id} value={form._id}>
                        {form.formName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleSendConsentMsgOnWhatsapp}
                    disabled={!selectedConsentId || sendingConsent}
                    className="flex items-center gap-1 px-2 py-1 text-[9px] bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {sendingConsent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    {consentSent ? "Sent" : "Send"}
                  </button>
                </div>

                {/* Generate Invoice Button */}
                <button
                  type="button"
                  onClick={generateInvoicePDF}
                  disabled={isGeneratingPDF || (!selectedTreatments.length && !selectedPackage)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] bg-teal-600 text-white rounded hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-semibold shadow-sm"
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <FileText className="w-3.5 h-3.5" />
                  )}
                  {isGeneratingPDF ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
          
              {/* Right: Pending, Advance, Visits */}
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider">Pending</div>
                  <div className={`text-sm font-bold ${apiPendingBalance > 0 ? "text-red-600" : "text-gray-400"}`}>
                    AED {apiPendingBalance.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider">Advance</div>
                  <div className={`text-sm font-bold ${apiAdvanceBalance > 0 ? "text-emerald-600" : "text-gray-400"}`}>
                    AED {apiAdvanceBalance.toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[9px] text-gray-400 uppercase tracking-wider">Visits</div>
                  <div className="text-sm font-bold text-blue-600">
                    {visitCount !== null ? visitCount : <span className="text-gray-400">–</span>}
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-gray-100 rounded transition-all text-gray-500 hover:text-gray-800 ml-2"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── BODY ── */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50 scrollbar-hide">
            <form
              id="billing-form"
              onSubmit={handleSubmit}
              className="p-6 space-y-4"
            >
              {errors.general && (
                <div className="bg-red-50 border-l-2 border-red-500 rounded p-2 flex items-start gap-2 text-red-700 shadow-sm animate-in slide-in-from-top-2 fade-in" role="alert">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 animate-pulse" />
                  <p className="text-xs font-medium">{errors.general}</p>
                </div>
              )}

              {/* ── TWO-COLUMN LAYOUT: Left = Service Type | Right = Membership + Active Packages ── */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* ── LEFT COLUMN: Service Type (spans 2 of 3) ── */}
                <div className="lg:col-span-2 space-y-3">

                  {/* Service Type selector */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-3">
                      Service Type <span className="text-red-500">*</span>
                    </h3>

                    {/* Radio toggle */}
                    <div className="flex gap-4 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          value="Treatment"
                          checked={selectedService === "Treatment"}
                          onChange={(e) => { setSelectedService(e.target.value as "Treatment"); setFormData((prev) => ({ ...prev, service: "Treatment" })); }}
                          className="w-3.5 h-3.5 text-teal-600 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">Treatment</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="radio"
                          value="Package"
                          checked={selectedService === "Package"}
                          onChange={(e) => { setSelectedService(e.target.value as "Package"); setFormData((prev) => ({ ...prev, service: "Package" })); }}
                          className="w-3.5 h-3.5 text-teal-600 cursor-pointer"
                        />
                        <span className="text-xs font-medium text-gray-700 group-hover:text-gray-900">Package</span>
                      </label>
                    </div>

                    {/* Membership Free Consultation banner (hide if transferred out) */}
                    {loadingMembershipUsage && (
                      <div className="rounded-lg border p-2 mb-3 bg-gray-50 border-gray-200 text-xs text-gray-600 flex items-center gap-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />
                        Loading membership usage...
                      </div>
                    )}
                    {membershipUsage?.hasMembership && !membershipUsage?.isExpired && membershipUsage?.hasFreeConsultations && !isMembershipTransferredOut() && (
                      <div className={`rounded-lg border p-2 mb-3 ${
                        membershipUsage.remainingFreeConsultations > 0 ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
                      }`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-gray-900">{membershipUsage.membershipName} – Free Consultations</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            membershipUsage.remainingFreeConsultations > 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}>
                            {membershipUsage.remainingFreeConsultations > 0 ? `${membershipUsage.remainingFreeConsultations} Remaining` : "All Used"}
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              membershipUsage.remainingFreeConsultations > 0 ? "bg-emerald-500" : "bg-amber-500"
                            }`}
                            style={{ width: `${Math.min((membershipUsage.usedFreeConsultations / membershipUsage.totalFreeConsultations) * 100, 100)}%` }}
                          />
                        </div>
                        {membershipUsage.remainingFreeConsultations > 0 && (
                          <p className="mt-1 text-[10px] text-emerald-700">This session will be free. No charge applied.</p>
                        )}
                        {membershipUsage.remainingFreeConsultations === 0 && (
                          <p className="mt-1 text-[10px] text-amber-700">
                            All consultations used.{membershipUsage.discountPercentage > 0 ? ` ${membershipUsage.discountPercentage}% discount will apply.` : " Regular pricing applies."}
                          </p>
                        )}
                      </div>
                    )}
                    {membershipUsage?.hasMembership && membershipUsage?.isExpired && (
                      <div className="rounded-lg border bg-red-50 border-red-200 p-2 mb-3 text-xs text-red-700">
                        <span className="font-semibold">{membershipUsage.membershipName}</span> – Membership expired. Regular pricing applies.
                      </div>
                    )}
                    {membershipUsage?.hasMembership && !membershipUsage?.isExpired && !membershipUsage?.hasFreeConsultations && membershipUsage?.discountPercentage > 0 && (
                      <div className="rounded-lg border bg-blue-50 border-blue-200 p-2 mb-3 text-xs text-blue-700">
                        <span className="font-semibold">{membershipUsage.membershipName}</span> – {membershipUsage.discountPercentage}% discount applied automatically.
                      </div>
                    )}

                    {/* Notification for recently added service from Smart Recommendations */}
                    {justAddedServiceName && (
                      <div className="rounded-lg border bg-emerald-50 border-emerald-200 p-2 mb-3 text-xs text-emerald-700 flex items-center gap-2 animate-in slide-in-from-top-2 fade-in">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold">{justAddedServiceName}</span> added to Treatment & Billing!
                      </div>
                    )}

                    {/* Treatment Selection */}
                    {selectedService === "Treatment" && (
                      <div className="relative z-20">
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Select Treatment <span className="text-red-500">*</span></label>
                        <div className="relative" ref={treatmentDropdownRef}>
                          <button
                            type="button"
                            onClick={() => { setTreatmentDropdownOpen(!treatmentDropdownOpen); if (!treatmentDropdownOpen) setTreatmentSearchQuery(""); }}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 hover:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <span className="text-gray-500">
                              {selectedTreatments.length > 0 ? `${selectedTreatments.length} treatment(s) selected` : "Click to select treatments..."}
                            </span>
                            <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${treatmentDropdownOpen ? "rotate-180" : ""}`} />
                          </button>
                          {treatmentDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
                              <div className="p-1.5 border-b border-gray-200 sticky top-0 bg-white">
                                <input
                                  type="text" placeholder="Search treatments..."
                                  value={treatmentSearchQuery}
                                  onChange={(e) => { e.stopPropagation(); setTreatmentSearchQuery(e.target.value); }}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Escape") setTreatmentDropdownOpen(false); }}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500"
                                  autoFocus
                                />
                              </div>
                              <div className="overflow-y-auto max-h-56">
                                {filteredTreatments.length === 0 ? (
                                  <div className="p-2 text-center text-xs text-gray-500">
                                    {treatmentSearchQuery.trim() ? "No treatments found" : "No treatments available"}
                                  </div>
                                ) : (
                                  <div className="p-1">
                                    {filteredTreatments.map((treatment) => {
                                      const isSelected = selectedTreatments.some((t) => t.treatmentSlug === treatment.slug);
                                      return (
                                        <button
                                          key={treatment.slug} type="button"
                                          onClick={(e) => { e.stopPropagation(); handleTreatmentToggle(treatment); }}
                                          onMouseDown={(e) => e.preventDefault()}
                                          className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${isSelected ? "bg-teal-50 text-teal-700 font-medium" : "text-gray-700 hover:bg-gray-50"}`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span>
                                              {treatment.name}
                                              {treatment.mainTreatment && <span className="text-gray-400 ml-1">({treatment.mainTreatment})</span>}
                                            </span>
                                            {isSelected && <span className="text-teal-600">✓</span>}
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

                        {/* Selected treatments with quantity & toggle */}
                        {selectedTreatments.length > 0 && (
                          <div className="mt-3 space-y-2">
                            {selectedTreatments.map((treatment) => {
                              const isJustAdded = justAddedServiceName && treatment.treatmentName === justAddedServiceName;
                              return (
                                <div
                                  key={treatment.treatmentSlug}
                                  className={`bg-white border rounded-xl p-3 shadow-sm transition-all duration-500 ${
                                    isJustAdded ? "border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200" : "border-gray-200"
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {/* Toggle (enable/disable treatment in invoice) */}
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveSelectedTreatment(treatment.treatmentSlug)}
                                        className="relative w-8 h-5 rounded-full bg-teal-500 transition-colors flex-shrink-0"
                                        title="Remove treatment"
                                      >
                                        <span className="absolute right-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow" />
                                      </button>
                                      <div className="min-w-0">
                                        <div className="text-xs font-semibold text-gray-900 truncate">{treatment.treatmentName}</div>
                                        <div className="text-[10px] text-gray-500">Dr. {appointment.doctorName}</div>
                                        {(treatment.usesFreeConsultation || treatment.usesMembershipDiscount) && (
                                          <div className="flex items-center gap-1 mt-0.5">
                                            {treatment.usesFreeConsultation && (
                                              <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">Free</span>
                                            )}
                                            {treatment.usesMembershipDiscount && (
                                              <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">{membershipUsage?.discountPercentage || 10}% Off</span>
                                            )}
                                          </div>
                                        )}
                                        {isJustAdded && (
                                          <div className="text-[9px] text-emerald-600 font-semibold mt-0.5 flex items-center gap-1">
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                            </svg>
                                            Just added from Smart Recommendations
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {/* Qty control */}
                                      <button type="button" onClick={() => handleQuantityChange(treatment.treatmentSlug, Math.max(1, treatment.quantity - 1))} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">−</button>
                                      <span className="text-xs font-semibold text-gray-900 w-5 text-center">{treatment.quantity}</span>
                                      <button type="button" onClick={() => handleQuantityChange(treatment.treatmentSlug, treatment.quantity + 1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">+</button>
                                      <span className="text-[10px] text-gray-500 ml-1">@ AED {treatment.price.toFixed(2)} each</span>
                                      <span className="text-xs font-bold text-gray-900 ml-2">AED {treatment.totalPrice.toFixed(2)}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                            <div className="text-xs text-gray-500 mt-1 text-center bg-gray-100 px-2 py-1 rounded-lg">
                              Qty: {selectedTreatments.reduce((s, t) => s + t.quantity, 0)} | Total: AED {selectedTreatments.reduce((s, t) => s + t.totalPrice, 0).toFixed(2)}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Package Selection */}
                    {selectedService === "Package" && (
                      <div className="space-y-2 relative z-20">
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Select Package <span className="text-red-500">*</span></label>
                        <div className="relative" ref={packageDropdownRef}>
                          <button
                            type="button"
                            onClick={() => setPackageDropdownOpen(!packageDropdownOpen)}
                            className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs text-gray-700 hover:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <span className="text-gray-500">{selectedPackage ? selectedPackage.name : "Search packages..."}</span>
                            <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${packageDropdownOpen ? "rotate-180" : ""}`} />
                          </button>
                          {packageDropdownOpen && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-hidden flex flex-col">
                              <div className="p-1.5 border-b border-gray-200">
                                <input type="text" placeholder="Search packages..."
                                  value={packageSearchQuery}
                                  onChange={(e) => { e.stopPropagation(); setPackageSearchQuery(e.target.value); }}
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-teal-500" autoFocus
                                />
                              </div>
                              <div className="overflow-y-auto max-h-40">
                                {filteredAllPackages.length === 0 ? (
                                  <div className="p-2 text-center text-xs text-gray-500">{packageSearchQuery.trim() ? "No packages found" : "Start typing..."}</div>
                                ) : (
                                  <div className="p-1">
                                    {filteredAllPackages.map((pkg) => (
                                      <button key={pkg._id} type="button"
                                        onClick={(e) => { e.stopPropagation(); handlePackageSelect(pkg); }}
                                        className="w-full text-left px-2 py-1.5 rounded text-xs text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                                      >
                                        <div className="font-medium">{pkg.name}</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">
                                          Total: AED {Number(pkg.totalPrice).toFixed(2)} | {pkg.totalSessions} sessions
                                        </div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Package treatment sessions */}
                        {selectedPackage && packageTreatmentSessions.length > 0 && (
                          <div className="mt-2">
                            {loadingPackageUsage ? (
                              <div className="flex items-center justify-center py-4">
                                <Loader2 className="w-4 h-4 animate-spin text-gray-400 mr-2" />
                                <span className="text-xs text-gray-500">Loading package usage...</span>
                              </div>
                            ) : (
                              <>
                                {packageUsageData && packageUsageData.totalSessions > 0 && (
                                  <div className="mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                                    <AlertCircle className="w-3 h-3 inline mr-1" />
                                    <span className="font-semibold">Package Usage History</span> — {packageUsageData.totalSessions} sessions used from previous billings
                                  </div>
                                )}
                                <div className="space-y-2">
                                  {packageTreatmentSessions.map((treatment) => {
                                    const remainingSessions = treatment.maxSessions - treatment.previouslyUsedSessions;
                                    const isFullyUsed = remainingSessions <= 0;
                                    return (
                                      <div key={treatment.treatmentSlug}
                                        className={`bg-white border rounded-xl p-3 shadow-sm transition-all duration-200 ${
                                          isFullyUsed ? "border-red-200" : treatment.isSelected ? "border-teal-300" : "border-gray-200"
                                        }`}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="flex items-start gap-2 flex-1">
                                            {/* Toggle */}
                                            <button
                                              type="button"
                                              disabled={isFullyUsed}
                                              onClick={() => handlePackageTreatmentToggle(treatment.treatmentSlug)}
                                              className={`relative mt-0.5 w-8 h-5 rounded-full transition-colors flex-shrink-0 ${
                                                isFullyUsed ? "bg-gray-200 cursor-not-allowed" : treatment.isSelected ? "bg-teal-500" : "bg-gray-200"
                                              }`}
                                            >
                                              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                                                treatment.isSelected && !isFullyUsed ? "right-0.5" : "left-0.5"
                                              }`} />
                                            </button>
                                            <div>
                                              <div className={`text-xs font-semibold ${
                                                isFullyUsed ? "text-red-600" : treatment.isSelected ? "text-gray-900" : "text-gray-700"
                                              }`}>{treatment.treatmentName}</div>
                                              <div className="text-[10px] text-teal-600 font-medium">AED {treatment.sessionPrice.toFixed(2)}/session</div>
                                              {(treatment.usesFreeConsultation || treatment.usesMembershipDiscount) && (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                  {treatment.usesFreeConsultation && (
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold">Free Session</span>
                                                  )}
                                                  {treatment.usesMembershipDiscount && (
                                                    <span className="text-[9px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold">{membershipUsage?.discountPercentage || 10}% Off</span>
                                                  )}
                                                </div>
                                              )}
                                              {treatment.previouslyUsedSessions > 0 ? (
                                                <div className={`text-[10px] mt-0.5 font-medium flex items-center gap-1 ${
                                                  isFullyUsed ? "text-red-600" : "text-amber-600"
                                                }`}>
                                                  {isFullyUsed ? (
                                                    <><XCircle className="w-3 h-3" /> All sessions used</>
                                                  ) : (
                                                    <><AlertCircle className="w-3 h-3" /> {treatment.previouslyUsedSessions}/{treatment.maxSessions} used · {remainingSessions} left</>
                                                  )}
                                                </div>
                                              ) : (
                                                <div className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                                  <CheckCircle className="w-3 h-3" /> All {treatment.maxSessions} sessions available
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                          {/* Session input */}
                                          <div className="flex items-center gap-2 flex-shrink-0">
                                            <button type="button"
                                              disabled={!treatment.isSelected || isFullyUsed}
                                              onClick={() => handlePackageSessionChange(treatment.treatmentSlug, Math.max(1, treatment.usedSessions - 1))}
                                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs font-bold disabled:opacity-40"
                                            >−</button>
                                            <span className="text-xs font-bold w-5 text-center">{treatment.isSelected ? treatment.usedSessions : 0}</span>
                                            <button type="button"
                                              disabled={!treatment.isSelected || isFullyUsed}
                                              onClick={() => handlePackageSessionChange(treatment.treatmentSlug, Math.min(remainingSessions, treatment.usedSessions + 1))}
                                              className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-xs font-bold disabled:opacity-40"
                                            >+</button>
                                          </div>
                                        </div>
                                        {errors[`packageSession_${treatment.treatmentSlug}`] && (
                                          <div className="mt-1.5 text-[10px] text-red-600 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            {errors[`packageSession_${treatment.treatmentSlug}`]}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                                {errors.packageTreatments && (
                                  <div className="mt-1 text-xs text-red-600">{errors.packageTreatments}</div>
                                )}
                                <div className="mt-2 p-2 bg-gray-50 border border-gray-200 rounded-lg">
                                  <div className="flex gap-4 text-xs">
                                    <span className="text-gray-600">Selected: <span className="font-bold text-teal-600">{packageTreatmentSessions.filter(t => t.isSelected).length}/{packageTreatmentSessions.length}</span></span>
                                    <span className="text-gray-600">Sessions: <span className="font-bold text-emerald-600">{packageTreatmentSessions.filter(t => t.isSelected).reduce((s, t) => s + t.usedSessions, 0)}</span></span>
                                    <span className="text-gray-600">Total: <span className="font-bold text-teal-600">AED {totalPrice.toFixed(2)}</span></span>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Membership discount breakdown in service area */}
                    {membershipUsage?.hasMembership && !membershipUsage?.isExpired && membershipUsage?.remainingFreeConsultations === 0 && membershipUsage?.discountPercentage > 0 && parseFloat(formData.originalAmount || "0") > 0 && (
                      <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <div className="text-gray-500 text-[10px]">Original</div>
                            <div className="font-semibold line-through text-gray-500">AED {parseFloat(formData.originalAmount || "0").toFixed(2)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-blue-500 text-[10px]">Discount ({membershipUsage.discountPercentage}%)</div>
                            <div className="font-semibold text-blue-600">−AED {((parseFloat(formData.originalAmount || "0") * membershipUsage.discountPercentage) / 100).toFixed(2)}</div>
                          </div>
                          <div className="text-center">
                            <div className="text-emerald-500 text-[10px]">Final</div>
                            <div className="font-bold text-emerald-600">AED {totalPrice.toFixed(2)}</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {membershipUsage?.hasMembership && !membershipUsage?.isExpired && membershipUsage?.remainingFreeConsultations > 0 && totalPrice === 0 && (
                      <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                        ✓ Free consultation applied — no charge for this session.
                      </div>
                    )}
                  </div>

                  {/* ── PAYMENT DETAILS ── */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <h3 className="text-[10px] font-bold text-gray-700 uppercase tracking-wider mb-3">Payment Details</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-semibold text-gray-600">Total Amount <span className="text-red-500">*</span></label>
                          {doctorDiscount && (
                            <button type="button"
                              onClick={() => setIsDoctorDiscountApplied(!isDoctorDiscountApplied)}
                              className={`px-1.5 py-0.5 text-[9px] font-semibold rounded border transition-all ${
                                isDoctorDiscountApplied ? "bg-emerald-100 border-emerald-300 text-emerald-700" : "bg-gray-50 border-gray-300 text-gray-600"
                              }`}
                            >
                              {isDoctorDiscountApplied ? "Discount Applied" : "Apply Discount"}
                            </button>
                          )}
                        </div>
                        <input type="number" step="0.01" value={formData.amount || "0.00"} readOnly
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-100 text-gray-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Paid <span className="text-red-500">*</span></label>
                        <input type="number" step="0.01" value={formData.paid}
                          onChange={(e) => setFormData((prev) => ({ ...prev, paid: e.target.value }))}
                          className={`w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg text-gray-900 focus:ring-1 focus:ring-teal-500 outline-none ${
                            useMultiplePayments ? "bg-gray-100" : "bg-white"
                          }`}
                          required readOnly={useMultiplePayments}
                        />
                        <div className="text-[9px] text-gray-500 mt-0.5">
                          Net due: AED {Math.max(0, (parseFloat(formData.amount) || 0) - (applyAdvance ? Math.min(balances.advanceBalance, parseFloat(formData.amount) || 0) : 0) - (applyPastAdvance50Percent ? Math.min(balances.pastAdvance50PercentBalance, parseFloat(formData.amount) || 0) : 0) - (applyPastAdvance54Percent ? Math.min(balances.pastAdvance54PercentBalance, parseFloat(formData.amount) || 0) : 0) - (applyPastAdvance159Flat ? Math.min(balances.pastAdvance159FlatBalance, parseFloat(formData.amount) || 0) : 0)).toFixed(2)}
                        </div>
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Pending</label>
                        <input type="number" step="0.01" value={formData.pending || "0.00"}
                          onChange={(e) => setFormData((prev) => ({ ...prev, pending: e.target.value }))}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-1 focus:ring-teal-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Advance</label>
                        <input type="number" step="0.01" value={formData.advance}
                          onChange={(e) => setFormData((prev) => ({ ...prev, advance: e.target.value }))}
                          className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-1 focus:ring-teal-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-600 mb-1">Payment Method <span className="text-red-500">*</span></label>
                        <select value={formData.paymentMethod}
                          onChange={(e) => setFormData((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                          className={`w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-1 focus:ring-teal-500 outline-none ${useMultiplePayments ? "opacity-50" : ""}`}
                          required disabled={useMultiplePayments}
                        >
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="BT">BT</option>
                          <option value="Tabby">Tabby</option>
                          <option value="Tamara">Tamara</option>
                        </select>
                      </div>
                    </div>

                    {/* Advance Balance Options */}
                    <div className="mt-3">
                      <div className="bg-gradient-to-r from-teal-50 to-blue-50 border border-teal-200 rounded-xl p-3 space-y-2">
                        <h4 className="text-[10px] font-bold text-teal-800 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
                          </svg>
                          Available Advances
                        </h4>
                        
                        {/* Regular Advance Balance */}
                        <label className="flex items-center justify-between cursor-pointer group">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={applyAdvance}
                              onChange={(e) => setApplyAdvance(e.target.checked)}
                              className="w-3.5 h-3.5 text-teal-600 rounded focus:ring-teal-500 border-gray-300"
                            />
                            <span className="text-[10px] font-medium text-gray-700 group-hover:text-gray-900">Use advance balance now</span>
                          </div>
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full">
                            AED {balances.advanceBalance.toFixed(2)}
                          </span>
                        </label>

                        {/* 50% Past Advance */}
                        <label className="flex items-center justify-between cursor-pointer group">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={applyPastAdvance50Percent}
                              onChange={(e) => setApplyPastAdvance50Percent(e.target.checked)}
                              className="w-3.5 h-3.5 text-blue-600 rounded focus:ring-blue-500 border-gray-300"
                            />
                            <span className="text-[10px] font-medium text-gray-700 group-hover:text-gray-900">Use 50% Offer past advance now</span>
                          </div>
                          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                            AED {balances.pastAdvance50PercentBalance.toFixed(2)}
                          </span>
                        </label>

                        {/* 54% Past Advance */}
                        <label className="flex items-center justify-between cursor-pointer group">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={applyPastAdvance54Percent}
                              onChange={(e) => setApplyPastAdvance54Percent(e.target.checked)}
                              className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500 border-gray-300"
                            />
                            <span className="text-[10px] font-medium text-gray-700 group-hover:text-gray-900">Use 54% Offer past advance now</span>
                          </div>
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                            AED {balances.pastAdvance54PercentBalance.toFixed(2)}
                          </span>
                        </label>

                        {/* 159 Flat Past Advance (if available) */}
                        {balances.pastAdvance159FlatBalance > 0 && (
                          <label className="flex items-center justify-between cursor-pointer group">
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={applyPastAdvance159Flat}
                                onChange={(e) => setApplyPastAdvance159Flat(e.target.checked)}
                                className="w-3.5 h-3.5 text-orange-600 rounded focus:ring-orange-500 border-gray-300"
                              />
                              <span className="text-[10px] font-medium text-gray-700 group-hover:text-gray-900">Use 159 Flat past advance now</span>
                            </div>
                            <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full">
                              AED {balances.pastAdvance159FlatBalance.toFixed(2)}
                            </span>
                          </label>
                        )}

                        {/* Summary of applied advances */}
                        {(applyAdvance || applyPastAdvance50Percent || applyPastAdvance54Percent || applyPastAdvance159Flat) && (
                          <div className="mt-2 pt-2 border-t border-teal-200">
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-gray-700">Total Applied:</span>
                              <span className="font-bold text-teal-700">
                                AED {(
                                  (applyAdvance ? Math.min(balances.advanceBalance, parseFloat(formData.amount) || 0) : 0) +
                                  (applyPastAdvance50Percent ? Math.min(balances.pastAdvance50PercentBalance, parseFloat(formData.amount) || 0) : 0) +
                                  (applyPastAdvance54Percent ? Math.min(balances.pastAdvance54PercentBalance, parseFloat(formData.amount) || 0) : 0) +
                                  (applyPastAdvance159Flat ? Math.min(balances.pastAdvance159FlatBalance, parseFloat(formData.amount) || 0) : 0)
                                ).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-2">
                      <button type="button"
                        onClick={() => { setUseMultiplePayments(!useMultiplePayments); if (!useMultiplePayments) setMultiplePayments([{ paymentMethod: "Cash", amount: "" }, { paymentMethod: "Card", amount: "" }]); }}
                        className="text-xs text-teal-600 hover:text-teal-800 underline font-medium"
                      >
                        {useMultiplePayments ? "← Single payment" : "+ Multiple payment methods"}
                      </button>
                    </div>

                    {useMultiplePayments && (
                      <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-gray-700 uppercase">Split Payments</span>
                          <span className="text-[10px] font-semibold text-blue-700">
                            Total: AED {multiplePayments.reduce((s, mp) => s + (parseFloat(mp.amount) || 0), 0).toFixed(2)}
                          </span>
                        </div>
                        {multiplePayments.map((mp, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <select value={mp.paymentMethod}
                              onChange={(e) => { const u = [...multiplePayments]; u[idx] = { ...u[idx], paymentMethod: e.target.value }; setMultiplePayments(u); }}
                              className="px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-1 focus:ring-teal-500 outline-none min-w-[80px]"
                            >
                              <option value="Cash">Cash</option>
                              <option value="Card">Card</option>
                              <option value="BT">BT</option>
                              <option value="Tabby">Tabby</option>
                              <option value="Tamara">Tamara</option>
                            </select>
                            <input type="number" step="0.01" min="0" placeholder="Amount"
                              value={mp.amount}
                              onChange={(e) => { const u = [...multiplePayments]; u[idx] = { ...u[idx], amount: e.target.value }; setMultiplePayments(u); }}
                              className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-1 focus:ring-teal-500 outline-none"
                            />
                            {multiplePayments.length > 1 && (
                              <button type="button" onClick={() => setMultiplePayments(multiplePayments.filter((_, i) => i !== idx))} className="p-1 text-red-500 hover:text-red-700 rounded transition-colors">
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        ))}
                        <button type="button" onClick={() => setMultiplePayments([...multiplePayments, { paymentMethod: "Cash", amount: "" }])} className="text-xs text-teal-600 hover:text-teal-800 font-medium">+ Add method</button>
                      </div>
                    )}
                  </div>

                  {/* Referred By / Notes */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                      <label className="block text-[10px] font-semibold text-gray-600 mb-1">Referred By</label>
                      <input type="text" value={formData.referredBy}
                        onChange={(e) => setFormData((prev) => ({ ...prev, referredBy: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-1 focus:ring-teal-500 outline-none"
                      />
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                      <label className="block text-[10px] font-semibold text-gray-600 mb-1">Notes</label>
                      <textarea value={formData.notes}
                        onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-1 focus:ring-teal-500 outline-none resize-none"
                        rows={2}
                      />
                    </div>
                  </div>

                  {/* Billing Summary */}
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <svg className="w-4 h-4 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-bold text-gray-900">Billing Summary</span>
                      {/* Free Consultation Tag */}
                      {membershipUsage && membershipUsage.hasMembership && !membershipUsage.isExpired && membershipUsage.remainingFreeConsultations > 0 && parseFloat(formData.originalAmount || "0") > 0 && (
                        <span className="ml-auto px-2 py-0.5 text-[10px] font-semibold bg-emerald-100 text-emerald-700 rounded-full">
                          Free Consultation Applied
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Original Amount (before discounts) */}
                      {parseFloat(formData.originalAmount || "0") > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600">Original Amount</span>
                          <span className="font-semibold text-gray-900">AED {parseFloat(formData.originalAmount || "0").toFixed(2)}</span>
                        </div>
                      )}

                      {/* Doctor Discount (if applied) */}
                      {isDoctorDiscountApplied && doctorDiscount && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600">
                            Doctor Discount ({doctorDiscount.discountType === "percentage" ? `${doctorDiscount.discountAmount}%` : "Fixed"})
                          </span>
                          <span className="font-semibold text-red-500">
                            −AED {(() => {
                              const originalAmt = parseFloat(formData.originalAmount || formData.amount || "0");
                              if (doctorDiscount.discountType === "percentage") {
                                return ((originalAmt * doctorDiscount.discountAmount) / 100).toFixed(2);
                              }
                              return doctorDiscount.discountAmount.toFixed(2);
                            })()}
                          </span>
                        </div>
                      )}

                      {/* Membership Discount (if applied) */}
                      {membershipUsage && membershipUsage.hasMembership && !membershipUsage.isExpired && membershipUsage.discountPercentage > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600">
                            Membership Discount ({membershipUsage.discountPercentage}%)
                          </span>
                          <span className="font-semibold text-blue-600">
                            −AED {((parseFloat(formData.originalAmount || "0") * membershipUsage.discountPercentage) / 100).toFixed(2)}
                          </span>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="border-t border-gray-200 my-2"></div>

                      {/* Total Amount (after discounts) */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-700 font-medium">Total Amount</span>
                        <span className="font-bold text-gray-900">AED {parseFloat(formData.amount || "0").toFixed(2)}</span>
                      </div>

                      {/* Previous Pending Rolled In */}
                      {parseFloat(formData.pendingUsed || "0") > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600">Previous Pending Rolled In</span>
                          <span className="font-semibold text-amber-600">+AED {parseFloat(formData.pendingUsed || "0").toFixed(2)}</span>
                        </div>
                      )}

                      {/* Advance Balance Used */}
                      {parseFloat(formData.advanceUsed || "0") > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600">Advance Balance Used</span>
                          <span className="font-semibold text-purple-600">−AED {parseFloat(formData.advanceUsed || "0").toFixed(2)}</span>
                        </div>
                      )}

                      {/* Past Advance Used */}
                      {parseFloat(formData.pastAdvanceUsed || "0") > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600">Past Advance Used</span>
                          <span className="font-semibold text-purple-600">−AED {parseFloat(formData.pastAdvanceUsed || "0").toFixed(2)}</span>
                        </div>
                      )}

                      {/* Divider */}
                      <div className="border-t border-gray-200 my-2"></div>

                      {/* Paid Amount */}
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gray-700 font-medium">Paid Amount</span>
                        <span className="font-bold text-emerald-600">AED {parseFloat(formData.paid || "0").toFixed(2)}</span>
                      </div>

                      {/* Split Payment Breakdown */}
                      {useMultiplePayments && multiplePayments.length > 0 && (
                        <div className="pl-3 space-y-1 border-l-2 border-emerald-100 mt-1 mb-2">
                          {multiplePayments.map((payment, idx) => (
                            parseFloat(payment.amount || "0") > 0 && (
                              <div key={idx} className="flex items-center justify-between text-[10px] text-gray-500 font-medium">
                                <span>{payment.paymentMethod === 'BT' ? 'Bank Transfer (BT)' : payment.paymentMethod}</span>
                                <span>AED {parseFloat(payment.amount || "0").toFixed(2)}</span>
                              </div>
                            )
                          ))}
                        </div>
                      )}

                      {/* Pending Amount */}
                      {parseFloat(formData.pending || "0") > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600">Pending Amount</span>
                          <span className="font-semibold text-amber-600">AED {parseFloat(formData.pending || "0").toFixed(2)}</span>
                        </div>
                      )}

                      {/* Advance Given */}
                      {parseFloat(formData.advance || "0") > 0 && (
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-600">Advance Given</span>
                          <span className="font-semibold text-purple-600">AED {parseFloat(formData.advance || "0").toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                
                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
                    <button type="button" onClick={onClose}
                      className="px-4 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={loading}
                      className="px-4 py-2 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? "Creating..." : "Create Billing"}
                    </button>
                  </div>
                </div>

                  {/* ── RIGHT COLUMN: Membership + Active Packages + Payment History ── */}
                  <div className="space-y-4">
                  {/* Membership Card (Financial Summary-style) */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">Membership</div>
                        <div className="text-[10px] text-gray-500">Patient membership plans</div>
                      </div>
                    </div>

                    {loadingMembershipUsage ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                        <span className="text-[10px] text-gray-500">Checking membership...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Memberships list */}
                        {patientDetails && (Array.isArray(patientDetails.memberships) ? patientDetails.memberships : []).filter((m: any) => {
                          return !patientDetails.membershipTransfers?.some((t: any) => t.type === "out" && String(t.membershipId) === String(m.membershipId));
                        }).length > 0 ? (
                          patientDetails.memberships.filter((m: any) => {
                            return !patientDetails.membershipTransfers?.some((t: any) => t.type === "out" && String(t.membershipId) === String(m.membershipId));
                          }).map((m: any, idx: number) => {
                            const membershipPlan = memberships.find((mem: any) => mem._id === m.membershipId);
                            const displayName = membershipPlan?.name || m.membershipName || m.membershipId;
                            const ml = monthsUntil(m.endDate);
                            return (
                              <div key={`${m.membershipId}-${idx}`} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-semibold text-emerald-800">{displayName}</div>
                                  {typeof ml === "number" && ml >= 0 && (
                                    <span className="text-[9px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">{ml}m left</span>
                                  )}
                                </div>
                                <div className="text-[9px] text-emerald-600 mt-0.5">
                                  {m.startDate ? new Date(m.startDate).toLocaleDateString() : "–"} → {m.endDate ? new Date(m.endDate).toLocaleDateString() : "–"}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-[10px] text-gray-400 py-1">No active memberships</div>
                        )}

                        {/* Active membership usage details */}
                        {membershipUsage && membershipUsage.hasMembership && !membershipUsage.isExpired && !isMembershipTransferredOut() && (
                          <div className="pt-2 mt-1 border-t border-gray-100 space-y-1.5">
                            <div className="text-[10px] font-bold text-gray-700">{membershipUsage.membershipName}</div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-gray-600">Free Consultations</span>
                              <span className={`font-semibold ${membershipUsage.remainingFreeConsultations > 0 ? "text-emerald-600" : "text-amber-600"}`}>
                                {membershipUsage.remainingFreeConsultations || 0} remaining
                              </span>
                            </div>
                            {membershipUsage.totalFreeConsultations > 0 && (
                              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    membershipUsage.remainingFreeConsultations > 0 ? "bg-emerald-400" : "bg-amber-400"
                                  }`}
                                  style={{ width: `${Math.min(((membershipUsage.usedFreeConsultations || 0) / membershipUsage.totalFreeConsultations) * 100, 100)}%` }}
                                />
                              </div>
                            )}
                            {membershipUsage.discountPercentage > 0 && (
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-gray-600">Discount</span>
                                <span className="font-semibold text-blue-600">{membershipUsage.discountPercentage}%</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Active Packages (Financial Profile-style) */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-teal-100 flex items-center justify-center">
                        <Package className="w-4 h-4 text-teal-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">Active Packages</div>
                        <div className="text-[10px] text-gray-500">Package session tracking</div>
                      </div>
                    </div>

                    {loadingActivePackageUsage ? (
                      <div className="flex items-center gap-2 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-500" />
                        <span className="text-[10px] text-gray-500">Loading packages...</span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {/* Combine regular packages and userPackages */}
                        {(() => {
                          const purchasedPackages = (patientDetails?.packages || []).filter((p: any) => {
                            return !patientDetails.packageTransfers?.some((t: any) => t.type === "out" && String(t.packageId) === String(p.packageId));
                          });
                          
                          // Add userPackages (approved packages from PatientRegistration.userPackages)
                          const approvedUserPackages = (patientDetails?.userPackages || []).filter(
                            (pkg: any) => pkg.approvalStatus === 'approved'
                          );
                          
                          const allPackages = [
                            ...purchasedPackages.map((p: any) => ({ ...p, isUserPackage: false })),
                            ...approvedUserPackages.map((p: any) => ({ ...p, isUserPackage: true }))
                          ];
                          
                          if (allPackages.length === 0) {
                            return <div className="text-[10px] text-gray-400 py-1">No active packages</div>;
                          }
                          
                          const usageMap = new Map();
                          activePackageUsage.forEach(u => usageMap.set(u.packageName, u));

                          return allPackages.map((pkg: any, pkgIndex: number) => {
                            let packageName: string;
                            let packageDef: any = null;
                            let treatments: any[] = [];
                            let totalSessions = 0;
                            
                            if (pkg.isUserPackage) {
                              // Handle userPackage
                              packageName = pkg.packageName;
                              treatments = pkg.treatments || [];
                              totalSessions = pkg.totalSessions || 0;
                            } else {
                              // Handle regular package
                              packageDef = packages.find(p => p._id === pkg.packageId);
                              packageName = packageDef?.name || pkg.packageId;
                              treatments = packageDef?.treatments || [];
                              totalSessions = packageDef?.treatments?.reduce((s: number, t: any) => s + (t.sessions || 0), 0) || 0;
                            }
                            
                            const usageData = usageMap.get(packageName);
                            const isExpanded = expandedPackages[packageName] || false;
                            const displayData = usageData || {
                              packageName,
                              treatments,
                              totalSessions,
                              billingHistory: []
                            };

                            return (
                              <div key={`${pkg.packageId || pkg._id}-${pkgIndex}`} className="border border-teal-200 rounded-xl overflow-hidden bg-gradient-to-br from-teal-50 to-cyan-50">
                                <button type="button"
                                  onClick={() => togglePackageExpansion(packageName)}
                                  className="w-full px-3 py-2 flex items-center justify-between hover:bg-teal-100/50 transition-colors"
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-teal-500 flex items-center justify-center">
                                      <span className="text-[8px] font-bold text-white">#{pkgIndex + 1}</span>
                                    </div>
                                    <div className="text-left">
                                      <div className="text-[10px] font-semibold text-gray-900">{packageName}</div>
                                      <div className="text-[9px] text-gray-500">{displayData.treatments?.length || 0} treatments · {displayData.totalSessions || 0} sessions</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700 font-medium">{displayData.billingHistory?.length || 0} bills</span>
                                    {isExpanded ? <ChevronUp className="w-3 h-3 text-gray-500" /> : <ChevronDown className="w-3 h-3 text-gray-500" />}
                                  </div>
                                </button>

                                {isExpanded && (
                                  <div className="border-t border-teal-200 p-2.5 space-y-2">
                                    {displayData.treatments && displayData.treatments.length > 0 ? (
                                      displayData.treatments.map((treatment: any, tIndex: number) => {
                                        const treatmentUsage = usageData?.treatments?.find((t: any) => t.treatmentSlug === treatment.treatmentSlug);
                                        const maxSessions = treatment.sessions || treatment.maxSessions || 0;
                                        const totalUsedSessions = treatmentUsage?.totalUsedSessions || 0;
                                        const remainingSessions = maxSessions - totalUsedSessions;
                                        const isFullyUsed = maxSessions > 0 && totalUsedSessions >= maxSessions;
                                        const usagePercent = maxSessions > 0 ? Math.round((totalUsedSessions / maxSessions) * 100) : 0;

                                        return (
                                          <div key={treatment.treatmentSlug || tIndex}
                                            className={`rounded-lg border p-2 ${
                                              isFullyUsed ? "bg-green-50 border-green-200" : remainingSessions > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200"
                                            }`}
                                          >
                                            <div className="flex items-center justify-between mb-1">
                                              <span className="font-medium text-gray-900 text-[10px]">{treatment.treatmentName}</span>
                                              <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
                                                isFullyUsed ? "bg-green-100 text-green-700" : remainingSessions > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"
                                              }`}>{isFullyUsed ? "Complete" : remainingSessions > 0 ? `${remainingSessions} left` : "0 left"}</span>
                                            </div>
                                            <div className="flex justify-between text-[9px] mb-0.5">
                                              <span className="text-gray-500">Progress</span>
                                              <span className="font-medium text-gray-800">{totalUsedSessions}/{maxSessions}</span>
                                            </div>
                                            <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                              <div className={`h-full rounded-full ${
                                                isFullyUsed ? "bg-green-500" : remainingSessions > 0 ? "bg-amber-500" : "bg-gray-400"
                                              }`} style={{ width: `${Math.min(usagePercent, 100)}%` }} />
                                            </div>
                                          </div>
                                        );
                                      })
                                    ) : (
                                      <div className="text-[10px] text-gray-400 text-center py-1">No treatments found</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>

                  {/* Payment History - Last 3 invoices */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                        <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">Payment History</div>
                        <div className="text-[10px] text-gray-500">Transaction timeline</div>
                      </div>
                    </div>

                    {loadingHistory ? (
                      <div className="flex items-center gap-2 py-3">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span className="text-[10px] text-gray-500">Loading history...</span>
                      </div>
                    ) : last3Billings.length === 0 ? (
                      <div className="text-[10px] text-gray-400 py-2">No payment history found</div>
                    ) : (
                      <div className="space-y-2">
                        {last3Billings.map((billing) => (
                          <div key={billing._id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl border border-gray-100">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                </svg>
                              </div>
                              <div>
                                <div className="text-xs font-semibold text-gray-900">AED {billing.paid?.toFixed(2) || "0.00"}</div>
                                <div className="text-[10px] text-gray-500">
                                  {billing.paymentMethod || (billing.multiplePayments?.length > 0 ? billing.multiplePayments.map((mp: any) => mp.paymentMethod).join(" + ") : "–")}
                                  {billing.invoicedDate && (
                                    <span className="ml-2">{new Date(billing.invoicedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[9px] text-gray-400">{billing.invoiceNumber}</span>
                            </div>
                          </div>
                        ))}
                        {last3Billings.length > 0 && (
                          <button
                            onClick={() => {
                              const router = window.location.href.includes('/clinic/') 
                                ? (window as any).router || { push: (url: string) => window.location.href = url }
                                : null;
                              if (router) {
                                router.push(`/clinic/billing-history?patientId=${appointment.patientId}`);
                              } else {
                                window.location.href = `/clinic/billing-history?patientId=${appointment.patientId}`;
                              }
                            }}
                            className="w-full mt-2 py-2 text-[10px] font-semibold text-teal-700 hover:text-teal-900 hover:bg-teal-50 rounded-lg transition-colors border border-teal-200"
                          >
                            View All Invoices →
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Communication Log - Consent Form Status */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                        <FileText className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-gray-900">Communication Log</div>
                        <div className="text-[10px] text-gray-500">Consent form status</div>
                      </div>
                    </div>

                    {loadingConsentStatus ? (
                      <div className="flex items-center gap-2 py-3">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                        <span className="text-[10px] text-gray-500">Loading status...</span>
                      </div>
                    ) : consentStatuses.length === 0 ? (
                      <div className="text-[10px] text-gray-400 py-2">No consent forms sent yet</div>
                    ) : (
                      <div className="space-y-2">
                        {consentStatuses.map((consent: any, index: number) => {
                          // Generate consent form URL
                          const patientInfo = {
                            firstName: appointment?.patientName?.split(" ")[0] || "",
                            lastName: appointment?.patientName?.split(" ").slice(1).join(" ") || "",
                            mobileNumber: appointment?.patientNumber || "",
                            email: appointment?.patientEmail || "",
                            appointmentId: appointment?._id,
                          };
                          const encodedPatientData = encodeURIComponent(JSON.stringify(patientInfo));
                          const consentUrl = `https://zeva360.com/consent-form/${consent.consentFormId}?patient=${encodedPatientData}`;
                          
                          return (
                            <div
                              key={consent._id || index}
                              className={`flex items-center justify-between p-2.5 rounded-xl border ${
                                consent.status === "signed"
                                  ? "border-green-200 bg-green-50"
                                  : "border-blue-200 bg-blue-50"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {consent.status === "signed" ? (
                                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                                ) : (
                                  <Send className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="text-xs font-semibold text-gray-900 truncate">
                                    {consent.consentFormName}
                                  </div>
                                  <div className="text-[9px] text-gray-500">
                                    <span className={`px-1.5 py-0.5 rounded-full font-semibold ${
                                      consent.status === "signed"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-blue-100 text-blue-700"
                                    }`}>
                                      {consent.status === "signed" ? "SIGNED" : "SENT"}
                                    </span>
                                    <span className="ml-1">{consent.date}</span>
                                  </div>
                                </div>
                              </div>
                              <a
                                href={consentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-blue-600 hover:text-blue-800 underline flex-shrink-0"
                              >
                                Open
                              </a>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Smart Recommendations */}
                  {(smartDepartments.length > 0 || loadingSmartRec) && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                        </div>
                        <div>
                          <div className="text-xs font-bold text-gray-900">Smart Recommendations</div>
                          <div className="text-[10px] text-gray-500">AI-powered treatment suggestions</div>
                        </div>
                      </div>

                      {loadingSmartRec ? (
                        <div className="flex items-center gap-2 py-3">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                          <span className="text-[10px] text-gray-500">Loading recommendations...</span>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {smartDepartments.map((dept) => (
                            <div key={dept._id}>
                              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">{dept.name}</p>
                              <div className="grid grid-cols-3 gap-2">
                                {dept.services.map((svc) => {
                                  // Services use serviceSlug or _id as identifier - match both
                                  const serviceIdentifier = svc.serviceSlug || svc._id;
                                  const isAdded = selectedTreatments.some((t) => 
                                    t.treatmentSlug === serviceIdentifier ||
                                    t.treatmentSlug === svc._id ||
                                    (t.treatmentName && svc.name && t.treatmentName.toLowerCase() === svc.name.toLowerCase())
                                  );
                                  return (
                                    <div
                                      key={svc._id}
                                      className={`flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 shadow-sm transition-all ${
                                        isAdded ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"
                                      }`}
                                    >
                                      <div className="text-center w-full">
                                        <span className="text-[10px] font-semibold text-gray-800 line-clamp-2 leading-tight min-h-[20px]">{svc.name}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[9px] text-blue-600 font-medium whitespace-nowrap">
                                          {svc.clinicPrice != null ? `AED ${svc.clinicPrice}` : `AED ${svc.price}`}
                                        </span>
                                        {!isAdded && (
                                          <button
                                            type="button"
                                            onClick={async () => {
                                              const price = svc.clinicPrice != null ? svc.clinicPrice : svc.price;
                                              // Match how services are loaded: use serviceSlug if available, otherwise _id
                                              const treatmentSlug = svc.serviceSlug || svc._id;
                                              
                                              // 1. Ensure Treatment service is selected
                                              setSelectedService("Treatment");

                                              // 2. Find matching treatment from treatments array
                                              const matchingTreatment = treatments.find(
                                                (t) => t.slug === treatmentSlug || 
                                                (t.name && t.name.toLowerCase() === svc.name.toLowerCase())
                                              );
                                              
                                              if (matchingTreatment) {
                                                // 3. Add to selected treatments with notification
                                                handleTreatmentToggle(matchingTreatment, true);
                                              } else {
                                                // Create treatment object manually if not found in treatments array
                                                const newTreatment: any = {
                                                  name: svc.name,
                                                  slug: treatmentSlug,
                                                  price: price,
                                                };
                                                handleTreatmentToggle(newTreatment, true);
                                              }
                                              
                                              // 4. Save to appointment via API
                                              if (appointment?._id && appointment?.patientId) {
                                                try {
                                                  const headers = getAuthHeaders();
                                                  await axios.patch(
                                                    `/api/clinic/appointment-services/${appointment._id}`,
                                                    { serviceIds: [svc._id] },
                                                    { headers }
                                                  );
                                                } catch (error) {
                                                  console.error("Error saving smart recommendation:", error);
                                                }
                                              }
                                            }}
                                            className="text-[8px] px-1.5 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium whitespace-nowrap"
                                          >
                                            + Add
                                          </button>
                                        )}
                                        {isAdded && (
                                          <span className="text-[8px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-semibold whitespace-nowrap">
                                            ✓ Added
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default AppointmentBillingModal;



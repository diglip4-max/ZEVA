"use client";
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  X,
  Plus,
  Trash2,
  Pencil,
  Check,
  X as XIcon,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Package,
  FileText,
  Hash,
  Calendar,
  Scale,
  Stethoscope,
  User,
  Clock,
  Activity,
  ClipboardList,
  Eye,
  RefreshCw,
  Upload,
  Send,
  TrendingUp,
  Pill,
  NotebookPen,
} from "lucide-react";
import useStockItems from "@/hooks/useStockItems";
import useUoms from "@/hooks/useUoms";
import { getTokenByPath, handleUpload } from "@/lib/helper";
import useAllocatedItems from "@/hooks/useAllocatedItems";
import AddStockTransferRequestModal from "@/pages/clinic/stocks/stock-transfer/stock-transfer-requests/_components/AddStockTransferRequestModal";

interface AppointmentLite {
  _id: string;
  patientName: string;
  patientId: string;
  emrNumber?: string;
  gender?: string;
  doctorName: string;
  startDate?: string;
  fromTime?: string;
  toTime?: string;
  status?: string;
}

interface AppointmentDetails {
  appointmentId: string;
  patientId: string;
  patientName: string;
  emrNumber?: string;
  gender?: string;
  email?: string;
  mobileNumber?: string;
  doctorId?: string;
  doctorName: string;
  doctorEmail?: string;
  roomId?: string;
  startDate?: string;
  fromTime?: string;
  toTime?: string;
  status?: string;
  serviceIds?: string[];
  serviceNames?: string[];
}

interface AppointmentReportSummary {
  reportId?: string;
  appointmentId: string;
  temperatureCelsius: number;
  pulseBpm: number;
  systolicBp: number;
  diastolicBp: number;
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  respiratoryRate?: number;
  spo2Percent?: number;
  hipCircumference?: number;
  headCircumference?: number;
  bmi?: number;
  sugar?: string;
  urinalysis?: string;
  otherDetails?: string;
  updatedAt: string;
  createdAt: string;
  doctorName?: string;
  doctorEmail?: string;
  startDate?: string;
  fromTime?: string;
  toTime?: string;
}

interface SingleReport {
  reportId?: string;
  temperatureCelsius: number;
  pulseBpm: number;
  systolicBp: number;
  diastolicBp: number;
  heightCm?: number;
  weightKg?: number;
  waistCm?: number;
  respiratoryRate?: number;
  spo2Percent?: number;
  hipCircumference?: number;
  headCircumference?: number;
  bmi?: number;
  sugar?: string;
  urinalysis?: string;
  otherDetails?: string;
  updatedAt?: string;
}

interface PreviousComplaint {
  _id: string;
  complaints: string;
  createdAt: string;
  doctorId:
    | {
        _id?: string;
        name?: string;
        email?: string;
      }
    | string
    | null;
  items?: Array<{
    itemId?: string;
    code?: string;
    name: string;
    description?: string;
    quantity: number;
    uom?: string;
    totalAmount?: number;
  }>;
  beforeImage?: string;
  afterImage?: string;
}

interface AppointmentComplaintModalProps {
  isOpen: boolean;
  appointment: AppointmentLite | null;
  onClose: () => void;
  getAuthHeaders: () => Record<string, string>;
}

const AppointmentComplaintModal: React.FC<AppointmentComplaintModalProps> = ({
  isOpen,
  appointment,
  onClose,
  getAuthHeaders,
}) => {
  type StockRow = {
    itemId?: string;
    code?: string;
    name: string;
    description?: string;
    quantity: number;
    uom?: string;
  };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [details, setDetails] = useState<AppointmentDetails | null>(null);
  const [report, setReport] = useState<SingleReport | null>(null);
  const [patientReports, setPatientReports] = useState<
    AppointmentReportSummary[]
  >([]);
  const [complaints, setComplaints] = useState<string>("");
  const [beforeImage, setBeforeImage] = useState<string>("");
  const [afterImage, setAfterImage] = useState<string>("");
  const [uploadingBefore, setUploadingBefore] = useState(false);
  const [uploadingAfter, setUploadingAfter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previousComplaints, setPreviousComplaints] = useState<
    PreviousComplaint[]
  >([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [showPreviousReports, setShowPreviousReports] = useState(false);
  const [expandedComplaints, setExpandedComplaints] = useState<
    Record<string, boolean>
  >({});
  const [editingComplaint, setEditingComplaint] =
    useState<PreviousComplaint | null>(null);
  const [deletedComplaint, setDeletedComplaint] =
    useState<PreviousComplaint | null>(null);
  const [selectedComplaint, setSelectedComplaint] =
    useState<PreviousComplaint | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [items, setItems] = useState<StockRow[]>([]);
  const [currentItem, setCurrentItem] = useState<StockRow>({
    itemId: "",
    code: "",
    name: "",
    description: "",
    quantity: 1,
    uom: "",
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<StockRow | null>(null);
  const [isOpenDeleteComplaintModal, setIsOpenDeleteComplaintModal] =
    useState<boolean>(false);
  const [isOpenViewComplaintModal, setIsOpenViewComplaintModal] =
    useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);
  const [isAllocatedDropdownOpen, setIsAllocatedDropdownOpen] =
    useState<boolean>(false);
  const [allocatedSearch, setAllocatedSearch] = useState<string>("");
  const allocatedDropdownRef = useRef<HTMLDivElement | null>(null);

  // stock transfer modal
  const [isOpenStockTransferModal, setIsOpenStockTransferModal] =
    useState<boolean>(false);

  // consent form
  interface ConsentFormOption {
    _id: string;
    formName: string;
  }
  const [consentForms, setConsentForms] = useState<ConsentFormOption[]>([]);
  const [selectedConsentId, setSelectedConsentId] = useState<string>("");
  const [sendingConsent, setSendingConsent] = useState<boolean>(false);
  const [consentSent, setConsentSent] = useState<boolean>(false);

  // Tab state
  type TabType = "complaint" | "progress" | "prescription";
  const [activeTab, setActiveTab] = useState<TabType>("complaint");

  // Progress tab state
  interface ProgressNoteEntry {
    _id: string;
    note: string;
    noteDate: string;
    doctorId?: { _id?: string; name?: string; email?: string } | string | null;
    createdAt: string;
  }
  const [progressNotes, setProgressNotes] = useState<ProgressNoteEntry[]>([]);
  const [loadingProgressNotes, setLoadingProgressNotes] = useState(false);
  const [addingNewEntry, setAddingNewEntry] = useState(false);
  const [newEntryText, setNewEntryText] = useState<string>("");
  const [newEntryDate, setNewEntryDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [savingProgress, setSavingProgress] = useState(false);
  const [progressError, setProgressError] = useState<string>("");

  // Prescription tab state
  type MedicineLine = {
    id: string;
    medicineName: string;
    dosage: string;
    duration: string;
    notes: string;
  };
  const emptyMedicine = (): MedicineLine => ({
    id: Date.now().toString() + Math.random(),
    medicineName: "",
    dosage: "",
    duration: "",
    notes: "",
  });
  const [medicines, setMedicines] = useState<MedicineLine[]>([emptyMedicine()]);
  const [aftercareInstructions, setAftercareInstructions] =
    useState<string>("");
  const [includeInPdf, setIncludeInPdf] = useState<boolean>(true);
  const [savingPrescription, setSavingPrescription] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState<string>("");
  const [prescriptionSaved, setPrescriptionSaved] = useState<boolean>(false);
  interface PrescriptionHistoryEntry {
    _id: string;
    medicines: Array<{
      _id?: string;
      medicineName: string;
      dosage?: string;
      duration?: string;
      notes?: string;
    }>;
    aftercareInstructions?: string;
    includeInPdf?: boolean;
    doctorId?: { _id?: string; name?: string; email?: string } | string | null;
    createdAt: string;
    updatedAt: string;
  }
  const [prescriptionHistory, setPrescriptionHistory] = useState<
    PrescriptionHistoryEntry[]
  >([]);
  const [loadingPrescriptionHistory, setLoadingPrescriptionHistory] =
    useState(false);
  const [expandedPrescription, setExpandedPrescription] = useState<
    Record<string, boolean>
  >({});

  // Smart Recommendations state
  interface SmartService {
    _id: string;
    name: string;
    price: number;
    clinicPrice?: number | null;
    durationMinutes?: number;
    departmentId?: string;
  }
  interface SmartDepartment {
    _id: string;
    name: string;
    services: SmartService[];
  }
  const [smartDepartments, setSmartDepartments] = useState<SmartDepartment[]>(
    [],
  );
  const [loadingSmartRec, setLoadingSmartRec] = useState(false);

  // Next Session Booking state
  const todayStr = new Date().toISOString().slice(0, 10);
  const [nextSessionDate, setNextSessionDate] = useState<string>(todayStr);
  const [nextSessionTime, setNextSessionTime] = useState<string>("09:00");
  const [bookingNextSession, setBookingNextSession] = useState(false);
  const [nextSessionBooked, setNextSessionBooked] = useState(false);
  const [nextSessionError, setNextSessionError] = useState<string>("");

  // Clinical Checklist state
  const CHECKLIST_ITEMS = [
    "Consent Signed",
    "Allergy Checked",
    "Photos Uploaded",
    "Notes Completed",
  ] as const;
  const [checklist, setChecklist] = useState<Record<string, boolean>>({
    "Consent Signed": false,
    "Allergy Checked": false,
    "Photos Uploaded": false,
    "Notes Completed": false,
  });
  const [checklistError, setChecklistError] = useState<string>("");

  // Add Service state
  interface ClinicService {
    _id: string;
    name: string;
    price: number;
    clinicPrice?: number | null;
    durationMinutes?: number;
  }
  const [allServices, setAllServices] = useState<ClinicService[]>([]);
  const [showAddServiceDropdown, setShowAddServiceDropdown] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");
  const [selectedServices, setSelectedServices] = useState<ClinicService[]>([]);
  const [savingServices, setSavingServices] = useState(false);
  const [servicesSaved, setServicesSaved] = useState(false);
  const [servicesError, setServicesError] = useState("");
  const [loadingServices, setLoadingServices] = useState(false);
  const addServiceDropdownRef = useRef<HTMLDivElement | null>(null);

  // Create Package state
  const [showCreatePackage, setShowCreatePackage] = useState(false);
  const [pkgModalName, setPkgModalName] = useState("");
  const [pkgModalPrice, setPkgModalPrice] = useState("");
  const [pkgTreatments, setPkgTreatments] = useState<
    Array<{
      name: string;
      slug: string;
      type?: string;
      mainTreatment?: string | null;
    }>
  >([]);
  const [pkgSelectedTreatments, setPkgSelectedTreatments] = useState<
    Array<{
      treatmentName: string;
      treatmentSlug: string;
      sessions: number;
      allocatedPrice: number;
    }>
  >([]);
  const [pkgTreatmentDropdownOpen, setPkgTreatmentDropdownOpen] =
    useState(false);
  const [pkgTreatmentSearch, setPkgTreatmentSearch] = useState("");
  const [pkgSubmitting, setPkgSubmitting] = useState(false);
  const [pkgError, setPkgError] = useState("");
  const [pkgSuccess, setPkgSuccess] = useState("");
  const [addingPackageToPatient, setAddingPackageToPatient] = useState(false);
  const [createdPackageId, setCreatedPackageId] = useState<string | null>(null);
  const [addingRecService, setAddingRecService] = useState<
    Record<string, boolean>
  >({});
  const [addedRecServices, setAddedRecServices] = useState<
    Record<string, boolean>
  >({});

  // SEND CONSENT FORM MSG ON WHATSAPP
  const [sendMsgLoading, setSendMsgLoading] = useState<boolean>(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (
        isAllocatedDropdownOpen &&
        allocatedDropdownRef.current &&
        target &&
        !allocatedDropdownRef.current.contains(target)
      ) {
        setIsAllocatedDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isAllocatedDropdownOpen]);

  // fetch allocated stock items
  const {
    allocatedItems,
    loading: fetchAllocatedItemsLoading,
    fetchAllocatedItems,
  } = useAllocatedItems({
    // @ts-ignore
    userId: details?.doctorId || "",
    search: allocatedSearch,
  });

  useEffect(() => {
    if (!isOpen || !appointment) {
      setDetails(null);
      setReport(null);
      setPatientReports([]);
      setComplaints("");
      setBeforeImage("");
      setAfterImage("");
      setUploadingBefore(false);
      setUploadingAfter(false);
      setError("");
      setLoading(false);
      setSaving(false);
      setPreviousComplaints([]);
      setLoadingComplaints(false);
      setShowPreviousReports(false);
      setExpandedComplaints({});
      setItems([]);
      setCurrentItem({
        itemId: "",
        code: "",
        name: "",
        description: "",
        quantity: 1,
        uom: "",
      });
      setEditIndex(null);
      setEditingItem(null);
      setSelectedConsentId("");
      setConsentSent(false);
      setActiveTab("complaint");
      setProgressNotes([]);
      setAddingNewEntry(false);
      setNewEntryText("");
      setNewEntryDate(new Date().toISOString().slice(0, 10));
      setProgressError("");
      setMedicines([emptyMedicine()]);
      setAftercareInstructions("");
      setIncludeInPdf(true);
      setPrescriptionError("");
      setPrescriptionSaved(false);
      setPrescriptionHistory([]);
      setLoadingPrescriptionHistory(false);
      setExpandedPrescription({});
      setSmartDepartments([]);
      setLoadingSmartRec(false);
      setNextSessionDate(new Date().toISOString().slice(0, 10));
      setNextSessionTime("09:00");
      setNextSessionBooked(false);
      setNextSessionError("");
      setNextSessionDate(new Date().toISOString().slice(0, 10));
      setNextSessionTime("09:00");
      setNextSessionBooked(false);
      setNextSessionError("");
      return;
    }

    // Fetch consent forms for dropdown
    const fetchConsentForms = async () => {
      try {
        const headers = getAuthHeaders();
        const res = await axios.get("/api/clinic/consent", { headers });
        if (res.data?.success) setConsentForms(res.data.consents || []);
      } catch {
        // silently ignore
      }
    };
    fetchConsentForms();

    const fetchDetails = async () => {
      setLoading(true);
      setError("");
      try {
        const headers = getAuthHeaders();
        const response = await axios.get("/api/clinic/appointment-reports", {
          headers,
          params: { appointmentId: appointment._id },
        });

        if (!response.data?.success) {
          setError(
            response.data?.message || "Failed to load appointment report",
          );
          return;
        }

        setDetails(response.data.appointment || null);

        if (response.data.report) {
          const r = response.data.report;
          setReport({
            reportId: r.reportId,
            temperatureCelsius: r.temperatureCelsius,
            pulseBpm: r.pulseBpm,
            systolicBp: r.systolicBp,
            diastolicBp: r.diastolicBp,
            heightCm: r.heightCm,
            weightKg: r.weightKg,
            waistCm: r.waistCm,
            respiratoryRate: r.respiratoryRate,
            spo2Percent: r.spo2Percent,
            hipCircumference: r.hipCircumference,
            headCircumference: r.headCircumference,
            bmi: r.bmi,
            sugar: r.sugar,
            urinalysis: r.urinalysis,
            otherDetails: r.otherDetails,
            updatedAt: r.updatedAt,
          });
          setComplaints(r.otherDetails || "");
        } else {
          setReport(null);
          setComplaints("");
        }

        setPatientReports(
          Array.isArray(response.data.patientReports)
            ? response.data.patientReports
            : [],
        );

        // Fetch previous complaints for this patient
        if (response.data.appointment?.patientId) {
          fetchPreviousComplaints(response.data.appointment.patientId);
        }

        // Fetch smart recommendations based on doctor's departments
        if (response.data.appointment?.doctorId) {
          fetchSmartRecommendations(
            response.data.appointment.doctorId,
            headers,
          );
        }
      } catch (err: any) {
        setError(
          err.response?.data?.message || "Failed to load appointment report",
        );
      } finally {
        setLoading(false);
      }
    };

    const fetchPreviousComplaints = async (patientId: string) => {
      setLoadingComplaints(true);
      try {
        const headers = getAuthHeaders();
        const complaintsResponse = await axios.get(
          "/api/clinic/patient-complaints",
          {
            headers,
            params: { patientId },
          },
        );

        if (complaintsResponse.data?.success) {
          setPreviousComplaints(complaintsResponse.data.complaints || []);
        }
      } catch (err: any) {
        console.error("Failed to fetch previous complaints:", err);
        // Don't show error for complaints, just log it
      } finally {
        setLoadingComplaints(false);
      }
    };

    fetchDetails();
  }, [isOpen, appointment, getAuthHeaders]);

  // Fetch doctor departments + services for smart recommendations
  const fetchSmartRecommendations = async (
    doctorStaffId: string,
    headers: Record<string, string>,
  ) => {
    setLoadingSmartRec(true);
    try {
      const deptRes = await axios.get("/api/clinic/doctor-departments", {
        headers,
        params: { doctorStaffId },
      });
      if (!deptRes.data?.success) {
        setLoadingSmartRec(false);
        return;
      }
      const departments: {
        _id: string;
        name: string;
        clinicDepartmentId?: string;
      }[] = deptRes.data.departments || [];
      if (departments.length === 0) {
        setSmartDepartments([]);
        setLoadingSmartRec(false);
        return;
      }

      // Fetch services for each department in parallel
      const results = await Promise.allSettled(
        departments.map((dept) =>
          axios.get("/api/clinic/services", {
            headers,
            params: { departmentId: dept.clinicDepartmentId || dept._id },
          }),
        ),
      );

      const enriched: SmartDepartment[] = departments
        .map((dept, i) => {
          const res = results[i];
          const services: SmartService[] =
            res.status === "fulfilled" && res.value.data?.success
              ? (res.value.data.services || []).map((s: any) => ({
                  _id: s._id,
                  name: s.name,
                  price: s.price,
                  clinicPrice: s.clinicPrice,
                  durationMinutes: s.durationMinutes,
                  departmentId: dept._id,
                }))
              : [];
          return { _id: dept._id, name: dept.name, services };
        })
        .filter((d) => d.services.length > 0);

      setSmartDepartments(enriched);
    } catch {
      // silently ignore
    } finally {
      setLoadingSmartRec(false);
    }
  };

  // Book next session for the same patient + doctor
  const bookNextSession = async () => {
    if (!details?.patientId || !details?.doctorId) {
      setNextSessionError("Missing patient or doctor information.");
      return;
    }
    setBookingNextSession(true);
    setNextSessionError("");
    setNextSessionBooked(false);
    try {
      const headers = getAuthHeaders();
      // Calculate toTime = nextSessionTime + 30 minutes
      const [hh, mm] = nextSessionTime.split(":").map(Number);
      const toDate = new Date(0, 0, 0, hh, mm + 30);
      const toTime = `${String(toDate.getHours()).padStart(2, "0")}:${String(toDate.getMinutes()).padStart(2, "0")}`;

      await axios.post(
        "/api/clinic/appointments",
        {
          patientId: details.patientId,
          doctorId: details.doctorId,
          startDate: nextSessionDate,
          fromTime: nextSessionTime,
          toTime,
          status: "booked",
          followType: "follow up",
          bookedFrom: "doctor",
          referral: "direct",
          emergency: "no",
        },
        { headers },
      );
      setNextSessionBooked(true);
    } catch (err: any) {
      setNextSessionError(
        err.response?.data?.message || "Failed to book next session.",
      );
    } finally {
      setBookingNextSession(false);
    }
  };

  // Fetch all clinic services
  const fetchAllServices = async () => {
    setLoadingServices(true);
    try {
      const headers = getAuthHeaders();
      const res = await axios.get("/api/clinic/services", { headers });
      if (res.data?.success) {
        setAllServices(res.data.services || []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingServices(false);
    }
  };

  // Save selected services to appointment
  const saveServicesToAppointment = async () => {
    if (!details?.appointmentId || selectedServices.length === 0) return;
    setSavingServices(true);
    setServicesError("");
    setServicesSaved(false);
    try {
      const headers = getAuthHeaders();
      const serviceIds = selectedServices.map((s) => s._id);
      await axios.patch(
        `/api/clinic/appointment-services/${details.appointmentId}`,
        { serviceIds },
        { headers },
      );
      setServicesSaved(true);
      setShowAddServiceDropdown(false);
    } catch (err: any) {
      setServicesError(
        err.response?.data?.message || "Failed to save services.",
      );
    } finally {
      setSavingServices(false);
    }
  };

  // Fetch services for package creation (from /api/clinic/services only)
  const fetchPkgTreatments = async () => {
    try {
      const headers = getAuthHeaders();
      const res = await axios.get("/api/clinic/services", { headers });
      if (res.data?.success) {
        const flat: Array<{
          name: string;
          slug: string;
          type?: string;
          mainTreatment?: string | null;
        }> = [];
        (res.data.services || []).forEach((svc: any) => {
          flat.push({
            name: svc.name,
            slug: svc.serviceSlug || svc._id,
            type: "service",
            mainTreatment: null,
          });
        });
        setPkgTreatments(flat);
      }
    } catch {
      /* ignore */
    }
  };

  // Create package and optionally add to patient
  const handleCreatePackageModal = async (addToPatient: boolean) => {
    setPkgError("");
    setPkgSuccess("");
    if (!pkgModalName.trim()) {
      setPkgError("Please enter a package name");
      return;
    }
    if (!pkgModalPrice || parseFloat(pkgModalPrice) < 0) {
      setPkgError("Please enter a valid price");
      return;
    }
    if (pkgSelectedTreatments.length === 0) {
      setPkgError("Please select at least one treatment");
      return;
    }
    const totalAllocated = pkgSelectedTreatments.reduce(
      (sum, t) => sum + (parseFloat(String(t.allocatedPrice)) || 0),
      0,
    );
    const packagePrice = parseFloat(pkgModalPrice);
    if (Math.abs(totalAllocated - packagePrice) > 0.01) {
      setPkgError(
        `Total allocated prices (${totalAllocated.toFixed(2)}) must equal the package price (${packagePrice.toFixed(2)})`,
      );
      return;
    }
    setPkgSubmitting(true);
    try {
      const headers = getAuthHeaders();
      const res = await axios.post(
        "/api/clinic/packages",
        {
          name: pkgModalName.trim(),
          totalPrice: packagePrice,
          treatments: pkgSelectedTreatments,
        },
        { headers },
      );
      if (res.data?.success) {
        const newPkgId = res.data.package?._id || res.data.packageId || null;
        setCreatedPackageId(newPkgId);
        if (addToPatient && newPkgId && details?.patientId) {
          setAddingPackageToPatient(true);
          try {
            await axios.post(
              "/api/clinic/assign-package-to-patient",
              {
                patientId: details.patientId,
                packageId: newPkgId,
              },
              { headers },
            );
            setPkgSuccess("Package created and added to patient profile!");
          } catch {
            setPkgSuccess(
              "Package created. (Could not add to patient profile)",
            );
          } finally {
            setAddingPackageToPatient(false);
          }
        } else {
          setPkgSuccess("Package created successfully!");
        }
        setPkgModalName("");
        setPkgModalPrice("");
        setPkgSelectedTreatments([]);
        setPkgTreatmentSearch("");
      } else {
        setPkgError(res.data?.message || "Failed to create package");
      }
    } catch (err: any) {
      setPkgError(err.response?.data?.message || "Failed to create package");
    } finally {
      setPkgSubmitting(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "progress" || !details?.patientId) return;
    const fetchProgressNotes = async () => {
      setLoadingProgressNotes(true);
      setProgressError("");
      try {
        const headers = getAuthHeaders();
        const res = await axios.get("/api/clinic/progress-notes", {
          headers,
          params: { patientId: details.patientId },
        });
        if (res.data?.success) {
          setProgressNotes(res.data.notes || []);
        }
      } catch {
        setProgressError("Failed to load progress notes");
      } finally {
        setLoadingProgressNotes(false);
      }
    };
    fetchProgressNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, details?.patientId]);

  // Fetch prescription history when switching to prescription tab
  useEffect(() => {
    if (activeTab !== "prescription" || !details?.patientId) return;
    const fetchPrescriptionHistory = async () => {
      setLoadingPrescriptionHistory(true);
      try {
        const headers = getAuthHeaders();
        const res = await axios.get("/api/clinic/prescriptions", {
          headers,
          params: { patientId: details.patientId },
        });
        if (res.data?.success) {
          setPrescriptionHistory(res.data.prescriptions || []);
        }
      } catch {
        // silently ignore history fetch errors
      } finally {
        setLoadingPrescriptionHistory(false);
      }
    };
    fetchPrescriptionHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, details?.patientId]);

  const formatDate = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleDateString();
  };

  const formatDateTime = (value?: string) => {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;
    return d.toLocaleString();
  };

  const handleSaveComplaints = async () => {
    if (!appointment || !details) return;

    if (!report || !report.reportId) {
      setError(
        "Vitals report not found. Please fill the appointment report first, then add complaints.",
      );
      return;
    }

    if (!complaints.trim()) {
      setError("Please enter complaint notes before saving.");
      return;
    }

    // Validate clinical checklist
    const unchecked = CHECKLIST_ITEMS.filter((item) => !checklist[item]);
    if (unchecked.length > 0) {
      setChecklistError(
        `Please tick all checklist items before saving: ${unchecked.join(", ")}`,
      );
      return;
    }
    setChecklistError("");

    setSaving(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      await axios.post(
        "/api/clinic/patient-complaints",
        {
          appointmentId: details.appointmentId,
          appointmentReportId: report.reportId,
          complaints: complaints.trim(),
          items: items || [],
          beforeImage: beforeImage || null,
          afterImage: afterImage || null,
        },
        { headers },
      );

      // Refresh previous complaints list
      if (details.patientId) {
        const complaintsResponse = await axios.get(
          "/api/clinic/patient-complaints",
          {
            headers,
            params: { patientId: details.patientId },
          },
        );
        if (complaintsResponse.data?.success) {
          setPreviousComplaints(complaintsResponse.data.complaints || []);
        }
      }

      // Clear the input
      setComplaints("");
      setBeforeImage("");
      setAfterImage("");
      setError("");

      // set items to empty array
      setItems([]);
      fetchAllocatedItems();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save complaints");
    } finally {
      setSaving(false);
    }
  };

  const handleCurrentItemChange = (field: keyof StockRow, value: any) => {
    // if (field === "itemId") {
    //   const item = .find((i) => i._id === value);
    //   const selectedUOM = uoms.find((u) => u?.name === item?.level0?.uom);
    //   if (item) {
    //     setCurrentItem((prev) => ({
    //       ...prev,
    //       itemId: value,
    //       code: item.code,
    //       name: item.name,
    //       uom: selectedUOM ? selectedUOM.name : "",
    //       description: item.description || "",
    //     }));
    //     return;
    //   }
    // }
    setCurrentItem((prev) => ({
      ...prev,
      [field]: field === "quantity" ? parseFloat(value) || 0 : value,
    }));
  };

  const addCurrentItem = () => {
    if (!currentItem.name.trim() || !currentItem.quantity || !currentItem.uom) {
      setError("Please complete item selection, quantity and UOM");
      return;
    }
    setItems((prev) => [...prev, { ...currentItem }]);
    setCurrentItem({
      itemId: "",
      code: "",
      name: "",
      description: "",
      quantity: 1,
      uom: "",
    });
    setError("");
  };

  const removeItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
    if (editIndex === index) {
      setEditIndex(null);
      setEditingItem(null);
    }
  };

  const startEditItem = (index: number) => {
    setEditIndex(index);
    setEditingItem({ ...items[index] });
  };

  const handleEditingItemChange = (field: keyof StockRow, value: any) => {
    if (!editingItem) return;
    // if (field === "itemId") {
    //   const item = stockItems.find((i) => i._id === value);
    //   const selectedUOM = uoms.find((u) => u?.name === item?.level0?.uom);
    //   if (item) {
    //     setEditingItem({
    //       ...editingItem,
    //       itemId: value,
    //       code: item.code,
    //       name: item.name,
    //       uom: selectedUOM ? selectedUOM.name : "",
    //     });
    //     return;
    //   }
    // }
    setEditingItem({
      ...editingItem,
      [field]: field === "quantity" ? parseFloat(value) || 0 : value,
    } as any);
  };

  const handleDeleteComplaint = async (complaint: PreviousComplaint | null) => {
    if (!complaint) return;
    try {
      setDeleting(true);
      const headers = getAuthHeaders();
      await axios.delete(`/api/clinic/patient-complaints`, {
        headers,
        params: {
          complaintId: complaint._id,
        },
      });
      setPreviousComplaints((prev) =>
        prev.filter((pc) => pc._id !== complaint._id),
      );
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete complaint");
    } finally {
      setDeleting(false);
      setIsOpenDeleteComplaintModal(false);
    }
  };

  const saveEditItem = () => {
    if (editIndex == null || editingItem == null) return;
    if (!editingItem.name.trim() || !editingItem.quantity || !editingItem.uom) {
      setError("Please complete item fields before saving");
      return;
    }
    const updated = [...items];
    updated[editIndex] = { ...editingItem };
    setItems(updated);
    setEditIndex(null);
    setEditingItem(null);
    setError("");
  };

  const cancelEditItem = () => {
    setEditIndex(null);
    setEditingItem(null);
  };

  /*---------------------------
  // SEND CONSENT FORM MESSAGE ON WHATSAPP 
  //---------------------------*/
  const handleSendConsentMsgOnWhatsapp = async () => {
    if (!selectedConsentId) return;

    try {
      setSendMsgLoading(true);
      setSendingConsent(true);
      const token = getTokenByPath();
      console.log({ details });

      const { data } = await axios.post(
        "/api/messages/send-message",
        {
          patientId: details?.patientId,
          providerId: "6952256c4a46b2f1eb01be86",
          channel: "whatsapp",
          content: `Please review and sign the consent form by clicking the link below:

https://consent-form.zeva.co.ke

Thank you.`,
          mediaUrl: "",
          mediaType: "",
          source: "Zeva",
          messageType: "conversational",
          templateId: "69c38b4d26b8217e1ba78f8a",
          // for whatsapp template if body variables exist
          headerParameters: [],
          bodyParameters: [
            {
              type: "text",
              text: "https://consent-form.zeva.co.ke",
            },
          ],
          attachments: [],
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (data && data?.success) {
        setConsentSent(true);
      }
    } catch (error: any) {
      console.log(
        "Error in send consent form msg on whatsapp: ",
        error?.message,
      );
    } finally {
      setSendMsgLoading(false);
      setSendingConsent(false);
    }
  };

  if (!isOpen || !appointment) {
    return null;
  }

  const selectedAllocatedItem: any =
    allocatedItems.find((si: any) => si._id === currentItem.itemId) || null;
  const availableForSelectedUom: number =
    selectedAllocatedItem?.quantitiesByUom?.find(
      (q: any) => q?.uom === currentItem.uom,
    )?.quantity ?? 0;
  const exceedsAvailable =
    !!currentItem.uom &&
    typeof currentItem.quantity === "number" &&
    currentItem.quantity > availableForSelectedUom &&
    availableForSelectedUom > 0;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
        <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Patient Complaints & EMR Overview
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-gray-200 px-6 bg-white">
            {(
              [
                {
                  key: "complaint",
                  label: "Complaint",
                  icon: <NotebookPen className="w-4 h-4" />,
                },
                {
                  key: "progress",
                  label: "Progress",
                  icon: <TrendingUp className="w-4 h-4" />,
                },
                {
                  key: "prescription",
                  label: "Prescription",
                  icon: <Pill className="w-4 h-4" />,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                  activeTab === tab.key
                    ? "border-red-500 text-red-600"
                    : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="px-6 py-4 overflow-y-auto space-y-4">
            {/* ── COMPLAINT TAB ── */}
            {activeTab === "complaint" && (
              <>
                {error && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                {loading && (
                  <div className="py-8 text-center text-gray-500 text-sm">
                    Loading patient details and reports...
                  </div>
                )}

                {!loading && details && (
                  <>
                    {/* 1. Patient Details - light green - Compact single row */}
                    <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                      <h3 className="text-xs font-semibold text-emerald-900 uppercase tracking-wide mb-1">
                        Patient Details
                      </h3>
                      <div className="text-xs text-emerald-900 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          <span className="font-semibold">Name:</span>{" "}
                          {details.patientName}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-semibold">EMR:</span>{" "}
                          {details.emrNumber || "-"}
                        </span>
                        <span>•</span>
                        <span className="capitalize">
                          <span className="font-semibold">Gender:</span>{" "}
                          {details.gender || "-"}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-semibold">Mobile:</span>{" "}
                          {details.mobileNumber || "-"}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-semibold">Email:</span>{" "}
                          {details.email || "-"}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-semibold">ID:</span>{" "}
                          {details.patientId.slice(-8)}
                        </span>
                      </div>
                    </div>

                    {/* 2. Appointment & Doctor - light blue - Compact single row */}
                    <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                      <h3 className="text-xs font-semibold text-sky-900 uppercase tracking-wide mb-1">
                        Appointment & Doctor
                      </h3>
                      <div className="text-xs text-sky-900 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>
                          <span className="font-semibold">Date:</span>{" "}
                          {formatDate(details.startDate)}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-semibold">Time:</span>{" "}
                          {details.fromTime && details.toTime
                            ? `${details.fromTime} – ${details.toTime}`
                            : "-"}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-semibold">Doctor:</span>{" "}
                          {details.doctorName}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-semibold">Email:</span>{" "}
                          {details.doctorEmail || "-"}
                        </span>
                        <span>•</span>
                        <span>
                          <span className="font-semibold">Status:</span>{" "}
                          {details.status || "-"}
                        </span>
                        {Array.isArray(details.serviceNames) &&
                          details.serviceNames.length > 0 && (
                            <>
                              <span>•</span>
                              <span>
                                <span className="font-semibold">
                                  Treatments:
                                </span>{" "}
                                {details.serviceNames.join(", ")}
                              </span>
                            </>
                          )}
                      </div>
                    </div>

                    {/* 3. Appointment Reports - light red */}
                    <div className="rounded-lg border border-rose-100 bg-rose-50 px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="text-xs font-semibold text-rose-900 uppercase tracking-wide">
                          Appointment Reports
                        </h3>
                        {patientReports.length > 0 && (
                          <button
                            onClick={() =>
                              setShowPreviousReports(!showPreviousReports)
                            }
                            className="text-xs px-2 py-1 bg-rose-200 text-rose-900 rounded hover:bg-rose-300 transition"
                          >
                            {showPreviousReports ? "Hide" : "Previous"} (
                            {patientReports.length})
                          </button>
                        )}
                      </div>

                      {report ? (
                        <div className="text-xs text-rose-900">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="font-semibold">Latest:</span>
                            <span>Temp: {report.temperatureCelsius}°C</span>
                            <span>•</span>
                            <span>Pulse: {report.pulseBpm} bpm</span>
                            <span>•</span>
                            <span>
                              BP: {report.systolicBp}/{report.diastolicBp} mmHg
                            </span>
                            {report.weightKg != null && (
                              <>
                                <span>•</span>
                                <span>Weight: {report.weightKg} kg</span>
                              </>
                            )}
                            {report.heightCm != null && (
                              <>
                                <span>•</span>
                                <span>Height: {report.heightCm} cm</span>
                              </>
                            )}
                            {report.bmi != null && (
                              <>
                                <span>•</span>
                                <span>BMI: {report.bmi}</span>
                              </>
                            )}
                            {report.spo2Percent != null && (
                              <>
                                <span>•</span>
                                <span>SpO₂: {report.spo2Percent}%</span>
                              </>
                            )}
                            {report.respiratoryRate != null && (
                              <>
                                <span>•</span>
                                <span>Resp: {report.respiratoryRate}/min</span>
                              </>
                            )}
                            {report.waistCm != null && (
                              <>
                                <span>•</span>
                                <span>Waist: {report.waistCm} cm</span>
                              </>
                            )}
                            {(report.sugar || report.urinalysis) && (
                              <>
                                {report.sugar && (
                                  <>
                                    <span>•</span>
                                    <span>Sugar: {report.sugar}</span>
                                  </>
                                )}
                                {report.urinalysis && (
                                  <>
                                    <span>•</span>
                                    <span>Urinalysis: {report.urinalysis}</span>
                                  </>
                                )}
                              </>
                            )}
                            <span>•</span>
                            <span className="text-rose-700">
                              Updated:{" "}
                              {report.updatedAt
                                ? formatDateTime(report.updatedAt)
                                : "-"}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-rose-700">
                          No vitals report found for this appointment yet.
                        </p>
                      )}

                      {showPreviousReports && patientReports.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-rose-200 space-y-1.5">
                          <p className="text-xs font-semibold text-rose-900 mb-1">
                            Previous Reports ({patientReports.length})
                          </p>
                          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-[11px] text-rose-900">
                            {patientReports.map((r) => (
                              <div
                                key={
                                  r.reportId ||
                                  `${r.appointmentId}-${r.createdAt}`
                                }
                                className="rounded border border-rose-200 bg-rose-100/60 px-2 py-1.5"
                              >
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                                  <span className="font-semibold">
                                    {formatDateTime(r.updatedAt)}
                                  </span>
                                  {r.doctorName && (
                                    <>
                                      <span>•</span>
                                      <span>Dr. {r.doctorName}</span>
                                    </>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span>Temp: {r.temperatureCelsius}°C</span>
                                  <span>•</span>
                                  <span>Pulse: {r.pulseBpm} bpm</span>
                                  <span>•</span>
                                  <span>
                                    BP: {r.systolicBp}/{r.diastolicBp} mmHg
                                  </span>
                                  {r.weightKg != null && (
                                    <>
                                      <span>•</span>
                                      <span>Weight: {r.weightKg} kg</span>
                                    </>
                                  )}
                                  {r.heightCm != null && (
                                    <>
                                      <span>•</span>
                                      <span>Height: {r.heightCm} cm</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Send Consent Form ── */}
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <FileText
                          size={15}
                          className="text-blue-600 flex-shrink-0"
                        />
                        <h3 className="text-sm font-semibold text-blue-900">
                          Send Consent Form to Patient
                        </h3>
                      </div>
                      <p className="text-xs text-blue-700">
                        Select a consent form and send it to the patient for
                        acknowledgment.
                      </p>
                      <div className="flex gap-2 items-center">
                        <select
                          value={selectedConsentId}
                          onChange={(e) => {
                            setSelectedConsentId(e.target.value);
                            setConsentSent(false);
                          }}
                          className="flex-1 border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 text-gray-700"
                        >
                          <option value="">-- Select Consent Form --</option>
                          {consentForms.map((cf) => (
                            <option key={cf._id} value={cf._id}>
                              {cf.formName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={
                            !selectedConsentId ||
                            sendingConsent ||
                            sendMsgLoading ||
                            consentSent
                          }
                          onClick={handleSendConsentMsgOnWhatsapp}
                          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap
                        ${
                          consentSent
                            ? "bg-green-100 text-green-700 border border-green-300 cursor-default"
                            : "bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-blue-200"
                        }`}
                        >
                          {sendingConsent ? (
                            <>
                              <RefreshCw size={13} className="animate-spin" />
                              Sending...
                            </>
                          ) : consentSent ? (
                            <>
                              <Check size={13} />
                              Sent
                            </>
                          ) : (
                            <>
                              <Send size={13} />
                              Send
                            </>
                          )}
                        </button>
                      </div>
                      {consentSent && (
                        <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                          <Check size={12} />
                          Consent form sent successfully to the patient.
                        </p>
                      )}
                    </div>

                    {/* Notebook-like complaints input */}
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                      <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wide">
                        Doctor&apos;s Complaint Notes
                      </h3>
                      <p className="text-xs text-amber-800">
                        Write all patient complaints here. This will be saved
                        together with the appointment report.
                      </p>
                      <div className="relative">
                        <textarea
                          value={complaints}
                          onChange={(e) => setComplaints(e.target.value)}
                          rows={6}
                          className="w-full rounded-xl border border-amber-200 bg-[repeating-linear-gradient(white,white_28px,#fde68a_30px)] px-4 py-3 text-sm text-gray-900 shadow-inner focus:outline-none focus:ring-2 focus:ring-amber-400"
                          placeholder="Start writing complaints in a notebook style..."
                        />
                        <div className="pointer-events-none absolute inset-y-0 left-10 border-l border-amber-300" />
                      </div>

                      {/* Image Upload Section */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        {/* Before Image */}
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-amber-900 uppercase">
                            Before Image
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="relative group">
                              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-amber-300 bg-white flex items-center justify-center overflow-hidden">
                                {beforeImage ? (
                                  <img
                                    src={beforeImage}
                                    alt="Before"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Upload className="w-6 h-6 text-amber-400" />
                                )}
                                {uploadingBefore && (
                                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                    <RefreshCw className="w-5 h-5 text-white animate-spin" />
                                  </div>
                                )}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setUploadingBefore(true);
                                  const res = await handleUpload(file);
                                  if (res?.success) setBeforeImage(res.url);
                                  setUploadingBefore(false);
                                }}
                              />
                            </div>
                            {beforeImage && (
                              <button
                                onClick={() => setBeforeImage("")}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {/* After Image */}
                        <div className="space-y-2">
                          <label className="block text-xs font-semibold text-amber-900 uppercase">
                            After Image
                          </label>
                          <div className="flex items-center gap-3">
                            <div className="relative group">
                              <div className="w-20 h-20 rounded-lg border-2 border-dashed border-amber-300 bg-white flex items-center justify-center overflow-hidden">
                                {afterImage ? (
                                  <img
                                    src={afterImage}
                                    alt="After"
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Upload className="w-6 h-6 text-amber-400" />
                                )}
                                {uploadingAfter && (
                                  <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                    <RefreshCw className="w-5 h-5 text-white animate-spin" />
                                  </div>
                                )}
                              </div>
                              <input
                                type="file"
                                accept="image/*"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={async (e) => {
                                  const file = e.target.files?.[0];
                                  if (!file) return;
                                  setUploadingAfter(true);
                                  const res = await handleUpload(file);
                                  if (res?.success) setAfterImage(res.url);
                                  setUploadingAfter(false);
                                }}
                              />
                            </div>
                            {afterImage && (
                              <button
                                onClick={() => setAfterImage("")}
                                className="text-xs text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="flex items-center gap-2">
                            <div className="text-sm font-semibold text-blue-900 uppercase tracking-wide flex items-center gap-2">
                              Stock Items{" "}
                              <button
                                onClick={() => {
                                  setIsOpenStockTransferModal(true);
                                }}
                                className="flex items-center gap-1 text-xs text-blue-800 p-1.5 rounded-md bg-white border border-blue-800 hover:bg-blue-100 transition-colors"
                              >
                                <RefreshCw size={16} /> Stock Transfer Request
                              </button>
                            </div>
                          </div>
                          <p className="text-xs text-blue-800 mt-1">
                            Add items related to this appointment
                          </p>
                        </div>
                      </div>
                      <div className="border border-blue-200 rounded-lg p-3 bg-white">
                        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                          <div
                            className="sm:col-span-3 space-y-1"
                            ref={allocatedDropdownRef}
                          >
                            <label className="block text-xs font-bold text-gray-900">
                              Item <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <div
                                className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 transition-all disabled:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-between cursor-pointer bg-white h-10"
                                onClick={() =>
                                  setIsAllocatedDropdownOpen(
                                    !isAllocatedDropdownOpen,
                                  )
                                }
                              >
                                <span
                                  className={
                                    currentItem.itemId
                                      ? "text-gray-900"
                                      : "text-gray-400"
                                  }
                                >
                                  {allocatedItems.find(
                                    (si: any) => si._id === currentItem.itemId,
                                  )?.item?.name || "Select an item"}
                                </span>
                                <ChevronDown
                                  className={`w-4 h-4 text-gray-500 transition-transform ${
                                    isAllocatedDropdownOpen ? "rotate-180" : ""
                                  }`}
                                />
                              </div>

                              {isAllocatedDropdownOpen && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                  <div className="p-2 border-b border-gray-200">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        placeholder="Search items..."
                                        value={allocatedSearch}
                                        onChange={(e) =>
                                          setAllocatedSearch(e.target.value)
                                        }
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
                                        autoFocus
                                      />
                                    </div>
                                  </div>

                                  {fetchAllocatedItemsLoading && (
                                    <div className="p-4 text-sm text-center text-gray-500">
                                      Loading items...
                                    </div>
                                  )}

                                  {!fetchAllocatedItemsLoading && (
                                    <>
                                      {allocatedItems.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500 text-sm">
                                          {allocatedSearch
                                            ? "No items found"
                                            : "No items available"}
                                        </div>
                                      ) : (
                                        <ul className="py-1">
                                          {allocatedItems
                                            .filter((si: any) => {
                                              const n = (
                                                si.item?.name || ""
                                              ).toLowerCase();
                                              const c = (
                                                si.item?.code || ""
                                              ).toLowerCase();
                                              const q =
                                                allocatedSearch.toLowerCase();
                                              return (
                                                n.includes(q) || c.includes(q)
                                              );
                                            })
                                            .map((si: any) => (
                                              <li
                                                key={si._id}
                                                className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer"
                                                onClick={() => {
                                                  const it = si.item || {};
                                                  console.log({ it, si });
                                                  setCurrentItem((prev) => ({
                                                    ...prev,
                                                    code: it.code || "",
                                                    itemId: si._id || "",
                                                    name: it.name || "",
                                                    description:
                                                      it.description || "",
                                                    uom:
                                                      it.uom || prev.uom || "",
                                                  }));
                                                  setIsAllocatedDropdownOpen(
                                                    false,
                                                  );
                                                  setAllocatedSearch("");
                                                }}
                                              >
                                                <div className="font-medium">
                                                  {si.item?.name || "-"}
                                                </div>
                                                {(si.item?.code ||
                                                  si.location?.name) && (
                                                  <div className="text-xs text-gray-500">
                                                    {si.item?.code
                                                      ? `Code: ${si.item.code}`
                                                      : ""}
                                                  </div>
                                                )}
                                              </li>
                                            ))}
                                        </ul>
                                      )}
                                    </>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="sm:col-span-3 space-y-1">
                            <label className="block text-xs font-bold text-gray-900">
                              Description
                            </label>
                            <input
                              type="text"
                              value={currentItem.description || ""}
                              onChange={(e) =>
                                handleCurrentItemChange(
                                  "description",
                                  e.target.value,
                                )
                              }
                              placeholder="Description"
                              className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 h-10"
                            />
                          </div>
                          <div className="sm:col-span-3 space-y-1">
                            <label className="block text-xs font-bold text-gray-900">
                              Qty <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="number"
                              min={1}
                              value={currentItem.quantity}
                              onChange={(e) =>
                                handleCurrentItemChange(
                                  "quantity",
                                  e.target.value,
                                )
                              }
                              placeholder="Qty"
                              className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 h-10"
                            />
                            {currentItem.uom && (
                              <p className="text-xs text-gray-500">
                                Available: {availableForSelectedUom}{" "}
                                {currentItem.uom}
                              </p>
                            )}
                            {exceedsAvailable && (
                              <p className="text-xs text-red-600">
                                Quantity exceeds available for selected UOM
                              </p>
                            )}
                          </div>

                          <div className="sm:col-span-3 space-y-1">
                            <label className="block text-xs font-bold text-gray-900">
                              UOM <span className="text-red-500">*</span>
                            </label>
                            <select
                              value={currentItem.uom || ""}
                              onChange={(e) =>
                                handleCurrentItemChange("uom", e.target.value)
                              }
                              className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 h-10"
                            >
                              <option value="">Select UOM</option>
                              {!allocatedItems?.find(
                                (i) => i?._id === currentItem?.itemId,
                              ) ? (
                                <option value="">Loading UOMs...</option>
                              ) : allocatedItems?.find(
                                  (i) => i?._id === currentItem?.itemId,
                                ) && currentItem ? (
                                (
                                  allocatedItems?.find(
                                    (i) => i?._id === currentItem?.itemId,
                                  )?.quantitiesByUom || []
                                )?.map((i, index: number) => (
                                  <option key={index.toString()} value={i.uom}>
                                    {i.uom}
                                  </option>
                                ))
                              ) : (
                                <></>
                              )}
                            </select>
                          </div>
                          <div className="sm:col-span-3 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setItems([]);
                              }}
                              disabled={
                                items.length === 0 || !availableForSelectedUom
                              }
                              className="inline-flex items-center px-3 py-2.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 disabled:bg-gray-400 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Reset
                            </button>
                            <button
                              type="button"
                              onClick={addCurrentItem}
                              disabled={
                                !currentItem.name.trim() ||
                                !currentItem.quantity ||
                                !currentItem.uom ||
                                exceedsAvailable
                              }
                              className="inline-flex items-center px-3 py-2.5 border border-transparent text-xs font-medium rounded-lg text-white bg-gray-800 hover:bg-gray-900"
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add Item
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-800">
                              <tr>
                                <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                                  SI No
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                                  Item
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                                  Description
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                                  Qty
                                </th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                                  UOM
                                </th>

                                <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                              {items.length === 0 ? (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="px-3 py-8 text-sm text-center text-gray-500"
                                  >
                                    No Items Added
                                  </td>
                                </tr>
                              ) : (
                                items.map((item, index) => {
                                  const isEditing =
                                    editIndex === index && editingItem;
                                  return (
                                    <tr
                                      key={index}
                                      className="hover:bg-gray-50"
                                    >
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {index + 1}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {isEditing ? (
                                          <select
                                            value={editingItem?.itemId || ""}
                                            onChange={(e) =>
                                              handleEditingItemChange(
                                                "itemId",
                                                e.target.value,
                                              )
                                            }
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                          >
                                            <option value="">
                                              Select Item
                                            </option>
                                            {allocatedItems.map((si: any) => (
                                              <option
                                                key={si._id}
                                                value={si.item?.itemId || ""}
                                              >
                                                {si.item?.name || "-"}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          item.name
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {isEditing ? (
                                          <input
                                            value={
                                              editingItem?.description || ""
                                            }
                                            onChange={(e) =>
                                              handleEditingItemChange(
                                                "description",
                                                e.target.value,
                                              )
                                            }
                                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                                          />
                                        ) : (
                                          item.description || "-"
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {isEditing ? (
                                          <input
                                            type="number"
                                            min={1}
                                            value={editingItem?.quantity || 1}
                                            onChange={(e) =>
                                              handleEditingItemChange(
                                                "quantity",
                                                e.target.value,
                                              )
                                            }
                                            className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded text-right"
                                          />
                                        ) : (
                                          item.quantity
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-900">
                                        {isEditing ? (
                                          <select
                                            value={editingItem?.uom || ""}
                                            onChange={(e) =>
                                              handleEditingItemChange(
                                                "uom",
                                                e.target.value,
                                              )
                                            }
                                            className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded"
                                          >
                                            <option value="">Select UOM</option>
                                            {!allocatedItems?.find(
                                              (i) =>
                                                i?._id === editingItem?.itemId,
                                            ) ? (
                                              <option value="">
                                                Loading UOMs...
                                              </option>
                                            ) : allocatedItems?.find(
                                                (i) =>
                                                  i?._id ===
                                                  editingItem?.itemId,
                                              ) && editingItem ? (
                                              (
                                                allocatedItems?.find(
                                                  (i) =>
                                                    i?._id ===
                                                    editingItem?.itemId,
                                                )?.quantitiesByUom || []
                                              )?.map((i, index: number) => (
                                                <option
                                                  key={index.toString()}
                                                  value={i.uom}
                                                >
                                                  {i.uom}
                                                </option>
                                              ))
                                            ) : (
                                              <></>
                                            )}
                                          </select>
                                        ) : (
                                          item.uom || "-"
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-sm">
                                        {isEditing ? (
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              onClick={saveEditItem}
                                              className="text-green-600 hover:text-green-800"
                                            >
                                              <Check className="w-4 h-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={cancelEditItem}
                                              className="text-gray-600 hover:text-gray-800"
                                            >
                                              <XIcon className="w-4 h-4" />
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="flex gap-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                startEditItem(index)
                                              }
                                              className="text-blue-600 hover:text-blue-900"
                                            >
                                              <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => removeItem(index)}
                                              className="text-red-600 hover:text-red-900"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </button>
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>

                    {/* Previous Complaints Table */}
                    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-3">
                      <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                        Previous Complaints ({previousComplaints.length})
                      </h3>

                      {loadingComplaints ? (
                        <div className="py-4 text-center text-gray-500 text-sm">
                          Loading previous complaints...
                        </div>
                      ) : previousComplaints.length === 0 ? (
                        <div className="py-4 text-center text-gray-500 text-sm">
                          No previous complaints found for this patient.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200">
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Complaints
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Date of Complaint
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Doctor Name
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                  Action
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {previousComplaints.map((complaint) => {
                                const hasItems =
                                  Array.isArray(complaint.items) &&
                                  complaint.items.length > 0;
                                const isOpen =
                                  !!expandedComplaints[complaint._id];
                                return (
                                  <React.Fragment key={complaint._id}>
                                    <tr className="hover:bg-gray-50 transition-colors">
                                      <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                                        <div className="whitespace-pre-wrap break-words">
                                          {complaint.complaints}
                                        </div>
                                        {(complaint.beforeImage ||
                                          complaint.afterImage) && (
                                          <div className="flex gap-2 mt-2">
                                            {complaint.beforeImage && (
                                              <div className="space-y-1">
                                                <p className="text-[10px] font-semibold text-gray-500 uppercase">
                                                  Before
                                                </p>
                                                <a
                                                  href={complaint.beforeImage}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="block w-12 h-12 rounded border border-gray-200 overflow-hidden hover:opacity-80 transition"
                                                >
                                                  <img
                                                    src={complaint.beforeImage}
                                                    alt="Before"
                                                    className="w-full h-full object-cover"
                                                  />
                                                </a>
                                              </div>
                                            )}
                                            {complaint.afterImage && (
                                              <div className="space-y-1">
                                                <p className="text-[10px] font-semibold text-gray-500 uppercase">
                                                  After
                                                </p>
                                                <a
                                                  href={complaint.afterImage}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="block w-12 h-12 rounded border border-gray-200 overflow-hidden hover:opacity-80 transition"
                                                >
                                                  <img
                                                    src={complaint.afterImage}
                                                    alt="After"
                                                    className="w-full h-full object-cover"
                                                  />
                                                </a>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                        {formatDateTime(complaint.createdAt)}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700">
                                        {typeof complaint.doctorId ===
                                          "object" && complaint.doctorId?.name
                                          ? complaint.doctorId.name
                                          : "Unknown Doctor"}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700">
                                        <div className="flex items-center gap-2">
                                          {hasItems ? (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setExpandedComplaints(
                                                  (prev) => ({
                                                    ...prev,
                                                    [complaint._id]:
                                                      !prev[complaint._id],
                                                  }),
                                                )
                                              }
                                              className="inline-flex items-center gap-1 px-2 py-1 border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
                                            >
                                              {isOpen ? (
                                                <>
                                                  <ChevronUp className="w-4 h-4" />
                                                  Hide Items
                                                </>
                                              ) : (
                                                <>
                                                  <ChevronDown className="w-4 h-4" />
                                                  Show Items
                                                </>
                                              )}
                                            </button>
                                          ) : (
                                            <span className="text-xs text-gray-400">
                                              No Items
                                            </span>
                                          )}
                                          {new Date(complaint.createdAt) >
                                            new Date(
                                              Date.now() - 24 * 60 * 60 * 1000,
                                            ) && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setSelectedComplaint(
                                                    complaint,
                                                  );
                                                  setIsOpenViewComplaintModal(
                                                    true,
                                                  );
                                                }}
                                                className="inline-flex items-center gap-1 px-2 py-1 border border-blue-300 rounded text-blue-700 hover:bg-blue-50"
                                              >
                                                <Eye className="w-4 h-4" />
                                                View
                                              </button>
                                              {/* <button
                                            type="button"
                                            onClick={() => {
                                              setEditingComplaint(complaint);
                                              setIsEditModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 border border-blue-300 rounded text-blue-700 hover:bg-blue-50"
                                          >
                                            <Pencil className="w-4 h-4" />
                                            Edit
                                          </button> */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setDeletedComplaint(
                                                    complaint,
                                                  );
                                                  setIsOpenDeleteComplaintModal(
                                                    true,
                                                  );
                                                }}
                                                className="inline-flex items-center gap-1 px-2 py-1 border border-red-300 rounded text-red-700 hover:bg-red-50"
                                              >
                                                <Trash2 className="w-4 h-4" />
                                                Delete
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                    {hasItems && isOpen && (
                                      <tr className="bg-gray-50">
                                        <td colSpan={4} className="px-4 py-3">
                                          <div className="border border-gray-200 rounded-md overflow-hidden">
                                            <table className="w-full text-sm">
                                              <thead className="bg-gray-100 border-b border-gray-200">
                                                <tr>
                                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                    Code
                                                  </th>
                                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                    Item
                                                  </th>
                                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                    Description
                                                  </th>
                                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                    Qty
                                                  </th>
                                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                    UOM
                                                  </th>
                                                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                                    Total Amount
                                                  </th>
                                                </tr>
                                              </thead>
                                              <tbody className="divide-y divide-gray-200 bg-white">
                                                {complaint.items!.map(
                                                  (it, idx) => (
                                                    <tr
                                                      key={`${complaint._id}-${idx}`}
                                                    >
                                                      <td className="px-3 py-2 text-gray-700">
                                                        {it.code || "-"}
                                                      </td>
                                                      <td className="px-3 py-2 text-gray-900">
                                                        {it.name}
                                                      </td>
                                                      <td className="px-3 py-2 text-gray-700">
                                                        {it.description || "-"}
                                                      </td>
                                                      <td className="px-3 py-2 text-gray-900">
                                                        {it.quantity}
                                                      </td>
                                                      <td className="px-3 py-2 text-gray-900">
                                                        {it.uom || "-"}
                                                      </td>
                                                      <td className="px-3 py-2 text-gray-900">
                                                        {it?.totalAmount || "0"}
                                                      </td>
                                                    </tr>
                                                  ),
                                                )}
                                              </tbody>
                                            </table>
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* ── SMART RECOMMENDATIONS ── */}
                {(smartDepartments.length > 0 || loadingSmartRec) && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Stethoscope className="w-4 h-4 text-violet-600" />
                      <h3 className="text-sm font-semibold text-violet-900 uppercase tracking-wide">
                        Smart Recommendations
                      </h3>
                      <span className="ml-1 text-[10px] text-violet-500 font-medium">
                        Based on Doctor's Department Services
                      </span>
                    </div>
                    {loadingSmartRec ? (
                      <div className="text-xs text-violet-500 py-2">
                        Loading recommendations...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {smartDepartments.map((dept) => (
                          <div key={dept._id}>
                            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1.5">
                              {dept.name}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {dept.services.map((svc) => (
                                <div
                                  key={svc._id}
                                  className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-1.5 shadow-sm"
                                >
                                  <span className="text-xs font-semibold text-gray-800">
                                    {svc.name}
                                  </span>
                                  <span className="text-[10px] text-violet-500 font-medium">
                                    {svc.clinicPrice != null
                                      ? `₹${svc.clinicPrice}`
                                      : `₹${svc.price}`}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={
                                      addingRecService[svc._id] ||
                                      addedRecServices[svc._id]
                                    }
                                    onClick={async () => {
                                      if (!details?.appointmentId) return;
                                      setAddingRecService((p) => ({
                                        ...p,
                                        [svc._id]: true,
                                      }));
                                      try {
                                        await axios.patch(
                                          `/api/clinic/appointment-services/${details.appointmentId}`,
                                          { serviceIds: [svc._id] },
                                          { headers: getAuthHeaders() },
                                        );
                                        setAddedRecServices((p) => ({
                                          ...p,
                                          [svc._id]: true,
                                        }));
                                      } catch {
                                        // silently ignore; user can retry
                                      } finally {
                                        setAddingRecService((p) => ({
                                          ...p,
                                          [svc._id]: false,
                                        }));
                                      }
                                    }}
                                    className={`flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold transition-colors ${
                                      addedRecServices[svc._id]
                                        ? "bg-green-100 text-green-700 cursor-default"
                                        : "bg-violet-100 text-violet-700 hover:bg-violet-200"
                                    }`}
                                  >
                                    {addingRecService[svc._id] ? (
                                      <svg
                                        className="w-3 h-3 animate-spin"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                      >
                                        <circle
                                          className="opacity-25"
                                          cx="12"
                                          cy="12"
                                          r="10"
                                          stroke="currentColor"
                                          strokeWidth="4"
                                        />
                                        <path
                                          className="opacity-75"
                                          fill="currentColor"
                                          d="M4 12a8 8 0 018-8v8z"
                                        />
                                      </svg>
                                    ) : addedRecServices[svc._id] ? (
                                      <>
                                        <svg
                                          className="w-3 h-3"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                          strokeWidth={3}
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                        Added
                                      </>
                                    ) : (
                                      <>
                                        <Plus size={10} />
                                        Add
                                      </>
                                    )}
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── NEXT SESSION BOOKING ── */}
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Next Session Booking
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={nextSessionDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          setNextSessionDate(e.target.value);
                          setNextSessionBooked(false);
                          setNextSessionError("");
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Select Time
                      </label>
                      <select
                        value={nextSessionTime}
                        onChange={(e) => {
                          setNextSessionTime(e.target.value);
                          setNextSessionBooked(false);
                          setNextSessionError("");
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      >
                        {[
                          "07:00",
                          "07:30",
                          "08:00",
                          "08:30",
                          "09:00",
                          "09:30",
                          "10:00",
                          "10:30",
                          "11:00",
                          "11:30",
                          "12:00",
                          "12:30",
                          "13:00",
                          "13:30",
                          "14:00",
                          "14:30",
                          "15:00",
                          "15:30",
                          "16:00",
                          "16:30",
                          "17:00",
                          "17:30",
                          "18:00",
                          "18:30",
                          "19:00",
                          "19:30",
                          "20:00",
                        ].map((t) => {
                          const [h, m] = t.split(":").map(Number);
                          const ampm = h < 12 ? "AM" : "PM";
                          const h12 = h % 12 || 12;
                          return (
                            <option
                              key={t}
                              value={t}
                            >{`${h12}:${String(m).padStart(2, "0")} ${ampm}`}</option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  {nextSessionError && (
                    <p className="text-red-500 text-xs mb-2">
                      {nextSessionError}
                    </p>
                  )}
                  {nextSessionBooked && (
                    <p className="text-green-600 text-xs mb-3 flex items-center gap-1">
                      <Check size={12} /> Next session booked successfully!
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={bookNextSession}
                    disabled={bookingNextSession || nextSessionBooked}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <Calendar size={15} />
                    {bookingNextSession
                      ? "Booking..."
                      : nextSessionBooked
                        ? "Session Booked!"
                        : "Book Next Session"}
                  </button>
                </div>

                {/* ── ADD SERVICE & CREATE PACKAGE ── */}
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Package className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Services & Packages
                    </h3>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddServiceDropdown(true);
                        setShowCreatePackage(false);
                        setServicesSaved(false);
                        setServicesError("");
                        if (allServices.length === 0) fetchAllServices();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-teal-500 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-100 transition-colors"
                    >
                      <Plus size={14} />
                      Add Service
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreatePackage(true);
                        setShowAddServiceDropdown(false);
                        setPkgError("");
                        setPkgSuccess("");
                        if (pkgTreatments.length === 0) fetchPkgTreatments();
                      }}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-violet-500 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100 transition-colors"
                    >
                      <Package size={14} />
                      Create Package
                    </button>
                  </div>

                  {/* ADD SERVICE DROPDOWN PANEL */}
                  {showAddServiceDropdown && (
                    <div className="mt-3 border border-teal-200 rounded-lg bg-teal-50 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-teal-800">
                          Select Services
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAddServiceDropdown(false)}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                      {/* Search */}
                      <div className="relative mb-2">
                        <input
                          type="text"
                          placeholder="Search services..."
                          value={serviceSearchQuery}
                          onChange={(e) =>
                            setServiceSearchQuery(e.target.value)
                          }
                          className="w-full pl-3 pr-3 py-2 text-xs border border-teal-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-400"
                        />
                      </div>
                      {/* Services list */}
                      <div className="max-h-48 overflow-y-auto space-y-1 mb-2">
                        {loadingServices ? (
                          <p className="text-xs text-gray-400 text-center py-4">
                            Loading services...
                          </p>
                        ) : allServices.filter((s) =>
                            s.name
                              .toLowerCase()
                              .includes(serviceSearchQuery.toLowerCase()),
                          ).length === 0 ? (
                          <p className="text-xs text-gray-400 text-center py-4">
                            No services found
                          </p>
                        ) : (
                          allServices
                            .filter((s) =>
                              s.name
                                .toLowerCase()
                                .includes(serviceSearchQuery.toLowerCase()),
                            )
                            .map((svc) => {
                              const isSelected = selectedServices.some(
                                (s) => s._id === svc._id,
                              );
                              return (
                                <button
                                  key={svc._id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedServices((prev) =>
                                      isSelected
                                        ? prev.filter((s) => s._id !== svc._id)
                                        : [...prev, svc],
                                    );
                                    setServicesSaved(false);
                                  }}
                                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-all ${
                                    isSelected
                                      ? "bg-teal-100 border border-teal-400 text-teal-800 font-semibold"
                                      : "bg-white border border-gray-200 text-gray-700 hover:bg-teal-50"
                                  }`}
                                >
                                  <span>{svc.name}</span>
                                  <span className="font-medium text-teal-700">
                                    {svc.clinicPrice != null
                                      ? `₹${svc.clinicPrice}`
                                      : `₹${svc.price}`}
                                  </span>
                                </button>
                              );
                            })
                        )}
                      </div>
                      {/* Selected summary */}
                      {selectedServices.length > 0 && (
                        <div className="mb-2 space-y-1">
                          <p className="text-xs font-semibold text-gray-700">
                            Selected ({selectedServices.length}):
                          </p>
                          {selectedServices.map((s) => (
                            <div
                              key={s._id}
                              className="flex items-center justify-between text-xs bg-white border border-teal-200 rounded px-2 py-1"
                            >
                              <span className="text-gray-800">{s.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-teal-700 font-medium">
                                  {s.clinicPrice != null
                                    ? `₹${s.clinicPrice}`
                                    : `₹${s.price}`}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedServices((prev) =>
                                      prev.filter((x) => x._id !== s._id),
                                    )
                                  }
                                  className="text-red-400 hover:text-red-600"
                                >
                                  <XIcon size={12} />
                                </button>
                              </div>
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-2 py-1.5 bg-teal-100 rounded-lg">
                            <span className="text-xs font-bold text-teal-800">
                              Total
                            </span>
                            <span className="text-sm font-bold text-teal-800">
                              ₹
                              {selectedServices
                                .reduce(
                                  (sum, s) =>
                                    sum +
                                    (s.clinicPrice != null
                                      ? s.clinicPrice
                                      : s.price),
                                  0,
                                )
                                .toFixed(2)}
                            </span>
                          </div>
                        </div>
                      )}
                      {servicesError && (
                        <p className="text-red-500 text-xs mb-2">
                          {servicesError}
                        </p>
                      )}
                      {servicesSaved && (
                        <p className="text-green-600 text-xs mb-2 flex items-center gap-1">
                          <Check size={12} /> Services saved to appointment!
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={saveServicesToAppointment}
                        disabled={
                          savingServices || selectedServices.length === 0
                        }
                        className="w-full flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50 transition-colors"
                      >
                        {savingServices
                          ? "Saving..."
                          : "Save Services to Appointment"}
                      </button>
                    </div>
                  )}

                  {/* CREATE PACKAGE PANEL */}
                  {showCreatePackage && (
                    <div className="mt-3 border border-violet-200 rounded-lg bg-violet-50 p-3">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-semibold text-violet-800">
                          Create New Package
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreatePackage(false);
                            setPkgError("");
                            setPkgSuccess("");
                          }}
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <XIcon size={14} />
                        </button>
                      </div>
                      {/* Package Name */}
                      <div className="mb-2">
                        <label className="block text-[10px] font-semibold text-violet-700 mb-1">
                          Package Name
                        </label>
                        <input
                          type="text"
                          value={pkgModalName}
                          onChange={(e) => setPkgModalName(e.target.value)}
                          placeholder="Enter package name"
                          className="w-full px-3 py-2 text-xs border border-violet-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-400 focus:outline-none"
                        />
                      </div>
                      {/* Package Price */}
                      <div className="mb-2">
                        <label className="block text-[10px] font-semibold text-violet-700 mb-1">
                          Total Package Price
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pkgModalPrice}
                          onChange={(e) => setPkgModalPrice(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 text-xs border border-violet-200 rounded-lg bg-white focus:ring-2 focus:ring-violet-400 focus:outline-none"
                        />
                      </div>
                      {/* Treatment selector */}
                      <div className="mb-2 relative">
                        <label className="block text-[10px] font-semibold text-violet-700 mb-1">
                          Select Treatments / Services
                        </label>
                        <button
                          type="button"
                          onClick={() => setPkgTreatmentDropdownOpen((v) => !v)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-white border border-violet-200 rounded-lg text-xs text-gray-700 hover:bg-violet-50 focus:outline-none focus:ring-2 focus:ring-violet-400"
                        >
                          <span className="text-violet-700 font-medium">
                            {pkgSelectedTreatments.length > 0
                              ? `${pkgSelectedTreatments.length} treatment(s) selected`
                              : "Select treatments..."}
                          </span>
                          <ChevronDown
                            className={`w-4 h-4 text-violet-500 transition-transform ${pkgTreatmentDropdownOpen ? "rotate-180" : ""}`}
                          />
                        </button>
                        {pkgTreatmentDropdownOpen && (
                          <div className="absolute z-30 w-full mt-1 bg-white border border-violet-200 rounded-lg shadow-lg max-h-52 overflow-hidden flex flex-col">
                            <div className="p-2 border-b border-violet-100">
                              <input
                                type="text"
                                placeholder="Search..."
                                value={pkgTreatmentSearch}
                                onChange={(e) =>
                                  setPkgTreatmentSearch(e.target.value)
                                }
                                onClick={(e) => e.stopPropagation()}
                                autoFocus
                                className="w-full pl-3 pr-2 py-1.5 text-xs border border-violet-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-400"
                              />
                            </div>
                            <div className="overflow-y-auto max-h-40 p-1">
                              {pkgTreatments
                                .filter((t) =>
                                  t.name
                                    .toLowerCase()
                                    .includes(pkgTreatmentSearch.toLowerCase()),
                                )
                                .map((treatment) => {
                                  const isSelected = pkgSelectedTreatments.some(
                                    (t) => t.treatmentSlug === treatment.slug,
                                  );
                                  return (
                                    <button
                                      key={treatment.slug}
                                      type="button"
                                      onClick={() => {
                                        setPkgSelectedTreatments((prev) => {
                                          if (
                                            prev.some(
                                              (t) =>
                                                t.treatmentSlug ===
                                                treatment.slug,
                                            )
                                          ) {
                                            return prev.filter(
                                              (t) =>
                                                t.treatmentSlug !==
                                                treatment.slug,
                                            );
                                          }
                                          setPkgTreatmentDropdownOpen(false);
                                          return [
                                            ...prev,
                                            {
                                              treatmentName: treatment.name,
                                              treatmentSlug: treatment.slug,
                                              sessions: 1,
                                              allocatedPrice: 0,
                                            },
                                          ];
                                        });
                                        setPkgTreatmentSearch("");
                                      }}
                                      className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-all ${
                                        isSelected
                                          ? "bg-violet-50 text-violet-800 font-medium border border-violet-200"
                                          : "text-gray-700 hover:bg-violet-50 border border-transparent"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span>
                                          {treatment.name}
                                          {treatment.type === "sub" &&
                                            treatment.mainTreatment && (
                                              <span className="text-[10px] text-violet-500 ml-1">
                                                ({treatment.mainTreatment})
                                              </span>
                                            )}
                                        </span>
                                        {isSelected && (
                                          <span className="text-violet-600 text-xs">
                                            ✓
                                          </span>
                                        )}
                                      </div>
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Selected treatments with price/sessions */}
                      {pkgSelectedTreatments.length > 0 && (
                        <div className="space-y-2 mb-2">
                          <p className="text-[10px] font-semibold text-violet-700">
                            Selected Treatments
                          </p>
                          {pkgSelectedTreatments.map((sel) => {
                            const sessPrice =
                              sel.sessions > 0
                                ? (sel.allocatedPrice || 0) / sel.sessions
                                : 0;
                            return (
                              <div
                                key={sel.treatmentSlug}
                                className="bg-white border border-violet-200 rounded-lg p-2"
                              >
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs font-semibold text-violet-700">
                                    {sel.treatmentName}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPkgSelectedTreatments((prev) =>
                                        prev.filter(
                                          (t) =>
                                            t.treatmentSlug !==
                                            sel.treatmentSlug,
                                        ),
                                      )
                                    }
                                    className="text-red-400 hover:text-red-600"
                                  >
                                    <XIcon size={12} />
                                  </button>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                  <div>
                                    <label className="block text-[9px] text-violet-600 font-medium mb-0.5">
                                      Price
                                    </label>
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={sel.allocatedPrice || ""}
                                      onChange={(e) =>
                                        setPkgSelectedTreatments((prev) =>
                                          prev.map((t) =>
                                            t.treatmentSlug ===
                                            sel.treatmentSlug
                                              ? {
                                                  ...t,
                                                  allocatedPrice:
                                                    parseFloat(
                                                      e.target.value,
                                                    ) || 0,
                                                }
                                              : t,
                                          ),
                                        )
                                      }
                                      className="w-full px-1.5 py-1 text-xs border border-violet-200 rounded focus:outline-none focus:ring-1 focus:ring-violet-400"
                                      placeholder="0.00"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-violet-600 font-medium mb-0.5">
                                      Sessions
                                    </label>
                                    <input
                                      type="number"
                                      min="1"
                                      value={sel.sessions}
                                      onChange={(e) =>
                                        setPkgSelectedTreatments((prev) =>
                                          prev.map((t) =>
                                            t.treatmentSlug ===
                                            sel.treatmentSlug
                                              ? {
                                                  ...t,
                                                  sessions:
                                                    parseInt(e.target.value) ||
                                                    1,
                                                }
                                              : t,
                                          ),
                                        )
                                      }
                                      className="w-full px-1.5 py-1 text-xs border border-violet-200 rounded text-center focus:outline-none focus:ring-1 focus:ring-violet-400"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-[9px] text-violet-600 font-medium mb-0.5">
                                      /Session
                                    </label>
                                    <div className="px-1.5 py-1 text-xs font-bold text-center bg-violet-100 rounded text-violet-700 border border-violet-200">
                                      ₹{sessPrice.toFixed(2)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {/* Price validation */}
                          <div className="grid grid-cols-3 gap-1.5 bg-violet-100 rounded-lg p-2">
                            <div className="text-center">
                              <p className="text-[9px] text-violet-600 font-medium">
                                Pkg Price
                              </p>
                              <p className="text-xs font-bold text-violet-800">
                                ₹{parseFloat(pkgModalPrice) || 0}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] text-violet-600 font-medium">
                                Allocated
                              </p>
                              <p className="text-xs font-bold text-violet-800">
                                ₹
                                {pkgSelectedTreatments
                                  .reduce(
                                    (sum, t) => sum + (t.allocatedPrice || 0),
                                    0,
                                  )
                                  .toFixed(2)}
                              </p>
                            </div>
                            <div className="text-center">
                              <p className="text-[9px] text-violet-600 font-medium">
                                Remaining
                              </p>
                              <p
                                className={`text-xs font-bold ${Math.abs((parseFloat(pkgModalPrice) || 0) - pkgSelectedTreatments.reduce((sum, t) => sum + (t.allocatedPrice || 0), 0)) < 0.01 ? "text-teal-600" : "text-amber-600"}`}
                              >
                                ₹
                                {(
                                  (parseFloat(pkgModalPrice) || 0) -
                                  pkgSelectedTreatments.reduce(
                                    (sum, t) => sum + (t.allocatedPrice || 0),
                                    0,
                                  )
                                ).toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {pkgError && (
                        <p className="text-red-500 text-xs mb-2">{pkgError}</p>
                      )}
                      {pkgSuccess && (
                        <p className="text-green-600 text-xs mb-2 flex items-center gap-1">
                          <Check size={12} /> {pkgSuccess}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleCreatePackageModal(false)}
                          disabled={pkgSubmitting || addingPackageToPatient}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg border border-violet-500 bg-white px-3 py-2 text-xs font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-50 transition-colors"
                        >
                          <Package size={12} />
                          {pkgSubmitting ? "Creating..." : "Create Package"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCreatePackageModal(true)}
                          disabled={pkgSubmitting || addingPackageToPatient}
                          className="flex-1 flex items-center justify-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                        >
                          <Plus size={12} />
                          {addingPackageToPatient
                            ? "Adding..."
                            : "Create & Add to Patient"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── STOCK USED (all complaints) ── */}
                {previousComplaints.some(
                  (c) => Array.isArray(c.items) && c.items.length > 0,
                ) && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Package className="w-4 h-4 text-orange-600" />
                      <h3 className="text-sm font-semibold text-gray-900">
                        Stock Used
                      </h3>
                      <span className="text-[10px] text-orange-500 font-medium">
                        All sessions combined
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-orange-100">
                            <th className="px-3 py-2 text-left font-semibold text-orange-800 uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-orange-800 uppercase tracking-wider">
                              Item Name
                            </th>
                            <th className="px-3 py-2 text-right font-semibold text-orange-800 uppercase tracking-wider">
                              Qty
                            </th>
                            <th className="px-3 py-2 text-left font-semibold text-orange-800 uppercase tracking-wider">
                              UOM
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-orange-100">
                          {previousComplaints
                            .filter(
                              (c) =>
                                Array.isArray(c.items) && c.items.length > 0,
                            )
                            .sort(
                              (a, b) =>
                                new Date(b.createdAt).getTime() -
                                new Date(a.createdAt).getTime(),
                            )
                            .flatMap((c) =>
                              (c.items as NonNullable<typeof c.items>).map(
                                (item, idx) => ({
                                  date: c.createdAt,
                                  item,
                                  key: `${c._id}-${idx}`,
                                }),
                              ),
                            )
                            .map(({ date, item, key }) => (
                              <tr
                                key={key}
                                className="hover:bg-orange-50 transition-colors"
                              >
                                <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                  {new Date(date).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </td>
                                <td className="px-3 py-2 font-medium text-gray-900">
                                  {item.name}
                                </td>
                                <td className="px-3 py-2 text-right font-semibold text-orange-700">
                                  {item.quantity}
                                </td>
                                <td className="px-3 py-2 text-gray-600">
                                  {item.uom || "-"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ── CLINICAL CHECKLIST ── */}
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">
                    Clinical Checklist
                  </h3>
                  <div className="space-y-2">
                    {CHECKLIST_ITEMS.map((item) => (
                      <label
                        key={item}
                        className={`flex items-center justify-between gap-3 rounded-lg border px-4 py-3 cursor-pointer transition-colors ${
                          checklist[item]
                            ? "border-green-400 bg-green-50"
                            : "border-gray-200 bg-white hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checklist[item]}
                            onChange={() =>
                              setChecklist((prev) => ({
                                ...prev,
                                [item]: !prev[item],
                              }))
                            }
                            className="w-4 h-4 rounded accent-green-500 cursor-pointer"
                          />
                          <span
                            className={`text-sm font-medium ${
                              checklist[item]
                                ? "text-green-700"
                                : "text-gray-800"
                            }`}
                          >
                            {item}
                          </span>
                        </div>
                        {checklist[item] ? (
                          <svg
                            className="w-4 h-4 text-green-500"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-4 h-4 text-gray-300"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <circle cx="12" cy="12" r="9" />
                          </svg>
                        )}
                      </label>
                    ))}
                  </div>
                  {checklistError && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                      <svg
                        className="w-4 h-4 text-red-500 mt-0.5 shrink-0"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                        />
                      </svg>
                      <p className="text-xs text-red-700 font-medium">
                        {checklistError}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "progress" && (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-800">
                    Treatment Timeline
                  </h3>
                </div>

                {/* Error */}
                {progressError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {progressError}
                  </div>
                )}

                {/* Timeline entries */}
                {loadingProgressNotes ? (
                  <div className="py-8 text-center text-gray-400 text-sm">
                    Loading progress notes...
                  </div>
                ) : (
                  <div className="relative">
                    {progressNotes.length > 0 && (
                      <div className="absolute left-[18px] top-5 bottom-5 w-px bg-gradient-to-b from-teal-400 to-teal-100" />
                    )}
                    <div className="space-y-4">
                      {progressNotes.map((entry) => {
                        const dateStr = entry.noteDate
                          ? new Date(entry.noteDate).toISOString().slice(0, 10)
                          : new Date(entry.createdAt)
                              .toISOString()
                              .slice(0, 10);
                        const doctorName =
                          typeof entry.doctorId === "object" &&
                          entry.doctorId?.name
                            ? entry.doctorId.name
                            : null;
                        return (
                          <div
                            key={entry._id}
                            className="flex gap-4 items-start"
                          >
                            {/* Dot */}
                            <div className="flex-shrink-0 w-9 h-9 rounded-full bg-teal-500 border-4 border-white shadow-md flex items-center justify-center z-10">
                              <TrendingUp size={14} className="text-white" />
                            </div>
                            {/* Card */}
                            <div className="flex-1 rounded-2xl border border-gray-200 bg-white shadow-sm px-4 py-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-teal-600">
                                  {dateStr}
                                </span>
                                <div className="flex items-center gap-3">
                                  {doctorName && (
                                    <span className="text-xs text-gray-400">
                                      {doctorName}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      try {
                                        const headers = getAuthHeaders();
                                        await axios.delete(
                                          "/api/clinic/progress-notes",
                                          {
                                            headers,
                                            params: { noteId: entry._id },
                                          },
                                        );
                                        setProgressNotes((prev) =>
                                          prev.filter(
                                            (n) => n._id !== entry._id,
                                          ),
                                        );
                                      } catch {
                                        setProgressError(
                                          "Failed to delete progress note",
                                        );
                                      }
                                    }}
                                    className="text-gray-300 hover:text-red-500 transition-colors"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                                {entry.note}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inline Add New Entry form */}
                {addingNewEntry ? (
                  <div className="rounded-2xl border-2 border-dashed border-teal-300 bg-teal-50/60 px-4 py-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-teal-700 uppercase tracking-wide flex items-center gap-1.5">
                        <Plus size={12} />
                        New Progress Entry
                      </span>
                      <span className="text-xs text-teal-600 font-medium">
                        {newEntryDate}
                      </span>
                    </div>
                    <textarea
                      autoFocus
                      value={newEntryText}
                      onChange={(e) => setNewEntryText(e.target.value)}
                      rows={4}
                      placeholder="Describe the patient's progress, treatment response, observations for today..."
                      className="w-full rounded-xl border border-teal-200 bg-white px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                    />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-teal-700 font-medium">
                          Date:
                        </label>
                        <input
                          type="date"
                          value={newEntryDate}
                          onChange={(e) => setNewEntryDate(e.target.value)}
                          className="border border-teal-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-700"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAddingNewEntry(false);
                            setNewEntryText("");
                            setProgressError("");
                          }}
                          className="px-4 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={savingProgress || !newEntryText.trim()}
                          onClick={async () => {
                            if (!newEntryText.trim() || !details) return;
                            setSavingProgress(true);
                            setProgressError("");
                            try {
                              const headers = getAuthHeaders();
                              const res = await axios.post(
                                "/api/clinic/progress-notes",
                                {
                                  appointmentId: details.appointmentId,
                                  patientId: details.patientId,
                                  note: newEntryText.trim(),
                                  noteDate: newEntryDate,
                                },
                                { headers },
                              );
                              if (res.data?.success && res.data.note) {
                                setProgressNotes((prev) => [
                                  res.data.note,
                                  ...prev,
                                ]);
                              }
                              setNewEntryText("");
                              setNewEntryDate(
                                new Date().toISOString().slice(0, 10),
                              );
                              setAddingNewEntry(false);
                            } catch (err: any) {
                              setProgressError(
                                err.response?.data?.message ||
                                  "Failed to save progress note",
                              );
                            } finally {
                              setSavingProgress(false);
                            }
                          }}
                          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {savingProgress ? (
                            <>
                              <RefreshCw size={12} className="animate-spin" />{" "}
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check size={12} /> Save Entry
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Add New Progress Note button */
                  <button
                    type="button"
                    onClick={() => {
                      setAddingNewEntry(true);
                      setNewEntryDate(new Date().toISOString().slice(0, 10));
                    }}
                    className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 py-4 text-sm font-medium text-gray-500 hover:border-teal-400 hover:text-teal-600 transition-colors bg-white"
                  >
                    <Plus size={16} />
                    Add New Progress Note
                  </button>
                )}

                {/* ── SMART RECOMMENDATIONS ── */}
                {(smartDepartments.length > 0 || loadingSmartRec) && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Stethoscope className="w-4 h-4 text-violet-600" />
                      <h3 className="text-sm font-semibold text-violet-900 uppercase tracking-wide">
                        Smart Recommendations
                      </h3>
                      <span className="ml-1 text-[10px] text-violet-500 font-medium">
                        Based on Doctor's Department Services
                      </span>
                    </div>
                    {loadingSmartRec ? (
                      <div className="text-xs text-violet-500 py-2">
                        Loading recommendations...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {smartDepartments.map((dept) => (
                          <div key={dept._id}>
                            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1.5">
                              {dept.name}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {dept.services.map((svc) => (
                                <div
                                  key={svc._id}
                                  className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-1.5 shadow-sm"
                                >
                                  <span className="text-xs font-semibold text-gray-800">
                                    {svc.name}
                                  </span>
                                  <span className="text-[10px] text-violet-500 font-medium">
                                    {svc.clinicPrice != null
                                      ? `₹${svc.clinicPrice}`
                                      : `₹${svc.price}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── NEXT SESSION BOOKING ── */}
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Next Session Booking
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={nextSessionDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          setNextSessionDate(e.target.value);
                          setNextSessionBooked(false);
                          setNextSessionError("");
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Select Time
                      </label>
                      <select
                        value={nextSessionTime}
                        onChange={(e) => {
                          setNextSessionTime(e.target.value);
                          setNextSessionBooked(false);
                          setNextSessionError("");
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      >
                        {[
                          "07:00",
                          "07:30",
                          "08:00",
                          "08:30",
                          "09:00",
                          "09:30",
                          "10:00",
                          "10:30",
                          "11:00",
                          "11:30",
                          "12:00",
                          "12:30",
                          "13:00",
                          "13:30",
                          "14:00",
                          "14:30",
                          "15:00",
                          "15:30",
                          "16:00",
                          "16:30",
                          "17:00",
                          "17:30",
                          "18:00",
                          "18:30",
                          "19:00",
                          "19:30",
                          "20:00",
                        ].map((t) => {
                          const [h, m] = t.split(":").map(Number);
                          const ampm = h < 12 ? "AM" : "PM";
                          const h12 = h % 12 || 12;
                          return (
                            <option
                              key={t}
                              value={t}
                            >{`${h12}:${String(m).padStart(2, "0")} ${ampm}`}</option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  {nextSessionError && (
                    <p className="text-red-500 text-xs mb-2">
                      {nextSessionError}
                    </p>
                  )}
                  {nextSessionBooked && (
                    <p className="text-green-600 text-xs mb-3 flex items-center gap-1">
                      <Check size={12} /> Next session booked successfully!
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={bookNextSession}
                    disabled={bookingNextSession || nextSessionBooked}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <Calendar size={15} />
                    {bookingNextSession
                      ? "Booking..."
                      : nextSessionBooked
                        ? "Session Booked!"
                        : "Book Next Session"}
                  </button>
                </div>
              </div>
            )}

            {/* ── PRESCRIPTION TAB ── */}
            {activeTab === "prescription" && (
              <div className="space-y-6">
                {/* Prescribed Medicines */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-base font-semibold text-gray-900">
                      Prescribed Medicines
                    </h3>
                    <button
                      type="button"
                      onClick={() =>
                        setMedicines((prev) => [...prev, emptyMedicine()])
                      }
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 transition-colors shadow-sm"
                    >
                      <Plus size={15} />
                      Add Medicine
                    </button>
                  </div>

                  {/* Medicine rows */}
                  <div className="space-y-2">
                    {medicines.map((med) => (
                      <div
                        key={med.id}
                        className="rounded-xl border border-gray-200 bg-white px-4 py-3 flex flex-col sm:flex-row gap-3 items-start sm:items-center shadow-sm"
                      >
                        {/* Medicine name */}
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Medicine
                          </label>
                          <input
                            type="text"
                            value={med.medicineName}
                            onChange={(e) =>
                              setMedicines((prev) =>
                                prev.map((m) =>
                                  m.id === med.id
                                    ? { ...m, medicineName: e.target.value }
                                    : m,
                                ),
                              )
                            }
                            placeholder="Medicine name"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-800 placeholder-gray-400"
                          />
                        </div>
                        {/* Dosage */}
                        <div className="flex flex-col gap-0.5 w-full sm:w-32">
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Dosage
                          </label>
                          <input
                            type="text"
                            value={med.dosage}
                            onChange={(e) =>
                              setMedicines((prev) =>
                                prev.map((m) =>
                                  m.id === med.id
                                    ? { ...m, dosage: e.target.value }
                                    : m,
                                ),
                              )
                            }
                            placeholder="2 times/day"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-800 placeholder-gray-400"
                          />
                        </div>
                        {/* Duration */}
                        <div className="flex flex-col gap-0.5 w-full sm:w-28">
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Duration
                          </label>
                          <input
                            type="text"
                            value={med.duration}
                            onChange={(e) =>
                              setMedicines((prev) =>
                                prev.map((m) =>
                                  m.id === med.id
                                    ? { ...m, duration: e.target.value }
                                    : m,
                                ),
                              )
                            }
                            placeholder="7 days"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-800 placeholder-gray-400"
                          />
                        </div>
                        {/* Notes */}
                        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                          <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                            Notes
                          </label>
                          <input
                            type="text"
                            value={med.notes}
                            onChange={(e) =>
                              setMedicines((prev) =>
                                prev.map((m) =>
                                  m.id === med.id
                                    ? { ...m, notes: e.target.value }
                                    : m,
                                ),
                              )
                            }
                            placeholder="After meals"
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-400 text-gray-800 placeholder-gray-400"
                          />
                        </div>
                        {/* Delete row */}
                        <button
                          type="button"
                          onClick={() => {
                            if (medicines.length === 1) {
                              setMedicines([emptyMedicine()]);
                            } else {
                              setMedicines((prev) =>
                                prev.filter((m) => m.id !== med.id),
                              );
                            }
                          }}
                          className="mt-4 sm:mt-0 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Aftercare Instructions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      Aftercare Instructions
                    </h3>
                  </div>
                  <textarea
                    value={aftercareInstructions}
                    onChange={(e) => setAftercareInstructions(e.target.value)}
                    rows={6}
                    placeholder="Enter detailed aftercare instructions for the patient..."
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
                  />
                </div>

                {/* Include in PDF toggle */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={includeInPdf}
                    onClick={() => setIncludeInPdf((v) => !v)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      includeInPdf ? "bg-teal-500" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        includeInPdf ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  <span className="text-sm text-gray-700 font-medium">
                    Include in patient PDF
                  </span>
                </div>

                {/* Error */}
                {prescriptionError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {prescriptionError}
                  </div>
                )}
                {prescriptionSaved && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex items-center gap-2">
                    <Check size={14} />
                    Prescription saved successfully.
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    disabled={
                      savingPrescription ||
                      medicines.every((m) => !m.medicineName.trim())
                    }
                    onClick={async () => {
                      const validMeds = medicines.filter((m) =>
                        m.medicineName.trim(),
                      );
                      if (!validMeds.length || !details) return;
                      setSavingPrescription(true);
                      setPrescriptionError("");
                      setPrescriptionSaved(false);
                      try {
                        const headers = getAuthHeaders();
                        await axios.post(
                          "/api/clinic/prescriptions",
                          {
                            appointmentId: details.appointmentId,
                            patientId: details.patientId,
                            medicines: validMeds,
                            aftercareInstructions,
                            includeInPdf,
                          },
                          { headers },
                        );
                        setPrescriptionSaved(true);
                        // Refresh history
                        const histRes = await axios.get(
                          "/api/clinic/prescriptions",
                          {
                            headers,
                            params: { patientId: details.patientId },
                          },
                        );
                        if (histRes.data?.success) {
                          setPrescriptionHistory(
                            histRes.data.prescriptions || [],
                          );
                        }
                      } catch (err: any) {
                        setPrescriptionError(
                          err.response?.data?.message ||
                            "Failed to save prescription",
                        );
                      } finally {
                        setSavingPrescription(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-semibold hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    {savingPrescription ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />{" "}
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check size={14} /> Save Prescription
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    disabled={medicines.every((m) => !m.medicineName.trim())}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-800 text-white text-sm font-semibold hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm transition-colors"
                  >
                    <FileText size={14} />
                    Generate PDF
                  </button>
                  <button
                    type="button"
                    disabled={medicines.every((m) => !m.medicineName.trim())}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-green-500 text-green-700 text-sm font-semibold hover:bg-green-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={14} />
                    Send via WhatsApp
                  </button>
                </div>

                {/* ── Prescription History ── */}
                <div className="border-t border-gray-200 pt-5">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Pill size={14} className="text-violet-500" />
                    Prescription History
                    {prescriptionHistory.length > 0 && (
                      <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold">
                        {prescriptionHistory.length}
                      </span>
                    )}
                  </h3>

                  {loadingPrescriptionHistory ? (
                    <div className="py-6 text-center text-gray-400 text-sm">
                      Loading prescription history...
                    </div>
                  ) : prescriptionHistory.length === 0 ? (
                    <div className="py-6 text-center text-gray-400 text-sm">
                      No prescription history found for this patient.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {prescriptionHistory.map((entry) => {
                        const isExpanded = !!expandedPrescription[entry._id];
                        const doctorName =
                          typeof entry.doctorId === "object" &&
                          entry.doctorId?.name
                            ? entry.doctorId.name
                            : null;
                        return (
                          <div
                            key={entry._id}
                            className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden"
                          >
                            {/* Header row */}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedPrescription((prev) => ({
                                  ...prev,
                                  [entry._id]: !prev[entry._id],
                                }))
                              }
                              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200">
                                  <Pill size={10} />
                                  {entry.medicines.length} medicine
                                  {entry.medicines.length !== 1 ? "s" : ""}
                                </span>
                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                  <Calendar size={11} />
                                  {new Date(entry.createdAt).toLocaleDateString(
                                    "en-US",
                                    {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )}
                                </span>
                                {doctorName && (
                                  <span className="text-xs text-gray-400">
                                    Dr. {doctorName}
                                  </span>
                                )}
                                {entry.updatedAt !== entry.createdAt && (
                                  <span className="text-[10px] text-gray-400 italic">
                                    (updated{" "}
                                    {new Date(
                                      entry.updatedAt,
                                    ).toLocaleDateString()}
                                    )
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                      const headers = getAuthHeaders();
                                      await axios.delete(
                                        "/api/clinic/prescriptions",
                                        {
                                          headers,
                                          params: { prescriptionId: entry._id },
                                        },
                                      );
                                      setPrescriptionHistory((prev) =>
                                        prev.filter((p) => p._id !== entry._id),
                                      );
                                    } catch {
                                      setPrescriptionError(
                                        "Failed to delete prescription",
                                      );
                                    }
                                  }}
                                  className="p-1 text-gray-300 hover:text-red-500 transition-colors"
                                >
                                  <Trash2 size={13} />
                                </button>
                                {isExpanded ? (
                                  <ChevronUp
                                    size={15}
                                    className="text-gray-400"
                                  />
                                ) : (
                                  <ChevronDown
                                    size={15}
                                    className="text-gray-400"
                                  />
                                )}
                              </div>
                            </button>

                            {/* Expanded details */}
                            {isExpanded && (
                              <div className="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50">
                                {/* Medicine table */}
                                <div>
                                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                                    Medicines
                                  </p>
                                  <div className="rounded-lg border border-gray-200 overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-gray-100">
                                        <tr>
                                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                            #
                                          </th>
                                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                            Medicine
                                          </th>
                                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                            Dosage
                                          </th>
                                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                            Duration
                                          </th>
                                          <th className="px-3 py-2 text-left text-[10px] font-bold text-gray-600 uppercase tracking-wider">
                                            Notes
                                          </th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 bg-white">
                                        {entry.medicines.map((med, mIdx) => (
                                          <tr
                                            key={med._id || mIdx}
                                            className="hover:bg-gray-50"
                                          >
                                            <td className="px-3 py-2 text-gray-400 text-xs">
                                              {mIdx + 1}
                                            </td>
                                            <td className="px-3 py-2 font-medium text-gray-900">
                                              {med.medicineName}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600">
                                              {med.dosage || (
                                                <span className="text-gray-300">
                                                  —
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600">
                                              {med.duration || (
                                                <span className="text-gray-300">
                                                  —
                                                </span>
                                              )}
                                            </td>
                                            <td className="px-3 py-2 text-gray-600">
                                              {med.notes || (
                                                <span className="text-gray-300">
                                                  —
                                                </span>
                                              )}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>

                                {/* Aftercare instructions */}
                                {entry.aftercareInstructions && (
                                  <div>
                                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                      Aftercare Instructions
                                    </p>
                                    <p className="text-sm text-gray-700 whitespace-pre-wrap bg-white rounded-lg border border-gray-200 px-3 py-2.5">
                                      {entry.aftercareInstructions}
                                    </p>
                                  </div>
                                )}

                                {/* Include in PDF badge */}
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                                      entry.includeInPdf
                                        ? "bg-teal-50 text-teal-700 border border-teal-200"
                                        : "bg-gray-100 text-gray-500 border border-gray-200"
                                    }`}
                                  >
                                    <FileText size={9} />
                                    {entry.includeInPdf
                                      ? "Included in PDF"
                                      : "Not included in PDF"}
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ── SMART RECOMMENDATIONS ── */}
                {(smartDepartments.length > 0 || loadingSmartRec) && (
                  <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Stethoscope className="w-4 h-4 text-violet-600" />
                      <h3 className="text-sm font-semibold text-violet-900 uppercase tracking-wide">
                        Smart Recommendations
                      </h3>
                      <span className="ml-1 text-[10px] text-violet-500 font-medium">
                        Based on Doctor's Department Services
                      </span>
                    </div>
                    {loadingSmartRec ? (
                      <div className="text-xs text-violet-500 py-2">
                        Loading recommendations...
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {smartDepartments.map((dept) => (
                          <div key={dept._id}>
                            <p className="text-[10px] font-bold text-violet-700 uppercase tracking-wider mb-1.5">
                              {dept.name}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {dept.services.map((svc) => (
                                <div
                                  key={svc._id}
                                  className="flex items-center gap-2 rounded-lg border border-violet-200 bg-white px-3 py-1.5 shadow-sm"
                                >
                                  <span className="text-xs font-semibold text-gray-800">
                                    {svc.name}
                                  </span>
                                  <span className="text-[10px] text-violet-500 font-medium">
                                    {svc.clinicPrice != null
                                      ? `₹${svc.clinicPrice}`
                                      : `₹${svc.price}`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ── NEXT SESSION BOOKING ── */}
                <div className="rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <h3 className="text-sm font-semibold text-gray-900">
                      Next Session Booking
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Select Date
                      </label>
                      <input
                        type="date"
                        value={nextSessionDate}
                        min={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => {
                          setNextSessionDate(e.target.value);
                          setNextSessionBooked(false);
                          setNextSessionError("");
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">
                        Select Time
                      </label>
                      <select
                        value={nextSessionTime}
                        onChange={(e) => {
                          setNextSessionTime(e.target.value);
                          setNextSessionBooked(false);
                          setNextSessionError("");
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                      >
                        {[
                          "07:00",
                          "07:30",
                          "08:00",
                          "08:30",
                          "09:00",
                          "09:30",
                          "10:00",
                          "10:30",
                          "11:00",
                          "11:30",
                          "12:00",
                          "12:30",
                          "13:00",
                          "13:30",
                          "14:00",
                          "14:30",
                          "15:00",
                          "15:30",
                          "16:00",
                          "16:30",
                          "17:00",
                          "17:30",
                          "18:00",
                          "18:30",
                          "19:00",
                          "19:30",
                          "20:00",
                        ].map((t) => {
                          const [h, m] = t.split(":").map(Number);
                          const ampm = h < 12 ? "AM" : "PM";
                          const h12 = h % 12 || 12;
                          return (
                            <option
                              key={t}
                              value={t}
                            >{`${h12}:${String(m).padStart(2, "0")} ${ampm}`}</option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                  {nextSessionError && (
                    <p className="text-red-500 text-xs mb-2">
                      {nextSessionError}
                    </p>
                  )}
                  {nextSessionBooked && (
                    <p className="text-green-600 text-xs mb-3 flex items-center gap-1">
                      <Check size={12} /> Next session booked successfully!
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={bookNextSession}
                    disabled={bookingNextSession || nextSessionBooked}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <Calendar size={15} />
                    {bookingNextSession
                      ? "Booking..."
                      : nextSessionBooked
                        ? "Session Booked!"
                        : "Book Next Session"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Close
            </button>
            {activeTab === "complaint" && (
              <button
                type="button"
                onClick={handleSaveComplaints}
                disabled={saving || loading}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Complaints"}
              </button>
            )}
          </div>
          {isEditModalOpen && editingComplaint && (
            <EditComplaintModal
              complaint={editingComplaint}
              onClose={() => {
                setIsEditModalOpen(false);
                setEditingComplaint(null);
              }}
              onSaved={(updated) => {
                setPreviousComplaints((prev) =>
                  prev.map((pc) =>
                    pc._id === updated._id
                      ? {
                          ...pc,
                          complaints: updated.complaints,
                          items: updated.items || [],
                          createdAt: (updated as any).createdAt || pc.createdAt,
                        }
                      : pc,
                  ),
                );
                setIsEditModalOpen(false);
                setEditingComplaint(null);
              }}
              getAuthHeaders={getAuthHeaders}
            />
          )}
        </div>
      </div>
      {/* Modals */}
      <DeleteConfirmationModal
        isOpen={isOpenDeleteComplaintModal}
        onClose={() => setIsOpenDeleteComplaintModal(false)}
        onConfirm={() => handleDeleteComplaint(deletedComplaint)}
        isDeleting={deleting}
        title="Delete Complaint"
        message="Are you sure you want to delete this complaint? All associated items will also be removed. This action cannot be undone."
        confirmText="Yes, Delete"
        cancelText="No, Keep"
      />
      {isOpenViewComplaintModal && (
        <ComplaintDetailModal
          onClose={() => setIsOpenViewComplaintModal(false)}
          complaint={selectedComplaint}
        />
      )}
      {/* Stock Transfer Request Modal */}
      {/* stock transfer request modal */}
      <AddStockTransferRequestModal
        isOpen={isOpenStockTransferModal}
        onClose={() => {
          setIsOpenStockTransferModal(false);
        }}
        onSuccess={() => {
          fetchAllocatedItems();
          setIsOpenStockTransferModal(false);
        }}
      />
    </>
  );
};

const EditComplaintModal: React.FC<{
  complaint: PreviousComplaint;
  onClose: () => void;
  onSaved: (updated: PreviousComplaint) => void;
  getAuthHeaders: () => Record<string, string>;
}> = ({ complaint, onClose, onSaved, getAuthHeaders }) => {
  const token = getTokenByPath() || "";
  const { stockItems } = useStockItems();
  const { uoms, loading: uomsLoading } = useUoms({ token });
  type StockRow = {
    itemId?: string;
    code?: string;
    name: string;
    description?: string;
    quantity: number;
    uom?: string;
  };
  const [note, setNote] = useState<string>(complaint.complaints || "");
  const [items, setItems] = useState<StockRow[]>(
    Array.isArray(complaint.items) ? (complaint.items as any) : [],
  );
  const [currentItem, setCurrentItem] = useState<StockRow>({
    itemId: "",
    code: "",
    name: "",
    description: "",
    quantity: 1,
    uom: "",
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editingItem, setEditingItem] = useState<StockRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>("");

  const handleCurrentItemChange = (field: keyof StockRow, value: any) => {
    if (field === "itemId") {
      const item = stockItems.find((i) => i._id === value);
      const selectedUOM = uoms.find((u) => u?.name === item?.level0?.uom);
      if (item) {
        setCurrentItem((prev) => ({
          ...prev,
          itemId: value,
          code: item.code,
          name: item.name,
          uom: selectedUOM ? selectedUOM.name : "",
          description: item.description || "",
        }));
        return;
      }
    }
    setCurrentItem((prev) => ({
      ...prev,
      [field]: field === "quantity" ? parseFloat(value) || 0 : value,
    }));
  };

  const addCurrentItem = () => {
    if (!currentItem.name.trim() || !currentItem.quantity || !currentItem.uom) {
      setError("Please complete item selection, quantity and UOM");
      return;
    }
    setItems((prev) => [...prev, { ...currentItem }]);
    setCurrentItem({
      itemId: "",
      code: "",
      name: "",
      description: "",
      quantity: 1,
      uom: "",
    });
    setError("");
  };

  const removeItem = (index: number) => {
    const updated = [...items];
    updated.splice(index, 1);
    setItems(updated);
    if (editIndex === index) {
      setEditIndex(null);
      setEditingItem(null);
    }
  };

  const startEditItem = (index: number) => {
    setEditIndex(index);
    setEditingItem({ ...items[index] });
  };

  const handleEditingItemChange = (field: keyof StockRow, value: any) => {
    if (!editingItem) return;
    if (field === "itemId") {
      const item = stockItems.find((i) => i._id === value);
      const selectedUOM = uoms.find((u) => u?.name === item?.level0?.uom);
      if (item) {
        setEditingItem({
          ...editingItem,
          itemId: value,
          code: item.code,
          name: item.name,
          uom: selectedUOM ? selectedUOM.name : "",
        });
        return;
      }
    }
    setEditingItem({
      ...editingItem,
      [field]: field === "quantity" ? parseFloat(value) || 0 : value,
    } as any);
  };

  const saveEditItem = () => {
    if (editIndex == null || editingItem == null) return;
    if (!editingItem.name.trim() || !editingItem.quantity || !editingItem.uom) {
      setError("Please complete item fields before saving");
      return;
    }
    const updated = [...items];
    updated[editIndex] = { ...editingItem };
    setItems(updated);
    setEditIndex(null);
    setEditingItem(null);
    setError("");
  };

  const cancelEditItem = () => {
    setEditIndex(null);
    setEditingItem(null);
  };

  const handleSave = async () => {
    if (!note.trim()) {
      setError("Complaint note is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      const res = await axios.patch(
        "/api/clinic/patient-complaints",
        {
          complaintId: complaint._id,
          complaints: note.trim(),
          items,
        },
        { headers },
      );
      const updated = res.data?.complaint;
      if (res.data?.success && updated) {
        onSaved(updated);
      } else {
        setError(res.data?.message || "Failed to update complaint");
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to update complaint");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-8">
      <div className="bg-white w-full max-w-6xl rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Complaint
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-900">
              Complaint Note <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2.5 text-sm text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-900">Items</h4>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-gray-900">
                    Item
                  </label>
                  <select
                    value={currentItem.itemId || ""}
                    onChange={(e) =>
                      handleCurrentItemChange("itemId", e.target.value)
                    }
                    className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg h-10"
                  >
                    <option value="">Select Item</option>
                    {stockItems.map((si: any) => (
                      <option key={si._id} value={si._id}>
                        {si.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-gray-900">
                    Description
                  </label>
                  <input
                    value={currentItem.description || ""}
                    onChange={(e) =>
                      handleCurrentItemChange("description", e.target.value)
                    }
                    className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg h-10"
                    placeholder="Description"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs font-bold text-gray-900">
                    Qty
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={currentItem.quantity}
                    onChange={(e) =>
                      handleCurrentItemChange("quantity", e.target.value)
                    }
                    className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg h-10"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-900">
                    UOM
                  </label>
                  <select
                    value={currentItem.uom || ""}
                    onChange={(e) =>
                      handleCurrentItemChange("uom", e.target.value)
                    }
                    className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg h-10"
                  >
                    <option value="">Select UOM</option>
                    {uomsLoading ? (
                      <option value="">Loading UOMs...</option>
                    ) : uoms.length > 0 ? (
                      uoms.map((u: any) => (
                        <option key={u._id} value={u.name}>
                          {u.name}
                        </option>
                      ))
                    ) : (
                      <option value="">No UOMs available</option>
                    )}
                  </select>
                </div>
                <div className="sm:col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={addCurrentItem}
                    disabled={
                      !currentItem.name.trim() ||
                      !currentItem.quantity ||
                      !currentItem.uom
                    }
                    className="inline-flex items-center px-3 py-2.5 border border-transparent text-xs font-medium rounded-lg text-white bg-gray-800 hover:bg-gray-900"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add
                  </button>
                </div>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-800">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                      SI
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Qty
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                      UOM
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-white uppercase tracking-wider">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-6 text-sm text-center text-gray-500"
                      >
                        No Items
                      </td>
                    </tr>
                  ) : (
                    items.map((it, idx) => {
                      const isEditing = editIndex === idx && editingItem;
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {idx + 1}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {isEditing ? (
                              <select
                                value={editingItem?.itemId || ""}
                                onChange={(e) =>
                                  handleEditingItemChange(
                                    "itemId",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                              >
                                <option value="">Select Item</option>
                                {stockItems.map((si: any) => (
                                  <option key={si._id} value={si._id}>
                                    {si.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              it.name
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                value={editingItem?.description || ""}
                                onChange={(e) =>
                                  handleEditingItemChange(
                                    "description",
                                    e.target.value,
                                  )
                                }
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                              />
                            ) : (
                              it.description || "-"
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {isEditing ? (
                              <input
                                type="number"
                                min={1}
                                value={editingItem?.quantity || 1}
                                onChange={(e) =>
                                  handleEditingItemChange(
                                    "quantity",
                                    e.target.value,
                                  )
                                }
                                className="w-24 px-2 py-1.5 text-sm border border-gray-300 rounded text-right"
                              />
                            ) : (
                              it.quantity
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {isEditing ? (
                              <select
                                value={editingItem?.uom || ""}
                                onChange={(e) =>
                                  handleEditingItemChange("uom", e.target.value)
                                }
                                className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded"
                              >
                                <option value="">Select UOM</option>
                                {uoms.map((u: any) => (
                                  <option key={u._id} value={u.name}>
                                    {u.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              it.uom || "-"
                            )}
                          </td>
                          <td className="px-3 py-2 text-sm">
                            {isEditing ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={saveEditItem}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={cancelEditItem}
                                  className="text-gray-600 hover:text-gray-800"
                                >
                                  <XIcon className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => startEditItem(idx)}
                                  className="text-blue-600 hover:text-blue-900"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeItem(idx)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !note.trim()}
            className="rounded-lg bg-gray-800 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-gray-900 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  isDeleting?: boolean;
}> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Complaint",
  message = "Are you sure you want to delete this complaint? This action cannot be undone.",
  confirmText = "Delete",
  cancelText = "Cancel",
  isDeleting = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={isDeleting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-700">{message}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-gray-200 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
          >
            {isDeleting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

const ComplaintDetailModal: React.FC<{
  complaint: any;
  onClose: () => void;
}> = ({ complaint, onClose }) => {
  if (!complaint) return null;
  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      dateStyle: "full",
      timeStyle: "short",
    });
  };

  const getTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    if (diffHours > 0)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffMins > 0) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    return "Just now";
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-8 overflow-y-auto">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">
                  Complaint Details
                </h2>
                <p className="text-sm text-gray-300 mt-0.5">
                  ID: {complaint._id.slice(-8).toUpperCase()}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
          {/* Status Banner */}
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-full">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-medium">Active</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-medium">
                  {getTimeAgo(complaint.createdAt)}
                </span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              Last updated: {formatDate(complaint.updatedAt)}
            </div>
          </div>

          {/* Main Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Patient Info Card */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-5 border border-blue-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">
                  Patient Information
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-blue-600 w-24">
                    EMR No:
                  </span>
                  <span className="text-sm text-gray-900 font-mono">
                    {complaint.patientId?.emrNumber || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-blue-600 w-24">
                    Name:
                  </span>
                  <span className="text-sm text-gray-900">
                    {`${complaint.patientId?.firstName} ${complaint.patientId?.lastName}` ||
                      "N/A"}
                  </span>
                </div>
                {complaint.patientId?.phone && (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-blue-600 w-24">
                      Contact:
                    </span>
                    <span className="text-sm text-gray-900">
                      {complaint.patientId.phone}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Doctor & Appointment Card */}
            <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-5 border border-purple-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                  <Stethoscope className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">
                  Consultation Details
                </h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-purple-600 w-24">
                    Doctor:
                  </span>
                  <span className="text-sm text-gray-900">
                    {complaint.doctorId?.name || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-purple-600 w-24">
                    Appointment:
                  </span>
                  <span className="text-sm text-gray-900 font-mono">
                    {complaint.appointmentId?._id?.slice(-8).toUpperCase() ||
                      "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-purple-600 w-24">
                    Report ID:
                  </span>
                  <span className="text-sm text-gray-900 font-mono">
                    {complaint.appointmentReportId?._id
                      ?.slice(-8)
                      .toUpperCase() || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Complaint Note Card */}
          <div className="mb-8">
            <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-white" />
                </div>
                <h3 className="font-semibold text-gray-900">Complaint Note</h3>
              </div>
              <div className="bg-white rounded-lg p-4 border border-gray-200">
                <p className="text-gray-700 whitespace-pre-wrap">
                  {complaint.complaints}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
                <Package className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-semibold text-gray-900">
                Items ({complaint.items?.length || 0})
              </h3>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      <div className="flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        <span>SI</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Item Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Code
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-white uppercase tracking-wider">
                      <div className="flex items-center justify-end gap-1">
                        <Scale className="w-3 h-3" />
                        <span>Quantity</span>
                      </div>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      UOM
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {complaint.items && complaint.items.length > 0 ? (
                    complaint.items.map((item: any, index: number) => (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {(index + 1).toString().padStart(2, "0")}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-gray-900">
                            {item.name}
                          </div>
                          {item.itemId && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              ID: {item.itemId.slice(-6).toUpperCase()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            {item.code || "N/A"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {item.description || "-"}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            {item.uom || "N/A"}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="w-8 h-8 text-gray-400" />
                          <p className="text-sm text-gray-500">
                            No items added
                          </p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-gray-500" />
                <span className="text-xs text-gray-600">
                  Created: {formatDate(complaint.createdAt)}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentComplaintModal;

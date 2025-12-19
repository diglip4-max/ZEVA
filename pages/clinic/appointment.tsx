"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import type { NextPageWithLayout } from "../_app";
import { Loader2, Calendar, Clock, X } from "lucide-react";
import AppointmentBookingModal from "../../components/AppointmentBookingModal";
import { Toaster, toast } from "react-hot-toast";
import { useAgentPermissions } from '../../hooks/useAgentPermissions';

interface DoctorStaff {
  _id: string;
  name: string;
  email: string;
}

interface DoctorTreatmentSummary {
  _id: string;
  treatmentName: string;
  departmentName?: string | null;
  subcategories?: { name: string; slug?: string; price?: number | null }[];
}

interface DoctorDepartmentSummary {
  _id: string;
  name: string;
  clinicDepartmentId?: string | null;
}

interface Room {
  _id: string;
  name: string;
}

interface ClinicData {
  _id: string;
  name: string;
  timings: string;
}

interface TimeSlot {
  time: string;
  displayTime: string;
}

const ROW_INTERVAL_MINUTES = 30;
const SLOT_INTERVAL_MINUTES = 15;
const ROW_HEIGHT_PX = 48;
const SUB_SLOT_HEIGHT_PX = ROW_HEIGHT_PX / 2;

function timeStringToMinutes(time24: string): number {
  const [hourStr, minuteStr] = time24.split(":");
  return parseInt(hourStr, 10) * 60 + parseInt(minuteStr, 10);
}

function minutesToDisplay(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${String(minute).padStart(2, "0")} ${period}`;
}

function addMinutesToTime(time24: string, minutesToAdd: number): string {
  const baseMinutes = timeStringToMinutes(time24);
  const total = baseMinutes + minutesToAdd;
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

interface Appointment {
  _id: string;
  patientId: string;
  patientName: string;
  patientInvoiceNumber?: string | null;
  patientEmrNumber?: string | null;
  patientGender?: string | null;
  patientEmail?: string | null;
  patientMobileNumber?: string | null;
  doctorId: string;
  doctorName: string;
  roomId: string;
  roomName: string;
  status: string;
  followType: string;
  startDate: string;
  fromTime: string;
  toTime: string;
  referral: string;
  emergency: string;
  notes: string;
  bookedFrom?: "doctor" | "room"; // Track which column the appointment was booked from
}

// Parse clinic timings string and generate time slots
function parseTimings(timings: string): { startTime: string; endTime: string } | null {
  if (!timings || !timings.trim()) {
    return null;
  }

  // Common formats: "9:00 AM - 5:00 PM", "09:00-17:00", "9 AM - 5 PM", etc.
  const patterns = [
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i,
    /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/,
    /(\d{1,2})\s*(AM|PM)\s*-\s*(\d{1,2})\s*(AM|PM)/i,
  ];

  for (const pattern of patterns) {
    const match = timings.match(pattern);
    if (match) {
      if (pattern === patterns[0]) {
        // Format: "9:00 AM - 5:00 PM"
        const startHour = parseInt(match[1]);
        const startMin = parseInt(match[2]);
        const startPeriod = match[3].toUpperCase();
        const endHour = parseInt(match[4]);
        const endMin = parseInt(match[5]);
        const endPeriod = match[6].toUpperCase();

        let start24 = startHour === 12 ? 0 : startHour;
        if (startPeriod === "PM") start24 += 12;
        start24 = start24 * 60 + startMin;

        let end24 = endHour === 12 ? 0 : endHour;
        if (endPeriod === "PM") end24 += 12;
        end24 = end24 * 60 + endMin;

        return {
          startTime: `${String(Math.floor(start24 / 60)).padStart(2, "0")}:${String(start24 % 60).padStart(2, "0")}`,
          endTime: `${String(Math.floor(end24 / 60)).padStart(2, "0")}:${String(end24 % 60).padStart(2, "0")}`,
        };
      } else if (pattern === patterns[1]) {
        // Format: "09:00-17:00"
        return { startTime: match[1] + ":" + match[2], endTime: match[3] + ":" + match[4] };
      } else if (pattern === patterns[2]) {
        // Format: "9 AM - 5 PM"
        const startHour = parseInt(match[1]);
        const startPeriod = match[2].toUpperCase();
        const endHour = parseInt(match[3]);
        const endPeriod = match[4].toUpperCase();

        let start24 = startHour === 12 ? 0 : startHour;
        if (startPeriod === "PM") start24 += 12;
        let end24 = endHour === 12 ? 0 : endHour;
        if (endPeriod === "PM") end24 += 12;

        return {
          startTime: `${String(start24).padStart(2, "0")}:00`,
          endTime: `${String(end24).padStart(2, "0")}:00`,
        };
      }
    }
  }

  // Default: 9 AM to 5 PM if parsing fails
  return { startTime: "09:00", endTime: "17:00" };
}

// Generate 15-minute time slots
function generateTimeSlots(startTime: string, endTime: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);

  for (let current = startMinutes; current < endMinutes; current += ROW_INTERVAL_MINUTES) {
    const hours = Math.floor(current / 60);
    const minutes = current % 60;
    const time24 = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    slots.push({ time: time24, displayTime: minutesToDisplay(current) });
  }

  return slots;
}

// Format time for display
function formatTime(time24: string): string {
  const [hour, min] = time24.split(":").map(Number);
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${String(min).padStart(2, "0")} ${period}`;
}

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
  "adminToken",
];

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    const value =
      window.localStorage.getItem(key) ||
      window.sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

function AppointmentPage({ contextOverride = null }: { contextOverride?: "clinic" | "agent" | null }) {
  const router = useRouter();
  const [routeContext, setRouteContext] = useState<"clinic" | "agent">(
    contextOverride || "clinic"
  );
  const [permissions, setPermissions] = useState({
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [hasAgentToken, setHasAgentToken] = useState(false);
  const [isAgentRoute, setIsAgentRoute] = useState(false);
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [doctorStaff, setDoctorStaff] = useState<DoctorStaff[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [closingMinutes, setClosingMinutes] = useState<number | null>(null);
  // Custom time slot state - Initialize from localStorage if available
  const [useCustomTimeSlots, setUseCustomTimeSlots] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appointmentUseCustomTimeSlots");
      if (saved !== null) {
        return saved === "true";
      }
    }
    return false;
  });
  const [customStartTime, setCustomStartTime] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appointmentCustomStartTime");
      if (saved) {
        return saved;
      }
    }
    return "";
  });
  const [customEndTime, setCustomEndTime] = useState<string>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appointmentCustomEndTime");
      if (saved) {
        return saved;
      }
    }
    return "";
  });
  const [customTimeSlotModalOpen, setCustomTimeSlotModalOpen] = useState<boolean>(false);
  const [bookingModal, setBookingModal] = useState<{
    isOpen: boolean;
    doctorId: string;
    doctorName: string;
    roomId: string;
    roomName: string;
    slotTime: string;
    slotDisplayTime: string;
    selectedDate: string;
    bookedFrom: "doctor" | "room";
    fromTime?: string; // For drag selection
    toTime?: string; // For drag selection
  }>({
    isOpen: false,
    doctorId: "",
    doctorName: "",
    roomId: "",
    roomName: "",
    slotTime: "",
    slotDisplayTime: "",
    selectedDate: new Date().toISOString().split("T")[0],
    bookedFrom: "doctor",
  });
  
  // Drag selection state for time slots
  const [timeDragSelection, setTimeDragSelection] = useState<{
    isDragging: boolean;
    startMinutes: number | null;
    endMinutes: number | null;
    doctorId: string | null;
  }>({
    isDragging: false,
    startMinutes: null,
    endMinutes: null,
    doctorId: null,
  });
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [doctorTreatmentsMap, setDoctorTreatmentsMap] = useState<Record<string, DoctorTreatmentSummary[]>>({});
  const [doctorTreatmentsLoading, setDoctorTreatmentsLoading] = useState<Record<string, boolean>>({});
  const [doctorTreatmentsError, setDoctorTreatmentsError] = useState<Record<string, string>>({});
  const [doctorDepartmentsMap, setDoctorDepartmentsMap] = useState<Record<string, DoctorDepartmentSummary[]>>({});
  const [doctorDepartmentsLoading, setDoctorDepartmentsLoading] = useState<Record<string, boolean>>({});
  const [doctorDepartmentsError, setDoctorDepartmentsError] = useState<Record<string, string>>({});
  const [activeDoctorTooltip, setActiveDoctorTooltip] = useState<{
    doctorId: string;
    doctorName: string;
    position: { top: number; left: number };
  } | null>(null);
  const [visibleDoctorIds, setVisibleDoctorIds] = useState<string[]>([]);
  const [visibleRoomIds, setVisibleRoomIds] = useState<string[]>([]);
  // Unified order for both doctors and rooms (format: "doctor:id" or "room:id")
  // Initialize from localStorage if available
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("appointmentColumnOrder");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          // Swallow parse errors silently; user doesn't need to see them
        }
      }
    }
    return [];
  });
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null); // Format: "doctor:id" or "room:id"
  
  // Save columnOrder to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== "undefined" && columnOrder.length > 0) {
      localStorage.setItem("appointmentColumnOrder", JSON.stringify(columnOrder));
    }
  }, [columnOrder]);

  // Save custom time slot settings to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("appointmentUseCustomTimeSlots", String(useCustomTimeSlots));
    }
  }, [useCustomTimeSlots]);

  useEffect(() => {
    if (typeof window !== "undefined" && customStartTime) {
      localStorage.setItem("appointmentCustomStartTime", customStartTime);
    }
  }, [customStartTime]);

  useEffect(() => {
    if (typeof window !== "undefined" && customEndTime) {
      localStorage.setItem("appointmentCustomEndTime", customEndTime);
    }
  }, [customEndTime]);

  // Update time slots when custom time slots are enabled/disabled or changed
  useEffect(() => {
    if (useCustomTimeSlots && customStartTime && customEndTime) {
      const startMinutes = timeStringToMinutes(customStartTime);
      const endMinutes = timeStringToMinutes(customEndTime);
      if (endMinutes > startMinutes) {
        const slots = generateTimeSlots(customStartTime, customEndTime);
        setTimeSlots(slots);
        setClosingMinutes(endMinutes);
      }
    } else if (clinic?.timings && !useCustomTimeSlots) {
      const parsed = parseTimings(clinic.timings);
      if (parsed) {
        const slots = generateTimeSlots(parsed.startTime, parsed.endTime);
        setTimeSlots(slots);
        setClosingMinutes(timeStringToMinutes(parsed.endTime));
      }
    }
  }, [useCustomTimeSlots, customStartTime, customEndTime, clinic?.timings]);
  const [doctorFilterOpen, setDoctorFilterOpen] = useState(false);
  const [roomFilterOpen, setRoomFilterOpen] = useState(false);
  const doctorFilterTouchedRef = useRef(false);
  const roomFilterTouchedRef = useRef(false);
  const doctorFilterRef = useRef<HTMLDivElement | null>(null);
  const roomFilterRef = useRef<HTMLDivElement | null>(null);
  const dragStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeDragSelectionRef = useRef(timeDragSelection);
  
  // Keep ref in sync with state
  useEffect(() => {
    timeDragSelectionRef.current = timeDragSelection;
  }, [timeDragSelection]);
  const [hoveredAppointment, setHoveredAppointment] = useState<{
    appointment: Appointment;
    position: { top: number; left: number };
  } | null>(null);
  
  // Drag and drop state for appointments
  const [draggedAppointmentId, setDraggedAppointmentId] = useState<string | null>(null);
  const [dragOverDoctorId, setDragOverDoctorId] = useState<string | null>(null);
  const [dragOverTimeSlot, setDragOverTimeSlot] = useState<{ doctorId: string; minutes: number } | null>(null);

  // Central helper: log errors silently without showing toast popups
  const showErrorToast = (_message: string) => {
    // Requirement: do not show any axios error in toaster or noisy console logs on this page.
    // Intentionally left blank to silently swallow UI error notifications.
    // If needed for debugging, temporarily add a console.log here.
  };

  function getAuthHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    let token = null;
    
    // Check tokens based on route context first
    if (routeContext === "agent") {
      token =
        localStorage.getItem("agentToken") ||
        sessionStorage.getItem("agentToken") ||
        localStorage.getItem("staffToken") ||
        sessionStorage.getItem("staffToken") ||
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("userToken");
    } else {
      token = localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken");
    }
    
    // Fallback to userToken if no token found
    if (!token) {
      token = localStorage.getItem("userToken") || sessionStorage.getItem("userToken");
    }
    
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

  // Detect agent route and token
  useEffect(() => {
    if (typeof window === "undefined") return;
    const syncTokens = () => {
      const hasAgent =
        Boolean(localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken")) ||
        Boolean(localStorage.getItem("staffToken") || sessionStorage.getItem("staffToken")) ||
        Boolean(localStorage.getItem("userToken") || sessionStorage.getItem("userToken"));
      setHasAgentToken(hasAgent);
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
    setIsAgentRoute(agentPath && hasAgentToken);
  }, [router.pathname, hasAgentToken]);

  useEffect(() => {
    if (contextOverride) {
      setRouteContext(contextOverride);
      return;
    }
    if (typeof window === "undefined") return;
    const currentPath = window.location.pathname || "";
    if (currentPath.startsWith("/agent/")) {
      setRouteContext("agent");
    } else {
      setRouteContext("clinic");
    }
  }, [contextOverride]);

  // Use agent permissions hook for agent routes
  const agentPermissionsHook: any = useAgentPermissions(isAgentRoute ? "clinic_Appointment" : null);
  const agentPermissions = agentPermissionsHook?.permissions || {
    canRead: false,
    canCreate: false,
    canUpdate: false,
    canDelete: false,
    canAll: false,
  };
  const agentPermissionsLoading = agentPermissionsHook?.loading || false;

  // Handle agent permissions
  useEffect(() => {
    if (!isAgentRoute) return;
    if (agentPermissionsLoading) return;
    
    const newPermissions = {
      canRead: Boolean(agentPermissions.canAll || agentPermissions.canRead),
      canCreate: Boolean(agentPermissions.canAll || agentPermissions.canCreate),
      canUpdate: Boolean(agentPermissions.canAll || agentPermissions.canUpdate),
      canDelete: Boolean(agentPermissions.canAll || agentPermissions.canDelete),
    };
    
    setPermissions(newPermissions);
    setPermissionsLoaded(true);
  }, [isAgentRoute, agentPermissions, agentPermissionsLoading]);

  // Handle clinic permissions - clinic, doctor have full access; agent/doctorStaff need checks
  useEffect(() => {
    if (isAgentRoute) return;
    let isMounted = true;
    
    // Check which token type is being used
    const clinicToken = typeof window !== "undefined"
      ? (localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken"))
      : null;
    const doctorToken = typeof window !== "undefined"
      ? (localStorage.getItem("doctorToken") || sessionStorage.getItem("doctorToken"))
      : null;
    const agentToken = typeof window !== "undefined"
      ? (localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken"))
      : null;
    const staffToken = typeof window !== "undefined"
      ? (localStorage.getItem("staffToken") || sessionStorage.getItem("staffToken"))
      : null;
    const userToken = typeof window !== "undefined"
      ? (localStorage.getItem("userToken") || sessionStorage.getItem("userToken"))
      : null;

    // ✅ Clinic and doctor roles have full access by default - skip permission check
    if (clinicToken || doctorToken) {
      if (!isMounted) return;
      setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
      setPermissionsLoaded(true);
      return;
    }

    // For agent/doctorStaff tokens (when not on agent route), check permissions
    const token = getStoredToken();
    if (!token) {
      setPermissions({ canRead: false, canCreate: false, canUpdate: false, canDelete: false });
      setPermissionsLoaded(true);
      return;
    }

    // Only check permissions for agent/doctorStaff roles when not on agent route
    if (agentToken || staffToken || userToken) {
      const fetchPermissions = async () => {
        try {
          setPermissionsLoaded(false);
          // Use agent permissions API for agent/doctorStaff
          const res = await axios.get("/api/agent/get-module-permissions", {
            params: { moduleKey: "clinic_Appointment" },
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = res.data;
          
          if (!isMounted) return;
          const actions = data?.permissions?.actions || data?.data?.moduleActions || {};
          const canAll =
            actions.all === true ||
            actions.all === "true" ||
            String(actions.all || "").toLowerCase() === "true";
          setPermissions({
            canRead: canAll || actions.read === true,
            canCreate: canAll || actions.create === true,
            canUpdate: canAll || actions.update === true,
            canDelete: canAll || actions.delete === true,
          });
        } catch (err) {
          // Swallow agent permission errors; they will just result in no extra access
          setPermissions({ canRead: false, canCreate: false, canUpdate: false, canDelete: false });
        } finally {
          if (isMounted) {
            setPermissionsLoaded(true);
          }
        }
      };

      fetchPermissions();
    } else {
      // Unknown token type - default to full access (likely clinic/doctor)
      if (!isMounted) return;
      setPermissions({ canRead: true, canCreate: true, canUpdate: true, canDelete: true });
      setPermissionsLoaded(true);
    }

    return () => { isMounted = false; };
  }, [isAgentRoute]);

  const fetchDoctorTreatments = async (doctorId: string) => {
    setDoctorTreatmentsLoading((prev) => ({ ...prev, [doctorId]: true }));
    setDoctorTreatmentsError((prev) => ({ ...prev, [doctorId]: "" }));
    try {
      const res = await axios.get(`/api/clinic/doctor-treatments?doctorStaffId=${doctorId}`, {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        setDoctorTreatmentsMap((prev) => ({ ...prev, [doctorId]: res.data.treatments || [] }));
      } else {
        const errorMsg = res.data.message || "Failed to load doctor details";
        setDoctorTreatmentsError((prev) => ({ ...prev, [doctorId]: errorMsg }));
        showErrorToast(errorMsg);
      }
    } catch (err: any) {
      // Swallow doctor treatment load errors; tooltip will show generic failure
      const errorMsg = err.response?.data?.message || "Failed to load doctor details";
      setDoctorTreatmentsError((prev) => ({ ...prev, [doctorId]: errorMsg }));
      showErrorToast(errorMsg);
    } finally {
      setDoctorTreatmentsLoading((prev) => ({ ...prev, [doctorId]: false }));
    }
  };

  const fetchDoctorDepartments = async (doctorId: string) => {
    setDoctorDepartmentsLoading((prev) => ({ ...prev, [doctorId]: true }));
    setDoctorDepartmentsError((prev) => ({ ...prev, [doctorId]: "" }));
    try {
      const res = await axios.get(`/api/clinic/doctor-departments?doctorStaffId=${doctorId}`, {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        setDoctorDepartmentsMap((prev) => ({ ...prev, [doctorId]: res.data.departments || [] }));
      } else {
        const errorMsg = res.data.message || "Unable to load departments";
        setDoctorTreatmentsError((prev) => ({ ...prev, [doctorId]: errorMsg }));
        showErrorToast(errorMsg);
      }
    } catch (err: any) {
      // Swallow doctor department load errors; tooltip will show generic failure
      const errorMsg = err.response?.data?.message || "Unable to load departments";
      setDoctorDepartmentsError((prev) => ({ ...prev, [doctorId]: errorMsg }));
      showErrorToast(errorMsg);
    } finally {
      setDoctorDepartmentsLoading((prev) => ({ ...prev, [doctorId]: false }));
    }
  };

  const handleDoctorMouseEnter = (doctor: DoctorStaff, event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActiveDoctorTooltip({
      doctorId: doctor._id,
      doctorName: doctor.name,
      position: {
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX + rect.width / 2,
      },
    });
    if (!doctorTreatmentsMap[doctor._id] && !doctorTreatmentsLoading[doctor._id]) {
      fetchDoctorTreatments(doctor._id);
    }
    if (!doctorDepartmentsMap[doctor._id] && !doctorDepartmentsLoading[doctor._id]) {
      fetchDoctorDepartments(doctor._id);
    }
  };

  const handleDoctorMouseLeave = () => {
    setActiveDoctorTooltip(null);
  };

  useEffect(() => {
    if (!permissionsLoaded) return;
    
    // ✅ Only fetch appointment data if user has read permission
    if (!permissions.canRead) {
      setLoading(false);
      setError("You do not have permission to view appointment data");
      return;
    }

    const loadAppointmentData = async () => {
      try {
        setLoading(true);
        setError("");

        const res = await axios.get("/api/clinic/appointment-data", {
          headers: getAuthHeaders(),
        });

        if (res.data.success) {
          setClinic(res.data.clinic);
          setDoctorStaff(res.data.doctorStaff || []);
          setRooms(res.data.rooms || []);

          // Parse timings and generate time slots
          const parsed = parseTimings(res.data.clinic.timings);
          if (parsed) {
            const slots = generateTimeSlots(parsed.startTime, parsed.endTime);
            setTimeSlots(slots);
            setClosingMinutes(timeStringToMinutes(parsed.endTime));
            // Initialize custom times with clinic timings
            if (!customStartTime && !customEndTime) {
              setCustomStartTime(parsed.startTime);
              setCustomEndTime(parsed.endTime);
            }
          } else {
            // Default: 6 AM to 6 PM
            const defaultStart = "06:00";
            const defaultEnd = "18:00";
            const slots = generateTimeSlots(defaultStart, defaultEnd);
            setTimeSlots(slots);
            setClosingMinutes(timeStringToMinutes(defaultEnd));
            // Initialize custom times with defaults
            if (!customStartTime && !customEndTime) {
              setCustomStartTime(defaultStart);
              setCustomEndTime(defaultEnd);
            }
          }
          toast.success("Appointment schedule loaded successfully", { duration: 2000 });
        } else {
          const errorMsg = res.data.message || "Failed to load appointment data";
          setError(errorMsg);
          showErrorToast(errorMsg);
        }
      } catch (err: any) {
        // Swallow appointment data load errors; page will show generic error state
        const status = err.response?.status;
        const errorMsg = err.response?.data?.message || "Failed to load appointment data";
        // Friendly message for permission denied
        if (status === 403) {
          setError("You do not have permission to view appointment data.");
        } else {
          setError(errorMsg);
          showErrorToast(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    };

    loadAppointmentData();
  }, [routeContext, permissionsLoaded, permissions.canRead]);

  useEffect(() => {
    setVisibleDoctorIds((prev) => {
      if (doctorStaff.length === 0) return [];
      if (!doctorFilterTouchedRef.current || prev.length === 0) {
        const allIds = doctorStaff.map((doc) => doc._id);
        // Update unified column order - preserve saved order if available, otherwise add doctor columns at the end
        setColumnOrder((order) => {
          // Get saved order from localStorage if current order is empty or different
          let currentOrder = order;
          if (typeof window !== "undefined") {
            const saved = localStorage.getItem("appointmentColumnOrder");
            if (saved) {
              try {
                const parsedSaved = JSON.parse(saved);
                // Use saved order if it exists and has items, otherwise use current order
                if (parsedSaved.length > 0) {
                  currentOrder = parsedSaved;
                }
              } catch (e) {
                // Ignore bad saved order; fall back to current layout
              }
            }
          }
          
          // If we have a saved order, try to preserve it
          if (currentOrder.length > 0) {
            // Filter out invalid doctor IDs and add new ones
            const validDoctorColumns = currentOrder.filter(item => {
              if (item.startsWith("doctor:")) {
                const id = item.replace("doctor:", "");
                return allIds.includes(id);
              }
              return true; // Keep all room columns
            });
            // Add any new doctors that weren't in the saved order
            const existingDoctorIds = validDoctorColumns
              .filter(item => item.startsWith("doctor:"))
              .map(item => item.replace("doctor:", ""));
            const newDoctorIds = allIds.filter(id => !existingDoctorIds.includes(id));
            const newDoctorColumns = newDoctorIds.map(id => `doctor:${id}`);
            const mergedOrder = [...validDoctorColumns, ...newDoctorColumns];
            // Save merged order
            if (typeof window !== "undefined") {
              localStorage.setItem("appointmentColumnOrder", JSON.stringify(mergedOrder));
            }
            return mergedOrder;
          } else {
            // No saved order, add doctor columns at the end
            const roomColumns = currentOrder.filter(item => item.startsWith("room:"));
            const newDoctorColumns = allIds.map(id => `doctor:${id}`);
            const newOrder = [...roomColumns, ...newDoctorColumns];
            // Save new order
            if (typeof window !== "undefined") {
              localStorage.setItem("appointmentColumnOrder", JSON.stringify(newOrder));
            }
            return newOrder;
          }
        });
        return allIds;
      }
      const doctorIdSet = new Set(doctorStaff.map((doc) => doc._id));
      const filtered = prev.filter((id) => doctorIdSet.has(id));
      // Update unified order to match filtered list, preserving existing order where possible
      setColumnOrder((order) => {
        const filteredSet = new Set(filtered.map(id => `doctor:${id}`));
        // Keep existing order for items that are still visible
        const preserved = order.filter(item => {
          if (item.startsWith("doctor:")) {
            const id = item.replace("doctor:", "");
            return filteredSet.has(item) && filtered.includes(id);
          }
          return true; // Keep all room columns
        });
        // Add new doctor items that weren't in order
        const existingDoctorIds = preserved.filter(item => item.startsWith("doctor:")).map(item => item.replace("doctor:", ""));
        const newDoctorItems = filtered.filter(id => !existingDoctorIds.includes(id)).map(id => `doctor:${id}`);
        return [...preserved, ...newDoctorItems];
      });
      return filtered;
    });
  }, [doctorStaff]);

  useEffect(() => {
    setVisibleRoomIds((prev) => {
      if (rooms.length === 0) return [];
      if (!roomFilterTouchedRef.current || prev.length === 0) {
        const allIds = rooms.map((room) => room._id);
        // Update unified column order - preserve saved order if available, otherwise add room columns at the end
        setColumnOrder((order) => {
          // Get saved order from localStorage if current order is empty or different
          let currentOrder = order;
          if (typeof window !== "undefined") {
            const saved = localStorage.getItem("appointmentColumnOrder");
            if (saved) {
              try {
                const parsedSaved = JSON.parse(saved);
                // Use saved order if it exists and has items, otherwise use current order
                if (parsedSaved.length > 0) {
                  currentOrder = parsedSaved;
                }
              } catch (e) {
                // Ignore bad saved order; fall back to current layout
              }
            }
          }
          
          // If we have a saved order, try to preserve it
          if (currentOrder.length > 0) {
            // Filter out invalid room IDs and add new ones
            const validRoomColumns = currentOrder.filter(item => {
              if (item.startsWith("room:")) {
                const id = item.replace("room:", "");
                return allIds.includes(id);
              }
              return true; // Keep all doctor columns
            });
            // Add any new rooms that weren't in the saved order
            const existingRoomIds = validRoomColumns
              .filter(item => item.startsWith("room:"))
              .map(item => item.replace("room:", ""));
            const newRoomIds = allIds.filter(id => !existingRoomIds.includes(id));
            const newRoomColumns = newRoomIds.map(id => `room:${id}`);
            const mergedOrder = [...validRoomColumns, ...newRoomColumns];
            // Save merged order
            if (typeof window !== "undefined") {
              localStorage.setItem("appointmentColumnOrder", JSON.stringify(mergedOrder));
            }
            return mergedOrder;
          } else {
            // No saved order, add room columns at the end
            const doctorColumns = currentOrder.filter(item => item.startsWith("doctor:"));
            const newRoomColumns = allIds.map(id => `room:${id}`);
            const newOrder = [...doctorColumns, ...newRoomColumns];
            // Save new order
            if (typeof window !== "undefined") {
              localStorage.setItem("appointmentColumnOrder", JSON.stringify(newOrder));
            }
            return newOrder;
          }
        });
        return allIds;
      }
      const roomIdSet = new Set(rooms.map((room) => room._id));
      const filtered = prev.filter((id) => roomIdSet.has(id));
      // Update unified order to match filtered list, preserving existing order where possible
      setColumnOrder((order) => {
        const filteredSet = new Set(filtered.map(id => `room:${id}`));
        // Keep existing order for items that are still visible
        const preserved = order.filter(item => {
          if (item.startsWith("room:")) {
            const id = item.replace("room:", "");
            return filteredSet.has(item) && filtered.includes(id);
          }
          return true; // Keep all doctor columns
        });
        // Add new room items that weren't in order
        const existingRoomIds = preserved.filter(item => item.startsWith("room:")).map(item => item.replace("room:", ""));
        const newRoomItems = filtered.filter(id => !existingRoomIds.includes(id)).map(id => `room:${id}`);
        return [...preserved, ...newRoomItems];
      });
      return filtered;
    });
  }, [rooms]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (doctorFilterRef.current && !doctorFilterRef.current.contains(event.target as Node)) {
        setDoctorFilterOpen(false);
      }
      if (roomFilterRef.current && !roomFilterRef.current.contains(event.target as Node)) {
        setRoomFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  // Fetch appointments when date changes
  const loadAppointments = useCallback(async () => {
    // ✅ Only fetch appointments if user has read permission
    if (!permissions.canRead) {
      setAppointments([]);
      return;
    }

    try {
      const res = await axios.get(`/api/clinic/appointments?date=${selectedDate}`, {
        headers: getAuthHeaders(),
      });

      if (res.data.success) {
        const appointmentsData = res.data.appointments || [];
        setAppointments(appointmentsData);
        if (appointmentsData.length > 0) {
          toast.success(`Loaded ${appointmentsData.length} appointment(s)`, { duration: 2000 });
        }
      } else {
        showErrorToast(res.data.message || "Failed to load appointments");
      }
    } catch (err: any) {
      // Swallow appointment list load errors; generic error message is enough
      const status = err.response?.status;
      const errorMsg = err.response?.data?.message || "Failed to load appointments";
      if (status === 403) {
        setAppointments([]);
        setError("You do not have permission to view appointments.");
      } else {
        showErrorToast(errorMsg);
        setError(errorMsg);
      }
    }
  }, [selectedDate, routeContext, permissions.canRead]);

  useEffect(() => {
    if (selectedDate) {
      loadAppointments();
    }
  }, [selectedDate, loadAppointments]);

  // Update appointment function
  const updateAppointment = useCallback(async (
    appointmentId: string,
    updates: {
      doctorId?: string;
      fromTime?: string;
      toTime?: string;
      roomId?: string;
    }
  ) => {
    // ✅ Check permission before updating
    if (!permissions.canUpdate) {
      showErrorToast("You do not have permission to update appointments");
      return;
    }

    try {
      const appointment = appointments.find(apt => apt._id === appointmentId);
      if (!appointment) {
        showErrorToast("Appointment not found");
        return;
      }

      // Calculate new times if needed
      let newFromTime = updates.fromTime || appointment.fromTime;
      let newToTime = updates.toTime || appointment.toTime;
      
      // If only time is changed, preserve duration
      if (updates.fromTime && !updates.toTime) {
        const oldDuration = timeStringToMinutes(appointment.toTime) - timeStringToMinutes(appointment.fromTime);
        const newFromMinutes = timeStringToMinutes(updates.fromTime);
        const newToMinutes = newFromMinutes + oldDuration;
        newToTime = `${String(Math.floor(newToMinutes / 60)).padStart(2, "0")}:${String(newToMinutes % 60).padStart(2, "0")}`;
      }

      const updateData = {
        patientId: appointment.patientId,
        doctorId: updates.doctorId || appointment.doctorId,
        roomId: updates.roomId || appointment.roomId,
        status: appointment.status,
        followType: appointment.followType,
        startDate: appointment.startDate,
        fromTime: newFromTime,
        toTime: newToTime,
        referral: appointment.referral,
        emergency: appointment.emergency,
        notes: appointment.notes,
      };

      const res = await axios.put(
        `/api/clinic/update-appointment/${appointmentId}`,
        updateData,
        { headers: getAuthHeaders() }
      );

      if (res.data.success) {
        toast.success("Appointment updated successfully", { duration: 2000 });
        // Refresh appointments
        await loadAppointments();
      } else {
        showErrorToast(res.data.message || "Failed to update appointment");
      }
    } catch (err: any) {
      // Swallow update errors; generic message already set
      const errorMsg = err.response?.data?.message || "Failed to update appointment";
      showErrorToast(errorMsg);
    }
  }, [appointments, loadAppointments, routeContext]);

  // Drag handlers for appointments
  const handleAppointmentDragStart = (e: React.DragEvent, appointmentId: string) => {
    // ✅ Check permission before allowing drag
    if (!permissions.canUpdate) {
      e.preventDefault();
      showErrorToast("You do not have permission to move appointments");
      return;
    }
    e.stopPropagation();
    setDraggedAppointmentId(appointmentId);
    // Set drag image
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("appointmentId", appointmentId);
    }
  };

  const handleAppointmentDragEnd = () => {
    setDraggedAppointmentId(null);
    setDragOverDoctorId(null);
    setDragOverTimeSlot(null);
  };

  // Drop handler for doctor columns
  const handleDoctorColumnDrop = async (e: React.DragEvent, doctorId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // ✅ Check permission before allowing drop
    if (!permissions.canUpdate) {
      showErrorToast("You do not have permission to move appointments");
      return;
    }
    
    if (!draggedAppointmentId) return;

    const appointment = appointments.find(apt => apt._id === draggedAppointmentId);
    if (!appointment) return;

    // If dropped on same doctor, do nothing
    if (appointment.doctorId === doctorId) {
      setDraggedAppointmentId(null);
      setDragOverDoctorId(null);
      return;
    }

    // Update doctor
    await updateAppointment(draggedAppointmentId, { doctorId });
    
    setDraggedAppointmentId(null);
    setDragOverDoctorId(null);
  };

  // Drop handler for time slots
  const handleTimeSlotDrop = async (
    e: React.DragEvent,
    doctorId: string,
    slotMinutes: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    
    // ✅ Check permission before allowing drop
    if (!permissions.canUpdate) {
      showErrorToast("You do not have permission to move appointments");
      return;
    }
    
    if (!draggedAppointmentId) return;

    const appointment = appointments.find(apt => apt._id === draggedAppointmentId);
    if (!appointment) return;

    // Calculate new time
    const newFromTime = `${String(Math.floor(slotMinutes / 60)).padStart(2, "0")}:${String(slotMinutes % 60).padStart(2, "0")}`;
    
    // Check if dropping on the same doctor and same time
    const currentFromMinutes = timeStringToMinutes(appointment.fromTime);
    if (appointment.doctorId === doctorId && currentFromMinutes === slotMinutes) {
      setDraggedAppointmentId(null);
      setDragOverTimeSlot(null);
      return;
    }
    
    // Update both doctor and time
    await updateAppointment(draggedAppointmentId, {
      doctorId,
      fromTime: newFromTime,
    });
    
    setDraggedAppointmentId(null);
    setDragOverTimeSlot(null);
  };

  // Drag over handlers
  const handleDoctorColumnDragOver = (e: React.DragEvent, doctorId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedAppointmentId) {
      setDragOverDoctorId(doctorId);
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
    }
  };

  const handleTimeSlotDragOver = (
    e: React.DragEvent,
    doctorId: string,
    slotMinutes: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedAppointmentId) {
      setDragOverTimeSlot({ doctorId, minutes: slotMinutes });
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = "move";
      }
    }
  };

  const handleDragLeave = () => {
    setDragOverDoctorId(null);
    setDragOverTimeSlot(null);
  };

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Unused functions - kept for potential future use
  // These functions are commented out to fix TypeScript errors but can be uncommented when needed
  /*
  const handleToggleDoctorVisibility = (doctorId: string) => {
    doctorFilterTouchedRef.current = true;
    setVisibleDoctorIds((prev) => {
      if (prev.includes(doctorId)) {
        const filtered = prev.filter((id) => id !== doctorId);
        setColumnOrder((order) => order.filter((item) => item !== `doctor:${doctorId}`));
        return filtered;
      }
      const updated = [...prev, doctorId];
      setColumnOrder((order) => [...order, `doctor:${doctorId}`]);
      return updated;
    });
  };

  const handleToggleRoomVisibility = (roomId: string) => {
    roomFilterTouchedRef.current = true;
    setVisibleRoomIds((prev) => {
      if (prev.includes(roomId)) {
        const filtered = prev.filter((id) => id !== roomId);
        setColumnOrder((order) => order.filter((item) => item !== `room:${roomId}`));
        return filtered;
      }
      const updated = [...prev, roomId];
      setColumnOrder((order) => [...order, `room:${roomId}`]);
      return updated;
    });
  };

  const handleSelectAllDoctors = () => {
    doctorFilterTouchedRef.current = true;
    const allIds = doctorStaff.map((doc) => doc._id);
    setVisibleDoctorIds(allIds);
    setColumnOrder((order) => {
      const roomColumns = order.filter(item => item.startsWith("room:"));
      const doctorColumns = allIds.map(id => `doctor:${id}`);
      return [...roomColumns, ...doctorColumns];
    });
  };

  const handleClearDoctors = () => {
    doctorFilterTouchedRef.current = true;
    setVisibleDoctorIds([]);
  };

  const handleSelectAllRooms = () => {
    roomFilterTouchedRef.current = true;
    const allIds = rooms.map((room) => room._id);
    setVisibleRoomIds(allIds);
    setColumnOrder((order) => {
      const doctorColumns = order.filter(item => item.startsWith("doctor:"));
      const roomColumns = allIds.map(id => `room:${id}`);
      return [...doctorColumns, ...roomColumns];
    });
  };

  const handleClearRooms = () => {
    roomFilterTouchedRef.current = true;
    setVisibleRoomIds([]);
  };
  */

  // Get appointments for a specific doctor and row
  // Only show appointments that were booked from the doctor column
  const getAppointmentsForRow = (doctorId: string, slotTime: string): Appointment[] => {
    return appointments.filter((apt) => {
      if (apt.doctorId !== doctorId) return false;
      // Only show in doctor column if booked from doctor column (or undefined for backward compatibility)
      // If bookedFrom is "room", don't show in doctor column
      if (apt.bookedFrom === "room") {
        console.log(`Filtering out appointment ${apt._id} from doctor column - bookedFrom is "room"`);
        return false;
      }
      const aptDate = new Date(apt.startDate).toISOString().split("T")[0];
      if (aptDate !== selectedDate) return false;
      
      const rowStart = timeStringToMinutes(slotTime);
      const rowEnd = rowStart + ROW_INTERVAL_MINUTES;
      const fromTotal = timeStringToMinutes(apt.fromTime);
      const toTotal = timeStringToMinutes(apt.toTime);
      
      return fromTotal < rowEnd && toTotal > rowStart;
    });
  };

  // Get appointments for a specific room and row
  // Only show appointments that were booked from the room column
  const getRoomAppointmentsForRow = (roomId: string, slotTime: string): Appointment[] => {
    return appointments.filter((apt) => {
      if (apt.roomId !== roomId) return false;
      // Only show in room column if booked from room column
      // Check explicitly for "room" - handle undefined, null, or string "undefined"
      const bookedFrom = apt.bookedFrom;
      if (bookedFrom !== "room") {
        console.log(`Filtering out appointment ${apt._id} from room column - bookedFrom is "${bookedFrom}" (type: ${typeof bookedFrom}, not "room")`);
        return false;
      }
      const aptDate = new Date(apt.startDate).toISOString().split("T")[0];
      if (aptDate !== selectedDate) return false;

      const rowStart = timeStringToMinutes(slotTime);
      const rowEnd = rowStart + ROW_INTERVAL_MINUTES;
      const fromTotal = timeStringToMinutes(apt.fromTime);
      const toTotal = timeStringToMinutes(apt.toTime);

      return fromTotal < rowEnd && toTotal > rowStart;
    });
  };

  const todayStr = new Date().toISOString().split("T")[0];
  const isPastDay = selectedDate < todayStr;
  const isToday = selectedDate === todayStr;
  const currentMinutes = (() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  })();
  const lastBookableMinutes =
    closingMinutes !== null ? closingMinutes - SLOT_INTERVAL_MINUTES : null;

  // Helper function to open modal with selected time range
  const openModalWithSelection = useCallback((startMinutes: number, endMinutes: number, doctorId: string) => {
    const minStart = Math.min(startMinutes, endMinutes);
    const maxEnd = Math.max(startMinutes, endMinutes);
    
    // Only open modal if there's a valid selection (at least one slot)
    if (maxEnd > minStart) {
      const fromTime = `${String(Math.floor(minStart / 60)).padStart(2, "0")}:${String(minStart % 60).padStart(2, "0")}`;
      const toTime = `${String(Math.floor(maxEnd / 60)).padStart(2, "0")}:${String(maxEnd % 60).padStart(2, "0")}`;
      
      const doctor = doctorStaff.find((doc) => doc._id === doctorId);
      if (doctor) {
        setBookingModal({
          isOpen: true,
          doctorId: doctor._id,
          doctorName: doctor.name,
          roomId: "",
          roomName: "",
          slotTime: fromTime,
          slotDisplayTime: minutesToDisplay(minStart),
          selectedDate,
          bookedFrom: "doctor",
          fromTime,
          toTime,
        });
      }
    }
    
    setTimeDragSelection({
      isDragging: false,
      startMinutes: null,
      endMinutes: null,
      doctorId: null,
    });
  }, [doctorStaff, selectedDate, minutesToDisplay]);

  // Global mouse event handlers for time slot drag selection
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!timeDragSelection.isDragging || !timeDragSelection.doctorId) return;
      
      // Clear previous timeout
      if (dragStopTimeoutRef.current) {
        clearTimeout(dragStopTimeoutRef.current);
        dragStopTimeoutRef.current = null;
      }
      
      // Find the doctor column element
      const doctorColumn = document.querySelector(`[data-doctor-id="${timeDragSelection.doctorId}"]`);
      if (!doctorColumn) return;
      
      const rect = doctorColumn.getBoundingClientRect();
      const y = e.clientY - rect.top;
      
      // Calculate which time slot the mouse is over
      const slotIndex = Math.floor(y / ROW_HEIGHT_PX);
      if (slotIndex < 0 || slotIndex >= timeSlots.length) return;
      
      const slot = timeSlots[slotIndex];
      const rowStartMinutes = timeStringToMinutes(slot.time);
      
      // Calculate offset within the row (0 or 15 minutes)
      const offsetInRow = y - (slotIndex * ROW_HEIGHT_PX);
      const subSlotOffset = offsetInRow < ROW_HEIGHT_PX / 2 ? 0 : SLOT_INTERVAL_MINUTES;
      const currentMinutes = rowStartMinutes + subSlotOffset;
      
      const slotWithinClosing = lastBookableMinutes === null || currentMinutes <= lastBookableMinutes;
      const now = new Date();
      const currentTimeMinutes = now.getHours() * 60 + now.getMinutes();
      const canBookSlot = !isPastDay && (!isToday || currentMinutes >= currentTimeMinutes) && slotWithinClosing;
      
      if (canBookSlot) {
        setTimeDragSelection((prev) => ({
          ...prev,
          endMinutes: currentMinutes,
        }));
        
        // Set timeout to open modal when mouse stops moving (500ms delay)
        dragStopTimeoutRef.current = setTimeout(() => {
          const currentSelection = timeDragSelectionRef.current;
          if (currentSelection.isDragging && 
              currentSelection.startMinutes !== null && 
              currentSelection.endMinutes !== null && 
              currentSelection.doctorId) {
            openModalWithSelection(
              currentSelection.startMinutes,
              currentSelection.endMinutes,
              currentSelection.doctorId
            );
          }
        }, 500);
      }
    };

    const handleGlobalMouseUp = () => {
      if (!timeDragSelection.isDragging) return;
      
      // Clear the timeout if mouse is released
      if (dragStopTimeoutRef.current) {
        clearTimeout(dragStopTimeoutRef.current);
        dragStopTimeoutRef.current = null;
      }
      
      const { startMinutes, endMinutes, doctorId } = timeDragSelection;
      if (startMinutes !== null && endMinutes !== null && doctorId) {
        openModalWithSelection(startMinutes, endMinutes, doctorId);
      } else {
        // Reset selection if invalid
        setTimeDragSelection({
          isDragging: false,
          startMinutes: null,
          endMinutes: null,
          doctorId: null,
        });
      }
    };

    if (timeDragSelection.isDragging) {
      document.addEventListener("mousemove", handleGlobalMouseMove);
      document.addEventListener("mouseup", handleGlobalMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleGlobalMouseMove);
        document.removeEventListener("mouseup", handleGlobalMouseUp);
        // Clear timeout on cleanup
        if (dragStopTimeoutRef.current) {
          clearTimeout(dragStopTimeoutRef.current);
          dragStopTimeoutRef.current = null;
        }
      };
    }
  }, [timeDragSelection.isDragging, timeDragSelection.doctorId, timeDragSelection.startMinutes, timeDragSelection.endMinutes, timeSlots, lastBookableMinutes, isPastDay, isToday, currentMinutes, doctorStaff, selectedDate, minutesToDisplay, openModalWithSelection]);

  const tooltipDoctor = activeDoctorTooltip
    ? doctorStaff.find((doc) => doc._id === activeDoctorTooltip.doctorId)
    : null;
  const tooltipTreatments =
    (activeDoctorTooltip && doctorTreatmentsMap[activeDoctorTooltip.doctorId]) || [];
  const tooltipLoading =
    activeDoctorTooltip && doctorTreatmentsLoading[activeDoctorTooltip.doctorId];
  const tooltipError =
    activeDoctorTooltip && doctorTreatmentsError[activeDoctorTooltip.doctorId];
  const tooltipDeptList =
    (activeDoctorTooltip && doctorDepartmentsMap[activeDoctorTooltip.doctorId]) || [];
  const tooltipDeptLoading =
    activeDoctorTooltip && doctorDepartmentsLoading[activeDoctorTooltip.doctorId];
  const tooltipDeptError =
    activeDoctorTooltip && doctorDepartmentsError[activeDoctorTooltip.doctorId];
  // Get ordered columns (doctors and rooms) from unified columnOrder
  const orderedColumns = columnOrder
    .map((columnKey) => {
      if (columnKey.startsWith("doctor:")) {
        const doctorId = columnKey.replace("doctor:", "");
        const doctor = doctorStaff.find((doc) => doc._id === doctorId);
        if (doctor && visibleDoctorIds.includes(doctorId)) {
          return { type: "doctor" as const, data: doctor };
        }
      } else if (columnKey.startsWith("room:")) {
        const roomId = columnKey.replace("room:", "");
        const room = rooms.find((r) => r._id === roomId);
        if (room && visibleRoomIds.includes(roomId)) {
          return { type: "room" as const, data: room };
        }
      }
      return null;
    })
    .filter((col): col is { type: "doctor"; data: DoctorStaff } | { type: "room"; data: Room } => col !== null);

  // Separate for backward compatibility (used in some places)
  const visibleDoctors = orderedColumns.filter(col => col.type === "doctor").map(col => col.data);
  const visibleRooms = orderedColumns.filter(col => col.type === "room").map(col => col.data);

  // Unified drag and drop handlers for both doctor and room columns
  const handleColumnDragStart = (e: React.DragEvent, columnKey: string) => {
    setDraggedColumnId(columnKey);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", columnKey);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleColumnDragEnd = (e: React.DragEvent) => {
    setDraggedColumnId(null);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
  };

  const handleColumnDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Add visual feedback on drag over
    if (e.currentTarget instanceof HTMLElement) {
      if (e.currentTarget.classList.contains("room-column")) {
        e.currentTarget.classList.add("border-emerald-400", "bg-emerald-50");
      } else {
        e.currentTarget.classList.add("border-blue-400", "bg-blue-50");
      }
    }
  };

  const handleColumnDragLeave = (e: React.DragEvent) => {
    // Remove visual feedback when leaving
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.classList.remove("border-blue-400", "bg-blue-50", "border-emerald-400", "bg-emerald-50");
    }
  };

  const handleColumnDrop = (e: React.DragEvent, targetColumnKey: string) => {
    e.preventDefault();
    if (!draggedColumnId || draggedColumnId === targetColumnKey) return;

    setColumnOrder((prevOrder) => {
      const newOrder = [...prevOrder];
      const draggedIndex = newOrder.indexOf(draggedColumnId);
      const targetIndex = newOrder.indexOf(targetColumnKey);

      if (draggedIndex === -1 || targetIndex === -1) return prevOrder;

      // Remove dragged item from its current position
      newOrder.splice(draggedIndex, 1);
      // Insert at target position
      newOrder.splice(targetIndex, 0, draggedColumnId);

      // Save to localStorage immediately
      if (typeof window !== "undefined") {
        localStorage.setItem("appointmentColumnOrder", JSON.stringify(newOrder));
      }

      return newOrder;
    });
    setDraggedColumnId(null);
  };

  // Time slot drag selection handlers
  const handleTimeSlotMouseDown = (e: React.MouseEvent, doctorId: string, startMinutes: number) => {
    // Only start drag on left mouse button and if slot is bookable
    if (e.button !== 0) return;
    
    const slotWithinClosing = lastBookableMinutes === null || startMinutes <= lastBookableMinutes;
    const canBookSlot = !isPastDay && (!isToday || startMinutes >= currentMinutes) && slotWithinClosing;
    
    if (!canBookSlot) return;
    
    e.preventDefault();
    setTimeDragSelection({
      isDragging: true,
      startMinutes,
      endMinutes: startMinutes,
      doctorId,
    });
  };


  // Check if a time slot is within the drag selection
  const isSlotInSelection = (slotStartMinutes: number, slotEndMinutes: number, doctorId: string): boolean => {
    if (!timeDragSelection.isDragging || timeDragSelection.doctorId !== doctorId) return false;
    const { startMinutes, endMinutes } = timeDragSelection;
    if (startMinutes === null || endMinutes === null) return false;
    
    const minStart = Math.min(startMinutes, endMinutes);
    const maxEnd = Math.max(startMinutes, endMinutes);
    
    // Check if slot overlaps with selection
    return slotStartMinutes < maxEnd && slotEndMinutes > minStart;
  };

  const handleBookingSuccess = () => {
    // Reload appointments
    axios
      .get(`/api/clinic/appointments?date=${selectedDate}`, {
        headers: getAuthHeaders(),
      })
      .then((res) => {
        if (res.data.success) {
          const appointmentsData = res.data.appointments || [];
          setAppointments(appointmentsData);
          toast.success("Appointment booked successfully!", { duration: 3000 });
        } else {
          showErrorToast(res.data.message || "Failed to reload appointments");
        }
      })
      .catch((err) => {
        // Swallow reload errors; generic message already set
        showErrorToast(err.response?.data?.message || "Failed to reload appointments");
      });
  };

  if (loading || !permissionsLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-700">Loading appointment schedule...</p>
        </div>
      </div>
    );
  }

  // Show access denied message if no permission
  if (!permissions.canRead) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">Access Denied</h3>
          <p className="text-sm text-gray-700 dark:text-gray-400">
            You do not have permission to view appointments. Please contact your administrator.
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-3 text-red-600">
          <Calendar className="w-5 h-5" />
          <p className="font-medium">{error}</p>
        </div>
      </div>
    );
  }

  // Get status color for appointments
  const getStatusColor = (status: string): { bg: string; text: string; border: string } => {
    const statusLower = status.toLowerCase();
    switch (statusLower) {
      case "booked":
        return { bg: "bg-blue-500", text: "text-white", border: "border-blue-600" };
      case "enquiry":
        return { bg: "bg-amber-500", text: "text-white", border: "border-amber-600" };
      case "discharge":
        return { bg: "bg-green-500", text: "text-white", border: "border-green-600" };
      case "arrived":
        return { bg: "bg-purple-500", text: "text-white", border: "border-purple-600" };
      case "consultation":
        return { bg: "bg-indigo-500", text: "text-white", border: "border-indigo-600" };
      case "cancelled":
        return { bg: "bg-red-500", text: "text-white", border: "border-red-600" };
      case "approved":
        return { bg: "bg-emerald-500", text: "text-white", border: "border-emerald-600" };
      case "rescheduled":
        return { bg: "bg-orange-500", text: "text-white", border: "border-orange-600" };
      case "waiting":
        return { bg: "bg-yellow-500", text: "text-white", border: "border-yellow-600" };
      case "rejected":
        return { bg: "bg-rose-500", text: "text-white", border: "border-rose-600" };
      case "completed":
        return { bg: "bg-teal-500", text: "text-white", border: "border-teal-600" };
      default:
        return { bg: "bg-gray-500", text: "text-white", border: "border-gray-600" };
    }
  };

  return (
    <div className="p-1 sm:p-2 md:p-3 space-y-2 sm:space-y-3">
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
        }}
      />
      <div className="bg-white dark:bg-gray-50 rounded-lg border border-gray-200 dark:border-gray-200 shadow-sm p-1.5 sm:p-2">
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-900">Appointment Schedule</h1>
              <p className="text-xs text-gray-700 dark:text-gray-800">
                {clinic?.name} • {clinic?.timings || "No timings set"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    const current = new Date(selectedDate);
                    current.setDate(current.getDate() - 1);
                    setSelectedDate(current.toISOString().split("T")[0]);
                  }}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-xs font-medium text-gray-700 dark:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-200 transition-colors"
                  type="button"
                >
                  Prev
                </button>
                <button
                  onClick={() => {
                    setSelectedDate(new Date().toISOString().split("T")[0]);
                    toast.success("Switched to today", { duration: 2000 });
                  }}
                  className="px-2 py-1 rounded border border-gray-900 dark:border-gray-300 bg-gray-900 dark:bg-gray-200 text-xs font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 transition-colors"
                  type="button"
                >
                  Today
                </button>
                <button
                  onClick={() => {
                    const current = new Date(selectedDate);
                    current.setDate(current.getDate() + 1);
                    setSelectedDate(current.toISOString().split("T")[0]);
                  }}
                  className="px-2 py-1 rounded border border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-xs font-medium text-gray-700 dark:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-200 transition-colors"
                  type="button"
                >
                  Next
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-800 whitespace-nowrap">Date:</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    toast(`Viewing appointments for ${new Date(e.target.value).toLocaleDateString()}`, {
                      duration: 2000,
                      icon: "ℹ️",
                    });
                  }}
                  className="border border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-700 focus:border-gray-900 dark:focus:border-gray-700 transition-all"
                />
              </div>
            </div>
          </div>
          {(doctorStaff.length > 0 || rooms.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {doctorStaff.length > 0 && (
                <div className="relative" ref={doctorFilterRef}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!permissions.canUpdate) {
                        showErrorToast("You do not have permission to filter doctors");
                        return;
                      }
                      setDoctorFilterOpen((prev) => !prev);
                    }}
                    disabled={!permissions.canUpdate}
                    className={`inline-flex items-center gap-1 rounded border border-gray-300 dark:border-gray-300 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-700 ${
                      permissions.canUpdate
                        ? "bg-white dark:bg-gray-100 text-gray-700 dark:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-200"
                        : "bg-gray-100 dark:bg-gray-200 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Doctors
                    <span className="text-[10px] text-gray-700 dark:text-gray-800">
                      ({visibleDoctorIds.length}/{doctorStaff.length})
                    </span>
                  </button>
                  {doctorFilterOpen && (
                    <div className="absolute z-40 mt-1 w-48 rounded border border-gray-200 dark:border-gray-300 bg-white dark:bg-gray-100 p-2 shadow-lg">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-gray-700 dark:text-gray-800">
                        <span>Doctors</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (!permissions.canUpdate) {
                                showErrorToast("You do not have permission to modify doctor filters");
                                return;
                              }
                              doctorFilterTouchedRef.current = true;
                              const allIds = doctorStaff.map((doc) => doc._id);
                              setVisibleDoctorIds(allIds);
                              setColumnOrder((order) => {
                                const roomColumns = order.filter(item => item.startsWith("room:"));
                                const doctorColumns = allIds.map(id => `doctor:${id}`);
                                return [...roomColumns, ...doctorColumns];
                              });
                            }}
                            disabled={!permissions.canUpdate}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (!permissions.canUpdate) {
                                showErrorToast("You do not have permission to modify doctor filters");
                                return;
                              }
                              doctorFilterTouchedRef.current = true;
                              setVisibleDoctorIds([]);
                            }}
                            disabled={!permissions.canUpdate}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
                        {doctorStaff.map((doctor) => (
                          <label key={doctor._id} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-800">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              checked={visibleDoctorIds.includes(doctor._id)}
                              onChange={() => {
                                if (!permissions.canUpdate) {
                                  showErrorToast("You do not have permission to toggle doctor visibility");
                                  return;
                                }
                                doctorFilterTouchedRef.current = true;
                                setVisibleDoctorIds((prev) => {
                                  if (prev.includes(doctor._id)) {
                                    const filtered = prev.filter((id) => id !== doctor._id);
                                    setColumnOrder((order) => order.filter((item) => item !== `doctor:${doctor._id}`));
                                    return filtered;
                                  }
                                  const updated = [...prev, doctor._id];
                                  setColumnOrder((order) => [...order, `doctor:${doctor._id}`]);
                                  return updated;
                                });
                              }}
                              disabled={!permissions.canUpdate}
                            />
                            <span className="truncate">{doctor.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {rooms.length > 0 && (
                <div className="relative" ref={roomFilterRef}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!permissions.canUpdate) {
                        showErrorToast("You do not have permission to filter rooms");
                        return;
                      }
                      setRoomFilterOpen((prev) => !prev);
                    }}
                    disabled={!permissions.canUpdate}
                    className={`inline-flex items-center gap-1 rounded border border-gray-300 dark:border-gray-300 px-2 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-700 ${
                      permissions.canUpdate
                        ? "bg-white dark:bg-gray-100 text-gray-700 dark:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-200"
                        : "bg-gray-100 dark:bg-gray-200 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    }`}
                  >
                    Rooms
                    <span className="text-[10px] text-gray-700 dark:text-gray-800">
                      ({visibleRoomIds.length}/{rooms.length})
                    </span>
                  </button>
                  {roomFilterOpen && (
                    <div className="absolute z-40 mt-1 w-48 rounded border border-gray-200 dark:border-gray-300 bg-white dark:bg-gray-100 p-2 shadow-lg">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-gray-700 dark:text-gray-800">
                        <span>Rooms</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (!permissions.canUpdate) {
                                showErrorToast("You do not have permission to modify room filters");
                                return;
                              }
                              roomFilterTouchedRef.current = true;
                              const allIds = rooms.map((room) => room._id);
                              setVisibleRoomIds(allIds);
                              setColumnOrder((order) => {
                                const doctorColumns = order.filter(item => item.startsWith("doctor:"));
                                const roomColumns = allIds.map(id => `room:${id}`);
                                return [...doctorColumns, ...roomColumns];
                              });
                            }}
                            disabled={!permissions.canUpdate}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-[10px] disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => {
                              if (!permissions.canUpdate) {
                                showErrorToast("You do not have permission to modify room filters");
                                return;
                              }
                              roomFilterTouchedRef.current = true;
                              setVisibleRoomIds([]);
                            }}
                            disabled={!permissions.canUpdate}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
                        {rooms.map((room) => (
                          <label key={room._id} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-800">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                              checked={visibleRoomIds.includes(room._id)}
                              onChange={() => {
                                if (!permissions.canUpdate) {
                                  showErrorToast("You do not have permission to toggle room visibility");
                                  return;
                                }
                                roomFilterTouchedRef.current = true;
                                setVisibleRoomIds((prev) => {
                                  if (prev.includes(room._id)) {
                                    const filtered = prev.filter((id) => id !== room._id);
                                    setColumnOrder((order) => order.filter((item) => item !== `room:${room._id}`));
                                    return filtered;
                                  }
                                  const updated = [...prev, room._id];
                                  setColumnOrder((order) => [...order, `room:${room._id}`]);
                                  return updated;
                                });
                              }}
                              disabled={!permissions.canUpdate}
                            />
                            <span className="truncate">{room.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Custom Time Slot Option */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (!permissions.canUpdate) {
                      showErrorToast("You do not have permission to modify time slots");
                      return;
                    }
                    setCustomTimeSlotModalOpen(true);
                  }}
                  disabled={!permissions.canUpdate}
                  className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-gray-900 dark:focus:ring-gray-100 ${
                    !permissions.canUpdate
                      ? "border-gray-300 dark:border-gray-300 bg-gray-100 dark:bg-gray-200 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                      : useCustomTimeSlots
                      ? "border-purple-500 dark:border-purple-400 bg-purple-50 dark:bg-purple-100 text-purple-700 dark:text-purple-800 hover:bg-purple-100 dark:hover:bg-purple-200"
                      : "border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-gray-700 dark:text-gray-800 hover:bg-gray-50 dark:hover:bg-gray-200"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {useCustomTimeSlots ? "Custom Time" : "Time Slots"}
                  {useCustomTimeSlots && customStartTime && customEndTime && (
                    <span className="text-[10px]">
                      ({formatTime(customStartTime)} - {formatTime(customEndTime)})
                    </span>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {doctorStaff.length === 0 && rooms.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gray-100 dark:bg-gray-200 flex items-center justify-center text-gray-400 dark:text-gray-600 text-sm">
              👨‍⚕️
            </div>
            <p className="text-xs text-gray-700 dark:text-gray-800">No doctor staff or rooms available.</p>
            <p className="text-[10px] text-gray-700 dark:text-gray-700 mt-1">Add doctor staff and rooms to view their schedules.</p>
          </div>
        ) : (
          <div className="border border-gray-200 dark:border-gray-300 rounded overflow-hidden bg-white dark:bg-gray-50">
            {/* Scrollable container */}
            <div className="overflow-x-auto max-h-[75vh] overflow-y-auto relative">
            {/* Header with doctor names and rooms */}
              <div className="flex bg-gray-50 dark:bg-gray-200 border-b border-gray-200 dark:border-gray-300 sticky top-0 z-20">
                <div className="w-16 sm:w-18 flex-shrink-0 border-r border-gray-200 dark:border-gray-300 p-1 bg-white dark:bg-gray-50 sticky left-0 z-30">
                  <div className="flex items-center gap-0.5 text-[8px] sm:text-[9px] font-semibold text-gray-900 dark:text-gray-900">
                    <Clock className="w-2.5 h-2.5" />
                  <span>Time</span>
                </div>
              </div>
              {/* Unified columns (doctors and rooms in order) */}
                {orderedColumns.map((column, index) => {
                  const columnKey = column.type === "doctor" ? `doctor:${column.data._id}` : `room:${column.data._id}`;
                  const isDragged = draggedColumnId === columnKey;
                  const isLast = index === orderedColumns.length - 1;
                  
                  if (column.type === "doctor") {
                    const doctor = column.data;
                    return (
                      <div
                        key={columnKey}
                        className={`flex-1 min-w-[90px] sm:min-w-[100px] ${isLast ? '' : 'border-r'} border-gray-200 dark:border-gray-300 p-1 relative bg-white dark:bg-gray-50 transition-all ${
                          isDragged ? "opacity-50" : ""
                        } ${draggedColumnId ? "cursor-move" : ""}`}
                        draggable={permissions.canUpdate}
                        onDragStart={(e) => {
                          if (!permissions.canUpdate) {
                            e.preventDefault();
                            showErrorToast("You do not have permission to reorder columns");
                            return;
                          }
                          handleColumnDragStart(e, columnKey);
                        }}
                        onDragEnd={handleColumnDragEnd}
                        onDragOver={handleColumnDragOver}
                        onDragLeave={handleColumnDragLeave}
                        onDrop={(e) => {
                          handleColumnDrop(e, columnKey);
                          if (e.currentTarget instanceof HTMLElement) {
                            e.currentTarget.classList.remove("border-blue-400", "bg-blue-50", "border-emerald-400", "bg-emerald-50");
                          }
                        }}
                    onMouseEnter={(e) => handleDoctorMouseEnter(doctor, e)}
                    onMouseLeave={handleDoctorMouseLeave}
                        title={permissions.canUpdate ? "Drag to reorder columns" : "Column (no permission to reorder)"}
                >
                    {/* ✅ Only show doctor name if user has read permission */}
                    {permissions.canRead ? (
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-50 dark:bg-blue-100 border border-blue-200 dark:border-blue-300 flex items-center justify-center text-blue-700 dark:text-blue-800 font-semibold text-[8px] sm:text-[9px] flex-shrink-0">
                          {getInitials(doctor.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[8px] sm:text-[9px] font-semibold text-gray-900 dark:text-gray-900 truncate">{doctor.name}</p>
                        </div>
                        {permissions.canUpdate && (
                          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-70 transition-opacity" title="Drag to reorder">
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-100 dark:bg-gray-200 flex items-center justify-center text-gray-400 dark:text-gray-600 font-semibold text-[8px] sm:text-[9px] flex-shrink-0">
                          ?
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[8px] sm:text-[9px] font-semibold text-gray-500 dark:text-gray-500 truncate">Hidden</p>
                        </div>
                      </div>
                    )}
                      </div>
                    );
                  } else {
                    const room = column.data;
                    return (
                      <div
                        key={columnKey}
                        className={`flex-1 min-w-[90px] sm:min-w-[100px] ${isLast ? '' : 'border-r'} border-gray-200 dark:border-gray-300 p-1 bg-white dark:bg-gray-50 transition-all room-column ${
                          isDragged ? "opacity-50" : ""
                        } ${draggedColumnId ? "cursor-move" : ""}`}
                        draggable={permissions.canUpdate}
                        onDragStart={(e) => {
                          if (!permissions.canUpdate) {
                            e.preventDefault();
                            showErrorToast("You do not have permission to reorder columns");
                            return;
                          }
                          handleColumnDragStart(e, columnKey);
                        }}
                        onDragEnd={handleColumnDragEnd}
                        onDragOver={handleColumnDragOver}
                        onDragLeave={handleColumnDragLeave}
                        onDrop={(e) => {
                          handleColumnDrop(e, columnKey);
                          if (e.currentTarget instanceof HTMLElement) {
                            e.currentTarget.classList.remove("border-blue-400", "bg-blue-50", "border-emerald-400", "bg-emerald-50");
                          }
                        }}
                        title={permissions.canUpdate ? "Drag to reorder columns" : "Column (no permission to reorder)"}
                >
                    {/* ✅ Only show room name if user has read permission */}
                    {permissions.canRead ? (
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-50 dark:bg-emerald-100 border border-emerald-200 dark:border-emerald-300 flex items-center justify-center text-emerald-700 dark:text-emerald-800 font-semibold text-[8px] sm:text-[9px] flex-shrink-0">
                          🏥
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[8px] sm:text-[9px] font-semibold text-gray-900 dark:text-gray-900 truncate">{room.name}</p>
                        </div>
                        {permissions.canUpdate && (
                          <div className="flex-shrink-0 cursor-grab active:cursor-grabbing opacity-40 hover:opacity-70 transition-opacity" title="Drag to reorder">
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-gray-500 dark:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                            </svg>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-gray-100 dark:bg-gray-200 flex items-center justify-center text-gray-400 dark:text-gray-600 font-semibold text-[8px] sm:text-[9px] flex-shrink-0">
                          ?
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[8px] sm:text-[9px] font-semibold text-gray-500 dark:text-gray-500 truncate">Hidden</p>
                        </div>
                      </div>
                    )}
                      </div>
                    );
                  }
                })}
            </div>

            {/* Time slots grid */}
              <div className="min-w-max">
              {timeSlots.map((slot) => {
                const rowStartMinutes = timeStringToMinutes(slot.time);
                return (
                  <div key={slot.time} className="flex border-b border-gray-100 dark:border-gray-300 hover:bg-gray-50/50 dark:hover:bg-gray-100/50 transition-colors min-w-max">
                    {/* Time column */}
                    <div
                      className="w-16 sm:w-18 flex-shrink-0 border-r border-gray-200 dark:border-gray-300 p-1 bg-white dark:bg-gray-50 relative sticky left-0 z-10"
                      style={{ height: ROW_HEIGHT_PX }}
                    >
                      <p className="text-[8px] sm:text-[9px] font-semibold text-gray-900 dark:text-gray-900">{slot.displayTime}</p>
                      <div className="absolute left-0 right-0 top-1/2 border-t border-gray-200 dark:border-gray-300" />
                    </div>

                    {/* Unified columns (doctors and rooms in order) */}
                          {orderedColumns.map((column, colIndex) => {
                      const isLastColumn = colIndex === orderedColumns.length - 1;
                      if (column.type === "doctor") {
                        const doctor = column.data;
                      const rowAppointments = getAppointmentsForRow(doctor._id, slot.time);

                      const isInSelection = timeDragSelection.isDragging && timeDragSelection.doctorId === doctor._id;

                      const isDragOver = dragOverDoctorId === doctor._id;
                      return (
                        <div
                            key={`${slot.time}-doctor-${doctor._id}`}
                          className={`flex-1 min-w-[90px] sm:min-w-[100px] ${isLastColumn ? '' : 'border-r'} border-gray-200 dark:border-gray-300 relative bg-white dark:bg-gray-50 transition-colors ${isDragOver ? "bg-blue-50 dark:bg-blue-100 border-blue-300 dark:border-blue-400" : ""}`}
                          style={{ height: ROW_HEIGHT_PX }}
                          data-doctor-id={doctor._id}
                          onDragOver={(e) => {
                            if (permissions.canUpdate) {
                              handleDoctorColumnDragOver(e, doctor._id);
                            }
                          }}
                          onDragLeave={handleDragLeave}
                          onDrop={(e) => {
                            if (permissions.canUpdate) {
                              handleDoctorColumnDrop(e, doctor._id);
                            }
                          }}
                        >
                          <div className="absolute left-0 right-0 top-1/2 border-t border-gray-200 dark:border-gray-700 pointer-events-none" />
                          <div className="flex flex-col h-full">
                            {[0, SLOT_INTERVAL_MINUTES].map((offset) => {
                              const subSlotTime = addMinutesToTime(slot.time, offset);
                              const subStartMinutes = rowStartMinutes + offset;
                              const subEndMinutes = subStartMinutes + SLOT_INTERVAL_MINUTES;
                              const isSubSlotOccupied = rowAppointments.some((apt) => {
                                const aptStart = timeStringToMinutes(apt.fromTime);
                                const aptEnd = timeStringToMinutes(apt.toTime);
                                return aptStart < subEndMinutes && aptEnd > subStartMinutes;
                              });
                              const slotWithinClosing =
                                lastBookableMinutes === null ||
                                subStartMinutes <= lastBookableMinutes;
                              const canBookSlot =
                                !isPastDay &&
                                (!isToday || subStartMinutes >= currentMinutes) &&
                                slotWithinClosing &&
                                !isSubSlotOccupied;
                              
                              // Check if this slot is in the drag selection
                              const isSelected = isInSelection && isSlotInSelection(subStartMinutes, subEndMinutes, doctor._id);
                              const isDragOverSlot = dragOverTimeSlot?.doctorId === doctor._id && dragOverTimeSlot?.minutes === subStartMinutes;

                              return (
                                <div
                                  key={`${slot.time}-${doctor._id}-${offset}`}
                                  className={`flex-1 transition-all ${
                                    isDragOverSlot
                                      ? "bg-green-200 dark:bg-green-200 border-l-2 border-green-500 dark:border-green-600"
                                      : isSelected
                                      ? "bg-blue-200 dark:bg-blue-200 border-l-2 border-blue-500 dark:border-blue-600 cursor-crosshair"
                                      : canBookSlot
                                      ? "cursor-crosshair hover:bg-blue-50 dark:hover:bg-blue-100 border-l-2 border-transparent hover:border-blue-400 dark:hover:border-blue-500"
                                      : isSubSlotOccupied
                                      ? "bg-gray-50 dark:bg-gray-100 cursor-not-allowed"
                                      : "bg-gray-50 dark:bg-gray-100 cursor-not-allowed"
                                  }`}
                                  style={{ height: SUB_SLOT_HEIGHT_PX }}
                                  title={
                                    draggedAppointmentId
                                      ? `Drop appointment here to move to ${minutesToDisplay(subStartMinutes)}`
                                      : canBookSlot
                                      ? `Click or drag to select time range starting at ${minutesToDisplay(subStartMinutes)}`
                                      : isPastDay
                                      ? "Cannot book appointments for past dates"
                                      : slotWithinClosing
                                      ? "Cannot book past time slots"
                                      : "Cannot book beyond clinic closing time"
                                  }
                                  onDragOver={(e) => {
                                    if (permissions.canUpdate && draggedAppointmentId && canBookSlot) {
                                      handleTimeSlotDragOver(e, doctor._id, subStartMinutes);
                                    }
                                  }}
                                  onDragLeave={handleDragLeave}
                                  onDrop={(e) => {
                                    if (permissions.canUpdate && draggedAppointmentId && canBookSlot) {
                                      handleTimeSlotDrop(e, doctor._id, subStartMinutes);
                                    }
                                  }}
                                  onMouseDown={(e) => {
                                    if (canBookSlot && !draggedAppointmentId) {
                                      handleTimeSlotMouseDown(e, doctor._id, subStartMinutes);
                                    }
                                  }}
                                  onClick={(_e) => {
                                    // ✅ Check permission before opening booking modal
                                    if (!permissions.canCreate) {
                                      showErrorToast("You do not have permission to book appointments");
                                      return;
                                    }
                                    // Only handle click if not dragging (to avoid double-triggering)
                                    if (canBookSlot && !timeDragSelection.isDragging && !draggedAppointmentId) {
                                      setBookingModal({
                                        isOpen: true,
                                        doctorId: doctor._id,
                                        doctorName: doctor.name,
                                        roomId: "",
                                        roomName: "",
                                        slotTime: subSlotTime,
                                        slotDisplayTime: minutesToDisplay(subStartMinutes),
                                        selectedDate,
                                        bookedFrom: "doctor",
                                      });
                                    }
                                  }}
                                />
                              );
                            })}
                          </div>

                          {/* ✅ Only show appointments if user has read permission */}
                          {permissions.canRead && rowAppointments.length > 0
                            ? rowAppointments.map((apt) => {
                                const fromTotal = timeStringToMinutes(apt.fromTime);
                                const toTotal = timeStringToMinutes(apt.toTime);
                                
                                // Only render appointment in the row where it starts
                                // Check if appointment starts in this row
                                const appointmentStartsInThisRow = fromTotal >= rowStartMinutes && fromTotal < rowStartMinutes + ROW_INTERVAL_MINUTES;
                                
                                if (!appointmentStartsInThisRow) {
                                  return null;
                                }
                                
                                // Calculate the full height of the appointment across all rows
                                const appointmentDuration = toTotal - fromTotal;
                                const fullHeightPx = (appointmentDuration / ROW_INTERVAL_MINUTES) * ROW_HEIGHT_PX;
                                
                                // Calculate top offset within this row
                                const topOffset = ((fromTotal - rowStartMinutes) / ROW_INTERVAL_MINUTES) * ROW_HEIGHT_PX;
                                
                                const statusColor = getStatusColor(apt.status);
                                const isShortAppointment = fullHeightPx < 32;
                                const isDragging = draggedAppointmentId === apt._id;
                                return (
                                  <div
                                    key={apt._id}
                                    className={`absolute left-0.5 right-0.5 rounded shadow-sm border ${statusColor.bg} ${statusColor.text} ${statusColor.border} overflow-hidden transition-all hover:shadow-md hover:scale-[1.01] ${permissions.canUpdate ? "cursor-move" : "cursor-default"} ${isDragging ? "opacity-50" : ""}`}
                                    style={{
                                      top: `${topOffset + 1}px`,
                                      height: `${fullHeightPx - 2}px`,
                                      zIndex: isDragging ? 50 : 10,
                                    }}
                                    draggable={permissions.canUpdate}
                                    onDragStart={(e) => handleAppointmentDragStart(e, apt._id)}
                                    onDragEnd={handleAppointmentDragEnd}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const tooltipWidth = 200;
                                      const tooltipHeight = 300;
                                      const spacing = 8;
                                      
                                      // Calculate position relative to viewport
                                      let left = rect.right + spacing;
                                      let top = rect.top;
                                      
                                      // Check if tooltip would go off right edge
                                      if (left + tooltipWidth > window.innerWidth) {
                                        // Position to the left of the appointment
                                        left = rect.left - tooltipWidth - spacing;
                                      }
                                      
                                      // Check if tooltip would go off bottom edge
                                      if (top + tooltipHeight > window.innerHeight) {
                                        top = window.innerHeight - tooltipHeight - 10;
                                      }
                                      
                                      // Check if tooltip would go off top edge
                                      if (top < 10) {
                                        top = 10;
                                      }
                                      
                                      // Check if tooltip would go off left edge
                                      if (left < 10) {
                                        left = 10;
                                      }
                                      
                                      setHoveredAppointment({
                                        appointment: apt,
                                        position: {
                                          top,
                                          left,
                                        },
                                      });
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredAppointment(null);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    title={permissions.canUpdate ? "Drag to move appointment to another doctor or time slot" : "Appointment (no permission to move)"}
                                  >
                                    <div className="h-full flex flex-col justify-between p-1">
                                      <div className="flex items-start gap-1 min-w-0">
                                        <div className="flex-shrink-0 mt-0.5">
                                          <div className={`w-1 h-1 rounded-full ${statusColor.bg} ${statusColor.border} border`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="truncate font-bold text-[10px] sm:text-xs leading-tight">{apt.patientName}</p>
                                          {!isShortAppointment && apt.patientEmrNumber && (
                                            <p className="truncate text-[9px] opacity-85 mt-0.5 font-medium">EMR: {apt.patientEmrNumber}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-0.5 mt-auto">
                                        <Clock className="w-2 h-2 opacity-90 flex-shrink-0" />
                                        <p className="truncate text-[9px] font-semibold opacity-95 leading-tight">
                                          {formatTime(apt.fromTime)} - {formatTime(apt.toTime)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            : null}
                        </div>
                      );
                      } else {
                        const room = column.data;
                      const roomAppointments = getRoomAppointmentsForRow(room._id, slot.time);

                      return (
                        <div
                            key={`${slot.time}-room-${room._id}`}
                          className={`flex-1 min-w-[90px] sm:min-w-[100px] ${isLastColumn ? '' : 'border-r'} border-gray-200 dark:border-gray-300 relative bg-white dark:bg-gray-50`}
                          style={{ height: ROW_HEIGHT_PX }}
                        >
                          <div className="absolute left-0 right-0 top-1/2 border-t border-gray-200 dark:border-gray-700 pointer-events-none" />
                          <div className="flex flex-col h-full">
                            {[0, SLOT_INTERVAL_MINUTES].map((offset) => {
                              const subSlotTime = addMinutesToTime(slot.time, offset);
                              const subStartMinutes = rowStartMinutes + offset;
                              const subEndMinutes = subStartMinutes + SLOT_INTERVAL_MINUTES;
                              const isSubSlotOccupied = roomAppointments.some((apt) => {
                                const aptStart = timeStringToMinutes(apt.fromTime);
                                const aptEnd = timeStringToMinutes(apt.toTime);
                                return aptStart < subEndMinutes && aptEnd > subStartMinutes;
                              });
                              const slotWithinClosing =
                                lastBookableMinutes === null ||
                                subStartMinutes <= lastBookableMinutes;
                              const canBookSlot =
                                permissions.canCreate &&
                                !isPastDay &&
                                (!isToday || subStartMinutes >= currentMinutes) &&
                                slotWithinClosing &&
                                !isSubSlotOccupied;

                              return (
                                <div
                                  key={`${slot.time}-${room._id}-${offset}`}
                                  className={`flex-1 transition-all ${
                                    canBookSlot
                                      ? "cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-100 border-l-2 border-transparent hover:border-emerald-400 dark:hover:border-emerald-500"
                                      : isSubSlotOccupied
                                      ? "bg-gray-50 dark:bg-gray-100 cursor-not-allowed"
                                      : "bg-gray-50 dark:bg-gray-100 cursor-not-allowed"
                                  }`}
                                  style={{ height: SUB_SLOT_HEIGHT_PX }}
                                  title={
                                    !permissions.canCreate
                                      ? "You do not have permission to book appointments"
                                      : canBookSlot
                                      ? `Click to book appointment at ${minutesToDisplay(subStartMinutes)}`
                                      : isPastDay
                                      ? "Cannot book appointments for past dates"
                                      : slotWithinClosing
                                      ? "Cannot book past time slots"
                                      : "Cannot book beyond clinic closing time"
                                  }
                                  onClick={() => {
                                    // ✅ Check permission before opening booking modal
                                    if (!permissions.canCreate) {
                                      showErrorToast("You do not have permission to book appointments");
                                      return;
                                    }
                                    if (canBookSlot) {
                                      setBookingModal({
                                        isOpen: true,
                                        doctorId: "",
                                        doctorName: "",
                                        roomId: room._id,
                                        roomName: room.name,
                                        slotTime: subSlotTime,
                                        slotDisplayTime: minutesToDisplay(subStartMinutes),
                                        selectedDate,
                                        bookedFrom: "room",
                                      });
                                    }
                                  }}
                                />
                              );
                            })}
                          </div>

                          {/* ✅ Only show appointments if user has read permission */}
                          {permissions.canRead && roomAppointments.length > 0
                            ? roomAppointments.map((apt) => {
                                const fromTotal = timeStringToMinutes(apt.fromTime);
                                const toTotal = timeStringToMinutes(apt.toTime);
                                
                                // Only render appointment in the row where it starts
                                // Check if appointment starts in this row
                                const appointmentStartsInThisRow = fromTotal >= rowStartMinutes && fromTotal < rowStartMinutes + ROW_INTERVAL_MINUTES;
                                
                                if (!appointmentStartsInThisRow) {
                                  return null;
                                }
                                
                                // Calculate the full height of the appointment across all rows
                                const appointmentDuration = toTotal - fromTotal;
                                const fullHeightPx = (appointmentDuration / ROW_INTERVAL_MINUTES) * ROW_HEIGHT_PX;
                                
                                // Calculate top offset within this row
                                const topOffset = ((fromTotal - rowStartMinutes) / ROW_INTERVAL_MINUTES) * ROW_HEIGHT_PX;
                                
                                const statusColor = getStatusColor(apt.status);
                                const isShortAppointment = fullHeightPx < 32;
                                const isDragging = draggedAppointmentId === apt._id;
                                return (
                                  <div
                                    key={apt._id}
                                    className={`absolute left-0.5 right-0.5 rounded shadow-sm border ${statusColor.bg} ${statusColor.text} ${statusColor.border} overflow-hidden transition-all hover:shadow-md hover:scale-[1.01] ${permissions.canUpdate ? "cursor-move" : "cursor-default"} ${isDragging ? "opacity-50" : ""}`}
                                    style={{
                                      top: `${topOffset + 1}px`,
                                      height: `${fullHeightPx - 2}px`,
                                      zIndex: isDragging ? 50 : 10,
                                    }}
                                    draggable={permissions.canUpdate}
                                    onDragStart={(e) => handleAppointmentDragStart(e, apt._id)}
                                    onDragEnd={handleAppointmentDragEnd}
                                    onMouseEnter={(e) => {
                                      const rect = e.currentTarget.getBoundingClientRect();
                                      const tooltipWidth = 200;
                                      const tooltipHeight = 300;
                                      const spacing = 8;
                                      
                                      // Calculate position relative to viewport
                                      let left = rect.right + spacing;
                                      let top = rect.top;
                                      
                                      // Check if tooltip would go off right edge
                                      if (left + tooltipWidth > window.innerWidth) {
                                        // Position to the left of the appointment
                                        left = rect.left - tooltipWidth - spacing;
                                      }
                                      
                                      // Check if tooltip would go off bottom edge
                                      if (top + tooltipHeight > window.innerHeight) {
                                        top = window.innerHeight - tooltipHeight - 10;
                                      }
                                      
                                      // Check if tooltip would go off top edge
                                      if (top < 10) {
                                        top = 10;
                                      }
                                      
                                      // Check if tooltip would go off left edge
                                      if (left < 10) {
                                        left = 10;
                                      }
                                      
                                      setHoveredAppointment({
                                        appointment: apt,
                                        position: {
                                          top,
                                          left,
                                        },
                                      });
                                    }}
                                    onMouseLeave={() => {
                                      setHoveredAppointment(null);
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    title={permissions.canUpdate ? "Drag to move appointment to another doctor or time slot" : "Appointment (no permission to move)"}
                                  >
                                    <div className="h-full flex flex-col justify-between p-1">
                                      <div className="flex items-start gap-1 min-w-0">
                                        <div className="flex-shrink-0 mt-0.5">
                                          <div className={`w-1 h-1 rounded-full ${statusColor.bg} ${statusColor.border} border`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="truncate font-bold text-[10px] sm:text-xs leading-tight text-gray-900 dark:text-gray-900">{apt.patientName}</p>
                                          {!isShortAppointment && apt.patientEmrNumber && (
                                            <p className="truncate text-[9px] opacity-85 dark:opacity-85 mt-0.5 font-medium text-gray-700 dark:text-gray-800">EMR: {apt.patientEmrNumber}</p>
                                          )}
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-0.5 mt-auto">
                                        <Clock className="w-2 h-2 opacity-90 dark:opacity-90 flex-shrink-0 text-gray-700 dark:text-gray-800" />
                                        <p className="truncate text-[9px] font-semibold opacity-95 dark:opacity-95 leading-tight text-gray-700 dark:text-gray-800">
                                          {formatTime(apt.fromTime)} - {formatTime(apt.toTime)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            : null}
                        </div>
                      );
                      }
                    })}
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}
        {visibleDoctors.length === 0 && visibleRooms.length === 0 && (doctorStaff.length > 0 || rooms.length > 0) && (
          <div className="mt-2 rounded border border-dashed border-gray-300 dark:border-gray-300 bg-gray-50 dark:bg-gray-100 p-2 text-center text-xs text-gray-700 dark:text-gray-800">
            No doctor or room columns selected. Use the filters above to choose which schedules to display.
          </div>
        )}
      </div>

      {/* Custom Time Slot Modal */}
      {customTimeSlotModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setCustomTimeSlotModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-50 rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-900">Custom Time Slots</h2>
              <button
                onClick={() => setCustomTimeSlotModalOpen(false)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-200 rounded-lg transition-colors text-gray-900 dark:text-gray-900"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-700" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-800 mb-2">
                  Use Custom Time Slots
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustomTimeSlots}
                    onChange={(e) => {
                      setUseCustomTimeSlots(e.target.checked);
                      // Don't reset custom times when disabled - preserve them for when user re-enables
                      // The time slots will switch back to clinic timings, but custom values are preserved
                    }}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-purple-600 focus:ring-purple-500 dark:focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-800">Enable custom time slots</span>
                </label>
              </div>

              {useCustomTimeSlots && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-800 mb-2">
                      Start Time
                    </label>
                    <input
                      type="time"
                      value={customStartTime}
                      onChange={(e) => setCustomStartTime(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-800 mb-2">
                      End Time
                    </label>
                    <input
                      type="time"
                      value={customEndTime}
                      onChange={(e) => setCustomEndTime(e.target.value)}
                      className="w-full border border-gray-300 dark:border-gray-300 bg-white dark:bg-gray-100 text-gray-900 dark:text-gray-900 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 dark:focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-600"
                    />
                  </div>
                  {customStartTime && customEndTime && (
                    <div className="bg-purple-50 dark:bg-purple-100 border border-purple-200 dark:border-purple-300 rounded-lg p-3">
                      <p className="text-sm text-purple-700 dark:text-purple-800">
                        <strong>Preview:</strong> {formatTime(customStartTime)} - {formatTime(customEndTime)}
                      </p>
                    </div>
                  )}
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => {
                    if (useCustomTimeSlots && customStartTime && customEndTime) {
                      const startMinutes = timeStringToMinutes(customStartTime);
                      const endMinutes = timeStringToMinutes(customEndTime);
                      if (endMinutes > startMinutes) {
                        const slots = generateTimeSlots(customStartTime, customEndTime);
                        setTimeSlots(slots);
                        setClosingMinutes(endMinutes);
                        toast.success("Custom time slots applied", { duration: 2000 });
                        setCustomTimeSlotModalOpen(false);
                      } else {
                        showErrorToast("End time must be after start time");
                      }
                    } else {
                      setCustomTimeSlotModalOpen(false);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white rounded-lg hover:bg-purple-700 dark:hover:bg-purple-600 font-medium transition-colors"
                >
                  Apply
                </button>
                <button
                  onClick={() => setCustomTimeSlotModalOpen(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-200 text-gray-700 dark:text-gray-900 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-300 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Booking Modal */}
      <AppointmentBookingModal
        isOpen={bookingModal.isOpen}
        onClose={() => setBookingModal({ ...bookingModal, isOpen: false })}
        onSuccess={handleBookingSuccess}
        doctorId={bookingModal.doctorId}
        doctorName={bookingModal.doctorName}
        defaultRoomId={bookingModal.roomId}
        slotTime={bookingModal.slotTime}
        slotDisplayTime={bookingModal.slotDisplayTime}
        defaultDate={bookingModal.selectedDate}
        bookedFrom={bookingModal.bookedFrom}
        fromTime={bookingModal.fromTime}
        toTime={bookingModal.toTime}
        customTimeSlots={useCustomTimeSlots ? { startTime: customStartTime, endTime: customEndTime } : undefined}
        rooms={rooms}
        doctorStaff={doctorStaff}
        getAuthHeaders={getAuthHeaders}
      />

      {activeDoctorTooltip && (
        <div
          className="fixed z-[80] w-[180px] max-w-[85vw] -translate-x-1/2"
          style={{
            top: activeDoctorTooltip.position.top,
            left: activeDoctorTooltip.position.left,
          }}
        >
          <div className="rounded-lg bg-white dark:bg-gray-50 shadow-xl border border-purple-200 dark:border-purple-300 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 dark:from-purple-700 dark:to-purple-600 text-white text-[9px] font-bold px-2 py-1 flex items-center justify-center tracking-wide">
              Doctor Info
            </div>
            <div className="p-1.5 space-y-1.5">
              <div className="flex items-center gap-1.5 pb-1 border-b border-gray-100 dark:border-gray-200">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 dark:from-purple-600 dark:to-purple-700 flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0 shadow-sm">
                  {getInitials(activeDoctorTooltip.doctorName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[9px] font-bold text-gray-900 dark:text-gray-900 truncate leading-tight">
                    {activeDoctorTooltip.doctorName}
                  </p>
                  <p className="text-[8px] text-gray-600 dark:text-gray-700 truncate leading-tight mt-0.5">{tooltipDoctor?.email || "No email"}</p>
                </div>
              </div>

              <div className="space-y-0.5">
                {tooltipDeptLoading ? (
                  <div className="flex items-center gap-1 text-gray-700 dark:text-gray-800">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span className="text-[8px]">Loading...</span>
                  </div>
                ) : tooltipDeptError ? (
                  <p className="text-[8px] text-red-500 dark:text-red-400">{tooltipDeptError}</p>
                ) : tooltipDeptList && tooltipDeptList.length > 0 ? (
                  <div className="flex items-start gap-1">
                    <span className="text-[8px] font-bold text-gray-600 dark:text-gray-700 flex-shrink-0">Dept:</span>
                    <span className="text-[8px] font-medium text-gray-800 dark:text-gray-900 leading-tight">{tooltipDeptList.map((dept) => dept.name).join(", ")}</span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <span className="text-[8px] font-bold text-gray-600 dark:text-gray-700 flex-shrink-0">Dept:</span>
                    <span className="text-[8px] text-gray-500 dark:text-gray-600">Not assigned</span>
                  </div>
                )}
              </div>

              <div className="pt-0.5 border-t border-gray-100 dark:border-gray-200">
                {tooltipLoading ? (
                  <div className="flex gap-1 text-gray-700 dark:text-gray-800">
                    <Loader2 className="w-2.5 h-2.5 animate-spin" />
                    <span className="text-[8px]">Loading...</span>
                  </div>
                ) : tooltipError ? (
                  <p className="text-[8px] text-red-500 dark:text-red-400">{tooltipError}</p>
                ) : tooltipTreatments && tooltipTreatments.length > 0 ? (
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-0.5 custom-scrollbar">
                    {tooltipTreatments.map((treatment) => (
                      <div
                        key={treatment._id}
                        className="rounded-md border border-purple-100 dark:border-purple-200 bg-gradient-to-r from-purple-50 to-purple-100/50 dark:from-purple-50/30 dark:to-purple-100/20 p-1"
                      >
                        <p className="text-[8px] font-bold text-purple-900 dark:text-purple-900 mb-0.5 leading-tight">
                          {treatment.treatmentName}
                        </p>
                        {treatment.departmentName && (
                          <p className="text-[7px] text-gray-600 dark:text-gray-700 mb-0.5 leading-tight">
                            <span className="font-semibold">Dept:</span> {treatment.departmentName}
                          </p>
                        )}
                        {treatment.subcategories && treatment.subcategories.length > 0 && (
                          <p className="text-[7px] text-gray-700 dark:text-gray-800 leading-tight">
                            <span className="font-semibold">Types:</span> {treatment.subcategories.map((sub) => sub.name).join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-start gap-1">
                    <span className="text-[8px] font-bold text-gray-600 dark:text-gray-700 flex-shrink-0">Treatment:</span>
                    <span className="text-[8px] text-gray-500 dark:text-gray-600">Not assigned</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Appointment Hover Tooltip */}
      {hoveredAppointment && (
        <div
          className="fixed z-[90] w-[200px] max-w-[85vw] pointer-events-none"
          style={{
            top: hoveredAppointment.position.top,
            left: hoveredAppointment.position.left,
          }}
        >
          <div className="bg-white dark:bg-gray-50 rounded-md shadow-xl border border-gray-200 dark:border-gray-300 overflow-hidden">
            {/* Header */}
            <div className={`px-2 py-1 ${getStatusColor(hoveredAppointment.appointment.status).bg} ${getStatusColor(hoveredAppointment.appointment.status).text}`}>
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] font-bold truncate text-gray-900 dark:text-gray-900">{hoveredAppointment.appointment.patientName}</p>
                <span className="text-[9px] font-semibold opacity-90 dark:opacity-80 ml-1">{hoveredAppointment.appointment.status.toUpperCase()}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
              {/* Time */}
              <div className="flex items-center gap-1.5">
                <Clock className="w-2.5 h-2.5 text-gray-500 dark:text-gray-700 flex-shrink-0" />
                <p className="text-[10px] text-gray-700 dark:text-gray-800 font-semibold">
                  {formatTime(hoveredAppointment.appointment.fromTime)} - {formatTime(hoveredAppointment.appointment.toTime)}
                </p>
              </div>

              {/* Patient Info */}
              <div className="space-y-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-300">
                {hoveredAppointment.appointment.patientEmrNumber && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium">EMR:</span>
                    <span className="text-[10px] text-gray-700 dark:text-gray-800 truncate">{hoveredAppointment.appointment.patientEmrNumber}</span>
                  </div>
                )}
                {hoveredAppointment.appointment.patientInvoiceNumber && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium">Inv:</span>
                    <span className="text-[10px] text-gray-700 dark:text-gray-800 truncate">{hoveredAppointment.appointment.patientInvoiceNumber}</span>
                  </div>
                )}
                {hoveredAppointment.appointment.patientGender && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium">Gender:</span>
                    <span className="text-[10px] text-gray-700 dark:text-gray-800">{hoveredAppointment.appointment.patientGender}</span>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              {(hoveredAppointment.appointment.patientEmail || hoveredAppointment.appointment.patientMobileNumber) && (
                <div className="space-y-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-300">
                  {hoveredAppointment.appointment.patientMobileNumber && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium w-12 flex-shrink-0">Mobile:</span>
                      <span className="text-[10px] text-gray-700 dark:text-gray-800 truncate">{hoveredAppointment.appointment.patientMobileNumber}</span>
                    </div>
                  )}
                  {hoveredAppointment.appointment.patientEmail && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium w-12 flex-shrink-0">Email:</span>
                      <span className="text-[10px] text-gray-700 dark:text-gray-800 truncate">{hoveredAppointment.appointment.patientEmail}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Doctor & Room */}
              <div className="space-y-0.5 pt-0.5 border-t border-gray-100 dark:border-gray-300">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium w-12 flex-shrink-0">Dr:</span>
                  <span className="text-[10px] text-gray-700 dark:text-gray-800 truncate">{hoveredAppointment.appointment.doctorName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium w-12 flex-shrink-0">Room:</span>
                  <span className="text-[10px] text-gray-700 dark:text-gray-800 truncate">{hoveredAppointment.appointment.roomName}</span>
                </div>
              </div>

              {/* Follow Type */}
              {hoveredAppointment.appointment.followType && (
                <div className="pt-0.5 border-t border-gray-100 dark:border-gray-300">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium w-12 flex-shrink-0">Follow:</span>
                    <span className="text-[10px] text-gray-700 dark:text-gray-800">{hoveredAppointment.appointment.followType}</span>
                  </div>
                </div>
              )}

              {/* Referral */}
              {hoveredAppointment.appointment.referral && (
                <div className="pt-0.5 border-t border-gray-100 dark:border-gray-300">
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium w-12 flex-shrink-0">Ref:</span>
                    <span className="text-[10px] text-gray-700 dark:text-gray-800">{hoveredAppointment.appointment.referral}</span>
                  </div>
                </div>
              )}

              {/* Emergency */}
              {hoveredAppointment.appointment.emergency && (
                <div className="pt-0.5 border-t border-gray-100 dark:border-gray-300">
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] text-gray-700 dark:text-gray-800 font-medium w-12 flex-shrink-0">Emer:</span>
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">{hoveredAppointment.appointment.emergency}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              {hoveredAppointment.appointment.notes && (
                <div className="pt-0.5 border-t border-gray-100 dark:border-gray-300">
                  <p className="text-[9px] font-semibold text-gray-700 dark:text-gray-800 uppercase mb-0.5">Notes</p>
                  <p className="text-[10px] text-gray-700 dark:text-gray-800 leading-tight">{hoveredAppointment.appointment.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

AppointmentPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

export const AppointmentPageBase = AppointmentPage;

const ProtectedAppointmentPage: NextPageWithLayout = withClinicAuth(AppointmentPage);
ProtectedAppointmentPage.getLayout = AppointmentPage.getLayout;

export default ProtectedAppointmentPage;



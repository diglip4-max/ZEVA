"use client";
import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import type { NextPageWithLayout } from "../_app";
import { Loader2, Calendar, Clock, User } from "lucide-react";
import AppointmentBookingModal from "../../components/AppointmentBookingModal";
import { Toaster, toast } from "react-hot-toast";

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

function AppointmentPage({ contextOverride = null }: { contextOverride?: "clinic" | "agent" | null }) {
  const [routeContext, setRouteContext] = useState<"clinic" | "agent">(
    contextOverride || "clinic"
  );
  const [clinic, setClinic] = useState<ClinicData | null>(null);
  const [doctorStaff, setDoctorStaff] = useState<DoctorStaff[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [closingMinutes, setClosingMinutes] = useState<number | null>(null);
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
  const [doctorFilterOpen, setDoctorFilterOpen] = useState(false);
  const [roomFilterOpen, setRoomFilterOpen] = useState(false);
  const doctorFilterTouchedRef = useRef(false);
  const roomFilterTouchedRef = useRef(false);
  const doctorFilterRef = useRef<HTMLDivElement | null>(null);
  const roomFilterRef = useRef<HTMLDivElement | null>(null);
  const [hoveredAppointment, setHoveredAppointment] = useState<{
    appointment: Appointment;
    position: { top: number; left: number };
  } | null>(null);

  function getAuthHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token =
      routeContext === "agent"
        ? localStorage.getItem("agentToken") || sessionStorage.getItem("agentToken")
        : localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

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
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (err: any) {
      console.error("Error loading doctor treatments", err);
      const errorMsg = err.response?.data?.message || "Failed to load doctor details";
      setDoctorTreatmentsError((prev) => ({ ...prev, [doctorId]: errorMsg }));
      toast.error(errorMsg, { duration: 3000 });
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
        toast.error(errorMsg, { duration: 3000 });
      }
    } catch (err: any) {
      console.error("Error loading doctor departments", err);
      const errorMsg = err.response?.data?.message || "Unable to load departments";
      setDoctorDepartmentsError((prev) => ({ ...prev, [doctorId]: errorMsg }));
      toast.error(errorMsg, { duration: 3000 });
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
          } else {
            // Default: 6 AM to 6 PM
            const defaultStart = "06:00";
            const defaultEnd = "18:00";
            const slots = generateTimeSlots(defaultStart, defaultEnd);
            setTimeSlots(slots);
            setClosingMinutes(timeStringToMinutes(defaultEnd));
          }
          toast.success("Appointment schedule loaded successfully", { duration: 2000 });
        } else {
          const errorMsg = res.data.message || "Failed to load appointment data";
          setError(errorMsg);
          toast.error(errorMsg, { duration: 4000 });
        }
      } catch (err: any) {
        console.error("Error loading appointment data", err);
        const errorMsg = err.response?.data?.message || "Failed to load appointment data";
        setError(errorMsg);
        toast.error(errorMsg, { duration: 4000 });
      } finally {
        setLoading(false);
      }
    };

    loadAppointmentData();
  }, [routeContext]);

  useEffect(() => {
    setVisibleDoctorIds((prev) => {
      if (doctorStaff.length === 0) return [];
      if (!doctorFilterTouchedRef.current || prev.length === 0) {
        return doctorStaff.map((doc) => doc._id);
      }
      const doctorIdSet = new Set(doctorStaff.map((doc) => doc._id));
      return prev.filter((id) => doctorIdSet.has(id));
    });
  }, [doctorStaff]);

  useEffect(() => {
    setVisibleRoomIds((prev) => {
      if (rooms.length === 0) return [];
      if (!roomFilterTouchedRef.current || prev.length === 0) {
        return rooms.map((room) => room._id);
      }
      const roomIdSet = new Set(rooms.map((room) => room._id));
      return prev.filter((id) => roomIdSet.has(id));
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
  useEffect(() => {
    const loadAppointments = async () => {
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
          toast.error(res.data.message || "Failed to load appointments", { duration: 3000 });
        }
      } catch (err: any) {
        console.error("Error loading appointments", err);
        const errorMsg = err.response?.data?.message || "Failed to load appointments";
        toast.error(errorMsg, { duration: 3000 });
      }
    };

    if (selectedDate) {
      loadAppointments();
    }
  }, [selectedDate]);

  // Get initials for avatar
  const getInitials = (name: string): string => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleToggleDoctorVisibility = (doctorId: string) => {
    doctorFilterTouchedRef.current = true;
    setVisibleDoctorIds((prev) => {
      if (prev.includes(doctorId)) {
        return prev.filter((id) => id !== doctorId);
      }
      return [...prev, doctorId];
    });
  };

  const handleToggleRoomVisibility = (roomId: string) => {
    roomFilterTouchedRef.current = true;
    setVisibleRoomIds((prev) => {
      if (prev.includes(roomId)) {
        return prev.filter((id) => id !== roomId);
      }
      return [...prev, roomId];
    });
  };

  const handleSelectAllDoctors = () => {
    doctorFilterTouchedRef.current = true;
    setVisibleDoctorIds(doctorStaff.map((doc) => doc._id));
  };

  const handleClearDoctors = () => {
    doctorFilterTouchedRef.current = true;
    setVisibleDoctorIds([]);
  };

  const handleSelectAllRooms = () => {
    roomFilterTouchedRef.current = true;
    setVisibleRoomIds(rooms.map((room) => room._id));
  };

  const handleClearRooms = () => {
    roomFilterTouchedRef.current = true;
    setVisibleRoomIds([]);
  };

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
  const visibleDoctors = doctorStaff.filter((doc) => visibleDoctorIds.includes(doc._id));
  const visibleRooms = rooms.filter((room) => visibleRoomIds.includes(room._id));

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
          toast.error(res.data.message || "Failed to reload appointments", { duration: 3000 });
        }
      })
      .catch((err) => {
        console.error("Error reloading appointments", err);
        toast.error(err.response?.data?.message || "Failed to reload appointments", { duration: 3000 });
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-700">Loading appointment schedule...</p>
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
    <div className="p-3 sm:p-4 lg:p-5 space-y-3 sm:space-y-4 lg:space-y-5">
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
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-2 sm:p-3">
        <div className="flex flex-col gap-2 mb-2">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-gray-900">Appointment Schedule</h1>
              <p className="text-xs text-gray-700">
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
                  className="px-2 py-1 rounded border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  type="button"
                >
                  Prev
                </button>
                <button
                  onClick={() => {
                    setSelectedDate(new Date().toISOString().split("T")[0]);
                    toast.success("Switched to today", { duration: 2000 });
                  }}
                  className="px-2 py-1 rounded border border-gray-900 bg-gray-900 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
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
                  className="px-2 py-1 rounded border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  type="button"
                >
                  Next
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">Date</label>
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
                  className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-gray-900 focus:border-gray-900 transition-all"
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
                    onClick={() => setDoctorFilterOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  >
                    Doctors
                    <span className="text-[10px] text-gray-600">
                      ({visibleDoctorIds.length}/{doctorStaff.length})
                    </span>
                  </button>
                  {doctorFilterOpen && (
                    <div className="absolute z-40 mt-1 w-48 rounded border border-gray-200 bg-white p-2 shadow-lg">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-gray-700">
                        <span>Doctors</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800 text-[10px]"
                            onClick={handleSelectAllDoctors}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800 text-[10px]"
                            onClick={handleClearDoctors}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
                        {doctorStaff.map((doctor) => (
                          <label key={doctor._id} className="flex items-center gap-1.5 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={visibleDoctorIds.includes(doctor._id)}
                              onChange={() => handleToggleDoctorVisibility(doctor._id)}
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
                    onClick={() => setRoomFilterOpen((prev) => !prev)}
                    className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  >
                    Rooms
                    <span className="text-[10px] text-gray-600">
                      ({visibleRoomIds.length}/{rooms.length})
                    </span>
                  </button>
                  {roomFilterOpen && (
                    <div className="absolute z-40 mt-1 w-48 rounded border border-gray-200 bg-white p-2 shadow-lg">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-gray-700">
                        <span>Rooms</span>
                        <div className="flex gap-1.5">
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800 text-[10px]"
                            onClick={handleSelectAllRooms}
                          >
                            All
                          </button>
                          <button
                            type="button"
                            className="text-blue-600 hover:text-blue-800 text-[10px]"
                            onClick={handleClearRooms}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
                        {rooms.map((room) => (
                          <label key={room._id} className="flex items-center gap-1.5 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              className="h-3 w-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              checked={visibleRoomIds.includes(room._id)}
                              onChange={() => handleToggleRoomVisibility(room._id)}
                            />
                            <span className="truncate">{room.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {doctorStaff.length === 0 && rooms.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 mx-auto mb-2 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">
              👨‍⚕️
            </div>
            <p className="text-xs text-gray-700">No doctor staff or rooms available.</p>
            <p className="text-[10px] text-gray-700 mt-1">Add doctor staff and rooms to view their schedules.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded overflow-hidden bg-white">
            {/* Scrollable container */}
            <div className="overflow-x-auto max-h-[75vh] overflow-y-auto">
            {/* Header with doctor names and rooms */}
              <div className="flex bg-gray-50 border-b border-gray-200 sticky top-0 z-20 min-w-max">
                <div className="w-20 sm:w-24 flex-shrink-0 border-r border-gray-200 p-1 sm:p-1.5 bg-white sticky left-0 z-30">
                  <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-gray-900">
                    <Clock className="w-3 h-3" />
                  <span>Time</span>
                </div>
              </div>
              {/* Doctor columns */}
                {visibleDoctors.map((doctor) => (
                <div
                  key={doctor._id}
                    className="flex-1 min-w-[120px] sm:min-w-[140px] border-r border-gray-200 p-1 sm:p-1.5 relative bg-white"
                    onMouseEnter={(e) => handleDoctorMouseEnter(doctor, e)}
                    onMouseLeave={handleDoctorMouseLeave}
                >
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-semibold text-[10px] sm:text-xs flex-shrink-0">
                      {getInitials(doctor.name)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-semibold text-gray-900 truncate">{doctor.name}</p>
                    </div>
                  </div>
                </div>
              ))}
              {/* Room columns */}
                {visibleRooms.map((room) => (
                <div
                  key={room._id}
                    className="flex-1 min-w-[120px] sm:min-w-[140px] border-r border-gray-200 last:border-r-0 p-1 sm:p-1.5 bg-white"
                >
                    <div className="flex items-center gap-1.5">
                      <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-semibold text-[10px] sm:text-xs flex-shrink-0">
                      🏥
                    </div>
                    <div className="min-w-0">
                        <p className="text-[10px] sm:text-xs font-semibold text-gray-900 truncate">{room.name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Time slots grid */}
              <div className="min-w-max">
              {timeSlots.map((slot) => {
                const rowStartMinutes = timeStringToMinutes(slot.time);
                return (
                  <div key={slot.time} className="flex border-b border-gray-100 hover:bg-gray-50/50 transition-colors min-w-max">
                    {/* Time column */}
                    <div
                      className="w-20 sm:w-24 flex-shrink-0 border-r border-gray-200 p-1 sm:p-1.5 bg-white relative sticky left-0 z-10"
                      style={{ height: ROW_HEIGHT_PX }}
                    >
                      <p className="text-[10px] sm:text-xs font-semibold text-gray-900">{slot.displayTime}</p>
                      <div className="absolute left-0 right-0 top-1/2 border-t border-gray-200" />
                    </div>

                    {/* Doctor columns */}
                          {visibleDoctors.map((doctor) => {
                      const rowAppointments = getAppointmentsForRow(doctor._id, slot.time);

                      return (
                        <div
                          key={`${slot.time}-${doctor._id}`}
                          className="flex-1 min-w-[120px] sm:min-w-[140px] border-r border-gray-200 relative bg-white"
                          style={{ height: ROW_HEIGHT_PX }}
                        >
                          <div className="absolute left-0 right-0 top-1/2 border-t border-gray-200 pointer-events-none" />
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

                              return (
                                <div
                                  key={`${slot.time}-${doctor._id}-${offset}`}
                                  className={`flex-1 transition-all ${
                                    canBookSlot
                                      ? "cursor-pointer hover:bg-blue-50 border-l-2 border-transparent hover:border-blue-400"
                                      : isSubSlotOccupied
                                      ? "bg-gray-50 cursor-not-allowed"
                                      : "bg-gray-50 cursor-not-allowed"
                                  }`}
                                  style={{ height: SUB_SLOT_HEIGHT_PX }}
                                  title={
                                    canBookSlot
                                      ? `Click to book appointment at ${minutesToDisplay(subStartMinutes)}`
                                      : isPastDay
                                      ? "Cannot book appointments for past dates"
                                      : slotWithinClosing
                                      ? "Cannot book past time slots"
                                      : "Cannot book beyond clinic closing time"
                                  }
                                  onClick={() => {
                                    if (canBookSlot) {
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

                          {rowAppointments.length > 0
                            ? rowAppointments.map((apt) => {
                                const fromTotal = timeStringToMinutes(apt.fromTime);
                                const toTotal = timeStringToMinutes(apt.toTime);
                                const visibleStart = Math.max(fromTotal, rowStartMinutes);
                                const visibleEnd = Math.min(toTotal, rowStartMinutes + ROW_INTERVAL_MINUTES);
                                const topOffset =
                                  ((visibleStart - rowStartMinutes) / ROW_INTERVAL_MINUTES) *
                                  ROW_HEIGHT_PX;
                                const heightPx = Math.max(
                                  16,
                                  ((visibleEnd - visibleStart) / ROW_INTERVAL_MINUTES) * ROW_HEIGHT_PX
                                );
                                const statusColor = getStatusColor(apt.status);
                                const isShortAppointment = heightPx < 32;
                                return (
                                  <div
                                    key={apt._id}
                                    className={`absolute left-0.5 right-0.5 rounded shadow-sm border ${statusColor.bg} ${statusColor.text} ${statusColor.border} overflow-hidden transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer`}
                                    style={{
                                      top: `${topOffset + 1}px`,
                                      height: `${heightPx - 2}px`,
                                      zIndex: 10,
                                    }}
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
                    })}

                    {/* Room columns */}
                          {visibleRooms.map((room) => {
                      const roomAppointments = getRoomAppointmentsForRow(room._id, slot.time);

                      return (
                        <div
                          key={`${slot.time}-${room._id}`}
                          className="flex-1 min-w-[120px] sm:min-w-[140px] border-r border-gray-200 relative bg-white"
                          style={{ height: ROW_HEIGHT_PX }}
                        >
                          <div className="absolute left-0 right-0 top-1/2 border-t border-gray-200 pointer-events-none" />
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
                                !isPastDay &&
                                (!isToday || subStartMinutes >= currentMinutes) &&
                                slotWithinClosing &&
                                !isSubSlotOccupied;

                              return (
                                <div
                                  key={`${slot.time}-${room._id}-${offset}`}
                                  className={`flex-1 transition-all ${
                                    canBookSlot
                                      ? "cursor-pointer hover:bg-emerald-50 border-l-2 border-transparent hover:border-emerald-400"
                                      : isSubSlotOccupied
                                      ? "bg-gray-50 cursor-not-allowed"
                                      : "bg-gray-50 cursor-not-allowed"
                                  }`}
                                  style={{ height: SUB_SLOT_HEIGHT_PX }}
                                  title={
                                    canBookSlot
                                      ? `Click to book appointment at ${minutesToDisplay(subStartMinutes)}`
                                      : isPastDay
                                      ? "Cannot book appointments for past dates"
                                      : slotWithinClosing
                                      ? "Cannot book past time slots"
                                      : "Cannot book beyond clinic closing time"
                                  }
                                  onClick={() => {
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

                          {roomAppointments.length > 0
                            ? roomAppointments.map((apt) => {
                                const fromTotal = timeStringToMinutes(apt.fromTime);
                                const toTotal = timeStringToMinutes(apt.toTime);
                                const visibleStart = Math.max(fromTotal, rowStartMinutes);
                                const visibleEnd = Math.min(toTotal, rowStartMinutes + ROW_INTERVAL_MINUTES);
                                const topOffset =
                                  ((visibleStart - rowStartMinutes) / ROW_INTERVAL_MINUTES) *
                                  ROW_HEIGHT_PX;
                                const heightPx = Math.max(
                                  16,
                                  ((visibleEnd - visibleStart) / ROW_INTERVAL_MINUTES) *
                                    ROW_HEIGHT_PX
                                );
                                const statusColor = getStatusColor(apt.status);
                                const isShortAppointment = heightPx < 32;
                                return (
                                  <div
                                    key={apt._id}
                                    className={`absolute left-0.5 right-0.5 rounded shadow-sm border ${statusColor.bg} ${statusColor.text} ${statusColor.border} overflow-hidden transition-all hover:shadow-md hover:scale-[1.01] cursor-pointer`}
                                    style={{
                                      top: `${topOffset + 1}px`,
                                      height: `${heightPx - 2}px`,
                                      zIndex: 10,
                                    }}
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
                    })}
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}
        {visibleDoctors.length === 0 && visibleRooms.length === 0 && (doctorStaff.length > 0 || rooms.length > 0) && (
          <div className="mt-2 rounded border border-dashed border-gray-300 bg-gray-50 p-2 text-center text-xs text-gray-700">
            No doctor or room columns selected. Use the filters above to choose which schedules to display.
          </div>
        )}
      </div>

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
        rooms={rooms}
        doctorStaff={doctorStaff}
        getAuthHeaders={getAuthHeaders}
      />

      {activeDoctorTooltip && (
        <div
          className="fixed z-[80] w-[260px] max-w-[85vw] -translate-x-1/2"
          style={{
            top: activeDoctorTooltip.position.top,
            left: activeDoctorTooltip.position.left,
          }}
        >
          <div className="rounded-xl bg-white shadow-2xl border border-purple-100 overflow-hidden">
            <div className="bg-purple-600 text-white text-xs font-semibold px-3 py-2 flex items-center gap-2 tracking-wide">
              Doctor Information
            </div>
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-semibold text-base">
                  {getInitials(activeDoctorTooltip.doctorName)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    {activeDoctorTooltip.doctorName}
                  </p>
                  <p className="text-xs text-gray-700">{tooltipDoctor?.email || "No email available"}</p>
                </div>
              </div>

              <div className="space-y-1 text-xs text-gray-700">
                <p className="font-semibold text-gray-900 text-[11px] uppercase tracking-[0.2em]">
                  Departments
                </p>
                {tooltipDeptLoading ? (
                  <div className="flex items-center gap-2 text-gray-700">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading...
                  </div>
                ) : tooltipDeptError ? (
                  <p className="text-xs text-red-500">{tooltipDeptError}</p>
                ) : tooltipDeptList && tooltipDeptList.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {tooltipDeptList.map((dept) => (
                      <span
                        key={dept._id}
                        className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-[11px] text-gray-700"
                      >
                        {dept.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-700">Not assigned</p>
                )}
              </div>

              <div>
                <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-[0.2em] mb-1.5">
                  Treatments
                </p>
                {tooltipLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-700">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading treatments...
                  </div>
                ) : tooltipError ? (
                  <p className="text-xs text-red-500">{tooltipError}</p>
                ) : tooltipTreatments && tooltipTreatments.length > 0 ? (
                  <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                    {tooltipTreatments.map((treatment) => (
                      <div
                        key={treatment._id}
                        className="rounded-lg border border-gray-100 bg-gray-50/60 p-2.5"
                      >
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {treatment.treatmentName}
                        </p>
                        {treatment.departmentName && (
                          <p className="text-xs text-gray-700 mt-0.5">
                            Department: <span className="font-medium">{treatment.departmentName}</span>
                          </p>
                        )}
                        {treatment.subcategories && treatment.subcategories.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {treatment.subcategories.map((sub, idx) => (
                              <span
                                key={sub.slug || `${treatment._id}-${idx}`}
                                className="px-2 py-0.5 rounded-full bg-white border border-gray-200 text-[11px] text-gray-700"
                              >
                                {sub.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-700">No treatments assigned yet.</p>
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
          <div className="bg-white rounded-md shadow-xl border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className={`px-2 py-1 ${getStatusColor(hoveredAppointment.appointment.status).bg} ${getStatusColor(hoveredAppointment.appointment.status).text}`}>
              <div className="flex items-center justify-between gap-1">
                <p className="text-[10px] font-bold truncate">{hoveredAppointment.appointment.patientName}</p>
                <span className="text-[9px] font-semibold opacity-90 ml-1">{hoveredAppointment.appointment.status.toUpperCase()}</span>
              </div>
            </div>

            {/* Content */}
            <div className="p-2 space-y-1 max-h-[300px] overflow-y-auto">
              {/* Time */}
              <div className="flex items-center gap-1.5">
                <Clock className="w-2.5 h-2.5 text-gray-500 flex-shrink-0" />
                <p className="text-[10px] text-gray-700 font-semibold">
                  {formatTime(hoveredAppointment.appointment.fromTime)} - {formatTime(hoveredAppointment.appointment.toTime)}
                </p>
              </div>

              {/* Patient Info */}
              <div className="space-y-0.5 pt-0.5 border-t border-gray-100">
                {hoveredAppointment.appointment.patientEmrNumber && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-600 font-medium">EMR:</span>
                    <span className="text-[10px] text-gray-700 truncate">{hoveredAppointment.appointment.patientEmrNumber}</span>
                  </div>
                )}
                {hoveredAppointment.appointment.patientInvoiceNumber && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-600 font-medium">Inv:</span>
                    <span className="text-[10px] text-gray-700 truncate">{hoveredAppointment.appointment.patientInvoiceNumber}</span>
                  </div>
                )}
                {hoveredAppointment.appointment.patientGender && (
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-600 font-medium">Gender:</span>
                    <span className="text-[10px] text-gray-700">{hoveredAppointment.appointment.patientGender}</span>
                  </div>
                )}
              </div>

              {/* Contact Info */}
              {(hoveredAppointment.appointment.patientEmail || hoveredAppointment.appointment.patientMobileNumber) && (
                <div className="space-y-0.5 pt-0.5 border-t border-gray-100">
                  {hoveredAppointment.appointment.patientMobileNumber && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-600 font-medium w-12 flex-shrink-0">Mobile:</span>
                      <span className="text-[10px] text-gray-700 truncate">{hoveredAppointment.appointment.patientMobileNumber}</span>
                    </div>
                  )}
                  {hoveredAppointment.appointment.patientEmail && (
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] text-gray-600 font-medium w-12 flex-shrink-0">Email:</span>
                      <span className="text-[10px] text-gray-700 truncate">{hoveredAppointment.appointment.patientEmail}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Doctor & Room */}
              <div className="space-y-0.5 pt-0.5 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-600 font-medium w-12 flex-shrink-0">Dr:</span>
                  <span className="text-[10px] text-gray-700 truncate">{hoveredAppointment.appointment.doctorName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-gray-600 font-medium w-12 flex-shrink-0">Room:</span>
                  <span className="text-[10px] text-gray-700 truncate">{hoveredAppointment.appointment.roomName}</span>
                </div>
              </div>

              {/* Follow Type */}
              {hoveredAppointment.appointment.followType && (
                <div className="pt-0.5 border-t border-gray-100">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-gray-600 font-medium w-12 flex-shrink-0">Follow:</span>
                    <span className="text-[10px] text-gray-700">{hoveredAppointment.appointment.followType}</span>
                  </div>
                </div>
              )}

              {/* Referral */}
              {hoveredAppointment.appointment.referral && (
                <div className="pt-0.5 border-t border-gray-100">
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] text-gray-600 font-medium w-12 flex-shrink-0">Ref:</span>
                    <span className="text-[10px] text-gray-700">{hoveredAppointment.appointment.referral}</span>
                  </div>
                </div>
              )}

              {/* Emergency */}
              {hoveredAppointment.appointment.emergency && (
                <div className="pt-0.5 border-t border-gray-100">
                  <div className="flex items-start gap-1">
                    <span className="text-[9px] text-gray-600 font-medium w-12 flex-shrink-0">Emer:</span>
                    <span className="text-[10px] text-red-600 font-semibold">{hoveredAppointment.appointment.emergency}</span>
                  </div>
                </div>
              )}

              {/* Notes */}
              {hoveredAppointment.appointment.notes && (
                <div className="pt-0.5 border-t border-gray-100">
                  <p className="text-[9px] font-semibold text-gray-600 uppercase mb-0.5">Notes</p>
                  <p className="text-[10px] text-gray-700 leading-tight">{hoveredAppointment.appointment.notes}</p>
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



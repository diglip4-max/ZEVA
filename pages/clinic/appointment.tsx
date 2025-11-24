"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import type { NextPageWithLayout } from "../_app";
import { Loader2, Calendar, Clock } from "lucide-react";
import AppointmentBookingModal from "../../components/AppointmentBookingModal";

interface DoctorStaff {
  _id: string;
  name: string;
  email: string;
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
const ROW_HEIGHT_PX = 64;
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

function AppointmentPage() {
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

  function getAuthHeaders(): Record<string, string> {
    if (typeof window === "undefined") return {};
    const token = localStorage.getItem("clinicToken") || sessionStorage.getItem("clinicToken");
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }

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
        } else {
          setError(res.data.message || "Failed to load appointment data");
        }
      } catch (err: any) {
        console.error("Error loading appointment data", err);
        setError(err.response?.data?.message || "Failed to load appointment data");
      } finally {
        setLoading(false);
      }
    };

    loadAppointmentData();
  }, []);

  // Fetch appointments when date changes
  useEffect(() => {
    const loadAppointments = async () => {
      try {
        const res = await axios.get(`/api/clinic/appointments?date=${selectedDate}`, {
          headers: getAuthHeaders(),
        });

        if (res.data.success) {
          setAppointments(res.data.appointments || []);
        }
      } catch (err: any) {
        console.error("Error loading appointments", err);
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

  const handleBookingSuccess = () => {
    // Reload appointments
    axios
      .get(`/api/clinic/appointments?date=${selectedDate}`, {
        headers: getAuthHeaders(),
      })
      .then((res) => {
        if (res.data.success) {
          const appointmentsData = res.data.appointments || [];
          // Debug: Log bookedFrom values after reload
          console.log("=== RELOADED APPOINTMENTS AFTER BOOKING ===");
          appointmentsData.forEach((apt: Appointment) => {
            console.log(`Appointment ${apt._id}: bookedFrom="${apt.bookedFrom}", doctorId="${apt.doctorId}", roomId="${apt.roomId}"`);
          });
          console.log("============================================");
          setAppointments(appointmentsData);
        }
      })
      .catch((err) => {
        console.error("Error reloading appointments", err);
      });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading appointment schedule...</p>
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col gap-1 mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Appointment Schedule</h1>
              <p className="text-sm text-gray-500">
                {clinic?.name} • {clinic?.timings || "No timings set"}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const current = new Date(selectedDate);
                    current.setDate(current.getDate() - 1);
                    setSelectedDate(current.toISOString().split("T")[0]);
                  }}
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  Previous
                </button>
                <button
                  onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
                  className="px-3 py-2 rounded-lg border border-blue-600 text-blue-600 hover:bg-blue-50"
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
                  className="px-3 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  Next
                </button>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {doctorStaff.length === 0 && rooms.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 text-xl">
              👨‍⚕️
            </div>
            <p className="text-gray-600">No doctor staff or rooms available.</p>
            <p className="text-sm text-gray-500 mt-2">Add doctor staff and rooms to view their schedules.</p>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            {/* Header with doctor names and rooms */}
            <div className="flex bg-gray-50 border-b border-gray-200">
              <div className="w-32 flex-shrink-0 border-r border-gray-200 p-3">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Clock className="w-4 h-4" />
                  <span>Time</span>
                </div>
              </div>
              {/* Doctor columns */}
              {doctorStaff.map((doctor) => (
                <div
                  key={doctor._id}
                  className="flex-1 min-w-[180px] border-r border-gray-200 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm flex-shrink-0">
                      {getInitials(doctor.name)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{doctor.name}</p>
                    </div>
                  </div>
                </div>
              ))}
              {/* Room columns */}
              {rooms.map((room) => (
                <div
                  key={room._id}
                  className="flex-1 min-w-[180px] border-r border-gray-200 last:border-r-0 p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-semibold text-sm flex-shrink-0">
                      🏥
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{room.name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Time slots grid */}
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              {timeSlots.map((slot) => {
                const rowStartMinutes = timeStringToMinutes(slot.time);
                return (
                  <div key={slot.time} className="flex border-b border-gray-100">
                    {/* Time column */}
                    <div
                      className="w-32 flex-shrink-0 border-r border-gray-200 p-3 bg-gray-50 relative"
                      style={{ height: ROW_HEIGHT_PX }}
                    >
                      <p className="text-sm font-medium text-gray-700">{slot.displayTime}</p>
                      <div className="absolute left-0 right-0 top-1/2 border-t border-blue-100" />
                    </div>

                    {/* Doctor columns */}
                    {doctorStaff.map((doctor) => {
                      const rowAppointments = getAppointmentsForRow(doctor._id, slot.time);

                      return (
                        <div
                          key={`${slot.time}-${doctor._id}`}
                          className="flex-1 min-w-[180px] border-r border-gray-200 relative"
                          style={{ height: ROW_HEIGHT_PX }}
                        >
                          <div className="absolute left-0 right-0 top-1/2 border-t border-blue-100 pointer-events-none" />
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
                                  className={`flex-1 transition-colors ${
                                    canBookSlot
                                      ? "cursor-pointer hover:bg-blue-50"
                                      : isSubSlotOccupied
                                      ? "bg-purple-50 text-purple-400 cursor-not-allowed"
                                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  }`}
                                  style={{ height: SUB_SLOT_HEIGHT_PX }}
                                  title={
                                    canBookSlot
                                      ? undefined
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
                                        bookedFrom: "doctor", // Mark as booked from doctor column
                                      });
                                    }
                                  }}
                                />
                              );
                            })}
                          </div>

                          {rowAppointments.length > 0
                            ? rowAppointments.map((apt) => {
                                const tooltip = [
                                  `Patient: ${apt.patientName}`,
                                  `Doctor: ${apt.doctorName}`,
                                  `Room: ${apt.roomName}`,
                                  `Status: ${apt.status}`,
                                  `Follow: ${apt.followType}`,
                                  `Time: ${formatTime(apt.fromTime)} - ${formatTime(apt.toTime)}`,
                                  apt.referral ? `Referral: ${apt.referral}` : "",
                                  apt.emergency ? `Emergency: ${apt.emergency}` : "",
                                  apt.notes ? `Notes: ${apt.notes}` : "",
                                ]
                                  .filter(Boolean)
                                  .join("\n");
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
                                const statusColors = {
                                  booked: "bg-purple-500",
                                  enquiry: "bg-yellow-500",
                                  discharge: "bg-green-500",
                                };
                                return (
                                  <div
                                    key={apt._id}
                                    className={`absolute left-1 right-1 rounded px-2 py-1 text-white text-xs font-medium ${
                                      statusColors[apt.status as keyof typeof statusColors] ||
                                      "bg-purple-500"
                                    }`}
                                    style={{
                                      top: `${topOffset + 4}px`,
                                      height: `${heightPx - 8}px`,
                                      zIndex: 10,
                                    }}
                                    title={tooltip}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <p className="truncate font-semibold">{apt.patientName}</p>
                                  </div>
                                );
                              })
                            : null}
                        </div>
                      );
                    })}

                    {/* Room columns */}
                    {rooms.map((room) => {
                      const roomAppointments = getRoomAppointmentsForRow(room._id, slot.time);

                      return (
                        <div
                          key={`${slot.time}-${room._id}`}
                          className="flex-1 min-w-[180px] border-r border-gray-200 relative"
                          style={{ height: ROW_HEIGHT_PX }}
                        >
                          <div className="absolute left-0 right-0 top-1/2 border-t border-blue-100 pointer-events-none" />
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
                                  className={`flex-1 transition-colors ${
                                    canBookSlot
                                      ? "cursor-pointer hover:bg-green-50"
                                      : isSubSlotOccupied
                                      ? "bg-purple-50 text-purple-400 cursor-not-allowed"
                                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                  }`}
                                  style={{ height: SUB_SLOT_HEIGHT_PX }}
                                  title={
                                    canBookSlot
                                      ? undefined
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
                                        bookedFrom: "room", // Mark as booked from room column
                                      });
                                    }
                                  }}
                                />
                              );
                            })}
                          </div>

                          {roomAppointments.length > 0
                            ? roomAppointments.map((apt) => {
                                const tooltip = [
                                  `Patient: ${apt.patientName}`,
                                  `Doctor: ${apt.doctorName}`,
                                  `Room: ${apt.roomName}`,
                                  `Status: ${apt.status}`,
                                  `Follow: ${apt.followType}`,
                                  `Time: ${formatTime(apt.fromTime)} - ${formatTime(apt.toTime)}`,
                                  apt.referral ? `Referral: ${apt.referral}` : "",
                                  apt.emergency ? `Emergency: ${apt.emergency}` : "",
                                  apt.notes ? `Notes: ${apt.notes}` : "",
                                ]
                                  .filter(Boolean)
                                  .join("\n");
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
                                const statusColors = {
                                  booked: "bg-purple-500",
                                  enquiry: "bg-yellow-500",
                                  discharge: "bg-green-500",
                                };
                                return (
                                  <div
                                    key={apt._id}
                                    className={`absolute left-1 right-1 rounded px-2 py-1 text-white text-xs font-medium ${
                                      statusColors[apt.status as keyof typeof statusColors] ||
                                      "bg-purple-500"
                                    }`}
                                    style={{
                                      top: `${topOffset + 4}px`,
                                      height: `${heightPx - 8}px`,
                                      zIndex: 10,
                                    }}
                                    title={tooltip}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                  >
                                    <p className="truncate font-semibold">{apt.patientName}</p>
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
    </div>
  );
}

AppointmentPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedAppointmentPage: NextPageWithLayout = withClinicAuth(AppointmentPage);
ProtectedAppointmentPage.getLayout = AppointmentPage.getLayout;

export default ProtectedAppointmentPage;


"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Search, Plus, Loader2, Calendar, Clock, User, Building2, Stethoscope, AlertCircle } from "lucide-react";

interface AppointmentBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  doctorId: string;
  doctorName: string;
  slotTime: string;
  slotDisplayTime: string;
  defaultDate: string;
  defaultRoomId?: string;
  bookedFrom?: "doctor" | "room"; // Track which column the appointment is being booked from
  fromTime?: string; // For drag selection - start time
  toTime?: string; // For drag selection - end time
  customTimeSlots?: { startTime: string; endTime: string }; // Custom time slot selection
  rooms: Array<{ _id: string; name: string }>;
  doctorStaff: Array<{ _id: string; name: string; email?: string }>;
  getAuthHeaders: () => Record<string, string>;
}

interface Patient {
  _id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  mobileNumber: string;
  email: string;
  emrNumber: string;
  gender: string;
}

interface AddPatientForm {
  emrNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
  email: string;
  mobileNumber: string;
  referredBy: string;
  patientType: string;
}

interface DoctorDepartment {
  _id: string;
  name: string;
}

export default function AppointmentBookingModal({
  isOpen,
  onClose,
  onSuccess,
  doctorId,
  doctorName,
  slotTime,
  slotDisplayTime,
  defaultDate,
  defaultRoomId,
  bookedFrom, // No default - use the prop value directly
  customTimeSlots,
  fromTime: propFromTime,
  toTime: propToTime,
  rooms,
  doctorStaff,
  getAuthHeaders,
}: AppointmentBookingModalProps) {
  // Debug: Log when component receives props
  console.log("AppointmentBookingModal - Received props:", {
    bookedFrom,
    doctorId,
    defaultRoomId,
    isOpen
  });

  const [roomId, setRoomId] = useState<string>(defaultRoomId || "");
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(doctorId || "");
  const [status, setStatus] = useState<string>("booked");
  // Use useRef to capture bookedFrom when modal opens - this ensures it doesn't change
  const bookedFromRef = React.useRef<"doctor" | "room">("doctor");
  
  // Initialize bookedFrom from prop - this will be updated in useEffect when modal opens
  const [currentBookedFrom, setCurrentBookedFrom] = useState<"doctor" | "room">(() => {
    // Use the prop value if available, otherwise default based on whether roomId or doctorId is set
    console.log("Initializing currentBookedFrom - bookedFrom prop:", bookedFrom);
    if (bookedFrom === "room" || bookedFrom === "doctor") {
      bookedFromRef.current = bookedFrom;
      return bookedFrom;
    }
    if (defaultRoomId && !doctorId) {
      bookedFromRef.current = "room";
      return "room";
    }
    bookedFromRef.current = "doctor";
    return "doctor";
  });
  const [patientSearch, setPatientSearch] = useState<string>("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [addPatientForm, setAddPatientForm] = useState<AddPatientForm>({
    emrNumber: "",
    firstName: "",
    lastName: "",
    gender: "",
    email: "",
    mobileNumber: "",
    referredBy: "",
    patientType: "New",
  });
  const [followType, setFollowType] = useState<string>("first time");
  const [startDate, setStartDate] = useState<string>(defaultDate || new Date().toISOString().split("T")[0]);

  const SLOT_INTERVAL_MINUTES = 15;

  const calculateEndTime = (time: string) => {
    if (!time) return "";
    const [hour, min] = time.split(":").map(Number);
    const totalMinutes = hour * 60 + min + SLOT_INTERVAL_MINUTES;
    const newHour = Math.floor(totalMinutes / 60);
    const newMin = totalMinutes % 60;
    return `${String(newHour).padStart(2, "0")}:${String(newMin).padStart(2, "0")}`;
  };

  const [fromTime, setFromTime] = useState<string>(slotTime);
  const [toTime, setToTime] = useState<string>(calculateEndTime(slotTime));
  const [referral, setReferral] = useState<string>("direct");
  const [emergency, setEmergency] = useState<string>("no");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [addingPatient, setAddingPatient] = useState(false);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [doctorDepartments, setDoctorDepartments] = useState<DoctorDepartment[]>([]);
  const [doctorDeptLoading, setDoctorDeptLoading] = useState(false);
  const [doctorDeptError, setDoctorDeptError] = useState("");

  // Whenever the selected slot changes (or modal reopens), sync the times
  useEffect(() => {
    if (isOpen) {
      // Use drag-selected times if available, otherwise use slotTime
      if (propFromTime && propToTime) {
        setFromTime(propFromTime);
        setToTime(propToTime);
      } else {
        setFromTime(slotTime);
        setToTime(calculateEndTime(slotTime));
      }
      setStartDate(defaultDate || new Date().toISOString().split("T")[0]);
      setSelectedDoctorId(doctorId || "");
      setRoomId(defaultRoomId || "");
      // Always update bookedFrom from prop when modal opens - this ensures it's correct
      // CRITICAL: Use the prop value directly if it's explicitly "room" or "doctor"
      let newBookedFrom: "doctor" | "room";
      if (bookedFrom === "room") {
        newBookedFrom = "room";
      } else if (bookedFrom === "doctor") {
        newBookedFrom = "doctor";
      } else {
        // Fallback: infer from context
        newBookedFrom = (defaultRoomId && !doctorId) ? "room" : "doctor";
      }
      // Update both state and ref to ensure we have the correct value
      bookedFromRef.current = newBookedFrom;
      console.log("=== MODAL OPENED - UPDATING bookedFrom ===");
      console.log("Prop bookedFrom:", bookedFrom);
      console.log("Calculated newBookedFrom:", newBookedFrom);
      console.log("Updated bookedFromRef.current to:", bookedFromRef.current);
      console.log("defaultRoomId:", defaultRoomId, "doctorId:", doctorId);
      console.log("==========================================");
      setCurrentBookedFrom(newBookedFrom);
    }
  }, [slotTime, isOpen, defaultDate, doctorId, defaultRoomId, bookedFrom, propFromTime, propToTime]);

  // Search patients
  useEffect(() => {
    if (patientSearch.trim().length >= 2) {
      const searchTimeout = setTimeout(() => {
        searchPatients();
      }, 300);
      return () => clearTimeout(searchTimeout);
    } else {
      setSearchResults([]);
    }
  }, [patientSearch]);

  const searchPatients = async () => {
    try {
      setSearching(true);
      const res = await axios.get(`/api/clinic/search-patients?search=${encodeURIComponent(patientSearch)}`, {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        setSearchResults(res.data.patients || []);
      }
    } catch (err: any) {
      console.error("Error searching patients:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleFromTimeChange = (value: string) => {
    setFromTime(value);
    setToTime(calculateEndTime(value));
    setFieldErrors((prev) => ({ ...prev, fromTime: "", toTime: "" }));
  };

  const handleAddPatient = async () => {
    if (!addPatientForm.firstName || !addPatientForm.gender || !addPatientForm.mobileNumber) {
      setError("Please fill all required fields: First Name, Gender, and Mobile Number");
      return;
    }

    try {
      setAddingPatient(true);
      setError("");
      const res = await axios.post(
        "/api/clinic/add-patient",
        addPatientForm,
        {
          headers: getAuthHeaders(),
        }
      );

      if (res.data.success) {
        setSelectedPatient(res.data.patient);
        setShowAddPatient(false);
        setPatientSearch(res.data.patient.fullName);
        setAddPatientForm({
          emrNumber: "",
          firstName: "",
          lastName: "",
          gender: "",
          email: "",
          mobileNumber: "",
          referredBy: "",
          patientType: "New",
        });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to add patient");
    } finally {
      setAddingPatient(false);
    }
  };

  const fetchDoctorDepartments = async (targetDoctorId: string) => {
    if (!targetDoctorId) {
      setDoctorDepartments([]);
      return;
    }
    try {
      setDoctorDeptLoading(true);
      setDoctorDeptError("");
      const res = await axios.get(`/api/clinic/doctor-departments?doctorStaffId=${targetDoctorId}`, {
        headers: getAuthHeaders(),
      });
      if (res.data.success) {
        setDoctorDepartments(res.data.departments || []);
      } else {
        setDoctorDeptError(res.data.message || "Failed to load departments");
        setDoctorDepartments([]);
      }
    } catch (err: any) {
      console.error("Error loading doctor departments", err);
      setDoctorDeptError(err.response?.data?.message || "Failed to load departments");
      setDoctorDepartments([]);
    } finally {
      setDoctorDeptLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && selectedDoctorId) {
      fetchDoctorDepartments(selectedDoctorId);
    }
  }, [isOpen, selectedDoctorId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setError("");
    setFieldErrors({});

    // Client-side validation
    const clientErrors: Record<string, string> = {};
    if (!selectedPatient) {
      clientErrors.patientId = "Please select a patient";
    }
    if (!roomId) {
      clientErrors.roomId = "Please select a room";
    }
    if (!selectedDoctorId) {
      clientErrors.doctorId = "Please select a doctor";
    }
    if (!status) {
      clientErrors.status = "Please select a status";
    }
    if (!followType) {
      clientErrors.followType = "Please select a follow type";
    }
    if (!startDate) {
      clientErrors.startDate = "Please select a start date";
    }
    if (!fromTime) {
      clientErrors.fromTime = "Please select a from time";
    }
    if (!toTime) {
      clientErrors.toTime = "Please select a to time";
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      setError("Please fill all required fields");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setFieldErrors({});

      // Determine the final bookedFrom value - prioritize in this order: ref > prop > state > context
      // The ref ensures we have the value that was set when the modal opened, even if prop changes
      let finalBookedFrom: "doctor" | "room";
      
      // Debug: Log all values first
      console.log("=== APPOINTMENT BOOKING DEBUG ===");
      console.log("Ref bookedFromRef.current:", bookedFromRef.current);
      console.log("Prop bookedFrom:", bookedFrom, "Type:", typeof bookedFrom);
      console.log("Prop bookedFrom === 'room':", bookedFrom === "room");
      console.log("Prop bookedFrom === 'doctor':", bookedFrom === "doctor");
      console.log("State currentBookedFrom:", currentBookedFrom);
      console.log("defaultRoomId:", defaultRoomId);
      console.log("doctorId prop:", doctorId);
      console.log("selectedDoctorId state:", selectedDoctorId);
      
      // CRITICAL: Check ref first (captured when modal opened)
      if (bookedFromRef.current === "room") {
        finalBookedFrom = "room";
        console.log("✓ Using 'room' from ref (captured when modal opened)");
      } else if (bookedFromRef.current === "doctor") {
        finalBookedFrom = "doctor";
        console.log("✓ Using 'doctor' from ref (captured when modal opened)");
      }
      // Then check prop
      else if (bookedFrom === "room") {
        finalBookedFrom = "room";
        console.log("✓ Using 'room' from prop");
      } else if (bookedFrom === "doctor") {
        finalBookedFrom = "doctor";
        console.log("✓ Using 'doctor' from prop");
      } 
      // Fallback to state if prop is not explicitly set
      else if (currentBookedFrom === "room" || currentBookedFrom === "doctor") {
        finalBookedFrom = currentBookedFrom;
        console.log("⚠ Using state value:", currentBookedFrom);
      }
      // Last resort: infer from context
      else {
        finalBookedFrom = (defaultRoomId && !doctorId) ? "room" : "doctor";
        console.log("⚠ Inferring from context:", finalBookedFrom);
      }
      
      console.log("Final bookedFrom being sent:", finalBookedFrom);
      console.log("=================================");
      
      // CRITICAL: Double-check the value before sending
      const valueToSend = finalBookedFrom;
      console.log("🚀 SENDING TO API - bookedFrom:", valueToSend);
      console.log("🚀 Request payload bookedFrom field will be:", valueToSend);
      
      const res = await axios.post(
        "/api/clinic/appointments",
        {
          patientId: selectedPatient?._id,
          doctorId: selectedDoctorId,
          roomId,
          status,
          followType,
          startDate,
          fromTime,
          toTime,
          referral,
          emergency,
          notes,
          bookedFrom: valueToSend, // Use the determined value - ensure it's "room" or "doctor"
          customTimeSlots: customTimeSlots ? {
            startTime: customTimeSlots.startTime,
            endTime: customTimeSlots.endTime,
          } : undefined,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      if (res.data.success) {
        onSuccess();
        onClose();
        // Reset form
        resetForm();
      } else {
        setError(res.data.message || "Failed to book appointment");
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData?.errors) {
        // Field-level errors from API
        setFieldErrors(errorData.errors);
        setError(errorData.message || "Please fix the errors below");
      } else if (errorData?.missingFields) {
        // Convert missing fields to field errors
        const missingFieldErrors: Record<string, string> = {};
        errorData.missingFields.forEach((field: string) => {
          const fieldLabel = errorData.missingFieldLabels?.[errorData.missingFields.indexOf(field)] || field;
          missingFieldErrors[field] = `${fieldLabel} is required`;
        });
        setFieldErrors(missingFieldErrors);
        setError(errorData.message || "Please fill all required fields");
      } else {
        setError(errorData?.message || "Failed to book appointment");
      }
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setRoomId(defaultRoomId || "");
    setSelectedDoctorId(doctorId || "");
    setStatus("booked");
    setPatientSearch("");
    setSearchResults([]);
    setSelectedPatient(null);
    setShowAddPatient(false);
    setFollowType("first time");
    setStartDate(defaultDate || new Date().toISOString().split("T")[0]);
    setFromTime(slotTime);
    setToTime(calculateEndTime(slotTime));
    setReferral("direct");
    setEmergency("no");
    setNotes("");
    setError("");
    setFieldErrors({});
  };

  if (!isOpen) return null;
  const selectedDoctor = doctorStaff.find((doc) => doc._id === selectedDoctorId);
  const departmentNames =
    doctorDepartments.length > 0 ? doctorDepartments.map((dept) => dept.name).filter(Boolean) : [];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm transition-opacity"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col transform transition-all duration-200 scale-100 opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between z-10">
          <h2 id="modal-title" className="text-lg sm:text-xl font-semibold text-gray-900">Book Appointment</h2>
          <button
            onClick={onClose}
            className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-red-700" role="alert">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Doctor
                </p>
                <p className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                  {selectedDoctor?.name || doctorName || "Select a doctor"}
                </p>
                {selectedDoctor?.email && (
                  <p className="text-xs text-gray-600 truncate">{selectedDoctor.email}</p>
                )}
              </div>
              <div className="text-xs text-gray-700">
                <p className="font-semibold text-gray-900 mb-1.5">Departments</p>
                {doctorDeptLoading ? (
                  <div className="flex items-center gap-2 text-gray-600">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-[11px]">Loading...</span>
                  </div>
                ) : doctorDeptError ? (
                  <p className="text-red-600 text-[11px]">{doctorDeptError}</p>
                ) : departmentNames.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {departmentNames.map((name, idx) => (
                      <span
                        key={`${name}-${idx}`}
                        className="px-1.5 py-0.5 rounded bg-white border border-gray-200 text-[10px] text-gray-700"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-600 text-[11px]">No departments</p>
                )}
              </div>
            </div>
          </div>

          {/* Room Field */}
          <div>
            <label htmlFor="room-select" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
              Room <span className="text-red-500">*</span>
            </label>
            <select
              id="room-select"
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                if (fieldErrors.roomId) {
                  setFieldErrors({ ...fieldErrors, roomId: "" });
                }
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all ${
                fieldErrors.roomId ? "border-red-500" : "border-gray-300"
              }`}
              required
              aria-invalid={!!fieldErrors.roomId}
              aria-describedby={fieldErrors.roomId ? "room-error" : undefined}
            >
              <option value="">Select a room</option>
              {rooms.map((room) => (
                <option key={room._id} value={room._id}>
                  {room.name}
                </option>
              ))}
            </select>
            {fieldErrors.roomId && (
              <p id="room-error" className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.roomId}</p>
            )}
          </div>

          {/* Doctor Field */}
          <div>
            <label htmlFor="doctor-select" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
              Doctor <span className="text-red-500">*</span>
            </label>
            <select
              id="doctor-select"
              value={selectedDoctorId}
              onChange={(e) => {
                setSelectedDoctorId(e.target.value);
                if (fieldErrors.doctorId) {
                  setFieldErrors({ ...fieldErrors, doctorId: "" });
                }
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all ${
                fieldErrors.doctorId ? "border-red-500" : "border-gray-300"
              }`}
              required
              aria-invalid={!!fieldErrors.doctorId}
              aria-describedby={fieldErrors.doctorId ? "doctor-error" : undefined}
            >
              {doctorStaff.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.name}
                </option>
              ))}
            </select>
            {fieldErrors.doctorId && (
              <p id="doctor-error" className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.doctorId}</p>
            )}
          </div>

          {/* Status Field */}
          <div>
            <label htmlFor="status-select" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              id="status-select"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                if (fieldErrors.status) {
                  setFieldErrors({ ...fieldErrors, status: "" });
                }
              }}
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all ${
                fieldErrors.status ? "border-red-500" : "border-gray-300"
              }`}
              required
              aria-invalid={!!fieldErrors.status}
              aria-describedby={fieldErrors.status ? "status-error" : undefined}
            >
              <option value="booked">Booked</option>
              <option value="enquiry">Enquiry</option>
              <option value="discharge">Discharge</option>
            </select>
            {fieldErrors.status && (
              <p id="status-error" className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.status}</p>
            )}
          </div>

          {/* Search Patient */}
          <div>
            <label htmlFor="patient-search" className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">
              Search Patient <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                id="patient-search"
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  if (fieldErrors.patientId) {
                    setFieldErrors({ ...fieldErrors, patientId: "" });
                  }
                }}
                placeholder="Search by name, mobile, email, or EMR number..."
                className={`w-full border rounded-lg pl-9 pr-9 py-2 text-sm focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-all ${
                  fieldErrors.patientId ? "border-red-500" : "border-gray-300"
                }`}
                aria-invalid={!!fieldErrors.patientId}
                aria-describedby={fieldErrors.patientId ? "patient-error" : undefined}
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
            {fieldErrors.patientId && (
              <p id="patient-error" className="mt-1 text-xs text-red-600" role="alert">{fieldErrors.patientId}</p>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                {searchResults.map((patient) => (
                  <div
                    key={patient._id}
                    onClick={() => {
                      setSelectedPatient(patient);
                      setPatientSearch(patient.fullName);
                      setSearchResults([]);
                    }}
                    className="p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <p className="font-medium text-gray-900">{patient.fullName}</p>
                    <p className="text-sm text-gray-500">{patient.mobileNumber} • {patient.email || "No email"}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Selected Patient */}
            {selectedPatient && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900">Selected: {selectedPatient.fullName}</p>
              </div>
            )}

            {/* Add Patient Button */}
            <button
              type="button"
              onClick={() => setShowAddPatient(!showAddPatient)}
              className="mt-2 flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add New Patient
            </button>
          </div>

          {/* Add Patient Form */}
          {showAddPatient && (
            <div className="border border-gray-200 rounded-lg p-4 space-y-4 bg-gray-50">
              <h3 className="font-medium text-gray-900">Add New Patient</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">EMR Number</label>
                  <input
                    type="text"
                    value={addPatientForm.emrNumber}
                    onChange={(e) => setAddPatientForm({ ...addPatientForm, emrNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    First Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={addPatientForm.firstName}
                    onChange={(e) => setAddPatientForm({ ...addPatientForm, firstName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={addPatientForm.lastName}
                    onChange={(e) => setAddPatientForm({ ...addPatientForm, lastName: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={addPatientForm.gender}
                    onChange={(e) => setAddPatientForm({ ...addPatientForm, gender: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    required
                  >
                    <option value="">Select</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={addPatientForm.email}
                    onChange={(e) => setAddPatientForm({ ...addPatientForm, email: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mobile Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={addPatientForm.mobileNumber}
                    onChange={(e) => setAddPatientForm({ ...addPatientForm, mobileNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Referred By</label>
                  <input
                    type="text"
                    value={addPatientForm.referredBy}
                    onChange={(e) => setAddPatientForm({ ...addPatientForm, referredBy: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Patient Type</label>
                  <select
                    value={addPatientForm.patientType}
                    onChange={(e) => setAddPatientForm({ ...addPatientForm, patientType: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="New">New</option>
                    <option value="Old">Old</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddPatient}
                disabled={addingPatient}
                className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addingPatient && <Loader2 className="w-4 h-4 animate-spin" />}
                {addingPatient ? "Adding..." : "Add Patient"}
              </button>
            </div>
          )}

          {/* Follow Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Follow Type <span className="text-red-500">*</span>
            </label>
            <select
              value={followType}
              onChange={(e) => {
                setFollowType(e.target.value);
                if (fieldErrors.followType) {
                  setFieldErrors({ ...fieldErrors, followType: "" });
                }
              }}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                fieldErrors.followType ? "border-red-500" : "border-gray-300"
              }`}
              required
            >
              <option value="first time">First Time</option>
              <option value="follow up">Follow Up</option>
              <option value="repeat">Repeat</option>
            </select>
            {fieldErrors.followType && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.followType}</p>
            )}
          </div>

          {/* Date and Time Fields */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (fieldErrors.startDate) {
                    setFieldErrors({ ...fieldErrors, startDate: "" });
                  }
                }}
                className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.startDate ? "border-red-500" : "border-gray-300"
                }`}
                required
              />
              {fieldErrors.startDate && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.startDate}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                From Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={fromTime}
                onChange={(e) => handleFromTimeChange(e.target.value)}
                className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.fromTime ? "border-red-500" : "border-gray-300"
                }`}
                required
              />
              {fieldErrors.fromTime && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.fromTime}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                To Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={toTime}
                onChange={(e) => {
                  setToTime(e.target.value);
                  if (fieldErrors.toTime) {
                    setFieldErrors({ ...fieldErrors, toTime: "" });
                  }
                }}
                className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.toTime ? "border-red-500" : "border-gray-300"
                }`}
                required
              />
              {fieldErrors.toTime && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.toTime}</p>
              )}
            </div>
          </div>

          {/* Referral */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Referral</label>
            <select
              value={referral}
              onChange={(e) => setReferral(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="direct">Direct</option>
              <option value="referral">Referral</option>
            </select>
          </div>

          {/* Emergency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Emergency</label>
            <select
              value={emergency}
              onChange={(e) => setEmergency(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Additional notes..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200 sticky bottom-0 bg-white -mx-4 sm:-mx-6 px-4 sm:px-6 pb-2 sm:pb-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 sm:px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                loading || 
                !selectedPatient || 
                !roomId || 
                !selectedDoctorId || 
                !status || 
                !followType || 
                !startDate || 
                !fromTime || 
                !toTime
              }
              className="flex-1 px-3 sm:px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? "Booking..." : "Book Appointment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

 
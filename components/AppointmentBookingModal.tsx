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
  rooms: Array<{ _id: string; name: string }>;
  doctorStaff: Array<{ _id: string; name: string }>;
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

  // Whenever the selected slot changes (or modal reopens), sync the times
  useEffect(() => {
    if (isOpen) {
      setFromTime(slotTime);
      setToTime(calculateEndTime(slotTime));
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
  }, [slotTime, isOpen, defaultDate, doctorId, defaultRoomId, bookedFrom]);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Book Appointment</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Room Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Room <span className="text-red-500">*</span>
            </label>
            <select
              value={roomId}
              onChange={(e) => {
                setRoomId(e.target.value);
                if (fieldErrors.roomId) {
                  setFieldErrors({ ...fieldErrors, roomId: "" });
                }
              }}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                fieldErrors.roomId ? "border-red-500" : "border-gray-300"
              }`}
              required
            >
              <option value="">Select a room</option>
              {rooms.map((room) => (
                <option key={room._id} value={room._id}>
                  {room.name}
                </option>
              ))}
            </select>
            {fieldErrors.roomId && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.roomId}</p>
            )}
          </div>

          {/* Doctor Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Doctor <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedDoctorId}
              onChange={(e) => {
                setSelectedDoctorId(e.target.value);
                if (fieldErrors.doctorId) {
                  setFieldErrors({ ...fieldErrors, doctorId: "" });
                }
              }}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                fieldErrors.doctorId ? "border-red-500" : "border-gray-300"
              }`}
              required
            >
              {doctorStaff.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {doctor.name}
                </option>
              ))}
            </select>
            {fieldErrors.doctorId && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.doctorId}</p>
            )}
          </div>

          {/* Status Field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status <span className="text-red-500">*</span>
            </label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                if (fieldErrors.status) {
                  setFieldErrors({ ...fieldErrors, status: "" });
                }
              }}
              className={`w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                fieldErrors.status ? "border-red-500" : "border-gray-300"
              }`}
              required
            >
              <option value="booked">Booked</option>
              <option value="enquiry">Enquiry</option>
              <option value="discharge">Discharge</option>
            </select>
            {fieldErrors.status && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.status}</p>
            )}
          </div>

          {/* Search Patient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Patient <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => {
                  setPatientSearch(e.target.value);
                  if (fieldErrors.patientId) {
                    setFieldErrors({ ...fieldErrors, patientId: "" });
                  }
                }}
                placeholder="Search by name, mobile, email, or EMR number..."
                className={`w-full border rounded-lg pl-10 pr-10 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.patientId ? "border-red-500" : "border-gray-300"
                }`}
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
              )}
            </div>
            {fieldErrors.patientId && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.patientId}</p>
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
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !selectedPatient || !roomId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
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

 
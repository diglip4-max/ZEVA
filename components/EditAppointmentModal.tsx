"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Loader2, Calendar, Clock, AlertCircle } from "lucide-react";

interface EditAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  appointment: {
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
  } | null;
  rooms: Array<{ _id: string; name: string }>;
  doctors: Array<{ _id: string; name: string }>;
  getAuthHeaders: () => Record<string, string>;
}

export default function EditAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  appointment,
  rooms,
  doctors,
  getAuthHeaders,
}: EditAppointmentModalProps) {
  const [roomId, setRoomId] = useState<string>("");
  const [doctorId, setDoctorId] = useState<string>("");
  const [status, setStatus] = useState<string>("booked");
  const [followType, setFollowType] = useState<string>("first time");
  const [startDate, setStartDate] = useState<string>("");
  const [fromTime, setFromTime] = useState<string>("");
  const [toTime, setToTime] = useState<string>("");
  const [referral, setReferral] = useState<string>("direct");
  const [emergency, setEmergency] = useState<string>("no");
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Update form when appointment changes
  useEffect(() => {
    if (appointment) {
      setRoomId(appointment.roomId || "");
      setDoctorId(appointment.doctorId || "");
      setStatus(appointment.status || "booked");
      setFollowType(appointment.followType || "first time");
      // Format startDate for input (YYYY-MM-DD)
      const dateStr = appointment.startDate 
        ? (typeof appointment.startDate === 'string' 
            ? appointment.startDate.split("T")[0] 
            : new Date(appointment.startDate).toISOString().split("T")[0])
        : new Date().toISOString().split("T")[0];
      setStartDate(dateStr);
      setFromTime(appointment.fromTime || "");
      setToTime(appointment.toTime || "");
      setReferral(appointment.referral || "direct");
      setEmergency(appointment.emergency || "no");
      setNotes(appointment.notes || "");
      setError("");
      setFieldErrors({});
    }
  }, [appointment]);

  // Calculate end time when fromTime changes
  useEffect(() => {
    if (fromTime && !toTime) {
      const [hour, min] = fromTime.split(":").map(Number);
      const totalMinutes = hour * 60 + min + 15;
      const newHour = Math.floor(totalMinutes / 60);
      const newMin = totalMinutes % 60;
      setToTime(`${String(newHour).padStart(2, "0")}:${String(newMin).padStart(2, "0")}`);
    }
  }, [fromTime, toTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointment) return;

    setLoading(true);
    setError("");
    setFieldErrors({});

    try {
      const headers = getAuthHeaders();
      const response = await axios.put(
        `/api/clinic/update-appointment/${appointment._id}`,
        {
          patientId: appointment.patientId,
          doctorId,
          roomId,
          status,
          followType,
          startDate,
          fromTime,
          toTime,
          referral,
          emergency,
          notes,
        },
        { headers }
      );

      if (response.data.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.data.message || "Failed to update appointment");
      }
    } catch (err: any) {
      const errorData = err.response?.data;
      if (errorData?.errors) {
        setFieldErrors(errorData.errors);
        setError(errorData.message || "Please fix the errors below");
      } else if (errorData?.missingFields) {
        const missingFieldErrors: Record<string, string> = {};
        errorData.missingFields.forEach((field: string, index: number) => {
          const fieldLabel = errorData.missingFieldLabels?.[index] || field;
          missingFieldErrors[field] = `${fieldLabel} is required`;
        });
        setFieldErrors(missingFieldErrors);
        setError(errorData.message || "Please fill all required fields");
      } else {
        setError(errorData?.message || "Failed to update appointment");
      }
    } finally {
      setLoading(false);
    }
  };

  // Debug logging
  useEffect(() => {
    console.log("EditAppointmentModal - isOpen:", isOpen, "appointment:", appointment?._id);
  }, [isOpen, appointment]);

  if (!isOpen) return null;
  if (!appointment) {
    console.log("EditAppointmentModal: No appointment provided");
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-2" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl max-w-5xl w-full max-h-[95vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Edit Appointment</h2>
            <p className="text-xs text-gray-600 mt-0.5">Patient: {appointment.patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 flex items-center gap-2 text-red-700">
              <AlertCircle className="w-4 h-4" />
              <p className="text-xs">{error}</p>
            </div>
          )}

          {/* Patient Info (Read-only) */}
          <div className="bg-gray-50 border border-gray-200 rounded p-2">
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Patient</label>
            <p className="text-xs text-gray-900 font-medium">{appointment.patientName}</p>
            <p className="text-xs text-gray-500 mt-0.5">This field cannot be changed</p>
          </div>

          {/* Room, Doctor, Status, Follow Type - In one row */}
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
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
                className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.roomId ? "border-red-500" : "border-gray-300"
                }`}
                required
              >
                <option value="">Select room</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.name}
                  </option>
                ))}
              </select>
              {fieldErrors.roomId && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.roomId}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                Doctor <span className="text-red-500">*</span>
              </label>
              <select
                value={doctorId}
                onChange={(e) => {
                  setDoctorId(e.target.value);
                  if (fieldErrors.doctorId) {
                    setFieldErrors({ ...fieldErrors, doctorId: "" });
                  }
                }}
                className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.doctorId ? "border-red-500" : "border-gray-300"
                }`}
                required
              >
                <option value="">Select doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor._id} value={doctor._id}>
                    {doctor.name}
                  </option>
                ))}
              </select>
              {fieldErrors.doctorId && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.doctorId}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
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
                className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.status ? "border-red-500" : "border-gray-300"
                }`}
                required
              >
                <option value="booked">Booked</option>
                <option value="enquiry">Enquiry</option>
                <option value="Discharge">Discharge</option>
                <option value="Arrived">Arrived</option>
                <option value="Consultation">Consultation</option>
                <option value="Cancelled">Cancelled</option>
                <option value="Approved">Approved</option>
                <option value="Rescheduled">Rescheduled</option>
                <option value="Waiting">Waiting</option>
                <option value="Rejected">Rejected</option>
                <option value="Completed">Completed</option>
              </select>
              {fieldErrors.status && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.status}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
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
                className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.followType ? "border-red-500" : "border-gray-300"
                }`}
                required
              >
                <option value="first time">First Time</option>
                <option value="follow up">Follow Up</option>
                <option value="repeat">Repeat</option>
              </select>
              {fieldErrors.followType && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.followType}</p>
              )}
            </div>
          </div>

          {/* Date and Time Fields - In one row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                <Calendar className="w-3 h-3 inline mr-0.5" />
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
                className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.startDate ? "border-red-500" : "border-gray-300"
                }`}
                required
              />
              {fieldErrors.startDate && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.startDate}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                <Clock className="w-3 h-3 inline mr-0.5" />
                From Time <span className="text-red-500">*</span>
              </label>
              <input
                type="time"
                value={fromTime}
                onChange={(e) => {
                  setFromTime(e.target.value);
                  if (fieldErrors.fromTime) {
                    setFieldErrors({ ...fieldErrors, fromTime: "" });
                  }
                }}
                className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.fromTime ? "border-red-500" : "border-gray-300"
                }`}
                required
              />
              {fieldErrors.fromTime && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.fromTime}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">
                <Clock className="w-3 h-3 inline mr-0.5" />
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
                className={`w-full border rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${
                  fieldErrors.toTime ? "border-red-500" : "border-gray-300"
                }`}
                required
              />
              {fieldErrors.toTime && (
                <p className="mt-0.5 text-xs text-red-600">{fieldErrors.toTime}</p>
              )}
            </div>
          </div>

          {/* Referral, Emergency, Notes - In one row */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Referral</label>
              <select
                value={referral}
                onChange={(e) => setReferral(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="direct">Direct</option>
                <option value="referral">Referral</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Emergency</label>
              <select
                value={emergency}
                onChange={(e) => setEmergency(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-0.5">Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add notes..."
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Appointment"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


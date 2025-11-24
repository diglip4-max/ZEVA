"use client";
import React, { useState, useEffect } from "react";
import axios from "axios";
import { X, Loader2, Calendar, Clock, User, Building2, Stethoscope, AlertCircle } from "lucide-react";

interface AppointmentHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  getAuthHeaders: () => Record<string, string>;
}

interface HistoryAppointment {
  _id: string;
  visitId: string;
  patientName: string;
  patientEmail: string;
  patientMobile: string;
  emrNumber: string;
  doctorName: string;
  doctorEmail: string;
  roomName: string;
  status: string;
  followType: string;
  startDate: string;
  fromTime: string;
  toTime: string;
  referral: string;
  emergency: string;
  notes: string;
  arrivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function AppointmentHistoryModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  getAuthHeaders,
}: AppointmentHistoryModalProps) {
  const [appointments, setAppointments] = useState<HistoryAppointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isOpen && patientId) {
      fetchHistory();
    } else {
      setAppointments([]);
      setError("");
    }
  }, [isOpen, patientId]);

  const fetchHistory = async () => {
    setLoading(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(`/api/clinic/patient-appointment-history/${patientId}`, { headers });

      if (response.data.success) {
        setAppointments(response.data.appointments || []);
      } else {
        setError(response.data.message || "Failed to fetch appointment history");
      }
    } catch (err: any) {
      console.error("Error fetching appointment history:", err);
      setError(err.response?.data?.message || "Failed to fetch appointment history");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return "-";
    return timeStr;
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadgeColor = (status: string) => {
    const statusColors: Record<string, string> = {
      booked: "bg-blue-100 text-blue-800",
      enquiry: "bg-yellow-100 text-yellow-800",
      Discharge: "bg-green-100 text-green-800",
      Arrived: "bg-purple-100 text-purple-800",
      Consultation: "bg-indigo-100 text-indigo-800",
      Cancelled: "bg-red-100 text-red-800",
      Approved: "bg-green-100 text-green-800",
      Rescheduled: "bg-orange-100 text-orange-800",
      Waiting: "bg-yellow-100 text-yellow-800",
      Rejected: "bg-red-100 text-red-800",
      Completed: "bg-green-100 text-green-800",
    };
    return statusColors[status] || "bg-gray-100 text-gray-800";
  };

  const getFollowTypeBadgeColor = (followType: string) => {
    const typeColors: Record<string, string> = {
      "first time": "bg-blue-100 text-blue-800",
      "follow up": "bg-green-100 text-green-800",
      repeat: "bg-purple-100 text-purple-800",
    };
    return typeColors[followType] || "bg-gray-100 text-gray-800";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Appointment History</h2>
            <p className="text-sm text-gray-600 mt-1">Patient: {patientName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <span className="ml-3 text-gray-600">Loading appointment history...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && appointments.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No appointment history found for this patient.</p>
            </div>
          )}

          {!loading && !error && appointments.length > 0 && (
            <div className="space-y-4">
              {appointments.map((apt) => (
                <div
                  key={apt._id}
                  className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition-shadow"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Left Column */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Date:</span>
                        <span className="text-sm text-gray-900">{formatDate(apt.startDate)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Time:</span>
                        <span className="text-sm text-gray-900">
                          {formatTime(apt.fromTime)} - {formatTime(apt.toTime)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Stethoscope className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Doctor:</span>
                        <span className="text-sm text-gray-900">{apt.doctorName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Room:</span>
                        <span className="text-sm text-gray-900">{apt.roomName}</span>
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-700">Status:</span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(apt.status)}`}>
                          {apt.status}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Follow Type:</span>
                        <span className={`ml-2 px-2 py-1 rounded-full text-xs font-semibold ${getFollowTypeBadgeColor(apt.followType)}`}>
                          {apt.followType}
                        </span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Referral:</span>
                        <span className="ml-2 text-sm text-gray-900 capitalize">{apt.referral}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-700">Emergency:</span>
                        <span className="ml-2 text-sm text-gray-900 capitalize">{apt.emergency}</span>
                      </div>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-2">
                    {apt.visitId && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Visit ID:</span> {apt.visitId}
                      </div>
                    )}
                    {apt.emrNumber && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">EMR Number:</span> {apt.emrNumber}
                      </div>
                    )}
                    {apt.arrivedAt && (
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Arrived At:</span> {formatDateTime(apt.arrivedAt)}
                      </div>
                    )}
                    {apt.notes && (
                      <div className="mt-2">
                        <span className="text-xs font-medium text-gray-700">Notes:</span>
                        <p className="text-xs text-gray-600 mt-1">{apt.notes}</p>
                      </div>
                    )}
                    <div className="text-xs text-gray-400">
                      Created: {formatDateTime(apt.createdAt)} | Updated: {formatDateTime(apt.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


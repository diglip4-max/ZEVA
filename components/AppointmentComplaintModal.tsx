"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { X } from "lucide-react";

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
  doctorName: string;
  doctorEmail?: string;
  roomId?: string;
  startDate?: string;
  fromTime?: string;
  toTime?: string;
  status?: string;
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
  doctorId: {
    _id?: string;
    name?: string;
    email?: string;
  } | string | null;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [details, setDetails] = useState<AppointmentDetails | null>(null);
  const [report, setReport] = useState<SingleReport | null>(null);
  const [patientReports, setPatientReports] = useState<AppointmentReportSummary[]>([]);
  const [complaints, setComplaints] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [previousComplaints, setPreviousComplaints] = useState<PreviousComplaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(false);
  const [showPreviousReports, setShowPreviousReports] = useState(false);

  useEffect(() => {
    if (!isOpen || !appointment) {
      setDetails(null);
      setReport(null);
      setPatientReports([]);
      setComplaints("");
      setError("");
      setLoading(false);
      setSaving(false);
      setPreviousComplaints([]);
      setLoadingComplaints(false);
      setShowPreviousReports(false);
      return;
    }

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
          setError(response.data?.message || "Failed to load appointment report");
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

        setPatientReports(Array.isArray(response.data.patientReports) ? response.data.patientReports : []);

        // Fetch previous complaints for this patient
        if (response.data.appointment?.patientId) {
          fetchPreviousComplaints(response.data.appointment.patientId);
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load appointment report");
      } finally {
        setLoading(false);
      }
    };

    const fetchPreviousComplaints = async (patientId: string) => {
      setLoadingComplaints(true);
      try {
        const headers = getAuthHeaders();
        const complaintsResponse = await axios.get("/api/clinic/patient-complaints", {
          headers,
          params: { patientId },
        });

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
      setError("Vitals report not found. Please fill the appointment report first, then add complaints.");
      return;
    }

    if (!complaints.trim()) {
      setError("Please enter complaint notes before saving.");
      return;
    }

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
        },
        { headers }
      );
      
      // Refresh previous complaints list
      if (details.patientId) {
        const complaintsResponse = await axios.get("/api/clinic/patient-complaints", {
          headers,
          params: { patientId: details.patientId },
        });
        if (complaintsResponse.data?.success) {
          setPreviousComplaints(complaintsResponse.data.complaints || []);
        }
      }
      
      // Clear the input
      setComplaints("");
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save complaints");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen || !appointment) {
    return null;
  }

  return (
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

        <div className="px-6 py-4 overflow-y-auto space-y-4">
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
                  <span><span className="font-semibold">Name:</span> {details.patientName}</span>
                  <span>•</span>
                  <span><span className="font-semibold">EMR:</span> {details.emrNumber || "-"}</span>
                  <span>•</span>
                  <span className="capitalize"><span className="font-semibold">Gender:</span> {details.gender || "-"}</span>
                  <span>•</span>
                  <span><span className="font-semibold">Mobile:</span> {details.mobileNumber || "-"}</span>
                  <span>•</span>
                  <span><span className="font-semibold">Email:</span> {details.email || "-"}</span>
                  <span>•</span>
                  <span><span className="font-semibold">ID:</span> {details.patientId.slice(-8)}</span>
                </div>
              </div>

              {/* 2. Appointment & Doctor - light blue - Compact single row */}
              <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2">
                <h3 className="text-xs font-semibold text-sky-900 uppercase tracking-wide mb-1">
                  Appointment & Doctor
                </h3>
                <div className="text-xs text-sky-900 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span><span className="font-semibold">Date:</span> {formatDate(details.startDate)}</span>
                  <span>•</span>
                  <span><span className="font-semibold">Time:</span> {details.fromTime && details.toTime ? `${details.fromTime} – ${details.toTime}` : "-"}</span>
                  <span>•</span>
                  <span><span className="font-semibold">Doctor:</span> {details.doctorName}</span>
                  <span>•</span>
                  <span><span className="font-semibold">Email:</span> {details.doctorEmail || "-"}</span>
                  <span>•</span>
                  <span><span className="font-semibold">Status:</span> {details.status || "-"}</span>
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
                      onClick={() => setShowPreviousReports(!showPreviousReports)}
                      className="text-xs px-2 py-1 bg-rose-200 text-rose-900 rounded hover:bg-rose-300 transition"
                    >
                      {showPreviousReports ? "Hide" : "Previous"} ({patientReports.length})
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
                      <span>BP: {report.systolicBp}/{report.diastolicBp} mmHg</span>
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
                      <span className="text-rose-700">Updated: {report.updatedAt ? formatDateTime(report.updatedAt) : "-"}</span>
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
                          key={r.reportId || `${r.appointmentId}-${r.createdAt}`}
                          className="rounded border border-rose-200 bg-rose-100/60 px-2 py-1.5"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                            <span className="font-semibold">{formatDateTime(r.updatedAt)}</span>
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
                            <span>BP: {r.systolicBp}/{r.diastolicBp} mmHg</span>
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

              {/* Notebook-like complaints input */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 space-y-2">
                <h3 className="text-sm font-semibold text-amber-900 uppercase tracking-wide">
                  Doctor&apos;s Complaint Notes
                </h3>
                <p className="text-xs text-amber-800">
                  Write all patient complaints here. This will be saved together with the appointment report.
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
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {previousComplaints.map((complaint) => (
                          <tr key={complaint._id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                              <div className="whitespace-pre-wrap break-words">
                                {complaint.complaints}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                              {formatDateTime(complaint.createdAt)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700">
                              {typeof complaint.doctorId === "object" && complaint.doctorId?.name
                                ? complaint.doctorId.name
                                : "Unknown Doctor"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
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
          <button
            type="button"
            onClick={handleSaveComplaints}
            disabled={saving || loading}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Complaints"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppointmentComplaintModal;



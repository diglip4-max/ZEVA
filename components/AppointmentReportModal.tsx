"use client";
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { X, Heart, ClipboardList, Trash2 } from "lucide-react";

interface AppointmentLite {
  _id: string;
  patientName: string;
  patientId: string;
  emrNumber?: string;
  gender?: string;
  doctorName: string;
  doctorEmail?: string;
  startDate?: string;
  fromTime?: string;
  toTime?: string;
  status?: string;
}

interface PatientReportSummary {
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

interface AppointmentReportModalProps {
  isOpen: boolean;
  appointment: AppointmentLite | null;
  onClose: () => void;
  getAuthHeaders: () => Record<string, string>;
  onSuccess?: () => void;
}

interface ReportData {
  temperatureCelsius: number | "";
  pulseBpm: number | "";
  systolicBp: number | "";
  diastolicBp: number | "";
  heightCm: number | "";
  weightKg: number | "";
  waistCm: number | "";
  respiratoryRate: number | "";
  spo2Percent: number | "";
  hipCircumference: number | "";
  headCircumference: number | "";
  bmi: number | "";
  sugar: string;
  urinalysis: string;
  otherDetails: string;
}

const defaultReport: ReportData = {
  temperatureCelsius: "",
  pulseBpm: "",
  systolicBp: "",
  diastolicBp: "",
  heightCm: "",
  weightKg: "",
  waistCm: "",
  respiratoryRate: "",
  spo2Percent: "",
  hipCircumference: "",
  headCircumference: "",
  bmi: "",
  sugar: "",
  urinalysis: "",
  otherDetails: "",
};

const fieldGroups = [
  {
    title: "Vital Signs",
    fields: [
      { name: "temperatureCelsius", label: "Temperature (°C)", type: "number", required: true },
      { name: "pulseBpm", label: "Pulse (BPM)", type: "number", required: true },
      { name: "systolicBp", label: "BP Systolic (mmHg)", type: "number", required: true },
      { name: "diastolicBp", label: "BP Diastolic (mmHg)", type: "number", required: true },
    ],
  },
  {
    title: "Body Measurements",
    fields: [
      { name: "heightCm", label: "Height (cm)", type: "number", required: false },
      { name: "weightKg", label: "Weight (kg)", type: "number", required: false },
      { name: "waistCm", label: "Waist (cm)", type: "number", required: false },
      { name: "hipCircumference", label: "Hip (cm)", type: "number", required: false },
      { name: "headCircumference", label: "Head Circumference (cm)", type: "number", required: false },
      { name: "bmi", label: "BMI", type: "number", required: false, readonly: true },
    ],
  },
  {
    title: "Lab Readings",
    fields: [
      { name: "sugar", label: "Sugar", type: "text", required: false },
      { name: "urinalysis", label: "Urinalysis", type: "text", required: false },
    ],
  },
  {
    title: "Additional Vitals",
    fields: [
      { name: "respiratoryRate", label: "Respiratory", type: "number", required: false },
      { name: "spo2Percent", label: "SpO₂ (%)", type: "number", required: false },
    ],
  },
];

const AppointmentReportModal: React.FC<AppointmentReportModalProps> = ({
  isOpen,
  appointment,
  onClose,
  getAuthHeaders,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [reportValues, setReportValues] = useState<ReportData>(defaultReport);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [patientReports, setPatientReports] = useState<PatientReportSummary[]>([]);
  const [patientDetails, setPatientDetails] = useState<{
    patientName: string;
    emrNumber?: string;
    gender?: string;
    doctorName: string;
    doctorEmail?: string;
    startDate?: string;
    fromTime?: string;
    toTime?: string;
    mobileNumber?: string;
    email?: string;
  } | null>(null);

  const formatDate = (date?: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const formatTimeRange = useMemo(() => {
    if (!patientDetails?.fromTime || !patientDetails?.toTime) return "";
    return `${patientDetails.fromTime} – ${patientDetails.toTime}`;
  }, [patientDetails?.fromTime, patientDetails?.toTime]);

  useEffect(() => {
    if (!isOpen || !appointment) {
      setReportValues(defaultReport);
      setPatientDetails(null);
      setLastUpdated(null);
      setPatientReports([]);
      setError("");
      return;
    }

    const fetchReport = async () => {
      setLoading(true);
      setError("");
      try {
        const headers = getAuthHeaders();
        const response = await axios.get("/api/clinic/appointment-reports", {
          headers,
          params: { appointmentId: appointment._id },
        });

        if (response.data.success) {
          const apptDetails = response.data.appointment;
          setPatientDetails({
            patientName: apptDetails.patientName || appointment.patientName,
            emrNumber: apptDetails.emrNumber || appointment.emrNumber,
            gender: apptDetails.gender || appointment.gender,
            doctorName: apptDetails.doctorName || appointment.doctorName,
            doctorEmail: apptDetails.doctorEmail || appointment.doctorEmail,
            startDate: apptDetails.startDate,
            fromTime: apptDetails.fromTime,
            toTime: apptDetails.toTime,
            mobileNumber: apptDetails.mobileNumber,
            email: apptDetails.email,
          });

          if (response.data.report) {
            setReportValues({
              temperatureCelsius: response.data.report.temperatureCelsius ?? "",
              pulseBpm: response.data.report.pulseBpm ?? "",
              systolicBp: response.data.report.systolicBp ?? "",
              diastolicBp: response.data.report.diastolicBp ?? "",
              heightCm: response.data.report.heightCm ?? "",
              weightKg: response.data.report.weightKg ?? "",
              waistCm: response.data.report.waistCm ?? "",
              respiratoryRate: response.data.report.respiratoryRate ?? "",
              spo2Percent: response.data.report.spo2Percent ?? "",
              hipCircumference: response.data.report.hipCircumference ?? "",
              headCircumference: response.data.report.headCircumference ?? "",
              bmi: response.data.report.bmi ?? "",
              sugar: response.data.report.sugar ?? "",
              urinalysis: response.data.report.urinalysis ?? "",
              otherDetails: response.data.report.otherDetails ?? "",
            });
            setLastUpdated(response.data.report.updatedAt);
          } else {
            setReportValues(defaultReport);
            setLastUpdated(null);
          }

          if (Array.isArray(response.data.patientReports)) {
            setPatientReports(response.data.patientReports);
          } else {
            setPatientReports([]);
          }
        } else {
          setError(response.data.message || "Failed to load report data");
        }
      } catch (err: any) {
        setError(err.response?.data?.message || "Failed to load report data");
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [isOpen, appointment, getAuthHeaders]);

  const handleChange = (field: keyof ReportData, value: string) => {
    setReportValues((prev) => {
      const updated = {
        ...prev,
        [field]: value === "" ? "" : value,
      };
      if (field === "heightCm" || field === "weightKg") {
        if (updated.heightCm && updated.weightKg) {
          const heightMeters = Number(updated.heightCm) / 100;
          if (heightMeters > 0) {
            updated.bmi = Number(
              (Number(updated.weightKg) / (heightMeters * heightMeters)).toFixed(1)
            );
          }
        } else {
          updated.bmi = "";
        }
      }
      return updated;
    });
  };

  const refreshPatientReports = async () => {
    if (!appointment) return;
    try {
      const headers = getAuthHeaders();
      const response = await axios.get("/api/clinic/appointment-reports", {
        headers,
        params: { appointmentId: appointment._id },
      });
      if (response.data.success) {
        setPatientReports(response.data.patientReports || []);
      }
    } catch (error) {
      console.error("Failed to refresh reports", error);
    }
  };

  const deleteReport = async (reportId?: string) => {
    if (!reportId) return;
    try {
      const headers = getAuthHeaders();
      await axios.delete("/api/clinic/appointment-reports", {
        headers,
        params: { reportId },
      });
      await refreshPatientReports();
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to delete report");
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!appointment) return;

    if (
      reportValues.temperatureCelsius === "" ||
      reportValues.pulseBpm === "" ||
      reportValues.systolicBp === "" ||
      reportValues.diastolicBp === ""
    ) {
      setError("Temperature, pulse, and blood pressure fields are mandatory.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      await axios.post(
        "/api/clinic/appointment-reports",
        {
          appointmentId: appointment._id,
          temperatureCelsius: reportValues.temperatureCelsius,
          pulseBpm: reportValues.pulseBpm,
          systolicBp: reportValues.systolicBp,
          diastolicBp: reportValues.diastolicBp,
          heightCm: reportValues.heightCm === "" ? undefined : reportValues.heightCm,
          weightKg: reportValues.weightKg === "" ? undefined : reportValues.weightKg,
          waistCm: reportValues.waistCm === "" ? undefined : reportValues.waistCm,
          respiratoryRate: reportValues.respiratoryRate === "" ? undefined : reportValues.respiratoryRate,
          spo2Percent: reportValues.spo2Percent === "" ? undefined : reportValues.spo2Percent,
          hipCircumference: reportValues.hipCircumference === "" ? undefined : reportValues.hipCircumference,
          headCircumference: reportValues.headCircumference === "" ? undefined : reportValues.headCircumference,
          sugar: reportValues.sugar,
          urinalysis: reportValues.urinalysis,
          otherDetails: reportValues.otherDetails,
        },
        { headers }
      );

      setLastUpdated(new Date().toISOString());
      await refreshPatientReports();
      setReportValues(defaultReport);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save report");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !appointment) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-start justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Patient Report</p>
            <h3 className="text-2xl font-semibold text-gray-900">{appointment.patientName}</h3>
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
              {appointment.emrNumber && (
                <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full">EMR: {appointment.emrNumber}</span>
              )}
              {appointment.gender && (
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-full capitalize">
                  {appointment.gender}
                </span>
              )}
              <span className="px-2 py-1 bg-green-50 text-green-700 rounded-full">
                Dr. {appointment.doctorName}
              </span>
              {patientDetails?.startDate && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                  {formatDate(patientDetails.startDate)} {formatTimeRange && `• ${formatTimeRange}`}
                </span>
              )}
            </div>
          </div>
          <button
            className="text-gray-400 hover:text-gray-600 transition"
            onClick={() => {
              onClose();
            }}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="px-6 py-4 overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {lastUpdated && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 flex items-center gap-2">
              <ClipboardList className="w-4 h-4" />
              Last updated {new Date(lastUpdated).toLocaleString()}
            </div>
          )}

          {loading ? (
            <div className="py-10 text-center text-gray-500">Loading report...</div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {fieldGroups.map((group) => (
                <div key={group.title} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-4">{group.title}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {group.fields.map((field) => (
                      <label key={field.name} className="text-sm font-medium text-gray-700 flex flex-col gap-1">
                        {field.label}
                        <input
                          type={field.type}
                          value={reportValues[field.name as keyof ReportData] ?? ""}
                          onChange={(e) => handleChange(field.name as keyof ReportData, e.target.value)}
                          required={field.required}
                          min={field.type === "number" ? "0" : undefined}
                          readOnly={Boolean(field.readonly)}
                          className={`rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
                            field.readonly ? "bg-gray-100 text-gray-500 cursor-not-allowed" : ""
                          }`}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <label className="text-sm font-medium text-gray-700 flex flex-col gap-1">
                  Sugar Details
                  <textarea
                    value={reportValues.sugar}
                    onChange={(e) => handleChange("sugar", e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    rows={3}
                    placeholder="Enter sugar level details"
                  />
                </label>
                <label className="text-sm font-medium text-gray-700 flex flex-col gap-1">
                  Urinalysis
                  <textarea
                    value={reportValues.urinalysis}
                    onChange={(e) => handleChange("urinalysis", e.target.value)}
                    className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    rows={3}
                    placeholder="Enter urinalysis observations"
                  />
                </label>
              </div>

              <label className="text-sm font-medium text-gray-700 flex flex-col gap-1">
                Other Notes
                <textarea
                  value={reportValues.otherDetails}
                  onChange={(e) => handleChange("otherDetails", e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  rows={3}
                  placeholder="Add any additional observations"
                />
              </label>

              {patientReports.length > 0 && (
                <div className="rounded-xl border border-gray-100 bg-white/60 p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Previous Reports ({patientReports.length})
                  </h4>
                  <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                    {patientReports.map((report, idx) => (
                      <div
                        key={`${report.appointmentId}-${idx}`}
                        className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2 text-gray-500 text-[11px]">
                          <span className="font-semibold text-gray-700">
                            {new Date(report.updatedAt).toLocaleString()}
                          </span>
                          <div className="flex items-center gap-2">
                            {report.doctorName && (
                              <span className="text-gray-500">Dr. {report.doctorName}</span>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteReport(report.reportId)}
                              className="rounded-full border border-red-200 p-1 text-red-500 hover:bg-red-50 transition"
                              title="Delete report"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
                          <span>Temp: {report.temperatureCelsius}°C</span>
                          <span>Pulse: {report.pulseBpm} BPM</span>
                          <span>BP: {report.systolicBp}/{report.diastolicBp} mmHg</span>
                          {report.weightKg && <span>Weight: {report.weightKg} kg</span>}
                          {report.heightCm && <span>Height: {report.heightCm} cm</span>}
                          {report.waistCm && <span>Waist: {report.waistCm} cm</span>}
                        </div>
                        {(report.sugar || report.urinalysis || report.otherDetails) && (
                          <div className="mt-2 space-y-1 text-gray-600">
                            {report.sugar && <p>Sugar: {report.sugar}</p>}
                            {report.urinalysis && <p>Urinalysis: {report.urinalysis}</p>}
                            {report.otherDetails && <p>Notes: {report.otherDetails}</p>}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Heart className="w-4 h-4" />
                      Save Report
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentReportModal;



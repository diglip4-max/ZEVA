"use client";
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  X,
  Plus,
  Trash2,
  CirclePlus,
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
} from "lucide-react";
import useStockItems from "@/hooks/useStockItems";
import useUoms from "@/hooks/useUoms";
import { getTokenByPath } from "@/lib/helper";
import AddStockItemModal from "@/components/shared/AddStockItemModal";

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
  }>;
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
  const { stockItems, fetchStockItems } = useStockItems();
  const token = getTokenByPath() || "";
  const { uoms, loading: uomsLoading } = useUoms({ token });
  const [isOpenAddStockItemModal, setIsOpenAddStockItemModal] = useState(false);
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
      setError("");
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to save complaints");
    } finally {
      setSaving(false);
    }
  };

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

  if (!isOpen || !appointment) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 px-4 py-8">
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
                              r.reportId || `${r.appointmentId}-${r.createdAt}`
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
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wide">
                          Stock Items
                        </h3>
                        <button
                          onClick={() => setIsOpenAddStockItemModal(true)}
                          className="flex items-center justify-center gap-1 text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          <CirclePlus size={16} />
                        </button>
                      </div>
                      <p className="text-xs text-blue-800 mt-1">
                        Add items related to this appointment
                      </p>
                    </div>
                  </div>
                  <div className="border border-blue-200 rounded-lg p-3 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="sm:col-span-3 space-y-1">
                        <label className="block text-xs font-bold text-gray-900">
                          Item <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={currentItem.itemId || ""}
                          onChange={(e) =>
                            handleCurrentItemChange("itemId", e.target.value)
                          }
                          className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 h-10"
                        >
                          <option value="">Select Item</option>
                          {stockItems.map((si: any) => (
                            <option key={si._id} value={si._id}>
                              {si.name}
                            </option>
                          ))}
                        </select>
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
                            handleCurrentItemChange("quantity", e.target.value)
                          }
                          placeholder="Qty"
                          className="w-full px-3 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-800/20 focus:border-gray-800 h-10"
                        />
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
                      <div className="sm:col-span-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setItems([]);
                          }}
                          disabled={items.length === 0}
                          className="inline-flex items-center px-3 py-2.5 border border-gray-300 text-xs font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50"
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
                            !currentItem.uom
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
                                <tr key={index} className="hover:bg-gray-50">
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
                                        <option value="">Select Item</option>
                                        {stockItems.map((si: any) => (
                                          <option key={si._id} value={si._id}>
                                            {si.name}
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
                                        {uoms.map((u: any) => (
                                          <option key={u._id} value={u.name}>
                                            {u.name}
                                          </option>
                                        ))}
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
                                          onClick={() => startEditItem(index)}
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
                            const isOpen = !!expandedComplaints[complaint._id];
                            return (
                              <React.Fragment key={complaint._id}>
                                <tr className="hover:bg-gray-50 transition-colors">
                                  <td className="px-4 py-3 text-sm text-gray-900 max-w-md">
                                    <div className="whitespace-pre-wrap break-words">
                                      {complaint.complaints}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                                    {formatDateTime(complaint.createdAt)}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    {typeof complaint.doctorId === "object" &&
                                    complaint.doctorId?.name
                                      ? complaint.doctorId.name
                                      : "Unknown Doctor"}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-700">
                                    <div className="flex items-center gap-2">
                                      {hasItems ? (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedComplaints((prev) => ({
                                              ...prev,
                                              [complaint._id]:
                                                !prev[complaint._id],
                                            }))
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
                                              setSelectedComplaint(complaint);
                                              setIsOpenViewComplaintModal(true);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 border border-blue-300 rounded text-blue-700 hover:bg-blue-50"
                                          >
                                            <Eye className="w-4 h-4" />
                                            View
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingComplaint(complaint);
                                              setIsEditModalOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1 px-2 py-1 border border-blue-300 rounded text-blue-700 hover:bg-blue-50"
                                          >
                                            <Pencil className="w-4 h-4" />
                                            Edit
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setDeletedComplaint(complaint);
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
                                            </tr>
                                          </thead>
                                          <tbody className="divide-y divide-gray-200 bg-white">
                                            {complaint.items!.map((it, idx) => (
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
                                              </tr>
                                            ))}
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
          <AddStockItemModal
            token={token || ""}
            clinicId={""}
            isOpen={isOpenAddStockItemModal}
            onClose={() => setIsOpenAddStockItemModal(false)}
            onSuccess={() => {
              setIsOpenAddStockItemModal(false);
              fetchStockItems();
            }}
          />
        </div>
      </div>
      // Add the modal at the bottom of your component (before the closing div)
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
                    Patient ID:
                  </span>
                  <span className="text-sm text-gray-900 font-mono">
                    {complaint.patientId?._id?.slice(-8).toUpperCase() || "N/A"}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs font-medium text-blue-600 w-24">
                    Name:
                  </span>
                  <span className="text-sm text-gray-900">
                    {complaint.patientId?.name || "N/A"}
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

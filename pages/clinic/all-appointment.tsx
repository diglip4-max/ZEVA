"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import type { NextPageWithLayout } from "../_app";
import {
  Search,
  Filter,
  User,
  MoreVertical,
  Edit,
  History,
  FileText,
  MessageCircle,
  Trash2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  X,
} from "lucide-react";
import EditAppointmentModal from "../../components/EditAppointmentModal";
import AppointmentHistoryModal from "../../components/AppointmentHistoryModal";
import AppointmentReportModal from "../../components/AppointmentReportModal";
import AppointmentComplaintModal from "../../components/AppointmentComplaintModal";

interface Appointment {
  _id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  patientNumber: string;
  patientEmail: string;
  emrNumber: string;
  invoiceNumber: string;
  gender: string;
  doctorId: string;
  doctorName: string;
  doctorEmail: string;
  roomId: string;
  roomName: string;
  status: string;
  followType: string;
  referral: string;
  emergency: string;
  notes: string;
  registeredDate: string;
  registeredTime: string;
  invoicedDate: string;
  invoicedTime: string;
  startDate: string;
  fromTime: string;
  toTime: string;
  createdAt: string;
  updatedAt: string;
}

interface Doctor {
  _id: string;
  name: string;
  email: string;
}

interface Room {
  _id: string;
  name: string;
}

interface FilterState {
  search: string;
  emrNumber: string;
  fromDate: string;
  toDate: string;
  doctorId: string;
  roomId: string;
  status: string;
  followType: string;
  referral: string;
  emergency: string;
}

const AllAppointmentsPage: NextPageWithLayout = ({
  contextOverride = null,
}: {
  contextOverride?: "clinic" | "agent" | null;
}) => {
  const [routeContext, setRouteContext] = useState<"clinic" | "agent">(
    (contextOverride || "clinic") as "clinic" | "agent"
  );
  useEffect(() => {
    if (contextOverride) {
      setRouteContext(contextOverride);
      return;
    }
    if (typeof window === "undefined") return;
    const isAgentRoute =
      window.location.pathname?.startsWith("/agent/") ?? false;
    setRouteContext(isAgentRoute ? "agent" : "clinic");
  }, [contextOverride]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    emrNumber: "",
    fromDate: "",
    toDate: "",
    doctorId: "",
    roomId: "",
    status: "",
    followType: "",
    referral: "",
    emergency: "",
  });
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [openActionMenu, setOpenActionMenu] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [complaintModalOpen, setComplaintModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<string>("");
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [reportAppointment, setReportAppointment] = useState<Appointment | null>(null);
  const [complaintAppointment, setComplaintAppointment] = useState<Appointment | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const appointmentRef = useRef<Appointment | null>(null);

  // Debug: Log modal state changes
  useEffect(() => {
    console.log("Modal state changed - editModalOpen:", editModalOpen, "selectedAppointment:", selectedAppointment?._id);
  }, [editModalOpen, selectedAppointment]);

  // Sync ref with state
  useEffect(() => {
    if (selectedAppointment) {
      appointmentRef.current = selectedAppointment;
    }
  }, [selectedAppointment]);

  // Add custom scrollbar styles and ensure horizontal scrolling works
  useEffect(() => {
    const style = document.createElement("style");
    style.id = "appointment-table-scroll-styles";
    style.textContent = `
      /* Custom scrollbar for webkit browsers */
      [style*="overflow-x: auto"]::-webkit-scrollbar,
      .overflow-x-auto::-webkit-scrollbar {
        height: 12px;
        display: block !important;
      }
      [style*="overflow-x: auto"]::-webkit-scrollbar-track,
      .overflow-x-auto::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 6px;
      }
      [style*="overflow-x: auto"]::-webkit-scrollbar-thumb,
      .overflow-x-auto::-webkit-scrollbar-thumb {
        background: #888;
        border-radius: 6px;
      }
      [style*="overflow-x: auto"]::-webkit-scrollbar-thumb:hover,
      .overflow-x-auto::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
      /* Firefox scrollbar */
      [style*="overflow-x: auto"],
      .overflow-x-auto {
        scrollbar-width: thin;
        scrollbar-color: #888 #f1f1f1;
      }
      @media (max-width: 640px) {
        [style*="overflow-x: auto"]::-webkit-scrollbar,
        .overflow-x-auto::-webkit-scrollbar {
          height: 8px;
        }
      }
      /* Force horizontal scroll to work */
      .appointment-table-wrapper {
        overflow-x: auto !important;
        overflow-y: visible !important;
        -webkit-overflow-scrolling: touch !important;
        width: 100% !important;
        display: block !important;
      }
      /* Ensure main content allows horizontal overflow */
      main[role="main"] {
        overflow-x: visible !important;
        overflow-y: auto !important;
      }
      /* Override any parent constraints */
      .appointment-table-wrapper table {
        min-width: 1800px !important;
        width: max-content !important;
      }
      /* Toast animation */
      @keyframes slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      .animate-slide-in {
        animation: slide-in 0.3s ease-out;
      }
    `;
    
    // Remove existing style if present
    const existingStyle = document.getElementById("appointment-table-scroll-styles");
    if (existingStyle) {
      document.head.removeChild(existingStyle);
    }
    
    document.head.appendChild(style);
    return () => {
      const styleToRemove = document.getElementById("appointment-table-scroll-styles");
      if (styleToRemove) {
        document.head.removeChild(styleToRemove);
      }
    };
  }, []);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (typeof window === "undefined") return {};
    let token = null;
    if (routeContext === "agent") {
      token = localStorage.getItem("agentToken") ||
        sessionStorage.getItem("agentToken") ||
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("userToken");
    } else {
      token = localStorage.getItem("clinicToken") ||
        sessionStorage.getItem("clinicToken") ||
        localStorage.getItem("agentToken") ||
        sessionStorage.getItem("agentToken") ||
        localStorage.getItem("userToken") ||
        sessionStorage.getItem("userToken");
    }
    if (!token) return {};
    return { Authorization: `Bearer ${token}` };
  }, [routeContext]);

  // Fetch doctors and rooms for filter dropdowns
  const fetchFilterData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) return;
      const response = await axios.get("/api/clinic/appointment-data", { headers });
      if (response.data.success) {
        setDoctors(response.data.doctorStaff || []);
        setRooms(response.data.rooms || []);
      }
    } catch (err) {
      console.error("Failed to fetch filter data:", err);
    }
  }, [getAuthHeaders]);

  // Fetch appointments with filters
  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        setLoading(false);
        return;
      }
      const params: any = { page, limit: 50 };
      
      // Add filters to params
      if (filters.search) params.search = filters.search;
      if (filters.emrNumber) params.emrNumber = filters.emrNumber;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      if (filters.doctorId) params.doctorId = filters.doctorId;
      if (filters.roomId) params.roomId = filters.roomId;
      if (filters.status) params.status = filters.status;
      if (filters.followType) params.followType = filters.followType;
      if (filters.referral) params.referral = filters.referral;
      if (filters.emergency) params.emergency = filters.emergency;

      const response = await axios.get("/api/clinic/all-appointments", {
        headers,
        params,
      });

      if (response.data.success) {
        setAppointments(response.data.appointments || []);
        setTotal(response.data.total || 0);
        setTotalPages(response.data.totalPages || 1);
      } else {
        setError(response.data.message || "Failed to fetch appointments");
      }
    } catch (err: any) {
      console.error("Error fetching appointments:", err);
      setError(err.response?.data?.message || "Failed to fetch appointments");
    } finally {
      setLoading(false);
    }
  }, [filters, page, getAuthHeaders]);

  useEffect(() => {
    fetchFilterData();
  }, [fetchFilterData]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openActionMenu) {
        setOpenActionMenu(null);
      }
    };

    if (openActionMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openActionMenu]);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      emrNumber: "",
      fromDate: "",
      toDate: "",
      doctorId: "",
      roomId: "",
      status: "",
      followType: "",
      referral: "",
      emergency: "",
    });
    setPage(1);
  };

  const getStatusBadgeColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === "discharged") return "bg-gray-100 text-gray-800";
    if (statusLower === "invoiced") return "bg-purple-100 text-purple-800";
    if (statusLower === "booked") return "bg-green-100 text-green-800";
    if (statusLower === "enquiry") return "bg-yellow-100 text-yellow-800";
    if (statusLower === "cancelled") return "bg-red-100 text-red-800";
    if (statusLower === "arrived") return "bg-indigo-100 text-indigo-800";
    if (statusLower === "consultation") return "bg-gray-100 text-gray-800";
    return "bg-gray-100 text-gray-800";
  };

  const getGenderIcon = (gender: string) => {
    if (gender?.toLowerCase() === "male") return "♂";
    if (gender?.toLowerCase() === "female") return "♀";
    return "";
  };

  const handleDeleteClick = (apt: Appointment) => {
    setAppointmentToDelete(apt);
    setDeleteConfirmOpen(true);
    setOpenActionMenu(null);
  };

  const handleDeleteConfirm = async () => {
    if (!appointmentToDelete) return;

    setDeleting(true);
    try {
      const headers = getAuthHeaders();
      if (!headers.Authorization) {
        setError("Unauthorized. Please log in again.");
        setDeleteConfirmOpen(false);
        setAppointmentToDelete(null);
        setDeleting(false);
        return;
      }

      const response = await axios.delete(
        `/api/clinic/delete-appointment/${appointmentToDelete._id}`,
        { headers }
      );

      if (response.data.success) {
        // Remove appointment from list
        setAppointments((prev) =>
          prev.filter((apt) => apt._id !== appointmentToDelete._id)
        );
        setTotal((prev) => Math.max(0, prev - 1));
        setDeleteConfirmOpen(false);
        setAppointmentToDelete(null);
        setToast({ message: "Appointment deleted successfully", type: 'success' });
        setTimeout(() => setToast(null), 3000);
      } else {
        setToast({ message: response.data.message || "Failed to delete appointment", type: 'error' });
        setTimeout(() => setToast(null), 3000);
        setDeleteConfirmOpen(false);
        setAppointmentToDelete(null);
      }
    } catch (err: any) {
      console.error("Error deleting appointment:", err);
      setToast({ message: err.response?.data?.message || "Failed to delete appointment", type: 'error' });
      setTimeout(() => setToast(null), 3000);
      setDeleteConfirmOpen(false);
      setAppointmentToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr === "-") return "-";
    return dateStr;
  };

  return (
    <>
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-[300] animate-slide-in">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border ${
            toast.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {toast.type === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <span className="font-medium text-sm">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-2 hover:opacity-70 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

        <div className="bg-gray-50 min-h-screen" style={{ width: '100%', padding: '0', margin: '0' }}>
          <div className="p-3 sm:p-4 md:p-6" style={{ width: '100%', minWidth: '100%' }}>
            <div className="w-full" style={{ width: '100%', overflowX: 'visible' }}>
              {/* Header - Matching clinic dashboard theme */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <div>
                      <h1 className="text-lg sm:text-xl font-bold text-gray-900">All Appointments</h1>
                      <p className="text-xs sm:text-sm text-gray-700 mt-0.5">View and manage all appointment records</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className="inline-flex items-center justify-center gap-1.5 bg-gray-800 hover:bg-gray-900 text-white px-3 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-xs sm:text-sm font-medium"
                      >
                        <Filter className="h-4 w-4" />
                        <span>{showFilters ? "Hide Filters" : "Show Filters"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Quick Search */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                    <input
                      type="text"
                      placeholder="Search by patient name, mobile, visit ID, or patient ID..."
                      value={filters.search}
                      onChange={(e) => {
                        handleFilterChange("search", e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          fetchAppointments();
                        }
                      }}
                      className="w-full pl-9 sm:pl-10 pr-3 sm:pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                    />
                  </div>
                </div>
              </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-3">
                <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
                  <div className="p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                      {/* EMR Number */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          EMR Number
                        </label>
                        <input
                          type="text"
                          value={filters.emrNumber}
                          onChange={(e) => handleFilterChange("emrNumber", e.target.value)}
                          placeholder="Enter EMR number"
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                        />
                      </div>

                      {/* From Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          From Date
                        </label>
                        <input
                          type="date"
                          value={filters.fromDate}
                          onChange={(e) => handleFilterChange("fromDate", e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                        />
                      </div>

                      {/* To Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={filters.toDate}
                          onChange={(e) => handleFilterChange("toDate", e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                        />
                      </div>

                      {/* Doctor */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Doctor
                        </label>
                        <select
                          value={filters.doctorId}
                          onChange={(e) => handleFilterChange("doctorId", e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                        >
                          <option value="">All Doctors</option>
                          {doctors.map((doc) => (
                            <option key={doc._id} value={doc._id}>
                              {doc.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Room */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Room
                        </label>
                        <select
                          value={filters.roomId}
                          onChange={(e) => handleFilterChange("roomId", e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                        >
                          <option value="">All Rooms</option>
                          {rooms.map((room) => (
                            <option key={room._id} value={room._id}>
                              {room.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Status */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Status
                        </label>
                        <select
                          value={filters.status}
                          onChange={(e) => handleFilterChange("status", e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                        >
                          <option value="">All Status</option>
                          <option value="booked">Booked</option>
                          <option value="enquiry">Enquiry</option>
                          <option value="Discharge">Discharged</option>
                          <option value="Arrived">Arrived</option>
                          <option value="Consultation">Consultation</option>
                          <option value="Invoiced">Invoiced</option>
                          <option value="Cancelled">Cancelled</option>
                        </select>
                      </div>

                      {/* Follow Type */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Follow Type
                        </label>
                        <select
                          value={filters.followType}
                          onChange={(e) => handleFilterChange("followType", e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                        >
                          <option value="">All Types</option>
                          <option value="first time">First Time</option>
                          <option value="follow up">Follow Up</option>
                          <option value="repeat">Repeat</option>
                        </select>
                      </div>

                      {/* Referral */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Source
                        </label>
                        <select
                          value={filters.referral}
                          onChange={(e) => handleFilterChange("referral", e.target.value)}
                          className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-gray-900"
                        >
                          <option value="">All Sources</option>
                          <option value="direct">Direct</option>
                          <option value="referral">Referral</option>
                        </select>
                      </div>
                    </div>

                    {/* Clear Filters Button */}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={clearFilters}
                        className="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition font-medium"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Results Count */}
            <div className="mb-3 text-xs sm:text-sm text-gray-700">
              Showing {appointments.length} of {total} appointments
            </div>

            {/* Table */}
            {loading ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800 mx-auto"></div>
                <p className="mt-4 text-sm text-gray-700">Loading appointments...</p>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
                {error}
              </div>
            ) : appointments.length === 0 ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                <p className="text-sm text-gray-700">No appointments found</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200" style={{ width: '100%', overflow: 'visible' }}>
              {/* Horizontal Scroll Indicator */}
              <div className="px-3 sm:px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs text-gray-700 flex items-center justify-center gap-2">
                <span className="hidden sm:inline">← Scroll horizontally to view all columns →</span>
                <span className="sm:hidden">← Swipe to view all →</span>
              </div>
              
              {/* Scrollable Table Container */}
              <div 
                className="appointment-table-wrapper"
                style={{ 
                  overflowX: 'auto',
                  overflowY: 'visible',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#888 #f1f1f1',
                  width: '100%',
                  display: 'block',
                  position: 'relative',
                  maxWidth: '100%'
                }}
              >
                <table 
                  className="divide-y divide-gray-200" 
                  style={{ 
                    minWidth: '1800px',
                    width: 'max-content',
                    tableLayout: 'auto',
                    display: 'table',
                    margin: 0
                  }}
                >
                    <thead className="bg-gray-900 text-white">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[50px]">
                          <input
                            type="checkbox"
                            checked={selectedRows.size === appointments.length && appointments.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedRows(new Set(appointments.map((apt) => apt._id)));
                              } else {
                                setSelectedRows(new Set());
                              }
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[70px]">
                          Photo
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[90px]">
                          Visit ID
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                          Date & Time
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[250px]">
                          Patient Details
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[180px]">
                          Doctor Details
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                          Room
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[100px]">
                          Type
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[100px]">
                          Source
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                          Insurance
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[150px]">
                          Remarks
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[70px]">
                          EMR
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[120px]">
                          Status
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider whitespace-nowrap min-w-[80px]">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {appointments.map((apt) => (
                        <tr key={apt._id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(apt._id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedRows);
                              if (e.target.checked) {
                                newSelected.add(apt._id);
                              } else {
                                newSelected.delete(apt._id);
                              }
                              setSelectedRows(newSelected);
                            }}
                            className="rounded"
                          />
                        </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="w-6 h-6 text-gray-700" />
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                              {apt.visitId}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm">
                          <div className="space-y-1">
                            <div>
                              <span className="text-gray-700">D/T Registered: </span>
                              <span className="font-medium text-gray-900">{formatDate(apt.registeredDate)}</span>
                              {apt.registeredTime && (
                                <span className="text-red-600 ml-1">{apt.registeredTime}</span>
                              )}
                            </div>
                            <div>
                              <span className="text-gray-700">D/T Invoiced: </span>
                              <span className="font-medium text-gray-900">{formatDate(apt.invoicedDate)}</span>
                              {apt.invoicedTime && <span className="text-gray-700 ml-1">{apt.invoicedTime}</span>}
                            </div>
                          </div>
                        </td>
                          <td className="px-3 py-4 text-sm">
                            <div className="space-y-1">
                              <div className="font-semibold text-gray-900">{apt.patientName}</div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                                  ID: {apt.patientId.slice(-4) || "N/A"}
                                </span>
                                <span className="text-gray-700 text-xs">{apt.patientNumber}</span>
                                {apt.gender && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs flex items-center gap-1">
                                    {getGenderIcon(apt.gender)} {apt.gender}
                                  </span>
                                )}
                                {apt.emrNumber && (
                                  <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">
                                    DOB: {apt.emrNumber}
                                  </span>
                                )}
                                <button className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs hover:bg-red-200 transition">
                                  Direct →
                                </button>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-4 text-sm">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <div className="w-2 h-2 bg-gray-700 rounded-full"></div>
                                <span className="font-medium text-gray-900">{apt.doctorName}</span>
                              </div>
                              <div className="text-gray-700 text-xs">{apt.doctorEmail}</div>
                            </div>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            {apt.roomName}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="capitalize">{apt.followType || "-"}</span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span className="capitalize">{apt.referral || "Direct"}</span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-900">
                            <span>Cash [DHA]</span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap text-sm max-w-xs truncate text-gray-900">
                            {apt.notes || "No Remarks"}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            {apt.status?.toLowerCase() === "arrived" ? (
                              <button
                                type="button"
                                className="w-7 h-7 bg-red-100 text-red-700 rounded-full flex items-center justify-center hover:bg-red-200 transition"
                                title="Patient Complaint"
                                onClick={() => {
                                  setComplaintAppointment(apt);
                                  setComplaintModalOpen(true);
                                }}
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            ) : apt.emrNumber ? (
                              <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 text-xs">✓</span>
                              </div>
                            ) : (
                              <div className="w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center">
                                <span className="text-yellow-600 text-xs">1</span>
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(
                                apt.status
                              )}`}
                            >
                              {apt.status || "N/A"}
                            </span>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap relative">
                          <div className="relative">
                            <button
                              onClick={() => {
                                setOpenActionMenu(openActionMenu === apt._id ? null : apt._id);
                              }}
                              className="p-1 hover:bg-gray-200 rounded transition"
                            >
                              <MoreVertical className="w-5 h-5 text-gray-700" />
                            </button>
                            
                            {/* Dropdown Menu */}
                            {openActionMenu === apt._id && (
                              <>
                                {/* Backdrop to close menu when clicking outside */}
                                <div
                                  className="fixed inset-0 z-10"
                                  onMouseDown={(e) => {
                                    // Only close if clicking directly on backdrop
                                    if (e.target === e.currentTarget) {
                                      console.log("Backdrop mousedown - closing menu");
                                      setOpenActionMenu(null);
                                    }
                                  }}
                                ></div>
                                
                                {/* Dropdown Content */}
                                <div 
                                  className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50"
                                  onMouseDown={(e) => {
                                    console.log("Dropdown container mousedown");
                                    e.stopPropagation();
                                  }}
                                >
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("=== EDIT BUTTON MOUSEDOWN ===");
                                        console.log("Appointment data:", apt);
                                        console.log("Appointment ID:", apt._id);
                                        
                                        // Store in ref immediately (synchronous)
                                        appointmentRef.current = apt;
                                        console.log("Ref set:", appointmentRef.current?._id);
                                        
                                        // Close dropdown first
                                        setOpenActionMenu(null);
                                        
                                        // Set state immediately
                                        setSelectedAppointment(apt);
                                        console.log("State set, selectedAppointment:", apt._id);
                                        
                                        // Open modal immediately
                                        setEditModalOpen(true);
                                        console.log("Modal opened, editModalOpen set to true");
                                      }}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("=== EDIT BUTTON CLICKED ===");
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition cursor-pointer"
                                    >
                                      <Edit className="w-4 h-4" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        console.log("=== HISTORY BUTTON MOUSEDOWN ===");
                                        console.log("Patient ID:", apt.patientId);
                                        console.log("Patient Name:", apt.patientName);
                                        
                                        // Close dropdown first
                                        setOpenActionMenu(null);
                                        
                                        // Set patient info and open history modal
                                        setSelectedPatientId(apt.patientId);
                                        setSelectedPatientName(apt.patientName);
                                        setHistoryModalOpen(true);
                                        console.log("History modal opened");
                                      }}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition cursor-pointer"
                                    >
                                      <History className="w-4 h-4" />
                                      Appointment History
                                    </button>
                                    {apt.status?.toLowerCase() === "arrived" && (
                                      <button
                                        type="button"
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setOpenActionMenu(null);
                                          setReportAppointment(apt);
                                          setReportModalOpen(true);
                                        }}
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2 transition cursor-pointer"
                                      >
                                        <FileText className="w-4 h-4" />
                                        Report
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onMouseDown={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDeleteClick(apt);
                                      }}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                      }}
                                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition cursor-pointer"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-3 sm:px-4 py-3 bg-gray-50 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-gray-700">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 transition"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Edit Appointment Modal */}
      <EditAppointmentModal
        isOpen={editModalOpen && (selectedAppointment !== null || appointmentRef.current !== null)}
        onClose={() => {
          console.log("Closing edit modal");
          setEditModalOpen(false);
          setSelectedAppointment(null);
          appointmentRef.current = null;
        }}
        onSuccess={() => {
          console.log("Edit success, refreshing appointments");
          fetchAppointments();
          setEditModalOpen(false);
          setSelectedAppointment(null);
          appointmentRef.current = null;
        }}
        appointment={selectedAppointment || appointmentRef.current}
        rooms={rooms}
        doctors={doctors}
        getAuthHeaders={getAuthHeaders}
      />

      {/* Appointment History Modal */}
      <AppointmentHistoryModal
        isOpen={historyModalOpen}
        onClose={() => {
          setHistoryModalOpen(false);
          setSelectedPatientId("");
          setSelectedPatientName("");
        }}
        patientId={selectedPatientId}
        patientName={selectedPatientName}
        getAuthHeaders={getAuthHeaders}
      />

      <AppointmentReportModal
        isOpen={reportModalOpen}
        appointment={reportAppointment}
        onClose={() => {
          setReportModalOpen(false);
          setReportAppointment(null);
        }}
        getAuthHeaders={getAuthHeaders}
        onSuccess={() => {
          fetchAppointments();
        }}
      />

      <AppointmentComplaintModal
        isOpen={complaintModalOpen}
        appointment={complaintAppointment}
        onClose={() => {
          setComplaintModalOpen(false);
          setComplaintAppointment(null);
        }}
        getAuthHeaders={getAuthHeaders}
      />

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">
                Delete Appointment
              </h2>
              <p className="text-gray-700 text-center mb-6">
                Are you sure you want to delete this appointment?
              </p>
              {appointmentToDelete && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-semibold">Patient:</span> {appointmentToDelete.patientName}
                  </p>
                  <p className="text-sm text-gray-600 mb-1">
                    <span className="font-semibold">Visit ID:</span> {appointmentToDelete.visitId}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold">Date:</span> {formatDate(appointmentToDelete.startDate)} {appointmentToDelete.fromTime}
                  </p>
                </div>
              )}
              <p className="text-sm text-red-600 font-medium text-center mb-6">
                This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmOpen(false);
                    setAppointmentToDelete(null);
                  }}
                  disabled={deleting}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

AllAppointmentsPage.getLayout = function PageLayout(page: React.ReactElement) {
  // Wrap page in ClinicLayout for persistent layout
  // When getLayout is used, Next.js keeps the layout mounted and only swaps page content
  // This prevents sidebar and header from re-rendering on navigation
  // For clinic routes, sidebar and header will be visible and persistent
  // For agent routes, the component can handle hiding via contextOverride if needed
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};
export const ClinicAllAppointmentsPageBase = AllAppointmentsPage;

const ProtectedAppointmentsPage = withClinicAuth(AllAppointmentsPage) as NextPageWithLayout;
ProtectedAppointmentsPage.getLayout = AllAppointmentsPage.getLayout;

export default ProtectedAppointmentsPage;


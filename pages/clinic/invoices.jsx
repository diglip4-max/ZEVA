"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import withClinicAuth from "../../components/withClinicAuth";
import ClinicLayout from "../../components/ClinicLayout";
import {
  Search,
  Filter,
  MoreVertical,
  Receipt,
  X,
  AlertTriangle,
  FileText,
  DollarSign,
  Clock,
  User,
} from "lucide-react";
import AppointmentBillingModal from "../../components/AppointmentBillingModal";

const TOKEN_PRIORITY = ["clinicToken", "doctorToken", "agentToken", "staffToken", "userToken", "adminToken"];
const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    try {
      const value = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (value) return value;
    } catch (error) {
      continue;
    }
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

const getUserRole = () => {
  if (typeof window === 'undefined') return null;
  try {
    const token = getStoredToken();
    if (token) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.role || null;
    }
  } catch (error) {
    console.error('Error getting user role:', error);
  }
  return null;
};

function InvoicesPage() {
  const [complaints, setComplaints] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({
  search: "",
  fromDate: new Date().toISOString().split("T")[0],
  toDate: new Date().toISOString().split("T")[0],
  doctorId: "",
  status: "",
});
 
  const [pendingFilters, setPendingFilters] = useState({
  search: "",
  fromDate: new Date().toISOString().split("T")[0],
  toDate: new Date().toISOString().split("T")[0],
  doctorId: "",
  status: "",
});
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [billingModalOpen, setBillingModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [selectedComplaintNote, setSelectedComplaintNote] = useState(null);
  const [selectedBillings, setSelectedBillings] = useState(null);
  const [billingsModalOpen, setBillingsModalOpen] = useState(false);
  const [patientBalances, setPatientBalances] = useState({});
const [activeCard, setActiveCard] = useState(null);
  const fetchFilterData = useCallback(async () => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return;
      const res = await axios.get("/api/clinic/appointment-data", { headers });
      if (res.data.success) {
        setDoctors(res.data.doctorStaff || []);
      }
    } catch (err) {
      console.error("Failed to fetch filter data:", err);
    }
  }, []);

  const fetchPatientBalance = useCallback(async (patientId) => {
    try {
      const headers = getAuthHeaders();
      if (!headers) return null;
      const res = await axios.get(`/api/clinic/patient-balance/${patientId}`, { headers });
      if (res.data.success && res.data.balances) {
        return {
          pendingAmount: res.data.balances.pendingBalance || 0,
          advanceAmount: res.data.balances.advanceBalance || 0,
        };
      }
      return null;
    } catch (err) {
      console.error("Error fetching patient balance:", err);
      return null;
    }
  }, []);
const pendingPatients = complaints.filter((item) => {
  const balance = patientBalances[item.patientId];
  return balance && balance.pendingAmount > 0;
});

const advancePatients = complaints.filter((item) => {
  const balance = patientBalances[item.patientId];
  return balance && balance.advanceAmount > 0;
});
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const headers = getAuthHeaders();
      if (!headers) {
        setLoading(false);
        return;
      }
      const params = { page, limit: 10 };

      if (filters.search) params.search = filters.search;
      if (filters.fromDate) params.fromDate = filters.fromDate;
      if (filters.toDate) params.toDate = filters.toDate;
      if (filters.doctorId) params.doctorId = filters.doctorId;

      const res = await axios.get("/api/clinic/complaints", {
        headers,
        params,
      });
      

      if (res.data.success) {
        const complaintList = res.data.complaints || [];


        setComplaints(complaintList);
        setTotal(res.data.total || 0);
        setTotalPages(res.data.totalPages || 1);
        
        // Fetch patient balances for each complaint
        for (const comp of complaintList) {
          if (comp.patientId && !patientBalances[comp.patientId]) {
            const balance = await fetchPatientBalance(comp.patientId);
            if (balance) {
              setPatientBalances(prev => ({ ...prev, [comp.patientId]: balance }));
            }
          }
        }
      } else {
        setError(res.data.message || "Failed to fetch complaints");
      }
    } catch (err) {
      console.error("Error fetching complaints:", err);
      setError(err.response?.data?.message || "Failed to fetch complaints");
    } finally {
      setLoading(false);
    }
  }, [filters, page, patientBalances, fetchPatientBalance]);

  useEffect(() => {
    fetchFilterData();
  }, [fetchFilterData]);

  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  const handleFilterChange = (key, value) => {
    setPendingFilters((prev) => ({ ...prev, [key]: value }));
  };

  const applyFilters = () => {
    setFilters(pendingFilters);
    setPage(1);
  };

  const clearFilters = () => {
    const emptyFilters = {
      search: "",
      fromDate: "",
      toDate: "",
      doctorId: "",
    };
    setPendingFilters(emptyFilters);
    setFilters(emptyFilters);
    setPage(1);
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === "Enter") {
      applyFilters();
    }
  };

  const handleActionClick = (id) => {
    setOpenActionMenu(openActionMenu === id ? null : id);
  };

  const handleBillingClick = (appointment) => {
        setSelectedAppointment(appointment);
        setBillingModalOpen(true);
        setOpenActionMenu(null);
      };

  const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return "₹0.00";
    const num = Number(amount);
    return "₹" + num.toFixed(2);
  };
const APPOINTMENT_STATUS_OPTIONS = [
  { value: "Booked", label: "Booked" },
  {value: "Enquiry", label:"Enquiry"},
    {value: "Discharge", label:"Discharge"},
  { value: "Arrived", label: "Arrived" },
 { value: "Consultation", label: "Consultation" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Rescheduled", label: "Rescheduled" },
   { value: "Approved", label: "Approved" },
    { value: "Waiting", label: "Waiting" },
  { value: "Rejected", label: "Rejected" },
  { value: "Completed", label: "Completed" },
  { value: "Invoiced", label: "Invoiced" },
  { value: "No Show", label: "No Show" },
  
];
  const formatDateTime = (date, time) => {
    let result = "";
    if (date) {
      const d = new Date(date);
      result = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
    if (time) {
      result += ` at ${time}`;
    }
    return result || "-";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-green-50" style={{ width: '100%', padding: '0', margin: '0' }}>
      <div className="p-2 sm:p-3 md:p-4 lg:p-6" style={{ width: '100%', minWidth: '100%' }}>
        <div className="w-full" style={{ width: '100%', overflowX: 'visible' }}>
          {/* Header Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-green-100 mb-1 sm:mb-2 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-500 px-4 sm:px-6 py-4 sm:py-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
                    <FileText className="h-7 w-7 sm:h-8 sm:w-8" />
                    Patient Invoices
                  </h1>
                  <p className="text-green-100 mt-1 text-sm sm:text-base">
                    Manage and view invoices for patient complaints
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className="inline-flex items-center justify-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl transition-all duration-300 border border-white/30 backdrop-blur-sm shadow-sm"
                  >
                    <Filter className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span className="font-medium text-sm">{showFilters ? "Hide Filters" : "Show Filters"}</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="px-4 sm:px-6 py-4 sm:py-5">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by patient name, EMR number or mobile..."
                  value={pendingFilters.search}
                  onChange={(e) => handleFilterChange("search", e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="w-full pl-12 pr-6 py-3 text-sm border-2 border-green-100 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-green-900 bg-white transition-all duration-200"
                />
              </div>
            </div>
          </div>


          {/* Filters Section */}
          {showFilters && (
            <div className="bg-white rounded-2xl shadow-lg border border-green-100 mb-4 sm:mb-6 p-4 sm:p-6 ">
              <div className="bg-gradient-to-br from-green-50 to-green-50 rounded-xl p-4 sm:p-5 border border-green-100">
                <h3 className="text-sm font-semibold text-green-900 mb-4 flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter Options
                </h3>
                
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">
                      From Date
                    </label>
                    <input
                      type="date"
                      value={pendingFilters.fromDate}
                      onChange={(e) => handleFilterChange("fromDate", e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-green-900 bg-white transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">
                      To Date
                    </label>
                    <input
                      type="date"
                      value={pendingFilters.toDate}
                      onChange={(e) => handleFilterChange("toDate", e.target.value)}
                      className="w-full px-4 py-2.5 text-sm border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-green-900 bg-white transition-all duration-200"
                    />
                  </div>

                  <div>
    <label className="block text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">
      Doctor
    </label>

    <select value={pendingFilters.doctorId} 
    onChange={(e) => handleFilterChange("doctorId", e.target.value)} className="w-full px-4 py-2.5 text-sm border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-green-900 bg-white transition-all duration-200" > 
    <option value="">All Doctors</option> 
    {doctors.map((doc) => ( <option key={doc._id} value={doc._id}> {doc.name} 

    </option> ))}
     </select>
  </div>

  {/* Status */}
   <div>
                       <label className="block text-xs font-semibold text-green-700 mb-2 uppercase tracking-wider">
                        Status
                      </label>
                      <select
                      className="w-full px-4 py-2.5 text-sm border-2 border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-green-900 bg-white transition-all duration-200"
    >
  value={pendingFilters.status}
  onChange={(e) => handleFilterChange("status", e.target.value)}

  <option value="">All Status</option>

  {APPOINTMENT_STATUS_OPTIONS.map((opt) => (
    <option key={opt.value} value={opt.value}>
      {opt.label}
    </option>
  ))}
</select>
                    </div>

</div>

                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={clearFilters}
                    className="px-5 py-2.5 text-sm text-green-700 bg-white border-2 border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all duration-200 font-medium"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={applyFilters}
                    className="px-5 py-2.5 text-sm text-white bg-gradient-to-r from-green-600 to-green-600 border-2 border-green-600 rounded-lg hover:from-green-700 hover:to-green-700 hover:border-green-700 transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            
            
          )}

<div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
  <h3 className="text-sm font-semibold text-gray-700 mb-3">
    Today's Status:
  </h3>

  <div className="flex gap-3">

    {/* Pending */}
    <div className="relative">

      <button
        onClick={() =>
          setActiveCard(activeCard === "pending" ? null : "pending")
        }
        className="flex items-center gap-3 px-6 py-2 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100"
      >
        <span className="text-purple-700 font-semibold">
          Pending Amount
        </span>

        <span className="text-purple-700 font-bold">
          {pendingPatients.length}
        </span>
      </button>

      {activeCard === "pending" && (
        <div className="absolute mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">

          <div className="flex justify-between px-4 py-3 border-b bg-gray-50">
            <span className="font-semibold">
              Pending Amount
            </span>

            <span>{pendingPatients.length} records</span>
          </div>

          <table className="w-full text-sm">

            <thead className="bg-green-50">
              <tr>
                <th className="text-left px-3 py-2">
                  Patient
                </th>

                <th className="text-left px-3 py-2">
                  Pending Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {pendingPatients.map((item) => (
                <tr key={item._id} className="border-t">

                  <td className="px-3 py-2">
                    {item.patientName}
                  </td>

                  <td className="px-3 py-2 font-semibold text-red-600">
  {formatCurrency(
    patientBalances[item.patientId]?.pendingAmount || 0
  )}
</td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>

    {/* Advance */}

    <div className="relative">

      <button
        onClick={() =>
          setActiveCard(activeCard === "advance" ? null : "advance")
        }
        className="flex items-center gap-3 px-6 py-2 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100"
      >
        <span className="text-teal-700 font-semibold">
          Advance Amount
        </span>

        <span className="text-teal-700 font-bold">
          {advancePatients.length}
        </span>
      </button>

      {activeCard === "advance" && (
        <div className="absolute mt-2 w-80 bg-white rounded-lg shadow-xl border z-50">

          <div className="flex justify-between px-4 py-3 border-b bg-gray-50">
            <span className="font-semibold">
              Advance Amount
            </span>

            <span>{advancePatients.length} records</span>
          </div>

          <table className="w-full text-sm">

            <thead className="bg-green-50">
              <tr>
                <th className="text-left px-3 py-2">
                  Patient
                </th>

                <th className="text-left px-3 py-2">
                  Advance Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {advancePatients.map((item) => (
                <tr key={item._id} className="border-t">

                  <td className="px-3 py-2">
                    {item.patientName}
                  </td>

                 <td className="px-3 py-2 font-semibold text-green-600">
  {formatCurrency(
    patientBalances[item.patientId]?.advanceAmount || 0
  )}
</td>

                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>

  </div>
</div>

      {/* Summary Stats */}
          <div className="mb-0 mt-3 sm:mb-3 text-sm text-green-700 bg-white px-4 py-3 rounded-xl shadow-sm border border-green-100 flex items-center gap-2">
            <span className="font-semibold">Showing</span>
            <span className="font-bold text-green-900">{complaints.length}</span>
            <span>of</span>
            <span className="font-bold text-green-900">{total}</span>
            <span>complaints</span>
          </div>

          {/* Loading State */}
          {loading ? (
            <div className="min-h-[400px]  bg-white rounded-2xl shadow-lg border border-green-100 flex items-center justify-center p-12">
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin"></div>
                <p className="text-green-700 text-lg font-medium">Loading invoices...</p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-red-200 rounded-2xl p-8 shadow-lg">
              <div className="flex items-start gap-4">
                <AlertTriangle className="h-8 w-8 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Invoices</h3>
                  <p className="text-red-700">{error}</p>
                </div>
              </div>
            </div>
          ) : complaints.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg border border-green-100 p-12 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center">
                  <FileText className="h-10 w-10 text-green-400" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-green-900 mb-2">No Invoices Found</h3>
                  <p className="text-green-600">There are no complaints matching your criteria.</p>
                </div>
              </div>
            </div>









          ) : (
            /* Main Table Section */
            <div className="bg-white rounded-2xl shadow-lg border border-green-100 overflow-hidden" style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
              <div className="px-6 py-3 bg-gradient-to-r from-green-50 to-green-50 border-b border-green-100 text-xs sm:text-sm text-green-700 flex items-center justify-center gap-2">
                <span className="hidden md:inline">← Scroll horizontally to view all columns →</span>
                <span className="hidden sm:inline md:hidden">← Scroll to view all →</span>
                <span className="sm:hidden">← Swipe →</span>
              </div>

              <div
                className="overflow-x-auto overflow-y-auto"
                style={{
                  height: '500px',
                  maxHeight: '500px',
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#4f46e5 #f1f1f1',
                  width: '100%',
                  display: 'block',
                  position: 'relative',
                  maxWidth: '100%'
                }}
              >
                <table className="min-w-full" style={{ minWidth: '1400px', tableLayout: 'auto', display: 'table' }}>
                  <thead className="bg-gradient-to-r from-green-600 to-green-600 text-white sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[180px]">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Patient Details
                        </div>
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[180px]">
                        Doctor
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[200px]">
                        Appointment Time
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[200px]">
                        Services
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[200px]">
                        Complaint Note
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[140px]">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Pending Amount
                        </div>
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[140px]">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Advance Amount
                        </div>
                      </th>
                      <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[140px]">
  Status
</th>
                      <th className="px-4 py-4 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap w-[80px]">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {complaints.map((comp, index) => {
                      const balance = patientBalances[comp.patientId] || { pendingAmount: 0, advanceAmount: 0 };
                      const apptDetails = comp.appointment || {};
                      const isEven = index % 2 === 0;
                      
                      return (
                        <tr 
                          key={comp._id} 
                          className={`transition-all duration-200 ${isEven ? 'bg-white' : 'bg-green-50/30'} hover:bg-gradient-to-r from-green-50 to-green-50 cursor-default`}
                        >
                          <td className="px-4 py-4 whitespace-nowrap border-b border-green-100">
                            <div className="text-sm">
                              <div className="font-semibold text-green-900 text-base">{comp.patientName}</div>
                              <div className="text-green-600 text-xs mt-1 flex items-center gap-2 flex-wrap">
                                <span className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium">
                                  EMR: {comp.emrNumber || "-"}
                                </span>
                                {comp.isInvoiced && (
                                  <button
                                    onClick={() => {
                                      setSelectedBillings(comp.billings);
                                      setBillingsModalOpen(true);
                                    }}
                                    className="bg-green-100 text-green-800 px-2 py-0.5 rounded-full text-xs font-medium hover:bg-green-200 transition cursor-pointer"
                                  >
                                    INVOICED
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap border-b border-green-100">
                            <div className="text-sm text-green-900 font-medium">{comp.doctorName}</div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap border-b border-green-100">
                            <div className="text-sm">
                              <div className="text-green-900 flex items-center gap-2">
                                <Clock className="h-4 w-4 text-green-400" />
                                {apptDetails.startDate 
                                  ? new Date(apptDetails.startDate).toLocaleDateString("en-GB", {
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "numeric"
                                    }) 
                                  : comp.appointmentDate || "-"}
                              </div>
                              {apptDetails.fromTime && apptDetails.toTime && (
                                <div className="text-green-600 text-xs mt-1">
                                  {apptDetails.fromTime} - {apptDetails.toTime}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 border-b border-green-100">
                            <div className="text-sm text-green-900 max-w-[200px]">
                              {comp.services && comp.services.length > 0 
                                ? comp.services.slice(0, 2).join(", ") + (comp.services.length > 2 ? "..." : "") 
                                : "-"}
                            </div>
                          </td>
                          <td className="px-4 py-4 border-b border-green-100">
                            {comp.complaintNote && comp.complaintNote.length > 50 ? (
                              <button
                                onClick={() => setSelectedComplaintNote({
                                  patientName: comp.patientName,
                                  note: comp.complaintNote
                                })}
                                className="text-left text-sm text-green-700 hover:text-green-900 hover:underline font-medium max-w-[180px] truncate"
                              >
                                {comp.complaintNote.substring(0, 50)}...
                              </button>
                            ) : (
                              <div className="text-sm text-green-900 max-w-[180px]">
                                {comp.complaintNote || "-"}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap border-b border-green-100">
                            <div className="text-sm font-semibold text-orange-600">
                              {formatCurrency(balance.pendingAmount)}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap border-b border-green-100">
                            <div className="text-sm font-semibold text-green-600">
                              {formatCurrency(balance.advanceAmount)}
                            </div>
                          </td>
<td className="px-4 py-4 border-b border-green-100">
  <span
    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
  comp?.appointment?.status?.toLowerCase() === "active"
    ? "bg-green-100 text-green-700"
    : comp?.appointment?.status?.toLowerCase() === "invoiced"
    ? "bg-blue-100 text-blue-700"
    : comp?.appointment?.status?.toLowerCase() === "pending"
    ? "bg-yellow-100 text-yellow-700"
    : comp?.appointment?.status?.toLowerCase() === "cancelled"
    ? "bg-red-100 text-red-700"
    : comp?.appointment?.status?.toLowerCase() === "completed"
    ? "bg-emerald-100 text-emerald-700"
    : "bg-gray-100 text-gray-700"
}`}
  >
   {comp?.appointment?.status
  ? comp.appointment.status.charAt(0).toUpperCase() +
    comp.appointment.status.slice(1).toLowerCase()
  : "-"}
  </span>
</td>
              <td className="px-4 py-4 whitespace-nowrap border-b border-green-100 text-center">
                            <div className="relative inline-block">
                              <button
                                onClick={() => handleActionClick(comp._id)}
                                className="p-2 text-green-600 hover:text-green-900 rounded-full hover:bg-green-100 transition-all duration-200"
                              >
                                <MoreVertical className="h-5 w-5" />
                              </button>
                              {openActionMenu === comp._id && (
                                <>
                                  <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setOpenActionMenu(null)}
                                  />
                                  <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-2xl border border-green-200 min-w-[140px] overflow-hidden">
                                    <button
                                      onClick={() => handleBillingClick(comp.appointment)}
                                      className="w-full text-left px-4 py-3 text-sm text-green-900 hover:bg-green-50 flex items-center gap-2 transition-all duration-200"
                                    >
                                      <Receipt className="h-4 w-4" />
                                      Billing
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-50 to-green-50 border-t border-green-100">
                  <div className="text-sm text-green-700 font-medium">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-3">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                      className="px-4 py-2 text-sm bg-white border-2 border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium text-green-700"
                    >
                      ← Previous
                    </button>
                    <button
                      disabled={page >= totalPages}
                      onClick={() => setPage(page + 1)}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-green-600 to-green-600 text-white border-2 border-green-600 rounded-lg hover:from-green-700 hover:to-green-700 hover:border-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-md hover:shadow-lg"
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Billing Modal */}
      {billingModalOpen && selectedAppointment && (
        <AppointmentBillingModal
          isOpen={billingModalOpen}
          onClose={() => {
            setBillingModalOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          getAuthHeaders={getAuthHeaders}
          onSuccess={() => {
            fetchComplaints();
          }}
        />
      )}

      {/* Complaint Note Modal */}
      {selectedComplaintNote && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-green-600 to-green-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <FileText className="h-5 w-5" />
                  Complaint Note
                </h2>
                <p className="text-green-100 text-sm mt-1">
                  Patient: {selectedComplaintNote.patientName}
                </p>
              </div>
              <button
                onClick={() => setSelectedComplaintNote(null)}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="bg-gradient-to-br from-green-50 to-green-50 rounded-xl p-6 border border-green-100">
                <p className="text-green-900 text-lg leading-relaxed whitespace-pre-wrap">
                  {selectedComplaintNote.note}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => setSelectedComplaintNote(null)}
                className="px-6 py-2.5 text-sm text-green-700 bg-white border-2 border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all duration-200 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Billings Modal */}
      {billingsModalOpen && selectedBillings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[80vh] overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-3">
                  <Receipt className="h-5 w-5" />
                  Invoice Details
                </h2>
                <p className="text-green-100 text-sm mt-1">
                  {selectedBillings.length} Invoice{selectedBillings.length !== 1 ? 's' : ''} Found
                </p>
              </div>
              <button
                onClick={() => {
                  setBillingsModalOpen(false);
                  setSelectedBillings(null);
                }}
                className="p-2 text-white hover:bg-white/20 rounded-full transition-all duration-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
              {selectedBillings.map((bill, idx) => (
                <div key={idx} className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border border-green-100">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-sm font-semibold text-green-900">Invoice {bill.invoiceNumber}</div>
                   {bill.invoicedDate && bill.invoicedBy && (
  <div className="text-xs text-green-700">
    <div>
      <strong>Date:</strong>{" "}
      {new Date(bill.invoicedDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}
    </div>

    <div>
      <strong>Invoiced By:</strong> {bill.invoicedBy}
    </div>
  </div>
)}
                  </div>

                  {/* Services/Treatments */}
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">
                      Services/Treatments:
                    </div>
                    <div className="text-sm text-green-900 space-y-1">
                      {/* Show selected treatments first! */}
                      {Array.isArray(bill.selectedTreatments) && bill.selectedTreatments.length > 0 && (
                        bill.selectedTreatments.map((t, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            {t.treatmentName}
                            {t.quantity > 1 && (
                              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">x{t.quantity}</span>
                            )}
                          </div>
                        ))
                      )}
                      {/* Show treatment if no selected treatments */}
                      {!Array.isArray(bill.selectedTreatments) || bill.selectedTreatments.length === 0 ? (
                        <>
                          {bill.treatment ? <div>{bill.treatment}</div> : null}
                          {bill.service === "Package" && bill.package ? <div>{bill.package}</div> : null}
                        </>
                      ) : null}
                      {/* Show unpaid packages paid */}
                      {Array.isArray(bill.unpaidPackagesPaid) && bill.unpaidPackagesPaid.length > 0 && (
                        <div className="mt-2">
                          <div className="text-xs text-green-700 font-medium mb-1">Unpaid Packages:</div>
                          {bill.unpaidPackagesPaid.map((pkg, pkgIdx) => (
                            <div key={pkgIdx} className="flex items-center justify-between">
                              <span>{pkg.packageName}</span>
                              {/* <span>{bill.invoicedBy || "-"}</span> */}
                                  {/* <span>{bill.billings.invoicedBy}</span> */}
                              <span className="font-medium">{formatCurrency(pkg.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Package Treatments */}
                  {Array.isArray(bill.selectedPackageTreatments) && bill.selectedPackageTreatments.length > 0 && (
                    <div className="mb-3">
                      <div className="text-xs font-semibold text-green-800 uppercase tracking-wide mb-2">
                        Package Treatments:
                      </div>
                      <div className="text-sm text-green-900 space-y-1">
                        {bill.selectedPackageTreatments.map((pt, ptIdx) => (
                        <div key={ptIdx}>
                          {pt.treatmentName}
                          {pt.numberOfSessions && ` (${pt.numberOfSessions} ${pt.numberOfSessions === 1 ? "session" : "sessions"})`}
                        </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Amounts */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="bg-white/60 rounded-lg p-3">
                      <div className="text-xs text-green-700 font-medium">Total Amount</div>
                      <div className="text-lg font-bold text-green-900 mt-1">
                        {formatCurrency(bill.amount)}
                      </div>
                    </div>
                    <div className="bg-white/60 rounded-lg p-3">
                      <div className="text-xs text-green-700 font-medium">Paid Amount</div>
                      <div className="text-lg font-bold text-green-900 mt-1">
                        {formatCurrency(bill.paid)}
                      </div>
                    </div>
                  </div>

                  {bill.pending > 0 && (
                    <div className="mt-3 bg-orange-50 border border-orange-100 rounded-lg p-3">
                      <div className="text-xs text-orange-700 font-medium">Pending Amount</div>
                      <div className="text-lg font-bold text-orange-900 mt-1">
                        {formatCurrency(bill.pending)}
                      </div>
                    </div>
                  )}

                  {bill.advance > 0 && (
                    <div className="mt-3 bg-blue-50 border border-blue-100 rounded-lg p-3">
                      <div className="text-xs text-blue-700 font-medium">Advance Used</div>
                    </div>
                  )}

                  {/* Payment Method */}
                  {bill.paymentMethod && (
                    <div className="mt-3">
                      <div className="text-xs text-green-700 font-medium">Payment Method: {bill.paymentMethod}</div>
                    </div>
                  )}

                  {/* Notes */}
                  {bill.notes && (
                    <div className="mt-3">
                      <div className="text-xs text-green-700 font-medium">Notes</div>
                      <div className="text-sm text-green-900 mt-1">{bill.notes}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
              <button
                onClick={() => {
                  setBillingsModalOpen(false);
                  setSelectedBillings(null);
                }}
                className="px-6 py-2.5 text-sm text-green-700 bg-white border-2 border-green-200 rounded-lg hover:bg-green-50 hover:border-green-300 transition-all duration-200 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

InvoicesPage.getLayout = function PageLayout(page) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedInvoicesPage = withClinicAuth(InvoicesPage);
ProtectedInvoicesPage.getLayout = InvoicesPage.getLayout;

export default ProtectedInvoicesPage;
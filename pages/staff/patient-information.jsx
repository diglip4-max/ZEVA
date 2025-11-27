import React, { useState, useEffect } from "react";
import axios from "axios";
import { Package, TrendingUp, Eye, Search, ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle2, Info, Edit3, User, DollarSign, Filter } from "lucide-react";
import { useRouter } from "next/router";
import ClinicLayout from '../../components/staffLayout';
import withClinicAuth from '../../components/withStaffAuth';

const TOKEN_PRIORITY = [
  "clinicToken",
  "doctorToken",
  "agentToken",
  "staffToken",
  "userToken",
  "adminToken",
];

const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    const value =
      localStorage.getItem(key) ||
      sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3500); return () => clearTimeout(timer); }, [onClose]);
  const styles = { success: "bg-emerald-500", error: "bg-rose-500", info: "bg-blue-500" };
  return (
    <div className={`${styles[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slideIn`}>
      {type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : type === 'error' ? <AlertCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button onClick={onClose} className="hover:bg-white/20 rounded p-1"><X className="w-4 h-4" /></button>
    </div>
  );
};

const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2 w-full max-w-sm px-4">
    {toasts.map(toast => <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />)}
  </div>
);

const PatientDetailsModal = ({ isOpen, onClose, patient }) => {
  if (!isOpen || !patient) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl max-w-4xl w-full my-8 animate-scaleIn max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-800">Patient Details</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
                          <div><h4 className="text-sm font-semibold text-gray-900 uppercase border-b pb-2 mb-3">Personal Info</h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-700">Name:</span> <span className="font-medium text-gray-900">{patient.firstName} {patient.lastName}</span></div>
                <div><span className="text-gray-700">Gender:</span> <span className="font-medium text-gray-900">{patient.gender}</span></div>
                <div><span className="text-gray-700">Email:</span> <span className="font-medium text-gray-900">{patient.email}</span></div>
                <div><span className="text-gray-700">Mobile:</span> <span className="font-medium text-gray-900">{patient.mobileNumber}</span></div>
                <div><span className="text-gray-700">Type:</span> <span className="font-medium text-gray-900">{patient.patientType}</span></div>
                <div><span className="text-gray-700">Referred By:</span> <span className="font-medium text-gray-900">{patient.referredBy || 'N/A'}</span></div>
              </div>
            </div>
            <div><h4 className="text-sm font-semibold text-gray-900 uppercase border-b pb-2 mb-3">Medical Info</h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-700">EMR:</span> <span className="font-medium text-gray-900">{patient.emrNumber}</span></div>
                <div><span className="text-gray-700">Doctor:</span> <span className="font-medium text-gray-900">{patient.doctor}</span></div>
                <div><span className="text-gray-700">Service:</span> <span className="font-medium text-gray-900">{patient.service}</span></div>
                <div><span className="text-gray-700">Treatment:</span> <span className="font-medium text-gray-900">{patient.treatment || 'N/A'}</span></div>
                <div><span className="text-gray-700">Package:</span> <span className="font-medium text-gray-900">{patient.package || 'N/A'}</span></div>
                <div><span className="text-gray-700">Status:</span> <span className={`px-2 py-1 text-xs font-medium rounded ${patient.status === 'Completed' ? 'bg-blue-100 text-blue-700' : patient.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-700'}`}>{patient.status}</span></div>
              </div>
            </div>
            <div><h4 className="text-sm font-semibold text-gray-900 uppercase border-b pb-2 mb-3">Invoice Info</h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-700">Invoice No:</span> <span className="font-medium text-gray-900">{patient.invoiceNumber}</span></div>
                <div><span className="text-gray-700">Invoiced By:</span> <span className="font-medium text-gray-900">{patient.invoicedBy}</span></div>
                <div><span className="text-gray-700">Date:</span> <span className="font-medium text-gray-900">{new Date(patient.invoicedDate).toLocaleDateString()}</span></div>
                <div><span className="text-gray-700">Method:</span> <span className="font-medium text-gray-900">{patient.paymentMethod}</span></div>
              </div>
            </div>
            <div><h4 className="text-sm font-semibold text-gray-900 uppercase border-b pb-2 mb-3">Financial Info</h4>
              <div className="space-y-2 text-sm">
                <div><span className="text-gray-700">Total:</span> <span className="font-semibold text-gray-900">د.إ{patient.amount?.toLocaleString() || 0}</span></div>
                <div><span className="text-gray-700">Paid:</span> <span className="font-semibold text-emerald-600">د.إ{patient.paid?.toLocaleString() || 0}</span></div>
                <div><span className="text-gray-700">Advance:</span> <span className="font-semibold text-blue-600">د.إ{patient.advance?.toLocaleString() || 0}</span></div>
                <div><span className="text-gray-700">Pending:</span> <span className="font-semibold text-rose-600">د.إ{patient.pending?.toLocaleString() || 0}</span></div>
              </div>
            </div>
          </div>
          <div><h4 className="text-sm font-semibold text-gray-900 uppercase border-b pb-2 mb-3">Insurance Info</h4>
            <div className="grid md:grid-cols-3 gap-3 text-sm">
              <div><span className="text-gray-700">Insurance:</span> <span className="font-medium text-gray-900">{patient.insurance}</span></div>
              <div><span className="text-gray-700">Type:</span> <span className="font-medium text-gray-900">{patient.insuranceType || 'N/A'}</span></div>
              <div><span className="text-gray-700">Advance Given:</span> <span className="font-medium text-gray-900">د.إ{patient.advanceGivenAmount?.toLocaleString() || 0}</span></div>
              <div><span className="text-gray-700">Co-Pay:</span> <span className="font-medium text-gray-900">{patient.coPayPercent || 0}%</span></div>
              <div><span className="text-gray-700">Need To Pay:</span> <span className="font-medium text-gray-900">د.إ{patient.needToPay?.toLocaleString() || 0}</span></div>
              <div><span className="text-gray-700">Claim Status:</span> <span className={`px-2 py-1 text-xs font-medium rounded ${patient.advanceClaimStatus === 'Released' ? 'bg-emerald-100 text-emerald-700' : patient.advanceClaimStatus === 'Approved by doctor' ? 'bg-blue-100 text-blue-700' : patient.advanceClaimStatus === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{patient.advanceClaimStatus}</span></div>
            </div>
          </div>
          {patient.paymentHistory?.length > 0 && (
            <div><h4 className="text-sm font-semibold text-gray-900 uppercase border-b pb-2 mb-3">Payment History</h4>
              {patient.paymentHistory.map((p, i) => (
                <div key={p._id} className="bg-gray-50 rounded p-3 mb-2 text-xs">
                  <div className="flex justify-between mb-2"><span className="font-semibold text-gray-900">Payment #{i + 1}</span><span className="text-gray-700">{new Date(p.updatedAt).toLocaleString()}</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    <div><span className="text-gray-700">Amount:</span> <span className="text-gray-900">د.إ{p.amount?.toLocaleString()}</span></div>
                    <div><span className="text-gray-700">Paid:</span> <span className="text-gray-900">د.إ{p.paid?.toLocaleString()}</span></div>
                    <div><span className="text-gray-700">Advance:</span> <span className="text-gray-900">د.إ{p.advance?.toLocaleString()}</span></div>
                    <div><span className="text-gray-700">Pending:</span> <span className="text-gray-900">د.إ{p.pending?.toLocaleString()}</span></div>
                    <div><span className="text-gray-700">Paying:</span> <span className="text-gray-900">د.إ{p.paying?.toLocaleString()}</span></div>
                    <div><span className="text-gray-700">Method:</span> <span className="text-gray-900">{p.paymentMethod}</span></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
          <button onClick={onClose} className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">Close</button>
        </div>
      </div>
    </div>
  );
};

const PatientCard = ({ patient, onUpdate, onViewDetails }) => (
  <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
    <div className="flex items-start justify-between mb-3">
      <div className="flex-1 min-w-0">
        <h3 className="text-base font-semibold text-gray-900 truncate">{patient.firstName} {patient.lastName}</h3>
        <p className="text-sm text-gray-700">{patient.mobileNumber}</p>
        <p className="text-xs text-gray-700">{patient.email}</p>
      </div>
      <div className="flex flex-col gap-1 ml-2">
        {patient.advanceClaimStatus && (
          <span className={`px-2 py-1 text-xs font-medium rounded text-center whitespace-nowrap ${patient.advanceClaimStatus === 'Released' ? 'bg-emerald-100 text-emerald-700' : patient.advanceClaimStatus === 'Approved by doctor' ? 'bg-blue-100 text-blue-700' : patient.advanceClaimStatus === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{patient.advanceClaimStatus}</span>
        )}
      </div>
    </div>
    <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
      <div><p className="text-gray-700">EMR Number</p><p className="font-medium text-gray-900">{patient.emrNumber}</p></div>
      <div><p className="text-gray-700">Invoice No</p><p className="font-medium text-gray-900">{patient.invoiceNumber}</p></div>
      <div><p className="text-gray-700">Total Amount</p><p className="font-semibold text-gray-900">د.إ{patient.amount?.toLocaleString() || 0}</p></div>
      <div><p className="text-gray-700">Paid Amount</p><p className="font-semibold text-emerald-600">د.إ{patient.paid?.toLocaleString() || 0}</p></div>
      <div><p className="text-gray-700">Advance Payment</p><p className="font-semibold text-blue-600">د.إ{patient.advance?.toLocaleString() || 0}</p></div>
      <div><p className="text-gray-700">Amount Pending</p><p className="font-semibold text-rose-600">د.إ{patient.pending?.toLocaleString() || 0}</p></div>
      <div><p className="text-gray-700">Insurance</p><p className="font-medium text-gray-900">{patient.insurance || 'No'}</p></div>
      <div><p className="text-gray-700">Payment Type</p><p className="font-medium text-gray-900">{patient.paymentMethod || 'N/A'}</p></div>
    </div>
    {patient.notes && (
      <div className="mb-3 text-xs">
        <p className="text-gray-700">Notes</p>
        <p className="font-medium text-gray-900 break-words">{patient.notes}</p>
      </div>
    )}
    <div className="mb-3 flex gap-2 flex-wrap">
      {patient.patientType && <span className="inline-flex px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-700">{patient.patientType}</span>}
    </div>
    <div className="flex gap-2">
      <button onClick={() => onUpdate(patient._id)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"><Edit3 className="w-4 h-4" /> Update</button>
      <button onClick={() => onViewDetails(patient)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"><Eye className="w-4 h-4" /> View More</button>
    </div>
  </div>
);

function PatientFilterUI({ hideHeader = false }) {
  const router = useRouter();
  const [filters, setFilters] = useState({ emrNumber: "", invoiceNumber: "", name: "", phone: "", claimStatus: "", applicationStatus: "", dateFrom: "", dateTo: "" });
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState([]);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, patient: null });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const pageSize = 12;

  const addToast = (message, type = "info") => setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  const filteredPatients = patients;
  const totalPages = Math.ceil(filteredPatients.length / pageSize);
  const displayedPatients = filteredPatients.slice((page - 1) * pageSize, page * pageSize);

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some(value => value !== "" && value !== null && value !== undefined);

  // Calculate stats
  const totalPatients = patients.length;
  const activePatients = patients.filter(p => p.status === 'Active' || p.applicationStatus === 'Active').length;
  const totalRevenue = patients.reduce((sum, p) => sum + (p.amount || 0), 0);

  const fetchPatients = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      addToast("Authentication required. Please login again.", "error");
      return;
    }
    setLoading(true);
    try {
      const { data } = await axios.get("/api/staff/get-patient-registrations", { params: filters, headers });
      setPatients(data.success ? data.data : []);
      setPage(1);
      addToast("Data loaded successfully", "success");
    } catch (err) {
      console.error(err);
      setPatients([]);
      addToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPatients(); }, []);

  const handleUpdate = (id) => {
    const isClinicRoute = router.pathname?.startsWith('/clinic/') || (typeof window !== 'undefined' && window.location.pathname?.startsWith('/clinic/'));
    if (isClinicRoute) {
      router.push(`/clinic/update-patient-info/${id}`);
    } else {
      router.push(`/staff/update-patient-info/${id}`);
    }
  };

  const getStatusBadge = (status) => {
    const statusLower = (status || '').toLowerCase();
    if (statusLower === 'active' || statusLower === 'completed') {
      return <span className="px-2 py-1 text-[10px] font-medium rounded bg-emerald-100 text-emerald-700">active</span>;
    }
    if (statusLower === 'pending') {
      return <span className="px-2 py-1 text-[10px] font-medium rounded bg-amber-100 text-amber-700">pending</span>;
    }
    return <span className="px-2 py-1 text-[10px] font-medium rounded bg-gray-100 text-gray-700 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>expired</span>;
  };

  return (
    <>
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes scaleIn{from{transform:scale(0.9);opacity:0}to{transform:scale(1);opacity:1}}.animate-slideIn{animation:slideIn 0.3s ease-out}.animate-scaleIn{animation:scaleIn 0.2s ease-out}`}</style>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <PatientDetailsModal isOpen={detailsModal.isOpen} onClose={() => setDetailsModal({ isOpen: false, patient: null })} patient={detailsModal.patient} />
      
      <div className={hideHeader ? "p-3 sm:p-4 md:p-6" : "min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6"}>
        <div className="max-w-7xl mx-auto space-y-3">
          {/* Header Section */}
          {!hideHeader && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 mb-0.5">Patient Management</h1>
                  <p className="text-gray-700 text-xs">View and manage all patient records and information</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md shadow hover:shadow-md transition-all duration-200 text-xs font-medium ${
                      hasActiveFilters || showAdvancedFilters
                        ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-2 border-blue-500'
                        : 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white'
                    }`}
                  >
                    <Filter className="h-3.5 w-3.5" />
                    <span>
                      Advanced Filters
                      {hasActiveFilters && <span className="ml-1 text-[10px] opacity-90">(Active)</span>}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}
          
          {/* Advanced Filters Button (shown when header is hidden) */}
          {hideHeader && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center justify-end">
                <button
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-md shadow hover:shadow-md transition-all duration-200 text-xs font-medium ${
                    hasActiveFilters || showAdvancedFilters
                      ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white border-2 border-blue-500'
                      : 'bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white'
                  }`}
                >
                  <Filter className="h-3.5 w-3.5" />
                  <span>
                    Advanced Filters
                    {hasActiveFilters && <span className="ml-1 text-[10px] opacity-90">(Active)</span>}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-gray-700 mb-0.5">Total Patients</p>
                  <p className="text-xl font-bold text-gray-900">{totalPatients}</p>
                </div>
                <div className="bg-blue-100 p-2 rounded-md">
                  <User className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-gray-700 mb-0.5">Active Patients</p>
                  <p className="text-xl font-bold text-green-600">{activePatients}</p>
                </div>
                <div className="bg-green-100 p-2 rounded-md">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-gray-700 mb-0.5">Total Revenue</p>
                  <p className="text-xl font-bold text-teal-600">د.إ {totalRevenue.toLocaleString()}</p>
                </div>
                <div className="bg-teal-100 p-2 rounded-md">
                  <DollarSign className="h-5 w-5 text-teal-600" />
                </div>
              </div>
            </div>
          </div>

          {/* Patients Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-teal-600" />
                <h2 className="text-base font-semibold text-gray-900">All Patients</h2>
              </div>
            </div>

            <div className="p-3">
              {loading ? (
                <div className="text-center py-10">
                  <div className="w-10 h-10 border-3 border-gray-200 border-t-teal-600 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-gray-600">Loading...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">PATIENT DETAILS</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">EMR NUMBER</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">TOTAL AMOUNT</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">PAID</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">PENDING</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">STATUS</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedPatients.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="py-10 text-center">
                            <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full mb-2.5">
                              <User className="h-6 w-6 text-gray-500" />
                            </div>
                            <h3 className="text-sm font-medium text-gray-900 mb-1">No patients found</h3>
                            <p className="text-gray-700 text-xs">Try adjusting your filters</p>
                          </td>
                        </tr>
                      ) : (
                        displayedPatients.map((patient) => (
                          <tr key={patient._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-emerald-100 rounded flex items-center justify-center flex-shrink-0">
                                  <User className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div>
                                  <p className="text-xs font-medium text-gray-900">{patient.firstName} {patient.lastName}</p>
                                  <p className="text-[10px] text-gray-500">{patient.mobileNumber}</p>
                                </div>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs font-medium text-gray-900">{patient.emrNumber}</p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs font-semibold text-gray-900">د.إ{patient.amount?.toLocaleString() || 0}</p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs font-semibold text-emerald-600">د.إ{patient.paid?.toLocaleString() || 0}</p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs font-semibold text-rose-600">د.إ{patient.pending?.toLocaleString() || 0}</p>
                            </td>
                            <td className="py-3 px-3">
                              {getStatusBadge(patient.status || patient.applicationStatus)}
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleUpdate(patient._id)}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title="Edit"
                                >
                                  <Edit3 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => setDetailsModal({ isOpen: true, patient })}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-xs text-gray-600">Page <span className="font-medium text-gray-800">{page}</span> of <span className="font-medium text-gray-800">{totalPages}</span></p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                  {[...Array(Math.min(totalPages, 5))].map((_, idx) => {
                    const pageNum = totalPages <= 5 ? idx + 1 : page <= 3 ? idx + 1 : page >= totalPages - 2 ? totalPages - 4 + idx : page - 2 + idx;
                    return <button key={idx} onClick={() => setPage(pageNum)} className={`w-8 h-8 rounded text-xs font-medium ${page === pageNum ? 'bg-teal-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-white'}`}>{pageNum}</button>;
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>

          {/* Filter Panel */}
          {showAdvancedFilters && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Advanced Filters</h3>
                <button
                  onClick={() => setShowAdvancedFilters(false)}
                  className="p-1 hover:bg-gray-100 rounded text-gray-500"
                  aria-label="Close filters"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input type="text" placeholder="EMR Number" value={filters.emrNumber} onChange={e => setFilters({ ...filters, emrNumber: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs text-gray-800" />
                <input type="text" placeholder="Invoice Number" value={filters.invoiceNumber} onChange={e => setFilters({ ...filters, invoiceNumber: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs text-gray-800" />
                <input type="text" placeholder="Patient Name" value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs text-gray-800" />
                <input type="text" placeholder="Phone" value={filters.phone} onChange={e => setFilters({ ...filters, phone: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs text-gray-800" />
                <select value={filters.claimStatus} onChange={e => setFilters({ ...filters, claimStatus: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs text-gray-800 bg-white">
                  <option value="">All Claim Status</option><option value="Pending">Pending</option><option value="Released">Released</option><option value="Cancelled">Cancelled</option>
                </select>
                <select value={filters.applicationStatus} onChange={e => setFilters({ ...filters, applicationStatus: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs text-gray-800 bg-white">
                  <option value="">All App Status</option><option value="Active">Active</option><option value="Cancelled">Cancelled</option><option value="Completed">Completed</option>
                </select>
                <input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs text-gray-800" />
                <input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 outline-none text-xs text-gray-800" />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button onClick={fetchPatients} className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-medium transition-colors">Apply Filters</button>
                <button 
                  onClick={() => {
                    setFilters({ emrNumber: "", invoiceNumber: "", name: "", phone: "", claimStatus: "", applicationStatus: "", dateFrom: "", dateTo: "" });
                    fetchPatients();
                  }} 
                  className="px-6 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

PatientFilterUI.getLayout = function PageLayout(page) { return <ClinicLayout>{page}</ClinicLayout>; };
const ProtectedDashboard = withClinicAuth(PatientFilterUI);
ProtectedDashboard.getLayout = PatientFilterUI.getLayout;
export default ProtectedDashboard;
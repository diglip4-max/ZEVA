import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { Package, TrendingUp, Eye, Search, ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle2, Info, Edit3, User, DollarSign, Mail, Phone, Calendar, FileText, MapPin, Building2, CreditCard, Trash2, Download } from "lucide-react";
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-3xl w-full my-2 sm:my-4 md:my-8 animate-scaleIn max-h-[95vh] sm:max-h-[90vh] md:max-h-[85vh] overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-gray-50 border-b px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
            <User className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 flex-shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">Patient Details</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ml-2"><X className="w-4 h-4 sm:w-5 sm:h-5" /></button>
        </div>
        <div className="p-3 sm:p-4 space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
          <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold text-gray-900 uppercase border-b pb-2 mb-3 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                Personal Info
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2"><span className="text-gray-700 w-20">Name:</span> <span className="font-medium text-gray-900">{patient.firstName} {patient.lastName}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-700 w-20">Gender:</span> <span className="font-medium text-gray-900">{patient.gender}</span></div>
                <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-700 w-20">Email:</span> <span className="font-medium text-gray-900">{patient.email}</span></div>
                <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-700 w-20">Mobile:</span> <span className="font-medium text-gray-900">{patient.mobileNumber}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-700 w-20">Type:</span> <span className="font-medium text-gray-900">{patient.patientType}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-700 w-20">Referred:</span> <span className="font-medium text-gray-900">{patient.referredBy || 'N/A'}</span></div>
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-3">
              <h4 className="text-xs font-semibold text-gray-900 uppercase border-b pb-2 mb-3 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Invoice Info
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2"><span className="text-gray-700 w-20">Invoice:</span> <span className="font-medium text-gray-900">{patient.invoiceNumber}</span></div>
                <div className="flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-700 w-20">By:</span> <span className="font-medium text-gray-900">{patient.invoicedBy}</span></div>
                <div className="flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-gray-400" /><span className="text-gray-700 w-20">Date:</span> <span className="font-medium text-gray-900">{new Date(patient.invoicedDate).toLocaleDateString()}</span></div>
                <div className="flex items-center gap-2"><span className="text-gray-700 w-20">EMR:</span> <span className="font-medium text-gray-900">{patient.emrNumber || 'N/A'}</span></div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-3">
            <h4 className="text-xs font-semibold text-gray-900 uppercase border-b pb-2 mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              Insurance Info
            </h4>
            <div className="grid md:grid-cols-3 gap-3 text-xs">
              <div className="flex items-center gap-2"><span className="text-gray-700">Insurance:</span> <span className="font-medium text-gray-900">{patient.insurance}</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-700">Type:</span> <span className="font-medium text-gray-900">{patient.insuranceType || 'N/A'}</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-700">Advance:</span> <span className="font-medium text-gray-900">د.إ{patient.advanceGivenAmount?.toLocaleString() || 0}</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-700">Co-Pay:</span> <span className="font-medium text-gray-900">{patient.coPayPercent || 0}%</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-700">Need To Pay:</span> <span className="font-medium text-gray-900">د.إ{patient.needToPay?.toLocaleString() || 0}</span></div>
              <div className="flex items-center gap-2"><span className="text-gray-700">Claim:</span> <span className={`px-2 py-0.5 text-xs font-medium rounded ${patient.advanceClaimStatus === 'Released' ? 'bg-emerald-100 text-emerald-700' : patient.advanceClaimStatus === 'Approved by doctor' ? 'bg-blue-100 text-blue-700' : patient.advanceClaimStatus === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{patient.advanceClaimStatus}</span></div>
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
        <div className="sticky bottom-0 bg-gray-50 border-t px-3 sm:px-4 py-2 sm:py-3">
          <button onClick={onClose} className="w-full px-3 sm:px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-xs sm:text-sm font-medium transition-colors">Close</button>
        </div>
      </div>
    </div>
  );
};

const PatientCard = ({ patient, onUpdate, onViewDetails, canUpdate = true }) => (
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
      <div><p className="text-gray-700">Insurance</p><p className="font-medium text-gray-900">{patient.insurance || 'No'}</p></div>
      <div><p className="text-gray-700">Patient Type</p><p className="font-medium text-gray-900">{patient.patientType || 'N/A'}</p></div>
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
      {canUpdate && (
        <button onClick={() => onUpdate(patient._id)} className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors"><Edit3 className="w-4 h-4" /> Update</button>
      )}
      <button onClick={() => onViewDetails(patient)} className={`${canUpdate ? 'flex-1' : 'w-full'} inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-700 hover:bg-gray-800 text-white text-sm font-medium rounded-lg transition-colors`}><Eye className="w-4 h-4" /> View More</button>
    </div>
  </div>
);

function PatientFilterUI({ hideHeader = false, onEditPatient, permissions = { canRead: true, canUpdate: true, canDelete: true, canCreate: true }, routeContext = "clinic" }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState([]);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, patient: null });
  const [deleteSuccessModal, setDeleteSuccessModal] = useState({ isOpen: false, patientName: "" });
  const pageSize = 12;

  const addToast = (message, type = "info") => setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // Filter patients by search query
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const query = searchQuery.toLowerCase();
    return patients.filter(patient => 
      (patient.firstName && patient.firstName.toLowerCase().includes(query)) ||
      (patient.lastName && patient.lastName.toLowerCase().includes(query)) ||
      (patient.mobileNumber && patient.mobileNumber.includes(query)) ||
      (patient.emrNumber && patient.emrNumber.toLowerCase().includes(query)) ||
      (patient.invoiceNumber && patient.invoiceNumber.toLowerCase().includes(query)) ||
      (patient.email && patient.email.toLowerCase().includes(query))
    );
  }, [patients, searchQuery]);
  
  const totalPages = Math.ceil(filteredPatients.length / pageSize);
  const displayedPatients = filteredPatients.slice((page - 1) * pageSize, page * pageSize);

  // Calculate stats
  const totalPatients = patients.length;
  const activePatients = patients.filter(p => p.status === 'Active' || p.applicationStatus === 'Active').length;

  const fetchPatients = async () => {
    const headers = getAuthHeaders();
    if (!headers) {
      addToast("Authentication required. Please login again.", "error");
      return;
    }
    setLoading(true);
    try {
      // Always use clinic API endpoint for consistency - it supports clinic, agent, and doctorStaff roles
      const apiEndpoint = "/api/clinic/patient-information";
      const { data } = await axios.get(apiEndpoint, { headers });
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

  useEffect(() => { fetchPatients(); }, [routeContext]);

  const exportPatientsToCSV = () => {
    if (patients.length === 0) {
      addToast("No patients to export", "error");
      return;
    }

    const headers = [
      "First Name",
      "Last Name",
      "Email",
      "Mobile Number",
      "Gender",
      "Patient Type",
      "EMR Number",
      "Invoice Number",
      "Insurance",
      "Created At"
    ];

    const csvContent = [
      headers.join(","),
      ...patients.map(p => [
        `"${(p.firstName || "").replace(/"/g, '""')}"`,
        `"${(p.lastName || "").replace(/"/g, '""')}"`,
        `"${(p.email || "").replace(/"/g, '""')}"`,
        `"${(p.mobileNumber || "").replace(/"/g, '""')}"`,
        `"${(p.gender || "").replace(/"/g, '""')}"`,
        `"${(p.patientType || "").replace(/"/g, '""')}"`,
        `"${(p.emrNumber || "").replace(/"/g, '""')}"`,
        `"${(p.invoiceNumber || "").replace(/"/g, '""')}"`,
        `"${(p.insurance || "").replace(/"/g, '""')}"`,
        `"${p.createdAt ? new Date(p.createdAt).toLocaleString() : ""}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `patients_export_${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast("Patients exported successfully", "success");
  };

  const handleUpdate = (id) => {
    if (typeof onEditPatient === "function") {
      onEditPatient(id);
      return;
    }
    const isClinicRoute = router.pathname?.startsWith('/clinic/') || (typeof window !== 'undefined' && window.location.pathname?.startsWith('/clinic/'));
    if (isClinicRoute) {
      router.push(`/clinic/update-patient-info/${id}`);
    } else {
      router.push(`/staff/update-patient-info/${id}`);
    }
  };

  const handleDelete = async (patientId, patientName) => {
    if (!window.confirm(`Are you sure you want to delete ${patientName || 'this patient'}? This action cannot be undone.`)) {
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      addToast("Authentication required. Please login again.", "error");
      return;
    }

    try {
      // Use clinic API endpoint for consistency - it supports clinic, agent, and doctorStaff roles
      const response = await axios.delete("/api/clinic/patient-information", {
        headers,
        data: { id: patientId }
      });

      if (response.data.success) {
        // Show success popup
        setDeleteSuccessModal({ isOpen: true, patientName: patientName });
        // Refresh the patient list
        fetchPatients();
      } else {
        addToast(response.data.message || "Failed to delete patient", "error");
      }
    } catch (err) {
      console.error("Delete error:", err);
      addToast(err.response?.data?.message || "Failed to delete patient", "error");
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
      
      {/* Delete Success Modal */}
      {deleteSuccessModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDeleteSuccessModal({ isOpen: false, patientName: "" })} />
          <div className="relative bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-md w-full my-2 sm:my-4 animate-scaleIn">
            <div className="p-4 sm:p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">
                  Patient Deleted Successfully
                </h3>
                <p className="text-sm text-gray-700 mb-6">
                  {deleteSuccessModal.patientName ? (
                    <>Patient <span className="font-semibold">{deleteSuccessModal.patientName}</span> has been deleted successfully.</>
                  ) : (
                    "The patient has been deleted successfully."
                  )}
                </p>
                <button
                  onClick={() => setDeleteSuccessModal({ isOpen: false, patientName: "" })}
                  className="w-full px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
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
              </div>
            </div>
          )}
          
          {/* Simple Search Bar */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by name, phone, EMR number, invoice number, or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 outline-none text-sm text-gray-900"
                />
              </div>
              {/* <button
                onClick={exportPatientsToCSV}
                className="inline-flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                <span>Export</span>
              </button> */}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
          </div>

          {/* Patients Table */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center gap-3">
                <Package className="h-4 w-4 text-gray-700" />
                <h2 className="text-base font-semibold text-gray-900">All Patients</h2>
              </div>
            </div>

            <div className="p-3">
              {loading ? (
                <div className="text-center py-10">
                  <div className="w-10 h-10 border-3 border-gray-200 border-t-gray-800 rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-sm text-gray-600">Loading...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">NAME</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">EMR NUMBER</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">GENDER</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">EMAIL</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">MOBILE</th>
                        <th className="text-left py-2.5 px-3 text-[11px] font-semibold text-gray-700 uppercase">TYPE</th>
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
                              <p className="text-xs font-medium text-gray-900">{patient.firstName} {patient.lastName}</p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs font-medium text-gray-900">{patient.emrNumber || '-'}</p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs text-gray-900">{patient.gender || '-'}</p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs text-gray-900">{patient.email || '-'}</p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs text-gray-900">{patient.mobileNumber || '-'}</p>
                            </td>
                            <td className="py-3 px-3">
                              <p className="text-xs text-gray-900">{patient.patientType || '-'}</p>
                            </td>
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2">
                                {permissions.canUpdate && (
                                  <button
                                    onClick={() => handleUpdate(patient._id)}
                                    className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                    title="Edit"
                                  >
                                    <Edit3 className="h-4 w-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => setDetailsModal({ isOpen: true, patient })}
                                  className="p-1.5 text-gray-700 hover:bg-gray-100 rounded transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {permissions.canDelete && (
                                  <button
                                    onClick={() => handleDelete(patient._id, `${patient.firstName} ${patient.lastName}`)}
                                    className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                )}
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
                    return <button key={idx} onClick={() => setPage(pageNum)} className={`w-8 h-8 rounded text-xs font-medium ${page === pageNum ? 'bg-gray-800 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{pageNum}</button>;
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 border border-gray-300 rounded hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </>
  );
}

PatientFilterUI.getLayout = function PageLayout(page) { return <ClinicLayout>{page}</ClinicLayout>; };
const ProtectedDashboard = withClinicAuth(PatientFilterUI);
ProtectedDashboard.getLayout = PatientFilterUI.getLayout;

// Export PatientFilterUI as named export for use in other components
export { PatientFilterUI as PatientInformation };
export default ProtectedDashboard;
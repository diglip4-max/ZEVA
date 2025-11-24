import React, { useState, useEffect } from "react";
import axios from "axios";
import { Filter, Eye, Search, ChevronLeft, ChevronRight, X, AlertCircle, CheckCircle2, Info, Edit3 } from "lucide-react";
import { useRouter } from "next/router";
import ClinicLayout from '../../components/staffLayout';
import withClinicAuth from '../../components/withStaffAuth';

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

function PatientFilterUI() {
  const router = useRouter();
  const [filters, setFilters] = useState({ emrNumber: "", invoiceNumber: "", name: "", phone: "", claimStatus: "", applicationStatus: "", dateFrom: "", dateTo: "" });
  const [search, setSearch] = useState("");
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState([]);
  const [detailsModal, setDetailsModal] = useState({ isOpen: false, patient: null });
  const pageSize = 12;

  const addToast = (message, type = "info") => setToasts(prev => [...prev, { id: Date.now(), message, type }]);
  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));
  const token = typeof window !== "undefined" ? localStorage.getItem("userToken") : null;

  const filteredPatients = patients.filter(item => search.trim() === "" || `${item.firstName} ${item.lastName} ${item.emrNumber} ${item.invoiceNumber} ${item.mobileNumber}`.toLowerCase().includes(search.trim().toLowerCase()));
  const totalPages = Math.ceil(filteredPatients.length / pageSize);
  const displayedPatients = filteredPatients.slice((page - 1) * pageSize, page * pageSize);

  const fetchPatients = async () => {
    if (!token) return addToast("Session expired. Please login again.", "error");
    setLoading(true);
    try {
      const { data } = await axios.get("/api/staff/get-patient-registrations", { params: filters, headers: { Authorization: `Bearer ${token}` } });
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

  const handleUpdate = (id) => router.push(`/staff/update-patient-info/${id}`);

  return (
    <>
      <style>{`@keyframes slideIn{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}@keyframes scaleIn{from{transform:scale(0.9);opacity:0}to{transform:scale(1);opacity:1}}.animate-slideIn{animation:slideIn 0.3s ease-out}.animate-scaleIn{animation:scaleIn 0.2s ease-out}`}</style>
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <PatientDetailsModal isOpen={detailsModal.isOpen} onClose={() => setDetailsModal({ isOpen: false, patient: null })} patient={detailsModal.patient} />
      <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0"><Filter className="w-5 h-5 text-white" /></div>
              <div><h1 className="text-lg sm:text-xl font-semibold text-gray-800">Patient Filter</h1><p className="text-xs sm:text-sm text-gray-600">Search and manage records</p></div>
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input type="text" placeholder="Search patients..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm text-gray-800" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <input type="text" placeholder="EMR Number" value={filters.emrNumber} onChange={e => setFilters({ ...filters, emrNumber: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800" />
              <input type="text" placeholder="Invoice Number" value={filters.invoiceNumber} onChange={e => setFilters({ ...filters, invoiceNumber: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800" />
              <input type="text" placeholder="Patient Name" value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800" />
              <input type="text" placeholder="Phone" value={filters.phone} onChange={e => setFilters({ ...filters, phone: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800" />
              <select value={filters.claimStatus} onChange={e => setFilters({ ...filters, claimStatus: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 bg-white">
                <option value="">All Claim Status</option><option value="Pending">Pending</option><option value="Released">Released</option><option value="Cancelled">Cancelled</option>
              </select>
              <select value={filters.applicationStatus} onChange={e => setFilters({ ...filters, applicationStatus: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800 bg-white">
                <option value="">All App Status</option><option value="Active">Active</option><option value="Cancelled">Cancelled</option><option value="Completed">Completed</option>
              </select>
              <input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800" />
              <input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm text-gray-800" />
            </div>
            <button onClick={fetchPatients} className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2"><Filter className="w-4 h-4" /> Apply Filters</button>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3"><span className="font-medium text-gray-800">{filteredPatients.length}</span> results found</p>
            {loading ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 flex flex-col items-center gap-3"><div className="w-10 h-10 border-3 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div><p className="text-sm text-gray-600">Loading...</p></div>
            ) : displayedPatients.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{displayedPatients.map(patient => <PatientCard key={patient._id} patient={patient} onUpdate={handleUpdate} onViewDetails={(p) => setDetailsModal({ isOpen: true, patient: p })} />)}</div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 p-12 flex flex-col items-center gap-2"><Search className="w-12 h-12 text-gray-300" /><p className="text-sm text-gray-600">No records found</p></div>
            )}
          </div>
          {totalPages > 1 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-600">Page <span className="font-medium text-gray-800">{page}</span> of <span className="font-medium text-gray-800">{totalPages}</span></p>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
                {[...Array(Math.min(totalPages, 5))].map((_, idx) => {
                  const pageNum = totalPages <= 5 ? idx + 1 : page <= 3 ? idx + 1 : page >= totalPages - 2 ? totalPages - 4 + idx : page - 2 + idx;
                  return <button key={idx} onClick={() => setPage(pageNum)} className={`w-9 h-9 rounded-lg text-sm font-medium ${page === pageNum ? 'bg-blue-600 text-white' : 'border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{pageNum}</button>;
                })}
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
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
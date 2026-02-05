import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import { Eye, CheckCircle, AlertCircle, X } from "lucide-react";

const TOKEN_PRIORITY = ["clinicToken", "doctorToken", "agentToken", "staffToken", "userToken", "adminToken"];
const getStoredToken = () => {
  if (typeof window === "undefined") return null;
  for (const key of TOKEN_PRIORITY) {
    const v = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (v) return v;
  }
  return null;
};
const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

function ClinicCommissionPage() {
  const [source, setSource] = useState("referral");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalItems, setModalItems] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [lastSource, setLastSource] = useState("referral"); // Track last source to detect changes

  const showToast = useCallback((message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 2500);
  }, []);

  const load = useCallback(async () => {
    const headers = getAuthHeaders();
    if (!headers) return;
    setLoading(true);
    try {
      const res = await axios.get("/api/clinic/commissions/summary", {
        params: { source },
        headers,
      });
      if (res.data.success) {
        setItems(res.data.items || []);
      } else {
        showToast(res.data.message || "Failed to load commissions", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    } finally {
      setLoading(false);
    }
  }, [source, showToast]);

  useEffect(() => {
    load();
    // Clear modal when source changes
    if (source !== lastSource) {
      setShowModal(false);
      setModalItems([]);
      setSelectedPerson(null);
      setLastSource(source);
    }
  }, [load, source, lastSource]);

  const openDetails = async (row) => {
    const headers = getAuthHeaders();
    if (!headers) {
      showToast("Authentication required", "error");
      return;
    }
    
    // Clear previous data and show modal
    setSelectedPerson(null);
    setModalItems([]);
    setShowModal(true);
    setModalLoading(true);
    
    try {
      // Small delay to ensure UI updates
      await new Promise(resolve => setTimeout(resolve, 100));
      
      setSelectedPerson(row);
      const params =
        row.source === "referral"
          ? { source: "referral", referralId: row.personId }
          : { source: "staff", staffId: row.personId };
      const res = await axios.get("/api/clinic/commissions/by-person", {
        params,
        headers,
      });
      if (res.data.success) {
        setModalItems(res.data.items || []);
      } else {
        showToast(res.data.message || "Failed to load history", "error");
        setShowModal(false);
      }
    } catch (err) {
      showToast("Network error", "error");
      setShowModal(false);
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      {toast && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-lg text-white shadow-lg flex items-center gap-2 ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          <span className="text-sm">{toast.message}</span>
          <button className="hover:bg-white/10 rounded p-1" onClick={() => setToast(null)}>
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-teal-900">Commission Tracker</h2>
              <p className="text-xs sm:text-sm text-teal-600">Referral and doctor/staff commissions</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${source === "referral" ? "bg-teal-600 text-white shadow-sm hover:bg-teal-700" : "bg-white text-teal-700 border border-gray-300 hover:bg-teal-50"}`}
                onClick={() => {
                  if (source !== "referral") {
                    setSource("referral");
                  }
                }}
              >
                Referral
              </button>
              <button
                className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${source === "staff" ? "bg-teal-600 text-white shadow-sm hover:bg-teal-700" : "bg-white text-teal-700 border border-gray-300 hover:bg-teal-50"}`}
                onClick={() => {
                  if (source !== "staff") {
                    setSource("staff");
                  }
                }}
              >
                Doctor/Staff
              </button>
              <button 
                className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 text-teal-700 hover:bg-teal-50 transition-all"
                onClick={load}
              >
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-teal-600">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-sm text-teal-600">No commissions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">%</th>
                    <th className="px-4 py-3 font-medium">Earned</th>
                    <th className="px-4 py-3 font-medium">Paid</th>
                    <th className="px-4 py-3 font-medium">Count</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={`${row.source}-${row.personId}`} className="border-t border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">{row.name || "—"}</td>
                      <td className="px-4 py-3">{row.source === "referral" ? "Referral" : "Doctor/Staff"}</td>
                      <td className="px-4 py-3">{row.percent ?? 0}</td>
                      <td className="px-4 py-3">₹ {Number(row.totalEarned || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">₹ {Number(row.totalPaid || 0).toFixed(2)}</td>
                      <td className="px-4 py-3">{row.count}</td>
                      <td className="px-4 py-3">
                        <button
                          className="px-3 py-1.5 text-xs rounded-md bg-teal-600 hover:bg-teal-700 text-white flex items-center gap-1 font-medium transition-all shadow-sm"
                          onClick={() => openDetails(row)}
                        >
                          <Eye className="w-3 h-3" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal Popup */}
        {showModal && (
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div>
                  <h3 className="text-xl font-bold text-teal-900">
                    {selectedPerson?.source === "referral" ? "Referral History" : "Doctor/Staff History"}
                  </h3>
                  <p className="text-sm text-teal-600 mt-1">{selectedPerson?.name || ""}</p>
                </div>
                <button 
                  className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                  onClick={() => setShowModal(false)}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-5">
                {modalLoading ? (
                  <div className="text-center py-6">
                    <div className="inline-flex items-center px-4 py-2 bg-teal-50 rounded-lg">
                      <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                      <span className="text-teal-700 font-medium">Loading history...</span>
                    </div>
                  </div>
                ) : modalItems.length === 0 ? (
                  <div className="text-center py-6">
                    <div className="text-teal-600">No records found</div>
                  </div>
                ) : (
                  <div className="overflow-hidden max-h-[50vh]">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Patient</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Mobile</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Paid</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Earned</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Commission</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Doctor</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {modalItems.map((it) => (
                          <tr key={it.commissionId} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">{it.patientName || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{it.patientMobile || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{it.invoiceNumber || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">₹ {Number(it.paidAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">₹ {Number(it.commissionAmount || 0).toFixed(2)}</td>
                            <td className="px-4 py-3 whitespace-nowrap">₹ {Number(it.commissionAmount || 0).toFixed(2)} ({Number(it.commissionPercent || 0)}%)</td>
                            <td className="px-4 py-3 whitespace-nowrap">{it.doctorName || "—"}</td>
                            <td className="px-4 py-3 whitespace-nowrap">{it.invoicedDate ? new Date(it.invoicedDate).toLocaleDateString() : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

ClinicCommissionPage.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedClinicCommissionPage = withClinicAuth(ClinicCommissionPage);
ProtectedClinicCommissionPage.getLayout = ClinicCommissionPage.getLayout;

export default ProtectedClinicCommissionPage;

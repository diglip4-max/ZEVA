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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsItems, setDetailsItems] = useState([]);
  const [selected, setSelected] = useState(null);

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
  }, [load]);

  const openDetails = async (row) => {
    const headers = getAuthHeaders();
    if (!headers) {
      showToast("Authentication required", "error");
      return;
    }
    setSelected(row);
    setDetailsOpen(true);
    setDetailsLoading(true);
    try {
      const params =
        row.source === "referral"
          ? { source: "referral", referralId: row.personId }
          : { source: "staff", staffId: row.personId };
      const res = await axios.get("/api/clinic/commissions/by-person", {
        params,
        headers,
      });
      if (res.data.success) {
        setDetailsItems(res.data.items || []);
      } else {
        showToast(res.data.message || "Failed to load history", "error");
      }
    } catch (err) {
      showToast("Network error", "error");
    } finally {
      setDetailsLoading(false);
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
        <div className="bg-white rounded-lg shadow-sm border border-teal-200 p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-teal-900">Commission Tracker</h2>
              <p className="text-[10px] sm:text-xs text-teal-700">Referral and doctorStaff commissions</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1.5 text-xs rounded-md border ${source === "referral" ? "bg-teal-900 text-white border-teal-900" : "bg-white text-teal-900 border-teal-300"}`}
                onClick={() => setSource("referral")}
              >
                Referral
              </button>
              <button
                className={`px-3 py-1.5 text-xs rounded-md border ${source === "staff" ? "bg-teal-900 text-white border-teal-900" : "bg-white text-teal-900 border-teal-300"}`}
                onClick={() => setSource("staff")}
              >
                Doctor/Staff
              </button>
              <button className="px-3 py-1.5 text-xs rounded-md border border-teal-300" onClick={load}>
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-xs text-gray-700">Loading...</div>
          ) : items.length === 0 ? (
            <div className="text-xs text-gray-700">No commissions found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[10px]">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="px-2 py-1">Name</th>
                    <th className="px-2 py-1">Type</th>
                    <th className="px-2 py-1">% Rate</th>
                    <th className="px-2 py-1">Earned</th>
                    <th className="px-2 py-1">Paid</th>
                    <th className="px-2 py-1">Count</th>
                    <th className="px-2 py-1">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={`${row.source}-${row.personId}`} className="border-t">
                      <td className="px-2 py-1">{row.name || "—"}</td>
                      <td className="px-2 py-1">{row.source === "referral" ? "Referral" : "Doctor/Staff"}</td>
                      <td className="px-2 py-1">{row.percent ?? 0}</td>
                      <td className="px-2 py-1">₹ {Number(row.totalEarned || 0).toFixed(2)}</td>
                      <td className="px-2 py-1">₹ {Number(row.totalPaid || 0).toFixed(2)}</td>
                      <td className="px-2 py-1">{row.count}</td>
                      <td className="px-2 py-1">
                        <button
                          className="px-2 py-1 text-[10px] rounded-md bg-teal-900 hover:bg-teal-800 text-white flex items-center gap-1"
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

        {detailsOpen && (
          <div className="mt-4 bg-white rounded-lg shadow-sm border border-teal-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-semibold text-teal-900">
                  {selected?.source === "referral" ? "Referral History" : "Doctor/Staff History"}
                </h3>
                <p className="text-[10px] text-teal-700">{selected?.name || ""}</p>
              </div>
              <button className="px-2 py-1 text-[10px] border border-teal-300 rounded-md" onClick={() => setDetailsOpen(false)}>
                Close
              </button>
            </div>
            {detailsLoading ? (
              <div className="text-xs text-gray-700">Loading history...</div>
            ) : detailsItems.length === 0 ? (
              <div className="text-xs text-gray-700">No records</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-[10px]">
                  <thead>
                    <tr className="text-left text-gray-600">
                      <th className="px-2 py-1">Patient</th>
                      <th className="px-2 py-1">Mobile</th>
                      <th className="px-2 py-1">Invoice</th>
                      <th className="px-2 py-1">Paid</th>
                      <th className="px-2 py-1">Commission</th>
                      <th className="px-2 py-1">Doctor</th>
                      <th className="px-2 py-1">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailsItems.map((it) => (
                      <tr key={it.commissionId} className="border-t">
                        <td className="px-2 py-1">{it.patientName || "—"}</td>
                        <td className="px-2 py-1">{it.patientMobile || "—"}</td>
                        <td className="px-2 py-1">{it.invoiceNumber || "—"}</td>
                        <td className="px-2 py-1">₹ {Number(it.paidAmount || 0).toFixed(2)}</td>
                        <td className="px-2 py-1">₹ {Number(it.commissionAmount || 0).toFixed(2)} ({Number(it.commissionPercent || 0)}%)</td>
                        <td className="px-2 py-1">{it.doctorName || "—"}</td>
                        <td className="px-2 py-1">{it.invoicedDate ? new Date(it.invoicedDate).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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


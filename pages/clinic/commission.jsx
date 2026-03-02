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
  const [expandedRow, setExpandedRow] = useState(null);
  const [patientInfoMap, setPatientInfoMap] = useState({});
  const [membershipList, setMembershipList] = useState([]);
  const [packageList, setPackageList] = useState([]);
  const [expandedMemberships, setExpandedMemberships] = useState({});
  const [expandedPackages, setExpandedPackages] = useState({});

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

  useEffect(() => {
    const headers = getAuthHeaders();
    if (!headers) return;
    (async () => {
      try {
        const [mRes, pRes] = await Promise.all([
          axios.get("/api/clinic/memberships", { headers }),
          axios.get("/api/clinic/packages", { headers }),
        ]);
        setMembershipList(Array.isArray(mRes.data?.memberships) ? mRes.data.memberships : []);
        setPackageList(Array.isArray(pRes.data?.packages) ? pRes.data.packages : []);
      } catch {}
    })();
  }, []);

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

  const toggleRow = async (row) => {
    const isExpanded = expandedRow === row.commissionId;
    if (isExpanded) {
      setExpandedRow(null);
      return;
    }
    setExpandedRow(row.commissionId);
    // Lazy-load patient info for tags (membership/package status) if not available
    if (row.patientId && !patientInfoMap[row.patientId]) {
      const headers = getAuthHeaders();
      if (!headers) return;
      try {
        const [basicRes, fullRes, pkgUsageRes] = await Promise.all([
          axios.get(`/api/clinic/${row.patientId}`, { headers }),
          axios.get(`/api/staff/get-patient-data/${row.patientId}`, { headers }),
          axios.get(`/api/clinic/package-usage/${row.patientId}`, { headers }).catch(() => ({ data: null })),
        ]);
        const full = fullRes?.data || null;
        const transferIds = new Set();
        if (full?.membershipTransfers) {
          full.membershipTransfers.forEach(t => {
            if (t.fromPatientId) transferIds.add(String(t.fromPatientId));
            if (t.toPatientId) transferIds.add(String(t.toPatientId));
          });
        }
        if (full?.packageTransfers) {
          full.packageTransfers.forEach(t => {
            if (t.fromPatientId) transferIds.add(String(t.fromPatientId));
            if (t.toPatientId) transferIds.add(String(t.toPatientId));
          });
        }
        const transferNameMap = {};
        await Promise.all(
          Array.from(transferIds).map(async (pid) => {
            try {
              const r = await axios.get(`/api/staff/get-patient-data/${pid}`, { headers });
              const d = r.data;
              const name = `${(d.firstName || "").trim()} ${(d.lastName || "").trim()}`.trim() || d.emrNumber || pid;
              transferNameMap[pid] = name;
            } catch {}
          })
        );
        const entries = [];
        const existing = Array.isArray(full?.memberships) ? full.memberships : [];
        const transferredIns = (full?.membershipTransfers || [])
          .filter(t => t.type === 'in')
          .map(t => ({ membershipId: t.membershipId, startDate: t.startDate, endDate: t.endDate }));
        const displayMemberships = [...existing];
        transferredIns.forEach(t => {
          const dup = displayMemberships.some(m =>
            String(m.membershipId) === String(t.membershipId) &&
            (!!m.startDate ? String(m.startDate) === String(t.startDate) : true) &&
            (!!m.endDate ? String(m.endDate) === String(t.endDate) : true)
          );
          if (!dup) displayMemberships.push(t);
        });
        displayMemberships.forEach(m => {
          if (m.membershipId && m.startDate && m.endDate) {
            entries.push({ membershipId: m.membershipId, startDate: m.startDate, endDate: m.endDate });
          }
        });
        const membershipUsageMap = {};
        await Promise.all(entries.map(async (e) => {
          const qs = new URLSearchParams();
          qs.set("membershipId", e.membershipId);
          qs.set("startDate", e.startDate);
          qs.set("endDate", e.endDate);
          try {
            const mRes = await axios.get(`/api/clinic/membership-usage/${row.patientId}?${qs.toString()}`, { headers });
            const key = `${e.membershipId}|${e.startDate}|${e.endDate}`;
            membershipUsageMap[key] = mRes.data && mRes.data.success ? mRes.data : null;
          } catch {
            const key = `${e.membershipId}|${e.startDate}|${e.endDate}`;
            membershipUsageMap[key] = null;
          }
        }));

        setPatientInfoMap((prev) => ({
          ...prev,
          [row.patientId]: { 
            data: basicRes.data, 
            full, 
            transferNameMap, 
            membershipUsageMap,
            displayMemberships,
            packageUsage: pkgUsageRes?.data?.success ? pkgUsageRes.data.packageUsage : null,
            error: null 
          }
        }));
      } catch (e) {
        setPatientInfoMap((prev) => ({ ...prev, [row.patientId]: { data: null, error: "Failed to load patient" } }));
      }
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
          <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-[98vw] sm:max-w-5xl md:max-w-6xl lg:max-w-7xl max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between px-3 py-4 sm:p-6 border-b border-gray-200">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-teal-900">
                    {selectedPerson?.source === "referral" ? "Referral History" : "Doctor/Staff History"}
                  </h3>
                  <p className="text-xs sm:text-sm text-teal-600 mt-1">{selectedPerson?.name || ""}</p>
                </div>
                <button 
                  className="p-2 rounded-md hover:bg-gray-100 transition-colors"
                  onClick={() => setShowModal(false)}
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              
              {/* Modal Body */}
              <div className="p-3 sm:p-5">
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
                  <div className="overflow-x-auto overflow-y-auto max-h-[75vh] sm:max-h-[72vh]">
                    <table className="min-w-[900px] md:min-w-full text-sm">
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
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {modalItems.map((it) => (
                          <React.Fragment key={it.commissionId}>
                            <tr className="hover:bg-gray-50">
                              <td className="px-4 py-3 whitespace-nowrap">{it.patientName || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{it.patientMobile || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{it.invoiceNumber || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">₹ {Number(it.paidAmount || 0).toFixed(2)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">₹ {Number(it.commissionAmount || 0).toFixed(2)}</td>
                              <td className="px-4 py-3 whitespace-nowrap">₹ {Number(it.commissionAmount || 0).toFixed(2)} ({Number(it.commissionPercent || 0)}%)</td>
                              <td className="px-4 py-3 whitespace-nowrap">{it.doctorName || "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">{it.invoicedDate ? new Date(it.invoicedDate).toLocaleDateString() : "—"}</td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button
                                  onClick={() => toggleRow(it)}
                                  className="px-2 py-1 text-xs rounded-md bg-teal-600 hover:bg-teal-700 text-white whitespace-nowrap"
                                >
                                  {expandedRow === it.commissionId ? "Hide" : "View"}
                                </button>
                              </td>
                            </tr>
                            {expandedRow === it.commissionId && (
                              <tr className="bg-gray-50/60">
                                <td colSpan={9} className="px-4 py-3">
                                  <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm overflow-x-auto">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-xs font-semibold text-gray-700">Details:</span>
                                        {it.service === "Package" ? (
                                          <>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-indigo-100 text-indigo-700 font-medium">
                                              Package: {it.package || "—"}
                                            </span>
                                            {Array.isArray(it.selectedPackageTreatments) && it.selectedPackageTreatments.length > 0 && (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-cyan-100 text-cyan-700 font-medium">
                                                Sess used: {it.selectedPackageTreatments.reduce((s, t) => s + (Number(t.sessions) || 0), 0)}
                                              </span>
                                            )}
                                          </>
                                        ) : (
                                          <>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-emerald-100 text-emerald-700 font-medium">
                                              Treatment: {it.treatment || it.service || "—"}
                                            </span>
                                          </>
                                        )}
                                        {it.isFreeConsultation ? (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-amber-100 text-amber-700 font-semibold">
                                            Free consult used{it.freeConsultationCount ? ` (${it.freeConsultationCount})` : ""}
                                          </span>
                                        ) : null}
                                        {Number(it.membershipDiscountApplied || 0) > 0 && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-teal-100 text-teal-700 font-medium">
                                            Discount: ₹{Number(it.membershipDiscountApplied).toFixed(2)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="ml-auto flex items-center gap-2">
                                        {(() => {
                                          const totalPending = Number((it.totalPendingBalance ?? it.pendingAmount ?? 0) || 0);
                                          const totalAdvance = Number((it.totalAdvanceBalance ?? it.advanceAmount ?? 0) || 0);
                                          return (
                                            <>
                                              {totalPending > 0 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-100">
                                                  Total Pending: ₹ {totalPending.toFixed(2)}
                                                </span>
                                              )}
                                              {totalAdvance > 0 && (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold text-green-700 bg-green-50 border border-green-100">
                                                  Total Advance: ₹ {totalAdvance.toFixed(2)}
                                                </span>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                    <div className="border-t border-gray-100 my-2" />
                                    {/* Package treatments list if present */}
                                    {it.service === "Package" && Array.isArray(it.selectedPackageTreatments) && it.selectedPackageTreatments.length > 0 && (
                                      <div className="mb-2">
                                        <div className="text-[11px] text-gray-600 font-semibold mb-1">Treatments in this bill:</div>
                                        <div className="flex flex-wrap gap-1.5">
                                          {it.selectedPackageTreatments.map((pt, idx) => (
                                            <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-700">
                                              {pt.treatmentName} — {pt.sessions} sess
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    <div className="border-t border-gray-100 my-2" />
                                    {it.patientId && patientInfoMap[it.patientId]?.full && (() => {
                                      const full = patientInfoMap[it.patientId].full;
                                      const outMemIds = new Set((full.membershipTransfers || []).filter(t => t.type === 'out').map(t => String(t.membershipId)));
                                      const outPkgIds = new Set((full.packageTransfers || []).filter(t => t.type === 'out').map(t => String(t.packageId)));
                                      const showMembership = full.membership === "Yes" && full.membershipId && !outMemIds.has(String(full.membershipId));
                                      const showPackage = full.package === "Yes" && full.packageId && !outPkgIds.has(String(full.packageId));
                                      if (!showMembership && !showPackage) return null;
                                      return (
                                        <div className="mt-2 flex flex-wrap items-center gap-2">
                                          {showMembership && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-purple-100 text-purple-700">
                                              Membership active
                                            </span>
                                          )}
                                          {showPackage && (
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-blue-100 text-blue-700">
                                              Package assigned
                                            </span>
                                          )}
                                        </div>
                                      );
                                    })()}
                                    {/* Detailed Membership Info */}
                                    {it.patientId && patientInfoMap[it.patientId]?.full && (
                                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {(() => {
                                          const full = patientInfoMap[it.patientId].full;
                                          const outIds = new Set((full.membershipTransfers || []).filter(t => t.type === 'out').map(t => String(t.membershipId)));
                                          const list = Array.isArray(patientInfoMap[it.patientId].displayMemberships) ? patientInfoMap[it.patientId].displayMemberships : [];
                                          const filtered = list.filter(m => m.membershipId && !outIds.has(String(m.membershipId)));
                                          if (filtered.length === 0) return null;
                                          return filtered.map((mItem, idx) => {
                                            const mId = mItem.membershipId;
                                            const m = membershipList.find(x => String(x._id) === String(mId));
                                            const name = m?.name || "Membership";
                                            const start = mItem.startDate ? new Date(mItem.startDate).toLocaleDateString() : "-";
                                            const end = mItem.endDate ? new Date(mItem.endDate).toLocaleDateString() : "-";
                                            const usageMap = patientInfoMap[it.patientId].membershipUsageMap || {};
                                            const values = Object.entries(usageMap)
                                              .filter(([k]) => k.startsWith(String(mId) + "|"))
                                              .map(([, v]) => v)
                                              .filter(Boolean);
                                            const totalFree = values.reduce((s, u) => s + (u.totalFreeConsultations || 0), 0);
                                            const usedFree = values.reduce((s, u) => s + (u.usedFreeConsultations || 0), 0);
                                            const remaining = Math.max(0, totalFree - usedFree);
                                            const inTransferred = Array.isArray(full.membershipTransfers) && full.membershipTransfers.some(t => t.type === 'in' && String(t.membershipId) === String(mId));
                                            const memKey = `${mId}|${start}|${end}`;
                                            const isOpen = !!expandedMemberships[memKey];
                                            return (
                                              <div key={idx} className="rounded-md border border-purple-200 bg-purple-50/40 p-2">
                                                <div className="text-[11px] font-semibold text-purple-800 mb-1">Membership</div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="inline-flex px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-[11px]">{name}</span>
                                                  <span className="text-[11px] text-gray-600">From {start} to {end}</span>
                                                  {inTransferred && (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px]">Transferred in</span>
                                                  )}
                                                  <button
                                                    onClick={() => setExpandedMemberships(prev => ({ ...prev, [memKey]: !prev[memKey] }))}
                                                    className="ml-auto inline-flex px-2 py-0.5 rounded-md bg-white border border-purple-200 text-[11px] text-purple-700 hover:bg-purple-100"
                                                  >
                                                    {isOpen ? "Hide details" : "Included"}
                                                  </button>
                                                </div>
                                                {isOpen && (
                                                  <div className="mt-2 rounded-md bg-white border border-purple-100 p-2">
                                                    <div className="text-[11px] text-gray-700">
                                                      Free consults: <span className="font-semibold">{usedFree}/{totalFree}</span>{remaining > 0 ? <span className="ml-2 inline-flex px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">Remaining {remaining}</span> : null}
                                                    </div>
                                                    {m?.benefits && (
                                                      <div className="mt-1 flex flex-wrap gap-1.5">
                                                        {m.benefits.priorityBooking ? (
                                                          <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px]">Priority booking</span>
                                                        ) : null}
                                                        {typeof m.benefits.discountPercentage === 'number' && m.benefits.discountPercentage > 0 ? (
                                                          <span className="inline-flex px-2 py-0.5 rounded-full bg-teal-100 text-teal-700 text-[11px]">Discount {m.benefits.discountPercentage}%</span>
                                                        ) : null}
                                                      </div>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          });
                                        })()}
                                        {/* Detailed Package Info */}
                                        {(() => {
                                          const full = patientInfoMap[it.patientId].full || {};
                                          const usage = Array.isArray(patientInfoMap[it.patientId].packageUsage) ? patientInfoMap[it.patientId].packageUsage : [];
                                          const usageList = usage.filter(pkg => pkg && pkg.packageName);
                                          if (usageList.length > 0) {
                                            return usageList.map((pkg, idx) => {
                                              const totalUsed = typeof pkg.totalSessions === 'number'
                                                ? pkg.totalSessions
                                                : (Array.isArray(pkg.treatments) ? pkg.treatments.reduce((s, t) => s + (t.totalUsedSessions || 0), 0) : 0);
                                              const inTransferred = !!pkg.isTransferred;
                                              const pkgKey = `name:${pkg.packageName}`;
                                              const isOpen = !!expandedPackages[pkgKey];
                                              return (
                                                <div key={`pkg-usage-${idx}`} className="rounded-md border border-blue-200 bg-blue-50/40 p-2">
                                                  <div className="text-[11px] font-semibold text-blue-800 mb-1">Package</div>
                                                  <div className="flex flex-wrap items-center gap-2">
                                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px]">{pkg.packageName}</span>
                                                    {inTransferred && (
                                                      <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px]">Transferred in</span>
                                                    )}
                                                    <button
                                                      onClick={() => setExpandedPackages(prev => ({ ...prev, [pkgKey]: !prev[pkgKey] }))}
                                                      className="ml-auto inline-flex px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[11px] text-blue-700 hover:bg-blue-100"
                                                    >
                                                      {isOpen ? "Hide treatments" : "Included"}
                                                    </button>
                                                  </div>
                                                  <div className="mt-1 text-[11px] text-gray-700">Used sessions: <span className="font-semibold">{totalUsed}</span></div>
                                                  {isOpen && Array.isArray(pkg.treatments) && pkg.treatments.length > 0 && (
                                                    <div className="mt-2 rounded-md bg-white border border-blue-100 p-2">
                                                      <div className="text-[11px] text-gray-700 font-medium mb-1">Treatments</div>
                                                      <div className="flex flex-wrap gap-1.5">
                                                        {pkg.treatments.map((t, i2) => (
                                                          <span key={i2} className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                                                            {t.treatmentName} {t.totalUsedSessions || 0}/{t.maxSessions || 0}
                                                          </span>
                                                        ))}
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>
                                              );
                                            });
                                          }
                                          // Fallback: show assigned packages when usage is empty
                                          const transfersOutIds = new Set((full.packageTransfers || []).filter(t => t.type === 'out').map(t => String(t.packageId)));
                                          const assigned = Array.isArray(full.packages) ? full.packages : [];
                                          const mainPkgId = full.packageId ? String(full.packageId) : null;
                                          const allAssignedIds = new Set(assigned.map(p => String(p.packageId)));
                                          if (mainPkgId) allAssignedIds.add(mainPkgId);
                                          const filteredIds = Array.from(allAssignedIds).filter(pid => !transfersOutIds.has(pid));
                                          if (filteredIds.length === 0) return null;
                                          return filteredIds.map((pid, idx) => {
                                            const pkgDef = packageList.find(x => String(x._id) === String(pid));
                                            const name = pkgDef?.name || "Package";
                                            const inTransferred = Array.isArray(full.packageTransfers) && full.packageTransfers.some(t => t.type === 'in' && String(t.packageId) === String(pid));
                                            const pkgKey = `id:${pid}`;
                                            const isOpen = !!expandedPackages[pkgKey];
                                            return (
                                              <div key={`pkg-assigned-${idx}`} className="rounded-md border border-blue-200 bg-blue-50/40 p-2">
                                                <div className="text-[11px] font-semibold text-blue-800 mb-1">Package</div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                  <span className="inline-flex px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[11px]">{name}</span>
                                                  {inTransferred && (
                                                    <span className="inline-flex px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px]">Transferred in</span>
                                                  )}
                                                  <button
                                                    onClick={() => setExpandedPackages(prev => ({ ...prev, [pkgKey]: !prev[pkgKey] }))}
                                                    className="ml-auto inline-flex px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[11px] text-blue-700 hover:bg-blue-100"
                                                  >
                                                    {isOpen ? "Hide treatments" : "Included"}
                                                  </button>
                                                </div>
                                                {isOpen && Array.isArray(pkgDef?.treatments) && pkgDef.treatments.length > 0 && (
                                                  <div className="mt-2 rounded-md bg-white border border-blue-100 p-2">
                                                    <div className="text-[11px] text-gray-700 font-medium mb-1">Treatments</div>
                                                    <div className="flex flex-wrap gap-1.5">
                                                      {pkgDef.treatments.map((t, i2) => (
                                                        <span key={i2} className="inline-flex px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px]">
                                                          {t.treatmentName} 0/{t.sessions || 0}
                                                        </span>
                                                      ))}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            );
                                          });
                                        })()}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
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

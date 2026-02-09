import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import {
  Calendar,
  User,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  DollarSign,
  Edit,
  Loader2,
} from "lucide-react";

const genderOptions = ["", "Male", "Female", "Other"];
const patientTypeOptions = ["New", "Old"];
const insuranceOptions = ["Yes", "No"];
const insuranceTypeOptions = ["Paid", "Advance"];

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

const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const styles = {
    success: "bg-green-50 border-green-200 text-green-800",
    error: "bg-red-50 border-red-200 text-red-800",
    warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
    info: "bg-blue-50 border-blue-200 text-blue-800",
  };

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-600" />,
    error: <AlertCircle className="w-5 h-5 text-red-600" />,
    warning: <AlertCircle className="w-5 h-5 text-yellow-600" />,
    info: <AlertCircle className="w-5 h-5 text-blue-600" />,
  };

  return (
    <div className={`fixed top-4 right-4 left-4 sm:left-auto sm:right-4 sm:w-96 z-[100] flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg ${styles[type]} animate-slide-in`}>
      {icons[type]}
      <span className="font-medium text-sm flex-1">{message}</span>
      <button onClick={onClose} className="ml-2 hover:opacity-70 flex-shrink-0" aria-label="Close notification">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const EditableField = ({
  label,
  name,
  type = "text",
  value,
  onChange,
  required,
  options = [],
  placeholder,
  disabled = false,
  min,
  max,
  step,
  maxLength,
  isCompact = false,
}) => (
  <div className="flex-1 min-w-[120px]">
    <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {type === "select" ? (
      <select
        name={name}
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        className={`w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-500" : "bg-white text-gray-900"}`}
      >
        <option value="">{placeholder || `Select ${label}`}</option>
        {options.map((opt) => (
          <option key={opt.value || opt} value={opt.value || opt}>
            {opt.label || opt}
          </option>
        ))}
      </select>
    ) : type === "textarea" ? (
      <textarea
        name={name}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={2}
        className={`w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 resize-none ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-500" : "bg-white text-gray-900"}`}
      />
    ) : (
      <input
        name={name}
        type={type}
        value={value ?? ""}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        maxLength={maxLength}
        className={`w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-500" : "bg-white text-gray-900"}`}
      />
    )}
  </div>
);

const PatientUpdateForm = ({ patientId, embedded = false, onClose, onUpdated }) => {
  const router = useRouter();
  const resolvedId = patientId || router.query.id;
  const [currentUser] = useState({ name: "Admin User", role: "Clinic" });
  const [invoiceInfo, setInvoiceInfo] = useState(null);
  const [formData, setFormData] = useState({});
  const [calculatedFields, setCalculatedFields] = useState({ needToPay: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("update"); // "update" or "paymentHistory"
  const [billingHistory, setBillingHistory] = useState([]);
  const [loadingBillingHistory, setLoadingBillingHistory] = useState(false);
  const [referrals, setReferrals] = useState([]);

  const authToken = getStoredToken();
  const showToast = (message, type = "success") => setToast({ message, type });

  const handleFieldChange = useCallback((e) => {
    const { name, value, type } = e.target;
    
    // Handle mobileNumber - only allow digits and limit to 10 digits
    if (name === "mobileNumber") {
      const numericValue = value.replace(/\D/g, '');
      if (numericValue.length <= 10) {
        setFormData((prev) => ({ ...prev, [name]: numericValue }));
      }
      return;
    }
    
    let parsedValue = value;
    if (type === "number") {
      parsedValue = value === "" ? "" : Number(value);
    }
    setFormData((prev) => ({ ...prev, [name]: parsedValue }));
  }, []);

  useEffect(() => {
    if (!resolvedId || !authToken) return;

    const fetchInvoice = async () => {
      setLoading(true);
      setFetchError("");

      try {
        const res = await fetch(`/api/staff/get-patient-data/${resolvedId}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        });
        if (!res.ok) throw new Error("Patient record not found");

        const data = await res.json();
        setInvoiceInfo(data);
        setFormData({
          ...data,
          invoicedDate: data.invoicedDate ? data.invoicedDate.slice(0, 16) : "",
        });
      } catch (err) {
        console.error(err);
        setFetchError(err.message || "Failed to fetch data");
        showToast(err.message || "Failed to fetch patient data", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchInvoice();
  }, [resolvedId, authToken]);

  // Fetch referrals
  useEffect(() => {
    if (!authToken) return;
    
    const fetchReferrals = async () => {
      try {
        const headers = { Authorization: `Bearer ${authToken}` };
        const res = await fetch(`/api/clinic/referrals`, { headers });
        const data = await res.json();
        
        if (data.success && Array.isArray(data.referrals)) {
          setReferrals(data.referrals);
        }
      } catch (err) {
        console.error('Error fetching referrals:', err);
      }
    };
    
    fetchReferrals();
  }, [authToken]);

  // Fetch billing history when payment history tab is active
  useEffect(() => {
    if (activeTab === "paymentHistory" && resolvedId && authToken && !loadingBillingHistory) {
      const fetchBillingHistory = async () => {
        setLoadingBillingHistory(true);
        try {
          const res = await fetch(`/api/clinic/billing-history/${resolvedId}`, {
            headers: { Authorization: `Bearer ${authToken}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success) {
              setBillingHistory(data.billings || []);
            }
          }
        } catch (err) {
          console.error("Error fetching billing history:", err);
        } finally {
          setLoadingBillingHistory(false);
        }
      };
      fetchBillingHistory();
    }
  }, [activeTab, resolvedId, authToken]);

  const calculateNeedToPay = useCallback(() => {
    if (formData.insurance === "Yes" && formData.insuranceType === "Advance") {
      const advanceGivenAmount = parseFloat(formData.advanceGivenAmount) || 0;
      const coPayPercent = parseFloat(formData.coPayPercent) || 0;
      const coPayAmount = (advanceGivenAmount * coPayPercent) / 100;
      setCalculatedFields((prev) => ({ ...prev, needToPay: Math.max(0, advanceGivenAmount - coPayAmount) }));
    } else {
      setCalculatedFields((prev) => ({ ...prev, needToPay: 0 }));
    }
  }, [formData.insurance, formData.insuranceType, formData.advanceGivenAmount, formData.coPayPercent]);

  useEffect(() => {
    calculateNeedToPay();
  }, [calculateNeedToPay]);


  const handleFullUpdate = useCallback(async () => {
    if (!invoiceInfo) return;
    const requiredFields = [
      { field: "firstName", label: "First Name" },
      { field: "gender", label: "Gender" },
      { field: "mobileNumber", label: "Mobile Number" },
    ];

    const missingField = requiredFields.find(
      ({ field }) => !formData[field] && formData[field] !== 0
    );
    if (missingField) {
      showToast(`${missingField.label} is required`, "error");
      return;
    }


    const invoiceId = invoiceInfo?._id;
    const payload = {
      updateType: "details",
      invoiceNumber: formData.invoiceNumber,
      invoicedDate: formData.invoicedDate ? new Date(formData.invoicedDate).toISOString() : null,
      emrNumber: formData.emrNumber,
      firstName: formData.firstName,
      lastName: formData.lastName,
      gender: formData.gender,
      email: formData.email,
      mobileNumber: formData.mobileNumber,
      referredBy: formData.referredBy,
      patientType: formData.patientType,
      insurance: formData.insurance,
      insuranceType: formData.insuranceType,
      advanceGivenAmount: formData.advanceGivenAmount,
      coPayPercent: formData.coPayPercent,
      notes: formData.notes,
      membership: formData.membership,
      membershipStartDate: formData.membershipStartDate,
      membershipEndDate: formData.membershipEndDate,
    };

    try {
      const res = await fetch(`/api/staff/get-patient-data/${invoiceId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json();
      if (res.ok) {
        const updated = result.updatedInvoice;
        setInvoiceInfo(updated);
        setFormData({
          ...updated,
          invoicedDate: updated.invoicedDate ? updated.invoicedDate.slice(0, 16) : "",
        });
        showToast(result.message || "Patient updated successfully", "success");
        if (onUpdated) onUpdated();
        // Close modal after successful update (with small delay to show toast)
        if (onClose) {
          setTimeout(() => {
            onClose();
          }, 1500);
        }
      } else {
        showToast(result.message || "Failed to update patient details", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error. Try again later.", "error");
    }
  }, [authToken, formData, invoiceInfo, onUpdated]);


  const canViewMobileNumber = useMemo(
    () => ["Admin", "Super Admin", "Clinic"].includes(currentUser.role),
    [currentUser.role]
  );

  if (!embedded && loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-sm md:text-base text-gray-800 font-medium">Loading patient details...</p>
        </div>
      </div>
    );
  }

  if (!embedded && fetchError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="text-center bg-white rounded-xl shadow-lg p-6 md:p-8 max-w-md w-full">
          <AlertCircle className="w-12 h-12 md:w-16 md:h-16 text-red-500 mx-auto mb-4" />
          <p className="text-sm md:text-base text-red-600 font-semibold">{fetchError}</p>
        </div>
      </div>
    );
  }

  const containerClass = embedded
    ? "bg-white rounded-lg sm:rounded-xl shadow-2xl w-full max-w-3xl mx-auto max-h-[95vh] sm:max-h-[85vh] overflow-y-auto flex flex-col"
    : "min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-3 sm:p-4 md:p-6 lg:p-8";

  return (
    <div className={containerClass}>
      <style jsx global>{`
        @keyframes slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes scale-in {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .animate-slide-in { animation: slide-in 0.3s ease-out; }
        .animate-scale-in { animation: scale-in 0.2s ease-out; }
      `}</style>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <div className={embedded ? "p-2 space-y-2 flex-1 overflow-y-auto" : "max-w-7xl mx-auto"}>
        {embedded ? (
          <div className="sticky top-0 bg-gray-50 border-b px-2 py-1 flex items-center justify-between z-10">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <FileText className="w-3 h-3 text-gray-700 flex-shrink-0" />
              <h1 className="text-xs font-bold text-gray-900 truncate">Edit Patient</h1>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-2 py-1.5 ml-3 mr-3">
            <div>
              <h1 className="text-xs font-bold flex items-center gap-1">
                <FileText className="w-3 h-3" />
                Patient & Invoice Management
              </h1>
              <p className="text-indigo-100 mt-0.5 text-[8px]">View and update patient information</p>
            </div>
          </div>
        )}

        <div className={`${embedded ? 'p-1.5 space-y-1.5 flex-1 overflow-y-auto' : 'p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 md:space-y-4'}`}>
          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 mb-1.5">
            <button
              onClick={() => setActiveTab("update")}
              className={`px-2 py-1 text-[9px] font-medium transition-colors flex items-center gap-1 ${
                activeTab === "update"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Edit className="w-2.5 h-2.5" />
              Update Patient
            </button>
            <button
              onClick={() => setActiveTab("paymentHistory")}
              className={`px-2 py-1 text-[9px] font-medium transition-colors flex items-center gap-1 ${
                activeTab === "paymentHistory"
                  ? "text-gray-900 border-b-2 border-gray-900"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <DollarSign className="w-2.5 h-2.5" />
              Payment History
            </button>
          </div>

          {/* Update Patient Tab */}
          {activeTab === "update" && (
            <>
            <div className={`bg-white rounded-lg p-1.5 border border-gray-200`}>
              <h2 className={`text-[10px] font-semibold text-gray-900 mb-1 flex items-center gap-1`}>
                <Calendar className={`w-2.5 h-2.5 text-gray-700 flex-shrink-0`} />
                Invoice Information
              </h2>
              <div className={`flex flex-wrap gap-1.5 items-end`}>
                <EditableField
                  label="Invoice Number"
                  name="invoiceNumber"
                  value={formData.invoiceNumber}
                  onChange={handleFieldChange}
                  required
                  isCompact={embedded}
                />
                <EditableField
                  label="Invoiced Date"
                  name="invoicedDate"
                  type="datetime-local"
                  value={formData.invoicedDate || ""}
                  onChange={handleFieldChange}
                  required
                  isCompact={embedded}
                />
                <EditableField
                  label="Invoiced By"
                  name="invoicedBy"
                  value={formData.invoicedBy}
                  onChange={handleFieldChange}
                  isCompact={embedded}
                />
              </div>
            </div>

            <div className={`bg-white rounded-lg p-1.5 border border-gray-200`}>
              <h2 className={`text-[10px] font-semibold text-gray-900 mb-1 flex items-center gap-1`}>
                <User className={`w-2.5 h-2.5 text-gray-700`} />
                Patient Information
              </h2>
              <div className={`flex flex-wrap gap-1.5 items-end`}>
                <EditableField
                  label="EMR Number"
                  name="emrNumber"
                  value={formData.emrNumber}
                  onChange={handleFieldChange}
                />
                <EditableField
                  label="First Name"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleFieldChange}
                  required
                />
                <EditableField
                  label="Last Name"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleFieldChange}
                />
                <EditableField
                  label="Email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleFieldChange}
                />
                <EditableField
                  label="Mobile Number"
                  name="mobileNumber"
                  type="tel"
                  value={canViewMobileNumber ? formData.mobileNumber : ""}
                  onChange={handleFieldChange}
                  required
                  disabled={!canViewMobileNumber}
                  maxLength={10}
                />
                <EditableField
                  label="Gender"
                  name="gender"
                  type="select"
                  value={formData.gender}
                  onChange={handleFieldChange}
                  options={genderOptions}
                  placeholder="Select Gender"
                  required
                />
                <EditableField
                  label="Patient Type"
                  name="patientType"
                  type="select"
                  value={formData.patientType}
                  onChange={handleFieldChange}
                  options={patientTypeOptions}
                  required
                />
              </div>
            </div>
            <div className="bg-white rounded-lg p-1.5 border border-gray-200">
                <div className="flex flex-col gap-2">
                  {/* Row 1: Referred By */}
                  <div className="w-full">
                    <label className="block text-[10px] mb-0.5 font-medium text-gray-700">
                      Referred By
                    </label>
                    <select
                      name="referredBy"
                      value={formData.referredBy === "No" ? "" : (formData.referredBy || "")}
                      onChange={handleFieldChange}
                      className={`text-gray-900 w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 ${formData.referredBy && formData.referredBy !== "No" ? 'border-blue-300' : 'border-gray-300'}`}
                    >
                      <option value="">Select Referred By</option>
                      {referrals.map((r) => {
                        const displayName = `${(r.firstName || "").trim()} ${(r.lastName || "").trim()}`.trim() || (r.email || r.phone || "Unknown");
                        return (
                          <option key={r._id} value={displayName}>
                            {displayName}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Row 2: Membership */}
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] mb-0.5 font-medium text-gray-700">Membership</label>
                      <select
                        name="membership"
                        value={formData.membership || "No"}
                        onChange={handleFieldChange}
                        className="text-gray-900 w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 border-gray-300"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>

                    {/* Membership Date Fields */}
                    {formData.membership === "Yes" && (
                      <>
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-[10px] mb-0.5 font-medium text-gray-700">Membership Start Date</label>
                          <input
                            type="date"
                            name="membershipStartDate"
                            value={formData.membershipStartDate ? formData.membershipStartDate.slice(0, 10) : ""}
                            onChange={handleFieldChange}
                            className="w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-gray-900 border-gray-300"
                          />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-[10px] mb-0.5 font-medium text-gray-700">Membership End Date</label>
                          <input
                            type="date"
                            name="membershipEndDate"
                            value={formData.membershipEndDate ? formData.membershipEndDate.slice(0, 10) : ""}
                            onChange={handleFieldChange}
                            className="w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-gray-900 border-gray-300"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Row 3: Package */}
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-[10px] mb-0.5 font-medium text-gray-700">Package</label>
                      <select
                        name="package"
                        value={formData.package || "No"}
                        onChange={handleFieldChange}
                        className="text-gray-900 w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 border-gray-300"
                      >
                        <option value="No">No</option>
                        <option value="Yes">Yes</option>
                      </select>
                    </div>

                    {/* Package Date Fields */}
                    {formData.package === "Yes" && (
                      <>
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-[10px] mb-0.5 font-medium text-gray-700">Package Start Date</label>
                          <input
                            type="date"
                            name="packageStartDate"
                            value={formData.packageStartDate ? formData.packageStartDate.slice(0, 10) : ""}
                            onChange={handleFieldChange}
                            className="w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-gray-900 border-gray-300"
                          />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-[10px] mb-0.5 font-medium text-gray-700">Package End Date</label>
                          <input
                            type="date"
                            name="packageEndDate"
                            value={formData.packageEndDate ? formData.packageEndDate.slice(0, 10) : ""}
                            onChange={handleFieldChange}
                            className="w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-gray-900 border-gray-300"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
            </div>

            <div className={`bg-white rounded-lg p-1.5 border border-gray-200`}>
              <h2 className={`text-[10px] font-semibold text-gray-900 mb-1`}>Insurance Details</h2>
              <div className={`flex flex-wrap gap-1.5 items-end`}>
                <EditableField
                  label="Insurance"
                  name="insurance"
                  type="select"
                  value={formData.insurance || "No"}
                  onChange={handleFieldChange}
                  options={insuranceOptions}
                />
                <EditableField
                  label="Insurance Type"
                  name="insuranceType"
                  type="select"
                  value={formData.insuranceType}
                  onChange={handleFieldChange}
                  options={insuranceTypeOptions}
                  disabled={formData.insurance !== "Yes"}
                />
                <EditableField
                  label="Advance Given Amount"
                  name="advanceGivenAmount"
                  type="number"
                  value={formData.advanceGivenAmount}
                  onChange={handleFieldChange}
                  min={0}
                  disabled={formData.insurance !== "Yes"}
                />
                <EditableField
                  label="Co-Pay %"
                  name="coPayPercent"
                  type="number"
                  value={formData.coPayPercent}
                  onChange={handleFieldChange}
                  min={0}
                  max={100}
                  disabled={formData.insurance !== "Yes"}
                />
                <EditableField
                  label="Need to Pay Amount (Auto)"
                  name="needToPay"
                  value={`د.إ ${calculatedFields.needToPay.toFixed(2)}`}
                  onChange={() => {}}
                  disabled
                />
                <EditableField
                  label="Advance Claim Status"
                  name="advanceClaimStatus"
                  value={formData.advanceClaimStatus || "-"}
                  onChange={() => {}}
                  disabled
                />
                {formData.advanceClaimReleaseDate && (
                  <EditableField
                    label="Advance Claim Release Date"
                    name="advanceClaimReleaseDate"
                    value={new Date(formData.advanceClaimReleaseDate).toLocaleString()}
                    onChange={() => {}}
                    disabled
                  />
                )}
                {formData.advanceClaimReleasedBy && (
                  <EditableField
                    label="Advance Claim Released By"
                    name="advanceClaimReleasedBy"
                    value={formData.advanceClaimReleasedBy}
                    onChange={() => {}}
                    disabled
                  />
                )}
                {formData.advanceClaimCancellationRemark && (
                  <EditableField
                    label="Cancellation Reason"
                    name="advanceClaimCancellationRemark"
                    value={formData.advanceClaimCancellationRemark}
                    onChange={() => {}}
                    disabled
                  />
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-1.5 pt-1">
              <button
                onClick={handleFullUpdate}
                className="px-2.5 py-1 text-[9px] bg-gray-900 text-white rounded-md hover:bg-gray-800 transition font-medium shadow-sm"
              >
                Update Patient
              </button>
            </div>
            </>
          )}

          {/* Payment History Tab */}
          {activeTab === "paymentHistory" && (
            <div className="bg-white rounded-lg p-1.5 border border-gray-200">
              <h2 className="text-[10px] font-semibold text-gray-900 mb-1.5 flex items-center gap-1">
                <DollarSign className="w-2.5 h-2.5 text-gray-700" />
                Payment History
              </h2>
              
              {loadingBillingHistory ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-3 h-3 animate-spin text-gray-500 mr-1.5" />
                  <span className="text-[9px] text-gray-500">Loading payment history...</span>
                </div>
              ) : billingHistory.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[9px] text-gray-500">No payment history found</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[9px]">
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th className="px-1.5 py-0.5 text-left font-medium">Invoice ID</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Treatment/Package</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Total Amount</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Paid</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Pending</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Advance</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Quantity</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Session</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Payment Method</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {billingHistory.map((billing, index) => (
                        <tr key={billing._id || index} className="border-b border-gray-200 hover:bg-gray-50">
                          <td className="px-1.5 py-0.5 text-gray-900">{billing.invoiceNumber || "-"}</td>
                          <td className="px-1.5 py-0.5 text-gray-900">
                            {billing.service === "Treatment" ? billing.treatment : billing.package || "-"}
                          </td>
                          <td className="px-1.5 py-0.5 text-gray-900">₹{billing.amount?.toFixed(2) || "0.00"}</td>
                          <td className="px-1.5 py-0.5 text-gray-900">₹{billing.paid?.toFixed(2) || "0.00"}</td>
                          <td className="px-1.5 py-0.5 text-gray-900">₹{billing.pending?.toFixed(2) || "0.00"}</td>
                          <td className="px-1.5 py-0.5 text-gray-900">₹{billing.advance?.toFixed(2) || "0.00"}</td>
                          <td className="px-1.5 py-0.5 text-gray-900">{billing.quantity || "-"}</td>
                          <td className="px-1.5 py-0.5 text-gray-900">{billing.sessions || "-"}</td>
                          <td className="px-1.5 py-0.5 text-gray-900">{billing.paymentMethod || "-"}</td>
                          <td className="px-1.5 py-0.5 text-gray-900">
                            {billing.invoicedDate ? new Date(billing.invoicedDate).toLocaleDateString() : "-"}
                          </td>
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
    </div>
  );
};

export default PatientUpdateForm;


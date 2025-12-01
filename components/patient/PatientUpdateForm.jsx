import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/router";
import {
  Calendar,
  User,
  DollarSign,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

const paymentMethods = ["Cash", "Card", "BT", "Tabby", "Tamara"];
const genderOptions = ["Male", "Female", "Other"];
const patientTypeOptions = ["New", "Old"];
const serviceOptions = ["Package", "Treatment"];
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
  isCompact = false,
}) => (
  <div className="min-w-0">
    <label className={`block ${isCompact ? 'text-xs mb-1' : 'text-xs md:text-sm mb-1'} font-semibold text-gray-700`}>
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {type === "select" ? (
      <select
        name={name}
        value={value ?? ""}
        onChange={onChange}
        disabled={disabled}
        className={`w-full ${isCompact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm md:text-base'} border rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-500" : "bg-white text-gray-900"}`}
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
        rows={isCompact ? 2 : 3}
        className={`w-full ${isCompact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm md:text-base'} border rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 resize-none ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-500" : "bg-white text-gray-900"}`}
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
        className={`w-full ${isCompact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm md:text-base'} border rounded-lg focus:ring-2 focus:ring-gray-900 focus:border-gray-900 ${disabled ? "bg-gray-100 cursor-not-allowed text-gray-500" : "bg-white text-gray-900"}`}
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
  const [calculatedFields, setCalculatedFields] = useState({ pending: 0, needToPay: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [toast, setToast] = useState(null);

  const authToken = getStoredToken();
  const showToast = (message, type = "success") => setToast({ message, type });

  const handleFieldChange = useCallback((e) => {
    const { name, value, type } = e.target;
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
        showToast("Patient data loaded successfully", "success");
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

  const calculatePending = useCallback(() => {
    const amount = parseFloat(formData.amount) || 0;
    const paid = parseFloat(formData.paid) || 0;
    const advance = parseFloat(formData.advance) || 0;
    setCalculatedFields((prev) => ({ ...prev, pending: Math.max(0, amount - (paid)) }));
    setFormData((prev) => ({
      ...prev,
      pending: Math.max(0, amount - paid),
      advance: paid > amount ? paid - amount : advance,
    }));
  }, [formData.amount, formData.paid, formData.advance]);

  const calculateNeedToPay = useCallback(() => {
    if (formData.insurance === "Yes") {
      const amount = parseFloat(formData.amount) || 0;
      const coPayPercent = parseFloat(formData.coPayPercent) || 0;
      const coPayAmount = (amount * coPayPercent) / 100;
      setCalculatedFields((prev) => ({ ...prev, needToPay: Math.max(0, amount - coPayAmount) }));
      setFormData((prev) => ({ ...prev, needToPay: Math.max(0, amount - coPayAmount) }));
    } else {
      setCalculatedFields((prev) => ({ ...prev, needToPay: Math.max(0, formData.pending || 0) }));
      setFormData((prev) => ({ ...prev, needToPay: Math.max(0, prev.pending || 0) }));
    }
  }, [formData.insurance, formData.amount, formData.coPayPercent, formData.pending]);

  useEffect(() => {
    calculatePending();
    calculateNeedToPay();
  }, [calculatePending, calculateNeedToPay]);

  const previewValues = useMemo(() => {
    const amountNum = parseFloat(formData.amount) || 0;
    const paidNum = parseFloat(formData.paid) || 0;
    const payingNum = parseFloat(formData.paying) || 0;
    const totalPaid = paidNum + payingNum;
    return {
      totalPaid,
      advance: Math.max(0, totalPaid - amountNum),
      pending: Math.max(0, amountNum - totalPaid),
    };
  }, [formData.amount, formData.paid, formData.paying]);

  const handleFullUpdate = useCallback(async () => {
    if (!invoiceInfo) return;
    const requiredFields = [
      { field: "firstName", label: "First Name" },
      { field: "gender", label: "Gender" },
      { field: "mobileNumber", label: "Mobile Number" },
      { field: "doctor", label: "Doctor" },
      { field: "service", label: "Service" },
      { field: "paymentMethod", label: "Payment Method" },
      { field: "amount", label: "Amount" },
    ];

    const missingField = requiredFields.find(
      ({ field }) => !formData[field] && formData[field] !== 0
    );
    if (missingField) {
      showToast(`${missingField.label} is required`, "error");
      return;
    }

    if ((formData.status === "Rejected" || formData.status === "Cancelled") && !formData.rejectionNote?.trim()) {
      showToast("Please provide a reason for the selected claim status", "error");
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
      doctor: formData.doctor,
      service: formData.service,
      treatment: formData.service === "Treatment" ? formData.treatment : "",
      package: formData.service === "Package" ? formData.package : "",
      packageUnits: formData.packageUnits || 1,
      usedSession: formData.usedSession || 0,
      userTreatmentName: formData.userTreatmentName,
      amount: formData.amount,
      paymentMethod: formData.paymentMethod,
      insurance: formData.insurance,
      insuranceType: formData.insuranceType,
      advanceGivenAmount: formData.advanceGivenAmount,
      coPayPercent: formData.coPayPercent,
      notes: formData.notes,
      membership: formData.membership,
      membershipStartDate: formData.membershipStartDate,
      membershipEndDate: formData.membershipEndDate,
      status: formData.status,
      rejectionNote: formData.rejectionNote,
      paying: formData.paying || 0,
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
          paying: "",
        });
        showToast(result.message || "Patient updated successfully", "success");
        if (onUpdated) onUpdated();
      } else {
        showToast(result.message || "Failed to update patient details", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Network error. Try again later.", "error");
    }
  }, [authToken, formData, invoiceInfo, onUpdated]);

  const handlePaymentChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === "" ? "" : Number(value),
    }));
  }, []);

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

      <div className={embedded ? "p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 flex-1 overflow-y-auto" : "max-w-7xl mx-auto"}>
        {embedded ? (
          <div className="sticky top-0 bg-gray-50 border-b px-2 sm:px-3 md:px-4 py-2 sm:py-3 flex items-center justify-between z-10">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 text-gray-700 flex-shrink-0" />
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 truncate">Edit Patient</h1>
            </div>
            {onClose && (
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            )}
          </div>
        ) : (
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 md:px-6 lg:px-8 py-4 md:py-5 lg:py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl md:text-2xl lg:text-3xl font-bold flex items-center gap-2 md:gap-3">
                <FileText className="w-6 h-6 md:w-7 md:h-7 lg:w-8 lg:h-8" />
                Patient & Invoice Management
              </h1>
              <p className="text-indigo-100 mt-1 text-xs md:text-sm">View and update patient information</p>
            </div>
            <div className="flex items-center gap-2">
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 rounded-lg bg-white/10 text-white border border-white/30 hover:bg-white/20 transition-colors text-sm font-medium"
                >
                  Close
                </button>
              )}
              <div className="bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2 text-left">
                <div className="text-xs text-indigo-100">Logged in as</div>
                <div className="text-xs text-indigo-200">Clinic Staff</div>
              </div>
            </div>
          </div>
        )}

        <div className={`${embedded ? 'p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 flex-1 overflow-y-auto' : 'p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-5 md:space-y-6'}`}>
            <div className={`${embedded ? 'bg-gray-50 rounded-lg p-2 sm:p-3 border border-gray-200' : 'bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-5 border border-blue-100'}`}>
              <h2 className={`${embedded ? 'text-xs sm:text-sm' : 'text-sm sm:text-base md:text-lg'} font-bold text-gray-900 ${embedded ? 'mb-1.5 sm:mb-2' : 'mb-3 sm:mb-4'} flex items-center gap-1.5 sm:gap-2`}>
                <Calendar className={`${embedded ? 'w-3.5 h-3.5 sm:w-4 sm:h-4' : 'w-4 h-4 sm:w-5 sm:h-5'} text-gray-700 flex-shrink-0`} />
                Invoice Information
              </h2>
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${embedded ? 'gap-2' : 'gap-4 md:gap-5'}`}>
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

            <div className={`${embedded ? 'bg-gray-50 rounded-lg p-3 border border-gray-200' : 'bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 md:p-5 border border-green-100'}`}>
              <h2 className={`${embedded ? 'text-sm' : 'text-base md:text-lg'} font-bold text-gray-900 ${embedded ? 'mb-2' : 'mb-4'} flex items-center gap-2`}>
                <User className={`${embedded ? 'w-4 h-4' : 'w-5 h-5'} text-gray-700`} />
                Patient Information
              </h2>
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${embedded ? 'gap-2' : 'gap-4 md:gap-5'}`}>
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
                  value={canViewMobileNumber ? formData.mobileNumber : ""}
                  onChange={handleFieldChange}
                  required
                  disabled={!canViewMobileNumber}
                />
                <EditableField
                  label="Gender"
                  name="gender"
                  type="select"
                  value={formData.gender}
                  onChange={handleFieldChange}
                  options={genderOptions}
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
                <EditableField
                  label="Referred By"
                  name="referredBy"
                  value={formData.referredBy}
                  onChange={handleFieldChange}
                />
                <EditableField
                  label="Membership"
                  name="membership"
                  type="select"
                  value={formData.membership || "No"}
                  onChange={handleFieldChange}
                  options={["Yes", "No"]}
                />
                {formData.membership === "Yes" && (
                  <>
                    <EditableField
                      label="Membership Start Date"
                      name="membershipStartDate"
                      type="date"
                      value={formData.membershipStartDate ? formData.membershipStartDate.slice(0, 10) : ""}
                      onChange={handleFieldChange}
                    />
                    <EditableField
                      label="Membership End Date"
                      name="membershipEndDate"
                      type="date"
                      value={formData.membershipEndDate ? formData.membershipEndDate.slice(0, 10) : ""}
                      onChange={handleFieldChange}
                    />
                  </>
                )}
              </div>
            </div>

            <div className={`${embedded ? 'bg-gray-50 rounded-lg p-3 border border-gray-200' : 'bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 md:p-5 border border-purple-100'}`}>
              <h2 className={`${embedded ? 'text-sm' : 'text-base md:text-lg'} font-bold text-gray-900 ${embedded ? 'mb-2' : 'mb-4'} flex items-center gap-2`}>
                <FileText className={`${embedded ? 'w-4 h-4' : 'w-5 h-5'} text-gray-700`} />
                Medical Details
              </h2>
              <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${embedded ? 'gap-2' : 'gap-4 md:gap-5'}`}>
                <EditableField
                  label="Doctor"
                  name="doctor"
                  value={formData.doctor}
                  onChange={handleFieldChange}
                  required
                />
                <EditableField
                  label="Service"
                  name="service"
                  type="select"
                  value={formData.service}
                  onChange={handleFieldChange}
                  options={serviceOptions}
                  required
                />
                {formData.service === "Treatment" && (
                  <EditableField
                    label="Treatment"
                    name="treatment"
                    value={formData.treatment}
                    onChange={handleFieldChange}
                    required
                  />
                )}
                {formData.service === "Package" && (
                  <>
                    <EditableField
                      label="Package"
                      name="package"
                      value={formData.package}
                      onChange={handleFieldChange}
                      required
                    />
                    <EditableField
                      label="Package Units"
                      name="packageUnits"
                      type="number"
                      value={formData.packageUnits}
                      onChange={handleFieldChange}
                      min={1}
                    />
                  </>
                )}
                <EditableField
                  label="Used Sessions"
                  name="usedSession"
                  type="number"
                  value={formData.usedSession}
                  onChange={handleFieldChange}
                  min={0}
                />
                <EditableField
                  label="Custom Treatment Name"
                  name="userTreatmentName"
                  value={formData.userTreatmentName}
                  onChange={handleFieldChange}
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-4 md:p-5 border border-yellow-100">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <h2 className="text-base md:text-lg font-bold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-amber-600" />
                  Payment & Claim Details
                </h2>
                <button
                  onClick={handleFullUpdate}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Update Patient
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 mb-6">
                <EditableField
                  label="Amount"
                  name="amount"
                  type="number"
                  value={formData.amount}
                  onChange={handleFieldChange}
                  min={0}
                  required
                />
                <EditableField
                  label="Current Paid Amount"
                  name="paid"
                  type="number"
                  value={formData.paid}
                  onChange={handleFieldChange}
                  min={0}
                />
                <EditableField
                  label="New Payment to Add (Optional)"
                  name="paying"
                  type="number"
                  value={formData.paying || ""}
                  onChange={handlePaymentChange}
                  min={0}
                  placeholder="Enter amount to add (optional)"
                />
                <EditableField
                  label="Total Paid After Update (Preview)"
                  name="totalPaidPreview"
                  type="number"
                  value={previewValues.totalPaid.toFixed(2)}
                  onChange={() => {}}
                  disabled
                />
                <EditableField
                  label="New Advance (Preview)"
                  name="advancePreview"
                  type="number"
                  value={previewValues.advance.toFixed(2)}
                  onChange={() => {}}
                  disabled
                />
                <EditableField
                  label="Pending (Auto)"
                  name="pending"
                  value={`د.إ ${formData.pending?.toFixed(2) || "0.00"}`}
                  onChange={() => {}}
                  disabled
                />
                <EditableField
                  label="Payment Method"
                  name="paymentMethod"
                  type="select"
                  value={formData.paymentMethod}
                  onChange={handleFieldChange}
                  options={paymentMethods}
                  required
                />
                <EditableField
                  label="Claim Status"
                  name="status"
                  type="select"
                  value={formData.status || ""}
                  onChange={handleFieldChange}
                  options={["Released", "Approved by doctor", "Cancelled", "Rejected"]}
                />
                {formData.status === "Rejected" && (
                  <EditableField
                    label="Rejection Note"
                    name="rejectionNote"
                    type="textarea"
                    value={formData.rejectionNote || ""}
                    onChange={handleFieldChange}
                    required
                  />
                )}
                <EditableField
                  label="Notes"
                  name="notes"
                  type="textarea"
                  value={formData.notes || ""}
                  onChange={handleFieldChange}
                  placeholder="Optional notes..."
                />
              </div>
            </div>

            <div className={`${embedded ? 'bg-gray-50 rounded-lg p-3 border border-gray-200' : 'bg-gradient-to-br from-cyan-50 to-blue-50 rounded-xl p-4 md:p-5 border border-cyan-100'}`}>
              <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-600" />
                Insurance Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
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

            {formData.paymentHistory && formData.paymentHistory.length > 0 && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 md:p-5 border border-amber-100">
                <h2 className="text-base md:text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-600" />
                  Payment History
                </h2>
                <div className="space-y-3">
                  {formData.paymentHistory.map((entry, index) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-3 md:p-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-3 gap-2">
                        <h4 className="font-semibold text-gray-800 text-sm md:text-base">Entry #{index + 1}</h4>
                        <span className="text-xs md:text-sm text-gray-500">
                          {new Date(entry.updatedAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 text-xs md:text-sm">
                        <div>
                          <span className="font-medium text-gray-600">Amount:</span>
                          <p className="text-gray-800">د.إ{entry.amount?.toFixed(2) || "0.00"}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Paid:</span>
                          <p className="text-gray-800">د.إ{entry.paid?.toFixed(2) || "0.00"}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Advance:</span>
                          <p className="text-gray-800">د.إ{entry.advance?.toFixed(2) || "0.00"}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Pending:</span>
                          <p className="text-gray-800">د.إ{entry.pending?.toFixed(2) || "0.00"}</p>
                        </div>
                        {entry.paying > 0 && (
                          <div className="col-span-2 sm:col-span-4">
                            <span className="font-medium text-gray-600">Paying Amount:</span>
                            <p className="text-green-600 font-semibold">د.إ{entry.paying.toFixed(2)}</p>
                          </div>
                        )}
                        <div className="col-span-2 sm:col-span-4">
                          <span className="font-medium text-gray-600">Payment Method:</span>
                          <p className="text-gray-800">{entry.paymentMethod || "N/A"}</p>
                        </div>
                        {entry.status && (
                          <div className="col-span-2 sm:col-span-4">
                            <span className="font-medium text-gray-600">Status:</span>
                            <span
                              className={`ml-2 px-2 py-1 rounded text-xs font-semibold ${
                                entry.status === "Active"
                                  ? "bg-green-100 text-green-800"
                                  : entry.status === "Completed"
                                  ? "bg-blue-100 text-blue-800"
                                  : entry.status === "Cancelled"
                                  ? "bg-red-100 text-red-800"
                                  : entry.status === "Rejected"
                                  ? "bg-red-100 text-red-800"
                                  : entry.status === "Released"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {entry.status}
                            </span>
                          </div>
                        )}
                        {entry.rejectionNote && (
                          <div className="col-span-2 sm:col-span-4">
                            <span className="font-medium text-gray-600">Rejection Note:</span>
                            <p className="text-red-600 text-xs md:text-sm mt-1">{entry.rejectionNote}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default PatientUpdateForm;


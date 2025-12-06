import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Calendar, User, DollarSign, FileText, AlertCircle, Search, CheckCircle, XCircle, AlertTriangle, X } from "lucide-react";
import ClinicLayout from '../../components/staffLayout';
import withClinicAuth from '../../components/withStaffAuth';
import { useRouter } from "next/router";

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
// Toast Component
const Toast = ({ message, type, onClose }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertTriangle className="w-5 h-5" />
  };
  const colors = {
    success: "bg-green-500",
    error: "bg-red-500",
    warning: "bg-yellow-500"
  };

  return (
    <div className={`${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 min-w-[300px] animate-slide-in`}>
      {icons[type]}
      <span className="flex-1 font-medium">{message}</span>
      <button onClick={onClose} className="hover:bg-white/20 rounded p-1">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Toast Container
const ToastContainer = ({ toasts, removeToast }) => (
  <div className="fixed top-4 right-4 z-50 space-y-2">
    {toasts.map(toast => (
      <Toast key={toast.id} {...toast} onClose={() => removeToast(toast.id)} />
    ))}
  </div>
);

// Confirmation Modal
const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel, type = "warning" }) => {
  if (!isOpen) return null;

  const colors = {
    warning: "bg-yellow-500",
    danger: "bg-red-500",
    info: "bg-blue-500"
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-scale-in">
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-700 mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 ${colors[type]} text-white rounded-lg hover:opacity-90 font-medium transition shadow-lg`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};

const paymentMethods = ["Cash", "Card", "BT", "Tabby", "Tamara"];

const INITIAL_FORM_DATA = {
  invoiceNumber: "", emrNumber: "", firstName: "", lastName: "", email: "",
  mobileNumber: "", gender: "", patientType: "", referredBy: "", 
  insurance: "No", advanceGivenAmount: "", coPayPercent: "", advanceClaimStatus: "Pending", 
  insuranceType: "Paid", membership: "No", membershipStartDate: "", membershipEndDate: ""
};

const InvoiceManagementSystem = ({ onSuccess, isCompact = false }) => {
  const [currentUser, setCurrentUser] = useState({ name: "", role: "" });
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [autoFields, setAutoFields] = useState({
    invoicedDate: new Date().toISOString(),
    invoicedBy: " ",
    advanceClaimReleaseDate: null,
    advanceClaimReleasedBy: null
  });
  const [calculatedFields, setCalculatedFields] = useState({ needToPay: 0 });
  const [errors, setErrors] = useState({});
  const [usedEMRNumbers] = useState(() => new Set());
  const [fetching, setFetching] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, action: null });

  // Toast functions
  const showToast = useCallback((message, type = "success") => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Fetch data
  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    const headers = getAuthHeaders();
    if (!headers) return;
    fetch("/api/staff/patient-registration", { headers })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCurrentUser(data.data);
          setAutoFields(prev => ({ ...prev, invoicedBy: data.data.name }));
        }
      })
      .catch(() => showToast("Failed to fetch user details", "error"));
  }, [showToast]);


  useEffect(() => generateInvoiceNumber(), []);

  useEffect(() => {
    const advanceGivenAmount = parseFloat(formData.advanceGivenAmount) || 0;
    const coPayPercentNum = parseFloat(formData.coPayPercent);

    if (formData.insurance === "Yes" && formData.insuranceType === "Advance" && !Number.isNaN(coPayPercentNum)) {
      // Requirement: base the calculation ONLY on Advance Payment Amount
      // needToPay = advanceGivenAmount * (100 - coPay%) / 100
      const needToPay = Math.max(0, (advanceGivenAmount * (100 - coPayPercentNum)) / 100);
      setCalculatedFields(prev => ({ ...prev, needToPay }));
    } else {
      setCalculatedFields(prev => ({ ...prev, needToPay: 0 }));
    }
  }, [formData.coPayPercent, formData.insurance, formData.insuranceType, formData.advanceGivenAmount]);

  const generateInvoiceNumber = useCallback(() => {
    const date = new Date();
    const seq = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    const id = `INV-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}-${seq}`;
    setFormData(prev => ({ ...prev, invoiceNumber: id }));
  }, []);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: "" }));
    if (name === "insurance" && value === "No") {
      setFormData(prev => ({
        ...prev,
        advanceGivenAmount: "0",
        coPayPercent: "",
        advanceClaimStatus: "Pending",
        insuranceType: "Paid"
      }));
      setAutoFields(prev => ({
        ...prev,
        advanceClaimReleaseDate: null,
        advanceClaimReleasedBy: null
      }));
    }
    
    if (name === "insurance" && value === "Yes") {
      setFormData(prev => ({
        ...prev,
        advanceGivenAmount: "0"
      }));
    }
  }, [errors]);



  const fetchEMRData = useCallback(async () => {
    if (!formData.emrNumber.trim()) {
      showToast("Please enter an EMR Number", "warning");
      return;
    }

    try {
      setFetching(true);
      const headers = getAuthHeaders();
      if (!headers) {
        showToast("Authentication required. Please login again.", "error");
        setFetching(false);
        return;
      }
      const res = await fetch(`/api/staff/patient-registration/${formData.emrNumber}`, { headers });
      const data = await res.json();

        if (res.ok && data.success && data.data) {
          const f = data.data;
          // Enable EMR advance mode before setting advance so auto-calc doesn't override it
          setManualAdvance(true);
          setFormData(prev => ({
            ...prev,
            firstName: f.firstName || "",
            lastName: f.lastName || "",
            email: f.email || "",
            mobileNumber: f.mobileNumber || "",
            gender: f.gender || "",
            patientType: f.patientType || "",
            referredBy: f.referredBy || ""
          }));
        showToast("Patient details loaded successfully", "success");
      } else {
        showToast("Patient not found. Fill details manually", "warning");
      }
    } catch {
      showToast("Failed to fetch patient data", "error");
    } finally {
      setFetching(false);
    }
  }, [formData.emrNumber, showToast]);

  const validateForm = useCallback(() => {
    const newErrors = {};
    const { invoiceNumber, emrNumber, firstName, lastName, email, mobileNumber, gender, patientType, insurance, advanceGivenAmount, coPayPercent } = formData;
    
    if (!invoiceNumber.trim()) newErrors.invoiceNumber = "Required";
    if (!emrNumber.trim()) newErrors.emrNumber = "Required";
    else if (usedEMRNumbers.has(emrNumber)) newErrors.emrNumber = "Already exists";
    if (!firstName.trim()) newErrors.firstName = "Required";
    if (!lastName.trim()) newErrors.lastName = "Required";
    if (!email.trim()) newErrors.email = "Required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) newErrors.email = "Invalid email";
    if (!mobileNumber.trim()) newErrors.mobileNumber = "Required";
    else if (!/^[0-9]{10}$/.test(mobileNumber)) newErrors.mobileNumber = "Enter valid 10-digit number";
    if (!gender) newErrors.gender = "Required";
    if (!patientType) newErrors.patientType = "Required";
    if (insurance === "Yes" && formData.insuranceType === "Advance") {
      if (!coPayPercent || parseFloat(coPayPercent) < 0 || parseFloat(coPayPercent) > 100) newErrors.coPayPercent = "0-100 required";
    }
    
    // Validate membership dates
    if (formData.membership === "Yes") {
      if (!formData.membershipStartDate) newErrors.membershipStartDate = "Required";
      if (!formData.membershipEndDate) newErrors.membershipEndDate = "Required";
      if (formData.membershipStartDate && formData.membershipEndDate && new Date(formData.membershipStartDate) >= new Date(formData.membershipEndDate)) {
        newErrors.membershipEndDate = "End date must be after start date";
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData, usedEMRNumbers]);

const router = useRouter(); // <-- inside your component

const handleSubmit = useCallback(async () => {
  if (!validateForm()) {
    showToast("Please fix validation errors", "error");
    return;
  }

  setConfirmModal({
    isOpen: true,
    title: "Save Invoice",
    message: "Are you sure you want to save this invoice? Please verify all details are correct.",
    type: "info",
    action: async () => {
      try {
        const headers = getAuthHeaders();
        if (!headers) {
          showToast("Authentication required. Please login again.", "error");
          setConfirmModal({ isOpen: false, action: null });
          return;
        }
        const res = await fetch("/api/staff/patient-registration", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json", 
            ...headers
          },
          body: JSON.stringify({ ...formData, ...autoFields, userId: currentUser._id, calculatedFields })
        });
        const data = await res.json();
        
        if (res.ok && data.success) {
          showToast("Invoice saved successfully!", "success");
          resetForm();

          // If onSuccess callback is provided (modal mode), call it instead of redirecting
          if (onSuccess) {
            onSuccess();
          } else {
            // Redirect to patient information page - check if we're on clinic route
            const isClinicRoute = router.pathname?.startsWith('/clinic/') || window.location.pathname?.startsWith('/clinic/');
            if (isClinicRoute) {
              router.push("/clinic/patient-registration?tab=information");
            } else {
              router.push("/staff/patient-information");
            }
          }
        } else {
          // Handle validation errors
          if (data.errors && Array.isArray(data.errors)) {
            showToast(`Validation Error: ${data.errors.join(", ")}`, "error");
          } else {
            showToast(data.message || "Failed to save invoice", "error");
          }
        }
      } catch {
        showToast("Network error. Please try again", "error");
      }
      setConfirmModal({ isOpen: false, action: null });
    }
  });
}, [formData, autoFields, currentUser, calculatedFields, validateForm, showToast, router, onSuccess]);

  const resetForm = useCallback(() => {
    setConfirmModal({
      isOpen: true,
      title: "Reset Form",
      message: "All entered data will be lost. Are you sure you want to reset?",
      type: "warning",
      action: () => {
        setFormData(INITIAL_FORM_DATA);
        setAutoFields({
          invoicedDate: new Date().toISOString(),
          invoicedBy: currentUser.name,
          advanceClaimReleaseDate: null,
          advanceClaimReleasedBy: null
        });
        setCalculatedFields({ needToPay: 0 });
        setErrors({});
        generateInvoiceNumber();
        showToast("Form reset successfully", "success");
        setConfirmModal({ isOpen: false, action: null });
      }
    });
  }, [currentUser.name, generateInvoiceNumber, showToast]);

  const canViewMobile = useMemo(() => ["Admin", "Super Admin"].includes(currentUser.role), [currentUser.role]);

return (
  <>
    <style>{`
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

    <ToastContainer toasts={toasts} removeToast={removeToast} />
    <ConfirmModal {...confirmModal} onCancel={() => setConfirmModal({ isOpen: false, action: null })} onConfirm={confirmModal.action} />

    <div className={isCompact ? "" : "min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6"}>
      <div className={isCompact ? "w-full" : "max-w-7xl mx-auto"}>
        <div className={`bg-white ${isCompact ? '' : 'rounded-lg shadow-sm border border-gray-200'} ${isCompact ? 'p-0' : 'p-4 sm:p-6 md:p-8'}`}>
          
          {/* Header - Hidden in compact mode */}
          {!isCompact && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 pb-2 border-b border-gray-200">
              <div className="mb-1 sm:mb-0">
                <h1 className="text-sm font-bold text-gray-900 flex items-center gap-1">
                  <FileText className="w-3 h-3 text-gray-700" />
                  Patient Registration
                </h1>
                <p className="text-[9px] text-gray-700 mt-0.5">Complete patient and invoice details</p>
              </div>
              {autoFields.invoicedBy && (
                <div className="text-left sm:text-right">
                  <div className="text-[9px] text-gray-700">Logged in as:</div>
                  <div className="font-semibold text-[10px] text-gray-700">{autoFields.invoicedBy}</div>
                  {currentUser.role && <div className="text-[9px] text-gray-700">{currentUser.role}</div>}
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            
            {/* Invoice Information */}
            <div className={`bg-white ${isCompact ? '' : 'rounded-lg'} ${isCompact ? 'p-0' : 'p-2'} border border-gray-200`}>
              <h2 className={`text-xs font-semibold text-gray-900 mb-1 flex items-center gap-1`}>
                <Calendar className={`w-3 h-3 text-gray-700`} />
                Invoice Information
              </h2>
              <div className={`flex flex-wrap gap-2 items-end`}>
                <div className="flex-1 min-w-[120px]">
                  <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>
                    Invoice Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="invoiceNumber"
                    value={formData.invoiceNumber}
                    onChange={handleInputChange}
                    className={`text-gray-900 w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 ${errors.invoiceNumber ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                  />
                  {errors.invoiceNumber && (
                    <p className="text-red-500 text-[9px] mt-0.5 flex items-center gap-0.5">
                      <AlertCircle className="w-2.5 h-2.5" />{errors.invoiceNumber}
                    </p>
                  )}
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>Invoiced Date</label>
                  <input
                    type="text"
                    value={new Date(autoFields.invoicedDate).toLocaleString()}
                    disabled
                    className={`w-full px-2 py-1 text-[10px] bg-gray-50 border border-gray-300 rounded-md text-gray-700`}
                  />
                </div>
                <div className="flex-1 min-w-[120px]">
                  <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>Invoiced By</label>
                  <input
                    type="text"
                    value={autoFields.invoicedBy}
                    disabled
                    className={`w-full px-2 py-1 text-[10px] bg-gray-50 border border-gray-300 rounded-md text-gray-700`}
                  />
                </div>
              </div>
            </div>

            {/* EMR Search */}
            <div className={`bg-indigo-50 rounded-lg p-2 border border-indigo-200`}>
              <h2 className={`text-xs font-semibold text-gray-900 mb-1 flex items-center gap-1`}>
                <Search className={`w-3 h-3 text-gray-700`} />
                Search Patient by EMR
              </h2>
              <div className={`flex items-center gap-2`}>
                <input
                  type="text"
                  name="emrNumber"
                  value={formData.emrNumber}
                  onChange={handleInputChange}
                  placeholder="Enter EMR Number"
                  className={`flex-1 px-2 py-1 text-[10px] border border-indigo-300 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-gray-900`}
                />
                <button
                  type="button"
                  onClick={fetchEMRData}
                  disabled={fetching || !formData.emrNumber.trim()}
                  className={`px-2 py-1 text-[10px] rounded-md text-white font-medium transition flex items-center justify-center gap-1 whitespace-nowrap ${fetching || !formData.emrNumber.trim() ? "bg-gray-400 cursor-not-allowed" : "bg-gray-900 hover:bg-gray-800"}`}
                >
                  <Search className="w-3 h-3" />
                  {fetching ? "Searching..." : "Search"}
                </button>
              </div>
              <p className="text-[9px] text-gray-800 mt-1">💡 Search by EMR to auto-fill or enter manually below</p>
            </div>

            {/* Patient Information */}
            <div className={`bg-white rounded-lg p-2 border border-gray-200`}>
              <h2 className={`text-xs font-semibold text-gray-900 mb-1 flex items-center gap-1`}>
                <User className={`w-3 h-3 text-gray-700`} />
                Patient Information
              </h2>
              <div className={`flex flex-wrap gap-2 items-end`}>
                {[{ name: "emrNumber", label: "EMR Number", required: true },
                  { name: "firstName", label: "First Name", required: true },
                  { name: "lastName", label: "Last Name", required: true },
                  { name: "email", label: "Email", type: "email", required: true },
                  { name: "mobileNumber", label: canViewMobile ? "Mobile Number" : "Mobile (Restricted)", type: "number" },
                  { name: "gender", label: "Gender", type: "select", options: ["Male", "Female", "Other"], required: true },
                  { name: "patientType", label: "Patient Type", type: "select", options: ["New", "Old"], required: true },
                  { name: "referredBy", label: "Referred By" }
                ].map(field => (
                  <div key={field.name} className="flex-1 min-w-[120px]">
                    <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    {field.type === "select" ? (
                      <select
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleInputChange}
                        className={`text-gray-900 w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 ${errors[field.name] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      >
                        <option value="">Select {field.label}</option>
                        {field.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : (
                      <input
                        type={field.type || "text"}
                        name={field.name}
                        value={formData[field.name]}
                        onChange={handleInputChange}
                        className={`w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-gray-900 ${errors[field.name] ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                        placeholder={field.label}
                      />
                    )}
                    {errors[field.name] && (
                      <p className="text-red-500 text-[9px] mt-0.5 flex items-center gap-0.5">
                        <AlertCircle className="w-2.5 h-2.5" />{errors[field.name]}
                      </p>
                    )}
                  </div>
                ))}
                
                {/* Membership Date Fields */}
                {formData.membership === "Yes" && (
                  <>
                    <div className="flex-1 min-w-[120px]">
                      <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>
                        Membership Start Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="membershipStartDate"
                        value={formData.membershipStartDate}
                        onChange={handleInputChange}
                        className={`w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-indigo-500 text-gray-900 ${errors.membershipStartDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      />
                      {errors.membershipStartDate && (
                        <p className="text-red-500 text-[9px] mt-0.5 flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" />{errors.membershipStartDate}
                        </p>
                      )}
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>
                        Membership End Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        name="membershipEndDate"
                        value={formData.membershipEndDate}
                        onChange={handleInputChange}
                        className={`w-full px-2 py-1 text-[10px] border rounded-md focus:ring-1 focus:ring-indigo-500 text-gray-900 ${errors.membershipEndDate ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
                      />
                      {errors.membershipEndDate && (
                        <p className="text-red-500 text-[9px] mt-0.5 flex items-center gap-0.5">
                          <AlertCircle className="w-2.5 h-2.5" />{errors.membershipEndDate}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>


            {/* Insurance Details */}
            <div className={`bg-white rounded-lg p-2 border border-gray-200`}>
              <h2 className={`text-xs font-semibold text-gray-900 mb-1`}>Insurance Details</h2>
              <div className={`flex flex-wrap gap-2 items-end`}>
                <div className="flex-1 min-w-[120px]">
                  <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>Insurance</label>
                  <select name="insurance" value={formData.insurance} onChange={handleInputChange} className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 text-gray-900">
                    <option value="No">No</option>
                    <option value="Yes">Yes</option>
                  </select>
                </div>
                {formData.insurance === 'Yes' && (
                  <>
                    <div className="flex-1 min-w-[120px]">
                      <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>Type</label>
                      <select name="insuranceType" value={formData.insuranceType} onChange={handleInputChange} className="w-full px-2 py-1 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-indigo-500 text-gray-900">
                        <option value="Paid">Paid</option>
                        <option value="Advance">Advance</option>
                      </select>
                    </div>
                    {formData.insuranceType === 'Advance' && (
                      <>
                        <div className="flex-1 min-w-[120px]">
                          <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>Advance Payment Amount</label>
                          <input 
                            type="number" 
                            name="advanceGivenAmount" 
                            value={formData.advanceGivenAmount || ""} 
                            onChange={handleInputChange}
                            className={`w-full px-2 py-1 text-[10px] border border-gray-300 rounded-md focus:ring-1 focus:ring-gray-900 focus:border-gray-900 text-gray-900`} 
                            placeholder="0"
                            step="0.01"
                          />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>Co-Pay % <span className="text-red-500">*</span></label>
                          <input 
                            type="number" 
                            name="coPayPercent" 
                            value={formData.coPayPercent} 
                            onChange={handleInputChange} 
                            className={`w-full px-2 py-1 text-[10px] border rounded-md text-gray-900 ${errors.coPayPercent ? 'border-red-500 bg-red-50' : 'border-gray-300'}`} 
                            placeholder="0-100" 
                            min="0" 
                            max="100" 
                          />
                          {errors.coPayPercent && <p className="text-red-500 text-[9px] mt-0.5"><AlertCircle className="w-2.5 h-2.5 inline" /> {errors.coPayPercent}</p>}
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className={`block text-[10px] mb-0.5 font-medium text-gray-700`}>Need to Pay (Auto)</label>
                          <input 
                            type="text" 
                            value={`د.إ ${calculatedFields.needToPay.toFixed(2)}`} 
                            disabled 
                            className="w-full px-2 py-1 text-[10px] bg-gray-50 border border-gray-300 rounded-md text-gray-900 font-semibold" 
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>


            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <button 
                type="button" 
                onClick={resetForm} 
                className="px-3 py-1 border border-gray-300 rounded-md text-gray-800 hover:bg-gray-50 transition text-[10px] font-medium"
              >
                Reset Form
              </button>
              <button 
                type="button" 
                onClick={handleSubmit} 
                className={`px-3 py-1 text-[10px] bg-gray-900 text-white rounded-md hover:bg-gray-800 transition font-medium shadow-sm`}
              >
                Save Invoice
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </>
);
};

InvoiceManagementSystem.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedDashboard = withClinicAuth(InvoiceManagementSystem);
ProtectedDashboard.getLayout = InvoiceManagementSystem.getLayout;

export default ProtectedDashboard;
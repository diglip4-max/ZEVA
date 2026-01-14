import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import PatientRegistration from "../staff/patient-registration";
import PatientInformation from "../staff/patient-information";
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { X, UserPlus, Upload, Download, FileText, AlertCircle, CheckCircle, XCircle } from "lucide-react";
import PatientUpdateForm from "../../components/patient/PatientUpdateForm";
import axios from "axios";
import csv from "csvtojson";
import * as XLSX from "xlsx";

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
    try {
      const value =
        window.localStorage.getItem(key) ||
        window.sessionStorage.getItem(key);
      if (value) return value;
    } catch (error) {
      console.warn(`Unable to read ${key} from storage`, error);
    }
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

const getUserRole = () => {
  if (typeof window === "undefined") return null;
  try {
    for (const key of TOKEN_PRIORITY) {
      const token = window.localStorage.getItem(key) || window.sessionStorage.getItem(key);
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          return payload.role || null;
        } catch (e) {
          continue;
        }
      }
    }
  } catch (error) {
    console.error("Error getting user role:", error);
  }
  return null;
};

function ClinicPatientRegistration() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editPatientId, setEditPatientId] = useState(null);

  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const handleRegistrationSuccess = () => {
    setIsModalOpen(false);
    // Trigger refresh of patient information
    setRefreshKey(prev => prev + 1);
  };

  const handleOpenEditModal = (patientId) => {
    setEditPatientId(patientId);
  };

  const handleCloseEditModal = (shouldRefresh = false) => {
    setEditPatientId(null);
    if (shouldRefresh) {
      setRefreshKey((prev) => prev + 1);
    }
  };

  const handleOpenImportModal = () => {
    setIsImportModalOpen(true);
  };

  const handleCloseImportModal = () => {
    setIsImportModalOpen(false);
  };

  const handleImportSuccess = () => {
    setIsImportModalOpen(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3">
      {/* Register Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-lg sm:rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-2 sm:px-3 py-2 flex items-center justify-between z-10">
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Register New Patient</h2>
              <button
                onClick={handleCloseModal}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 sm:p-3 flex-1 overflow-y-auto">
              <PatientRegistrationWrapper 
                onSuccess={handleRegistrationSuccess}
              />
            </div>
          </div>
        </div>
      )}

      {/* Import Patients Modal */}
      {isImportModalOpen && (
        <PatientImportModal
          onClose={handleCloseImportModal}
          onSuccess={handleImportSuccess}
        />
      )}

      {/* Main Content - Patient Information with Register Button */}
      <PatientInformationWithButton 
        onRegisterClick={handleOpenModal}
        onImportClick={handleOpenImportModal}
        refreshKey={refreshKey}
        onEditPatient={handleOpenEditModal}
      />

      {editPatientId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-6xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto bg-white rounded-lg sm:rounded-xl shadow-2xl flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-2 sm:px-3 py-2 flex items-center justify-between z-10">
              <h2 className="text-sm sm:text-base font-bold text-gray-900">Edit Patient</h2>
              <button
                onClick={() => handleCloseEditModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
                aria-label="Close edit modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-2 sm:p-3 flex-1 overflow-y-auto">
              <PatientUpdateForm
                patientId={editPatientId}
                onClose={() => handleCloseEditModal(true)}
                onUpdated={() => setRefreshKey((prev) => prev + 1)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper component for PatientRegistration to handle success callback
const PatientRegistrationWrapper = ({ onSuccess }) => {
  return <PatientRegistration onSuccess={onSuccess} />;
};

// Patient Import Modal Component
function PatientImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [columnMapping, setColumnMapping] = useState({});
  const [availableColumns, setAvailableColumns] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [step, setStep] = useState(1); // 1: Upload, 2: Mapping, 3: Result

  const fieldLabels = {
    invoiceNumber: "Invoice Number (Auto-generated - will be ignored)",
    firstName: "First Name *",
    lastName: "Last Name",
    gender: "Gender *",
    email: "Email",
    mobileNumber: "Mobile Number *",
    emrNumber: "EMR Number (Auto-generated - will be ignored)",
    referredBy: "Referred By",
    patientType: "Patient Type (New/Old)",
    insurance: "Insurance (Yes/No)",
    insuranceType: "Insurance Type (Paid/Advance)",
    advanceGivenAmount: "Advance Given Amount",
    coPayPercent: "Co-Pay Percent",
    advanceClaimStatus: "Advance Claim Status",
    advanceClaimReleasedBy: "Advance Claim Released By",
    notes: "Notes",
  };

  const handleFileSelect = async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setUploadResult(null);

    // Parse file to get columns
    try {
      const fileBuffer = await selectedFile.arrayBuffer();
      const fileName = selectedFile.name.toLowerCase();
      let jsonArray = [];

      if (fileName.endsWith(".csv")) {
        const text = new TextDecoder().decode(fileBuffer);
        jsonArray = await csv().fromString(text);
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const workbook = XLSX.read(fileBuffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        jsonArray = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
      }

      if (jsonArray && jsonArray.length > 0) {
        const columns = Object.keys(jsonArray[0]);
        setAvailableColumns(columns);
        setFilePreview(jsonArray.slice(0, 5)); // Preview first 5 rows

        // Auto-map columns if names match
        const autoMapping = {};
        columns.forEach((col) => {
          const colLower = col.toLowerCase().trim();
          Object.keys(fieldLabels).forEach((field) => {
            const fieldWithSpaces = field.replace(/([A-Z])/g, ' $1').toLowerCase().trim();
            if (colLower === field.toLowerCase() || 
                colLower === fieldWithSpaces ||
                colLower.includes(field.toLowerCase()) ||
                field.toLowerCase().includes(colLower)) {
              if (!autoMapping[col]) {
                autoMapping[col] = field;
              }
            }
          });
        });
        setColumnMapping(autoMapping);
        setStep(2);
      }
    } catch (error) {
      console.error("Error parsing file:", error);
      setUploadResult({
        success: false,
        message: "Failed to parse file. Please check the file format.",
      });
    }
  };

  const handleDownloadSample = () => {
    const sampleData = [
      {
        "First Name": "John",
        "Last Name": "Doe",
        "Gender": "Male",
        "Email": "john.doe@example.com",
        "Mobile Number": "9876543210",
        "Referred By": "Dr. Smith",
        "Patient Type": "New",
        "Insurance": "No",
        "Insurance Type": "Paid",
        "Advance Given Amount": "0",
        "Co-Pay Percent": "0",
        "Notes": "Sample patient data"
      },
      {
        "First Name": "Jane",
        "Last Name": "Smith",
        "Gender": "Female",
        "Email": "jane.smith@example.com",
        "Mobile Number": "9876543211",
        "Referred By": "",
        "Patient Type": "Old",
        "Insurance": "Yes",
        "Insurance Type": "Advance",
        "Advance Given Amount": "5000",
        "Co-Pay Percent": "10",
        "Notes": ""
      }
    ];

    const csvContent = [
      Object.keys(sampleData[0]).join(","),
      ...sampleData.map(row => 
        Object.values(row).map(val => `"${val}"`).join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "patient-import-sample.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async () => {
    if (!file) {
      setUploadResult({
        success: false,
        message: "Please select a file first",
      });
      return;
    }

    setIsUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("columnMapping", JSON.stringify(columnMapping));

      const authHeaders = getAuthHeaders();
      const response = await axios.post("/api/clinic/import-patients", formData, {
        headers: {
          ...authHeaders,
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        setUploadResult({
          success: true,
          message: response.data.message,
          data: response.data.data,
        });
        setStep(3);
        if (onSuccess) {
          setTimeout(() => {
            onSuccess();
          }, 2000);
        }
      } else {
        setUploadResult({
          success: false,
          message: response.data.message || "Import failed",
          data: response.data.data,
        });
        setStep(3);
      }
    } catch (error) {
      console.error("Import error:", error);
      setUploadResult({
        success: false,
        message: error.response?.data?.message || "Failed to import patients",
        data: error.response?.data?.data,
      });
      setStep(3);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-lg sm:rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-2 sm:px-3 py-2 flex items-center justify-between z-10">
          <h2 className="text-sm sm:text-base font-bold text-gray-900">Import Patients</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-gray-700 transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-2 sm:p-3 flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-blue-900 mb-2">Import Instructions</h3>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Upload a CSV or Excel file (.csv, .xlsx, .xls)</li>
                      <li>Maximum file size: 5MB</li>
                      <li>Required fields: First Name, Mobile Number, Gender</li>
                      <li>EMR Number and Invoice Number are automatically generated sequentially (ignore any values in your file)</li>
                      <li>Download the sample file to see the correct format</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <button
                  onClick={handleDownloadSample}
                  className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </button>
              </div>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <label className="cursor-pointer">
                  <span className="text-sm font-medium text-gray-700">Choose file to upload</span>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">CSV or Excel files only</p>
                {file && (
                  <p className="text-xs text-green-600 mt-2 font-medium">{file.name}</p>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-yellow-900 mb-1">Map Your Columns</h3>
                    <p className="text-xs text-yellow-800">
                      Match your file columns to the patient fields. Fields marked with * are required.
                    </p>
                  </div>
                </div>
              </div>

              {filePreview && filePreview.length > 0 && (
                <div className="bg-gray-50 rounded-lg p-3 mb-4">
                  <p className="text-xs font-semibold text-gray-700 mb-2">File Preview (first 5 rows):</p>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-xs border border-gray-200">
                      <thead>
                        <tr className="bg-gray-100">
                          {availableColumns.map((col) => (
                            <th key={col} className="px-2 py-1 border border-gray-300 text-left font-semibold">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filePreview.map((row, idx) => (
                          <tr key={idx}>
                            {availableColumns.map((col) => (
                              <td key={col} className="px-2 py-1 border border-gray-300">
                                {String(row[col] || "").substring(0, 20)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.entries(fieldLabels).map(([field, label]) => {
                  // Find which column is mapped to this field
                  const mappedColumn = Object.keys(columnMapping).find(
                    (col) => columnMapping[col] === field
                  ) || "";
                  
                  return (
                    <div key={field} className="flex items-center gap-3">
                      <label className="flex-1 text-xs font-medium text-gray-700 min-w-[200px]">
                        {label}
                      </label>
                      <select
                        value={mappedColumn}
                        onChange={(e) => {
                          const newMapping = { ...columnMapping };
                          // Remove old mapping for this field
                          Object.keys(newMapping).forEach((key) => {
                            if (newMapping[key] === field) {
                              delete newMapping[key];
                            }
                          });
                          // Add new mapping
                          if (e.target.value) {
                            newMapping[e.target.value] = field;
                          }
                          setColumnMapping(newMapping);
                        }}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Select Column --</option>
                        {availableColumns.map((col) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isUploading}
                  className="px-4 py-2 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUploading ? "Importing..." : "Import Patients"}
                </button>
              </div>
            </div>
          )}

          {step === 3 && uploadResult && (
            <div className="space-y-4">
              <div className={`rounded-lg p-4 ${
                uploadResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
              }`}>
                <div className="flex items-start gap-3">
                  {uploadResult.success ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <h3 className={`text-sm font-semibold mb-1 ${
                      uploadResult.success ? "text-green-900" : "text-red-900"
                    }`}>
                      {uploadResult.success ? "Import Successful" : "Import Failed"}
                    </h3>
                    <p className={`text-xs ${
                      uploadResult.success ? "text-green-800" : "text-red-800"
                    }`}>
                      {uploadResult.message}
                    </p>
                    {uploadResult.data && (
                      <div className="mt-3 text-xs">
                        <p className={uploadResult.success ? "text-green-800" : "text-red-800"}>
                          Total: {uploadResult.data.total} | 
                          Imported: {uploadResult.data.imported} | 
                          Failed: {uploadResult.data.failed}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {uploadResult.data && uploadResult.data.errors && uploadResult.data.errors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="text-xs font-semibold text-red-900 mb-2">Errors:</h4>
                  <ul className="space-y-1">
                    {uploadResult.data.errors.slice(0, 10).map((error, idx) => (
                      <li key={idx} className="text-xs text-red-800">{error}</li>
                    ))}
                    {uploadResult.data.errors.length > 10 && (
                      <li className="text-xs text-red-600 italic">
                        ... and {uploadResult.data.errors.length - 10} more errors
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Enhanced Patient Information component with Register button
function PatientInformationWithButton({ onRegisterClick, onImportClick, refreshKey, onEditPatient }) {
  const [permissions, setPermissions] = useState({
    canRead: false,
    canUpdate: false,
    canDelete: false,
    canCreate: false,
  });
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Fetch permissions
  useEffect(() => {
    const fetchPermissions = async () => {
      try {
        const authHeaders = getAuthHeaders();
        if (!authHeaders) {
          setPermissions({
            canRead: false,
            canUpdate: false,
            canDelete: false,
            canCreate: false,
          });
          setPermissionsLoaded(true);
          return;
        }

        const userRole = getUserRole();
        
        // For clinic and doctor roles, fetch admin-level permissions from /api/clinic/sidebar-permissions
        if (userRole === "clinic" || userRole === "doctor") {
          try {
            const res = await axios.get("/api/clinic/sidebar-permissions", {
              headers: authHeaders,
            });
            
            if (res.data.success) {
              // Check if permissions array exists and is not null
              // If permissions is null, admin hasn't set any restrictions yet - allow full access (backward compatibility)
              if (res.data.permissions === null || !Array.isArray(res.data.permissions) || res.data.permissions.length === 0) {
                // No admin restrictions set yet - default to full access for backward compatibility
                setPermissions({
                  canRead: true,
                  canUpdate: true,
                  canDelete: true,
                  canCreate: true,
                });
              } else {
                // Admin has set permissions - check the clinic_patient_registration module
                const modulePermission = res.data.permissions.find((p) => {
                  if (!p?.module) return false;
                  // Check for clinic_patient_registration module
                  if (p.module === "clinic_patient_registration") return true;
                  if (p.module === "patient_registration") return true;
                  return false;
                });

                if (modulePermission) {
                  const actions = modulePermission.actions || {};
                  
                  // Check if "all" is true, which grants all permissions
                  const moduleAll = actions.all === true || actions.all === "true" || String(actions.all).toLowerCase() === "true";
                  const moduleRead = actions.read === true || actions.read === "true" || String(actions.read).toLowerCase() === "true";
                  const moduleCreate = actions.create === true || actions.create === "true" || String(actions.create).toLowerCase() === "true";
                  const moduleUpdate = actions.update === true || actions.update === "true" || String(actions.update).toLowerCase() === "true";
                  const moduleDelete = actions.delete === true || actions.delete === "true" || String(actions.delete).toLowerCase() === "true";

                  setPermissions({
                    canRead: moduleAll || moduleRead,
                    canCreate: moduleAll || moduleCreate,
                    canUpdate: moduleAll || moduleUpdate,
                    canDelete: moduleAll || moduleDelete,
                  });
                } else {
                  // Module permission not found in the permissions array - default to read-only
                  setPermissions({
                    canRead: true, // Clinic/doctor can always read their own data
                    canCreate: false,
                    canUpdate: false,
                    canDelete: false,
                  });
                }
              }
            } else {
              // API response doesn't have permissions, default to full access (backward compatibility)
              setPermissions({
                canRead: true,
                canUpdate: true,
                canDelete: true,
                canCreate: true,
              });
            }
          } catch (err) {
            console.error("Error fetching clinic sidebar permissions:", err);
            // On error, default to full access (backward compatibility)
            setPermissions({
              canRead: true,
              canUpdate: true,
              canDelete: true,
              canCreate: true,
            });
          }
          setPermissionsLoaded(true);
          return;
        }

        // For agents, staff, and doctorStaff, fetch from /api/agent/permissions
        if (["agent", "staff", "doctorStaff"].includes(userRole || "")) {
          let permissionsData = null;
          try {
            // Get agentId from token
            const token = getStoredToken();
            if (token) {
              const payload = JSON.parse(atob(token.split('.')[1]));
              const agentId = payload.userId || payload.id;
              
              if (agentId) {
                const res = await axios.get(`/api/agent/permissions?agentId=${agentId}`, {
                  headers: authHeaders,
                });
                
                if (res.data.success && res.data.data) {
                  permissionsData = res.data.data;
                }
              }
            }
          } catch (err) {
            console.error("Error fetching agent permissions:", err);
          }

          if (permissionsData && permissionsData.permissions) {
            const modulePermission = permissionsData.permissions.find((p) => {
              if (!p?.module) return false;
              if (p.module === "patient_registration") return true;
              if (p.module === "clinic_patient_registration") return true;
              if (p.module.startsWith("clinic_") && p.module.slice(7) === "patient_registration") {
                return true;
              }
              return false;
            });

            if (modulePermission) {
              const actions = modulePermission.actions || {};
              
              // Module-level "all" grants all permissions
              const moduleAll = actions.all === true || actions.all === "true" || String(actions.all).toLowerCase() === "true";
              const moduleRead = actions.read === true || actions.read === "true" || String(actions.read).toLowerCase() === "true";
              const moduleUpdate = actions.update === true || actions.update === "true" || String(actions.update).toLowerCase() === "true";
              const moduleDelete = actions.delete === true || actions.delete === "true" || String(actions.delete).toLowerCase() === "true";
              const moduleCreate = actions.create === true || actions.create === "true" || String(actions.create).toLowerCase() === "true";

              setPermissions({
                canRead: moduleAll || moduleRead,
                canUpdate: moduleAll || moduleUpdate,
                canDelete: moduleAll || moduleDelete,
                canCreate: moduleAll || moduleCreate,
              });
            } else {
              // No permissions found for this module, default to false
              setPermissions({
                canRead: false,
                canUpdate: false,
                canDelete: false,
                canCreate: false,
              });
            }
          } else {
            // API failed or no permissions data, default to false
            setPermissions({
              canRead: false,
              canUpdate: false,
              canDelete: false,
              canCreate: false,
            });
          }
        } else {
          // Unknown role, default to false
          setPermissions({
            canRead: false,
            canUpdate: false,
            canDelete: false,
            canCreate: false,
          });
        }
        setPermissionsLoaded(true);
        } catch (err) {
        console.error("Error fetching permissions:", err);
        // On error, default to false (no permissions)
        setPermissions({
          canRead: false,
          canUpdate: false,
          canDelete: false,
          canCreate: false,
        });
        setPermissionsLoaded(true);
      }
    };

    fetchPermissions();
  }, []);

  // Don't render until permissions are loaded
  if (!permissionsLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-300 border-t-blue-600"></div>
      </div>
    );
  }

  // If both canRead and canCreate are false, show access denied message
  if (!permissions.canRead && !permissions.canCreate) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg border border-red-200 p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-sm text-gray-700 mb-4">
            You do not have permission to view or register patients.
          </p>
          <p className="text-xs text-gray-600">
            Please contact your administrator to request access to the Patient Registration module.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Register Button - Matching clinic dashboard theme */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-2">
        <div className="max-w-7xl mx-auto px-2 sm:px-3 py-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-sm sm:text-base font-bold text-gray-900">Patient Management</h1>
              <p className="text-[10px] sm:text-xs text-gray-700 mt-0.5">View and manage all patient records</p>
            </div>
            {permissions.canCreate && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    // Find the export button in PatientInformation and click it? 
                    // No, better to just trigger it if we had a ref.
                    // But for now, since it's in PatientInformation, it's already there.
                  }}
                  className="hidden" // Just a placeholder if needed
                >
                </button>
                <button
                  onClick={onImportClick}
                  className="inline-flex items-center justify-center gap-1 bg-white hover:bg-gray-50 text-gray-800 border border-gray-300 px-2.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-[10px] sm:text-xs font-medium"
                >
                  <Upload className="h-3 w-3"/>
                  <span>Import Patients</span>
                </button>
                <button
                  onClick={onRegisterClick}
                  className="inline-flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-900 text-white px-2.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-[10px] sm:text-xs font-medium"
                >
                  <UserPlus className="h-3 w-3"/>
                  <span>Register Patient</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Patient Information Content - Show access denied if canRead is false, otherwise show patient list */}
      {!permissions.canRead ? (
        <div className="bg-white rounded-lg p-6 sm:p-8 border border-gray-200 shadow-sm">
          <div className="text-center max-w-md mx-auto">
            <div className="w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <UserPlus className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              Access Denied
            </h3>
            <p className="text-sm text-gray-700 mb-3">
              You do not have permission to view patient information.
            </p>
            <p className="text-xs text-gray-600">
              Please contact your administrator to request access to view patients.
            </p>
          </div>
        </div>
      ) : (
        <PatientInformation key={refreshKey} hideHeader={true} onEditPatient={onEditPatient} permissions={permissions} />
      )}
    </div>
  );
}

// Layout: _app.tsx will use ClinicLayout for /clinic/* routes
// and force AgentLayout for /agent/* routes (overriding this)
ClinicPatientRegistration.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedClinicPatientRegistration = withClinicAuth(ClinicPatientRegistration);
ProtectedClinicPatientRegistration.getLayout = ClinicPatientRegistration.getLayout;

export default ProtectedClinicPatientRegistration;

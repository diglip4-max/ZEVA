import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import PatientRegistration from "../staff/patient-registration";
import PatientInformation from "../staff/patient-information";
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { X, UserPlus } from "lucide-react";
import PatientUpdateForm from "../../components/patient/PatientUpdateForm";
import axios from "axios";

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

      {/* Main Content - Patient Information with Register Button */}
      <PatientInformationWithButton 
        onRegisterClick={handleOpenModal} 
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

// Enhanced Patient Information component with Register button
function PatientInformationWithButton({ onRegisterClick, refreshKey, onEditPatient }) {
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
        
        // Clinic and doctor roles have full access by default - no need to check permissions
        if (userRole === "clinic" || userRole === "doctor") {
          setPermissions({
            canRead: true,
            canUpdate: true,
            canDelete: true,
            canCreate: true,
          });
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
              <button
                onClick={onRegisterClick}
                className="inline-flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-900 text-white px-2.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-[10px] sm:text-xs font-medium"
              >
                <UserPlus className="h-3 w-3"/>
                <span>Register Patient</span>
              </button>
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

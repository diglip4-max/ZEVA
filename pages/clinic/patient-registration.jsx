import React, { useState } from "react";
import { useRouter } from "next/router";
import PatientRegistration from "../staff/patient-registration";
import PatientInformation from "../staff/patient-information";
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { X, UserPlus } from "lucide-react";
import PatientUpdateForm from "../../components/patient/PatientUpdateForm";

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
            <button
              onClick={onRegisterClick}
              className="inline-flex items-center justify-center gap-1 bg-gray-800 hover:bg-gray-900 text-white px-2.5 py-1.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-[10px] sm:text-xs font-medium"
            >
              <UserPlus className="h-3 w-3" />
              <span>Register Patient</span>
            </button>
          </div>
        </div>
      </div>

      {/* Patient Information Content - key prop forces remount on refresh */}
      <PatientInformation key={refreshKey} hideHeader={true} onEditPatient={onEditPatient} />
    </div>
  );
}

ClinicPatientRegistration.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedClinicPatientRegistration = withClinicAuth(ClinicPatientRegistration);
ProtectedClinicPatientRegistration.getLayout = ClinicPatientRegistration.getLayout;

export default ProtectedClinicPatientRegistration;

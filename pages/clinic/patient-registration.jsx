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
    <div className="min-h-screen bg-gray-50">
      {/* Register Patient Modal - Compact */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto flex flex-col">
            {/* Compact Modal Header */}
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-gray-700" />
                Register New Patient
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content - Compact */}
            <div className="p-4 flex-1 overflow-y-auto">
              <PatientRegistrationWrapper 
                onSuccess={handleRegistrationSuccess}
                isCompact={true}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto flex flex-col bg-white rounded-xl shadow-2xl">
            <div className="sticky top-0 bg-gray-50 border-b border-gray-200 px-4 py-3 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-gray-700" />
                Edit Patient
              </h2>
              <button
                onClick={() => handleCloseEditModal(false)}
                className="p-1.5 hover:bg-gray-200 rounded-lg text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Close edit modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              <PatientUpdateForm
                patientId={editPatientId}
                embedded
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
const PatientRegistrationWrapper = ({ onSuccess, isCompact = false }) => {
  return <PatientRegistration onSuccess={onSuccess} isCompact={isCompact} />;
};

// Enhanced Patient Information component with Register button
function PatientInformationWithButton({ onRegisterClick, refreshKey, onEditPatient }) {
  return (
    <div>
      {/* Header with Register Button */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
              <p className="text-sm text-gray-700 mt-1">View and manage all patient records</p>
            </div>
            <button
              onClick={onRegisterClick}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
            >
              <UserPlus className="w-5 h-5" />
              Register Patient
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

import React, { useState } from "react";
import { useRouter } from "next/router";
import PatientRegistration from "../staff/patient-registration";
import PatientInformation from "../staff/patient-information";
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';
import { X, UserPlus } from "lucide-react";

function ClinicPatientRegistration() {
  const router = useRouter();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Register Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/50 backdrop-blur-sm">
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-y-auto my-4">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#2D9AA5]" />
                Register New Patient
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-gray-100 rounded-lg text-gray-700 transition-colors"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-4">
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
      />
    </div>
  );
}

// Wrapper component for PatientRegistration to handle success callback
const PatientRegistrationWrapper = ({ onSuccess }) => {
  return <PatientRegistration onSuccess={onSuccess} />;
};

// Enhanced Patient Information component with Register button
function PatientInformationWithButton({ onRegisterClick, refreshKey }) {
  return (
    <div>
      {/* Header with Register Button */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Patient Management</h1>
              <p className="text-sm text-gray-600 mt-1">View and manage all patient records</p>
            </div>
            <button
              onClick={onRegisterClick}
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#2D9AA5] hover:bg-[#258a94] text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
            >
              <UserPlus className="w-5 h-5" />
              Register Patient
            </button>
          </div>
        </div>
      </div>

      {/* Patient Information Content - key prop forces remount on refresh */}
      <PatientInformation key={refreshKey} hideHeader={true} />
    </div>
  );
}

ClinicPatientRegistration.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedClinicPatientRegistration = withClinicAuth(ClinicPatientRegistration);
ProtectedClinicPatientRegistration.getLayout = ClinicPatientRegistration.getLayout;

export default ProtectedClinicPatientRegistration;

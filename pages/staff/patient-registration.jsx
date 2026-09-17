'use client';
import React from "react";
import withClinicAuth from '../../components/withStaffAuth';
import PatientRegistrationForm from "@/components/patient/PatientRegistrationForm";
import ClinicLayout from '../../components/staffLayout';

const WrappedPatientRegistration = ({ isModal, ...props }) => {
  return <PatientRegistrationForm {...props} />;
};

const ProtectedStaffPatientRegistration = withClinicAuth(WrappedPatientRegistration);
ProtectedStaffPatientRegistration.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

export { PatientRegistrationForm as InvoiceManagementSystem };
export default ProtectedStaffPatientRegistration;

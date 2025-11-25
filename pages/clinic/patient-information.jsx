import React from "react";
import PatientInformation from "../staff/patient-information";
import ClinicLayout from '../../components/ClinicLayout';
import withClinicAuth from '../../components/withClinicAuth';

function ClinicPatientInformation() {
  return <PatientInformation />;
}

ClinicPatientInformation.getLayout = function PageLayout(page) {
  return <ClinicLayout>{page}</ClinicLayout>;
};

const ProtectedClinicPatientInformation = withClinicAuth(ClinicPatientInformation);
ProtectedClinicPatientInformation.getLayout = ClinicPatientInformation.getLayout;

export default ProtectedClinicPatientInformation;


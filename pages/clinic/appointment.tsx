import React from "react";
import ClinicLayout from "../../components/ClinicLayout";
import withClinicAuth from "../../components/withClinicAuth";
import { ClinicAllAppointmentsPageBase } from "./all-appointment";
import type { NextPageWithLayout } from "../_app";

type AppointmentPageProps = {
  contextOverride?: "clinic" | "agent" | null;
};

const AppointmentPage: NextPageWithLayout = ({
  contextOverride = null,
}: AppointmentPageProps) => {
  return <ClinicAllAppointmentsPageBase contextOverride={contextOverride} />;
};

AppointmentPage.getLayout = function PageLayout(page: React.ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

export const AppointmentPageBase = AppointmentPage;

const ProtectedAppointmentPage = withClinicAuth(
  AppointmentPage
) as NextPageWithLayout;
ProtectedAppointmentPage.getLayout = AppointmentPage.getLayout;

export default ProtectedAppointmentPage;

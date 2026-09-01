import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement } from "react";
import SettingsManager from "./_components/SettingsManager";

const SettingsPage: NextPageWithLayout = () => {
  return (
    <>
      <SettingsManager />
    </>
  );
};

SettingsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedSettingsPage = withClinicAuth(
  SettingsPage,
) as NextPageWithLayout;
ProtectedSettingsPage.getLayout = SettingsPage.getLayout;

export default ProtectedSettingsPage;

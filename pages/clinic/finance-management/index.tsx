import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement } from "react";
import FinanceManager from "./_components/FinanceManager";

const FinanceManagementPage: NextPageWithLayout = () => {
  return (
    <>
      <FinanceManager />
    </>
  );
};

// Layout configuration
FinanceManagementPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

// Export protected page with auth
const ProtectedFinanceManagementPage = withClinicAuth(
  FinanceManagementPage,
) as NextPageWithLayout;
ProtectedFinanceManagementPage.getLayout = FinanceManagementPage.getLayout;

export default ProtectedFinanceManagementPage;

import ClinicLayout from "@/components/ClinicLayout";
import withClinicAuth from "@/components/withClinicAuth";
import { NextPageWithLayout } from "@/pages/_app";
import React, { ReactElement } from "react";
import NotificationLogs from "./_components/NotificationLogs";

const NotificationLogsPage: NextPageWithLayout = () => {
  return (
    <>
      <NotificationLogs />
    </>
  );
};

NotificationLogsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ClinicLayout hideSidebar={false} hideHeader={false}>
      {page}
    </ClinicLayout>
  );
};

const ProtectedNotificationLogsPage = withClinicAuth(
  NotificationLogsPage,
) as NextPageWithLayout;
ProtectedNotificationLogsPage.getLayout = NotificationLogsPage.getLayout;

export default ProtectedNotificationLogsPage;

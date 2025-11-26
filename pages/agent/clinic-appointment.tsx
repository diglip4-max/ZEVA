import React from "react";
import AgentLayout from "../../components/AgentLayout";
import withAgentAuth from "../../components/withAgentAuth";
import { AppointmentPageBase } from "../clinic/appointment";

const AgentClinicAppointmentPage = () => {
  return <AppointmentPageBase contextOverride="agent" />;
};

AgentClinicAppointmentPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <AgentLayout>{page}</AgentLayout>;
};

const ProtectedAgentClinicAppointmentPage = withAgentAuth(AgentClinicAppointmentPage);
ProtectedAgentClinicAppointmentPage.getLayout = AgentClinicAppointmentPage.getLayout;

export default ProtectedAgentClinicAppointmentPage;


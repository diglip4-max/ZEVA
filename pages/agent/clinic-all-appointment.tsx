import React from "react";
import AgentLayout from "../../components/AgentLayout";
import withAgentAuth from "../../components/withAgentAuth";
import { ClinicAllAppointmentsPageBase } from "../clinic/all-appointment";

const AgentClinicAllAppointmentPage = () => {
  return <ClinicAllAppointmentsPageBase contextOverride="agent" />;
};

AgentClinicAllAppointmentPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <AgentLayout>{page}</AgentLayout>;
};

const ProtectedAgentClinicAllAppointmentPage = withAgentAuth(AgentClinicAllAppointmentPage);
ProtectedAgentClinicAllAppointmentPage.getLayout = AgentClinicAllAppointmentPage.getLayout;

export default ProtectedAgentClinicAllAppointmentPage;


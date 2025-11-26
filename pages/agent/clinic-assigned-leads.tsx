import React from "react";
import AgentLayout from "../../components/AgentLayout";
import withAgentAuth from "../../components/withAgentAuth";
import { AssignedLeadsPageBase } from "../clinic/assigned-leads";

const AgentClinicAssignedLeadsPage = () => {
  return <AssignedLeadsPageBase contextOverride="agent" />;
};

AgentClinicAssignedLeadsPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <AgentLayout>{page}</AgentLayout>;
};

const ProtectedAgentClinicAssignedLeadsPage = withAgentAuth(AgentClinicAssignedLeadsPage);
ProtectedAgentClinicAssignedLeadsPage.getLayout = AgentClinicAssignedLeadsPage.getLayout;

export default ProtectedAgentClinicAssignedLeadsPage;


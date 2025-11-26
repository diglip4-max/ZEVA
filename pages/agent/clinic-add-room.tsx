import React from "react";
import AgentLayout from "../../components/AgentLayout";
import withAgentAuth from "../../components/withAgentAuth";
import { AddRoomPageBase } from "../clinic/add-room";

const AgentClinicAddRoomPage = () => {
  return <AddRoomPageBase contextOverride="agent" />;
};

AgentClinicAddRoomPage.getLayout = function PageLayout(page: React.ReactNode) {
  return <AgentLayout>{page}</AgentLayout>;
};

const ProtectedAgentClinicAddRoomPage = withAgentAuth(AgentClinicAddRoomPage);
ProtectedAgentClinicAddRoomPage.getLayout = AgentClinicAddRoomPage.getLayout;

export default ProtectedAgentClinicAddRoomPage;


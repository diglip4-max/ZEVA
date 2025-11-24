import React from "react";
import AgentLayout from "../../components/AgentLayout"; // ✅ use Agent layout
import withAgentAuth from "../../components/withAgentAuth"; // ✅ use Agent auth

const AgentDashboard = () => {
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white shadow rounded-lg p-8">
        <h1 className="text-3xl font-bold">Hi, Agent!</h1>
        <p className="mt-3 text-sm text-gray-600">
          Welcome to your agent dashboard.
        </p>

        {/* quick stats / placeholder */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 border rounded">
            Leads
            <br />
            <span className="text-xl font-semibold">--</span>
          </div>
          <div className="p-4 border rounded">
            Conversions
            <br />
            <span className="text-xl font-semibold">--</span>
          </div>
          <div className="p-4 border rounded">
            Tasks
            <br />
            <span className="text-xl font-semibold">--</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ✅ Attach Agent layout
AgentDashboard.getLayout = function PageLayout(page) {
  return <AgentLayout>{page}</AgentLayout>;
};

// ✅ Apply Agent Auth HOC
const ProtectedAgentDashboard = withAgentAuth(
  AgentDashboard
);

// ✅ Reassign layout for the protected version
ProtectedAgentDashboard.getLayout = AgentDashboard.getLayout;

export default ProtectedAgentDashboard;

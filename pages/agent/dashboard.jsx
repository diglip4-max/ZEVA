import React, { useState, useEffect } from "react";
import AgentLayout from "../../components/AgentLayout"; // ✅ use Agent layout
import withAgentAuth from "../../components/withAgentAuth"; // ✅ use Agent auth

const AgentDashboard = () => {
  const [userInfo, setUserInfo] = useState({ name: "", email: "" });

  useEffect(() => {
    // Decode JWT token to get user info
    const getToken = () => {
      if (typeof window !== "undefined") {
        // Check for agentToken first, then userToken
        return localStorage.getItem("agentToken") || localStorage.getItem("userToken");
      }
      return null;
    };

    const decodeToken = (token) => {
      try {
        if (!token) {
          return null;
        }
        
        // JWT tokens have 3 parts: header.payload.signature
        const parts = token.split(".");
        if (parts.length !== 3) {
          return null;
        }

        // Decode the payload (second part)
        const payload = JSON.parse(atob(parts[1]));
        
        return {
          name: payload.name || "",
          email: payload.email || "",
        };
      } catch (error) {
        console.error("Error decoding token:", error);
        return null;
      }
    };

    const token = getToken();
    
    if (token) {
      const decoded = decodeToken(token);
      if (decoded) {
        setUserInfo(decoded);
      }
    }
  }, []);

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white shadow rounded-lg p-8">
        {/* User Info Section at the top */}
        <div className="mb-6 pb-6 border-b border-gray-200">
          {userInfo.name && (
            <h1 className="text-3xl font-bold text-gray-900">
              Hi, {userInfo.name}!
            </h1>
          )}
          {!userInfo.name && (
            <h1 className="text-3xl font-bold text-gray-900">Hi, Agent!</h1>
          )}
          {userInfo.email && (
            <p className="mt-2 text-sm text-gray-600">{userInfo.email}</p>
          )}
          <p className="mt-3 text-sm text-gray-600">
            Welcome to your agent dashboard.
          </p>
        </div>

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

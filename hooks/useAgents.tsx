import { User } from "@/types/users";
import React from "react";

const useAgents = () => {
  const [agents, setAgents] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);

  const getTokenByPath = () => {
    if (typeof window === "undefined") return null;

    const pathname = window.location.pathname;

    if (pathname === "/clinic/inbox") {
      return localStorage.getItem("clinicToken");
    } else if (pathname === "/staff/clinic-inbox") {
      return localStorage.getItem("agentToken");
    } else {
      return localStorage.getItem("userToken");
    }
  };

  const token = getTokenByPath();

  const fetchAgents = React.useCallback(async (token: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lead-ms/get-agents?role=agent`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setAgents(data.agents);
      } else {
        setAgents([]);
      }
    } catch (error) {
      console.error("Error fetching agents:", error);
      setAgents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // This effect can be used to fetch agents when needed
    if (token) fetchAgents(token);
  }, [token, fetchAgents]);

  const state = {
    agents,
    loading,
  };
  return {
    state,
    setAgents,
    setLoading,
    fetchAgents,
  };
};

export default useAgents;

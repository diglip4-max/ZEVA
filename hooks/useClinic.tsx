import React from "react";
import { Clinic } from "@/types/clinic";
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";

interface ClinicResponse {
  success: boolean;
  clinic: Clinic;
  message: string;
}

const useClinic = () => {
  const token = getTokenByPath();
  const [loading, setLoading] = React.useState<boolean>(false);
  const [clinic, setClinic] = React.useState<Clinic | null>(null);

  const fetchClinic = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get<ClinicResponse>(`/api/clinics/myallClinic`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const response = res.data;
      if (response.success) {
        setClinic(response.clinic);
      } else {
        throw new Error(response.message || "Failed to fetch clinic data");
      }
    } catch (err: any) {
      console.error("Error fetching clinic:", err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [token]);

  React.useEffect(() => {
    fetchClinic();
  }, [fetchClinic]);

  return {
    loading,
    clinic,
    setClinic,
    fetchClinic,
  };
};

export default useClinic;

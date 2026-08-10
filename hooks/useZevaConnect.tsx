import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import React from "react";
import { toast } from "react-toastify";

const useZevaConnect = () => {
  const token = getTokenByPath();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleZevaConnect = async () => {
    setIsLoading(true);

    // Show loading toast
    const loadingToastId = toast.loading("Connecting to Team Chat...", {
      position: "top-right",
    });

    try {
      const { data } = await axios.post(
        "/api/zeva-connect/create-ticket",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data.redirectUrl) {
        throw new Error("Failed to create ticket");
      }

      // Update loading toast to success
      toast.update(loadingToastId, {
        render: "Connected successfully! Opening Team Chat...",
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });

      const { redirectUrl } = data;

      // Open in new tab
      window.open(redirectUrl, "_blank");
      // window.location.href = redirectUrl; // same tab
    } catch (err: any) {
      console.error(err);

      // Update loading toast to error
      toast.update(loadingToastId, {
        render:
          err?.response?.data?.message ||
          "Could not open Team Chat. Please try again.",
        type: "error",
        isLoading: false,
        autoClose: 5000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    token,
    isLoading,
    setIsLoading,
    handleZevaConnect,
  };
};

export default useZevaConnect;

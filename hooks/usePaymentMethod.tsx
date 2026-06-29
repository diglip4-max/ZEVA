import React from "react";
import axios from "axios";
import { getAuthHeaders, handleError } from "@/lib/helper";

// Define PaymentMethod interface
export interface PaymentMethod {
  _id: string;
  clinicId: string;
  name: string;
  uniqueName: string;
  status: "active" | "inactive";
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

// Define API response interface
interface PaymentMethodsResponse {
  success: boolean;
  message: string;
  data: {
    paymentMethods: PaymentMethod[];
    statistics: {
      total: number;
      active: number;
      inactive: number;
    };
    pagination: {
      totalResults: number;
      totalPages: number;
      currentPage: number;
      limit: number;
      hasMore: boolean;
    };
  };
}

const usePaymentMethod = () => {
  const [paymentMethods, setPaymentMethods] = React.useState<PaymentMethod[]>(
    [],
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const getPaymentMethods = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const authHeaders = getAuthHeaders();
      if (!authHeaders) {
        throw new Error("Not authenticated");
      }

      // Fetch with limit 500 as requested
      const response = await axios.get<PaymentMethodsResponse>(
        "/api/payment-method",
        {
          headers: authHeaders,
          params: {
            limit: 500,
          },
        },
      );

      if (response.data.success) {
        setPaymentMethods(response.data.data.paymentMethods);
      } else {
        throw new Error(
          response.data.message || "Failed to fetch payment methods",
        );
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
      handleError(error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to fetch payment methods",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    getPaymentMethods();
  }, [getPaymentMethods]);

  return {
    paymentMethods,
    loading,
    error,
    refresh: getPaymentMethods,
  };
};

export default usePaymentMethod;

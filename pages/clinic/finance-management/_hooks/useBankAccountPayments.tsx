// _hooks/useBankAccountPayments.ts
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";

export interface BankAccountPayment {
  _id: string;
  paymentNumber: string;
  amount: number;
  date: string;
  method: string;
  supplierId?: { _id: string; name: string } | string;
  transactionId?:
    | { _id: string; invoiceNumber: string; category?: string }
    | string;
}

export default function useBankAccountPayments(accountId: string | null) {
  const [payments, setPayments] = useState<BankAccountPayment[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!accountId) {
      setPayments([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(
        `/api/finance/bank-accounts/${accountId}/payments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Failed to load payment history");
      }

      setPayments(data.data || []);
    } catch (err: any) {
      setError(
        err.message || "Something went wrong while loading payment history",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { payments, loading, error, refetch: fetchPayments };
}

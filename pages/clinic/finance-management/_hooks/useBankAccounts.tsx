// _hooks/useBankAccounts.ts
import { getTokenByPath } from "@/lib/helper";
import axios from "axios";
import { useCallback, useEffect, useState } from "react";

export interface BankAccountData {
  _id: string;
  bankName: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  currentBalance: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

export interface NewBankAccountInput {
  bankName: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  currentBalance?: number;
  notes?: string;
}

export default function useBankAccounts() {
  const [bankAccounts, setBankAccounts] = useState<BankAccountData[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get("/api/finance/bank-accounts", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!data.success) {
        throw new Error(data.message || "Failed to load bank accounts");
      }

      setBankAccounts(data.data || []);
      setTotalBalance(data.totalBalance || 0);
    } catch (err: any) {
      setError(
        err.message || "Something went wrong while loading bank accounts",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const createAccount = useCallback(
    async (input: NewBankAccountInput) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.post("/api/finance/bank-accounts", input, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!data.success) {
          return { ok: false as const, warning: data.message as string };
        }

        await fetchAccounts();
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchAccounts],
  );

  const editAccount = useCallback(
    async (id: string, input: Partial<NewBankAccountInput>) => {
      setSaving(true);
      try {
        const token = getTokenByPath();
        const { data } = await axios.patch(
          `/api/finance/bank-accounts/${id}`,
          input,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          },
        );

        if (!data.success) {
          return { ok: false as const, warning: data.message as string };
        }

        await fetchAccounts();
        return { ok: true as const };
      } catch (err: any) {
        return { ok: false as const, warning: err.message };
      } finally {
        setSaving(false);
      }
    },
    [fetchAccounts],
  );

  return {
    bankAccounts,
    totalBalance,
    loading,
    saving,
    error,
    createAccount,
    editAccount,
    refetch: fetchAccounts,
  };
}

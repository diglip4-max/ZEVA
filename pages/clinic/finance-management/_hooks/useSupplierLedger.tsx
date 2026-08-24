import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import { useCallback, useEffect, useState } from "react";

export interface SupplierInfo {
  _id: string;
  code: string;
  name: string;
  mobile?: string;
  telephone?: string;
  email?: string;
  creditDays?: number;
  status: string;
}

export interface LedgerBill {
  _id: string;
  invoiceNumber: string;
  category: string;
  dueDate?: string;
  amount: number;
  paidAmount: number;
  balance: number;
  status: string;
}

export interface LedgerPayment {
  _id: string;
  paymentNumber: string;
  amount: number;
  date: string;
  method: string;
  reversed: boolean;
  transactionId?:
    | { _id: string; invoiceNumber: string; category?: string }
    | string;
}

export interface LedgerCheque {
  _id: string;
  chequeNumber: string;
  bank: string;
  payee: string;
  amount: number;
  chequeDate: string;
  status: string;
}

export interface LedgerSummary {
  totalBilled: number;
  totalPaid: number;
  totalBalance: number;
  overdueCount: number;
  billCount: number;
  totalPayments: number;
  totalCheques: number;
  pendingCheques: number;
  bouncedCheques: number;
}

const DEFAULT_SUMMARY: LedgerSummary = {
  totalBilled: 0,
  totalPaid: 0,
  totalBalance: 0,
  overdueCount: 0,
  billCount: 0,
  totalPayments: 0,
  totalCheques: 0,
  pendingCheques: 0,
  bouncedCheques: 0,
};

export default function useSupplierLedger(supplierId: string | null) {
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [bills, setBills] = useState<LedgerBill[]>([]);
  const [payments, setPayments] = useState<LedgerPayment[]>([]);
  const [cheques, setCheques] = useState<LedgerCheque[]>([]);
  const [summary, setSummary] = useState<LedgerSummary>(DEFAULT_SUMMARY);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLedger = useCallback(async () => {
    if (!supplierId) {
      setSupplier(null);
      setBills([]);
      setPayments([]);
      setCheques([]);
      setSummary(DEFAULT_SUMMARY);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const token = getTokenByPath();
      const { data } = await axios.get(
        `/api/finance/suppliers/${supplierId}/ledger`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (!data.success) {
        throw new Error(data.message || "Failed to load supplier ledger");
      }

      const { supplier, bills, payments, cheques, summary } = data?.data || {};
      setSupplier(supplier);
      setBills(bills || []);
      setPayments(payments || []);
      setCheques(cheques || []);
      setSummary({ ...DEFAULT_SUMMARY, ...(summary || {}) });
    } catch (err: any) {
      setError(err.message || "Something went wrong while loading the ledger");
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  return {
    supplier,
    bills,
    payments,
    cheques,
    summary,
    loading,
    error,
    refetch: fetchLedger,
  };
}

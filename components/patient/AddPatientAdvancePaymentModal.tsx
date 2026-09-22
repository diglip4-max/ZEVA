import React, { useState, useEffect } from "react";
import {
  X,
  Save,
  Loader2,
  DollarSign,
  CreditCard,
  Landmark,
  Zap,
  Plus,
  Wallet,
} from "lucide-react";
import axios from "axios";
import { getTokenByPath } from "@/lib/helper";
import { getCurrencySymbol } from "@/lib/currencyHelper";
import { clsx, type ClassValue } from "clsx";

function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

interface AddPatientAdvancePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName?: string;
  onSuccess: (data: any) => void;
}

const paymentMethods = [
  {
    label: "Cash",
    value: "Cash",
    icon: DollarSign,
    color: "text-emerald-500",
    bg: "bg-emerald-50",
  },
  {
    label: "Card",
    value: "Card",
    icon: CreditCard,
    color: "text-blue-500",
    bg: "bg-blue-50",
  },
  {
    label: "BT (Bank Transfer)",
    value: "BT",
    icon: Landmark,
    color: "text-amber-500",
    bg: "bg-amber-50",
  },
  {
    label: "Tabby",
    value: "Tabby",
    icon: Zap,
    color: "text-purple-500",
    bg: "bg-purple-50",
  },
  {
    label: "Tamara",
    value: "Tamara",
    icon: Zap,
    color: "text-orange-500",
    bg: "bg-orange-50",
  },
];

const AddPatientAdvancePaymentModal: React.FC<
  AddPatientAdvancePaymentModalProps
> = ({ isOpen, onClose, patientId, patientName, onSuccess }) => {
  const [amount, setAmount] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash");
  const [useMultiplePayment, setUseMultiplePayment] = useState(false);
  const [multiplePaymentMethods, setMultiplePaymentMethods] = useState<Array<{ paymentMethod: string; amount: number }>>([]);
  const [notes, setNotes] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicCurrency, setClinicCurrency] = useState<string>("INR");

  useEffect(() => {
    if (isOpen) {
      fetchClinicCurrency();
    }
  }, [isOpen]);

  // Sync multiple payment methods total to Amount field
  useEffect(() => {
    if (useMultiplePayment && multiplePaymentMethods.length > 0) {
      const total = multiplePaymentMethods.reduce((sum, pm) => sum + (pm.amount || 0), 0);
      const roundedTotal = Math.round(total * 100) / 100;
      setAmount(String(roundedTotal));
    }
  }, [useMultiplePayment, multiplePaymentMethods]);

  const fetchClinicCurrency = async () => {
    try {
      const token = getTokenByPath();
      if (!token) return;
      const res = await axios.get('/api/clinics/myallClinic', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success && res.data.clinic?.currency) {
        setClinicCurrency(res.data.clinic.currency);
      }
    } catch (e) {
      console.error('Error fetching clinic currency:', e);
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Please enter a valid amount.");
      return;
    }

    if (useMultiplePayment && multiplePaymentMethods.length === 0) {
      setError("Please add at least one payment method.");
      return;
    }

    const totalMultiple = multiplePaymentMethods.reduce((sum, pm) => sum + (pm.amount || 0), 0);
    if (useMultiplePayment && Math.abs(totalMultiple - Number(amount)) > 0.01) {
      setError(`Total of payment methods (${getCurrencySymbol(clinicCurrency)}${totalMultiple.toFixed(2)}) must equal the amount (${getCurrencySymbol(clinicCurrency)}${Number(amount).toFixed(2)}).`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = getTokenByPath();
      const payload: any = {
        amount: Number(amount),
        paymentMethod: useMultiplePayment ? "Multiple" : paymentMethod,
        notes,
      };
      if (useMultiplePayment) {
        payload.multiplePayments = multiplePaymentMethods;
      }
      const { data } = await axios.post(
        `/api/clinic/patient-balance/add-advance-payment/${patientId}`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (data.success) {
        onSuccess(data.data);
        handleClose();
      } else {
        setError(data.message || "Failed to add advance payment.");
      }
    } catch (err: any) {
      console.error("Error adding advance payment:", err);
      setError(
        err.response?.data?.message || "An error occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAmount("");
    setPaymentMethod("Cash");
    setUseMultiplePayment(false);
    setMultiplePaymentMethods([]);
    setNotes("");
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-gray-900/60 backdrop-blur-md transition-opacity duration-300"
        onClick={handleClose}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-2xl sm:rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto transform transition-all animate-in fade-in zoom-in duration-300">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-700 px-5 sm:px-8 py-4 sm:py-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-white/20 rounded-xl backdrop-blur-sm flex items-center justify-center min-w-[32px] sm:min-w-[40px]">
              <span className="text-white font-bold text-sm sm:text-base">{getCurrencySymbol(clinicCurrency)}</span>
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-white">
                Add Advance Payment
              </h3>
              <p className="text-emerald-100 text-[10px] sm:text-xs font-medium opacity-80">
                Record a credit balance for {patientName || "the patient"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 sm:p-2 hover:bg-white/10 rounded-xl text-white/80 hover:text-white transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          {/* Amount Input */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-700">
              {/* <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500" /> */}
              Amount to Add
            </label>
            <div className="relative group">
              <div className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-emerald-500 transition-colors">
                <span className="text-base sm:text-lg font-bold">{getCurrencySymbol(clinicCurrency)}</span>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0.01"
                className="w-full pl-12 sm:pl-16 pr-4 py-3 sm:py-4 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all text-lg sm:text-xl font-bold text-gray-700 placeholder:text-gray-300"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-700">
                Payment Method
              </label>
              {!useMultiplePayment ? (
                <button
                  type="button"
                  onClick={() => setUseMultiplePayment(true)}
                  className="text-[10px] sm:text-xs font-semibold text-emerald-600 hover:text-emerald-700 underline underline-offset-2"
                >
                  Use Multiple
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { setUseMultiplePayment(false); setMultiplePaymentMethods([]); }}
                  className="text-[10px] sm:text-xs font-semibold text-gray-500 hover:text-gray-700 underline underline-offset-2"
                >
                  Use Single
                </button>
              )}
            </div>

            {!useMultiplePayment ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {paymentMethods.map((method) => {
                  const isSelected = paymentMethod === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      className={cn(
                        "flex flex-row sm:flex-col items-center justify-center p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border-2 transition-all gap-2 sm:gap-1",
                        isSelected
                          ? "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/10"
                          : "border-gray-100 hover:border-gray-200 bg-white",
                      )}
                    >
                      <span
                        className={cn(
                          "text-[10px] font-bold uppercase tracking-wider",
                          isSelected ? "text-emerald-700" : "text-gray-500",
                        )}
                      >
                        {method.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5" /> Multiple Payment Methods
                  </h5>
                  <button
                    type="button"
                    onClick={() => setMultiplePaymentMethods((prev) => [...prev, { paymentMethod: "Cash", amount: 0 }])}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-white px-2.5 py-1.5 rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors"
                  >
                    <Plus className="w-3 h-3" /> Add Method
                  </button>
                </div>
                {multiplePaymentMethods.length === 0 && (
                  <p className="text-[10px] text-gray-500 text-center py-2">Click "Add Method" to add payment methods</p>
                )}
                {multiplePaymentMethods.map((pm, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={pm.paymentMethod}
                      onChange={(e) => setMultiplePaymentMethods((prev) => prev.map((p, i) => i === idx ? { ...p, paymentMethod: e.target.value } : p))}
                      className="flex-1 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      {paymentMethods.map((m) => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <div className="relative w-28">
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400">{getCurrencySymbol(clinicCurrency)}</span>
                      <input
                        type="number"
                        value={pm.amount || ""}
                        onChange={(e) => setMultiplePaymentMethods((prev) => prev.map((p, i) => i === idx ? { ...p, amount: parseFloat(e.target.value) || 0 } : p))}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                        className="w-full pl-7 pr-2 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-700 focus:ring-2 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setMultiplePaymentMethods((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {multiplePaymentMethods.length > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-emerald-200">
                    <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Total</span>
                    <span className="text-sm font-bold text-emerald-800">{getCurrencySymbol(clinicCurrency)}{multiplePaymentMethods.reduce((sum, pm) => sum + (pm.amount || 0), 0).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs sm:text-sm font-bold text-gray-700">
             
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="E.g. Advance for laser treatment package..."
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl sm:rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none transition-all h-20 sm:h-24 resize-none text-xs sm:text-sm text-gray-600 placeholder:text-gray-400 font-medium"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs sm:text-sm text-red-600 bg-red-50 p-3 sm:p-4 rounded-xl sm:rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-1">
              <X className="w-4 h-4 shrink-0" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row gap-3 sm:gap-4 pt-2 sm:pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 sm:py-4 bg-gray-100 text-gray-600 text-sm font-bold rounded-xl sm:rounded-2xl hover:bg-gray-200 transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-6 py-3 sm:py-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white text-sm font-bold rounded-xl sm:rounded-2xl hover:shadow-lg hover:shadow-emerald-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Add Advance
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPatientAdvancePaymentModal;

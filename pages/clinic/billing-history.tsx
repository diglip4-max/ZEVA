'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { ArrowLeft, FileText, Loader2, Check } from 'lucide-react';

const TOKEN_PRIORITY = [
  'clinicToken',
  'doctorToken',
  'agentToken',
  'staffToken',
  'adminToken',
];

const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  for (const key of TOKEN_PRIORITY) {
    const value = localStorage.getItem(key) || sessionStorage.getItem(key);
    if (value) return value;
  }
  return null;
};

const getAuthHeaders = () => {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : null;
};

const BillingHistoryPage = () => {
  const router = useRouter();
  const { appointmentId, patientId } = router.query;
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (appointmentId || patientId) {
      fetchBillingHistory();
    }
  }, [appointmentId, patientId]);

  const fetchBillingHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const headers = getAuthHeaders();
      // Use patientId if provided, otherwise use appointmentId
      const apiParam = patientId || appointmentId;
      const response = await axios.get(
        `/api/clinic/billing-history/${apiParam}`,
        headers ? { headers } : undefined
      );
      
      // Extract billings array from response (response.data.billings or response.data)
      const billingData = response.data?.billings || response.data;
      if (billingData && Array.isArray(billingData)) {
        setBillingHistory(billingData);
      } else {
        setBillingHistory([]);
      }
    } catch (err: any) {
      console.error('Error fetching billing history:', err);
      setError(err.response?.data?.message || 'Failed to load billing history');
      setBillingHistory([]);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number | string) => {
    return `${Number(amount || 0).toFixed(2)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-teal-600" />
                Billing History
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {patientId ? `Patient ID: ${patientId}` : `Appointment ID: ${appointmentId}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Container */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-800 text-white text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-semibold">Invoice ID</th>
                  <th className="px-4 py-3 text-left font-semibold">Treatment/Package</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold text-red-300">Pending</th>
                  <th className="px-4 py-3 text-right font-semibold">Advance</th>
                  <th className="px-4 py-3 text-right font-semibold">Advance Used</th>
                  <th className="px-4 py-3 text-right font-semibold">Past Advance</th>
                  <th className="px-4 py-3 text-right font-semibold">Past Advance Used</th>
                  <th className="px-4 py-3 text-center font-semibold">Qty</th>
                  <th className="px-4 py-3 text-center font-semibold">Session</th>
                  <th className="px-4 py-3 text-left font-semibold">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                        <span className="text-sm text-gray-500">Loading billing history...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12">
                      <div className="text-center">
                        <div className="text-sm text-red-600 font-medium mb-2">{error}</div>
                        <button
                          onClick={fetchBillingHistory}
                          className="px-4 py-2 text-xs font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : billingHistory.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-12">
                      <div className="text-center text-sm text-gray-500">
                        No billing history found for this appointment
                      </div>
                    </td>
                  </tr>
                ) : (
                  billingHistory.map((billing, index) => (
                    <tr 
                      key={billing._id || index} 
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-gray-900">
                          {billing.invoiceNumber || '—'}
                        </div>
                        <div className="text-[10px] text-gray-500">
                          {formatDate(billing.invoicedDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-xs font-medium text-gray-900 mb-1">
                            {billing.treatment || billing.package || '—'}
                          </div>
                          {billing.selectedPackageTreatments && billing.selectedPackageTreatments.length > 0 ? (
                            <div className="mt-1 space-y-1">
                              {billing.selectedPackageTreatments.map((item: any, idx: number) => (
                                <div key={idx} className="text-[10px] text-gray-600 flex items-center gap-1.5 pl-1">
                                  <Check className="w-3 h-3 text-emerald-500" strokeWidth={3} />
                                  <span>
                                    {item.treatmentName}
                                    {Number(item.sessions || 0) > 0 && `: ${item.sessions} session(s)`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            Number(billing.session || billing.sessions || 0) > 0 && (
                              <div className="text-[10px] text-gray-600 font-medium">
                                {billing.session || billing.sessions} session{(Number(billing.session || billing.sessions) || 1) !== 1 ? 's' : ''}
                              </div>
                            )
                          )}
                          {billing.description && (
                            <div className="text-[10px] text-gray-500 truncate max-w-xs mt-1">
                              {billing.description}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs font-semibold text-gray-900">
                          {formatCurrency(billing.amount)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs font-semibold text-emerald-700">
                          {formatCurrency(billing.paid)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(billing.pending || 0) > 0 ? (
                          <div className="text-xs font-bold text-red-600">
                            {formatCurrency(billing.pending)}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">—</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs text-gray-700">
                          {formatCurrency(billing.advance || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs text-gray-700">
                          {formatCurrency(billing.advanceUsed || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs text-gray-700">
                          {formatCurrency(billing.pastAdvance || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-xs text-gray-700">
                          {formatCurrency(billing.pastAdvanceUsed || 0)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs font-medium text-gray-700">
                          {billing.quantity || billing.qty || 1}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="text-xs text-gray-700">
                          {Number(billing.session || billing.sessions || 0) > 0 
                            ? (billing.session || billing.sessions) 
                            : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-medium text-gray-700">
                          {billing.multiplePayments && billing.multiplePayments.length > 0 ? (
                            billing.multiplePayments.map((payment: any, idx: number) => (
                              <span key={idx}>
                                {payment.paymentMethod}: {Number(payment.amount || 0).toFixed(2)}
                                {idx < billing.multiplePayments.length - 1 ? ', ' : ''}
                              </span>
                            ))
                          ) : (
                            billing.paymentMethod || '—'
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {!loading && !error && billingHistory.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300 text-xs font-bold">
                    <td className="px-4 py-3 text-gray-900">Totals</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.amount) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.paid) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.pending) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.advance) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.advanceUsed) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.pastAdvance) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.pastAdvanceUsed) || 0), 0))}
                    </td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

// Export without auth wrapper to avoid layout
export default BillingHistoryPage;

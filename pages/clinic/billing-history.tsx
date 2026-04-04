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
  const [patientData, setPatientData] = useState<any>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (appointmentId || patientId) {
      fetchBillingHistory();
      if (patientId) {
        fetchPatientDetails();
      }
    }
  }, [appointmentId, patientId]);

  const fetchPatientDetails = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await axios.get(
        `/api/clinic/patient-registration?id=${patientId}`,
        headers ? { headers } : undefined
      );
      if (response.data.success) {
        setPatientData(response.data.patient);
      }
    } catch (err) {
      console.error('Error fetching patient details:', err);
    }
  };

  const generateInvoicePDF = async () => {
    try {
      setIsGeneratingPDF(true);
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(20, 184, 166); // teal-600
      doc.setFont("helvetica", "bold");
      doc.text("ZEVA CLINIC", 14, 20);

      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.setFont("helvetica", "normal");
      doc.text("Billing Statement / Invoice History", 14, 26);

      doc.setFontSize(14);
      doc.setTextColor(30, 41, 59); // slate-800
      doc.text("INVOICE", pageWidth - 14, 20, { align: "right" });

      const today = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      doc.setFontSize(9);
      doc.text(`Generated: ${today}`, pageWidth - 14, 26, { align: "right" });

      // Patient Details
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(14, 32, pageWidth - 14, 32);

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105); // slate-600
      doc.text("PATIENT INFORMATION", 14, 40);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(`Name: ${patientData?.firstName || ''} ${patientData?.lastName || ''}`, 14, 46);
      doc.text(`Patient ID: ${patientId || '—'}`, 14, 51);
      doc.text(`EMR No: ${patientData?.emrNumber || '—'}`, 14, 56);
      
      doc.text(`Mobile: ${patientData?.mobileNumber || '—'}`, pageWidth / 2, 46);
      doc.text(`Email: ${patientData?.email || '—'}`, pageWidth / 2, 51);
      doc.text(`Gender: ${patientData?.gender || '—'}`, pageWidth / 2, 56);

      // Billing History Table
      const tableRows = billingHistory.map(item => {
        const originalAmount = item.originalAmount || 0;
        const finalAmount = item.amount || 0;
        const discountAmount = originalAmount > finalAmount ? (originalAmount - finalAmount) : 0;
        const percent = item.discountPercent || (originalAmount > 0 ? (discountAmount / originalAmount * 100) : 0);
        
        return [
          formatDate(item.invoicedDate),
          item.invoiceNumber || '—',
          item.treatment || item.package || '—',
          percent > 0 ? `${percent.toFixed(1)}%` : '—',
          formatCurrency(item.amount),
          formatCurrency(item.paid),
          formatCurrency(item.pending || 0),
          formatCurrency(item.advance || 0),
          formatCurrency(item.advanceUsed || 0),
          formatCurrency(item.pastAdvance || 0),
          formatCurrency(item.pastAdvanceUsed || 0),
          item.quantity || 1,
          item.sessions || item.session || 0,
          item.multiplePayments && item.multiplePayments.length > 0 
            ? item.multiplePayments.map((p: any) => `${p.paymentMethod}: ${Number(p.amount || 0).toFixed(2)}`).join('\n')
            : item.paymentMethod || '—'
        ];
      });

      autoTable(doc, {
        startY: 65,
        head: [['Date', 'Invoice ID', 'Treatment/Package', 'Disc.', 'Total', 'Paid', 'Pending', 'Adv.', 'Adv.Used', 'PastAdv.', 'P.Adv.Used', 'Qty', 'Sess.', 'Method']],
        body: tableRows,
        theme: 'striped',
        headStyles: { 
          fillColor: [31, 41, 55], // Gray-800
          fontSize: 7,
          fontStyle: 'bold',
        },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'right' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
          11: { halign: 'center' },
          12: { halign: 'center' }
        },
        margin: { top: 65, left: 10, right: 10 }
      });

      // Summary Section
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      const totalAmount = billingHistory.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      const totalPaid = billingHistory.reduce((sum, b) => sum + (Number(b.paid) || 0), 0);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.text('SUMMARY', pageWidth - 70, finalY);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text('Total Billed:', pageWidth - 70, finalY + 6);
      doc.text(`AED ${formatCurrency(totalAmount)}`, pageWidth - 14, finalY + 6, { align: 'right' });
      
      doc.text('Total Paid:', pageWidth - 70, finalY + 11);
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text(`AED ${formatCurrency(totalPaid)}`, pageWidth - 14, finalY + 11, { align: 'right' });
      
      // Removed Total Outstanding (Pending) from summary as per user request
      /*
      doc.setTextColor(220, 38, 38); // red-600
      doc.setFont('helvetica', 'bold');
      doc.text('Total Outstanding:', pageWidth - 70, finalY + 16);
      doc.text(`AED ${formatCurrency(totalPending)}`, pageWidth - 14, finalY + 16, { align: 'right' });
      */

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184); // slate-400
        doc.text(
          `Page ${i} of ${pageCount} | ZEVA Clinic Management System`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      doc.save(`Invoice_${patientData?.firstName || 'Patient'}_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

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
      let billingData = response.data?.billings || response.data;
      if (billingData && Array.isArray(billingData)) {
        // Filter out advance-only records and pure balance adjustments
        // but keep actual pending balance payments
        billingData = billingData.filter((b: any) => 
          (!b.isAdvanceOnly && b.treatment !== "Advance Payment" && b.treatment !== "Historical Advance Balance") ||
          b.treatment === "Pending Balance Payment"
        );
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
          <div className="flex items-center gap-3">
            <button
              onClick={generateInvoicePDF}
              disabled={isGeneratingPDF || billingHistory.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md"
            >
              {isGeneratingPDF ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              {isGeneratingPDF ? "Generating..." : "Generate Invoice"}
            </button>
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
                  <th className="px-4 py-3 text-center font-semibold">Discount</th>
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
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const isDoctorDiscount = billing.isDoctorDiscountApplied;
                          const isAgentDiscount = billing.isAgentDiscountApplied;
                          // const discountType = isDoctorDiscount ? billing.doctorDiscountType : (isAgentDiscount ? billing.agentDiscountType : null);
                          // const discountValue = isDoctorDiscount ? billing.doctorDiscountAmount : (isAgentDiscount ? billing.agentDiscountAmount : 0);
                          const originalAmount = billing.originalAmount || 0;
                          const finalAmount = billing.amount || 0;
                          const discountAmount = originalAmount > finalAmount ? (originalAmount - finalAmount) : 0;
                          const percent = billing.discountPercent || (originalAmount > 0 ? (discountAmount / originalAmount * 100) : 0);

                          if (!isDoctorDiscount && !isAgentDiscount && percent <= 0) {
                            return <div className="text-xs text-gray-400">—</div>;
                          }

                          return (
                            <div className="flex flex-col items-center gap-1">
                              {percent > 0 && (
                                <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
                                  {Number(percent).toFixed(1)}% OFF
                                </div>
                              )}
                              {discountAmount > 0 && (
                                <div className="text-[10px] font-medium text-gray-500">
                                  Saved AED {formatCurrency(discountAmount)}
                                </div>
                              )}
                              {(isDoctorDiscount || isAgentDiscount) && (
                                <div className="text-[8px] uppercase tracking-wider text-gray-400 font-bold">
                                  {isDoctorDiscount ? 'Doctor Disc.' : 'Agent Disc.'}
                                </div>
                              )}
                            </div>
                          );
                        })()}
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
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.amount) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-700">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.paid) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {/* Pending amount sum removed as per user request */}
                      —
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

'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import { ArrowLeft, FileText, Loader2, Check, X, Wallet, CreditCard, CheckCircle, Eye } from 'lucide-react';
import { getCurrencySymbol } from '@/lib/currencyHelper';

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
  const { appoinmentfirstName, patientfirstName } = router.query;
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<any>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clinicCurrency, setClinicCurrency] = useState('INR');
  const [searchInvoice, setSearchInvoice] = useState('');
  const [showPaymentHistoryModal, setShowPaymentHistoryModal] = useState(false);
  const [selectedPaymentHistoryBilling, setSelectedPaymentHistoryBilling] = useState<any>(null);

  // Cache for package names to avoid repeated API calls
  const [packageNameCache, setPackageNameCache] = useState<Record<string, string>>({});
  const [allPackagesLoaded, setAllPackagesLoaded] = useState(false);

  // Function to fetch package name by ID
  const fetchPackageName = async (packageId: string): Promise<string> => {
    // Return from cache if available
    if (packageNameCache[packageId]) {
      return packageNameCache[packageId];
    }

    // If we haven't loaded all packages yet, load them now
    if (!allPackagesLoaded) {
      try {
        const headers = getAuthHeaders();
        if (!headers) return 'Package';

        const res = await axios.get('/api/clinic/packages', { headers });
        if (res.data?.success && res.data?.packages) {
          // Build cache from all packages
          const newCache: Record<string, string> = { ...packageNameCache };
          res.data.packages.forEach((pkg: any) => {
            if (pkg._id && pkg.name) {
              newCache[pkg._id] = pkg.name;
            }
          });
          setPackageNameCache(newCache);
          setAllPackagesLoaded(true);

          // Return the package name if found
          if (newCache[packageId]) {
            return newCache[packageId];
          }
        }
      } catch (error) {
        console.error('Error fetching packages:', error);
      }
    }

    return 'Package';
  };

  useEffect(() => {
    if (appointmentId || patientId) {
      fetchBillingHistory();
      if (patientId) {
        fetchPatientDetails();
      }
    }
  }, [appointmentId, patientId]);

  // Fetch clinic currency preference
  useEffect(() => {
    const fetchClinicCurrency = async () => {
      try {
        const headers = getAuthHeaders();
        if (!headers || typeof headers !== 'object' || Object.keys(headers).length === 0) return;
        const res = await axios.get('/api/clinics/myallClinic', { headers });
        if (res.data.success && res.data.clinic?.currency) {
          setClinicCurrency(res.data.clinic.currency);
        }
      } catch (e) {
        console.error('Error fetching clinic currency:', e);
      }
    };
    fetchClinicCurrency();
  }, []);

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
      // doc.text("ZEVA CLINIC", 14, 20);

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
        const totalPercent = originalAmount > 0 ? (discountAmount / originalAmount * 100) : 0;

        // Build discount description
        const discountParts = [];
        if (totalPercent > 0) {
          discountParts.push(`${totalPercent.toFixed(1)}%`);
        }
        // Free sessions USED (redeemed at ₹0)
        if (item.usedFreeSessions && item.usedFreeSessions.length > 0) {
          discountParts.push(`Free Session: ${item.usedFreeSessions.join(', ')}`);
        }
        // Free sessions EARNED (from bundle offer)
        if (item.offerType === 'bundle' && item.offerFreeSession && item.offerFreeSession.length > 0) {
          discountParts.push(`Free: ${item.offerFreeSession.join(', ')}`);
        }
        if (item.cashbackWalletUsed && item.cashbackWalletUsed > 0) {
          discountParts.push(`Cashback: ${getCurrencySymbol(clinicCurrency)}${item.cashbackWalletUsed.toFixed(2)}`);
        }
        if (item.isDoctorDiscountApplied) {
          discountParts.push('Dr. Disc.');
        }
        if (item.isAgentDiscountApplied) {
          discountParts.push('Agent Disc.');
        }
        if (item.membershipDiscountApplied > 0) {
          discountParts.push('Memb.');
        }

        const discountDesc = discountParts.length > 0 ? discountParts.join('\n') : '—';

        // Build offer applied description
        const offerName = item.offerName || item.offerTitle;
        const offerType = item.offerType;
        const offerParts = [];

        if (offerName) {
          offerParts.push(offerName);
          if (offerType) {
            const typeLabel = offerType === 'instant_discount' ? 'Discount' :
              offerType === 'cashback' ? 'Cashback' :
                offerType === 'bundle' ? 'Bundle' : offerType;
            offerParts.push(`[${typeLabel}]`);
          }
        }

        // Add amounts
        if (item.offerDiscountAmount && item.offerDiscountAmount > 0) {
          offerParts.push(`Disc: ${getCurrencySymbol(clinicCurrency)}${item.offerDiscountAmount.toFixed(2)}`);
        }
        if (item.cashbackAmount && item.cashbackAmount > 0) {
          offerParts.push(`Earned: ${getCurrencySymbol(clinicCurrency)}${item.cashbackAmount.toFixed(2)}`);
        }
        if (item.cashbackWalletUsed && item.cashbackWalletUsed > 0) {
          offerParts.push(`Used: ${getCurrencySymbol(clinicCurrency)}${item.cashbackWalletUsed.toFixed(2)}`);
        }
        // Free sessions USED (redeemed at ₹0)
        if (item.usedFreeSessions && item.usedFreeSessions.length > 0) {
          offerParts.push(`Free Session: ${item.usedFreeSessions.join(', ')}`);
        }
        // Free sessions EARNED (from bundle offer)
        if (item.offerType === 'bundle' && item.offerFreeSession && item.offerFreeSession.length > 0) {
          offerParts.push(`Free: ${item.offerFreeSession.join(', ')}`);
        }

        const offerDesc = offerParts.length > 0 ? offerParts.join('\n') : '—';

        // Build treatment/package display including unpaid packages paid
        let treatmentPackageDisplay = item.treatment || item.package || '—';
        if (item.unpaidPackagesPaid && item.unpaidPackagesPaid.length > 0) {
          const packageNames = item.unpaidPackagesPaid.map((pkg: any) =>
            `Pkg: ${pkg.packageName || 'Package'} (${formatCurrency(pkg.amount || 0)})`
          );
          treatmentPackageDisplay = treatmentPackageDisplay + '\n' + packageNames.join('\n');
        }

        return [
          formatDate(item.invoicedDate),
          item.invoiceNumber || '—',
          item.invoicedBy || '—',
          treatmentPackageDisplay,
          item.doctorName || '—',
          discountDesc,
          offerDesc,
          formatCurrency(item.originalAmount || item.amount || 0),
          formatCurrency(item.amount),
          formatCurrency(item.paid),
          formatCurrency(item.pending || 0),
          formatCurrency(item.advance || 0),
          formatCurrency(item.advanceUsed || 0),
          formatCurrency(item.claimAmountUsed || 0),
          formatCurrency(item.pendingClaimUsed || 0),
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
        head: [['Date', 'Invoice ID', 'Invoiced By', 'Treatment/Package', 'Doctor', 'Disc.', 'Offer Applied', 'Orig. Amt', 'Total', 'Paid', 'Pending', 'Adv.', 'Adv.Used', 'Claim Used', 'Pend.Cl Paid', 'PastAdv.', 'P.Adv.Used', 'Qty', 'Sess.', 'Method']],
        body: tableRows,
        theme: 'striped',
        headStyles: {
          fillColor: [31, 41, 55], // Gray-800
          fontSize: 7,
          fontStyle: 'bold',
        },
        bodyStyles: { fontSize: 7 },
        columnStyles: {
          4: { halign: 'left' },
          5: { halign: 'center' },
          6: { halign: 'left' },
          7: { halign: 'right' },
          8: { halign: 'right' },
          9: { halign: 'right' },
          10: { halign: 'right' },
          11: { halign: 'right' },
          12: { halign: 'right' },
          13: { halign: 'right' },
          14: { halign: 'right' },
          15: { halign: 'right' },
          16: { halign: 'center' },
          17: { halign: 'center' }
        },
        margin: { top: 65, left: 8, right: 8 }
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
      doc.text(`${getCurrencySymbol(clinicCurrency)} ${formatCurrency(totalAmount)}`, pageWidth - 14, finalY + 6, { align: 'right' });

      doc.text('Total Paid:', pageWidth - 70, finalY + 11);
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text(`${getCurrencySymbol(clinicCurrency)} ${formatCurrency(totalPaid)}`, pageWidth - 14, finalY + 11, { align: 'right' });

      // Removed Total Outstanding (Pending) from summary as per user request
      /*
      doc.setTextColor(220, 38, 38); // red-600
      doc.setFont('helvetica', 'bold');
      doc.text('Total Outstanding:', pageWidth - 70, finalY + 16);
      doc.text(`${getCurrencySymbol(clinicCurrency)} ${formatCurrency(totalPending)}`, pageWidth - 14, finalY + 16, { align: 'right' });
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
        // Include all billing records including advance payments
        // Advance payment records are included for tracking
        billingData = billingData.filter((b: any) =>
          !b.isAdvanceOnly ||
          b.treatment === "Advance Payment" ||
          b.treatment === "Pending Balance Payment"
        );

        // Resolve package names for unpaidPackagesPaid
        const billingsWithPackageNames = await Promise.all(
          billingData.map(async (billing: any) => {
            if (billing.unpaidPackagesPaid && billing.unpaidPackagesPaid.length > 0) {
              const updatedPackages = await Promise.all(
                billing.unpaidPackagesPaid.map(async (pkg: any) => {
                  // If packageName already exists, use it
                  if (pkg.packageName) {
                    return pkg;
                  }

                  // Otherwise fetch it from packageId
                  if (pkg.packageId) {
                    const packageName = await fetchPackageName(pkg.packageId);
                    return { ...pkg, packageName };
                  }

                  return pkg;
                })
              );
              return { ...billing, unpaidPackagesPaid: updatedPackages };
            }
            return billing;
          })
        );

        setBillingHistory(billingsWithPackageNames);
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
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                <FileText className="w-5 h-5 sm:w-6 h-6 text-teal-600 flex-shrink-0" />
                <span className="truncate">Billing History</span>
              </h1>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {patientId ? (
                  <>
                    Patient Name: <span className="font-semibold text-gray-800">{patientData ? `${patientData.firstName} ${patientData.lastName || ''}` : (patientfirstName || appoinmentfirstName || 'Loading...')}</span> | Patient ID: {patientId}
                  </>
                ) : (
                  `Appointment ID: ${appointmentId}`
                )}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search Invoice Number */}
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search Invoice No..."
                value={searchInvoice}
                onChange={(e) => setSearchInvoice(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
              {searchInvoice && (
                <button
                  onClick={() => setSearchInvoice('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              )}
            </div>
            <button
              onClick={generateInvoicePDF}
              disabled={isGeneratingPDF || billingHistory.length === 0}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-all shadow-sm hover:shadow-md w-full sm:w-auto"
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
                  <th className="px-4 py-3 text-left font-semibold">Doctor</th>
                  <th className="px-4 py-3 text-center font-semibold">Discount</th>
                  <th className="px-4 py-3 text-left font-semibold">Offer Applied</th>
                  <th className="px-4 py-3 text-right font-semibold">Original Amount</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Paid</th>
                  <th className="px-4 py-3 text-right font-semibold text-red-300">Pending</th>
                  <th className="px-4 py-3 text-right font-semibold">Advance</th>
                  <th className="px-4 py-3 text-right font-semibold">Advance Used</th>
                  <th className="px-4 py-3 text-right font-semibold">Claim Amount Used</th>
                  <th className="px-4 py-3 text-right font-semibold">Pending Claim Paid</th>
                  <th className="px-4 py-3 text-right font-semibold">Past Advance</th>
                  <th className="px-4 py-3 text-right font-semibold">Past Advance Used</th>
                  <th className="px-4 py-3 text-center font-semibold">Qty</th>
                  <th className="px-4 py-3 text-center font-semibold">Session</th>
                  <th className="px-4 py-3 text-left font-semibold">Method</th>
                  <th className="px-4 py-3 text-left font-semibold">Refund Details</th>
                  <th className="px-4 py-3 text-left font-semibold">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={20} className="px-4 py-12">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                        <span className="text-sm text-gray-500">Loading billing history...</span>
                      </div>
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={20} className="px-4 py-12">
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
                    <td colSpan={20} className="px-4 py-12">
                      <div className="text-center text-sm text-gray-500">
                        No billing history found for this appointment
                      </div>
                    </td>
                  </tr>
                ) : (
                  (() => {
                    // Filter billing history based on search
                    const filteredBilling = searchInvoice
                      ? billingHistory.filter(b =>
                        (b.invoiceNumber || '').toLowerCase().includes(searchInvoice.toLowerCase())
                      )
                      : billingHistory;

                    return filteredBilling.map((billing, index) => {
                      // Check if invoice is refunded
                      const isRefunded = billing.isOfferRefunded || false;
                      const refundedOffers = billing.refundedOffers || [];
                      const refundedAt = billing.refundedAt;
                      // const refundedBy = billing.refundedBy;
                      // const refundedAmount = billing.refundedAmount || 0;

                      return (
                        <tr
                          key={billing._id || index}
                          className={`transition-colors ${isRefunded ? 'bg-red-50 hover:bg-red-100 border-l-4 border-l-red-500' : 'hover:bg-gray-50'}`}
                        >
                          <td className="px-4 py-3">
                            <div className="text-xs font-semibold text-gray-900">
                              {billing.invoiceNumber || '—'}
                            </div>
                            <div className="text-[10px] text-gray-500">
                              {formatDate(billing.invoicedDate)}
                            </div>
                            {/* Invoiced By Tag - Simple Small Text */}
                            {billing.invoicedBy && (
                              <div className="mt-1 text-[9px] text-gray-600 flex items-center gap-1">
                                <span className="font-medium text-purple-700">
                                  Invoiced by:
                                </span>
                                <span>{billing.invoicedBy}</span>

                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div>
                              <div className="text-xs font-medium text-gray-900 mb-1">
                                {billing.treatment || billing.package || '—'}
                              </div>
                              {/* Show unpaid packages that were paid in this billing */}
                              {billing.unpaidPackagesPaid && billing.unpaidPackagesPaid.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {billing.unpaidPackagesPaid.map((pkg: any, idx: number) => (
                                    <div key={idx} className="text-[10px] text-blue-700 flex items-center gap-1.5 pl-1 bg-blue-50 px-2 py-1 rounded">
                                      <Check className="w-3 h-3 text-blue-600" strokeWidth={3} />
                                      <span className="font-medium">
                                        Package Paid: {pkg.packageName || 'Package'}
                                      </span>
                                      <span className="text-blue-600 font-semibold ml-1">
                                        ({getCurrencySymbol(clinicCurrency)}{pkg.amount?.toFixed(2)})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
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
                          {/* Doctor Column */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-xs text-gray-700">
                              {billing.doctorName || '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {(() => {
                              const isDoctorDiscount = billing.isDoctorDiscountApplied;
                              const isAgentDiscount = billing.isAgentDiscountApplied;
                              const membershipDiscountAmount = billing.membershipDiscountApplied || 0;
                              const isMembershipDiscount = membershipDiscountAmount > 0;
                              const isFreeSessionEarned = billing.offerType === 'bundle' && billing.offerFreeSession && billing.offerFreeSession.length > 0;
                              const isFreeSessionUsed = billing.usedFreeSessions && billing.usedFreeSessions.length > 0;
                              const isCashbackUsed = billing.cashbackWalletUsed && billing.cashbackWalletUsed > 0;
                              const isCashbackApplied = billing.isCashbackApplied || false;
                              const cashbackEarnedAmt = billing.cashbackAmount || 0;
                              const cashbackOfferName = billing.cashbackOfferName || '';

                              // Check if this is an advance payment (should not show discount calculation)
                              const isAdvancePayment = billing.treatment === "Advance Payment" || billing.isAdvanceOnly;

                              const originalAmount = billing.originalAmount || 0;
                              const finalAmount = billing.amount || 0;
                              // Exclude advance payments from discount calculation
                              const totalDiscountAmount = (!isAdvancePayment && originalAmount > finalAmount) ? (originalAmount - finalAmount) : 0;
                              // Use stored discountPercent if available, otherwise calculate
                              const totalPercent = billing.discountPercent > 0 ? billing.discountPercent : (totalDiscountAmount > 0 && originalAmount > 0 ? (totalDiscountAmount / originalAmount * 100) : 0);
                              const membershipPercent = isMembershipDiscount && originalAmount > 0 ? (membershipDiscountAmount / originalAmount * 100) : 0;

                              if (!isDoctorDiscount && !isAgentDiscount && !isMembershipDiscount && !isFreeSessionEarned && !isFreeSessionUsed && !isCashbackUsed && !isCashbackApplied && totalPercent <= 0) {
                                return <div className="text-xs text-gray-400">—</div>;
                              }

                              return (
                                <div className="flex flex-col items-center gap-1">
                                  {totalPercent > 0 && (
                                    <div className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200 shadow-sm">
                                      {Number(totalPercent).toFixed(1)}% OFF
                                    </div>
                                  )}
                                  {totalDiscountAmount > 0 && (
                                    <div className="text-[10px] font-medium text-gray-500">
                                      Saved {getCurrencySymbol(clinicCurrency)} {formatCurrency(totalDiscountAmount)}
                                    </div>
                                  )}
                                  <div className="flex flex-col items-center gap-1 mt-0.5">
                                    {/* Cashback Offer Name */}
                                    {cashbackOfferName && isCashbackApplied && cashbackEarnedAmt > 0 && (
                                      <div className="text-[8px] font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded border border-cyan-200">
                                        {cashbackOfferName}
                                      </div>
                                    )}
                                    {/* Free Session USED (Redeemed at ₹0) */}
                                    {isFreeSessionUsed && (
                                      <div className="text-[8px] uppercase tracking-wider text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold border border-green-200 flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Free Session: {billing.usedFreeSessions.join(', ')}
                                      </div>
                                    )}
                                    {/* Free Session EARNED (from bundle offer) */}
                                    {isFreeSessionEarned && (
                                      <div className="text-[8px] uppercase tracking-wider text-green-700 bg-green-100 px-1.5 py-0.5 rounded font-bold border border-green-200 flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                        </svg>
                                        Free: {billing.offerFreeSession.join(', ')}
                                      </div>
                                    )}
                                    {/* Cashback Earned Amount */}
                                    {isCashbackApplied && cashbackEarnedAmt > 0 && (
                                      <div className="text-[8px] uppercase tracking-wider text-cyan-700 bg-cyan-100 px-1.5 py-0.5 rounded font-bold border border-cyan-200 flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                        </svg>
                                        CB Earned: {getCurrencySymbol(clinicCurrency)} {cashbackEarnedAmt.toFixed(2)}
                                      </div>
                                    )}
                                    {/* Cashback Used */}
                                    {isCashbackUsed && (
                                      <div className="text-[8px] uppercase tracking-wider text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded font-bold border border-orange-200 flex items-center gap-0.5">
                                        <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                                        </svg>
                                        CB Used: {getCurrencySymbol(clinicCurrency)} {billing.cashbackWalletUsed.toFixed(2)}
                                      </div>
                                    )}
                                    {isMembershipDiscount && (
                                      <div className="text-[8px] uppercase tracking-wider text-emerald-600 px-1.5 py-0.5 rounded font-bold">
                                        Memb {membershipPercent > 0 ? `(${membershipPercent.toFixed(0)}%)` : 'Disc.'}
                                      </div>
                                    )}
                                    {isAgentDiscount && (
                                      <div className="text-[8px] uppercase tracking-wider text-blue-600 px-1.5 py-0.5 rounded font-bold">
                                        Agent Disc.
                                      </div>
                                    )}
                                    {isDoctorDiscount && (
                                      <div className="text-[8px] uppercase tracking-wider text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded font-bold border border-orange-100">
                                        Doctor Disc.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const offerName = billing.offerName || billing.offerTitle;
                              const offerType = billing.offerType;
                              const offerDiscountAmount = billing.offerDiscountAmount || 0;
                              const cashbackAmount = billing.cashbackAmount || 0;
                              const cashbackWalletUsed = billing.cashbackWalletUsed || 0;
                              const isCashbackApplied = billing.isCashbackApplied || false;
                              const cashbackOfferName = billing.cashbackOfferName || '';
                              const isFreeSession = offerType === 'bundle' && billing.offerFreeSession && billing.offerFreeSession.length > 0;

                              // Check if any offer info is available
                              const hasOfferInfo = offerName || offerType || cashbackOfferName || (isCashbackApplied && cashbackAmount > 0);

                              if (!hasOfferInfo) {
                                return <div className="text-xs text-gray-400">—</div>;
                              }

                              return (
                                <div className="flex flex-col gap-1.5">
                                  {/* Main Offer (Instant/Bonus/Bundle) */}
                                  {offerName && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-gray-900 truncate max-w-[150px]">
                                        {offerName}
                                      </span>
                                      {offerType && (
                                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold uppercase ${offerType === 'instant_discount' ? 'bg-amber-100 text-amber-700' :
                                          offerType === 'cashback' ? 'bg-purple-100 text-purple-700' :
                                            offerType === 'bundle' ? 'bg-green-100 text-green-700' :
                                              'bg-gray-100 text-gray-700'
                                          }`}>
                                          {offerType === 'instant_discount' ? 'Discount' :
                                            offerType === 'cashback' ? 'Cashback' :
                                              offerType === 'bundle' ? 'Bundle' :
                                                offerType}
                                        </span>
                                      )}
                                    </div>
                                  )}

                                  {/* Cashback Offer */}
                                  {cashbackOfferName && isCashbackApplied && (
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-bold text-cyan-700 truncate max-w-[150px]">
                                        {cashbackOfferName}
                                      </span>
                                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase bg-cyan-100 text-cyan-700">
                                        Cashback
                                      </span>
                                    </div>
                                  )}

                                  {/* Offer Details */}
                                  <div className="flex flex-wrap items-center gap-1">
                                    {/* Instant Discount Amount */}
                                    {offerType === 'instant_discount' && offerDiscountAmount > 0 && (
                                      <span className="text-[9px] font-semibold text-amber-700">
                                        Disc: {getCurrencySymbol(clinicCurrency)}{offerDiscountAmount.toFixed(2)}
                                      </span>
                                    )}

                                    {/* Cashback Earned Amount */}
                                    {cashbackAmount > 0 && (
                                      <span className="text-[9px] font-semibold text-cyan-700">
                                        Earned: {getCurrencySymbol(clinicCurrency)}{cashbackAmount.toFixed(2)}
                                      </span>
                                    )}

                                    {/* Cashback Wallet Used */}
                                    {cashbackWalletUsed > 0 && (
                                      <div className="inline-flex flex-col items-start px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                                        <span className="text-[8px] uppercase">CB Applied</span>
                                        <span className="text-[9px]">{getCurrencySymbol(clinicCurrency)}{cashbackWalletUsed.toFixed(2)}</span>
                                      </div>
                                    )}

                                    {/* Free Sessions */}
                                    {isFreeSession && (
                                      <span className="text-[9px] font-semibold text-green-700">
                                        Free: {billing.offerFreeSession.join(', ')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="text-xs font-semibold text-gray-900">
                              {formatCurrency(billing.originalAmount || billing.amount || 0)}
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
                            {(billing.claimAmountUsed || 0) > 0 ? (
                              <div className="text-xs font-semibold text-blue-700">
                                {formatCurrency(billing.claimAmountUsed)}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">—</div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {(billing.pendingClaimUsed || 0) > 0 ? (
                              <div className="text-xs font-semibold text-purple-700">
                                {formatCurrency(billing.pendingClaimUsed)}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">—</div>
                            )}
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
                            <div className="flex flex-col gap-1 items-start text-xs font-medium text-gray-700">
                              {billing.multiplePayments && billing.multiplePayments.length > 0 ? (
                                billing.multiplePayments.map((payment: any, idx: number) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2.5 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200 font-semibold text-[10px] whitespace-nowrap shadow-sm"
                                  >
                                    {payment.paymentMethod}: <span className="ml-1 text-gray-600 font-bold">{Number(payment.amount || 0).toFixed(2)}</span>
                                  </span>
                                ))
                              ) : (
                                billing.paymentMethod ? (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-gray-100 text-gray-800 border border-gray-200 font-semibold text-[10px] whitespace-nowrap shadow-sm">
                                    {billing.paymentMethod}
                                  </span>
                                ) : (
                                  <span className="text-gray-400">—</span>
                                )
                              )}
                            </div>
                          </td>
                          {/* Refund Details Column */}
                          <td className="px-4 py-3">
                            {isRefunded ? (
                              <div className="flex flex-col gap-1">
                                <div className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-bold bg-red-100 text-red-700 border border-red-200">
                                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                  REFUNDED
                                </div>
                                {refundedOffers.length > 0 && (
                                  <div className="text-[9px] text-gray-600 space-y-0.5">
                                    {refundedOffers.map((offer: any, idx: number) => (
                                      <div key={idx} className="flex items-start gap-1">
                                        <span className="text-red-500">•</span>
                                        <div className="flex flex-col">
                                          <span className="font-medium">{offer.offerName || offer.offerType}</span>
                                          <span className="text-[8px] text-gray-500">
                                            {offer.offerType === 'bundle' && offer.freeSessionsRefunded?.length > 0 && (
                                              <span>Free Sessions Removed: {offer.freeSessionsRefunded.join(', ')}</span>
                                            )}
                                            {offer.offerType === 'bundle' && offer.freeSessionsRestored?.length > 0 && (
                                              <span>Free Sessions Restored: {offer.freeSessionsRestored.join(', ')}</span>
                                            )}
                                            {offer.cashbackRefunded > 0 && (
                                              <span>Cashback: {getCurrencySymbol(clinicCurrency)}{offer.cashbackRefunded.toFixed(2)}</span>
                                            )}
                                            {offer.amount > 0 && offer.offerType !== 'cashback' && (
                                              <span>Amount: {getCurrencySymbol(clinicCurrency)}{offer.amount.toFixed(2)}</span>
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {refundedAt && (
                                  <div className="text-[8px] text-gray-400">
                                    {new Date(refundedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">—</div>
                            )}
                          </td>
                          {/* View Button Column */}
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => {
                                setSelectedPaymentHistoryBilling(billing);
                                setShowPaymentHistoryModal(true);
                              }}
                              className="inline-flex items-center justify-center p-1.5 rounded-lg bg-gradient-to-r from-gray-500 to-gray-700 hover:from-gray-600 hover:to-gray-700 text-white shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105"
                              title="View Details"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
              {!loading && !error && billingHistory.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-100 border-t-2 border-gray-300 text-xs font-bold">
                    <td className="px-4 py-3 text-gray-900">Totals</td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.originalAmount || b.amount) || 0), 0))}
                    </td>
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
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.claimAmountUsed) || 0), 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {formatCurrency(billingHistory.reduce((sum, b) => sum + (Number(b.pendingClaimUsed) || 0), 0))}
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
                    <td className="px-4 py-3"></td>
                    <td className="px-4 py-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      {/* Payment History Modal */}
      {showPaymentHistoryModal && selectedPaymentHistoryBilling && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setShowPaymentHistoryModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="bg-gradient-to-r from-gray-600 to-gray-500 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Payment History</h3>
                <p className="text-xs text-indigo-200">{selectedPaymentHistoryBilling.invoiceNumber || 'Invoice Details'}</p>
              </div>
              <button
                onClick={() => setShowPaymentHistoryModal(false)}
                className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {/* Invoice Summary Card */}
              <div className="p-4 bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200 rounded-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Total Amount</p>
                    <p className="text-lg font-bold text-gray-900">{getCurrencySymbol(clinicCurrency)}{formatCurrency(selectedPaymentHistoryBilling.amount)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Paid</p>
                    <p className="text-lg font-bold text-green-600">{getCurrencySymbol(clinicCurrency)}{formatCurrency(selectedPaymentHistoryBilling.paid)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Pending</p>
                    <p className="text-lg font-bold text-red-600">{getCurrencySymbol(clinicCurrency)}{formatCurrency(selectedPaymentHistoryBilling.pending)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Payment Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-[10px] font-bold ${selectedPaymentHistoryBilling.pending === 0
                      ? 'bg-green-100 text-green-700'
                      : selectedPaymentHistoryBilling.paid > 0
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                      }`}>
                      {selectedPaymentHistoryBilling.pending === 0 ? 'Completed' : selectedPaymentHistoryBilling.paid > 0 ? 'Partial' : 'Unpaid'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Invoice Details */}
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Service</p>
                  <p className="font-semibold text-gray-700">{selectedPaymentHistoryBilling.service || 'Treatment'}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Invoiced Date</p>
                  <p className="font-semibold text-gray-700">
                    {selectedPaymentHistoryBilling.invoicedDate
                      ? new Date(selectedPaymentHistoryBilling.invoicedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Invoiced By</p>
                  <p className="font-semibold text-gray-700">{selectedPaymentHistoryBilling.invoicedBy || 'N/A'}</p>
                </div>
              </div>

              {/* Package/Treatment Info */}
              {(selectedPaymentHistoryBilling.package || selectedPaymentHistoryBilling.treatment) && (
                <div className="p-3 bg-white rounded-lg border border-gray-200">
                  <p className="text-[10px] text-gray-500 uppercase mb-1">{selectedPaymentHistoryBilling.service === 'Package' ? 'Package' : 'Treatment'}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-indigo-700">{selectedPaymentHistoryBilling.package || selectedPaymentHistoryBilling.treatment}</p>
                    <p className="text-xs font-bold text-green-700">Paid: {getCurrencySymbol(clinicCurrency)}{formatCurrency(selectedPaymentHistoryBilling.paid)}</p>
                  </div>
                  {selectedPaymentHistoryBilling.selectedPackageTreatments && selectedPaymentHistoryBilling.selectedPackageTreatments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {selectedPaymentHistoryBilling.selectedPackageTreatments.map((treatment: any, idx: number) => (
                        <span key={idx} className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[9px] rounded-full">
                          {treatment.treatmentName}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Pending Amount Card */}
              {selectedPaymentHistoryBilling.pending > 0 && (
                <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="text-[10px] text-orange-700 uppercase font-bold mb-1">
                    Pending Amount ({selectedPaymentHistoryBilling.invoiceNumber || 'N/A'})
                  </p>
                  <p className="text-sm font-bold text-orange-800">
                    {getCurrencySymbol(clinicCurrency)}{formatCurrency(selectedPaymentHistoryBilling.pending)}
                  </p>
                </div>
              )}

              {/* Cashback Info */}
              {selectedPaymentHistoryBilling.cashbackEarned > 0 && (
                <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                  <div className="p-1.5 bg-emerald-100 rounded-full">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[10px] text-emerald-600 uppercase font-bold">Cashback Earned</p>
                    <p className="text-sm font-bold text-emerald-700">{getCurrencySymbol(clinicCurrency)}{formatCurrency(selectedPaymentHistoryBilling.cashbackEarned)}</p>
                  </div>
                </div>
              )}

              {/* Payment Details Section */}
              <div>
                {(() => {
                  const billing = selectedPaymentHistoryBilling;
                  const history = billing.paymentHistory || [];

                  // Derive individual payments from paymentHistory
                  const allPayments = [];
                  let prevPaid = 0;

                  for (let i = 0; i < history.length; i++) {
                    const entry = history[i];
                    const currentPaid = Number(entry.paid || 0);
                    const paymentAmount = currentPaid - prevPaid;
                    const subPayments = entry.multiplePayments || [];
                    const isMultiPay = subPayments.length >= 1;

                    if (paymentAmount > 0) {
                      if (isMultiPay) {
                        for (let j = 0; j < subPayments.length; j++) {
                          const sub = subPayments[j];
                          allPayments.push({
                            paymentMethod: sub.paymentMethod || 'Cash',
                            amount: Number(sub.amount || 0),
                            paidAt: entry.updatedAt,
                            status: entry.status,
                            transactionType: sub.transactionType || (i === 0 ? 'INITIAL_PAYMENT' : 'PENDING_CLEARANCE'),
                            paidByName: sub.paidByName || entry.paidByName || billing.invoicedBy || 'N/A',
                          });
                        }

                        // If paymentAmount is greater than the sum of sub-payments, push the remaining as a base/initial payment
                        const subPaymentsSum = subPayments.reduce((sum: number, sub: any) => sum + Number(sub.amount || 0), 0);
                        const remainingAmount = paymentAmount - subPaymentsSum;
                        if (remainingAmount > 0) {
                          allPayments.push({
                            paymentMethod: entry.paymentMethod || billing.paymentMethod || 'Cash',
                            amount: remainingAmount,
                            paidAt: entry.updatedAt,
                            status: entry.status,
                            transactionType: i === 0 ? 'INITIAL_PAYMENT' : 'PAYMENT',
                            paidByName: entry.paidByName || billing.invoicedBy || 'N/A',
                          });
                        }
                      } else {
                        allPayments.push({
                          paymentMethod: entry.paymentMethod || subPayments[0]?.paymentMethod || 'Cash',
                          amount: paymentAmount,
                          paidAt: entry.updatedAt,
                          status: entry.status,
                          transactionType: subPayments[0]?.transactionType || (i === 0 ? 'INITIAL_PAYMENT' : 'PENDING_CLEARANCE'),
                          paidByName: subPayments[0]?.paidByName || entry.paidByName || billing.invoicedBy || 'N/A',
                        });
                      }
                    }
                    prevPaid = currentPaid;
                  }

                  const paymentsToShow = allPayments.length > 0 ? allPayments : (billing.multiplePayments || []);

                  if (paymentsToShow.length === 0) {
                    return (
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                          <div className="p-1.5 bg-indigo-100 rounded-full">
                            <CreditCard className="w-4 h-4 text-indigo-600" />
                          </div>
                          Payment Details
                        </h4>
                        <div className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50">
                          <p className="text-sm text-gray-600">No payments recorded yet</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div>
                      <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-100 rounded-full">
                          <CreditCard className="w-4 h-4 text-indigo-600" />
                        </div>
                        All Payments ({paymentsToShow.length})
                      </h4>
                      <div className="space-y-3">
                        {paymentsToShow.map((payment: any, idx: number) => (
                          <div key={idx} className="relative">
                            <div className={`relative p-4 rounded-xl border-2 ${payment.transactionType === 'ADVANCE_USAGE'
                              ? 'bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200'
                              : payment.transactionType === 'CLAIM_USAGE'
                                ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
                                : payment.transactionType === 'PENDING_CLEARANCE'
                                  ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200'
                                  : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'
                              }`}>
                              {/* Cleared Invoice Badge */}
                              {(() => {
                                if (payment.transactionType === 'PENDING_CLEARANCE') {
                                  const clearanceIndex = paymentsToShow
                                    .slice(0, idx + 1)
                                    .filter((p: any) => p.transactionType === 'PENDING_CLEARANCE')
                                    .length - 1;
                                  const matchingBreakdown = selectedPaymentHistoryBilling.pendingClearedBreakdown?.[clearanceIndex];
                                  if (matchingBreakdown && matchingBreakdown.invoiceNumber) {
                                    return (
                                      <div className="absolute top-0 right-0 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-[8px] md:text-[9px] font-bold px-2.5 py-0.5 rounded-tr-[10px] rounded-bl-lg uppercase tracking-wider shadow-sm">
                                        Cleared Invoice: {matchingBreakdown.invoiceNumber}
                                      </div>
                                    );
                                  }
                                }
                                return null;
                              })()}
                              <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2.5 rounded-xl ${payment.paymentMethod === 'Cash' ? 'bg-green-100' :
                                    payment.paymentMethod === 'Card' ? 'bg-blue-100' :
                                      payment.paymentMethod === 'BT' ? 'bg-purple-100' :
                                        payment.paymentMethod === 'Advance Balance' ? 'bg-amber-100' :
                                          payment.paymentMethod === 'Insurance' || payment.paymentMethod === 'Claim' ? 'bg-purple-100' :
                                            'bg-gray-100'
                                    }`}>
                                    {payment.paymentMethod === 'Cash' && <span className="text-lg">💵</span>}
                                    {payment.paymentMethod === 'Card' && <span className="text-lg">💳</span>}
                                    {payment.paymentMethod === 'BT' && <span className="text-lg">🏦</span>}
                                    {payment.paymentMethod === 'Advance Balance' && <Wallet className="w-5 h-5 text-amber-600" />}
                                    {(payment.paymentMethod === 'Insurance' || payment.paymentMethod === 'Claim') && <span className="text-lg">🏥</span>}
                                    {!['Cash', 'Card', 'BT', 'Advance Balance', 'Insurance', 'Claim'].includes(payment.paymentMethod) && <CreditCard className="w-5 h-5 text-gray-600" />}
                                  </div>
                                  <div>
                                    <p className="text-sm font-bold text-gray-800">{payment.paymentMethod}</p>
                                    <p className="text-[10px] text-gray-500">
                                      {payment.paidAt ? new Date(payment.paidAt).toLocaleString('en-US', {
                                        month: 'short', day: 'numeric', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                      }) : 'N/A'}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xl font-bold text-gray-900">{getCurrencySymbol(clinicCurrency)}{formatCurrency(payment.amount)}</p>
                                  <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${payment.transactionType === 'ADVANCE_USAGE' ? 'bg-amber-100 text-amber-700' :
                                    payment.transactionType === 'CLAIM_USAGE' ? 'bg-blue-100 text-blue-700' :
                                      (payment.transactionType === 'PENDING_CLEARANCE' && selectedPaymentHistoryBilling.pending === 0) ? 'bg-green-100 text-green-700' :
                                        payment.status === 'Completed' ? 'bg-green-100 text-green-700' :
                                          'bg-gray-100 text-gray-600'
                                    }`}>
                                    {payment.transactionType === 'ADVANCE_USAGE' ? 'Advance' :
                                      payment.transactionType === 'CLAIM_USAGE' ? 'Claim' :
                                        (payment.transactionType === 'PENDING_CLEARANCE' && selectedPaymentHistoryBilling.pending === 0) ? 'Pending Clear' :
                                          payment.status === 'Completed' ? 'Paid' :
                                            'Payment'}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 pt-3 border-t border-gray-200/50 grid grid-cols-3 gap-2">
                                <div>
                                  <p className="text-[9px] text-gray-400 uppercase">Transaction Type</p>
                                  <p className="text-xs font-semibold text-gray-600">{payment.transactionType || 'PAYMENT'}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-400 uppercase">Paid By</p>
                                  <p className="text-xs font-semibold text-gray-600">{payment.paidByName || 'N/A'}</p>
                                </div>
                                <div>
                                  <p className="text-[9px] text-gray-400 uppercase">Payment #</p>
                                  <p className="text-xs font-semibold text-gray-600">#{idx + 1}</p>
                                </div>
                              </div>
                            </div>
                            {idx < paymentsToShow.length - 1 && (
                              <div className="absolute left-1/2 -bottom-3 w-0.5 h-3 bg-gray-300"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* Pending Cleared Breakdown */}
              {selectedPaymentHistoryBilling.pendingClearedBreakdown && selectedPaymentHistoryBilling.pendingClearedBreakdown.length > 0 && (
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <div className="p-1.5 bg-emerald-100 rounded-full">
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    </div>
                    Pending Cleared Breakdown ({selectedPaymentHistoryBilling.pendingClearedBreakdown.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedPaymentHistoryBilling.pendingClearedBreakdown.map((item: any, idx: number) => (
                      <div key={idx} className="p-3 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {item.service === 'Treatment' ? '🩺' : item.service === 'Package' ? '📦' : '🧾'}
                            </span>
                            <div>
                              <p className="text-xs font-bold text-gray-800">
                                {item.treatmentName || item.packageName || item.service || 'N/A'}
                              </p>
                              <p className="text-[10px] text-gray-500">
                                {item.service || 'Service'}{item.invoiceNumber ? ` • ${item.invoiceNumber}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-emerald-700">{getCurrencySymbol(clinicCurrency)}{formatCurrency(item.amountCleared)}</p>
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${item.newStatus === 'Closed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>
                              {item.newStatus === 'Closed' ? '✓ Closed' : '⏳ Partial'}
                            </span>
                          </div>
                        </div>
                        {item.newRemaining > 0 && (
                          <div className="mt-2 pt-2 border-t border-emerald-200/50">
                            <p className="text-[10px] text-gray-500">Remaining: <span className="font-bold text-amber-600">{getCurrencySymbol(clinicCurrency)}{formatCurrency(item.newRemaining)}</span></p>
                          </div>
                        )}
                        {item.paymentMethod && (
                          <div className="mt-1.5 flex items-center gap-1.5">
                            <span className="text-[10px]">
                              {item.paymentMethod === 'Cash' ? '💵' : item.paymentMethod === 'Card' ? '💳' : item.paymentMethod === 'BT' ? '🏦' : '💰'}
                            </span>
                            <span className="text-[10px] font-semibold text-gray-600">Paid via {item.paymentMethod}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 px-6 py-4 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <div className="text-xs text-gray-500">
                <p>Invoice: {selectedPaymentHistoryBilling.invoiceNumber}</p>
                <p>Created: {selectedPaymentHistoryBilling.createdAt ? new Date(selectedPaymentHistoryBilling.createdAt).toLocaleString() : 'N/A'}</p>
              </div>
              <button
                onClick={() => setShowPaymentHistoryModal(false)}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg text-xs font-bold text-gray-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Export without auth wrapper to avoid layout
export default BillingHistoryPage;

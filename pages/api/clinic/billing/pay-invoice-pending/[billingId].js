import dbConnect from "../../../../../lib/database";
import Billing from "../../../../../models/Billing";
import PettyCash from "../../../../../models/PettyCash";
import PatientRegistration from "../../../../../models/PatientRegistration";
import Package from "../../../../../models/Package";
import { getUserFromReq } from "../../../lead-ms/auth";
export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!["clinic", "agent", "doctorStaff", "staff", "admin"].includes(clinicUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { billingId } = req.query;
    if (!billingId) {
      return res.status(400).json({ success: false, message: "Billing ID is required" });
    }

    const { amount, paymentMethod, notes, advanceBalanceUsed } = req.body;
    const advanceUsed = Number(advanceBalanceUsed || 0);
    const totalPayment = Number(amount || 0) + advanceUsed;
    
    // Allow amount to be 0 if advance balance covers the full payment
    if (isNaN(amount) || Number(amount) < 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }
    if (!paymentMethod) {
      return res.status(400).json({ success: false, message: "Payment method is required" });
    }
    
    // Validate that total payment (cash + advance) is greater than 0
    if (totalPayment <= 0) {
      return res.status(400).json({ success: false, message: "Total payment amount must be greater than 0" });
    }

    // Find the billing record
    const billing = await Billing.findById(billingId);
    if (!billing) {
      return res.status(404).json({ success: false, message: "Billing record not found" });
    }

    // Verify user has access to this clinic
    let clinicId;
    if (clinicUser.role === "clinic") {
      const Clinic = (await import("../../../../../models/Clinic")).default;
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (clinicUser.role === "admin") {
      clinicId = req.body.clinicId || billing.clinicId;
    } else {
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to a clinic" });
      }
    }

    if (billing.clinicId.toString() !== clinicId.toString()) {
      return res.status(403).json({ success: false, message: "Access denied to this billing record" });
    }

    // Check if payment amount exceeds pending
    const currentPending = Number(billing.pending || 0);
    
    if (totalPayment > currentPending) {
      return res.status(400).json({ 
        success: false, 
        message: `Payment amount exceeds pending amount. Current pending: ${currentPending}` 
      });
    }

    // Calculate new values for billing record
    // paid tracks total cash/card paid (not including advance balance)
    const newPaid = Number(billing.paid || 0) + Number(amount);
    const newAdvanceUsed = Number(billing.advanceUsed || 0) + advanceUsed;
    const newPending = Math.max(0, currentPending - totalPayment);

    // Determine if this is a pending clearance or regular payment
    // pendingUsed tracks payments towards pending amounts (for accounting)
    const isPendingClearance = Number(amount) >= currentPending || totalPayment >= currentPending;
    const pendingAmountUsed = isPendingClearance ? currentPending : Number(amount);
    const newPendingUsed = Number(billing.pendingUsed || 0) + pendingAmountUsed;

    // Create payment history entry (for UI display - derived state)
    const paymentHistoryEntry = {
      amount: Number(billing.amount || 0),
      paid: newPaid,
      pending: newPending,
      paymentMethod: paymentMethod,
      status: newPending === 0 ? "Completed" : "Partial",
      updatedAt: new Date(),
      transactionType: isPendingClearance ? "PENDING_CLEARANCE" : "REGULAR_PAYMENT",
      amountPaid: Number(amount),
      advanceAmountUsed: advanceUsed,
      paidBy: clinicUser._id,
      paidByName: clinicUser.name || "Staff",
      remainingPending: newPending,
      multiplePayments: advanceUsed > 0 ? [
        { paymentMethod: paymentMethod, amount: Number(amount), transactionType: "PAYMENT" },
        { paymentMethod: "Advance Balance", amount: advanceUsed, transactionType: "ADVANCE_USAGE" }
      ] : [{ paymentMethod: paymentMethod, amount: Number(amount), transactionType: "PAYMENT" }]
    };

    // Update the billing record - main fields are derived totals
    billing.paid = newPaid;
    billing.advanceUsed = newAdvanceUsed;
    billing.pending = newPending;
    billing.pendingUsed = newPendingUsed;
    
    // Add to paymentHistory (UI audit trail)
    if (!billing.paymentHistory) {
      billing.paymentHistory = [];
    }
    billing.paymentHistory.push(paymentHistoryEntry);

    // Update multiplePayments (enterprise ledger)
    if (!billing.multiplePayments) {
      billing.multiplePayments = [];
    }
    
    // Add cash/card payment
    if (Number(amount) > 0) {
      billing.multiplePayments.push({
        paymentMethod: paymentMethod,
        amount: Number(amount),
        paidAt: new Date(),
        paidBy: clinicUser._id,
        transactionType: "PAYMENT"
      });
    }
    
    // Add advance balance usage if any
    if (advanceUsed > 0) {
      billing.multiplePayments.push({
        paymentMethod: "Advance Balance",
        amount: advanceUsed,
        paidAt: new Date(),
        paidBy: clinicUser._id,
        transactionType: "ADVANCE_USAGE"
      });
    }

    // Update notes if provided
    if (notes) {
      billing.notes = billing.notes ? `${billing.notes} | ${notes}` : notes;
    }

    await billing.save();

    // ============================================================
    // Enterprise Pending Ledger: clear the ledger row(s) for this
    // specific billing so the per-treatment/package audit trail
    // stays in sync with the legacy Billing.pending update above.
    // ============================================================
    let ledgerBreakdown = [];
    try {
      const PatientPendingLedger = (await import("../../../../../models/PatientPendingLedger")).default;
      const { applyClearance } = await import("../../../../../lib/pendingLedger");

      // Find Open/Partial ledger rows for THIS billing
      const openLedgers = await PatientPendingLedger.find({
        parentBillingId: billing._id,
        status: { $in: ["Open", "Partial"] },
      })
        .sort({ createdAt: 1 })
        .lean();

      if (openLedgers.length > 0 && totalPayment > 0) {
        // Build allocations against this billing's ledger rows
        const allocations = [];
        let remaining = totalPayment;
        for (const l of openLedgers) {
          if (remaining <= 0) break;
          const take = Math.min(remaining, Number(l.remainingAmount || 0));
          if (take > 0) {
            allocations.push({ ledgerId: l.ledgerId, amount: take });
            remaining = Number((remaining - take).toFixed(2));
          }
        }

        if (allocations.length > 0) {
          const clearanceResult = await applyClearance({
            allocations,
            clearingBillingId: billing._id,
            clearingInvoiceNumber: billing.invoiceNumber,
            paymentMethod: paymentMethod || "Cash",
            paidBy: clinicUser._id,
            paidByName: clinicUser.name || "Staff",
            transactionType: "PENDING_CLEARANCE",
            notes: notes || `Payment towards invoice ${billing.invoiceNumber}`,
            useTransaction: false,
          });

          ledgerBreakdown = Array.isArray(clearanceResult?.breakdown)
            ? clearanceResult.breakdown
            : [];

          if (ledgerBreakdown.length > 0) {
            // Persist the breakdown on the billing for audit trail
            await Billing.findByIdAndUpdate(
              billing._id,
              {
                $set: {
                  pendingClearedBreakdown: ledgerBreakdown.map((b) => ({
                    ledgerId: b.ledgerId,
                    invoiceNumber: b.invoiceNumber,
                    service: b.service,
                    treatmentSlug: b.treatmentSlug || null,
                    treatmentName: b.treatmentName || null,
                    packageId: b.packageId || null,
                    packageName: b.packageName || null,
                    amountCleared: b.amountCleared,
                    newStatus: b.newStatus,
                    newRemaining: b.newRemaining,
                    paymentMethod: b.paymentMethod || paymentMethod || null,
                  })),
                },
              },
            );
            console.log(
              "[PayInvoicePending] ✓ Cleared", ledgerBreakdown.length, "ledger row(s) for billing", billing._id,
            );
          }
        }
      } else {
        console.log("[PayInvoicePending] No Open/Partial ledger rows found for billing", billing._id);
      }
    } catch (ledgerErr) {
      console.error("[PayInvoicePending] ✗ Ledger clearance failed:", ledgerErr.message);
    }

    // Add to PettyCash if payment method is Cash
    if (paymentMethod === "Cash" && Number(amount) > 0) {
      try {
        // Find patient to get details
        const patient = await PatientRegistration.findById(billing.patientId);
        
        const pettyCashEntry = new PettyCash({
          clinicId: clinicId,
          staffId: clinicUser._id,
          staffName: clinicUser.name || "Staff",
          patientId: billing.patientId,
          patientName: patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : "Patient",
          patientFirstName: patient?.firstName || "",
          patientLastName: patient?.lastName || "",
          patientMobileNumber: patient?.mobileNumber || "",
          emrNumber: patient?.emrNumber || "",
          invoiceNumber: billing.invoiceNumber,
          invoicedDate: billing.invoicedDate,
          invoicedBy: billing.invoicedBy,
          service: billing.service,
          treatment: billing.treatment,
          package: billing.package,
          selectedPackageTreatments: billing.selectedPackageTreatments || [],
          amount: billing.amount,
          paid: Number(amount),
          cashAmount: Number(amount),
          paymentMethod: paymentMethod,
          multiplePayments: [{ paymentMethod, amount: Number(amount) }]
        });

        await pettyCashEntry.save();
        await PettyCash.updateGlobalTotalAmount(clinicId, Number(amount), 'add');
        console.log('[PayInvoicePending] Added to PettyCash:', pettyCashEntry._id);
      } catch (pettyCashError) {
        console.error('[PayInvoicePending] Error adding to PettyCash:', pettyCashError);
      }
    }

    // Update patient's package if billing is a Package
    if (billing.service === "Package") {
      try {
        const patient = await PatientRegistration.findById(billing.patientId);
        if (patient && patient.packages) {
          console.log('[PayInvoicePending] === PACKAGE UPDATE START ===');
          console.log('[PayInvoicePending] Billing record:', {
            _id: billing._id,
            invoiceNumber: billing.invoiceNumber,
            patientPackageId: billing.patientPackageId,
            patientPackageSubId: billing.patientPackageSubId,
            package: billing.package,
            service: billing.service,
            amount: billing.amount,
            paid: billing.paid,
            pending: billing.pending
          });
          console.log('[PayInvoicePending] Patient packages array:', patient.packages);
          console.log('[PayInvoicePending] Billing package name:', billing.package);
          
          let matchingPackageIndex = -1;
          let matchingPackage = null;
          
          for (let i = 0; i < patient.packages.length; i++) {
            const pkg = patient.packages[i];
            console.log('[PayInvoicePending] Checking package index', i, ':', pkg);
            
            // Check 1: Match by patientPackageId or patientPackageSubId
            if (
              (billing.patientPackageId && String(pkg.packageId) === String(billing.patientPackageId)) || 
              (billing.patientPackageSubId && String(pkg._id) === String(billing.patientPackageSubId))
            ) {
              matchingPackageIndex = i;
              matchingPackage = pkg;
              console.log('[PayInvoicePending] Match by ID found at index', i);
              break;
            }
            
            // Check 2: Match by packageId field in billing (for transferred packages)
            if (billing.packageId && String(pkg.packageId) === String(billing.packageId)) {
              matchingPackageIndex = i;
              matchingPackage = pkg;
              console.log('[PayInvoicePending] Match by billing.packageId found at index', i);
              break;
            }
            
            // Check 3: Match by packageName field directly (fallback for transferred packages)
            if (pkg.packageName && String(pkg.packageName).toLowerCase() === String(billing.package).toLowerCase()) {
              matchingPackageIndex = i;
              matchingPackage = pkg;
              console.log('[PayInvoicePending] Match by packageName found at index', i);
              break;
            }
            
            // Check 4: Match by package name from Package model
            if (pkg.packageId) {
              try {
                const pkgModel = await Package.findById(pkg.packageId);
                console.log('[PayInvoicePending] Package model for packageId', pkg.packageId, ':', pkgModel);
                if (pkgModel && pkgModel.name === billing.package) {
                  matchingPackageIndex = i;
                  matchingPackage = pkg;
                  console.log('[PayInvoicePending] Match by package name found at index', i);
                  break;
                }
              } catch (pkgErr) {
                console.log('[PayInvoicePending] Error fetching package model:', pkgErr);
              }
            }
            
            // Check 5: Match by packageId name (for transferred packages where packageName might not match)
            if (pkg.packageId && billing.package) {
              try {
                const pkgModel = await Package.findById(pkg.packageId);
                if (pkgModel && pkgModel.name && String(pkgModel.name).toLowerCase() === String(billing.package).toLowerCase()) {
                  matchingPackageIndex = i;
                  matchingPackage = pkg;
                  console.log('[PayInvoicePending] Match by packageId name found at index', i);
                  break;
                }
              } catch (pkgErr) {
                // Ignore errors
              }
            }
          }
          
          console.log('[PayInvoicePending] Found matching package index:', matchingPackageIndex);
          
          if (matchingPackageIndex !== -1 && matchingPackage) {
            const pkg = matchingPackage;
            console.log('[PayInvoicePending] Found matching package details:', pkg);
            
            // Calculate new paid amount for the package
            const newPackagePaid = (pkg.paidAmount || 0) + Number(amount);
            const totalPrice = pkg.totalPrice || 0;
            
            console.log('[PayInvoicePending] Package payment calculation:', {
              oldPaid: pkg.paidAmount,
              paymentAmount: Number(amount),
              newPaid: newPackagePaid,
              totalPrice: totalPrice
            });
            
            // Update the package in the patient's packages array
            patient.packages[matchingPackageIndex].paidAmount = newPackagePaid;
            patient.packages[matchingPackageIndex].paymentMethod = paymentMethod;
            
            // Update payment status based on new paid amount
            if (newPackagePaid >= totalPrice) {
              patient.packages[matchingPackageIndex].paymentStatus = 'Full';
              console.log('[PayInvoicePending] Setting payment status to Full');
            } else if (newPackagePaid > 0) {
              patient.packages[matchingPackageIndex].paymentStatus = 'Partial';
              console.log('[PayInvoicePending] Setting payment status to Partial');
            } else {
              patient.packages[matchingPackageIndex].paymentStatus = 'Unpaid';
              console.log('[PayInvoicePending] Setting payment status to Unpaid');
            }
            
            console.log('[PayInvoicePending] Updated package object in array:', patient.packages[matchingPackageIndex]);
            
            // Mark the packages array as modified to ensure mongoose saves the changes
            patient.markModified('packages');
            
            // Also update the top-level package fields in PatientRegistration
            patient.packageId = patient.packageId || pkg.packageId;
            patient.packageTotalPrice = patient.packageTotalPrice || totalPrice;
            patient.packagePaidAmount = newPackagePaid;
            patient.packagePaymentStatus = patient.packages[matchingPackageIndex].paymentStatus;
            patient.packagePaymentMethod = paymentMethod;
            
            console.log('[PayInvoicePending] Updated patient object:', {
              packageId: patient.packageId,
              packageTotalPrice: patient.packageTotalPrice,
              packagePaidAmount: patient.packagePaidAmount,
              packagePaymentStatus: patient.packagePaymentStatus,
              packagePaymentMethod: patient.packagePaymentMethod
            });
            
            await patient.save();
            console.log('[PayInvoicePending] === PATIENT SAVED SUCCESSFULLY ===');
            console.log('[PayInvoicePending] Updated patient package:', { 
              matchingPackageIndex, 
              newPackagePaid, 
              paymentStatus: patient.packages[matchingPackageIndex].paymentStatus 
            });
          } else {
            console.log('[PayInvoicePending] === NO MATCHING PACKAGE FOUND ===');
          }
        } else {
          console.log('[PayInvoicePending] === NO PATIENT OR NO PACKAGES ARRAY ===');
        }
      } catch (packageError) {
        console.error('[PayInvoicePending] === ERROR UPDATING PATIENT PACKAGE ===');
        console.error('[PayInvoicePending] Error details:', packageError);
      }
    }

    // Refresh billing from DB to include updated ledger cached fields
    let billingForResponse = billing;
    try {
      const refreshed = await Billing.findById(billing._id).lean();
      if (refreshed) billingForResponse = refreshed;
    } catch (refreshErr) {
      console.warn("[PayInvoicePending] Billing refresh failed:", refreshErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Payment recorded successfully",
      data: billingForResponse,
      pendingClearedBreakdown: ledgerBreakdown,
      totalCleared: ledgerBreakdown.reduce((sum, b) => sum + (b.amountCleared || 0), 0),
    });
  } catch (error) {
    console.error("Error recording invoice payment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to record payment",
    });
  }
}

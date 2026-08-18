import dbConnect from "../../../../../lib/database";
import Billing from "../../../../../models/Billing";
import Clinic from "../../../../../models/Clinic";
import PatientRegistration from "../../../../../models/PatientRegistration";
import Package from "../../../../../models/Package";
import PettyCash from "../../../../../models/PettyCash";
import { getUserFromReq } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (
      !["clinic", "agent", "doctorStaff", "staff", "admin"].includes(
        clinicUser.role,
      )
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { patientId } = req.query;
    if (!patientId) {
      return res
        .status(400)
        .json({ success: false, message: "Patient ID is required" });
    }

    const { amount, paymentMethod, notes, invoicedBy, multiplePayments, advanceUsed } =
      req.body;
    const amountNum = Number(amount);
    const advanceUsedNum = advanceUsed !== undefined ? Math.max(0, Number(advanceUsed) || 0) : 0;
    
    if (amount === undefined || amount === null || isNaN(amountNum) || amountNum < 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid amount is required" });
    }
    
    if (amountNum === 0 && advanceUsedNum <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid amount is required" });
    }
    if (
      !paymentMethod &&
      (!multiplePayments || multiplePayments.length === 0)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Payment method is required" });
    }

    // Verify patient
    const patient = await PatientRegistration.findById(patientId);
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    // Determine clinicId
    let clinicId;
    if (clinicUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (clinicUser.role === "admin") {
      clinicId = req.body.clinicId || patient.clinicId;
    } else {
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "User not linked to a clinic" });
      }
    }

    // ============================================================
    // Enterprise Pending Ledger: this endpoint now uses the dedicated
    // PatientPendingLedger collection for the FIFO distribution.
    // 1) Find all open / partial ledger rows for this patient
    // 2) Allocate the cash payment across them in FIFO order
    // 3) Each allocation is written transactionally with a clearance
    //    sub-record so we always know which treatment/package was paid
    // 4) The parent billings have pendingLedgerCached refreshed
    // 5) The package-status + petty-cash + audit-billing logic below
    //    still runs to preserve legacy behavior
    // ============================================================
    const { applyAutoFifoClearance, getOpenLedgers } = await import(
      "../../../../../lib/pendingLedger"
    );

    // Fallback for legacy billings that were created BEFORE the ledger
    // was introduced: ensure they have at least one Open ledger row.
    // We do this lazily on every pending-payment call so the system is
    // self-healing for data created before this release.
    try {
      const { syncBillingFromLegacy } = await import(
        "../../../../../lib/pendingLedger"
      );
      const legacyBillings = await Billing.find({
        clinicId,
        patientId,
        isAdvanceOnly: { $ne: true },
      })
        .where("pending")
        .gt(0)
        .select("_id invoiceNumber pending pendingUsed service treatment package")
        .lean();
      for (const lb of legacyBillings) {
        const hasLedger = await (await import("../../../../../models/PatientPendingLedger"))
          .default.exists({ parentBillingId: lb._id });
        if (!hasLedger) {
          await syncBillingFromLegacy(
            {
              _id: lb._id,
              clinicId,
              patientId,
              appointmentId: null,
              invoiceNumber: lb.invoiceNumber,
              service: lb.service || "Service",
              treatmentSlug: null,
              treatment: lb.treatment || null,
              package: lb.package || null,
              patientPackageId: null,
              patientPackageSubId: null,
              pending: lb.pending,
              pendingUsed: lb.pendingUsed,
            },
            { createdBy: clinicUser._id },
          );
        }
      }
    } catch (legacyErr) {
      console.warn("[AddPendingPayment] Legacy ledger sync warning:", legacyErr.message);
    }

    // Step 1: Allocate the cash portion FIFO across open ledgers.
    // The advance portion is recorded as advanceUsed on the audit billing
    // but does NOT consume ledger capacity (advance is credit, not cash).
    const clearanceResult = await applyAutoFifoClearance({
      patientId,
      clinicId,
      totalAmount: amountNum,
      clearingBillingId: null, // filled in once the audit billing exists
      clearingInvoiceNumber: null,
      paymentMethod: paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod),
      paidBy: clinicUser._id,
      paidByName: clinicUser.name || clinicUser.firstName || "Staff",
      transactionType: "PENDING_CLEARANCE",
      notes: notes || `Pending balance payment from overview pay`,
    });

    const breakdown = clearanceResult?.breakdown || [];
    const totalCleared = Number(clearanceResult?.totalAmount || 0);
    const remainingPayment = Math.max(0, Number((amountNum - totalCleared).toFixed(2)));

    // Step 2: For each affected billing, run the legacy side-effects
    // (package status sync, unpaidPackagesPaid marker, petty cash entry)
    // AND record the payment directly on the original invoice (no new audit billing).
    const affectedBillingTotals = new Map(); // invoiceNumber -> { billing, amountCleared }
    for (const b of breakdown) {
      const id = String(b.invoiceNumber);
      const existing = affectedBillingTotals.get(id) || { amountCleared: 0 };
      existing.amountCleared = (existing.amountCleared || 0) + b.amountCleared;
      affectedBillingTotals.set(id, existing);
    }

    const updatedBillings = [];

    for (const [invoiceNumber, { amountCleared: paymentForInvoice }] of affectedBillingTotals) {
      const invoice = await Billing.findOne({ invoiceNumber, clinicId });
      if (!invoice) continue;

      // --- Update the original invoice's paid/pending fields directly ---
      const currentPending = Number(invoice.pending || 0);
      const currentPaid = Number(invoice.paid || 0);
      const currentAdvanceUsed = Number(invoice.advanceUsed || 0);
      const currentPendingUsed = Number(invoice.pendingUsed || 0);

      // The cash portion that goes against this invoice's pending
      const cashForThisInvoice = Math.min(paymentForInvoice, amountNum);
      // Advance portion is distributed proportionally
      const advanceForThisInvoice = advanceUsedNum > 0 && paymentForInvoice > 0
        ? Number(((advanceUsedNum / (totalCleared || 1)) * paymentForInvoice).toFixed(2))
        : 0;

      // billing.pending is the single source of truth for outstanding pending.
      // currentPending is the original value (recomputeBillingCache no longer
      // overwrites it).  Only the cash portion reduces pending — advance is
      // a separate credit mechanism.
      const newPaid = Number((currentPaid + cashForThisInvoice + advanceForThisInvoice).toFixed(2));
      const newAdvanceUsed = Number((currentAdvanceUsed + advanceForThisInvoice).toFixed(2));
      const newPending = Math.max(0, Number((currentPending - paymentForInvoice).toFixed(2)));
      const newPendingUsed = Number((currentPendingUsed + paymentForInvoice).toFixed(2));

      // Build the payment entries to add to multiplePayments
      const newMultiplePaymentEntries = [];
      if (cashForThisInvoice > 0) {
        newMultiplePaymentEntries.push({
          paymentMethod: paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod) || "Cash",
          amount: cashForThisInvoice,
          paidAt: new Date(),
          paidBy: clinicUser._id,
          paidByName: clinicUser.name || clinicUser.firstName || "Staff",
          transactionType: "PENDING_CLEARANCE",
        });
      }
      if (advanceForThisInvoice > 0) {
        newMultiplePaymentEntries.push({
          paymentMethod: "Advance Balance",
          amount: advanceForThisInvoice,
          paidAt: new Date(),
          paidBy: clinicUser._id,
          paidByName: clinicUser.name || clinicUser.firstName || "Staff",
          transactionType: "ADVANCE_USAGE",
        });
      }

      // Build paymentHistory entry
      const newPaymentHistoryEntry = {
        amount: Number(invoice.amount || 0),
        paid: newPaid,
        pending: newPending,
        advanceUsed: newAdvanceUsed,
        paymentMethod: paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod) || "Cash",
        multiplePayments: newMultiplePaymentEntries.map((e) => ({
          paymentMethod: e.paymentMethod,
          amount: e.amount,
          transactionType: e.transactionType,
        })),
        status: newPending === 0 ? "Completed" : "Partial",
        updatedAt: new Date(),
        amountPaid: cashForThisInvoice,
        advanceAmountUsed: advanceForThisInvoice,
        remainingPending: newPending,
        paidBy: clinicUser._id,
        paidByName: clinicUser.name || clinicUser.firstName || "Staff",
      };

      // Use findByIdAndUpdate with $push to ensure atomic update
      const updatedInvoice = await Billing.findByIdAndUpdate(
        invoice._id,
        {
          $set: {
            paid: newPaid,
            advanceUsed: newAdvanceUsed,
            pending: newPending,
            pendingUsed: newPendingUsed,
          },
          $push: {
            multiplePayments: { $each: newMultiplePaymentEntries },
            paymentHistory: newPaymentHistoryEntry,
          },
        },
        { new: true },
      );

      if (updatedInvoice) {
        updatedBillings.push(updatedInvoice);
        console.log('[AddPendingPayment] ✓ Updated original invoice', invoiceNumber, 'paid:', newPaid, 'pending:', newPending, 'multiplePayments:', updatedInvoice.multiplePayments?.length || 0);
      }

      // Update patient's package if this invoice is a Package service
      if (invoice.service === "Package") {
        try {
          const patient = await PatientRegistration.findById(patientId);
          if (patient && patient.packages) {
            let matchingPackageIndex = -1;
            
            for (let i = 0; i < patient.packages.length; i++) {
              const pkg = patient.packages[i];
              
              // Check 1: Match by patientPackageId or patientPackageSubId
              if (
                (invoice.patientPackageId && String(pkg.packageId) === String(invoice.patientPackageId)) || 
                (invoice.patientPackageSubId && String(pkg._id) === String(invoice.patientPackageSubId))
              ) {
                matchingPackageIndex = i;
                break;
              }
              
              // Check 2: Match by package name from Package model
              if (pkg.packageId) {
                try {
                  const pkgModel = await Package.findById(pkg.packageId);
                  if (pkgModel && pkgModel.name === invoice.package) {
                    matchingPackageIndex = i;
                    break;
                  }
                } catch (pkgErr) {
                  console.log('[AddPendingPayment] Error fetching package model:', pkgErr);
                }
              }
            }
            
            if (matchingPackageIndex !== -1) {
              const pkg = patient.packages[matchingPackageIndex];
              const newPackagePaid = (pkg.paidAmount || 0) + paymentForInvoice;
              const totalPrice = pkg.totalPrice || 0;
              
              // Update package in patient's packages array
              patient.packages[matchingPackageIndex].paidAmount = newPackagePaid;
              patient.packages[matchingPackageIndex].paymentMethod = paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod);
              
              // Update payment status
              if (newPackagePaid >= totalPrice) {
                patient.packages[matchingPackageIndex].paymentStatus = 'Full';
              } else if (newPackagePaid > 0) {
                patient.packages[matchingPackageIndex].paymentStatus = 'Partial';
              } else {
                patient.packages[matchingPackageIndex].paymentStatus = 'Unpaid';
              }
              
              // Also update top-level package fields
              patient.packageId = patient.packageId || pkg.packageId;
              patient.packageTotalPrice = patient.packageTotalPrice || totalPrice;
              patient.packagePaidAmount = newPackagePaid;
              patient.packagePaymentStatus = patient.packages[matchingPackageIndex].paymentStatus;
              patient.packagePaymentMethod = patient.packages[matchingPackageIndex].paymentMethod;
              
              await patient.save();
              console.log('[AddPendingPayment] Updated patient package:', { matchingPackageIndex, newPackagePaid, paymentStatus: patient.packages[matchingPackageIndex].paymentStatus });
            }
          }
        } catch (packageError) {
          console.error('[AddPendingPayment] Error updating patient package:', packageError);
        }
      }

      // Check if invoice has unpaidPackagesPaid and update those packages
      if (invoice.unpaidPackagesPaid && Array.isArray(invoice.unpaidPackagesPaid) && invoice.unpaidPackagesPaid.length > 0) {
        try {
          console.log('[AddPendingPayment] Processing unpaidPackagesPaid from invoice:', invoice.invoiceNumber);
          
          const patient = await PatientRegistration.findById(patientId);
          if (patient && patient.packages) {
            for (const pkgPayment of invoice.unpaidPackagesPaid) {
              const { packageId, packageSubId, packageName } = pkgPayment;
              
              if (!packageId || !packageSubId) continue;
              
              // Find the package in patient's packages
              const packageIndex = patient.packages.findIndex(
                (pkg) => String(pkg._id) === String(packageSubId) && String(pkg.packageId) === String(packageId)
              );
              
              if (packageIndex !== -1) {
                const pkg = patient.packages[packageIndex];
                const totalPrice = pkg.totalPrice || 0;
                
                // Mark package as fully paid
                patient.packages[packageIndex].paidAmount = totalPrice;
                patient.packages[packageIndex].paymentStatus = 'Full';
                patient.packages[packageIndex].paymentMethod = paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod);
                
                console.log('[AddPendingPayment] Marked package as paid:', {
                  packageId,
                  packageSubId,
                  packageName: packageName || pkg.packageName,
                  paymentStatus: 'Full',
                  paidAmount: totalPrice
                });
              }
            }
            
            await patient.save();
          }
        } catch (unpaidPkgError) {
          console.error('[AddPendingPayment] Error updating unpaidPackagesPaid:', unpaidPkgError);
        }
      }

      // Add to PettyCash if this invoice's payment method is Cash and we have cash payment
      // Determine the actual payment method used for this invoice
      let invoicePaymentMethod = paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod);
      const cashPortionForInvoice = Math.min(paymentForInvoice, amountNum);
      if (invoicePaymentMethod === "Cash" && cashPortionForInvoice > 0) {
        try {
          const patient = await PatientRegistration.findById(patientId);
          const pettyCashEntry = new PettyCash({
            clinicId: clinicId,
            staffId: clinicUser._id,
            staffName: clinicUser.name || "Staff",
            patientId: patientId,
            patientName: patient ? `${patient.firstName || ''} ${patient.lastName || ''}`.trim() : "Patient",
            patientFirstName: patient?.firstName || "",
            patientLastName: patient?.lastName || "",
            patientMobileNumber: patient?.mobileNumber || "",
            emrNumber: patient?.emrNumber || "",
            invoiceNumber: invoice.invoiceNumber,
            invoicedDate: invoice.invoicedDate,
            invoicedBy: invoice.invoicedBy,
            service: invoice.service,
            treatment: invoice.treatment,
            package: invoice.package,
            selectedPackageTreatments: invoice.selectedPackageTreatments || [],
            amount: invoice.amount,
            paid: paymentForInvoice,
            cashAmount: cashPortionForInvoice,
            paymentMethod: invoicePaymentMethod,
            multiplePayments: [{ paymentMethod: invoicePaymentMethod, amount: cashPortionForInvoice }]
          });
          
          await pettyCashEntry.save();
          await PettyCash.updateGlobalTotalAmount(clinicId, cashPortionForInvoice, 'add');
          console.log('[AddPendingPayment] Added to PettyCash:', pettyCashEntry._id);
        } catch (pettyCashError) {
          console.error('[AddPendingPayment] Error adding to PettyCash:', pettyCashError);
        }
      }

      // Write the pendingClearedBreakdown back to the ORIGINAL billing
      // so the View modal in the billing section shows what was cleared.
      try {
        const invoiceBreakdownItems = breakdown
          .filter((b) => b.invoiceNumber === invoiceNumber)
          .map((b) => ({
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
          }));
        if (invoiceBreakdownItems.length > 0) {
          await Billing.findByIdAndUpdate(
            invoice._id,
            {
              $push: {
                pendingClearedBreakdown: { $each: invoiceBreakdownItems },
              },
            },
          );
          console.log(
            '[AddPendingPayment] ✓ Wrote', invoiceBreakdownItems.length, 'breakdown item(s) to original billing', invoice.invoiceNumber,
          );
        }
      } catch (breakdownErr) {
        console.error('[AddPendingPayment] Failed to write breakdown to original billing:', breakdownErr.message);
      }
    }

    // Step 3: Backfill the clearingBillingId / clearingInvoiceNumber on
    // every ledger clearance so the ledger rows know which invoice reduced them.
    // We use the ORIGINAL invoice IDs (not a separate audit billing).
    try {
      const PatientPendingLedger = (
        await import("../../../../../models/PatientPendingLedger")
      ).default;
      // Build a map: ledgerId -> original invoice that cleared it
      const ledgerToInvoice = new Map();
      for (const b of breakdown) {
        const inv = updatedBillings.find((ib) => ib.invoiceNumber === b.invoiceNumber);
        if (inv) ledgerToInvoice.set(b.ledgerId, inv);
      }
      for (const b of breakdown) {
        const inv = ledgerToInvoice.get(b.ledgerId);
        if (!inv) continue;
        await PatientPendingLedger.updateOne(
          {
            ledgerId: b.ledgerId,
            "clearances.clearingBillingId": null,
          },
          {
            $set: {
              "clearances.$[matching].clearingBillingId": inv._id,
              "clearances.$[matching].clearingInvoiceNumber": inv.invoiceNumber,
            },
          },
          {
            arrayFilters: [{ "matching.clearingBillingId": null }],
          },
        );
      }
    } catch (backfillErr) {
      console.warn(
        "[AddPendingPayment] Ledger clearance back-link warning:",
        backfillErr.message,
      );
    }

    // ------------------------------
    // Handle advanceUsed portion (even if amount is 0)
    // ------------------------------
    let advanceBreakdown = [];
    let advanceTotalCleared = 0;
    
    if (advanceUsedNum > 0) {
      console.log('[AddPendingPayment] Handling advanceUsed portion:', advanceUsedNum);
      
      // Fetch pending invoices (FIFO order)
      const pendingInvoices = await Billing.find({
        clinicId,
        patientId,
        pending: { $gt: 0 },
        isAdvanceOnly: { $ne: true }
      }).sort({ invoicedDate: 1, createdAt: 1 });
      
      let remainingAdvance = advanceUsedNum;
      
      for (const invoice of pendingInvoices) {
        if (remainingAdvance <= 0) break;
        
        const paymentForInvoice = Math.min(remainingAdvance, Number(invoice.pending || 0));
        console.log('[AddPendingPayment] Applying advance to invoice', invoice.invoiceNumber, ':', paymentForInvoice);
        
        // Update invoice fields
        const currentPaid = Number(invoice.paid || 0);
        const currentAdvanceUsed = Number(invoice.advanceUsed || 0);
        const currentPending = Number(invoice.pending || 0);
        const currentPendingUsed = Number(invoice.pendingUsed || 0);
        
        const newPaid = Number((currentPaid + paymentForInvoice).toFixed(2)); // add advance to paid, like create-patient-registration.js
        const newAdvanceUsed = Number((currentAdvanceUsed + paymentForInvoice).toFixed(2));
        const newPending = Math.max(0, Number((currentPending - paymentForInvoice).toFixed(2)));
        const newPendingUsed = Number((currentPendingUsed + paymentForInvoice).toFixed(2));
        
        // Build payment entries
        const newMultiplePaymentEntries = [];
        newMultiplePaymentEntries.push({
          paymentMethod: "Advance Balance",
          amount: paymentForInvoice,
          paidAt: new Date(),
          paidBy: clinicUser._id,
          paidByName: clinicUser.name || clinicUser.firstName || "Staff",
          transactionType: "ADVANCE_USAGE",
        });
        
        // Build payment history entry
        const newPaymentHistoryEntry = {
          amount: Number(invoice.amount || 0),
          paid: newPaid,
          pending: newPending,
          advanceUsed: newAdvanceUsed,
          paymentMethod: paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod) || "Cash",
          multiplePayments: newMultiplePaymentEntries.map((e) => ({
            paymentMethod: e.paymentMethod,
            amount: e.amount,
            transactionType: e.transactionType,
          })),
          status: newPending === 0 ? "Completed" : "Partial",
          updatedAt: new Date(),
          amountPaid: 0,
          advanceAmountUsed: paymentForInvoice,
          remainingPending: newPending,
          paidBy: clinicUser._id,
          paidByName: clinicUser.name || clinicUser.firstName || "Staff",
        };
        
        // Update invoice in DB
        const updatedInvoice = await Billing.findByIdAndUpdate(
          invoice._id,
          {
            $set: {
              paid: newPaid,
              advanceUsed: newAdvanceUsed,
              pending: newPending,
              pendingUsed: newPendingUsed,
            },
            $push: {
              multiplePayments: { $each: newMultiplePaymentEntries },
              paymentHistory: newPaymentHistoryEntry,
            },
          },
          { new: true }
        );
        
        if (updatedInvoice) {
          updatedBillings.push(updatedInvoice);
          advanceTotalCleared += paymentForInvoice;
        }
        
        // ------------------------------
        // Handle PatientPendingLedger for advance portion
        // ------------------------------
        try {
          const PatientPendingLedger = (await import("../../../../../models/PatientPendingLedger")).default;
          const { applyClearance } = await import("../../../../../lib/pendingLedger");
          
          // Find open/partial ledgers for this invoice
          const openLedgers = await PatientPendingLedger.find({
            parentBillingId: invoice._id,
            status: { $in: ["Open", "Partial"] }
          }).sort({ createdAt: 1 }).lean();
          
          if (openLedgers.length > 0) {
            const allocations = [];
            let remaining = paymentForInvoice;
            
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
                clearingBillingId: invoice._id,
                clearingInvoiceNumber: invoice.invoiceNumber,
                paymentMethod: "Advance Balance",
                paidBy: clinicUser._id,
                paidByName: clinicUser.name || "Staff",
                transactionType: "PENDING_CLEARANCE",
                notes: notes || `Advance payment towards pending balance`,
                useTransaction: false,
              });
              
              const invoiceBreakdown = Array.isArray(clearanceResult?.breakdown) 
                ? clearanceResult.breakdown 
                : [];
              
              advanceBreakdown.push(...invoiceBreakdown);
              
              // Add pendingClearedBreakdown to original invoice
              if (invoiceBreakdown.length > 0) {
                await Billing.findByIdAndUpdate(
                  invoice._id,
                  {
                    $push: {
                      pendingClearedBreakdown: { $each: invoiceBreakdown.map((b) => ({
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
                        paymentMethod: "Advance Balance",
                      })) }
                    }
                  }
                );
              }
            }
          }
        } catch (ledgerErr) {
          console.error('[AddPendingPayment] ✗ Ledger clearance for advance failed:', ledgerErr.message);
        }
        
        remainingAdvance -= paymentForInvoice;
      }
    }
    
    // Combine cash breakdown and advance breakdown
    const totalBreakdown = [...breakdown, ...advanceBreakdown];
    const totalTotalCleared = totalCleared + advanceTotalCleared;

    return res.status(200).json({
      success: true,
      message:
        "Pending payment recorded successfully, and pending invoices updated",
      data: updatedBillings[0] || null,
      updatedBillings: updatedBillings.map((b) => ({
        _id: b._id,
        invoiceNumber: b.invoiceNumber,
        paid: b.paid,
        pending: b.pending,
      })),
      pendingClearedBreakdown: totalBreakdown,
      totalCleared: totalTotalCleared,
      remainingPayment,
    });
  } catch (error) {
    console.error("Error adding pending payment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add pending payment",
    });
  }
}

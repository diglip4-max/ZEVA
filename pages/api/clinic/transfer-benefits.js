import dbConnect from "../../../lib/database";
import { getUserFromReq } from "../lead-ms/auth";
import PatientRegistration from "../../../models/PatientRegistration";
import MembershipPlan from "../../../models/MembershipPlan";
import Package from "../../../models/Package";
import UserPackage from "../../../models/UserPackage";
import Billing from "../../../models/Billing";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!["clinic", "agent", "doctor", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { type, sourcePatientId, targetPatientId, membershipId, packageId } = req.body || {};
    if (!type || !sourcePatientId || !targetPatientId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (sourcePatientId === targetPatientId) {
      return res.status(400).json({ success: false, message: "Cannot transfer to the same patient" });
    }

    const source = await PatientRegistration.findById(sourcePatientId);
    const target = await PatientRegistration.findById(targetPatientId);
    if (!source || !target) {
      return res.status(404).json({ success: false, message: "Source or target patient not found" });
    }

    if (type === "membership") {
      if (!membershipId) {
        return res.status(400).json({ success: false, message: "membershipId is required" });
      }
      const hasSelectedInArray = Array.isArray(source.memberships) && source.memberships.some(m => String(m.membershipId) === String(membershipId));
      const hasSelectedAsSingle = source.membership === "Yes" && String(source.membershipId) === String(membershipId);
      if (!hasSelectedInArray && !hasSelectedAsSingle) {
        return res.status(400).json({ success: false, message: "Source patient does not have selected membership" });
      }

      const plan = await MembershipPlan.findById(membershipId);
      if (!plan) {
        return res.status(404).json({ success: false, message: "Membership plan not found" });
      }

      // Find original membership entry to copy payment details
      const sourceMembEntry = (source.memberships || []).find(m => String(m.membershipId) === String(membershipId)) || {};
      const { paymentStatus = "Unpaid", paidAmount = 0, paymentMethod = "" } = sourceMembEntry;

      const total = plan.benefits?.freeConsultations || 0;
      // Determine selected membership time window to count used consultations correctly
      let startDate = null;
      let endDate = null;
      if (hasSelectedInArray) {
        const entry = source.memberships.find(m => String(m.membershipId) === String(membershipId));
        startDate = entry?.startDate || null;
        endDate = entry?.endDate || null;
      } else if (hasSelectedAsSingle) {
        startDate = source.membershipStartDate || null;
        endDate = source.membershipEndDate || null;
      }
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const freeBills = await Billing.find({
        patientId: sourcePatientId,
        isFreeConsultation: true,
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      }).select("sessions createdAt");
      let used = 0;
      freeBills.forEach(b => { used += (b.sessions || 1); });
      if (used === 0) {
        const allBills = await Billing.find({
          patientId: sourcePatientId,
          $or: [{ service: "Treatment" }, { service: "Package" }],
          ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
        }).select("sessions createdAt").sort({ createdAt: 1 });
        for (const b of allBills) {
          if (used >= total) break;
          const s = b.sessions || 1;
          const remainingAllowed = total - used;
          used += Math.min(s, remainingAllowed);
        }
      }
      const remaining = Math.max(0, total - used);
      if (remaining <= 0) {
        return res.status(400).json({ success: false, message: "No remaining membership benefits to transfer" });
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Remove the membership from source patient (they transferred it out)
        if (hasSelectedAsSingle) {
          source.membership = "No";
          source.membershipId = undefined;
          source.membershipStartDate = undefined;
          source.membershipEndDate = undefined;
        }
        source.memberships = (Array.isArray(source.memberships) ? source.memberships.filter(m => String(m.membershipId) !== String(membershipId)) : []);
        source.hasTransferredOut = true;
        if (plan?.benefits?.priorityBooking) {
          source.transferredOutMembershipPriority = true;
        }
        source.membershipTransfers = source.membershipTransfers || [];
        source.membershipTransfers.push({
          type: "out",
          membershipId,
          membershipName: plan.name,
          startDate,
          endDate,
          toPatientId: target._id,
          transferredFreeConsultations: remaining,
          discountPercentageTransferred: plan.benefits?.discountPercentage || 0,
          paymentStatus,
          paidAmount,
          paymentMethod,
          transferDate: new Date(),
        });
        await source.save({ session });

        // Assign to target: preserve source membership period, and allow multiple entries (even same plan)
        target.membership = "Yes";
        if (!target.membershipId) {
          target.membershipId = membershipId; // keep single for backward-compat only if empty
        }
        target.memberships = Array.isArray(target.memberships) ? target.memberships : [];
        target.memberships.push({ 
          membershipId, 
          startDate, 
          endDate,
          paymentStatus,
          paidAmount,
          paymentMethod,
        });
        target.membershipTransfers = target.membershipTransfers || [];
        target.membershipTransfers.push({
          type: "in",
          membershipId,
          membershipName: plan.name,
          startDate,
          endDate,
          fromPatientId: source._id,
          transferredFreeConsultations: remaining,
          discountPercentageTransferred: plan.benefits?.discountPercentage || 0,
          paymentStatus,
          paidAmount,
          paymentMethod,
          transferDate: new Date(),
        });
        await target.save({ session });

        await session.commitTransaction();
      } catch (e) {
        await session.abortTransaction();
        throw e;
      } finally {
        session.endSession();
      }

      return res.status(200).json({
        success: true,
        message: `Transferred ${remaining} free consultation(s)`,
        data: { type, remainingTransferred: remaining }
      });
    }

    if (type === "package") {
      if (!packageId) {
        return res.status(400).json({ success: false, message: "packageId is required" });
      }

      let pkg = null;
      let isUserPackage = false;
      let sourcePkgEntry = null;

      // Check standard packages first (stored in source.packages array)
      const hasStandardPackage = Array.isArray(source.packages) && source.packages.some(p => String(p.packageId) === String(packageId));
      
      if (hasStandardPackage) {
        pkg = await Package.findById(packageId);
        sourcePkgEntry = source.packages.find(p => String(p.packageId) === String(packageId)) || {};
      } else {
        // Check UserPackage model for user-created packages
        const userPkg = await UserPackage.findOne({ _id: packageId, patientId: sourcePatientId });
        if (userPkg) {
          pkg = userPkg;
          isUserPackage = true;
          sourcePkgEntry = {
            paymentStatus: userPkg.paymentStatus,
            paidAmount: userPkg.totalPrice || 0,
            paymentMethod: "", // UserPackage doesn't track method directly in its schema
          };
        }
      }

      if (!pkg) {
        return res.status(400).json({ success: false, message: "Source patient does not have selected package" });
      }

      // Find original package entry to copy payment details
      const { paymentStatus = "Unpaid", paidAmount = 0, paymentMethod = "" } = sourcePkgEntry;
      const packageName = isUserPackage ? pkg.packageName : pkg.name;
      const total = Number(pkg.totalSessions) || 0;
      let remaining = 0;

      // Get clinicId from source patient for billing operations
      const clinicId = source.clinicId;

      if (isUserPackage) {
        remaining = Number(pkg.remainingSessions) || 0;
      } else {
        const billings = await Billing.find({
          patientId: sourcePatientId,
          service: "Package",
          package: packageName,
        }).select("sessions");
        let used = 0;
        billings.forEach(b => { used += (b.sessions || 0); });
        remaining = Math.max(0, total - used);
      }

      // Get sessions to transfer from request body, default to all remaining
        let sessionsToTransfer = req.body.sessionsToTransfer ? Number(req.body.sessionsToTransfer) : remaining;
        
        // Validate sessions to transfer
        if (sessionsToTransfer <= 0) {
          return res.status(400).json({ success: false, message: "Sessions to transfer must be greater than 0" });
        }
        if (sessionsToTransfer > remaining) {
          return res.status(400).json({ success: false, message: `Only ${remaining} sessions available to transfer` });
        }

        // Check if doing partial transfer, then verify package is fully paid
        if (sessionsToTransfer < remaining) {
          // Calculate payment status from billing history for accuracy
          let packagePaymentStatus = "Unpaid";
          
          if (isUserPackage) {
            packagePaymentStatus = pkg.paymentStatus;
          } else {
            // Get all package billings for this patient
            const packageBillingsForPkg = await Billing.find({
              clinicId: source.clinicId,
              patientId: sourcePatientId,
              service: "Package",
              package: pkg.name,
            });
            
            // Calculate total paid (cash + advance)
            const totalCashPaidFromBillings = packageBillingsForPkg.reduce((sum, b) => sum + (Number(b.paid) || 0), 0);
            const totalAdvanceUsedFromBillings = packageBillingsForPkg.reduce((sum, b) => sum + (Number(b.advanceUsed) || 0), 0);
            const totalPaidIncludingAdvance = totalCashPaidFromBillings + totalAdvanceUsedFromBillings;
            
            // Get package price
            const packagePrice = pkg.totalPrice || 0;
            
            // Determine payment status
            if (packagePrice > 0 && totalPaidIncludingAdvance >= packagePrice) {
              packagePaymentStatus = "Full";
            } else if (totalPaidIncludingAdvance > 0) {
              packagePaymentStatus = "Partial";
            } else {
              // Fall back to patient package entry if no billings
              const sourcePackageEntry = (source.packages || []).find(p => String(p.packageId) === String(packageId));
              packagePaymentStatus = sourcePackageEntry?.paymentStatus || "Unpaid";
            }
          }
          
          if (packagePaymentStatus !== "Full") {
            return res.status(400).json({ success: false, message: "Only fully paid package sessions can be transferred" });
          }
        }

      // Check for pending package billing and handle transfer of pending liability (only if transferring all sessions)
      let pendingPackageAmount = 0;
      let packageBillingToTransfer = null;
      let totalPaidBySource = 0; // Total paid by source patient (cash + advance)
      let cashPaidBySource = 0; // Cash/card paid by source patient
      let advanceUsedBySource = 0; // Advance balance used by source patient

      if (clinicId && sessionsToTransfer === remaining) {
        // Only transfer pending amount if transferring all sessions
        const packageBillings = await Billing.find({
          clinicId,
          patientId: sourcePatientId,
          service: "Package",
          package: packageName,
        });

        if (packageBillings.length > 0) {
          // Calculate total pending amount across all billing records for this package
          pendingPackageAmount = packageBillings.reduce((sum, b) => sum + Number(b.pending || 0), 0);
          
          // Calculate total paid (cash + advance) by source patient
          cashPaidBySource = packageBillings.reduce((sum, b) => sum + Number(b.paid || 0), 0);
          advanceUsedBySource = packageBillings.reduce((sum, b) => sum + Number(b.advanceUsed || 0), 0);
          totalPaidBySource = cashPaidBySource + advanceUsedBySource;
          
          // Use the first billing record with pending > 0 as reference
          packageBillingToTransfer = packageBillings.find(b => Number(b.pending || 0) > 0) || packageBillings[0];
          
          console.log(`[Transfer Benefits] Found package billing: pending=${pendingPackageAmount}, cashPaid=${cashPaidBySource}, advanceUsed=${advanceUsedBySource}, totalPaid=${totalPaidBySource} for package ${packageName}`);
        }
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // If there's pending amount and transferring all sessions, transfer the billing liability
        if (pendingPackageAmount > 0 && packageBillingToTransfer && clinicId && sessionsToTransfer === remaining) {
          // Create new billing record for target patient with the pending amount
          const targetBillingInvoiceCount = await Billing.countDocuments({ clinicId });
          const targetBillingInvoiceNumber = `PKG-TRANSFER-${Date.now()}-${targetBillingInvoiceCount + 1}`;

          const targetBillingRecord = new Billing({
            clinicId,
            patientId: targetPatientId,
            invoiceNumber: targetBillingInvoiceNumber,
            invoicedDate: new Date(),
            invoicedBy: user.name || user.email || "System",
            invoicedById: user._id,
            service: "Package",
            package: packageName,
            quantity: 1,
            sessions: 0,
            amount: pkg.totalPrice || pendingPackageAmount, // Total package price (not just pending)
            paid: cashPaidBySource, // Cash/card amount already paid by source patient
            advanceUsed: advanceUsedBySource, // Advance balance already used by source patient
            claimAmountUsed: 0,
            pending: pendingPackageAmount, // Remaining pending amount
            pendingUsed: 0,
            paymentMethod: packageBillingToTransfer.paymentMethod || "Cash",
            paymentStatus: "Partial", // Partial since some amount is already paid
            notes: `Transferred package billing - Original patient: ${sourcePatientId}. Package: ${packageName}. Cash paid: ${cashPaidBySource}, Advance used: ${advanceUsedBySource}, Pending: ${pendingPackageAmount}`,
            multiplePayments: [
              ...(cashPaidBySource > 0 ? [{ paymentMethod: packageBillingToTransfer.paymentMethod || "Cash", amount: cashPaidBySource, paidAt: new Date(), paidBy: user._id, transactionType: "PAYMENT" }] : []),
              ...(advanceUsedBySource > 0 ? [{ paymentMethod: "Advance Balance", amount: advanceUsedBySource, paidAt: new Date(), paidBy: user._id, transactionType: "ADVANCE_USAGE" }] : [])
            ],
            paymentHistory: [{
              amount: pkg.totalPrice || pendingPackageAmount, // Total package price
              paid: totalPaidBySource, // Total paid (cash + advance)
              pending: pendingPackageAmount, // Remaining pending
              paymentMethod: packageBillingToTransfer.paymentMethod || "Cash",
              multiplePayments: [
                ...(cashPaidBySource > 0 ? [{ paymentMethod: packageBillingToTransfer.paymentMethod || "Cash", amount: cashPaidBySource, transactionType: "PAYMENT" }] : []),
                ...(advanceUsedBySource > 0 ? [{ paymentMethod: "Advance Balance", amount: advanceUsedBySource, transactionType: "ADVANCE_USAGE" }] : [])
              ],
              status: "Active",
              updatedAt: new Date(),
              transactionType: "PARTIAL_PAYMENT",
              amountPaid: cashPaidBySource,
              advanceAmountUsed: advanceUsedBySource,
              paidBy: user._id,
              paidByName: user.name || user.email || "System",
              remainingPending: pendingPackageAmount,
            }]
          });
          await targetBillingRecord.save({ session });

          // Update source patient's billing record to clear the pending amount
          // Find the specific billing record(s) and set pending to 0
          await Billing.updateMany(
            {
              clinicId,
              patientId: sourcePatientId,
              service: "Package",
              package: packageName,
              pending: { $gt: 0 },
            },
            {
              $set: {
                pending: 0,
                paymentStatus: "Full",
              }
            }
          );

          console.log(`[Transfer Benefits] Transferred pending amount ${pendingPackageAmount} from source ${sourcePatientId} to target ${targetPatientId}`);
        }
        if (isUserPackage) {
          if (sessionsToTransfer === remaining) {
            // Transfer entire UserPackage
            pkg.patientId = targetPatientId;
            await pkg.save({ session });
          } else {
            // Update remaining sessions for source
            pkg.remainingSessions = remaining - sessionsToTransfer;
            await pkg.save({ session });
            // Create a new UserPackage for the target patient
            const targetUserPkg = new UserPackage({
              patientId: targetPatientId,
              packageName: pkg.packageName,
              clinicId: source.clinicId,
              totalSessions: sessionsToTransfer,
              remainingSessions: sessionsToTransfer,
              totalPrice: pkg.totalPrice,
              paymentStatus: pkg.paymentStatus,
              paidAmount: pkg.paidAmount,
              createdBy: user._id,
              createdAt: new Date(),
            });
            await targetUserPkg.save({ session });
          }
        } else {
          // For standard package: only remove from source if transferring all sessions, but ALWAYS add to target.packages
          // First get sourcePackage BEFORE removing it from source.packages!
          const sourcePackage = (Array.isArray(source.packages) ? source.packages.find(p => String(p.packageId) === String(packageId)) : {});
          if (sessionsToTransfer === remaining) {
            source.packages = (Array.isArray(source.packages) ? source.packages.filter(p => String(p.packageId) !== String(packageId)) : []);
          }
          target.packages = Array.isArray(target.packages) ? target.packages : [];
          const existingTargetPkg = target.packages.find(p => String(p.packageId) === String(packageId));
          if (!existingTargetPkg) {
            target.packages.push({ 
              packageId, 
              packageName,
              packageSoldBy: sourcePackage.packageSoldBy || user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown',
              assignedDate: new Date(),
              paymentStatus: pendingPackageAmount > 0 ? (totalPaidBySource >= (pkg.totalPrice || 0) ? 'Full' : (totalPaidBySource > 0 ? 'Partial' : 'Unpaid')) : paymentStatus,
              paidAmount: pendingPackageAmount > 0 ? totalPaidBySource : paidAmount, // Total paid (cash + advance) by source patient
              paymentMethod,
              totalPrice: pkg.totalPrice || 0, // Add totalPrice for payment status calculation
            });
          }
        }

        // Common logging for transfer history
        source.hasTransferredOut = true;
        source.packageTransfers = source.packageTransfers || [];
        source.packageTransfers.push({
          type: "out",
          packageId,
          packageName,
          isUserPackage,
          toPatientId: target._id,
          transferredSessions: sessionsToTransfer,
          paymentStatus,
          paidAmount,
          paymentMethod,
          transferDate: new Date(),
        });
        await source.save({ session });

        target.packageTransfers = target.packageTransfers || [];
        target.packageTransfers.push({
          type: "in",
          packageId,
          packageName,
          isUserPackage,
          fromPatientId: source._id,
          transferredSessions: sessionsToTransfer,
          paymentStatus,
          paidAmount,
          paymentMethod,
          transferDate: new Date(),
        });
        await target.save({ session });

        await session.commitTransaction();
      } catch (e) {
        await session.abortTransaction();
        throw e;
      } finally {
        session.endSession();
      }

      return res.status(200).json({
        success: true,
        message: `Transferred ${sessionsToTransfer} package session(s)${pendingPackageAmount > 0 ? ` and pending amount ₹${pendingPackageAmount}` : ''}`,
        data: { 
          type, 
          remainingTransferred: sessionsToTransfer,
          pendingAmountTransferred: pendingPackageAmount,
        }
      });
    }

    return res.status(400).json({ success: false, message: "Invalid transfer type" });
  } catch (error) {
    console.error("Error transferring benefits:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to transfer benefits" });
  }
}

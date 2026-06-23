import dbConnect from "../../../../lib/database";
import PatientPendingLedger from "../../../../models/PatientPendingLedger";
import Billing from "../../../../models/Billing";
import Clinic from "../../../../models/Clinic";
import PatientRegistration from "../../../../models/PatientRegistration";
import PettyCash from "../../../../models/PettyCash";
import { getUserFromReq } from "../../lead-ms/auth";
import {
  applyClearance,
  applyAutoFifoClearance,
  newLedgerId,
} from "../../../../lib/pendingLedger";

/**
 * POST /api/clinic/pending-ledgers/clear
 *
 * Body:
 *   {
 *     patientId: string,
 *     mode: "explicit" | "fifo",                 // default fifo
 *     allocations?: [{ ledgerId, amount }],      // required when mode=explicit
 *     amount: number,                            // total payment (cash only)
 *     advanceUsed?: number,                      // optional
 *     cashbackWalletUsed?: number,               // optional
 *     paymentMethod?: "Cash"|"Card"|"BT"|"Tabby"|"Tamara",
 *     multiplePayments?: [{ paymentMethod, amount }],
 *     notes?: string,
 *     createAuditBilling?: boolean,              // default true
 *   }
 *
 * Behavior:
 *   1) Apply clearance to the targeted ledger rows (transactional).
 *   2) Create an audit Billing row carrying pendingClearedBreakdown so the
 *      UI can render a per-treatment breakdown of the payment.
 *   3) For cash payments, write a PettyCash entry.
 *
 * Returns: { success, totalAmount, breakdown, auditBillingId, invoiceNumber }
 */
export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }

    const {
      patientId,
      mode = "fifo",
      allocations = null,
      amount,
      advanceUsed = 0,
      cashbackWalletUsed = 0,
      paymentMethod = null,
      multiplePayments = null,
      notes = null,
      createAuditBilling = true,
    } = req.body || {};

    if (!patientId) {
      return res
        .status(400)
        .json({ success: false, message: "patientId is required" });
    }

    // Validate payment shape
    const amountNum = Number(amount || 0);
    const advanceUsedNum = Math.max(0, Number(advanceUsed || 0));
    const cashbackWalletUsedNum = Math.max(0, Number(cashbackWalletUsed || 0));
    const totalPayment = Number(
      (amountNum + advanceUsedNum + cashbackWalletUsedNum).toFixed(2),
    );

    if (totalPayment <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Total payment must be > 0" });
    }
    if (!paymentMethod && (!Array.isArray(multiplePayments) || multiplePayments.length === 0)) {
      return res
        .status(400)
        .json({ success: false, message: "paymentMethod or multiplePayments is required" });
    }

    // Verify patient
    const patient = await PatientRegistration.findById(patientId);
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    // Resolve clinic scope
    let clinicId = null;
    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id });
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (user.role === "admin") {
      clinicId = req.body.clinicId || patient.clinicId;
    } else {
      clinicId = user.clinicId || patient.clinicId;
    }
    if (!clinicId) {
      return res
        .status(403)
        .json({ success: false, message: "Clinic not resolved" });
    }

    // 1) Pre-generate the clearing invoice number so we can pass it into
    //    the ledger clearance record (for the audit trail).
    const now = new Date();
    const ymd =
      now.getFullYear().toString() +
      String(now.getMonth() + 1).padStart(2, "0") +
      String(now.getDate()).padStart(2, "0");
    const rand = Math.floor(100000 + Math.random() * 900000);
    const clearingInvoiceNumber = `PAY-${ymd}-${rand}`;

    // 2) Apply clearance (transactional)
    let clearanceResult;
    if (mode === "explicit") {
      if (!Array.isArray(allocations) || allocations.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "explicit mode requires allocations[]" });
      }
      // Convert amount to advance+cash semantics: only the cash portion
      // is applied as actual payment; advance+cashback wallet portions are
      // handled by the legacy pendingUsed/advanceUsed fields on the audit
      // billing. We treat the cash portion as the sum of allocations.
      const allocSum = Number(
        allocations.reduce((s, a) => s + Number(a.amount || 0), 0).toFixed(2),
      );
      if (Math.abs(allocSum - amountNum) > 0.01) {
        return res.status(400).json({
          success: false,
          message: `Sum of allocations (${allocSum}) must equal cash amount (${amountNum})`,
        });
      }
      clearanceResult = await applyClearance({
        allocations,
        clearingBillingId: null, // filled in after audit billing creation below
        clearingInvoiceNumber,
        paymentMethod: paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod),
        paidBy: user._id,
        paidByName: user.name || user.firstName || "Staff",
        transactionType: "PENDING_CLEARANCE",
        notes,
        useTransaction: true,
      });
    } else {
      // fifo mode
      clearanceResult = await applyAutoFifoClearance({
        patientId,
        clinicId,
        totalAmount: amountNum,
        clearingInvoiceNumber,
        paymentMethod: paymentMethod || (multiplePayments && multiplePayments[0]?.paymentMethod),
        paidBy: user._id,
        paidByName: user.name || user.firstName || "Staff",
        transactionType: "PENDING_CLEARANCE",
        notes,
      });
    }

    if (!clearanceResult || !clearanceResult.ok) {
      return res
        .status(400)
        .json({ success: false, message: "Clearance failed", details: clearanceResult });
    }

    // 3) Create audit billing record (optional but recommended)
    let auditBilling = null;
    if (createAuditBilling) {
      const initialMultiplePayments =
        Array.isArray(multiplePayments) && multiplePayments.length > 0
          ? multiplePayments
          : [{ paymentMethod: paymentMethod || "Cash", amount: amountNum }];

      auditBilling = await Billing.create({
        clinicId,
        patientId,
        appointmentId: null,
        invoiceNumber: clearingInvoiceNumber,
        invoicedDate: now,
        invoicedBy: user.name || user.firstName || "Clinic Staff",
        invoicedById: user._id,
        service: "Service",
        treatment: notes || "Pending Balance Payment",
        amount: totalPayment,
        paid: amountNum,
        advanceUsed: advanceUsedNum,
        cashbackWalletUsed: cashbackWalletUsedNum,
        pendingUsed: totalPayment, // legacy field
        pendingClaimUsed: 0,
        isAdvanceOnly: false,
        pending: 0,
        paymentMethod: initialMultiplePayments[0].paymentMethod,
        status: "Completed",
        multiplePayments: initialMultiplePayments,
        // NEW: enterprise breakdown of which ledgers were cleared
        pendingClearedBreakdown: clearanceResult.breakdown.map((b) => ({
          ledgerId: b.ledgerId,
          invoiceNumber: b.invoiceNumber,
          service: b.service,
          treatmentSlug: b.treatmentSlug,
          treatmentName: b.treatmentName,
          packageId: b.packageId,
          packageName: b.packageName,
          amountCleared: b.amountCleared,
          newStatus: b.newStatus,
          newRemaining: b.newRemaining,
        })),
        paymentHistory: [
          {
            amount: totalPayment,
            paid: amountNum,
            pending: 0,
            advanceUsed: advanceUsedNum,
            multiplePayments: initialMultiplePayments,
            status: "Completed",
            updatedAt: now,
          },
        ],
        notes: notes || `Pending payment allocation across ${clearanceResult.breakdown.length} ledger row(s)`,
      });
    }

    // 4) Cash portion -> PettyCash
    try {
      const cashPortion = Math.min(amountNum, Number(clearanceResult.totalAmount || amountNum));
      if (cashPortion > 0 && (paymentMethod === "Cash" || (multiplePayments || []).some((mp) => mp.paymentMethod === "Cash"))) {
        const pettyEntry = new PettyCash({
          clinicId,
          staffId: user._id,
          staffName: user.name || "Staff",
          patientId,
          patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
          patientFirstName: patient.firstName || "",
          patientLastName: patient.lastName || "",
          patientMobileNumber: patient.mobileNumber || "",
          emrNumber: patient.emrNumber || "",
          invoiceNumber: clearingInvoiceNumber,
          invoicedDate: now,
          invoicedBy: user.name || "Staff",
          service: "Service",
          treatment: notes || "Pending Balance Payment",
          amount: totalPayment,
          paid: amountNum,
          cashAmount: cashPortion,
          paymentMethod: paymentMethod || "Cash",
          multiplePayments: multiplePayments || [{ paymentMethod: paymentMethod || "Cash", amount: cashPortion }],
        });
        await pettyEntry.save();
        if (typeof PettyCash.updateGlobalTotalAmount === "function") {
          await PettyCash.updateGlobalTotalAmount(clinicId, cashPortion, "add");
        }
      }
    } catch (pettyErr) {
      console.error("[pending-ledgers/clear] petty cash error:", pettyErr);
    }

    return res.status(200).json({
      success: true,
      message: "Pending payment cleared successfully",
      data: {
        invoiceNumber: clearingInvoiceNumber,
        auditBillingId: auditBilling ? auditBilling._id : null,
        totalAmount: clearanceResult.totalAmount,
        breakdown: clearanceResult.breakdown,
        affectedBillingIds: clearanceResult.affectedBillingIds,
      },
    });
  } catch (error) {
    console.error("[pending-ledgers/clear] error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Failed to clear pending" });
  }
}

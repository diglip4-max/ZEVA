import dbConnect from "../../../../lib/database";
import InsuranceClaim from "../../../../models/InsuranceClaim";
import Billing from "../../../../models/Billing";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser } from "../../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!["clinic", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  try {
    const { claimId, amount, paymentMethod, notes } = req.body;

    if (!claimId || !amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "claimId and valid amount are required" });
    }

    const { clinicId } = await getClinicIdFromUser(user);

    const claim = await InsuranceClaim.findById(claimId);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Insurance claim not found" });
    }

    const payAmount = Number(amount);
    const currentPending = Number(claim.pendingClaim || 0);

    if (payAmount > currentPending) {
      return res.status(400).json({
        success: false,
        message: `Payment amount (${payAmount}) cannot exceed pending claim (${currentPending})`,
      });
    }

    // Reduce pendingClaim by paid amount
    const newPendingClaim = Math.max(0, currentPending - payAmount);
    claim.pendingClaim = newPendingClaim;

    // If fully paid, update advanceStatus to Full Pay
    // and set advanceAmount to finalClaimAmount for Paid type claims
    if (newPendingClaim === 0) {
      claim.advanceStatus = "Full Pay";
      if (claim.claimType === "Paid") {
        claim.advanceAmount = Number(claim.finalClaimAmount || claim.claimAmount || 0);
      }
    }

    await claim.save();

    // Generate invoice number
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    const invoiceNumber = `INV-${dateStr}-${randomNum}`;

    // Create a billing record for this pending claim payment with proper tracking
    try {
      await Billing.create({
        clinicId: clinicId || claim.clinicId,
        patientId: claim.patientId,
        invoiceNumber,
        invoicedDate: now,
        invoicedBy: user.name || user.firstName || "Clinic Staff",
        invoicedById: user._id,
        service: "Treatment",
        treatment: "Insurance Pending Claim Payment",
        amount: payAmount,
        paid: payAmount,
        pending: 0,
        pendingClaimUsed: payAmount, // Track pending claim amount paid
        paymentMethod: paymentMethod || "Cash",
        notes: notes || `Pending claim payment for insurance claim`,
        isAdvanceOnly: false,
      });
    } catch (billingErr) {
      console.error("Warning: billing record creation failed:", billingErr.message);
      // Don't fail the whole request if billing creation fails
    }

    return res.status(200).json({
      success: true,
      message: "Pending claim payment recorded successfully",
      data: {
        claimId: claim._id,
        previousPendingClaim: currentPending,
        amountPaid: payAmount,
        newPendingClaim,
        advanceStatus: claim.advanceStatus,
      },
    });
  } catch (error) {
    console.error("Error paying pending claim:", error);
    return res.status(500).json({ success: false, message: "Failed to process payment" });
  }
}

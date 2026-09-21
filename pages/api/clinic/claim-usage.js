import dbConnect from "../../../lib/database";
import mongoose from "mongoose";
import Billing from "../../../models/Billing";
import InsuranceClaim from "../../../models/InsuranceClaim";
import ClaimCreditTransfer from "../../../models/ClaimCreditTransfer";
import { getUserFromReq } from "../lead-ms/auth";

// GET /api/clinic/claim-usage?patientId=<id>
// Returns the claim credit usage for a patient:
//   totalReleasedClaimAmount — sum of Released claims (Advance → claimAmount, Paid → advanceAmount)
//   totalClaimAmountUsed     — sum of Billing.claimAmountUsed for the patient (clinic scoped)
//   remainingClaimAmount     — max(0, total - used)
// Formula mirrors pages/api/clinic/patient-balance/[patientId].js so the numbers
// always match the "Use Insurance Claim Amount" credit shown in billing.
export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
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

    // Determine clinicId (same logic as patient-balance)
    let clinicId;
    if (clinicUser.role === "clinic") {
      const Clinic = (await import("../../../models/Clinic")).default;
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (clinicUser.role === "admin") {
      clinicId = req.query.clinicId || undefined;
    } else {
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "User not linked to a clinic" });
      }
    }

    // Released claims for the patient (same matching as patient-balance:
    // intentionally NOT clinic-scoped so numbers match the billing credit)
    const claims = await InsuranceClaim.find({
      patientId,
      status: "Released",
    })
      .select(
        "claimAmount advanceAmount claimType status pendingClaim insuranceProvider departmentName doctorName releasedAt invoiceNumber",
      )
      .sort({ releasedAt: -1 })
      .lean();

    let totalReleasedClaimAmount = 0;
    let totalPendingClaim = 0;

    console.log("\n========== CLAIM USAGE CALCULATION ==========");
    console.log("patientId:", patientId, "| clinicId:", String(clinicId));
    console.log("Found", claims.length, "Released claim(s)\n");

    for (const c of claims) {
      let added = 0;
      let rule = "";
      if (c.claimType === "Advance") {
        added = Number(c.claimAmount || 0);
        rule = "claimType='Advance' -> use claimAmount";
      } else if (c.claimType === "Paid") {
        added = Number(c.advanceAmount || 0);
        rule = "claimType='Paid' -> use advanceAmount (NOT claimAmount)";
      } else {
        rule = `claimType='${c.claimType}' -> no rule, adds 0`;
      }
      totalReleasedClaimAmount += added;
      totalPendingClaim += Number(c.pendingClaim || 0);

      console.log(`Claim ${c._id}`);
      console.log(`  claimType      : ${c.claimType}`);
      console.log(`  claimAmount    : ${c.claimAmount}`);
      console.log(`  advanceAmount  : ${c.advanceAmount}`);
      console.log(`  pendingClaim   : ${c.pendingClaim || 0}`);
      console.log(`  rule applied   : ${rule}`);
      console.log(`  value added    : +${added}`);
      console.log(`  running total  : ${totalReleasedClaimAmount}\n`);
    }

    // Billings for this patient scoped to the clinic (same as patient-balance)
    const billingMatch = {
      patientId,
      isAdvanceOnly: { $ne: true },
    };
    if (clinicId) billingMatch.clinicId = clinicId;

    const billings = await Billing.find(billingMatch)
      .select("claimAmountUsed")
      .lean();

    const totalClaimAmountUsed = billings.reduce(
      (sum, b) => sum + Number(b.claimAmountUsed || 0),
      0,
    );

    console.log("Billing usage (Billing.claimAmountUsed, clinic-scoped):");
    console.log("  billings found :", billings.length);
    billings.forEach((b, i) =>
      console.log(`  billing[${i}] ${b._id} claimAmountUsed = ${b.claimAmountUsed || 0}`),
    );
    console.log("  totalClaimAmountUsed =", totalClaimAmountUsed, "\n");

    // Claim credit transfers (ClaimCreditTransfer ledger):
    //   transfers OUT reduce this patient's usable credit,
    //   transfers IN increase it. Completed only, clinic scoped.
    let transferredOut = 0;
    let transferredIn = 0;
    if (mongoose.Types.ObjectId.isValid(patientId)) {
      const pid = new mongoose.Types.ObjectId(patientId);
      const tMatch = { status: "Completed" };
      if (clinicId) tMatch.clinicId = clinicId;
      const [outAgg] = await ClaimCreditTransfer.aggregate([
        { $match: { ...tMatch, sourcePatientId: pid } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      const [inAgg] = await ClaimCreditTransfer.aggregate([
        { $match: { ...tMatch, destPatientId: pid } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      transferredOut = Number(outAgg?.total || 0);
      transferredIn = Number(inAgg?.total || 0);
    }
    console.log("Transfers (ClaimCreditTransfer ledger):");
    console.log("  transferredOut =", transferredOut);
    console.log("  transferredIn  =", transferredIn, "\n");

    const remainingClaimAmount = Math.max(
      0,
      Number(
        (
          totalReleasedClaimAmount -
          totalClaimAmountUsed -
          transferredOut +
          transferredIn
        ).toFixed(2),
      ),
    );

    console.log("========== FINAL CALCULATION ==========");
    console.log("  totalReleasedClaimAmount =", totalReleasedClaimAmount);
    console.log("  totalClaimAmountUsed     =", totalClaimAmountUsed);
    console.log("  transferredOut           =", transferredOut);
    console.log("  transferredIn            =", transferredIn);
    console.log("  remainingClaimAmount     = max(0,", totalReleasedClaimAmount, "-", totalClaimAmountUsed, "-", transferredOut, "+", transferredIn, ") =", remainingClaimAmount);
    console.log("  pendingClaim             =", totalPendingClaim);
    console.log("======================================\n");

    return res.status(200).json({
      success: true,
      data: {
        patientId,
        totalReleasedClaimAmount: Number(totalReleasedClaimAmount.toFixed(2)),
        totalClaimAmountUsed: Number(totalClaimAmountUsed.toFixed(2)),
        transferredOut: Number(transferredOut.toFixed(2)),
        transferredIn: Number(transferredIn.toFixed(2)),
        remainingClaimAmount,
        pendingClaim: Math.max(0, Number(totalPendingClaim.toFixed(2))),
        claims: claims.map((c) => ({
          _id: c._id.toString(),
          insuranceProvider: c.insuranceProvider || "",
          departmentName: c.departmentName || "",
          doctorName: c.doctorName || "",
          claimAmount: Number(c.claimAmount || 0),
          advanceAmount: Number(c.advanceAmount || 0),
          claimType: c.claimType || "",
          invoiceNumber: c.invoiceNumber || "",
          releasedAt: c.releasedAt || null,
        })),
      },
    });
  } catch (error) {
    console.error("Error fetching claim usage:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch claim usage" });
  }
}

// pages/api/clinic/claim-transfer/execute.js
// POST { sourcePatientId, destPatientId, amount, notes? }
//   Moves claim credit from the SOURCE patient to the DESTINATION patient.
//   The transfer is written once to the ClaimCreditTransfer ledger — the
//   balance APIs pick it up via: remaining = released - used - out + in.
//   Balances are ALWAYS recomputed on the server; client numbers are display
//   only. The write is a single-document insert, so it is atomic by default
//   and safe without multi-document transactions.
// GET  ?patientId=<id> — transfer history for a patient (audit trail).
import dbConnect from "../../../../lib/database";
import mongoose from "mongoose";
import PatientRegistration from "../../../../models/PatientRegistration";
import InsuranceClaim from "../../../../models/InsuranceClaim";
import Billing from "../../../../models/Billing";
import ClaimCreditTransfer from "../../../../models/ClaimCreditTransfer";
import Clinic from "../../../../models/Clinic";
import { getUserFromReq } from "../../lead-ms/auth";

const ALLOWED_ROLES = ["clinic", "agent", "doctorStaff", "staff", "admin"];

// Mirrors the patient-balance formula plus the transfer ledger:
//   remaining = released(Advance→claimAmount, Paid→advanceAmount)
//             - SUM(Billing.claimAmountUsed, clinic scoped)
//             - transfersOut + transfersIn        (Completed only)
async function computeClaimUsage(patientId, clinicId) {
  const claims = await InsuranceClaim.find({
    patientId,
    status: "Released",
  })
    .select("claimAmount advanceAmount claimType")
    .lean();

  let released = 0;
  for (const c of claims) {
    if (c.claimType === "Advance") released += Number(c.claimAmount || 0);
    else if (c.claimType === "Paid") released += Number(c.advanceAmount || 0);
  }

  const billingMatch = { patientId, isAdvanceOnly: { $ne: true } };
  if (clinicId) billingMatch.clinicId = clinicId;
  const billings = await Billing.find(billingMatch)
    .select("claimAmountUsed")
    .lean();
  const used = billings.reduce(
    (sum, b) => sum + Number(b.claimAmountUsed || 0),
    0,
  );

  let transferredOut = 0;
  let transferredIn = 0;
  if (mongoose.Types.ObjectId.isValid(patientId)) {
    const pid = new mongoose.Types.ObjectId(patientId);
    const base = { status: "Completed" };
    if (clinicId) base.clinicId = clinicId;

    const [outAgg] = await ClaimCreditTransfer.aggregate([
      { $match: { ...base, sourcePatientId: pid } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const [inAgg] = await ClaimCreditTransfer.aggregate([
      { $match: { ...base, destPatientId: pid } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    transferredOut = Number(outAgg?.total || 0);
    transferredIn = Number(inAgg?.total || 0);
  }

  const remaining = Math.max(
    0,
    Number(
      (released - used - transferredOut + transferredIn).toFixed(2),
    ),
  );

  return {
    released: Number(released.toFixed(2)),
    used: Number(used.toFixed(2)),
    transferredOut: Number(transferredOut.toFixed(2)),
    transferredIn: Number(transferredIn.toFixed(2)),
    remaining,
  };
}

async function resolveClinicId(clinicUser, req, res) {
  if (clinicUser.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: clinicUser._id });
    if (!clinic) {
      res.status(404).json({ success: false, message: "Clinic not found" });
      return null;
    }
    return clinic._id;
  }
  if (clinicUser.role === "admin") {
    return req.query.clinicId || req.body?.clinicId || undefined;
  }
  if (!clinicUser.clinicId) {
    res
      .status(403)
      .json({ success: false, message: "User not linked to a clinic" });
    return null;
  }
  return clinicUser.clinicId;
}

function generateTransferNumber() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate(),
  ).padStart(2, "0")}`;
  const rand = Math.floor(100000 + Math.random() * 900000);
  return `CCT-${ymd}-${rand}`;
}

export default async function handler(req, res) {
  await dbConnect();

  const clinicUser = await getUserFromReq(req);
  if (!clinicUser) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }
  if (!ALLOWED_ROLES.includes(clinicUser.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  const clinicId = await resolveClinicId(clinicUser, req, res);
  if (clinicId === null) return; // response already sent

  // ============ GET — transfer history for a patient (audit) ============
  if (req.method === "GET") {
    try {
      const { patientId } = req.query;
      if (!patientId) {
        return res
          .status(400)
          .json({ success: false, message: "Patient ID is required" });
      }
      const history = await ClaimCreditTransfer.find({
        $or: [{ sourcePatientId: patientId }, { destPatientId: patientId }],
        ...(clinicId ? { clinicId } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

      return res.status(200).json({ success: true, transfers: history });
    } catch (error) {
      console.error("Error fetching transfer history:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch transfer history" });
    }
  }

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  // ============ POST — execute a transfer ============
  try {
    const { sourcePatientId, destPatientId, amount, notes } = req.body || {};

    // ----- Validation -----
    if (!sourcePatientId || !destPatientId) {
      return res.status(400).json({
        success: false,
        message: "Source and destination patient are required",
      });
    }
    if (String(sourcePatientId) === String(destPatientId)) {
      return res.status(400).json({
        success: false,
        message: "Source and destination patient cannot be the same",
      });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Amount must be greater than 0" });
    }

    const [source, dest] = await Promise.all([
      PatientRegistration.findById(sourcePatientId).select(
        "firstName lastName emrNumber mobileNumber clinicId",
      ),
      PatientRegistration.findById(destPatientId).select(
        "firstName lastName emrNumber mobileNumber clinicId",
      ),
    ]);
    if (!source || !dest) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }
    if (
      clinicId &&
      (String(source.clinicId) !== String(clinicId) ||
        String(dest.clinicId) !== String(clinicId))
    ) {
      return res.status(403).json({
        success: false,
        message: "Patients do not belong to your clinic",
      });
    }

    // ----- Server-computed balances (never trust client amounts) -----
    const src = await computeClaimUsage(sourcePatientId, clinicId);
    const dst = await computeClaimUsage(destPatientId, clinicId);

    console.log("\n===== CLAIM TRANSFER EXECUTE =====");
    console.log("Source usage:", JSON.stringify(src));
    console.log("Dest usage  :", JSON.stringify(dst));
    console.log("Requested amount:", amt);

    if (amt > src.remaining + 0.0001) {
      console.log("REJECTED: insufficient claim credit\n");
      return res.status(400).json({
        success: false,
        message: `Insufficient claim credit. Available: ${src.remaining}`,
        sourceRemaining: src.remaining,
      });
    }

    // ----- Unique transfer number (retry on collision) -----
    let transferNumber = generateTransferNumber();
    for (let i = 0; i < 3; i++) {
      const exists = await ClaimCreditTransfer.findOne({ transferNumber })
        .select("_id")
        .lean();
      if (!exists) break;
      transferNumber = generateTransferNumber();
    }

    const sourceName = `${source.firstName || ""} ${source.lastName || ""}`.trim();
    const destName = `${dest.firstName || ""} ${dest.lastName || ""}`.trim();
    const sourceRemainingAfter = Number((src.remaining - amt).toFixed(2));
    const destRemainingAfter = Number((dst.remaining + amt).toFixed(2));

    // ----- Single-document ledger write (atomic by default) -----
    const transfer = await ClaimCreditTransfer.create({
      transferNumber,
      clinicId: clinicId || source.clinicId || null,
      sourcePatientId: source._id,
      sourcePatientName: sourceName,
      sourceEmrNumber: source.emrNumber || "",
      destPatientId: dest._id,
      destPatientName: destName,
      destEmrNumber: dest.emrNumber || "",
      amount: amt,
      notes: typeof notes === "string" ? notes.slice(0, 500) : "",
      sourceReleasedTotal: src.released,
      sourceUsedTotal: src.used,
      sourceTransferredOutBefore: src.transferredOut,
      sourceRemainingBefore: src.remaining,
      sourceRemainingAfter,
      destReleasedTotal: dst.released,
      destUsedTotal: dst.used,
      destTransferredInBefore: dst.transferredIn,
      destRemainingBefore: dst.remaining,
      destRemainingAfter,
      status: "Completed",
      transferredBy: clinicUser._id,
      transferredByName: clinicUser.name || clinicUser.email || "",
      transferredByRole: clinicUser.role,
      ipAddress:
        String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
        req.socket?.remoteAddress ||
        "",
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    });

    console.log("Transfer recorded:", transferNumber, "| amount:", amt);
    console.log(
      `Source ${sourceName}: ${src.remaining} -> ${sourceRemainingAfter}`,
    );
    console.log(
      `Dest   ${destName}: ${dst.remaining} -> ${destRemainingAfter}`,
    );
    console.log("===== TRANSFER COMPLETE =====\n");

    return res.status(200).json({
      success: true,
      transfer,
      transferNumber,
      sourceRemaining: sourceRemainingAfter,
      destRemaining: destRemainingAfter,
    });
  } catch (error) {
    console.error("Error executing claim transfer:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to execute transfer" });
  }
}

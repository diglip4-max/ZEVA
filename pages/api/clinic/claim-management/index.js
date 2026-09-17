import dbConnect from "../../../../lib/database";
import InsuranceClaim from "../../../../models/InsuranceClaim";
import PatientRegistration from "../../../../models/PatientRegistration";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser } from "../../lead-ms/permissions-helper";

/**
 * GET /api/clinic/claim-management
 *
 * Read-only claims dashboard. Returns the seven management buckets used by
 * /clinic/claim-management, each with { count, amount, claims[] } where a row
 * carries: patientName, emrNumber, insuranceProvider, amount.
 *
 * Amount semantics (kept identical to patient-balance / claim-usage):
 *  - "paid amount" of a claim = claimAmount for Advance type, advanceAmount for Paid type.
 *  - full-paid bucket = settled amount matches finalClaimAmount (± epsilon).
 */

const EPSILON = 0.005;
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// Settled-amount semantics shared with the patient-balance endpoint:
// Advance claims settle on claimAmount, Paid claims settle on advanceAmount.
const paidAmountOf = (claim) =>
  claim.claimType === "Advance"
    ? Number(claim.claimAmount || 0)
    : Number(claim.advanceAmount || 0);

const claimTotalOf = (claim) =>
  claim.finalClaimAmount != null
    ? Number(claim.finalClaimAmount)
    : Number(claim.claimAmount || 0);

const toRow = (claim, amount) => ({
  _id: String(claim._id),
  patientId: String(claim.patientId || ""),
  patientName:
    `${claim.patientFirstName || ""} ${claim.patientLastName || ""}`.trim() || "—",
  emrNumber: "",
  insuranceProvider: claim.insuranceProvider || "—",
  amount: round2(amount),
});

const emptyBucket = () => ({ count: 0, amount: 0, claims: [] });

export default async function handler(req, res) {
  await dbConnect();

  // Verify authentication
  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "doctor", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const { clinicId: userClinicId, isAdmin } = await getClinicIdFromUser(user);

    const query = {};
    if (isAdmin) {
      // Admin can see all, optionally filter by clinicId
      if (req.query.clinicId) query.clinicId = req.query.clinicId;
    } else if (userClinicId) {
      query.clinicId = userClinicId;
    }

    // doctorStaff always sees only their own claims (same rule as the list endpoint)
    if (user.role === "doctorStaff") query.doctorId = user._id;

    const claims = await InsuranceClaim.find(query).sort({ createdAt: -1 }).lean();

    const buckets = {
      total: emptyBucket(),
      paid: emptyBucket(),
      advance: emptyBucket(),
      ongoing: emptyBucket(),
      released: emptyBucket(),
      readyToRelease: emptyBucket(),
      waitingApproval: emptyBucket(),
    };

    for (const claim of claims) {
      const paidAmount = paidAmountOf(claim);
      const claimTotal = claimTotalOf(claim);

      // 1. All claims — original claim amounts
      buckets.total.claims.push(toRow(claim, claim.claimAmount));

      // 2. Fully paid — settled amount matches the final claim amount
      if (
        claim.finalClaimAmount != null &&
        Math.abs(paidAmount - Number(claim.finalClaimAmount)) < EPSILON
      ) {
        buckets.paid.claims.push(toRow(claim, paidAmount));
      }

      // 3. Advance claims
      if (claim.claimType === "Advance") {
        buckets.advance.claims.push(toRow(claim, claim.advanceAmount));
      }

      // 4. Ongoing — in the pipeline (Ready / Completed / Under Review), not released
      if (["Ready", "Completed", "Under Review"].includes(claim.status)) {
        buckets.ongoing.claims.push(toRow(claim, claimTotal));
      }

      // 5. Released
      if (claim.status === "Released") {
        buckets.released.claims.push(toRow(claim, paidAmount));
      }

      // 6. Ready to release — finance completed, not released yet
      if (claim.status === "Completed") {
        buckets.readyToRelease.claims.push(toRow(claim, paidAmount));
      }

      // 7. Waiting approval — under doctor review
      if (claim.status === "Under Review") {
        buckets.waitingApproval.claims.push(toRow(claim, paidAmount));
      }
    }

    // Enrich rows with patient EMR numbers (display-only denormalization —
    // EMR lives only on PatientRegistration; single batched indexed query)
    const patientIds = [...new Set(claims.map((c) => c.patientId).filter(Boolean).map(String))];
    if (patientIds.length > 0) {
      const patients = await PatientRegistration.find({ _id: { $in: patientIds } })
        .select("_id emrNumber")
        .lean();
      const emrMap = {};
      for (const p of patients) emrMap[String(p._id)] = p.emrNumber || "";
      for (const key of Object.keys(buckets)) {
        for (const row of buckets[key].claims) {
          row.emrNumber = emrMap[row.patientId] || "";
        }
      }
    }

    for (const key of Object.keys(buckets)) {
      const bucket = buckets[key];
      bucket.count = bucket.claims.length;
      bucket.amount = round2(bucket.claims.reduce((acc, row) => acc + row.amount, 0));
    }

    res.setHeader("Cache-Control", "private, max-age=10");
    return res.status(200).json({ success: true, data: buckets });
  } catch (error) {
    console.error("Error building claim management dashboard:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to build claim management dashboard" });
  }
}

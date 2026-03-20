import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import { getUserFromReq } from "../../lead-ms/auth";

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

    // Determine clinicId
    let clinicId;
    if (clinicUser.role === "clinic") {
      const Clinic = (await import("../../../../models/Clinic")).default;
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (clinicUser.role === "admin") {
      // Admin can view across clinics if clinicId provided (optional)
      clinicId = req.query.clinicId || undefined;
    } else {
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "User not linked to a clinic" });
      }
    }

    const match = { patientId };
    if (clinicId) match.clinicId = clinicId;

    // We track advance and pending separately (not net)
    const billings = await Billing.find(match)
      .select(
        "pending advance advanceUsed pendingUsed pastAdvance pastAdvanceUsed pastAdvanceType createdAt",
      )
      .lean();

    let totalPending = 0;
    let totalPendingUsed = 0;
    let totalAdvanceGenerated = 0;
    let totalAdvanceUsed = 0;

    // Track past advance and its usage
    let totalPastAdvanceGenerated = 0;
    let totalPastAdvanceUsed = 0;
    let total50PercentOfferPastAdvanceGenerated = 0;
    let total50PercentOfferPastAdvanceUsed = 0;
    let total54PercentOfferPastAdvanceGenerated = 0;
    let total54PercentOfferPastAdvanceUsed = 0;
    let total159FlatPastAdvanceGenerated = 0;
    let total159FlatPastAdvanceUsed = 0;

    for (const b of billings) {
      totalPending += Number(b.pending || 0);
      totalPendingUsed += Number(b.pendingUsed || 0);
      totalAdvanceGenerated += Number(b.advance || 0);
      totalAdvanceUsed += Number(b.advanceUsed || 0);

      // Track past advance
      totalPastAdvanceGenerated += Number(b.pastAdvance || 0);
      totalPastAdvanceUsed += Number(b.pastAdvanceUsed || 0);

      if (b.pastAdvanceType === "50% Offer") {
        total50PercentOfferPastAdvanceGenerated += Number(b.pastAdvance || 0);
        total50PercentOfferPastAdvanceUsed += Number(b.pastAdvanceUsed || 0);
      }
      if (b.pastAdvanceType === "54% Offer") {
        total54PercentOfferPastAdvanceGenerated += Number(b.pastAdvance || 0);
        total54PercentOfferPastAdvanceUsed += Number(b.pastAdvanceUsed || 0);
      }
      if (b.pastAdvanceType === "159 Flat") {
        total159FlatPastAdvanceGenerated += Number(b.pastAdvance || 0);
        total159FlatPastAdvanceUsed += Number(b.pastAdvanceUsed || 0);
      }
    }

    const pendingBalance = Math.max(
      0,
      Number((totalPending - totalPendingUsed).toFixed(2)),
    );
    const advanceBalance = Math.max(
      0,
      Number((totalAdvanceGenerated - totalAdvanceUsed).toFixed(2)),
    );

    // Calculate past advance balance
    const pastAdvanceBalance = Math.max(
      0,
      Number((totalPastAdvanceGenerated - totalPastAdvanceUsed).toFixed(2)),
    );

    // Calculate past advance balance for each type
    const pastAdvance50PercentBalance = Math.max(
      0,
      Number(
        (
          total50PercentOfferPastAdvanceGenerated -
          total50PercentOfferPastAdvanceUsed
        ).toFixed(2),
      ),
    );
    const pastAdvance54PercentBalance = Math.max(
      0,
      Number(
        (
          total54PercentOfferPastAdvanceGenerated -
          total54PercentOfferPastAdvanceUsed
        ).toFixed(2),
      ),
    );
    const pastAdvance159FlatBalance = Math.max(
      0,
      Number(
        (
          total159FlatPastAdvanceGenerated - total159FlatPastAdvanceUsed
        ).toFixed(2),
      ),
    );

    return res.status(200).json({
      success: true,
      balances: {
        advanceBalance,
        pendingBalance,
        pastAdvanceBalance,
        pastAdvance50PercentBalance,
        pastAdvance54PercentBalance,
        pastAdvance159FlatBalance,
      },
      count: billings.length,
    });
  } catch (error) {
    console.error("Error computing patient balance:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to compute patient balance",
    });
  }
}

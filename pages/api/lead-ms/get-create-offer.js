// File: /pages/api/lead-ms/get-created-offer.js
import dbConnect from "../../../lib/database";
import Offer from "../../../models/CreateOffer";
import Treatment from "../../../models/Treatment";
import Clinic from "../../../models/Clinic"; 
import { getUserFromReq, requireRole } from "./auth";
import { checkClinicPermission } from "./permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  try {
    await dbConnect();

    if (req.method !== "GET") {
      return res
        .status(405)
        .json({ success: false, message: "Method not allowed" });
    }

    const user = await getUserFromReq(req);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    // Allow clinics, agents, doctors, and admins
    if (!requireRole(user, ["clinic", "agent", "admin", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;

    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id }).select("_id");
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (user.role === "agent") {
      // agent must have clinicId
      if (!user.clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "Agent not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "doctor") {
      if (!user.clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "Doctor not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "admin") {
      // Admin can access all offers, but we still need clinicId if provided
      const { clinicId: adminClinicId } = req.query;
      if (adminClinicId) {
        clinicId = adminClinicId;
      }
    }

    // ✅ Check permission for reading offers (only for clinic and agent, admin bypasses)
    if (user.role !== "admin" && clinicId) {
      // First check if clinic has read permission
      const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
        clinicId,
        "create_offers",
        "read"
      );

      if (!clinicHasPermission) {
        return res.status(403).json({
          success: false,
          message: clinicError || "You do not have permission to view offers"
        });
      }

      // If user is an agent, also check agent-specific permissions
      if (user.role === "agent") {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "create_offers",
          "read"
        );

        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to view offers"
          });
        }
      }
    }

    // Fetch offers for the clinic - minimal fields, no populate for speed
    const now = new Date();
    const offers = await Offer.find({ clinicId })
      .select("title type value endsAt status createdAt updatedAt code slug")
      .sort({ createdAt: -1 })
      .lean();

    // Compute expired status in-memory without DB write
    const shapedOffers = offers.map((offer) => ({
      ...offer,
      status:
        offer.endsAt && new Date(offer.endsAt) < now ? "expired" : offer.status,
    }));

    // Light caching for 5s (client-side private cache)
    res.setHeader("Cache-Control", "private, max-age=5, stale-while-revalidate=30");
    res.status(200).json({ success: true, offers: shapedOffers });
  } catch (err) {
    console.error("Error fetching offers:", err);
    res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
}

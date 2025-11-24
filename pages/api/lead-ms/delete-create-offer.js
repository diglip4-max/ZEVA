import dbConnect from "../../../lib/database";
import Offer from "../../../models/CreateOffer";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "./auth";
import { checkClinicPermission } from "./permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "DELETE") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "User not authenticated" });
    }

    const { id } = req.query;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing Offer ID" });
    }

    // ✅ First, get the offer to determine which clinic it belongs to
    const offer = await Offer.findById(id);
    if (!offer) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found" });
    }

    const filter = { _id: new mongoose.Types.ObjectId(id) };
    let clinic = null;

    if (user.role === "clinic" || user.role === "agent" || user.role === "doctor") {
      if (user.role === "clinic") {
        clinic = await Clinic.findOne({ owner: user._id }).select("_id");
      } else if (user.role === "agent") {
        if (!user.clinicId) {
          return res.status(403).json({ success: false, message: "No clinic linked to this user" });
        }
        clinic = await Clinic.findById(user.clinicId).select("_id");
      } else if (user.role === "doctor") {
        if (!user.clinicId) {
          return res.status(403).json({ success: false, message: "Doctor not linked to a clinic" });
        }
        clinic = await Clinic.findById(user.clinicId).select("_id");
      }

      if (!clinic) {
        return res.status(403).json({ success: false, message: "Clinic not found" });
      }

      // Ensure the offer belongs to this clinic
      if (offer.clinicId.toString() !== clinic._id.toString()) {
        return res.status(403).json({ success: false, message: "Not allowed to access this offer" });
      }

      filter.clinicId = clinic._id;

      // ✅ Check permission for deleting offers (only for clinic and agent, admin bypasses)
      // First check if clinic has delete permission
      const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
        clinic._id,
        "create_offers",
        "delete"
      );

      if (!clinicHasPermission) {
        return res.status(403).json({
          success: false,
          message: clinicError || "You do not have permission to delete offers"
        });
      }

      // If user is an agent, also check agent-specific permissions
      if (user.role === "agent") {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "create_offers",
          "delete"
        );

        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to delete offers"
          });
        }
      }
    } else if (user.role === "admin") {
      // Admin can delete any offer
      clinic = await Clinic.findById(offer.clinicId).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
    }

    const deletedOffer = await Offer.findOneAndDelete(filter);

    if (!deletedOffer) {
      return res
        .status(404)
        .json({ success: false, message: "Offer not found or not authorized" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Offer deleted successfully" });
  } catch (err) {
    console.error("Error deleting offer:", err.message || err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
}

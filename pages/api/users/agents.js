import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: `${req.method} - Method not allowed` });
  }
  try {
    const me = await getUserFromReq(req);
    if (!requireRole(me, ["clinic", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Resolve clinicId
    let clinic;
    if (me.role === "clinic") {
      clinic = await Clinic.findOne({ owner: me._id });
    } else if (me.role === "admin") {
      const { clinicId } = req.query;
      if (!clinicId) {
        return res.status(400).json({ success: false, message: "clinicId is required for admin" });
      }
      clinic = await Clinic.findById(clinicId);
    }

    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    // Get all agents belonging to this clinic
    const agents = await User.find({
      clinicId: clinic._id,
      role: "agent",
      isApproved: true,
    }).select("_id name email phone role");

    return res.status(200).json({
      success: true,
      message: "Agents fetched successfully",
      data: agents,
    });
  } catch (error) {
    console.error("Get agents error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
}
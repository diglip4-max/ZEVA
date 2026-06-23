import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import Provider from "../../../../models/Provider";
import User from "../../../../models/Users";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: `${req.method} - Method not allowed` });
  }
  try {
    const me = await getUserFromReq(req);
    if (!requireRole(me, ["clinic"])) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Only clinic users can assign providers.",
      });
    }

    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    const { providerId } = req.query;
    const { userIds } = req.body;

    if (!providerId) {
      return res
        .status(400)
        .json({ success: false, message: "providerId is required" });
    }

    if (!Array.isArray(userIds)) {
      return res
        .status(400)
        .json({ success: false, message: "userIds must be an array" });
    }

    // Verify all users are agents and belong to this clinic
    const users = await User.find({
      _id: { $in: userIds },
      clinicId: clinic._id,
      role: "agent",
    });
    if (users.length !== userIds.length) {
      return res.status(400).json({
        success: false,
        message: "One or more users are not valid agents of this clinic",
      });
    }

    // Update the provider
    await Provider.findByIdAndUpdate(
      providerId,
      { $set: { owners: userIds } },
      { new: true },
    );

    return res.status(200).json({
      success: true,
      message: "Provider assigned successfully",
    });
  } catch (error) {
    console.error("Assign provider error:", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
}

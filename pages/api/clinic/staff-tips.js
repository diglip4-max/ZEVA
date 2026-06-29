import dbConnect from "../../../lib/database";
import StaffTip from "../../../models/StaffTip";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Get clinic ID
    let clinicId;
    if (clinicUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      clinicId = clinic?._id;
    } else if (clinicUser.clinicId) {
      clinicId = clinicUser.clinicId;
    } else {
      return res.status(400).json({ success: false, message: "Clinic not found" });
    }

    if (!clinicId) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    // Get staffId from query params
    const { staffId } = req.query;
    if (!staffId) {
      return res.status(400).json({ success: false, message: "staffId is required" });
    }

    // Get all staff tips for the staff member
    const tips = await StaffTip.find({ clinicId, staffId })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      tips
    });
  } catch (error) {
    console.error("Error fetching staff tips:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching staff tips"
    });
  }
}

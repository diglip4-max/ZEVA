import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { checkClinicPermission } from "../lead-ms/permissions-helper";

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

    // Get all users for the clinic
    const users = await User.find({ clinicId })
      .select("_id name firstName lastName role email")
      .lean();

    res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error("Error fetching clinic users:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching users"
    });
  }
}

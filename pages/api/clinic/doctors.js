import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const { clinicId, error: clinicError, isAdmin } = await getClinicIdFromUser(user);
  if (clinicError && !isAdmin) {
    return res.status(403).json({ success: false, message: clinicError || "Unable to determine clinic access" });
  }

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    // If specific doctorId is requested
    if (req.query.doctorId) {
      const doc = await User.findOne({
        _id: req.query.doctorId,
        role: "doctor",
      })
        .select("-password")
        .lean();
      if (!doc)
        return res.status(404).json({ success: false, message: "Doctor not found" });
      return res.status(200).json({ success: true, data: doc });
    }

    // Build filter: only doctors/doctorStaff belonging to this clinic
    const filter = {
      role: { $in: ["doctor", "doctorStaff"] },
      isApproved: true,
      declined: false,
    };

    // branchId override (for backward compatibility with useClinicDoctors hook)
    const effectiveClinicId = req.query.branchId || clinicId;

    // Scope to current clinic (admin can see all)
    if (!isAdmin && effectiveClinicId) {
      filter.clinicId = effectiveClinicId;
    }

    const doctors = await User.find(filter)
      .select("_id name email phone role isApproved clinicId createdBy")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: doctors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

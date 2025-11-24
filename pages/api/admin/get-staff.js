// pages/api/admin/get-staff.js
import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const staffList = await User.find({ role: { $in: ["staff", "doctorStaff"] } })
      .select("-password") // exclude password
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, staff: staffList });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import Room from "../../../models/Room";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const authUser = await getUserFromReq(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    let clinicId = null;
    let clinic = null;

    if (authUser.role === "clinic") {
      clinic = await Clinic.findOne({ owner: authUser._id }).lean();
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (["agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      clinicId = authUser.clinicId;
      if (!clinicId) {
        return res.status(403).json({ success: false, message: "Access denied. User not linked to a clinic." });
      }
      clinic = await Clinic.findById(clinicId).lean();
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
    } else {
      return res.status(403).json({ success: false, message: "Access denied." });
    }

    // Fetch all doctorStaff for this clinic
    const doctorStaff = await User.find({
      role: "doctorStaff",
      clinicId: clinicId,
      isApproved: true,
      declined: false,
    })
      .select("_id name email")
      .sort({ name: 1 })
      .lean();

    // Fetch all rooms for this clinic
    const rooms = await Room.find({
      clinicId: clinicId,
    })
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      clinic: {
        _id: clinic._id.toString(),
        name: clinic.name,
        timings: clinic.timings || "",
      },
      doctorStaff: doctorStaff.map((doc) => ({
        _id: doc._id.toString(),
        name: doc.name,
        email: doc.email,
      })),
      rooms: rooms.map((room) => ({
        _id: room._id.toString(),
        name: room.name,
      })),
    });
  } catch (error) {
    console.error("Error fetching appointment data:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch appointment data" });
  }
}


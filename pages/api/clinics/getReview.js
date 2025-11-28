import dbConnect from "../../../lib/database";
import Review from "../../../models/Review";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    const authUser = await getUserFromReq(req);
    if (!authUser) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Allow clinic, agent, doctor, doctorStaff, and staff roles
    if (!["clinic", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    let clinicId = null;
    let clinic = null;

    // Step 1: Find the clinic associated with the user
    if (authUser.role === "clinic") {
      clinic = await Clinic.findOne({ owner: authUser._id });
      if (!clinic) {
        return res.status(404).json({ message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (["agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      // For agent, doctor, doctorStaff, and staff, use their clinicId
      if (!authUser.clinicId) {
        return res.status(403).json({ message: "Access denied. User not linked to a clinic." });
      }
      clinicId = authUser.clinicId;
      clinic = await Clinic.findById(clinicId);
      if (!clinic) {
        return res.status(404).json({ message: "Clinic not found" });
      }
    }

    // Step 2: Fetch all reviews for the clinic and populate user details
    const reviews = await Review.find({ clinicId: clinicId })
      .sort({ createdAt: -1 })
      .populate({
        path: "userId",
        select: "name email", // adjust fields if needed
        model: User,
      });

    return res.status(200).json({ success: true, reviews });
  } catch (err) {
    console.error("Fetch clinic reviews error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}

import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import User from "../../../../models/Users";
import { getUserFromReq } from "../../lead-ms/auth";

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

    // Check if user has access (clinic, agent, doctorStaff, staff)
    if (!["clinic", "agent", "doctorStaff", "staff"].includes(clinicUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { patientId: id } = req.query;

    if (!id) {
      return res.status(400).json({ success: false, message: "Patient or Appointment ID is required" });
    }

    // Determine clinicId
    let clinicId;
    if (clinicUser.role === "clinic") {
      // For clinic role, find clinic by owner
      const Clinic = (await import("../../../../models/Clinic")).default;
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else {
      // For agent, doctorStaff, staff - use clinicId from user
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to a clinic" });
      }
    }

    // Check if the id is an appointmentId or patientId
    // First, try to find any billings with this appointmentId
    let query = Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
    });

    // First, try appointmentId
    let billings = await query.clone().where('appointmentId').equals(id)
      .populate({
        path: "doctorId",
        select: "name",
        model: User
      })
      .sort({ createdAt: -1 }) // Most recent first
      .lean();

    // If no billings found, try patientId
    if (!billings || billings.length === 0) {
      billings = await query.clone().where('patientId').equals(id)
        .populate({
          path: "doctorId",
          select: "name",
          model: User
        })
        .sort({ createdAt: -1 }) // Most recent first
        .lean();
    }

    // No longer filter out Package invoices, even when referenced in Treatment invoices' pendingClearedBreakdown
    // Show all billings to maintain full history visibility

    // Now map through each billing to set doctorName (using either stored doctorName or from populated doctorId)
    const billingsWithDoctorName = billings.map(billing => {
      const doctorName = billing.doctorName || billing.doctorId?.name || "—";
      return {
        ...billing,
        doctorName
      };
    });

    return res.status(200).json({
      success: true,
      billings: billingsWithDoctorName,
    });
  } catch (error) {
    console.error("Error fetching billing history:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch billing history",
    });
  }
}


import dbConnect from "../../../../lib/database";
import InsuranceClaim from "../../../../models/InsuranceClaim";
import User from "../../../../models/Users";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser } from "../../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "PATCH") {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  // Verify authentication
  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "doctor", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  try {
    const { claimId } = req.body;

    if (!claimId) {
      return res.status(400).json({ success: false, message: "claimId is required" });
    }

    const claim = await InsuranceClaim.findById(claimId);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    // Get clinicId for access control
    const { clinicId: userClinicId, isAdmin } = await getClinicIdFromUser(user);

    // Only Ready claims can be completed
    if (claim.status !== "Ready") {
      return res.status(400).json({
        success: false,
        message: `Cannot complete claim with status "${claim.status}". Only "Ready" claims can be completed.`,
      });
    }

    // Clinic/agent/staff/doctorStaff can only complete claims from their clinic
    if (!isAdmin && userClinicId) {
      if (claim.clinicId?.toString() !== userClinicId.toString()) {
        return res.status(403).json({ success: false, message: "Access denied: claim belongs to another clinic" });
      }
    }

    // Mark claim as Completed
    claim.status = "Completed";
    claim.completedBy = user._id;
    claim.completedByName = user.name || user.firstName || "";
    claim.completedByRole = user.role;
    claim.completedAt = new Date();

    await claim.save();

    return res.status(200).json({
      success: true,
      message: "Claim completed successfully",
      data: claim,
    });
  } catch (error) {
    console.error("Error completing claim:", error);
    return res.status(500).json({ success: false, message: "Failed to complete claim" });
  }
}

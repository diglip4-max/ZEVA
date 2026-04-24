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
    const { claimId, action, rejectionReason, reviewNotes } = req.body;

    if (!claimId || !action) {
      return res.status(400).json({ success: false, message: "claimId and action are required" });
    }

    if (!["approve", "reject"].includes(action)) {
      return res.status(400).json({ success: false, message: "Action must be 'approve' or 'reject'" });
    }

    if (action === "reject" && (!rejectionReason || !rejectionReason.trim())) {
      return res.status(400).json({ success: false, message: "Rejection reason is required when rejecting a claim" });
    }

    const claim = await InsuranceClaim.findById(claimId);
    if (!claim) {
      return res.status(404).json({ success: false, message: "Claim not found" });
    }

    // Get clinicId for access control
    const { clinicId: userClinicId, isAdmin } = await getClinicIdFromUser(user);

    // Clinic/agent/staff/doctorStaff can only review claims from their clinic
    if (!isAdmin && userClinicId) {
      if (claim.clinicId?.toString() !== userClinicId.toString()) {
        return res.status(403).json({ success: false, message: "Access denied: claim belongs to another clinic" });
      }
    }

    // Only claims with "Under Review" status can be reviewed
    if (claim.status !== "Under Review") {
      return res.status(400).json({
        success: false,
        message: `Cannot review claim with status "${claim.status}". Only "Under Review" claims can be reviewed.`,
      });
    }

    // Authorization: doctorStaff can only review claims assigned to them
    if (user.role === "doctorStaff" && claim.doctorId.toString() !== user._id.toString()) {
      return res.status(403).json({ success: false, message: "You can only review claims assigned to you" });
    }

    // Update claim status
    if (action === "approve") {
      claim.status = "Approved";
    } else {
      claim.status = "Rejected";
      claim.rejectionReason = rejectionReason.trim();
    }

    claim.reviewedBy = user._id;
    claim.reviewedAt = new Date();
    claim.reviewNotes = reviewNotes || "";

    await claim.save();

    return res.status(200).json({
      success: true,
      message: `Claim ${action === "approve" ? "approved" : "rejected"} successfully`,
      data: claim,
    });
  } catch (error) {
    console.error("Error reviewing claim:", error);
    return res.status(500).json({ success: false, message: "Failed to review claim" });
  }
}

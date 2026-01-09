 import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import DoctorProfile from "../../../models/DoctorProfile";
import Review from "../../../models/Review"; // ✅ Import Review model
import Appointment from "../../../models/Appointment";
import DoctorTreatment from "../../../models/DoctorTreatment";
import DoctorDepartment from "../../../models/DoctorDepartment";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";
import { generateAndLockSlug } from "../../../lib/slugService";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST")
    return res.status(405).json({ message: "Method not allowed" });

  const { userId, action } = req.body;

  if (!userId || !["approve", "decline", "delete"].includes(action)) {
    return res.status(400).json({ message: "Invalid request" });
  }

  try {
    // Get the logged-in user
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
    }

    // If user is an agent, check permissions based on action
    if (['agent', 'doctorStaff'].includes(me.role)) {
      let requiredAction = action;
      if (action === "approve" || action === "decline") {
        requiredAction = "approve"; // Both approve and decline require "approve" permission
      }
      // delete action requires "delete" permission

      const { hasPermission, error: permissionError } = await checkAgentPermission(
        me._id,
        "approval_doctors", // moduleKey
        requiredAction, // action: "approve" or "delete"
        null // subModuleName
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permissionError || `You do not have permission to ${action} doctors`
        });
      }
    }
    // Admin users bypass permission checks
    if (action === "delete") {
      // Delete DoctorProfile
      const doctorProfile = await DoctorProfile.findOneAndDelete({ user: userId });

      // Delete User
      await User.findByIdAndDelete(userId);

      // Delete all reviews associated with this doctor
      if (doctorProfile) {
        await Review.deleteMany({ doctorId: doctorProfile._id }); // ✅ Cleanup reviews
      }

      return res.status(200).json({ message: "Doctor and related reviews deleted successfully" });
    }

    // Step 1: Update user approval status
    const updateFields = {
      isApproved: action === "approve",
      declined: action === "decline",
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
    });

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    // Step 2: Generate and lock slug for doctor profile (only on approval)
    if (action === "approve") {
      try {
        const doctorProfile = await DoctorProfile.findOne({ user: userId });
        if (doctorProfile && !doctorProfile.slugLocked) {
          console.log(`🔄 Generating slug for doctor: ${updatedUser.name} (Profile ID: ${doctorProfile._id})`);
          
          // Use central slug service to generate and lock slug
          const updatedProfile = await generateAndLockSlug('doctor', doctorProfile._id.toString());
          
          if (updatedProfile.slug && updatedProfile.slugLocked) {
            console.log(`✅ Slug generated successfully: ${updatedProfile.slug}`);
          } else {
            console.log(`⚠️ Slug generation completed but slugLocked is false`);
          }
        } else if (doctorProfile && doctorProfile.slugLocked) {
          console.log(`⏭️ Skipping slug generation - slug already locked: ${doctorProfile.slug}`);
        }
      } catch (slugError) {
        // If slug generation fails but doctor is approved, continue with approval
        console.error("❌ Slug generation error (non-fatal):", slugError.message);
        console.error("Error stack:", slugError.stack);
        // Continue with approval even if slug generation fails
      }
    }

    return res.status(200).json({
      message: `Doctor ${action === "approve" ? "approved" : "declined"} successfully`,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

 
import User from "../../../models/Users";
import DoctorProfile from "../../../models/DoctorProfile";
import Review from "../../../models/Review"; // ✅ Import Review model
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";

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

    const updateFields = {
      isApproved: action === "approve",
      declined: action === "decline",
    };

    const updatedUser = await User.findByIdAndUpdate(userId, updateFields, {
      new: true,
    });

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    return res.status(200).json({
      message: `Doctor ${action === "approve" ? "approved" : "declined"} successfully`,
      user: updatedUser,
    });
  } catch (error) {
    return res.status(500).json({ message: "Server error", error: error.message });
  }
}

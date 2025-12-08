import dbConnect from "../../../lib/database";
import Treatment from "../../../models/Treatment";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "GET") {
    try {
      // Get the logged-in user
      const me = await getUserFromReq(req);
      if (!me) {
        return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
      }

      console.log("getTreatment - User role:", me.role, "User ID:", me._id);

      // Allow clinic, doctor, admin, lead, doctorStaff roles without permission checks
      if (['clinic', 'doctor', 'admin', 'lead', 'doctorStaff'].includes(me.role)) {
        // These roles can access treatments without permission checks
        console.log("getTreatment - Allowing access for role:", me.role);
      } else if (['agent', 'staff'].includes(me.role)) {
        // For agent and staff, check read permission for add_treatment module
        try {
          console.log("getTreatment - Checking permission for role:", me.role);
        const { hasPermission, error: permissionError } = await checkAgentPermission(
          me._id,
          "add_treatment", // moduleKey
          "read", // action
          null // subModuleName
        );

          console.log("getTreatment - Permission result:", { hasPermission, error: permissionError });

        if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: permissionError || "You do not have permission to view treatments",
              role: me.role
            });
          }
        } catch (permissionError) {
          console.error("Permission check error:", permissionError);
          // If permission check fails, deny access
          return res.status(403).json({
            success: false,
            message: "Permission check failed. You may not have access to view treatments.",
            error: permissionError.message,
            role: me.role
          });
        }
      } else {
        // Unknown role, deny access
        console.log("getTreatment - Unknown role:", me.role);
        return res.status(403).json({
          success: false,
          message: "Access denied. Your role does not have access to treatments.",
          role: me.role
        });
      }
      
      const treatments = await Treatment.find({}).lean();
      return res.status(200).json({ treatments });
    } catch (error) {
      console.error("Error fetching treatments:", error);
      return res.status(500).json({ message: "Error fetching treatments" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}

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

      // If user is an agent, check read permission for add_treatment module
      if (['agent', 'doctorStaff'].includes(me.role)) {
        const { hasPermission, error: permissionError } = await checkAgentPermission(
          me._id,
          "add_treatment", // moduleKey
          "read", // action
          null // subModuleName
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: permissionError || "You do not have permission to view treatments"
          });
        }
      }
      // Admin users bypass permission checks
      
      const treatments = await Treatment.find({}).lean();
      return res.status(200).json({ treatments });
    } catch (error) {
      console.error("Error fetching treatments:", error);
      return res.status(500).json({ message: "Error fetching treatments" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}

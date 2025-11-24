import dbConnect from "../../../lib/database";
import Vendor from "../../../models/VendorProfile";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "POST") {
    try {
      // Get the logged-in user
      const me = await getUserFromReq(req);
      if (!me) {
        return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
      }
      
      // Check permissions for agents - admins bypass all checks
      if (me.role === 'agent' || me.role === 'doctorStaff') {
        const { hasPermission } = await checkAgentPermission(me._id, "admin_staff_management", "create", "Create Vendor");
        if (!hasPermission) {
          return res.status(403).json({ 
            success: false,
            message: "Permission denied: You do not have create permission for Create Vendor submodule" 
          });
        }
      } else if (me.role !== 'admin') {
        return res.status(403).json({ success: false, message: "Access denied. Admin or agent role required" });
      }
      
      let createdBy = req.body.createdBy || me.name || me.email || "System";

      // commissionPercentage removed — rest stays same
      const vendor = new Vendor({
        ...req.body,
        createdBy,
      });

      await vendor.save();

      res.status(201).json({ success: true, data: vendor });
    } catch (error) {
      console.error("Error creating vendor:", error);
      res.status(400).json({ success: false, message: error.message });
    }
  } else {
    res.status(405).json({ success: false, message: "Method not allowed" });
  }
}

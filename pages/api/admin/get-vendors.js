import dbConnect from "../../../lib/database";
import Vendor from "../../../models/VendorProfile";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    // Get the logged-in user
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
    }
    
    // Check permissions for agents - admins bypass all checks
    if (me.role === 'agent' || me.role === 'doctorStaff') {
      const { hasPermission } = await checkAgentPermission(me._id, "admin_staff_management", "read", "Create Vendor");
      if (!hasPermission) {
        return res.status(403).json({ 
          success: false,
          message: "Permission denied: You do not have read permission for Create Vendor submodule" 
        });
      }
    } else if (me.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Access denied. Admin or agent role required" });
    }
    
    const vendors = await Vendor.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: vendors });
  } catch (error) {
    console.error("Error fetching vendors:", error);
    res.status(400).json({ success: false, message: error.message });
  }
}

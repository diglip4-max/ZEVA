import dbConnect from "../../../lib/database";
import Vendor from "../../../models/VendorProfile";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  const { id } = req.query;

  if (req.method !== "PUT") {
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
      const { hasPermission } = await checkAgentPermission(me._id, "admin_staff_management", "update", "Create Vendor");
      if (!hasPermission) {
        return res.status(403).json({ 
          success: false,
          message: "Permission denied: You do not have update permission for Create Vendor submodule" 
        });
      }
    } else if (me.role !== 'admin') {
      return res.status(403).json({ success: false, message: "Access denied. Admin or agent role required" });
    }
    
    const updated = await Vendor.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ success: false, message: "Vendor not found" });
    }

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
}

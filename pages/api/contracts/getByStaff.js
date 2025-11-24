import dbConnect from "../../../lib/database";
import Contract from "../../../models/Contract";
import jwt from "jsonwebtoken";
import { checkAgentPermission } from "../../../lib/checkAgentPermission";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ success: false, message: "Token missing" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log(decoded);
    
    // Allow multiple roles: staff, agent, clinic, doctor
    const allowedRoles = ["staff", "agent", "clinic", "doctor", "doctorStaff"];
    if (!decoded || !allowedRoles.includes(decoded.role)) {
      return res.status(403).json({ success: false, message: "Access denied. Invalid role." });
    }

    // Check agent permissions for reading contracts
    // All Contracts is a submodule under staff_management
    if (decoded.role === 'agent' || decoded.role === 'doctorStaff') {
      console.log(`Checking read permission for user ${decoded.userId} on contracts submodule`);
      const hasPermission = await checkAgentPermission(
        decoded.userId, 
        'staff_management', 
        'read',
        'All Contracts'
      ) || await checkAgentPermission(decoded.userId, 'staff_management', 'all', 'All Contracts')
      || await checkAgentPermission(decoded.userId, 'clinic_staff_management', 'read', 'All Contracts')
      || await checkAgentPermission(decoded.userId, 'clinic_staff_management', 'all', 'All Contracts');
      
      console.log(`Read permission result for contracts:`, hasPermission);
      
      if (!hasPermission) {
        return res.status(403).json({ 
          success: false, 
          message: "You don't have permission to view contracts" 
        });
      }
    }

    // Fetch contracts assigned to this user
    console.log("Looking for contracts with responsiblePerson:", decoded.userId);
    const contracts = await Contract.find({
      responsiblePerson: decoded.userId,
    })
      .populate("responsiblePerson", "name email")
      .sort({ createdAt: -1 })
      .lean();
    
    console.log("Found contracts:", contracts.length);

    res.status(200).json({
      success: true,
      count: contracts.length,
      data: contracts,
    });
  } catch (error) {
    console.error("Error fetching staff contracts:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
}
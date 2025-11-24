// pages/api/clinic/permissions/staff.js
import dbConnect from "../../../../lib/database";
import StaffPermission from "../../../../models/StaffPermission";
import ClinicPermission from "../../../../models/ClinicPermission";
import User from "../../../../models/Users";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  await dbConnect();

  // Verify clinic token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  let clinicId;
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!['clinic', 'admin'].includes(decoded.role)) {
      return res.status(403).json({ success: false, message: 'Clinic access required' });
    }
    clinicId = decoded.clinicId || decoded.userId; // For clinic role, clinicId might be the userId
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  if (req.method === 'GET') {
    try {
      const { staffId } = req.query;
      
      if (staffId) {
        // Get specific staff permissions
        const permissions = await StaffPermission.findOne({ 
          staffId, 
          clinicId,
          isActive: true 
        }).populate('staffId', 'name email role');
        return res.status(200).json({ success: true, data: permissions });
      } else {
        // Get all staff permissions for this clinic
        const permissions = await StaffPermission.find({ 
          clinicId,
          isActive: true 
        }).populate('staffId', 'name email role');
        return res.status(200).json({ success: true, data: permissions });
      }
    } catch (error) {
      console.error('Error fetching staff permissions:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    try {
      const { staffId, permissions } = req.body;

      if (!staffId || !permissions) {
        return res.status(400).json({ success: false, message: 'Staff ID and permissions are required' });
      }

      // Verify staff belongs to this clinic
      const staff = await User.findOne({ 
        _id: staffId, 
        clinicId,
        role: { $in: ['staff', 'doctorStaff'] }
      });
      if (!staff) {
        return res.status(404).json({ success: false, message: 'Staff not found or not associated with this clinic' });
      }

      // Get clinic's own permissions to validate against
      const clinicPermissions = await ClinicPermission.findOne({ clinicId, isActive: true });
      if (!clinicPermissions) {
        return res.status(403).json({ success: false, message: 'Clinic permissions not found' });
      }

      // Validate that staff permissions don't exceed clinic permissions
      const validatedPermissions = permissions.filter(staffPerm => {
        const clinicPerm = clinicPermissions.permissions.find(cp => cp.module === staffPerm.module);
        if (!clinicPerm) return false;

        // Check if staff actions are within clinic permissions
        return Object.keys(staffPerm.actions).every(action => 
          !staffPerm.actions[action] || clinicPerm.actions[action]
        );
      });

      // Get clinic user ID from token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Create or update staff permissions
      const staffPermission = await StaffPermission.findOneAndUpdate(
        { staffId, clinicId },
        {
          staffId,
          clinicId,
          permissions: validatedPermissions,
          grantedBy: decoded.userId,
          lastModified: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );

      return res.status(200).json({ 
        success: true, 
        message: 'Staff permissions updated successfully',
        data: staffPermission 
      });
    } catch (error) {
      console.error('Error updating staff permissions:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const { staffId } = req.body;

      if (!staffId) {
        return res.status(400).json({ success: false, message: 'Staff ID is required' });
      }

      await StaffPermission.findOneAndUpdate(
        { staffId, clinicId },
        { isActive: false }
      );

      return res.status(200).json({ 
        success: true, 
        message: 'Staff permissions deactivated successfully' 
      });
    } catch (error) {
      console.error('Error deactivating staff permissions:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}

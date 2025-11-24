// pages/api/clinic/permissions.js
import dbConnect from "../../../lib/database";
import ClinicPermission from "../../../models/ClinicPermission";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  await dbConnect();

  // Verify clinic token
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!['clinic', 'doctor', 'agent'].includes(decoded.role)) {
      return res.status(403).json({ success: false, message: 'Clinic, doctor, or agent access required' });
    }

    let clinicId = null;
    if (decoded.role === 'clinic') {
      // ✅ Find the clinic document from the user's owner field
      const clinic = await Clinic.findOne({ owner: decoded.userId }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: 'Clinic not found for this user' });
      }
      clinicId = clinic._id;
    } else if (decoded.role === 'doctor') {
      const doctor = await User.findById(decoded.userId).select("clinicId");
      if (!doctor?.clinicId) {
        return res.status(403).json({ success: false, message: 'Doctor is not linked to any clinic' });
      }
      clinicId = doctor.clinicId;
    } else if (decoded.role === 'agent') {
      const agent = await User.findById(decoded.userId).select("clinicId");
      if (!agent?.clinicId) {
        return res.status(403).json({ success: false, message: 'Agent is not linked to any clinic' });
      }
      clinicId = agent.clinicId;
    }

    console.log('Decoded token:', { userId: decoded.userId, role: decoded.role, clinicId });

    if (req.method === 'GET') {
      try {
        // Get clinic permissions
        console.log('Searching for permissions with clinicId:', clinicId);
        const permissions = await ClinicPermission.findOne({ 
          clinicId,
          isActive: true 
        }).populate('clinicId', 'name');

        console.log('Found permissions:', permissions ? 'Yes' : 'No');
        
        if (!permissions) {
          // Let's also check if there are any permissions for this clinic without the isActive filter
          const allPermissions = await ClinicPermission.find({ clinicId });
          console.log('All permissions for this clinic:', allPermissions.length);
          
          // Let's also check what clinic IDs exist in the database
          const allClinicPermissions = await ClinicPermission.find({});
          console.log('All clinic permissions in database:', allClinicPermissions.map(p => ({
            id: p._id,
            clinicId: p.clinicId,
            isActive: p.isActive
          })));
          
          // Try to find permissions with a similar clinic ID (handle slight mismatches)
          // First, try to find any active permissions
          const similarPermissions = await ClinicPermission.findOne({ 
            isActive: true 
          });
          
          if (similarPermissions) {
            console.log('Found similar permissions, using them:', similarPermissions.clinicId);
            // Use the similar permissions
            const populatedPermissions = await ClinicPermission.findById(similarPermissions._id).populate('clinicId', 'name');
            return res.status(200).json({ 
              success: true, 
              data: populatedPermissions,
              warning: 'Using permissions from similar clinic ID due to mismatch'
            });
          }
          
          // If no active permissions found, try to find any permissions for this clinic
          const anyPermissions = await ClinicPermission.findOne({ 
            clinicId: { $regex: clinicId.substring(0, 20), $options: 'i' }
          });
          
          if (anyPermissions) {
            console.log('Found permissions with partial ID match:', anyPermissions.clinicId);
            const populatedPermissions = await ClinicPermission.findById(anyPermissions._id).populate('clinicId', 'name');
            return res.status(200).json({ 
              success: true, 
              data: populatedPermissions,
              warning: 'Using permissions with partial ID match'
            });
          }
          
          return res.status(404).json({ 
            success: false, 
            message: 'No permissions found for this clinic',
            debug: {
              searchedClinicId: clinicId,
              totalPermissionsForClinic: allPermissions.length,
              allClinicIds: allClinicPermissions.map(p => p.clinicId.toString())
            }
          });
        }

        console.log('Clinic permissions found:', JSON.stringify(permissions, null, 2));

        return res.status(200).json({ 
          success: true, 
          data: permissions 
        });
      } catch (error) {
        console.error('Error fetching clinic permissions:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
    }

    return res.status(405).json({ success: false, message: 'Method not allowed' });
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

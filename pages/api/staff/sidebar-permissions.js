// pages/api/staff/sidebar-permissions.js
// Returns navigation items for staff sidebar based on who created the staff member
// Similar to agent sidebar permissions, but for staff roles (staff, doctorStaff)
import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import ClinicNavigationItem from "../../../models/ClinicNavigationItem";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get the logged-in staff member
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
    }

    // Verify user is a staff member
    if (!['staff', 'doctorStaff'].includes(me.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Staff role required' });
    }

    // Determine which role's navigation items to show based on who created the staff member
    // Priority: 1. Check who created the staff, 2. Default to 'clinic'
    let navigationRole = 'clinic'; // default
    
    if (me.createdBy) {
      const creator = await User.findById(me.createdBy).select('role');
      if (creator) {
        if (creator.role === 'admin') {
          navigationRole = 'admin';
        } else if (creator.role === 'clinic') {
          navigationRole = 'clinic';
        } else if (creator.role === 'doctor') {
          navigationRole = 'doctor';
        }
      }
    }

    // Get navigation items for the determined role (these are the modules from creator's dashboard)
    const navigationItems = await ClinicNavigationItem.find({ 
      role: navigationRole, 
      isActive: true 
    }).sort({ order: 1 });

    // Helper function to transform paths based on navigation role
    const transformPath = (path) => {
      if (!path) return path;
      
      // For clinic staff, convert /staff/* to /clinic/staff/*
      if (navigationRole === 'clinic') {
        if (path.startsWith('/staff/')) {
          return path.replace('/staff/', '/clinic/staff/');
        }
        if (path === '/staff') {
          return '/clinic/staff';
        }
      }
      
      // For doctor staff, convert /staff/* to /doctor/staff/*
      if (navigationRole === 'doctor') {
        if (path.startsWith('/staff/')) {
          return path.replace('/staff/', '/doctor/staff/');
        }
        if (path === '/staff') {
          return '/doctor/staff';
        }
      }
      
      // For admin staff, keep /staff/* as is (or convert to /admin/staff/* if needed)
      // For now, keep as is
      
      return path;
    };

    // For now, staff see all navigation items (no permission model yet)
    // This can be extended later with StaffPermission model if needed
    return res.status(200).json({
      success: true,
      permissions: null,
      navigationItems: navigationItems.map(item => ({
        _id: item._id,
        label: item.label,
        path: transformPath(item.path),
        icon: item.icon,
        description: item.description,
        order: item.order,
        moduleKey: item.moduleKey,
        subModules: (item.subModules || []).map(subModule => ({
          name: subModule.name,
          path: transformPath(subModule.path || ''),
          icon: subModule.icon || '',
          order: subModule.order || 0
        }))
      })),
      navigationRole,
      staffId: me._id.toString()
    });

  } catch (error) {
    console.error('Error fetching staff sidebar permissions:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}


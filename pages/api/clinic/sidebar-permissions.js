// pages/api/clinic/sidebar-permissions.js
// Returns navigation items for clinic sidebar based on permissions granted by admin
import dbConnect from "../../../lib/database";
import ClinicPermission from "../../../models/ClinicPermission";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import ClinicNavigationItem from "../../../models/ClinicNavigationItem";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get the logged-in clinic user
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
    }

    // Verify user is a clinic or an agent/doctorStaff accessing clinic routes
    // Agents can access clinic routes if they have appropriate permissions
    if (me.role === 'clinic') {
      // Clinic user - proceed normally
    } else if (['agent', 'doctorStaff'].includes(me.role)) {
      // Agent accessing clinic route - check if they have clinic permissions
      // This is handled by the agent sidebar-permissions API, but we allow it here
      // for direct API calls from agent routes
    } else {
      return res.status(403).json({ success: false, message: 'Access denied. Clinic role or agent with clinic permissions required' });
    }

    // Get clinic associated with this user
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res.status(404).json({ success: false, message: 'Clinic not found for this user' });
    }

    // Check if clinic is approved
    if (!clinic.isApproved) {
      return res.status(403).json({ 
        success: false, 
        message: 'Clinic account not approved. Please wait for admin approval.' 
      });
    }

    // Check if clinic is declined
    if (clinic.declined) {
      return res.status(403).json({ 
        success: false, 
        message: 'Clinic account has been declined' 
      });
    }

    // Get clinic permissions
    const clinicPermission = await ClinicPermission.findOne({ clinicId: clinic._id });

    // Get navigation items for clinic role
    const navigationItems = await ClinicNavigationItem.find({ 
      role: 'clinic', 
      isActive: true 
    }).sort({ order: 1 });

    // Helper function to transform /staff paths to /clinic/staff paths
    const transformPath = (path) => {
      if (!path) return path;
      // Transform /staff/* to /clinic/staff/*
      if (path.startsWith('/staff/')) {
        return path.replace('/staff/', '/clinic/staff/');
      }
      // Transform /staff to /clinic/staff
      if (path === '/staff') {
        return '/clinic/staff';
      }
      // Keep other paths as-is (clinic paths, etc.)
      return path;
    };

    // If no permissions exist, return all navigation items (clinic sees everything until admin restricts)
    if (!clinicPermission || !clinicPermission.permissions || clinicPermission.permissions.length === 0) {
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
            ...subModule,
            path: transformPath(subModule.path)
          }))
        })),
        clinicId: clinic._id.toString()
      });
    }

    // Build permission map for quick lookup
    const permissionMap = {};
    clinicPermission.permissions.forEach(perm => {
      const moduleKey = perm.module;
      const moduleKeyWithoutPrefix = moduleKey.replace(/^(admin|clinic|doctor)_/, '');
      const moduleKeyWithPrefix = `clinic_${moduleKeyWithoutPrefix}`;
      
      const permissionData = {
        moduleActions: perm.actions,
        subModules: {}
      };
      
      permissionMap[moduleKey] = permissionData;
      permissionMap[moduleKeyWithoutPrefix] = permissionData;
      permissionMap[moduleKeyWithPrefix] = permissionData;
      
      if (perm.subModules && perm.subModules.length > 0) {
        perm.subModules.forEach(subModule => {
          permissionData.subModules[subModule.name] = subModule.actions;
        });
      }
    });

    // Filter navigation items based on permissions
    // Show module only if clinic has "read" or "all" permission at module level
    // Show submodule only if clinic has "read" or "all" permission at submodule level
    const filteredNavigationItems = navigationItems
      .map(item => {
        // Try multiple lookup strategies for moduleKey matching
        const modulePerm = permissionMap[item.moduleKey] || 
                          permissionMap[item.moduleKey.replace('clinic_', '')] ||
                          permissionMap[item.moduleKey.replace(/^(admin|clinic|doctor)_/, '')];
        
        // Check if module has read permission
        const hasModuleRead = modulePerm && (
          modulePerm.moduleActions.read === true || 
          modulePerm.moduleActions.all === true
        );

        if (!hasModuleRead) {
          return null; // Don't show this module at all
        }

        // Filter submodules based on permissions
        // Only show submodules that have explicit read or all permission
        let filteredSubModules = [];
        if (item.subModules && item.subModules.length > 0) {
          filteredSubModules = item.subModules
            .map(subModule => {
              const subModulePerm = modulePerm?.subModules[subModule.name];
              const hasSubModuleRead = subModulePerm && (
                subModulePerm.read === true || 
                subModulePerm.all === true
              );
              
              // Only include submodule if it has read permission
              if (hasSubModuleRead) {
                return {
                  name: subModule.name,
                  path: transformPath(subModule.path || ''),
                  icon: subModule.icon || '',
                  order: subModule.order || 0
                };
              }
              return null;
            })
            .filter(subModule => subModule !== null);
        }

        return {
          _id: item._id,
          label: item.label,
          path: transformPath(item.path),
          icon: item.icon,
          description: item.description,
          order: item.order,
          moduleKey: item.moduleKey,
          subModules: filteredSubModules
        };
      })
      .filter(item => item !== null); // Remove null items

    return res.status(200).json({
      success: true,
      permissions: clinicPermission.permissions,
      navigationItems: filteredNavigationItems,
      clinicId: clinic._id.toString()
    });

  } catch (error) {
    console.error('Error fetching clinic sidebar permissions:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}


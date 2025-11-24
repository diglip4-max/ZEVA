// pages/api/agent/get-module-permissions.js
// API endpoint to get full permission details for a specific module
import dbConnect from "../../../lib/database";
import { getUserFromReq } from "../lead-ms/auth";
import { getAgentModulePermissions } from "./permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get the logged-in agent
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
    }

    // Verify user is an agent
    if (!['agent', 'doctorStaff'].includes(me.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Agent role required' });
    }

    const { moduleKey } = req.query;

    if (!moduleKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'moduleKey is required' 
      });
    }

    // Get module permissions
    const { permissions, error } = await getAgentModulePermissions(
      me._id,
      moduleKey
    );

    if (error) {
      return res.status(200).json({
        success: true,
        permissions: null,
        error,
        agentId: me._id.toString(),
        moduleKey
      });
    }

    return res.status(200).json({
      success: true,
      permissions: {
        module: permissions.module,
        actions: permissions.actions || {},
        subModules: permissions.subModules || []
      },
      error: null,
      agentId: me._id.toString(),
      moduleKey
    });

  } catch (error) {
    console.error('Error getting agent module permissions:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}


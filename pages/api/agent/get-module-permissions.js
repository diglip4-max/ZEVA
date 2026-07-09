// pages/api/agent/get-module-permissions.js
// API endpoint to get full permission details for a specific module
import dbConnect from "../../../lib/database";
import { getUserFromReq } from "../lead-ms/auth";
import { getAgentModulePermissions } from "./permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  console.log('\n========== [API DEBUG] /api/agent/get-module-permissions ==========');
  console.log('[API DEBUG] Method:', req.method);
  console.log('[API DEBUG] Query:', req.query);

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Get the logged-in user
    const me = await getUserFromReq(req);
    if (!me) {
      console.log('[API DEBUG] ERROR: Unauthorized - Missing or invalid token');
      return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
    }

    console.log('[API DEBUG] User authenticated:', {
      userId: me._id.toString(),
      role: me.role,
      name: me.name
    });

    const { moduleKey } = req.query;

    if (!moduleKey) {
      console.log('[API DEBUG] ERROR: moduleKey is required');
      return res.status(400).json({ 
        success: false, 
        message: 'moduleKey is required' 
      });
    }

    console.log('[API DEBUG] Requested moduleKey:', moduleKey);

    // If user is clinic/doctor/admin, return full permissions (they own the modules)
    if (['clinic', 'doctor', 'admin'].includes(me.role)) {
      console.log('[API DEBUG] User is clinic/doctor/admin - returning full permissions');
      return res.status(200).json({
        success: true,
        permissions: {
          module: moduleKey,
          actions: {
            all: true,
            create: true,
            read: true,
            update: true,
            delete: true,
            import: true,
            export: true
          },
          subModules: []
        },
        error: null,
        agentId: me._id.toString(),
        moduleKey
      });
    }

    // Verify user is an agent, doctorStaff, or staff for agent permission logic
    if (!['agent', 'doctorStaff', 'staff'].includes(me.role)) {
      console.log('[API DEBUG] ERROR: Access denied - role not agent/doctorStaff/staff');
      return res.status(403).json({ success: false, message: 'Access denied. Agent/Staff role required' });
    }

    console.log('[API DEBUG] Calling getAgentModulePermissions...');
    // Get module permissions for agents
    const { permissions, error } = await getAgentModulePermissions(
      me._id,
      moduleKey
    );

    console.log('[API DEBUG] getAgentModulePermissions returned:');
    console.log('[API DEBUG]   - permissions:', permissions ? 'FOUND' : 'NULL');
    console.log('[API DEBUG]   - error:', error);

    if (error) {
      console.log('[API DEBUG] Returning error response');
      return res.status(200).json({
        success: true,
        permissions: null,
        error,
        agentId: me._id.toString(),
        moduleKey
      });
    }

    // Normalize actions to ensure booleans for all flags
    const actions = permissions.actions || {};
    const toBool = (value) => {
      if (value === true || value === false) return value;
      if (typeof value === "string") {
        const lowered = value.toLowerCase();
        return lowered === "true" || lowered === "1" || lowered === "yes";
      }
      return Boolean(value);
    };

    const normalizedActions = {
      all: toBool(actions.all),
      create: toBool(actions.create),
      read: toBool(actions.read),
      update: toBool(actions.update),
      delete: toBool(actions.delete),
      import: toBool(actions.import),
      export: toBool(actions.export),
    };

    console.log('[API DEBUG] Normalized actions:', JSON.stringify(normalizedActions, null, 2));
    console.log('[API DEBUG] ========== /api/agent/get-module-permissions END (SUCCESS) ==========\n');

    return res.status(200).json({
      success: true,
      permissions: {
        module: permissions.module,
        actions: normalizedActions,
        subModules: permissions.subModules || []
      },
      error: null,
      agentId: me._id.toString(),
      moduleKey
    });

  } catch (error) {
    console.error('[API DEBUG] ERROR in /api/agent/get-module-permissions:', error);
    console.log('[API DEBUG] ========== /api/agent/get-module-permissions END (ERROR) ==========\n');
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error', 
      error: error.message 
    });
  }
}


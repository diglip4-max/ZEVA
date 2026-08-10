// pages/api/agent/permissions.js
import dbConnect from "../../../lib/database";
import AgentPermission from "../../../models/AgentPermission";
import User from "../../../models/Users";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  const me = await getUserFromReq(req);
  if (!me) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
  }

  // Allow admin, clinic, doctor, staff, doctorStaff, and agent roles
  if (!requireRole(me, ['admin', 'clinic', 'doctor', 'staff', 'doctorStaff', 'agent'])) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  if (req.method === 'GET') {
    try {
      const { agentId } = req.query;
      
      console.log('\n========== [API DEBUG] /api/agent/permissions (GET) ==========');
      console.log('[API DEBUG] Requesting agentId:', agentId);
      
      if (!agentId) {
        return res.status(400).json({ success: false, message: 'Agent ID is required' });
      }

      // Verify agent exists and user has permission to view it
      const agent = await User.findById(agentId);
      if (!agent || !['agent', 'doctorStaff'].includes(agent.role)) {
        console.log('[API DEBUG] ERROR: Agent not found');
        return res.status(404).json({ success: false, message: 'Agent not found' });
      }

      console.log('[API DEBUG] Agent found:', {
        agentId: agent._id.toString(),
        role: agent.role,
        name: agent.name
      });

      // Check if user has permission to view this agent's permissions
      if (me.role === 'admin') {
        // Admin can only view agents they created
        if (agent.createdBy?.toString() !== me._id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else if (me.role === 'clinic') {
        // Clinic can view agents from their clinic or agents they created
        const Clinic = (await import("../../../models/Clinic")).default;
        const clinic = await Clinic.findOne({ owner: me._id });
        if (clinic) {
          if (agent.clinicId?.toString() !== clinic._id.toString() && 
              agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        } else {
          if (agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        }
      } else if (me.role === 'doctor') {
        // Doctor can view agents from their clinic or agents they created
        if (me.clinicId) {
          if (agent.clinicId?.toString() !== me.clinicId.toString() && 
              agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        } else {
          if (agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        }
      } else if (me.role === 'staff' || me.role === 'doctorStaff') {
        // Staff and doctorStaff can view agents from their clinic or agents they created
        if (me.clinicId) {
          if (agent.clinicId?.toString() !== me.clinicId.toString() && 
              agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        } else {
          if (agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        }
      } else if (me.role === 'agent') {
        // Agents can view only their own permissions
        if (agent._id.toString() !== me._id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      // Get agent permissions
      const permissions = await AgentPermission.findOne({ agentId }).populate('grantedBy', 'name email');
      
      console.log('[API DEBUG] Permissions found:', !!permissions);
      if (permissions) {
        console.log('[API DEBUG] Permissions data:');
        console.log('[DEBUG]   - Total modules:', permissions.permissions?.length || 0);
        permissions.permissions?.forEach((perm, index) => {
          console.log(`[DEBUG]   [${index}] module: "${perm.module}"`);
          console.log(`[DEBUG]       actions:`, JSON.stringify(perm.actions, null, 2));
        });

        // Normalize customActions (Mongoose Map → plain object) for JSON serialization
        const normalizedPermissions = permissions.permissions.map((perm) => {
          const moduleCustomActions = {};
          const rawModuleCustom = perm.customActions || {};
          if (rawModuleCustom instanceof Map) {
            rawModuleCustom.forEach((value, key) => {
              moduleCustomActions[key] = Boolean(value);
            });
          } else if (typeof rawModuleCustom === 'object') {
            Object.entries(rawModuleCustom).forEach(([key, value]) => {
              moduleCustomActions[key] = Boolean(value);
            });
          }

          const normalizedSubModules = (perm.subModules || []).map((sub) => {
            const subCustomActions = {};
            const rawSubCustom = sub.customActions || {};
            if (rawSubCustom instanceof Map) {
              rawSubCustom.forEach((value, key) => {
                subCustomActions[key] = Boolean(value);
              });
            } else if (typeof rawSubCustom === 'object') {
              Object.entries(rawSubCustom).forEach(([key, value]) => {
                subCustomActions[key] = Boolean(value);
              });
            }
            return {
              ...sub.toObject ? sub.toObject() : sub,
              customActions: subCustomActions,
            };
          });

          return {
            ...(perm.toObject ? perm.toObject() : perm),
            customActions: moduleCustomActions,
            subModules: normalizedSubModules,
          };
        });

        // Attach normalized permissions to response
        permissions.permissions = normalizedPermissions;
      }
      
      console.log('[API DEBUG] ========== /api/agent/permissions (GET) END ==========\n');
      
      return res.status(200).json({ 
        success: true, 
        data: permissions || null 
      });
    } catch (error) {
      console.error('[API DEBUG] ERROR in /api/agent/permissions (GET):', error);
      console.log('[API DEBUG] ========== /api/agent/permissions (GET) END (ERROR) ==========\n');
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { agentId, permissions } = req.body;

      console.log('\n========== [API DEBUG] /api/agent/permissions (POST) ==========');
      console.log('[API DEBUG] agentId:', agentId);
      console.log('[API DEBUG] permissions count:', permissions?.length || 0);
      
      if (!agentId) {
        return res.status(400).json({ success: false, message: 'Agent ID is required' });
      }

      if (!permissions || !Array.isArray(permissions)) {
        return res.status(400).json({ success: false, message: 'Permissions array is required' });
      }

      // Log the permissions being saved
      console.log('[API DEBUG] Permissions to save:');
      permissions.forEach((perm, index) => {
        console.log(`[DEBUG]   [${index}] module: "${perm.module}"`);
        console.log(`[DEBUG]       actions:`, JSON.stringify(perm.actions, null, 2));
        if (perm.subModules?.length > 0) {
          console.log(`[DEBUG]       subModules: ${perm.subModules.length}`);
          perm.subModules.forEach((sm, smIndex) => {
            console.log(`[DEBUG]         [${smIndex}] name: "${sm.name}", moduleKey: "${sm.moduleKey || 'N/A'}"`);
            console.log(`[DEBUG]             actions:`, JSON.stringify(sm.actions, null, 2));
          });
        }
      });

      // Verify agent exists and user has permission to modify it
      const agent = await User.findById(agentId);
      if (!agent || !['agent', 'doctorStaff'].includes(agent.role)) {
        console.log('[API DEBUG] ERROR: Agent not found');
        return res.status(404).json({ success: false, message: 'Agent not found' });
      }

      console.log('[API DEBUG] Agent found:', {
        agentId: agent._id.toString(),
        role: agent.role,
        name: agent.name
      });

      // Check if user has permission to modify this agent's permissions
      if (me.role === 'admin') {
        // Admin can only modify agents they created
        if (agent.createdBy?.toString() !== me._id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      } else if (me.role === 'clinic') {
        // Clinic can modify agents from their clinic or agents they created
        const Clinic = (await import("../../../models/Clinic")).default;
        const clinic = await Clinic.findOne({ owner: me._id });
        if (clinic) {
          if (agent.clinicId?.toString() !== clinic._id.toString() && 
              agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        } else {
          if (agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        }
      } else if (me.role === 'doctor') {
        // Doctor can modify agents from their clinic or agents they created
        if (me.clinicId) {
          if (agent.clinicId?.toString() !== me.clinicId.toString() && 
              agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        } else {
          if (agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        }
      } else if (me.role === 'staff' || me.role === 'doctorStaff') {
        // Staff and doctorStaff can modify agents from their clinic or agents they created
        if (me.clinicId) {
          if (agent.clinicId?.toString() !== me.clinicId.toString() && 
              agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        } else {
          if (agent.createdBy?.toString() !== me._id.toString()) {
            return res.status(403).json({ success: false, message: 'Access denied' });
          }
        }
      } else if (me.role === 'agent') {
        // Agents cannot modify other agents; allow only self-update
        if (agent._id.toString() !== me._id.toString()) {
          return res.status(403).json({ success: false, message: 'Access denied' });
        }
      }

      // Validate permissions structure
      for (const perm of permissions) {
        if (!perm.module) {
          return res.status(400).json({ success: false, message: 'Each permission must have a module' });
        }
        if (!perm.actions || typeof perm.actions !== 'object') {
          return res.status(400).json({ success: false, message: 'Each permission must have actions object' });
        }
        if (perm.subModules && !Array.isArray(perm.subModules)) {
          return res.status(400).json({ success: false, message: 'subModules must be an array' });
        }
      }

      console.log('[API DEBUG] Validation passed, saving to database...');

      // Use findOne + save() instead of findOneAndUpdate to properly
      // handle Mongoose Map fields (customActions).
      let agentPermission = await AgentPermission.findOne({ agentId });

      if (!agentPermission) {
        agentPermission = new AgentPermission({
          agentId,
          grantedBy: me._id,
          isActive: true,
        });
      }

      // Step 1: Assign permissions WITHOUT customActions first.
      // This lets Mongoose create proper subdocuments with their own Map instances.
      agentPermission.permissions = permissions.map((p) => ({
        module: p.module,
        actions: {
          all: Boolean(p.actions?.all),
          create: Boolean(p.actions?.create),
          read: Boolean(p.actions?.read),
          update: Boolean(p.actions?.update),
          delete: Boolean(p.actions?.delete),
          import: Boolean(p.actions?.import),
          export: Boolean(p.actions?.export),
        },
        subModules: (p.subModules || []).map((sub) => ({
          name: sub.name,
          path: sub.path || '',
          icon: sub.icon || '',
          order: sub.order || 0,
          moduleKey: sub.moduleKey || '',
          actions: {
            all: Boolean(sub.actions?.all),
            create: Boolean(sub.actions?.create),
            read: Boolean(sub.actions?.read),
            update: Boolean(sub.actions?.update),
            delete: Boolean(sub.actions?.delete),
            import: Boolean(sub.actions?.import),
            export: Boolean(sub.actions?.export),
          },
        })),
      }));

      // Step 2: Now set customActions on the ACTUAL Mongoose subdocuments
      // using .set() on their real Map instances. This is critical because
      // assigning plain objects with Map instances doesn't persist correctly —
      // Mongoose replaces them with schema defaults during casting.
      permissions.forEach((p, i) => {
        const subDoc = agentPermission.permissions[i];
        if (!subDoc) return;

        // Ensure the Map is initialized (Mongoose may not create it from schema default)
        if (!(subDoc.customActions instanceof Map)) {
          subDoc.customActions = new Map();
        }

        // Module-level customActions
        const moduleCustomActions = p.customActions || {};
        for (const [key, val] of Object.entries(moduleCustomActions)) {
          subDoc.customActions.set(key, Boolean(val));
        }

        // Submodule-level customActions
        (p.subModules || []).forEach((sub, j) => {
          const subSubDoc = subDoc.subModules?.[j];
          if (!subSubDoc) return;
          if (!(subSubDoc.customActions instanceof Map)) {
            subSubDoc.customActions = new Map();
          }
          const subCustomActions = sub.customActions || {};
          for (const [key, val] of Object.entries(subCustomActions)) {
            subSubDoc.customActions.set(key, Boolean(val));
          }
        });
      });

      agentPermission.grantedBy = me._id;
      agentPermission.lastModified = new Date();
      agentPermission.isActive = true;

      await agentPermission.save();

      console.log('[API DEBUG] Save successful!');
      console.log('[API DEBUG]   - Created/Updated ID:', agentPermission._id.toString());
      console.log('[API DEBUG]   - Total permissions:', agentPermission.permissions?.length || 0);
      // Verify customActions were persisted
      agentPermission.permissions?.forEach((perm, idx) => {
        const ca = perm.customActions;
        const caObj = {};
        if (ca instanceof Map) {
          ca.forEach((v, k) => { caObj[k] = v; });
        }
        if (Object.keys(caObj).length > 0) {
          console.log(`[API DEBUG]   [${idx}] module="${perm.module}" customActions=`, JSON.stringify(caObj));
        }
      });
      console.log('[API DEBUG] ========== /api/agent/permissions (POST) END ==========\n');

      return res.status(200).json({ 
        success: true, 
        message: 'Agent permissions updated successfully',
        data: agentPermission 
      });
    } catch (error) {
      console.error('[API DEBUG] ERROR in /api/agent/permissions (POST):', error);
      console.log('[API DEBUG] ========== /api/agent/permissions (POST) END (ERROR) ==========\n');
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}



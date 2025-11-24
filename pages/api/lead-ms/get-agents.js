// /pages/api/get-agents
import dbConnect from '../../../lib/database';
import User from '../../../models/Users';
import Clinic from '../../../models/Clinic';   // ✅ import Clinic
import bcrypt from 'bcryptjs';
import { getUserFromReq, requireRole } from './auth';
import { checkClinicPermission } from './permissions-helper';
import { checkAgentPermission } from '../agent/permissions-helper';

export default async function handler(req, res) {
  await dbConnect();

  const me = await getUserFromReq(req);
  if (!me) {
    return res.status(401).json({ success: false, message: 'Unauthorized: Missing or invalid token' });
  }

  // Allow admin, clinic, doctor, agent, and doctorStaff roles
  if (!requireRole(me, ['admin', 'clinic', 'doctor', 'agent', 'doctorStaff'])) {
    return res.status(403).json({ success: false, message: 'Access denied' });
  }

  // ---------------- GET Agents/DoctorStaff ----------------
  if (req.method === 'GET') {
    // ✅ Check permissions for reading agents (admin bypasses all checks)
    if (me.role !== 'admin') {
      // For clinic role: Check clinic permissions
      if (me.role === 'clinic') {
        const clinic = await Clinic.findOne({ owner: me._id });
        if (clinic) {
          const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
            clinic._id,
            "create_agent",
            "read"
          );
          if (!clinicHasPermission) {
            return res.status(403).json({
              success: false,
              message: clinicError || "You do not have permission to view agents"
            });
          }
        }
      }
      // For agent/doctorStaff role: Check agent permissions
      else if (me.role === 'agent' || me.role === 'doctorStaff') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          me._id,
          "create_agent",
          "read"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to view agents"
          });
        }
      }
    }
    try {
      // Get role filter from query parameter (optional: 'agent', 'doctorStaff', or undefined for both)
      const roleFilter = req.query.role;
      
      // Build role query
      let roleQuery;
      if (roleFilter === 'agent') {
        roleQuery = { role: 'agent' };
      } else if (roleFilter === 'doctorStaff') {
        roleQuery = { role: 'doctorStaff' };
      } else {
        // If no role specified, default to agent (for backward compatibility)
        roleQuery = { role: 'agent' };
      }

      let query = {};

      // Filter based on who is requesting - STRICT: only show records created by the current user
      if (me.role === 'admin') {
        // Admin sees ONLY agents/doctorStaff they created
        query = { ...roleQuery, createdBy: me._id };
      } else if (me.role === 'clinic') {
        // Clinic sees agents from their clinic OR agents they created
        // For doctorStaff, they can ONLY see ones they created (strict filtering by createdBy)
        const clinic = await Clinic.findOne({ owner: me._id });
        
        // Debug: Log clinic lookup
        console.log('Clinic lookup:', {
          clinicFound: !!clinic,
          clinicId: clinic?._id?.toString(),
          ownerId: me._id.toString()
        });
        
        if (roleFilter === 'agent') {
          // Only agents - clinic sees agents from their clinic OR agents they created
          if (clinic) {
            query = {
              role: 'agent',
              $or: [
                { clinicId: clinic._id },
                { createdBy: me._id }
              ]
            };
            console.log('Clinic agent query - clinicId:', clinic._id.toString(), 'createdBy:', me._id.toString());
          } else {
            query = { role: 'agent', createdBy: me._id };
            console.log('Clinic agent query (no clinic found) - createdBy:', me._id.toString());
          }
        } else if (roleFilter === 'doctorStaff') {
          // Only doctorStaff - STRICT: clinic can ONLY see ones they created
          query = { role: 'doctorStaff', createdBy: me._id };
        } else {
          // Default to agent if no role filter
          if (clinic) {
            query = {
              role: 'agent',
              $or: [
                { clinicId: clinic._id },
                { createdBy: me._id }
              ]
            };
          } else {
            query = { role: 'agent', createdBy: me._id };
          }
        }
      } else if (me.role === 'doctor') {
        // Doctor sees agents from their clinic (if they have one) OR agents they created
        // For doctorStaff, they can ONLY see ones they created (strict filtering by createdBy)
        if (roleFilter === 'agent') {
          // Only agents
          if (me.clinicId) {
            query = {
              role: 'agent',
              $or: [
                { clinicId: me.clinicId },
                { createdBy: me._id }
              ]
            };
          } else {
            query = { role: 'agent', createdBy: me._id };
          }
        } else if (roleFilter === 'doctorStaff') {
          // Only doctorStaff - STRICT: doctor can ONLY see ones they created
          query = { role: 'doctorStaff', createdBy: me._id };
        } else {
          // Default to agent if no role filter
          if (me.clinicId) {
            query = {
              role: 'agent',
              $or: [
                { clinicId: me.clinicId },
                { createdBy: me._id }
              ]
            };
          } else {
            query = { role: 'agent', createdBy: me._id };
          }
        }
      } else if (me.role === 'agent') {
        // Agent sees only agents from their clinic (not doctorStaff)
        if (me.clinicId) {
          query = { clinicId: me.clinicId, role: 'agent' };
        } else {
          // If agent has no clinicId, return empty
          return res.status(200).json({ success: true, agents: [] });
        }
      } else if (me.role === 'doctorStaff') {
        // Doctor staff should mirror doctor visibility but scoped to their clinic/creations
        if (roleFilter === 'doctorStaff') {
          if (me.clinicId) {
            query = {
              role: 'doctorStaff',
              $or: [
                { clinicId: me.clinicId },
                { createdBy: me._id }
              ]
            };
          } else {
            query = { role: 'doctorStaff', createdBy: me._id };
          }
        } else {
          // Default/agent view: restrict to their clinic or creations
          if (me.clinicId) {
            query = {
              role: 'agent',
              clinicId: me.clinicId
            };
          } else {
            query = { role: 'agent', createdBy: me._id };
          }
        }
      }

      // Debug: Log the query and user info
      console.log('GET Agents Query:', JSON.stringify(query, null, 2));
      console.log('Current User:', { role: me.role, _id: me._id.toString() });

      const users = await User.find(query).select('_id name email phone isApproved declined clinicId createdBy role');

      // Debug: Log results
      console.log('Found users:', users.length);
      if (users.length > 0) {
        console.log('Sample user:', {
          name: users[0].name,
          role: users[0].role,
          clinicId: users[0].clinicId?.toString(),
          createdBy: users[0].createdBy?.toString()
        });
      }

      return res.status(200).json({ success: true, agents: users });
    } catch (err) {
      console.error('Error fetching users:', err);
      return res.status(500).json({ success: false, message: 'Failed to fetch users', error: err.message });
    }
  }

  // ---------------- PATCH Approve/Decline/Reset Password ----------------
  if (req.method === 'PATCH') {
    const { agentId, action, newPassword } = req.body;

    if (!agentId || typeof agentId !== 'string') {
      return res.status(400).json({ success: false, message: 'agentId is required and must be a string' });
    }
    if (!action || !['approve', 'decline', 'resetPassword'].includes(action)) {
      return res.status(400).json({ success: false, message: 'action must be either "approve", "decline" or "resetPassword"' });
    }

    // ✅ Check permissions for updating agents (admin bypasses all checks)
    if (me.role !== 'admin') {
      let requiredAction = 'update';
      if (action === 'approve' || action === 'decline') {
        requiredAction = 'approve';
      } else if (action === 'resetPassword') {
        requiredAction = 'update';
      }

      // For clinic role: Check clinic permissions
      if (me.role === 'clinic') {
        const clinic = await Clinic.findOne({ owner: me._id });
        if (clinic) {
          const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
            clinic._id,
            "create_agent",
            requiredAction
          );
          if (!clinicHasPermission) {
            return res.status(403).json({
              success: false,
              message: clinicError || `You do not have permission to ${requiredAction} agents`
            });
          }
        }
      }
      // For agent/doctorStaff role: Check agent permissions
      else if (me.role === 'agent' || me.role === 'doctorStaff') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          me._id,
          "create_agent",
          requiredAction
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || `You do not have permission to ${requiredAction} agents`
          });
        }
      }
    }

    // Build query to find agent or doctorStaff based on who is requesting
    // STRICT: Only allow modification of records created by the current user (or agents from clinic)
    let agentQuery = { _id: agentId, role: { $in: ['agent', 'doctorStaff'] } };

    if (me.role === 'admin') {
      // Admin can only modify agents/doctorStaff they created
      agentQuery.createdBy = me._id;
    } else if (me.role === 'clinic') {
      // Clinic can modify agents from their clinic OR agents they created
      // For doctorStaff, they can ONLY modify ones they created
      const clinic = await Clinic.findOne({ owner: me._id });
      if (clinic) {
        agentQuery.$or = [
          { role: 'agent', clinicId: clinic._id },
          { createdBy: me._id }
        ];
      } else {
        agentQuery.createdBy = me._id;
      }
    } else if (me.role === 'doctor') {
      // Doctor can modify agents from their clinic OR agents they created
      // For doctorStaff, they can ONLY modify ones they created
      if (me.clinicId) {
        agentQuery.$or = [
          { role: 'agent', clinicId: me.clinicId },
          { createdBy: me._id }
        ];
      } else {
        agentQuery.createdBy = me._id;
      }
    } else if (me.role === 'agent') {
      // Agent can only modify agents from their clinic (not doctorStaff)
      if (me.clinicId) {
        agentQuery.clinicId = me.clinicId;
        agentQuery.role = 'agent'; // Agents can't modify doctorStaff
      } else {
        return res.status(403).json({ success: false, message: 'Agent has no clinic assigned' });
      }
    }

    const agent = await User.findOne(agentQuery);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'User not found or you do not have permission to modify this user' });
    }

    if (action === 'approve') {
      agent.isApproved = true;
      agent.declined = false;
    } else if (action === 'decline') {
      agent.isApproved = false;
      agent.declined = true;
    } else if (action === 'resetPassword') {
      if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Valid newPassword (min 6 chars) is required' });
      }
      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      agent.password = hashedPassword;
    }

    try {
      await agent.save();
      return res.status(200).json({ success: true, agent });
    } catch (err) {
      return res.status(500).json({ success: false, message: 'Failed to update agent status', error: err.message });
    }
  }

  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed. Only GET and PATCH are supported.`,
  });
}

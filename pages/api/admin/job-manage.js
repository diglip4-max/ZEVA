// pages/api/admin/jobs/manage.ts
import dbConnect from '../../../lib/database';
import JobPosting from '../../../models/JobPosting';
import { getUserFromReq } from '../lead-ms/auth';
import { checkAgentPermission } from '../agent/permissions-helper';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get the logged-in user
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
    }
    
    // Check permissions for agents - admins bypass all checks
    if (me.role === 'agent' || me.role === 'doctorStaff') {
      const { hasPermission } = await checkAgentPermission(me._id, "admin_manage_job", "read");
      if (!hasPermission) {
        return res.status(403).json({ 
          message: "Permission denied: You do not have read permission for manage job module" 
        });
      }
    } else if (me.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin or agent role required' });
    }

    // Fetch jobs grouped by status
    const pendingJobs = await JobPosting.find({ status: 'pending' }).populate('postedBy', 'name email role');
    const approvedJobs = await JobPosting.find({ status: 'approved' }).populate('postedBy', 'name email role');
    const declinedJobs = await JobPosting.find({ status: 'declined' }).populate('postedBy', 'name email role');

    res.status(200).json({
      success: true,
      pending: pendingJobs,
      approved: approvedJobs,
      declined: declinedJobs,
    });
  } catch (error) {
    res.status(401).json({ message: 'Invalid token', error: error.message });
  }
}

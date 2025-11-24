import dbConnect from '../../../lib/database';
import JobPosting from '../../../models/JobPosting';
import JobApplication from '../../../models/JobApplication';
import Notification from '../../../models/Notification';
import { getUserFromReq } from '../lead-ms/auth';
import { checkAgentPermission } from '../agent/permissions-helper';

export default async function handler(req, res) {
  await dbConnect();

  try {
    // Get the logged-in user
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ message: 'Unauthorized: Missing or invalid token' });
    }
    
    // Check permissions for agents - admins bypass all checks
    if (me.role === 'agent' || me.role === 'doctorStaff') {
      // Approve / Decline
      if (req.method === 'PATCH') {
        const { hasPermission } = await checkAgentPermission(me._id, "admin_manage_job", "approve");
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Permission denied: You do not have approve permission for manage job module" 
          });
        }
      }
      
      // Delete
      if (req.method === 'DELETE') {
        const { hasPermission } = await checkAgentPermission(me._id, "admin_manage_job", "delete");
        if (!hasPermission) {
          return res.status(403).json({ 
            message: "Permission denied: You do not have delete permission for manage job module" 
          });
        }
      }
    } else if (me.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin or agent role required' });
    }

    // Approve / Decline
    if (req.method === 'PATCH') {
      const { jobId, status } = req.body;
      if (!['approved', 'declined'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status' });
      }

      const job = await JobPosting.findByIdAndUpdate(jobId, { status }, { new: true });
      if (!job) return res.status(404).json({ message: 'Job not found' });

      return res.status(200).json({ success: true, job });
    }

    // Delete job + related data
    if (req.method === 'DELETE') {
      const { jobId } = req.query; // jobId will come in query params
      if (!jobId) return res.status(400).json({ message: 'Job ID is required' });

      const job = await JobPosting.findById(jobId);
      if (!job) return res.status(404).json({ message: 'Job not found' });

      // Delete related applications
      await JobApplication.deleteMany({ jobId: job._id });

      // Delete related notifications
      await Notification.deleteMany({ relatedJob: job._id });

      // Finally delete job itself
      await job.deleteOne();

      return res.status(200).json({ success: true, message: 'Job and related data deleted successfully' });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token', error: error.message });
  }
}

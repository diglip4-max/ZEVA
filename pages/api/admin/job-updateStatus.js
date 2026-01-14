import dbConnect from '../../../lib/database';
import JobPosting from '../../../models/JobPosting';
import JobApplication from '../../../models/JobApplication';
import Notification from '../../../models/Notification';
import { getUserFromReq } from '../lead-ms/auth';
import { checkAgentPermission } from '../agent/permissions-helper';
import { generateAndLockSlug } from '../../../lib/slugService';
import { runSEOPipeline } from '../../../lib/seo/SEOOrchestrator';

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

      // Step 1: Update job status
      const job = await JobPosting.findByIdAndUpdate(jobId, { status }, { new: true });
      if (!job) return res.status(404).json({ message: 'Job not found' });

      // Step 2: Generate and lock slug for approved jobs
      if (status === 'approved' && !job.slugLocked) {
        try {
          console.log(`🔄 Generating slug for job: ${job.jobTitle} (ID: ${jobId})`);
          
          // Use central slug service to generate and lock slug
          const updatedJob = await generateAndLockSlug('job', jobId.toString());
          
          if (updatedJob.slug && updatedJob.slugLocked) {
            console.log(`✅ Slug generated successfully: ${updatedJob.slug}`);
            
            // Step 3: Run SEO pipeline after slug generation
            try {
              console.log(`🚀 Running SEO pipeline for job: ${jobId}`);
              const seoResult = await runSEOPipeline('job', jobId.toString(), updatedJob);
              if (seoResult.success) {
                console.log(`✅ SEO pipeline completed successfully`);
              } else {
                console.warn(`⚠️ SEO pipeline completed with warnings:`, seoResult.errors);
              }
            } catch (seoError) {
              // SEO errors are non-fatal - log but continue
              console.error("❌ SEO pipeline error (non-fatal):", seoError.message);
            }
          } else {
            console.log(`⚠️ Slug generation completed but slugLocked is false`);
          }
        } catch (slugError) {
          // If slug generation fails but job is approved, continue with approval
          console.error("❌ Slug generation error (non-fatal):", slugError.message);
          console.error("Error stack:", slugError.stack);
          // Continue with approval even if slug generation fails
        }
      } else if (status === 'approved' && job.slugLocked) {
        console.log(`⏭️ Skipping slug generation - slug already locked: ${job.slug}`);
      }

      // Refresh job data to get updated slug
      const finalJob = await JobPosting.findById(jobId);

      return res.status(200).json({ success: true, job: finalJob });
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

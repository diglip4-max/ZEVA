// pages/api/job-postings/toggle.js
import dbConnect from '../../../lib/database';
import JobPosting from '../../../models/JobPosting';
import Clinic from '../../../models/Clinic';
import { getUserFromReq, requireRole } from '../lead-ms/auth';

export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader("Allow", ["PATCH"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { jobId, isActive } = req.body;
    if (!jobId) {
      return res.status(400).json({ success: false, message: "Job ID is required" });
    }

    // ✅ First, get the job to determine which clinic it belongs to
    const job = await JobPosting.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // ✅ Verify job ownership
    if (job.postedBy.toString() !== me._id.toString() && me.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not allowed to access this job" });
    }

    // ✅ Resolve clinicId
    let clinicId;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    }

    // ✅ Check permission for updating jobs (only for clinic, admin bypasses)
    if (me.role !== "admin" && clinicId) {
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "jobs",
        "update",
        "See All Jobs" // Check "See All Jobs" submodule permission for update
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to update jobs"
        });
      }
    }

    job.isActive = isActive;
    await job.save();

    return res.status(200).json({ success: true, job });
  } catch (error) {
    console.error("Error toggling job:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

import dbConnect from "../../../lib/database";
import JobPosting from "../../../models/JobPosting";
import JobApplication from "../../../models/JobApplication";
import Notification from "../../../models/Notification";
import Clinic from "../../../models/Clinic";
import mongoose from "mongoose";
import { getUserFromReq, requireRole } from '../lead-ms/auth';

export default async function handler(req, res) {
  if (req.method !== "DELETE") {
    res.setHeader("Allow", ["DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { jobId } = req.query;
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

    // ✅ Check permission for deleting jobs (only for clinic, admin bypasses)
    if (me.role !== "admin" && clinicId) {
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "jobs",
        "delete",
        "See All Jobs" // Check "See All Jobs" submodule permission for delete
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to delete jobs"
        });
      }
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Find and verify job ownership again within transaction
      const jobToDelete = await JobPosting.findOne({ _id: jobId, postedBy: me._id }).session(session);
      if (!jobToDelete) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ success: false, message: "Job not found or not authorized" });
      }

    // Get all job applications for this job
    const jobApplications = await JobApplication.find({ jobId }).session(session);
    const jobApplicationIds = jobApplications.map(app => app._id);

    console.log("📌 Found applications:", jobApplications.length);
    console.log("📌 Application IDs:", jobApplicationIds);

    // Delete ONLY notifications linked to these applications
    const notificationResult = await Notification.deleteMany({
      relatedJobApplication: { $in: jobApplicationIds }
    }).session(session);

    console.log("🗑 Notifications deleted:", notificationResult.deletedCount);

    // Delete job applications
    const applicationResult = await JobApplication.deleteMany({ jobId }).session(session);
    console.log("🗑 Applications deleted:", applicationResult.deletedCount);

    // Delete job posting
    const jobResult = await JobPosting.deleteOne({ _id: jobId }).session(session);
    console.log("🗑 Job deleted:", jobResult.deletedCount);

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        success: true,
        message: "Job, applications, and related notifications deleted successfully",
        deletedCounts: {
          notifications: notificationResult.deletedCount,
          applications: applicationResult.deletedCount,
          jobs: jobResult.deletedCount
        }
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error("❌ Delete error:", error);

      if (error.code === 112) {
        return res.status(500).json({ success: false, message: "Write conflict. Please try again." });
      }

      return res.status(500).json({ success: false, message: "Server error" });
    }
  } catch (error) {
    console.error("Error in delete job API:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

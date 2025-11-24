// pages/api/job-postings/delete-application/[id].js
import dbConnect from "../../../../lib/database";
import JobApplication from "../../../../models/JobApplication";
import JobPosting from "../../../../models/JobPosting";
import Notification from "../../../../models/Notification";
import Clinic from "../../../../models/Clinic";
import { getUserFromReq, requireRole } from '../../lead-ms/auth';

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

    const { id } = req.query; // applicationId
    if (!id) {
      return res.status(400).json({ success: false, message: "Application ID is required" });
    }

    // ✅ First, get the application to find the job
    const application = await JobApplication.findById(id).populate("jobId");
    if (!application) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    // ✅ Verify the job belongs to this user
    const job = await JobPosting.findById(application.jobId._id || application.jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (job.postedBy.toString() !== me._id.toString() && me.role !== "admin") {
      return res.status(403).json({ success: false, message: "Not allowed to access this application" });
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

    // ✅ Check permission for deleting applications (only for clinic, admin bypasses)
    if (me.role !== "admin" && clinicId) {
      const { checkClinicPermission } = await import("../../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "jobs",
        "delete",
        "See Job Applicants" // Check "See Job Applicants" submodule permission for delete
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to delete applications"
        });
      }
    }

    try {
      // 1️⃣ Delete related notifications
      await Notification.deleteMany({ relatedJobApplication: id });

      // 2️⃣ Delete application
      await JobApplication.deleteOne({ _id: id });

      return res.status(200).json({ success: true, message: "Application deleted successfully" });
    } catch (error) {
      console.error("Delete application error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  } catch (error) {
    console.error("Error in delete-application API:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

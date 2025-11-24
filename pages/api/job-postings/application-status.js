import dbConnect from "../../../lib/database";
import JobApplication from "../../../models/JobApplication";
import JobPosting from "../../../models/JobPosting";
import Clinic from "../../../models/Clinic";
import { emitNotificationToUser } from "../push-notification/socketio";
import Notification from "../../../models/Notification";
import { getUserFromReq, requireRole } from '../lead-ms/auth';

export default async function handler(req, res) {
  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { applicationId, status } = req.body;
    if (!applicationId || !status) {
      return res.status(400).json({ success: false, message: "Application ID and status are required" });
    }

    // ✅ First, get the application to find the job
    const application = await JobApplication.findById(applicationId).populate("jobId");
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

    // ✅ Check permission for updating application status (only for clinic, admin bypasses)
    if (me.role !== "admin" && clinicId) {
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "jobs",
        "update",
        "See Job Applicants" // Check "See Job Applicants" submodule permission for update
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to update application status"
        });
      }
    }

    try {
    const updatedApplication = await JobApplication.findByIdAndUpdate(
      applicationId,
      { status },
      { new: true }
    )
      .populate("applicantId")
      .populate("jobId");

    if (!updatedApplication) {
      return res.status(404).json({ message: "Application not found" });
    }

    const applicantUserId = updatedApplication.applicantId._id;
    const jobTitle = updatedApplication.jobId?.jobTitle || "Job Posting";

    console.log("Populated JobId:", jobTitle );


    // ✅ Create notification in DB
    const notification = await Notification.create({
      user: applicantUserId,
      message: `Your application for "${jobTitle}" has been updated to "${status}"`,
      type: "job-status",
      relatedJobApplication: updatedApplication._id,
      relatedJob: updatedApplication.jobId._id,
    });

    // ✅ Emit socket events
    emitNotificationToUser(applicantUserId.toString(), {
      _id: notification._id,
      message: notification.message,
      createdAt: notification.createdAt,
      isRead: false,
    });

    emitNotificationToUser(applicantUserId.toString(), {
      type: "applicationStatusChanged",
      message: notification.message,
      applicationId: updatedApplication._id,
      newStatus: status,
    });

      // ✅ Return full response (not just message)
      return res.status(200).json({
        success: true,
        message: "Status updated & notification sent",
        application: updatedApplication,
        notification,
      });
    } catch (error) {
      console.error("Status update error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  } catch (error) {
    console.error("Error in application-status API:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// pages/api/job-postings/job-applications.js
import dbConnect from "../../../lib/database";
import JobApplication from "../../../models/JobApplication";
import JobPosting from "../../../models/JobPosting";
import { getUserFromReq, requireRole } from '../lead-ms/auth';
import { getClinicIdFromUser, checkClinicPermission } from "../lead-ms/permissions-helper";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "admin", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    // ✅ Check permission for reading job applications (only for clinic and doctor, admin bypasses)
    if (!isAdmin && clinicId) {
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        "jobs",
        "read",
        null, // subModuleName
        me.role === "doctor" ? "doctor" : me.role === "clinic" ? "clinic" : null
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permError || "You do not have permission to view job applicants"
        });
      }
    }

    // Get jobs posted by this user
    const jobQuery = {};
    if (!isAdmin) {
      const orConditions = [{ postedBy: me._id }];
      if (clinicId) {
        orConditions.push({ clinicId });
      }
      jobQuery.$or = orConditions;
    }
    const postedJobs = await JobPosting.find(jobQuery).select("_id");
    const jobIds = postedJobs.map((job) => job._id);

    // Fetch applications
    const applications = await JobApplication.find({ jobId: { $in: jobIds } })
      .populate("jobId", "jobTitle location jobType")
      .populate("applicantId", "name email phone role")
      .select("jobId applicantId resume status createdAt updatedAt");

    // Correct resume URL handling
    const formattedApps = applications.map((app) => {
      let resumeUrl = null;
      if (app.resume) {
        resumeUrl = app.resume.startsWith("http")
          ? app.resume
          : `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}${app.resume}`;
      }
      return {
        ...app.toObject(),
        resumeUrl,
      };
    });

    res.status(200).json({ success: true, applications: formattedApps });
  } catch (error) {
    console.error("Error fetching applications:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

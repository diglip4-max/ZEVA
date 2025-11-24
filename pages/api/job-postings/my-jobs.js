// pages/api/job-postings/my-jobs.js
import dbConnect from '../../../lib/database';
import JobPosting from '../../../models/JobPosting';
import { getUserFromReq, requireRole } from '../lead-ms/auth';
import { getClinicIdFromUser, checkClinicPermission } from '../lead-ms/permissions-helper';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
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

    // ✅ Check permission for reading jobs (only for clinic and doctor, admin bypasses)
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
          message: permError || "You do not have permission to view jobs"
        });
      }
    }

    let match = {};
    if (!isAdmin) {
      const orConditions = [{ postedBy: me._id }];
      if (clinicId) {
        orConditions.push({ clinicId });
      }
      match = { $or: orConditions };
    }

    const jobs = await JobPosting.find(match).sort({ createdAt: -1 });

    return res.status(200).json({ success: true, jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}
// pages/api/job-postings/create.js
import dbConnect from '../../../lib/database';
import JobPosting from '../../../models/JobPosting';
import Clinic from '../../../models/Clinic';
import { getUserFromReq, requireRole } from '../lead-ms/auth';
import { getClinicIdFromUser, checkClinicPermission } from '../lead-ms/permissions-helper';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  await dbConnect();

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
    let resolvedClinicId = clinicId;

    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    if (isAdmin && req.body.clinicId) {
      const clinic = await Clinic.findById(req.body.clinicId).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      resolvedClinicId = clinic._id;
    }

    if (!isAdmin && !resolvedClinicId) {
      return res.status(400).json({ success: false, message: "Clinic not found for this user" });
    }

    if (!isAdmin && resolvedClinicId) {
      // Check "job_posting" module permission (not submodule)
      const { hasPermission, error } = await checkClinicPermission(
        resolvedClinicId,
        "job_posting", // Check "job_posting" module permission
        "create",
        null, // No submodule - this is a module-level check
        me.role === "doctor" ? "doctor" : me.role === "clinic" ? "clinic" : null
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to create jobs"
        });
      }
    }

    const newJob = await JobPosting.create({
      ...req.body,
      postedBy: me._id,
      clinicId: resolvedClinicId || undefined,
      role: me.role,
      status: 'pending',
    });

    res.status(201).json({ success: true, job: newJob });
  } catch (error) {
    console.error("Error creating job:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
}

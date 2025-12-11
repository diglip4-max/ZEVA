// pages/api/job-postings/my-jobs.js
import dbConnect from '../../../lib/database';
import JobPosting from '../../../models/JobPosting';
import User from '../../../models/Users';
import Clinic from '../../../models/Clinic';
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
    if (!me || !requireRole(me, ["clinic", "admin", "doctor", "staff", "agent", "doctorStaff"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    // ✅ Check permission for reading jobs (only for clinic, doctor, staff, agent, doctorStaff, admin bypasses)
    if (!isAdmin && clinicId) {
      // Determine which role to check permissions for
      let roleForPermission = null;
      if (me.role === "doctor") {
        roleForPermission = "doctor";
      } else if (me.role === "clinic") {
        roleForPermission = "clinic";
      } else if (me.role === "staff" || me.role === "agent" || me.role === "doctorStaff") {
        // Staff, agent, and doctorStaff should check clinic-level permissions
        roleForPermission = "clinic";
      }

      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        "job_posting", // Check "job_posting" module permission
        "read",
        null, // No submodule - this is a module-level check
        roleForPermission
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
        // Add clinicId match
        orConditions.push({ clinicId });
        
        // Find all users from the same clinic (including clinic owner)
        // This handles cases where clinicId might not be set on the job
        const clinic = await Clinic.findById(clinicId).select('owner');
        const clinicUserIds = [];
        
        // Add clinic owner (who posted the jobs)
        if (clinic && clinic.owner) {
          clinicUserIds.push(clinic.owner);
        }
        
        // Add all users with this clinicId (agents, staff, doctors, etc.)
        const clinicUsers = await User.find({ 
          clinicId: clinicId 
        }).select('_id');
        
        clinicUsers.forEach(u => {
          if (!clinicUserIds.some(id => id.toString() === u._id.toString())) {
            clinicUserIds.push(u._id);
          }
        });
        
        if (clinicUserIds.length > 0) {
          orConditions.push({ postedBy: { $in: clinicUserIds } });
        }
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
import dbConnect from '../../../lib/database';
import Blog from '../../../models/Blog';
import User from '../../../models/Users';
import Clinic from '../../../models/Clinic';
import { getUserFromReq, requireRole } from '../lead-ms/auth';
import { getClinicIdFromUser, checkClinicPermission } from '../lead-ms/permissions-helper';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "doctor", "doctorStaff", "agent", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
    const isDoctor = me.role === "doctor";
    const isDoctorStaff = me.role === "doctorStaff";
    const isAgent = me.role === "agent";
    if (error && !isAdmin && !isDoctor && !isDoctorStaff && !isAgent) {
      return res.status(404).json({ success: false, message: error });
    }

    // ✅ Check permission for reading analytics (only for clinic roles, admin bypasses)
    if (!isAdmin && !isDoctor && clinicId) {
      const roleForPermission = isDoctorStaff ? "doctorStaff" : isAgent ? "agent" : me.role === "clinic" ? "clinic" : null;
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        "write_blog", // Check "write_blog" module permission
        "read",
        null, // Module-level check for analytics
        roleForPermission
      );
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permError || "You do not have permission to view blog analytics"
        });
      }
    }

    // Find all blogs - for agent/doctorStaff, find blogs from their clinic
    let blogQuery = { status: 'published' };

    if ((isAgent || isDoctorStaff) && clinicId) {
      // Find clinic owner and all users from this clinic
      const clinic = await Clinic.findById(clinicId).select("owner");
      if (clinic) {
        const clinicUsers = await User.find({
          $or: [
            { _id: clinic.owner }, // Clinic owner
            { clinicId: clinicId, role: "doctor" }, // Doctors from this clinic
          ],
        }).select("_id");
        const clinicUserIds = clinicUsers.map(u => u._id);
        
        // Include the current user (agent/doctorStaff) in the list so their own blogs show up
        clinicUserIds.push(me._id);
        
        blogQuery.postedBy = { $in: clinicUserIds };
      } else {
        // Fallback if clinic not found
        blogQuery.postedBy = me._id;
      }
    } else if (isAdmin) {
      // Admin can see all blogs - no filter needed
      blogQuery = { status: 'published' };
    } else {
      // For clinic/doctor, find blogs posted by this user
      blogQuery.postedBy = me._id;
    }

    const blogs = await Blog.find(blogQuery)
      .select('title likes comments createdAt')
      .lean();

    const response = blogs.map(blog => ({
      _id: blog._id,
      title: blog.title,
      likesCount: blog.likes?.length || 0,
      commentsCount: blog.comments?.length || 0,
      comments: blog.comments || [],
      createdAt: blog.createdAt,
    }));

    res.status(200).json({ success: true, blogs: response });
  } catch (error) {
    console.error('Error fetching author blogs:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

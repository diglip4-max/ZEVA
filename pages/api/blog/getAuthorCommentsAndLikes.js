import dbConnect from '../../../lib/database';
import Blog from '../../../models/Blog';
import Clinic from '../../../models/Clinic';
import { getUserFromReq, requireRole } from '../lead-ms/auth';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    }

    // ✅ Check permission for reading analytics (only for clinic, admin bypasses)
    if (me.role !== "admin" && clinicId) {
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "blogs",
        "read",
        "Analytics of blog" // Check "Analytics of blog" submodule permission
      );
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to view blog analytics"
        });
      }
    }

    // Find all blogs posted by this logged-in user
    const blogs = await Blog.find({ postedBy: me._id, status: 'published' })
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

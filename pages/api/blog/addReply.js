import dbConnect from '../../../lib/database';
import Blog from '../../../models/Blog';
import User from '../../../models/Users';
import Clinic from '../../../models/Clinic';
import { getUserFromReq, requireRole } from '../lead-ms/auth';
import { getClinicIdFromUser, checkClinicPermission } from '../lead-ms/permissions-helper';
import Notification from "../../../models/Notification";
import { emitNotificationToUser } from "../push-notification/socketio";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "doctor", "doctorStaff", "agent", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { blogId, commentId, text } = req.body;
    if (!blogId || !commentId || !text) {
      return res.status(400).json({ success: false, error: 'Blog ID, Comment ID & text are required' });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // ✅ Check if user owns the blog or is from the same clinic (for agent/doctorStaff)
    const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
    const isDoctor = me.role === "doctor";
    const isDoctorStaff = me.role === "doctorStaff";
    const isAgent = me.role === "agent";
    
    const isBlogAuthor = blog.postedBy.toString() === me._id.toString();
    
    // For agent/doctorStaff, check if blog is from their clinic
    let isClinicBlog = false;
    if ((isAgent || isDoctorStaff) && clinicId && !isBlogAuthor) {
      const clinic = await Clinic.findById(clinicId).select("owner");
      if (clinic) {
        const clinicUsers = await User.find({
          $or: [
            { _id: clinic.owner },
            { clinicId: clinicId, role: "doctor" },
          ],
        }).select("_id");
        const clinicUserIds = clinicUsers.map(u => u._id.toString());
        isClinicBlog = clinicUserIds.includes(blog.postedBy.toString());
      }
    }
    
    // Only blog author, clinic users (agent/doctorStaff) with permission, or admin can reply
    if (isBlogAuthor || isClinicBlog || isAdmin) {
      // Check permission for updating (replying to comments)
      if (!isAdmin && !isDoctor && clinicId) {
        const roleForPermission = isDoctorStaff ? "doctorStaff" : isAgent ? "agent" : me.role === "clinic" ? "clinic" : null;
        const { hasPermission, error: permError } = await checkClinicPermission(
          clinicId,
          "write_blog", // Check "write_blog" module permission
          "update",
          null, // Module-level check
          roleForPermission
        );
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: permError || "You do not have permission to reply to comments"
          });
        }
      }
    } else {
      // Not blog author or clinic user - deny access
      return res.status(403).json({
        success: false,
        message: "Only blog authors or clinic members can reply to comments on their clinic's blogs"
      });
    }

    const comment = blog.comments.id(commentId);
    if (!comment) {
      return res.status(404).json({ success: false, error: 'Comment not found' });
    }

    comment.replies.push({
      user: me._id,
      username: me.name,
      text,
      createdAt: new Date()
    });

    await blog.save();

    await Notification.create({
      user: comment.user,
      message: `You received a reply on your comment in "${blog.title}"`,
      relatedBlog: blog._id,
      type: "blog-reply", 
      relatedComment: comment._id,
    });

    emitNotificationToUser(comment.user.toString(), {
      message: `You received a reply on your comment in "${blog.title}"`,
      relatedBlog: blog._id,
      type: "blog-reply",
      relatedComment: comment._id,
      createdAt: new Date(),
    });

    res.status(200).json({ success: true, comment });
  } catch (error) {
    console.error("Error in addReply API:", error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

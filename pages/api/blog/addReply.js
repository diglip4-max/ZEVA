import dbConnect from '../../../lib/database';
import Blog from '../../../models/Blog';
import Clinic from '../../../models/Clinic';
import { getUserFromReq, requireRole } from '../lead-ms/auth';
import Notification from "../../../models/Notification";
import { emitNotificationToUser } from "../push-notification/socketio";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
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

    // ✅ Check if user owns the blog (only blog author can reply to comments on their blog)
    // For clinic users, also check permission
    if (blog.postedBy.toString() === me._id.toString()) {
      // Blog author - check permission for updating analytics (only for clinic, admin bypasses)
      if (me.role === "clinic") {
        const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
        if (clinic) {
          const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
          const { hasPermission, error } = await checkClinicPermission(
            clinic._id,
            "blogs",
            "update",
            "Analytics of blog" // Check "Analytics of blog" submodule permission for updating (replying)
          );
          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: error || "You do not have permission to reply to comments"
            });
          }
        }
      }
    } else {
      // Not blog author - only allow if user is admin or has permission
      if (me.role !== "admin") {
        return res.status(403).json({
          success: false,
          message: "Only blog authors can reply to comments on their blogs"
        });
      }
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

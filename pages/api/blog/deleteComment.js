import dbConnect from '../../../lib/database';
import Blog from '../../../models/Blog';
import Clinic from '../../../models/Clinic';
import { getUserFromReq, requireRole } from '../lead-ms/auth';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'DELETE') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { blogId, commentId } = req.body;

    if (!blogId || !commentId) {
      return res.status(400).json({ success: false, error: 'Blog ID & Comment ID are required' });
    }

    const blog = await Blog.findById(blogId);
    if (!blog) {
      return res.status(404).json({ success: false, error: 'Blog not found' });
    }

    // ✅ Check if user owns the blog (only blog author can delete comments on their blog)
    // For clinic users, also check permission
    const isBlogAuthor = blog.postedBy.toString() === me._id.toString();
    
    if (isBlogAuthor && me.role === "clinic") {
      // Blog author - check permission for deleting comments (only for clinic, admin bypasses)
      const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
      if (clinic) {
        const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
        const { hasPermission, error } = await checkClinicPermission(
          clinic._id,
          "blogs",
          "delete",
          "Analytics of blog" // Check "Analytics of blog" submodule permission for deleting comments
        );
        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: error || "You do not have permission to delete comments"
          });
        }
      }
    }

    // Try top-level comment first
    let comment = blog.comments.id(commentId);

    if (comment) {
      const isOwner = String(comment.user) === String(me._id);
      if (!isOwner && !isBlogAuthor && me.role !== "admin") {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this comment' });
      }
      comment.deleteOne();
    } else {
      // Search in replies
      let parentComment = blog.comments.find(c =>
        c.replies?.some(r => String(r._id) === String(commentId))
      );

      if (!parentComment) {
        return res.status(404).json({ success: false, error: 'Comment not found' });
      }

      const reply = parentComment.replies.id(commentId);
      const isOwner = String(reply.user) === String(me._id);
      if (!isOwner && !isBlogAuthor && me.role !== "admin") {
        return res.status(403).json({ success: false, error: 'Not authorized to delete this reply' });
      }

      reply.deleteOne();
    }

    await blog.save();
    return res.status(200).json({ success: true, message: 'Comment/reply deleted successfully' });
  } catch (error) {
    console.error("Error in deleteComment API:", error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

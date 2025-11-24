// api/blog/published.js

import dbConnect from "../../../lib/database";
import Blog from "../../../models/Blog";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();
  const { method } = req;

  try {
    switch (method) {
      case "GET":
        try {
          const me = await getUserFromReq(req);
          if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
            return res.status(403).json({ success: false, message: "Access denied" });
          }

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          if (error && !isAdmin && !isDoctor) {
            return res.status(404).json({ success: false, message: error });
          }

          // ✅ Check permission for reading published blogs (only for clinic, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            const { hasPermission, error: permError } = await checkClinicPermission(
              clinicId,
              "blogs",
              "read",
              null, // subModuleName
              me.role === "doctor" ? "doctor" : me.role === "clinic" ? "clinic" : null
            );
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: permError || "You do not have permission to view published blogs"
              });
            }
          }

          const { id } = req.query;

          if (id) {
            // Get single published blog by ID
            const blog = await Blog.findOne({
              _id: id,
              status: "published",
              $or: [
                { postedBy: me._id }, // User owns the blog
                { role: "admin" }, // Or user is admin
              ],
            }).populate("postedBy", "name email");

            if (!blog) {
              return res.status(404).json({
                success: false,
                message: "Published blog not found or you lack permission",
              });
            }
            return res.status(200).json({ success: true, blog });
          }

          // Get published blogs for the authenticated user's role
          const publishedBlogs = await Blog.find({
            status: "published",
            role: me.role, // Filter by the user's role
            $or: [
              { postedBy: me._id }, // User owns the blog
              { role: "admin" }, // Or user is admin
            ],
          })
            .populate("postedBy", "name email")
            .sort({ createdAt: -1 });

          res.status(200).json({ success: true, blogs: publishedBlogs });
        } catch (error) {
          console.error("Error in GET published blogs:", error);
          res.status(500).json({ success: false, message: "Internal server error" });
        }
        break;

      case "POST":
        try {
          const me = await getUserFromReq(req);
          if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
            return res.status(403).json({ success: false, message: "Access denied" });
          }

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          if (error && !isAdmin && !isDoctor) {
            return res.status(404).json({ success: false, message: error });
          }

          // ✅ Check permission for creating published blogs (only for clinic, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            const { hasPermission, error: permError } = await checkClinicPermission(
              clinicId,
              "blogs",
              "create",
              "Write Blog" // Check "Write Blog" submodule permission
            );
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: permError || "You do not have permission to create blogs"
              });
            }
          }

          const { title, content, paramlink } = req.body;

          if (!title || !content || !paramlink) {
            return res.status(400).json({
              success: false,
              message:
                "Title, content, and paramlink are required for published blogs",
            });
          }

          // Only disallow if a published blog already has the paramlink
          const existing = await Blog.findOne({ paramlink, status: "published" });
          if (existing) {
            return res
              .status(409)
              .json({ success: false, message: "Paramlink already exists" });
          }

          const publishedBlog = await Blog.create({
            title: title || "Untitled Blog",
            content: content || "",
            paramlink,
            status: "published",
            postedBy: me._id,
            role: me.role,
          });

          // Populate the postedBy field to return user info
          const populatedBlog = await Blog.findById(publishedBlog._id).populate(
            "postedBy",
            "name email"
          );

          res.status(201).json({ success: true, blog: populatedBlog });
        } catch (error) {
          console.error("Error in POST published blog:", error);
          res.status(500).json({ success: false, message: "Internal server error" });
        }
        break;

      case "PUT":
        try {
          const me = await getUserFromReq(req);
          if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
            return res.status(403).json({ success: false, message: "Access denied" });
          }

          const { id } = req.query;
          const { title, content, paramlink } = req.body;

          if (!id) {
            return res
              .status(400)
              .json({ success: false, message: "Blog ID required" });
          }

          // Find the existing blog
          const existingBlog = await Blog.findById(id);
          if (!existingBlog) {
            return res
              .status(404)
              .json({ success: false, message: "Published blog not found" });
          }

          // Check if user owns the blog or is admin
          if (existingBlog.postedBy.toString() !== me._id.toString() && me.role !== "admin") {
            return res.status(403).json({
              success: false,
              message:
                "You can only edit your own published blogs unless you are an admin",
            });
          }

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          if (error && !isAdmin && !isDoctor) {
            return res.status(404).json({ success: false, message: error });
          }

          // ✅ Check permission for updating published blogs (only for clinic, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            const { hasPermission, error: permError } = await checkClinicPermission(
              clinicId,
              "blogs",
              "update",
              "Published and Drafts Blogs" // Check "Published and Drafts Blogs" submodule permission
            );
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: permError || "You do not have permission to update blogs"
              });
            }
          }

          // If paramlink is being updated, only conflict with other published blogs
          if (paramlink) {
            const existing = await Blog.findOne({
              paramlink,
              status: "published",
              _id: { $ne: id },
            });
            if (existing) {
              return res
                .status(409)
                .json({ success: false, message: "Paramlink already exists" });
            }
          }

          const updatedBlog = await Blog.findByIdAndUpdate(
            id,
            {
              title,
              content,
              paramlink,
              status: "published",
              updatedAt: new Date(),
            },
            { new: true, runValidators: true }
          ).populate("postedBy", "name email");

          res.status(200).json({ success: true, blog: updatedBlog });
        } catch (error) {
          console.error("Error in PUT published blog:", error);
          res.status(500).json({ success: false, message: "Internal server error" });
        }
        break;

      case "DELETE":
        try {
          const me = await getUserFromReq(req);
          if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
            return res.status(403).json({ success: false, message: "Access denied" });
          }

          const { id } = req.query;

          if (!id) {
            return res
              .status(400)
              .json({ success: false, message: "Blog ID required" });
          }

          // Find the existing blog
          const existingBlog = await Blog.findById(id);
          if (!existingBlog) {
            return res
              .status(404)
              .json({ success: false, message: "Published blog not found" });
          }

          // Check if user owns the blog or is admin
          if (existingBlog.postedBy.toString() !== me._id.toString() && me.role !== "admin") {
            return res.status(403).json({
              success: false,
              message: "Not allowed to access this blog",
            });
          }

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          if (error && !isAdmin && !isDoctor) {
            return res.status(404).json({ success: false, message: error });
          }

          // ✅ Check permission for deleting published blogs (only for clinic, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            const { hasPermission, error: permError } = await checkClinicPermission(
              clinicId,
              "blogs",
              "delete",
              "Published and Drafts Blogs" // Check "Published and Drafts Blogs" submodule permission
            );
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: permError || "You do not have permission to delete blogs"
              });
            }
          }

          // Clear comments and likes before deleting
          existingBlog.comments = [];
          existingBlog.likes = [];
          await existingBlog.save();

          // Now delete the blog itself
          await Blog.findByIdAndDelete(id);

          res.status(200).json({
            success: true,
            message:
              "Published blog and all related comments & likes deleted successfully",
          });
        } catch (error) {
          console.error("Error in DELETE published blog:", error);
          res.status(500).json({ success: false, message: "Internal server error" });
        }
        break;

      default:
        res.status(405).json({ success: false, message: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in published blog API:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

// api/blog/published.js

import dbConnect from "../../../lib/database";
import Blog from "../../../models/Blog";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
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

          // ✅ Check permission for reading published blogs (only for clinic roles, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            const roleForPermission = isDoctorStaff ? "doctorStaff" : isAgent ? "agent" : me.role === "clinic" ? "clinic" : null;
            const { hasPermission, error: permError } = await checkClinicPermission(
              clinicId,
              "write_blog", // Check "write_blog" module permission
              "read",
              null, // No submodule - this is a module-level check
              roleForPermission
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
            let blogQuery = {
              _id: id,
              status: "published",
            };

            // For agent/doctorStaff, find blogs from their clinic
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
                
                blogQuery.$or = [
                  { postedBy: { $in: clinicUserIds } }, // Posted by clinic users (including current user)
                  { role: "admin" }, // Or admin blogs
                ];
              } else {
                blogQuery.$or = [
                  { postedBy: me._id },
                  { role: "admin" },
                ];
              }
            } else {
              // For clinic/doctor/admin, use existing logic
              blogQuery.$or = [
                { postedBy: me._id }, // User owns the blog
                { role: "admin" }, // Or user is admin
              ];
            }

            const blog = await Blog.findOne(blogQuery).populate("postedBy", "name email");

            if (!blog) {
              return res.status(404).json({
                success: false,
                message: "Published blog not found or you lack permission",
              });
            }
            return res.status(200).json({ success: true, blog });
          }

          // Get published blogs for the authenticated user's role
          let blogQuery = {
            status: "published",
          };

          // For agent/doctorStaff, find blogs from their clinic
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
              
              blogQuery.$or = [
                { postedBy: { $in: clinicUserIds } }, // Posted by clinic users (including current user)
                { role: "admin" }, // Or admin blogs
              ];
            } else {
              // Fallback if clinic not found
              blogQuery.$or = [
                { postedBy: me._id },
                { role: "admin" },
              ];
            }
          } else if (isAdmin) {
            // Admin can see all blogs
            blogQuery = { status: "published" };
          } else {
            // For clinic/doctor, filter by role
            blogQuery.role = me.role;
            blogQuery.$or = [
              { postedBy: me._id }, // User owns the blog
              { role: "admin" }, // Or user is admin
            ];
          }

          const publishedBlogs = await Blog.find(blogQuery)
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

          // ✅ Check permission for creating published blogs (only for clinic roles, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            const roleForPermission = isDoctorStaff ? "doctorStaff" : isAgent ? "agent" : me.role === "clinic" ? "clinic" : null;
            const { hasPermission, error: permError } = await checkClinicPermission(
              clinicId,
              "write_blog", // Check "write_blog" module permission
              "create",
              null, // No submodule - this is a module-level check
              roleForPermission
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

          // Determine the role to use for the blog
          // Blog model only accepts "clinic" or "doctor", so use "clinic" for agent/doctorStaff
          let blogRole = me.role;
          if (me.role === "agent" || me.role === "doctorStaff") {
            blogRole = "clinic"; // Agent/doctorStaff blogs are associated with clinic
          }

          const publishedBlog = await Blog.create({
            title: title || "Untitled Blog",
            content: content || "",
            paramlink,
            status: "published",
            postedBy: me._id,
            role: blogRole,
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
          if (!me || !requireRole(me, ["clinic", "doctor", "doctorStaff", "agent", "admin"])) {
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

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          const isDoctorStaff = me.role === "doctorStaff";
          const isAgent = me.role === "agent";
          if (error && !isAdmin && !isDoctor && !isDoctorStaff && !isAgent) {
            return res.status(404).json({ success: false, message: error });
          }

          // Check if user owns the blog, is from the same clinic (for agent/doctorStaff), or is admin
          const isBlogAuthor = existingBlog.postedBy.toString() === me._id.toString();
          
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
              isClinicBlog = clinicUserIds.includes(existingBlog.postedBy.toString());
            }
          }

          // Only allow if user owns the blog, is from the same clinic (with permission), or is admin
          if (!isBlogAuthor && !isClinicBlog && !isAdmin) {
            return res.status(403).json({
              success: false,
              message: "You can only edit blogs from your clinic unless you are an admin",
            });
          }

          // ✅ Check permission for updating published blogs (only for clinic roles, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            const roleForPermission = isDoctorStaff ? "doctorStaff" : isAgent ? "agent" : me.role === "clinic" ? "clinic" : null;
            const { hasPermission, error: permError } = await checkClinicPermission(
              clinicId,
              "write_blog", // Check "write_blog" module permission
              "update",
              null, // No submodule - this is a module-level check
              roleForPermission
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
          if (!me || !requireRole(me, ["clinic", "doctor", "doctorStaff", "agent", "admin"])) {
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

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          const isDoctorStaff = me.role === "doctorStaff";
          const isAgent = me.role === "agent";
          if (error && !isAdmin && !isDoctor && !isDoctorStaff && !isAgent) {
            return res.status(404).json({ success: false, message: error });
          }

          // Check if user owns the blog, is from the same clinic (for agent/doctorStaff), or is admin
          const isBlogAuthor = existingBlog.postedBy.toString() === me._id.toString();
          
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
              isClinicBlog = clinicUserIds.includes(existingBlog.postedBy.toString());
            }
          }

          // Only allow if user owns the blog, is from the same clinic (with permission), or is admin
          if (!isBlogAuthor && !isClinicBlog && !isAdmin) {
            return res.status(403).json({
              success: false,
              message: "Not allowed to access this blog",
            });
          }

          // ✅ Check permission for deleting published blogs (only for clinic roles, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            const roleForPermission = isDoctorStaff ? "doctorStaff" : isAgent ? "agent" : me.role === "clinic" ? "clinic" : null;
            const { hasPermission, error: permError } = await checkClinicPermission(
              clinicId,
              "write_blog", // Check "write_blog" module permission
              "delete",
              null, // No submodule - this is a module-level check
              roleForPermission
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

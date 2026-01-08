// api/blog/published.js

import dbConnect from "../../../lib/database";
import Blog from "../../../models/Blog";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../lead-ms/permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";

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

          // ✅ Check permission for reading published blogs (only for agent/doctorStaff, clinic/admin/doctor bypass)
          if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
            if (isAgent || isDoctorStaff) {
              const result = await checkAgentPermission(
                me._id,
                "clinic_write_blog", // Use clinic_write_blog to match the module key format
                "read",
                null // No submodule - this is a module-level check
              );
              if (!result.hasPermission) {
              return res.status(403).json({
                success: false,
                  message: result.error || "You do not have permission to view published blogs"
              });
              }
            }
            // Clinic, admin, and doctor users bypass permission checks
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
            } else if (me.role === "doctor") {
              // For doctor, filter by role and postedBy
              blogQuery.role = me.role;
              blogQuery.$or = [
                { postedBy: me._id }, // User owns the blog
                { role: "admin" }, // Or user is admin
              ];
            } else if (me.role === "clinic") {
              // For clinic role, find blogs posted by the clinic owner (similar to job-postings pattern)
              const orConditions = [{ postedBy: me._id }];
              
              if (clinicId) {
                // Find clinic owner and all users from this clinic
                const clinic = await Clinic.findById(clinicId).select("owner");
                const clinicUserIds = [];
                
                // Add clinic owner (who posted the blogs)
                if (clinic && clinic.owner) {
                  clinicUserIds.push(clinic.owner);
                }
                
                // Add all users with this clinicId (agents, staff, doctors, etc.)
                const clinicUsers = await User.find({ 
                  clinicId: clinicId 
                }).select("_id");
                
                clinicUsers.forEach(u => {
                  if (!clinicUserIds.some(id => id.toString() === u._id.toString())) {
                    clinicUserIds.push(u._id);
                  }
                });
                
                if (clinicUserIds.length > 0) {
                  orConditions.push({ postedBy: { $in: clinicUserIds } });
                }
              }
              
              // Also include admin blogs
              orConditions.push({ role: "admin" });
              
              blogQuery.$or = orConditions;
            } else if (isAdmin) {
              // Admin can see any blog - no additional filters needed
              // blogQuery already has _id and status filters
            } else {
              // Fallback for other roles
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
          if (isAgent || isDoctorStaff) {
            if (clinicId) {
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
            } else {
              // Agent/doctorStaff without clinicId - only show their own blogs
              blogQuery.$or = [
                { postedBy: me._id },
                { role: "admin" },
              ];
            }
          } else if (isAdmin) {
            // Admin can see all blogs
            blogQuery = { status: "published" };
          } else if (me.role === "doctor") {
            // For doctor, filter by role and postedBy
            blogQuery.role = me.role;
            blogQuery.$or = [
              { postedBy: me._id }, // User owns the blog
              { role: "admin" }, // Or user is admin
            ];
          } else if (me.role === "clinic") {
            // For clinic role, find blogs posted by the clinic owner and all clinic users (similar to job-postings pattern)
            // Always start with the user's own blogs (clinic owner)
            const orConditions = [{ postedBy: me._id }];
            
            if (clinicId) {
              // Find clinic owner and all users from this clinic
              const clinic = await Clinic.findById(clinicId).select("owner");
              
              const clinicUserIds = [];
              
              // Add clinic owner (who posted the blogs) - but only if different from current user
              // Note: For clinic role, clinic.owner should match me._id, but we check anyway
              if (clinic && clinic.owner) {
                const ownerId = clinic.owner.toString();
                const userId = me._id.toString();
                if (ownerId !== userId) {
                  clinicUserIds.push(clinic.owner);
                }
              }
              
              // Add all users with this clinicId (agents, staff, doctors, etc.)
              const clinicUsers = await User.find({ 
                clinicId: clinicId 
              }).select("_id");
              
              clinicUsers.forEach(u => {
                const userIdStr = u._id.toString();
                const currentUserIdStr = me._id.toString();
                // Don't add current user again (already in orConditions)
                if (userIdStr !== currentUserIdStr && !clinicUserIds.some(id => id.toString() === userIdStr)) {
                  clinicUserIds.push(u._id);
                }
              });
              
              if (clinicUserIds.length > 0) {
                orConditions.push({ postedBy: { $in: clinicUserIds } });
              }
            }
            
            // Also include admin blogs
            orConditions.push({ role: "admin" });
            
            blogQuery.$or = orConditions;
          } else {
            // Fallback for any other role
            blogQuery.$or = [
              { postedBy: me._id },
              { role: "admin" },
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

          // ✅ Check permission for creating published blogs (only for agent/doctorStaff, clinic/admin/doctor bypass)
          if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
            if (isAgent || isDoctorStaff) {
              const result = await checkAgentPermission(
                me._id,
                "clinic_write_blog", // Use clinic_write_blog to match the module key format
                "create",
                null // No submodule - this is a module-level check
              );
              if (!result.hasPermission) {
              return res.status(403).json({
                success: false,
                  message: result.error || "You do not have permission to create blogs"
              });
              }
            }
            // Clinic, admin, and doctor users bypass permission checks
          }

          const { title, content, paramlink } = req.body;
          const { draftId } = req.query; // Check if publishing from a draft

          if (!title || !content || !paramlink) {
            return res.status(400).json({
              success: false,
              message:
                "Title, content, and paramlink are required for published blogs",
            });
          }

          // If publishing from a draft, update the draft to published instead of creating new
          if (draftId) {
            // Find the existing draft
            const existingDraft = await Blog.findOne({ 
              _id: draftId, 
              status: "draft",
              postedBy: me._id 
            });

            if (!existingDraft) {
              return res.status(404).json({
                success: false,
                message: "Draft not found or you don't have permission to publish it",
              });
            }

            // Check if paramlink conflicts with other published blogs (excluding this draft)
            const existingPublished = await Blog.findOne({
              paramlink,
              status: "published",
              _id: { $ne: draftId },
            });
            if (existingPublished) {
              return res
                .status(409)
                .json({ success: false, message: "Paramlink already exists" });
            }

            // Update the draft to published status
            const updatedBlog = await Blog.findByIdAndUpdate(
              draftId,
              {
                title: title.trim(),
                content: content.trim(),
                paramlink: paramlink.trim(),
                status: "published",
                updatedAt: new Date(),
              },
              { new: true, runValidators: true }
            ).populate("postedBy", "name email");

            return res.status(200).json({ success: true, blog: updatedBlog });
          }

          // If not publishing from a draft, create a new published blog
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

          // ✅ Check permission for updating published blogs (only for agent/doctorStaff, clinic/admin/doctor bypass)
          if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
            if (isAgent || isDoctorStaff) {
              const result = await checkAgentPermission(
                me._id,
                "clinic_write_blog", // Use clinic_write_blog to match the module key format
                "update",
                null // No submodule - this is a module-level check
              );
              if (!result.hasPermission) {
              return res.status(403).json({
                success: false,
                  message: result.error || "You do not have permission to update blogs"
              });
              }
            }
            // Clinic, admin, and doctor users bypass permission checks
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

          // Find the existing blog - must be published status
          const existingBlog = await Blog.findOne({ _id: id, status: "published" });
          if (!existingBlog) {
            return res
              .status(404)
              .json({ success: false, message: "Published blog not found" });
          }

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          const isDoctorStaff = me.role === "doctorStaff";
          const isAgent = me.role === "agent";
          // Only return 404 if it's a critical "not found" error
          if (error && !isAdmin && !isDoctor && !isDoctorStaff && !isAgent && error.includes('not found')) {
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

          // ✅ Check permission for deleting published blogs (only for agent/doctorStaff, clinic/admin/doctor bypass)
          if (!["admin", "clinic", "doctor"].includes(me.role) && clinicId) {
            if (isAgent || isDoctorStaff) {
              const result = await checkAgentPermission(
                me._id,
                "clinic_write_blog", // Use clinic_write_blog to match the module key format
                "delete",
                null // No submodule - this is a module-level check
              );
              if (!result.hasPermission) {
              return res.status(403).json({
                success: false,
                  message: result.error || "You do not have permission to delete blogs"
              });
              }
            }
            // Clinic, admin, and doctor users bypass permission checks
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

import dbConnect from "../../../lib/database";
import Blog from "../../../models/Blog";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../lead-ms/permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase body size limit to handle large content
    },
  },
};

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

          // ✅ Check permission for reading drafts (only for clinic roles, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            let hasPermission = false;
            let permError = null;
            
            // For agent/doctorStaff, use checkAgentPermission (checks AgentPermission collection)
            if (isAgent || isDoctorStaff) {
              const result = await checkAgentPermission(
                me._id,
                "clinic_write_blog", // Use clinic_write_blog to match the module key format
                "read",
                null // No submodule - this is a module-level check
              );
              hasPermission = result.hasPermission;
              permError = result.error;
            } 
            // For clinic role, use checkClinicPermission (checks ClinicPermission collection)
            else if (me.role === "clinic") {
              const result = await checkClinicPermission(
                clinicId,
                "write_blog", // Check "write_blog" module permission
                "read",
                null, // No submodule - this is a module-level check
                "clinic"
              );
              hasPermission = result.hasPermission;
              permError = result.error;
            }
            
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: permError || "You do not have permission to view drafts"
              });
            }
          }

          const { id } = req.query;

          if (id) {
            // Get single draft by ID
            let draftQuery = {
              _id: id,
              status: "draft",
            };

            // For agent/doctorStaff, find drafts from their clinic
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
                
                // Include the current user (agent/doctorStaff) in the list so their own drafts show up
                clinicUserIds.push(me._id);
                
                draftQuery.$or = [
                  { postedBy: { $in: clinicUserIds } }, // Posted by clinic users (including current user)
                  { role: "admin" }, // Or admin drafts
                ];
              } else {
                draftQuery.$or = [
                  { postedBy: me._id },
                  { role: "admin" },
                ];
              }
            } else {
              // For clinic/doctor/admin, use existing logic
              draftQuery.$or = [
                { postedBy: me._id }, // User owns the draft
                { role: "admin" }, // Or user is admin
              ];
            }

            const draft = await Blog.findOne(draftQuery).populate("postedBy", "name email");

            if (!draft) {
              return res
                .status(404)
                .json({
                  success: false,
                  message: "Draft not found or you lack permission",
                });
            }
            return res.status(200).json({ success: true, draft });
          }

          // Get all drafts for the authenticated user's role
          // IMPORTANT: Always filter by status: "draft" to exclude published posts
          let draftQuery = {
            status: "draft", // Ensure only drafts are returned, never published posts
          };

          // For agent/doctorStaff, find drafts from their clinic
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
              
              // Include the current user (agent/doctorStaff) in the list so their own drafts show up
              clinicUserIds.push(me._id);
              
              // Combine status filter with $or condition
              draftQuery = {
                status: "draft", // Always filter by draft status
                $or: [
                  { postedBy: { $in: clinicUserIds } }, // Posted by clinic users (including current user)
                  { role: "admin" }, // Or admin drafts
                ],
              };
            } else {
              // Fallback if clinic not found
              draftQuery = {
                status: "draft", // Always filter by draft status
                $or: [
                  { postedBy: me._id },
                  { role: "admin" },
                ],
              };
            }
          } else if (isAdmin) {
            // Admin can see all drafts (but only drafts, not published)
            draftQuery = { status: "draft" };
          } else {
            // For clinic/doctor, filter by role and status
            draftQuery = {
              status: "draft", // Always filter by draft status
              role: me.role,
              $or: [
                { postedBy: me._id }, // User owns the draft
                { role: "admin" }, // Or user is admin
              ],
            };
          }

          const drafts = await Blog.find(draftQuery)
            .populate("postedBy", "name email")
            .sort({ createdAt: -1 });

          res.status(200).json({ success: true, drafts });
        } catch (error) {
          console.error("Error in GET drafts:", error);
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

          // ✅ Check permission for creating drafts (only for clinic roles, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            let hasPermission = false;
            let permError = null;
            
            // For agent/doctorStaff, use checkAgentPermission (checks AgentPermission collection)
            if (isAgent || isDoctorStaff) {
              const result = await checkAgentPermission(
                me._id,
                "clinic_write_blog", // Use clinic_write_blog to match the module key format
                "create",
                null // No submodule - this is a module-level check
              );
              hasPermission = result.hasPermission;
              permError = result.error;
            } 
            // For clinic role, use checkClinicPermission (checks ClinicPermission collection)
            else if (me.role === "clinic") {
              const result = await checkClinicPermission(
                clinicId,
                "write_blog", // Check "write_blog" module permission
                "create",
                null, // No submodule - this is a module-level check
                "clinic"
              );
              hasPermission = result.hasPermission;
              permError = result.error;
            }
            
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: permError || "You do not have permission to create drafts"
              });
            }
          }

          const { title, content, paramlink, isAutoSave } = req.body;

          // For auto-save (every 2 minutes), allow partial updates - only validate if not auto-save
          if (!isAutoSave) {
            // Validate that all required fields are present and non-empty for manual saves
            if (!title || title.trim() === '' || !content || content.trim() === '' || !paramlink || paramlink.trim() === '') {
              return res.status(400).json({
                success: false,
                message: "Title, content, and paramlink are required and cannot be empty for drafts",
              });
            }
          } else {
            // For auto-save, only require that at least one field has content
            if ((!title || title.trim() === '') && (!content || content.trim() === '') && (!paramlink || paramlink.trim() === '')) {
              return res.status(400).json({
                success: false,
                message: "At least one field (title, content, or paramlink) must have content for auto-save",
              });
            }
          }

          // Allow same paramlink for drafts; only block if a published blog already uses it
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

          const draft = await Blog.create({
            title: title || "Untitled Draft",
            content: content || "",
            paramlink,
            status: "draft",
            postedBy: me._id,
            role: blogRole,
          });

          // Populate the postedBy field to return user info
          const populatedDraft = await Blog.findById(draft._id).populate(
            "postedBy",
            "name email"
          );

          res.status(201).json({ success: true, draft: populatedDraft });
        } catch (error) {
          console.error("Error in POST draft:", error);
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
          const { title, content, paramlink, isAutoSave } = req.body;

          if (!id) {
            return res
              .status(400)
              .json({ success: false, message: "Draft ID required" });
          }

          // For auto-save (every 2 minutes), allow partial updates - only validate if not auto-save
          if (!isAutoSave) {
            // Validate that all required fields are present and non-empty for manual saves
            if (!title || title.trim() === '' || !content || content.trim() === '' || !paramlink || paramlink.trim() === '') {
              return res.status(400).json({
                success: false,
                message: "Title, content, and paramlink are required and cannot be empty for drafts",
              });
            }
          } else {
            // For auto-save, only require that at least one field has content
            if ((!title || title.trim() === '') && (!content || content.trim() === '') && (!paramlink || paramlink.trim() === '')) {
              return res.status(400).json({
                success: false,
                message: "At least one field (title, content, or paramlink) must have content for auto-save",
              });
            }
          }

          // Find the existing draft
          const existingDraft = await Blog.findById(id);
          if (!existingDraft) {
            return res
              .status(404)
              .json({ success: false, message: "Draft not found" });
          }

          // Check if user owns the draft or is admin
          if (
            existingDraft.postedBy.toString() !== me._id.toString() &&
            me.role !== "admin"
          ) {
            return res.status(403).json({
              success: false,
              message:
                "You can only edit your own drafts unless you are an admin",
            });
          }

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          const isDoctorStaff = me.role === "doctorStaff";
          const isAgent = me.role === "agent";
          if (error && !isAdmin && !isDoctor && !isDoctorStaff && !isAgent) {
            return res.status(404).json({ success: false, message: error });
          }

          // ✅ Check permission for updating drafts (only for clinic roles, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            let hasPermission = false;
            let permError = null;
            
            // For agent/doctorStaff, use checkAgentPermission (checks AgentPermission collection)
            if (isAgent || isDoctorStaff) {
              const result = await checkAgentPermission(
                me._id,
                "clinic_write_blog", // Use clinic_write_blog to match the module key format
                "update",
                null // No submodule - this is a module-level check
              );
              hasPermission = result.hasPermission;
              permError = result.error;
            } 
            // For clinic role, use checkClinicPermission (checks ClinicPermission collection)
            else if (me.role === "clinic") {
              const result = await checkClinicPermission(
                clinicId,
                "write_blog", // Check "write_blog" module permission
                "update",
                null, // No submodule - this is a module-level check
                "clinic"
              );
              hasPermission = result.hasPermission;
              permError = result.error;
            }
            
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: permError || "You do not have permission to update drafts"
              });
            }
          }

          // If paramlink is being updated, only conflict with published blogs
          if (paramlink) {
            const existing = await Blog.findOne({
              paramlink,
              status: "published",
            });
            if (existing) {
              return res
                .status(409)
                .json({ success: false, message: "Paramlink already exists" });
            }
          }

          // For auto-save, only update fields that are provided (partial update)
          const updateData = {
            status: "draft",
            updatedAt: new Date(),
          };
          
          // Only update fields that are provided and non-empty
          if (title !== undefined && title !== null && title.trim() !== '') {
            updateData.title = title;
          }
          if (content !== undefined && content !== null && content.trim() !== '') {
            updateData.content = content;
          }
          if (paramlink !== undefined && paramlink !== null && paramlink.trim() !== '') {
            updateData.paramlink = paramlink;
          }

          const updatedDraft = await Blog.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
          ).populate("postedBy", "name email");

          res.status(200).json({ success: true, draft: updatedDraft });
        } catch (error) {
          console.error("Error in PUT draft:", error);
          console.error("Request body:", req.body);
          console.error("Draft ID:", id);
          res.status(500).json({ 
            success: false, 
            message: error.message || "Internal server error",
            error: process.env.NODE_ENV === 'development' ? error.stack : undefined
          });
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
              .json({ success: false, message: "Draft ID required" });
          }

          // Find the existing draft - must be draft status
          const existingDraft = await Blog.findOne({ _id: id, status: "draft" });
          if (!existingDraft) {
            return res
              .status(404)
              .json({ success: false, message: "Draft not found" });
          }

          // Check if user owns the draft or is admin
          if (
            existingDraft.postedBy.toString() !== me._id.toString() &&
            me.role !== "admin"
          ) {
            return res.status(403).json({
              success: false,
              message: "Not allowed to access this draft",
            });
          }

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          const isDoctorStaff = me.role === "doctorStaff";
          const isAgent = me.role === "agent";
          // Only return 404 if it's a critical "not found" error
          if (error && !isAdmin && !isDoctor && !isDoctorStaff && !isAgent && error.includes('not found')) {
            return res.status(404).json({ success: false, message: error });
          }

          // ✅ Check permission for deleting drafts (only for clinic roles, admin bypasses)
          if (!isAdmin && !isDoctor && clinicId) {
            let hasPermission = false;
            let permError = null;
            
            // For agent/doctorStaff, use checkAgentPermission (checks AgentPermission collection)
            if (isAgent || isDoctorStaff) {
              const result = await checkAgentPermission(
                me._id,
                "clinic_write_blog", // Use clinic_write_blog to match the module key format
                "delete",
                null // No submodule - this is a module-level check
              );
              hasPermission = result.hasPermission;
              permError = result.error;
            } 
            // For clinic role, use checkClinicPermission (checks ClinicPermission collection)
            else if (me.role === "clinic") {
              const result = await checkClinicPermission(
                clinicId,
                "write_blog", // Check "write_blog" module permission
                "delete",
                null, // No submodule - this is a module-level check
                "clinic"
              );
              hasPermission = result.hasPermission;
              permError = result.error;
            }
            
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: permError || "You do not have permission to delete drafts"
              });
            }
          }

          await Blog.findByIdAndDelete(id);
          res
            .status(200)
            .json({ success: true, message: "Draft deleted successfully" });
        } catch (error) {
          console.error("Error in DELETE draft:", error);
          res.status(500).json({ success: false, message: "Internal server error" });
        }
        break;

      default:
        res.status(405).json({ success: false, message: "Method not allowed" });
    }
  } catch (error) {
    console.error("Error in draft API:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error",
      });
  }
}

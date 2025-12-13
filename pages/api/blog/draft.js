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

          // ✅ Check permission for reading drafts (only for clinic roles, admin bypasses)
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
          let draftQuery = {
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
              // Fallback if clinic not found
              draftQuery.$or = [
                { postedBy: me._id },
                { role: "admin" },
              ];
            }
          } else if (isAdmin) {
            // Admin can see all drafts
            draftQuery = { status: "draft" };
          } else {
            // For clinic/doctor, filter by role
            draftQuery.role = me.role;
            draftQuery.$or = [
              { postedBy: me._id }, // User owns the draft
              { role: "admin" }, // Or user is admin
            ];
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
                message: permError || "You do not have permission to create drafts"
              });
            }
          }

          const { title, content, paramlink } = req.body;

          if (!title || !content || !paramlink) {
            return res.status(400).json({
              success: false,
              message: "Title, content, and paramlink are required for drafts",
            });
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
          const { title, content, paramlink } = req.body;

          if (!id) {
            return res
              .status(400)
              .json({ success: false, message: "Draft ID required" });
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

          const updatedDraft = await Blog.findByIdAndUpdate(
            id,
            {
              title,
              content,
              paramlink,
              status: "draft",
              updatedAt: new Date(),
            },
            { new: true, runValidators: true }
          ).populate("postedBy", "name email");

          res.status(200).json({ success: true, draft: updatedDraft });
        } catch (error) {
          console.error("Error in PUT draft:", error);
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
              .json({ success: false, message: "Draft ID required" });
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
              message: "Not allowed to access this draft",
            });
          }

          const { clinicId, error, isAdmin } = await getClinicIdFromUser(me);
          const isDoctor = me.role === "doctor";
          const isDoctorStaff = me.role === "doctorStaff";
          const isAgent = me.role === "agent";
          if (error && !isAdmin && !isDoctor && !isDoctorStaff && !isAgent) {
            return res.status(404).json({ success: false, message: error });
          }

          // ✅ Check permission for deleting drafts (only for clinic roles, admin bypasses)
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

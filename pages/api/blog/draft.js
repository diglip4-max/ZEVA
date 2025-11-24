import dbConnect from "../../../lib/database";
import Blog from "../../../models/Blog";
import Clinic from "../../../models/Clinic";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

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

          let clinicId;
          if (me.role === "clinic") {
            const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
            if (!clinic) {
              return res.status(404).json({ success: false, message: "Clinic not found for this user" });
            }
            clinicId = clinic._id;
          }

          // ✅ Check permission for reading drafts (only for clinic, admin bypasses)
          if (me.role !== "admin" && clinicId) {
            const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
            const { hasPermission, error } = await checkClinicPermission(
              clinicId,
              "blogs",
              "read",
              "Published and Drafts Blogs" // Check "Published and Drafts Blogs" submodule permission
            );
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: error || "You do not have permission to view drafts"
              });
            }
          }

          const { id } = req.query;

          if (id) {
            // Get single draft by ID
            const draft = await Blog.findOne({
              _id: id,
              status: "draft",
              $or: [
                { postedBy: me._id }, // User owns the draft
                { role: "admin" }, // Or user is admin
              ],
            }).populate("postedBy", "name email");

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
          const drafts = await Blog.find({
            status: "draft",
            role: me.role, // Filter by the user's role
            $or: [
              { postedBy: me._id }, // User owns the draft
              { role: "admin" }, // Or user is admin
            ],
          })
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

          // ✅ Check permission for creating drafts (only for clinic, admin bypasses)
          if (me.role !== "admin" && clinicId) {
            const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
            const { hasPermission, error } = await checkClinicPermission(
              clinicId,
              "blogs",
              "create",
              "Write Blog" // Check "Write Blog" submodule permission
            );
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: error || "You do not have permission to create drafts"
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

          const draft = await Blog.create({
            title: title || "Untitled Draft",
            content: content || "",
            paramlink,
            status: "draft",
            postedBy: me._id,
            role: me.role,
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
          if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
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

          let clinicId;
          if (me.role === "clinic") {
            const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
            if (!clinic) {
              return res.status(404).json({ success: false, message: "Clinic not found for this user" });
            }
            clinicId = clinic._id;
          }

          // ✅ Check permission for updating drafts (only for clinic, admin bypasses)
          if (me.role !== "admin" && clinicId) {
            const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
            const { hasPermission, error } = await checkClinicPermission(
              clinicId,
              "blogs",
              "update",
              "Write Blog" // Check "Write Blog" submodule permission
            );
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: error || "You do not have permission to update drafts"
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
          if (!me || !requireRole(me, ["clinic", "doctor", "admin"])) {
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

          let clinicId;
          if (me.role === "clinic") {
            const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
            if (!clinic) {
              return res.status(404).json({ success: false, message: "Clinic not found for this user" });
            }
            clinicId = clinic._id;
          }

          // ✅ Check permission for deleting drafts (only for clinic, admin bypasses)
          if (me.role !== "admin" && clinicId) {
            const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
            const { hasPermission, error } = await checkClinicPermission(
              clinicId,
              "blogs",
              "delete",
              "Published and Drafts Blogs" // Check "Published and Drafts Blogs" submodule permission
            );
            if (!hasPermission) {
              return res.status(403).json({
                success: false,
                message: error || "You do not have permission to delete drafts"
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

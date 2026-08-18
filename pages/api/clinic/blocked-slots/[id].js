import dbConnect from "../../../../lib/database";
import BlockedSlot from "../../../../models/BlockedSlot";
import Clinic from "../../../../models/Clinic";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser } from "../../lead-ms/permissions-helper";

function isValidObjectIdString(id) {
  if (typeof id !== "string" || !id.trim()) return false;
  return /^[0-9a-fA-F]{24}$/.test(id.trim());
}

export default async function handler(req, res) {
  await dbConnect();

  try {
    const { id } = req.query;
    if (!id || !isValidObjectIdString(String(id))) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid blocked slot id" });
    }

    // Verify authentication
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    if (
      !["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(
        clinicUser.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Clinic role required.",
      });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(clinicUser);
    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    if (!clinicId && clinicUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: clinicUser._id }).select(
        "_id"
      );
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    }

    if (!clinicId) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    // GET single blocked slot
    if (req.method === "GET") {
      const blockedSlot = await BlockedSlot.findOne({
        _id: id,
        clinicId,
      })
        .populate("doctorId", "name email")
        .populate("roomId", "name")
        .populate("blockedByUserId", "name email role")
        .populate("unblockedByUserId", "name email role")
        .lean();

      if (!blockedSlot) {
        return res
          .status(404)
          .json({ success: false, message: "Blocked slot not found" });
      }

      return res.status(200).json({
        success: true,
        blockedSlot: {
          _id: blockedSlot._id.toString(),
          clinicId: blockedSlot.clinicId?.toString(),
          doctorId:
            blockedSlot.doctorId?._id?.toString() ||
            blockedSlot.doctorId?.toString() ||
            null,
          doctorName: blockedSlot.doctorId?.name || null,
          roomId:
            blockedSlot.roomId?._id?.toString() ||
            blockedSlot.roomId?.toString() ||
            null,
          roomName: blockedSlot.roomId?.name || null,
          startDate: blockedSlot.startDate,
          fromTime: blockedSlot.fromTime,
          toTime: blockedSlot.toTime,
          reason: blockedSlot.reason || "",
          isActive: blockedSlot.isActive !== false,
          blockedByRole: blockedSlot.blockedByRole || null,
          blockedByUserId:
            blockedSlot.blockedByUserId?._id?.toString() ||
            blockedSlot.blockedByUserId?.toString() ||
            null,
          blockedByName: blockedSlot.blockedByName || null,
          blockedAt: blockedSlot.blockedAt || null,
          unblockedByRole: blockedSlot.unblockedByRole || null,
          unblockedByUserId:
            blockedSlot.unblockedByUserId?._id?.toString() ||
            blockedSlot.unblockedByUserId?.toString() ||
            null,
          unblockedByName: blockedSlot.unblockedByName || null,
          unblockedAt: blockedSlot.unblockedAt || null,
        },
      });
    }

    // PATCH: unblock (or update fields if explicitly requested)
    if (req.method === "PATCH") {
      const existing = await BlockedSlot.findOne({ _id: id, clinicId });
      if (!existing) {
        return res
          .status(404)
          .json({ success: false, message: "Blocked slot not found" });
      }

      const body = req.body || {};
      const { action } = body;

      // Default behavior: unblock (soft-deactivate)
      const willUnblock =
        action === "unblock" || body.isActive === false || action === undefined;

      if (willUnblock) {
        // Record unblock metadata only on first unblock (idempotent)
        if (existing.isActive) {
          const recordedRole = (() => {
            const r = clinicUser.role;
            if (r === "admin") return "admin";
            if (r === "clinic") return "clinic";
            if (r === "doctor") return "doctor";
            if (r === "agent" || r === "doctorStaff" || r === "staff")
              return "staff";
            return null;
          })();
          existing.isActive = false;
          existing.unblockedByRole = recordedRole;
          existing.unblockedByUserId = clinicUser._id;
          existing.unblockedByName =
            clinicUser.name ||
            clinicUser.fullName ||
            clinicUser.email ||
            "Unknown";
          existing.unblockedAt = new Date();
          await existing.save();
        }

        return res.status(200).json({
          success: true,
          message: "Time slot unblocked successfully",
          blockedSlot: {
            _id: existing._id.toString(),
            isActive: existing.isActive !== false,
            unblockedByRole: existing.unblockedByRole || null,
            unblockedByName: existing.unblockedByName || null,
            unblockedAt: existing.unblockedAt || null,
          },
        });
      }

      // Optional re-activate path (not in current UI scope, but supported)
      if (action === "reactivate" || body.isActive === true) {
        existing.isActive = true;
        existing.unblockedByRole = null;
        existing.unblockedByUserId = null;
        existing.unblockedByName = null;
        existing.unblockedAt = null;
        await existing.save();

        return res.status(200).json({
          success: true,
          message: "Time slot re-activated successfully",
          blockedSlot: {
            _id: existing._id.toString(),
            isActive: existing.isActive !== false,
          },
        });
      }

      return res
        .status(400)
        .json({ success: false, message: "Unsupported action" });
    }

    // DELETE: hard delete (optional, kept for admin tools)
    if (req.method === "DELETE") {
      const deleted = await BlockedSlot.findOneAndDelete({
        _id: id,
        clinicId,
      });
      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, message: "Blocked slot not found" });
      }
      return res.status(200).json({
        success: true,
        message: "Blocked slot deleted successfully",
      });
    }

    res.setHeader("Allow", ["GET", "PATCH", "DELETE"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Error in blocked-slot detail API:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

import dbConnect from "../../../../lib/database";
import BlockedSlot from "../../../../models/BlockedSlot";
import Clinic from "../../../../models/Clinic";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser } from "../../lead-ms/permissions-helper";

// Helper: parse YYYY-MM-DD and build a UTC day range (matches appointments.js convention)
function buildUtcDayRange(dateStr) {
  const match = String(dateStr)
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1; // 0-indexed
  const day = parseInt(match[3], 10);
  const startOfDay = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
  const endOfDay = new Date(
    Date.UTC(year, month, day, 23, 59, 59, 999)
  );
  return { startOfDay, endOfDay };
}

// Helper: validate HH:MM 24-hour time
function isValidTimeString(t) {
  return typeof t === "string" && /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/.test(t);
}

function timeToMinutes(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isValidObjectIdString(id) {
  if (typeof id !== "string" || !id.trim()) return false;
  return /^[0-9a-fA-F]{24}$/.test(id.trim());
}

export default async function handler(req, res) {
  await dbConnect();

  try {
    // Verify authentication
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    // Allow clinic, admin, agent, doctor, doctorStaff, staff roles
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

    // Ensure clinicId is set correctly for clinic role
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

    // GET: list blocked slots for the clinic
    if (req.method === "GET") {
      const { date, doctorId, roomId, includeInactive } = req.query;

      const query = { clinicId };

      // Only return active blocks by default (inactive = unblocked records)
      if (includeInactive !== "true") {
        query.isActive = true;
      }

      if (date) {
        const range = buildUtcDayRange(date);
        if (range) {
          query.startDate = {
            $gte: range.startOfDay,
            $lte: range.endOfDay,
          };
        } else {
          return res.status(400).json({
            success: false,
            message: "Invalid date format. Expected YYYY-MM-DD.",
          });
        }
      }

      if (doctorId && isValidObjectIdString(doctorId)) {
        query.doctorId = doctorId;
      }

      if (roomId && isValidObjectIdString(roomId)) {
        query.roomId = roomId;
      }

      const blockedSlots = await BlockedSlot.find(query)
        .populate("doctorId", "name email")
        .populate("roomId", "name")
        .populate("blockedByUserId", "name email role")
        .populate("unblockedByUserId", "name email role")
        .sort({ startDate: 1, fromTime: 1 })
        .lean();

      return res.status(200).json({
        success: true,
        blockedSlots: blockedSlots.map((b) => ({
          _id: b._id.toString(),
          clinicId: b.clinicId?.toString(),
          doctorId: b.doctorId?._id?.toString() || b.doctorId?.toString() || null,
          doctorName: b.doctorId?.name || null,
          roomId: b.roomId?._id?.toString() || b.roomId?.toString() || null,
          roomName: b.roomId?.name || null,
          startDate: b.startDate,
          fromTime: b.fromTime,
          toTime: b.toTime,
          reason: b.reason || "",
          isActive: b.isActive !== false,
          blockedByRole: b.blockedByRole || null,
          blockedByUserId:
            b.blockedByUserId?._id?.toString() ||
            b.blockedByUserId?.toString() ||
            null,
          blockedByName: b.blockedByName || null,
          blockedAt: b.blockedAt || null,
          unblockedByRole: b.unblockedByRole || null,
          unblockedByUserId:
            b.unblockedByUserId?._id?.toString() ||
            b.unblockedByUserId?.toString() ||
            null,
          unblockedByName: b.unblockedByName || null,
          unblockedAt: b.unblockedAt || null,
          createdAt: b.createdAt,
          updatedAt: b.updatedAt,
        })),
      });
    }

    // POST: create a new block
    if (req.method === "POST") {
      const {
        doctorId,
        roomId,
        startDate,
        fromTime,
        toTime,
        reason,
      } = req.body || {};

      // Validate date
      if (!startDate) {
        return res
          .status(400)
          .json({ success: false, message: "startDate is required" });
      }
      const range = buildUtcDayRange(
        typeof startDate === "string" ? startDate.split("T")[0] : ""
      );
      if (!range) {
        return res.status(400).json({
          success: false,
          message: "Invalid startDate. Expected YYYY-MM-DD.",
        });
      }

      // Validate times
      if (!isValidTimeString(fromTime) || !isValidTimeString(toTime)) {
        return res.status(400).json({
          success: false,
          message: "Invalid time format. Use HH:MM (24-hour).",
        });
      }
      if (timeToMinutes(toTime) <= timeToMinutes(fromTime)) {
        return res.status(400).json({
          success: false,
          message: "toTime must be after fromTime",
        });
      }

      // At least one of doctorId or roomId must be provided
      const hasDoctor =
        doctorId && isValidObjectIdString(doctorId) ? doctorId.trim() : null;
      const hasRoom =
        roomId && isValidObjectIdString(roomId) ? roomId.trim() : null;
      if (!hasDoctor && !hasRoom) {
        return res.status(400).json({
          success: false,
          message: "At least one of doctorId or roomId is required",
        });
      }

      // Determine role to record (map agent/doctorStaff to broader enum)
      const recordedRole = (() => {
        const r = clinicUser.role;
        if (r === "admin") return "admin";
        if (r === "clinic") return "clinic";
        if (r === "doctor") return "doctor";
        // agent, doctorStaff, staff all fall under staff bucket for the enum
        if (r === "agent" || r === "doctorStaff" || r === "staff")
          return "staff";
        return null;
      })();

      const blockedSlot = await BlockedSlot.create({
        clinicId,
        doctorId: hasDoctor || undefined,
        roomId: hasRoom || undefined,
        startDate: range.startOfDay,
        fromTime,
        toTime,
        reason: typeof reason === "string" ? reason.trim() : "",
        blockedByRole: recordedRole,
        blockedByUserId: clinicUser._id,
        blockedByName:
          clinicUser.name ||
          clinicUser.fullName ||
          clinicUser.email ||
          "Unknown",
        blockedAt: new Date(),
        isActive: true,
      });

      return res.status(201).json({
        success: true,
        message: "Time slot blocked successfully",
        blockedSlot: {
          _id: blockedSlot._id.toString(),
          clinicId: blockedSlot.clinicId.toString(),
          doctorId: blockedSlot.doctorId
            ? blockedSlot.doctorId.toString()
            : null,
          roomId: blockedSlot.roomId ? blockedSlot.roomId.toString() : null,
          startDate: blockedSlot.startDate,
          fromTime: blockedSlot.fromTime,
          toTime: blockedSlot.toTime,
          reason: blockedSlot.reason || "",
          isActive: blockedSlot.isActive !== false,
          blockedByRole: blockedSlot.blockedByRole || null,
          blockedByName: blockedSlot.blockedByName || null,
          blockedAt: blockedSlot.blockedAt || null,
        },
      });
    }

    res.setHeader("Allow", ["GET", "POST"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Error in blocked-slots API:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}

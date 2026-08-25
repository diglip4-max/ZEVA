import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Users from "../../../models/Users";
import DoctorDepartment from "../../../models/DoctorDepartment";
import { getUserFromReq } from "../lead-ms/auth";

/**
 * GET /api/agent/open-slots?date=YYYY-MM-DD
 *
 * Returns unfilled afternoon time slots grouped by doctor.
 *
 * Role scoping:
 *   - Doctor / doctorStaff → only that doctor's open slots
 *   - Agent / staff / admin → all doctors' open slots in the clinic
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       doctors: [
 *         {
 *           doctorId: "...",
 *           name: "Dr. Mehta",
 *           department: "Dermatology",
 *           initials: "MH",
 *           slots: [
 *             { time: "2:30 PM", fromTime: "14:30" },
 *             { time: "4:30 PM", fromTime: "16:30" },
 *           ],
 *         },
 *         ...
 *       ],
 *       totalSlots: 15,
 *     }
 *   }
 */

// ─── helpers ────────────────────────────────────────────────────────────

function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getDayRange(dateObj) {
  const start = new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      0, 0, 0, 0,
    ),
  );
  const end = new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      23, 59, 59, 999,
    ),
  );
  return { start, end };
}

function getTimezoneSafeDayRange(dayStart, dayEnd) {
  const OFFSET_MS = 18 * 60 * 60 * 1000;
  return {
    start: new Date(dayStart.getTime() - OFFSET_MS),
    end: new Date(dayEnd.getTime() + OFFSET_MS),
  };
}

function formatTime12(t) {
  if (!t || typeof t !== "string") return "";
  const [hStr, mStr] = t.split(":");
  let h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return t;
  const period = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, "0")} ${period}`;
}

function buildInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const initialsColors = [
  "bg-indigo-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-sky-500",
  "bg-purple-500",
];

function colorForName(name) {
  if (!name) return initialsColors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return initialsColors[Math.abs(hash) % initialsColors.length];
}

// ─── handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // 1. Auth
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. AuthZ
    const allowedRoles = ["agent", "doctorStaff", "doctor", "staff", "admin"];
    if (!allowedRoles.includes(me.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // 3. Resolve clinic
    if (me.role !== "admin" && !me.clinicId) {
      return res.status(403).json({ success: false, message: "User not linked to a clinic" });
    }
    const clinicObjectId =
      me.role === "admin"
        ? req.query.clinicId && mongoose.Types.ObjectId.isValid(req.query.clinicId)
          ? new mongoose.Types.ObjectId(req.query.clinicId)
          : null
        : new mongoose.Types.ObjectId(me.clinicId.toString());
    if (!clinicObjectId) {
      return res.status(400).json({ success: false, message: "Unable to resolve clinicId" });
    }

    // 4. Resolve date
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

    // 5. Role scoping
    const doctorScopedRoles = ["doctorStaff", "doctor"];
    const isDoctorScoped = doctorScopedRoles.includes(me.role);

    // 6. Find doctors to show open slots for
    const baseMatch = {
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
    };
    
    let activeDoctorIds = [];
    
    if (isDoctorScoped) {
      // Doctor login: only this doctor
      activeDoctorIds = [me._id];
    } else {
      // Agent/staff/admin login: ALL doctors in the clinic
      const allClinicDoctors = await Users.find({
        clinicId: clinicObjectId,
        role: { $in: ["doctor", "doctorStaff"] },
        status: { $ne: "inactive" },
      })
        .select("_id")
        .lean();
      activeDoctorIds = allClinicDoctors.map((d) => d._id);
    }

    if (activeDoctorIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: { doctors: [], totalSlots: 0 },
      });
    }

    // 7. Build afternoon time grid (12:00 → 16:30 in 30-min steps)
    const afternoonGrid = [];
    for (let h = 12; h < 17; h++) {
      afternoonGrid.push(`${String(h).padStart(2, "0")}:00`);
      afternoonGrid.push(`${String(h).padStart(2, "0")}:30`);
    }

    // 8. Find all booked (non-cancelled) appointments in the afternoon
    const bookedAppointments = await Appointment.find({
      ...baseMatch,
      doctorId: { $in: activeDoctorIds },
      fromTime: { $gte: "12:00", $lt: "17:00" },
      status: { $nin: ["Cancelled", "Rejected", "No Show"] },
    })
      .select("doctorId fromTime")
      .lean();

    // Build a set of "doctorId|fromTime" keys for booked slots
    const bookedKeySet = new Set();
    for (const apt of bookedAppointments) {
      if (!apt.doctorId || !apt.fromTime) continue;
      bookedKeySet.add(`${apt.doctorId.toString()}|${apt.fromTime}`);
    }

    // 9. Find unfilled slots per doctor
    const unfilledByDoctor = {};
    for (const docId of activeDoctorIds) {
      const docIdStr = docId.toString();
      unfilledByDoctor[docIdStr] = [];
      for (const slot of afternoonGrid) {
        if (!bookedKeySet.has(`${docIdStr}|${slot}`)) {
          unfilledByDoctor[docIdStr].push({
            time: formatTime12(slot),
            fromTime: slot,
          });
        }
      }
    }

    // 10. Populate doctor names and departments
    const [doctors, departments] = await Promise.all([
      Users.find({ _id: { $in: activeDoctorIds } }).select("name").lean(),
      DoctorDepartment.find({ doctorId: { $in: activeDoctorIds } }).select("doctorId name").lean(),
    ]);

    const doctorNameById = new Map(doctors.map((d) => [d._id.toString(), d.name || "Doctor"]));
    const deptByDoctor = new Map();
    departments.forEach((d) => {
      if (!deptByDoctor.has(d.doctorId?.toString())) {
        deptByDoctor.set(d.doctorId?.toString(), d.name || "");
      }
    });

    // 11. Build the response grouped by doctor
    const doctorResults = activeDoctorIds
      .map((docId) => {
        const docIdStr = docId.toString();
        const slots = unfilledByDoctor[docIdStr] || [];
        if (slots.length === 0) return null;

        const rawName = doctorNameById.get(docIdStr) || "Doctor";
        const name = `Dr. ${rawName}`;
        const department = deptByDoctor.get(docIdStr) || "";

        return {
          doctorId: docIdStr,
          name,
          department,
          initials: buildInitials(rawName),
          initialsBg: colorForName(rawName),
          slots,
        };
      })
      .filter(Boolean);

    const totalSlots = doctorResults.reduce((sum, d) => sum + d.slots.length, 0);

    return res.status(200).json({
      success: true,
      data: {
        doctors: doctorResults,
        totalSlots,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal Server Error" });
  }
}

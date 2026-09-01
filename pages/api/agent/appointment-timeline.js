import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Users from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import DoctorDepartment from "../../../models/DoctorDepartment";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq } from "../lead-ms/auth";

/**
 * GET /api/agent/appointment-timeline?date=YYYY-MM-DD
 *
 * Returns today's appointments with status counts for the
 * Appointment Timeline card on the staff dashboard.
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       statusCounts: [
 *         { status: "booked", count: 12, label: "Booked" },
 *         { status: "Arrived", count: 5, label: "Arrived" },
 *         ...
 *       ],
 *       total: 38,
 *       appointments: [
 *         {
 *           _id: "...",
 *           time: "09:30 AM",
 *           patientName: "Sarah Ahmed",
 *           initials: "SA",
 *           department: "Dermatology",
 *           doctorName: "Dr. Mehta",
 *           status: "booked",
 *         },
 *         ...
 *       ]
 *     }
 *   }
 */

// ─── helpers ────────────────────────────────────────────────────────────

/** Parse a YYYY-MM-DD string into a Date (UTC midnight). */
function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Returns the local-day start/end as UTC datetimes. */
function getDayRange(dateObj) {
  const start = new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
  const end = new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
  return { start, end };
}

/**
 * Expand a UTC day range so it covers any timezone's interpretation
 * of "that date". ±18 hours covers every real-world timezone.
 */
function getTimezoneSafeDayRange(dayStart, dayEnd) {
  const OFFSET_MS = 18 * 60 * 60 * 1000;
  return {
    start: new Date(dayStart.getTime() - OFFSET_MS),
    end: new Date(dayEnd.getTime() + OFFSET_MS),
  };
}

/** Build initials from a full name (up to 2 characters, uppercase). */
function buildInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || "?";
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Human-readable label for each appointment status. */
function getStatusLabel(status) {
  const labels = {
    booked: "Booked",
    enquiry: "Enquiry",
    Discharge: "Discharged",
    Arrived: "Arrived",
    Consultation: "Consultation",
    Cancelled: "Cancelled",
    Approved: "Approved",
    Rescheduled: "Rescheduled",
    Waiting: "Waiting",
    Rejected: "Rejected",
    Completed: "Completed",
    invoice: "Invoiced",
    "No Show": "No Show",
  };
  return labels[status] || status;
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

    // 2. AuthZ — same roles as zeva-recommends
    const allowedRoles = ["agent", "doctorStaff", "doctor", "staff", "admin", "clinic"];
    if (!allowedRoles.includes(me.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // 3. Resolve clinic
    let resolvedClinicId = null;
    if (me.role === "admin") {
      resolvedClinicId =
        req.query.clinicId && mongoose.Types.ObjectId.isValid(req.query.clinicId)
          ? new mongoose.Types.ObjectId(req.query.clinicId)
          : null;
    } else if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
      if (!clinic) {
        return res.status(403).json({ success: false, message: "Clinic not found for this user" });
      }
      resolvedClinicId = new mongoose.Types.ObjectId(clinic._id.toString());
    } else if (me.clinicId) {
      resolvedClinicId = new mongoose.Types.ObjectId(me.clinicId.toString());
    }
    if (!resolvedClinicId) {
      return res
        .status(403)
        .json({ success: false, message: "User not linked to a clinic" });
    }
    const clinicObjectId = resolvedClinicId;

    // 4. Resolve date — use exact single-day UTC range (no timezone expansion)
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);
    // Use the exact UTC day boundaries — do NOT expand with getTimezoneSafeDayRange
    // as it pulls in appointments from adjacent days (±18h = ~36h window).
    const safeStart = dayStart;
    const safeEnd = dayEnd;

    // 5. Role scoping
    const doctorScopedRoles = ["doctorStaff", "doctor"];
    const isDoctorScoped = doctorScopedRoles.includes(me.role);

    // 6. Build base match filter
    const matchFilter = {
      clinicId: clinicObjectId,
      startDate: { $gte: safeStart, $lte: safeEnd },
    };
    if (isDoctorScoped) {
      matchFilter.doctorId = me._id;
    }

    // 7. Fetch status counts via aggregation (only statuses with count > 0)
    const statusAgg = await Appointment.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 0 } } },
      { $sort: { count: -1 } },
    ]);

    const total = statusAgg.reduce((sum, s) => sum + s.count, 0);

    const statusCounts = statusAgg.map((s) => ({
      status: s._id,
      count: s.count,
      label: getStatusLabel(s._id),
    }));

    // 8. Fetch all appointments for the timeline list
    const appointments = await Appointment.find(matchFilter)
      .sort({ fromTime: 1 })
      .lean();

    // 9. Populate patient names, doctor names, and departments in bulk
    const patientIds = [...new Set(appointments.map((a) => a.patientId?.toString()).filter(Boolean))];
    const doctorIds = [...new Set(appointments.map((a) => a.doctorId?.toString()).filter(Boolean))];

    const [patients, doctors, departments] = await Promise.all([
      PatientRegistration.find({ _id: { $in: patientIds } })
        .select("firstName lastName")
        .lean(),
      Users.find({ _id: { $in: doctorIds } })
        .select("name")
        .lean(),
      DoctorDepartment.find({ doctorId: { $in: doctorIds } })
        .select("doctorId name")
        .lean(),
    ]);

    // Build lookup maps
    const patientMap = {};
    patients.forEach((p) => {
      patientMap[p._id.toString()] = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown";
    });

    const doctorMap = {};
    doctors.forEach((d) => {
      doctorMap[d._id.toString()] = d.name ? `Dr. ${d.name}` : "Unknown";
    });

    const deptMap = {};
    departments.forEach((d) => {
      if (!deptMap[d.doctorId?.toString()]) {
        deptMap[d.doctorId?.toString()] = d.name || "";
      }
    });

    // 10. Format appointments for the timeline
    const formattedAppointments = appointments.map((apt) => {
      const patientName = patientMap[apt.patientId?.toString()] || "Unknown Patient";
      const doctorName = doctorMap[apt.doctorId?.toString()] || "";
      const department = deptMap[apt.doctorId?.toString()] || "";

      // Format time from "HH:MM" to "h:MM AM/PM"
      let timeStr = apt.fromTime || "";
      if (timeStr) {
        const [hStr, mStr] = timeStr.split(":");
        let h = parseInt(hStr, 10);
        const ampm = h >= 12 ? "PM" : "AM";
        h = h % 12 || 12;
        timeStr = `${h}:${mStr} ${ampm}`;
      }

      return {
        _id: apt._id.toString(),
        time: timeStr,
        fromTimeRaw: apt.fromTime || "",
        toTimeRaw: apt.toTime || "",
        patientName,
        initials: buildInitials(patientName),
        department,
        doctorName,
        status: apt.status,
        statusLabel: getStatusLabel(apt.status),
      };
    });

    // 11. Build waiting room list — all appointments with status "Waiting"
    //     Waiting time = gap between toTime and fromTime (slot duration).
    const waitingRoom = formattedAppointments
      .filter((apt) => apt.status === "Waiting")
      .map((apt) => {
        // Calculate slot duration: toTime - fromTime in minutes
        let waitMinutes = 0;
        if (apt.fromTimeRaw && apt.toTimeRaw) {
          const [fH, fM] = apt.fromTimeRaw.split(":").map(Number);
          const [tH, tM] = apt.toTimeRaw.split(":").map(Number);
          const fromMinutes = fH * 60 + fM;
          const toMinutes = tH * 60 + tM;
          waitMinutes = Math.max(0, toMinutes - fromMinutes);
        }

        return {
          _id: apt._id,
          patientName: apt.patientName,
          initials: apt.initials,
          doctorName: apt.doctorName,
          department: apt.department,
          fromTime: apt.time,
          waitMinutes,
          waitLabel: waitMinutes > 0 ? `${waitMinutes} min wait` : "On time",
        };
      });

    // 12. Win-Back patients — find patients whose LAST visit (any status)
    //     was 30, 60, or 90+ days ago. Uses ALL appointments (not just today).
    const winBackMatch = { clinicId: clinicObjectId, patientId: { $ne: null } };
    if (isDoctorScoped) {
      winBackMatch.doctorId = me._id;
    }

    const lastVisitAgg = await Appointment.aggregate([
      { $match: winBackMatch },
      {
        $group: {
          _id: "$patientId",
          lastVisit: { $max: "$startDate" },
        },
      },
    ]);

    // Bucket patients by days since last visit
    const now = new Date();
    const buckets = { d30: [], d60: [], d90: [] };
    const winBackPatientIds = [];

    lastVisitAgg.forEach((entry) => {
      const lastVisit = entry.lastVisit ? new Date(entry.lastVisit) : null;
      if (!lastVisit) return;
      const daysSince = Math.floor((now - lastVisit) / (1000 * 60 * 60 * 24));
      if (daysSince >= 30) {
        winBackPatientIds.push(entry._id);
        if (daysSince < 60) {
          buckets.d30.push({ patientId: entry._id, daysSince, lastVisit: lastVisit.toISOString() });
        } else if (daysSince < 90) {
          buckets.d60.push({ patientId: entry._id, daysSince, lastVisit: lastVisit.toISOString() });
        } else {
          buckets.d90.push({ patientId: entry._id, daysSince, lastVisit: lastVisit.toISOString() });
        }
      }
    });

    // Fetch patient names for win-back patients
    let winBackPatientMap = {};
    if (winBackPatientIds.length > 0) {
      const winBackPatients = await PatientRegistration.find({
        _id: { $in: winBackPatientIds },
      })
        .select("firstName lastName")
        .lean();
      winBackPatients.forEach((p) => {
        winBackPatientMap[p._id.toString()] =
          `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown";
      });
    }

    const formatWinBackList = (items) =>
      items.map((item) => ({
        patientId: item.patientId?.toString(),
        patientName: winBackPatientMap[item.patientId?.toString()] || "Unknown",
        initials: buildInitials(winBackPatientMap[item.patientId?.toString()] || ""),
        daysSince: item.daysSince,
        lastVisit: item.lastVisit,
      }));

    const winBack = {
      stats: [
        { label: "30 days", count: buckets.d30.length },
        { label: "60 days", count: buckets.d60.length },
        { label: "90 days", count: buckets.d90.length },
      ],
      patients: [
        ...formatWinBackList(buckets.d30),
        ...formatWinBackList(buckets.d60),
        ...formatWinBackList(buckets.d90),
      ],
    };

    // 13. Follow-ups data — high intent patient (most appointments)
    const highIntentMatch = { clinicId: clinicObjectId, patientId: { $ne: null } };
    if (isDoctorScoped) {
      highIntentMatch.doctorId = me._id;
    }

    const highIntentAgg = await Appointment.aggregate([
      { $match: highIntentMatch },
      {
        $group: {
          _id: "$patientId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]);

    let highIntent = { patientName: null, count: 0 };
    if (highIntentAgg.length > 0 && highIntentAgg[0]._id) {
      const topPatient = await PatientRegistration.findById(highIntentAgg[0]._id)
        .select("firstName lastName")
        .lean();
      const name = topPatient
        ? `${topPatient.firstName || ""} ${topPatient.lastName || ""}`.trim()
        : "Unknown";
      highIntent = {
        patientId: highIntentAgg[0]._id?.toString(),
        patientName: name || "Unknown",
        count: highIntentAgg[0].count,
      };
    }

    // Extract booked count from statusCounts for revisit due
    const bookedCount = statusCounts.find((s) => s.status === "booked")?.count || 0;

    const followUps = {
      highIntent,
      revisitDue: bookedCount,
    };

    return res.status(200).json({
      success: true,
      data: {
        statusCounts,
        total,
        appointments: formattedAppointments,
        waitingRoom,
        winBack,
        followUps,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal Server Error" });
  }
}

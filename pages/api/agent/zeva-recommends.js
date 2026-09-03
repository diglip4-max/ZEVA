import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Lead from "../../../models/Lead";
import Users from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import DoctorDepartment from "../../../models/DoctorDepartment";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq } from "../lead-ms/auth";

/**
 * GET /api/agent/zeva-recommends?date=YYYY-MM-DD
 *
 * Returns data for the "ZEVA RECOMMENDS" card on the staff dashboard.
 *
 * Role-aware behaviour:
 *   - Doctor / doctorStaff → show the doctor's name + department,
 *     scope the top-patient aggregation to that doctor's bookings.
 *   - Agent / staff / admin → hide doctor info (null), scope the
 *     top-patient aggregation clinic-wide.
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       doctorName: "Dr. Mehta" | null,
 *       departmentName: "Dermatology" | null,
 *       topPatient: {
 *         name: "Sarah Ahmed",
 *         initials: "SA",
 *         visitCount: 12,           // total visits (all statuses)
 *         percentage: 34,           // share of total visits
 *         totalVisits: 35,
 *       } | null,
 *       hasFollowUpToday: boolean,
 *       followUpLeads: [
 *         { name: "Maria Joseph" },
 *         { name: "John Doe" },
 *       ],
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

// ─── section fetchers ───────────────────────────────────────────────────

/**
 * Resolve the doctor's display name + department for the header.
 * Returns null for both when the user is not a doctor.
 */
async function fetchDoctorInfo({ me, isDoctorScoped }) {
  if (!isDoctorScoped) {
    return { doctorName: null, departmentName: null };
  }

  // The doctor's name lives on the Users collection.
  const doctor = await Users.findById(me._id || me.doctorId)
    .select("name")
    .lean();
  const doctorName = doctor?.name ? `Dr. ${doctor.name}` : null;

  // Department: the DoctorDepartment model links a doctor to one or
  // more departments. We pick the first one (most doctors have only
  // one). The `name` field is the department's display name.
  const dept = await DoctorDepartment.findOne({ doctorId: me._id })
    .select("name")
    .lean();
  const departmentName = dept?.name || null;

  return { doctorName, departmentName };
}

/**
 * Find the patient with the most visits (appointments).
 *
 * Counts ALL appointment statuses (booked, Arrived, Discharge,
 * Completed, Consultation, etc.) — not just "booked" — because
 * "most visited" means the patient who has come in the most,
 * regardless of the current status of each appointment.
 *
 * Excludes only the statuses that do NOT represent a real visit:
 *   - "Cancelled"  — appointment was called off
 *   - "No Show"    — patient never arrived
 *   - "Rejected"   — appointment was declined
 *   - "enquiry"    — pre-booking enquiry, not an appointment yet
 *
 * Doctor-scoped → only appointments where doctorId = me._id.
 * Clinic-wide   → every appointment for this clinic.
 *
 * The percentage is the patient's share of the total valid
 * appointments (round to integer). Returns null when there are
 * no appointments.
 */
async function fetchTopPatient({ clinicObjectId, isDoctorScoped, me }) {
  // Statuses that should NOT count as a "visit".
  const EXCLUDED_STATUSES = ["Cancelled", "No Show", "Rejected", "enquiry"];

  const match = {
    clinicId: clinicObjectId,
    status: { $nin: EXCLUDED_STATUSES },
  };
  if (isDoctorScoped) match.doctorId = me._id;

  // Aggregate: group by patientId, count visits, sort desc, take 1.
  const agg = await Appointment.aggregate([
    { $match: match },
    {
      $group: {
        _id: "$patientId",
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 1 },
  ]);

  if (!agg.length || !agg[0]._id) return null;

  const topCount = agg[0].count;

  // Total valid visits (for the percentage calculation).
  const totalVisits = await Appointment.countDocuments(match);
  const percentage =
    totalVisits > 0 ? Math.round((topCount / totalVisits) * 100) : 0;

  // Populate the patient's name.
  const patient = await PatientRegistration.findById(agg[0]._id)
    .select("firstName lastName")
    .lean();
  const name =
    `${patient?.firstName || ""} ${patient?.lastName || ""}`.trim() ||
    "Unknown patient";
  const initials = buildInitials(name);

  return {
    name,
    initials,
    visitCount: topCount,
    percentage,
    totalVisits,
  };
}

/**
 * Find every lead with a follow-up scheduled for the target day.
 *
 * The Lead model stores follow-ups in two arrays:
 *   - followUps[].date      — historical follow-up dates
 *   - nextFollowUps[].date  — upcoming follow-up dates
 *
 * We check both, using a timezone-safe day range so we don't miss
 * leads stored in a different UTC offset. Returns the full list
 * (not just the first) so the UI can show every lead that needs
 * attention today.
 */
async function fetchFollowUpToday({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me }) {
  const { start, end } = getTimezoneSafeDayRange(dayStart, dayEnd);

  const match = {
    clinicId: clinicObjectId,
    $or: [
      { "followUps.date": { $gte: start, $lte: end } },
      { "nextFollowUps.date": { $gte: start, $lte: end } },
    ],
  };
  if (isDoctorScoped) {
    // Only leads assigned to this doctor.
    match["assignedTo.user"] = me._id;
  }

  const leads = await Lead.find(match)
    .select("name")
    .sort({ name: 1 })
    .lean();

  const followUpLeads = leads.map((l) => ({ name: l.name || "Unknown" }));

  return {
    hasFollowUpToday: followUpLeads.length > 0,
    followUpLeads,
  };
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

    // 2. AuthZ — same roles as priorities
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

    // 4. Resolve date
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

    // 5. Role scoping
    const doctorScopedRoles = ["doctorStaff", "doctor"];
    const isDoctorScoped = doctorScopedRoles.includes(me.role);

    // 6. Run all 3 fetches in parallel
    const [doctorInfo, topPatient, followUpInfo] = await Promise.all([
      fetchDoctorInfo({ me, isDoctorScoped }),
      fetchTopPatient({ clinicObjectId, isDoctorScoped, me }),
      fetchFollowUpToday({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        ...doctorInfo,
        topPatient,
        ...followUpInfo,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal Server Error" });
  }
}

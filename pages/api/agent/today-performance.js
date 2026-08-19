import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Billing from "../../../models/Billing";
import Lead from "../../../models/Lead";
import PatientRegistration from "../../../models/PatientRegistration";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";

/**
 * GET /api/agent/today-performance?date=YYYY-MM-DD
 *
 * Returns today's performance metrics for the staff dashboard:
 *   1. Bookings — slots booked vs total available
 *   2. Revenue Booked — total revenue from today's appointments (via Billing)
 *   3. Lead → Booking — count of leads converted to patients with appointments
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       bookings: { booked: 31, totalSlots: 40, percent: 77.5 },
 *       revenue: { amount: 18420 },
 *       leadBooking: { count: 5, totalLeads: 20, percent: 25 },
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

/**
 * Parse time string (e.g., "09:00 AM", "06:00 PM", "14:30") to minutes since midnight
 */
function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  
  // Try 12-hour format first (e.g., "09:00 AM", "06:00 PM")
  const match12 = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    
    return hours * 60 + minutes;
  }
  
  // Try 24-hour format (e.g., "14:30", "09:00")
  const match24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  
  return null;
}

/**
 * Get clinic's operating hours for a specific date
 * Returns { openMinutes, closeMinutes } or null if clinic is closed
 */
async function getClinicOperatingHours(clinicId, targetDate) {
  const clinic = await Clinic.findById(clinicId).select("timings customTimeSlots").lean();
  if (!clinic) return null;
  
  // Check if clinic uses custom time slots
  if (clinic.customTimeSlots?.useCustomTimeSlots && clinic.customTimeSlots.customStartTime && clinic.customTimeSlots.customEndTime) {
    const openMinutes = parseTimeToMinutes(clinic.customTimeSlots.customStartTime);
    const closeMinutes = parseTimeToMinutes(clinic.customTimeSlots.customEndTime);
    if (openMinutes !== null && closeMinutes !== null) {
      return { openMinutes, closeMinutes };
    }
  }
  
  // Get day of week from target date
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = dayNames[targetDate.getUTCDay()];
  
  // Find timing for this day
  const dayTiming = clinic.timings?.find(t => t.day === dayName);
  if (!dayTiming || !dayTiming.isOpen) {
    return null; // Clinic is closed
  }
  
  const openMinutes = parseTimeToMinutes(dayTiming.openingTime);
  const closeMinutes = parseTimeToMinutes(dayTiming.closingTime);
  
  if (openMinutes === null || closeMinutes === null) {
    return null;
  }
  
  return { openMinutes, closeMinutes };
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
      return res
        .status(403)
        .json({ success: false, message: "User not linked to a clinic" });
    }
    const clinicObjectId =
      me.role === "admin"
        ? req.query.clinicId && mongoose.Types.ObjectId.isValid(req.query.clinicId)
          ? new mongoose.Types.ObjectId(req.query.clinicId)
          : null
        : new mongoose.Types.ObjectId(me.clinicId.toString());
    if (!clinicObjectId) {
      return res
        .status(400)
        .json({ success: false, message: "Unable to resolve clinicId" });
    }

    // 4. Resolve date
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);
    const { start: safeStart, end: safeEnd } = getTimezoneSafeDayRange(dayStart, dayEnd);

    // 5. Role scoping
    const doctorScopedRoles = ["doctorStaff", "doctor"];
    const isDoctorScoped = doctorScopedRoles.includes(me.role);

    // ─── 1. BOOKINGS ───────────────────────────────────────────────────
    // Count today's appointments (all statuses)
    const appointmentMatch = {
      clinicId: clinicObjectId,
      startDate: { $gte: safeStart, $lte: safeEnd },
    };
    if (isDoctorScoped) {
      appointmentMatch.doctorId = me._id;
    }

    // Debug: Fetch and log all appointments being counted
    const debugAppointments = await Appointment.find(appointmentMatch)
      .select("_id doctorId fromTime status startDate patientId")
      .lean();
    // eslint-disable-next-line no-console
    console.log("[Bookings Debug] Query:", JSON.stringify(appointmentMatch, null, 2));
    // eslint-disable-next-line no-console
    console.log("[Bookings Debug] Total appointments counted:", debugAppointments.length);
    // eslint-disable-next-line no-console
    console.log("[Bookings Debug] Appointments list:", debugAppointments.map((a) => ({
      id: a._id,
      doctorId: a.doctorId?.toString(),
      fromTime: a.fromTime,
      status: a.status,
      startDate: a.startDate,
      patientId: a.patientId?.toString(),
    })));

    const bookedCount = debugAppointments.length;

    // Calculate total available slots based on clinic's operating hours
    // Fetch clinic timings for the selected date
    const operatingHours = await getClinicOperatingHours(clinicObjectId, targetDate);
    
    let slotsPerDoctor;
    if (operatingHours) {
      // Calculate slots based on clinic's operating hours (15-minute intervals)
      const operatingMinutes = operatingHours.closeMinutes - operatingHours.openMinutes;
      slotsPerDoctor = Math.floor(operatingMinutes / 15);
    } else {
      // Default: 6:00 AM to 12:00 AM (midnight) = 18 hours = 72 slots
      slotsPerDoctor = 72;
    }
    
    // Ensure at least 1 slot to avoid division by zero
    if (slotsPerDoctor < 1) slotsPerDoctor = 1;

    let totalSlots;

    if (isDoctorScoped) {
      // Single doctor
      totalSlots = slotsPerDoctor;
    } else {
      // All doctors: count distinct doctors with appointments today
      const activeDoctorMatch = {
        clinicId: clinicObjectId,
        startDate: { $gte: safeStart, $lte: safeEnd },
      };
      const activeDoctors = await Appointment.distinct(
        "doctorId",
        activeDoctorMatch,
      );
      // If no doctors have appointments, default to 1 doctor
      const doctorCount = activeDoctors.length > 0 ? activeDoctors.length : 1;
      totalSlots = doctorCount * slotsPerDoctor;
    }

    // Ensure totalSlots is at least the booked count
    if (totalSlots < bookedCount) {
      totalSlots = bookedCount;
    }

    const bookingsPercent = totalSlots > 0 ? Math.round((bookedCount / totalSlots) * 100 * 10) / 10 : 0;

    const bookings = {
      booked: bookedCount,
      totalSlots,
      percent: bookingsPercent,
    };

    // ─── 2. REVENUE BOOKED ─────────────────────────────────────────────
    // Sum of `paid` from Billing records linked to today's appointments
    const todayAppointments = await Appointment.find(appointmentMatch)
      .select("_id")
      .lean();
    const todayAppointmentIds = todayAppointments.map((a) => a._id);

    let revenueAmount = 0;
    if (todayAppointmentIds.length > 0) {
      const revenueAgg = await Billing.aggregate([
        {
          $match: {
            clinicId: clinicObjectId,
            appointmentId: { $in: todayAppointmentIds },
            status: { $nin: ["Cancelled", "Rejected"] },
          },
        },
        {
          $group: {
            _id: null,
            totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          },
        },
      ]);
      revenueAmount = Number(revenueAgg?.[0]?.totalPaid || 0);
    }

    const revenue = { amount: revenueAmount };

    // ─── 3. LEAD → BOOKING ─────────────────────────────────────────────
    // Find leads that have been converted to patients (patientId is set)
    // Then check if those patients have any appointment
    const leadMatch = { clinicId: clinicObjectId, patientId: { $ne: null } };

    const convertedLeads = await Lead.find(leadMatch)
      .select("patientId")
      .lean();

    const convertedPatientIds = convertedLeads
      .map((l) => l.patientId)
      .filter(Boolean);

    let leadBookingCount = 0;
    if (convertedPatientIds.length > 0) {
      // Count patients who have at least one appointment
      const patientsWithAppointments = await Appointment.distinct(
        "patientId",
        {
          clinicId: clinicObjectId,
          patientId: { $in: convertedPatientIds },
        },
      );
      leadBookingCount = patientsWithAppointments.length;
    }

    // Total leads for the clinic
    const totalLeads = await Lead.countDocuments({ clinicId: clinicObjectId });
    const leadPercent = totalLeads > 0 ? Math.round((leadBookingCount / totalLeads) * 100 * 10) / 10 : 0;

    const leadBooking = {
      count: leadBookingCount,
      totalLeads,
      percent: leadPercent,
    };

    return res.status(200).json({
      success: true,
      data: {
        bookings,
        revenue,
        leadBooking,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal Server Error" });
  }
}

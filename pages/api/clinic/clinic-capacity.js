import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import BlockedSlot from "../../../models/BlockedSlot";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/clinic-capacity?date=YYYY-MM-DD
 *
 * Calculates clinic capacity metrics for the selected date:
 *   - available: total slots across all doctors (15-min intervals × doctors)
 *   - booked: slots with any appointment (any status)
 *   - utilized: percentage (booked / available × 100)
 *   - unused: available - booked - blocked (empty slots)
 *   - primeTime: breakdown by time period (morning/afternoon/evening)
 */

const SLOT_INTERVAL_MINUTES = 15;

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
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999)
  );
  return { start, end };
}

function convert12HourTo24(t) {
  if (!t || typeof t !== "string") return "";
  const parts = t.trim().split(/\s+/);
  if (parts.length < 2) return "";
  const [time, period] = parts;
  const [hStr, mStr] = time.split(":");
  let h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  const p = period.toLowerCase();
  if (p.startsWith("p") && h < 12) h += 12;
  if (p.startsWith("a") && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseTimingsForDay(timings, dateStr) {
  if (!Array.isArray(timings) || !dateStr) return null;
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const dayIndex = d.getUTCDay();
  const dayName = DAYS[dayIndex];
  const entry = timings.find((t) => t && t.day === dayName);
  if (!entry || !entry.isOpen) return null;
  const start = convert12HourTo24(entry.openingTime || "");
  const end = convert12HourTo24(entry.closingTime || "");
  if (!start || !end) return null;
  return { startTime: start, endTime: end };
}

function timeStringToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

function minutesToTime24(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function generateTimeSlots(startTime, endTime) {
  const startMinutes = timeStringToMinutes(startTime);
  const endMinutes = timeStringToMinutes(endTime);
  if (startMinutes == null || endMinutes == null) return [];
  if (endMinutes <= startMinutes) return [];
  const slots = [];
  for (let current = startMinutes; current < endMinutes; current += SLOT_INTERVAL_MINUTES) {
    slots.push(minutesToTime24(current));
  }
  return slots;
}

function formatTime12h(time24) {
  if (!time24) return "";
  const [hStr, mStr] = time24.split(":");
  let h = parseInt(hStr, 10);
  const m = mStr;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
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
    const authUser = await getUserFromReq(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. AuthZ
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) {
      return res.status(404).json({ message: error });
    }

    if (!clinicId && authUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: authUser._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    }

    if (!clinicId) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());

    // 3. Parse date (legacy single `date` or `startDate`/`endDate` range;
    //    a one-sided or `date`-only input collapses to that single day)
    const requestedDate = parseDateInput(req.query.date);
    const fromDate = parseDateInput(req.query.startDate);
    const toDate = parseDateInput(req.query.endDate);
    const targetDate = toDate || fromDate || requestedDate || new Date();
    const dayStart = getDayRange(fromDate || targetDate).start;
    const dayEnd = getDayRange(toDate || targetDate).end;

    // 4. Get clinic timings (fetched once, reused for every day in the range)
    const clinicDoc = await Clinic.findById(clinicObjectId).select("timings").lean();

    // 5. Generate 15-minute time slots for EVERY day in the selected range
    //    (days the clinic is closed contribute no slots). A single-day
    //    range behaves exactly like the old single-date flow.
    const daySlotLists = [];
    for (
      let d = new Date(dayStart);
      d.getTime() <= dayEnd.getTime();
      d = new Date(d.getTime() + 24 * 60 * 60 * 1000)
    ) {
      const rangeDateStr = d.toISOString().slice(0, 10);
      const dayTiming = parseTimingsForDay(clinicDoc?.timings, rangeDateStr);
      if (!dayTiming) continue;
      const timeSlots = generateTimeSlots(dayTiming.startTime, dayTiming.endTime);
      if (timeSlots.length === 0) continue;
      daySlotLists.push({ dateStr: rangeDateStr, dayTiming, timeSlots });
    }

    if (daySlotLists.length === 0) {
      return res.status(200).json({
        success: true,
        data: { available: 0, booked: 0, utilized: 0, unused: 0, primeTime: [] },
      });
    }

    // 6. Get all doctors for the clinic
    const doctors = await User.find({
      clinicId: clinicObjectId,
      role: { $in: ["doctor", "doctorStaff"] },
      status: { $ne: "inactive" },
    })
      .select("_id name")
      .lean();

    const doctorIds = doctors.map((d) => d._id.toString());

    if (doctorIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: { available: 0, booked: 0, utilized: 0, unused: 0, primeTime: [] },
      });
    }

    // 7. Total available slots = Σ (daily slots × doctors)
    const totalAvailable =
      daySlotLists.reduce((sum, day) => sum + day.timeSlots.length, 0) * doctorIds.length;

    // 8. Fetch booked appointments AND blocked slots in parallel
    const [allAppointments, blockedSlots] = await Promise.all([
      Appointment.find({
        clinicId: clinicObjectId,
        startDate: { $gte: dayStart, $lte: dayEnd },
        doctorId: { $in: doctorIds.map((id) => new mongoose.Types.ObjectId(id)) },
        fromTime: { $ne: null },
      })
        .select("doctorId fromTime status startDate")
        .lean(),
      BlockedSlot.find({
        clinicId: clinicObjectId,
        startDate: { $gte: dayStart, $lte: dayEnd },
        isActive: { $ne: false },
      })
        .select("doctorId fromTime startDate")
        .lean(),
    ]);

    // 9. Build sets for booked and blocked — keys are date-scoped so the
    //    same (doctor, time) pair on different days never collides
    const bookedSet = new Set();
    for (const apt of allAppointments) {
      if (apt && apt.doctorId && apt.fromTime) {
        const aptDate = apt.startDate
          ? new Date(apt.startDate).toISOString().slice(0, 10)
          : daySlotLists[0].dateStr;
        bookedSet.add(`${aptDate}|${apt.doctorId.toString()}|${apt.fromTime}`);
      }
    }

    const blockedSet = new Set();
    for (const blk of blockedSlots) {
      if (blk && blk.doctorId && blk.fromTime) {
        const blkDate = blk.startDate
          ? new Date(blk.startDate).toISOString().slice(0, 10)
          : daySlotLists[0].dateStr;
        blockedSet.add(`${blkDate}|${blk.doctorId.toString()}|${blk.fromTime}`);
      }
    }

    const bookedCount = bookedSet.size;

    // 10. Unused = total available - booked - blocked (that aren't also booked)
    let unusedCount = 0;
    for (const day of daySlotLists) {
      for (const docId of doctorIds) {
        for (const slot of day.timeSlots) {
          const key = `${day.dateStr}|${docId}|${slot}`;
          if (!bookedSet.has(key) && !blockedSet.has(key)) {
            unusedCount++;
          }
        }
      }
    }

    // 11. Utilized percentage
    const utilizedPercent = totalAvailable > 0
      ? Math.round((bookedCount / totalAvailable) * 1000) / 10
      : 0;

    // 12. Prime-time breakdown — clamped to each day's actual clinic hours
    //     so every slot falls into exactly one bucket and the open counts
    //     sum to `unused`. Buckets accumulate across all days in the range;
    //     labels use the widest open/close hours seen in the range.
    let labelStartMins = null;
    let labelEndMins = null;
    const bucketTotals = { morning: 0, afternoon: 0, evening: 0 };
    const bucketBooked = { morning: 0, afternoon: 0, evening: 0 };

    const countBookedForDay = (dateStr, slotList) =>
      slotList.reduce((count, slot) => {
        return count + doctorIds.filter((docId) => bookedSet.has(`${dateStr}|${docId}|${slot}`)).length;
      }, 0);

    for (const day of daySlotLists) {
      const clinicStartMins = timeStringToMinutes(day.dayTiming.startTime);
      const clinicEndMins = timeStringToMinutes(day.dayTiming.endTime);
      if (labelStartMins === null || clinicStartMins < labelStartMins) labelStartMins = clinicStartMins;
      if (labelEndMins === null || clinicEndMins > labelEndMins) labelEndMins = clinicEndMins;

      // Bucket boundaries — morning always starts at clinic open so every slot is covered
      const morningStart = clinicStartMins;
      const morningEnd = Math.min(timeStringToMinutes("12:00"), clinicEndMins);
      const afternoonStart = Math.max(timeStringToMinutes("12:00"), clinicStartMins);
      const afternoonEnd = Math.min(timeStringToMinutes("17:00"), clinicEndMins);
      const eveningStart = Math.max(timeStringToMinutes("17:00"), clinicStartMins);
      const eveningEnd = Math.min(timeStringToMinutes("22:00"), clinicEndMins);

      const filterByRange = (startMins, endMins) =>
        day.timeSlots.filter((t) => {
          const mins = timeStringToMinutes(t);
          return mins >= startMins && mins < endMins;
        });

      const morningSlotList = morningStart < morningEnd ? filterByRange(morningStart, morningEnd) : [];
      const afternoonSlotList = afternoonStart < afternoonEnd ? filterByRange(afternoonStart, afternoonEnd) : [];
      const eveningSlotList = eveningStart < eveningEnd ? filterByRange(eveningStart, eveningEnd) : [];

      bucketTotals.morning += morningSlotList.length * doctorIds.length;
      bucketBooked.morning += countBookedForDay(day.dateStr, morningSlotList);
      bucketTotals.afternoon += afternoonSlotList.length * doctorIds.length;
      bucketBooked.afternoon += countBookedForDay(day.dateStr, afternoonSlotList);
      bucketTotals.evening += eveningSlotList.length * doctorIds.length;
      bucketBooked.evening += countBookedForDay(day.dateStr, eveningSlotList);
    }

    const morningStart = labelStartMins;
    const morningEnd = Math.min(timeStringToMinutes("12:00"), labelEndMins);
    const afternoonStart = Math.max(timeStringToMinutes("12:00"), labelStartMins);
    const afternoonEnd = Math.min(timeStringToMinutes("17:00"), labelEndMins);
    const eveningStart = Math.max(timeStringToMinutes("17:00"), labelStartMins);
    const eveningEnd = Math.min(timeStringToMinutes("22:00"), labelEndMins);

    const primeTime = [
      {
        label: "Morning",
        range: `${formatTime12h(minutesToTime24(morningStart))} - ${formatTime12h(minutesToTime24(morningEnd))}`,
        totalSlots: bucketTotals.morning,
        booked: bucketBooked.morning,
      },
      {
        label: "Afternoon",
        range: `${formatTime12h(minutesToTime24(afternoonStart))} - ${formatTime12h(minutesToTime24(afternoonEnd))}`,
        totalSlots: bucketTotals.afternoon,
        booked: bucketBooked.afternoon,
      },
      {
        label: "Evening",
        range: `${formatTime12h(minutesToTime24(eveningStart))} - ${formatTime12h(minutesToTime24(eveningEnd))}`,
        totalSlots: bucketTotals.evening,
        booked: bucketBooked.evening,
      },
    ]
      .filter((period) => period.totalSlots > 0)
      .map((period) => ({
        ...period,
        open: period.totalSlots - period.booked,
        utilization: period.totalSlots > 0
          ? Math.round((period.booked / period.totalSlots) * 100)
          : 0,
      }));

    return res.status(200).json({
      success: true,
      data: {
        available: totalAvailable,
        booked: bookedCount,
        utilized: utilizedPercent,
        unused: unusedCount,
        primeTime,
      },
    });
  } catch (err) {
    console.error("Error in clinic-capacity:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

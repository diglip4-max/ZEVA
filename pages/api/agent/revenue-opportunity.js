import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import PatientRegistration from "../../../models/PatientRegistration";
import Service from "../../../models/Service";
import Billing from "../../../models/Billing";
import Lead from "../../../models/Lead";
import Segment from "../../../models/Segment";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import BlockedSlot from "../../../models/BlockedSlot";
import { getUserFromReq } from "../lead-ms/auth";

/**
 * GET /api/agent/revenue-opportunity?date=YYYY-MM-DD
 *
 * Returns the revenue opportunity for the selected date (default: today).
 *
 * Response shape:
 *   data: {
 *     date                — ISO date string of the selected date
 *     isToday             — true if the selected date is today
 *     scope               — "doctor" | "clinic"
 *     totalPotential      — sum of treatment + expired package revenue
 *     recoveredSoFar      — sum(paid) from billings for the selected date
 *     progressPercent     — recovered / potential * 100
 *     percentChangeVsYesterday
 *     highValueActions
 *     todaysAppointmentsCount
 *     expiredPackagesCount
 *     treatmentRevenue
 *     expiredPackageRevenue
 *     yesterdayPotential
 *     hotLeadsCount       — leads in segments whose name matches /hot lead/i
 *     followUpsCount      — leads with status "Follow-up" and follow-up due
 *     slotRecoveryCount   — number of (doctor, fromTime) tuples within the
 *                            clinic's operating hours on the selected date
 *                            that have NO active appointment AND NO active
 *                            BlockedSlot. Mirrors the appointment calendar's
 *                            slot generation exactly. Scoped by role
 *                            (doctor's own slots for doctor/doctorStaff; all
 *                            doctors' slots for agent/staff/admin).
 *     categories: {
 *       hotLeads,
 *       followUps,
 *       packageRenewals,
 *       slotRecovery,
 *     },
 *   }
 *
 * Performance:
 *   - All independent queries run in parallel via Promise.all
 *   - Lead status filter is index-friendly
 *   - Segment name match uses case-insensitive regex with the indexed `name` field
 *   - Single Service.find for bulk price resolution (no N+1)
 */

const NON_REVENUE_STATUSES = ["Cancelled", "Rejected", "No Show"];
const NON_EXPIRED_PACKAGE_STATUSES = ["Cancelled"];

const FOLLOWUP_STATUS = "Follow-up";
const HOT_LEAD_SEGMENT_REGEX = /hot\s*lead/i;

// Mirrors the appointment page's calendar slot generation. 30-minute
// increments between openingTime and closingTime (24h "HH:MM" strings).
const SLOT_INTERVAL_MINUTES = 30;

/** Convert a 12-hour "HH:MM AM/PM" string to a 24-hour "HH:MM" string. */
function convert12HourTo24(t) {
  if (!t) return "";
  if (!/AM|PM/i.test(t)) return t; // already in 24h format
  const match = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return "";
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && h !== 12) h += 12;
  else if (period === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${m}`;
}

/** Convert a 24-hour "HH:MM" string into total minutes since midnight. */
function timeStringToMinutes(time24) {
  if (!time24 || typeof time24 !== "string") return null;
  const parts = time24.split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** Convert minutes since midnight back into a 24-hour "HH:MM" string. */
function minutesToTime24(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Generate the list of "HH:MM" 24-hour slot start times between
 * `startTime` and `endTime` (both "HH:MM"), stepped by
 * SLOT_INTERVAL_MINUTES. Matches the appointment calendar exactly.
 */
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

/**
 * Look up the clinic's opening/closing time for a specific date from
 * the weekly `clinic.timings` array. Returns null when the clinic is
 * closed on that day or the timings array is missing/malformed.
 */
function parseTimingsForDay(timings, dateStr) {
  if (!Array.isArray(timings) || !dateStr) return null;
  const DAYS = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  let dayIndex;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    // Match the clinic appointment page: parse as a local date so the
    // day-of-week aligns with what the user sees on the calendar
    // (i.e. `.getDay()`, not `.getUTCDay()`, since the page also uses
    // local time).
    dayIndex = new Date(`${dateStr}T00:00:00`).getDay();
  } else {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    dayIndex = d.getDay();
  }
  const dayName = DAYS[dayIndex];
  const entry = timings.find((t) => t && t.day === dayName);
  if (!entry || !entry.isOpen) return null;
  const start = convert12HourTo24(entry.openingTime || "");
  const end = convert12HourTo24(entry.closingTime || "");
  if (!start || !end) return null;
  return { startTime: start, endTime: end };
}
/** Parse a YYYY-MM-DD string into a Date, or return null if invalid. */
function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Returns UTC start-of-day and end-of-day for a given Date. */
function getDayRange(dateObj) {
  const start = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999),
  );
  return { start, end };
}

/** Returns the day-range pair for "today" (server local date in UTC). */
function getTodayRange() {
  return getDayRange(new Date());
}

/** Returns the day-range pair for the day before the given Date. */
function getPreviousDayRange(refDate) {
  const prev = new Date(refDate);
  prev.setUTCDate(prev.getUTCDate() - 1);
  return getDayRange(prev);
}

/** Resolves the effective clinicId for the requester (admin override or user.clinicId). */
async function resolveClinicId(req, me) {
  if (me.role === "admin") {
    const qClinicId = req.query.clinicId;
    if (!qClinicId) {
      return { error: { status: 400, message: "Admin must provide clinicId" } };
    }
    if (!mongoose.Types.ObjectId.isValid(qClinicId)) {
      return { error: { status: 400, message: "Invalid clinicId" } };
    }
    return { clinicId: qClinicId };
  }
  if (!me.clinicId) {
    return { error: { status: 403, message: "User not linked to a clinic" } };
  }
  return { clinicId: me.clinicId.toString() };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // 1. AuthN
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. AuthZ — agent-side roles + admin (for diagnostic views)
    const allowedRoles = ["agent", "doctorStaff", "doctor", "staff", "admin"];
    if (!allowedRoles.includes(me.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // 3. Resolve clinicId
    const resolved = await resolveClinicId(req, me);
    if (resolved.error) {
      return res
        .status(resolved.error.status)
        .json({ success: false, message: resolved.error.message });
    }
    const clinicObjectId = new mongoose.Types.ObjectId(resolved.clinicId);

    // 4. Resolve the target date (from query param, default to today)
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const today = new Date();
    const isToday =
      targetDate.getUTCFullYear() === today.getUTCFullYear() &&
      targetDate.getUTCMonth() === today.getUTCMonth() &&
      targetDate.getUTCDate() === today.getUTCDate();

    const { start: startOfTarget, end: endOfTarget } = getDayRange(targetDate);
    const { start: startOfPrev, end: endOfPrev } = getPreviousDayRange(targetDate);

    // 4b. Role-based scope for appointment revenue.
    // `doctorStaff` and `doctor` see only appointments booked under their own
    // `doctorId` (i.e. themselves). `agent` / `staff` / `admin` see all
    // appointments in the clinic.
    //
    // Slot-recovery is also role-scoped:
    //   - doctorStaff / doctor → only their own doctor slots
    //   - agent / staff / admin → every doctor's slots in the clinic
    //
    // Hot-leads, follow-ups and expired-packages are clinic-level signals
    // and are NOT filtered by doctor.
    const doctorScopedRoles = ["doctorStaff", "doctor"];
    const isDoctorScoped = doctorScopedRoles.includes(me.role);
    const doctorFilter = isDoctorScoped ? { doctorId: me._id } : null;

    // 5. Parallel data fetch (multiple round-trips, executed concurrently)
    const [
      targetAppointments,
      prevAppointments,
      expiredPackagesAgg,
      targetBillingsAgg,
      hotLeadSegments,
      followUpsCount,
      clinicDoc,
      allDayAppointments,
      blockedSlots,
      clinicDoctors,
    ] = await Promise.all([
      // 5a. Target-date appointments that have a treatment selected.
      Appointment.find({
        clinicId: clinicObjectId,
        startDate: { $gte: startOfTarget, $lte: endOfTarget },
        status: { $nin: NON_REVENUE_STATUSES },
        ...(doctorFilter || {}),
        $or: [
          { treatment: { $exists: true, $nin: ["", null] } },
          { serviceId: { $exists: true, $ne: null } },
          { "services.0": { $exists: true } },
        ],
      })
        .select("treatment serviceId services")
        .lean(),

      // 5b. Previous-day appointments (same filter) for vs-previous comparison
      Appointment.find({
        clinicId: clinicObjectId,
        startDate: { $gte: startOfPrev, $lte: endOfPrev },
        status: { $nin: NON_REVENUE_STATUSES },
        ...(doctorFilter || {}),
        $or: [
          { treatment: { $exists: true, $nin: ["", null] } },
          { serviceId: { $exists: true, $ne: null } },
          { "services.0": { $exists: true } },
        ],
      })
        .select("treatment serviceId services")
        .lean(),

      // 5c. Sum of totalPrice for every expired package (endDate < now) for the clinic
      PatientRegistration.aggregate([
        { $match: { clinicId: clinicObjectId } },
        { $unwind: "$packages" },
        {
          $match: {
            "packages.endDate": { $lt: new Date(), $ne: null },
            "packages.paymentStatus": { $nin: NON_EXPIRED_PACKAGE_STATUSES },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
            count: { $sum: 1 },
          },
        },
      ]),

      // 5d. Sum of paid amounts from billings dated within the target window.
      // $expr+$ifNull falls back to createdAt for legacy records without invoicedDate.
      Billing.aggregate([
        {
          $match: {
            clinicId: clinicObjectId,
            $expr: {
              $and: [
                {
                  $gte: [
                    { $ifNull: ["$invoicedDate", "$createdAt"] },
                    startOfTarget,
                  ],
                },
                {
                  $lte: [
                    { $ifNull: ["$invoicedDate", "$createdAt"] },
                    endOfTarget,
                  ],
                },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: { $ifNull: ["$paid", 0] } },
          },
        },
      ]),

      // 5e. Hot-lead segments (case-insensitive name match on /hot lead/i).
      // We only need the IDs — the actual lead count comes from query 5f.
      Segment.find({
        clinicId: clinicObjectId,
        status: { $ne: "archived" },
        name: { $regex: HOT_LEAD_SEGMENT_REGEX },
      })
        .select("_id name")
        .lean(),

      // 5f. Follow-up leads whose follow-up date falls within the target
      // window. We use $expr over `followUps` and `nextFollowUps` arrays
      // because either field may contain the due date. We also fall back to
      // createdAt within the window for leads marked Follow-up with no
      // recorded follow-up date.
      Lead.aggregate([
        {
          $match: {
            clinicId: clinicObjectId,
            status: FOLLOWUP_STATUS,
            $or: [
              {
                $expr: {
                  $and: [
                    { $gt: [{ $size: { $ifNull: ["$followUps", []] } }, 0] },
                    {
                      $gte: [
                        { $arrayElemAt: ["$followUps.date", 0] },
                        startOfTarget,
                      ],
                    },
                    {
                      $lte: [
                        { $arrayElemAt: ["$followUps.date", 0] },
                        endOfTarget,
                      ],
                    },
                  ],
                },
              },
              {
                $expr: {
                  $and: [
                    { $gt: [{ $size: { $ifNull: ["$nextFollowUps", []] } }, 0] },
                    {
                      $gte: [
                        { $arrayElemAt: ["$nextFollowUps.date", 0] },
                        startOfTarget,
                      ],
                    },
                    {
                      $lte: [
                        { $arrayElemAt: ["$nextFollowUps.date", 0] },
                        endOfTarget,
                      ],
                    },
                  ],
                },
              },
              {
                createdAt: { $gte: startOfTarget, $lte: endOfTarget },
              },
            ],
          },
        },
        { $count: "count" },
      ]),

      // 5g. Slot-recovery: count of (doctorId, fromTime) tuples that are
      // open (unbooked + unblocked) inside the clinic's operating hours
      // on the target date.
      //
      // We mirror the appointment calendar in `pages/clinic/appointment.tsx`
      // so the number on this card matches what the user sees on the
      // booking page. The logic is:
      //   1. Pull the clinic's weekly `timings` to get the opening /
      //      closing time for the target day-of-week.
      //   2. Generate SLOT_INTERVAL_MINUTES-step slots from opening
      //      to closing (the same 30-min rows the calendar shows).
      //   3. For each (doctor, slot), subtract it if there's an active
      //      appointment OR an active BlockedSlot record.
      //
      // Role scoping:
      //   - doctorStaff / doctor → only the current user's slots
      //   - agent / staff / admin → slots for every doctor in the clinic
      //
      // We issue 4 small queries (clinic, all-day appointments,
      // blocked slots, and the doctor list) in parallel. The actual
      // count is computed in plain JS after the queries resolve — the
      // cartesian product is at most a few hundred tuples per day.

      // 5g-1. Clinic timings (only the timings field).
      Clinic.findById(clinicObjectId).select("timings").lean(),

      // 5g-2. Every active appointment on the target date that is
      // bound to a doctor column. We only need doctorId + fromTime;
      // the calendar slot is a (doctor, fromTime) pair.
      Appointment.find({
        clinicId: clinicObjectId,
        startDate: { $gte: startOfTarget, $lte: endOfTarget },
        doctorId: { $exists: true, $ne: null },
        fromTime: { $exists: true, $nin: ["", null] },
        ...(isDoctorScoped ? { doctorId: me._id } : {}),
        status: { $nin: NON_REVENUE_STATUSES },
      })
        .select("doctorId fromTime")
        .lean(),

      // 5g-3. Blocked slots for the target date. BlockedSlot records
      // (with isActive !== false) hide a (doctor, fromTime) cell from
      // the calendar, so they must be subtracted too.
      BlockedSlot.find({
        clinicId: clinicObjectId,
        startDate: { $gte: startOfTarget, $lte: endOfTarget },
        isActive: { $ne: false },
        ...(isDoctorScoped ? { doctorId: me._id } : {}),
      })
        .select("doctorId fromTime")
        .lean(),

      // 5g-4. Doctor roster (only needed when not doctor-scoped).
      // `doctorStaff` are listed alongside `doctor` because the
      // appointment calendar shows both as bookable columns.
      isDoctorScoped
        ? Promise.resolve([])
        : User.find({
            clinicId: clinicObjectId,
            role: { $in: ["doctor", "doctorStaff"] },
          })
            .select("_id")
            .lean(),
    ]);

    // 6. Hot-leads: count distinct leads that are in any hot-lead segment.
    let hotLeadsCount = 0;
    if (Array.isArray(hotLeadSegments) && hotLeadSegments.length > 0) {
      const hotSegmentIds = hotLeadSegments.map((s) => s._id);
      hotLeadsCount = await Lead.countDocuments({
        clinicId: clinicObjectId,
        segments: { $in: hotSegmentIds },
      });
    }

    const followUpsResult = Array.isArray(followUpsCount) ? followUpsCount[0]?.count : 0;
    const followUpsCountFinal = Number(followUpsResult || 0);

    // Slot-recovery: number of (doctor, fromTime) tuples inside the
    // clinic's operating hours on the target date that are NOT booked
    // and NOT blocked. See the 5g block above for the full algorithm.
    const slotRecoveryCount = computeSlotRecovery({
      clinic: clinicDoc,
      dateStr: startOfTarget.toISOString().slice(0, 10),
      doctors: isDoctorScoped ? [{ _id: me._id }] : (clinicDoctors || []),
      appointments: Array.isArray(allDayAppointments) ? allDayAppointments : [],
      blockedSlots: Array.isArray(blockedSlots) ? blockedSlots : [],
    });

    // 7. Build a single price-lookup map (one Service query)
    const allAppointments = [...targetAppointments, ...prevAppointments];
    const serviceIdSet = new Set();
    const treatmentNameSet = new Set();

    for (const appt of allAppointments) {
      if (appt.serviceId) serviceIdSet.add(appt.serviceId.toString());
      if (Array.isArray(appt.services)) {
        for (const s of appt.services) {
          if (s && s.serviceId) serviceIdSet.add(s.serviceId.toString());
        }
      }
      if (appt.treatment) treatmentNameSet.add(appt.treatment);
    }

    const serviceIds = [...serviceIdSet];
    const treatmentNames = [...treatmentNameSet];

    const services = await Service.find({
      clinicId: clinicObjectId,
      $or: [
        ...(serviceIds.length > 0 ? [{ _id: { $in: serviceIds } }] : [{ _id: null }]),
        ...(treatmentNames.length > 0 ? [{ name: { $in: treatmentNames } }] : [{ name: null }]),
      ],
      isActive: { $ne: false },
      isDeleted: { $ne: true },
    })
      .select("name price clinicPrice")
      .lean();

    const priceById = new Map();
    const priceByName = new Map();
    for (const svc of services) {
      const price = Number(svc.clinicPrice ?? svc.price ?? 0);
      if (Number.isFinite(price) && price >= 0) {
        priceById.set(svc._id.toString(), price);
        priceByName.set(svc.name, price);
      }
    }

    // 8. Resolve price for an appointment (priority: explicit serviceId → services[] → name)
    const resolveAppointmentPrice = (appt) => {
      if (appt.serviceId) {
        const id = appt.serviceId.toString();
        if (priceById.has(id)) return priceById.get(id);
      }
      if (Array.isArray(appt.services) && appt.services.length > 0) {
        for (const s of appt.services) {
          if (s && s.serviceId) {
            const id = s.serviceId.toString();
            if (priceById.has(id)) return priceById.get(id);
          }
        }
      }
      if (appt.treatment && priceByName.has(appt.treatment)) {
        return priceByName.get(appt.treatment);
      }
      return 0;
    };

    // 9. Compute revenue components
    const treatmentRevenue = targetAppointments.reduce(
      (sum, a) => sum + resolveAppointmentPrice(a),
      0,
    );
    const prevTreatmentRevenue = prevAppointments.reduce(
      (sum, a) => sum + resolveAppointmentPrice(a),
      0,
    );

    const expiredPackageRevenue = Number(expiredPackagesAgg[0]?.total ?? 0);
    const expiredPackagesCount = Number(expiredPackagesAgg[0]?.count ?? 0);

    const recoveredSoFar = Number(targetBillingsAgg[0]?.total ?? 0);

    // 10. Totals & derived metrics
    const totalPotential = treatmentRevenue + expiredPackageRevenue;
    const previousDayPotential = prevTreatmentRevenue + expiredPackageRevenue;

    const percentChangeVsYesterday =
      previousDayPotential > 0
        ? ((totalPotential - previousDayPotential) / previousDayPotential) * 100
        : 0;

    const progressPercent =
      totalPotential > 0
        ? Math.min(100, Math.max(0, (recoveredSoFar / totalPotential) * 100))
        : 0;

    const highValueActions = targetAppointments.length + expiredPackagesCount;

    // 11. Return the structured payload
    return res.status(200).json({
      success: true,
      data: {
        date: startOfTarget.toISOString().slice(0, 10),
        isToday,
        scope: isDoctorScoped ? "doctor" : "clinic",
        scopeNote: isDoctorScoped
          ? "Showing only appointments booked under you"
          : "Showing all clinic appointments",
        totalPotential: round2(totalPotential),
        recoveredSoFar: round2(recoveredSoFar),
        progressPercent: round1(progressPercent),
        percentChangeVsYesterday: round1(percentChangeVsYesterday),
        highValueActions,
        todaysAppointmentsCount: targetAppointments.length,
        expiredPackagesCount,
        treatmentRevenue: round2(treatmentRevenue),
        expiredPackageRevenue: round2(expiredPackageRevenue),
        yesterdayPotential: round2(previousDayPotential),
        hotLeadsCount,
        followUpsCount: followUpsCountFinal,
        slotRecoveryCount,
        categories: {
          hotLeads: hotLeadsCount,
          followUps: followUpsCountFinal,
          packageRenewals: round2(expiredPackageRevenue),
          slotRecovery: slotRecoveryCount,
        },
      },
    });
  } catch (err) {
    // console.error("[/api/agent/revenue-opportunity]", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal Server Error" });
  }
}

function round1(n) {
  return Number(Number(n || 0).toFixed(1));
}

function round2(n) {
  return Number(Number(n || 0).toFixed(2));
}

/**
 * Count the open (doctor, fromTime) tuples for a given date, i.e. the
 * number of doctor slots that are still bookable on that day.
 *
 * Inputs:
 *   - clinic:     clinic document (or null) carrying `timings`
 *   - dateStr:    YYYY-MM-DD string of the day to score
 *   - doctors:    array of `{ _id }` users to consider
 *   - appointments: active appointment docs with `doctorId` + `fromTime`
 *   - blockedSlots:  active BlockedSlot docs with `doctorId` + `fromTime`
 *
 * Returns 0 when:
 *   - the clinic is closed on the target day, or
 *   - the timings array is missing/malformed, or
 *   - no doctors are passed in.
 */
function computeSlotRecovery({ clinic, dateStr, doctors, appointments, blockedSlots }) {
  if (!Array.isArray(doctors) || doctors.length === 0) return 0;
  if (!dateStr) return 0;

  const dayTiming = parseTimingsForDay(clinic?.timings, dateStr);
  if (!dayTiming) return 0;

  const timeSlots = generateTimeSlots(dayTiming.startTime, dayTiming.endTime);
  if (timeSlots.length === 0) return 0;

  // Build (doctorId|fromTime) sets for fast membership tests.
  const bookedSet = new Set();
  for (const a of appointments) {
    if (a && a.doctorId && a.fromTime) {
      bookedSet.add(`${a.doctorId.toString()}|${a.fromTime}`);
    }
  }
  const blockedSet = new Set();
  for (const b of blockedSlots) {
    if (b && b.doctorId && b.fromTime) {
      blockedSet.add(`${b.doctorId.toString()}|${b.fromTime}`);
    }
  }

  let count = 0;
  for (const doc of doctors) {
    if (!doc || !doc._id) continue;
    const docId = doc._id.toString();
    for (const slot of timeSlots) {
      const key = `${docId}|${slot}`;
      if (!bookedSet.has(key) && !blockedSet.has(key)) {
        count += 1;
      }
    }
  }
  return count;
}


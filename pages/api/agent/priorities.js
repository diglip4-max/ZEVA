import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Lead from "../../../models/Lead";
import Conversation from "../../../models/Conversation";
import Message from "../../../models/Message";
import PatientRegistration from "../../../models/PatientRegistration";
import Users from "../../../models/Users";
import Room from "../../../models/Room";
import Clinic from "../../../models/Clinic";
import BlockedSlot from "../../../models/BlockedSlot";
import { getUserFromReq } from "../lead-ms/auth";

/**
 * GET /api/agent/priorities?timePeriod=morning|afternoon|evening&date=YYYY-MM-DD
 *
 * Returns the four "Your Priorities" cards for the agent dashboard.
 *
 * The data is partitioned by `timePeriod` (the time-of-day the user is
 * currently looking at) so the four cards can be re-fetched whenever
 * the user switches between morning / afternoon / evening without
 * re-pulling everything else on the page.
 *
 *   - appointments: booked-but-not-yet-Approved appointments whose
 *     `fromTime` falls inside the period. The most recent by fromTime
 *     is returned as `latest` for the card subtitle.
 *
 *   - newLeads: leads whose latest conversation message is `incoming`
 *     AND has NO outgoing message after it. "Needs response" = clinic
 *     has not replied yet. The card count is dynamic.
 *
 *   - followUps: leads with status "Follow-up" whose `followUps[0].date`
 *     OR `nextFollowUps[0].date` falls on the target date. Date-based
 *     (not period-based) — same data across all 3 tabs.
 *
 *   - packageRenewals: patient-registration packages whose `endDate`
 *     falls on the target date. Returns the renewal-revenue total and
 *     the list of packages for the "View details" modal.
 *
 * Role scoping:
 *   - agent / staff / admin → clinic-wide
 *   - doctor / doctorStaff   → only their own doctorId
 *
 * Response shape:
 *   {
 *     success: true,
 *     data: {
 *       timePeriod: "morning",
 *       date: "2026-08-14",
 *       period: { start: "06:00", end: "12:00", label: "Morning" },
 *       appointments: { count, latest, list },
 *       newLeads:    { count, list },
 *       followUps:   { count, list },
 *       packageRenewals: { count, totalRevenue, list },
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
 * of "that date". ±18 hours is enough to cover every real-world
 * timezone (UTC-12 through UTC+18, including Kiribati). This
 * matters because follow-ups / messages / packages are stored in
 * UTC, but the user is asking for "today" in their local timezone.
 * Without this expansion, a follow-up at 2026-08-14T22:45:00.000Z
 * (= 2026-08-15 04:15 IST) would be missed when the user queries
 * with date=2026-08-15.
 */
function getTimezoneSafeDayRange(dayStart, dayEnd) {
  const OFFSET_MS = 18 * 60 * 60 * 1000;
  return {
    start: new Date(dayStart.getTime() - OFFSET_MS),
    end: new Date(dayEnd.getTime() + OFFSET_MS),
  };
}

/** Convert 24h "HH:MM" to total minutes since midnight. */
function toMinutes(t) {
  if (!t || typeof t !== "string") return null;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

// Time-period windows (24h hours). The boundaries were chosen to mirror
// the typical Middle-East / South-Asia clinic day:
//   morning  → 06:00 – 12:00
//   afternoon → 12:00 – 17:00
//   evening  → 17:00 – 23:00
const TIME_PERIODS = {
  morning: { start: "06:00", end: "12:00", label: "Morning" },
  afternoon: { start: "12:00", end: "17:00", label: "Afternoon" },
  evening: { start: "17:00", end: "23:00", label: "Evening" },
};

function resolvePeriod(timePeriod) {
  const key = String(timePeriod || "morning").toLowerCase();
  return TIME_PERIODS[key] ? { key, ...TIME_PERIODS[key] } : null;
}

/** Format 24h "HH:MM" into 12h "h:MM AM/PM" for display. */
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

/** "x min ago" / "x hr ago" string for the lead card subtitle. */
function relativeTimeAgo(date) {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr`;
  const day = Math.floor(hr / 24);
  return `${day} d`;
}

function buildLeadName(lead) {
  if (!lead) return "Unknown lead";
  const first = lead.firstName || lead.name?.split?.(" ")?.[0] || "";
  const last = lead.lastName || "";
  const full = `${first} ${last}`.trim();
  return full || lead.name || "Unknown lead";
}

/**
 * Pick the text that best represents a lead's latest message for the
 * "new leads" card subtitle. The Message model has three channels:
 *   - "sms" / "whatsapp" → the body (`content`) IS the message
 *   - "email"            → the subject is the headline; the body is
 *                          secondary
 * Returns an empty string when nothing useful is present so the
 * frontend can render an empty subtitle cleanly.
 */
function pickLatestMessageDisplay(msg) {
  if (!msg) return "";
  const channel = (msg.channel || "").toLowerCase();
  if (channel === "email") {
    const subject = (msg.subject || "").trim();
    if (subject) return subject;
    // Fall back to body when there's no subject.
    return (msg.content || "").trim();
  }
  // sms / whatsapp / unknown → content is the message
  return (msg.content || "").trim();
}

// ─── clinic timing helpers (aligned with revenue-opportunity.js) ────────

const SLOT_INTERVAL_MINUTES = 15;

/** Convert a 12-hour "HH:MM AM/PM" string to a 24-hour "HH:MM" string. */
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

/** Convert 24h "HH:MM" to total minutes since midnight. */
function timeStringToMinutes(t) {
  if (!t || typeof t !== "string") return null;
  const [h, m] = t.split(":").map(Number);
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
 * Look up the clinic's opening/closing time for a specific date from
 * the weekly `clinic.timings` array. Returns null when the clinic is
 * closed on that day or the timings array is missing/malformed.
 */
function parseTimingsForDay(timings, dateStr) {
  if (!Array.isArray(timings) || !dateStr) return null;
  const DAYS = [
    "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ];
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

/**
 * Generate the list of "HH:MM" 24-hour slot start times between
 * `startTime` and `endTime` (both "HH:MM"), stepped by
 * SLOT_INTERVAL_MINUTES (15 minutes).
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

// ─── per-section data fetchers ──────────────────────────────────────────

/**
 * 1. Booked appointments for the day.
 *
 * Day-wise, NOT period-wise: the count and the list both cover every
 * `status: "booked"` appointment whose `startDate` is today, regardless
 * of the user's currently selected time period (morning / afternoon /
 * evening). The `timePeriod` filter was removed so the card surfaces
 * the true day-wide workload for the agent — the same day-wise rule
 * the Today's Status section uses (see "Today's Status day-wise
 * aggregation" memory). The `period` argument is kept for symmetry with
 * the other sections and is used to pick a sensible `latest` for the
 * card subtitle: when the user is on Morning, show the next upcoming
 * morning slot; when no slot exists in the period, fall back to the
 * earliest booking of the day so the subtitle is never empty.
 */
async function fetchAppointmentsSection({ clinicObjectId, period, dayStart, dayEnd, isDoctorScoped, me }) {
  const baseMatch = {
    clinicId: clinicObjectId,
    startDate: { $gte: dayStart, $lte: dayEnd },
    status: "booked",
  };
  if (isDoctorScoped) baseMatch.doctorId = me._id;

  // Day-wide count and full list (no `fromTime` filter here).
  const [count, dayList] = await Promise.all([
    Appointment.countDocuments(baseMatch),
    Appointment.find(baseMatch)
      .populate({
        path: "patientId",
        model: "PatientRegistration",
        select: "firstName lastName mobileNumber emrNumber",
      })
      // Service names are not stored on the appointment document — they
      // live on the Service collection. Populate both `serviceId` (single)
      // and `serviceIds` (array) so the UI can show the treatment name(s).
      .populate({ path: "serviceId", model: "Service", select: "name" })
      .populate({ path: "serviceIds", model: "Service", select: "name" })
      .sort({ fromTime: 1, createdAt: 1 })
      .lean(),
  ]);

  const list = dayList.map((a) => {
    const p = a.patientId || {};
    // Treatment name: prefer the multi-service array (it usually wins
    // because new bookings use `serviceIds`), fall back to the single
    // `serviceId` for older rows. `serviceName` is the denormalized
    // single-service label and `serviceNames` is the array form — the
    // UI can render either depending on the layout.
    const fromServiceIds = Array.isArray(a.serviceIds)
      ? a.serviceIds.map((s) => s?.name).filter(Boolean)
      : [];
    const fromServiceId = a.serviceId?.name || "";
    const combined = fromServiceId
      ? [fromServiceId, ...fromServiceIds.filter((n) => n !== fromServiceId)]
      : fromServiceIds;
    const treatmentName = combined[0] || "";
    const treatmentNames = combined;
    return {
      _id: a._id.toString(),
      patientName:
        `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown patient",
      patientMobile: p.mobileNumber || "",
      emrNumber: p.emrNumber || "",
      status: a.status || "booked",
      fromTime: a.fromTime,
      toTime: a.toTime,
      fromTimeDisplay: formatTime12(a.fromTime),
      toTimeDisplay: formatTime12(a.toTime),
      followType: a.followType || "",
      treatmentName,
      treatmentNames,
    };
  });

  // `latest` for the card subtitle: the first booking inside the
  // current period (so morning shows the next morning slot). If the
  // period is empty (e.g. afternoon tab when there are no afternoon
  // bookings yet), fall back to the earliest booking of the day so the
  // subtitle is never blank.
  const inPeriod = list.find((x) => x.fromTime >= period.start && x.fromTime < period.end);
  const latest = inPeriod || list[0] || null;

  return { count, latest, list };
}

/**
 * 2. New leads needing response.
 *
 * Per the Message model, `recipientId` is the Lead (regardless of
 * direction — the comment in the schema explicitly says
 * `recipientId` references `Lead` for both incoming and outgoing).
 * So the right unit of "needs a response" is a unique Lead, not a
 * unique conversation: a lead with multiple conversations still
 * counts once.
 *
 * Algorithm (single aggregation, no N+1):
 *   1. Pull every message for this clinic with direction
 *      `incoming` or `outgoing`.
 *   2. Sort by `recipientId` then `createdAt` desc, group by
 *      `recipientId`, take `$first` — that's the LATEST message
 *      the lead has sent or received.
 *   3. Keep only rows where that latest message is `incoming`
 *      (i.e. the lead spoke last).
 *   4. For each remaining row, look across the messages collection
 *      for ANY outgoing message to the same `recipientId` with
 *      `createdAt > latest.createdAt`. If none, the clinic hasn't
 *      replied yet — the lead "needs response".
 *
 * Time-period filter: the lead is attributed to the period when
 * the latest incoming message was received (its `createdAt` hour,
 * local time).
 *
 * Date filter: the aggregation also constrains `createdAt` to the
 * target day (today by default, or whatever `date` query the caller
 * passed). This is what makes the section honour the dashboard's
 * date picker — selecting 2026-08-13 will only show leads whose
 * latest message was received on that day, not today.
 */
async function fetchNewLeadsSection({ clinicObjectId, period, dayStart, dayEnd, isDoctorScoped, me }) {
  // Build a [from, to) range for the latest incoming message.
  // We re-derive the period into a UTC date range for createdAt.
  const periodStartMin = toMinutes(period.start);
  const periodEndMin = toMinutes(period.end);
  if (periodStartMin == null || periodEndMin == null) {
    return { count: 0, list: [] };
  }

  // DEBUG: Log what we're querying
  console.log("[DEBUG fetchNewLeadsSection] clinicObjectId:", clinicObjectId?.toString());
  console.log("[DEBUG fetchNewLeadsSection] dayStart:", dayStart, "dayEnd:", dayEnd);
  console.log("[DEBUG fetchNewLeadsSection] period:", period.start, "-", period.end, "=> mins:", periodStartMin, "-", periodEndMin);

  // Quick count of messages for this clinic in the date range
  const totalMsgCount = await Message.countDocuments({
    clinicId: clinicObjectId,
    createdAt: { $gte: dayStart, $lte: dayEnd },
  });
  console.log("[DEBUG fetchNewLeadsSection] Total messages for clinic in date range:", totalMsgCount);

  // Sample recent messages to check fields
  const sampleMsgs = await Message.find({
    clinicId: clinicObjectId,
    createdAt: { $gte: dayStart, $lte: dayEnd },
  })
    .select("direction recipientId channel content createdAt")
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
  console.log("[DEBUG fetchNewLeadsSection] Sample recent messages:", JSON.stringify(sampleMsgs.map(m => ({
    direction: m.direction,
    recipientId: m.recipientId?.toString(),
    channel: m.channel,
    content: (m.content || "").slice(0, 50),
    createdAt: m.createdAt,
  })), null, 2));

  // 1. Group by `recipientId` (the Lead) and pick the most recent
  //    message per lead. This is where the "Set" of unique leads
  //    is materialised — one row per recipientId, never two.
  const latestPerLead = await Message.aggregate([
    {
      $match: {
        clinicId: clinicObjectId,
        // Exclude messages with no recipientId — they can't be
        // attributed to a lead.
        recipientId: { $ne: null },
        direction: { $in: ["incoming", "outgoing"] },
        // Date filter: the lead's LATEST message must fall inside
        // the target day. This is what makes the section respect
        // the dashboard's date picker. Without this, switching the
        // date would still pull in today's messages.
        createdAt: { $gte: dayStart, $lte: dayEnd },
      },
    },
    { $sort: { recipientId: 1, createdAt: -1 } },
    {
      $group: {
        _id: "$recipientId",
        latest: { $first: "$$ROOT" },
      },
    },
    { $match: { "latest.direction": "incoming" } },
    // 2. For each lead, check whether ANY outgoing message was sent
    //    to that lead AFTER their latest incoming. We don't scope to
    //    a single conversation — a reply in any thread counts as
    //    "we already responded to this lead".
    {
      $lookup: {
        from: "messages",
        let: { leadId: "$_id", latestAt: "$latest.createdAt" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$recipientId", "$$leadId"] },
                  { $eq: ["$direction", "outgoing"] },
                  { $gt: ["$createdAt", "$$latestAt"] },
                ],
              },
            },
          },
          { $limit: 1 },
          { $project: { _id: 1 } },
        ],
        as: "outgoingAfter",
      },
    },
    { $match: { outgoingAfter: { $size: 0 } } },
  ]);

  console.log("[DEBUG fetchNewLeadsSection] Aggregation result (latestPerLead) count:", latestPerLead.length);
  if (latestPerLead.length > 0) {
    console.log("[DEBUG fetchNewLeadsSection] latestPerLead details:", JSON.stringify(latestPerLead.map(r => ({
      recipientId: r._id?.toString(),
      direction: r.latest?.direction,
      createdAt: r.latest?.createdAt,
      hasOutgoingAfter: r.outgoingAfter?.length,
    })), null, 2));
  }

  if (!latestPerLead.length) {
    return { count: 0, list: [] };
  }

  // Resolve the lead details for the unique recipientIds.
  const leadIds = [
    ...new Set(
      latestPerLead
        .map((r) => r._id)
        .filter(Boolean)
        .map((id) => new mongoose.Types.ObjectId(id)),
    ),
  ];

  const leads = leadIds.length
    ? await Lead.find({ _id: { $in: leadIds } })
        .select("firstName lastName name phone email assignedTo")
        .lean()
    : [];

  const leadById = new Map();
  for (const l of leads) leadById.set(l._id.toString(), l);

  // Apply time-period filter on the latest incoming message's createdAt.
  // The lead is attributed to the period when the lead's latest message
  // was received. We use UTC methods because createdAt is stored in UTC
  // and the period boundaries (e.g. "06:00"–"12:00") are interpreted as
  // UTC hours to stay consistent with the day range (also UTC).
  const inPeriod = latestPerLead.filter((row) => {
    const ts = row.latest?.createdAt ? new Date(row.latest.createdAt) : null;
    if (!ts || Number.isNaN(ts.getTime())) return false;
    const minutes = ts.getUTCHours() * 60 + ts.getUTCMinutes();
    return minutes >= periodStartMin && minutes < periodEndMin;
  });

  if (!inPeriod.length) {
    return { count: 0, list: [] };
  }

  // Build the per-lead list. The `conversationId` we return is the
  // conversation that the lead's latest message belongs to — that's
  // the thread the agent should be sent to when they click "View".
  const meId = me?._id?.toString() || "";
  const list = inPeriod
    .map((row) => {
      const leadIdStr =
        typeof row._id === "string" ? row._id : row._id.toString();
      const lead = leadById.get(leadIdStr);
      if (!lead) return null;
      if (isDoctorScoped) {
        const assigned = Array.isArray(lead.assignedTo)
          ? lead.assignedTo.some(
              (a) => a && a.user && a.user.toString() === meId,
            )
          : false;
        if (!assigned) return null;
      }
      return {
        leadId: lead._id.toString(),
        conversationId: row.latest?.conversationId
          ? row.latest.conversationId.toString()
          : "",
        name: buildLeadName(lead),
        phone: lead.phone || "",
        email: lead.email || "",
        // Channel-aware display of the lead's latest message.
        // For email the agent cares about the subject first; for
        // sms / whatsapp the body is the message.
        latestMessageChannel: row.latest?.channel || "",
        latestMessageSubject: row.latest?.subject || "",
        latestMessageContent: row.latest?.content || "",
        latestMessageDisplay: pickLatestMessageDisplay(row.latest),
        latestMessageAt: row.latest.createdAt,
        waitingFor: relativeTimeAgo(row.latest.createdAt),
      };
    })
    .filter(Boolean);

  // Sort by most-recent first.
  list.sort(
    (a, b) =>
      new Date(b.latestMessageAt).getTime() -
      new Date(a.latestMessageAt).getTime(),
  );

  return { count: list.length, list: list.slice(0, 10) };
}

/**
 * 3. Follow-ups due today.
 * Lead.followUps[0].date or Lead.nextFollowUps[0].date in the date range.
 * Date-based, not period-based — same data across all 3 tabs.
 *
 * Note on timezones: the date range is expanded by ±18 hours (see
 * `getTimezoneSafeDayRange`) so a follow-up stored as, say,
 * 2026-08-14T22:45:00.000Z (which is 2026-08-15 04:15 IST) is
 * still included when the user queries for 2026-08-15.
 */
async function fetchFollowUpsSection({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me, dateStr }) {
  // The follow-up date is stored in UTC. The user's `date` query
  // is also interpreted in UTC (it comes from the date picker which
  // is a YYYY-MM-DD string with no timezone). We therefore compare
  // the date part of the follow-up in UTC against the target date
  // — NOT the local-timezone interpretation.
  //
  // This is deliberate: a follow-up at 2026-08-14T22:45:00.000Z has
  // the date string "2026-08-14" in the database, and the user
  // expects it to show up when the dashboard header also says
  // "2026-08-14". A local-timezone comparison would shift it to
  // Aug 15 in IST and hide it, which is the bug we're avoiding.
  //
  // We still expand the MongoDB range by ±18h (see
  // `getTimezoneSafeDayRange`) so the index scan stays wide enough
  // to catch any follow-up whose UTC date matches the target even
  // when the user is in a non-UTC timezone.
  const range = getTimezoneSafeDayRange(dayStart, dayEnd);
  const match = {
    clinicId: clinicObjectId,
    status: "Follow-up",
    $or: [
      { "followUps.0.date": { $gte: range.start, $lte: range.end } },
      { "nextFollowUps.0.date": { $gte: range.start, $lte: range.end } },
    ],
  };
  if (isDoctorScoped) {
    match.assignedTo = { $elemMatch: { user: me._id } };
  }

  // NOTE: cannot use MongoDB `.sort()` here because `followUps` and
  // `nextFollowUps` are PARALLEL arrays on the same document, and
  // MongoDB throws "cannot sort with keys that are parallel arrays"
  // when you reference fields from two different arrays in one
  // sort. We fetch unsorted and sort in JavaScript below.
  const leads = await Lead.find(match)
    .select("firstName lastName name phone email followUps nextFollowUps")
    .lean();

  const utcDateKey = (d) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
      d.getUTCDate(),
    ).padStart(2, "0")}`;
  // The target key is the raw YYYY-MM-DD the caller passed in
  // (already a clean YYYY-MM-DD string, validated upstream).
  const targetKey = String(dateStr).slice(0, 10);

  const list = leads
    .map((l) => {
      const followAt = l.followUps?.[0]?.date || l.nextFollowUps?.[0]?.date || null;
      return { l, followAt };
    })
    .filter(({ followAt }) => {
      if (!followAt) return false;
      const d = new Date(followAt);
      if (Number.isNaN(d.getTime())) return false;
      return utcDateKey(d) === targetKey;
    })
    .map(({ l, followAt }) => ({
      _id: l._id.toString(),
      name: buildLeadName(l),
      phone: l.phone || "",
      email: l.email || "",
      followUpAt: followAt,
      followUpAtDisplay: followAt
        ? new Date(followAt).toLocaleString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          })
        : "",
    }))
    // Sort earliest follow-up first. Done in JS because the
    // MongoDB sort key on parallel arrays is illegal.
    .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));

  return { count: list.length, list };
}

/**
 * 4. Package renewals: packages expiring today.
 * Sum of totalPrice for those packages, plus the list for the
 * "View full details" modal.
 */
async function fetchPackageRenewalsSection({ clinicObjectId }) {
  // Find packages expiring within the next 30 days (not just today)
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const baseMatch = {
    clinicId: clinicObjectId,
    "packages.endDate": { $gte: now, $lte: thirtyDaysFromNow },
    "packages.paymentStatus": { $nin: ["Cancelled"] },
  };

  const [agg, list] = await Promise.all([
    PatientRegistration.aggregate([
      { $match: baseMatch },
      { $unwind: "$packages" },
      {
        $match: {
          "packages.endDate": { $gte: now, $lte: thirtyDaysFromNow },
          "packages.paymentStatus": { $nin: ["Cancelled"] },
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
    PatientRegistration.aggregate([
      { $match: baseMatch },
      { $unwind: "$packages" },
      {
        $match: {
          "packages.endDate": { $gte: now, $lte: thirtyDaysFromNow },
          "packages.paymentStatus": { $nin: ["Cancelled"] },
        },
      },
      {
        $project: {
          patientId: "$_id",
          patientName: {
            $trim: {
              input: { $concat: ["$firstName", " ", "$lastName"] },
            },
          },
          patientMobile: "$mobileNumber",
          patientEmr: "$emrNumber",
          packageName: "$packages.packageName",
          packageId: "$packages.packageId",
          totalPrice: { $ifNull: ["$packages.totalPrice", 0] },
          paidAmount: { $ifNull: ["$packages.paidAmount", 0] },
          paymentStatus: "$packages.paymentStatus",
          endDate: "$packages.endDate",
          startDate: "$packages.startDate",
          assignedDate: "$packages.assignedDate",
          validityInMonths: "$packages.validityInMonths",
          totalSessions: { $ifNull: ["$packages.totalSessions", 0] },
          remainingSessions: { $ifNull: ["$packages.remainingSessions", 0] },
          treatments: { $ifNull: ["$packages.treatments", []] },
        },
      },
      { $sort: { endDate: 1 } },
    ]),
  ]);

  return {
    count: Number(agg?.[0]?.count || 0),
    totalRevenue: Number(agg?.[0]?.total || 0),
    list: list.map((p) => ({
      patientId: p.patientId?.toString(),
      patientName: p.patientName || "Unknown patient",
      patientMobile: p.patientMobile || "",
      patientEmr: p.patientEmr || "",
      packageName: p.packageName || "Package",
      packageId: p.packageId?.toString() || null,
      totalPrice: p.totalPrice,
      paidAmount: p.paidAmount,
      paymentStatus: p.paymentStatus || "",
      endDate: p.endDate ? new Date(p.endDate).toISOString() : null,
      startDate: p.startDate ? new Date(p.startDate).toISOString() : null,
      assignedDate: p.assignedDate ? new Date(p.assignedDate).toISOString() : null,
      validityInMonths: p.validityInMonths || 0,
      totalSessions: p.totalSessions || 0,
      remainingSessions: p.remainingSessions || 0,
      treatmentNames: Array.isArray(p.treatments)
        ? p.treatments.map((t) => t.treatmentName).filter(Boolean)
        : [],
    })),
  };
}

// ─── afternoon card sections ─────────────────────────────────────────

/**
 * Afternoon 1: Open slots unfilled.
 *
 * Aligned with revenue-opportunity.js slot recovery logic:
 *   - Uses clinic's actual operating hours from clinic.timings
 *   - Uses 15-minute slot intervals
 *   - Excludes both booked appointments AND blocked slots
 *   - Respects the date filter
 *
 * Audience-aware:
 *   - doctor-staff (`isDoctorScoped`): only their own doctor's slots
 *   - staff / admin (clinic-wide): all doctors' slots
 */
async function fetchOpenSlotsSection({ clinicObjectId, dayStart, dayEnd, dateStr, isDoctorScoped, me }) {
  // 1. Get the list of doctors to check slots for
  //    - Doctor login: only the logged-in doctor
  //    - Agent/Staff login: ALL doctors in the clinic
  let doctorIdsToCheck = [];
  let doctorDocs = [];
  
  if (isDoctorScoped) {
    // Doctor-staff: only their own slots
    doctorIdsToCheck = [me._id.toString()];
    doctorDocs = [{ _id: me._id, name: me.name || "Doctor" }];
  } else {
    // Agent/Staff: get ALL doctors in the clinic
    doctorDocs = await Users.find({
      clinicId: clinicObjectId,
      role: { $in: ["doctor", "doctorStaff"] },
      status: { $ne: "inactive" },
    })
      .select("_id name")
      .lean();
    doctorIdsToCheck = doctorDocs.map((d) => d._id.toString());
  }

  if (doctorIdsToCheck.length === 0) {
    return { count: 0, list: [] };
  }

  // 2. Fetch clinic timings to get operating hours for the target date
  const clinicDoc = await Clinic.findById(clinicObjectId).select("timings").lean();
  const dayTiming = parseTimingsForDay(clinicDoc?.timings, dateStr);
  
  // If clinic is closed on this day, return 0 slots
  if (!dayTiming) {
    return { count: 0, list: [] };
  }

  // 3. Generate 15-minute slots based on clinic operating hours
  const timeSlots = generateTimeSlots(dayTiming.startTime, dayTiming.endTime);
  if (timeSlots.length === 0) {
    return { count: 0, list: [] };
  }

  // 4. Fetch booked appointments AND blocked slots in parallel
  //    Only count appointments with status NOT in ["Cancelled", "Rescheduled"]
  //    as "slot filled". Cancelled/Rescheduled appointments leave the slot open.
  const [bookedAppointments, blockedSlots] = await Promise.all([
    Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      doctorId: { $in: doctorIdsToCheck.map((id) => new mongoose.Types.ObjectId(id)) },
      fromTime: { $ne: null },
      status: { $nin: ["Cancelled", "Rescheduled"] },
    })
      .select("doctorId fromTime")
      .lean(),
    BlockedSlot.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      isActive: { $ne: false },
      ...(isDoctorScoped ? { doctorId: me._id } : {}),
    })
      .select("doctorId fromTime")
      .lean(),
  ]);

  // 5. Build sets for booked and blocked slots per doctor
  const bookedSet = new Set();
  for (const apt of bookedAppointments) {
    if (apt && apt.doctorId && apt.fromTime) {
      bookedSet.add(`${apt.doctorId.toString()}|${apt.fromTime}`);
    }
  }
  
  const blockedSet = new Set();
  for (const blk of blockedSlots) {
    if (blk && blk.doctorId && blk.fromTime) {
      blockedSet.add(`${blk.doctorId.toString()}|${blk.fromTime}`);
    }
  }

  // 6. Count unfilled slots for each doctor (exclude booked AND blocked)
  const unfilled = [];
  for (const docId of doctorIdsToCheck) {
    for (const slot of timeSlots) {
      const key = `${docId}|${slot}`;
      if (!bookedSet.has(key) && !blockedSet.has(key)) {
        unfilled.push({
          scope: "doctor",
          doctorId: docId,
          roomId: null,
          fromTime: slot,
          fromTimeDisplay: formatTime12(slot),
        });
      }
    }
  }

  // 7. Populate doctor names for the modal display
  const doctorNameById = new Map(doctorDocs.map((d) => [d._id.toString(), d.name || "Doctor"]));

  // 8. Build the sorted list for modal display
  const sorted = unfilled
    .map((u) => ({
      ...u,
      doctorName: doctorNameById.get(u.doctorId) || "Doctor",
      roomName: null,
    }))
    .sort((a, b) => {
      // Sort by doctor name, then by time
      if (a.doctorName !== b.doctorName) return a.doctorName < b.doctorName ? -1 : 1;
      return a.fromTime < b.fromTime ? -1 : a.fromTime > b.fromTime ? 1 : 0;
    });

  return { count: sorted.length, list: sorted };
}

/**
 * Afternoon 2: Hot leads need follow-up.
 * Leads with status="Follow-up" AND a follow-up scheduled today.
 */
async function fetchHotLeadsSection({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me }) {
  const range = getTimezoneSafeDayRange(dayStart, dayEnd);
  const match = {
    clinicId: clinicObjectId,
    status: "Follow-up",
    $or: [
      { "followUps.0.date": { $gte: range.start, $lte: range.end } },
      { "nextFollowUps.0.date": { $gte: range.start, $lte: range.end } },
    ],
  };
  if (isDoctorScoped) match.assignedTo = { $elemMatch: { user: me._id } };

  const leads = await Lead.find(match)
    .select("firstName lastName name phone email followUps nextFollowUps")
    .lean();

  const list = leads.map((l) => ({
    _id: l._id.toString(),
    name: buildLeadName(l),
    phone: l.phone || "",
    email: l.email || "",
    followUpAt: l.followUps?.[0]?.date || l.nextFollowUps?.[0]?.date || null,
  }));

  return { count: list.length, list };
}

/**
 * Afternoon 3: Package renewals this week (today + 6 days).
 */
async function fetchPackageRenewalsWeekSection({ clinicObjectId, dayStart }) {
  const weekEnd = new Date(dayStart.getTime() + 7 * 24 * 60 * 60 * 1000);
  const baseMatch = {
    clinicId: clinicObjectId,
    "packages.endDate": { $gte: dayStart, $lte: weekEnd },
    "packages.paymentStatus": { $nin: ["Cancelled"] },
  };

  const [agg, list] = await Promise.all([
    PatientRegistration.aggregate([
      { $match: baseMatch },
      { $unwind: "$packages" },
      {
        $match: {
          "packages.endDate": { $gte: dayStart, $lte: weekEnd },
          "packages.paymentStatus": { $nin: ["Cancelled"] },
        },
      },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$packages.totalPrice", 0] } }, count: { $sum: 1 } } },
    ]),
    PatientRegistration.aggregate([
      { $match: baseMatch },
      { $unwind: "$packages" },
      {
        $match: {
          "packages.endDate": { $gte: dayStart, $lte: weekEnd },
          "packages.paymentStatus": { $nin: ["Cancelled"] },
        },
      },
      {
        $project: {
          patientId: "$_id",
          patientName: { $trim: { input: { $concat: ["$firstName", " ", "$lastName"] } } },
          packageName: "$packages.packageName",
          packageId: "$packages.packageId",
          totalPrice: { $ifNull: ["$packages.totalPrice", 0] },
          endDate: "$packages.endDate",
        },
      },
      { $sort: { endDate: 1 } },
    ]),
  ]);

  return {
    count: Number(agg?.[0]?.count || 0),
    totalRevenue: Number(agg?.[0]?.total || 0),
    list: list.map((p) => ({
      patientId: p.patientId?.toString(),
      patientName: p.patientName || "Unknown patient",
      packageName: p.packageName || "Package",
      packageId: p.packageId?.toString() || null,
      totalPrice: p.totalPrice,
      endDate: p.endDate ? new Date(p.endDate).toISOString() : null,
    })),
  };
}

/**
 * Afternoon 4: Follow-ups responded.
 * Leads with a follow-up today that have received an outgoing
 * message after the follow-up was scheduled. The "good news" card.
 */
async function fetchFollowUpsRespondedSection({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me, dateStr }) {
  const range = getTimezoneSafeDayRange(dayStart, dayEnd);
  const match = {
    clinicId: clinicObjectId,
    status: "Follow-up",
    $or: [
      { "followUps.0.date": { $gte: range.start, $lte: range.end } },
      { "nextFollowUps.0.date": { $gte: range.start, $lte: range.end } },
    ],
  };
  if (isDoctorScoped) match.assignedTo = { $elemMatch: { user: me._id } };

  console.log("[DEBUG fetchFollowUpsRespondedSection] clinicObjectId:", clinicObjectId?.toString());
  console.log("[DEBUG fetchFollowUpsRespondedSection] dateStr:", dateStr, "range:", range.start, "-", range.end);

  const leads = await Lead.find(match)
    .select("firstName lastName name phone email followUps nextFollowUps status")
    .lean();

  console.log("[DEBUG fetchFollowUpsRespondedSection] Leads with status='Follow-up' and follow-up date in range:", leads.length);
  if (leads.length > 0) {
    console.log("[DEBUG fetchFollowUpsRespondedSection] Leads:", JSON.stringify(leads.map(l => ({
      _id: l._id?.toString(),
      name: buildLeadName(l),
      status: l.status,
      followUpDate: l.followUps?.[0]?.date || l.nextFollowUps?.[0]?.date,
    })), null, 2));
  }

  // Also check how many leads have status "Follow-up" at all for this clinic
  const totalFollowUpLeads = await Lead.countDocuments({ clinicId: clinicObjectId, status: "Follow-up" });
  console.log("[DEBUG fetchFollowUpsRespondedSection] Total leads with status='Follow-up' for clinic:", totalFollowUpLeads);

  const utcDateKey = (d) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const targetKey = String(dateStr).slice(0, 10);
  const todaysFollowUps = leads.filter((l) => {
    const fu = l.followUps?.[0]?.date || l.nextFollowUps?.[0]?.date;
    if (!fu) return false;
    return utcDateKey(new Date(fu)) === targetKey;
  });

  if (todaysFollowUps.length === 0) {
    return { count: 0, list: [], appointmentsBooked: 0 };
  }

  const leadIds = todaysFollowUps.map((l) => l._id);
  const followUpDateByLead = new Map(
    todaysFollowUps.map((l) => [l._id.toString(), new Date(l.followUps?.[0]?.date || l.nextFollowUps?.[0]?.date)]),
  );

  const replies = await Message.aggregate([
    {
      $match: {
        clinicId: clinicObjectId,
        recipientId: { $in: leadIds },
        direction: "outgoing",
      },
    },
    { $sort: { createdAt: -1 } },
    { $group: { _id: "$recipientId", latest: { $first: "$$ROOT" } } },
  ]);

  const repliedLeadIds = new Set();
  for (const r of replies) {
    const fuAt = followUpDateByLead.get(r._id?.toString());
    if (!fuAt) continue;
    const replyAt = new Date(r.latest.createdAt);
    if (replyAt.getTime() >= fuAt.getTime()) {
      repliedLeadIds.add(r._id.toString());
    }
  }

  // Count of appointments created today (proxy for "appointments booked
  // from follow-ups" since appointment model doesn't link to lead).
  const appointmentsBooked = await Appointment.countDocuments({
    clinicId: clinicObjectId,
    createdAt: { $gte: dayStart, $lte: dayEnd },
  });

  const list = todaysFollowUps
    .filter((l) => repliedLeadIds.has(l._id.toString()))
    .map((l) => ({
      _id: l._id.toString(),
      name: buildLeadName(l),
      phone: l.phone || "",
      email: l.email || "",
    }));

  return { count: list.length, list, appointmentsBooked };
}

// ─── evening card sections ────────────────────────────────────────────

/**
 * Evening 1: Tomorrow appointments unconfirmed.
 *
 * "Tomorrow" = the calendar day after the requested `date`. We only
 * surface `status: "booked"` — the rest (Approved / Arrived /
 * Consultation / Completed / etc.) are considered confirmed and
 * don't need an evening nudge. The full list is returned (capped
 * at 50) so the View modal can show every patient, treatment, and
 * time-slot for tomorrow's bookings.
 */
async function fetchTomorrowAppointmentsSection({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me }) {
  // dayEnd is today's 23:59:59.999 UTC. Adding 1ms lands exactly on
  // tomorrow's 00:00:00.000 UTC, which is what we want for the new
  // day's window.
  const tomorrowStart = new Date(dayEnd.getTime() + 1);
  tomorrowStart.setUTCHours(0, 0, 0, 0);
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000 - 1);

  const match = {
    clinicId: clinicObjectId,
    startDate: { $gte: tomorrowStart, $lte: tomorrowEnd },
    status: "booked",
  };
  if (isDoctorScoped) match.doctorId = me._id;

  const [count, appts] = await Promise.all([
    Appointment.countDocuments(match),
    Appointment.find(match)
      .populate({
        path: "patientId",
        model: "PatientRegistration",
        select: "firstName lastName mobileNumber emrNumber",
      })
      .populate({ path: "doctorId", model: "User", select: "name" })
      // Service names are not stored on the appointment document;
      // populate both `serviceId` (single) and `serviceIds` (array)
      // so the modal can show the treatment name(s).
      .populate({ path: "serviceId", model: "Service", select: "name" })
      .populate({ path: "serviceIds", model: "Service", select: "name" })
      .sort({ fromTime: 1, createdAt: 1 })
      .limit(50)
      .lean(),
  ]);

  const list = appts.map((a) => {
    const p = a.patientId || {};
    // Same treatment-name resolution the morning appointments
    // section uses: prefer the multi-service array, fall back to the
    // single serviceId, dedupe.
    const fromServiceIds = Array.isArray(a.serviceIds)
      ? a.serviceIds.map((s) => s?.name).filter(Boolean)
      : [];
    const fromServiceId = a.serviceId?.name || "";
    const combined = fromServiceId
      ? [fromServiceId, ...fromServiceIds.filter((n) => n !== fromServiceId)]
      : fromServiceIds;
    return {
      _id: a._id.toString(),
      patientName:
        `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown patient",
      patientMobile: p.mobileNumber || "",
      emrNumber: p.emrNumber || "",
      status: a.status || "booked",
      fromTime: a.fromTime,
      toTime: a.toTime,
      fromTimeDisplay: formatTime12(a.fromTime),
      toTimeDisplay: formatTime12(a.toTime),
      followType: a.followType || "",
      doctorName: a.doctorId?.name || "Unknown doctor",
      treatmentName: combined[0] || "",
      treatmentNames: combined,
    };
  });

  return { count, list };
}

/**
 * Evening 2: Pending callbacks.
 * Leads with status Contacted or Follow-up that have a "callback"-
 * style note added today.
 */
async function fetchPendingCallbacksSection({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me }) {
  const range = getTimezoneSafeDayRange(dayStart, dayEnd);
  const callbackRegex = /callback|call\s*back|call\s*me|call\s*later/i;

  const match = {
    clinicId: clinicObjectId,
    status: { $in: ["Contacted", "Follow-up"] },
    "notes.0": { $exists: true },
  };
  if (isDoctorScoped) match.assignedTo = { $elemMatch: { user: me._id } };

  const leads = await Lead.find(match)
    .select("firstName lastName name phone email notes status")
    .lean();

  const list = [];
  for (const l of leads) {
    const todayNotes = (l.notes || []).filter((n) => {
      if (!n.text || !callbackRegex.test(n.text)) return false;
      const d = new Date(n.createdAt || 0);
      return d.getTime() >= range.start.getTime() && d.getTime() <= range.end.getTime();
    });
    if (todayNotes.length === 0) continue;
    list.push({
      _id: l._id.toString(),
      name: buildLeadName(l),
      phone: l.phone || "",
      email: l.email || "",
      noteText: todayNotes[0].text,
    });
  }

  return { count: list.length, list };
}

/**
 * Evening 3: Cancelled appointments today + revenue at risk.
 *
 * Surfaces every appointment for the requested day whose status is
 * exactly `"Cancelled"` (the Mongoose enum value). The day-wide
 * range is supplied by the caller (today's `dayStart` / `dayEnd`)
 * so the count is a full-day total, not a per-period slice.
 *
 * The list now carries the patient + treatment + status fields
 * the View modal renders; the list cap is 50 so the modal can
 * show every cancellation in one go.
 */
async function fetchCancelledAppointmentsSection({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me }) {
  // "Cancelled" is the literal status enum value; do not collapse
  // it with "Rejected" or "No Show" — those are distinct buckets
  // and should stay in their own reporting cards.
  const match = {
    clinicId: clinicObjectId,
    startDate: { $gte: dayStart, $lte: dayEnd },
    status: "Cancelled",
  };
  if (isDoctorScoped) match.doctorId = me._id;

  const [count, appts] = await Promise.all([
    Appointment.countDocuments(match),
    Appointment.find(match)
      .populate({
        path: "patientId",
        model: "PatientRegistration",
        select: "firstName lastName mobileNumber emrNumber",
      })
      .populate({ path: "doctorId", model: "User", select: "name" })
      .populate({ path: "serviceId", model: "Service", select: "name" })
      .populate({ path: "serviceIds", model: "Service", select: "name" })
      .sort({ fromTime: 1, createdAt: 1 })
      .limit(50)
      .lean(),
  ]);

  const apptIds = appts.map((a) => a._id);
  const billingAgg = apptIds.length
    ? await mongoose.connection.db.collection("billings").aggregate([
        { $match: { appointmentId: { $in: apptIds } } },
        { $group: { _id: null, total: { $sum: { $ifNull: ["$totalAmount", 0] } } } },
      ]).toArray()
    : [];
  const totalAtRisk = Number(billingAgg?.[0]?.total || 0);

  const list = appts.map((a) => {
    const p = a.patientId || {};
    const fromServiceIds = Array.isArray(a.serviceIds)
      ? a.serviceIds.map((s) => s?.name).filter(Boolean)
      : [];
    const fromServiceId = a.serviceId?.name || "";
    const combined = fromServiceId
      ? [fromServiceId, ...fromServiceIds.filter((n) => n !== fromServiceId)]
      : fromServiceIds;
    return {
      _id: a._id.toString(),
      patientName:
        `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown patient",
      patientMobile: p.mobileNumber || "",
      emrNumber: p.emrNumber || "",
      status: a.status || "Cancelled",
      fromTime: a.fromTime,
      toTime: a.toTime,
      fromTimeDisplay: formatTime12(a.fromTime),
      toTimeDisplay: formatTime12(a.toTime),
      doctorName: a.doctorId?.name || "Unknown doctor",
      treatmentName: combined[0] || "",
      treatmentNames: combined,
      reason: a.cancellationReason || "",
    };
  });

  return { count, totalAtRisk, list };
}

/**
 * Evening 4: End-of-day checklist (6 items).
 */
async function fetchEndOfDayChecklistSection({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me }) {
  const doctorMatch = { clinicId: clinicObjectId, startDate: { $gte: dayStart, $lte: dayEnd } };
  if (isDoctorScoped) doctorMatch.doctorId = me._id;

  const [
    unconfirmedToday,
    unrespondedLeads,
    pendingFollowUps,
    pendingPackages,
    unconfirmedTomorrow,
  ] = await Promise.all([
    Appointment.countDocuments({ ...doctorMatch, status: "booked" }),
    Lead.countDocuments({ clinicId: clinicObjectId, status: "New" }),
    Lead.countDocuments({
      clinicId: clinicObjectId,
      status: "Follow-up",
      "followUps.0.date": { $gte: dayStart, $lte: dayEnd },
    }),
    PatientRegistration.countDocuments({
      clinicId: clinicObjectId,
      "packages.endDate": { $gte: dayStart, $lte: dayEnd },
      "packages.paymentStatus": { $nin: ["Cancelled", "Renewed", "Completed"] },
    }),
    Appointment.countDocuments({
      ...doctorMatch,
      startDate: {
        $gte: new Date(dayEnd.getTime() + 1),
        $lte: new Date(dayEnd.getTime() + 24 * 60 * 60 * 1000),
      },
      status: "booked",
    }),
  ]);

  const items = [
    { id: "morning-confirm", label: "Morning appointments confirmed", done: unconfirmedToday === 0 },
    { id: "leads-replied", label: "New leads replied to", done: unrespondedLeads === 0 },
    { id: "followups-done", label: "Today's follow-ups done", done: pendingFollowUps === 0 },
    { id: "packages-renewed", label: "Today's packages renewed", done: pendingPackages === 0 },
    { id: "tomorrow-confirm", label: "Tomorrow's appointments confirmed", done: unconfirmedTomorrow === 0 },
    { id: "eod-report", label: "End-of-day report submitted", done: false },
  ];
  const completed = items.filter((i) => i.done).length;
  const total = items.length;
  const remaining = total - completed;

  return { total, completed, remaining, items };
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

    // 2. AuthZ — same roles as revenue-opportunity (agent-side staff + doctor + admin)
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

    // 4. Resolve time-period and date
    const period = resolvePeriod(req.query.timePeriod);
    if (!period) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid timePeriod (morning|afternoon|evening)" });
    }
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const dateStr = targetDate.toISOString().slice(0, 10);
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

    // 5. Role scoping
    const doctorScopedRoles = ["doctorStaff", "doctor"];
    const isDoctorScoped = doctorScopedRoles.includes(me.role);



    // 6. Run ALL 12 sections in parallel (4 per period).
    //    Each card group (morning / afternoon / evening) is fetched
    //    up-front so switching tabs is instant. All data is "today"
    //    (date-filtered) — the time period only changes which 4
    //    cards the UI renders, not which data is shown.
    const [
      // Morning cards
      appointments,
      newLeads,
      followUps,
      packageRenewals,
      // Afternoon cards
      openSlots,
      hotLeads,
      packageRenewalsWeek,
      followUpsResponded,
      // Evening cards
      tomorrowAppointments,
      pendingCallbacks,
      cancelledAppointments,
      endOfDayChecklist,
    ] = await Promise.all([
      fetchAppointmentsSection({
        clinicObjectId,
        period,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
      }),
      fetchNewLeadsSection({
        clinicObjectId,
        period,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
      }),
      fetchFollowUpsSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
        dateStr,
      }),
      fetchPackageRenewalsSection({ clinicObjectId }),
      fetchOpenSlotsSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        dateStr,
        isDoctorScoped,
        me,
      }),
      fetchHotLeadsSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
      }),
      fetchPackageRenewalsWeekSection({ clinicObjectId, dayStart }),
      fetchFollowUpsRespondedSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
        dateStr,
      }),
      fetchTomorrowAppointmentsSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
      }),
      fetchPendingCallbacksSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
      }),
      fetchCancelledAppointmentsSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
      }),
      fetchEndOfDayChecklistSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
      }),
    ]);

    // ─── Revenue Rescue summary ──────────────────────────────────────
    // Reuses counts already fetched above so the RevenueRescue card
    // on the dashboard shows the same numbers as the Priorities cards.
    const revenueRescue = {
      abandonedEnquiries: {
        count: newLeads.count || 0,
      },
      cancelledAppointments: {
        count: cancelledAppointments.count || 0,
      },
      packageRenewals: {
        count: packageRenewals.count || 0,
      },
      overdueFollowUps: {
        count: followUps.count || 0,
      },
    };

    // console.log("[DEBUG priorities] RESULTS => newLeads:", newLeads.count, "followUps:", followUps.count, "followUpsResponded:", followUpsResponded.count, "hotLeads:", hotLeads.count);

    return res.status(200).json({
      success: true,
      data: {
        timePeriod: period.key,
        period: { start: period.start, end: period.end, label: period.label },
        date: dateStr,
        // Morning cards
        appointments,
        newLeads,
        followUps,
        packageRenewals,
        // Afternoon cards
        openSlots,
        hotLeads,
        packageRenewalsWeek,
        followUpsResponded,
        // Evening cards
        tomorrowAppointments,
        pendingCallbacks,
        cancelledAppointments,
        endOfDayChecklist,
        // Revenue Rescue summary
        revenueRescue,
      },
    });
  } catch (err) {
    // console.error("[DEBUG priorities] ERROR:", err.message);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal Server Error" });
  }
}

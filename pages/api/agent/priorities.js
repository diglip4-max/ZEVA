import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Lead from "../../../models/Lead";
import Conversation from "../../../models/Conversation";
import Message from "../../../models/Message";
import PatientRegistration from "../../../models/PatientRegistration";
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

// ─── per-section data fetchers ──────────────────────────────────────────

/**
 * 1. Booked-but-not-yet-Approved appointments for the period.
 *    `fromTime` is a 24h "HH:MM" string, so we filter lexicographically
 *    after bounding it inside the period window.
 */
async function fetchAppointmentsSection({ clinicObjectId, period, dayStart, dayEnd, isDoctorScoped, me }) {
  const matchStage = {
    clinicId: clinicObjectId,
    startDate: { $gte: dayStart, $lte: dayEnd },
    status: "booked",
    fromTime: { $gte: period.start, $lt: period.end },
  };
  if (isDoctorScoped) matchStage.doctorId = me._id;

  // Run the count and the "latest" lookup in parallel.
  const [count, latestList] = await Promise.all([
    Appointment.countDocuments(matchStage),
    Appointment.find(matchStage)
      .populate({
        path: "patientId",
        model: "PatientRegistration",
        select: "firstName lastName mobileNumber emrNumber",
      })
      .sort({ fromTime: -1, createdAt: -1 })
      .limit(5)
      .lean(),
  ]);

  const list = latestList.map((a) => {
    const p = a.patientId || {};
    return {
      _id: a._id.toString(),
      patientName:
        `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown patient",
      patientMobile: p.mobileNumber || "",
      emrNumber: p.emrNumber || "",
      fromTime: a.fromTime,
      toTime: a.toTime,
      fromTimeDisplay: formatTime12(a.fromTime),
      toTimeDisplay: formatTime12(a.toTime),
      followType: a.followType || "",
    };
  });
  const latest = list[0] || null;

  return { count, latest, list };
}

/**
 * 2. New leads needing response.
 *
 * For each conversation in the clinic, find the latest message. If
 * it's `incoming` AND no outgoing message exists after it, the lead
 * needs a response. We do this in a single aggregation to avoid N+1.
 *
 * Time-period filter: the lead is attributed to the period when the
 * latest incoming message was received (its `createdAt` hour).
 */
async function fetchNewLeadsSection({ clinicObjectId, period, isDoctorScoped, me }) {
  // Build a [from, to) range for the latest incoming message.
  // We re-derive the period into a UTC date range for createdAt.
  const periodStartMin = toMinutes(period.start);
  const periodEndMin = toMinutes(period.end);
  if (periodStartMin == null || periodEndMin == null) {
    return { count: 0, list: [] };
  }

  // First: get the latest message per conversation, joining the lead.
  const latestPerConv = await Message.aggregate([
    { $match: { clinicId: clinicObjectId, direction: { $in: ["incoming", "outgoing"] } } },
    { $sort: { conversationId: 1, createdAt: -1 } },
    {
      $group: {
        _id: "$conversationId",
        latest: { $first: "$$ROOT" },
      },
    },
    { $match: { "latest.direction": "incoming" } },
    // For each, check whether any outgoing message exists after latest.
    {
      $lookup: {
        from: "messages",
        let: { convId: "$_id", latestAt: "$latest.createdAt" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$conversationId", "$$convId"] },
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

  if (!latestPerConv.length) {
    return { count: 0, list: [] };
  }

  // Populate the lead details and filter to the requested period.
  const leadIds = [
    ...new Set(
      latestPerConv
        .map((r) => r.latest?.leadId)
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
  const inPeriod = latestPerConv.filter((row) => {
    const ts = row.latest?.createdAt ? new Date(row.latest.createdAt) : null;
    if (!ts || Number.isNaN(ts.getTime())) return false;
    // The timestamp is in UTC. Convert to local minutes-of-day for filtering.
    // We use the local hour/minute to align with the period window.
    const minutes = ts.getHours() * 60 + ts.getMinutes();
    return minutes >= periodStartMin && minutes < periodEndMin;
  });

  // If nothing falls into this period, return empty (no leads attributed
  // here). This is the "dynamic count" the user asked for.
  if (!inPeriod.length) {
    return { count: 0, list: [] };
  }

  // For doctor-scoped roles, only show leads assigned to them. We do
  // this on the populated lead doc.
  const meId = me?._id?.toString() || "";
  const list = inPeriod
    // Drop rows whose latest message has no `leadId` — these can't
    // be attributed to a lead and the map below would otherwise throw
    // "Cannot read properties of undefined (reading 'toString')".
    .filter((row) => row.latest && row.latest.leadId)
    .map((row) => {
      const leadIdStr =
        typeof row.latest.leadId === "string"
          ? row.latest.leadId
          : row.latest.leadId.toString();
      const lead = leadById.get(leadIdStr);
      if (!lead) return null;
      if (isDoctorScoped) {
        const assigned = Array.isArray(lead.assignedTo)
          ? lead.assignedTo.some((a) => a && a.user && a.user.toString() === meId)
          : false;
        if (!assigned) return null;
      }
      return {
        leadId: lead._id.toString(),
        conversationId: row._id ? row._id.toString() : "",
        name: buildLeadName(lead),
        phone: lead.phone || "",
        email: lead.email || "",
        latestMessageAt: row.latest.createdAt,
        latestMessageContent: row.latest.content || "",
        waitingFor: relativeTimeAgo(row.latest.createdAt),
      };
    })
    .filter(Boolean);

  // Sort by most-recent first.
  list.sort(
    (a, b) => new Date(b.latestMessageAt).getTime() - new Date(a.latestMessageAt).getTime(),
  );

  return { count: list.length, list: list.slice(0, 10) };
}

/**
 * 3. Follow-ups due today.
 * Lead.followUps[0].date or Lead.nextFollowUps[0].date in the date range.
 * Date-based, not period-based — same data across all 3 tabs.
 */
async function fetchFollowUpsSection({ clinicObjectId, dayStart, dayEnd, isDoctorScoped, me }) {
  const match = {
    clinicId: clinicObjectId,
    status: "Follow-up",
    $or: [
      { "followUps.0.date": { $gte: dayStart, $lte: dayEnd } },
      { "nextFollowUps.0.date": { $gte: dayStart, $lte: dayEnd } },
    ],
  };
  if (isDoctorScoped) {
    match.assignedTo = { $elemMatch: { user: me._id } };
  }

  const leads = await Lead.find(match)
    .select("firstName lastName name phone email followUps nextFollowUps")
    .sort({ "followUps.0.date": 1, "nextFollowUps.0.date": 1 })
    .lean();

  const list = leads.map((l) => {
    const followAt = l.followUps?.[0]?.date || l.nextFollowUps?.[0]?.date || null;
    return {
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
    };
  });

  return { count: list.length, list };
}

/**
 * 4. Package renewals: packages expiring today.
 * Sum of totalPrice for those packages, plus the list for the
 * "View full details" modal.
 */
async function fetchPackageRenewalsSection({ clinicObjectId, dayStart, dayEnd }) {
  const baseMatch = {
    clinicId: clinicObjectId,
    "packages.endDate": { $gte: dayStart, $lte: dayEnd },
    "packages.paymentStatus": { $nin: ["Cancelled"] },
  };

  const [agg, list] = await Promise.all([
    PatientRegistration.aggregate([
      { $match: baseMatch },
      { $unwind: "$packages" },
      {
        $match: {
          "packages.endDate": { $gte: dayStart, $lte: dayEnd },
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
          "packages.endDate": { $gte: dayStart, $lte: dayEnd },
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
    })),
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

    // 6. Run all 4 sections in parallel.
    const [appointments, newLeads, followUps, packageRenewals] = await Promise.all([
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
        isDoctorScoped,
        me,
      }),
      fetchFollowUpsSection({
        clinicObjectId,
        dayStart,
        dayEnd,
        isDoctorScoped,
        me,
      }),
      fetchPackageRenewalsSection({ clinicObjectId, dayStart, dayEnd }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        timePeriod: period.key,
        period: { start: period.start, end: period.end, label: period.label },
        date: dateStr,
        appointments,
        newLeads,
        followUps,
        packageRenewals,
      },
    });
  } catch (err) {
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal Server Error" });
  }
}

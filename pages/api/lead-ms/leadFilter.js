// /pages/api/lead-ms/leadFilter.js
import dbConnect from "../../../lib/database";
import Lead from "../../../models/Lead";
import Clinic from "../../../models/Clinic";
import Treatment from "../../../models/Treatment";
import User from "../../../models/Users";
import { getUserFromReq, requireRole } from "./auth";
import { checkAgentPermission } from "../agent/permissions-helper";

// ✅ Escape regex special chars to prevent crashes on search
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ✅ Status alias map — frontend "Contacted" ↔ backend "Engaged" etc.
const STATUS_ALIASES = {
  Contacted: ["Contacted", "Engaged"],
  Engaged: ["Engaged", "Contacted"],
  Booked: ["Booked", "Confirmed"],
  Confirmed: ["Confirmed", "Booked"],
  "Follow-up": ["Follow-up", "Follow up", "Followup"],
  "Not Interested": ["Not Interested", "NotInterested"],
};

// ✅ Whitelist of sortable fields (security)
const SORTABLE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "name",
  "status",
  "source",
  "phone",
  "email",
]);

export default async function handler(req, res) {
  await dbConnect();

  const me = await getUserFromReq(req);
  if (
    !requireRole(me, [
      "clinic",
      "agent",
      "admin",
      "doctor",
      "doctorStaff",
      "staff",
    ])
  ) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // ✅ Resolve clinicId based on role
  let clinic;
  if (me.role === "clinic") {
    clinic = await Clinic.findOne({ owner: me._id });
  } else if (me.role === "agent") {
    if (!me.clinicId) {
      return res
        .status(403)
        .json({ success: false, message: "Agent not linked to any clinic" });
    }
    clinic = await Clinic.findById(me.clinicId);
  } else if (me.role === "doctor") {
    if (!me.clinicId) {
      return res
        .status(403)
        .json({ success: false, message: "Doctor not linked to any clinic" });
    }
    clinic = await Clinic.findById(me.clinicId);
  } else if (me.role === "doctorStaff" || me.role === "staff") {
    if (!me.clinicId) {
      return res
        .status(403)
        .json({ success: false, message: "Staff not linked to any clinic" });
    }
    clinic = await Clinic.findById(me.clinicId);
  } else if (me.role === "admin") {
    const { clinicId: adminClinicId } = req.query;
    if (adminClinicId) {
      clinic = await Clinic.findById(adminClinicId);
    }
  }

  if (!clinic) {
    return res
      .status(404)
      .json({ success: false, message: "Clinic not found for this user" });
  }

  // ✅ Permission checks (unchanged)
  if (me.role !== "admin" && clinic._id) {
    try {
      const { checkClinicPermission } = await import("./permissions-helper");
      const { hasPermission: clinicHasPermission, error: clinicError } =
        await checkClinicPermission(
          clinic._id,
          "create_lead",
          "read",
          null,
          me.role === "doctor"
            ? "doctor"
            : me.role === "clinic"
              ? "clinic"
              : null,
        );

      if (!clinicHasPermission) {
        return res.status(403).json({
          success: false,
          message: clinicError || "You do not have permission to view leads",
        });
      }
    } catch (permError) {
      return res.status(500).json({
        success: false,
        message: "Error checking permissions",
        error: permError.message,
      });
    }

    if (me.role === "agent") {
      const { hasPermission: agentHasPermission, error: agentError } =
        await checkAgentPermission(me._id, "create_lead", "read", null);

      if (!agentHasPermission) {
        return res.status(403).json({
          success: false,
          message: agentError || "You do not have permission to view leads",
        });
      }
    }
  }

  if (req.method === "GET") {
    try {
      const {
        treatment,
        offer,
        source,
        status,
        name,
        startDate,
        endDate,
        page: pageQuery,
        limit: limitQuery,
        segmentId,
        sortBy: sortByQuery,
        sortOrder: sortOrderQuery,
        // ✅ NEW filters
        assignedTo, // agent _id
        quickFilter, // one of: "no_next_action" | "overdue" | "idle_48h" | "duplicates"
      } = req.query;

      // ✅ Build base filter (scoped to clinic)
      const filter = { clinicId: clinic._id };
      const baseFilter = { clinicId: clinic._id };

      if (treatment) filter["treatments.treatment"] = treatment;
      if (offer) filter.offerTag = offer;
      if (source) filter.source = source;

      // ✅ Status aliases
      if (status) {
        const aliases = STATUS_ALIASES[status] || [status];
        filter.status = aliases.length > 1 ? { $in: aliases } : aliases[0];
      }

      // ✅ Safe name search
      if (name) {
        filter.name = { $regex: escapeRegex(name), $options: "i" };
      }

      // ✅ Date range
      if (startDate && endDate) {
        const from = new Date(startDate);
        const to = new Date(endDate);
        to.setHours(23, 59, 59, 999);
        if (!Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime())) {
          filter.createdAt = { $gte: from, $lte: to };
        }
      }

      if (segmentId) {
        filter.segments = { $in: [segmentId] };
      }

      // ✅ NEW: Agent/Owner filter
      if (assignedTo) {
        filter["assignedTo.user"] = assignedTo;
      }

      // ✅ NEW: Quick filters
      const now = new Date();
      const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

      switch (quickFilter) {
        case "no_next_action":
          // No follow-ups at all
          filter.$or = [
            { followUps: { $exists: false } },
            { followUps: { $size: 0 } },
          ];
          break;

        case "overdue":
          // Has at least one follow-up AND the latest one is in the past
          filter.followUps = { $elemMatch: { date: { $lt: now } } };
          break;

        case "idle_48h":
          // Not updated in last 48h AND still in active status
          filter.updatedAt = { $lt: fortyEightHoursAgo };
          filter.status = { $nin: ["Visited", "Not Interested", "Booked"] };
          break;

        case "duplicates":
          // We'll handle duplicates separately (needs aggregation, see below)
          break;

        default:
          break;
      }

      // ✅ Pagination
      const page = Math.max(1, parseInt(pageQuery || "1", 10));
      const limit = Math.min(
        100,
        Math.max(1, parseInt(limitQuery || "20", 10)),
      );
      const skip = (page - 1) * limit;

      // ✅ Sorting
      const sortField = SORTABLE_FIELDS.has(sortByQuery)
        ? sortByQuery
        : "createdAt";
      const sortDir = sortOrderQuery === "asc" ? 1 : -1;
      const sortObj = { [sortField]: sortDir };

      // ✅ SPECIAL CASE: duplicates → needs aggregation
      let leads = [];
      let totalCount = 0;

      if (quickFilter === "duplicates") {
        // Find phones that appear more than once within the clinic
        const duplicatePhones = await Lead.aggregate([
          { $match: baseFilter },
          { $match: { phone: { $exists: true, $nin: [null, ""] } } },
          { $group: { _id: "$phone", count: { $sum: 1 } } },
          { $match: { count: { $gt: 1 } } },
          { $project: { _id: 1 } },
        ]);

        const phones = duplicatePhones.map((d) => d._id);

        if (phones.length === 0) {
          // No duplicates → return empty
          return res.status(200).json({
            success: true,
            leads: [],
            pagination: {
              totalLeads: 0,
              totalPages: 1,
              currentPage: 1,
              limit,
              hasMore: false,
            },
            statusCounts: {},
            allLeadsCount: 0,
          });
        }

        filter.phone = { $in: phones };

        totalCount = await Lead.countDocuments(filter);

        leads = await Lead.find(filter)
          .skip(skip)
          .limit(limit)
          .sort({ phone: 1, createdAt: -1 })
          .populate({
            path: "treatments.treatment",
            model: "Treatment",
            select: "name",
          })
          .populate({
            path: "assignedTo.user",
            model: "User",
            select: "name role email",
          })
          .populate({
            path: "notes.addedBy",
            model: "User",
            select: "name",
          })
          .lean();

        const totalPages = Math.ceil(totalCount / limit) || 1;

        return res.status(200).json({
          success: true,
          leads,
          pagination: {
            totalLeads: totalCount,
            totalPages,
            currentPage: page,
            limit,
            hasMore: page < totalPages,
          },
          statusCounts: {},
          allLeadsCount: totalCount,
        });
      }

      // ✅ Normal path: parallel queries
      const [countRes, leadsRes, statusAgg, allCount] = await Promise.all([
        Lead.countDocuments(filter),

        Lead.find(filter)
          .skip(skip)
          .limit(limit)
          .sort(sortObj)
          .populate({
            path: "treatments.treatment",
            model: "Treatment",
            select: "name",
          })
          .populate({
            path: "assignedTo.user",
            model: "User",
            select: "name role email",
          })
          .populate({
            path: "notes.addedBy",
            model: "User",
            select: "name",
          })
          .lean(),

        Lead.aggregate([
          { $match: baseFilter },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]),

        Lead.countDocuments(baseFilter),
      ]);

      totalCount = countRes;
      leads = leadsRes;

      // ✅ Build statusCounts map
      const statusCounts = {};
      for (const row of statusAgg) {
        if (!row?._id) continue;
        statusCounts[row._id] = (statusCounts[row._id] || 0) + row.count;
      }
      for (const [primary, aliases] of Object.entries(STATUS_ALIASES)) {
        if (aliases.length > 1) {
          const total = aliases.reduce(
            (sum, a) => sum + (statusCounts[a] || 0),
            0,
          );
          statusCounts[primary] = total;
        }
      }

      const totalPages = Math.ceil(totalCount / limit) || 1;
      const currentPage = page;
      const hasMore = page < totalPages;

      return res.status(200).json({
        success: true,
        leads,
        pagination: {
          totalLeads: totalCount,
          totalPages,
          currentPage,
          limit,
          hasMore,
        },
        statusCounts,
        allLeadsCount: allCount,
      });
    } catch (err) {
      console.error("Error fetching leads:", err);
      return res
        .status(500)
        .json({ success: false, message: "Failed to fetch leads" });
    }
  }

  return res
    .status(405)
    .json({ success: false, message: "Method not allowed" });
}

// /pages/api/lead-ms/export-leads.js
import dbConnect from "../../../lib/database";
import Lead from "../../../models/Lead";
import Clinic from "../../../models/Clinic";
import Treatment from "../../../models/Treatment";
import User from "../../../models/Users";
import { getUserFromReq, requireRole } from "./auth";
import { checkAgentPermission } from "../agent/permissions-helper";

// ✅ Escape regex special chars
const escapeRegex = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ✅ Status alias map (same as leadFilter)
const STATUS_ALIASES = {
  Contacted: ["Contacted", "Engaged"],
  Engaged: ["Engaged", "Contacted"],
  Booked: ["Booked", "Confirmed"],
  Confirmed: ["Confirmed", "Booked"],
  "Follow-up": ["Follow-up", "Follow up", "Followup"],
  "Not Interested": ["Not Interested", "NotInterested"],
};

// ✅ Whitelist of sortable fields
const SORTABLE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "name",
  "status",
  "source",
  "phone",
  "email",
]);

// ✅ CSV cell escaper
const csvCell = (value) => {
  if (value === undefined || value === null) return '""';
  const str = String(value).replace(/"/g, '""');
  return `"${str}"`;
};

// ✅ Date formatter (IST-friendly output)
const formatDate = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
};

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  // ============ AUTH ============
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

  // ============ RESOLVE CLINIC ============
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

  // ============ PERMISSIONS ============
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
          message: clinicError || "You do not have permission to export leads",
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
          message: agentError || "You do not have permission to export leads",
        });
      }
    }
  }

  // ============ QUERY PARAMS (same as leadFilter) ============
  try {
    const {
      treatment,
      offer,
      source,
      status,
      name,
      startDate,
      endDate,
      segmentId,
      sortBy: sortByQuery,
      sortOrder: sortOrderQuery,
      assignedTo,
      quickFilter,
    } = req.query;

    // ✅ Base filter
    const filter = { clinicId: clinic._id };
    const baseFilter = { clinicId: clinic._id };

    if (treatment) filter["treatments.treatment"] = treatment;
    if (offer) filter.offerTag = offer;
    if (source) filter.source = source;

    if (status) {
      const aliases = STATUS_ALIASES[status] || [status];
      filter.status = aliases.length > 1 ? { $in: aliases } : aliases[0];
    }

    if (name) {
      filter.name = { $regex: escapeRegex(name), $options: "i" };
    }

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

    if (assignedTo) {
      filter["assignedTo.user"] = assignedTo;
    }

    // ✅ Quick filters (same as leadFilter)
    const now = new Date();
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    switch (quickFilter) {
      case "no_next_action":
        filter.$or = [
          { followUps: { $exists: false } },
          { followUps: { $size: 0 } },
        ];
        break;
      case "overdue":
        filter.followUps = { $elemMatch: { date: { $lt: now } } };
        break;
      case "idle_48h":
        filter.updatedAt = { $lt: fortyEightHoursAgo };
        filter.status = { $nin: ["Visited", "Not Interested", "Booked"] };
        break;
      case "duplicates":
        // handled below via aggregation
        break;
      default:
        break;
    }

    // ✅ Sorting
    const sortField = SORTABLE_FIELDS.has(sortByQuery)
      ? sortByQuery
      : "createdAt";
    const sortDir = sortOrderQuery === "asc" ? 1 : -1;
    const sortObj = { [sortField]: sortDir };

    // ============ FETCH LEADS ============
    let leads = [];

    if (quickFilter === "duplicates") {
      // Same aggregation as leadFilter
      const duplicatePhones = await Lead.aggregate([
        { $match: baseFilter },
        { $match: { phone: { $exists: true, $nin: [null, ""] } } },
        { $group: { _id: "$phone", count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        { $project: { _id: 1 } },
      ]);

      const phones = duplicatePhones.map((d) => d._id);

      if (phones.length === 0) {
        // Return empty CSV with headers only
        const emptyHeaders = [
          "Name",
          "Phone",
          "Email",
          "Gender",
          "Age",
          "Source",
          "Custom Source",
          "Status",
          "Custom Status",
          "Offer",
          "Treatments",
          "Assigned To",
          "Notes",
          "Follow-ups",
          "Segments",
          "Tags",
          "Created At",
          "Updated At",
        ];
        const csv = emptyHeaders.map(csvCell).join(",") + "\n";
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="leads_export_${new Date()
            .toISOString()
            .slice(0, 10)}.csv"`,
        );
        return res.status(200).send("\uFEFF" + csv);
      }

      filter.phone = { $in: phones };

      leads = await Lead.find(filter)
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
        .populate({
          path: "segments",
          model: "Segment",
          select: "name",
        })
        .lean();
    } else {
      leads = await Lead.find(filter)
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
        .populate({
          path: "segments",
          model: "Segment",
          select: "name",
        })
        .lean();
    }

    // ============ BUILD CSV ============
    const headers = [
      "Name",
      "Phone",
      "Email",
      "Gender",
      "Age",
      "Source",
      "Custom Source",
      "Status",
      "Custom Status",
      "Offer",
      "Treatments",
      "Assigned To",
      "Notes",
      "Follow-ups",
      "Segments",
      "Tags",
      "Created At",
      "Updated At",
    ];

    const rows = leads.map((lead) => {
      const treatmentsStr = (lead.treatments || [])
        .map((t) => {
          const name = t?.treatment?.name || "";
          const sub = t?.subTreatment ? `: ${t.subTreatment}` : "";
          return `${name}${sub}`.trim();
        })
        .filter(Boolean)
        .join(" | ");

      const assignedStr = (lead.assignedTo || [])
        .map((a) => a?.user?.name)
        .filter(Boolean)
        .join(" | ");

      const notesStr = (lead.notes || [])
        .map((n) => {
          const by = n?.addedBy?.name ? ` (${n.addedBy.name})` : "";
          const when = n?.createdAt ? ` @ ${formatDate(n.createdAt)}` : "";
          return `${n?.text || ""}${by}${when}`;
        })
        .filter(Boolean)
        .join(" | ");

      const followUpsStr = (lead.followUps || [])
        .map((f) => formatDate(f?.date))
        .filter(Boolean)
        .join(" | ");

      const segmentsStr = (lead.segments || [])
        .map((s) => s?.name || "")
        .filter(Boolean)
        .join(" | ");

      const tagsStr = (lead.tags || []).join(" | ");

      return [
        csvCell(lead.name || ""),
        csvCell(lead.phone || ""),
        csvCell(lead.email || ""),
        csvCell(lead.gender || ""),
        csvCell(lead.age ?? ""),
        csvCell(lead.source || ""),
        csvCell(lead.customSource || ""),
        csvCell(lead.status || ""),
        csvCell(lead.customStatus || ""),
        csvCell(lead.offerTag || ""),
        csvCell(treatmentsStr),
        csvCell(assignedStr),
        csvCell(notesStr),
        csvCell(followUpsStr),
        csvCell(segmentsStr),
        csvCell(tagsStr),
        csvCell(formatDate(lead.createdAt)),
        csvCell(formatDate(lead.updatedAt)),
      ].join(",");
    });

    const csvContent = [headers.map(csvCell).join(","), ...rows].join("\n");

    // ✅ Filename with applied filters hint
    const parts = ["leads_export"];
    if (status) parts.push(status.toLowerCase().replace(/\s+/g, "_"));
    if (source) parts.push(source.toLowerCase().replace(/\s+/g, "_"));
    if (quickFilter) parts.push(quickFilter);
    if (startDate) parts.push(startDate);
    if (endDate) parts.push(endDate);
    parts.push(new Date().toISOString().slice(0, 10));
    const filename = `${parts.join("_")}.csv`;

    // ✅ Send as downloadable CSV
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    // ✅ Add UTF-8 BOM for Excel to correctly show Hindi/regional chars
    return res.status(200).send("\uFEFF" + csvContent);
  } catch (err) {
    console.error("Error exporting leads:", err);
    return res
      .status(500)
      .json({ success: false, message: "Failed to export leads" });
  }
}

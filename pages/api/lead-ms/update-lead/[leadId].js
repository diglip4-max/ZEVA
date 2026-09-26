// pages/api/lead-ms/update-lead/[leadId].js
import mongoose from "mongoose";
import dbConnect from "../../../../lib/database";
import Lead from "../../../../models/Lead";
import Treatment from "../../../../models/Treatment";
import User from "../../../../models/Users";
import Clinic from "../../../../models/Clinic";
import Segment from "../../../../models/Segment";
import { getUserFromReq, requireRole } from "../auth";
import {
  executeWorkflows,
  WORKFLOW_ENTITY_TYPE,
  WORKFLOW_TRIGGER_TYPE,
} from "../../../../bullmq/workflow";

// ✅ Safe array coercion
const toArray = (v) => {
  if (v === undefined || v === null) return [];
  if (Array.isArray(v)) return v;
  return [v];
};

export default async function handler(req, res) {
  await dbConnect();

  // ✅ Only PUT / PATCH allowed
  if (req.method !== "PUT" && req.method !== "PATCH") {
    res.setHeader("Allow", ["PUT", "PATCH"]);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  // ✅ Get leadId from URL param
  const { leadId } = req.query;

  if (!leadId || !mongoose.Types.ObjectId.isValid(leadId)) {
    return res.status(400).json({
      success: false,
      message: "Valid leadId is required in URL",
    });
  }

  // ============ PARSE BODY ============
  let body = req.body;

  // ============ AUTH ============
  const me = await getUserFromReq(req);
  if (
    !me ||
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
  let clinicId;
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res
        .status(400)
        .json({ success: false, message: "Clinic not found for this user" });
    }
    clinicId = clinic._id;
  } else if (
    me.role === "agent" ||
    me.role === "doctor" ||
    me.role === "doctorStaff" ||
    me.role === "staff"
  ) {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "User not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = body.clinicId || null;
  }

  // ============ PAYLOAD ============
  const {
    // leadId is now in URL — removed from body
    name,
    phone,
    email,
    gender,
    age,
    treatments,
    source,
    customSource,
    offerTag,
    status,
    customStatus,
    notes,
    followUps,
    assignedTo,
    segmentId,
  } = body;

  // ============ LOAD EXISTING LEAD ============
  const existingLead = await Lead.findById(leadId);
  if (!existingLead) {
    return res.status(404).json({ success: false, message: "Lead not found" });
  }

  // ✅ Ownership check (non-admin)
  if (
    me.role !== "admin" &&
    clinicId &&
    String(existingLead.clinicId) !== String(clinicId)
  ) {
    return res.status(403).json({
      success: false,
      message: "You do not have access to this lead",
    });
  }

  if (!clinicId) clinicId = existingLead.clinicId;

  // ============ PERMISSION CHECK ============
  if (me.role !== "admin" && clinicId) {
    const { checkClinicPermission } = await import("../permissions-helper");
    const { hasPermission: clinicHasPermission, error: clinicError } =
      await checkClinicPermission(
        clinicId,
        "create_lead",
        "update",
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
        message: clinicError || "You do not have permission to update leads",
      });
    }

    if (me.role === "agent") {
      const { checkAgentPermission } =
        await import("../../agent/permissions-helper");
      const { hasPermission: agentHasPermission, error: agentError } =
        await checkAgentPermission(me._id, "create_lead", "update", null);

      if (!agentHasPermission) {
        return res.status(403).json({
          success: false,
          message: agentError || "You do not have permission to update leads",
        });
      }
    }
  }

  try {
    // ============ BUILD UPDATE OBJECT ============
    const update = {};
    const pushOps = {};

    // --- Basic fields ---
    if (typeof name === "string" && name.trim()) {
      update.name = name.trim();
    }
    if (typeof phone === "string" && phone.trim()) {
      update.phone = phone.trim();
    }
    if (email !== undefined) {
      update.email = email ? String(email).trim().toLowerCase() : null;
    }
    if (gender !== undefined) update.gender = gender;
    if (age !== undefined) update.age = age ? Number(age) : undefined;
    if (source !== undefined) update.source = source;
    if (customSource !== undefined) {
      update.customSource = customSource?.trim() || null;
    }
    if (offerTag !== undefined) update.offerTag = offerTag?.trim() || null;
    if (status !== undefined) update.status = status;
    if (customStatus !== undefined) {
      update.customStatus = customStatus?.trim() || null;
    }

    // --- Treatments ---
    if (treatments !== undefined) {
      const arr = toArray(treatments);
      if (arr.length > 0) {
        const validated = await Promise.all(
          arr.map(async (t) => {
            if (!t || !t.treatment) {
              throw new Error("Treatment field missing in one entry");
            }
            const treatmentName = t.treatment;

            const tDoc = mongoose.Types.ObjectId.isValid(treatmentName)
              ? await Treatment.findById(treatmentName)
              : await Treatment.findOne({
                  name: { $regex: `^${treatmentName}$`, $options: "i" },
                });

            if (!tDoc) {
              throw new Error(`Treatment not found: ${treatmentName}`);
            }

            if (t.subTreatment) {
              const subExists = tDoc.subcategories?.some(
                (s) =>
                  s.name?.trim().toLowerCase() ===
                  String(t.subTreatment).trim().toLowerCase(),
              );
              if (!subExists) {
                throw new Error(`SubTreatment not found: ${t.subTreatment}`);
              }
            }

            return {
              treatment: tDoc._id,
              subTreatment: t.subTreatment || null,
            };
          }),
        );
        update.treatments = validated;
      } else {
        update.treatments = [];
      }
    }

    // --- Notes (append) ---
    if (notes !== undefined) {
      const notesToAdd = toArray(notes)
        .map((n) => {
          const text = typeof n === "string" ? n : n?.text;
          if (!text) return null;
          return {
            text: String(text).trim(),
            addedBy: me._id,
            createdAt: new Date(),
          };
        })
        .filter(Boolean);

      if (notesToAdd.length > 0) {
        pushOps.notes = { $each: notesToAdd };
      }
    }

    // --- Follow-ups (replace) ---
    if (followUps !== undefined) {
      const followArr = toArray(followUps)
        .map((f) => {
          const d = typeof f === "string" ? f : f?.date;
          if (!d) return null;
          const dt = new Date(d);
          if (Number.isNaN(dt.getTime())) return null;
          return { date: dt, addedBy: me._id };
        })
        .filter(Boolean);

      update.followUps = followArr;
    }

    // --- Assigned users ---
    if (assignedTo !== undefined) {
      const rawAssigned = toArray(assignedTo).filter(Boolean);
      if (rawAssigned.length > 0) {
        const assignedArr = await Promise.all(
          rawAssigned.map(async (val) => {
            if (mongoose.Types.ObjectId.isValid(val)) {
              return {
                user: new mongoose.Types.ObjectId(val),
                assignedAt: new Date(),
              };
            } else {
              const u = await User.findOne({
                name: { $regex: `^${val}$`, $options: "i" },
              });
              if (!u) throw new Error(`Assigned user not found: ${val}`);
              return { user: u._id, assignedAt: new Date() };
            }
          }),
        );
        update.assignedTo = assignedArr;
      } else {
        update.assignedTo = [];
      }
    }

    // --- Segments ---
    if (segmentId !== undefined) {
      update.segments = segmentId ? [segmentId] : [];

      if (segmentId && mongoose.Types.ObjectId.isValid(segmentId)) {
        await Segment.findByIdAndUpdate(segmentId, {
          $addToSet: { leads: existingLead._id },
        });
      }
      // Remove from old segments
      const oldSegIds = (existingLead.segments || []).map((s) => String(s));
      if (segmentId && !oldSegIds.includes(String(segmentId))) {
        await Segment.updateMany(
          { _id: { $in: existingLead.segments || [] } },
          { $pull: { leads: existingLead._id } },
        );
      }
    }

    // ============ BUILD MONGO UPDATE ============
    const mongoUpdate = {};
    if (Object.keys(update).length > 0) mongoUpdate.$set = update;
    if (Object.keys(pushOps).length > 0) mongoUpdate.$push = pushOps;

    if (Object.keys(mongoUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields to update",
      });
    }

    // ============ APPLY ============
    const updatedLead = await Lead.findByIdAndUpdate(leadId, mongoUpdate, {
      new: true,
      runValidators: true,
    })
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

    // ============ WORKFLOW ============
    try {
      executeWorkflows({
        entity: WORKFLOW_ENTITY_TYPE.LEAD,
        trigger: WORKFLOW_TRIGGER_TYPE.CREATE_OR_UPDATE_LEAD,
        leadId: updatedLead._id?.toString(),
        clinicId: clinicId?.toString(),
      });
    } catch (err) {
      console.error("Workflow trigger failed:", err);
    }

    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      lead: updatedLead,
    });
  } catch (err) {
    console.error("Error updating lead:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}

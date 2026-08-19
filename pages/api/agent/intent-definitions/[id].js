// pages/api/agent/intent-definitions/[id].js
// PATCH — update an existing clinic-scoped IntentDefinition
// DELETE — soft-delete by setting isActive: false (never hard-delete)

import mongoose from "mongoose";
import dbConnect from "../../../../lib/database";
import IntentDefinition from "../../../../models/IntentDefinition";
import { getUserFromReq } from "../../lead-ms/auth";
import { invalidateClinicPromptCache } from "../../../../lib/classifierPromptBuilder";

export default async function handler(req, res) {
  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    await dbConnect();

    const clinicId = user.clinicId;
    if (!clinicId) {
      return res.status(400).json({ success: false, message: "No clinic associated" });
    }

    const { id } = req.query;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid intent definition ID" });
    }

    // Find the definition — must belong to this clinic (not global)
    const definition = await IntentDefinition.findById(id);
    if (!definition) {
      return res.status(404).json({ success: false, message: "Intent definition not found" });
    }

    // ─── PATCH: Update a clinic-scoped IntentDefinition ────────────────────
    if (req.method === "PATCH") {
      // Cannot edit global (clinicId: null) definitions through this endpoint
      if (!definition.clinicId) {
        return res.status(403).json({
          success: false,
          message: "Cannot edit global intent definitions through this endpoint",
        });
      }

      // Verify the definition belongs to this clinic
      if (definition.clinicId.toString() !== clinicId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Cannot edit intent definitions from another clinic",
        });
      }

      const { label, description, examples, baseWeight, isActive } = req.body;
      const update = {};

      if (label !== undefined) update.label = label;
      if (description !== undefined) update.description = description;
      if (baseWeight !== undefined) update.baseWeight = baseWeight;

      if (examples !== undefined) {
        if (!Array.isArray(examples) || examples.length < 2) {
          return res.status(400).json({
            success: false,
            message: "At least 2 examples are required",
          });
        }
        update.examples = examples;
      }

      if (isActive !== undefined) {
        update.isActive = isActive;
      }

      if (Object.keys(update).length === 0) {
        return res.status(400).json({ success: false, message: "No valid fields to update" });
      }

      // Apply update (triggers pre-save validation if isActive is being set to true)
      Object.assign(definition, update);
      await definition.save();

      // Invalidate prompt cache so changes take effect immediately
      await invalidateClinicPromptCache(clinicId);

      return res.status(200).json({
        success: true,
        data: {
          id: definition._id.toString(),
          key: definition.key,
          label: definition.label,
          description: definition.description,
          examples: definition.examples,
          baseWeight: definition.baseWeight,
          regexPatterns: definition.regexPatterns,
          isActive: definition.isActive,
        },
      });
    }

    // ─── DELETE: Soft-delete by setting isActive: false ────────────────────
    if (req.method === "DELETE") {
      // Cannot delete global definitions through this endpoint
      if (!definition.clinicId) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete global intent definitions through this endpoint",
        });
      }

      // Verify the definition belongs to this clinic
      if (definition.clinicId.toString() !== clinicId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Cannot delete intent definitions from another clinic",
        });
      }

      // Soft-delete: set isActive to false (never hard-delete to preserve historical records)
      definition.isActive = false;
      await definition.save();

      // Invalidate prompt cache
      await invalidateClinicPromptCache(clinicId);

      return res.status(200).json({
        success: true,
        message: `Intent definition "${definition.key}" has been deactivated`,
      });
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("[intent-definitions/:id] Error:", err);

    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }

    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

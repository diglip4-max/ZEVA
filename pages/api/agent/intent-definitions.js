// pages/api/agent/intent-definitions.js
// Admin API for managing intent definitions
// GET — list all IntentDefinitions visible to the authenticated user's clinic
// POST — create a new IntentDefinition scoped to the authenticated user's clinic

import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import IntentDefinition from "../../../models/IntentDefinition";
import { getUserFromReq } from "../lead-ms/auth";
import { invalidateClinicPromptCache } from "../../../lib/classifierPromptBuilder";

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

    // ─── GET: List all visible IntentDefinitions ───────────────────────────
    if (req.method === "GET") {
      // Show global (clinicId: null) + clinic-scoped definitions
      const definitions = await IntentDefinition.find({
        $or: [{ clinicId: null }, { clinicId: new mongoose.Types.ObjectId(clinicId) }],
      })
        .sort({ key: 1 })
        .lean();

      return res.status(200).json({
        success: true,
        data: definitions.map((d) => ({
          id: d._id.toString(),
          clinicId: d.clinicId?.toString() || null,
          key: d.key,
          label: d.label,
          description: d.description,
          examples: d.examples,
          baseWeight: d.baseWeight,
          regexPatterns: d.regexPatterns,
          isActive: d.isActive,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt,
        })),
      });
    }

    // ─── POST: Create a new clinic-scoped IntentDefinition ─────────────────
    if (req.method === "POST") {
      const { key, label, description, examples, baseWeight } = req.body;

      if (!key || !label || !description) {
        return res.status(400).json({
          success: false,
          message: "key, label, and description are required",
        });
      }

      // Require at least 2 examples (matches pre-save validation in model)
      if (!examples || !Array.isArray(examples) || examples.length < 2) {
        return res.status(400).json({
          success: false,
          message: "At least 2 examples are required to create an active intent definition",
        });
      }

      // Check for duplicate key within clinic scope
      const existing = await IntentDefinition.findOne({
        clinicId: new mongoose.Types.ObjectId(clinicId),
        key,
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: `An intent definition with key "${key}" already exists for this clinic`,
        });
      }

      const definition = await IntentDefinition.create({
        clinicId: new mongoose.Types.ObjectId(clinicId),
        key,
        label,
        description,
        examples,
        baseWeight: baseWeight || 50,
        isActive: true,
      });

      // Invalidate prompt cache so changes take effect immediately
      await invalidateClinicPromptCache(clinicId);

      return res.status(201).json({
        success: true,
        data: {
          id: definition._id.toString(),
          clinicId: definition.clinicId.toString(),
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

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("[intent-definitions] Error:", err);

    // Handle Mongoose validation errors (e.g., pre-save hook: < 2 examples)
    if (err.name === "ValidationError") {
      return res.status(400).json({ success: false, message: err.message });
    }

    return res.status(500).json({ success: false, message: "Internal server error" });
  }
}

// pages/api/permissions/custom-actions.js
// ─────────────────────────────────────────────────────────────────────────────
// API endpoints for custom (registry-defined) permission actions.
//
// GET  /api/permissions/custom-actions?module=<moduleKey>
//      → Returns available custom actions for a module from the registry.
//
// PATCH /api/permissions/custom-actions
//      → Body: { clinicId, role, module, actionKey, value }
//      → Updates only the given module's customActions.<actionKey> via
//        updateOne with dot notation — does NOT overwrite the entire
//        actions object.
// ─────────────────────────────────────────────────────────────────────────────
import dbConnect from "../../../lib/database";
import ClinicPermission from "../../../models/ClinicPermission";
import {
  MODULE_CUSTOM_ACTIONS,
  getCustomActionsForModule,
  isRegisteredCustomAction,
} from "../../../config/actionRegistry";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  await dbConnect();

  // ── Auth ────────────────────────────────────────────────────────────────
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ success: false, message: "No token provided" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const allowedRoles = ["admin", "clinic", "doctor"];
  if (!allowedRoles.includes(decoded.role)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // ── GET: return available custom actions for a module ───────────────────
  if (req.method === "GET") {
    const { module: moduleKey } = req.query;
    if (!moduleKey || typeof moduleKey !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "Query parameter 'module' is required" });
    }

    const actions = getCustomActionsForModule(moduleKey);
    return res.status(200).json({ success: true, data: actions });
  }

  // ── PATCH: update a single custom action value ──────────────────────────
  if (req.method === "PATCH") {
    const { clinicId, role = "clinic", module: moduleKey, actionKey, value } = req.body;

    if (!clinicId || !moduleKey || !actionKey || typeof value !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "clinicId, module, actionKey (string), and value (boolean) are required",
      });
    }

    // Validate that the action key is registered for this module
    if (!isRegisteredCustomAction(moduleKey, actionKey)) {
      return res.status(400).json({
        success: false,
        message: `Action key '${actionKey}' is not registered for module '${moduleKey}'`,
      });
    }

    const normalizedRole = String(role).toLowerCase();
    if (!allowedRoles.includes(normalizedRole)) {
      return res.status(400).json({ success: false, message: "Invalid role" });
    }

    try {
      // Use dot-notation update to modify ONLY the specific custom action key
      // without overwriting the entire actions object.
      // Path: permissions.$[elem].actions.customActions.<actionKey>
      const result = await ClinicPermission.updateOne(
        { clinicId, role: normalizedRole, isActive: true },
        {
          $set: {
            [`permissions.$[elem].actions.customActions.${actionKey}`]: value,
            lastModified: new Date(),
          },
        },
        {
          arrayFilters: [{ "elem.module": moduleKey }],
        },
      );

      if (result.modifiedCount === 0 && result.matchedCount === 0) {
        return res.status(404).json({
          success: false,
          message: `No active ${normalizedRole} permission document found for clinic ${clinicId}`,
        });
      }

      return res.status(200).json({
        success: true,
        message: `Custom action '${actionKey}' updated to ${value} for module '${moduleKey}'`,
        data: { module: moduleKey, actionKey, value },
      });
    } catch (error) {
      console.error("Error updating custom action:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}

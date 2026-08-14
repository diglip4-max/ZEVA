// middleware/withPermissionCheck.js
// ─────────────────────────────────────────────────────────────────────────────
// Higher-order function that wraps a Next.js API route handler with a
// permission check. Works for both standard actions (create/read/update/
// delete/import/export) AND custom actions (advance/approve/etc.).
//
// Usage:
//   import withPermissionCheck from '../../../middleware/withPermissionCheck';
//
//   export default withPermissionCheck('clinic_patient_registration', 'advance')(
//     async function handler(req, res) { ... }
//   );
//
// The middleware resolves the user's clinicId from the decoded JWT, loads
// their ClinicPermission document, and calls hasPermission() to allow/deny.
// Admins bypass the check automatically.
// ─────────────────────────────────────────────────────────────────────────────
import dbConnect from "../lib/database";
import ClinicPermission from "../models/ClinicPermission";
import Clinic from "../models/Clinic";
import User from "../models/Users";
import { hasPermission as checkHasPermission } from "../lib/hasPermission";

/**
 * Resolve clinicId from a decoded JWT payload.
 * Returns null for admin role (admins bypass permission checks).
 */
async function resolveClinicId(decoded) {
  if (!decoded?.userId) return null;

  if (decoded.role === "admin") return null;

  if (decoded.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: decoded.userId }).select("_id");
    return clinic?._id || null;
  }

  // doctor, agent, doctorStaff, staff
  const user = await User.findById(decoded.userId).select("clinicId");
  return user?.clinicId || null;
}

/**
 * Create a permission-checking wrapper for an API route handler.
 *
 * @param {string} moduleKey   – module key (e.g. "clinic_patient_registration")
 * @param {string} actionKey   – action to check (e.g. "advance", "create")
 * @param {string} [subModule] – optional submodule name for scoped check
 * @returns {function} – HOF that wraps (req, res) => Promise
 */
export default function withPermissionCheck(moduleKey, actionKey, subModule) {
  return function wrap(handler) {
    return async function permissionCheckedHandler(req, res) {
      await dbConnect();

      // Extract and verify token
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (!token) {
        return res.status(401).json({ success: false, message: "No token provided" });
      }

      let decoded;
      try {
        const jwt = (await import("jsonwebtoken")).default;
        decoded = jwt.verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(401).json({ success: false, message: "Invalid token" });
      }

      // Admin bypass
      if (decoded.role === "admin") {
        req.user = decoded;
        return handler(req, res);
      }

      const clinicId = await resolveClinicId(decoded);
      if (!clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "Unable to resolve clinic for this user" });
      }

      // Load the clinic's permission document
      const clinicPermission = await ClinicPermission.findOne({
        clinicId,
        isActive: true,
      }).lean();

      if (!clinicPermission) {
        // No permissions set up – allow by default (backward compatibility)
        req.user = decoded;
        return handler(req, res);
      }

      // Find the matching module in the permissions array
      const moduleCandidates = Array.from(
        new Set(
          [
            moduleKey,
            moduleKey?.startsWith("clinic_") ? moduleKey.slice("clinic_".length) : null,
            moduleKey?.startsWith("doctor_") ? moduleKey.slice("doctor_".length) : null,
            moduleKey?.startsWith("agent_") ? moduleKey.slice("agent_".length) : null,
            moduleKey?.startsWith("admin_") ? moduleKey.slice("admin_".length) : null,
            moduleKey ? `clinic_${moduleKey}` : null,
            moduleKey ? `doctor_${moduleKey}` : null,
            moduleKey ? `agent_${moduleKey}` : null,
            moduleKey ? `admin_${moduleKey}` : null,
            moduleKey ? moduleKey.replace(/^(admin|clinic|doctor|agent)_/, "") : null,
          ].filter(Boolean),
        ),
      );

      const modulePermission = clinicPermission.permissions.find((p) => {
        const pModule = p.module || "";
        if (moduleCandidates.includes(pModule)) return true;
        const pModuleWithoutPrefix = pModule.replace(/^(admin|clinic|doctor|agent)_/, "");
        const moduleKeyWithoutPrefix = moduleKey.replace(/^(admin|clinic|doctor|agent)_/, "");
        return pModuleWithoutPrefix === moduleKeyWithoutPrefix;
      });

      if (!modulePermission) {
        // Module not in permissions – allow by default (backward compatibility)
        req.user = decoded;
        return handler(req, res);
      }

      // Check permission (supports both standard and custom actions)
      const allowed = checkHasPermission(modulePermission, actionKey, subModule);
      if (!allowed) {
        return res.status(403).json({
          success: false,
          message: `Permission denied: '${actionKey}' action not allowed for module '${moduleKey}'${
            subModule ? ` / submodule '${subModule}'` : ""
          }`,
        });
      }

      req.user = decoded;
      return handler(req, res);
    };
  };
}

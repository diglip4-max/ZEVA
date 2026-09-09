// lib/finance/dashboardAuth.js
//
// Shared boilerplate for every /api/finance/dashboard/* endpoint:
//   - method check
//   - DB connect
//   - auth + role check
//   - clinicId resolution (clinic / agent / doctor / doctorStaff / admin)
//   - clinic.currency resolution (so "AED" is never hard-coded again)
//   - consistent error handling
//
// Usage in an endpoint:
//
//   import { withDashboardAuth } from "../../../../lib/finance/dashboardAuth";
//
//   export default withDashboardAuth(async (req, res, ctx) => {
//     const { clinicId, currency } = ctx;
//     // ... your query logic ...
//     return res.status(200).json({ success: true, data: { currency, ... } });
//   });

import dbConnect from "../database";
import Clinic from "../../models/Clinic";
import { getUserFromReq, requireRole } from "../../pages/api/lead-ms/auth";

export const ALLOWED_DASHBOARD_ROLES = [
  "clinic",
  "agent",
  "admin",
  "doctor",
  "doctorStaff",
];

export class DashboardError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value) || 0;
  if (value?.$numberDecimal) return parseFloat(value.$numberDecimal) || 0;
  if (value?._bsontype === "Decimal128")
    return parseFloat(value.toString()) || 0;
  return 0;
};

export async function resolveClinicId(me, req) {
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id }).select("_id").lean();
    if (!clinic)
      throw new DashboardError(400, "Clinic not found for this user");
    return clinic._id;
  }
  if (["agent", "doctor", "doctorStaff"].includes(me.role)) {
    if (!me.clinicId)
      throw new DashboardError(400, "User not tied to a clinic");
    return me.clinicId;
  }
  if (me.role === "admin") {
    const clinicId = req.query.clinicId;
    if (!clinicId)
      throw new DashboardError(
        400,
        "clinicId is required for admin in query parameters",
      );
    return clinicId;
  }
  throw new DashboardError(403, "Access denied");
}

// Clinic.currency defaults to "INR" on the model, but every clinic can set
// its own. Never assume AED (or any currency) on the server or client.
export async function getClinicCurrency(clinicId) {
  const clinic = await Clinic.findById(clinicId).select("currency").lean();
  return clinic?.currency || "USD";
}

/**
 * Wrap a finance-dashboard GET handler with the shared auth/context flow.
 * `fn(req, res, { clinicId, currency, me })` should return the response.
 */
export function withDashboardAuth(fn) {
  return async function handler(req, res) {
    if (req.method !== "GET") {
      return res
        .status(405)
        .json({ success: false, message: "Method Not Allowed" });
    }

    try {
      await dbConnect();

      const me = await getUserFromReq(req);
      if (!me) {
        return res
          .status(401)
          .json({ success: false, message: "Not authenticated" });
      }

      if (!requireRole(me, ALLOWED_DASHBOARD_ROLES)) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied. Only clinic, agent, admin, or doctor can view this.",
        });
      }

      const clinicId = await resolveClinicId(me, req);
      const currency = await getClinicCurrency(clinicId);

      return await fn(req, res, { clinicId, currency, me });
    } catch (error) {
      if (error instanceof DashboardError) {
        return res
          .status(error.status)
          .json({ success: false, message: error.message });
      }
      console.error("Finance dashboard error:", error);
      return res
        .status(500)
        .json({ success: false, message: "Internal Server Error" });
    }
  };
}

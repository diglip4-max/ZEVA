import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Service from "../../../models/Service";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/revenue-at-risk?date=YYYY-MM-DD
 *
 * Calculates revenue at risk from appointments with statuses:
 *   - Cancelled, No Show, booked
 *
 * For each appointment, checks if services/treatments are attached.
 * Sums the service price × quantity for all linked services.
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       totalAmount: 4500,
 *       appointmentCount: 6,
 *       statusBreakdown: { Cancelled: 2, "No Show": 1, booked: 3 },
 *       currency: "AED"
 *     }
 *   }
 */

// ─── helpers ────────────────────────────────────────────────────────────

function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getDayRange(dateObj) {
  const start = new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      0, 0, 0, 0,
    ),
  );
  const end = new Date(
    Date.UTC(
      dateObj.getUTCFullYear(),
      dateObj.getUTCMonth(),
      dateObj.getUTCDate(),
      23, 59, 59, 999,
    ),
  );
  return { start, end };
}

/**
 * Expand a UTC day range so it covers any timezone's interpretation
 * of "that date". ±18 hours covers every real-world timezone.
 */
function getTimezoneSafeDayRange(dayStart, dayEnd) {
  const OFFSET_MS = 18 * 60 * 60 * 1000;
  return {
    start: new Date(dayStart.getTime() - OFFSET_MS),
    end: new Date(dayEnd.getTime() + OFFSET_MS),
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
    const authUser = await getUserFromReq(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. AuthZ
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) {
      return res.status(404).json({ message: error });
    }

    if (!clinicId && authUser.role === "clinic") {
      const Clinic = (await import("../../../models/Clinic")).default;
      const clinic = await Clinic.findOne({ owner: authUser._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    }

    if (!clinicId) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());

    // 3. Parse date
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

    // 4. Find appointments with at-risk statuses that have services attached
    const atRiskStatuses = ["Cancelled", "No Show", "booked"];

    const atRiskAppointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: atRiskStatuses },
    })
      .select("status services serviceIds serviceId treatment")
      .lean();

    // 5. Collect all unique service IDs from appointments that have services
    const allServiceIds = new Set();
    const appointmentsWithServices = [];

    for (const apt of atRiskAppointments) {
      const svcIds = [];

      // Check services array (with quantity)
      if (apt.services && apt.services.length > 0) {
        for (const s of apt.services) {
          if (s.serviceId) {
            svcIds.push(s.serviceId.toString());
            allServiceIds.add(s.serviceId.toString());
          }
        }
      }

      // Check serviceIds array
      if (apt.serviceIds && apt.serviceIds.length > 0) {
        for (const id of apt.serviceIds) {
          const idStr = id.toString();
          if (!svcIds.includes(idStr)) {
            svcIds.push(idStr);
            allServiceIds.add(idStr);
          }
        }
      }

      // Check single serviceId
      if (apt.serviceId) {
        const idStr = apt.serviceId.toString();
        if (!svcIds.includes(idStr)) {
          svcIds.push(idStr);
          allServiceIds.add(idStr);
        }
      }

      if (svcIds.length > 0) {
        appointmentsWithServices.push({
          appointmentId: apt._id.toString(),
          status: apt.status,
          serviceIds: svcIds,
          services: apt.services || [],
        });
      }
    }

    // 6. Fetch service prices
    let totalAmount = 0;
    const servicePriceMap = new Map();

    if (allServiceIds.size > 0) {
      const services = await Service.find({
        _id: { $in: Array.from(allServiceIds).map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("name price clinicPrice")
        .lean();

      for (const svc of services) {
        // Use clinicPrice if available, otherwise use price
        const price = svc.clinicPrice != null ? svc.clinicPrice : svc.price;
        servicePriceMap.set(svc._id.toString(), price || 0);
      }
    }

    // 7. Calculate total: for each appointment, sum service price × quantity
    for (const apt of appointmentsWithServices) {
      // If appointment has services array with quantity, use that
      if (apt.services.length > 0) {
        for (const s of apt.services) {
          const svcId = s.serviceId?.toString();
          if (svcId && servicePriceMap.has(svcId)) {
            totalAmount += servicePriceMap.get(svcId) * (s.quantity || 1);
          }
        }
      } else {
        // For serviceIds/serviceId without quantity, add price once per service
        for (const svcId of apt.serviceIds) {
          if (servicePriceMap.has(svcId)) {
            totalAmount += servicePriceMap.get(svcId);
          }
        }
      }
    }

    // 8. Build status breakdown
    const statusBreakdown = {};
    for (const apt of atRiskAppointments) {
      statusBreakdown[apt.status] = (statusBreakdown[apt.status] || 0) + 1;
    }

    // 9. Get clinic currency
    const Clinic = (await import("../../../models/Clinic")).default;
    const clinic = await Clinic.findById(clinicObjectId).select("currency").lean();
    const currency = clinic?.currency || "AED";

    return res.status(200).json({
      success: true,
      data: {
        totalAmount,
        appointmentCount: atRiskAppointments.length,
        appointmentsWithServicesCount: appointmentsWithServices.length,
        statusBreakdown,
        currency,
      },
    });
  } catch (err) {
    console.error("Error in revenue-at-risk:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

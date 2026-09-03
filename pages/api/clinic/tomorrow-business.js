import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Service from "../../../models/Service";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/tomorrow-business?date=YYYY-MM-DD
 *
 * Calculates tomorrow's business metrics based on the selected date filter.
 * "Tomorrow" = selectedDate + 1 day.
 *
 * Metrics:
 *   - totalAppointments: booked + cancelled count
 *   - bookedCount: appointments with status "booked"
 *   - cancelledCount: appointments with status "Cancelled"
 *   - expectedRevenue: sum of service/treatment prices for booked + cancelled
 *   - revenueAtRisk: sum of service/treatment prices for cancelled only
 *   - potentialOpportunity: sum of service/treatment prices for booked only
 *   - currency: clinic currency
 */

// ─── helpers ────────────────────────────────────────────────────────────

function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getTomorrowRange(todayDate) {
  const tomorrow = new Date(
    Date.UTC(
      todayDate.getUTCFullYear(),
      todayDate.getUTCMonth(),
      todayDate.getUTCDate() + 1,
      0, 0, 0, 0,
    ),
  );
  const end = new Date(
    Date.UTC(
      tomorrow.getUTCFullYear(),
      tomorrow.getUTCMonth(),
      tomorrow.getUTCDate(),
      23, 59, 59, 999,
    ),
  );
  return { start: tomorrow, end };
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

    // 3. Parse date and calculate tomorrow
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getTomorrowRange(targetDate);

    // 4. Find appointments for tomorrow (booked + Cancelled)
    const targetStatuses = ["booked", "Cancelled"];

    const appointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: { $in: targetStatuses },
    })
      .select("status services serviceIds serviceId treatment")
      .lean();

    if (appointments.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          totalAppointments: 0,
          bookedCount: 0,
          cancelledCount: 0,
          expectedRevenue: 0,
          revenueAtRisk: 0,
          potentialOpportunity: 0,
          currency: "AED",
        },
      });
    }

    // 5. Count by status
    let bookedCount = 0;
    let cancelledCount = 0;
    for (const apt of appointments) {
      if (apt.status === "booked") bookedCount++;
      else if (apt.status === "Cancelled") cancelledCount++;
    }

    // 6. Collect all unique service IDs
    const allServiceIds = new Set();
    const appointmentServices = []; // { status, serviceIds: [{id, quantity}] }

    for (const apt of appointments) {
      const svcList = [];

      // services array (with quantity)
      if (apt.services && apt.services.length > 0) {
        for (const s of apt.services) {
          if (s.serviceId) {
            const idStr = s.serviceId.toString();
            svcList.push({ id: idStr, quantity: s.quantity || 1 });
            allServiceIds.add(idStr);
          }
        }
      }

      // serviceIds array
      if (apt.serviceIds && apt.serviceIds.length > 0) {
        for (const id of apt.serviceIds) {
          const idStr = id.toString();
          if (!svcList.find((s) => s.id === idStr)) {
            svcList.push({ id: idStr, quantity: 1 });
            allServiceIds.add(idStr);
          }
        }
      }

      // single serviceId
      if (apt.serviceId) {
        const idStr = apt.serviceId.toString();
        if (!svcList.find((s) => s.id === idStr)) {
          svcList.push({ id: idStr, quantity: 1 });
          allServiceIds.add(idStr);
        }
      }

      appointmentServices.push({
        status: apt.status,
        services: svcList,
      });
    }

    // 7. Fetch service prices
    const servicePriceMap = new Map();
    if (allServiceIds.size > 0) {
      const services = await Service.find({
        _id: { $in: Array.from(allServiceIds).map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("name price clinicPrice")
        .lean();

      for (const svc of services) {
        const price = svc.clinicPrice != null ? svc.clinicPrice : svc.price;
        servicePriceMap.set(svc._id.toString(), price || 0);
      }
    }

    // 8. Calculate revenue metrics
    let expectedRevenue = 0;
    let revenueAtRisk = 0;
    let potentialOpportunity = 0;

    for (const apt of appointmentServices) {
      let aptTotal = 0;
      for (const s of apt.services) {
        const price = servicePriceMap.get(s.id) || 0;
        aptTotal += price * s.quantity;
      }

      expectedRevenue += aptTotal;

      if (apt.status === "Cancelled") {
        revenueAtRisk += aptTotal;
      } else if (apt.status === "booked") {
        potentialOpportunity += aptTotal;
      }
    }

    // 9. Get clinic currency
    const Clinic = (await import("../../../models/Clinic")).default;
    const clinic = await Clinic.findById(clinicObjectId).select("currency").lean();
    const currency = clinic?.currency || "AED";

    return res.status(200).json({
      success: true,
      data: {
        totalAppointments: appointments.length,
        bookedCount,
        cancelledCount,
        expectedRevenue,
        revenueAtRisk,
        potentialOpportunity,
        currency,
      },
    });
  } catch (err) {
    console.error("Error in tomorrow-business:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

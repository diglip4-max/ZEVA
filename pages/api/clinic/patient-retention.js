import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import PatientRegistration from "../../../models/PatientRegistration";
import Service from "../../../models/Service";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/patient-retention?date=YYYY-MM-DD
 *
 * Calculates patient retention metrics for the clinic:
 *   - newPatients: count registered with patientType "New" on selected date
 *   - returningPatients: count of unique patients with appointments on selected date (patientType "Old")
 *   - repeatVisitRate: % of patients with 2+ appointments (last 90 days)
 *   - inactivePatients: registered but never had an appointment
 *   - highValuePatients: patients with 5+ total appointments
 *   - avgPatientLTV: average revenue per patient from services (last 30 days)
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
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999)
  );
  return { start, end };
}

// Get date range for "last N days" from the selected date
function getLastNDaysRange(dateObj, days) {
  const end = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999)
  );
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days);
  start.setUTCHours(0, 0, 0, 0);
  return { start, end };
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

    // 4. Get appointments for selected date FIRST (needed for new patients query)
    const dayAppointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
    })
      .select("patientId")
      .lean();

    const dayPatientIds = new Set();
    for (const apt of dayAppointments) {
      if (apt.patientId) {
        dayPatientIds.add(apt.patientId.toString());
      }
    }

    // 5. New patients: patientType "New" who have appointments on selected date
    const dayPatientIdsArray = Array.from(dayPatientIds).map((id) => new mongoose.Types.ObjectId(id));

    const newPatientsList = await PatientRegistration.find({
      _id: { $in: dayPatientIdsArray },
      clinicId: clinicObjectId,
      patientType: "New",
    })
      .select("firstName lastName patientType createdAt phone")
      .lean();

    const newPatientsCount = newPatientsList.length;
    const newPatientDetails = newPatientsList.map((p) => ({
      patientName: `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown",
      patientType: p.patientType || "New",
      phone: p.phone || "—",
      registeredDate: p.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "—",
    }));

    // 6. Returning patients: unique patients with appointments today who are "Old"
    let returningPatientsCount = 0;
    if (dayPatientIds.size > 0) {
      const returningCount = await PatientRegistration.countDocuments({
        _id: { $in: Array.from(dayPatientIds).map((id) => new mongoose.Types.ObjectId(id)) },
        clinicId: clinicObjectId,
        patientType: "Old",
      });
      returningPatientsCount = returningCount;
    }

    // 7. Repeat visit rate: % of patients with 2+ appointments in last 90 days
    const { start: last90Start, end: last90End } = getLastNDaysRange(targetDate, 90);
    const last90Appointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: last90Start, $lte: last90End },
    })
      .select("patientId")
      .lean();

    const patientAppointmentCount = {};
    for (const apt of last90Appointments) {
      if (apt.patientId) {
        const pid = apt.patientId.toString();
        patientAppointmentCount[pid] = (patientAppointmentCount[pid] || 0) + 1;
      }
    }

    const totalUniquePatients90 = Object.keys(patientAppointmentCount).length;
    const repeatPatients = Object.values(patientAppointmentCount).filter((count) => count >= 2).length;
    const repeatVisitRate = totalUniquePatients90 > 0
      ? Math.round((repeatPatients / totalUniquePatients90) * 100)
      : 0;

    // 8. Inactive patients: registered but never had an appointment
    const allPatients = await PatientRegistration.find({
      clinicId: clinicObjectId,
    })
      .select("_id firstName lastName patientType createdAt phone")
      .lean();

    const allPatientIds = allPatients.map((p) => p._id.toString());
    const allPatientsMap = {};
    for (const p of allPatients) {
      allPatientsMap[p._id.toString()] = p;
    }

    // Find patients who have at least one appointment
    const patientsWithAppointments = await Appointment.distinct("patientId", {
      clinicId: clinicObjectId,
      patientId: { $in: allPatientIds.map((id) => new mongoose.Types.ObjectId(id)) },
    });

    const patientsWithAppointmentSet = new Set(
      patientsWithAppointments.map((id) => id.toString())
    );

    const inactivePatientIds = allPatientIds.filter(
      (pid) => !patientsWithAppointmentSet.has(pid)
    );
    const inactivePatientsCount = inactivePatientIds.length;

    // Build inactive patient details (limit to 50 for performance)
    const inactivePatientDetails = inactivePatientIds.slice(0, 50).map((pid) => {
      const p = allPatientsMap[pid];
      return {
        patientName: p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown" : "Unknown",
        patientType: p?.patientType || "—",
        phone: p?.phone || "—",
        registeredDate: p?.createdAt ? new Date(p.createdAt).toISOString().split("T")[0] : "—",
      };
    });

    // 9. High-value patients: patients with 5+ total appointments (all time)
    const allAppointments = await Appointment.find({
      clinicId: clinicObjectId,
    })
      .select("patientId")
      .lean();

    const lifetimeAppointmentCount = {};
    for (const apt of allAppointments) {
      if (apt.patientId) {
        const pid = apt.patientId.toString();
        lifetimeAppointmentCount[pid] = (lifetimeAppointmentCount[pid] || 0) + 1;
      }
    }

    const highValuePatientIds = Object.entries(lifetimeAppointmentCount)
      .filter(([, count]) => count >= 5)
      .map(([pid]) => pid);
    const highValuePatientsCount = highValuePatientIds.length;

    // 10. Average patient LTV: average revenue per patient from services (last 30 days)
    const { start: last30Start, end: last30End } = getLastNDaysRange(targetDate, 30);
    const last30Appointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: last30Start, $lte: last30End },
    })
      .select("patientId services serviceIds serviceId")
      .lean();

    // Collect all unique service IDs
    const serviceIdSet = new Set();
    for (const apt of last30Appointments) {
      if (Array.isArray(apt.services)) {
        for (const s of apt.services) {
          if (s.serviceId) serviceIdSet.add(s.serviceId.toString());
        }
      }
      if (Array.isArray(apt.serviceIds)) {
        for (const sid of apt.serviceIds) {
          if (sid) serviceIdSet.add(sid.toString());
        }
      }
      if (apt.serviceId) {
        serviceIdSet.add(apt.serviceId.toString());
      }
    }

    // Fetch service prices
    const servicePrices = {};
    if (serviceIdSet.size > 0) {
      const services = await Service.find({
        _id: { $in: Array.from(serviceIdSet).map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("_id price clinicPrice")
        .lean();

      for (const svc of services) {
        servicePrices[svc._id.toString()] = svc.clinicPrice ?? svc.price ?? 0;
      }
    }

    // Calculate revenue per patient
    const patientRevenue = {};
    for (const apt of last30Appointments) {
      if (!apt.patientId) continue;
      const pid = apt.patientId.toString();
      let aptRevenue = 0;

      // From services array (with quantity)
      if (Array.isArray(apt.services)) {
        for (const s of apt.services) {
          const sid = s.serviceId?.toString();
          if (sid && servicePrices[sid]) {
            aptRevenue += servicePrices[sid] * (s.quantity || 1);
          }
        }
      }

      // From serviceIds array (quantity = 1 each)
      if (Array.isArray(apt.serviceIds)) {
        for (const sid of apt.serviceIds) {
          const sidStr = sid?.toString();
          // Only add if not already counted in services array
          const alreadyCounted = Array.isArray(apt.services) && apt.services.some(
            (s) => s.serviceId?.toString() === sidStr
          );
          if (sidStr && servicePrices[sidStr] && !alreadyCounted) {
            aptRevenue += servicePrices[sidStr];
          }
        }
      }

      // From single serviceId (if no services/serviceIds)
      if (apt.serviceId && !Array.isArray(apt.services)?.length && !Array.isArray(apt.serviceIds)?.length) {
        const sidStr = apt.serviceId.toString();
        if (servicePrices[sidStr]) {
          aptRevenue += servicePrices[sidStr];
        }
      }

      patientRevenue[pid] = (patientRevenue[pid] || 0) + aptRevenue;
    }

    const revenueValues = Object.values(patientRevenue);
    const avgPatientLTV = revenueValues.length > 0
      ? Math.round(revenueValues.reduce((sum, r) => sum + r, 0) / revenueValues.length)
      : 0;

    // Build high-value patient details AFTER patientRevenue is calculated (limit to 50)
    const highValuePatientDetails = highValuePatientIds.slice(0, 50).map((pid) => {
      const p = allPatientsMap[pid];
      return {
        patientName: p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown" : "Unknown",
        appointmentCount: lifetimeAppointmentCount[pid] || 0,
        totalRevenue: patientRevenue[pid] || 0,
        phone: p?.phone || "—",
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        newPatients: newPatientsCount,
        returningPatients: returningPatientsCount,
        repeatVisitRate,
        inactivePatients: inactivePatientsCount,
        highValuePatients: highValuePatientsCount,
        avgPatientLTV,
        newPatientDetails,
        inactivePatientDetails,
        highValuePatientDetails,
      },
    });
  } catch (err) {
    console.error("Error in patient-retention:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

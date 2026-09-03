import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Appointment from "../../../models/Appointment";
import PatientRegistration from "../../../models/PatientRegistration";
import Service from "../../../models/Service";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/control-exceptions?date=YYYY-MM-DD
 *
 * Calculates control & exceptions metrics:
 *   - collectedRevenue: sum of Billing.paid where paymentMethod is "Cash" on selected date
 *   - outstanding: sum of Billing.pending for all billings on selected date
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
    if (!authUser) return res.status(401).json({ success: false, message: "Unauthorized" });

    // 2. AuthZ
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) return res.status(404).json({ message: error });

    if (!clinicId && authUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: authUser._id }).select("_id");
      if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });
      clinicId = clinic._id;
    }
    if (!clinicId) return res.status(404).json({ success: false, message: "Clinic not found" });

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());

    // 3. Parse date
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

    // ── Collected Revenue: Billing where paymentMethod is "Cash" on selected date ──
    const cashBillings = await Billing.find({
      clinicId: clinicObjectId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
      paymentMethod: "Cash",
      treatment: { $ne: "Advance Payment" },
    }).select("paid amount").lean();

    let collectedRevenue = 0;
    for (const bill of cashBillings) {
      collectedRevenue += bill.paid || 0;
    }

    // ── Outstanding: sum of Billing.pending for billings on selected date ──
    const allBillings = await Billing.find({
      clinicId: clinicObjectId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
      treatment: { $ne: "Advance Payment" },
    }).select("pending amount paid").lean();

    let outstandingAmount = 0;
    for (const bill of allBillings) {
      outstandingAmount += bill.pending || 0;
    }

    // ════════════════════════════════════════════════════════════════════
    // PATIENT JOURNEY EXCEPTIONS (based on date filter)
    // ════════════════════════════════════════════════════════════════════

    // Fetch all appointments for the selected date (exclude Cancelled & No Show)
    const todayAppointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["Cancelled", "No Show"] },
    })
      .select("patientId treatment status services serviceId serviceIds")
      .lean();

    // Collect unique patient IDs for name lookup
    const patientIds = [...new Set(todayAppointments.map((apt) => apt.patientId?.toString()).filter(Boolean))];
    const patients = await PatientRegistration.find({ _id: { $in: patientIds } })
      .select("firstName lastName")
      .lean();
    const patientMap = {};
    for (const p of patients) {
      patientMap[p._id.toString()] = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown";
    }

    // Collect unique service IDs from all appointments (services[], serviceId, serviceIds[])
    const serviceIdSet = new Set();
    for (const apt of todayAppointments) {
      if (apt.serviceId) serviceIdSet.add(apt.serviceId.toString());
      if (apt.serviceIds) apt.serviceIds.forEach((id) => serviceIdSet.add(id.toString()));
      if (apt.services) apt.services.forEach((s) => { if (s.serviceId) serviceIdSet.add(s.serviceId.toString()); });
    }
    const serviceIds = [...serviceIdSet];
    const serviceDocs = serviceIds.length > 0
      ? await Service.find({ _id: { $in: serviceIds } }).select("_id name").lean()
      : [];
    const serviceMap = {};
    for (const s of serviceDocs) {
      serviceMap[s._id.toString()] = s.name || "Unknown Service";
    }

    // Helper to resolve treatment name from appointment
    const resolveTreatment = (apt) => {
      // Priority: services[] array > serviceIds[] > serviceId > treatment string
      if (apt.services && apt.services.length > 0) {
        const names = apt.services.map((s) => serviceMap[s.serviceId?.toString()] || "Unknown Service");
        return [...new Set(names)].join(", ");
      }
      if (apt.serviceIds && apt.serviceIds.length > 0) {
        const names = apt.serviceIds.map((id) => serviceMap[id.toString()] || "Unknown Service");
        return [...new Set(names)].join(", ");
      }
      if (apt.serviceId) {
        return serviceMap[apt.serviceId.toString()] || apt.treatment || "—";
      }
      return apt.treatment || "—";
    };

    // Collect billing data for paid amounts (by appointmentId)
    const appointmentIds = todayAppointments.map((apt) => apt._id);
    const billings = await Billing.find({ appointmentId: { $in: appointmentIds } })
      .select("appointmentId paid amount pending")
      .lean();
    const billingMap = {};
    for (const b of billings) {
      billingMap[b.appointmentId?.toString()] = { paid: b.paid || 0, amount: b.amount || 0, pending: b.pending || 0 };
    }

    // Helper to build detail object
    const buildDetail = (apt) => ({
      patientName: patientMap[apt.patientId?.toString()] || "Unknown",
      treatment: resolveTreatment(apt),
      status: apt.status || "—",
      paid: billingMap[apt._id.toString()]?.paid || 0,
      amount: billingMap[apt._id.toString()]?.amount || 0,
      pending: billingMap[apt._id.toString()]?.pending || 0,
    });

    // Incomplete journeys: appointments NOT marked as "Completed"
    const incompleteJourneyList = todayAppointments
      .filter((apt) => apt.status !== "Completed")
      .map(buildDetail);
    const incompleteJourneys = incompleteJourneyList.length;

    // Pending discharge: appointments NOT marked as "Discharge"
    const pendingDischargeList = todayAppointments
      .filter((apt) => apt.status !== "Discharge")
      .map(buildDetail);
    const pendingDischarge = pendingDischargeList.length;

    // Billing incomplete: appointments NOT marked as "invoice"
    const billingIncompleteList = todayAppointments
      .filter((apt) => apt.status !== "invoice")
      .map(buildDetail);
    const billingIncomplete = billingIncompleteList.length;

    return res.status(200).json({
      success: true,
      data: {
        collectedRevenue,
        outstandingAmount,
        incompleteJourneys,
        pendingDischarge,
        billingIncomplete,
        incompleteJourneyDetails: incompleteJourneyList,
        pendingDischargeDetails: pendingDischargeList,
        billingIncompleteDetails: billingIncompleteList,
      },
    });
  } catch (err) {
    console.error("Error in control-exceptions:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

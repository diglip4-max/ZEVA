import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Appointment from "../../../models/Appointment";
import PatientRegistration from "../../../models/PatientRegistration";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/zeva-intelligence?date=YYYY-MM-DD
 *
 * Calculates week-over-week intelligence metrics:
 *   - Revenue: % change in Billing.paid (current week vs previous week)
 *   - New patients: % change in PatientRegistration where patientType "New"
 *   - Repeat visits: unique patients with appointments this week
 *   - No-shows: appointments with status "No Show" this week
 */

// ─── helpers ────────────────────────────────────────────────────────────

function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

// Get Monday 00:00 UTC and Sunday 23:59:59.999 UTC for the week containing `date`
function getWeekRange(date) {
  const day = date.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  // Convert to Mon=0 ... Sun=6
  const mondayOffset = day === 0 ? 6 : day - 1;
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - mondayOffset);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { monday, sunday };
}

function getPercentChange(current, previous) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
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

    // 3. Parse date & calculate week ranges
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();

    const { monday: currentMonday, sunday: currentSunday } = getWeekRange(targetDate);
    const prevMonday = new Date(currentMonday);
    prevMonday.setUTCDate(currentMonday.getUTCDate() - 7);
    const prevSunday = new Date(prevMonday);
    prevSunday.setUTCDate(prevMonday.getUTCDate() + 6);
    prevSunday.setUTCHours(23, 59, 59, 999);

    // ════════════════════════════════════════════════════════════════════
    // 1. REVENUE — Billing.paid week-over-week
    // ════════════════════════════════════════════════════════════════════
    const [currentRevenue, previousRevenue] = await Promise.all([
      Billing.aggregate([
        {
          $match: {
            clinicId: clinicObjectId,
            createdAt: { $gte: currentMonday, $lte: currentSunday },
            treatment: { $ne: "Advance Payment" },
          },
        },
        { $group: { _id: null, total: { $sum: "$paid" } } },
      ]),
      Billing.aggregate([
        {
          $match: {
            clinicId: clinicObjectId,
            createdAt: { $gte: prevMonday, $lte: prevSunday },
            treatment: { $ne: "Advance Payment" },
          },
        },
        { $group: { _id: null, total: { $sum: "$paid" } } },
      ]),
    ]);

    const currentRevenueTotal = currentRevenue[0]?.total || 0;
    const previousRevenueTotal = previousRevenue[0]?.total || 0;
    const revenueChange = getPercentChange(currentRevenueTotal, previousRevenueTotal);

    // ════════════════════════════════════════════════════════════════════
    // 2. NEW PATIENTS — PatientRegistration where patientType "New"
    // ════════════════════════════════════════════════════════════════════
    const [currentNewPatients, previousNewPatients] = await Promise.all([
      PatientRegistration.countDocuments({
        clinicId: clinicObjectId,
        patientType: "New",
        createdAt: { $gte: currentMonday, $lte: currentSunday },
      }),
      PatientRegistration.countDocuments({
        clinicId: clinicObjectId,
        patientType: "New",
        createdAt: { $gte: prevMonday, $lte: prevSunday },
      }),
    ]);

    const newPatientsChange = getPercentChange(currentNewPatients, previousNewPatients);

    // ════════════════════════════════════════════════════════════════════
    // 3. REPEAT VISITS — unique patients with appointments this week
    // ════════════════════════════════════════════════════════════════════
    const repeatVisitData = await Appointment.aggregate([
      {
        $match: {
          clinicId: clinicObjectId,
          startDate: { $gte: currentMonday, $lte: currentSunday },
        },
      },
      {
        $group: {
          _id: "$patientId",
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ]);

    const repeatVisits = repeatVisitData.length;

    // Previous week repeat visits for comparison
    const prevRepeatVisitData = await Appointment.aggregate([
      {
        $match: {
          clinicId: clinicObjectId,
          startDate: { $gte: prevMonday, $lte: prevSunday },
        },
      },
      {
        $group: {
          _id: "$patientId",
          count: { $sum: 1 },
        },
      },
      {
        $match: { count: { $gt: 1 } },
      },
    ]);

    const prevRepeatVisits = prevRepeatVisitData.length;
    const repeatVisitsChange = getPercentChange(repeatVisits, prevRepeatVisits);

    // ════════════════════════════════════════════════════════════════════
    // 4. NO-SHOWS — appointments with status "No Show" this week
    // ════════════════════════════════════════════════════════════════════
    const [currentNoShows, previousNoShows] = await Promise.all([
      Appointment.countDocuments({
        clinicId: clinicObjectId,
        startDate: { $gte: currentMonday, $lte: currentSunday },
        status: "No Show",
      }),
      Appointment.countDocuments({
        clinicId: clinicObjectId,
        startDate: { $gte: prevMonday, $lte: prevSunday },
        status: "No Show",
      }),
    ]);

    const noShowsChange = getPercentChange(currentNoShows, previousNoShows);

    return res.status(200).json({
      success: true,
      data: {
        revenue: {
          currentWeek: currentRevenueTotal,
          previousWeek: previousRevenueTotal,
          changePercent: revenueChange,
        },
        newPatients: {
          currentWeek: currentNewPatients,
          previousWeek: previousNewPatients,
          changePercent: newPatientsChange,
        },
        repeatVisits: {
          currentWeek: repeatVisits,
          previousWeek: prevRepeatVisits,
          changePercent: repeatVisitsChange,
        },
        noShows: {
          currentWeek: currentNoShows,
          previousWeek: previousNoShows,
          changePercent: noShowsChange,
        },
      },
    });
  } catch (err) {
    console.error("Error in zeva-intelligence:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

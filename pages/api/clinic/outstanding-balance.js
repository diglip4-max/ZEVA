import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Billing from "../../../models/Billing";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/outstanding-balance?date=YYYY-MM-DD
 *
 * Finds billing records with pending > 0 linked to appointments on the selected date.
 * Returns total outstanding amount and count of unique patients with unpaid balances.
 * Also returns detailed billing list for modal display.
 *
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       totalPending: 4500,
 *       patientCount: 8,
 *       billingCount: 10,
 *       patients: [{ patientId, pendingAmount }],
 *       billingList: [{ patientName, doctorName, appointmentTime, invoiceNumber, pendingAmount, treatment }]
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

    // 4. Find all appointments for the selected date
    const appointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
    })
      .select("_id patientId fromTime doctorId doctorName treatment")
      .lean();

    if (appointments.length === 0) {
      return res.status(200).json({
        success: true,
        data: { totalPending: 0, patientCount: 0, billingCount: 0, patients: [], billingList: [] },
      });
    }

    const appointmentIds = appointments.map((a) => a._id);
    const appointmentMap = new Map(appointments.map((a) => [a._id.toString(), a]));

    // 5. Find billing records with pending > 0 linked to these appointments
    const pendingBillings = await Billing.find({
      clinicId: clinicObjectId,
      appointmentId: { $in: appointmentIds },
      pending: { $gt: 0 },
    })
      .select("patientId pending appointmentId invoiceNumber treatment doctorName")
      .lean();

    // 6. Collect unique patient IDs and fetch names
    const patientIds = [...new Set(pendingBillings.map((b) => b.patientId?.toString()).filter(Boolean))];
    const patientNameMap = new Map();

    if (patientIds.length > 0) {
      const patients = await PatientRegistration.find({
        _id: { $in: patientIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("firstName lastName")
        .lean();
      for (const p of patients) {
        const fullName = `${p.firstName || ""} ${p.lastName || ""}`.trim();
        patientNameMap.set(p._id.toString(), fullName || "Unknown Patient");
      }
    }

    // 7. Aggregate per patient
    const patientPendingMap = new Map();
    for (const b of pendingBillings) {
      const pid = b.patientId?.toString();
      if (!pid) continue;
      const current = patientPendingMap.get(pid) || 0;
      patientPendingMap.set(pid, current + (b.pending || 0));
    }

    const totalPending = Array.from(patientPendingMap.values()).reduce((sum, v) => sum + v, 0);
    const patientCount = patientPendingMap.size;

    // 8. Build patient list (top 10 by pending amount)
    const patients = Array.from(patientPendingMap.entries())
      .map(([patientId, pendingAmount]) => ({ patientId, pendingAmount }))
      .sort((a, b) => b.pendingAmount - a.pendingAmount)
      .slice(0, 10);

    // 9. Build detailed billing list for modal
    const billingList = pendingBillings.map((b) => {
      const apt = appointmentMap.get(b.appointmentId?.toString());
      const patientName = patientNameMap.get(b.patientId?.toString()) || "Unknown Patient";
      
      // Format appointment time
      let appointmentTime = "";
      if (apt?.fromTime) {
        const [hours, minutes] = apt.fromTime.split(":");
        const h = parseInt(hours, 10);
        const ampm = h >= 12 ? "PM" : "AM";
        const h12 = h % 12 || 12;
        appointmentTime = `${h12}:${minutes} ${ampm}`;
      }

      return {
        patientName,
        doctorName: b.doctorName || apt?.doctorName || "",
        appointmentTime,
        invoiceNumber: b.invoiceNumber || "",
        pendingAmount: b.pending || 0,
        treatment: b.treatment || apt?.treatment || "",
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        totalPending,
        patientCount,
        billingCount: pendingBillings.length,
        patients,
        billingList,
      },
    });
  } catch (err) {
    console.error("Error in outstanding-balance:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

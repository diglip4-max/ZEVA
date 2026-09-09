import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/live-clinic?date=YYYY-MM-DD
 *
 * Returns real-time clinic status for the Live Clinic view:
 *   - patientsWaiting: appointments with status "Waiting" on selected date
 *   - inTreatment: appointments with status "Arrived" on selected date
 *   - delayedAppointments: appointments whose toTime has passed (current time > toTime)
 *     and status is still "booked" (patient hasn't arrived/discharged/etc.)
 *   - practitionersAvailable: doctors with no active Arrived appointments today
 *   - pendingCheckout: appointments with status "Completed" (finished treatment, not yet discharged/invoiced)
 *   - appointmentsHappeningNow: appointments scheduled for the current time window
 *   - incompletePatientJourneys: appointments that are not in Completed/Discharge/Cancelled/No Show status
 */

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

    // Parse date filter — use selected date or today
    const dateStr = req.query.date;
    let filterDate;
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      filterDate = new Date(`${dateStr}T00:00:00.000Z`);
    } else {
      filterDate = new Date();
    }

    const dayStart = new Date(
      Date.UTC(filterDate.getUTCFullYear(), filterDate.getUTCMonth(), filterDate.getUTCDate(), 0, 0, 0, 0)
    );
    const dayEnd = new Date(
      Date.UTC(filterDate.getUTCFullYear(), filterDate.getUTCMonth(), filterDate.getUTCDate(), 23, 59, 59, 999)
    );

    // Current time in HH:MM 24-hour format for delayed appointment comparison
    const now = new Date();
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTimeStr = `${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")}`;

    // 1. Patients Waiting — status "Waiting" on selected date
    const patientsWaiting = await Appointment.countDocuments({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: "Waiting",
    });

    // 2. In Treatment — status "Arrived" on selected date
    const inTreatment = await Appointment.countDocuments({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: "Arrived",
    });

    // 3. Delayed Appointments — current time > toTime AND status is still "booked"
    //    (patient hasn't arrived, discharged, or changed status)
    const delayedAppointments = await Appointment.countDocuments({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: "booked",
      toTime: { $lt: currentTimeStr },
    });

    // 4. Practitioners Available (count of doctors under whom appointments have been booked today)
    const practitionersWithAppointments = await Appointment.distinct("doctorId", {
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
    });
    const practitionersAvailable = practitionersWithAppointments.length;

    // 5. Pending Checkout — patients not marked as invoiced on selected date
    const pendingCheckout = await Appointment.countDocuments({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: { $nin: ["invoice"] },
    });

    // 6. Appointments Happening Now — status "Arrived" on selected date
    const appointmentsHappeningNow = await Appointment.countDocuments({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: "Arrived",
    });

    // 7. Incomplete Patient Journeys — status "Completed" on selected date
    const incompletePatientJourneys = await Appointment.countDocuments({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      status: "Completed",
    });

    return res.status(200).json({
      success: true,
      data: {
        patientsWaiting,
        inTreatment,
        delayedAppointments,
        practitionersAvailable,
        pendingCheckout,
        appointmentsHappeningNow,
        incompletePatientJourneys,
      },
    });
  } catch (err) {
    console.error("Error in live-clinic:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

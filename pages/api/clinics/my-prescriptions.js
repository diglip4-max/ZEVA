// /api/agent/doctor/my-prescriptions.js
//
// Lists all prescriptions written by the currently authenticated doctor.
// doctorId is ALWAYS derived from the verified Bearer token — it is never
// accepted as a request parameter, so it cannot be spoofed by editing the
// query string or a client-side value like localStorage.
//
// Prescription.doctorId is stored directly on the document (see
// models/Prescription.js), so this queries Prescription in one shot —
// no need to first look up the doctor's appointments and join through them.

import dbConnect from "../../../lib/database";
import Prescription from "../../../models/Prescription";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";
export default async function handler(req, res) {
  let user;
  try {
    await dbConnect();
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (user.role !== "doctorStaff") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    console.error("Auth/connection error in my-prescriptions:", error);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  // doctorId comes ONLY from the verified token payload.
  const doctorId = user.userId || user._id?.toString();
  if (!doctorId) {
    return res.status(400).json({
      success: false,
      message: "Unable to resolve doctor identity from token",
    });
  }

  let clinicId;
  try {
    const doctorUser = await User.findById(doctorId)
      .select("clinicId name")
      .lean();
    if (!doctorUser) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }
    clinicId = doctorUser.clinicId;
    if (!clinicId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. User not linked to a clinic.",
      });
    }
  } catch (error) {
    console.error("Error resolving doctor's clinic:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to resolve clinic" });
  }

  // Optional narrowing filters — none of these can widen the query past
  // this doctor's own doctorId, because doctorId below is fixed and always
  // AND-ed in. A patientId/appointmentId/fromDate/toDate this doctor never
  // actually touched simply returns zero rows, not someone else's records.
  const {
    patientId,
    appointmentId,
    fromDate,
    toDate,
    page = 1,
    limit = 20,
  } = req.query;

  try {
    const query = { clinicId, doctorId }; // <-- the containment boundary

    if (patientId) query.patientId = patientId;
    if (appointmentId) query.appointmentId = appointmentId;

    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) {
        const start = new Date(fromDate);
        if (isNaN(start.getTime())) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid fromDate parameter" });
        }
        start.setHours(0, 0, 0, 0);
        query.createdAt.$gte = start;
      }
      if (toDate) {
        const end = new Date(toDate);
        if (isNaN(end.getTime())) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid toDate parameter" });
        }
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100); // cap to avoid unbounded fetches

    const total = await Prescription.countDocuments(query);

    const prescriptions = await Prescription.find(query)
      .populate({
        path: "patientId",
        select: "firstName lastName mobileNumber email emrNumber gender",
      })
      .populate({
        path: "appointmentId",
        select: "startDate fromTime toTime status",
      })
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const formatted = prescriptions.map((rx) => {
      const patient = rx.patientId || {};
      const appointment = rx.appointmentId || {};
      return {
        _id: rx._id.toString(),
        patientId: patient._id?.toString() || "",
        patientName:
          `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
          "Unknown",
        patientNumber: patient.mobileNumber || "",
        patientEmail: patient.email || "",
        emrNumber: patient.emrNumber || "",
        gender: patient.gender || "",
        appointmentId: appointment._id?.toString() || "",
        visitDate: appointment.startDate
          ? appointment.startDate.toISOString()
          : null,
        visitTime:
          appointment.fromTime && appointment.toTime
            ? `${appointment.fromTime} - ${appointment.toTime}`
            : null,
        appointmentStatus: appointment.status || null,
        medicines: (rx.medicines || []).map((m) => ({
          medicineName: m.medicineName || "",
          dosage: m.dosage || "",
          duration: m.duration || "",
          notes: m.notes || "",
        })),
        aftercareInstructions: rx.aftercareInstructions || "",
        includeInPdf: !!rx.includeInPdf,
        pdfUrl: rx.pdfUrl || null,
        createdAt: rx.createdAt,
        updatedAt: rx.updatedAt,
      };
    });

    return res.status(200).json({
      success: true,
      prescriptions: formatted,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (error) {
    console.error("Error fetching doctor's prescriptions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
      error: error.message,
    });
  }
}

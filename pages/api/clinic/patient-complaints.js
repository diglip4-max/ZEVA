import dbConnect from "../../../lib/database";
import PatientComplains from "../../../models/PatientComplains";
import Appointment from "../../../models/Appointment";
import AppointmentReport from "../../../models/AppointmentReport";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  let clinicUser;
  try {
    clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  let clinicId = null;
  if (clinicUser.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: clinicUser._id }).lean();
    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }
    clinicId = clinic._id;
  } else if (["agent", "doctor", "doctorStaff"].includes(clinicUser.role)) {
    clinicId = clinicUser.clinicId;
    if (!clinicId) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied. User not linked to a clinic." });
    }
  } else {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  if (req.method === "POST") {
    const { appointmentId, appointmentReportId, complaints } = req.body;

    if (!appointmentId || !appointmentReportId || !complaints || !complaints.trim()) {
      return res.status(400).json({
        success: false,
        message: "appointmentId, appointmentReportId, and complaints are required",
      });
    }

    try {
      // Verify appointment exists and belongs to clinic
      const appointment = await Appointment.findOne({ _id: appointmentId, clinicId }).lean();
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Appointment not found" });
      }

      // Verify appointment report exists and belongs to the appointment
      const report = await AppointmentReport.findOne({
        _id: appointmentReportId,
        appointmentId: appointmentId,
        clinicId,
      }).lean();
      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Appointment report not found or does not match appointment",
        });
      }

      // Get doctorId from appointment (the doctor assigned to this appointment)
      const doctorId = appointment.doctorId;
      if (!doctorId) {
        return res.status(400).json({
          success: false,
          message: "Appointment does not have an assigned doctor",
        });
      }

      // Create the complaint record
      const complaint = await PatientComplains.create({
        clinicId,
        patientId: appointment.patientId,
        doctorId: doctorId,
        appointmentId: appointmentId,
        appointmentReportId: appointmentReportId,
        complaints: complaints.trim(),
      });

      return res.status(200).json({
        success: true,
        message: "Complaint saved successfully",
        complaint: {
          _id: complaint._id,
          clinicId: complaint.clinicId,
          patientId: complaint.patientId,
          doctorId: complaint.doctorId,
          appointmentId: complaint.appointmentId,
          appointmentReportId: complaint.appointmentReportId,
          complaints: complaint.complaints,
          createdAt: complaint.createdAt,
          updatedAt: complaint.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error saving patient complaint:", error);
      return res.status(500).json({ success: false, message: "Failed to save complaint" });
    }
  }

  if (req.method === "GET") {
    const { appointmentId, patientId, appointmentReportId } = req.query;

    try {
      const query = { clinicId };
      if (appointmentId) query.appointmentId = appointmentId;
      if (patientId) query.patientId = patientId;
      if (appointmentReportId) query.appointmentReportId = appointmentReportId;

      const complaints = await PatientComplains.find(query)
        .populate("patientId", "firstName lastName emrNumber")
        .populate("doctorId", "name email")
        .populate("appointmentId", "visitId startDate fromTime toTime status")
        .populate("appointmentReportId", "temperatureCelsius pulseBpm systolicBp diastolicBp updatedAt")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        complaints: complaints.map((c) => ({
          _id: c._id,
          patientId: c.patientId,
          doctorId: c.doctorId,
          appointmentId: c.appointmentId,
          appointmentReportId: c.appointmentReportId,
          complaints: c.complaints,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
      });
    } catch (error) {
      console.error("Error fetching patient complaints:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch complaints" });
    }
  }

  res.setHeader("Allow", ["GET", "POST"]);
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}


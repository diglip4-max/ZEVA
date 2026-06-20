import dbConnect from "../../../lib/database";
import Prescription from "../../../models/Prescription";
import Appointment from "../../../models/Appointment";
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
  } catch {
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
      return res.status(403).json({ success: false, message: "Access denied. User not linked to a clinic." });
    }
  } else {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  // ── GET ──────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const { appointmentId, patientId } = req.query;
    try {
      const query = { clinicId };
      if (appointmentId) query.appointmentId = appointmentId;
      if (patientId) query.patientId = patientId;

      const prescriptions = await Prescription.find(query)
        .populate("doctorId", "name email")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, prescriptions });
    } catch (error) {
      console.error("Error fetching prescriptions:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch prescriptions" });
    }
  }

  // ── POST (create or upsert per appointment) ───────────────────────────────────
  if (req.method === "POST") {
    const { appointmentId, patientId, medicines, aftercareInstructions, includeInPdf, pdfUrl } = req.body || {};

    if (!appointmentId || !patientId) {
      return res.status(400).json({ success: false, message: "appointmentId and patientId are required" });
    }
    // Medicines are now optional - prescription can be saved with just aftercare instructions
    if (!Array.isArray(medicines)) {
      // If medicines is not provided, initialize as empty array
      req.body.medicines = [];
    }

    try {
      const appointment = await Appointment.findOne({ _id: appointmentId, clinicId }).lean();
      if (!appointment) {
        return res.status(404).json({ success: false, message: "Appointment not found" });
      }
      const doctorId = appointment.doctorId;
      if (!doctorId) {
        return res.status(400).json({ success: false, message: "Appointment has no assigned doctor" });
      }

      // Upsert: one prescription per appointment
      const prescription = await Prescription.findOneAndUpdate(
        { clinicId, appointmentId },
        {
          $set: {
            patientId,
            doctorId,
            medicines: Array.isArray(medicines) 
              ? medicines
                  .filter((m) => m.medicineName && m.medicineName.trim()) // Only save medicines with names
                  .map((m) => ({
                    medicineName: m.medicineName.trim(),
                    dosage: m.dosage?.trim() || "",
                    duration: m.duration?.trim() || "",
                    notes: m.notes?.trim() || "",
                  }))
              : [], // Empty array if no medicines provided
            aftercareInstructions: aftercareInstructions?.trim() || "",
            includeInPdf: includeInPdf !== undefined ? !!includeInPdf : true,
            pdfUrl: pdfUrl || null,
          },
        },
        { new: true, upsert: true },
      ).populate("doctorId", "name email");

      return res.status(200).json({
        success: true,
        message: "Prescription saved successfully",
        prescription,
      });
    } catch (error) {
      console.error("Error saving prescription:", error);
      return res.status(500).json({ success: false, message: "Failed to save prescription" });
    }
  }

  // ── DELETE ────────────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    const { prescriptionId } = req.query || {};
    if (!prescriptionId) {
      return res.status(400).json({ success: false, message: "prescriptionId is required" });
    }
    try {
      const deleted = await Prescription.findOneAndDelete({ _id: prescriptionId, clinicId });
      if (!deleted) {
        return res.status(404).json({ success: false, message: "Prescription not found" });
      }
      return res.status(200).json({ success: true, message: "Prescription deleted successfully" });
    } catch (error) {
      console.error("Error deleting prescription:", error);
      return res.status(500).json({ success: false, message: "Failed to delete prescription" });
    }
  }

  // ── PUT (update existing prescription) ───────────────────────────────────────
  if (req.method === "PUT") {
    const { prescriptionId, medicines, aftercareInstructions } = req.body || {};

    if (!prescriptionId) {
      return res.status(400).json({ success: false, message: "prescriptionId is required" });
    }

    try {
      // Find the prescription first to verify it belongs to this clinic
      const existingPrescription = await Prescription.findOne({ _id: prescriptionId, clinicId });
      if (!existingPrescription) {
        return res.status(404).json({ success: false, message: "Prescription not found" });
      }

      // Check if prescription was created within the last 24 hours
      const createdAt = new Date(existingPrescription.createdAt);
      const now = new Date();
      const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      if (hoursDiff >= 24) {
        return res.status(403).json({ 
          success: false, 
          message: "Prescription can only be edited within 24 hours of creation" 
        });
      }

      // Update the prescription
      const updatedPrescription = await Prescription.findByIdAndUpdate(
        prescriptionId,
        {
          $set: {
            medicines: Array.isArray(medicines)
              ? medicines
                  .filter((m) => m.medicineName && m.medicineName.trim()) // Only save medicines with names
                  .map((m) => ({
                    medicineName: m.medicineName.trim(),
                    dosage: m.dosage?.trim() || "",
                    duration: m.duration?.trim() || "",
                    notes: m.notes?.trim() || "",
                  }))
              : [], // Empty array if no medicines provided
            aftercareInstructions: aftercareInstructions?.trim() || "",
          },
        },
        { new: true },
      ).populate("doctorId", "name email");

      return res.status(200).json({
        success: true,
        message: "Prescription updated successfully",
        prescription: updatedPrescription,
      });
    } catch (error) {
      console.error("Error updating prescription:", error);
      return res.status(500).json({ success: false, message: "Failed to update prescription" });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}

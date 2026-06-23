import dbConnect from "../../../lib/database";
import ConsentLog from "../../../models/ConsentLog";
import Consent from "../../../models/Consent";
import PatientComplains from "../../../models/PatientComplains";

export default async function handler(req, res) {
  await dbConnect();

  // POST: Log when a consent form is sent
  if (req.method === "POST") {
    try {
      const {
        consentFormId,
        consentFormName,
        patientId,
        patientName,
        appointmentId,
        clinicId,
        sentVia,
        sentBy,
        complaintId, // New optional field
      } = req.body;

      if (!consentFormId || !patientId) {
        return res.status(400).json({
          success: false,
          message: "consentFormId and patientId are required",
        });
      }

      // Validate that consent form exists
      const consentForm = await Consent.findById(consentFormId);
      if (!consentForm) {
        return res.status(404).json({
          success: false,
          message: "Consent form not found",
        });
      }

      // If complaintId is provided, validate it exists and belongs to the patient/appointment
      let validatedComplaintId = null;
      if (complaintId) {
        const complaint = await PatientComplains.findById(complaintId).lean();
        if (!complaint) {
          return res.status(404).json({
            success: false,
            message: "Complaint not found",
          });
        }
        // Ensure complaint is for the same patient and appointment (if provided)
        if (complaint.patientId.toString() !== patientId.toString()) {
          return res.status(400).json({
            success: false,
            message: "Complaint does not belong to this patient",
          });
        }
        if (appointmentId && complaint.appointmentId.toString() !== appointmentId.toString()) {
          return res.status(400).json({
            success: false,
            message: "Complaint does not belong to this appointment",
          });
        }
        validatedComplaintId = complaintId;
      }

      // Create consent log
      const consentLog = await ConsentLog.create({
        consentFormId,
        consentFormName: consentFormName || consentForm.formName,
        patientId,
        patientName,
        appointmentId: appointmentId || null,
        complaintId: validatedComplaintId,
        clinicId: clinicId || null,
        sentVia: sentVia || "whatsapp",
        sentBy: sentBy || null,
        status: "sent",
      });

      // If complaintId is provided, push consent log ID to complaint's consentLogs array
      if (validatedComplaintId) {
        await PatientComplains.findByIdAndUpdate(
          validatedComplaintId,
          { $addToSet: { consentLogs: consentLog._id } }, // $addToSet prevents duplicates
          { new: true }
        );
      }

      return res.status(201).json({
        success: true,
        message: "Consent form sent logged successfully",
        logId: consentLog._id,
        consentLog: {
          ...consentLog.toObject(),
        },
      });
    } catch (error) {
      console.error("Error logging consent form sent:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to log consent form sent",
      });
    }
  }

  // GET: Fetch consent logs for a patient/appointment/complaint
  if (req.method === "GET") {
    try {
      const { patientId, appointmentId, complaintId } = req.query;

      if (!patientId && !appointmentId && !complaintId) {
        return res.status(400).json({
          success: false,
          message: "Either patientId, appointmentId, or complaintId is required",
        });
      }

      // Build query
      const query = {};
      if (patientId) query.patientId = patientId;
      if (appointmentId) query.appointmentId = appointmentId;
      if (complaintId) query.complaintId = complaintId;

      // Fetch all consent logs
      const logs = await ConsentLog.find(query)
        .populate("consentFormId", "formName description")
        .populate({ path: "complaintId", select: "_id complaints", strictPopulate: false }) // Optional: populate complaint details with strictPopulate false
        .sort({ createdAt: -1 })
        .lean();

      // Format response
      const consentLogs = logs.map((log) => ({
        _id: log._id,
        consentFormId: log.consentFormId?._id,
        consentFormName: log.consentFormName || log.consentFormId?.formName || "Unknown",
        description: log.consentFormId?.description || "",
        patientId: log.patientId,
        patientName: log.patientName,
        appointmentId: log.appointmentId,
        complaintId: log.complaintId?._id || log.complaintId || null, // Return complaintId
        complaintText: log.complaintId?.complaints || null, // Optional: return complaint text
        sentVia: log.sentVia,
        sentBy: log.sentBy,
        status: log.status,
        signedAt: log.signedAt,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt,
      }));

      return res.status(200).json({
        success: true,
        consentLogs,
        total: consentLogs.length,
      });
    } catch (error) {
      console.error("Error fetching consent logs:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch consent logs",
      });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}

import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { clinicId, error, isAdmin } = await getClinicIdFromUser(clinicUser);
    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    const { patientId } = req.query;
    if (!patientId) {
      return res.status(400).json({ success: false, message: "patientId is required" });
    }

    // Today at midnight (start of today UTC)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const appointments = await Appointment.find({
      clinicId,
      patientId,
      startDate: { $gt: today },
    })
      .sort({ startDate: 1, fromTime: 1 })
      .select("_id startDate fromTime toTime status followType serviceId serviceIds")
      .populate("serviceId", "name")
      .populate("serviceIds", "name")
      .lean();

    return res.status(200).json({
      success: true,
      appointments: appointments.map((appt) => {
        // Build serviceNames from both serviceIds and serviceId
        const fromServiceIds = Array.isArray(appt.serviceIds)
          ? appt.serviceIds.map((s) => s?.name || "").filter(Boolean)
          : [];
        const fromServiceId = appt.serviceId?.name || "";
        const serviceNames = fromServiceId
          ? [fromServiceId, ...fromServiceIds.filter((n) => n !== fromServiceId)]
          : fromServiceIds;

        return {
          _id: appt._id,
          startDate: appt.startDate,
          fromTime: appt.fromTime,
          toTime: appt.toTime,
          status: appt.status,
          followType: appt.followType,
          serviceName: appt.serviceId?.name || null,
          serviceNames,
        };
      }),
    });
  } catch (err) {
    console.error("patient-upcoming-appointments error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

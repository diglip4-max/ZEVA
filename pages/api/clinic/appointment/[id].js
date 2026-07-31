import dbConnect from "../../../../lib/database";
import Appointment from "../../../../models/Appointment";
import Clinic from "../../../../models/Clinic";
import Room from "../../../../models/Room";
import Service from "../../../../models/Service";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser } from "../../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (
      !["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(
        clinicUser.role,
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Clinic role required.",
      });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(clinicUser);
    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }
    if (!clinicId && clinicUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: clinicUser._id }).select(
        "_id",
      );
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    }
    if (!clinicId) {
      return res
        .status(404)
        .json({ success: false, message: "Clinic not found" });
    }

    const { id } = req.query;
    if (!id) {
      return res
        .status(400)
        .json({ success: false, message: "Appointment id is required" });
    }

    const query = { _id: id, clinicId };
    if (clinicUser.role === "doctorStaff") {
      query.doctorId = clinicUser._id;
    }

    const appointment = await Appointment.findOne(query)
      .populate(
        "patientId",
        "firstName lastName mobileNumber email invoiceNumber emrNumber gender",
      )
      .populate("doctorId", "name email")
      .populate("roomId", "name")
      .populate("serviceId", "name")
      .populate("serviceIds", "name")
      .lean();

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: `No appointment found with id '${id}'.`,
      });
    }

    return res.status(200).json({
      success: true,
      appointment: {
        _id: appointment._id.toString(),
        patientId: appointment.patientId?._id?.toString(),
        patientName: appointment.patientId
          ? `${appointment.patientId.firstName || ""} ${appointment.patientId.lastName || ""}`.trim()
          : "Unknown",
        patientNumber: appointment.patientId?.mobileNumber || "",
        doctorId: appointment.doctorId?._id?.toString(),
        doctorName: appointment.doctorId?.name || "Unknown",
        roomId: appointment.roomId?._id?.toString(),
        roomName: appointment.roomId?.name || "Unknown",
        status: appointment.status,
        followType: appointment.followType,
        startDate: appointment.startDate,
        fromTime: appointment.fromTime,
        toTime: appointment.toTime,
        referral: appointment.referral,
        emergency: appointment.emergency,
        notes: appointment.notes,
        bookedFrom: appointment.bookedFrom || "doctor",
        createdAt: appointment.createdAt,
      },
    });
  } catch (error) {
    console.error("Error in appointment/[id] API:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

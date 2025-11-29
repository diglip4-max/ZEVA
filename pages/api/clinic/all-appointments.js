import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Clinic from "../../../models/Clinic";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  try {
    // Verify clinic authentication
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    let clinicId = null;
    if (clinicUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: clinicUser._id }).lean();
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (["agent", "doctor", "doctorStaff", "staff"].includes(clinicUser.role)) {
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res.status(403).json({ success: false, message: "Access denied. User not linked to a clinic." });
      }
    } else {
      return res.status(403).json({ success: false, message: "Access denied. Clinic role required." });
    }

    if (req.method === "GET") {
      const {
        search,
        emrNumber,
        fromDate,
        toDate,
        doctorId,
        roomId,
        status,
        followType,
        referral,
        emergency,
        page = 1,
        limit = 50,
      } = req.query;

      // Build query
      let query = { clinicId };

      // Date range filter
      if (fromDate || toDate) {
        query.startDate = {};
        if (fromDate) {
          const startDate = new Date(fromDate);
          startDate.setHours(0, 0, 0, 0);
          query.startDate.$gte = startDate;
        }
        if (toDate) {
          const endDate = new Date(toDate);
          endDate.setHours(23, 59, 59, 999);
          query.startDate.$lte = endDate;
        }
      }

      // Doctor filter
      if (doctorId) {
        query.doctorId = doctorId;
      }

      // Room filter
      if (roomId) {
        query.roomId = roomId;
      }

      // Status filter
      if (status) {
        query.status = status;
      }

      // Follow type filter
      if (followType) {
        query.followType = followType;
      }

      // Referral filter
      if (referral) {
        query.referral = referral;
      }

      // Emergency filter
      if (emergency) {
        query.emergency = emergency;
      }

      // Search by patient name, mobile number, EMR number, visitId (last 4 digits), or patientId (last 4 digits)
      let patientQuery = {};
      let matchingAppointmentIds = [];
      let matchingPatientIds = [];
      
      if (search) {
        // Check if search is a 4-character hex string (for visitId or patientId search)
        const isHexSearch = search.length <= 4 && /^[0-9a-fA-F]+$/.test(search);
        
        if (isHexSearch) {
          // Search by visitId (last 4 digits of appointment _id)
          const allAppointments = await Appointment.find({ clinicId }).select("_id").lean();
          matchingAppointmentIds = allAppointments
            .filter((apt) => apt._id.toString().slice(-4).toLowerCase() === search.toLowerCase())
            .map((apt) => apt._id);
          
          // Search by patientId (last 4 digits)
          const allPatients = await PatientRegistration.find({}).select("_id").lean();
          matchingPatientIds = allPatients
            .filter((p) => p._id.toString().slice(-4).toLowerCase() === search.toLowerCase())
            .map((p) => p._id);
        }
        
        // Always search in patient fields (name, mobile)
        patientQuery.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { mobileNumber: { $regex: search, $options: "i" } },
        ];
        
        // If we found patient IDs from hex search, add them to patient query
        if (matchingPatientIds.length > 0) {
          patientQuery.$or.push({ _id: { $in: matchingPatientIds } });
        }
      }
      
      if (emrNumber) {
        patientQuery.emrNumber = { $regex: emrNumber, $options: "i" };
      }

      // Build the final query
      const queryConditions = [];
      
      // If we have appointment ID matches (visitId search), add them
      if (matchingAppointmentIds.length > 0) {
        queryConditions.push({ _id: { $in: matchingAppointmentIds } });
      }
      
      // If we have patient search conditions, find matching patient IDs
      if (Object.keys(patientQuery).length > 0) {
        const patients = await PatientRegistration.find(patientQuery).select("_id").lean();
        const patientIds = patients.map((p) => p._id);
        
        if (patientIds.length > 0) {
          queryConditions.push({ patientId: { $in: patientIds } });
        } else if (matchingAppointmentIds.length === 0) {
          // No patients match and no visitId matches, return empty result
          return res.status(200).json({
            success: true,
            appointments: [],
            total: 0,
            page: parseInt(page),
            totalPages: 0,
          });
        }
      }
      
      // Combine conditions with $or if we have multiple, otherwise use the single condition
      if (queryConditions.length > 1) {
        query.$or = queryConditions;
      } else if (queryConditions.length === 1) {
        Object.assign(query, queryConditions[0]);
      }

      // Calculate pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      // Get total count for pagination (use the final query)
      const total = await Appointment.countDocuments(query);

      // Fetch appointments with pagination
      const appointments = await Appointment.find(query)
        .populate({
          path: "patientId",
          model: "PatientRegistration",
          select: "firstName lastName mobileNumber email emrNumber invoiceNumber gender invoicedDate",
        })
        .populate({
          path: "doctorId",
          model: "User",
          select: "name email",
        })
        .populate({
          path: "roomId",
          model: "Room",
          select: "name",
        })
        .sort({ startDate: -1, fromTime: -1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean();

      // Format appointments for frontend
      const formatted = appointments.map((apt, index) => {
        const patient = apt.patientId || {};
        const doctor = apt.doctorId || {};
        const room = apt.roomId || {};

        // Generate visit ID (using appointment _id last 4 chars or index)
        const visitId = apt._id.toString().slice(-4);

        // Format dates
        const registeredDate = apt.startDate
          ? new Date(apt.startDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "-";
        const registeredTime = apt.fromTime && apt.toTime ? `${apt.fromTime} - ${apt.toTime}` : "-";

        // For invoiced date/time, use patient's invoicedDate if available
        const invoicedDate = patient.invoicedDate
          ? new Date(patient.invoicedDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "01-01-1900";
        const invoicedTime = patient.invoicedDate
          ? new Date(patient.invoicedDate).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })
          : "01:19 AM";

        return {
          _id: apt._id.toString(),
          visitId,
          patientId: patient._id?.toString() || "",
          patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
          patientNumber: patient.mobileNumber || "",
          patientEmail: patient.email || "",
          emrNumber: patient.emrNumber || "",
          invoiceNumber: patient.invoiceNumber || "",
          gender: patient.gender || "",
          doctorId: doctor._id?.toString() || "",
          doctorName: doctor.name || "Unknown",
          doctorEmail: doctor.email || "",
          roomId: room._id?.toString() || "",
          roomName: room.name || "-",
          status: apt.status,
          followType: apt.followType,
          referral: apt.referral || "direct",
          emergency: apt.emergency || "no",
          notes: apt.notes || "",
          // Date & Time fields
          registeredDate,
          registeredTime,
          invoicedDate,
          invoicedTime,
          startDate: apt.startDate ? apt.startDate.toISOString() : null,
          fromTime: apt.fromTime,
          toTime: apt.toTime,
          createdAt: apt.createdAt ? apt.createdAt.toISOString() : null,
          updatedAt: apt.updatedAt ? apt.updatedAt.toISOString() : null,
        };
      });

      return res.status(200).json({
        success: true,
        appointments: formatted,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Error in all-appointments API:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}


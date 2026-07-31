import dbConnect from "../../../lib/database";
import PatientComplains from "../../../models/PatientComplains";
import Clinic from "../../../models/Clinic";
import PatientRegistration from "../../../models/PatientRegistration";
import User from "../../../models/Users";
import Billing from "../../../models/Billing";
import Appointment from "../../../models/Appointment";
import Service from "../../../models/Service";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  try {
    await dbConnect();
  } catch (error) {
    console.error("Database connection error:", error);
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }

  if (!process.env.JWT_SECRET) {
    console.error("JWT_SECRET is not configured");
    return res.status(500).json({
      success: false,
      message: "Server configuration error: JWT_SECRET not configured",
    });
  }

  try {
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
        return res.status(403).json({
          success: false,
          message: "Access denied. User not linked to a clinic.",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied. Clinic role required.",
      });
    }

    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "Invalid clinic ID",
      });
    }

    if (req.method === "GET") {
      const {
        search,
        fromDate,
        toDate,
        doctorId,
        status,
        page = 1,
        limit = 10,
      } = req.query;

      let query = { clinicId };

      if (clinicUser.role === "doctorStaff") {
        query.doctorId = clinicUser._id;
      }

      if (fromDate || toDate) {
        const start = fromDate ? new Date(fromDate) : null;
        const end = toDate ? new Date(toDate) : null;
        query.createdAt = {};
        if (start) {
          if (isNaN(start.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid fromDate parameter" });
          }
          start.setHours(0, 0, 0, 0);
          query.createdAt.$gte = start;
        }
        if (end) {
          if (isNaN(end.getTime())) {
            return res.status(400).json({ success: false, message: "Invalid toDate parameter" });
          }
          end.setHours(23, 59, 59, 999);
          query.createdAt.$lte = end;
        }
      }

      if (doctorId) {
        query.doctorId = doctorId;
      }

      // Handle status filter
      if (status) {
        // Find all appointments that match the status (case-insensitive)
        const matchingAppointments = await Appointment.find(
          { 
            clinicId, 
            status: { $regex: new RegExp(`^${status}$`, 'i') } 
          },
          { _id: 1 }
        ).lean();
        
        // Extract the appointment IDs
        const matchingAppointmentIds = matchingAppointments.map(appt => appt._id);
        
        // If no matching appointments, return empty result
        if (matchingAppointmentIds.length === 0) {
          return res.status(200).json({
            success: true,
            complaints: [],
            total: 0,
            page: parseInt(page),
            totalPages: 0,
          });
        }
        
        // Add to our query
        query.appointmentId = { $in: matchingAppointmentIds };
      }

      let patientQuery = {};
      let matchingPatientIds = [];

      if (search) {
        patientQuery.$or = [
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { mobileNumber: { $regex: search, $options: "i" } },
        ];
      }

      if (Object.keys(patientQuery).length > 0) {
        try {
          const patients = await PatientRegistration.find(patientQuery).select("_id").lean();
          const patientIds = patients.map((p) => p._id);
          if (patientIds.length > 0) {
            query.patientId = { $in: patientIds };
          } else {
            return res.status(200).json({
              success: true,
              complaints: [],
              total: 0,
              page: parseInt(page),
              totalPages: 0,
            });
          }
        } catch (err) {
          console.error("Error searching patients:", err);
          return res.status(500).json({
            success: false,
            message: "Error searching patients",
            error: err.message,
          });
        }
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const skip = (pageNum - 1) * limitNum;

      let total, complaints;
      try {
        total = await PatientComplains.countDocuments(query);
        complaints = await PatientComplains.find(query)
          .populate({
            path: "patientId",
            model: "PatientRegistration",
            select: "firstName lastName mobileNumber email emrNumber invoiceNumber gender",
          })
          .populate({
            path: "doctorId",
            model: "User",
            select: "name email",
          })
          .populate({
  path: "appointmentId",
  model: "Appointment",
  select: "startDate fromTime toTime status serviceId serviceIds services",
            populate: [
              { path: "serviceId", model: "Service", select: "name" },
              { path: "serviceIds", model: "Service", select: "name" },
              { path: "services.serviceId", model: "Service", select: "name" },
            ],
          })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean();
          
      } catch (err) {
        console.error("Error fetching complaints:", err);
        return res.status(500).json({
          success: false,
          message: "Error fetching complaints",
          error: err.message,
        });
      }

      // First, get all unique patient IDs and appointment IDs
      const patientIds = [...new Set(complaints.map(c => {
        if (c.patientId) {
          if (typeof c.patientId === 'object' && c.patientId._id) {
            return String(c.patientId._id);
          } else {
            return String(c.patientId);
          }
        }
        return null;
      }).filter(Boolean))];
      
      const appointmentIds = [...new Set(complaints.map(c => {
        if (c.appointmentId) {
          if (typeof c.appointmentId === 'object' && c.appointmentId._id) {
            return String(c.appointmentId._id);
          } else {
            return String(c.appointmentId);
          }
        }
        return null;
      }).filter(Boolean))];

      // Now fetch all the billings in one query!
      let allBillings = [];
      if (patientIds.length > 0) {
        allBillings = await Billing.find({
          patientId: { $in: patientIds },
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
        })
          .populate({
            path: "doctorId",
            select: "name",
            model: User
          })
          .sort({ createdAt: -1 })
          .lean();
      }

      // Now process all the billings once
      // First, process cleared package invoices
      const clearedPackageInvoices = new Set();
      for (const b of allBillings) {
        if (b.service === "Treatment" && Array.isArray(b.pendingClearedBreakdown)) {
          for (const pcb of b.pendingClearedBreakdown) {
            if (pcb.invoiceNumber && pcb.service === "Package") {
              clearedPackageInvoices.add(pcb.invoiceNumber);
            }
          }
        }
      }
      // Filter out cleared packages
      allBillings = allBillings.filter((b) => {
        if (b.service === "Package" && clearedPackageInvoices.has(b.invoiceNumber)) {
          return false;
        }
        return true;
      });
      // Now set doctor name on all billings
      allBillings = allBillings.map(billing => {
        const doctorName = billing.doctorName || billing.doctorId?.name || "—";
        return { ...billing, doctorName };
      });

      // Now group billings by appointmentId for quick lookup!
      const billingsByAppointmentId = {};
      for (const b of allBillings) {
        let apptId;
        if (!b.appointmentId) {
          continue; // Skip if no appointmentId at all
        }
        if (typeof b.appointmentId === "object" && b.appointmentId._id) {
          apptId = String(b.appointmentId._id);
        } else {
          apptId = String(b.appointmentId);
        }
        if (apptId) {
          if (!billingsByAppointmentId[apptId]) {
            billingsByAppointmentId[apptId] = [];
          }
          billingsByAppointmentId[apptId].push(b);
        }
      }

      const formatted = [];

      for (const comp of complaints) {
        const patient = (typeof comp.patientId === 'object' && comp.patientId) ? comp.patientId : {};
        const doctor = (typeof comp.doctorId === 'object' && comp.doctorId) ? comp.doctorId : {};
        const appointment = (typeof comp.appointmentId === 'object' && comp.appointmentId) ? comp.appointmentId : {};

        const serviceNames = (() => {
          const names = new Set();
          if (appointment.serviceId?.name) names.add(appointment.serviceId.name);
          if (Array.isArray(appointment.serviceIds)) {
            appointment.serviceIds.forEach((s) => {
              if (s?.name) names.add(s.name);
            });
          }
          if (Array.isArray(appointment.services)) {
            appointment.services.forEach((s) => {
              if (s?.serviceId?.name) names.add(s.serviceId.name);
            });
          }
          return Array.from(names);
        })();

        const appointmentDate = appointment.startDate
          ? new Date(appointment.startDate).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "-";

        // Now quickly get billings for this appointment
        let billingsForAppointment = [];
        if (appointment._id) {
          const apptIdString = String(appointment._id);
          billingsForAppointment = billingsByAppointmentId[apptIdString] || [];
        }

        // Format appointment like all-appointments API
        const formattedAppointment = appointment._id ? {
          _id: appointment._id.toString(),
          visitId: appointment._id.toString().slice(-4),
          patientId: patient._id?.toString() || "",
          patientName:
            `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
            "Unknown",
          patientNumber: patient.mobileNumber || "",
          patientEmail: patient.email || "",
          emrNumber: patient.emrNumber || "",
          invoiceNumber: patient.invoiceNumber || "",
          gender: patient.gender || "",
          doctorId: doctor._id?.toString() || "",
          doctorName: doctor.name || "Unknown",
          doctorEmail: doctor.email || "",
          roomId: "",
          roomName: "-",
          serviceId: appointment.serviceId?._id?.toString() || "",
          serviceName: appointment.serviceId?.name || "",
          serviceIds: Array.isArray(appointment.serviceIds)
            ? appointment.serviceIds.map((s) => s?._id?.toString()).filter(Boolean)
            : [],
          serviceNames,
          services: (() => {
            const existingServices = new Map();

            if (Array.isArray(appointment.services)) {
              appointment.services.forEach(s => {
                if (s?.serviceId?._id) {
                  existingServices.set(s.serviceId._id.toString(), {
                    serviceId: s.serviceId._id.toString(),
                    quantity: s.quantity || 1,
                    name: s.serviceId?.name,
                  });
                }
              });
            }

            if (appointment.serviceId?._id) {
              const id = appointment.serviceId._id.toString();
              if (!existingServices.has(id)) {
                existingServices.set(id, {
                  serviceId: id,
                  quantity: 1,
                  name: appointment.serviceId?.name,
                });
              }
            }

            if (Array.isArray(appointment.serviceIds)) {
              appointment.serviceIds.forEach(s => {
                if (s?._id) {
                  const id = s._id.toString();
                  if (!existingServices.has(id)) {
                    existingServices.set(id, {
                      serviceId: id,
                      quantity: 1,
                      name: s?.name,
                    });
                  }
                }
              });
            }

            return Array.from(existingServices.values());
          })(),
      status: appointment.status || "Booked",
          followType: "",
          referral: "direct",
          emergency: "no",
          notes: "",
          registeredDate: appointmentDate,
          registeredTime: appointment.fromTime && appointment.toTime ? `${appointment.fromTime} - ${appointment.toTime}` : "-",
          invoicedDate: appointmentDate,
          invoicedTime: "-",
          startDate: appointment.startDate ? appointment.startDate.toISOString() : null,
          fromTime: appointment.fromTime,
          toTime: appointment.toTime,
          createdAt: appointment.createdAt ? appointment.createdAt.toISOString() : null,
          updatedAt: appointment.updatedAt ? appointment.updatedAt.toISOString() : null,
        } : null;

        formatted.push({
          _id: comp._id.toString(),
          patientId: patient._id?.toString() || "",
          patientName:
            `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
            "Unknown",
          patientNumber: patient.mobileNumber || "",
          invoiceNumber: patient.invoiceNumber || "",
          emrNumber: patient.emrNumber || "",
          appointmentDate,
          doctorId: doctor._id?.toString() || "",
          doctorName: doctor.name || "Unknown",
          services: serviceNames,
          complaintNote: comp.complaints || "",
          appointmentId: appointment._id?.toString() || "",
          appointment: formattedAppointment,
          billings: billingsForAppointment,
          isInvoiced: billingsForAppointment.length > 0,
          createdAt: comp.createdAt ? comp.createdAt.toISOString() : null,
          updatedAt: comp.updatedAt ? comp.updatedAt.toISOString() : null,
        });
      }

      return res.status(200).json({
        success: true,
        complaints: formatted,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
      });
    }

    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Error in complaints API:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
}

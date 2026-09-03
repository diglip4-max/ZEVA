import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import Room from "../../../models/Room";
import Service from "../../../models/Service";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/staff-intelligence?date=YYYY-MM-DD
 *
 * Calculates staff metrics for the clinic:
 *   - inClinic: total doctorStaff + agent count for the clinic
 *   - available: approved (isApproved=true, declined=false) staff
 *   - withPatients: doctorStaff who have appointments booked under them
 *   - capacityAlerts: top 3 doctors with most appointments (all time)
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
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999)
  );
  return { start, end };
}

// Get initials from name
function getInitials(name) {
  if (!name) return "??";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

    // 4. In Clinic: count of doctorStaff + agent for the clinic
    const inClinicCount = await User.countDocuments({
      clinicId: clinicObjectId,
      role: { $in: ["doctorStaff", "agent"] },
    });

    // 5. Available: approved (isApproved=true, declined=false)
    const availableCount = await User.countDocuments({
      clinicId: clinicObjectId,
      role: { $in: ["doctorStaff", "agent"] },
      isApproved: true,
      declined: { $ne: true },
    });

    // 6. With Patients: doctorStaff who have appointments booked under them today
    const doctorStaff = await User.find({
      clinicId: clinicObjectId,
      role: { $in: ["doctorStaff", "doctor"] },
    })
      .select("_id name")
      .lean();

    const doctorIds = doctorStaff.map((d) => d._id);
    const doctorNameMap = {};
    for (const d of doctorStaff) {
      doctorNameMap[d._id.toString()] = d.name;
    }

    // Find doctorStaff with appointments today
    const appointmentsToday = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      doctorId: { $in: doctorIds },
    })
      .select("doctorId")
      .lean();

    const doctorsWithPatientsToday = new Set();
    for (const apt of appointmentsToday) {
      if (apt.doctorId) {
        doctorsWithPatientsToday.add(apt.doctorId.toString());
      }
    }

    const withPatientsCount = doctorsWithPatientsToday.size;

    // 7. Capacity Alerts: top 3 doctors with most appointments (all time)
    const allAppointments = await Appointment.find({
      clinicId: clinicObjectId,
      doctorId: { $in: doctorIds },
    })
      .select("doctorId")
      .lean();

    const doctorAppointmentCount = {};
    for (const apt of allAppointments) {
      if (apt.doctorId) {
        const did = apt.doctorId.toString();
        doctorAppointmentCount[did] = (doctorAppointmentCount[did] || 0) + 1;
      }
    }

    // Sort doctors by appointment count descending
    const sortedDoctors = Object.entries(doctorAppointmentCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Calculate utilization percentage for each (booked slots / total possible slots)
    // For simplicity, use relative percentage based on max
    const maxAppointments = sortedDoctors.length > 0 ? sortedDoctors[0][1] : 1;

    const capacityAlerts = sortedDoctors.map(([doctorId, count]) => {
      const name = doctorNameMap[doctorId] || "Unknown Doctor";
      const percentage = Math.round((count / maxAppointments) * 100);
      return {
        doctorId,
        name,
        initials: getInitials(name),
        appointmentCount: count,
        utilization: percentage,
      };
    });

    // 8. Room utilization: count appointments per room for selected date
    const rooms = await Room.find({
      clinicId: clinicObjectId,
      isDeleted: { $ne: true },
    })
      .select("_id name")
      .lean();

    const roomIds = rooms.map((r) => r._id);
    const roomNameMap = {};
    for (const r of rooms) {
      roomNameMap[r._id.toString()] = r.name;
    }

    // Get appointments with roomId for selected date
    const appointmentsWithRooms = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
      roomId: { $in: roomIds },
    })
      .select("roomId")
      .lean();

    // Count appointments per room
    const roomAppointmentCount = {};
    for (const apt of appointmentsWithRooms) {
      if (apt.roomId) {
        const rid = apt.roomId.toString();
        roomAppointmentCount[rid] = (roomAppointmentCount[rid] || 0) + 1;
      }
    }

    // Build room data with utilization percentage
    const maxRoomAppointments = Math.max(...Object.values(roomAppointmentCount), 1);
    const roomData = rooms.map((room) => {
      const rid = room._id.toString();
      const count = roomAppointmentCount[rid] || 0;
      const utilization = maxRoomAppointments > 0
        ? Math.round((count / maxRoomAppointments) * 100)
        : 0;
      return {
        roomId: rid,
        name: room.name,
        appointmentCount: count,
        utilization,
      };
    });

    // 9. Service Performance: top services by appointment count for selected date
    const appointmentsWithServices = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
    })
      .select("services serviceIds")
      .lean();

    // Collect all service IDs from appointments
    const serviceCountMap = {};
    for (const apt of appointmentsWithServices) {
      // From services array (with quantity)
      if (Array.isArray(apt.services)) {
        for (const s of apt.services) {
          if (s.serviceId) {
            const sid = s.serviceId.toString();
            serviceCountMap[sid] = (serviceCountMap[sid] || 0) + (s.quantity || 1);
          }
        }
      }
      // From serviceIds array (quantity = 1 each)
      if (Array.isArray(apt.serviceIds)) {
        for (const sid of apt.serviceIds) {
          if (sid) {
            const sidStr = sid.toString();
            // Only add if not already counted in services array
            const alreadyCounted = Array.isArray(apt.services) && apt.services.some(
              (s) => s.serviceId?.toString() === sidStr
            );
            if (!alreadyCounted) {
              serviceCountMap[sidStr] = (serviceCountMap[sidStr] || 0) + 1;
            }
          }
        }
      }
    }

    // Get service names
    const serviceIds = Object.keys(serviceCountMap);
    const serviceNames = {};
    if (serviceIds.length > 0) {
      const services = await Service.find({
        _id: { $in: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("_id name")
        .lean();
      for (const svc of services) {
        serviceNames[svc._id.toString()] = svc.name;
      }
    }

    // Sort by count descending and take top 4
    const sortedServices = Object.entries(serviceCountMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const servicePerformance = sortedServices.map(([serviceId, count], index) => ({
      serviceId,
      name: serviceNames[serviceId] || "Unknown Service",
      count,
      rank: index + 1,
    }));

    return res.status(200).json({
      success: true,
      data: {
        inClinic: inClinicCount,
        available: availableCount,
        withPatients: withPatientsCount,
        capacityAlerts,
        roomData,
        servicePerformance,
      },
    });
  } catch (err) {
    console.error("Error in staff-intelligence:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

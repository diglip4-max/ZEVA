import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import Billing from "../../../../models/Billing";
import Appointment from "../../../../models/Appointment";
import Service from "../../../../models/Service";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();
  } catch {
    return res.status(500).json({ success: false, message: "Database connection failed" });
  }

  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(user);
  if (clinicError && user.role !== "admin") {
    return res.status(403).json({ success: false, message: clinicError });
  }

  const moduleKey = "clinic_reporting";
  const { hasPermission } = await checkClinicPermission(clinicId, moduleKey, "read");
  if (!hasPermission) {
    return res.status(403).json({ success: false, message: "You do not have permission to view reports" });
  }

  const { startDate, endDate, limit = "10", doctorId, departmentId } = req.query;
  const lim = Math.max(1, Math.min(25, parseInt(limit, 10) || 10));

  try {
    const match = { service: "Package" };
    if (user.role !== "admin") {
      match.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (req.query.clinicId) {
      match.clinicId = new mongoose.Types.ObjectId(String(req.query.clinicId));
    }
    // Normalize dates to local start-of-day / end-of-day so billings made later
    // in the day are still included (matches revenue.js behavior)
    const startAt = startDate
      ? new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), new Date(startDate).getDate(), 0, 0, 0, 0)
      : null;
    const endAt = endDate
      ? new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth(), new Date(endDate).getDate(), 23, 59, 59, 999)
      : null;

    if (startAt || endAt) {
      match.invoicedDate = {};
      if (startAt) match.invoicedDate.$gte = startAt;
      if (endAt) match.invoicedDate.$lte = endAt;
      if (Object.keys(match.invoicedDate).length === 0) delete match.invoicedDate;
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          effectiveDoctorId: {
            $ifNull: ["$doctorId", "$appointment.doctorId"]
          }
        }
      }
    ];

    if (doctorId) {
      pipeline.push({
        $match: { effectiveDoctorId: new mongoose.Types.ObjectId(String(doctorId)) },
      });
    }

    if (departmentId) {
      pipeline.push(
        {
          $lookup: {
            from: "services",
            localField: "appointment.serviceId",
            foreignField: "_id",
            as: "service",
          },
        },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        {
          $match: { "service.departmentId": new mongoose.Types.ObjectId(String(departmentId)) },
        }
      );
    }

    pipeline.push(
      {
        $group: {
          _id: "$package",
          totalRevenue: { $sum: { $ifNull: ["$paid", 0] } },
          totalBookings: { $sum: 1 },
          totalAppointments: { $sum: { $cond: [{ $ifNull: ["$appointmentId", false] }, 1, 0] } },
          averagePrice: { $avg: { $ifNull: ["$amount", 0] } },
        },
      },
      {
        $project: {
          packageName: "$_id",
          totalRevenue: 1,
          totalBookings: 1,
          totalAppointments: 1,
          averagePrice: 1,
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: lim }
    );

    const rows = await Billing.aggregate(pipeline);

    // Calculate summary metrics for all matching packages
    const summaryPipeline = [
      { $match: match },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          effectiveDoctorId: {
            $ifNull: ["$doctorId", "$appointment.doctorId"]
          },
        }
      },
      ...(doctorId ? [{ $match: { effectiveDoctorId: new mongoose.Types.ObjectId(String(doctorId)) } }] : []),
      ...(departmentId ? [
        {
          $lookup: {
            from: "services",
            localField: "appointment.serviceId",
            foreignField: "_id",
            as: "service",
          },
        },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        {
          $match: { "service.departmentId": new mongoose.Types.ObjectId(String(departmentId)) },
        }
      ] : []),
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: { $ifNull: ["$paid", 0] } },
          totalBookings: { $sum: 1 },
        },
      },
    ];

    const summaryAgg = await Billing.aggregate(summaryPipeline);
    const summary = summaryAgg?.[0] || { totalRevenue: 0, totalBookings: 0 };

    return res.status(200).json({ success: true, data: rows, summary });
  } catch (e) {
    console.error("package-performance error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch package performance" });
  }
}

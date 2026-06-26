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

    // Calculate previous period dates
    let previousStartAt = null;
    let previousEndAt = null;
    if (startAt && endAt) {
      const durationMs = endAt.getTime() - startAt.getTime();
      previousStartAt = new Date(startAt.getTime() - durationMs);
      previousEndAt = new Date(startAt.getTime() - 1);
    } else {
      // Default: previous month if no date range selected
      const now = new Date();
      const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
      const previousMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      previousStartAt = previousMonthStart;
      previousEndAt = previousMonthEnd;
    }

    // Build match for previous period
    const previousMatch = { ...match };
    if (previousStartAt || previousEndAt) {
      previousMatch.invoicedDate = {};
      if (previousStartAt) previousMatch.invoicedDate.$gte = previousStartAt;
      if (previousEndAt) previousMatch.invoicedDate.$lte = previousEndAt;
      if (Object.keys(previousMatch.invoicedDate).length === 0) delete previousMatch.invoicedDate;
    }

    // Helper to build pipeline and summary
    const buildPipelines = (matchObj) => {
      const pipeline = [
        { $match: matchObj },
        {
          $lookup: {
            from: "appointments",
            localField: "appointmentId",
            foreignField: "_id",
            as: "appointment",
          },
        },
        { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
        // First, get effectiveDoctorId
        {
          $addFields: {
            effectiveDoctorId: {
              $ifNull: ["$doctorId", "$appointment.doctorId"]
            }
          }
        },
        // Look up doctor's department from DoctorDepartment
        {
          $lookup: {
            from: "doctordepartments",
            localField: "effectiveDoctorId",
            foreignField: "doctorId",
            as: "doctorDepartments"
          }
        },
        // Then look up services from appointment
        {
          $lookup: {
            from: "services",
            localField: "appointment.serviceId",
            foreignField: "_id",
            as: "service",
          },
        },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        // First, get treatment names from selectedPackageTreatments or treatment field
        {
          $addFields: {
            treatmentNames: {
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ["$selectedPackageTreatments", []] } }, 0] },
                then: "$selectedPackageTreatments.treatmentName",
                else: { $cond: { if: "$treatment", then: ["$treatment"], else: [] } }
              }
            }
          }
        },
        // Look up services by treatment names for departmentId
        {
          $lookup: {
            from: "services",
            let: { tNames: "$treatmentNames", clinicId: "$clinicId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$clinicId", "$$clinicId"] },
                      { $in: ["$name", "$$tNames"] }
                    ]
                  }
                }
              },
              { $project: { departmentId: 1, name: 1, _id: 0 } }
            ],
            as: "treatmentServices"
          }
        },
        // Get the first non-null departmentId from:
        // 1. service.departmentId (from appointment)
        // 2. treatmentServices[0].departmentId (from treatment name lookup)
        // 3. doctorDepartments[0].clinicDepartmentId (from doctor's department)
        {
          $addFields: {
            effectiveDepartmentId: {
              $ifNull: [
                "$service.departmentId",
                { $arrayElemAt: ["$treatmentServices.departmentId", 0] },
                { $arrayElemAt: ["$doctorDepartments.clinicDepartmentId", 0] },
                null
              ]
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
        pipeline.push({
          $match: { effectiveDepartmentId: new mongoose.Types.ObjectId(String(departmentId)) },
        });
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

      // Summary pipeline
      const summaryPipeline = [
        { $match: matchObj },
        {
          $lookup: {
            from: "appointments",
            localField: "appointmentId",
            foreignField: "_id",
            as: "appointment",
          },
        },
        { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
        // First, get effectiveDoctorId
        {
          $addFields: {
            effectiveDoctorId: {
              $ifNull: ["$doctorId", "$appointment.doctorId"]
            }
          }
        },
        // Look up doctor's department from DoctorDepartment
        {
          $lookup: {
            from: "doctordepartments",
            localField: "effectiveDoctorId",
            foreignField: "doctorId",
            as: "doctorDepartments"
          }
        },
        // Then look up services from appointment
        {
          $lookup: {
            from: "services",
            localField: "appointment.serviceId",
            foreignField: "_id",
            as: "service",
          },
        },
        { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
        // First, get treatment names from selectedPackageTreatments or treatment field
        {
          $addFields: {
            treatmentNames: {
              $cond: {
                if: { $gt: [{ $size: { $ifNull: ["$selectedPackageTreatments", []] } }, 0] },
                then: "$selectedPackageTreatments.treatmentName",
                else: { $cond: { if: "$treatment", then: ["$treatment"], else: [] } }
              }
            }
          }
        },
        // Look up services by treatment names for departmentId
        {
          $lookup: {
            from: "services",
            let: { tNames: "$treatmentNames", clinicId: "$clinicId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$clinicId", "$$clinicId"] },
                      { $in: ["$name", "$$tNames"] }
                    ]
                  }
                }
              },
              { $project: { departmentId: 1, name: 1, _id: 0 } }
            ],
            as: "treatmentServices"
          }
        },
        // Get the first non-null departmentId from:
        // 1. service.departmentId (from appointment)
        // 2. treatmentServices[0].departmentId (from treatment name lookup)
        // 3. doctorDepartments[0].clinicDepartmentId (from doctor's department)
        {
          $addFields: {
            effectiveDepartmentId: {
              $ifNull: [
                "$service.departmentId",
                { $arrayElemAt: ["$treatmentServices.departmentId", 0] },
                { $arrayElemAt: ["$doctorDepartments.clinicDepartmentId", 0] },
                null
              ]
            }
          }
        },
        ...(doctorId ? [{ $match: { effectiveDoctorId: new mongoose.Types.ObjectId(String(doctorId)) } }] : []),
        ...(departmentId ? [{ $match: { effectiveDepartmentId: new mongoose.Types.ObjectId(String(departmentId)) } }] : []),
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: { $ifNull: ["$paid", 0] } },
            totalBookings: { $sum: 1 },
          },
        },
      ];

      return { pipeline, summaryPipeline };
    };

    const { pipeline: currentPipeline, summaryPipeline: currentSummaryPipeline } = buildPipelines(match);
    const { summaryPipeline: previousSummaryPipeline } = buildPipelines(previousMatch);

    const rows = await Billing.aggregate(currentPipeline);
    const summaryAgg = await Billing.aggregate(currentSummaryPipeline);
    const previousSummaryAgg = await Billing.aggregate(previousSummaryPipeline);
    const summary = summaryAgg?.[0] || { totalRevenue: 0, totalBookings: 0 };
    const previousSummary = previousSummaryAgg?.[0] || { totalRevenue: 0, totalBookings: 0 };

    return res.status(200).json({ success: true, data: rows, summary, previousSummary });
  } catch (e) {
    console.error("package-performance error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch package performance" });
  }
}

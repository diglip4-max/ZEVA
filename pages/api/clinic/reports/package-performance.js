import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import Billing from "../../../../models/Billing";
import Appointment from "../../../../models/Appointment";
import Service from "../../../../models/Service";
import User from "../../../../models/Users";
import PatientRegistration from "../../../../models/PatientRegistration";
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

  const { startDate, endDate, limit = "10", doctorId, departmentId, salesStaffId, clinicId: selectedClinicId, paymentMethod } = req.query;
  const lim = Math.max(1, Math.min(25, parseInt(limit, 10) || 10));

  try {
    const match = { service: "Package" };
    if (user.role !== "admin") {
      match.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (selectedClinicId) {
      match.clinicId = new mongoose.Types.ObjectId(String(selectedClinicId));
    }
    if (paymentMethod) {
      match.paymentMethod = paymentMethod;
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

      if (salesStaffId) {
        pipeline.push({
          $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) },
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
        ...(salesStaffId ? [{ $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) } }] : []),
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

    // Monthly package revenue data - all 12 months of the full year, ignoring date range but keeping other filters
    // Determine which year to use: use startDate's year if available, else current year
    const yearToUse = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    // Create match for monthly aggregation: full year + all other filters (clinic, payment method, etc.)
    const monthlyMatch = { ...match };
    // Override invoicedDate to full year to show all months
    monthlyMatch.invoicedDate = {
      $gte: new Date(yearToUse, 0, 1),
      $lte: new Date(yearToUse, 11, 31, 23, 59, 59, 999)
    };
    
    const monthlyAgg = await Billing.aggregate([
      { $match: monthlyMatch },
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
        },
      },
      // Apply the same filters (doctor, department, sales staff)
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
      ...(salesStaffId ? [{ $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) } }] : []),
      {
        $group: {
          _id: {
            patientId: "$patientId",
            package: "$package",
            month: { $month: "$invoicedDate" }
          },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          totalPending: { $sum: { $ifNull: ["$pending", 0] } },
        },
      },
      {
        $group: {
          _id: "$_id.month",
          actual: { $sum: "$totalPaid" },
          packageCount: { $sum: 1 },
          totalPackages: { $sum: 1 },
          totalRevenue: { $sum: "$totalPaid" },
          totalPaidRevenue: { $sum: "$totalPaid" },
          totalOutstanding: { $sum: "$totalPending" },
          paidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$totalPaid", 0] }, { $lte: ["$totalPending", 0] }] },
                1,
                0,
              ],
            },
          },
          partiallyPaidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] },
                1,
                0,
              ],
            },
          },
          unpaidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $lte: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    
    // Create array of all 12 months
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyRevenue = monthNames.map((month, index) => {
      const monthData = monthlyAgg.find((m) => m._id === index + 1);
      const targetRevenue = 200000; // Example fixed target
      return {
        month,
        actual: Math.round(Number(monthData?.actual || 0)),
        target: targetRevenue,
        packageCount: monthData?.packageCount || 0,
        totalPackages: monthData?.totalPackages || 0,
        totalRevenue: Math.round(Number(monthData?.totalRevenue || 0)),
        totalPaidRevenue: Math.round(Number(monthData?.totalPaidRevenue || 0)),
        totalOutstanding: Math.round(Number(monthData?.totalOutstanding || 0)),
        paidPackages: monthData?.paidPackages || 0,
        partiallyPaidPackages: monthData?.partiallyPaidPackages || 0,
        unpaidPackages: monthData?.unpaidPackages || 0,
      };
    });

    // Combined summary: all metrics from the same filtered match (selected date range)
    // Use the same grouping logic as packages-sold.js: group by { patientId, package }
    const combinedSummaryAgg = await Billing.aggregate([
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
          __usedSessions: {
            $sum: {
              $map: {
                input: { $ifNull: ["$selectedPackageTreatments", []] },
                as: "t",
                in: { $ifNull: ["$$t.sessions", 0] },
              },
            },
          },
        },
      },
      // Apply the same filters (doctor, department, sales staff)
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
      ...(salesStaffId ? [{ $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) } }] : []),
      {
        $group: {
          _id: { patientId: "$patientId", package: "$package" },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          totalPending: { $sum: { $ifNull: ["$pending", 0] } },
          sessionsUsed: { $sum: "$__usedSessions" },
          firstPurchaseDate: { $min: "$createdAt" },
          lastActivityDate: { $max: "$createdAt" },
          doctorIds: { $addToSet: "$effectiveDoctorId" },
        },
      },
      {
        $lookup: {
          from: "packages",
          localField: "_id.package",
          foreignField: "name",
          as: "pkg",
        },
      },
      {
        $addFields: {
          totalSessions: { $ifNull: [{ $arrayElemAt: ["$pkg.totalSessions", 0] }, 0] },
          pkgData: { $arrayElemAt: ["$pkg", 0] },
        },
      },
      // Now group all these into summary metrics
      {
        $group: {
          _id: null,
          totalPackages: { $sum: 1 },
          totalRevenue: { $sum: "$totalPaid" },
          totalPaidRevenue: { $sum: "$totalPaid" },
          totalOutstanding: { $sum: "$totalPending" },
          paidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$totalPaid", 0] }, { $lte: ["$totalPending", 0] }] },
                1,
                0,
              ],
            },
          },
          partiallyPaidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] },
                1,
                0,
              ],
            },
          },
          unpaidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $lte: ["$totalPaid", 0] }, { $gt: ["$totalPending", 0] }] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);
    const combinedSummary = combinedSummaryAgg?.[0] || {
      totalPackages: 0,
      totalRevenue: 0,
      totalPaidRevenue: 0,
      totalOutstanding: 0,
      paidPackages: 0,
      partiallyPaidPackages: 0,
      unpaidPackages: 0,
    };

    // ------------------------------
    // Doctor Leaderboard (Package Billing)
    // ------------------------------
    const doctorPackageAgg = await Billing.aggregate([
      { $match: { ...match, doctorId: { $ne: null } } },
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
        },
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
      ...(salesStaffId ? [{ $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) } }] : []),
      {
        $group: {
          _id: { patientId: "$patientId", package: "$package", doctorId: "$effectiveDoctorId" },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          firstPurchaseDate: { $min: "$createdAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.doctorId",
          foreignField: "_id",
          as: "doctor"
        }
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "doctordepartments",
          localField: "_id.doctorId",
          foreignField: "doctorId",
          as: "doctorDept"
        }
      },
      { $unwind: { path: "$doctorDept", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "departments",
          localField: "doctorDept.clinicDepartmentId",
          foreignField: "_id",
          as: "department"
        }
      },
      { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$_id.doctorId",
          name: { $first: { $ifNull: ["$doctor.name", "Unknown Doctor"] } },
          department: { $first: { $ifNull: ["$department.name", "Other"] } },
          packages: { $sum: 1 },
          revenue: { $sum: "$totalPaid" }
        }
      },
      { $sort: { packages: -1 } },
      { $limit: 5 }
    ]);
    const doctorLeaderboard = doctorPackageAgg.map((doc, index) => ({
      rank: index + 1,
      initials: doc.name
        ? doc.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : "UD",
      name: doc.name,
      department: doc.department,
      packages: doc.packages,
      revenue: Math.round(Number(doc.revenue || 0))
    }));

    // ------------------------------
    // Sales Staff Leaderboard
    // ------------------------------
    const salesStaffPipeline = [
      { $match: { ...(user.role !== "admin" ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } : (selectedClinicId ? { clinicId: new mongoose.Types.ObjectId(String(selectedClinicId)) } : {})) } },
      { $unwind: "$packages" },
      ...(startAt || endAt ? [{
        $match: {
          "packages.assignedDate": {
            ...(startAt ? { $gte: startAt } : {}),
            ...(endAt ? { $lte: endAt } : {})
          }
        }
      }] : []),
      {
        $group: {
          _id: "$packages.packageSoldByUserId",
          totalPackagesSold: { $sum: 1 },
          totalRevenue: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
          totalPaid: { $sum: { $ifNull: ["$packages.paidAmount", 0] } },
          totalPending: { $sum: { $subtract: [{ $ifNull: ["$packages.totalPrice", 0] }, { $ifNull: ["$packages.paidAmount", 0] }] } },
          paidPackages: {
            $sum: {
              $cond: [
                { $gte: [{ $ifNull: ["$packages.paidAmount", 0] }, { $ifNull: ["$packages.totalPrice", 0] }] },
                1,
                0
              ]
            }
          },
          partiallyPaidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $gt: [{ $ifNull: ["$packages.paidAmount", 0] }, 0] }, { $lt: [{ $ifNull: ["$packages.paidAmount", 0] }, { $ifNull: ["$packages.totalPrice", 0] }] }] },
                1,
                0
              ]
            }
          },
          unpaidPackages: {
            $sum: {
              $cond: [{ $eq: [{ $ifNull: ["$packages.paidAmount", 0] }, 0] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "staff"
        }
      },
      { $unwind: { path: "$staff", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          staffId: "$_id",
          name: {
            $ifNull: [
              "$staff.name",
              { $trim: { input: { $concat: [{ $ifNull: ["$staff.firstName", ""] }, " ", { $ifNull: ["$staff.lastName", ""] }] } } }
            ]
          },
          totalPackagesSold: 1,
          totalRevenue: 1,
          totalPaid: 1,
          totalPending: 1,
          outstanding: "$totalPending",
          paidPackages: 1,
          partiallyPaidPackages: 1,
          unpaidPackages: 1
        }
      },
      { $sort: { totalPackagesSold: -1 } },
      { $limit: 5 }
    ];
    const salesStaffLeaderboard = await PatientRegistration.aggregate(salesStaffPipeline);

    // ------------------------------
    // Department Revenue Data
    // ------------------------------
    const departmentRevenueAgg = await Billing.aggregate([
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
        },
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
      ...(salesStaffId ? [{ $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) } }] : []),
      {
        $group: {
          _id: { patientId: "$patientId", package: "$package" },
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          firstPurchaseDate: { $min: "$createdAt" },
          // Store appointment/service/department info for later
          appointment: { $first: "$appointment" }
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "appointment.serviceId",
          foreignField: "_id",
          as: "service"
        }
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "departments",
          localField: "service.departmentId",
          foreignField: "_id",
          as: "department"
        }
      },
      { $unwind: { path: "$department", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: { $ifNull: ["$department._id", null] },
          department: { $first: { $ifNull: ["$department.name", "Other"] } },
          revenue: { $sum: "$totalPaid" }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 6 }
    ]);
    const departmentRevenueData = departmentRevenueAgg.map(d => ({
      department: d.department,
      revenue: Math.round(Number(d.revenue || 0))
    }));

    return res.status(200).json({
      success: true,
      data: rows,
      summary,
      previousSummary,
      monthlyRevenue,
      combinedSummary, // New: all metrics from single source
      doctorLeaderboard,
      salesStaffLeaderboard,
      departmentRevenueData
    });
  } catch (e) {
    console.error("package-performance error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch package performance" });
  }
}

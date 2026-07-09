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

    const monthSectionMatch = { service: "Package" };
    if (user.role !== "admin") {
      monthSectionMatch.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (selectedClinicId) {
      monthSectionMatch.clinicId = new mongoose.Types.ObjectId(String(selectedClinicId));
    }
    if (startAt || endAt) {
      monthSectionMatch.invoicedDate = {};
      if (startAt) monthSectionMatch.invoicedDate.$gte = startAt;
      if (endAt) monthSectionMatch.invoicedDate.$lte = endAt;
      if (Object.keys(monthSectionMatch.invoicedDate).length === 0) delete monthSectionMatch.invoicedDate;
    }

    // Helper to build pipeline and summary
    const buildPipelines = (matchObj) => {
      const pipeline = [
        { $match: { $or: [matchObj, { ...matchObj, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
        // Only count packages with billing (paid > 0)
        { $match: { paid: { $gt: 0 } } },
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
        // Check if salesStaffId is a valid ObjectId or a name
        const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
        
        if (isValidObjectId) {
          pipeline.push({
            $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) },
          });
        } else {
          pipeline.push({
            $match: { invoicedBy: String(salesStaffId) },
          });
        }
      }

      pipeline.push(
        // Extract package name for Treatment billings from unpaidPackagesPaid
        {
          $addFields: {
            __packageName: {
              $cond: {
                if: { $eq: ["$service", "Treatment"] },
                then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
                else: "$package"
              }
            }
          }
        },
        {
          $group: {
            _id: "$__packageName",
            // Use paid amount directly. When pending is cleared via treatment pay,
            // Treatment billing's paid field contains the cash collected for the package.
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
      // Build sales staff filter based on whether it's an ObjectId or name
      const salesStaffFilter = salesStaffId ? (() => {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
        return isValidObjectId 
          ? { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) }
          : { invoicedBy: String(salesStaffId) };
      })() : null;
      
      const summaryPipeline = [
        { $match: { $or: [matchObj, { ...matchObj, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
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
        ...(salesStaffFilter ? [{ $match: salesStaffFilter }] : []),
        {
          $group: {
            _id: null,
            // Use paid amount directly. When pending is cleared via treatment pay,
            // Treatment billing's paid field contains the cash collected for the package.
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

    // Monthly package revenue data - all 12 months of the selected year, ignoring dashboard filters
    // Determine which year to use: use startDate's year if available, else current year
    const yearToUse = startDate ? new Date(startDate).getFullYear() : new Date().getFullYear();
    // Create match for monthly aggregation: full year + clinic scope only
    const monthlyMatch = { ...monthSectionMatch };
    // Override invoicedDate to full year to show all months
    monthlyMatch.invoicedDate = {
      $gte: new Date(yearToUse, 0, 1),
      $lte: new Date(yearToUse, 11, 31, 23, 59, 59, 999)
    };
    
    const monthlyAgg = await Billing.aggregate([
      { $match: { $or: [monthlyMatch, { ...monthlyMatch, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
      // Only count packages with billing (paid > 0)
      { $match: { paid: { $gt: 0 } } },
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
          __packageName: {
            $cond: {
              if: { $eq: ["$service", "Treatment"] },
              then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
              else: "$package"
            }
          }
        },
      },
      {
        $group: {
          _id: {
            patientId: "$patientId",
            package: "$__packageName",
            month: { $month: "$invoicedDate" }
          },
          // Use paid amount directly. When pending is cleared via treatment pay,
          // Treatment billing's paid field contains the cash collected for the package.
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
    // Build sales staff filter for combined summary (ObjectId or name)
    const combinedSalesStaffFilter = salesStaffId ? (() => {
      const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
      return isValidObjectId 
        ? { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) }
        : { invoicedBy: String(salesStaffId) };
    })() : null;
    
    const combinedSummaryAgg = await Billing.aggregate([
      { $match: { $or: [match, { ...match, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
      // Only count packages with billing (paid > 0)
      { $match: { paid: { $gt: 0 } } },
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
          __packageName: {
            $cond: {
              if: { $eq: ["$service", "Treatment"] },
              then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
              else: "$package"
            }
          }
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
      ...(combinedSalesStaffFilter ? [{ $match: combinedSalesStaffFilter }] : []),
      {
        $group: {
          _id: { patientId: "$patientId", package: "$__packageName" },
          // Use paid amount directly. When pending is cleared via treatment pay,
          // Treatment billing's paid field contains the cash collected for the package.
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


    const buildLifecycleSummaryPipeline = (matchObj) => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const sevenDaysFromNow = new Date(todayStart);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const thirtyDaysFromNow = new Date(todayStart);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      return [
        { $match: { $or: [matchObj, { ...matchObj, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
        // Only count packages with billing (paid > 0)
        { $match: { paid: { $gt: 0 } } },
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
            __usedSessions: {
              $sum: {
                $map: {
                  input: { $ifNull: ["$selectedPackageTreatments", []] },
                  as: "t",
                  in: { $ifNull: ["$$t.sessions", 0] },
                },
              },
            },
            __packageName: {
              $cond: {
                if: { $eq: ["$service", "Treatment"] },
                then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
                else: "$package"
              }
            }
          },
        },
        {
          $group: {
            _id: { patientId: "$patientId", package: "$__packageName" },
            // Use paid amount directly. When pending is cleared via treatment pay,
            // Treatment billing's paid field contains the cash collected for the package.
            totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
            totalPending: { $sum: { $ifNull: ["$pending", 0] } },
            sessionsUsed: { $sum: "$__usedSessions" },
            firstPurchaseDate: { $min: "$createdAt" },
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
        {
          $addFields: {
            expirationDate: {
              $switch: {
                branches: [
                  {
                    case: { $ne: ["$pkgData.endDate", null] },
                    then: "$pkgData.endDate",
                  },
                  {
                    case: { $gt: [{ $ifNull: ["$pkgData.validityInMonths", 0] }, 0] },
                    then: {
                      $dateAdd: {
                        startDate: "$firstPurchaseDate",
                        unit: "month",
                        amount: "$pkgData.validityInMonths",
                      },
                    },
                  },
                ],
                default: {
                  $dateAdd: {
                    startDate: "$firstPurchaseDate",
                    unit: "year",
                    amount: 1,
                  },
                },
              },
            },
          },
        },
        {
          $addFields: {
            isExpired: { $lt: ["$expirationDate", todayStart] },
            isExpiringIn7Days: {
              $and: [
                { $gte: ["$expirationDate", todayStart] },
                { $lte: ["$expirationDate", sevenDaysFromNow] },
              ],
            },
            isExpiringIn30Days: {
              $and: [
                { $gt: ["$expirationDate", sevenDaysFromNow] },
                { $lte: ["$expirationDate", thirtyDaysFromNow] },
              ],
            },
            isRenewalOpportunity: {
              $or: [
                { $lt: ["$expirationDate", thirtyDaysFromNow] },
                { $gte: ["$sessionsUsed", "$totalSessions"] },
              ],
            },
          },
        },
        {
          $group: {
            _id: null,
            totalPackagesSold: { $sum: 1 },
            activePackages: {
              $sum: {
                $cond: [
                  { $and: [{ $gt: ["$sessionsUsed", 0] }, { $lt: ["$sessionsUsed", "$totalSessions"] }] },
                  1,
                  0,
                ],
              },
            },
            completedPackages: {
              $sum: {
                $cond: [{ $gte: ["$sessionsUsed", "$totalSessions"] }, 1, 0],
              },
            },
            renewalOpportunities: {
              $sum: { $cond: ["$isRenewalOpportunity", 1, 0] },
            },
          },
        },
      ];
    };

    const lifecycleSummaryAgg = await Billing.aggregate(buildLifecycleSummaryPipeline(monthSectionMatch));
    const lifecycleSummary = lifecycleSummaryAgg?.[0] || {
      totalPackagesSold: 0,
      activePackages: 0,
      completedPackages: 0,
      renewalOpportunities: 0,
    };
    // ------------------------------
    // Doctor Leaderboard (Package Billing) - with month-wise data
    // Shows packages SOLD by doctors (where doctor is the invoicer)
    // ------------------------------
    const doctorPackageAgg = await Billing.aggregate([
      { $match: { $or: [monthSectionMatch, { ...monthSectionMatch, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
      // Only count packages where there's an invoicer (sold by someone)
      { $match: { invoicedById: { $ne: null, $exists: true } } },
      // Only count packages with billing (paid > 0)
      { $match: { paid: { $gt: 0 } } },
      // Extract package name for Treatment billings from unpaidPackagesPaid
      {
        $addFields: {
          __packageName: {
            $cond: {
              if: { $eq: ["$service", "Treatment"] },
              then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
              else: "$package"
            }
          }
        }
      },
      {
        $group: {
          _id: { 
            patientId: "$patientId", 
            package: "$__packageName", 
            invoicedById: "$invoicedById", 
            month: { $month: "$invoicedDate" },
            year: { $year: "$invoicedDate" }
          },
          // Use paid amount directly. When pending is cleared via treatment pay,
          // Treatment billing's paid field contains the cash collected for the package.
          totalPaid: { $sum: { $ifNull: ["$paid", 0] } },
          firstPurchaseDate: { $min: "$createdAt" },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id.invoicedById",
          foreignField: "_id",
          as: "invoicer"
        }
      },
      { $unwind: { path: "$invoicer", preserveNullAndEmptyArrays: true } },
      // Filter for doctors only (role = "doctor" or "doctorStaff")
      { $match: { "invoicer.role": { $in: ["doctor", "doctorStaff"] } } },
      {
        $group: {
          _id: { 
            invoicedById: "$_id.invoicedById", 
            month: "$_id.month", 
            year: "$_id.year" 
          },
          name: { $first: { $ifNull: ["$invoicer.name", "Unknown Doctor"] } },
          packages: { $sum: 1 },
          revenue: { $sum: "$totalPaid" }
        }
      },
      {
        $group: {
          _id: "$_id.invoicedById",
          name: { $first: "$name" },
          totalPackages: { $sum: "$packages" },
          totalRevenue: { $sum: "$revenue" },
          monthWiseData: {
            $push: {
              month: "$_id.month",
              year: "$_id.year",
              packages: "$packages",
              revenue: "$revenue"
            }
          }
        }
      },
      { $sort: { totalPackages: -1, totalRevenue: -1, name: 1 } },
      { $limit: 5 }
    ]);
    
    // ------------------------------
    // DoctorStaff Leaderboard (same calculation as Sales Staff)
    // Uses PatientRegistration + paidAmount from Billing lookup
    // ------------------------------
    // Get doctorStaff names from users collection
    const doctorStaffUsers = await User.find(
      { 
        role: "doctorStaff",
        ...(user.role !== "admin" ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } : {})
      },
      { name: 1 }
    ).lean();
    const doctorStaffNames = doctorStaffUsers.map((u) => u.name).filter(Boolean);

    let doctorStaffAgg = [];
    if (doctorStaffNames.length > 0) {
      const doctorStaffPipeline = [
        { $match: user.role !== "admin" ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } : (selectedClinicId ? { clinicId: new mongoose.Types.ObjectId(String(selectedClinicId)) } : {}) },
        { $unwind: "$packages" },
        // Only count packages sold by doctorStaff
        { $match: { "packages.packageSoldBy": { $in: doctorStaffNames } } },
        // Lookup Billing records to get actual paid amounts (Package service only)
        {
          $lookup: {
            from: "billings",
            let: { patientId: "$_id", packageName: "$packages.packageName" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$patientId", "$$patientId"] },
                      { $eq: ["$package", "$$packageName"] },
                      { $eq: ["$service", "Package"] }
                    ]
                  }
                }
              },
              { $project: { paid: 1 } }
            ],
            as: "__billingRecords"
          }
        },
        // Calculate actual paid amount from Billing records
        {
          $addFields: {
            "packages.paidAmount": {
              $reduce: {
                input: "$__billingRecords",
                initialValue: 0,
                in: { $add: ["$$value", { $ifNull: ["$$this.paid", 0] }] }
              }
            }
          }
        },
        { $project: { __billingRecords: 0 } },
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
            _id: {
              soldBy: "$packages.packageSoldBy",
              month: { $month: "$packages.assignedDate" },
              year: { $year: "$packages.assignedDate" }
            },
            totalPackagesSold: { $sum: 1 },
            totalPaid: { $sum: { $ifNull: ["$packages.paidAmount", 0] } },
          }
        },
        {
          $group: {
            _id: "$_id.soldBy",
            totalPackagesSold: { $sum: "$totalPackagesSold" },
            totalPaid: { $sum: "$totalPaid" },
            monthWiseData: {
              $push: {
                month: "$_id.month",
                year: "$_id.year",
                totalPackagesSold: "$totalPackagesSold",
                totalPaid: "$totalPaid"
              }
            }
          }
        },
        { $sort: { totalPaid: -1, totalPackagesSold: -1, _id: 1 } }
      ];
      doctorStaffAgg = await PatientRegistration.aggregate(doctorStaffPipeline);
    }

    // Build doctor leaderboard: doctors (non-doctorStaff) from Billing aggregation
    const doctorStaffNameSet = new Set(doctorStaffNames);
    const doctorOnlyAgg = doctorPackageAgg.filter((doc) => {
      // Exclude doctorStaff entries - they will be sourced from PatientRegistration
      const docName = doc.name;
      return docName && !doctorStaffNameSet.has(docName);
    });
    
    // Map doctorStaff aggregation results to leaderboard format
    const doctorStaffLeaderboardData = doctorStaffAgg.map((staff) => ({
      name: staff._id,
      totalPackages: staff.totalPackagesSold || 0,
      totalRevenue: staff.totalPaid || 0,
      monthWiseData: (staff.monthWiseData || []).map((m) => ({
        month: m.month,
        year: m.year,
        packages: m.totalPackagesSold || 0,
        revenue: m.totalPaid || 0
      }))
    }));
    
    // Merge doctors and doctorStaff, sort, and limit to 5
    const combinedDoctorAgg = [...doctorOnlyAgg, ...doctorStaffLeaderboardData]
      .sort((a, b) => {
        const packagesDiff = (b.totalPackages || 0) - (a.totalPackages || 0);
        if (packagesDiff !== 0) return packagesDiff;
        return (b.totalRevenue || 0) - (a.totalRevenue || 0);
      })
      .slice(0, 5);
    
    const doctorLeaderboard = combinedDoctorAgg.map((doc, index) => ({
      rank: index + 1,
      initials: doc.name
        ? doc.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
        : "UD",
      name: doc.name,
      packages: doc.totalPackages,
      revenue: Math.round(Number(doc.totalRevenue || 0)),
      monthWiseData: doc.monthWiseData.map((m) => ({
        month: monthNames[m.month - 1],
        year: m.year,
        packages: m.packages,
        revenue: Math.round(Number(m.revenue || 0))
      }))
    }));

    // ------------------------------
    // Sales Staff Leaderboard - with month-wise data
    // ------------------------------
    // Sales Staff Leaderboard is sourced directly from the "Sold By" field
    // (`packages.packageSoldBy`), which captures the seller's name at package
    // creation time. This avoids relying on `packageSoldByUserId` (which is
    // frequently null) and the separate user lookup that left the leaderboard
    // without names.
    const salesStaffPipeline = [
      { $match: user.role !== "admin" ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } : (selectedClinicId ? { clinicId: new mongoose.Types.ObjectId(String(selectedClinicId)) } : {}) },
      { $unwind: "$packages" },
      // Only count packages that actually have a non-empty "Sold By" name.
      {
        $match: {
          $expr: {
            $gt: [
              { $trim: { input: { $ifNull: ["$packages.packageSoldBy", ""] } } },
              ""
            ]
          }
        }
      },
      // Lookup Billing records to get actual paid amounts.
      // PatientRegistration.paidAmount is not updated when billing payments are made,
      // so we calculate the real paid amount from Billing records.
      {
        $lookup: {
          from: "billings",
          let: { patientId: "$_id", packageName: "$packages.packageName" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$patientId", "$$patientId"] },
                    { $eq: ["$package", "$$packageName"] },
                    { $eq: ["$service", "Package"] }
                  ]
                }
              }
            },
            {
              $project: { paid: 1 }
            }
          ],
          as: "__billingRecords"
        }
      },
      // Calculate actual paid amount from Billing records
      {
        $addFields: {
          "packages.paidAmount": {
            $reduce: {
              input: "$__billingRecords",
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.paid", 0] }] }
            }
          }
        }
      },
      // Remove the temporary lookup field
      {
        $project: { __billingRecords: 0 }
      },
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
          _id: {
            soldBy: "$packages.packageSoldBy",
            month: { $month: "$packages.assignedDate" },
            year: { $year: "$packages.assignedDate" }
          },
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
        $group: {
          _id: "$_id.soldBy",
          totalPackagesSold: { $sum: "$totalPackagesSold" },
          totalRevenue: { $sum: "$totalRevenue" },
          totalPaid: { $sum: "$totalPaid" },
          totalPending: { $sum: "$totalPending" },
          paidPackages: { $sum: "$paidPackages" },
          partiallyPaidPackages: { $sum: "$partiallyPaidPackages" },
          unpaidPackages: { $sum: "$unpaidPackages" },
          monthWiseData: {
            $push: {
              month: "$_id.month",
              year: "$_id.year",
              totalPackagesSold: "$totalPackagesSold",
              totalRevenue: "$totalRevenue",
              totalPaid: "$totalPaid"
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
          // The seller name comes directly from the "Sold By" field captured
          // when the package was created — no user lookup required.
          staffId: "$_id",
          name: "$_id",
          totalPackagesSold: 1,
          totalRevenue: 1,
          totalPaid: 1,
          totalPending: 1,
          outstanding: "$totalPending",
          paidPackages: 1,
          partiallyPaidPackages: 1,
          unpaidPackages: 1,
          monthWiseData: 1
        }
      },
      // Rank by highest revenue first (packages sold as a tie-breaker). The
      // client applies the final Top 5 slice so no high-revenue seller is
      // dropped before ranking.
      { $sort: { totalRevenue: -1, totalPackagesSold: -1, name: 1 } }
    ];
    const salesStaffLeaderboard = await PatientRegistration.aggregate(salesStaffPipeline).then(result => 
      result.map(staff => ({
        ...staff,
        monthWiseData: staff.monthWiseData.map(m => ({
          month: monthNames[m.month - 1],
          year: m.year,
          totalPackagesSold: m.totalPackagesSold,
          totalRevenue: Math.round(Number(m.totalRevenue || 0)),
          totalPaid: Math.round(Number(m.totalPaid || 0))
        }))
      }))
    );

    // ------------------------------
    // Department Revenue Data
    // ------------------------------
    const departmentRevenueAgg = await Billing.aggregate([
      { $match: { $or: [monthSectionMatch, { ...monthSectionMatch, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
      // Only count packages with billing (paid > 0)
      { $match: { paid: { $gt: 0 } } },
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
          __packageName: {
            $cond: {
              if: { $eq: ["$service", "Treatment"] },
              then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
              else: "$package"
            }
          }
        },
      },
      {
        $group: {
          _id: { patientId: "$patientId", package: "$__packageName" },
          // Use paid amount directly. When pending is cleared via treatment pay,
          // Treatment billing's paid field contains the cash collected for the package.
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
      lifecycleSummary,
      doctorLeaderboard,
      salesStaffLeaderboard,
      departmentRevenueData
    });
  } catch (e) {
    console.error("package-performance error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch package performance" });
  }
}

import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";
import Billing from "../../../../models/Billing";

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
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "agent", "doctor", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
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

  try {
    const { startDate, endDate, page = "1", limit = "20", doctorId, departmentId, salesStaffId, clinicId: selectedClinicId, paymentMethod, getAll } = req.query;
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = getAll ? Number.MAX_SAFE_INTEGER : Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = getAll ? 0 : (pageNum - 1) * pageSize;

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

    // Helper: build the comprehensive effectiveDepartmentId pipeline stages
    // (service.departmentId -> treatmentServices[0].departmentId -> doctorDepartments[0].clinicDepartmentId)
    // Mirrors the logic in package-performance.js so both endpoints report consistent stats
    const buildDepartmentFilterStages = () => {
      if (!departmentId) return [];
      const deptObjId = new mongoose.Types.ObjectId(String(departmentId));
      return [
        {
          $lookup: {
            from: "doctordepartments",
            localField: "effectiveDoctorId",
            foreignField: "doctorId",
            as: "doctorDepartments",
          },
        },
        // Treatment names from selectedPackageTreatments or treatment field
        {
          $addFields: {
            __treatmentNames: {
              $cond: {
                if: {
                  $gt: [
                    { $size: { $ifNull: ["$selectedPackageTreatments", []] } },
                    0,
                  ],
                },
                then: "$selectedPackageTreatments.treatmentName",
                else: { $cond: { if: "$treatment", then: ["$treatment"], else: [] } },
              },
            },
          },
        },
        {
          $lookup: {
            from: "services",
            let: { tNames: "$__treatmentNames", clinicId: "$clinicId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$clinicId", "$$clinicId"] },
                      { $in: ["$name", "$$tNames"] },
                    ],
                  },
                },
              },
              { $project: { departmentId: 1, name: 1, _id: 0 } },
            ],
            as: "treatmentServices",
          },
        },
        {
          $addFields: {
            effectiveDepartmentId: {
              $ifNull: [
                "$service.departmentId",
                { $arrayElemAt: ["$treatmentServices.departmentId", 0] },
                { $arrayElemAt: ["$doctorDepartments.clinicDepartmentId", 0] },
                null,
              ],
            },
          },
        },
        {
          $match: { effectiveDepartmentId: deptObjId },
        },
      ];
    };

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
      // Lookup appointment's service (needed for service.departmentId)
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
      pipeline.push(...buildDepartmentFilterStages());
    }

    if (salesStaffId) {
      // Check if salesStaffId is a valid ObjectId or a name
      const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
      
      if (isValidObjectId) {
        // Match by user ID
        pipeline.push({
          $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) },
        });
      } else {
        // Match by user name (e.g., "xyz", "muskan")
        pipeline.push({
          $match: { invoicedBy: String(salesStaffId) },
        });
      }
    }

    pipeline.push(
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
        },
      },
      {
        $group: {
          _id: { patientId: "$patientId", package: "$package" },
          patientId: { $first: "$patientId" },
          packageName: { $first: "$package" },
          // Use amount - pendingUsed to exclude pending clearance for other services
          totalPaid: { $sum: { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }] } },
          totalPending: { $sum: { $ifNull: ["$pending", 0] } },
          sessionsUsed: { $sum: "$__usedSessions" },
          firstPurchaseDate: { $min: "$createdAt" },
          lastActivityDate: { $max: "$createdAt" },
          doctorIds: { $addToSet: "$effectiveDoctorId" },
          // Fields required by the Package Registry table columns (Staff, Branch, Dept)
          soldBy: { $first: "$invoicedBy" },
          clinicId: { $first: "$clinicId" },
          serviceId: { $first: "$appointment.serviceId" },
        },
      },
      // Resolve doctor names
      {
        $lookup: {
          from: "users",
          let: { dids: "$doctorIds" },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", { $ifNull: ["$$dids", []] }] },
              },
            },
            { $project: { _id: 1, name: 1, firstName: 1, lastName: 1 } },
          ],
          as: "doctors",
        },
      },
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      {
        $lookup: {
          from: "packages",
          localField: "packageName",
          foreignField: "name",
          as: "pkg",
        },
      },
      // Branch (clinic) name — Billing carries clinicId
      {
        $lookup: {
          from: "clinics",
          localField: "clinicId",
          foreignField: "_id",
          as: "clinic",
        },
      },
      // Department chain: appointment.serviceId -> service.departmentId -> department.name
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "serviceDoc",
        },
      },
      {
        $addFields: {
          departmentId: {
            $ifNull: [{ $arrayElemAt: ["$serviceDoc.departmentId", 0] }, null],
          },
          // Expiry date mirrors the summary pipeline logic
          // (pkg.endDate / pkg.validityInMonths / +1 year from first purchase)
          expirationDate: {
            $switch: {
              branches: [
                {
                  case: { $ne: [{ $ifNull: [{ $arrayElemAt: ["$pkg.endDate", 0] }, null] }, null] },
                  then: { $arrayElemAt: ["$pkg.endDate", 0] },
                },
                {
                  case: { $gt: [{ $ifNull: [{ $arrayElemAt: ["$pkg.validityInMonths", 0] }, 0] }, 0] },
                  then: {
                    $dateAdd: {
                      startDate: { $ifNull: ["$firstPurchaseDate", new Date()] },
                      unit: "month",
                      amount: { $arrayElemAt: ["$pkg.validityInMonths", 0] },
                    },
                  },
                },
              ],
              default: {
                $dateAdd: {
                  startDate: { $ifNull: ["$firstPurchaseDate", new Date()] },
                  unit: "year",
                  amount: 1,
                },
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "departmentId",
          foreignField: "_id",
          as: "department",
        },
      },
      {
        $project: {
          patientId: 1,
          packageName: 1,
          patientName: {
            $concat: [
              { $ifNull: [{ $arrayElemAt: ["$patient.firstName", 0] }, ""] },
              " ",
              { $ifNull: [{ $arrayElemAt: ["$patient.lastName", 0] }, ""] },
            ],
          },
          phone: { $ifNull: [{ $arrayElemAt: ["$patient.mobileNumber", 0] }, ""] },
          emrNumber: { $ifNull: [{ $arrayElemAt: ["$patient.emrNumber", 0] }, ""] },
          branch: { $ifNull: [{ $arrayElemAt: ["$clinic.name", 0] }, ""] },
          department: { $ifNull: [{ $arrayElemAt: ["$department.name", 0] }, ""] },
          soldBy: { $ifNull: ["$soldBy", ""] },
          totalValue: { $add: [{ $ifNull: ["$totalPaid", 0] }, { $ifNull: ["$totalPending", 0] }] },
          totalSessions: { $ifNull: [{ $arrayElemAt: ["$pkg.totalSessions", 0] }, 0] },
          sessionsUsed: 1,
          remainingSessions: {
            $max: [{ $subtract: [{ $ifNull: [{ $arrayElemAt: ["$pkg.totalSessions", 0] }, 0] }, "$sessionsUsed"] }, 0],
          },
          doctorNames: {
            $map: {
              input: "$doctors",
              as: "d",
              in: {
                $cond: [
                  { $ifNull: ["$$d.name", false] },
                  "$$d.name",
                  {
                    $trim: {
                      input: {
                        $concat: [
                          { $ifNull: ["$$d.firstName", ""] },
                          " ",
                          { $ifNull: ["$$d.lastName", ""] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          },
          paymentStatus: {
            $cond: [{ $gt: ["$totalPending", 0] }, "Partly Paid", "Paid"],
          },
          totalPaid: 1,
          totalPending: 1,
          firstPurchaseDate: 1,
          lastActivityDate: 1,
          expirationDate: 1,
        },
      },
      {
        $addFields: {
          doctorName: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$doctorNames", []] } }, 0] },
              { $reduce: { input: "$doctorNames", initialValue: "", in: { $cond: [{ $eq: ["$$value", ""] }, "$$this", { $concat: ["$$value", ", ", "$$this"] }] } } },
              "Unknown",
            ],
          },
        },
      },
      { $sort: { totalPaid: -1 } },
      { $skip: skip },
      { $limit: pageSize }
    );

    const rows = await Billing.aggregate(pipeline);
    
    // Debug logging
    console.log('DEBUG packages-sold rows:', {
      salesStaffId,
      rowsCount: rows?.length || 0,
      firstRow: rows?.[0] ? { packageName: rows[0].packageName, soldBy: rows[0].soldBy } : null
    });

    // For count, we need to apply the same filters
    const countPipeline = [
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
        $lookup: {
          from: "services",
          localField: "appointment.serviceId",
          foreignField: "_id",
          as: "service",
        },
      },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          effectiveDoctorId: {
            $ifNull: ["$doctorId", "$appointment.doctorId"]
          }
        }
      }
    ];

    if (doctorId) {
      countPipeline.push({
        $match: { effectiveDoctorId: new mongoose.Types.ObjectId(String(doctorId)) },
      });
    }

    if (departmentId) {
      countPipeline.push(...buildDepartmentFilterStages());
    }

    if (salesStaffId) {
      // Check if salesStaffId is a valid ObjectId or a name
      const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
      
      if (isValidObjectId) {
        countPipeline.push({
          $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) },
        });
      } else {
        countPipeline.push({
          $match: { invoicedBy: String(salesStaffId) },
        });
      }
    }

    countPipeline.push(
      {
        $group: {
          _id: { patientId: "$patientId", package: "$package" },
        },
      },
      { $count: "total" }
    );

    const countAgg = await Billing.aggregate(countPipeline);
    const total = countAgg?.[0]?.count || 0;
    
    // Debug logging for count
    console.log('DEBUG packages-sold count:', { salesStaffId, total, countAggLength: countAgg?.length });

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
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
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

    // Helper function to build summary pipeline for a given match
    const buildSummaryPipeline = (matchObj) => {
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      const sevenDaysFromNow = new Date(todayStart);
      sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
      const thirtyDaysFromNow = new Date(todayStart);
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      
      // Build sales staff filter (ObjectId or name)
      const summarySalesStaffFilter = salesStaffId ? (() => {
        const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
        return isValidObjectId 
          ? { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) }
          : { invoicedBy: String(salesStaffId) };
      })() : null;
      
      return [
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
          }
        },
        ...(doctorId ? [{ $match: { effectiveDoctorId: new mongoose.Types.ObjectId(String(doctorId)) } }] : []),
        ...(departmentId ? buildDepartmentFilterStages() : []),
        ...(salesStaffId ? (() => {
          const isValidObjectId = mongoose.Types.ObjectId.isValid(salesStaffId) && String(salesStaffId).length === 24;
          return isValidObjectId 
            ? [{ $match: { invoicedById: new mongoose.Types.ObjectId(String(salesStaffId)) } }]
            : [{ $match: { invoicedBy: String(salesStaffId) } }];
        })() : []),
        {
          $group: {
            _id: { patientId: "$patientId", package: "$package" },
            // Use amount - pendingUsed to exclude pending clearance for other services
            totalPaid: { $sum: { $subtract: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }] } },
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
          }
        },
        {
          $addFields: {
            // Calculate expiration date
            expirationDate: {
              $switch: {
                branches: [
                  // Case 1: Package has explicit endDate
                  {
                    case: { $ne: ["$pkgData.endDate", null] },
                    then: "$pkgData.endDate"
                  },
                  // Case 2: Package has validityInMonths, use firstPurchaseDate + validity
                  {
                    case: { $gt: [{ $ifNull: ["$pkgData.validityInMonths", 0] }, 0] },
                    then: {
                      $dateAdd: {
                        startDate: "$firstPurchaseDate",
                        unit: "month",
                        amount: "$pkgData.validityInMonths"
                      }
                    }
                  }
                ],
                // Default: No expiration or 1 year default
                default: {
                  $dateAdd: {
                    startDate: "$firstPurchaseDate",
                    unit: "year",
                    amount: 1
                  }
                }
              }
            }
          }
        },
        {
          $addFields: {
            isExpired: { $lt: ["$expirationDate", todayStart] },
            isExpiringIn7Days: {
              $and: [
                { $gte: ["$expirationDate", todayStart] },
                { $lte: ["$expirationDate", sevenDaysFromNow] }
              ]
            },
            isExpiringIn30Days: {
              $and: [
                { $gt: ["$expirationDate", sevenDaysFromNow] },
                { $lte: ["$expirationDate", thirtyDaysFromNow] }
              ]
            },
            // Renewal opportunity: expired or expiring in 30 days
            isRenewalOpportunity: {
              $or: [
                { $lt: ["$expirationDate", thirtyDaysFromNow] },
                { $gte: ["$sessionsUsed", "$totalSessions"] }
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            totalPackagesSold: { $sum: 1 },
            totalPaid: { $sum: "$totalPaid" },
            totalPending: { $sum: "$totalPending" },
            totalSessions: { $sum: "$totalSessions" },
            totalUsedSessions: { $sum: "$sessionsUsed" },
            paidPackages: { $sum: { $cond: [{ $lte: ["$totalPending", 0] }, 1, 0] } },
            partiallyPaid: { $sum: { $cond: [{ $and: [{ $gt: ["$totalPending", 0] }, { $gt: ["$totalPaid", 0] }] }, 1, 0] } },
            unpaidPackages: { $sum: { $cond: [{ $lte: ["$totalPaid", 0] }, 1, 0] } },
            activePackages: { $sum: { $cond: [{ $and: [{ $gt: ["$sessionsUsed", 0] }, { $lt: ["$sessionsUsed", "$totalSessions"] }] }, 1, 0] } },
            completedPackages: { $sum: { $cond: [{ $gte: ["$sessionsUsed", "$totalSessions"] }, 1, 0] } },
            unusedPackages: { $sum: { $cond: [{ $lte: ["$sessionsUsed", 0] }, 1, 0] } },
            expiredPackages: { $sum: { $cond: ["$isExpired", 1, 0] } },
            expiring7Days: { $sum: { $cond: ["$isExpiringIn7Days", 1, 0] } },
            expiring30Days: { $sum: { $cond: ["$isExpiringIn30Days", 1, 0] } },
            renewalOpportunities: { $sum: { $cond: ["$isRenewalOpportunity", 1, 0] } },
          },
        },
      ];
    };

    const summaryPipeline = buildSummaryPipeline(match);
    const previousSummaryPipeline = buildSummaryPipeline(previousMatch);

    const summaryAgg = await Billing.aggregate(summaryPipeline);
    const previousSummaryAgg = await Billing.aggregate(previousSummaryPipeline);
    const summary = summaryAgg?.[0] || {
      totalPackagesSold: 0,
      totalPaid: 0,
      totalPending: 0,
      totalSessions: 0,
      totalUsedSessions: 0,
      paidPackages: 0,
      partiallyPaid: 0,
      unpaidPackages: 0,
      activePackages: 0,
      completedPackages: 0,
      unusedPackages: 0,
      expiredPackages: 0,
      expiring7Days: 0,
      expiring30Days: 0,
      renewalOpportunities: 0,
    };
    const previousSummary = previousSummaryAgg?.[0] || {
      totalPackagesSold: 0,
      totalPaid: 0,
      totalPending: 0,
      totalSessions: 0,
      totalUsedSessions: 0,
      paidPackages: 0,
      partiallyPaid: 0,
      unpaidPackages: 0,
      activePackages: 0,
      completedPackages: 0,
      unusedPackages: 0,
      expiredPackages: 0,
      expiring7Days: 0,
      expiring30Days: 0,
      renewalOpportunities: 0,
    };

    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    return res.status(200).json({
      success: true,
      data: rows,
      summary,
      previousSummary,
      pagination: { page: pageNum, pageSize, total, totalPages, hasNext: skip + rows.length < total },
    });
  } catch (e) {
    console.error("packages-sold error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch packages sold" });
  }
}

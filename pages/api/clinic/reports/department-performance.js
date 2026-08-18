import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import {
  getClinicIdFromUser,
  checkClinicPermission,
} from "../../lead-ms/permissions-helper";
import Billing from "../../../../models/Billing";
import mongoose from "mongoose";
import Appointment from "../../../../models/Appointment";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Database connection failed" });
  }

  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (
      !["clinic", "agent", "doctor", "doctorStaff", "staff", "admin"].includes(
        user.role,
      )
    ) {
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
  const { hasPermission } = await checkClinicPermission(
    clinicId,
    moduleKey,
    "read",
  );
  if (!hasPermission) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view reports",
    });
  }

  try {
    const { startDate, endDate, top = "3" } = req.query;
    const topN = Math.max(1, Math.min(10, parseInt(top, 10) || 3));

    // End date = end-of-day to include records on the last day
    const endDateEod = endDate
      ? new Date(
          new Date(endDate).getFullYear(),
          new Date(endDate).getMonth(),
          new Date(endDate).getDate(),
          23,
          59,
          59,
          999,
        )
      : null;

    const match = {
      $or: [
        { service: { $in: ["Treatment", "Service"] } },
        // EDGE-CASE FIX: Include Package billings with selectedTreatments (mixed billings)
        // This ensures Revenue by Department shows treatment revenue for mixed billings
        {
          service: "Package",
          selectedTreatments: { $exists: true, $ne: null, $ne: [] },
        },
      ],
    };
    if (user.role !== "admin") {
      match.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (req.query.clinicId) {
      match.clinicId = new mongoose.Types.ObjectId(String(req.query.clinicId));
    }
    if (startDate || endDateEod) {
      match.invoicedDate = {};
      if (startDate) match.invoicedDate.$gte = new Date(startDate);
      if (endDateEod) match.invoicedDate.$lte = endDateEod;
      if (Object.keys(match.invoicedDate).length === 0)
        delete match.invoicedDate;
    }

    const buildResolvedServiceRevenuePipeline = () => [
      { $match: match },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appt",
        },
      },
      { $unwind: { path: "$appt", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "services",
          let: {
            sId: "$appt.serviceId",
            sIds: { $ifNull: ["$appt.serviceIds", []] },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$_id", "$$sId"] },
                    { $in: ["$_id", "$$sIds"] },
                  ],
                },
              },
            },
            { $project: { _id: 1, name: 1, departmentId: 1 } },
          ],
          as: "apptServices",
        },
      },
      {
        $unwind: {
          path: "$selectedTreatments",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "services",
          let: {
            treatmentServiceId: "$selectedTreatments.treatmentServiceId",
            treatmentName: "$selectedTreatments.treatmentName",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: [{ $toString: "$_id" }, "$$treatmentServiceId"] },
                    { $eq: ["$name", "$$treatmentName"] },
                  ],
                },
              },
            },
            { $project: { _id: 1, name: 1, departmentId: 1 } },
          ],
          as: "treatmentServiceDoc",
        },
      },
      {
        $addFields: {
          appointmentServiceName: {
            $arrayElemAt: [
              {
                $map: {
                  input: {
                    $filter: {
                      input: "$apptServices",
                      as: "apptService",
                      cond: {
                        $and: [
                          { $ne: ["$$apptService.name", null] },
                          { $ne: ["$$apptService.name", ""] },
                        ],
                      },
                    },
                  },
                  as: "apptService",
                  in: "$$apptService.name",
                },
              },
              0,
            ],
          },
          appointmentDepartmentId: {
            $arrayElemAt: [
              {
                $map: {
                  input: {
                    $filter: {
                      input: "$apptServices",
                      as: "apptService",
                      cond: { $ne: ["$$apptService.departmentId", null] },
                    },
                  },
                  as: "apptService",
                  in: "$$apptService.departmentId",
                },
              },
              0,
            ],
          },
          // EDGE-CASE FIX: For Treatment/Service billings with unpaidPackagesPaid,
          // subtract pendingUsed from paid because the payment was for the package,
          // not the treatment. This prevents the treatment from showing revenue
          // when only the package pending was cleared.
          effectivePaid: {
            $cond: [
              {
                $and: [
                  { $in: ["$service", ["Treatment", "Service"]] },
                  { $gt: [{ $size: { $ifNull: ["$unpaidPackagesPaid", []] } }, 0] },
                  { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                ],
              },
              // Treatment/Service with unpaidPackagesPaid: subtract pendingUsed
              { $subtract: [
                { $ifNull: ["$paid", 0] },
                { $ifNull: ["$pendingUsed", 0] }
              ] },
              // All other billings: use paid as-is
              { $ifNull: ["$paid", 0] }
            ]
          },
          invoiceTotalForAllocation: {
            $cond: [
              { $gt: [{ $ifNull: ["$originalAmount", 0] }, 0] },
              { $ifNull: ["$originalAmount", 0] },
              {
                $cond: [
                  { $gt: [{ $ifNull: ["$amount", 0] }, 0] },
                  { $ifNull: ["$amount", 0] },
                  1,
                ],
              },
            ],
          },
          selectedTreatmentLineValue: {
            $multiply: [
              { $ifNull: ["$selectedTreatments.price", 0] },
              { $ifNull: ["$selectedTreatments.quantity", 1] },
            ],
          },
        },
      },
      {
        $addFields: {
          resolvedServiceName: {
            $cond: [
              { $ne: ["$selectedTreatments", null] },
              {
                $ifNull: [
                  { $arrayElemAt: ["$treatmentServiceDoc.name", 0] },
                  "$selectedTreatments.treatmentName",
                ],
              },
              {
                $cond: [
                  {
                    $and: [
                      { $ne: [{ $ifNull: ["$package", ""] }, ""] },
                      {
                        $ne: [{ $ifNull: ["$appointmentServiceName", ""] }, ""],
                      },
                    ],
                  },
                  "$appointmentServiceName",
                  { $ifNull: ["$treatment", "$appointmentServiceName"] },
                ],
              },
            ],
          },
          effectiveLineRevenue: {
            $cond: [
              { $ne: ["$selectedTreatments", null] },
              {
                $cond: [
                  { $gt: ["$invoiceTotalForAllocation", 0] },
                  {
                    $multiply: [
                      // EDGE-CASE FIX: Use effectivePaid (with pendingUsed subtracted)
                      // instead of paid to prevent treatment from showing revenue
                      // when only the package pending was cleared.
                      { $ifNull: ["$effectivePaid", 0] },
                      {
                        $divide: [
                          { $ifNull: ["$selectedTreatmentLineValue", 0] },
                          "$invoiceTotalForAllocation",
                        ],
                      },
                    ],
                  },
                  0,
                ],
              },
              { $ifNull: ["$effectivePaid", 0] },
            ],
          },
          effectiveLinePrice: {
            $cond: [
              { $ne: ["$selectedTreatments", null] },
              { $ifNull: ["$selectedTreatmentLineValue", 0] },
              { $ifNull: ["$amount", 0] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "services",
          let: { cId: "$clinicId", sName: "$resolvedServiceName" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$clinicId", "$$cId"] },
                    { $eq: ["$name", "$$sName"] },
                  ],
                },
              },
            },
            { $project: { departmentId: 1, name: 1 } },
          ],
          as: "serviceDoc",
        },
      },
      {
        $addFields: {
          resolvedDepartmentId: {
            $ifNull: [
              { $arrayElemAt: ["$treatmentServiceDoc.departmentId", 0] },
              "$appointmentDepartmentId",
              { $arrayElemAt: ["$serviceDoc.departmentId", 0] },
              null,
            ],
          },
        },
      },
      {
        $match: {
          resolvedDepartmentId: { $ne: null },
          resolvedServiceName: { $exists: true, $nin: [null, "", "Unknown"] },
        },
      },
      {
        $group: {
          _id: {
            departmentId: "$resolvedDepartmentId",
            serviceName: "$resolvedServiceName",
          },
          totalRevenue: { $sum: "$effectiveLineRevenue" },
          totalBookings: { $sum: 1 },
          avgPrice: { $avg: "$effectiveLinePrice" },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "_id.departmentId",
          foreignField: "_id",
          as: "dept",
        },
      },
      {
        $project: {
          departmentId: "$_id.departmentId",
          departmentName: {
            $ifNull: [{ $arrayElemAt: ["$dept.name", 0] }, "Unassigned"],
          },
          serviceName: "$_id.serviceName",
          totalRevenue: 1,
          totalBookings: 1,
          avgPrice: 1,
        },
      },
    ];

    const serviceRevenueRows = await Billing.aggregate(
      buildResolvedServiceRevenuePipeline(),
    );

    const departmentsMap = new Map();
    const servicesByDepartment = {};

    serviceRevenueRows.forEach((row) => {
      const deptId = row.departmentId ? String(row.departmentId) : "";
      const deptName = row.departmentName || "Unassigned";

      if (!servicesByDepartment[deptId]) {
        servicesByDepartment[deptId] = [];
      }
      servicesByDepartment[deptId].push({
        serviceName: row.serviceName,
        totalRevenue: row.totalRevenue || 0,
        totalBookings: row.totalBookings || 0,
        avgPrice: row.avgPrice || 0,
      });

      if (!departmentsMap.has(deptId)) {
        departmentsMap.set(deptId, {
          departmentId: row.departmentId || null,
          departmentName: deptName,
          totalRevenue: 0,
          totalBookings: 0,
          avgPriceTotal: 0,
          avgPriceCount: 0,
        });
      }

      const departmentEntry = departmentsMap.get(deptId);
      departmentEntry.totalRevenue += row.totalRevenue || 0;
      departmentEntry.totalBookings += row.totalBookings || 0;
      departmentEntry.avgPriceTotal += row.avgPrice || 0;
      departmentEntry.avgPriceCount += 1;
    });

    Object.keys(servicesByDepartment).forEach((deptId) => {
      servicesByDepartment[deptId] = servicesByDepartment[deptId].sort(
        (a, b) => b.totalRevenue - a.totalRevenue,
      );
    });

    const departments = Array.from(departmentsMap.values())
      .map((department) => ({
        departmentId: department.departmentId,
        departmentName: department.departmentName,
        totalRevenue: department.totalRevenue,
        totalBookings: department.totalBookings,
        avgPrice: department.avgPriceCount
          ? department.avgPriceTotal / department.avgPriceCount
          : 0,
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    // DEBUG: Log details of any billings that resolved to "Unassigned" department
    try {
      const unassignedBillingsDebug = await Billing.aggregate([
        { $match: match },
        {
          $lookup: {
            from: "appointments",
            localField: "appointmentId",
            foreignField: "_id",
            as: "appt",
          },
        },
        { $unwind: { path: "$appt", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "services",
            let: {
              sId: "$appt.serviceId",
              sIds: { $ifNull: ["$appt.serviceIds", []] },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: ["$_id", "$$sId"] },
                      { $in: ["$_id", "$$sIds"] },
                    ],
                  },
                },
              },
              { $project: { _id: 1, name: 1, departmentId: 1 } },
            ],
            as: "apptServices",
          },
        },
        {
          $unwind: {
            path: "$selectedTreatments",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $lookup: {
            from: "services",
            let: {
              treatmentServiceId: "$selectedTreatments.treatmentServiceId",
              treatmentName: "$selectedTreatments.treatmentName",
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $or: [
                      { $eq: [{ $toString: "$_id" }, "$$treatmentServiceId"] },
                      { $eq: ["$name", "$$treatmentName"] },
                    ],
                  },
                },
              },
              { $project: { _id: 1, name: 1, departmentId: 1 } },
            ],
            as: "treatmentServiceDoc",
          },
        },
        {
          $lookup: {
            from: "services",
            let: { cId: "$clinicId", sName: "$treatment" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$clinicId", "$$cId"] },
                      { $eq: ["$name", "$$sName"] },
                    ],
                  },
                },
              },
              { $project: { departmentId: 1, name: 1 } },
            ],
            as: "serviceDoc",
          },
        },
        {
          $addFields: {
            resolvedDepartmentId: {
              $ifNull: [
                { $arrayElemAt: ["$treatmentServiceDoc.departmentId", 0] },
                {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: {
                          $map: {
                            input: "$apptServices",
                            as: "asvc",
                            in: "$$asvc.departmentId",
                          },
                        },
                        as: "deptId",
                        cond: { $ne: ["$$deptId", null] },
                      },
                    },
                    0,
                  ],
                },
                { $arrayElemAt: ["$serviceDoc.departmentId", 0] },
                null,
              ],
            },
          },
        },
        { $match: { resolvedDepartmentId: null } },
        {
          $project: {
            _id: 1,
            invoiceNumber: 1,
            treatment: 1,
            service: 1,
            appointmentId: 1,
            "appt.serviceId": 1,
            "appt.serviceIds": 1,
            selectedTreatments: 1,
          },
        },
      ]);
      console.log("==================================================");
      console.log(
        `[DEBUG] Found ${unassignedBillingsDebug.length} billings resolving to Unassigned Department:`,
      );
      console.log(JSON.stringify(unassignedBillingsDebug, null, 2));
      console.log("==================================================");
    } catch (dbgErr) {
      console.error("[DEBUG] Error running unassigned debugging log:", dbgErr);
    }

    // Identify top departments
    const topDepartments = departments.slice(0, topN);

    // Top 5 services across ALL departments (for the pie chart)
    const topServicesAllAgg = [...serviceRevenueRows]
      .sort((a, b) => (b.totalRevenue || 0) - (a.totalRevenue || 0))
      .slice(0, 5)
      .map((row) => ({
        serviceName: row.serviceName,
        totalRevenue: row.totalRevenue || 0,
        totalBookings: row.totalBookings || 0,
        averagePrice: row.avgPrice || 0,
      }));

    // Aggregation for appointments by department
    const appointmentMatch = {};
    if (user.role !== "admin") {
      appointmentMatch.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (req.query.clinicId) {
      appointmentMatch.clinicId = new mongoose.Types.ObjectId(
        String(req.query.clinicId),
      );
    }
    if (startDate || endDateEod) {
      appointmentMatch.startDate = {};
      if (startDate) appointmentMatch.startDate.$gte = new Date(startDate);
      if (endDateEod) appointmentMatch.startDate.$lte = endDateEod;
      if (Object.keys(appointmentMatch.startDate).length === 0)
        delete appointmentMatch.startDate;
    }

    const appointmentPipeline = [
      { $match: appointmentMatch },
      {
        $lookup: {
          from: "services",
          localField: "serviceId",
          foreignField: "_id",
          as: "serviceInfo",
        },
      },
      { $unwind: { path: "$serviceInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "services",
          localField: "serviceIds",
          foreignField: "_id",
          as: "servicesFromIds",
        },
      },
      {
        $lookup: {
          from: "services",
          localField: "services.serviceId",
          foreignField: "_id",
          as: "servicesFromItems",
        },
      },
      {
        $lookup: {
          from: "doctordepartments",
          localField: "doctorId",
          foreignField: "doctorId",
          as: "doctorDepartments",
        },
      },
      {
        $lookup: {
          from: "billings",
          let: { appointmentId: "$_id", clinicId: "$clinicId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$appointmentId", "$$appointmentId"] },
                    { $eq: ["$clinicId", "$$clinicId"] },
                  ],
                },
              },
            },
            {
              $project: {
                selectedTreatments: 1,
                treatment: 1,
              },
            },
          ],
          as: "appointmentBillings",
        },
      },
      {
        $addFields: {
          billingTreatmentServiceIds: {
            $reduce: {
              input: { $ifNull: ["$appointmentBillings", []] },
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: { $ifNull: ["$$this.selectedTreatments", []] },
                          as: "selectedTreatment",
                          cond: {
                            $and: [
                              {
                                $ne: [
                                  "$$selectedTreatment.treatmentServiceId",
                                  null,
                                ],
                              },
                              {
                                $ne: [
                                  "$$selectedTreatment.treatmentServiceId",
                                  "",
                                ],
                              },
                            ],
                          },
                        },
                      },
                      as: "selectedTreatment",
                      in: {
                        $convert: {
                          input: "$$selectedTreatment.treatmentServiceId",
                          to: "objectId",
                          onError: null,
                          onNull: null,
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
          billingTreatmentNames: {
            $reduce: {
              input: { $ifNull: ["$appointmentBillings", []] },
              initialValue: [],
              in: {
                $concatArrays: [
                  "$$value",
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: { $ifNull: ["$$this.selectedTreatments", []] },
                          as: "selectedTreatment",
                          cond: {
                            $and: [
                              {
                                $ne: [
                                  "$$selectedTreatment.treatmentName",
                                  null,
                                ],
                              },
                              {
                                $ne: ["$$selectedTreatment.treatmentName", ""],
                              },
                            ],
                          },
                        },
                      },
                      as: "selectedTreatment",
                      in: "$$selectedTreatment.treatmentName",
                    },
                  },
                  {
                    $cond: [
                      {
                        $and: [
                          { $ne: ["$$this.treatment", null] },
                          { $ne: ["$$this.treatment", ""] },
                        ],
                      },
                      {
                        $map: {
                          input: { $split: ["$$this.treatment", ","] },
                          as: "billingTreatmentName",
                          in: { $trim: { input: "$$billingTreatmentName" } },
                        },
                      },
                      [],
                    ],
                  },
                ],
              },
            },
          },
        },
      },
      {
        $lookup: {
          from: "services",
          let: {
            serviceIds: {
              $filter: {
                input: { $ifNull: ["$billingTreatmentServiceIds", []] },
                as: "serviceId",
                cond: { $ne: ["$$serviceId", null] },
              },
            },
          },
          pipeline: [
            {
              $match: {
                $expr: { $in: ["$_id", "$$serviceIds"] },
              },
            },
            {
              $project: {
                departmentId: 1,
              },
            },
          ],
          as: "servicesFromBillings",
        },
      },
      {
        $lookup: {
          from: "services",
          let: {
            treatmentNames: {
              $filter: {
                input: { $ifNull: ["$billingTreatmentNames", []] },
                as: "treatmentName",
                cond: {
                  $and: [
                    { $ne: ["$$treatmentName", null] },
                    { $ne: ["$$treatmentName", ""] },
                  ],
                },
              },
            },
            clinicId: "$clinicId",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$clinicId", "$$clinicId"] },
                    { $in: ["$name", "$$treatmentNames"] },
                  ],
                },
              },
            },
            {
              $project: {
                departmentId: 1,
              },
            },
          ],
          as: "servicesFromBillingNames",
        },
      },
      {
        $addFields: {
          effectiveDepartmentId: {
            $ifNull: [
              "$serviceInfo.departmentId",
              { $arrayElemAt: ["$servicesFromIds.departmentId", 0] },
              { $arrayElemAt: ["$servicesFromItems.departmentId", 0] },
              { $arrayElemAt: ["$servicesFromBillings.departmentId", 0] },
              { $arrayElemAt: ["$servicesFromBillingNames.departmentId", 0] },
              { $arrayElemAt: ["$doctorDepartments.clinicDepartmentId", 0] },
              null,
            ],
          },
        },
      },
      {
        $match: {
          effectiveDepartmentId: { $ne: null },
        },
      },
      {
        $group: {
          _id: "$effectiveDepartmentId",
          totalAppointments: { $sum: 1 },
        },
      },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "deptInfo",
        },
      },
      {
        $project: {
          departmentId: "$_id",
          departmentName: { $arrayElemAt: ["$deptInfo.name", 0] },
          totalAppointments: 1,
        },
      },
      { $match: { departmentName: { $exists: true, $ne: null, $ne: "" } } },
      { $sort: { totalAppointments: -1 } },
    ];

    const appointmentsByDept = await Appointment.aggregate(appointmentPipeline);

    return res.status(200).json({
      success: true,
      data: {
        departments,
        topDepartments,
        servicesByDepartment,
        appointmentsByDept,
        topServicesAll: topServicesAllAgg,
      },
    });
  } catch (error) {
    console.error("department-performance error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate department performance",
    });
  }
}

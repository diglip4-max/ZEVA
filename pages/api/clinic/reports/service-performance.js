import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import Billing from "../../../../models/Billing";
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

  const { departmentId, sortBy = "revenue", startDate, endDate } = req.query;
  const hasDepartment = departmentId && mongoose.Types.ObjectId.isValid(departmentId);

  try {
    // Find all services of this department for this clinic (only when departmentId is provided)
    let serviceNames = [];
    if (hasDepartment) {
      const svcQuery = { departmentId: new mongoose.Types.ObjectId(departmentId) };
      if (user.role !== "admin") {
        svcQuery.clinicId = new mongoose.Types.ObjectId(String(clinicId));
      } else if (req.query.clinicId) {
        svcQuery.clinicId = new mongoose.Types.ObjectId(String(req.query.clinicId));
      }
      const services = await Service.find(svcQuery).select("name clinicId").lean();
      serviceNames = services.map((s) => s.name);
    }
    const clinicObjectId =
      user.role === "admin" && req.query.clinicId
        ? new mongoose.Types.ObjectId(String(req.query.clinicId))
        : new mongoose.Types.ObjectId(String(clinicId));

    // End date = end-of-day
    const endDateEod = endDate
      ? new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth(), new Date(endDate).getDate(), 23, 59, 59, 999)
      : null;

    // Aggregate billings (Treatment + Service). When departmentId is provided,
    // filter to services belonging to that department; otherwise return all services.
    const match = {
      $or: [
        { service: { $in: ["Treatment", "Service"] } },
        // EDGE-CASE FIX: Include Package billings with selectedTreatments (mixed billings)
        // This ensures Service Performance shows treatment revenue for mixed billings
        {
          service: "Package",
          selectedTreatments: { $exists: true, $ne: null, $ne: [] },
        },
      ],
      clinicId: clinicObjectId,
    };
    if (hasDepartment) {
      if (serviceNames.length) {
        match.$or = [
          { treatment: { $in: serviceNames } },
          { service: "Service" }, // Service billings filtered by department via appointment lookup below
        ];
      } else {
        match.treatment = { $in: ["__none__"] };
      }
    }
    if (startDate || endDateEod) {
      match.invoicedDate = {};
      if (startDate) match.invoicedDate.$gte = new Date(startDate);
      if (endDateEod) match.invoicedDate.$lte = endDateEod;
      if (Object.keys(match.invoicedDate).length === 0) delete match.invoicedDate;
    }

    const data = await Billing.aggregate([
      { $match: match },
      // EDGE-CASE FIX: Exclude pure clearance billings to prevent showing
      // clearance billings with empty service names in the report
      {
        $addFields: {
          isPureClearance: {
            $cond: [
              {
                $and: [
                  { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                  { $eq: ["$amount", "$pendingUsed"] },
                ],
              },
              true,
              false,
            ],
          },
        },
      },
      { $match: { isPureClearance: false } },
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
          localField: "appt.serviceId",
          foreignField: "_id",
          as: "apptSvc",
        },
      },
      { $unwind: { path: "$apptSvc", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          resolvedServiceName: {
            $ifNull: ["$treatment", { $ifNull: ["$apptSvc.name", "Unknown"] }],
          },
          apptDeptId: "$apptSvc.departmentId",
          // EDGE-CASE FIX: For Treatment/Service billings with unpaidPackagesPaid,
          // subtract pendingUsed from paid because the payment was for the package,
          // not the treatment. This prevents the treatment from showing revenue
          // when only the package pending was cleared.
          // For Package billings with selectedTreatments (mixed billings), use
          // proportional scaling to calculate treatment revenue.
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
              {
                $subtract: [
                  { $ifNull: ["$paid", 0] },
                  { $ifNull: ["$pendingUsed", 0] }
                ]
              },
              // Nested $cond for Package billing with selectedTreatments
              {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$service", "Package"] },
                      { $gt: [{ $size: { $ifNull: ["$selectedTreatments", []] } }, 0] },
                    ],
                  },
                  // Package billing with selectedTreatments: use proportional scaling
                  {
                    $multiply: [
                      { $ifNull: ["$paid", 0] },
                      {
                        $divide: [
                          {
                            $multiply: [
                              { $ifNull: [{ $arrayElemAt: ["$selectedTreatments.price", 0] }, 0] },
                              { $ifNull: [{ $arrayElemAt: ["$selectedTreatments.quantity", 0] }, 1] }
                            ]
                          },
                          { $ifNull: ["$originalAmount", "$amount", 1] }
                        ]
                      }
                    ]
                  },
                  // All other billings: use paid as-is
                  { $ifNull: ["$paid", 0] }
                ]
              }
            ]
          },
        },
      },
      // When departmentId is provided, keep only services that match this department
      // (by name for Treatment, or by departmentId for Service via appointment lookup)
      ...(hasDepartment
        ? [{
          $match: {
            $expr: {
              $or: [
                { $in: ["$resolvedServiceName", serviceNames.length ? serviceNames : ["__none__"]] },
                { $eq: ["$apptDeptId", new mongoose.Types.ObjectId(departmentId)] },
              ],
            },
          },
        }]
        : []),
      {
        $group: {
          _id: "$resolvedServiceName",
          // EDGE-CASE FIX: Use effectivePaid (with pendingUsed subtracted)
          // instead of paid to prevent treatment from showing revenue
          // when only the package pending was cleared.
          totalRevenue: { $sum: { $ifNull: ["$effectivePaid", 0] } },
          totalBookings: { $sum: 1 },
          averagePrice: { $avg: { $ifNull: ["$amount", 0] } },
        },
      },
      {
        $project: {
          serviceName: "$_id",
          totalRevenue: 1,
          totalBookings: 1,
          averagePrice: 1,
        },
      },
    ]);

    let sortFn;
    if (sortBy === "bookings") {
      sortFn = (a, b) => b.totalBookings - a.totalBookings;
    } else {
      sortFn = (a, b) => b.totalRevenue - a.totalRevenue;
    }

    const sorted = data.sort(sortFn);

    return res.status(200).json({
      success: true,
      data: sorted,
    });
  } catch (error) {
    console.error("service-performance error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch service performance" });
  }
}

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
      service: { $in: ["Treatment", "Service"] },
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
          totalRevenue: { $sum: { $ifNull: ["$paid", 0] } },
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

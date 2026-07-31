import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";
import PatientRegistration from "../../../../models/PatientRegistration";

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
    const { startDate, endDate } = req.query;

    // Build clinic match
    const match = {};
    if (user.role !== "admin") {
      match.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (req.query.clinicId) {
      match.clinicId = new mongoose.Types.ObjectId(String(req.query.clinicId));
    }

    // Normalize dates to local start-of-day / end-of-day
    const startAt = startDate
      ? new Date(new Date(startDate).getFullYear(), new Date(startDate).getMonth(), new Date(startDate).getDate(), 0, 0, 0, 0)
      : null;
    const endAt = endDate
      ? new Date(new Date(endDate).getFullYear(), new Date(endDate).getMonth(), new Date(endDate).getDate(), 23, 59, 59, 999)
      : null;

    // Get current date for expiry calculations
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysFromToday = new Date(today);
    sevenDaysFromToday.setDate(today.getDate() + 7);
    const thirtyDaysFromToday = new Date(today);
    thirtyDaysFromToday.setDate(today.getDate() + 30);

    // Build pipeline to get all patient packages
    const pipeline = [
      { $match: match },
      { $unwind: "$packages" },
      // Only consider packages that have a price set (actual purchased packages)
      { $match: { "packages.totalPrice": { $gt: 0 } } },
      // Date range filter on assignedDate (only if dates provided)
      ...(startAt || endAt
        ? [
            {
              $match: {
                "packages.assignedDate": {
                  ...(startAt ? { $gte: startAt } : {}),
                  ...(endAt ? { $lte: endAt } : {}),
                },
              },
            },
          ]
        : []),
      // Resolve package template to get totalSessions
      {
        $lookup: {
          from: "packages",
          localField: "packages.packageId",
          foreignField: "_id",
          as: "pkgTemplate",
        },
      },
      {
        $addFields: {
          "packages.__totalSessions": { $arrayElemAt: ["$pkgTemplate.totalSessions", 0] },
        },
      },
      // Calculate effective endDate: use package endDate, or assignedDate + validityInMonths, or assignedDate + 1 year
      {
        $addFields: {
          "packages.__effectiveEndDate": {
            $switch: {
              branches: [
                {
                  case: { $ne: ["$packages.endDate", null] },
                  then: "$packages.endDate",
                },
                {
                  case: { $gt: [{ $ifNull: ["$packages.validityInMonths", 0] }, 0] },
                  then: {
                    $dateAdd: {
                      startDate: { $ifNull: ["$packages.assignedDate", new Date()] },
                      unit: "month",
                      amount: "$packages.validityInMonths",
                    },
                  },
                },
              ],
              default: {
                $dateAdd: {
                  startDate: { $ifNull: ["$packages.assignedDate", new Date()] },
                  unit: "year",
                  amount: 1,
                },
              },
            },
          },
        },
      },
      // Calculate remaining sessions
      {
        $addFields: {
          "packages.__remainingSessions": {
            $max: [
              {
                $subtract: [
                  { $ifNull: ["$packages.__totalSessions", 0] },
                  { $ifNull: ["$packages.sessionsUsed", 0] },
                ],
              },
              0,
            ],
          },
        },
      },
      {
        $group: {
          _id: {
            patientId: "$_id",
            packageName: "$packages.packageName",
          },
          patientId: { $first: "$_id" },
          firstName: { $first: "$firstName" },
          lastName: { $first: "$lastName" },
          mobileNumber: { $first: "$mobileNumber" },
          emrNumber: { $first: "$emrNumber" },
          packageName: { $first: "$packages.packageName" },
          totalPrice: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
          paidAmount: { $sum: { $ifNull: ["$packages.paidAmount", 0] } },
          paymentStatus: { $first: "$packages.paymentStatus" },
          assignedDate: { $min: "$packages.assignedDate" },
          effectiveEndDate: { $first: "$packages.__effectiveEndDate" },
          totalSessions: { $first: "$packages.__totalSessions" },
          sessionsUsed: { $sum: { $ifNull: ["$packages.sessionsUsed", 0] } },
          remainingSessions: { $first: "$packages.__remainingSessions" },
          packageSoldBy: { $first: "$packages.packageSoldBy" },
        },
      },
    ];

    const patientPackages = await PatientRegistration.aggregate(pipeline);

    // Calculate expiry KPIs
    let activeCount = 0;
    let expiredCount = 0;
    let expiring7DaysCount = 0;
    let expiring30DaysCount = 0;

    // Collect detail data for each KPI
    const activePackages = [];
    const expiredPackages = [];
    const expiring7DaysPackages = [];
    const expiring30DaysPackages = [];

    for (const pkg of patientPackages) {
      const endDate = pkg.effectiveEndDate ? new Date(pkg.effectiveEndDate) : null;
      if (endDate) {
        endDate.setHours(0, 0, 0, 0);
      }

      const patientName = `${pkg.firstName || ""} ${pkg.lastName || ""}`.trim();
      const detailItem = {
        packageName: pkg.packageName || "Unknown",
        patientName: patientName || "Unknown Patient",
        amount: pkg.totalPrice || 0,
        paidAmount: pkg.paidAmount || 0,
        expirationDate: endDate ? endDate.toISOString() : null,
        date: pkg.assignedDate,
        paymentStatus: pkg.paymentStatus || "Unknown",
        remainingSessions: pkg.remainingSessions || 0,
        totalSessions: pkg.totalSessions || 0,
        sessionsUsed: pkg.sessionsUsed || 0,
      };

      if (!endDate) {
        // No end date - treat as active
        activeCount++;
        activePackages.push(detailItem);
        continue;
      }

      if (endDate <= today) {
        // Expired
        expiredCount++;
        expiredPackages.push(detailItem);
      } else if (endDate <= sevenDaysFromToday) {
        // Expiring in 7 days
        expiring7DaysCount++;
        expiring7DaysPackages.push(detailItem);
        // Also counts as active
        activeCount++;
        activePackages.push(detailItem);
      } else if (endDate <= thirtyDaysFromToday) {
        // Expiring in 30 days
        expiring30DaysCount++;
        expiring30DaysPackages.push(detailItem);
        // Also counts as active
        activeCount++;
        activePackages.push(detailItem);
      } else {
        // Active (not expiring soon)
        activeCount++;
        activePackages.push(detailItem);
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        activePackages: activeCount,
        expiredPackages: expiredCount,
        expiring7Days: expiring7DaysCount,
        expiring30Days: expiring30DaysCount,
        renewalOpportunities: expiring7DaysCount + expiring30DaysCount,
        // Detail data for modals
        activePackagesData: activePackages,
        expiredPackagesData: expiredPackages,
        expiring7DaysData: expiring7DaysPackages,
        expiring30DaysData: expiring30DaysPackages,
      },
    });
  } catch (e) {
    console.error("package-expiry error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch package expiry data" });
  }
}

import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";
import PatientRegistration from "../../../../models/PatientRegistration";
import Billing from "../../../../models/Billing";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed",
    });
  }

  try {
    await dbConnect();
  } catch {
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
    });
  }

  let user;

  try {
    user = await getUserFromReq(req);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (
      !["clinic", "agent", "doctor", "doctorStaff", "staff", "admin"].includes(
        user.role
      )
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid token",
    });
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(user);

  if (clinicError && user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: clinicError,
    });
  }

  const moduleKey = "clinic_reporting";

  const { hasPermission } = await checkClinicPermission(
    clinicId,
    moduleKey,
    "read"
  );

  if (!hasPermission) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view reports",
    });
  }

  const { startDate, endDate, limit = "10" } = req.query;

  const lim = Math.max(1, Math.min(1000, parseInt(limit, 10) || 10));

  try {
    const match = {};

    if (user.role !== "admin") {
      match.clinicId = new mongoose.Types.ObjectId(String(clinicId));
    } else if (req.query.clinicId) {
      match.clinicId = new mongoose.Types.ObjectId(
        String(req.query.clinicId)
      );
    }

    const startAt = startDate
      ? new Date(
          new Date(startDate).getFullYear(),
          new Date(startDate).getMonth(),
          new Date(startDate).getDate(),
          0,
          0,
          0,
          0
        )
      : null;

    const endAt = endDate
      ? new Date(
          new Date(endDate).getFullYear(),
          new Date(endDate).getMonth(),
          new Date(endDate).getDate(),
          23,
          59,
          59,
          999
        )
      : null;

    // Step 1: Get all Billing records for packages (and Treatment with unpaidPackagesPaid)
    const billingMatch = { ...match, service: "Package" };
    if (startAt || endAt) {
      billingMatch.invoicedDate = {};
      if (startAt) billingMatch.invoicedDate.$gte = startAt;
      if (endAt) billingMatch.invoicedDate.$lte = endAt;
    }

    const billingPipeline = [
      { $match: { $or: [billingMatch, { ...billingMatch, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
      // Extract package name for Treatment billings
      {
        $addFields: {
          __packageName: {
            $cond: {
              if: { $eq: ["$service", "Treatment"] },
              then: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
              else: "$package"
            }
          },
          __patientId: "$patientId"
        }
      },
      // First group by patientId + packageName only to avoid double counting
      {
        $group: {
          _id: {
            patientId: "$__patientId",
            packageName: "$__packageName"
          },
          totalPaidForPackage: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } },
          totalPendingForPackage: { $sum: { $cond: { if: { $eq: ["$service", "Package"] }, then: { $ifNull: ["$pending", 0] }, else: 0 } } },
          totalAmountForPackage: { $first: { $cond: { if: { $eq: ["$service", "Package"] }, then: { $ifNull: ["$amount", 0] }, else: 0 } } },
          firstInvoicedDate: { $min: "$invoicedDate" }
        }
      },
      // Now look up PatientRegistration
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: "$_id.patientId", packageName: "$_id.packageName" },
          pipeline: [
            { $match: { $expr: { $eq: ["$_id", "$$patientId"] } } },
            { $unwind: "$packages" },
            { $match: { $expr: { $eq: ["$packages.packageName", "$$packageName"] } } },
            { $limit: 1 },
            { $project: { "packages.packageSoldBy": 1, "packages.packageSoldByUserId": 1, "packages.totalPrice": 1, "packages.paidAmount": 1 } }
          ],
          as: "__patientReg"
        }
      },
      { $unwind: { path: "$__patientReg", preserveNullAndEmptyArrays: true } },
      // Now calculate final fields
      {
        $addFields: {
          soldBy: { $ifNull: ["$__patientReg.packages.packageSoldBy", ""] },
          totalAmount: { $ifNull: [
            { $cond: { if: { $ne: ["$totalAmountForPackage", 0] }, then: "$totalAmountForPackage", else: "$__patientReg.packages.totalPrice" } },
            0
          ] },
          totalPaid: { $ifNull: [
            { $cond: { if: { $ne: ["$__patientReg.packages.paidAmount", null] }, then: "$__patientReg.packages.paidAmount", else: "$totalPaidForPackage" } },
            "$totalPaidForPackage"
          ] },
          totalPending: { $subtract: [
            { $ifNull: [
              { $cond: { if: { $ne: ["$totalAmountForPackage", 0] }, then: "$totalAmountForPackage", else: "$__patientReg.packages.totalPrice" } },
              0
            ] },
            { $ifNull: [
              { $cond: { if: { $ne: ["$__patientReg.packages.paidAmount", null] }, then: "$__patientReg.packages.paidAmount", else: "$totalPaidForPackage" } },
              "$totalPaidForPackage"
            ] }
          ] }
        }
      },
      // Now group by soldBy
      {
        $group: {
          _id: "$soldBy",
          totalPackagesSold: { $sum: 1 },
          totalRevenue: { $sum: "$totalAmount" },
          totalPaid: { $sum: "$totalPaid" },
          totalPending: { $sum: "$totalPending" },
          paidPackages: {
            $sum: {
              $cond: [
                { $lte: ["$totalPending", 0] },
                1,
                0
              ]
            }
          },
          partiallyPaidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$totalPending", 0] }, { $gt: ["$totalPaid", 0] }] },
                1,
                0
              ]
            }
          },
          unpaidPackages: {
            $sum: {
              $cond: [
                { $lte: ["$totalPaid", 0] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
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
        }
      }
    ];

    const billingLeaderboard = await Billing.aggregate(billingPipeline);

    // Step 2: Get PatientRegistration data (for packages without billing records)
    const prPipeline = [
      { $match: match },
      { $unwind: "$packages" },
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
      // Only consider packages that have a price
      { $match: { "packages.totalPrice": { $gt: 0 } } },
      {
        $group: {
          _id: {
            patientId: "$_id",
            packageName: "$packages.packageName",
            soldBy: "$packages.packageSoldBy"
          },
          totalPrice: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
          paidAmount: { $sum: { $ifNull: ["$packages.paidAmount", 0] } }
        }
      },
      {
        $group: {
          _id: "$_id.soldBy",
          totalPackagesSold: { $sum: 1 },
          totalRevenue: { $sum: "$totalPrice" },
          totalPaid: { $sum: "$paidAmount" },
          totalPending: { $sum: { $subtract: ["$totalPrice", "$paidAmount"] } },
          paidPackages: {
            $sum: {
              $cond: [
                { $gte: ["$paidAmount", "$totalPrice"] },
                1,
                0
              ]
            }
          },
          partiallyPaidPackages: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ["$paidAmount", 0] }, { $lt: ["$paidAmount", "$totalPrice"] }] },
                1,
                0
              ]
            }
          },
          unpaidPackages: {
            $sum: {
              $cond: [
                { $eq: ["$paidAmount", 0] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $project: {
          _id: 0,
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
        }
      }
    ];

    const prLeaderboard = await PatientRegistration.aggregate(prPipeline);

    // Step 3: Merge Billing and PatientRegistration data, avoiding duplicates by (patientId + packageName)
    // First, get a list of all (patientId + packageName) pairs from Billing to avoid duplicates in PR
    const billingKeys = new Set();
    const billingKeyPipeline = [
      { $match: { $or: [billingMatch, { ...billingMatch, service: "Treatment", "unpaidPackagesPaid.0": { $exists: true } }] } },
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
          _id: { patientId: "$patientId", packageName: "$__packageName" }
        }
      }
    ];
    const billingKeyResults = await Billing.aggregate(billingKeyPipeline);
    billingKeyResults.forEach(k => billingKeys.add(`${String(k._id.patientId)}__${String(k._id.packageName)}`));

    // Now, process PR data to exclude packages already in Billing
    const prUniquePipeline = [
      { $match: match },
      { $unwind: "$packages" },
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
      { $match: { "packages.totalPrice": { $gt: 0 } } },
      {
        $group: {
          _id: {
            patientId: "$_id",
            packageName: "$packages.packageName",
            soldBy: "$packages.packageSoldBy"
          },
          totalPrice: { $sum: { $ifNull: ["$packages.totalPrice", 0] } },
          paidAmount: { $sum: { $ifNull: ["$packages.paidAmount", 0] } }
        }
      },
      {
        $group: {
          _id: "$_id.soldBy",
          packages: {
            $push: {
              patientId: "$_id.patientId",
              packageName: "$_id.packageName",
              totalPrice: "$totalPrice",
              paidAmount: "$paidAmount"
            }
          }
        }
      }
    ];

    const prUniqueResults = await PatientRegistration.aggregate(prUniquePipeline);

    // Now build the unique PR leaderboard
    const prUniqueLeaderboard = [];
    prUniqueResults.forEach(staff => {
      const uniquePackages = staff.packages.filter(p => !billingKeys.has(`${String(p.patientId)}__${String(p.packageName)}`));
      if (uniquePackages.length > 0) {
        prUniqueLeaderboard.push({
          staffId: staff._id,
          name: staff._id,
          totalPackagesSold: uniquePackages.length,
          totalRevenue: uniquePackages.reduce((sum, p) => sum + p.totalPrice, 0),
          totalPaid: uniquePackages.reduce((sum, p) => sum + p.paidAmount, 0),
          totalPending: uniquePackages.reduce((sum, p) => sum + (p.totalPrice - p.paidAmount), 0),
          paidPackages: uniquePackages.filter(p => p.paidAmount >= p.totalPrice).length,
          partiallyPaidPackages: uniquePackages.filter(p => p.paidAmount > 0 && p.paidAmount < p.totalPrice).length,
          unpaidPackages: uniquePackages.filter(p => p.paidAmount === 0).length,
          outstanding: uniquePackages.reduce((sum, p) => sum + (p.totalPrice - p.paidAmount), 0)
        });
      }
    });

    // Now merge billingLeaderboard and prUniqueLeaderboard
    const mergedMap = new Map();

    // Add billing data first
    billingLeaderboard.forEach(item => {
      mergedMap.set(item.staffId || "", { ...item });
    });

    // Add PR data, merging with existing
    prUniqueLeaderboard.forEach(item => {
      const key = item.staffId || "";
      if (mergedMap.has(key)) {
        const existing = mergedMap.get(key);
        mergedMap.set(key, {
          ...existing,
          totalPackagesSold: existing.totalPackagesSold + item.totalPackagesSold,
          totalRevenue: existing.totalRevenue + item.totalRevenue,
          totalPaid: existing.totalPaid + item.totalPaid,
          totalPending: existing.totalPending + item.totalPending,
          paidPackages: existing.paidPackages + item.paidPackages,
          partiallyPaidPackages: existing.partiallyPaidPackages + item.partiallyPaidPackages,
          unpaidPackages: existing.unpaidPackages + item.unpaidPackages,
          outstanding: existing.outstanding + item.outstanding
        });
      } else {
        mergedMap.set(key, { ...item });
      }
    });

    // Convert map to array
    let leaderboard = Array.from(mergedMap.values()).filter(item => item.name && item.name.trim() !== "");

    // Sort and limit
    leaderboard = leaderboard.sort((a, b) => b.totalPackagesSold - a.totalPackagesSold).slice(0, lim);

    // Add fallback if empty
    const leaderboardWithFallback =
      leaderboard.length > 0
        ? leaderboard
        : [
            {
              staffId: null,
              name: "Unknown Sales Staff",
              totalPackagesSold: 0,
              totalRevenue: 0,
              totalPaid: 0,
              totalPending: 0,
              outstanding: 0,
              paidPackages: 0,
              partiallyPaidPackages: 0,
              unpaidPackages: 0,
            },
          ];

    return res.status(200).json({
      success: true,
      data: leaderboardWithFallback,
    });
  } catch (error) {
    console.error("sales-staff-performance error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch sales staff performance",
    });
  }
}

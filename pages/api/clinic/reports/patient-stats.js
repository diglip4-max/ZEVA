import dbConnect from "../../../../lib/database";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
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

  const parseDate = (v) => {
    const val = Array.isArray(v) ? v[0] : v;
    if (!val || val === "undefined" || val === "null") return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  };
  const qStart = parseDate(req.query.startDate);
  const qEnd = parseDate(req.query.endDate);
  const targetClinicId =
    user.role !== "admin"
      ? new mongoose.Types.ObjectId(String(clinicId))
      : req.query.clinicId
      ? new mongoose.Types.ObjectId(String(req.query.clinicId))
      : null;

  try {
    const matchApt = {};
    if (targetClinicId) matchApt.clinicId = targetClinicId;
    if (qStart || qEnd) {
      matchApt.startDate = {};
      if (qStart) matchApt.startDate.$gte = qStart;
      if (qEnd) matchApt.startDate.$lte = qEnd;
      if (!Object.keys(matchApt.startDate).length) delete matchApt.startDate;
    }

    const matchBilling = {};
    if (targetClinicId) matchBilling.clinicId = targetClinicId;
    if (qStart || qEnd) {
      matchBilling.invoicedDate = {};
      if (qStart) matchBilling.invoicedDate.$gte = qStart;
      if (qEnd) matchBilling.invoicedDate.$lte = qEnd;
      if (!Object.keys(matchBilling.invoicedDate).length) delete matchBilling.invoicedDate;
    }

    const [aptAgg, billingAgg, membershipAgg] = await Promise.all([
      mongoose.connection.collection("appointments").aggregate([
        { $match: matchApt },
        {
          $facet: {
            topVisited: [
              { $group: { _id: "$patientId", visits: { $sum: 1 } } },
              { $sort: { visits: -1 } },
              {
                $lookup: {
                  from: "patientregistrations",
                  localField: "_id",
                  foreignField: "_id",
                  as: "p",
                },
              },
              {
                $project: {
                  patientId: "$_id",
                  visits: 1,
                  patientName: {
                    $let: {
                      vars: { pr: { $arrayElemAt: ["$p", 0] } },
                      in: {
                        $trim: {
                          input: {
                            $concat: [
                              { $ifNull: ["$$pr.firstName", ""] },
                              " ",
                              { $ifNull: ["$$pr.lastName", ""] },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            uniquePatients: [{ $group: { _id: "$patientId" } }, { $count: "count" }],
            previousApts: qStart
              ? [
                  { $match: { startDate: { $lt: qStart }, ...(targetClinicId ? { clinicId: targetClinicId } : {}) } },
                  { $group: { _id: "$patientId" } },
                  { $project: { _id: 1 } },
                ]
              : [{ $limit: 0 }],
          },
        },
      ]).toArray(),
      mongoose.connection.collection("billings").aggregate([
        { $match: matchBilling },
        {
          $facet: {
            revenueByPatient: [
              { $group: { _id: "$patientId", revenue: { $sum: { $ifNull: ["$paid", 0] } } } },
              { $sort: { revenue: -1 } },
              {
                $lookup: {
                  from: "patientregistrations",
                  localField: "_id",
                  foreignField: "_id",
                  as: "p",
                },
              },
              {
                $project: {
                  patientId: "$_id",
                  revenue: 1,
                  patientName: {
                    $let: {
                      vars: { pr: { $arrayElemAt: ["$p", 0] } },
                      in: {
                        $trim: {
                          input: {
                            $concat: [
                              { $ifNull: ["$$pr.firstName", ""] },
                              " ",
                              { $ifNull: ["$$pr.lastName", ""] },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            packageByPatient: [
              { $match: { service: "Package" } },
              { $group: { _id: "$patientId", revenue: { $sum: { $ifNull: ["$paid", 0] } }, count: { $sum: 1 } } },
              { $sort: { revenue: -1 } },
              {
                $lookup: {
                  from: "patientregistrations",
                  localField: "_id",
                  foreignField: "_id",
                  as: "p",
                },
              },
              {
                $project: {
                  patientId: "$_id",
                  revenue: 1,
                  count: 1,
                  patientName: {
                    $let: {
                      vars: { pr: { $arrayElemAt: ["$p", 0] } },
                      in: {
                        $trim: {
                          input: {
                            $concat: [
                              { $ifNull: ["$$pr.firstName", ""] },
                              " ",
                              { $ifNull: ["$$pr.lastName", ""] },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            highestPending: [
              { $group: { _id: "$patientId", pending: { $sum: { $ifNull: ["$pending", 0] } } } },
              { $sort: { pending: -1 } },
              {
                $lookup: {
                  from: "patientregistrations",
                  localField: "_id",
                  foreignField: "_id",
                  as: "p",
                },
              },
              {
                $project: {
                  patientId: "$_id",
                  pending: 1,
                  patientName: {
                    $let: {
                      vars: { pr: { $arrayElemAt: ["$p", 0] } },
                      in: {
                        $trim: {
                          input: {
                            $concat: [
                              { $ifNull: ["$$pr.firstName", ""] },
                              " ",
                              { $ifNull: ["$$pr.lastName", ""] },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
            highestAdvance: [
              { $group: { _id: "$patientId", advance: { $sum: { $ifNull: ["$advance", 0] } } } },
              { $sort: { advance: -1 } },
              {
                $lookup: {
                  from: "patientregistrations",
                  localField: "_id",
                  foreignField: "_id",
                  as: "p",
                },
              },
              {
                $project: {
                  patientId: "$_id",
                  advance: 1,
                  patientName: {
                    $let: {
                      vars: { pr: { $arrayElemAt: ["$p", 0] } },
                      in: {
                        $trim: {
                          input: {
                            $concat: [
                              { $ifNull: ["$$pr.firstName", ""] },
                              " ",
                              { $ifNull: ["$$pr.lastName", ""] },
                            ],
                          },
                        },
                      },
                    },
                  },
                },
              },
            ],
          },
        },
      ]).toArray(),
      mongoose.connection.collection("patientregistrations").aggregate([
        { $unwind: { path: "$memberships", preserveNullAndEmptyArrays: true } },
        ...(qEnd ? [{ $match: { "memberships.startDate": { $lte: qEnd } } }] : []),
        ...(qStart ? [{ $match: { $or: [{ "memberships.endDate": null }, { "memberships.endDate": { $gte: qStart } }] } }] : []),
        {
          $lookup: {
            from: "membershipplans",
            localField: "memberships.membershipId",
            foreignField: "_id",
            as: "plan",
          },
        },
        { $unwind: { path: "$plan", preserveNullAndEmptyArrays: true } },
        ...(targetClinicId ? [{ $match: { "plan.clinicId": targetClinicId } }] : []),
        {
          $group: {
            _id: "$_id",
            membershipRevenue: { $sum: { $ifNull: ["$plan.price", 0] } },
            count: { $sum: 1 },
            patientId: { $first: "$_id" },
            firstName: { $first: "$firstName" },
            lastName: { $first: "$lastName" },
          },
        },
        {
          $project: {
            patientId: 1,
            membershipRevenue: 1,
            count: 1,
            patientName: {
              $trim: { input: { $concat: [{ $ifNull: ["$firstName", "" ] }, " ", { $ifNull: ["$lastName", ""] }] } },
            },
          },
        },
        { $sort: { membershipRevenue: -1 } },
      ]).toArray(),
    ]);

    const aptOut = aptAgg[0] || {};
    const billingOut = billingAgg[0] || {};
    const topVisited = aptOut.topVisited || [];
    const uniquePatients = aptOut.uniquePatients?.[0]?.count || 0;
    const previousSet = new Set((aptOut.previousApts || []).map((x) => String(x._id)));

    const newPatientsCount = topVisited.filter((p) => !previousSet.has(String(p.patientId))).length;
    const returningPatientsCount = topVisited.filter((p) => previousSet.has(String(p.patientId))).length;

    const membershipByPatient = membershipAgg || [];

    return res.status(200).json({
      success: true,
      data: {
        topVisited,
        membershipByPatient,
        packageByPatient: billingOut.packageByPatient || [],
        highestPending: billingOut.highestPending || [],
        highestAdvance: billingOut.highestAdvance || [],
        revenueByPatient: billingOut.revenueByPatient || [],
        summary: {
          totalPatients: uniquePatients,
          newPatients: newPatientsCount,
          returningPatients: returningPatientsCount,
        },
      },
    });
  } catch (e) {
    console.error("patient-stats error:", e);
    return res.status(500).json({ success: false, message: "Failed to fetch patient stats" });
  }
}

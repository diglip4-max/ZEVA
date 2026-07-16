import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import Appointment from "../../../../models/Appointment";
import Service from "../../../../models/Service";
import Department from "../../../../models/Department";
import User from "../../../../models/Users";
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

  let me;
  try {
    me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(me);
  if (clinicError && me.role !== "admin") {
    return res.status(403).json({ success: false, message: clinicError });
  }

  const { hasPermission } = await checkClinicPermission(clinicId, "clinic_reporting", "read");
  if (!hasPermission) {
    return res.status(403).json({ success: false, message: "You do not have permission to view reports" });
  }

  const {
    startDate,
    endDate,
    doctorId,
    departmentId,
    serviceId,
    view,
    paymentsPage,
    paymentsPageSize,
    pendingType,
    pendingPage,
    pendingPageSize,
  } = req.query;

  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();
  const startAt = new Date(start);
  startAt.setHours(0, 0, 0, 0);
  const endAt = new Date(end);
  endAt.setHours(23, 59, 59, 999);

  const clinicMatch = clinicId ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } : {};
  const dateMatch = { invoicedDate: { $gte: startAt, $lte: endAt } };
  const pageNum = Math.max(1, parseInt(paymentsPage || "1", 10));
  const pageSizeNum = Math.max(1, parseInt(paymentsPageSize || "10", 10));
  const skipNum = (pageNum - 1) * pageSizeNum;

  try {
    const basePipeline = [
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: "$appointment" },
    ];

    if (doctorId) {
      basePipeline.push({
        $match: { "appointment.doctorId": new mongoose.Types.ObjectId(String(doctorId)) },
      });
    }
    if (serviceId) {
      basePipeline.push({
        $match: { "appointment.serviceId": new mongoose.Types.ObjectId(String(serviceId)) },
      });
    }

    // ─────────────────────────────────────────────────────────────────────
    // CLEARANCE BILLING EXCLUSION (shared across aggregations)
    // ─────────────────────────────────────────────────────────────────────
    // A "clearance billing" is the secondary billing created when a patient
    // pays off a previously-pending amount. The original billing's `paid`
    // is also incremented by the same amount (so the original billing now
    // reflects the full settlement). The clearance billing's own `paid`
    // must therefore be EXCLUDED from the simple sum-based aggregations
    // (totalRevenue, paymentsAgg, revenueTrend, payment reports) to
    // prevent double-counting.
    //
    // A "mixed billing" (e.g. a Package billing that ALSO clears a pending
    // from a different invoice) has its own service/package AND a
    // pendingClearedBreakdown pointing to another invoice. These must NOT
    // be excluded — they are real revenue. Instead, the breakdown amount
    // is subtracted from their `paid` in the aggregation so the cleared
    // slice is not double-counted (it's already in the original billing).
    //
    // Identification rule:
    //   Include the billing if ANY of these is true:
    //     1. No breakdown at all (null / missing / empty array)
    //     2. Breakdown's first invoiceNumber matches this billing's own
    //        invoiceNumber → this IS the original billing
    //     3. Billing has its own treatment (non-empty) → real treatment billing
    //     4. Billing has its own package (non-empty) → real package billing
    //   Otherwise (breakdown points elsewhere AND no treatment/package)
    //   → pure clearance billing → exclude.
    const excludeClearanceMatch = {
      $expr: {
        $or: [
          // No breakdown at all (null / missing / empty array)
          {
            $lte: [
              { $size: { $ifNull: ["$pendingClearedBreakdown", []] } },
              0,
            ],
          },
          // Breakdown exists but its first invoiceNumber matches this
          // billing's own invoiceNumber → this IS the original billing,
          // not a clearance billing.
          {
            $eq: [
              "$invoiceNumber",
              { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] },
            ],
          },
          // Billing has its own treatment (non-empty) → real treatment
          // billing, not a pure clearance billing.
          {
            $and: [
              { $ne: ["$treatment", null] },
              { $ne: ["$treatment", ""] },
            ],
          },
          // Billing has its own package (non-empty) → real package
          // billing, not a pure clearance billing.
          {
            $and: [
              { $ne: ["$package", null] },
              { $ne: ["$package", ""] },
            ],
          },
        ],
      },
    };

    // total revenue is computed at the end as treatmentRevenue + packageRevenue
    // (excludes advance payments and pending cleared amounts from the sum).
    let totalRevenue = 0;

    // revenue component: package billing (all Package billings, minus any
    // cleared Treatment/Service amounts from their pendingClearedBreakdown).
    // For "mixed billings" (Package billing that ALSO clears a pending from a
    // different invoice's Treatment/Service), the cleared amount is attributed
    // to Treatment/Service revenue (see treatmentRevenueAgg), so we subtract
    // it here to prevent double-counting.
    const packageRevenueAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch, service: "Package" } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $add: [
                { $ifNull: ["$paid", 0] },
                { $ifNull: ["$advanceUsed", 0] },
                { $ifNull: ["$claimAmountUsed", 0] },
                { $ifNull: ["$cashbackWalletUsed", 0] },
                // Subtract cleared Treatment/Service amounts from breakdowns
                // (they are counted in treatmentRevenueAgg instead).
                {
                  $cond: [
                    {
                      $and: [
                        { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                        { $eq: [{ $arrayElemAt: ["$pendingClearedBreakdown.service", 0] }, "Treatment"] },
                      ],
                    },
                    { $multiply: [-1, { $ifNull: [{ $arrayElemAt: ["$pendingClearedBreakdown.amountCleared", 0] }, 0] }] },
                    0,
                  ],
                },
              ],
            },
          },
        },
      },
    ]);
    const packageRevenue = Math.round(Number(packageRevenueAgg[0]?.total || 0));

    // revenue component: advance-only payments
    const advanceRevenueAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch, isAdvanceOnly: true } },
      { $group: { _id: null, total: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$advanceUsed", 0] }, { $ifNull: ["$claimAmountUsed", 0] }, { $ifNull: ["$cashbackWalletUsed", 0] } ] } } } },
    ]);
    const advanceRevenue = Math.round(Number(advanceRevenueAgg[0]?.total || 0));

    // revenue component: pending cleared (pendingUsed + pendingClaimUsed across all billings)
    const pendingClearedAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $add: [
                { $ifNull: ["$pendingUsed", 0] },
                { $ifNull: ["$pendingClaimUsed", 0] },
              ],
            },
          },
        },
      },
    ]);
    const pendingCleared = Math.round(Number(pendingClearedAgg[0]?.total || 0));

    // revenue component: treatment/service (breakdown-aware).
    // Treatment/Service billings contribute their full paid amount. Package
    // billings do NOT contribute their full paid (that goes to packageRevenue);
    // instead, only the cleared Treatment/Service amounts from their
    // pendingClearedBreakdown contribute here. This prevents the package
    // amount from being double-counted in both Treatment/Service and Package
    // revenue.
    const treatmentRevenueAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
      // Unwind pendingClearedBreakdown (preserveNullAndEmptyArrays so billings
      // without a breakdown keep flowing through the pipeline).
      {
        $unwind: {
          path: "$pendingClearedBreakdown",
          preserveNullAndEmptyArrays: true,
        },
      },
      // Derive effective amount per row:
      //   - Cleared item with Treatment/Service breakdown: amountCleared
      //   - Non-cleared item, billing is Treatment/Service: full paid
      //   - Non-cleared item, billing is Package: 0
      //   - Cleared item with Package breakdown: 0
      //   (Note: matches byServiceAgg which also includes "Service" in its
      //   $match filter, so the breakdown-aware cleared amount is counted
      //   consistently in both the Treatment/Service summary and the per-
      //   service breakdown.)
      {
        $addFields: {
          isClearedItem: { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
          isTreatmentBreakdown: {
            $in: [
              { $ifNull: ["$pendingClearedBreakdown.service", null] },
              ["Treatment", "Service"],
            ],
          },
          effectiveTreatmentAmount: {
            $cond: [
              {
                $and: [
                  "$isClearedItem",
                  "$isTreatmentBreakdown",
                ],
              },
              { $ifNull: ["$pendingClearedBreakdown.amountCleared", 0] },
              {
                $cond: [
                  {
                    $and: [
                      { $not: "$isClearedItem" },
                      { $in: [{ $ifNull: ["$service", null] }, ["Treatment", "Service"]] },
                    ],
                  },
                  {
                    $add: [
                      { $ifNull: ["$paid", 0] },
                      { $ifNull: ["$advanceUsed", 0] },
                      { $ifNull: ["$claimAmountUsed", 0] },
                      { $ifNull: ["$cashbackWalletUsed", 0] },
                    ],
                  },
                  0,
                ],
              },
            ],
          },
        },
      },
      // Exclude "Advance Payment" rows – advance usage is already included
      // in the parent service billing's amount. Showing it separately would
      // double-count and cause Treatment/Service total to exceed Revenue by Service.
      {
        $match: {
          $expr: {
            $or: [
              // Non-cleared items: exclude if treatment name is "Advance Payment"
              {
                $and: [
                  { $eq: ["$isClearedItem", false] },
                  { $ne: ["$treatment", "Advance Payment"] },
                ],
              },
              // Cleared items: exclude if breakdown treatmentName is "Advance Payment"
              {
                $and: [
                  { $eq: ["$isClearedItem", true] },
                  { $ne: [{ $ifNull: ["$pendingClearedBreakdown.treatmentName", null] }, "Advance Payment"] },
                ],
              },
            ],
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$effectiveTreatmentAmount" } } },
    ]);
    const treatmentRevenue = Math.round(Number(treatmentRevenueAgg[0]?.total || 0));

    // Total Revenue = Treatment/Service + Package Billing (excludes advance
    // payments and pending cleared amounts from the sum).
    totalRevenue = treatmentRevenue + packageRevenue;

    // revenue by doctor. Uses pendingClearedBreakdown so cleared amounts are
    // attributed to the ORIGINAL billing's doctor (looked up by invoiceNumber),
    // not the clearance billing's appointment doctor. For "mixed billings"
    // (Package billings that ALSO clear a pending from a different invoice),
    // the cleared amount is attributed to the original doctor and the
    // package's own portion (paid - cleared) is attributed to the billing's
    // own doctor – both are needed so the total revenue by doctor matches the
    // total revenue (700 = 500 + 200).
    const byDoctorAgg = await Billing.aggregate([
      ...basePipeline,
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient"
        }
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      // $facet to split the billings into two streams so we can produce
      // TWO rows for mixed billings: one for the cleared amount (attributed
      // to the original billing's doctor) and one for the package portion
      // (attributed to the billing's own doctor).
      {
        $facet: {
          // Stream 1: cleared items – one row per breakdown item, attributed
          // to the ORIGINAL billing's doctor with amount = amountCleared.
          cleared: [
            // Only billings WITH a breakdown
            {
              $match: {
                $expr: {
                  $gt: [
                    { $size: { $ifNull: ["$pendingClearedBreakdown", []] } },
                    0,
                  ],
                },
              },
            },
            { $unwind: "$pendingClearedBreakdown" },
            // Lookup the ORIGINAL billing by invoiceNumber to fetch its doctorId.
            {
              $lookup: {
                from: "billings",
                let: {
                  invNum: "$pendingClearedBreakdown.invoiceNumber",
                },
                pipeline: [
                  { $match: { $expr: { $eq: ["$invoiceNumber", "$$invNum"] } } },
                  { $project: { doctorId: 1, invoiceNumber: 1 } },
                ],
                as: "originalBilling",
              },
            },
            {
              $addFields: {
                isClearedItem: { $literal: true },
                effectiveDoctorId: {
                  $cond: [
                    {
                      $and: [
                        { $gt: [{ $size: "$originalBilling" }, 0] },
                        { $ne: [{ $arrayElemAt: ["$originalBilling.doctorId", 0] }, null] },
                      ],
                    },
                    { $arrayElemAt: ["$originalBilling.doctorId", 0] },
                    "$appointment.doctorId",
                  ],
                },
                effectiveAmount: { $ifNull: ["$pendingClearedBreakdown.amountCleared", 0] },
              },
            },
          ],
          // Stream 2: non-cleared items – one row per non-cleared billing.
          // For mixed billings, this stream ALSO produces a row for the
          // PACKAGE portion (paid - cleared) attributed to the billing's
          // own doctor. This is added via $unionWith below.
          nonCleared: [
            // Non-cleared billings (no breakdown)
            {
              $match: {
                $expr: {
                  $lte: [
                    { $size: { $ifNull: ["$pendingClearedBreakdown", []] } },
                    0,
                  ],
                },
              },
            },
            {
              $addFields: {
                isClearedItem: { $literal: false },
                effectiveDoctorId: "$appointment.doctorId",
                effectiveAmount: {
                  $add: [
                    { $ifNull: ["$paid", 0] },
                    { $ifNull: ["$advanceUsed", 0] },
                    { $ifNull: ["$claimAmountUsed", 0] },
                    { $ifNull: ["$cashbackWalletUsed", 0] },
                  ],
                },
              },
            },
            // Add mixed billings (as non-cleared) via $unionWith so they
            // contribute a row for the PACKAGE portion (paid - cleared)
            // attributed to the billing's own doctor.
            {
              $unionWith: {
                coll: "billings",
                pipeline: [
                  // Match clinic + date range
                  { $match: { ...clinicMatch, ...dateMatch } },
                  // Only mixed billings (breakdown exists AND invoiceNumber
                  // does not match the breakdown's first invoiceNumber)
                  {
                    $match: {
                      $expr: {
                        $and: [
                          {
                            $gt: [
                              { $size: { $ifNull: ["$pendingClearedBreakdown", []] } },
                              0,
                            ],
                          },
                          {
                            $ne: [
                              "$invoiceNumber",
                              { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] },
                            ],
                          },
                        ],
                      },
                    },
                  },
                  // Same lookups as basePipeline
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
                      from: "patientregistrations",
                      localField: "patientId",
                      foreignField: "_id",
                      as: "patient",
                    },
                  },
                  { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
                  // Compute effective doctor and amount for the package portion
                  {
                    $addFields: {
                      isClearedItem: { $literal: false },
                      effectiveDoctorId: "$appointment.doctorId",
                      effectiveAmount: {
                        $subtract: [
                          {
                            $add: [
                              { $ifNull: ["$paid", 0] },
                              { $ifNull: ["$advanceUsed", 0] },
                              { $ifNull: ["$claimAmountUsed", 0] },
                              { $ifNull: ["$cashbackWalletUsed", 0] },
                            ],
                          },
                          { $arrayElemAt: ["$pendingClearedBreakdown.amountCleared", 0] },
                        ],
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      },
      // Combine the two streams into a single array of rows.
      {
        $project: {
          combined: { $concatArrays: ["$cleared", "$nonCleared"] },
        },
      },
      { $unwind: "$combined" },
      { $replaceRoot: { newRoot: "$combined" } },
      {
        $group: {
          _id: "$effectiveDoctorId",
          amount: { $sum: "$effectiveAmount" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              service: { $cond: ["$isClearedItem", { $ifNull: ["$pendingClearedBreakdown.service", "$service"] }, "$service"] },
              packageName: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.packageName", null] },
                  "$package",
                ],
              },
              treatmentName: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.treatmentName", null] },
                  "$treatment",
                ],
              },
              invoiceNumber: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.invoiceNumber", "$invoiceNumber"] },
                  "$invoiceNumber",
                ],
              },
              invoicedDate: "$invoicedDate",
              amount: "$effectiveAmount",
              paid: {
                $cond: [
                  // Mixed billing (isClearedItem=false but in nonCleared
                  // stream via $unionWith): use billing's own paid
                  { $eq: ["$isClearedItem", false] },
                  "$paid",
                  // Clearance billing: use effectiveAmount (amountCleared)
                  "$effectiveAmount",
                ],
              },
              pending: { $cond: ["$isClearedItem", 0, "$pending"] },
              advance: { $cond: ["$isClearedItem", 0, "$advance"] },
              advanceUsed: { $cond: ["$isClearedItem", 0, { $ifNull: ["$advanceUsed", 0] }] },
              claimAmountUsed: { $cond: ["$isClearedItem", 0, { $ifNull: ["$claimAmountUsed", 0] }] },
              cashbackWalletUsed: { $cond: ["$isClearedItem", 0, { $ifNull: ["$cashbackWalletUsed", 0] }] },
              pendingUsed: {
                $cond: [
                  // Non-cleared (including mixed billings in nonCleared
                  // stream): use billing's own pendingUsed
                  { $eq: ["$isClearedItem", false] },
                  { $ifNull: ["$pendingUsed", 0] },
                  // Clearance billing: use effectiveAmount (cleared amount)
                  "$effectiveAmount",
                ],
              },
              pendingClaimUsed: { $cond: ["$isClearedItem", 0, { $ifNull: ["$pendingClaimUsed", 0] }] },
              isClearedItem: "$isClearedItem",
            }
          }
        }
      },
      { $sort: { amount: -1 } },
    ]);
    const doctorIds = byDoctorAgg.map((d) => d._id).filter(Boolean);
    const doctorMap = doctorIds.length
      ? new Map(
          (await User.find({ _id: { $in: doctorIds } }).select("_id name").lean()).map((u) => [
            String(u._id),
            u.name || "Unknown",
          ])
        )
      : new Map();
    const revenueByDoctor = byDoctorAgg.map((d) => ({
      doctorId: String(d._id || ""),
      name: doctorMap.get(String(d._id)) || "Unknown",
      amount: Math.round(Number(d.amount || 0)),
      details: d.details || []
    }));

    // Revenue by Service – mirrors the aggregation in service-performance.js so each
    // individual service name is listed with its own paid amount. Package billings
    // are excluded here UNLESS they carry a pendingClearedBreakdown with Treatment/
    // Service items (those cleared items are attributed to the original service so
    // the revenue lands under the right treatment, not under the clearance billing's
    // own service).
    const byServiceAgg = await Billing.aggregate([
      // 1. Match clinic + date range (do not pre-filter by service type – we need
      //    Package billings too because their pendingClearedBreakdown may contain
      //    Treatment/Service items that belong in this report).
      {
        $match: {
          ...clinicMatch,
          ...dateMatch,
        },
      },
      // 2. Lookup patient registration
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      // 3. Lookup appointment (preserveNullAndEmptyArrays)
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
      // 4. Unwind pendingClearedBreakdown (preserveNullAndEmptyArrays so billings
      //    without a breakdown keep flowing through the pipeline).
      {
        $unwind: {
          path: "$pendingClearedBreakdown",
          preserveNullAndEmptyArrays: true,
        },
      },
      // 5. Derive effective service/treatment/amount for each row:
      //    - Non-cleared rows: use the billing's own service/treatment and the
      //      paid+advanceUsed+claimAmountUsed+cashbackWalletUsed total.
      //    - Cleared rows: use the breakdown's service/treatmentName and the
      //      amountCleared so the revenue is attributed to the ORIGINAL service
      //      that the pending was for, not the clearance billing's own service.
      //    IMPORTANT: After $unwind with preserveNullAndEmptyArrays, an empty
      //    breakdown array causes the field to be REMOVED (not set to null).
      //    We must normalize missing → null via $ifNull before any $ne/$cond
      //    check, otherwise billings with empty breakdowns get misclassified as
      //    cleared items and filtered out.
      {
        $addFields: {
          isClearedItem: { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
          effectiveService: {
            $cond: [
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              { $ifNull: ["$pendingClearedBreakdown.service", "Unknown"] },
              "$service",
            ],
          },
          effectiveTreatmentName: {
            $cond: [
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              { $ifNull: ["$pendingClearedBreakdown.treatmentName", "Unknown"] },
              "$treatment",
            ],
          },
          effectiveAmount: {
            $cond: [
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              { $ifNull: ["$pendingClearedBreakdown.amountCleared", 0] },
              {
                $subtract: [
                  {
                    $add: [
                      { $ifNull: ["$paid", 0] },
                      { $ifNull: ["$advanceUsed", 0] },
                      { $ifNull: ["$claimAmountUsed", 0] },
                      { $ifNull: ["$cashbackWalletUsed", 0] },
                    ],
                  },
                  {
                    $cond: [
                      {
                        $and: [
                          { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                          { $ne: ["$invoiceNumber", { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] }] },
                        ],
                      },
                      { $ifNull: [{ $arrayElemAt: ["$pendingClearedBreakdown.amountCleared", 0] }, 0] },
                      0,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      // 6. Keep only Treatment/Service rows: main billings whose service is
      //    Treatment/Service, plus cleared items whose effective service is
      //    Treatment/Service (so Package-only breakdowns stay out of this list).
      {
        $match: {
          $or: [
            { isClearedItem: false, service: { $in: ["Treatment", "Service"] } },
            { isClearedItem: true, effectiveService: { $in: ["Treatment", "Service"] } },
          ],
        },
      },
      // 7. Resolve final group key: for cleared items use the breakdown's
      //    treatmentName; otherwise use billing.treatment → apptSvc.name fallback.
      {
        $addFields: {
          resolvedServiceName: {
            $cond: [
              "$isClearedItem",
              { $ifNull: ["$effectiveTreatmentName", "Unknown"] },
              { $ifNull: ["$treatment", { $ifNull: ["$apptSvc.name", "Unknown"] }] },
            ],
          },
        },
      },
      // 8. Group by the resolved service name. Cleared rows contribute
      //    amountCleared; non-cleared rows contribute the standard paid total.
      {
        $group: {
          _id: "$resolvedServiceName",
          amount: { $sum: "$effectiveAmount" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              service: { $cond: ["$isClearedItem", "$effectiveService", "$service"] },
              packageName: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.packageName", null] },
                  "$package",
                ],
              },
              treatmentName: {
                $cond: ["$isClearedItem", "$effectiveTreatmentName", "$treatment"],
              },
              invoiceNumber: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.invoiceNumber", "$invoiceNumber"] },
                  "$invoiceNumber",
                ],
              },
              invoicedDate: "$invoicedDate",
              amount: { $cond: ["$isClearedItem", "$effectiveAmount", "$amount"] },
              paid: { $cond: ["$isClearedItem", 0, "$paid"] },
              pending: { $cond: ["$isClearedItem", 0, "$pending"] },
              advance: { $cond: ["$isClearedItem", 0, "$advance"] },
              advanceUsed: { $cond: ["$isClearedItem", 0, { $ifNull: ["$advanceUsed", 0] }] },
              claimAmountUsed: { $cond: ["$isClearedItem", 0, { $ifNull: ["$claimAmountUsed", 0] }] },
              cashbackWalletUsed: { $cond: ["$isClearedItem", 0, { $ifNull: ["$cashbackWalletUsed", 0] }] },
              pendingUsed: { $cond: ["$isClearedItem", "$effectiveAmount", { $ifNull: ["$pendingUsed", 0] }] },
              pendingClaimUsed: { $cond: ["$isClearedItem", 0, { $ifNull: ["$pendingClaimUsed", 0] }] },
              isClearedItem: "$isClearedItem",
            },
          },
        },
      },
      { $sort: { amount: -1 } },
      // Exclude "Advance Payment" rows – advance usage is already included
      // in the parent service billing's amount (e.g. cleaning $300 includes
      // $200 advanceUsed). Showing it separately would double-count.
      { $match: { _id: { $ne: "Advance Payment" } } },
    ]);
    const revenueByService = byServiceAgg.map((s) => ({
      serviceId: String(s._id || ""),
      name: s._id || "Unknown",
      amount: Math.round(Number(s.amount || 0)),
      details: s.details || [],
    }));

    // revenue by package (Package billings grouped by package name). Also
    // consumes pendingClearedBreakdown items whose effective service is Package
    // so cleared amounts are attributed to the ORIGINAL package, not the
    // clearance billing's own service.
    const byPackageAgg = await Billing.aggregate([
      // 1. Match clinic + date range (do not pre-filter by service type – we
      //    need Treatment/Service billings too because their breakdown may
      //    contain Package items that belong in this report).
      { $match: { ...clinicMatch, ...dateMatch } },
      // 2. Lookup patient registration
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      // 2b. Capture breakdown info BEFORE $unwind. After $unwind with
      //    preserveNullAndEmptyArrays, the pendingClearedBreakdown field is
      //    REMOVED for non-cleared rows (when the array is empty/missing),
      //    so the mixed-billing adjustment check would fail. We pre-capture
      //    the values here so the non-cleared row can still detect that this
      //    is a mixed billing and subtract the cleared amount from its paid.
      {
        $addFields: {
          _origBreakdownAmount: { $arrayElemAt: ["$pendingClearedBreakdown.amountCleared", 0] },
          _origBreakdownInvoiceNumber: { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] },
          _isMixedBilling: {
            $and: [
              { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
              { $ne: ["$invoiceNumber", { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] }] },
            ],
          },
        },
      },
      // 3. Unwind pendingClearedBreakdown (preserveNullAndEmptyArrays so
      //    billings without a breakdown keep flowing through the pipeline).
      {
        $unwind: {
          path: "$pendingClearedBreakdown",
          preserveNullAndEmptyArrays: true,
        },
      },
      // 4. Derive effective service/package/amount for each row:
      //    - Non-cleared rows: use the billing's own service/package and the
      //      paid+advanceUsed+claimAmountUsed+cashbackWalletUsed total, MINUS
      //      the pre-captured breakdown amount (for mixed billings).
      //    - Cleared rows: use the breakdown's service/packageName and the
      //      amountCleared so the revenue is attributed to the ORIGINAL
      //      package that the pending was for.
      //    IMPORTANT: Normalize missing → null via $ifNull so billings with
      //    empty breakdowns are not misclassified as cleared items.
      {
        $addFields: {
          isClearedItem: { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
          effectiveService: {
            $cond: [
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              { $ifNull: ["$pendingClearedBreakdown.service", "Unknown"] },
              "$service",
            ],
          },
          effectivePackageName: {
            $cond: [
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              { $ifNull: ["$pendingClearedBreakdown.packageName", "Unknown"] },
              "$package",
            ],
          },
          effectiveAmount: {
            $cond: [
              // isClearedItem=true branch
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              {
                $cond: [
                  // Mixed billing: billing is a Package billing with a
                  // breakdown that points to a DIFFERENT invoice. In this
                  // case the cleared amount belongs to the original
                  // service, not this Package. The package's own
                  // contribution to revenue is paid - cleared.
                  {
                    $and: [
                      { $eq: ["$service", "Package"] },
                      { $eq: ["$_isMixedBilling", true] },
                    ],
                  },
                  {
                    $subtract: [
                      {
                        $add: [
                          { $ifNull: ["$paid", 0] },
                          { $ifNull: ["$advanceUsed", 0] },
                          { $ifNull: ["$claimAmountUsed", 0] },
                          { $ifNull: ["$cashbackWalletUsed", 0] },
                        ],
                      },
                      { $ifNull: ["$_origBreakdownAmount", 0] },
                    ],
                  },
                  // Otherwise (clearance billing whose breakdown has a
                  // Package item): use the cleared amount.
                  { $ifNull: ["$pendingClearedBreakdown.amountCleared", 0] },
                ],
              },
              // isClearedItem=false branch (non-cleared Package billing)
              {
                $subtract: [
                  {
                    $add: [
                      { $ifNull: ["$paid", 0] },
                      { $ifNull: ["$advanceUsed", 0] },
                      { $ifNull: ["$claimAmountUsed", 0] },
                      { $ifNull: ["$cashbackWalletUsed", 0] },
                    ],
                  },
                  // Use pre-captured mixed-billing flag (not the
                  // post-unwind pendingClearedBreakdown field, which is
                  // missing for non-cleared rows).
                  {
                    $cond: [
                      { $eq: ["$_isMixedBilling", true] },
                      { $ifNull: ["$_origBreakdownAmount", 0] },
                      0,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      // 5. Keep only Package rows: main billings whose service is Package,
      //    plus cleared items whose effective service is Package, plus
      //    mixed billings (Package billing with breakdown pointing to a
      //    different invoice – contributes the package's own portion).
      {
        $match: {
          $or: [
            { isClearedItem: false, service: "Package" },
            { isClearedItem: true, effectiveService: "Package" },
            { isClearedItem: true, service: "Package", _isMixedBilling: true },
          ],
        },
      },
      // 6. Resolve final group key:
      //    - For non-cleared Package billings: use the billing's own package
      //    - For mixed billings (Package billing with breakdown pointing to
      //      a different invoice): use the billing's own package (the
      //      breakdown is for a Treatment, not a Package, so its
      //      packageName is null)
      //    - For clearance billings (breakdown has a Package item): use the
      //      breakdown's packageName
      {
        $addFields: {
          resolvedPackageName: {
            $cond: [
              // Clearance billing (isClearedItem=true AND NOT mixed billing):
              // use the breakdown's packageName
              {
                $and: [
                  "$isClearedItem",
                  { $not: "$_isMixedBilling" },
                ],
              },
              { $ifNull: ["$effectivePackageName", "Unknown"] },
              // Otherwise (non-cleared Package billing or mixed billing):
              // use the billing's own package name
              { $ifNull: ["$package", "Unknown"] },
            ],
          },
        },
      },
      // 7. Group by the resolved package name. Cleared rows contribute
      //    amountCleared; non-cleared rows contribute the standard paid total.
      //    For mixed billings the details use the billing's own values
      //    (service, packageName, treatmentName, invoiceNumber, paid, etc.)
      //    NOT the breakdown's values, because the breakdown is for a
      //    different service (Treatment, not Package).
      {
        $group: {
          _id: "$resolvedPackageName",
          amount: { $sum: "$effectiveAmount" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              service: {
                $cond: [
                  // Mixed billing: use billing's own service
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$service",
                  // Clearance billing: use breakdown's service
                  { $cond: ["$isClearedItem", "$effectiveService", "$service"] },
                ],
              },
              packageName: {
                $cond: [
                  // Mixed billing: use billing's own package
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$package",
                  // Clearance billing: use breakdown's packageName
                  { $cond: ["$isClearedItem", "$effectivePackageName", "$package"] },
                ],
              },
              treatmentName: {
                $cond: [
                  // Mixed billing: use billing's own treatment
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$treatment",
                  // Clearance billing: use breakdown's treatmentName
                  { $cond: ["$isClearedItem", { $ifNull: ["$pendingClearedBreakdown.treatmentName", null] }, "$treatment"] },
                ],
              },
              invoiceNumber: {
                $cond: [
                  // Mixed billing: use billing's own invoiceNumber
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$invoiceNumber",
                  // Clearance billing: use breakdown's invoiceNumber
                  { $cond: ["$isClearedItem", { $ifNull: ["$pendingClearedBreakdown.invoiceNumber", "$invoiceNumber"] }, "$invoiceNumber"] },
                ],
              },
              invoicedDate: "$invoicedDate",
              amount: "$effectiveAmount",
              paid: {
                $cond: [
                  // Mixed billing: use billing's own paid
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$paid",
                  // Clearance billing: 0 (the cleared amount is shown via amount)
                  { $cond: ["$isClearedItem", 0, "$paid"] },
                ],
              },
              pending: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$pending",
                  { $cond: ["$isClearedItem", 0, "$pending"] },
                ],
              },
              advance: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$advance",
                  { $cond: ["$isClearedItem", 0, "$advance"] },
                ],
              },
              advanceUsed: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  { $ifNull: ["$advanceUsed", 0] },
                  { $cond: ["$isClearedItem", 0, { $ifNull: ["$advanceUsed", 0] }] },
                ],
              },
              claimAmountUsed: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  { $ifNull: ["$claimAmountUsed", 0] },
                  { $cond: ["$isClearedItem", 0, { $ifNull: ["$claimAmountUsed", 0] }] },
                ],
              },
              cashbackWalletUsed: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  { $ifNull: ["$cashbackWalletUsed", 0] },
                  { $cond: ["$isClearedItem", 0, { $ifNull: ["$cashbackWalletUsed", 0] }] },
                ],
              },
              pendingUsed: {
                $cond: [
                  // Mixed billing: use billing's own pendingUsed
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  { $ifNull: ["$pendingUsed", 0] },
                  // Clearance billing: use effectiveAmount (cleared amount)
                  { $cond: ["$isClearedItem", "$effectiveAmount", { $ifNull: ["$pendingUsed", 0] }] },
                ],
              },
              pendingClaimUsed: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  { $ifNull: ["$pendingClaimUsed", 0] },
                  { $cond: ["$isClearedItem", 0, { $ifNull: ["$pendingClaimUsed", 0] }] },
                ],
              },
              isClearedItem: "$isClearedItem",
              isMixedBilling: "$_isMixedBilling",
            },
          },
        },
      },
      { $sort: { amount: -1 } },
    ]);
    const revenueByPackage = byPackageAgg.map((p) => ({
      packageName: p._id || "Unknown",
      amount: Math.round(Number(p.amount || 0)),
      details: p.details || [],
    }));

    // Revenue by Department — mirrors the calculation used by Department
    // Performance / Top Performing Departments in department-performance.js:
    //   1. Restrict to Treatment & Service billings only (Package revenue is in
    //      the Revenue by Package section, so it is not double-counted here).
    //   2. Resolve department for each billing via:
    //        (a) appointment.service.departmentId when an appointment is attached, OR
    //        (b) service.departmentId looked up by clinicId + treatment/service name
    //            (fallback for billings without an appointment).
    //   3. Group by service first (sum paid per service), then group by department
    //      (sum paid per department) — same pipeline shape as department-performance.js,
    //      so both reports show the same numbers.
    //   4. Only `paid` amounts (real income) are summed.
    //   5. Cleared items (from pendingClearedBreakdown) are attributed to the
    //      ORIGINAL service's department (looked up by clinicId + treatmentName)
    //      instead of the clearance billing's appointment service department.
    const departmentObjectId =
      departmentId && mongoose.Types.ObjectId.isValid(String(departmentId))
        ? new mongoose.Types.ObjectId(String(departmentId))
        : null;

    const departmentPipeline = [
      // 1. Clinic + date range (do not pre-filter by service type – we need
      //    Package billings too because their pendingClearedBreakdown may
      //    contain Treatment/Service items that belong in this report).
      {
        $match: {
          ...clinicMatch,
          ...dateMatch,
        },
      },
      // 2. Lookup appointment (preserveNullAndEmptyArrays so billings without
      //    appointment are still resolved via the name lookup below)
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appt",
        },
      },
      { $unwind: { path: "$appt", preserveNullAndEmptyArrays: true } },
      // 2.5. Lookup patient for details
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      // 3. Lookup service attached to that appointment (gives departmentId)
      {
        $lookup: {
          from: "services",
          localField: "appt.serviceId",
          foreignField: "_id",
          as: "apptSvc",
        },
      },
      { $unwind: { path: "$apptSvc", preserveNullAndEmptyArrays: true } },
      // 4. Unwind pendingClearedBreakdown (preserveNullAndEmptyArrays so
      //    billings without a breakdown keep flowing through).
      {
        $unwind: {
          path: "$pendingClearedBreakdown",
          preserveNullAndEmptyArrays: true,
        },
      },
      // 5. Derive effective service/treatment/amount for each row:
      //    - Non-cleared rows: use the billing's own service/treatment and the
      //      paid+advanceUsed+claimAmountUsed+cashbackWalletUsed total.
      //    - Cleared rows: use the breakdown's service/treatmentName and the
      //      amountCleared so the revenue is attributed to the ORIGINAL
      //      service that the pending was for.
      //    IMPORTANT: Normalize missing → null via $ifNull so billings with
      //    empty breakdowns are not misclassified as cleared items.
      {
        $addFields: {
          isClearedItem: { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
          effectiveService: {
            $cond: [
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              { $ifNull: ["$pendingClearedBreakdown.service", "Unknown"] },
              "$service",
            ],
          },
          effectiveTreatmentName: {
            $cond: [
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              { $ifNull: ["$pendingClearedBreakdown.treatmentName", null] },
              "$treatment",
            ],
          },
          effectiveAmount: {
            $cond: [
              { $ne: [{ $ifNull: ["$pendingClearedBreakdown", null] }, null] },
              { $ifNull: ["$pendingClearedBreakdown.amountCleared", 0] },
              {
                $subtract: [
                  {
                    $add: [
                      { $ifNull: ["$paid", 0] },
                      { $ifNull: ["$advanceUsed", 0] },
                      { $ifNull: ["$claimAmountUsed", 0] },
                      { $ifNull: ["$cashbackWalletUsed", 0] },
                    ],
                  },
                  {
                    $cond: [
                      {
                        $and: [
                          { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                          { $ne: ["$invoiceNumber", { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] }] },
                        ],
                      },
                      { $ifNull: [{ $arrayElemAt: ["$pendingClearedBreakdown.amountCleared", 0] }, 0] },
                      0,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      // 6. Keep only Treatment/Service rows: main billings whose service is
      //    Treatment/Service, plus cleared items whose effective service is
      //    Treatment/Service (so Package-only breakdowns stay out of this list).
      {
        $match: {
          $or: [
            { isClearedItem: false, service: { $in: ["Treatment", "Service"] } },
            { isClearedItem: true, effectiveService: { $in: ["Treatment", "Service"] } },
          ],
        },
      },
      // 7. Resolve the final group key: for cleared items use the breakdown's
      //    treatmentName; otherwise use billing.treatment → apptSvc.name fallback.
      {
        $addFields: {
          resolvedServiceName: {
            $cond: [
              "$isClearedItem",
              { $ifNull: ["$effectiveTreatmentName", "Unknown"] },
              { $ifNull: ["$treatment", { $ifNull: ["$apptSvc.name", "Unknown"] }] },
            ],
          },
        },
      },
      // 7.5. Exclude "Advance Payment" rows – advance usage is already included
      //      in the parent service billing's amount. Showing it separately would
      //      double-count and cause department totals to exceed Revenue by Service.
      { $match: { resolvedServiceName: { $ne: "Advance Payment" } } },
      // 8. Group by service name first to sum effectiveAmount per service
      //    (matches the first $group in department-performance.js but uses the
      //    cleared-aware amount instead of just paid+advanceUsed+...).
      {
        $group: {
          _id: "$resolvedServiceName",
          clinicId: { $first: "$clinicId" },
          totalRevenue: { $sum: "$effectiveAmount" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ["$patient.firstName", ""] },
                      " ",
                      { $ifNull: ["$patient.lastName", ""] },
                    ],
                  },
                },
              },
              emrNumber: "$patient.emrNumber",
              service: "$effectiveService",
              packageName: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.packageName", null] },
                  "$package",
                ],
              },
              treatmentName: "$effectiveTreatmentName",
              invoiceNumber: "$invoiceNumber",
              invoicedDate: "$invoicedDate",
              totalAmount: { $ifNull: ["$originalAmount", "$amount"] },
              revenue: "$effectiveAmount",
            },
          },
        },
      },
      // 9. Lookup service doc by clinicId + name to get departmentId
      //    (same lookup as department-performance.js)
      {
        $lookup: {
          from: "services",
          let: { cId: "$clinicId", sName: "$_id" },
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
      // 10. Project with resolved departmentId
      {
        $project: {
          serviceName: "$_id",
          clinicId: 1,
          totalRevenue: 1,
          details: 1,
          departmentId: {
            $ifNull: [{ $arrayElemAt: ["$serviceDoc.departmentId", 0] }, null],
          },
        },
      },
      // 11. If a specific departmentId filter is requested, keep only that one
      ...(departmentObjectId
        ? [{ $match: { departmentId: departmentObjectId } }]
        : []),
      // 12. Group by departmentId and sum paid amounts (same final grouping as
      //    department-performance.js's Department Performance section)
      {
        $group: {
          _id: "$departmentId",
          amount: { $sum: "$totalRevenue" },
          details: { $push: "$details" },
        },
      },
      { $sort: { amount: -1 } },
    ];

    const byDepartmentAgg = await Billing.aggregate(departmentPipeline);
    const departmentIds = byDepartmentAgg.map((d) => d._id).filter(Boolean);
    const departmentMap = departmentIds.length
      ? new Map(
          (await Department.find({ _id: { $in: departmentIds } }).select("_id name").lean()).map((d) => [
            String(d._id),
            d.name || "Unknown",
          ])
        )
      : new Map();
    const revenueByDepartment = byDepartmentAgg.map((d) => {
      // Flatten nested details arrays (service-level details pushed into department-level)
      const flatDetails = (d.details || []).flat().map((detail) => ({
        patientId: String(detail.patientId || ""),
        patientName: detail.patientName || "Unknown",
        emrNumber: detail.emrNumber || "",
        service: detail.service || "Unknown",
        packageName: detail.packageName || null,
        treatmentName: detail.treatmentName || null,
        invoiceNumber: detail.invoiceNumber || "",
        invoicedDate: detail.invoicedDate || null,
        totalAmount: Math.round(Number(detail.totalAmount || 0)),
        revenue: Math.round(Number(detail.revenue || 0)),
      }));
      return {
        departmentId: String(d._id || ""),
        name: departmentMap.get(String(d._id)) || "Unknown",
        amount: Math.round(Number(d.amount || 0)),
        details: flatDetails,
      };
    });

    // revenue by payment method (respect multiplePayments) – ALL billings, not just those with appointments.
    // Clearance billings are excluded to prevent double-counting the Tamara /
    // Card / etc. payment that was already counted in the original billing.
    // PENDING_CLEARANCE transactions are also excluded from the revenue count
    // because they represent internal accounting (a patient's pending balance
    // being cleared against a new payment) – NOT a real cash inflow. Counting
    // them on top of `paid` would double-count the cleared amount.
    const paymentsAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      { $match: excludeClearanceMatch },
      // Lookup patient for details
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          // Calculate all amounts that should be considered "paid" for revenue
          paid: { $ifNull: ["$paid", 0] },
          advanceUsed: { $ifNull: ["$advanceUsed", 0] },
          claimAmountUsed: { $ifNull: ["$claimAmountUsed", 0] },
          cashbackWalletUsed: { $ifNull: ["$cashbackWalletUsed", 0] },
          pendingUsed: { $ifNull: ["$pendingUsed", 0] },
          paymentMethod: { $ifNull: ["$paymentMethod", "Cash"] },
          multiplePayments: { $ifNull: ["$multiplePayments", []] },
          // Fields for details
          patientId: "$patientId",
          patientName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$patient.firstName", ""] },
                  " ",
                  { $ifNull: ["$patient.lastName", ""] },
                ],
              },
            },
          },
          emrNumber: "$patient.emrNumber",
          service: "$service",
          treatment: "$treatment",
          package: "$package",
          invoiceNumber: "$invoiceNumber",
          invoicedDate: "$invoicedDate",
          originalAmount: { $ifNull: ["$originalAmount", "$amount"] },
        }
      },
      {
        $project: {
          // Calculate total of existing payments, EXCLUDING PENDING_CLEARANCE
          // and ADVANCE_USAGE transactions. PENDING_CLEARANCE is internal
          // accounting; ADVANCE_USAGE is already reflected in the billing's
          // `paid` + `advanceUsed` totals and should not be double-counted
          // under the "Advance Balance" payment method.
          totalFromPayments: {
            $reduce: {
              input: {
                $filter: {
                  input: "$multiplePayments",
                  as: "mp",
                  cond: {
                    $and: [
                      { $ne: [{ $ifNull: ["$$mp.transactionType", null] }, "PENDING_CLEARANCE"] },
                      { $ne: [{ $ifNull: ["$$mp.transactionType", null] }, "ADVANCE_USAGE"] },
                    ],
                  },
                },
              },
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] }
            }
          },
          // Calculate total expected paid amount (all credits included).
          // Note: pendingUsed is NOT added here because it is already included
          // in `paid` (the billing's paid field reflects all payments received,
          // including pending clearances). Adding it again would double-count.
          totalExpected: {
            $add: [
              "$paid",
              "$advanceUsed",
              "$claimAmountUsed",
              "$cashbackWalletUsed",
              { $ifNull: ["$pendingClaimUsed", 0] }
            ]
          },
          paymentMethod: 1,
          multiplePayments: 1,
          // Carry detail fields through
          patientId: 1,
          patientName: 1,
          emrNumber: 1,
          service: 1,
          treatment: 1,
          package: 1,
          invoiceNumber: 1,
          invoicedDate: 1,
          originalAmount: 1,
        }
      },
      {
        $project: {
          // Determine if there's a difference to add
          difference: { $max: [0, { $subtract: ["$totalExpected", "$totalFromPayments"] }] },
          paymentMethod: 1,
          multiplePayments: 1,
          // Carry detail fields through
          patientId: 1,
          patientName: 1,
          emrNumber: 1,
          service: 1,
          treatment: 1,
          package: 1,
          invoiceNumber: 1,
          invoicedDate: 1,
          originalAmount: 1,
        }
      },
      {
        $project: {
          // Build the payments array: existing payments (excluding
          // PENDING_CLEARANCE and ADVANCE_USAGE) + difference if any.
          // PENDING_CLEARANCE is internal accounting; ADVANCE_USAGE is already
          // reflected in the billing's totals and should not be double-counted.
          payments: {
            $cond: [
              { $gt: ["$difference", 0] },
              {
                $concatArrays: [
                  {
                    $filter: {
                      input: "$multiplePayments",
                      as: "mp",
                      cond: {
                        $and: [
                          { $ne: [{ $ifNull: ["$$mp.transactionType", null] }, "PENDING_CLEARANCE"] },
                          { $ne: [{ $ifNull: ["$$mp.transactionType", null] }, "ADVANCE_USAGE"] },
                        ],
                      },
                    }
                  },
                  [
                    {
                      paymentMethod: "$paymentMethod",
                      amount: "$difference"
                    }
                  ]
                ]
              },
              {
                $filter: {
                  input: "$multiplePayments",
                  as: "mp",
                  cond: {
                    $and: [
                      { $ne: [{ $ifNull: ["$$mp.transactionType", null] }, "PENDING_CLEARANCE"] },
                      { $ne: [{ $ifNull: ["$$mp.transactionType", null] }, "ADVANCE_USAGE"] },
                    ],
                  },
                }
              }
            ]
          },
          // Carry detail fields through
          patientId: 1,
          patientName: 1,
          emrNumber: 1,
          service: 1,
          treatment: 1,
          package: 1,
          invoiceNumber: 1,
          invoicedDate: 1,
          originalAmount: 1,
        }
      },
      { $unwind: "$payments" },
      {
        $group: {
          _id: "$payments.paymentMethod",
          amount: { $sum: { $ifNull: ["$payments.amount", 0] } },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: "$patientName",
              emrNumber: "$emrNumber",
              service: "$service",
              treatment: "$treatment",
              package: "$package",
              invoiceNumber: "$invoiceNumber",
              invoicedDate: "$invoicedDate",
              totalAmount: "$originalAmount",
              revenue: "$payments.amount",
            },
          },
        },
      },
      { $sort: { amount: -1 } },
    ]);
    const revenueByPaymentMethod = paymentsAgg.map((p) => ({
      method: p._id || "Unknown",
      amount: Math.round(Number(p.amount || 0)),
      details: (p.details || []).map((d) => ({
        patientId: String(d.patientId || ""),
        patientName: d.patientName || "Unknown",
        emrNumber: d.emrNumber || "",
        service: d.service || "Unknown",
        treatment: d.treatment || null,
        package: d.package || null,
        invoiceNumber: d.invoiceNumber || "",
        invoicedDate: d.invoicedDate || null,
        totalAmount: Math.round(Number(d.totalAmount || 0)),
        revenue: Math.round(Number(d.revenue || 0)),
      })),
    }));

    // pending payments list (pending > 0)
    const pPageNum = Math.max(1, parseInt(pendingPage || "1", 10));
    const pPageSizeNum = Math.max(1, parseInt(pendingPageSize || "10", 10));
    const pSkipNum = (pPageNum - 1) * pPageSizeNum;
    const pendingPipelineBase = [
      { $match: { ...clinicMatch, ...dateMatch } },
      { $match: pendingType === "advance" ? { advance: { $gt: 0 } } : { pending: { $gt: 0 } } },
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
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "services",
          localField: "appointment.serviceId",
          foreignField: "_id",
          as: "svc",
        },
      },
      { $unwind: { path: "$svc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "doctorId",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          invoiceNumber: "$invoiceNumber",
          dueDate: "$invoicedDate",
          totalAmount: { $ifNull: ["$amount", 0] },
          paidAmount: { $ifNull: ["$paid", 0] },
          pendingAmount: { $ifNull: ["$pending", 0] },
          advanceAmount: { $ifNull: ["$advance", 0] },
          serviceName: {
            $cond: [
              { $eq: ["$service", "Package"] },
              { $ifNull: ["$package", "$svc.name"] },
              {
                $cond: [
                  { $eq: ["$service", "Treatment"] },
                  { $ifNull: ["$treatment", "$svc.name"] },
                  "$svc.name",
                ],
              },
            ],
          },
          patientName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$patient.firstName", ""] },
                  " ",
                  { $ifNull: ["$patient.lastName", ""] },
                ],
              },
            },
          },
          doctorName: {
            $ifNull: ["$doctorName", { $ifNull: ["$doctor.name", "—"] }],
          },
        },
      },
    ];
    const pendingCountAgg = await Billing.aggregate([...pendingPipelineBase, { $count: "total" }]);
    const pendingTotal = Number(pendingCountAgg[0]?.total || 0);
    const pendingPageAgg = await Billing.aggregate([
      ...pendingPipelineBase,
      { $sort: { dueDate: -1 } },
      { $skip: pSkipNum },
      { $limit: pPageSizeNum },
    ]);
    const pendingPayments = pendingPageAgg.map((p) => ({
      invoiceNumber: p.invoiceNumber || "",
      patientName: p.patientName || "",
      serviceName: p.serviceName || "Unknown",
      doctorName: p.doctorName || "—",
      totalAmount: Math.round(Number(p.totalAmount || 0)),
      paidAmount: Math.round(Number(p.paidAmount || 0)),
      pendingAmount: Math.round(Number(p.pendingAmount || 0)),
      advanceAmount: Math.round(Number(p.advanceAmount || 0)),
      dueDate: p.dueDate || null,
    }));

    const topPendingAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch, pending: { $gt: 0 } } },
      {
        $group: {
          _id: "$patientId",
          amount: { $sum: { $ifNull: ["$pending", 0] } },
        },
      },
      { $sort: { amount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "patientregistrations",
          localField: "_id",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          patientId: { $toString: "$_id" },
          name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$patient.firstName", ""] },
                  " ",
                  { $ifNull: ["$patient.lastName", ""] },
                ],
              },
            },
          },
          amount: { $round: ["$amount", 0] },
        },
      },
    ]);
    const topPendingPatients = topPendingAgg.map((r) => ({
      patientId: r.patientId || "",
      name: r.name || "Unknown",
      amount: Math.round(Number(r.amount || 0)),
    }));

    const topAdvanceAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch, advance: { $gt: 0 } } },
      {
        $group: {
          _id: "$patientId",
          amount: { $sum: { $ifNull: ["$advance", 0] } },
        },
      },
      { $sort: { amount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "patientregistrations",
          localField: "_id",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          patientId: { $toString: "$_id" },
          name: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$patient.firstName", ""] },
                  " ",
                  { $ifNull: ["$patient.lastName", ""] },
                ],
              },
            },
          },
          amount: { $round: ["$amount", 0] },
        },
      },
    ]);
    const topAdvancePatients = topAdvanceAgg.map((r) => ({
      patientId: r.patientId || "",
      name: r.name || "Unknown",
      amount: Math.round(Number(r.amount || 0)),
    }));

    // payment reports list – covers ALL billings (not just those with appointments).
    // Clearance billings are excluded so the Tamara / Card payment that was
    // already counted on the original billing is not listed again here.
    const normalizeMethod = (m) => {
      switch (m) {
        case "BT": return "Bank Transfer";
        case "Tamara": return "Online Payment";
        case "Advance Balance": return "Advance Balance";
        case "Insurance Claim": return "Insurance Claim";
        case "Pending Claim": return "Pending Claim";
        case "Cashback Wallet": return "Cashback Wallet";
        case "Package Full Paid": return "Package Full Paid";
        case "Tabby": return "Tabby";
        default: return m || "Unknown";
      }
    };
    const normalizeTxnType = (t) => {
      switch (t) {
        case "PAYMENT": return "Payment";
        case "ADVANCE_USAGE": return "Advance Used";
        case "CLAIM_USAGE": return "Insurance Claim";
        case "PENDING_CLEARANCE": return "Pending Cleared";
        case "CASHBACK_USAGE": return "Cashback Used";
        default: return "Payment";
      }
    };
    const paymentsPipelineBase = [
      { $match: { ...clinicMatch, ...dateMatch } },
      { $match: excludeClearanceMatch },
      {
        $project: {
          invoiceNumber: "$invoiceNumber",
          invoicedDate: "$invoicedDate",
          paid: { $ifNull: ["$paid", 0] },
          pending: { $ifNull: ["$pending", 0] },
          originalAmount: { $ifNull: ["$originalAmount", "$amount"] },
          patientId: "$patientId",
          serviceType: "$service",
          packageName: "$package",
          treatmentName: "$treatment",
          appointmentId: "$appointmentId",
          doctorId: "$doctorId",
          doctorName: "$doctorName",
          advanceUsed: { $ifNull: ["$advanceUsed", 0] },
          claimAmountUsed: { $ifNull: ["$claimAmountUsed", 0] },
          cashbackWalletUsed: { $ifNull: ["$cashbackWalletUsed", 0] },
          paymentMethod: { $ifNull: ["$paymentMethod", "Cash"] },
          multiplePayments: { $ifNull: ["$multiplePayments", []] },
          // Keep pendingClearedBreakdown to detect if this billing is the
          // original being cleared (so we can filter out its PENDING_CLEARANCE
          // row – the clearance payment belongs to the billing that DID the
          // clearing, not the one being cleared).
          pendingClearedBreakdown: { $ifNull: ["$pendingClearedBreakdown", []] },
        },
      },
      // Derive isOriginalBeingCleared: true when the breakdown's first
      // invoiceNumber matches this billing's own invoiceNumber (meaning this
      // billing is the original whose pending was cleared by another billing).
      {
        $addFields: {
          isOriginalBeingCleared: {
            $eq: [
              "$invoiceNumber",
              { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] },
            ],
          },
        },
      },
      {
        $project: {
          invoiceNumber: 1,
          invoicedDate: 1,
          paid: 1,
          pending: 1,
          originalAmount: 1,
          patientId: 1,
          serviceType: 1,
          packageName: 1,
          treatmentName: 1,
          appointmentId: 1,
          doctorId: 1,
          doctorName: 1,
          totalFromPayments: {
            $reduce: {
              input: "$multiplePayments",
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] }
            }
          },
          totalExpected: {
            $add: [
              "$paid",
              "$advanceUsed",
              "$claimAmountUsed",
              "$cashbackWalletUsed"
            ]
          },
          paymentMethod: 1,
          multiplePayments: 1,
          isOriginalBeingCleared: 1
        }
      },
      {
        $project: {
          invoiceNumber: 1,
          invoicedDate: 1,
          paid: 1,
          pending: 1,
          originalAmount: 1,
          patientId: 1,
          serviceType: 1,
          packageName: 1,
          treatmentName: 1,
          appointmentId: 1,
          doctorId: 1,
          doctorName: 1,
          difference: { $max: [0, { $subtract: ["$totalExpected", "$totalFromPayments"] }] },
          paymentMethod: 1,
          multiplePayments: 1,
          isOriginalBeingCleared: 1
        }
      },
      {
        $project: {
          invoiceNumber: 1,
          invoicedDate: 1,
          paid: 1,
          pending: 1,
          originalAmount: 1,
          patientId: 1,
          serviceType: 1,
          packageName: 1,
          treatmentName: 1,
          appointmentId: 1,
          doctorId: 1,
          doctorName: 1,
          payments: {
            $cond: [
              { $gt: ["$difference", 0] },
              {
                $concatArrays: [
                  "$multiplePayments",
                  [
                    {
                      paymentMethod: "$paymentMethod",
                      amount: "$difference",
                      transactionType: "PAYMENT"
                    }
                  ]
                ]
              },
              {
                $cond: [
                  { $gt: [{ $size: "$multiplePayments" }, 0] },
                  "$multiplePayments",
                  [{ paymentMethod: "$paymentMethod", amount: "$paid", transactionType: "PAYMENT" }]
                ]
              }
            ]
          },
          isOriginalBeingCleared: 1
        }
      },
      { $unwind: "$payments" },
      // Filter out PENDING_CLEARANCE rows from the original billing being
      // cleared. The clearance payment belongs to the billing that DID the
      // clearing (e.g. the package billing), not the one being cleared.
      {
        $match: {
          $or: [
            { "payments.transactionType": { $ne: "PENDING_CLEARANCE" } },
            { isOriginalBeingCleared: { $ne: true } },
          ],
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
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
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
          as: "apptService",
        },
      },
      { $unwind: { path: "$apptService", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "doctorId",
          foreignField: "_id",
          as: "doctor",
        },
      },
      { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          invoiceNumber: 1,
          paymentDate: "$invoicedDate",
          amount: { $ifNull: ["$payments.amount", 0] },
          originalAmount: 1,
          method: "$payments.paymentMethod",
          transactionType: "$payments.transactionType",
          serviceName: {
            $cond: [
              { $eq: ["$serviceType", "Package"] },
              { $ifNull: ["$packageName", "Package"] },
              {
                $cond: [
                  { $eq: ["$serviceType", "Treatment"] },
                  { $ifNull: ["$treatmentName", { $ifNull: ["$apptService.name", "Service"] }] },
                  { $ifNull: ["$apptService.name", "Service"] },
                ],
              },
            ],
          },
          patientName: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ["$patient.firstName", ""] },
                  " ",
                  { $ifNull: ["$patient.lastName", ""] },
                ],
              },
            },
          },
          doctorName: {
            $ifNull: ["$doctorName", { $ifNull: ["$doctor.name", "—"] }],
          },
          paid: 1,
          pending: 1,
        },
      },
    ];
    const paymentsCountAgg = await Billing.aggregate([...paymentsPipelineBase, { $count: "total" }]);
    const paymentsTotal = Number(paymentsCountAgg[0]?.total || 0);
    const paymentsPageAgg = await Billing.aggregate([
      ...paymentsPipelineBase,
      { $sort: { paymentDate: -1 } },
      { $skip: skipNum },
      { $limit: pageSizeNum },
    ]);
    const payments = paymentsPageAgg.map((p) => {
      let status = "Pending";
      const paid = Math.round(Number(p.paid || 0));
      const pending = Math.round(Number(p.pending || 0));
      if (pending === 0 && paid > 0) status = "Paid";
      else if (pending > 0 && paid > 0) status = "Partially Paid";
      else status = "Pending";
      // For PENDING_CLEARANCE rows the row represents a specific clearance
      // payment (e.g. 150 Tamara paid to settle a 150 pending slice of a
      // 300 billing) — NOT the full billing. Showing the billing's full
      // originalAmount/paid would inflate the row. Use the actual payment
      // amount from the unwound multiplePayments entry instead.
      const isClearanceRow = p.transactionType === "PENDING_CLEARANCE";
      const rowTotal = isClearanceRow
        ? Math.round(Number(p.amount || 0))
        : Math.round(Number(p.originalAmount || p.amount || 0));
      // Use the payment's amount from the payments array for all rows,
      // not the billing's paid field. This ensures each payment method
      // shows its actual amount (e.g., Advance Balance shows 200, not 100).
      const rowPaid = Math.round(Number(p.amount || 0));
      return {
        invoiceNumber: p.invoiceNumber || "",
        patientName: p.patientName || "",
        service: p.serviceName || "Unknown",
        doctorName: p.doctorName || "—",
        amount: rowTotal,
        paidAmount: rowPaid,
        paymentMethod: normalizeMethod(p.method),
        transactionType: normalizeTxnType(p.transactionType),
        paymentStatus: status,
        paymentDate: p.paymentDate || null,
      };
    });

    // views: daily/weekly/monthly/yearly – breakdown-aware revenue trend
    // matching Total Revenue = treatmentRevenue + packageRevenue.
    //
    // treatmentRevenueAgg counts amountCleared for ALL billings that have a
    // breakdown with Treatment/Service entries (including Package billings).
    // packageRevenueAgg subtracts amountCleared from Package billings.
    // Net effect for Package billings: amountCleared + (paid - amountCleared) = paid.
    // Net effect for Treatment billings with breakdown: amountCleared.
    // Net effect for Treatment billings without breakdown: paid.
    const views = {};

    // Helper: compute effective amount per billing row (treatment + package).
    // This matches the combined logic of treatmentRevenueAgg + packageRevenueAgg.
    const effectiveAmountExpr = {
      $let: {
        vars: {
          clearedTreatmentAmount: {
            $sum: {
              $map: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$pendingClearedBreakdown", []] },
                    cond: { $in: ["$$this.service", ["Treatment", "Service"]] },
                  },
                },
                in: { $ifNull: ["$$this.amountCleared", 0] },
              },
            },
          },
          fullPaid: {
            $add: [
              { $ifNull: ["$paid", 0] },
              { $ifNull: ["$advanceUsed", 0] },
              { $ifNull: ["$claimAmountUsed", 0] },
              { $ifNull: ["$cashbackWalletUsed", 0] },
            ],
          },
        },
        in: {
          $cond: [
            { $eq: ["$service", "Package"] },
            // Package billing: treatmentRevenue counts amountCleared, packageRevenue
            // counts (paid - amountCleared). Net = paid.
            "$$fullPaid",
            // Treatment/Service billing: if has breakdown with Treatment/Service
            // entries, treatmentRevenue counts amountCleared; else counts full paid.
            {
              $cond: [
                { $gt: ["$$clearedTreatmentAmount", 0] },
                "$$clearedTreatmentAmount",
                "$$fullPaid",
              ],
            },
          ],
        },
      },
    };

    const dailyAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      { $match: excludeClearanceMatch },
      { $addFields: { effectiveAmount: effectiveAmountExpr } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$invoicedDate" } },
          amount: { $sum: "$effectiveAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    views.daily = dailyAgg.map((d) => ({ label: d._id, amount: Math.round(Number(d.amount || 0)) }));

    const weeklyAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      { $match: excludeClearanceMatch },
      { $addFields: { effectiveAmount: effectiveAmountExpr } },
      {
        $group: {
          _id: {
            year: { $isoWeekYear: "$invoicedDate" },
            week: { $isoWeek: "$invoicedDate" },
          },
          amount: { $sum: "$effectiveAmount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
    ]);
    views.weekly = weeklyAgg.map((w) => ({
      label: `W${w._id.week}-${w._id.year}`,
      amount: Math.round(Number(w.amount || 0)),
    }));

    const monthlyAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      { $match: excludeClearanceMatch },
      { $addFields: { effectiveAmount: effectiveAmountExpr } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$invoicedDate" } },
          amount: { $sum: "$effectiveAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    views.monthly = monthlyAgg.map((m) => ({ label: m._id, amount: Math.round(Number(m.amount || 0)) }));

    const yearlyAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      { $match: excludeClearanceMatch },
      { $addFields: { effectiveAmount: effectiveAmountExpr } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y", date: "$invoicedDate" } },
          amount: { $sum: "$effectiveAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    views.yearly = yearlyAgg.map((y) => ({ label: y._id, amount: Math.round(Number(y.amount || 0)) }));

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        treatmentRevenue,
        packageRevenue,
        advanceRevenue,
        pendingCleared,
        revenueByDoctor,
        revenueByService,
        revenueByPackage,
        revenueByDepartment,
        revenueByPaymentMethod,
        payments,
        pendingPayments,
        pendingTotal,
        paymentsTotal,
        topPendingPatients,
        topAdvancePatients,
        views,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to load revenue report" });
  }
}

import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import Appointment from "../../../../models/Appointment";
import Service from "../../../../models/Service";
import Department from "../../../../models/Department";
import User from "../../../../models/Users";
import PatientRegistration from "../../../../models/PatientRegistration";
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
          // No breakdown at all (null / missing / empty array / not an array)
          {
            $lte: [
              { $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }},
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
          // Billing service is Package (even if package field is empty) →
          // real package billing clearing an unpaid package, not a pure
          // clearance billing.
          {
            $eq: ["$service", "Package"],
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
              $subtract: [
                {
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
                            { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
                            { $eq: [{ $arrayElemAt: ["$pendingClearedBreakdown.service", 0] }, "Treatment"] },
                          ],
                        },
                        { $multiply: [-1, { $ifNull: [{ $arrayElemAt: ["$pendingClearedBreakdown.amountCleared", 0] }, 0] }] },
                        0,
                      ],
                    },
                  ],
                },
                // Subtract treatment amount for mixed billings (Package + Treatment)
                {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$service", "Package"] },
                        { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                      ],
                    },
                    {
                      $sum: {
                        $map: {
                          input: "$selectedTreatments",
                          as: "st",
                          in: {
                            $multiply: [
                              { $ifNull: ["$$st.price", 0] },
                              { $ifNull: ["$$st.quantity", 1] },
                            ],
                          },
                        },
                      },
                    },
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
    let treatmentRevenue = Math.round(Number(treatmentRevenueAgg[0]?.total || 0));

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
      // Lookup patient to extract packageSoldBy info for Package billings
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: "$patientId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$patientId" }
                  ]
                }
              }
            }
          ],
          as: "patient",
        },
      },
      { $addFields: { patient: { $arrayElemAt: ["$patient", 0] } } },
      // Extract packageSoldBy info for Package billings
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$patient.packages", []] },
                  as: "pkg",
                  cond: {
                    $and: [
                      { $eq: ["$$pkg.packageName", {
                        $cond: [
                          { $or: [
                            { $eq: ["$package", ""] },
                            { $eq: ["$package", null] },
                          ]},
                          { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
                          "$package",
                        ],
                      }] },
                      { $ne: ["$$pkg.packageName", ""] },
                      { $ne: ["$$pkg.packageName", null] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      { $addFields: { packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] } } },
      // Lookup user to get role of packageSoldBy person
      {
        $lookup: {
          from: "users",
          let: { packageSoldByUserId: "$packageSoldByUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$packageSoldByUserId" }
                  ]
                }
              }
            }
          ],
          as: "packageSoldByUser",
        },
      },
      { $addFields: { packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] } } },
      // Check if billing's selectedTreatments match appointment's services
      {
        $addFields: {
          billingServiceIds: {
            $map: {
              input: { $ifNull: ["$selectedTreatments", []] },
              as: "st",
              in: { $toString: "$$st.treatmentServiceId" },
            },
          },
          appointmentServiceIds: {
            $concatArrays: [
              { $map: {
                input: { $ifNull: ["$appointment.serviceIds", []] },
                as: "sid",
                in: { $toString: "$$sid" },
              }},
              { $map: {
                input: { $ifNull: ["$appointment.services", []] },
                as: "s",
                in: { $toString: "$$s.serviceId" },
              }},
              { $cond: [{ $ifNull: ["$appointment.serviceId", false] }, [{ $toString: "$appointment.serviceId" }], []] },
            ],
          },
        },
      },
      {
        $addFields: {
          isFromAppointment: {
            $or: [
              // Has selectedTreatments matching appointment services
              {
                $and: [
                  // Must have selectedTreatments
                  { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                  // Check if any billingServiceId is in appointmentServiceIds
                  {
                    $gt: [
                      {
                        $size: {
                          $filter: {
                            input: "$billingServiceIds",
                            as: "bsid",
                            cond: { $in: ["$$bsid", "$appointmentServiceIds"] },
                          },
                        },
                      },
                      0,
                    ],
                  },
                ],
              },
              // Clearance-only billing: has pendingClearedBreakdown (pending amount being cleared)
              { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
              // Package billing with appointmentId (packages don't have selectedTreatments)
              {
                $and: [
                  { $eq: ["$service", "Package"] },
                  { $ne: ["$appointmentId", null] },
                ],
              },
            ],
          },
        },
      },
      // Only include billings where treatment/service is from appointment
      { $match: { isFromAppointment: true } },
      // DEBUG: Log pyree package after isFromAppointment filter
      {
        $addFields: {
          _debug_afterIsFromAppointment: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260718-121954"] },
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                package: "$package",
                appointmentId: "$appointmentId",
                pendingClearedBreakdown: "$pendingClearedBreakdown",
                isFromAppointment: "$isFromAppointment",
              },
              "$$REMOVE"
            ]
          }
        }
      },
      // Store billing-level paid amount before $unwind (for capping treatment amounts on partial payments)
      // Include advanceUsed to capture full revenue (paid + advanceUsed)
      { $addFields: { billingPaid: { $add: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$advanceUsed", 0] }] } } },
      // Unwind selectedTreatments to process each treatment independently
      // preserveNullAndEmptyArrays: true so clearance billings (without selectedTreatments) still flow through
      { $unwind: { path: "$selectedTreatments", preserveNullAndEmptyArrays: true } },
      // Check if current treatment is from appointment
      {
        $addFields: {
          isTreatmentFromAppointment: {
            $cond: [
              { $eq: ["$selectedTreatments", null] },
              false,
              {
                $in: [
                  { $toString: "$selectedTreatments.treatmentServiceId" },
                  "$appointmentServiceIds"
                ]
              }
            ]
          },
          // Calculate treatment amount using proportional scaling for partial payments
          // Each treatment gets (treatmentAmount / totalAmount) × paid
          // This ensures sum of all treatments = paid (not more)
          treatmentAmount: {
            $cond: [
              { $eq: ["$selectedTreatments", null] },
              0,
              {
                $multiply: [
                  { $ifNull: ["$billingPaid", 0] },
                  {
                    $divide: [
                      { $multiply: [{ $ifNull: ["$selectedTreatments.price", 0] }, { $ifNull: ["$selectedTreatments.quantity", 1] }] },
                      { $ifNull: ["$originalAmount", "$amount", 1] }
                    ]
                  }
                ]
              }
            ]
          }
        },
      },
      // Include treatments that match appointment services OR are cleared items (from pendingClearedBreakdown)
      {
        $match: {
          $expr: {
            $or: [
              "$isTreatmentFromAppointment",
              { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
            ],
          },
        },
      },
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient"
        }
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      // Extract packageSoldBy info for Package billings
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$patient.packages", []] },
                  as: "pkg",
                  cond: {
                    $and: [
                      { $eq: ["$$pkg.packageName", "$package"] },
                      { $ne: ["$$pkg.packageName", ""] },
                      { $ne: ["$$pkg.packageName", null] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
          packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
        },
      },
      // Lookup user to get role of packageSoldBy person
      {
        $lookup: {
          from: "users",
          localField: "packageSoldByUserId",
          foreignField: "_id",
          as: "packageSoldByUser",
        },
      },
      {
        $addFields: {
          packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] },
        },
      },
      // Filter: For Package billings, only include if seller is a doctor OR if billing has selectedTreatments from appointment (treatment portion goes to doctor)
      {
        $match: {
          $or: [
            { service: { $ne: "Package" } },
            { $and: [{ service: "Package" }, { packageSoldByRole: "doctor" }] },
            // Include Package billings with selectedTreatments from appointments
            {
              $expr: {
                $and: [
                  { $eq: ["$service", "Package"] },
                  { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                  { $ne: [{ $ifNull: ["$appointmentId", null] }, null] }
                ]
              }
            }
          ]
        }
      },
      // For Package billings, calculate effectiveDoctorId and effectiveAmount
      // For mixed billings from appointments: treatment portion goes to appointment's doctorId
      {
        $addFields: {
          effectiveDoctorId: {
            $cond: [
              { $eq: ["$service", "Package"] },
              {
                $cond: [
                  // If mixed billing from appointment, use appointment's doctorId for treatment portion
                  {
                    $expr: {
                      $and: [
                        { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                        { $ne: [{ $ifNull: ["$appointmentId", null] }, null] }
                      ]
                    }
                  },
                  "$doctorId", // Appointment's doctorId for treatment portion
                  "$packageSoldByUserId" // Package portion goes to seller
                ]
              },
              "$doctorId"
            ]
          },
          effectiveDoctorName: {
            $cond: [
              { $eq: ["$service", "Package"] },
              {
                $cond: [
                  {
                    $expr: {
                      $and: [
                        { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                        { $ne: [{ $ifNull: ["$appointmentId", null] }, null] }
                      ]
                    }
                  },
                  "$doctorName", // Appointment's doctor name
                  "$packageSoldByName" // Package seller name
                ]
              },
              "$doctorName"
            ]
          },
          // For mixed billings from appointments, calculate treatment amount (to attribute to doctor)
          treatmentAmount: {
            $cond: [
              {
                $expr: {
                  $and: [
                    { $eq: ["$service", "Package"] },
                    { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                    { $ne: [{ $ifNull: ["$appointmentId", null] }, null] }
                  ]
                }
              },
              {
                $sum: {
                  $map: {
                    input: "$selectedTreatments",
                    as: "st",
                    in: {
                      $multiply: [
                        { $ifNull: ["$$st.price", 0] },
                        { $ifNull: ["$$st.quantity", 1] },
                      ],
                    },
                  },
                },
              },
              0,
            ],
          },
        },
      },
      // $facet to split the billings into two streams so we can produce
      // TWO rows for mixed billings: one for the cleared amount (attributed
      // to the original billing's doctor) and one for the package portion
      // (attributed to the billing's own doctor).
      {
        $facet: {
          // Stream 1: cleared items – one row per breakdown item, attributed
          // to the ORIGINAL billing's doctor with amount = amountCleared.
          cleared: [
            // Only billings WITH a breakdown AND actual pending clearance payment
            // (pendingUsed > 0 distinguishes clearance billings from original billings
            // that just have pendingClearedBreakdown as metadata)
            {
              $match: {
                $expr: {
                  $and: [
                    { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
                    { $gt: [{ $ifNull: ["$pendingUsed", 0] }, 0] },
                  ],
                },
              },
            },
            { $unwind: "$pendingClearedBreakdown" },
            // Lookup the ORIGINAL billing by invoiceNumber to fetch its doctorId and check if it was direct billing
            {
              $lookup: {
                from: "billings",
                let: {
                  invNum: "$pendingClearedBreakdown.invoiceNumber",
                },
                pipeline: [
                  { $match: { $expr: { $eq: ["$invoiceNumber", "$$invNum"] } } },
                  { $project: { doctorId: 1, invoiceNumber: 1, selectedTreatments: 1, appointmentId: 1, service: 1, package: 1 } },
                ],
                as: "originalBilling",
              },
            },
            {
              $addFields: {
                isClearedItem: { $literal: true },
                // Check if original billing was a direct billing (not from appointment)
                // For package billings: check if sold by doctor (not direct) vs agent (direct)
                // For treatment billings: check selectedTreatments and appointmentId
                isOriginalBillingDirect: {
                  $cond: [
                    { $gt: [{ $size: "$originalBilling" }, 0] },
                    {
                      $cond: [
                        // If original billing is a Package, check service type
                        { $eq: [{ $arrayElemAt: ["$originalBilling.service", 0] }, "Package"] },
                        // For packages: treat as NOT direct (goes to doctor revenue)
                        // This preserves existing behavior where package clearances go to doctor
                        false,
                        // For treatment billings: use existing logic
                        {
                          $or: [
                            // No selectedTreatments = direct billing
                            { $eq: [{ $size: { $ifNull: [{ $arrayElemAt: ["$originalBilling.selectedTreatments", 0] }, []] } }, 0] },
                            // No appointmentId = direct billing
                            { $eq: [{ $arrayElemAt: ["$originalBilling.appointmentId", 0] }, null] },
                          ],
                        }
                      ],
                    },
                    false, // No original billing found, assume not direct
                  ],
                },
                // Only attribute clearance to doctor if original billing was from appointment (not direct)
                // OR if it's an unpaid package billing sold by a doctorStaff person
                effectiveDoctorId: {
                  $cond: [
                    {
                      $and: [
                        { $gt: [{ $size: "$originalBilling" }, 0] },
                        { $ne: [{ $arrayElemAt: ["$originalBilling.doctorId", 0] }, null] },
                        // Original billing must NOT be a direct billing
                        { $eq: ["$isOriginalBillingDirect", false] },
                      ],
                    },
                    { $arrayElemAt: ["$originalBilling.doctorId", 0] },
                    // For unpaid package billings where package was sold by doctorStaff, use packageSoldByUserId
                    {
                      $cond: [
                        {
                          $and: [
                            { $eq: ["$service", "Package"] },
                            { $eq: ["$packageSoldByRole", "doctorStaff"] },
                            { $ne: ["$packageSoldByUserId", null] },
                          ],
                        },
                        { $toObjectId: "$packageSoldByUserId" },
                        null, // Original was direct billing → clearance goes to staff, not doctor
                      ],
                    },
                  ],
                },
                effectiveAmount: { $ifNull: ["$pendingClearedBreakdown.amountCleared", 0] },
                // DEBUG fields
                _debug_originalDoctorId: { $arrayElemAt: ["$originalBilling.doctorId", 0] },
                _debug_appointmentDoctorId: "$appointment.doctorId",
                _debug_isOriginalBillingDirect: "$isOriginalBillingDirect",
                _debug_effectiveDoctorId: "$effectiveDoctorId",
              },
            },
            // Exclude clearance billings from direct billings (effectiveDoctorId = null)
            // These should go to staff revenue, not doctor revenue
            { $match: { effectiveDoctorId: { $ne: null } } },
          ],
          // Stream 2: non-cleared items – one row per non-cleared billing.
          // For mixed billings, this stream ALSO produces a row for the
          // PACKAGE portion (paid - cleared) attributed to the billing's
          // own doctor. This is added via $unionWith below.
          nonCleared: [
            // Non-cleared billings (no breakdown) OR original billings that were cleared
            // (have pendingClearedBreakdown as metadata but pendingUsed = 0)
            {
              $match: {
                $expr: {
                  $or: [
                    // No pendingClearedBreakdown = regular billing
                    { $lte: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
                    // Has pendingClearedBreakdown but pendingUsed = 0 = original billing that was cleared
                    { $eq: [{ $ifNull: ["$pendingUsed", 0] }, 0] },
                  ],
                },
              },
            },
            // Store billing-level paid amount for capping treatment amounts on partial payments
            // Include advanceUsed to capture full revenue (paid + advanceUsed)
            { $addFields: { billingPaid: { $add: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$advanceUsed", 0] }] } } },
            {
              $addFields: {
                isClearedItem: { $literal: false },
                effectiveDoctorId: "$appointment.doctorId",
                // Compute amount using proportional scaling for partial payments
                // Each treatment gets (treatmentAmount / totalAmount) × paid
                effectiveAmount: {
                  $cond: [
                    { $eq: ["$selectedTreatments", null] },
                    "$billingPaid",
                    {
                      $multiply: [
                        { $ifNull: ["$billingPaid", 0] },
                        {
                          $divide: [
                            { $multiply: [{ $ifNull: ["$selectedTreatments.price", 0] }, { $ifNull: ["$selectedTreatments.quantity", 1] }] },
                            { $ifNull: ["$originalAmount", "$amount", 1] }
                          ]
                        }
                      ]
                    }
                  ]
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
                              { $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }},
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
            // Add treatment portion for mixed billings (Package + Treatment) where treatment is appointment-based
            // Treatment revenue goes to doctor, package revenue goes to staff (sold by person)
            {
              $unionWith: {
                coll: "billings",
                pipeline: [
                  // Match clinic + date range
                  { $match: { ...clinicMatch, ...dateMatch } },
                  // Only mixed billings (service = Package AND has selectedTreatments AND has appointmentId)
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$service", "Package"] },
                          { $gt: [{ $size: {
                            $cond: [
                              { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                              { $ifNull: ["$selectedTreatments", []] },
                              []
                            ]
                          }}, 0] },
                          { $ne: [{ $ifNull: ["$appointmentId", null] }, null] },
                          // Exclude clearance billings (already handled above)
                          { $lte: [{ $size: {
                            $cond: [
                              { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                              { $ifNull: ["$pendingClearedBreakdown", []] },
                              []
                            ]
                          }}, 0] },
                        ],
                      },
                    },
                  },
                  // Lookup appointment to get serviceIds
                  {
                    $lookup: {
                      from: "appointments",
                      localField: "appointmentId",
                      foreignField: "_id",
                      as: "appointment",
                    },
                  },
                  { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
                  // Extract appointment service IDs
                  {
                    $addFields: {
                      appointmentServiceIds: {
                        $concatArrays: [
                          { $map: {
                            input: { $ifNull: ["$appointment.serviceIds", []] },
                            as: "sid",
                            in: { $toString: "$$sid" },
                          }},
                          { $map: {
                            input: { $ifNull: ["$appointment.services", []] },
                            as: "s",
                            in: { $toString: "$$s.serviceId" },
                          }},
                          { $cond: [{ $ifNull: ["$appointment.serviceId", false] }, [{ $toString: "$appointment.serviceId" }], []] },
                        ],
                      },
                    },
                  },
                  // Unwind selectedTreatments to check each treatment
                  { $unwind: { path: "$selectedTreatments", preserveNullAndEmptyArrays: true } },
                  // Filter to only include appointment-based treatments
                  {
                    $match: {
                      $expr: {
                        $in: [
                          { $toString: "$selectedTreatments.treatmentServiceId" },
                          "$appointmentServiceIds"
                        ]
                      }
                    }
                  },
                  // Lookup patient for packageSoldBy info
                  {
                    $lookup: {
                      from: "patientregistrations",
                      localField: "patientId",
                      foreignField: "_id",
                      as: "patient",
                    },
                  },
                  { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
                  // Extract packageSoldBy info
                  {
                    $addFields: {
                      packageSoldBy: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: { $ifNull: ["$patient.packages", []] },
                              as: "pkg",
                              cond: {
                                $and: [
                                  { $eq: ["$$pkg.packageName", "$package"] },
                                  { $ne: ["$$pkg.packageName", ""] },
                                  { $ne: ["$$pkg.packageName", null] },
                                ],
                              },
                            },
                          },
                          0,
                        ],
                      },
                    },
                  },
                  {
                    $addFields: {
                      packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
                      packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
                    },
                  },
                  // Store billing-level paid amount
                  { $addFields: { billingPaid: { $add: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$advanceUsed", 0] }] } } },
                  // Group by invoiceNumber to calculate total treatment amount for appointment-based treatments
                  {
                    $group: {
                      _id: "$invoiceNumber",
                      invoiceNumber: { $first: "$invoiceNumber" },
                      clinicId: { $first: "$clinicId" },
                      patientId: { $first: "$patientId" },
                      patient: { $first: "$patient" },
                      appointment: { $first: "$appointment" },
                      invoicedBy: { $first: "$invoicedBy" },
                      invoicedById: { $first: "$invoicedById" },
                      invoicedByRole: { $first: "$invoicedByRole" },
                      packageSoldByName: { $first: "$packageSoldByName" },
                      packageSoldByUserId: { $first: "$packageSoldByUserId" },
                      packageSoldByRole: { $first: "$packageSoldByRole" },
                      package: { $first: "$package" },
                      treatment: { $first: "$treatment" },
                      service: { $first: "$service" },
                      billingPaid: { $first: "$billingPaid" },
                      totalTreatmentAmount: {
                        $sum: {
                          $multiply: [
                            { $ifNull: ["$billingPaid", 0] },
                            {
                              $divide: [
                                { $multiply: [{ $ifNull: ["$selectedTreatments.price", 0] }, { $ifNull: ["$selectedTreatments.quantity", 1] }] },
                                { $ifNull: ["$originalAmount", "$amount", 1] }
                              ]
                            }
                          ]
                        }
                      },
                      invoicedDate: { $first: "$invoicedDate" },
                    },
                  },
                  // Compute treatment portion amount (attributed to doctor)
                  {
                    $addFields: {
                      isClearedItem: { $literal: false },
                      effectiveDoctorId: "$appointment.doctorId",
                      selectedTreatments: null, // Mark as treatment portion (not package)
                      effectiveAmount: "$totalTreatmentAmount",
                    },
                  },
                  // Only include if treatment amount > 0
                  { $match: { effectiveAmount: { $gt: 0 } } },
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
          amount: {
            $sum: "$effectiveAmount",
          },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              service: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.service", "$service"] },
                  // For treatment portions (selectedTreatments is null from $unionWith), show "Treatment"
                  // For package portions and regular billings, show original service
                  {
                    $cond: [
                      { $eq: ["$selectedTreatments", null] },
                      "Treatment",
                      "$service"
                    ]
                  }
                ]
              },
              packageName: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.packageName", null] },
                  // For treatment portions (selectedTreatments is null), show null (treatment name shown instead)
                  // For package portions and regular billings, show package name
                  {
                    $cond: [
                      { $eq: ["$selectedTreatments", null] },
                      null,
                      "$package"
                    ]
                  }
                ],
              },
              treatmentName: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.treatmentName", null] },
                  // For treatment portions (selectedTreatments is null), show treatment name
                  // For package portions and regular billings, show treatment name if available
                  {
                    $cond: [
                      { $eq: ["$selectedTreatments", null] },
                      "$treatment",
                      { $ifNull: ["$selectedTreatments.treatmentName", "$treatment"] }
                    ]
                  }
                ],
              },
              treatmentServiceId: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.treatmentServiceId", null] },
                  { $ifNull: ["$selectedTreatments.treatmentServiceId", null] },
                ],
              },
              treatmentQuantity: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.quantity", 1] },
                  { $ifNull: ["$selectedTreatments.quantity", 1] },
                ],
              },
              treatmentPrice: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$pendingClearedBreakdown.price", 0] },
                  { $ifNull: ["$selectedTreatments.price", 0] },
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
              paid: "$effectiveAmount",
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
              // DEBUG fields for tracing clearance attribution
              _debug_originalDoctorId: "$_debug_originalDoctorId",
              _debug_appointmentDoctorId: "$_debug_appointmentDoctorId",
              _debug_doctorsMatch: "$_debug_doctorsMatch",
              _debug_effectiveDoctorId: "$effectiveDoctorId",
            }
          }
        }
      },
      { $sort: { amount: -1 } },
    ]);

    // SEPARATE PIPELINE: Unpaid package billings without appointment (sold by doctorStaff)
    // These billings don't have an appointment, so they're excluded from the main byDoctorAgg pipeline
    // Revenue is attributed based on who sold the package, not based on appointment
    const unpaidPackageByDoctorAgg = await Billing.aggregate([
      // Match clinic + date range
      { $match: { ...clinicMatch, ...dateMatch } },
      // Only unpaid package billings (service: "Package", package: "", unpaidPackagesPaid: [...])
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$service", "Package"] },
              { $or: [{ $eq: ["$package", ""] }, { $eq: ["$package", null] }] },
              { $gt: [{ $size: { $ifNull: ["$unpaidPackagesPaid", []] } }, 0] },
            ],
          },
        },
      },
      // Lookup patient to extract packageSoldBy info
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: "$patientId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$patientId" }
                  ]
                }
              }
            }
          ],
          as: "patient",
        },
      },
      { $addFields: { patient: { $arrayElemAt: ["$patient", 0] } } },
      // Extract packageSoldBy info
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$patient.packages", []] },
                  as: "pkg",
                  cond: {
                    $and: [
                      { $eq: ["$$pkg.packageName", { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] }] },
                      { $ne: ["$$pkg.packageName", ""] },
                      { $ne: ["$$pkg.packageName", null] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      { $addFields: { packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] } } },
      // Lookup user to get role of packageSoldBy person
      {
        $lookup: {
          from: "users",
          let: { packageSoldByUserId: "$packageSoldByUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$packageSoldByUserId" }
                  ]
                }
              }
            }
          ],
          as: "packageSoldByUser",
        },
      },
      { $addFields: { packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] } } },
      // Only include billings where package was sold by doctorStaff
      { $match: { packageSoldByRole: "doctorStaff", packageSoldByUserId: { $ne: null } } },
      // Lookup patient for display fields
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: "$patientId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$patientId" }
                  ]
                }
              }
            }
          ],
          as: "patientInfo",
        },
      },
      { $addFields: { patientInfo: { $arrayElemAt: ["$patientInfo", 0] } } },
      // Group by packageSoldByUserId
      {
        $group: {
          _id: { $toObjectId: "$packageSoldByUserId" },
          amount: { $sum: "$amount" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patientInfo.firstName", " ", { $ifNull: ["$patientInfo.lastName", ""] }] },
              emrNumber: "$patientInfo.emrNumber",
              service: "Package",
              packageName: { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
              treatmentName: null,
              invoiceNumber: "$invoiceNumber",
              invoicedDate: "$invoicedDate",
              amount: "$amount",
              paid: "$paid",
              pending: { $ifNull: ["$pending", 0] },
              advance: { $ifNull: ["$advance", 0] },
              advanceUsed: { $ifNull: ["$advanceUsed", 0] },
              claimAmountUsed: { $ifNull: ["$claimAmountUsed", 0] },
              cashbackWalletUsed: { $ifNull: ["$cashbackWalletUsed", 0] },
              pendingUsed: { $ifNull: ["$pendingUsed", 0] },
              pendingClaimUsed: { $ifNull: ["$pendingClaimUsed", 0] },
              isClearedItem: false,
            },
          },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    // DEBUG: Log byDoctorAgg results to see what the cleared stream returned
    console.log("DEBUG byDoctorAgg - total results:", byDoctorAgg.length);
    console.log("DEBUG byDoctorAgg - results:", byDoctorAgg.map(d => ({
      id: String(d._id),
      amount: d.amount,
      invoices: d.invoices,
      details: d.details?.filter(det => det.isClearedItem).map(det => ({ invoiceNumber: det.invoiceNumber, packageName: det.packageName, amount: det.amount, isClearedItem: det.isClearedItem }))
    })));

    // Merge unpaid package billings into byDoctorAgg results
    if (unpaidPackageByDoctorAgg.length > 0) {
      for (const unpaidDoc of unpaidPackageByDoctorAgg) {
        const existingDoctor = byDoctorAgg.find(d => String(d._id) === String(unpaidDoc._id));
        if (existingDoctor) {
          // Add to existing doctor's revenue
          existingDoctor.amount += unpaidDoc.amount;
          existingDoctor.details.push(...unpaidDoc.details);
        } else {
          // Add new doctor entry
          byDoctorAgg.push(unpaidDoc);
        }
      }
    }

    // SEPARATE PIPELINE: Mixed billing package portion (sold by doctorStaff)
    // For mixed billings (Package + Treatment), treatment revenue goes to doctor (appointment-based)
    // Package revenue should go to the person who sold the package
    const mixedPackageByDoctorAgg = await Billing.aggregate([
      // Match clinic + date range
      { $match: { ...clinicMatch, ...dateMatch } },
      // Only mixed billings (service: "Package", package: not empty, has selectedTreatments)
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$service", "Package"] },
              { $ne: ["$package", ""] },
              { $ne: ["$package", null] },
              { $gt: [{ $size: { $ifNull: ["$selectedTreatments", []] } }, 0] },
            ],
          },
        },
      },
      // Lookup appointment to get doctorId for treatment portion calculation
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
      // Lookup patient to extract packageSoldBy info
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: "$patientId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$patientId" }
                  ]
                }
              }
            }
          ],
          as: "patient",
        },
      },
      { $addFields: { patient: { $arrayElemAt: ["$patient", 0] } } },
      // Extract packageSoldBy info
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$patient.packages", []] },
                  as: "pkg",
                  cond: {
                    $and: [
                      { $eq: ["$$pkg.packageName", "$package"] },
                      { $ne: ["$$pkg.packageName", ""] },
                      { $ne: ["$$pkg.packageName", null] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      { $addFields: { packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] } } },
      // Lookup user to get role of packageSoldBy person
      {
        $lookup: {
          from: "users",
          let: { packageSoldByUserId: "$packageSoldByUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$packageSoldByUserId" }
                  ]
                }
              }
            }
          ],
          as: "packageSoldByUser",
        },
      },
      { $addFields: { packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] } } },
      // Only include billings where package was sold by doctorStaff or agent
      { $match: { 
        $expr: {
          $and: [
            { $in: ["$packageSoldByRole", ["doctorStaff", "agent"]] },
            { $ne: ["$packageSoldByUserId", null] },
          ],
        },
      } },
      // Calculate treatment portion amount and package portion amount
      {
        $addFields: {
          billingPaid: { $add: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$advanceUsed", 0] }] },
          treatmentAmount: {
            $sum: {
              $map: {
                input: { $ifNull: ["$selectedTreatments", []] },
                as: "st",
                in: {
                  $multiply: [
                    { $ifNull: ["$$st.price", 0] },
                    { $ifNull: ["$$st.quantity", 1] },
                  ],
                },
              },
            },
          },
        },
      },
      {
        $addFields: {
          // Package portion = total paid - treatment portion
          packageAmount: {
            $multiply: [
              { $ifNull: ["$billingPaid", 0] },
              {
                $divide: [
                  { $subtract: [{ $ifNull: ["$originalAmount", "$amount", 1] }, "$treatmentAmount"] },
                  { $ifNull: ["$originalAmount", "$amount", 1] },
                ],
              },
            ],
          },
        },
      },
      // Only include if package amount > 0
      { $match: { packageAmount: { $gt: 0 } } },
      // Lookup patient for display fields
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: "$patientId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$patientId" }
                  ]
                }
              }
            }
          ],
          as: "patientInfo",
        },
      },
      { $addFields: { patientInfo: { $arrayElemAt: ["$patientInfo", 0] } } },
      // Group by packageSoldByUserId
      {
        $group: {
          _id: { $toObjectId: "$packageSoldByUserId" },
          role: { $first: "$packageSoldByRole" },
          amount: { $sum: "$packageAmount" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patientInfo.firstName", " ", { $ifNull: ["$patientInfo.lastName", ""] }] },
              emrNumber: "$patientInfo.emrNumber",
              service: "Package",
              packageName: "$package",
              treatmentName: null,
              invoiceNumber: "$invoiceNumber",
              invoicedDate: "$invoicedDate",
              amount: "$packageAmount",
              paid: "$packageAmount",
              pending: 0,
              advance: 0,
              advanceUsed: 0,
              claimAmountUsed: 0,
              cashbackWalletUsed: 0,
              pendingUsed: 0,
              pendingClaimUsed: 0,
              isClearedItem: false,
            },
          },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    // SEPARATE PIPELINE: Package billing from patient profile view (no appointment, no treatments)
    // For packages added via patient-profile-view page, revenue goes to the person who sold the package
    // - doctorStaff → Revenue by Doctor
    // - agent → Revenue by Staff
    // Using regular queries instead of aggregation pipeline for better debugging
    const patientProfileBillings = await Billing.find({
      ...clinicMatch,
      ...dateMatch,
      service: "Package",
      package: { $ne: "", $ne: null },
      appointmentId: null,
      selectedTreatments: { $size: 0 },
      unpaidPackagesPaid: { $size: 0 },
      pendingClearedBreakdown: { $size: 0 },
    }).lean();

    const patientProfilePackageAgg = [];
    if (patientProfileBillings.length > 0) {
      // Get unique patient IDs
      const patientIds = [...new Set(patientProfileBillings.map(b => b.patientId))];
      // Lookup patients to get packageSoldBy info AND patient details
      const patients = await PatientRegistration.find({ _id: { $in: patientIds } }).select("_id packages firstName lastName emrNumber").lean();
      const patientMap = new Map(patients.map(p => [String(p._id), p]));
      // Separate map for patient name/emrNumber (to avoid conflicts with existing patient variable used for package matching)
      const patientDetailsMap = new Map(patients.map(p => [String(p._id), { 
        name: `${p.firstName || ''} ${p.lastName || ''}`.trim(),
        emrNumber: p.emrNumber 
      }]));

      // Group billings by effectiveSoldByUserId
      const groupedBillings = new Map();
      for (const billing of patientProfileBillings) {
        const patient = patientMap.get(String(billing.patientId));
        const matchedPackage = patient?.packages?.find(pkg => pkg.packageName === billing.package);
        const packageSoldByUserId = matchedPackage?.packageSoldByUserId;

        // Determine effectiveSoldByUserId: use packageSoldByUserId if valid, otherwise fall back to invoicedById
        let effectiveSoldByUserId = null;
        if (packageSoldByUserId && packageSoldByUserId !== "undefined" && packageSoldByUserId !== "") {
          effectiveSoldByUserId = packageSoldByUserId;
        } else if (billing.invoicedById) {
          effectiveSoldByUserId = String(billing.invoicedById);
        }

        if (!effectiveSoldByUserId) continue;

        if (!groupedBillings.has(effectiveSoldByUserId)) {
          groupedBillings.set(effectiveSoldByUserId, {
            _id: new mongoose.Types.ObjectId(effectiveSoldByUserId),
            amount: 0,
            invoices: 0,
            details: [],
          });
        }

        const group = groupedBillings.get(effectiveSoldByUserId);
        group.amount += billing.paid || 0;
        group.invoices += 1;
        // Get patient details from patientDetailsMap (billing from patient-profile-view doesn't have patientName/emrNumber)
        const patientDetails = patientDetailsMap.get(String(billing.patientId));
        console.log(`DEBUG patientProfilePackage - billing: ${billing.invoiceNumber}, patientId: ${billing.patientId}, patientDetails:`, patientDetails, 'billing.patientName:', billing.patientName);
        group.details.push({
          patientId: String(billing.patientId),
          patientName: patientDetails?.name || billing.patientName || "Unknown",
          emrNumber: patientDetails?.emrNumber || billing.emrNumber || "",
          service: "Package",
          packageName: billing.package,
          treatmentName: null,
          invoiceNumber: billing.invoiceNumber,
          invoicedDate: billing.invoicedDate,
          amount: billing.amount,
          paid: billing.paid,
          pending: billing.pending,
          advance: billing.advance,
          advanceUsed: billing.advanceUsed,
          claimAmountUsed: billing.claimAmountUsed,
          pendingUsed: billing.pendingUsed,
          pendingClaimUsed: billing.pendingClaimUsed,
          paymentMethod: billing.paymentMethod,
          isClearedItem: false,
        });
      }

      // Lookup users to get roles
      const userIds = [...groupedBillings.keys()];
      const users = await User.find({ _id: { $in: userIds.map(id => new mongoose.Types.ObjectId(id)) } }).select("_id role").lean();
      const userRoleMap = new Map(users.map(u => [String(u._id), u.role]));

      // DEBUG: Check user roles
      console.log("DEBUG patientProfilePackageAgg - userIds:", userIds);
      console.log("DEBUG patientProfilePackageAgg - users found:", users.map(u => ({ id: String(u._id), role: u.role })));
      console.log("DEBUG patientProfilePackageAgg - userRoleMap:", [...userRoleMap.entries()]);

      // Build final aggregation result with role
      for (const [userId, group] of groupedBillings) {
        const role = userRoleMap.get(userId);
        console.log(`DEBUG patientProfilePackageAgg - userId: ${userId}, role: ${role}, amount: ${group.amount}`);
        if (role === "doctorStaff" || role === "agent") {
          patientProfilePackageAgg.push({
            ...group,
            role,
          });
        }
      }
      console.log("DEBUG patientProfilePackageAgg final results:", patientProfilePackageAgg.length, patientProfilePackageAgg.map(p => ({ id: String(p._id), role: p.role, amount: p.amount })));
    }

    // SEPARATE PIPELINE: Package clearance billings (pending amount cleared for packages)
    // When a package's pending amount is cleared, attribute revenue based on packageSoldByRole
    // This handles the edge case where clearing pending amount was incorrectly removing previous revenue
    
    // DEBUG: Check if clearance billings exist
    const clearanceBillingsCheck = await Billing.find({
      ...clinicMatch,
      ...dateMatch,
      pendingUsed: { $gt: 0 },
    }).select("invoiceNumber service pendingClearedBreakdown pendingUsed").lean();
    console.log("DEBUG packageClearanceAgg - clearance billings with pendingUsed > 0:", clearanceBillingsCheck.length);
    console.log("DEBUG packageClearanceAgg - clearance billings:", clearanceBillingsCheck.map(b => ({
      invoiceNumber: b.invoiceNumber,
      service: b.service,
      pendingUsed: b.pendingUsed,
      hasBreakdown: b.pendingClearedBreakdown?.length > 0,
      breakdownService: b.pendingClearedBreakdown?.[0]?.service
    })));
    
    const packageClearanceAgg = await Billing.aggregate([
      // Match clinic + date range
      { $match: { ...clinicMatch, ...dateMatch } },
      // Only clearance billings with pendingClearedBreakdown where service is Package
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
              { $gt: [{ $ifNull: ["$pendingUsed", 0] }, 0] },
              { $eq: [{ $arrayElemAt: ["$pendingClearedBreakdown.service", 0] }, "Package"] },
            ],
          },
        },
      },
      // Unwind pendingClearedBreakdown
      { $unwind: "$pendingClearedBreakdown" },
      // Filter to only Package breakdown items
      { $match: { "pendingClearedBreakdown.service": "Package" } },
      // Lookup the ORIGINAL billing by invoiceNumber to get package info
      {
        $lookup: {
          from: "billings",
          let: { invNum: "$pendingClearedBreakdown.invoiceNumber" },
          pipeline: [
            { $match: { $expr: { $eq: ["$invoiceNumber", "$$invNum"] } } },
            { $project: { service: 1, package: 1, appointmentId: 1, selectedTreatments: 1, patientId: 1 } },
          ],
          as: "originalBilling",
        },
      },
      // DEBUG: Log after original billing lookup
      {
        $addFields: {
          _debug_originalBillingCount: { $size: "$originalBilling" },
          _debug_originalBillingService: { $arrayElemAt: ["$originalBilling.service", 0] },
          _debug_originalBillingAppointmentId: { $arrayElemAt: ["$originalBilling.appointmentId", 0] },
          _debug_originalBillingPackage: { $arrayElemAt: ["$originalBilling.package", 0] },
        }
      },
      // Only process if original billing is a Package service billing
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: "$originalBilling" }, 0] },
              { $eq: [{ $arrayElemAt: ["$originalBilling.service", 0] }, "Package"] },
            ],
          },
        },
      },
      // Lookup patient to extract packageSoldBy info from original billing's patient
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: { $arrayElemAt: ["$originalBilling.patientId", 0] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$patientId" }
                  ]
                }
              }
            }
          ],
          as: "patient",
        },
      },
      { $addFields: { patient: { $arrayElemAt: ["$patient", 0] } } },
      // Extract packageSoldBy info from original billing's package
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$patient.packages", []] },
                  as: "pkg",
                  cond: {
                    $and: [
                      { $eq: ["$$pkg.packageName", { $arrayElemAt: ["$originalBilling.package", 0] }] },
                      { $ne: ["$$pkg.packageName", ""] },
                      { $ne: ["$$pkg.packageName", null] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      { $addFields: { packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] } } },
      // DEBUG: Log packageSoldByUserId extraction
      {
        $addFields: {
          _debug_packageSoldByUserId: "$packageSoldByUserId",
          _debug_packageSoldByName: "$packageSoldBy.packageSoldBy",
        }
      },
      // Lookup user to get role of packageSoldBy person
      // If packageSoldByUserId is valid, match by _id; otherwise match by name
      {
        $lookup: {
          from: "users",
          let: { 
            packageSoldByUserId: "$packageSoldByUserId",
            packageSoldByName: "$packageSoldBy.packageSoldBy"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // If packageSoldByUserId is valid, match by _id
                    { $and: [
                      { $ne: [{ $toString: "$$packageSoldByUserId" }, "null"] },
                      { $ne: ["$$packageSoldByUserId", null] },
                      { $eq: [{ $toString: "$_id" }, { $toString: "$$packageSoldByUserId" }] }
                    ]},
                    // If packageSoldByUserId is null, match by name
                    { $and: [
                      { $ne: ["$$packageSoldByName", null] },
                      { $ne: ["$$packageSoldByName", ""] },
                      { $eq: ["$name", "$$packageSoldByName"] }
                    ]}
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: "packageSoldByUser",
        },
      },
      { $addFields: { 
        packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] },
        // If packageSoldByUserId was null, use the found user's _id
        resolvedPackageSoldByUserId: {
          $cond: [
            { $and: [
              { $eq: ["$packageSoldByUserId", null] },
              { $gt: [{ $size: "$packageSoldByUser" }, 0] }
            ]},
            { $arrayElemAt: ["$packageSoldByUser._id", 0] },
            "$packageSoldByUserId"
          ]
        }
      } },
      // DEBUG: Log packageSoldByRole before match
      {
        $addFields: {
          _debug_packageSoldByRole: "$packageSoldByRole",
        }
      },
      // Only include billings where package was sold by doctorStaff or agent
      { $match: { 
        $expr: {
          $and: [
            { $in: ["$packageSoldByRole", ["doctorStaff", "agent"]] },
            { $ne: ["$resolvedPackageSoldByUserId", null] },
          ],
        },
      } },
      // Lookup patient for display fields
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: { $arrayElemAt: ["$originalBilling.patientId", 0] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$patientId" }
                  ]
                }
              }
            }
          ],
          as: "patientInfo",
        },
      },
      { $addFields: { patientInfo: { $arrayElemAt: ["$patientInfo", 0] } } },
      // DEBUG: Output intermediate results before grouping
      {
        $addFields: {
          _debug_invoiceNumber: "$invoiceNumber",
          _debug_pendingClearedInvoiceNumber: "$pendingClearedBreakdown.invoiceNumber",
          _debug_amountCleared: "$pendingClearedBreakdown.amountCleared",
          _debug_packageSoldByUserId: "$packageSoldByUserId",
          _debug_packageSoldByRole: "$packageSoldByRole",
        }
      },
      // Group by packageSoldByUserId
      {
        $group: {
          _id: { $toObjectId: "$resolvedPackageSoldByUserId" },
          role: { $first: "$packageSoldByRole" },
          amount: { $sum: "$pendingClearedBreakdown.amountCleared" },
          invoices: { $sum: 1 },
          details: {
            $push: {
              patientId: { $arrayElemAt: ["$originalBilling.patientId", 0] },
              patientName: { $concat: ["$patientInfo.firstName", " ", { $ifNull: ["$patientInfo.lastName", ""] }] },
              emrNumber: "$patientInfo.emrNumber",
              service: "Package",
              packageName: { $arrayElemAt: ["$originalBilling.package", 0] },
              treatmentName: null,
              invoiceNumber: "$pendingClearedBreakdown.invoiceNumber",
              invoicedDate: "$invoicedDate",
              amount: "$pendingClearedBreakdown.amountCleared",
              paid: "$pendingClearedBreakdown.amountCleared",
              pending: 0,
              advance: 0,
              advanceUsed: 0,
              claimAmountUsed: 0,
              cashbackWalletUsed: 0,
              pendingUsed: "$pendingUsed",
              pendingClaimUsed: 0,
              isClearedItem: true,
            },
          },
        },
      },
      { $sort: { amount: -1 } },
    ]);

    // DEBUG: Run pipeline without group to see intermediate results
    const packageClearanceDebug = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
              { $gt: [{ $ifNull: ["$pendingUsed", 0] }, 0] },
              { $eq: [{ $arrayElemAt: ["$pendingClearedBreakdown.service", 0] }, "Package"] },
            ],
          },
        },
      },
      { $unwind: "$pendingClearedBreakdown" },
      { $match: { "pendingClearedBreakdown.service": "Package" } },
      {
        $lookup: {
          from: "billings",
          let: { invNum: "$pendingClearedBreakdown.invoiceNumber" },
          pipeline: [
            { $match: { $expr: { $eq: ["$invoiceNumber", "$$invNum"] } } },
            { $project: { service: 1, package: 1, appointmentId: 1, selectedTreatments: 1, patientId: 1 } },
          ],
          as: "originalBilling",
        },
      },
      {
        $addFields: {
          _debug_originalBillingCount: { $size: "$originalBilling" },
          _debug_originalBillingService: { $arrayElemAt: ["$originalBilling.service", 0] },
          _debug_originalBillingAppointmentId: { $arrayElemAt: ["$originalBilling.appointmentId", 0] },
        }
      },
      // Log after original billing lookup - BEFORE the package-only filter
    ]);
    console.log("DEBUG packageClearanceAgg - after original billing lookup (BEFORE package-only filter):", packageClearanceDebug.length);
    console.log("DEBUG packageClearanceAgg - debug details:", packageClearanceDebug.map(d => ({
      invoiceNumber: d.invoiceNumber,
      pendingClearedInvoiceNumber: d.pendingClearedBreakdown?.invoiceNumber,
      amountCleared: d.pendingClearedBreakdown?.amountCleared,
      originalBillingCount: d._debug_originalBillingCount,
      originalBillingService: d._debug_originalBillingService,
      originalBillingAppointmentId: d._debug_originalBillingAppointmentId,
      originalBillingAppointmentIdType: typeof d._debug_originalBillingAppointmentId,
    })));

    // DEBUG: Run pipeline with patient lookup to check if patient is found
    const packageClearancePatientDebug = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
              { $gt: [{ $ifNull: ["$pendingUsed", 0] }, 0] },
              { $eq: [{ $arrayElemAt: ["$pendingClearedBreakdown.service", 0] }, "Package"] },
            ],
          },
        },
      },
      { $unwind: "$pendingClearedBreakdown" },
      { $match: { "pendingClearedBreakdown.service": "Package" } },
      {
        $lookup: {
          from: "billings",
          let: { invNum: "$pendingClearedBreakdown.invoiceNumber" },
          pipeline: [
            { $match: { $expr: { $eq: ["$invoiceNumber", "$$invNum"] } } },
            { $project: { service: 1, package: 1, appointmentId: 1, selectedTreatments: 1, patientId: 1 } },
          ],
          as: "originalBilling",
        },
      },
      {
        $match: {
          $expr: {
            $and: [
              { $gt: [{ $size: "$originalBilling" }, 0] },
              { $eq: [{ $arrayElemAt: ["$originalBilling.service", 0] }, "Package"] },
              { $eq: [{ $ifNull: [{ $arrayElemAt: ["$originalBilling.appointmentId", 0] }, null] }, null] },
              { $eq: [{ $size: { $ifNull: [{ $arrayElemAt: ["$originalBilling.selectedTreatments", 0] }, []] } }, 0] },
            ],
          },
        },
      },
      // Lookup patient
      {
        $lookup: {
          from: "patientregistrations",
          let: { patientId: { $arrayElemAt: ["$originalBilling.patientId", 0] } },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$patientId" }
                  ]
                }
              }
            }
          ],
          as: "patient",
        },
      },
      { $addFields: { patient: { $arrayElemAt: ["$patient", 0] } } },
      // Extract packageSoldBy
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$patient.packages", []] },
                  as: "pkg",
                  cond: {
                    $and: [
                      { $eq: ["$$pkg.packageName", { $arrayElemAt: ["$originalBilling.package", 0] }] },
                      { $ne: ["$$pkg.packageName", ""] },
                      { $ne: ["$$pkg.packageName", null] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      { $addFields: { packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] } } },
      // Lookup user
      {
        $lookup: {
          from: "users",
          let: { packageSoldByUserId: "$packageSoldByUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$packageSoldByUserId" }
                  ]
                }
              }
            }
          ],
          as: "packageSoldByUser",
        },
      },
      { $addFields: { packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] } } },
    ]);
    console.log("DEBUG packageClearanceAgg - patient/packageSoldBy debug:", packageClearancePatientDebug.length);
    console.log("DEBUG packageClearanceAgg - patient/packageSoldBy details:", packageClearancePatientDebug.map(d => ({
      invoiceNumber: d.invoiceNumber,
      originalBillingPatientId: d.originalBilling?.[0]?.patientId,
      originalBillingPackage: d.originalBilling?.[0]?.package,
      patientFound: !!d.patient,
      patientPackagesCount: d.patient?.packages?.length || 0,
      packageSoldBy: d.packageSoldBy ? { packageName: d.packageSoldBy.packageName, packageSoldBy: d.packageSoldBy.packageSoldBy, packageSoldByUserId: d.packageSoldBy.packageSoldByUserId } : null,
      packageSoldByUserId: d.packageSoldByUserId,
      packageSoldByRole: d.packageSoldByRole,
    })));

    // DEBUG: Check package-only filter conditions manually
    const afterPackageOnlyFilter = packageClearanceDebug.filter(d => {
      const hasOriginalBilling = d._debug_originalBillingCount > 0;
      const isPackageService = d._debug_originalBillingService === "Package";
      const noAppointmentId = d._debug_originalBillingAppointmentId === null || d._debug_originalBillingAppointmentId === undefined;
      return hasOriginalBilling && isPackageService && noAppointmentId;
    });
    console.log("DEBUG packageClearanceAgg - after manual package-only filter:", afterPackageOnlyFilter.length);
    console.log("DEBUG packageClearanceAgg - manual filter details:", afterPackageOnlyFilter.map(d => ({
      invoiceNumber: d.invoiceNumber,
      hasOriginalBilling: d._debug_originalBillingCount > 0,
      isPackageService: d._debug_originalBillingService === "Package",
      noAppointmentId: d._debug_originalBillingAppointmentId === null || d._debug_originalAppointmentId === undefined,
      appointmentIdValue: d._debug_originalBillingAppointmentId,
    })));

    // DEBUG: Log packageClearanceAgg results
    console.log("DEBUG packageClearanceAgg - total results:", packageClearanceAgg.length);
    console.log("DEBUG packageClearanceAgg - results:", packageClearanceAgg.map(p => ({
      id: String(p._id),
      role: p.role,
      amount: p.amount,
      invoices: p.invoices,
      details: p.details?.map(d => ({ invoiceNumber: d.invoiceNumber, packageName: d.packageName, amount: d.amount }))
    })));

    // DEBUG: Log byDoctorAgg BEFORE package clearance merge (staffRevenueAgg not yet declared)
    console.log("DEBUG BEFORE package clearance merge - byDoctorAgg count:", byDoctorAgg.length);

    // DEBUG: Step-by-step pipeline simulation
    const step1Billings = await Billing.find({
      ...clinicMatch,
      ...dateMatch,
      service: "Package",
      package: { $ne: "", $ne: null },
      appointmentId: null,
      selectedTreatments: { $size: 0 },
      unpaidPackagesPaid: { $size: 0 },
      pendingClearedBreakdown: { $size: 0 },
    }).lean();
    console.log("DEBUG step1 - billings after initial match:", step1Billings.length);

    if (step1Billings.length > 0) {
      // Check patient lookup
      const patientIds = [...new Set(step1Billings.map(b => b.patientId))];
      const patients = await PatientRegistration.find({ _id: { $in: patientIds } }).select("_id packages").lean();
      console.log("DEBUG step2 - patients found:", patients.length);

      // Check packageSoldBy extraction
      for (const billing of step1Billings.slice(0, 3)) {
        const patient = patients.find(p => String(p._id) === String(billing.patientId));
        const matchedPackage = patient?.packages?.find(pkg => pkg.packageName === billing.package);
        console.log(`DEBUG step3 - billing ${billing.invoiceNumber}:`, {
          package: billing.package,
          patientFound: !!patient,
          matchedPackage: matchedPackage || null,
          packageSoldByUserId: matchedPackage?.packageSoldByUserId || null,
          invoicedById: billing.invoicedById,
        });
      }
    }

    // DEBUG: Log clearance billing details to trace duplicate counting
    const clearanceDebug = byDoctorAgg.filter(d =>
      (d.details || []).some(detail =>
        (Array.isArray(detail) ? detail : [detail]).some(item =>
          item.invoiceNumber === "INV-20260718-286423" || item.invoiceNumber === "INV-20260718-178407"
        )
      )
    );
    // console.log("DEBUG clearance billing in byDoctorAgg:", JSON.stringify(clearanceDebug.map(d => ({
    //   doctorId: String(d._id),
    //   amount: d.amount,
    //   detailsCount: (d.details || []).length,
    //   details: (d.details || []).flat().map(item => ({
    //     invoiceNumber: item.invoiceNumber,
    //     amount: item.amount,
    //     isClearedItem: item.isClearedItem,
    //     originalDoctorId: item._debug_originalDoctorId,
    //     appointmentDoctorId: item._debug_appointmentDoctorId,
    //     isOriginalBillingDirect: item._debug_isOriginalBillingDirect,
    //     effectiveDoctorId: item._debug_effectiveDoctorId,
    //   }))
    // })), null, 2));

    // revenueByDoctor will be built after all merges are complete (after patientProfilePackageAgg merge)

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
                          { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
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
      //    Also include Package billings that have selectedTreatments (mixed billings).
      {
        $match: {
          $or: [
            { isClearedItem: false, service: { $in: ["Treatment", "Service"] } },
            { isClearedItem: true, effectiveService: { $in: ["Treatment", "Service"] } },
            {
              isClearedItem: false,
              service: "Package",
              $expr: { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] }
            },
          ],
        },
      },
      // 7. Resolve final group key: for cleared items use the breakdown's
      //    treatmentName; for Package billings with selectedTreatments use the first treatment;
      //    otherwise use billing.treatment → apptSvc.name fallback.
      {
        $addFields: {
          resolvedServiceName: {
            $cond: [
              "$isClearedItem",
              { $ifNull: ["$effectiveTreatmentName", "Unknown"] },
              {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$service", "Package"] },
                      { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                    ],
                  },
                  { $arrayElemAt: ["$selectedTreatments.treatmentName", 0] },
                  { $ifNull: ["$treatment", { $ifNull: ["$apptSvc.name", "Unknown"] }] },
                ],
              }
            ],
          },
          // For Package billings with selectedTreatments, use the treatment price as effectiveAmount
          effectiveAmountForService: {
            $cond: [
              {
                $and: [
                  { $eq: ["$service", "Package"] },
                  { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                ],
              },
              {
                $multiply: [
                  { $ifNull: [{ $arrayElemAt: ["$selectedTreatments.price", 0] }, 0] },
                  { $ifNull: [{ $arrayElemAt: ["$selectedTreatments.quantity", 0] }, 1] },
                ],
              },
              "$effectiveAmount",
            ],
          },
        },
      },
      // 8. Group by the resolved service name. Cleared rows contribute
      //    amountCleared; non-cleared rows contribute the standard paid total.
      {
        $group: {
          _id: "$resolvedServiceName",
          amount: { $sum: "$effectiveAmountForService" },
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
              amount: {
                $cond: [
                  "$isClearedItem",
                  "$effectiveAmount",
                  // Package billing with selectedTreatments: use treatment amount
                  {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$service", "Package"] },
                          { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                        ],
                      },
                      "$effectiveAmountForService",
                      "$amount",
                    ],
                  },
                ],
              },
              paid: {
                $cond: [
                  "$isClearedItem",
                  0,
                  // Package billing with selectedTreatments: use treatment amount
                  {
                    $cond: [
                      {
                        $and: [
                          { $eq: ["$service", "Package"] },
                          { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                        ],
                      },
                      "$effectiveAmountForService",
                      "$paid",
                    ],
                  },
                ],
              },
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

    // Debug: Log revenueByService after mapping

    // Debug: Log byServiceAgg results
    // console.log('DEBUG byServiceAgg:', JSON.stringify(byServiceAgg, null, 2));

    // Recalculate treatmentRevenue from Revenue by Service total (to ensure consistency)
    treatmentRevenue = revenueByService.reduce((sum, s) => sum + s.amount, 0);

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
      // Extract packageSoldBy from patient's packages array
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$patient.packages", []] },
                  as: "pkg",
                  cond: {
                    $and: [
                      { $eq: ["$$pkg.packageName", {
                        $cond: [
                          { $or: [
                            { $eq: ["$package", ""] },
                            { $eq: ["$package", null] },
                          ]},
                          { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
                          "$package",
                        ],
                      }] },
                      { $ne: ["$$pkg.packageName", ""] },
                      { $ne: ["$$pkg.packageName", null] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
          packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
        },
      },
      // Lookup user to get role of packageSoldBy person
      {
        $lookup: {
          from: "users",
          localField: "packageSoldByUserId",
          foreignField: "_id",
          as: "packageSoldByUser",
        },
      },
      {
        $addFields: {
          packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] },
        },
      },
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
          _origBreakdownService: { $arrayElemAt: ["$pendingClearedBreakdown.service", 0] },
          // Mixed billing: billing has breakdown pointing to a different invoice
          // AND the breakdown service is different from billing service
          // (e.g., Package billing with Treatment breakdown, or vice versa)
          // NOT a mixed billing if both are Package (unpaid package clearance)
          _isMixedBilling: {
            $and: [
              { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
              { $ne: ["$invoiceNumber", { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] }] },
              { $ne: ["$service", { $arrayElemAt: ["$pendingClearedBreakdown.service", 0] }] },
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
                    $subtract: [
                      {
                        $add: [
                          { $ifNull: ["$paid", 0] },
                          { $ifNull: ["$advanceUsed", 0] },
                          { $ifNull: ["$claimAmountUsed", 0] },
                          { $ifNull: ["$cashbackWalletUsed", 0] },
                        ],
                      },
                      // Subtract treatment amount for mixed billings (Package + Treatment)
                      {
                        $cond: [
                          {
                            $and: [
                              { $eq: ["$service", "Package"] },
                              { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                            ],
                          },
                          {
                            $sum: {
                              $map: {
                                input: "$selectedTreatments",
                                as: "st",
                                in: {
                                  $multiply: [
                                    { $ifNull: ["$$st.price", 0] },
                                    { $ifNull: ["$$st.quantity", 1] },
                                  ],
                                },
                              },
                            },
                          },
                          0,
                        ],
                      },
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
      // DEBUG: Log all billings before the Package match to see what's being filtered
      {
        $addFields: {
          _debug_beforePackageMatch: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260718-598436"] },
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                package: "$package",
                isClearedItem: "$isClearedItem",
                effectiveService: "$effectiveService",
                effectivePackageName: "$effectivePackageName",
                effectiveAmount: "$effectiveAmount",
                pendingClearedBreakdown: "$pendingClearedBreakdown",
              },
              "$$REMOVE"
            ]
          }
        }
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
      // DEBUG: Log clearance billing for pkgg07
      {
        $addFields: {
          _debug_isPkgg07Clearance: {
            $cond: [
              {
                $and: [
                  { $eq: ["$invoiceNumber", "INV-20260718-598436"] },
                  { $eq: ["$effectivePackageName", "pkgg07"] }
                ]
              },
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                isClearedItem: "$isClearedItem",
                effectiveService: "$effectiveService",
                effectivePackageName: "$effectivePackageName",
                effectiveAmount: "$effectiveAmount",
                amountCleared: { $ifNull: ["$pendingClearedBreakdown.amountCleared", 0] },
              },
              "$$REMOVE"
            ]
          }
        }
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
              // use the billing's own package name, but fall back to
              // breakdown's packageName if billing's package is empty
              {
                $cond: [
                  { $or: [
                    { $eq: ["$package", ""] },
                    { $eq: ["$package", null] },
                  ]},
                  { $ifNull: ["$effectivePackageName", "Unknown"] },
                  { $ifNull: ["$package", "Unknown"] },
                ],
              },
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
                  {
                    $cond: [
                      { $or: [
                        { $eq: ["$package", ""] },
                        { $eq: ["$package", null] },
                      ]},
                      { $ifNull: ["$effectivePackageName", "Unknown"] },
                      "$package",
                    ],
                  },
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
                  // Mixed billing (cleared): use billing's own paid
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$paid",
                  // Non-cleared Package billing with selectedTreatments: use effectiveAmount (package portion)
                  {
                    $cond: [
                      {
                        $and: [
                          { $not: "$isClearedItem" },
                          { $eq: ["$service", "Package"] },
                          { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] },
                        ],
                      },
                      "$effectiveAmount",
                      // Clearance billing: 0 (the cleared amount is shown via amount)
                      { $cond: ["$isClearedItem", 0, "$paid"] },
                    ],
                  },
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
              packageSoldBy: "$packageSoldByName",
              packageSoldByRole: "$packageSoldByRole",
            },
          },
        },
      },
      { $sort: { amount: -1 } },
    ]);
    // DEBUG: Log pkgg07 package details
    const pkgg07Debug = byPackageAgg.filter(p => p._id === "pkgg07");
    // console.log("DEBUG pkgg07 in byPackageAgg:", JSON.stringify(pkgg07Debug.map(p => ({
    //   packageName: p._id,
    //   amount: p.amount,
    //   detailsCount: (p.details || []).length,
    //   details: (p.details || []).map(d => ({
    //     invoiceNumber: d.invoiceNumber,
    //     amount: d.amount,
    //     isClearedItem: d.isClearedItem,
    //     service: d.service,
    //     packageName: d.packageName,
    //   })),
    //   // Check if any detail has the debug field
    //   hasDebugField: (p.details || []).some(d => d._debug_isPkgg07Clearance)
    // })), null, 2));

    // Also log all billings with the debug field
    const allDebugBillings = byPackageAgg.filter(p =>
      (p.details || []).some(d => d._debug_isPkgg07Clearance)
    );
    // console.log("DEBUG all billings with pkgg07 clearance debug:", JSON.stringify(allDebugBillings.map(p => ({
    //   packageName: p._id,
    //   amount: p.amount,
    //   debugDetails: (p.details || []).filter(d => d._debug_isPkgg07Clearance).map(d => d._debug_isPkgg07Clearance)
    // })), null, 2));

    // Log the clearance billing debug from before the match
    const clearanceDebugBeforeMatch = byPackageAgg.filter(p =>
      (p.details || []).some(d => d._debug_beforePackageMatch)
    );
    // console.log("DEBUG clearance billing before Package match:", JSON.stringify(clearanceDebugBeforeMatch.map(p => ({
    //   packageName: p._id,
    //   debugDetails: (p.details || []).filter(d => d._debug_beforePackageMatch).map(d => d._debug_beforePackageMatch)
    // })), null, 2));

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
                          { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
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
      //    Also include Package billings that have selectedTreatments (mixed billings).
      {
        $match: {
          $or: [
            { isClearedItem: false, service: { $in: ["Treatment", "Service"] } },
            { isClearedItem: true, effectiveService: { $in: ["Treatment", "Service"] } },
            {
              isClearedItem: false,
              service: "Package",
              $expr: { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] }
            },
          ],
        },
      },
      // 6.5. Store billing-level paid amount before $unwind (for capping treatment amounts on partial payments)
      // Include advanceUsed to capture full revenue (paid + advanceUsed)
      { $addFields: { billingPaid: { $add: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$advanceUsed", 0] }] } } },
      // 6.6. Unwind selectedTreatments for Package billings to process each treatment independently
      {
        $unwind: {
          path: "$selectedTreatments",
          preserveNullAndEmptyArrays: true
        }
      },
      // 6.6. Lookup Service document for each treatment to get departmentId
      // Handle type mismatch: treatmentServiceId may be string while Service._id is ObjectId
      {
        $lookup: {
          from: "services",
          let: {
            treatmentServiceId: "$selectedTreatments.treatmentServiceId",
            treatmentName: "$selectedTreatments.treatmentName"
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    // Match by _id (convert ObjectId to string for comparison)
                    { $eq: [{ $toString: "$_id" }, "$$treatmentServiceId"] },
                    // Fallback: match by treatment name
                    { $eq: ["$name", "$$treatmentName"] }
                  ]
                }
              }
            },
            { $project: { _id: 1, name: 1, departmentId: 1 } }
          ],
          as: "treatmentServiceDoc"
        }
      },
      // 7. Resolve the final group key: for cleared items use the breakdown's
      //    treatmentName; for Package billings with selectedTreatments use the individual treatment;
      //    otherwise use billing.treatment → apptSvc.name fallback.
      {
        $addFields: {
          resolvedServiceName: {
            $cond: [
              "$isClearedItem",
              { $ifNull: ["$effectiveTreatmentName", "Unknown"] },
              {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$service", "Package"] },
                      { $ne: ["$selectedTreatments", null] }
                    ],
                  },
                  { $ifNull: ["$selectedTreatments.treatmentName", "Unknown"] },
                  { $ifNull: ["$treatment", { $ifNull: ["$apptSvc.name", "Unknown"] }] },
                ],
              }
            ],
          },
          // For billings with selectedTreatments (after $unwind), use proportional scaling for partial payments
          // Each treatment gets (treatmentAmount / totalAmount) × paid
          // For billings without selectedTreatments, use the billing-level effectiveAmount
          effectiveAmountForService: {
            $cond: [
              { $ne: ["$selectedTreatments", null] },
              {
                $multiply: [
                  { $ifNull: ["$billingPaid", 0] },
                  {
                    $divide: [
                      { $multiply: [{ $ifNull: ["$selectedTreatments.price", 0] }, { $ifNull: ["$selectedTreatments.quantity", 1] }] },
                      { $ifNull: ["$originalAmount", "$amount", 1] }
                    ]
                  }
                ]
              },
              "$effectiveAmount",
            ],
          },
          // Get departmentId from treatment service doc
          treatmentDepartmentId: { $arrayElemAt: ["$treatmentServiceDoc.departmentId", 0] },
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
          _id: {
            serviceName: "$resolvedServiceName",
            departmentId: "$treatmentDepartmentId"
          },
          clinicId: { $first: "$clinicId" },
          treatmentDepartmentId: { $first: "$treatmentDepartmentId" },
          totalRevenue: { $sum: "$effectiveAmountForService" },
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
              treatmentName: {
                $cond: [
                  "$isClearedItem",
                  { $ifNull: ["$effectiveTreatmentName", null] },
                  { $ifNull: ["$selectedTreatments.treatmentName", "$effectiveTreatmentName"] },
                ],
              },
              treatmentServiceId: { $ifNull: ["$selectedTreatments.treatmentServiceId", null] },
              treatmentQuantity: { $ifNull: ["$selectedTreatments.quantity", 1] },
              treatmentPrice: { $ifNull: ["$selectedTreatments.price", 0] },
              invoiceNumber: "$invoiceNumber",
              invoicedDate: "$invoicedDate",
              totalAmount: { $ifNull: ["$originalAmount", "$amount"] },
              revenue: "$effectiveAmountForService",
            },
          },
        },
      },
      // 9. Lookup service doc by clinicId + name to get departmentId
      //    (same lookup as department-performance.js)
      {
        $lookup: {
          from: "services",
          let: { cId: "$clinicId", sName: "$_id.serviceName" },
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
          serviceName: "$_id.serviceName",
          clinicId: 1,
          totalRevenue: 1,
          details: 1,
          // Use treatmentDepartmentId from group (set during $group for billings with selectedTreatments)
          // Otherwise use serviceDoc.departmentId from name-based lookup
          departmentId: {
            $ifNull: [
              "$treatmentDepartmentId",
              { $arrayElemAt: ["$serviceDoc.departmentId", 0] }
            ]
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
        treatmentServiceId: detail.treatmentServiceId || null,
        treatmentQuantity: detail.treatmentQuantity || 1,
        treatmentPrice: detail.treatmentPrice || 0,
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
          // Include fields needed for package name and invoice number resolution
          unpaidPackagesPaid: { $ifNull: ["$unpaidPackagesPaid", []] },
          pendingClearedBreakdown: { $ifNull: ["$pendingClearedBreakdown", []] },
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
          unpaidPackagesPaid: 1,
          pendingClearedBreakdown: 1,
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
          unpaidPackagesPaid: 1,
          pendingClearedBreakdown: 1,
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
          unpaidPackagesPaid: 1,
          pendingClearedBreakdown: 1,
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
              // Resolve package name: billing's package field, or from unpaidPackagesPaid, or from breakdown
              package: {
                $cond: [
                  { $or: [
                    { $eq: ["$package", ""] },
                    { $eq: ["$package", null] },
                  ]},
                  {
                    $ifNull: [
                      { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
                      { $ifNull: ["$pendingClearedBreakdown.packageName", null] },
                    ],
                  },
                  "$package",
                ],
              },
              // For clearance billings, show the original package invoice number (PKG-...)
              // For regular billings, show the billing's own invoice number (INV-...)
              invoiceNumber: {
                $cond: [
                  { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
                  { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] },
                  "$invoiceNumber",
                ],
              },
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
      // Lookup clearance billings that cleared this billing's pending amount
      {
        $lookup: {
          from: "billings",
          let: { invNum: "$invoiceNumber" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$clinicId", { $literal: clinicId }] },
                    { $in: ["$$invNum", "$pendingClearedBreakdown.invoiceNumber"] },
                  ],
                },
              },
            },
            {
              $unwind: "$pendingClearedBreakdown",
            },
            {
              $match: {
                $expr: { $eq: ["$pendingClearedBreakdown.invoiceNumber", "$$invNum"] },
              },
            },
            {
              $group: {
                _id: null,
                totalCleared: { $sum: "$pendingClearedBreakdown.amountCleared" },
              },
            },
          ],
          as: "clearanceInfo",
        },
      },
      {
        $addFields: {
          // Calculate effective paid/pending considering clearances
          effectivePaid: {
            $add: [
              { $ifNull: ["$paid", 0] },
              { $ifNull: [{ $arrayElemAt: ["$clearanceInfo.totalCleared", 0] }, 0] },
            ],
          },
          effectivePending: {
            $subtract: [
              { $ifNull: ["$pending", 0] },
              { $ifNull: [{ $arrayElemAt: ["$clearanceInfo.totalCleared", 0] }, 0] },
            ],
          },
        },
      },
      {
        $project: {
          invoiceNumber: 1,
          invoicedDate: 1,
          paid: "$effectivePaid",
          pending: "$effectivePending",
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
              "$effectivePaid",
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

    // Revenue by Staff (Direct Billings) - same logic as doctor-staff-performance
    // DEBUG: Log all Package billings before pipeline filtering
    const allPackageBillingsDebug = await Billing.find({
      ...clinicMatch,
      ...dateMatch,
      service: "Package"
    }).select("invoiceNumber package paid invoicedBy invoicedById patientId invoicedDate").lean();
    // console.log("DEBUG all Package billings before pipeline:", JSON.stringify(allPackageBillingsDebug.map(b => ({
    //   invoiceNumber: b.invoiceNumber,
    //   package: b.package,
    //   paid: b.paid,
    //   invoicedBy: b.invoicedBy,
    //   invoicedById: String(b.invoicedById),
    //   patientId: String(b.patientId),
    //   invoicedDate: b.invoicedDate
    // })), null, 2));

    // DEBUG: Check patient packages for INV-20260721-583425 and INV-20260721-759828
    const debugBilling583425 = allPackageBillingsDebug.find(b => b.invoiceNumber === "INV-20260721-583425");
    const debugBilling759828 = allPackageBillingsDebug.find(b => b.invoiceNumber === "INV-20260721-759828");
    if (debugBilling583425 || debugBilling759828) {
      const patientIds = [];
      if (debugBilling583425) patientIds.push(debugBilling583425.patientId);
      if (debugBilling759828) patientIds.push(debugBilling759828.patientId);
      const debugPatients = await PatientRegistration.find({ _id: { $in: patientIds } }).select("firstName lastName packages").lean();
      console.log("DEBUG patients for mixed billings:", JSON.stringify(debugPatients.map(p => ({
        patientId: String(p._id),
        name: `${p.firstName} ${p.lastName}`,
        packagesCount: (p.packages || []).length,
        packages: (p.packages || []).map(pkg => ({
          packageName: pkg.packageName,
          packageSoldBy: pkg.packageSoldBy,
          packageSoldByUserId: String(pkg.packageSoldByUserId),
        }))
      })), null, 2));

      // DEBUG: Check packageSoldByRole for the specific billings
      const packageSoldByUserIds = [];
      debugPatients.forEach(p => {
        (p.packages || []).forEach(pkg => {
          if (pkg.packageSoldByUserId) {
            packageSoldByUserIds.push(pkg.packageSoldByUserId);
          }
        });
      });
      if (packageSoldByUserIds.length > 0) {
        const debugUsers = await User.find({ _id: { $in: packageSoldByUserIds } }).select("name role").lean();
        console.log("DEBUG packageSoldBy users:", JSON.stringify(debugUsers.map(u => ({
          userId: String(u._id),
          name: u.name,
          role: u.role,
        })), null, 2));

        // DEBUG: Simulate the $lookup to check if it works
        const testUserId = "6a51cf15b91dfc253d83ae76"; // suchi's ID
        const testLookup = await User.find({
          $expr: { $eq: [{ $toString: "$_id" }, { $toString: testUserId }] }
        }).select("name role").lean();
        console.log("DEBUG test $lookup with $toString:", JSON.stringify(testLookup.map(u => ({
          userId: String(u._id),
          name: u.name,
          role: u.role,
        })), null, 2));
      }

      // DEBUG: Check the billing's package field
      const billingIds = [];
      if (debugBilling583425) billingIds.push(debugBilling583425._id);
      if (debugBilling759828) billingIds.push(debugBilling759828._id);
      const debugBillings = await Billing.find({ _id: { $in: billingIds } }).select("invoiceNumber package service").lean();
      console.log("DEBUG billings package field:", JSON.stringify(debugBillings.map(b => ({
        invoiceNumber: b.invoiceNumber,
        package: b.package,
        service: b.service,
      })), null, 2));
    }

    // DEBUG: Check unpaid package billing INV-20260721-439825
    const debugBilling439825 = await Billing.findOne({ invoiceNumber: "INV-20260721-439825" }).select("invoiceNumber package service unpaidPackagesPaid patientId pendingClearedBreakdown").lean();
    if (debugBilling439825) {
      console.log("DEBUG unpaid package billing 439825:", JSON.stringify({
        invoiceNumber: debugBilling439825.invoiceNumber,
        package: debugBilling439825.package,
        service: debugBilling439825.service,
        unpaidPackagesPaid: debugBilling439825.unpaidPackagesPaid,
        pendingClearedBreakdown: debugBilling439825.pendingClearedBreakdown,
      }, null, 2));

      // Check patient's packages
      const debugPatient439825 = await PatientRegistration.findById(debugBilling439825.patientId).select("firstName lastName packages").lean();
      if (debugPatient439825) {
        const packageName = debugBilling439825.unpaidPackagesPaid?.[0]?.packageName || debugBilling439825.package;
        const matchedPackage = (debugPatient439825.packages || []).find(pkg => pkg.packageName === packageName);
        console.log("DEBUG 439825 patient packages:", JSON.stringify({
          patientName: `${debugPatient439825.firstName} ${debugPatient439825.lastName}`,
          packageNameToMatch: packageName,
          matchedPackage: matchedPackage ? {
            packageName: matchedPackage.packageName,
            packageSoldBy: matchedPackage.packageSoldBy,
            packageSoldByUserId: String(matchedPackage.packageSoldByUserId),
          } : null,
        }, null, 2));

        if (matchedPackage && matchedPackage.packageSoldByUserId) {
          const debugUser439825 = await User.findById(matchedPackage.packageSoldByUserId).select("name role").lean();
          console.log("DEBUG 439825 packageSoldBy user:", JSON.stringify({
            userId: String(debugUser439825._id),
            name: debugUser439825.name,
            role: debugUser439825.role,
          }, null, 2));
        }
      }
    }

    // DEBUG: Check unpaid package billing INV-20260721-160986
    const debugBilling160986 = await Billing.findOne({ invoiceNumber: "INV-20260721-160986" }).select("invoiceNumber package service unpaidPackagesPaid patientId pendingClearedBreakdown appointmentId").lean();
    if (debugBilling160986) {
      console.log("DEBUG unpaid package billing 160986:", JSON.stringify({
        invoiceNumber: debugBilling160986.invoiceNumber,
        package: debugBilling160986.package,
        service: debugBilling160986.service,
        unpaidPackagesPaid: debugBilling160986.unpaidPackagesPaid,
        pendingClearedBreakdown: debugBilling160986.pendingClearedBreakdown,
        appointmentId: debugBilling160986.appointmentId,
      }, null, 2));

      // Check if appointment exists
      const debugAppointment = await Appointment.findById(debugBilling160986.appointmentId).select("_id doctorId services").lean();
      console.log("DEBUG 160986 appointment exists:", JSON.stringify({
        appointmentId: debugBilling160986.appointmentId,
        appointmentFound: !!debugAppointment,
        appointmentDoctorId: debugAppointment?.doctorId,
      }, null, 2));

      // Check patient's packages
      const debugPatient160986 = await PatientRegistration.findById(debugBilling160986.patientId).select("firstName lastName packages").lean();
      if (debugPatient160986) {
        const packageName = debugBilling160986.unpaidPackagesPaid?.[0]?.packageName || debugBilling160986.package;
        const matchedPackage = (debugPatient160986.packages || []).find(pkg => pkg.packageName === packageName);
        console.log("DEBUG 160986 patient packages:", JSON.stringify({
          patientName: `${debugPatient160986.firstName} ${debugPatient160986.lastName}`,
          packageNameToMatch: packageName,
          allPackageNames: (debugPatient160986.packages || []).map(p => p.packageName),
          matchedPackage: matchedPackage ? {
            packageName: matchedPackage.packageName,
            packageSoldBy: matchedPackage.packageSoldBy,
            packageSoldByUserId: String(matchedPackage.packageSoldByUserId),
          } : null,
        }, null, 2));

        if (matchedPackage && matchedPackage.packageSoldByUserId) {
          const debugUser160986 = await User.findById(matchedPackage.packageSoldByUserId).select("name role").lean();
          console.log("DEBUG 160986 packageSoldBy user:", JSON.stringify({
            userId: String(debugUser160986._id),
            name: debugUser160986.name,
            role: debugUser160986.role,
          }, null, 2));
        }
      }
    }

    const staffRevenuePipeline = [
      { $match: { ...clinicMatch, ...dateMatch } },
      { $match: excludeClearanceMatch },
      // DEBUG: Log all Package billings before any filtering
      {
        $addFields: {
          _debug_allPackages: {
            $cond: [
              { $eq: ["$service", "Package"] },
              {
                invoiceNumber: "$invoiceNumber",
                package: "$package",
                paid: "$paid",
                invoicedBy: "$invoicedBy",
                invoicedById: "$invoicedById",
                patientId: "$patientId",
                invoicedDate: "$invoicedDate",
              },
              "$$REMOVE"
            ]
          }
        }
      },
      // Lookup appointment to check if billing is from appointment
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: { path: "$appointment", preserveNullAndEmptyArrays: true } },
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
      // DEBUG: Log Package billings after patient lookup
      {
        $addFields: {
          _debug_afterPatientLookup: {
            $cond: [
              { $eq: ["$service", "Package"] },
              {
                invoiceNumber: "$invoiceNumber",
                package: "$package",
                patientExists: { $ne: [{ $ifNull: ["$patient", null] }, null] },
                patientPackagesCount: { $size: { $ifNull: ["$patient.packages", []] } },
                hasMatchingPackage: {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: { $ifNull: ["$patient.packages", []] },
                          as: "pkg",
                          cond: { $eq: ["$$pkg.packageName", "$package"] }
                        }
                      }
                    },
                    0
                  ]
                }
              },
              "$$REMOVE"
            ]
          },
          // DEBUG: Log mixed billing INV-20260721-733331
          _debug_mixedBilling: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260721-733331"] },
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                package: "$package",
                selectedTreatments: "$selectedTreatments",
                amount: "$amount",
                paid: "$paid",
                appointmentId: "$appointmentId",
                treatmentServiceId: { $arrayElemAt: ["$selectedTreatments.treatmentServiceId", 0] },
              },
              "$$REMOVE"
            ]
          }
        }
      },
      // Extract packageSoldBy info for Package billings
      {
        $addFields: {
          // Determine the package name to use for matching:
          // - If billing's package field is not empty, use it
          // - Otherwise, use the first package name from unpaidPackagesPaid
          packageSoldBy: {
            $arrayElemAt: [
              {
                $filter: {
                  input: { $ifNull: ["$patient.packages", []] },
                  as: "pkg",
                  cond: {
                    $and: [
                      { $eq: ["$$pkg.packageName", {
                        $cond: [
                          { $or: [
                            { $eq: ["$package", ""] },
                            { $eq: ["$package", null] },
                          ]},
                          { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
                          "$package",
                        ],
                      }] },
                      { $ne: ["$$pkg.packageName", ""] },
                      { $ne: ["$$pkg.packageName", null] },
                    ],
                  },
                },
              },
              0,
            ],
          },
        },
      },
      {
        $addFields: {
          packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
          packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
          // DEBUG: Log patient packages for package billings
          _debug_patientPackages: {
            $cond: [
              { $eq: ["$service", "Package"] },
              { $ifNull: ["$patient.packages", []] },
              "$$REMOVE"
            ]
          },
          _debug_billingPackage: {
            $cond: [
              { $eq: ["$service", "Package"] },
              "$package",
              "$$REMOVE"
            ]
          },
          // DEBUG: Log packageSoldBy extraction for specific billings
          _debug_759828PackageSoldBy: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260721-759828"] },
              {
                invoiceNumber: "$invoiceNumber",
                package: "$package",
                packageSoldBy: "$packageSoldBy",
                packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
                patientPackagesCount: { $size: { $ifNull: ["$patient.packages", []] } },
              },
              "$$REMOVE"
            ]
          },
          _debug_583425PackageSoldBy: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260721-583425"] },
              {
                invoiceNumber: "$invoiceNumber",
                package: "$package",
                packageSoldBy: "$packageSoldBy",
                packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
                patientPackagesCount: { $size: { $ifNull: ["$patient.packages", []] } },
              },
              "$$REMOVE"
            ]
          },
        },
      },
      // Lookup user to get role of packageSoldBy person
      // Use pipeline $lookup with $toString to handle string-to-ObjectId comparison
      {
        $lookup: {
          from: "users",
          let: { packageSoldByUserId: "$packageSoldByUserId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toString: "$_id" },
                    { $toString: "$$packageSoldByUserId" }
                  ]
                }
              }
            }
          ],
          as: "packageSoldByUser",
        },
      },
      {
        $addFields: {
          packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] },
          // DEBUG: Log packageSoldBy resolution for hfejhbrfjhb package
          _debug_hfejhbrfjhbSoldBy: {
            $cond: [
              { $or: [
                { $eq: ["$invoiceNumber", "PKG-1784551192006-203"] },
                { $eq: ["$invoiceNumber", "PKG-1784551806232-204"] },
              ]},
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                package: "$package",
                unpaidPackagesPaid: "$unpaidPackagesPaid",
                packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
                packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
                packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] },
                invoicedBy: "$invoicedBy",
                invoicedById: "$invoicedById",
                patientExists: { $ne: [{ $ifNull: ["$patient", null] }, null] },
                patientPackagesCount: { $size: { $ifNull: ["$patient.packages", []] } },
              },
              "$$REMOVE"
            ]
          },
          // DEBUG: Log all Package billings after role lookup
          _debug_allPackagesAfterRole: {
            $cond: [
              { $eq: ["$service", "Package"] },
              {
                invoiceNumber: "$invoiceNumber",
                package: "$package",
                packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
                packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
                packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] },
                patientExists: { $ne: [{ $ifNull: ["$patient", null] }, null] },
                patientPackagesCount: { $size: { $ifNull: ["$patient.packages", []] } },
              },
              "$$REMOVE"
            ]
          },
          // DEBUG: Log packageSoldBy resolution for INV-20260721-759828
          _debug_759828SoldBy: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260721-759828"] },
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                package: "$package",
                packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
                packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
                packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] },
                invoicedBy: "$invoicedBy",
                invoicedById: "$invoicedById",
                patientExists: { $ne: [{ $ifNull: ["$patient", null] }, null] },
                patientPackagesCount: { $size: { $ifNull: ["$patient.packages", []] } },
                patientPackages: { $ifNull: ["$patient.packages", []] },
              },
              "$$REMOVE"
            ]
          },
          // DEBUG: Log packageSoldBy resolution for INV-20260721-583425
          _debug_583425SoldBy: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260721-583425"] },
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                package: "$package",
                packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
                packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
                packageSoldByRole: { $arrayElemAt: ["$packageSoldByUser.role", 0] },
                invoicedBy: "$invoicedBy",
                invoicedById: "$invoicedById",
                patientExists: { $ne: [{ $ifNull: ["$patient", null] }, null] },
                patientPackagesCount: { $size: { $ifNull: ["$patient.packages", []] } },
                patientPackages: { $ifNull: ["$patient.packages", []] },
              },
              "$$REMOVE"
            ]
          },
        },
      },
      // Filter: For Package billings, only include if seller is an agent
      {
        $match: {
          $or: [
            { service: { $ne: "Package" } },
            { $and: [{ service: "Package" }, { packageSoldByRole: "agent" }] }
          ]
        }
      },
      // For Package billings, override invoicedById to use packageSoldByUserId
      {
        $addFields: {
          effectiveInvoicedById: {
            $cond: [
              // For Package billings WITHOUT selectedTreatments (pure package): use packageSoldByUserId
              // For Package billings WITH selectedTreatments (mixed): use invoicedById for treatment portion
              {
                $and: [
                  { $eq: ["$service", "Package"] },
                  { $eq: ["$selectedTreatments", null] }
                ]
              },
              "$packageSoldByUserId",
              "$invoicedById"
            ]
          },
          effectiveInvoicedByName: {
            $cond: [
              // For Package billings WITHOUT selectedTreatments (pure package): use packageSoldByName
              // For Package billings WITH selectedTreatments (mixed): use invoicedBy for treatment portion
              {
                $and: [
                  { $eq: ["$service", "Package"] },
                  { $eq: ["$selectedTreatments", null] }
                ]
              },
              "$packageSoldByName",
              "$invoicedBy"
            ]
          },
        },
      },
      {
        $addFields: {
          // Extract treatmentServiceIds from selectedTreatments array
          billingServiceIds: {
            $map: {
              input: { $ifNull: ["$selectedTreatments", []] },
              as: "st",
              in: { $toString: "$$st.treatmentServiceId" },
            },
          },
          // Extract serviceIds from appointment
          appointmentServiceIds: {
            $concatArrays: [
              { $map: {
                input: { $ifNull: ["$appointment.serviceIds", []] },
                as: "sid",
                in: { $toString: "$$sid" },
              }},
              { $map: {
                input: { $ifNull: ["$appointment.services", []] },
                as: "s",
                in: { $toString: "$$s.serviceId" },
              }},
              { $cond: [{ $ifNull: ["$appointment.serviceId", false] }, [{ $toString: "$appointment.serviceId" }], []] },
            ],
          },
        },
      },
      {
        $addFields: {
          // Determine if billing has appointment with matching services
          hasAppointmentMatch: {
            $and: [
              { $ne: [{ $ifNull: ["$appointment", null] }, null] },
              { $gt: [{ $size: "$appointmentServiceIds" }, 0] },
            ]
          },
          // Store billing-level paid amount before $unwind (for capping treatment amounts on partial payments)
          // Include advanceUsed to capture full revenue (paid + advanceUsed)
          billingPaid: { $add: [{ $ifNull: ["$paid", 0] }, { $ifNull: ["$advanceUsed", 0] }] },
        },
      },
      // For clearance-only billings, lookup original billing to determine if it was direct or appointment-based
      {
        $lookup: {
          from: "billings",
          let: {
            hasBreakdown: { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
            invNum: { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] }
          },
          pipeline: [
            { $match: { $expr: { $eq: ["$invoiceNumber", "$$invNum"] } } },
            { $project: { doctorId: 1, appointmentId: 1 } },
          ],
          as: "originalBillingForClearance",
        },
      },
      {
        $addFields: {
          // For clearance-only billings: check if original billing was direct (doctor != appointment doctor)
          isClearanceFromDirectBilling: {
            $cond: [
              { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
              {
                $cond: [
                  { $gt: [{ $size: "$originalBillingForClearance" }, 0] },
                  { $ne: [{ $arrayElemAt: ["$originalBillingForClearance.doctorId", 0] }, "$appointment.doctorId"] },
                  false
                ]
              },
              false
            ]
          },
        },
      },
      // For package billings with empty selectedTreatments array, convert to null
      // so $unwind with preserveNullAndEmptyArrays produces a document (not removes it)
      {
        $addFields: {
          selectedTreatments: {
            $cond: [
              {
                $and: [
                  { $eq: ["$service", "Package"] },
                  { $eq: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$selectedTreatments" }, "array"] },
                  { $ifNull: ["$selectedTreatments", []] },
                  []
                ]
              }}, 0] }
                ]
              },
              null,
              "$selectedTreatments"
            ]
          }
        }
      },
      // Unwind selectedTreatments to process each treatment independently
      // preserveNullAndEmptyArrays: true so billings without selectedTreatments still flow through
      { $unwind: { path: "$selectedTreatments", preserveNullAndEmptyArrays: true } },
      // Check if current treatment is direct (NOT from appointment)
      {
        $addFields: {
          isTreatmentDirect: {
            $cond: [
              // If no selectedTreatments (null after unwind), use billing-level check
              { $eq: ["$selectedTreatments", null] },
              // For clearance-only billings: direct if original billing was direct
              // For package billings (no treatments): direct if packageSoldByRole is agent
              // For non-clearance, non-package billings: direct if no appointment match
              {
                $cond: [
                  { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
                  "$isClearanceFromDirectBilling",
                  {
                    $cond: [
                      { $eq: ["$service", "Package"] },
                      { $eq: ["$packageSoldByRole", "agent"] },
                      { $not: "$hasAppointmentMatch" }
                    ]
                  }
                ]
              },
              // Treatment-level check: treatmentServiceId NOT in appointmentServiceIds
              // This applies to ALL billings with selectedTreatments (including mixed Package+Treatment)
              {
                $not: {
                  $in: [
                    { $toString: "$selectedTreatments.treatmentServiceId" },
                    "$appointmentServiceIds"
                  ]
                }
              }
            ]
          },
          // DEBUG: Log isTreatmentDirect for mixed billing
          _debug_isTreatmentDirect: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260721-733331"] },
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                package: "$package",
                selectedTreatments: "$selectedTreatments",
                treatmentServiceId: { $toString: "$selectedTreatments.treatmentServiceId" },
                appointmentServiceIds: "$appointmentServiceIds",
                isTreatmentDirect: {
                  $not: {
                    $in: [
                      { $toString: "$selectedTreatments.treatmentServiceId" },
                      "$appointmentServiceIds"
                    ]
                  }
                },
                hasAppointmentMatch: "$hasAppointmentMatch",
                packageSoldByRole: "$packageSoldByRole",
              },
              "$$REMOVE"
            ]
          }
        },
      },
      // Calculate treatment amount using proportional scaling for partial payments
      // Each treatment gets (treatmentAmount / totalAmount) × paid
      // For package billings with no selectedTreatments, use full billing amount
      {
        $addFields: {
          treatmentAmount: {
            $cond: [
              { $eq: ["$selectedTreatments", null] },
              // No selectedTreatments: for package billings, use full amount; otherwise 0
              {
                $cond: [
                  { $eq: ["$service", "Package"] },
                  { $ifNull: ["$billingPaid", 0] },
                  0
                ]
              },
              {
                $multiply: [
                  { $ifNull: ["$billingPaid", 0] },
                  {
                    $divide: [
                      { $multiply: [{ $ifNull: ["$selectedTreatments.price", 0] }, { $ifNull: ["$selectedTreatments.quantity", 1] }] },
                      { $ifNull: ["$originalAmount", "$amount", 1] }
                    ]
                  }
                ]
              }
            ]
          }
        },
      },
      // Only include treatments that are direct (not from appointment)
      { $match: { isTreatmentDirect: true } },
      // Must have effectiveInvoicedById to attribute to an agent
      { $match: { effectiveInvoicedById: { $ne: null } } },
      // Calculate effectiveRevenue: use treatment amount for each treatment
      {
        $addFields: {
          effectiveRevenue: {
            $cond: [
              // Pure package (no selectedTreatments): use full billingPaid
              { $eq: ["$selectedTreatments", null] },
              { $ifNull: ["$billingPaid", 0] },
              // Mixed billing with selectedTreatments: use treatmentAmount for treatment portion
              "$treatmentAmount"
            ]
          },
          // DEBUG: Log amount calculation for pyree package
          _debug_pyreeAmount: {
            $cond: [
              { $eq: ["$invoiceNumber", "INV-20260718-121954"] },
              {
                invoiceNumber: "$invoiceNumber",
                service: "$service",
                package: "$package",
                paid: "$paid",
                billingPaid: "$billingPaid",
                selectedTreatments: "$selectedTreatments",
                treatmentAmount: "$treatmentAmount",
                effectiveRevenue: "$treatmentAmount",
              },
              "$$REMOVE"
            ]
          },
        },
      },
      // Add package portion for mixed billings (Package + Treatment)
      {
        $facet: {
          // Keep treatment documents as-is
          treatments: [ { $match: {} } ],
          // Create package portion documents for mixed billings
          packagePortions: [
            { $match: { 
              service: "Package",
              selectedTreatments: { $ne: null }
            }},
            { $group: {
              _id: "$invoiceNumber",
              invoiceNumber: { $first: "$invoiceNumber" },
              clinicId: { $first: "$clinicId" },
              patientId: { $first: "$patientId" },
              patient: { $first: "$patient" },
              invoicedBy: { $first: "$invoicedBy" },
              invoicedById: { $first: "$invoicedById" },
              invoicedByRole: { $first: "$invoicedByRole" },
              packageSoldByName: { $first: "$packageSoldByName" },
              packageSoldByUserId: { $first: "$packageSoldByUserId" },
              packageSoldByRole: { $first: "$packageSoldByRole" },
              package: { $first: "$package" },
              treatment: { $first: "$treatment" },
              service: { $first: "$service" },
              billingPaid: { $first: "$billingPaid" },
              totalTreatmentAmount: { $sum: "$treatmentAmount" },
              invoicedDate: { $first: "$invoicedDate" },
              emrNumber: { $first: "$patient.emrNumber" },
            }},
            { $addFields: {
              packageAmount: { $subtract: ["$billingPaid", "$totalTreatmentAmount"] },
              effectiveInvoicedById: "$packageSoldByUserId",
              effectiveInvoicedByName: "$packageSoldByName",
              selectedTreatments: null,
              treatmentAmount: 0,
              effectiveRevenue: { $subtract: ["$billingPaid", "$totalTreatmentAmount"] },
            }},
            { $match: { packageAmount: { $gt: 0 } } },
          ]
        }
      },
      { $project: {
        combined: { $concatArrays: ["$treatments", "$packagePortions"] }
      }},
      { $unwind: "$combined" },
      { $replaceRoot: { newRoot: "$combined" } },
      {
        $group: {
          _id: "$effectiveInvoicedById",
          revenue: { $sum: "$effectiveRevenue" },
          invoices: { $sum: 1 },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $trim: { input: { $concat: [{ $ifNull: ["$patient.firstName", ""] }, " ", { $ifNull: ["$patient.lastName", ""] }] } } },
              emrNumber: "$patient.emrNumber",
              // For treatment portions (selectedTreatments is not null), show "Treatment"
              // For package portions (selectedTreatments is null), show "Package"
              service: {
                $cond: [
                  { $eq: ["$selectedTreatments", null] },
                  "$service",
                  "Treatment"
                ]
              },
              // For treatment portions, show null (treatment name will be shown instead)
              // For package portions, show the package name
              packageName: {
                $cond: [
                  { $eq: ["$selectedTreatments", null] },
                  {
                    $cond: [
                      { $or: [
                        { $eq: ["$package", ""] },
                        { $eq: ["$package", null] },
                      ]},
                      {
                        $ifNull: [
                          { $arrayElemAt: ["$unpaidPackagesPaid.packageName", 0] },
                          { $ifNull: ["$pendingClearedBreakdown.packageName", ""] },
                        ],
                      },
                      "$package",
                    ],
                  },
                  null
                ]
              },
              treatmentName: {
                $cond: [
                  // For package portions (selectedTreatments is null), show null
                  { $eq: ["$selectedTreatments", null] },
                  null,
                  // For treatment portions, show treatment name
                  { $ifNull: ["$selectedTreatments.treatmentName", "$treatment"] }
                ]
              },
              treatmentServiceId: { $ifNull: ["$selectedTreatments.treatmentServiceId", null] },
              treatmentQuantity: { $ifNull: ["$selectedTreatments.quantity", 1] },
              treatmentPrice: { $ifNull: ["$selectedTreatments.price", 0] },
              // For clearance billings, show the original package invoice number (PKG-...)
              // For regular billings, show the billing's own invoice number (INV-...)
              invoiceNumber: {
                $cond: [
                  { $gt: [{ $size: {
                $cond: [
                  { $eq: [{ $type: "$pendingClearedBreakdown" }, "array"] },
                  { $ifNull: ["$pendingClearedBreakdown", []] },
                  []
                ]
              }}, 0] },
                  { $arrayElemAt: ["$pendingClearedBreakdown.invoiceNumber", 0] },
                  "$invoiceNumber",
                ],
              },
              invoicedDate: "$invoicedDate",
              amount: "$effectiveRevenue",
              paid: "$effectiveRevenue",
              pending: 0,
              advance: 0,
              // Package sold by info
              packageSoldBy: "$packageSoldByName",
              packageSoldByRole: "$packageSoldByRole",
              // DEBUG fields
              _debug_patientPackages: "$_debug_patientPackages",
              _debug_billingPackage: "$_debug_billingPackage",
              _debug_afterIsFromAppointment: "$_debug_afterIsFromAppointment",
              _debug_pyreeAmount: "$_debug_pyreeAmount",
              _debug_hfejhbrfjhbSoldBy: "$_debug_hfejhbrfjhbSoldBy",
              _debug_allPackagesAfterRole: "$_debug_allPackagesAfterRole",
              _debug_afterPatientLookup: "$_debug_afterPatientLookup",
              _debug_mixedBilling: "$_debug_mixedBilling",
              _debug_isTreatmentDirect: "$_debug_isTreatmentDirect",
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
    ];

    const staffRevenueAgg = await Billing.aggregate(staffRevenuePipeline);

    // DEBUG: Log hfejhbrfjhb package in staffRevenueAgg
    const hfejhbrfjhbDebug = staffRevenueAgg.filter(r =>
      (r.details || []).some(detail =>
        detail.invoiceNumber === "PKG-1784551192006-203" || detail.invoiceNumber === "PKG-1784551806232-204"
      )
    );
    

    // DEBUG: Log all Package billings in the pipeline
    const allPackagesDebug = staffRevenueAgg.filter(r =>
      (r.details || []).some(detail => detail._debug_allPackages || detail._debug_allPackagesAfterRole || detail._debug_afterPatientLookup)
    );
    console.log("DEBUG all Package billings in staffRevenueAgg:", JSON.stringify(allPackagesDebug.map(r => ({
      staffId: String(r._id),
      revenue: r.revenue,
      packages: (r.details || []).filter(d => d._debug_allPackages || d._debug_allPackagesAfterRole || d._debug_afterPatientLookup).map(d => d._debug_allPackages || d._debug_allPackagesAfterRole || d._debug_afterPatientLookup)
    })), null, 2));

    // DEBUG: Log hfejhbrfjhb package sold by resolution
    const afterIsFromAppointmentDebug = staffRevenueAgg.filter(r =>
      (r.details || []).some(detail => detail._debug_afterIsFromAppointment)
    );
    
    
    // DEBUG: Log package billing details to trace sold by attribution
    const packageDebug = staffRevenueAgg.filter(r =>
      (r.details || []).some(detail =>
        detail.invoiceNumber === "INV-20260718-913514"
      )
    );
    

    // DEBUG: Log INV-20260721-759828 package sold by resolution
    const debug759828 = staffRevenueAgg.filter(r =>
      (r.details || []).some(detail => detail._debug_759828SoldBy || detail._debug_759828PackageSoldBy)
    );
    console.log("DEBUG INV-20260721-759828 in staffRevenueAgg:", JSON.stringify(debug759828.map(r => ({
      staffId: String(r._id),
      revenue: r.revenue,
      details: (r.details || []).filter(d => d._debug_759828SoldBy || d._debug_759828PackageSoldBy).map(d => ({
        _debug_759828SoldBy: d._debug_759828SoldBy,
        _debug_759828PackageSoldBy: d._debug_759828PackageSoldBy,
      }))
    })), null, 2));

    // DEBUG: Log INV-20260721-583425 package sold by resolution
    const debug583425 = staffRevenueAgg.filter(r =>
      (r.details || []).some(detail => detail._debug_583425SoldBy || detail._debug_583425PackageSoldBy)
    );
    console.log("DEBUG INV-20260721-583425 in staffRevenueAgg:", JSON.stringify(debug583425.map(r => ({
      staffId: String(r._id),
      revenue: r.revenue,
      details: (r.details || []).filter(d => d._debug_583425SoldBy || d._debug_583425PackageSoldBy).map(d => ({
        _debug_583425SoldBy: d._debug_583425SoldBy,
        _debug_583425PackageSoldBy: d._debug_583425PackageSoldBy,
      }))
    })), null, 2));

    // DEBUG: Log pyree package sold by resolution
    const pyreeDebug = staffRevenueAgg.filter(r =>
      (r.details || []).some(detail => detail._debug_pyreePackageSoldBy)
    );
    console.log("DEBUG pyree package sold by resolution:", JSON.stringify(pyreeDebug.map(r => ({
      staffId: String(r._id),
      revenue: r.revenue,
      debugDetails: (r.details || []).filter(d => d._debug_pyreePackageSoldBy).map(d => d._debug_pyreePackageSoldBy)
    })), null, 2));

    // DEBUG: Log pyree package amount calculation
    const pyreeAmountDebug = staffRevenueAgg.filter(r =>
      (r.details || []).some(detail => detail._debug_pyreeAmount)
    );
    console.log("DEBUG pyree package amount calculation:", JSON.stringify(pyreeAmountDebug.map(r => ({
      staffId: String(r._id),
      revenue: r.revenue,
      debugDetails: (r.details || []).filter(d => d._debug_pyreeAmount).map(d => d._debug_pyreeAmount)
    })), null, 2));

    // Merge mixed billing package portion into appropriate revenue arrays
    // doctorStaff → Revenue by Doctor, agent → Revenue by Staff
    if (mixedPackageByDoctorAgg.length > 0) {
      for (const mixedDoc of mixedPackageByDoctorAgg) {
        const role = mixedDoc.role;
        if (role === "doctorStaff") {
          // Add to Revenue by Doctor
          const existingDoctor = byDoctorAgg.find(d => String(d._id) === String(mixedDoc._id));
          if (existingDoctor) {
            existingDoctor.amount += mixedDoc.amount;
            existingDoctor.details.push(...mixedDoc.details);
          } else {
            byDoctorAgg.push(mixedDoc);
          }
        } else if (role === "agent") {
          // Add to Revenue by Staff
          const existingStaff = staffRevenueAgg.find(s => String(s._id) === String(mixedDoc._id));
          if (existingStaff) {
            existingStaff.revenue += mixedDoc.amount;
            existingStaff.details.push(...mixedDoc.details);
          } else {
            staffRevenueAgg.push({
              _id: mixedDoc._id,
              revenue: mixedDoc.amount,
              invoices: mixedDoc.details.length,
              details: mixedDoc.details,
            });
          }
        }
      }
    }

    // Merge patient profile package billing results
    if (patientProfilePackageAgg.length > 0) {
      for (const profileDoc of patientProfilePackageAgg) {
        const role = profileDoc.role;
        if (role === "doctorStaff") {
          // Add to Revenue by Doctor
          const existingDoctor = byDoctorAgg.find(d => String(d._id) === String(profileDoc._id));
          if (existingDoctor) {
            existingDoctor.amount += profileDoc.amount;
            existingDoctor.invoices += profileDoc.invoices;
            existingDoctor.details.push(...profileDoc.details);
          } else {
            byDoctorAgg.push(profileDoc);
          }
        } else if (role === "agent") {
          // Add to Revenue by Staff
          const existingStaff = staffRevenueAgg.find(s => String(s._id) === String(profileDoc._id));
          if (existingStaff) {
            existingStaff.revenue += profileDoc.amount;
            existingStaff.details.push(...profileDoc.details);
          } else {
            staffRevenueAgg.push({
              _id: profileDoc._id,
              revenue: profileDoc.amount,
              invoices: profileDoc.invoices,
              details: profileDoc.details,
            });
          }
        }
      }
    }

    // Merge package clearance billing results (pending amount cleared for packages)
    console.log("DEBUG package clearance merge - starting merge, packageClearanceAgg length:", packageClearanceAgg.length);
    if (packageClearanceAgg.length > 0) {
      for (const clearanceDoc of packageClearanceAgg) {
        const role = clearanceDoc.role;
        console.log(`DEBUG package clearance merge - processing: id=${String(clearanceDoc._id)}, role=${role}, amount=${clearanceDoc.amount}`);
        if (role === "doctorStaff") {
          // Add to Revenue by Doctor
          const existingDoctor = byDoctorAgg.find(d => String(d._id) === String(clearanceDoc._id));
          console.log(`DEBUG package clearance merge - doctorStaff: existingDoctor=${!!existingDoctor}`);
          if (existingDoctor) {
            existingDoctor.amount += clearanceDoc.amount;
            existingDoctor.invoices += clearanceDoc.invoices;
            existingDoctor.details.push(...clearanceDoc.details);
          } else {
            byDoctorAgg.push(clearanceDoc);
          }
        } else if (role === "agent") {
          // Add to Revenue by Staff
          const existingStaff = staffRevenueAgg.find(s => String(s._id) === String(clearanceDoc._id));
          console.log(`DEBUG package clearance merge - agent: existingStaff=${!!existingStaff}`);
          if (existingStaff) {
            existingStaff.revenue += clearanceDoc.amount;
            existingStaff.details.push(...clearanceDoc.details);
          } else {
            staffRevenueAgg.push({
              _id: clearanceDoc._id,
              revenue: clearanceDoc.amount,
              invoices: clearanceDoc.invoices,
              details: clearanceDoc.details,
            });
          }
        }
      }
    }
    console.log("DEBUG package clearance merge - AFTER merge - byDoctorAgg count:", byDoctorAgg.length);
    console.log("DEBUG package clearance merge - AFTER merge - staffRevenueAgg count:", staffRevenueAgg.length);

    // Build revenueByDoctor AFTER all merges are complete
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

    // Lookup staff users to get their names
    const staffIds = staffRevenueAgg.map((r) => r._id).filter(Boolean);
    const staffUserMap = staffIds.length
      ? new Map(
          (await User.find({ _id: { $in: staffIds } }).select("_id name").lean()).map((u) => [
            String(u._id),
            u.name || "Unknown",
          ])
        )
      : new Map();

    const revenueByStaff = staffRevenueAgg.map((r) => ({
      staffId: String(r._id),
      name: staffUserMap.get(String(r._id)) || "Unknown",
      amount: Math.round(Number(r.revenue || 0)),
      invoices: r.invoices || 0,
      details: r.details || [],
    }));

    return res.status(200).json({
      success: true,
      data: {
        totalRevenue,
        treatmentRevenue,
        packageRevenue,
        advanceRevenue,
        pendingCleared,
        revenueByDoctor,
        revenueByStaff,
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

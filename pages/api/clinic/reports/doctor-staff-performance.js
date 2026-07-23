import dbConnect from "../../../../lib/database";
import Appointment from "../../../../models/Appointment";
import Billing from "../../../../models/Billing";
import User from "../../../../models/Users";
import Commission from "../../../../models/Commission";
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

  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();
  const startAt = new Date(start);
  startAt.setHours(0, 0, 0, 0);
  const endAt = new Date(end);
  endAt.setHours(23, 59, 59, 999);

  try {
    // console.log("doctor-staff-performance", {
    //   clinicId: clinicId ? String(clinicId) : null,
    //   role: me.role,
    //   startAt: startAt.toISOString(),
    //   endAt: endAt.toISOString(),
    // });
    let staffFilter = { role: "doctorStaff", ...(clinicId ? { clinicId: clinicId } : {}) };
    let staffList = await User.find(staffFilter).select("_id name email").lean();
    // Fallback: if no doctorStaff found with clinic scoping, use all doctorStaff (legacy data)
    if (!staffList.length) {
      staffFilter = { role: "doctorStaff" };
      staffList = await User.find(staffFilter).select("_id name email").lean();
    }
    const staffIds = staffList.map((s) => s._id);
    const staffMap = new Map(staffList.map((s) => [String(s._id), { name: s.name || "Unknown", email: s.email || "" }]));
    // console.log("staffListCount", staffList.length);

    const baseAppointmentFilter = {
      ...(clinicId ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } : {}),
      doctorId: { $in: staffIds },
      startDate: { $gte: startAt, $lte: endAt },
    };

    const bookingsAgg = await Appointment.aggregate([
      { $match: baseAppointmentFilter },
      {
        $addFields: {
          isBooked: { $cond: [{ $eq: [{ $toLower: "$status" }, "booked"] }, 1, 0] },
          isCancelled: { $cond: [{ $in: [{ $toLower: "$status" }, ["cancelled", "canceled"]] }, 1, 0] },
          isCompleted: { $cond: [{ $eq: [{ $toLower: "$status" }, "completed"] }, 1, 0] },
          isInvoiced: { $cond: [{ $in: [{ $toLower: "$status" }, ["invoice", "invoiced"]] }, 1, 0] },
          isRescheduled: { $cond: [{ $eq: [{ $toLower: "$status" }, "rescheduled"] }, 1, 0] },
        },
      },
      {
        $group: {
          _id: "$doctorId",
          totalAppointments: { $sum: 1 },
          bookedCount: { $sum: "$isBooked" },
          cancelledCount: { $sum: "$isCancelled" },
          completedCount: { $sum: "$isCompleted" },
          invoicedCount: { $sum: "$isInvoiced" },
          rescheduledCount: { $sum: "$isRescheduled" },
          uniquePatients: { $addToSet: "$patientId" },
        },
      },
      {
        $project: {
          _id: 1,
          totalAppointments: 1,
          bookedCount: 1,
          cancelledCount: 1,
          completedCount: 1,
          invoicedCount: 1,
          rescheduledCount: 1,
          totalPatients: { $size: "$uniquePatients" },
        },
      },
      { $sort: { totalAppointments: -1 } },
    ]);

    const leaderboard = bookingsAgg.map((row) => ({
      staffId: String(row._id),
      staffName: staffMap.get(String(row._id))?.name || "Unknown",
      totalAppointments: row.totalAppointments || 0,
    }));

    // Define clinicMatch and dateMatch for revenue calculations
    const clinicMatch = clinicId ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } : {};
    const dateMatch = {
      $or: [
        { invoicedDate: { $gte: startAt, $lte: endAt } },
        { invoicedDate: null, createdAt: { $gte: startAt, $lte: endAt } },
      ],
    };

    // Revenue by doctor - ONLY appointment-based billings
    // (where treatment comes from appointment and matches appointment's services)
    // This mirrors the commission logic: if treatment is from appointment → doctor's revenue
    const basePipeline = [
      { $match: { ...clinicMatch, ...dateMatch } },
      // Must have appointmentId to be considered for doctor's revenue
      { $match: { appointmentId: { $ne: null } } },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: "$appointment" },
      // Filter by doctorStaff - only include billings where appointment has a doctorStaff
      { $match: { "appointment.doctorId": { $in: staffIds } } },
      // Check if treatment/service matches appointment's services
      // This ensures we only count revenue from treatments that were actually in the appointment
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
          // Extract serviceIds from appointment (both serviceIds array and services array)
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
              // Also include single serviceId if present
              { $cond: [{ $ifNull: ["$appointment.serviceId", false] }, [{ $toString: "$appointment.serviceId" }], []] },
            ],
          },
        },
      },
      {
        $addFields: {
          // Check if any of the billing's treatment service IDs are in the appointment's service IDs
          isFromAppointment: {
            $and: [
              // Must have appointment
              { $ne: [{ $ifNull: ["$appointment", null] }, null] },
              // Must have appointmentServiceIds OR have pendingClearedBreakdown (clearance-only billing)
              {
                $or: [
                  { $gt: [{ $size: "$appointmentServiceIds" }, 0] },
                  { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                ]
              },
              // Check if any billingServiceId is in appointmentServiceIds
              // OR if service is Package and has appointmentId
              // OR if billing has pendingClearedBreakdown (clearance-only)
              {
                $or: [
                  // Check if any treatment service ID matches
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
                  // Package billing with appointmentId (packages don't have selectedTreatments)
                  {
                    $and: [
                      { $eq: ["$service", "Package"] },
                      { $ne: ["$appointmentId", null] },
                    ],
                  },
                  // Clearance-only billing: has pendingClearedBreakdown
                  { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                ],
              },
            ],
          },
        },
      },
      // Only include billings where treatment/service is from appointment
      { $match: { isFromAppointment: true } },
      // Store billing-level paid amount before $unwind (for capping treatment amounts on partial payments)
      {
        $addFields: {
          billingPaid: {
            $add: [
              { $ifNull: ["$paid", 0] },
              { $ifNull: ["$advanceUsed", 0] },
              { $ifNull: ["$claimAmountUsed", 0] },
              { $ifNull: ["$cashbackWalletUsed", 0] }
            ]
          }
        }
      },
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
              { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
            ],
          },
        },
      },
    ];

    const revenueAgg = await Billing.aggregate([
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
      // Extract packageSoldBy from patient's packages array (for Package billings)
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [{
              $filter: {
                input: { $ifNull: ["$patient.packages", []] },
                as: "pkg",
                cond: { $and: [
                  { $eq: ["$$pkg.packageName", "$package"] },
                  { $ne: ["$$pkg.packageName", ""] },
                  { $ne: ["$$pkg.packageName", null] },
                ]},
              },
            }, 0],
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
      // Filter: For Package billings, only include if seller is a doctor
      {
        $match: {
          $or: [
            { service: { $ne: "Package" } },
            { $and: [{ service: "Package" }, { packageSoldByRole: "doctor" }] }
          ]
        }
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
                    { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
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
                // For package billings: treat as NOT direct (goes to doctor revenue)
                // For treatment billings: check selectedTreatments and appointmentId
                isOriginalBillingDirect: {
                  $cond: [
                    { $gt: [{ $size: "$originalBilling" }, 0] },
                    {
                      $cond: [
                        // If original billing is a Package, treat as NOT direct
                        { $eq: [{ $arrayElemAt: ["$originalBilling.service", 0] }, "Package"] },
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
                    null, // Original was direct billing → clearance goes to staff, not doctor
                  ],
                },
                effectiveAmount: { $ifNull: ["$pendingClearedBreakdown.amountCleared", 0] },
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
                    { $lte: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                    // Has pendingClearedBreakdown but pendingUsed = 0 = original billing that was cleared
                    { $eq: [{ $ifNull: ["$pendingUsed", 0] }, 0] },
                  ],
                },
              },
            },
            // Store billing-level paid amount for capping treatment amounts on partial payments
            {
              $addFields: {
                billingPaid: {
                  $add: [
                    { $ifNull: ["$paid", 0] },
                    { $ifNull: ["$advanceUsed", 0] },
                    { $ifNull: ["$claimAmountUsed", 0] },
                    { $ifNull: ["$cashbackWalletUsed", 0] }
                  ]
                }
              }
            },
            {
              $addFields: {
                isClearedItem: { $literal: false },
                // For Package billings, use packageSoldByUserId as effectiveDoctorId
                effectiveDoctorId: {
                  $cond: [
                    { $eq: ["$service", "Package"] },
                    { $ifNull: ["$packageSoldByUserId", "$appointment.doctorId"] },
                    "$appointment.doctorId"
                  ]
                },
                effectiveAmount: {
                  // After $unwind on selectedTreatments, compute directly from each treatment:
                  // - Non-Package billings: use treatment price × quantity
                  // - Package billings: use package portion (paid - treatment amount)
                  $cond: [
                    { $eq: ["$service", "Package"] },
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
                          $multiply: [
                            { $ifNull: ["$selectedTreatments.price", 0] },
                            { $ifNull: ["$selectedTreatments.quantity", 1] }
                          ]
                        },
                      ],
                    },
                    {
                      // Non-Package: use proportional scaling for partial payments
                      // Each treatment gets (treatmentAmount / totalAmount) × paid
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
                  // Extract packageSoldBy from patient's packages array
                  {
                    $addFields: {
                      packageSoldBy: {
                        $arrayElemAt: [{
                          $filter: {
                            input: { $ifNull: ["$patient.packages", []] },
                            as: "pkg",
                            cond: { $and: [
                              { $eq: ["$$pkg.packageName", "$package"] },
                              { $ne: ["$$pkg.packageName", ""] },
                              { $ne: ["$$pkg.packageName", null] },
                            ]},
                          },
                        }, 0],
                      },
                    },
                  },
                  {
                    $addFields: {
                      packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
                      packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
                    },
                  },
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
                  // Filter: For Package billings, only include if seller is a doctor
                  {
                    $match: {
                      $or: [
                        { service: { $ne: "Package" } },
                        { $and: [{ service: "Package" }, { packageSoldByRole: "doctor" }] }
                      ]
                    }
                  },
                  // Compute effective doctor and amount for the package portion
                  {
                    $addFields: {
                      isClearedItem: { $literal: false },
                      // For Package billings, use packageSoldByUserId as effectiveDoctorId
                      effectiveDoctorId: {
                        $cond: [
                          { $eq: ["$service", "Package"] },
                          { $ifNull: ["$packageSoldByUserId", "$appointment.doctorId"] },
                          "$appointment.doctorId"
                        ]
                      },
                      effectiveAmount: {
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
                                      { $gt: [{ $size: { $ifNull: ["$selectedTreatments", []] } }, 0] },
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
          revenue: { $sum: "$effectiveAmount" },
          invoices: { $sum: 1 },
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
                  { $ifNull: ["$selectedTreatments.treatmentName", "$treatment"] },
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
              paid: {
                $cond: [
                  "$isClearedItem",
                  "$effectiveAmount",
                  "$effectiveAmount",
                ],
              },
              pending: { $cond: ["$isClearedItem", 0, "$pending"] },
              advance: { $cond: ["$isClearedItem", 0, "$advance"] },
            }
          }
        }
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]);

    const revenueByStaff = revenueAgg.map((r) => ({
      staffId: String(r._id),
      staffName: staffMap.get(String(r._id))?.name || "Unknown",
      revenue: Math.round(Number(r.revenue || 0)),
      invoices: r.invoices || 0,
      details: r.details || [],
    }));
    // console.log("bookingsAggCount", bookingsAgg.length);
    // console.log("revenueByStaffCount", revenueByStaff.length);

    // Revenue by agent/staff - ONLY direct billings (no appointment OR treatment not from appointment)
    // This mirrors the commission logic: if treatment is NOT from appointment → agent's revenue
    const directBillingPipeline = [
      { $match: { ...clinicMatch, ...dateMatch } },
      // Lookup appointment to check if treatment matches
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
      // Extract packageSoldBy from patient's packages array (for Package billings)
      {
        $addFields: {
          packageSoldBy: {
            $arrayElemAt: [{
              $filter: {
                input: { $ifNull: ["$patient.packages", []] },
                as: "pkg",
                cond: { $and: [
                  { $eq: ["$$pkg.packageName", "$package"] },
                  { $ne: ["$$pkg.packageName", ""] },
                  { $ne: ["$$pkg.packageName", null] },
                ]},
              },
            }, 0],
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
      // Filter: For Package billings, only include if seller is an agent
      {
        $match: {
          $or: [
            { service: { $ne: "Package" } },
            { $and: [{ service: "Package" }, { packageSoldByRole: "agent" }] }
          ]
        }
      },
      // Determine if this is a direct billing (no appointment OR treatment doesn't match)
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
          // Extract serviceIds from appointment (both serviceIds array and services array)
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
              // Also include single serviceId if present
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
          billingPaid: {
            $add: [
              { $ifNull: ["$paid", 0] },
              { $ifNull: ["$advanceUsed", 0] },
              { $ifNull: ["$claimAmountUsed", 0] },
              { $ifNull: ["$cashbackWalletUsed", 0] }
            ]
          },
        },
      },
      // For clearance-only billings, lookup original billing to determine if it was direct or appointment-based
      {
        $lookup: {
          from: "billings",
          let: {
            hasBreakdown: { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
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
              { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
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
              // For non-clearance billings: direct if no appointment match
              {
                $cond: [
                  { $gt: [{ $size: { $ifNull: ["$pendingClearedBreakdown", []] } }, 0] },
                  "$isClearanceFromDirectBilling",
                  { $not: "$hasAppointmentMatch" }
                ]
              },
              // Treatment-level check: treatmentServiceId NOT in appointmentServiceIds
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
          // Calculate treatment amount using proportional scaling for partial payments
          // Each treatment gets (treatmentAmount / totalAmount) × paid
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
      // Only include treatments that are direct (not from appointment)
      { $match: { isTreatmentDirect: true } },
      // Include all billings to match Revenue Report (no filtering by invoicedById or appointment.doctorId)
      // For Package billings, override invoicedById to use packageSoldByUserId
      {
        $addFields: {
          effectiveInvoicedById: {
            $cond: [
              { $eq: ["$service", "Package"] },
              { $ifNull: ["$packageSoldByUserId", "$invoicedById"] },
              // For non-Package billings, use invoicedById
              "$invoicedById"
            ]
          },
          effectiveInvoicedByName: {
            $cond: [
              { $eq: ["$service", "Package"] },
              { $ifNull: ["$packageSoldByName", ""] },
              ""
            ]
          },
          // Use treatment amount as effective revenue
          effectiveRevenue: "$treatmentAmount",
          // Calculate effective amount for display
          effectiveAmount: "$treatmentAmount",
          // Calculate effective paid for display
          effectivePaid: "$treatmentAmount",
        },
      },
      {
        $group: {
          _id: "$effectiveInvoicedById",
          revenue: { $sum: "$effectiveRevenue" },
          invoices: { $sum: 1 },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              service: "$service",
              packageName: "$package",
              treatmentName: { $ifNull: ["$selectedTreatments.treatmentName", "$treatment"] },
              treatmentServiceId: { $ifNull: ["$selectedTreatments.treatmentServiceId", null] },
              treatmentQuantity: { $ifNull: ["$selectedTreatments.quantity", 1] },
              treatmentPrice: { $ifNull: ["$selectedTreatments.price", 0] },
              invoiceNumber: "$invoiceNumber",
              invoicedDate: "$invoicedDate",
              amount: "$effectiveAmount",
              paid: "$effectivePaid",
              pending: 0,
              advance: 0,
            },
          },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ];

    const directBillingAgg = await Billing.aggregate(directBillingPipeline);
    // console.log("directBillingAggCount", directBillingAgg.length);
    // console.log("directBillingAggData", JSON.stringify(directBillingAgg, null, 2));

    // Lookup agent users to get their names
    const agentIds = directBillingAgg.map((r) => r._id).filter(Boolean);
    console.log("agentIds", agentIds);
    const agentMap = agentIds.length
      ? new Map(
          (await User.find({ _id: { $in: agentIds } }).select("_id name").lean()).map((u) => [
            String(u._id),
            u.name || "Unknown",
          ])
        )
      : new Map();
    // console.log("agentMap", Array.from(agentMap.entries()));

    const revenueByAgent = directBillingAgg.map((r) => ({
      staffId: String(r._id),
      staffName: agentMap.get(String(r._id)) || staffMap.get(String(r._id))?.name || "Unknown",
      revenue: Math.round(Number(r.revenue || 0)),
      invoices: r.invoices || 0,
      details: r.details || [],
    }));
    // console.log("revenueByAgentCount", revenueByAgent.length);
    // console.log("revenueByAgentData", JSON.stringify(revenueByAgent, null, 2));

    const detailsTop5 = bookingsAgg.slice(0, 5).map((row) => ({
      staffId: String(row._id),
      staffName: staffMap.get(String(row._id))?.name || "Unknown",
      totalAppointments: row.totalAppointments || 0,
      booked: row.bookedCount || 0,
      cancelled: row.cancelledCount || 0,
      completed: row.completedCount || 0,
      invoiced: row.invoicedCount || 0,
      rescheduled: row.rescheduledCount || 0,
      totalPatients: row.totalPatients || 0,
    }));

    // Top commissions (doctorStaff and agents)
    const commissionAmountExpr = {
      $cond: [
        { $gt: ["$finalCommissionAmount", 0] },
        "$finalCommissionAmount",
        "$commissionAmount",
      ],
    };
    // console.log("commissionQueryFilters", {
    //   clinicMatch,
    //   dateMatch,
    // });

    const topDoctorStaffCommissionAgg = await Commission.aggregate([
      { $match: { ...clinicMatch, source: "staff", ...dateMatch } },
      { $lookup: { from: "users", localField: "staffId", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $match: { "user.role": "doctorStaff" } },
      { $lookup: { from: "patientregistrations", localField: "patientId", foreignField: "_id", as: "patient" } },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "billings", localField: "billingId", foreignField: "_id", as: "billing" } },
      { $unwind: { path: "$billing", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$staffId",
          totalCommission: { $sum: commissionAmountExpr },
          entries: { $sum: 1 },
          name: { $first: "$user.name" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              invoiceNumber: "$billing.invoiceNumber",
              invoicedDate: "$invoicedDate",
              amountPaid: { $ifNull: ["$amountPaid", 0] },
              commissionAmount: commissionAmountExpr,
              totalAmount: { $ifNull: ["$billing.amount", 0] },
              paid: { $ifNull: ["$billing.paid", 0] },
              pending: { $ifNull: ["$billing.pending", 0] },
              advance: { $ifNull: ["$billing.advance", 0] },
            }
          }
        },
      },
      { $sort: { totalCommission: -1 } },
      { $limit: 5 },
    ]);
    // console.log("topDoctorStaffCommissionAggCount", topDoctorStaffCommissionAgg.length);

    const topAgentCommissionAggStaff = await Commission.aggregate([
      { $match: { ...clinicMatch, source: "staff", ...dateMatch, staffId: { $ne: null } } },
      { $lookup: { from: "users", localField: "staffId", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $match: { "user.role": "agent" } },
      { $lookup: { from: "patientregistrations", localField: "patientId", foreignField: "_id", as: "patient" } },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "billings", localField: "billingId", foreignField: "_id", as: "billing" } },
      { $unwind: { path: "$billing", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$staffId",
          totalCommission: { $sum: commissionAmountExpr },
          entries: { $sum: 1 },
          name: { $first: "$user.name" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              invoiceNumber: "$billing.invoiceNumber",
              invoicedDate: "$invoicedDate",
              amountPaid: { $ifNull: ["$amountPaid", 0] },
              commissionAmount: commissionAmountExpr,
              totalAmount: { $ifNull: ["$billing.amount", 0] },
              paid: { $ifNull: ["$billing.paid", 0] },
              pending: { $ifNull: ["$billing.pending", 0] },
              advance: { $ifNull: ["$billing.advance", 0] },
            }
          }
        },
      },
      { $sort: { totalCommission: -1 } },
    ]);
    // console.log("topAgentCommissionAggStaffCount", topAgentCommissionAggStaff.length);

    const topAgentCommissionAggReferral = await Commission.aggregate([
      { $match: { ...clinicMatch, source: "referral", ...dateMatch } },
      { $lookup: { from: "referrals", localField: "referralId", foreignField: "_id", as: "ref" } },
      { $unwind: { path: "$ref", preserveNullAndEmptyArrays: false } },
      {
        $lookup: {
          from: "users",
          let: { email: "$ref.email", phone: "$ref.phone", clinic: "$clinicId" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$clinicId", "$$clinic"] },
                    {
                      $or: [
                        {
                          $and: [
                            { $ne: ["$$email", null] },
                            { $eq: ["$email", { $toLower: "$$email" }] },
                          ],
                        },
                        {
                          $and: [
                            { $ne: ["$$phone", null] },
                            { $eq: ["$phone", "$$phone"] },
                          ],
                        },
                      ],
                    },
                  ],
                },
              },
            },
            { $match: { role: "agent" } },
          ],
          as: "user",
        },
      },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: false } },
      { $lookup: { from: "patientregistrations", localField: "patientId", foreignField: "_id", as: "patient" } },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "billings", localField: "billingId", foreignField: "_id", as: "billing" } },
      { $unwind: { path: "$billing", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$user._id",
          totalCommission: { $sum: commissionAmountExpr },
          entries: { $sum: 1 },
          name: { $first: "$user.name" },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              invoiceNumber: "$billing.invoiceNumber",
              invoicedDate: "$invoicedDate",
              amountPaid: { $ifNull: ["$amountPaid", 0] },
              commissionAmount: commissionAmountExpr,
              totalAmount: { $ifNull: ["$billing.amount", 0] },
              paid: { $ifNull: ["$billing.paid", 0] },
              pending: { $ifNull: ["$billing.pending", 0] },
              advance: { $ifNull: ["$billing.advance", 0] },
            }
          }
        },
      },
      { $sort: { totalCommission: -1 } },
    ]);
    // console.log("topAgentCommissionAggReferralCount", topAgentCommissionAggReferral.length);
    const referralTotal = await Commission.countDocuments({ ...clinicMatch, source: "referral", ...dateMatch });
    const referralWithStaffId = await Commission.countDocuments({ ...clinicMatch, source: "referral", ...dateMatch, staffId: { $ne: null } });
    // console.log("referralCommissionStats", { referralTotal, referralWithStaffId });
    const sampleRefComms = await Commission.find({ ...clinicMatch, source: "referral", ...dateMatch }).limit(3).select("referralId staffId").lean();
    for (const c of sampleRefComms) {
      const ReferralModel = (await import("../../../../models/Referral")).default;
      const ref = c.referralId ? await ReferralModel.findById(c.referralId).lean() : null;
      // console.log("sampleReferralCommission", {
      //   staffId: c.staffId ? String(c.staffId) : null,
      //   referralId: c.referralId ? String(c.referralId) : null,
      //   email: ref?.email || null,
      //   phone: ref?.phone || null,
      // });
    }

    const topDoctorStaffCommission = topDoctorStaffCommissionAgg.map((r) => ({
      staffId: String(r._id || ""),
      name: r.name || "Unknown",
      totalCommission: Math.round(Number(r.totalCommission || 0)),
      entries: r.entries || 0,
      details: r.details || [],
    }));

    const combinedAgentMap = new Map();
    [...topAgentCommissionAggStaff, ...topAgentCommissionAggReferral].forEach((r) => {
      const key = String(r._id || "");
      if (!key) return;
      const existing = combinedAgentMap.get(key);
      const total = Math.round(Number(r.totalCommission || 0));
      const entries = r.entries || 0;
      const details = r.details || [];
      if (!existing) {
        combinedAgentMap.set(key, { 
        staffId: key, 
        name: r.name || "Unknown", 
        totalCommission: total, 
        entries,
        details: details
      });
      } else {
        combinedAgentMap.set(key, {
          staffId: key,
          name: existing.name || r.name || "Unknown",
          totalCommission: existing.totalCommission + total,
          entries: (existing.entries || 0) + entries,
          details: [...(existing.details || []), ...details]
        });
      }
    });
    const topAgentCommission = Array.from(combinedAgentMap.values())
      .sort((a, b) => b.totalCommission - a.totalCommission)
      .slice(0, 5);
    // console.log("topAgentCommissionResultCount", topAgentCommission.length, "ids", topAgentCommission.map((x) => x.staffId));

    // New: Highest billing in memberships and packages per doctor staff with details
        // Highest billing in packages - mirrors the Revenue Report's byPackageAgg logic
    // to handle clearance billings and mixed billings properly
    const packageBillingAgg = await Billing.aggregate([
      // 1. Match clinic + date range (do not pre-filter by service type)
      { $match: { ...clinicMatch, ...dateMatch } },
      // 2. Lookup appointment to get doctorId
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "appointment",
        },
      },
      { $unwind: "$appointment" },
      // Filter by doctorStaff
      { $match: { "appointment.doctorId": { $in: staffIds } } },
      // 3. Lookup patient registration
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
            $arrayElemAt: [{
              $filter: {
                input: { $ifNull: ["$patient.packages", []] },
                as: "pkg",
                cond: { $and: [
                  { $eq: ["$$pkg.packageName", "$package"] },
                  { $ne: ["$$pkg.packageName", ""] },
                  { $ne: ["$$pkg.packageName", null] },
                ]},
              },
            }, 0],
          },
        },
      },
      {
        $addFields: {
          packageSoldByName: { $ifNull: ["$packageSoldBy.packageSoldBy", ""] },
          packageSoldByUserId: { $ifNull: ["$packageSoldBy.packageSoldByUserId", null] },
        },
      },
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
      // 4. Capture breakdown info BEFORE $unwind
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
      // 5. Unwind pendingClearedBreakdown
      {
        $unwind: {
          path: "$pendingClearedBreakdown",
          preserveNullAndEmptyArrays: true,
        },
      },
      // 6. Derive effective service/package/amount for each row
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
                  // Mixed billing: Package billing with breakdown pointing to DIFFERENT invoice
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
                  // Otherwise (clearance billing): use amountCleared
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
                              { $gt: [{ $size: { $ifNull: ["$selectedTreatments", []] } }, 0] },
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
      // 7. Keep only Package rows
      {
        $match: {
          $or: [
            { isClearedItem: false, service: "Package" },
            { isClearedItem: true, effectiveService: "Package" },
            { isClearedItem: true, service: "Package", _isMixedBilling: true },
          ],
        },
      },
      // 8. Resolve final group key
      {
        $addFields: {
          resolvedPackageName: {
            $cond: [
              // Clearance billing (isClearedItem=true AND NOT mixed billing)
              {
                $and: [
                  "$isClearedItem",
                  { $not: "$_isMixedBilling" },
                ],
              },
              { $ifNull: ["$effectivePackageName", "Unknown"] },
              // Otherwise: use billing's own package name
              { $ifNull: ["$package", "Unknown"] },
            ],
          },
        },
      },
      // 9. Group by packageSoldByUserId (the person who sold the package)
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$service", "Package"] },
              { $ifNull: ["$packageSoldByUserId", "$appointment.doctorId"] },
              "$appointment.doctorId"
            ]
          },
          amount: { $sum: "$effectiveAmount" },
          count: { $sum: 1 },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              service: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$service",
                  { $cond: ["$isClearedItem", "$effectiveService", "$service"] },
                ],
              },
              packageName: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$package",
                  { $cond: ["$isClearedItem", "$effectivePackageName", "$package"] },
                ],
              },
              treatmentName: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$treatment",
                  { $cond: ["$isClearedItem", { $ifNull: ["$pendingClearedBreakdown.treatmentName", null] }, "$treatment"] },
                ],
              },
              invoiceNumber: {
                $cond: [
                  { $and: ["$isClearedItem", "$_isMixedBilling"] },
                  "$invoiceNumber",
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
                          { $gt: [{ $size: { $ifNull: ["$selectedTreatments", []] } }, 0] },
                        ],
                      },
                      "$effectiveAmount",
                      // Clearance billing: 0
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
            }
          }
        }
      },
      { $sort: { amount: -1 } },
      { $limit: 5 }
    ]);

    // Lookup users for package billing (could be agents, not just doctorStaff)
    const packageStaffIds = packageBillingAgg.map((r) => r._id).filter(Boolean);
    const packageStaffMap = packageStaffIds.length
      ? new Map(
          (await User.find({ _id: { $in: packageStaffIds } }).select("_id name").lean()).map((u) => [
            String(u._id),
            u.name || "Unknown",
          ])
        )
      : new Map();

    const topPackageBilling = packageBillingAgg.map(r => ({
      staffId: String(r._id || ""),
      name: packageStaffMap.get(String(r._id)) || "Unknown",
      amount: Math.round(Number(r.amount || 0)),
      count: r.count,
      details: r.details || []
    }));

    const membershipBillingAgg = await Billing.aggregate([
      {
        $match: {
          ...(clinicId ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } : {}),
          invoicedDate: { $gte: startAt, $lte: endAt },
          $or: [
            { membershipDiscountApplied: { $gt: 0 } },
            { isFreeConsultation: true }
          ],
          doctorId: { $ne: null },
        }
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
      {
        $group: {
          _id: "$doctorId",
          amount: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$advanceUsed", 0] }, { $ifNull: ["$claimAmountUsed", 0] }, { $ifNull: ["$cashbackWalletUsed", 0] } ] } },
          count: { $sum: 1 },
          details: {
            $push: {
              patientId: "$patientId",
              patientName: { $concat: ["$patient.firstName", " ", { $ifNull: ["$patient.lastName", ""] }] },
              emrNumber: "$patient.emrNumber",
              service: "$service",
              packageName: "$package",
              treatmentName: "$treatment",
              invoiceNumber: "$invoiceNumber",
              invoicedDate: "$invoicedDate",
              amount: { $ifNull: ["$amount", 0] },
              paid: { $ifNull: ["$paid", 0] },
              pending: { $ifNull: ["$pending", 0] },
              advance: { $ifNull: ["$advance", 0] },
              isFreeConsultation: "$isFreeConsultation",
              membershipDiscountApplied: "$membershipDiscountApplied"
            }
          }
        }
      },
      { $sort: { amount: -1 } },
      { $limit: 5 }
    ]);

    const topMembershipBilling = membershipBillingAgg.map(r => ({
      staffId: String(r._id || ""),
      name: staffMap.get(String(r._id))?.name || "Unknown",
      amount: Math.round(Number(r.amount || 0)),
      count: r.count,
      details: r.details || []
    }));

    return res.status(200).json({
      success: true,
      data: {
        leaderboard,
        top5Revenue: revenueByStaff,
        top5AgentRevenue: revenueByAgent,
        top5Details: detailsTop5,
        topDoctorStaffCommission,
        topAgentCommission,
        topPackageBilling,
        topMembershipBilling,
        // Debug info
        debug: {
          directBillingAggCount: directBillingAgg.length,
          directBillingAggData: directBillingAgg,
          revenueByAgentCount: revenueByAgent.length,
          revenueByAgentData: revenueByAgent,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Failed to load doctor staff performance" });
  }
}

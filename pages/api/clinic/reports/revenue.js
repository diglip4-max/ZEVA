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

    // total revenue – from ALL billings (not just those with appointments)
    const totalRevenueAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      { $group: { _id: null, total: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } } } },
    ]);
    const totalRevenue = Math.round(Number(totalRevenueAgg[0]?.total || 0));

    // revenue component: package billing (all Package billings)
    const packageRevenueAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch, service: "Package" } },
      { $group: { _id: null, total: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } } } },
    ]);
    const packageRevenue = Math.round(Number(packageRevenueAgg[0]?.total || 0));

    // revenue component: advance-only payments
    const advanceRevenueAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch, isAdvanceOnly: true } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$paid", 0] } } } },
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

    // revenue component: treatment/service (current pipeline – billings with appointments)
    const treatmentRevenueAgg = await Billing.aggregate([
      ...basePipeline,
      { $group: { _id: null, total: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } } } },
    ]);
    const treatmentRevenue = Math.round(Number(treatmentRevenueAgg[0]?.total || 0));

    // revenue by doctor
    const byDoctorAgg = await Billing.aggregate([
      ...basePipeline,
      { $group: { _id: "$appointment.doctorId", amount: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } } } },
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
    }));

    // Revenue by Service – mirrors the aggregation in service-performance.js so each
    // individual service name is listed with its own paid amount. Package billings
    // are excluded here (they appear separately in Revenue by Package).
    const byServiceAgg = await Billing.aggregate([
      // 1. Match clinic + date range + Treatment & Service billings only
      {
        $match: {
          ...clinicMatch,
          ...dateMatch,
          service: { $in: ["Treatment", "Service"] },
        },
      },
      // 2. Lookup appointment (preserveNullAndEmptyArrays)
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
      // 3. Resolve service name from billing.treatment, falling back to apptSvc.name
      //    so each individual service stays as its own group key (never collapsed
      //    into a generic category like Package/Treatment/Service)
      {
        $addFields: {
          resolvedServiceName: {
            $ifNull: ["$treatment", { $ifNull: ["$apptSvc.name", "Unknown"] }],
          },
        },
      },
      // 4. Group by the resolved service name and sum `paid` + pendingUsed + pendingClaimUsed per service
      //    (same shape as the $group in service-performance.js)
      {
        $group: {
          _id: "$resolvedServiceName",
          amount: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } },
        },
      },
      { $sort: { amount: -1 } },
    ]);
    const revenueByService = byServiceAgg.map((s) => ({
      serviceId: String(s._id || ""),
      name: s._id || "Unknown",
      amount: Math.round(Number(s.amount || 0)),
    }));

    // revenue by package (all Package billings grouped by package name)
    const byPackageAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch, service: "Package" } },
      { $group: { _id: { $ifNull: ["$package", "Unknown"] }, amount: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } } } },
      { $sort: { amount: -1 } },
    ]);
    const revenueByPackage = byPackageAgg.map((p) => ({
      packageName: p._id || "Unknown",
      amount: Math.round(Number(p.amount || 0)),
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
    const departmentObjectId =
      departmentId && mongoose.Types.ObjectId.isValid(String(departmentId))
        ? new mongoose.Types.ObjectId(String(departmentId))
        : null;

    const departmentPipeline = [
      // 1. Clinic + date range + Treatment/Service billings only
      {
        $match: {
          ...clinicMatch,
          ...dateMatch,
          service: { $in: ["Treatment", "Service"] },
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
      // 4. Resolve service name: billing.treatment, fallback to apptSvc.name
      {
        $addFields: {
          resolvedServiceName: {
            $ifNull: ["$treatment", { $ifNull: ["$apptSvc.name", "Unknown"] }],
          },
        },
      },
      // 5. Group by service name first to sum paid + pendingUsed + pendingClaimUsed per service
      //    (matches the first $group in department-performance.js)
      {
        $group: {
          _id: "$resolvedServiceName",
          clinicId: { $first: "$clinicId" },
          totalRevenue: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } },
        },
      },
      // 6. Lookup service doc by clinicId + name to get departmentId
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
      // 7. Project with resolved departmentId
      {
        $project: {
          serviceName: "$_id",
          clinicId: 1,
          totalRevenue: 1,
          departmentId: {
            $ifNull: [{ $arrayElemAt: ["$serviceDoc.departmentId", 0] }, null],
          },
        },
      },
      // 8. If a specific departmentId filter is requested, keep only that one
      ...(departmentObjectId
        ? [{ $match: { departmentId: departmentObjectId } }]
        : []),
      // 9. Group by departmentId and sum paid amounts (same final grouping as
      //    department-performance.js's Department Performance section)
      {
        $group: {
          _id: "$departmentId",
          amount: { $sum: "$totalRevenue" },
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
    const revenueByDepartment = byDepartmentAgg.map((d) => ({
      departmentId: String(d._id || ""),
      name: departmentMap.get(String(d._id)) || "Unknown",
      amount: Math.round(Number(d.amount || 0)),
    }));

    // revenue by payment method (respect multiplePayments) – ALL billings, not just those with appointments
    const paymentsAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $project: {
          // Calculate all amounts that should be considered "paid" for revenue
          paid: { $ifNull: ["$paid", 0] },
          advanceUsed: { $ifNull: ["$advanceUsed", 0] },
          claimAmountUsed: { $ifNull: ["$claimAmountUsed", 0] },
          cashbackWalletUsed: { $ifNull: ["$cashbackWalletUsed", 0] },
          pendingUsed: { $ifNull: ["$pendingUsed", 0] },
          paymentMethod: { $ifNull: ["$paymentMethod", "Cash"] },
          multiplePayments: { $ifNull: ["$multiplePayments", []] }
        }
      },
      {
        $project: {
          // Calculate total of existing payments
          totalFromPayments: {
            $reduce: {
              input: "$multiplePayments",
              initialValue: 0,
              in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] }
            }
          },
          // Calculate total expected paid amount (all credits included)
          totalExpected: {
            $add: [
              "$paid",
              "$advanceUsed",
              "$claimAmountUsed",
              "$cashbackWalletUsed",
              "$pendingUsed",
              { $ifNull: ["$pendingClaimUsed", 0] }
            ]
          },
          paymentMethod: 1,
          multiplePayments: 1
        }
      },
      {
        $project: {
          // Determine if there's a difference to add
          difference: { $max: [0, { $subtract: ["$totalExpected", "$totalFromPayments"] }] },
          paymentMethod: 1,
          multiplePayments: 1
        }
      },
      {
        $project: {
          // Build the payments array: existing payments + difference if any
          payments: {
            $cond: [
              { $gt: ["$difference", 0] },
              {
                $concatArrays: [
                  "$multiplePayments",
                  [
                    {
                      paymentMethod: "$paymentMethod",
                      amount: "$difference"
                    }
                  ]
                ]
              },
              "$multiplePayments"
            ]
          }
        }
      },
      { $unwind: "$payments" },
      {
        $group: {
          _id: "$payments.paymentMethod",
          amount: { $sum: { $ifNull: ["$payments.amount", 0] } },
        },
      },
      { $sort: { amount: -1 } },
    ]);
    const revenueByPaymentMethod = paymentsAgg.map((p) => ({
      method: p._id || "Unknown",
      amount: Math.round(Number(p.amount || 0)),
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

    // payment reports list – covers ALL billings (not just those with appointments)
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
          multiplePayments: 1
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
          multiplePayments: 1
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
          }
        }
      },
      { $unwind: "$payments" },
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
      return {
        invoiceNumber: p.invoiceNumber || "",
        patientName: p.patientName || "",
        service: p.serviceName || "Unknown",
        doctorName: p.doctorName || "—",
        amount: Math.round(Number(p.originalAmount || p.amount || 0)),
        paidAmount: paid,
        paymentMethod: normalizeMethod(p.method),
        transactionType: normalizeTxnType(p.transactionType),
        paymentStatus: status,
        paymentDate: p.paymentDate || null,
      };
    });

    // views: daily/weekly/monthly/yearly – ALL billings, not just those with appointments
    const views = {};
    const dailyAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$invoicedDate" } },
          amount: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    views.daily = dailyAgg.map((d) => ({ label: d._id, amount: Math.round(Number(d.amount || 0)) }));

    const weeklyAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $group: {
          _id: {
            year: { $isoWeekYear: "$invoicedDate" },
            week: { $isoWeek: "$invoicedDate" },
          },
          amount: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } },
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
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$invoicedDate" } },
          amount: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    views.monthly = monthlyAgg.map((m) => ({ label: m._id, amount: Math.round(Number(m.amount || 0)) }));

    const yearlyAgg = await Billing.aggregate([
      { $match: { ...clinicMatch, ...dateMatch } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y", date: "$invoicedDate" } },
          amount: { $sum: { $add: [ { $ifNull: ["$paid", 0] }, { $ifNull: ["$pendingUsed", 0] }, { $ifNull: ["$pendingClaimUsed", 0] } ] } },
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

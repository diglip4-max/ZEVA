import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import { getUserFromReq } from "../../lead-ms/auth";
import {
  getClinicIdFromUser,
  checkClinicPermission,
} from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";

// ============================================================================
// ADVANCE REPORT — (Advance & Pending slider, Advance Balance section)
// ----------------------------------------------------------------------------
// Returns per-patient advance balances for the selected date range.
//
// BASIS (as specified by the product requirement): a Billing record counts as
// an advance payment when `treatment === "Advance Payment"` (this is exactly
// what /api/clinic/patient-balance/add-advance-payment stores).
//
// DATE FILTER: follows the same semantics as the Revenue / Package /
// Appointment reports — `invoicedDate` with a `createdAt` fallback, wrapped
// in its own $match stage so the single $expr key can never be clobbered by
// another spread-in $expr (see the historical packageRevenueAgg bug).
//
// RESPONSE
//   data.patients: [{
//     patientId, patientName, emrNumber, mobileNumber,
//     totalAdvance, paymentCount, lastPaymentDate,
//     payments: [{ _id, invoiceNumber, advanceAmount, paid, paymentMethod,
//                  multiplePayments, transactionId, attachment, notes,
//                  status, date }]
//   }]
//   data.totals: { totalAdvance, totalPatients, totalPayments }
// ============================================================================

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

  const { hasPermission } = await checkClinicPermission(
    clinicId,
    "clinic_reporting",
    "read",
  );
  if (!hasPermission) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to view reports",
    });
  }

  const { startDate, endDate } = req.query;

  const start = startDate
    ? new Date(startDate)
    : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid date range" });
  }
  const startAt = new Date(start);
  startAt.setHours(0, 0, 0, 0);
  const endAt = new Date(end);
  endAt.setHours(23, 59, 59, 999);

  const clinicMatch = clinicId
    ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) }
    : {};

  const dateMatch = {
    $expr: {
      $and: [
        { $gte: [{ $ifNull: ["$invoicedDate", "$createdAt"] }, startAt] },
        { $lte: [{ $ifNull: ["$invoicedDate", "$createdAt"] }, endAt] },
      ],
    },
  };

  try {
    // Single optimized aggregation:
    //   filter -> sort -> lookup patient -> group by patient -> order by total
    const patients = await Billing.aggregate([
      // Advance payments inside the selected range. Only ONE $expr key lives
      // in this object (dateMatch) — the treatment filter is a plain field.
      { $match: { ...clinicMatch, ...dateMatch, treatment: "Advance Payment" } },

      // Compute the effective date once for sorting + display.
      { $addFields: { effectiveDate: { $ifNull: ["$invoicedDate", "$createdAt"] } } },

      // Newest payments first — $push below preserves this order.
      { $sort: { effectiveDate: -1 } },

      // Patient identity (name / EMR / mobile) for the table + View modal.
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },

      // One row per patient with the full payment breakdown attached.
      {
        $group: {
          _id: "$patientId",
          patientName: {
            // $let must be nested inside an accumulator ($first) — it cannot
            // sit at the top level of a $group field definition.
            $first: {
              $let: {
                vars: {
                  full: {
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
                },
                in: {
                  $cond: [{ $eq: ["$$full", ""] }, "Unknown Patient", "$$full"],
                },
              },
            },
          },
          emrNumber: { $first: { $ifNull: ["$patient.emrNumber", ""] } },
          mobileNumber: { $first: { $ifNull: ["$patient.mobileNumber", ""] } },
          // Advance amount = value of the `advance` field (canonical for
          // advance-payment records); falls back to `paid` defensively.
          totalAdvance: {
            $sum: {
              $cond: [
                { $gt: [{ $ifNull: ["$advance", 0] }, 0] },
                { $ifNull: ["$advance", 0] },
                { $ifNull: ["$paid", 0] },
              ],
            },
          },
          paymentCount: { $sum: 1 },
          lastPaymentDate: { $max: "$effectiveDate" },
          payments: {
            $push: {
              _id: "$_id",
              invoiceNumber: "$invoiceNumber",
              advanceAmount: {
                $cond: [
                  { $gt: [{ $ifNull: ["$advance", 0] }, 0] },
                  { $ifNull: ["$advance", 0] },
                  { $ifNull: ["$paid", 0] },
                ],
              },
              paid: { $ifNull: ["$paid", 0] },
              paymentMethod: { $ifNull: ["$paymentMethod", ""] },
              multiplePayments: { $ifNull: ["$multiplePayments", []] },
              transactionId: { $ifNull: ["$transactionId", ""] },
              attachment: { $ifNull: ["$attachment", ""] },
              notes: { $ifNull: ["$notes", ""] },
              status: { $ifNull: ["$status", ""] },
              date: "$effectiveDate",
            },
          },
        },
      },

      // Highest advance first — most useful default order for the table.
      { $sort: { totalAdvance: -1 } },
    ]);

    const totals = patients.reduce(
      (acc, p) => {
        acc.totalAdvance += Number(p.totalAdvance || 0);
        acc.totalPatients += 1;
        acc.totalPayments += Number(p.paymentCount || 0);
        return acc;
      },
      { totalAdvance: 0, totalPatients: 0, totalPayments: 0 },
    );
    totals.totalAdvance = Number(totals.totalAdvance.toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        patients,
        totals,
        range: { startDate: startAt, endDate: endAt },
      },
    });
  } catch (error) {
    console.error("Advance report error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to build advance report",
    });
  }
}

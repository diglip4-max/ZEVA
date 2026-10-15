import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import { getUserFromReq } from "../../lead-ms/auth";
import {
  getClinicIdFromUser,
  checkClinicPermission,
} from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";

// ============================================================================
// PENDING CLEARANCE REPORT — (Advance & Pending slider, Pending Clearance)
// ----------------------------------------------------------------------------
// Returns per-patient pending clearances for the selected date range.
//
// BASIS (as specified by the product requirement): a Billing record counts as
// a pending clearance when its `pendingClearedBreakdown` array contains at
// least one entry with `amountCleared > 0` — i.e. the patient's pending
// amount for a treatment / package on an invoice was cleared by a payment.
// Written by:
//   - /api/clinic/pending-ledgers/clear                 (audit billing, PAY-*)
//   - /api/clinic/billing/pay-invoice-pending/[billingId]
//   - /api/clinic/patient-balance/add-pending-payment/[patientId]
//
// DATE FILTER: same semantics as the Revenue / Package / Appointment /
// Advance reports — `invoicedDate` with a `createdAt` fallback, wrapped in
// its own $match stage so the single $expr key can never be clobbered by a
// spread-in $expr (see the historical packageRevenueAgg bug).
//
// RESPONSE
//   data.patients: [{
//     patientId, patientName, emrNumber, mobileNumber,
//     totalCleared, clearanceCount, lastClearanceDate,
//     clearances: [{ _id, invoiceNumber, treatment, service,
//                    clearanceAmount, entryCount, paymentMethod,
//                    multiplePayments, transactionId, attachment, notes,
//                    status, date }]
//   }]
//   data.totals: { totalCleared, totalPatients, totalClearances }
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
    //   filter -> compute clearance amount -> sort -> lookup patient ->
    //   group by patient -> order by total
    const patients = await Billing.aggregate([
      // Clearances inside the selected range. Only ONE $expr key lives in
      // this object (dateMatch) — the breakdown filter is a plain field.
      {
        $match: {
          ...clinicMatch,
          ...dateMatch,
          pendingClearedBreakdown: { $elemMatch: { amountCleared: { $gt: 0 } } },
        },
      },

      // Compute effective date + total cleared on this billing in one pass.
      {
        $addFields: {
          effectiveDate: { $ifNull: ["$invoicedDate", "$createdAt"] },
          clearanceAmount: {
            $sum: {
              $map: {
                input: { $ifNull: ["$pendingClearedBreakdown", []] },
                as: "e",
                in: { $ifNull: ["$$e.amountCleared", 0] },
              },
            },
          },
        },
      },

      // Defensive: an array present with every amount at 0 is not a clearance.
      { $match: { clearanceAmount: { $gt: 0 } } },

      // Newest clearances first — $push below preserves this order.
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

      // One row per patient with the full clearance breakdown attached.
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
          totalCleared: { $sum: "$clearanceAmount" },
          clearanceCount: { $sum: 1 },
          lastClearanceDate: { $max: "$effectiveDate" },
          clearances: {
            $push: {
              _id: "$_id",
              invoiceNumber: "$invoiceNumber",
              treatment: { $ifNull: ["$treatment", ""] },
              service: { $ifNull: ["$service", ""] },
              clearanceAmount: "$clearanceAmount",
              entryCount: { $size: { $ifNull: ["$pendingClearedBreakdown", []] } },
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

      // Highest cleared amount first — most useful default order for the table.
      { $sort: { totalCleared: -1 } },
    ]);

    const totals = patients.reduce(
      (acc, p) => {
        acc.totalCleared += Number(p.totalCleared || 0);
        acc.totalPatients += 1;
        acc.totalClearances += Number(p.clearanceCount || 0);
        return acc;
      },
      { totalCleared: 0, totalPatients: 0, totalClearances: 0 },
    );
    totals.totalCleared = Number(totals.totalCleared.toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        patients,
        totals,
        range: { startDate: startAt, endDate: endAt },
      },
    });
  } catch (error) {
    console.error("Pending clearance report error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to build pending clearance report",
    });
  }
}

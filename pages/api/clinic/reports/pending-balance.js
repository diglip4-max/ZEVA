import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import { getUserFromReq } from "../../lead-ms/auth";
import {
  getClinicIdFromUser,
  checkClinicPermission,
} from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";

// ============================================================================
// PENDING BALANCE REPORT — (Advance & Pending slider, Pending Balance section)
// ----------------------------------------------------------------------------
// Returns per-patient outstanding pending balances for the selected date
// range — mirrors how /clinic/patient-profile-view shows the overview
// "Pending Payment" card and its per-treatment "Pending Breakdown":
//
//   - AMOUNT  : sum of `Billing.pending` across the patient's billings
//               (the profile card sums exactly the same field:
//                pages/api/clinic/patient-balance/[patientId].js ->
//                totalPending += Number(b.pending || 0)).
//   - BREAKDOWN : PatientPendingLedger rows (status Open/Partial,
//               remainingAmount > 0) attached to those billings — the same
//               rows the profile's "Pending Breakdown" panel renders with
//               treatmentName / packageName / remainingAmount / status.
//               Legacy billings created BEFORE the ledger release have no
//               ledger rows; for those a single item is synthesised from the
//               billing itself, exactly like lib/pendingLedger.js
//               syncBillingFromLegacy backfills (originalAmount = pending,
//               paidAmount = 0, status "Open").
//
// DATE FILTER: same semantics as the Revenue / Package / Appointment /
// Advance / Pending-clearance reports — `invoicedDate` with a `createdAt`
// fallback, wrapped in its own $match stage so the single $expr key can
// never be clobbered by a spread-in $expr.
//
// RESPONSE
//   data.patients: [{
//     patientId, patientName, emrNumber, mobileNumber,
//     totalPending, invoiceCount, itemCount, lastPendingDate,
//     pendingBreakdown: [{ ledgerId, invoiceNumber, service, treatmentName,
//                          packageName, originalAmount, paidAmount,
//                          remainingAmount, status, date }]
//   }]
//   data.totals: { totalPending, totalPatients, totalItems }
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
    //   billings with pending -> ledger breakdown per billing -> patient group
    const patients = await Billing.aggregate([
      // Outstanding billings inside the selected range. Only ONE $expr key
      // lives in this object (dateMatch) — `pending` is a plain field.
      { $match: { ...clinicMatch, ...dateMatch, pending: { $gt: 0 } } },

      // Compute the effective date once for sorting + display.
      { $addFields: { effectiveDate: { $ifNull: ["$invoicedDate", "$createdAt"] } } },

      // Newest invoices first — preserved by $push in the group stage.
      { $sort: { effectiveDate: -1 } },

      // Ledger rows of this billing (per-treatment / per-package detail).
      {
        $lookup: {
          from: "patientpendingledgers",
          localField: "_id",
          foreignField: "parentBillingId",
          as: "ledgerRows",
        },
      },

      // Only rows that still contribute to the outstanding amount.
      {
        $addFields: {
          openLedgerRows: {
            $filter: {
              input: { $ifNull: ["$ledgerRows", []] },
              as: "l",
              cond: {
                $and: [
                  { $in: ["$$l.status", ["Open", "Partial"]] },
                  { $gt: [{ $ifNull: ["$$l.remainingAmount", 0] }, 0] },
                ],
              },
            },
          },
        },
      },

      // Breakdown items for this billing: real ledger rows when they exist,
      // otherwise a single synthesised legacy row (see header comment).
      {
        $addFields: {
          pendingItems: {
            $cond: [
              { $gt: [{ $size: "$openLedgerRows" }, 0] },
              {
                $map: {
                  input: "$openLedgerRows",
                  as: "l",
                  in: {
                    ledgerId: "$$l.ledgerId",
                    invoiceNumber: {
                      $ifNull: ["$$l.invoiceNumber", "$invoiceNumber"],
                    },
                    service: { $ifNull: ["$$l.service", "Service"] },
                    treatmentName: { $ifNull: ["$$l.treatmentName", null] },
                    packageName: { $ifNull: ["$$l.packageName", null] },
                    originalAmount: { $ifNull: ["$$l.originalAmount", 0] },
                    paidAmount: { $ifNull: ["$$l.paidAmount", 0] },
                    remainingAmount: { $ifNull: ["$$l.remainingAmount", 0] },
                    status: { $ifNull: ["$$l.status", "Open"] },
                    date: "$effectiveDate",
                  },
                },
              },
              [
                {
                  ledgerId: { $toString: "$_id" },
                  invoiceNumber: { $ifNull: ["$invoiceNumber", ""] },
                  service: { $ifNull: ["$service", "Service"] },
                  treatmentName: { $ifNull: ["$treatment", null] },
                  packageName: { $ifNull: ["$package", null] },
                  originalAmount: { $ifNull: ["$pending", 0] },
                  paidAmount: 0,
                  remainingAmount: { $ifNull: ["$pending", 0] },
                  status: "Open",
                  date: "$effectiveDate",
                },
              ],
            ],
          },
        },
      },

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

      // One row per patient with every invoice's breakdown attached.
      {
        $group: {
          _id: "$patientId",
          // Emit the patient id as an explicit string field. The group key is
          // `_id`, but the client contract (PendingBalancePatient.patientId) and
          // the /clinic/patient-profile-view?id=... navigation need a real
          // `patientId` on every row — otherwise it is undefined because only
          // `_id` is produced.
          patientId: { $first: { $toString: "$patientId" } },
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
          totalPending: { $sum: { $ifNull: ["$pending", 0] } },
          invoiceCount: { $sum: 1 },
          lastPendingDate: { $max: "$effectiveDate" },
          itemArrays: { $push: "$pendingItems" },
        },
      },

      // Flatten the per-invoice breakdown arrays into one list per patient.
      {
        $addFields: {
          pendingBreakdown: {
            $reduce: {
              input: "$itemArrays",
              initialValue: [],
              in: { $concatArrays: ["$$value", "$$this"] },
            },
          },
          itemCount: {
            $sum: {
              $map: {
                input: "$itemArrays",
                as: "a",
                in: { $size: "$$a" },
              },
            },
          },
        },
      },
      { $project: { itemArrays: 0 } },

      // Highest outstanding amount first — most useful default order.
      { $sort: { totalPending: -1 } },
    ]);

    const totals = patients.reduce(
      (acc, p) => {
        acc.totalPending += Number(p.totalPending || 0);
        acc.totalPatients += 1;
        acc.totalItems += Number(p.itemCount || 0);
        return acc;
      },
      { totalPending: 0, totalPatients: 0, totalItems: 0 },
    );
    totals.totalPending = Number(totals.totalPending.toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        patients,
        totals,
        range: { startDate: startAt, endDate: endAt },
      },
    });
  } catch (error) {
    console.error("Pending balance report error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to build pending balance report",
    });
  }
}

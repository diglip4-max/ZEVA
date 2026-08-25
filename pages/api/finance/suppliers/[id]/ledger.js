// pages/api/finance/suppliers/[id]/ledger.js
import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import Supplier from "../../../../../models/stocks/Supplier";
import {
  FinanceTransaction,
  FinancePayment,
  FinanceCheque,
} from "../../../../../models/finance";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  try {
    await dbConnect();
  } catch (error) {
    console.error("Error connecting to database:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }

  const { id } = req.query;

  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  let clinicId;
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res
        .status(400)
        .json({ success: false, message: "Clinic not found for this user" });
    }
    clinicId = clinic._id;
  } else if (["agent", "doctor", "doctorStaff"].includes(me.role)) {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "User not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = req.query.clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required for admin in query parameters",
      });
    }
  }

  try {
    const supplier = await Supplier.findOne({ _id: id, clinicId });
    if (!supplier) {
      return res
        .status(404)
        .json({ success: false, message: "Supplier not found" });
    }

    const {
      billsLimit = 20,
      paymentsLimit = 20,
      chequesLimit = 20,
    } = req.query;

    const [bills, payments, cheques] = await Promise.all([
      FinanceTransaction.find({ clinicId, supplierId: id, entryType: "bill" })
        .sort({ dueDate: 1, createdAt: -1 })
        .limit(Math.min(100, parseInt(billsLimit)))
        .lean(),
      FinancePayment.find({ clinicId, supplierId: id })
        .populate("transactionId", "invoiceNumber category")
        .sort({ date: -1 })
        .limit(Math.min(100, parseInt(paymentsLimit)))
        .lean(),
      FinanceCheque.find({ clinicId, supplierId: id })
        .sort({ chequeDate: -1 })
        .limit(Math.min(100, parseInt(chequesLimit)))
        .lean(),
    ]);

    // Summary is computed across ALL supplier records (not just the limited/paginated slice above)
    const [billSummary, paymentSummary, chequeSummary] = await Promise.all([
      FinanceTransaction.aggregate([
        { $match: { clinicId, supplierId: supplier._id, entryType: "bill" } },
        {
          $group: {
            _id: null,
            totalBilled: { $sum: "$amount" },
            totalPaid: { $sum: "$paidAmount" },
            totalBalance: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["paid", "cancelled"]] },
                  0,
                  { $subtract: ["$amount", "$paidAmount"] },
                ],
              },
            },
            overdueCount: {
              $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
            },
            billCount: { $sum: 1 },
          },
        },
      ]),
      FinancePayment.aggregate([
        { $match: { clinicId, supplierId: supplier._id, reversed: false } },
        {
          $group: {
            _id: null,
            totalPayments: { $sum: 1 },
            totalPaidAmount: { $sum: "$amount" },
          },
        },
      ]),
      FinanceCheque.aggregate([
        { $match: { clinicId, supplierId: supplier._id } },
        {
          $group: {
            _id: null,
            totalCheques: { $sum: 1 },
            pendingCheques: {
              $sum: {
                $cond: [{ $in: ["$status", ["issued", "presented"]] }, 1, 0],
              },
            },
            bouncedCheques: {
              $sum: {
                $cond: [{ $in: ["$status", ["bounced", "returned"]] }, 1, 0],
              },
            },
          },
        },
      ]),
    ]);

    const bs = billSummary[0] || {
      totalBilled: 0,
      totalPaid: 0,
      totalBalance: 0,
      overdueCount: 0,
      billCount: 0,
    };
    const ps = paymentSummary[0] || { totalPayments: 0, totalPaidAmount: 0 };
    const cs = chequeSummary[0] || {
      totalCheques: 0,
      pendingCheques: 0,
      bouncedCheques: 0,
    };

    return res.status(200).json({
      success: true,
      data: {
        supplier,
        bills,
        payments,
        cheques,
        summary: {
          totalBilled: bs.totalBilled,
          totalPaid: bs.totalPaid,
          totalBalance: bs.totalBalance,
          overdueCount: bs.overdueCount,
          billCount: bs.billCount,
          totalPayments: ps.totalPayments,
          totalCheques: cs.totalCheques,
          pendingCheques: cs.pendingCheques,
          bouncedCheques: cs.bouncedCheques,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

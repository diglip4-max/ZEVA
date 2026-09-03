import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import { FinanceTransaction } from "../../../../models/finance";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) {
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

  // ---- shared: resolve clinicId based on role (used by both GET and POST) ----
  const me = await getUserFromReq(req);
  if (!me) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])) {
    return res.status(403).json({
      success: false,
      message:
        "Access denied. Only clinic, agent, admin, or doctor can view billing.",
    });
  }

  let clinicId;
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res.status(400).json({
        success: false,
        message: "Clinic not found for this user",
      });
    }
    clinicId = clinic._id;
  } else if (me.role === "agent") {
    if (!me.clinicId) {
      return res.status(400).json({
        success: false,
        message: "Agent not tied to a clinic",
      });
    }
    clinicId = me.clinicId;
  } else if (me.role === "doctor" || me.role === "doctorStaff") {
    if (!me.clinicId) {
      return res.status(400).json({
        success: false,
        message: "Doctor not tied to a clinic",
      });
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
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  // ---- GET /api/finance/bills — list + filters ----
  if (req.method === "GET") {
    try {
      const {
        status,
        supplierId,
        category,
        dueDateFrom,
        dueDateTo,
        search, // matches supplierInvoiceNumber or invoiceNumber
        page = 1,
        limit = 20,
      } = req.query;

      const query = { clinicId, entryType: "bill" };

      if (status) query.status = status;
      if (supplierId) query.supplierId = supplierId;
      if (category) query.category = category;

      if (dueDateFrom || dueDateTo) {
        query.dueDate = {};
        if (dueDateFrom) query.dueDate.$gte = new Date(dueDateFrom);
        if (dueDateTo) query.dueDate.$lte = new Date(dueDateTo);
      }

      if (search) {
        query.$or = [
          { invoiceNumber: { $regex: search, $options: "i" } },
          { supplierInvoiceNumber: { $regex: search, $options: "i" } },
        ];
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));

      const [bills, total] = await Promise.all([
        FinanceTransaction.find(query)
          .populate("supplierId", "name")
          .sort({ createdAt: -1 })
          .skip((pageNum - 1) * limitNum)
          .limit(limitNum),
        FinanceTransaction.countDocuments(query),
      ]);

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // ------------------------------------------------------------
      // Summary — totals + per-status outstanding amounts. All amounts
      // use (amount - paidAmount), i.e. what's actually still owed.
      // ------------------------------------------------------------
      const statusAmountSum = (s) => ({
        $sum: {
          $cond: [
            { $eq: ["$status", s] },
            { $subtract: ["$amount", "$paidAmount"] },
            0,
          ],
        },
      });
      const statusCountSum = (s) => ({
        $sum: { $cond: [{ $eq: ["$status", s] }, 1, 0] },
      });

      const summaryResult = await FinanceTransaction.aggregate([
        { $match: { clinicId: query.clinicId, entryType: "bill" } },
        {
          $group: {
            _id: null,
            totalOutstanding: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["paid", "cancelled"]] },
                  0,
                  { $subtract: ["$amount", "$paidAmount"] },
                ],
              },
            },
            overdueCount: statusCountSum("overdue"),
            paidThisMonth: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$updatedAt", monthStart] },
                      { $lt: ["$updatedAt", monthEnd] },
                    ],
                  },
                  "$paidAmount",
                  0,
                ],
              },
            },
            totalBills: { $sum: 1 },

            pendingAmount: statusAmountSum("pending"),
            pendingCount: statusCountSum("pending"),
            upcomingAmount: statusAmountSum("upcoming"),
            upcomingCount: statusCountSum("upcoming"),
            overdueAmount: statusAmountSum("overdue"),
            partialAmount: statusAmountSum("partial"),
            partialCount: statusCountSum("partial"),
          },
        },
      ]);

      const summary = summaryResult[0] || {
        totalOutstanding: 0,
        overdueCount: 0,
        paidThisMonth: 0,
        totalBills: 0,
        pendingAmount: 0,
        pendingCount: 0,
        upcomingAmount: 0,
        upcomingCount: 0,
        overdueAmount: 0,
        partialAmount: 0,
        partialCount: 0,
      };
      delete summary._id;

      // ------------------------------------------------------------
      // Next 30 days — upcoming/pending/partial bills due soon,
      // soonest first, for the "Next 30 Days" panel.
      // ------------------------------------------------------------
      const upcoming30Docs = await FinanceTransaction.find({
        clinicId,
        entryType: "bill",
        status: { $nin: ["paid", "cancelled"] },
        dueDate: { $gte: now, $lte: in30Days },
      })
        .populate("supplierId", "name")
        .sort({ dueDate: 1 })
        .limit(15);

      const upcoming30 = upcoming30Docs.map((b) => ({
        _id: b._id,
        supplierName:
          b.supplierId && typeof b.supplierId === "object"
            ? b.supplierId.name
            : "—",
        invoiceNumber: b.invoiceNumber,
        dueDate: b.dueDate,
        balance: b.amount - (b.paidAmount || 0),
      }));

      const totalUpcoming30 = upcoming30.reduce((sum, b) => sum + b.balance, 0);

      // ------------------------------------------------------------
      // Overdue aging — bucket every currently-overdue bill by how
      // many days past its due date it is, and find the supplier
      // with the largest overdue balance ("highest-risk supplier").
      // ------------------------------------------------------------
      const overdueDocs = await FinanceTransaction.find({
        clinicId,
        entryType: "bill",
        status: "overdue",
      }).populate("supplierId", "name");

      const aging = { d1to7: 0, d8to30: 0, d31plus: 0 };
      const bySupplier = {};

      for (const b of overdueDocs) {
        const balance = b.amount - (b.paidAmount || 0);
        const daysOverdue = b.dueDate
          ? Math.max(
              0,
              Math.floor(
                (now.getTime() - new Date(b.dueDate).getTime()) / 86400000,
              ),
            )
          : 0;

        if (daysOverdue <= 7) aging.d1to7 += balance;
        else if (daysOverdue <= 30) aging.d8to30 += balance;
        else aging.d31plus += balance;

        const supplierName =
          b.supplierId && typeof b.supplierId === "object"
            ? b.supplierId.name
            : "Unknown supplier";
        bySupplier[supplierName] = (bySupplier[supplierName] || 0) + balance;
      }

      let highestRiskSupplier = null;
      for (const [name, amount] of Object.entries(bySupplier)) {
        if (!highestRiskSupplier || amount > highestRiskSupplier.amount) {
          highestRiskSupplier = { name, amount };
        }
      }

      const overdueAging = {
        d1to7: aging.d1to7,
        d8to30: aging.d8to30,
        d31plus: aging.d31plus,
        totalAmount: aging.d1to7 + aging.d8to30 + aging.d31plus,
        totalCount: overdueDocs.length,
        highestRiskSupplier,
      };

      return res.status(200).json({
        success: true,
        data: bills,
        summary,
        upcoming30,
        totalUpcoming30,
        overdueAging,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  // ---- POST /api/finance/bills — create ----
  if (req.method === "POST") {
    try {
      const {
        supplierId,
        category,
        supplierInvoiceNumber, // vendor ka apna invoice number — Rule 7 duplicate check isi pe
        invoiceDate,
        dueDate,
        amount,
        notes,
        attachments,
        createdBy = me._id,
      } = req.body;

      if (!supplierId || !category || !amount || !invoiceDate || !dueDate) {
        return res.status(400).json({
          success: false,
          message:
            "Supplier, category, amount, invoice date and due date are required",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be greater than 0",
        });
      }

      if (new Date(dueDate) < new Date(invoiceDate)) {
        return res.status(400).json({
          success: false,
          message: "Due date cannot be before the invoice date",
        });
      }

      // Rule 7 — duplicate supplier invoice number warning
      if (supplierInvoiceNumber) {
        const duplicate = await FinanceTransaction.findOne({
          clinicId,
          supplierId,
          supplierInvoiceNumber,
          status: { $ne: "cancelled" },
        });
        if (duplicate && !req.body.force) {
          return res.status(409).json({
            success: false,
            warning: "DUPLICATE_INVOICE",
            message: `Invoice ${supplierInvoiceNumber} already exists for this supplier`,
            existingBillId: duplicate._id,
          });
        }
      }

      const bill = await FinanceTransaction.create({
        clinicId,
        type: "expense",
        entryType: "bill",
        supplierId,
        category,
        supplierInvoiceNumber,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        dueDate: dueDate ? new Date(dueDate) : undefined,
        amount,
        notes,
        attachments: attachments || [],
        createdBy,
        status:
          dueDate && new Date(dueDate) > new Date() ? "upcoming" : "pending",
        history: [
          {
            user: createdBy,
            action: "created",
            newValue: "pending",
            reason: "Bill created",
            at: new Date(),
          },
        ],
      });

      return res.status(201).json({
        success: true,
        message: "Bill created successfully",
        data: bill,
      });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }
}

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

      const summary = await FinanceTransaction.aggregate([
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
            overdueCount: {
              $sum: { $cond: [{ $eq: ["$status", "overdue"] }, 1, 0] },
            },
          },
        },
      ]);

      return res.status(200).json({
        success: true,
        data: bills,
        summary: summary[0] || { totalOutstanding: 0, overdueCount: 0 },
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

      if (!supplierId || !category || !amount) {
        return res.status(400).json({
          success: false,
          message: "SupplierId, category and amount are required",
        });
      }

      if (amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Amount must be greater than 0",
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

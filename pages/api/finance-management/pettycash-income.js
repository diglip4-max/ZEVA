// pages/api/finance-management/pettycash-income.js
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import Billing from "../../../models/Billing";
import PatientRegistration from "../../../models/PatientRegistration";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

// Helper function to safely parse numbers
const parseNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value?.$numberDecimal) return parseFloat(value.$numberDecimal);
  if (value?._bsontype === "Decimal128") return parseFloat(value.toString());
  return 0;
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    await dbConnect();

    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    // Only clinic, agent, admin, and doctor can view petty cash
    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only clinic, agent, admin, or doctor can view petty cash.",
      });
    }

    // Get clinicId based on user role
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

    const staffId = me._id.toString();

    // Get query parameters
    const search = req.query.search ? req.query.search.trim() : "";
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build clinic filter
    const clinicFilter = clinicId ? { clinicId: clinicId } : {};

    // Date filter
    const dateFilter = {};
    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      dateFilter.$gte = start;
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.$lte = end;
    }

    const dateMatch =
      Object.keys(dateFilter).length > 0 ? { invoicedDate: dateFilter } : {};

    // Cash filter: paymentMethod is Cash OR multiplePayments includes Cash
    const cashFilter = {
      $or: [
        { paymentMethod: "Cash" },
        { "multiplePayments.paymentMethod": "Cash" },
      ],
    };

    const baseFilter = {
      ...clinicFilter,
      ...dateMatch,
      ...cashFilter,
    };

    // ============================================================
    // AGGREGATION PIPELINE
    // ============================================================
    const pipeline = [
      { $match: baseFilter },
      {
        $addFields: {
          cashAmount: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$multiplePayments", []] } }, 0] },
              {
                $reduce: {
                  input: {
                    $filter: {
                      input: "$multiplePayments",
                      as: "mp",
                      cond: { $eq: ["$$mp.paymentMethod", "Cash"] },
                    },
                  },
                  initialValue: 0,
                  in: { $add: ["$$value", "$$this.amount"] },
                },
              },
              {
                $cond: [{ $eq: ["$paymentMethod", "Cash"] }, "$paid", 0],
              },
            ],
          },
        },
      },
      // Filter out transactions with zero cash received
      { $match: { cashAmount: { $gt: 0 } } },
      { $sort: { invoicedDate: -1 } },
      {
        $lookup: {
          from: "patientregistrations",
          localField: "patientId",
          foreignField: "_id",
          as: "patient",
        },
      },
      {
        $addFields: {
          patient: { $arrayElemAt: ["$patient", 0] },
        },
      },
    ];

    // Apply search after patient lookup
    if (search.trim()) {
      pipeline.push({
        $match: {
          $or: [
            { "patient.firstName": { $regex: search.trim(), $options: "i" } },
            { "patient.lastName": { $regex: search.trim(), $options: "i" } },
            { invoiceNumber: { $regex: search.trim(), $options: "i" } },
          ],
        },
      });
    }

    // Count total
    const countPipeline = [...pipeline, { $count: "total" }];
    const countResult = await Billing.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // Data with pagination
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];
    const records = await Billing.aggregate(dataPipeline);

    // ============================================================
    // SUMMARY - Total Cash Income
    // ============================================================
    const totalCashAgg = await Billing.aggregate([
      { $match: baseFilter },
      {
        $addFields: {
          cashAmount: {
            $cond: [
              { $gt: [{ $size: { $ifNull: ["$multiplePayments", []] } }, 0] },
              {
                $reduce: {
                  input: {
                    $filter: {
                      input: "$multiplePayments",
                      as: "mp",
                      cond: { $eq: ["$$mp.paymentMethod", "Cash"] },
                    },
                  },
                  initialValue: 0,
                  in: { $add: ["$$value", "$$this.amount"] },
                },
              },
              {
                $cond: [{ $eq: ["$paymentMethod", "Cash"] }, "$paid", 0],
              },
            ],
          },
        },
      },
      { $match: { cashAmount: { $gt: 0 } } },
      ...(search.trim()
        ? [
            {
              $lookup: {
                from: "patientregistrations",
                localField: "patientId",
                foreignField: "_id",
                as: "patient",
              },
            },
            { $addFields: { patient: { $arrayElemAt: ["$patient", 0] } } },
            {
              $match: {
                $or: [
                  {
                    "patient.firstName": {
                      $regex: search.trim(),
                      $options: "i",
                    },
                  },
                  {
                    "patient.lastName": {
                      $regex: search.trim(),
                      $options: "i",
                    },
                  },
                  { invoiceNumber: { $regex: search.trim(), $options: "i" } },
                ],
              },
            },
          ]
        : []),
      {
        $group: {
          _id: null,
          totalCash: { $sum: "$cashAmount" },
          totalTransactions: { $sum: 1 },
        },
      },
    ]);

    const totalCashIn = totalCashAgg[0]?.totalCash || 0;
    const totalTransactions = totalCashAgg[0]?.totalTransactions || 0;

    // ============================================================
    // FORMAT RESPONSE
    // ============================================================
    const enrichedRecords = records.map((r) => {
      const patient = r.patient || {};
      return {
        _id: r._id.toString(),
        invoiceNumber: r.invoiceNumber,
        invoicedDate: r.invoicedDate,
        patientName:
          `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
        firstName: patient.firstName || "",
        lastName: patient.lastName || "",
        mobileNumber: patient.mobileNumber || "",
        emrNumber: patient.emrNumber || "",
        service: r.service,
        amount: parseNumber(r.amount),
        paid: parseNumber(r.paid),
        cashAmount: parseNumber(r.cashAmount),
        paymentMethod: r.paymentMethod,
        multiplePayments: r.multiplePayments || [],
        status: r.status,
        invoicedBy: r.invoicedBy,
      };
    });

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    return res.status(200).json({
      success: true,
      data: enrichedRecords,
      summary: {
        totalCashIn: totalCashIn,
        totalTransactions: totalTransactions,
      },
      pagination: {
        totalResults: total,
        totalPages,
        currentPage: page,
        limit,
        hasMore,
        filters: {
          search: search || null,
          startDate: startDate || null,
          endDate: endDate || null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching petty cash income:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}

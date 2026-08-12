import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import ProductSale from "../../../models/stocks/ProductSale";
import PaymentMethod from "../../../models/PaymentMethod";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

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

    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only clinic, agent, admin, or doctor can view product sales.",
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

    const user = await getAuthorizedStaffUser(req, {
      allowedRoles: [
        "staff",
        "doctorStaff",
        "doctor",
        "clinic",
        "agent",
        "admin",
      ],
    });

    const staffId = user._id.toString();

    const search = req.query.search ? req.query.search.trim() : "";
    const status = req.query.status ? req.query.status.trim() : "";
    const paymentStatus = req.query.paymentStatus
      ? req.query.paymentStatus.trim()
      : "";
    const startDate = req.query.startDate
      ? new Date(req.query.startDate)
      : null;
    const endDate = req.query.endDate ? new Date(req.query.endDate) : null;
    const minAmount = req.query.minAmount
      ? parseFloat(req.query.minAmount)
      : null;
    const maxAmount = req.query.maxAmount
      ? parseFloat(req.query.maxAmount)
      : null;

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // ============================================================
    // Build filter for ALL records (for summary)
    // ============================================================
    const baseFilter = {
      clinicId,
      ...(me.role === "clinic" ? {} : { soldBy: staffId }),
    };

    // Build search/filter conditions
    let filterConditions = { ...baseFilter };

    if (search) {
      filterConditions.$or = [
        { invoiceNo: { $regex: search, $options: "i" } },
        { "items.name": { $regex: search, $options: "i" } },
        { "items.code": { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      filterConditions.status = status;
    }

    if (paymentStatus) {
      filterConditions.paymentStatus = paymentStatus;
    }

    if (startDate || endDate) {
      filterConditions.invoiceDate = {};
      if (startDate) {
        filterConditions.invoiceDate.$gte = startDate;
      }
      if (endDate) {
        filterConditions.invoiceDate.$lte = endDate;
      }
    }

    if (minAmount !== null || maxAmount !== null) {
      filterConditions.totalPrice = {};
      if (minAmount !== null) {
        filterConditions.totalPrice.$gte = minAmount;
      }
      if (maxAmount !== null) {
        filterConditions.totalPrice.$lte = maxAmount;
      }
    }

    console.log({ filterConditions });

    // ============================================================
    // Get SUMMARY statistics from ALL records (not paginated)
    // ============================================================
    const summary = await ProductSale.aggregate([
      { $match: filterConditions },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$totalPrice" },
          totalPaid: { $sum: "$totalPaidAmount" },
          totalCommission: { $sum: "$totalCommission" },
          totalItems: { $sum: { $size: "$items" } },
          totalRecords: { $sum: 1 },
          completedCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "completed"] }, 1, 0],
            },
          },
          pendingCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "pending"] }, 1, 0],
            },
          },
          canceledCount: {
            $sum: {
              $cond: [{ $eq: ["$status", "canceled"] }, 1, 0],
            },
          },
          refundedCount: {
            $sum: {
              $cond: [
                { $in: ["$status", ["refunded", "partially_refunded"]] },
                1,
                0,
              ],
            },
          },
          paidCount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "paid"] }, 1, 0],
            },
          },
          partiallyPaidCount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "partially_paid"] }, 1, 0],
            },
          },
          pendingPaymentCount: {
            $sum: {
              $cond: [{ $eq: ["$paymentStatus", "pending"] }, 1, 0],
            },
          },
        },
      },
    ]);

    console.log({ summary });

    // ============================================================
    // Get PAGINATED data
    // ============================================================
    const productSales = await ProductSale.find(filterConditions)
      .populate("patientId", "firstName lastName email mobileNumber emrNumber")
      .populate("soldBy", "name email")
      .populate("paymentMethodId", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalRecords = await ProductSale.countDocuments(filterConditions);
    const totalPages = Math.ceil(totalRecords / limit);
    const hasMore = page < totalPages;

    const summaryData =
      summary.length > 0
        ? summary[0]
        : {
            totalSales: 0,
            totalPaid: 0,
            totalCommission: 0,
            totalItems: 0,
            totalRecords: 0,
            completedCount: 0,
            pendingCount: 0,
            canceledCount: 0,
            refundedCount: 0,
            paidCount: 0,
            partiallyPaidCount: 0,
            pendingPaymentCount: 0,
          };

    const totalPending = summaryData.totalSales - summaryData.totalPaid;

    return res.status(200).json({
      success: true,
      data: productSales || [],
      summary: {
        totalSales: summaryData.totalSales || 0,
        totalPaid: summaryData.totalPaid || 0,
        totalPending: totalPending || 0,
        totalCommission: summaryData.totalCommission || 0,
        totalItems: summaryData.totalItems || 0,
        totalRecords: summaryData.totalRecords || 0,
        completedCount: summaryData.completedCount || 0,
        pendingCount: summaryData.pendingCount || 0,
        canceledCount: summaryData.canceledCount || 0,
        refundedCount: summaryData.refundedCount || 0,
        paidCount: summaryData.paidCount || 0,
        partiallyPaidCount: summaryData.partiallyPaidCount || 0,
        pendingPaymentCount: summaryData.pendingPaymentCount || 0,
      },
      pagination: {
        totalResults: totalRecords,
        totalPages,
        currentPage: page,
        limit,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Error fetching product sales:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}

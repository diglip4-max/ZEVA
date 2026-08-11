import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import Billing from "../../../models/Billing";
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

    // Only clinic, agent, admin, and doctor can view billing
    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only clinic, agent, admin, or doctor can view billing.",
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
    const service = req.query.service ? req.query.service.trim() : "";
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

    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {
      clinicId,
      paymentMethod: { $ne: "Cash" },
      service: { $ne: "Product" },
      ...(me.role === "clinic" ? {} : { invoicedById: staffId }),
    };

    // Search filter
    if (search) {
      filter.$or = [
        { invoiceNumber: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
        { doctorName: { $regex: search, $options: "i" } },
        { treatment: { $regex: search, $options: "i" } },
        { package: { $regex: search, $options: "i" } },
        { service: { $regex: search, $options: "i" } },
        { invoicedBy: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Service filter
    if (service) {
      filter.service = service;
    }

    // Date range filter
    if (startDate || endDate) {
      filter.invoicedDate = {};
      if (startDate) {
        filter.invoicedDate.$gte = startDate;
      }
      if (endDate) {
        filter.invoicedDate.$lte = endDate;
      }
    }

    // Amount range filter
    if (minAmount !== null || maxAmount !== null) {
      filter.amount = {};
      if (minAmount !== null) {
        filter.amount.$gte = minAmount;
      }
      if (maxAmount !== null) {
        filter.amount.$lte = maxAmount;
      }
    }

    const billingList = await Billing.find(filter)
      .populate("patientId", "firstName lastName email mobileNumber emrNumber")
      .populate("doctorId", "name email")
      .populate("invoicedById", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const totalRecords = await Billing.countDocuments(filter);
    const totalPages = Math.ceil(totalRecords / limit);
    const hasMore = page < totalPages;

    // Calculate summary statistics
    const summary = await Billing.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$paid" },
          totalPending: { $sum: "$pending" },
          totalAdvance: { $sum: "$advance" },
          count: { $sum: 1 },
        },
      },
    ]);

    if (!billingList) {
      return res
        .status(404)
        .json({ success: false, message: "Billing records not found" });
    }

    return res.status(200).json({
      success: true,
      data: billingList,
      summary:
        summary.length > 0
          ? summary[0]
          : {
              totalAmount: 0,
              totalPaid: 0,
              totalPending: 0,
              totalAdvance: 0,
              count: 0,
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
    console.error("Error fetching billing records:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}

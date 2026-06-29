import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import User from "../../../../models/Users";
import CustomStockItem from "../../../../models/stocks/CustomStockItem";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  res.setHeader("Allow", ["GET"]);

  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  try {
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
        message: "Access denied",
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
    } else if (me.role === "agent" || me.role === "doctorStaff") {
      if (!me.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Agent not tied to a clinic",
        });
      }
      clinicId = me.clinicId;
    } else if (me.role === "doctor") {
      if (!me.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Doctor not tied to a clinic",
        });
      }
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      clinicId = req.query.clinicId; // For GET, clinicId comes from query params
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

    const {
      page = 1,
      limit = 10,
      search = "",
    } = req.query;

    // Build filter object
    let filter = { clinicId };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const customStockItems = await CustomStockItem.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await CustomStockItem.countDocuments(filter);

    // Calculate stats
    const totalValue = customStockItems.reduce((sum, item) => sum + (item.netPlusVat || 0), 0);
    const totalQuantity = customStockItems.reduce((sum, item) => sum + item.quantity, 0);

    res.status(200).json({
      success: true,
      data: customStockItems,
      stats: {
        totalItems: total,
        totalValue,
        totalQuantity,
      },
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalResults: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error in custom stock items: ", error);

    return res.status(500).json({
      success: false,
      message: error?.message || "Internal Server Error",
    });
  }
}

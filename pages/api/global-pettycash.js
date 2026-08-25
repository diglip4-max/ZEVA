import dbConnect from "../../lib/database";
import jwt from "jsonwebtoken";
import User from "../../models/Users";
import PettyCash from "../../models/PettyCash";
import mongoose from "mongoose";

// Helper: verify JWT and get user
async function getUserFromToken(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.split(" ")[1];
  if (!token) throw { status: 401, message: "No token provided" };

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) throw { status: 401, message: "User not found" };
    return user;
  } catch (err) {
    throw { status: 401, message: "Invalid or expired token" };
  }
}

export default async function handler(req, res) {
  await dbConnect();

  try {
    const user = await getUserFromToken(req);

    // Check if user has permission to access global petty cash
    if (!["staff", "admin", "clinic", "super admin"].includes(user.role.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: "Access denied"
      });
    }

    // Determine clinicId
    let clinicId;
    try {
      const { getClinicIdFromUser } = await import("./lead-ms/permissions-helper");
      const { clinicId: cid } = await getClinicIdFromUser(user);
      clinicId = cid;
    } catch (err) {
      // console.error("Error getting clinicId:", err);
    }

    if (req.method === "GET") {
      const { clinicId: queryClinicId } = req.query;
      const targetClinicId = queryClinicId || clinicId;

      if (!targetClinicId) {
        return res.status(400).json({ success: false, message: "clinicId is required" });
      }

      // Get current global amounts
      const globalAmounts = await PettyCash.getGlobalAmounts(targetClinicId);

      // Get summary statistics scoped to the clinic
      const pipeline = [
        {
          $match: {
            clinicId: new mongoose.Types.ObjectId(String(targetClinicId)),
            staffId: { $ne: null }
          }
        },
        {
          $group: {
            _id: null,
            totalAllocated: { $sum: { $toDouble: "$totalAllocated" } },
            totalSpent: { $sum: { $toDouble: "$totalSpent" } },
            totalRecords: { $sum: 1 },
            totalStaff: { $addToSet: "$staffId" }
          }
        }
      ];

      const result = await PettyCash.aggregate(pipeline);
      const stats = result[0] || {
        totalAllocated: 0,
        totalSpent: 0,
        totalRecords: 0,
        totalStaff: []
      };

      return res.status(200).json({
        success: true,
        data: {
          globalTotalAmount: globalAmounts.globalTotalAmount,
          globalSpentAmount: globalAmounts.globalSpentAmount,
          globalRemainingAmount: globalAmounts.globalRemainingAmount,
          totalAllocated: stats.totalAllocated,
          totalSpent: stats.totalSpent,
          totalRecords: stats.totalRecords,
          totalStaff: stats.totalStaff.length,
          lastUpdated: new Date()
        }
      });
    }

    if (req.method === "POST") {
      // Update global amounts (admin only)
      if (!["admin", "super admin"].includes(user.role.toLowerCase())) {
        return res.status(403).json({
          success: false,
          message: "Admin privileges required"
        });
      }

      const { action, amount, clinicId: bodyClinicId } = req.body;
      const targetClinicId = bodyClinicId || clinicId;

      if (!targetClinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required to recalculate global amounts"
        });
      }

      // Recalculate global amounts from all records for this clinic
      const globalAmounts = await PettyCash.recalculateGlobalAmounts(targetClinicId);

      return res.status(200).json({
        success: true,
        message: "Global amounts updated successfully",
        data: {
          globalTotalAmount: globalAmounts.globalTotalAmount,
          globalSpentAmount: globalAmounts.globalSpentAmount,
          globalRemainingAmount: globalAmounts.globalRemainingAmount,
          action: action,
          amount: amount
        }
      });
    }

    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });

  } catch (error) {
    console.error("Error in global petty cash API:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

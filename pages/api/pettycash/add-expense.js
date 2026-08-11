import jwt from "jsonwebtoken";
import dbConnect from "../../../lib/database";
import PettyCash from "../../../models/PettyCash";
import PettyCashExpense from "../../../models/PettyCashExpense";
import User from "../../../models/Users";
import Supplier from "../../../models/stocks/Supplier";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const { 
      description, 
      spentAmount, 
      vendor, 
      vendorName, 
      items, 
      receipts, 
      usedFromPettyCash 
    } = req.body;

    // Validate required fields
    if (!description || spentAmount === undefined || spentAmount === "") {
      return res.status(400).json({ message: "Description and spentAmount are required" });
    }

    // Verify JWT
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token missing or invalid" });
    }
    const token = authHeader.split(" ")[1];

    let staffId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      staffId = decoded.userId;
    } catch (err) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const staffUser = await User.findById(staffId);
    if (!staffUser) {
      return res.status(403).json({ message: "User not found" });
    }

    // Check permissions for clinic roles
    if (["clinic", "agent", "doctor", "doctorStaff"].includes(staffUser.role)) {
      try {
        const { getClinicIdFromUser, checkClinicPermission } = await import("../lead-ms/permissions-helper");
        const { clinicId, error: clinicError } = await getClinicIdFromUser(staffUser);
        if (clinicError || !clinicId) {
          return res.status(403).json({ 
            message: clinicError || "Unable to determine clinic access" 
          });
        }
      } catch (permErr) {
        // console.error("Permission check error:", permErr);
      }
    } else if (staffUser.role !== "staff" && staffUser.role !== "admin") {
      return res.status(403).json({ message: "Access denied" });
    }

    // Get clinicId for global tracking
    let clinicId;
    try {
      const { getClinicIdFromUser } = await import("../lead-ms/permissions-helper");
      const { clinicId: cid } = await getClinicIdFromUser(staffUser);
      clinicId = cid;
    } catch (err) {
      // console.error("Error getting clinicId:", err);
    }

    if (!clinicId) {
      return res.status(400).json({ message: "Clinic ID is required and could not be determined" });
    }

    let pettyCash;
    let savedExpense;

    // Wrap in a transaction
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      pettyCash = await PettyCash.findOne({ staffId, clinicId }).session(session);

      if (!pettyCash) {
        const [createdPC] = await PettyCash.create(
          [
            {
              staffId,
              clinicId,
              note: "Petty Cash Record",
            },
          ],
          { session }
        );
        pettyCash = createdPC;
      }

      const pettyCashId = pettyCash._id;

      // Create new PettyCashExpense record
      [savedExpense] = await PettyCashExpense.create(
        [
          {
            pettyCashId,
            clinicId,
            staffId,
            description,
            spentAmount: Number(spentAmount),
            vendor: vendor || null,
            vendorName: vendorName || null,
            items: items || [],
            receipts: receipts || [],
            usedFromPettyCash: usedFromPettyCash !== undefined ? usedFromPettyCash : true,
            date: new Date(),
            createdBy: staffId,
          },
        ],
        { session }
      );

      // Apply rollup totals atomically to parent PettyCash
      await PettyCash.applyExpense(pettyCashId, Number(spentAmount), session);

      // Update global spent amount if usedFromPettyCash is true
      if (usedFromPettyCash !== false && clinicId) {
        await PettyCash.updateGlobalSpentAmount(clinicId, Number(spentAmount), 'add', session);
      }
    });
    session.endSession();

    res.status(201).json({
      success: true,
      message: "Expense added successfully",
      data: pettyCash,
      expense: savedExpense,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error", error: error.message });
  }
}

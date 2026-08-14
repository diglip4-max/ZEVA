import dbConnect from "../../../lib/database";
import PettyCash from "../../../models/PettyCash";
import PettyCashAllocation from "../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../models/PettyCashExpense";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "DELETE") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const staffId = decoded.userId;

    // Get user to check role and permissions
    const User = (await import("../../../models/Users")).default;
    const user = await User.findById(staffId);
    if (!user) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Get clinicId
    let clinicId;
    try {
      const { getClinicIdFromUser } = await import("../lead-ms/permissions-helper");
      const { clinicId: cid } = await getClinicIdFromUser(user);
      clinicId = cid;
    } catch (err) {
      // console.error("Error getting clinicId:", err);
    }

    // Check permissions for clinic/agent/doctor roles
    if (["clinic", "agent", "doctor", "doctorStaff"].includes(user.role)) {
      try {
        const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
        const { hasPermission, error: permError } = await checkClinicPermission(
          clinicId,
          "clinic_staff_management",
          "delete",
          "Add Expense"
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: permError || "You do not have permission to delete expenses"
          });
        }
      } catch (permErr) {
        return res.status(500).json({ success: false, message: "Error checking permissions" });
      }
    } else if (!["staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { type, pettyCashId, expenseId, allocationId } = req.body;

    if (!type || !pettyCashId) {
      return res.status(400).json({
        success: false,
        message: "type and pettyCashId are required fields.",
      });
    }

    const session = await mongoose.startSession();
    let resultMessage = "";

    await session.withTransaction(async () => {
      const petty = await PettyCash.findById(pettyCashId).session(session);
      if (!petty) {
        throw new Error("Petty cash record not found");
      }
      const actualClinicId = petty.clinicId || clinicId;

      if (type === "patient") {
        // Void all active allocations and expenses associated with this parent record
        const activeAllocations = await PettyCashAllocation.find({
          pettyCashId,
          isVoided: false,
        }).session(session);

        const activeExpenses = await PettyCashExpense.find({
          pettyCashId,
          isVoided: false,
        }).session(session);

        // Void allocations
        for (const alloc of activeAllocations) {
          await PettyCashAllocation.findByIdAndUpdate(
            alloc._id,
            {
              isVoided: true,
              voidedBy: staffId,
              voidReason: "Patient record deleted / voided",
              voidedAt: new Date(),
            },
            { session }
          );
          await PettyCash.applyAllocation(pettyCashId, -alloc.amount, session);
          await PettyCash.updateGlobalTotalAmount(actualClinicId, alloc.amount, "subtract", session);
        }

        // Void expenses
        for (const exp of activeExpenses) {
          await PettyCashExpense.findByIdAndUpdate(
            exp._id,
            {
              isVoided: true,
              voidedBy: staffId,
              voidReason: "Patient record deleted / voided",
              voidedAt: new Date(),
            },
            { session }
          );
          await PettyCash.applyExpense(pettyCashId, -exp.spentAmount, session);
          if (exp.usedFromPettyCash !== false) {
            await PettyCash.updateGlobalSpentAmount(actualClinicId, exp.spentAmount, "subtract", session);
          }
        }

        resultMessage = "Patient record allocations and expenses voided successfully";
      } else if (type === "expense") {
        if (!expenseId) {
          throw new Error("expenseId is required when deleting an expense");
        }

        const expense = await PettyCashExpense.findOne({ _id: expenseId, isVoided: false }).session(session);
        if (!expense) {
          throw new Error("Active expense not found");
        }

        await PettyCashExpense.findByIdAndUpdate(
          expenseId,
          {
            isVoided: true,
            voidedBy: staffId,
            voidReason: "Expense voided by user",
            voidedAt: new Date(),
          },
          { session }
        );

        // Reverse totals
        await PettyCash.applyExpense(pettyCashId, -expense.spentAmount, session);
        if (expense.usedFromPettyCash !== false) {
          await PettyCash.updateGlobalSpentAmount(actualClinicId, expense.spentAmount, "subtract", session);
        }

        resultMessage = "Expense voided successfully";
      } else if (type === "allocation") {
        if (!allocationId) {
          throw new Error("allocationId is required when deleting an allocation");
        }

        const allocation = await PettyCashAllocation.findOne({ _id: allocationId, isVoided: false }).session(session);
        if (!allocation) {
          throw new Error("Active allocation not found");
        }

        await PettyCashAllocation.findByIdAndUpdate(
          allocationId,
          {
            isVoided: true,
            voidedBy: staffId,
            voidReason: "Allocation voided by user",
            voidedAt: new Date(),
          },
          { session }
        );

        // Reverse totals
        await PettyCash.applyAllocation(pettyCashId, -allocation.amount, session);
        await PettyCash.updateGlobalTotalAmount(actualClinicId, allocation.amount, "subtract", session);

        resultMessage = "Allocation voided successfully";
      } else {
        throw new Error("Invalid type. Must be 'patient', 'expense', or 'allocation'.");
      }
    });

    session.endSession();

    return res.status(200).json({
      success: true,
      message: resultMessage,
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

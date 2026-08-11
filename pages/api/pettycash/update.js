import dbConnect from "../../../lib/database";
import PettyCash from "../../../models/PettyCash";
import PettyCashAllocation from "../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../models/PettyCashExpense";
import User from "../../../models/Users";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "PUT") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    // ✅ Authenticate
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const staffId = decoded.userId;

    // Get user to check role
    const user = await User.findById(staffId);
    if (!user) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Determine clinicId
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
          "update",
          "Add Expense"
        );

        if (!hasPermission) {
          return res.status(403).json({
            message: permError || "You do not have permission to update expenses"
          });
        }
      } catch (permErr) {
        return res.status(500).json({ message: "Error checking permissions" });
      }
    } else if (!["staff", "admin"].includes(user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }

    // ✅ Extract payload
    const { id, type, data } = req.body;

    if (!id || !type || !data) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const pettyCash = await PettyCash.findById(id);
    if (!pettyCash) {
      return res.status(404).json({ message: "Petty Cash record not found" });
    }

    // Check if staff can only update their own records (admin can update any)
    if (user.role === "staff" && pettyCash.staffId.toString() !== staffId.toString()) {
      return res.status(403).json({ message: "You can only update your own records" });
    }

    // ✅ Allow editing only today
    const today = new Date();
    const recordDate = new Date(pettyCash.createdAt);
    if (today.toDateString() !== recordDate.toDateString()) {
      return res
        .status(400)
        .json({ message: "You can only edit today's records" });
    }

    const actualClinicId = pettyCash.clinicId || clinicId;
    const session = await mongoose.startSession();

    await session.withTransaction(async () => {
      // ---------- ALLOCATED ----------
      if (type === "allocated") {
        const { newAmount, receipts, note } = data;

        if (newAmount === undefined || newAmount === null) {
          throw new Error("Allocated amount is required");
        }

        // Create new allocation
        await PettyCashAllocation.create(
          [
            {
              pettyCashId: id,
              clinicId: actualClinicId,
              staffId: pettyCash.staffId,
              amount: newAmount,
              receipts: receipts || [],
              date: new Date(),
              createdBy: staffId,
            },
          ],
          { session }
        );

        if (note !== undefined) {
          await PettyCash.findByIdAndUpdate(id, { note }, { session });
        }

        // Apply rollup and global totals
        await PettyCash.applyAllocation(id, newAmount, session);
        await PettyCash.updateGlobalTotalAmount(actualClinicId, newAmount, 'add', session);

      // ---------- EXPENSE ----------
      } else if (type === "expense") {
        const { expenseId, description, spentAmount, receipts } = data;

        if (!description) {
          throw new Error("Expense description is required");
        }

        if (spentAmount === undefined || spentAmount === null) {
          throw new Error("Expense amount is required");
        }

        if (expenseId) {
          // 🔹 Update existing expense
          const expense = await PettyCashExpense.findOne({
            _id: expenseId,
            pettyCashId: id,
            isVoided: false,
          }).session(session);

          if (!expense) {
            throw new Error("Expense not found in record");
          }

          // Calculate difference for global and parent rollup update
          const oldSpent = parseFloat(expense.spentAmount.toString());
          const amountDifference = spentAmount - oldSpent;

          await PettyCashExpense.findByIdAndUpdate(
            expenseId,
            {
              description,
              spentAmount,
              receipts: receipts || [],
              date: new Date(),
            },
            { session }
          );

          if (amountDifference !== 0) {
            await PettyCash.applyExpense(id, amountDifference, session);
            await PettyCash.updateGlobalSpentAmount(
              actualClinicId,
              Math.abs(amountDifference),
              amountDifference > 0 ? 'add' : 'subtract',
              session
            );
          }
        } else {
          // 🔹 Add new expense
          await PettyCashExpense.create(
            [
              {
                pettyCashId: id,
                clinicId: actualClinicId,
                staffId: pettyCash.staffId,
                description,
                spentAmount,
                receipts: receipts || [],
                date: new Date(),
                createdBy: staffId,
              },
            ],
            { session }
          );

          // Update parent and global spent amount
          await PettyCash.applyExpense(id, spentAmount, session);
          await PettyCash.updateGlobalSpentAmount(actualClinicId, spentAmount, 'add', session);
        }
      } else {
        throw new Error("Invalid type provided");
      }
    });

    session.endSession();

    // Fetch the updated petty cash record with totals to return
    const updatedPettyCash = await PettyCash.findById(id).lean({ getters: true });

    res.status(200).json({
      success: true,
      message: "Updated successfully",
      pettyCash: updatedPettyCash,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Internal Server Error" });
  }
}

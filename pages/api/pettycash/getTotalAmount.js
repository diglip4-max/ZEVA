// pages/api/pettycash/getTotalAmount.js
import dbConnect from "../../../lib/database";
import PettyCash from "../../../models/PettyCash";
import PettyCashAllocation from "../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../models/PettyCashExpense";
import mongoose from "mongoose";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";

export default async function handler(req, res) {
  await dbConnect();

  try {
    // Require auth and derive staffId
    const user = await getAuthorizedStaffUser(req, {
      allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent", "admin"],
    });
    
    if (!user || !user._id) {
      return res.status(401).json({ success: false, message: "Invalid user" });
    }
    
    const staffId = user._id.toString ? user._id.toString() : String(user._id);
    
    if (!staffId || !mongoose.Types.ObjectId.isValid(staffId)) {
      return res.status(401).json({ success: false, message: "Invalid user ID format" });
    }

    // Accept date as YYYY-MM-DD (client will pass this). If not provided, default to today's date.
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();

    // normalize to midnight start and next day start
    const start = new Date(targetDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const cumulativeEnd = new Date(end);
    const staffObjectId = new mongoose.Types.ObjectId(staffId);

    // 1. Calculate cumulative balance for this specific staff member
    const staffAllocationsAgg = await PettyCashAllocation.aggregate([
      {
        $match: {
          staffId: staffObjectId,
          date: { $lt: cumulativeEnd },
          isVoided: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } }
        }
      }
    ]);

    const staffExpensesAgg = await PettyCashExpense.aggregate([
      {
        $match: {
          staffId: staffObjectId,
          date: { $lt: cumulativeEnd },
          isVoided: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$spentAmount" } }
        }
      }
    ]);

    const cumulativeAllocated = staffAllocationsAgg[0]?.total || 0;
    const cumulativeSpent = staffExpensesAgg[0]?.total || 0;
    const cumulativeBalance = Math.max(0, cumulativeAllocated - cumulativeSpent);

    // 2. Fetch day-wise allocations and expenses for this staff member in range [start, end)
    const dayAllocations = await PettyCashAllocation.find({
      staffId: staffObjectId,
      date: { $gte: start, $lt: end },
      isVoided: false
    }).lean();

    const dayExpenses = await PettyCashExpense.find({
      staffId: staffObjectId,
      date: { $gte: start, $lt: end },
      isVoided: false
    }).lean();

    // Group by pettyCashId
    const patientGroups = {};

    // Helper to get group
    const getGroup = async (pcId) => {
      if (patientGroups[pcId]) return patientGroups[pcId];
      const pc = await PettyCash.findById(pcId).lean();
      patientGroups[pcId] = {
        _id: pcId,
        patientName: pc?.patientName || "Manual Entries",
        patientEmail: pc?.patientEmail || "",
        allocatedForDate: [],
        expensesForDate: [],
        allocatedForDateSum: 0,
        expensesForDateSum: 0,
        remainingForDate: 0,
      };
      return patientGroups[pcId];
    };

    // Populate allocations
    let dayWiseAllocated = 0;
    for (const alloc of dayAllocations) {
      const pcId = alloc.pettyCashId.toString();
      const group = await getGroup(pcId);
      const amt = alloc.amount ? parseFloat(alloc.amount.toString()) : 0;
      group.allocatedForDate.push({
        _id: alloc._id,
        amount: amt,
        receipts: alloc.receipts,
        date: alloc.date
      });
      group.allocatedForDateSum += amt;
      dayWiseAllocated += amt;
    }

    // Populate expenses
    let dayWiseSpent = 0;
    for (const exp of dayExpenses) {
      const pcId = exp.pettyCashId.toString();
      const group = await getGroup(pcId);
      const amt = exp.spentAmount ? parseFloat(exp.spentAmount.toString()) : 0;
      group.expensesForDate.push({
        _id: exp._id,
        description: exp.description,
        spentAmount: amt,
        vendor: exp.vendor,
        vendorName: exp.vendorName,
        items: exp.items,
        receipts: exp.receipts,
        usedFromPettyCash: exp.usedFromPettyCash,
        date: exp.date
      });
      group.expensesForDateSum += amt;
      dayWiseSpent += amt;
    }

    // Compute remaining for each group
    const patientList = Object.values(patientGroups).map(group => {
      group.remainingForDate = group.allocatedForDateSum - group.expensesForDateSum;
      return group;
    });

    // 3. Get global cumulative amounts (all staff combined) up to current day
    const globalAllocationsAgg = await PettyCashAllocation.aggregate([
      {
        $match: {
          date: { $lt: cumulativeEnd },
          isVoided: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } }
        }
      }
    ]);

    const globalExpensesAgg = await PettyCashExpense.aggregate([
      {
        $match: {
          date: { $lt: cumulativeEnd },
          isVoided: false
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$spentAmount" } }
        }
      }
    ]);

    const globalAllocated = globalAllocationsAgg[0]?.total || 0;
    const globalSpent = globalExpensesAgg[0]?.total || 0;
    const globalRemaining = Math.max(0, globalAllocated - globalSpent);

    return res.status(200).json({
      success: true,
      date: start.toISOString(),
      globalAllocated: dayWiseAllocated,
      globalSpent: dayWiseSpent,
      globalRemaining: globalRemaining,
      patients: patientList,
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ success: false, message: err.message || "Authentication error" });
    }
    return res.status(500).json({ 
      success: false, 
      message: err.message || "Server error",
      error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
}

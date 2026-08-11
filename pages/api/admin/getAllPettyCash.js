import jwt from "jsonwebtoken";
import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import PettyCash from "../../../models/PettyCash";
import PettyCashAllocation from "../../../models/PettyCashAllocation";
import PettyCashExpense from "../../../models/PettyCashExpense";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET")
    return res.status(405).json({ message: "Method Not Allowed" });

  try {
    // Get the logged-in user
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ message: "Unauthorized: Missing or invalid token" });
    }

    // Check permissions for agents - admins bypass all checks
    if (me.role === 'agent' || me.role === 'doctorStaff') {
      const { hasPermission } = await checkAgentPermission(me._id, "admin_staff_management", "read", "Track Expenses");
      if (!hasPermission) {
        return res.status(403).json({
          message: "Permission denied: You do not have read permission for Track Expenses submodule"
        });
      }
    } else if (me.role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admin or agent role required" });
    }

    const { staffName, startDate, endDate } = req.query;

    // Fetch all staff for dropdown
    const staffUsers = await User.find({ role: { $in: ["staff", "doctorStaff"] } }).select("name");

    // Find staffId if staffName is selected
    let staffIdFilter;
    if (staffName) {
      const staff = staffUsers.find(
        (s) => s.name.toLowerCase() === staffName.toLowerCase()
      );
      staffIdFilter = staff ? staff._id : null;
    }

    // Build date range filter
    let start, end;
    if (startDate && !endDate) {
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(startDate);
      end.setHours(23, 59, 59, 999);
    } else if (!startDate && endDate) {
      start = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
    } else {
      start = startDate ? new Date(startDate) : new Date();
      start.setHours(0, 0, 0, 0);
      end = endDate ? new Date(endDate) : new Date();
      end.setHours(23, 59, 59, 999);
    }

    const dateQuery = { $gte: start, $lte: end };

    // Query matched allocations and expenses in the date range
    const matchedAllocations = await PettyCashAllocation.find({
      date: dateQuery,
      isVoided: false,
      ...(staffIdFilter && { staffId: staffIdFilter })
    }).lean({ getters: true });

    const matchedExpenses = await PettyCashExpense.find({
      date: dateQuery,
      isVoided: false,
      ...(staffIdFilter && { staffId: staffIdFilter })
    }).lean({ getters: true });

    // Extract all unique pettyCashIds
    const pettyCashIds = [
      ...new Set([
        ...matchedAllocations.map(a => a.pettyCashId.toString()),
        ...matchedExpenses.map(e => e.pettyCashId.toString())
      ])
    ];

    const records = await PettyCash.find({ _id: { $in: pettyCashIds } })
      .populate("staffId", "name email")
      .sort({ createdAt: -1 })
      .lean({ getters: true });

    // Get cumulative balance up to the end of the current day (all previous days + current day)
    const cumulativeEnd = new Date(end);

    // Calculate global cumulative balance up to current day
    const cumAllocAgg = await PettyCashAllocation.aggregate([
      {
        $match: {
          date: { $lt: cumulativeEnd },
          isVoided: false,
          ...(staffIdFilter && { staffId: staffIdFilter })
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$amount" } }
        }
      }
    ]);

    const cumExpAgg = await PettyCashExpense.aggregate([
      {
        $match: {
          date: { $lt: cumulativeEnd },
          isVoided: false,
          ...(staffIdFilter && { staffId: staffIdFilter })
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $toDouble: "$spentAmount" } }
        }
      }
    ]);

    const cumulativeAllocated = cumAllocAgg[0]?.total || 0;
    const cumulativeSpent = cumExpAgg[0]?.total || 0;
    const cumulativeBalance = Math.max(0, cumulativeAllocated - cumulativeSpent);

    // Group by staff
    const groupedData = {};
    records.forEach((record) => {
      const recordId = record._id.toString();

      const allocatedFiltered = matchedAllocations.filter(
        (a) => a.pettyCashId.toString() === recordId
      );
      const expensesFiltered = matchedExpenses.filter(
        (e) => e.pettyCashId.toString() === recordId
      );

      if (allocatedFiltered.length === 0 && expensesFiltered.length === 0) return;

      const staffId = record.staffId._id;
      if (!groupedData[staffId]) {
        groupedData[staffId] = {
          staff: record.staffId,
          patients: [],
          expenses: [],
          totalAllocated: 0,
          totalSpent: 0,
          totalAmount: 0,
        };
      }

      // Add patient info
      groupedData[staffId].patients.push({
        name: record.patientName,
        email: record.patientEmail,
        phone: record.patientPhone,
        allocatedAmounts: allocatedFiltered,
      });

      // Add expenses
      groupedData[staffId].expenses.push(...expensesFiltered);

      // Update day-wise totals for display
      groupedData[staffId].totalAllocated += allocatedFiltered.reduce(
        (sum, a) => sum + (a.amount || 0),
        0
      );
      groupedData[staffId].totalSpent += expensesFiltered.reduce(
        (sum, e) => sum + (e.spentAmount || 0),
        0
      );
    });

    // Calculate cumulative balance for each staff member and update totals
    for (const staffId of Object.keys(groupedData)) {
      const staffAllocations = await PettyCashAllocation.aggregate([
        {
          $match: {
            staffId: new mongoose.Types.ObjectId(staffId),
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

      const staffExpenses = await PettyCashExpense.aggregate([
        {
          $match: {
            staffId: new mongoose.Types.ObjectId(staffId),
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

      const staffCumulativeAllocated = staffAllocations[0]?.total || 0;
      const staffCumulativeSpent = staffExpenses[0]?.total || 0;
      groupedData[staffId].totalAmount = Math.max(0, staffCumulativeAllocated - staffCumulativeSpent);
    }

    const finalData = Object.values(groupedData);

    // Calculate day-wise allocated and spent amounts for display
    let dayWiseAllocated = 0;
    let dayWiseSpent = 0;
    finalData.forEach((item) => {
      const staffDayWiseAllocated = item.patients.reduce((sum, patient) => {
        return sum + patient.allocatedAmounts.reduce((patientSum, alloc) => {
          const allocDate = new Date(alloc.date);
          return (allocDate >= start && allocDate <= end) ? patientSum + (alloc.amount || 0) : patientSum;
        }, 0);
      }, 0);

      const staffDayWiseSpent = item.expenses.reduce((sum, expense) => {
        const expenseDate = new Date(expense.date);
        return (expenseDate >= start && expenseDate <= end) ? sum + (expense.spentAmount || 0) : sum;
      }, 0);

      dayWiseAllocated += staffDayWiseAllocated;
      dayWiseSpent += staffDayWiseSpent;
    });

    // Use day-wise amounts for allocated/spent, but cumulative for remaining
    const globalAmounts = {
      globalTotalAmount: dayWiseAllocated, // Day-wise allocated
      globalSpentAmount: dayWiseSpent, // Day-wise spent
      globalRemainingAmount: cumulativeBalance // Cumulative remaining
    };

    return res.status(200).json({
      success: true,
      data: finalData,
      staffList: staffUsers.map((s) => s.name),
      globalAmounts: globalAmounts,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
}

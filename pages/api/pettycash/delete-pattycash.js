// /pages/api/pettycash/delete.js
import dbConnect from "../../../lib/database";
import PettyCash from "../../../models/PettyCash";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "DELETE") {
    return res.status(405).json({ success: false, message: "Method Not Allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { type, pettyCashId, expenseId } = req.body;

    if (!type || !pettyCashId) {
      return res.status(400).json({
        success: false,
        message: "type and pettyCashId are required fields.",
      });
    }

    if (type === "patient") {
      // Delete full petty cash record
      const deleted = await PettyCash.findByIdAndDelete(pettyCashId);
      if (!deleted)
        return res.status(404).json({ success: false, message: "Patient not found" });

      return res.status(200).json({
        success: true,
        message: "Patient record deleted successfully",
      });
    }

    if (type === "expense") {
      if (!expenseId)
        return res.status(400).json({
          success: false,
          message: "expenseId is required when deleting an expense",
        });

      const petty = await PettyCash.findById(pettyCashId);
      if (!petty)
        return res.status(404).json({ success: false, message: "Petty cash record not found" });

      petty.expenses = petty.expenses.filter(
        (exp) => exp._id.toString() !== expenseId
      );

      await petty.save();

      return res.status(200).json({
        success: true,
        message: "Expense deleted successfully",
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid type. Must be 'patient' or 'expense'.",
    });
  } catch (err) {
    console.error("Delete API error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}

// pages/api/clinic/manual-pettycash.js
// GET  – list all manually-added petty cash entries for this clinic
// POST – add a new manual petty cash entry (name + amount)
import dbConnect from "../../../lib/database";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";
import mongoose from "mongoose";

// Inline schema for manual clinic petty cash (stored in a simple collection)
const ManualPettyCashSchema = new mongoose.Schema(
  {
    clinicId: { type: mongoose.Schema.Types.ObjectId, ref: "Clinic", required: true, index: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: "" },
  },
  { timestamps: true }
);

const ManualPettyCash =
  mongoose.models.ManualPettyCash ||
  mongoose.model("ManualPettyCash", ManualPettyCashSchema);

export default async function handler(req, res) {
  await dbConnect();

  const me = await getUserFromReq(req);
  if (!me) return res.status(401).json({ success: false, message: "Unauthorized" });

  const { clinicId, error: clinicError } = await getClinicIdFromUser(me);
  if (clinicError && me.role !== "admin") {
    return res.status(403).json({ success: false, message: clinicError });
  }

  // ── GET: list entries ─────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      const { startDate, endDate, page = "1", limit = "100" } = req.query;
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(200, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      // agent / doctorStaff see only their own entries
      const isRestrictedRole = ["agent", "doctorStaff"].includes(me.role);

      const filter = clinicId
        ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) }
        : {};

      if (isRestrictedRole) {
        filter.addedBy = me._id;
      }

      if (startDate || endDate) {
        const df = {};
        if (startDate) { const s = new Date(startDate); s.setHours(0,0,0,0); df.$gte = s; }
        if (endDate)   { const e = new Date(endDate);   e.setHours(23,59,59,999); df.$lte = e; }
        filter.createdAt = df;
      }

      const [entries, total] = await Promise.all([
        ManualPettyCash.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
        ManualPettyCash.countDocuments(filter),
      ]);

      const totalAmount = entries.reduce((s, e) => s + (e.amount || 0), 0);

      return res.status(200).json({
        success: true,
        data: entries.map((e) => ({
          _id: e._id.toString(),
          name: e.name,
          amount: e.amount,
          note: e.note || "",
          createdAt: e.createdAt,
        })),
        total,
        totalAmount,
      });
    } catch (err) {
      console.error("manual-pettycash GET error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // ── POST: add entry ───────────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const { name, amount, note } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: "Name is required" });
      }
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) {
        return res.status(400).json({ success: false, message: "Valid amount is required" });
      }

      const entry = await ManualPettyCash.create({
        clinicId: new mongoose.Types.ObjectId(String(clinicId)),
        addedBy: me._id,
        name: name.trim(),
        amount: amt,
        note: note || "",
      });

      return res.status(201).json({
        success: true,
        message: "Petty cash entry added",
        data: {
          _id: entry._id.toString(),
          name: entry.name,
          amount: entry.amount,
          note: entry.note,
          createdAt: entry.createdAt,
        },
      });
    } catch (err) {
      console.error("manual-pettycash POST error:", err);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  }

  return res.status(405).json({ success: false, message: "Method Not Allowed" });
}

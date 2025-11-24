//api/pettycash/getpettyCash.js
import jwt from "jsonwebtoken";
import dbConnect from "../../../lib/database";
import PettyCash from "../../../models/PettyCash";
import User from "../../../models/Users";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Token missing" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const staffId = decoded.userId;

    const staffUser = await User.findById(staffId);
    if (!staffUser || staffUser.role !== "staff") {
      return res.status(403).json({ message: "Access denied" });
    }

    const search = req.query.search ? req.query.search.trim() : "";

    const filter = {
      staffId,
      ...(search
        ? {
            $or: [
              { patientName: { $regex: search, $options: "i" } },
              { patientEmail: { $regex: search, $options: "i" } },
            ],
          }
        : {}),
    };

    const pettyCashList = await PettyCash.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ pettyCashList });
  } catch (error) {
    console.error("Error fetching petty cash:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

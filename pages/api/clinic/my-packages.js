// pages/api/clinic/my-packages.js

import connectDB from "../../../lib/database";
import Package from "../../../models/Package";
import User from "../../../models/Users";
import { verifyToken } from "../../../lib/auth";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    await connectDB();

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { userId, role: receptionistRole } = decoded;

    if (receptionistRole !== "agent") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const agentDoc = await User.findById(userId).select("clinicId").lean();
    if (!agentDoc?.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Agent has no associated clinic" });
    }

    // Packages are clinic-owned resources, visible to any staff member
    // at that clinic — not filtered by who created them.
    const query = {
      clinicId: agentDoc.clinicId,
      createdBy: userId,
    };
    const pkg = await Package.findOne({ name: "akshay" }).lean();
    console.log(pkg.createdBy, pkg.clinicId);
    const { page = 1, limit = 50, search } = req.query;
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = (pageNum - 1) * limitNum;

    const [packages, total] = await Promise.all([
      Package.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Package.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      packages,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error("my-packages error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
}

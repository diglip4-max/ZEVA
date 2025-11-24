import dbConnect from "../../../lib/database";
import jwt from "jsonwebtoken";
import User from "../../../models/Users";
import Vendor from "../../../models/VendorProfile";

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

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = await getUserFromToken(req);
    
    // Check if user has permission to view vendors
    if (!["staff", "admin", "clinic"].includes(user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied" 
      });
    }

    const vendors = await Vendor.find({}).sort({ name: 1 });

    return res.status(200).json({
      success: true,
      data: vendors
    });

  } catch (error) {
    console.error("Error fetching vendors:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
}
import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Clinic from "../../../models/Clinic";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user || user.role !== "clinic") {
      return res
        .status(401)
        .json({ message: "Unauthorized. Clinic not found." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect password" });
    }

    const clinic = await Clinic.findOne({ owner: user._id });
    if (!clinic || !clinic.isApproved) {
      return res.status(403).json({ message: "Clinic not approved by admin." });
    }

    // 🔍 Debug: Ensure JWT_SECRET is properly set
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("❌ JWT_SECRET not found in environment variables");
      return res.status(500).json({ message: "Server configuration error" });
    }

    const token = jwt.sign(
      {
        userId: user._id.toString(), // Ensure it's a string
        role: user.role,
        email: user.email,
      },
      jwtSecret,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
}

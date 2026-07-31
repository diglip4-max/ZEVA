import bcrypt from "bcryptjs";
import Users from "../../../models/Users";
import dbConnect from "../../../lib/database";

export default async function handler(req, res) {
  res.setHeader("Allow", ["POST"]);
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  const { email, password } = await req.body;
  if (!email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Email and password required" });
  }

  // Step 1: confirm request is from Zeva Connect (shared secret)
  const apiKey = req.headers["x-internal-api-key"] || "";
  if (apiKey !== process.env.ZEVA_CONNECT_INTERNAL_API_KEY) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }
  try {
    await dbConnect();

    // Step 2: find user by email
    const user = await Users.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (user.isApproved === false) {
      return res
        .status(403)
        .json({ success: false, message: "User not approved" });
    }

    // Step 3: verify password (using bcrypt)
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const responseData = {
      zevaUserId: user._id,
      clinicId: user.clinicId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user?.avatarUrl || null,
      role: user.role,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      age: user.age,
    };

    // Step 4: return user object
    return res.status(200).json({
      success: true,
      message: "Credentials verified",
      data: responseData,
    });
  } catch (err) {
    console.error("Credential verification failed", err);
    return res
      .status(500)
      .json({ success: false, message: "Verification failed" });
  }
}

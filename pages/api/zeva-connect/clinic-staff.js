import dbConnect from "../../../lib/database";
import Users from "../../../models/Users";

export default async function handler(req, res) {
  res.setHeader("Allow", ["GET"]);
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  // Step 1: confirm request is from Zeva Connect (shared secret)
  const apiKey = req.headers["x-internal-api-key"] || "";
  console.log({ apiKey });
  if (apiKey !== process.env.ZEVA_CONNECT_INTERNAL_API_KEY) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  try {
    await dbConnect();

    const { clinicId } = req.query;
    if (!clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Clinic ID required" });
    }
    // Step 2: find all users in clinic
    const users = await Users.find({ clinicId, isApproved: true }).lean();
    if (!users || users.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No users found" });
    }

    const userList = users.map((user) => ({
      zevaUserId: user._id,
      clinicId: user.clinicId,
      name: user.name,
      email: user.email,
      role: user.role,
      gender: user.gender,
      dateOfBirth: user.dateOfBirth,
      age: user.age,
    }));
    return res.status(200).json({
      success: true,
      message: "Users found",
      data: userList,
    });
  } catch (err) {
    console.error("Failed to get clinic users", err);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }
}

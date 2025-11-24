import dbConnect from "../../../lib/database";
import jwt from "jsonwebtoken";
import PatientRegistration from "../../../models/PatientRegistration";
import User from "../../../models/Users";

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

  // ---------------- GET: fetch patients ----------------
  if (req.method === "GET") {
    try {
      const user = await getUserFromToken(req);

      if (user.role !== "staff") {
        return res.status(403).json({ success: false, message: "Only staff allowed" });
      }

      const { emrNumber, invoiceNumber, name, phone, claimStatus, applicationStatus } = req.query;

      const query = { userId: user._id };

      if (emrNumber) query.emrNumber = { $regex: emrNumber, $options: "i" };
      if (invoiceNumber) query.invoiceNumber = { $regex: invoiceNumber, $options: "i" };
      if (phone) query.mobileNumber = { $regex: phone, $options: "i" };
      if (claimStatus) query.advanceClaimStatus = claimStatus;
      if (applicationStatus) query.status = applicationStatus;

      if (name) {
        query.$or = [
          { firstName: { $regex: name, $options: "i" } },
          { lastName: { $regex: name, $options: "i" } },
        ];
      }

      // 🔹 Populate doctor info
      const patients = await PatientRegistration.find(query)
        .populate({
          path: "doctor",
          model: "User",
          select: "name role",
          match: { role: "doctorStaff" }, // optional if you only want doctorStaff
        })
        .sort({ createdAt: -1 });

      // 🔹 Map doctor name
      const patientDetails = patients.map((p) => ({
        ...p._doc,
        doctor: p.doctor ? p.doctor.name : "-", // replace doctor id with name
      }));

      return res.status(200).json({ success: true, count: patients.length, data: patientDetails });
    } catch (err) {
      console.error("GET error:", err);
      return res.status(err.status || 500).json({ success: false, message: err.message || "Server error" });
    }
  }


  // ---------------- PUT: update status ----------------
  if (req.method === "PUT") {
    try {
      const user = await getUserFromToken(req);
      const { id, status } = req.body;

      if (!id || !status) {
        return res.status(400).json({ success: false, message: "id and status required" });
      }

      const patient = await PatientRegistration.findOne({ _id: id, userId: user._id });
      if (!patient) return res.status(404).json({ success: false, message: "Patient not found or unauthorized" });

      patient.status = status;
      await patient.save();

      return res.status(200).json({ success: true, message: `Patient status updated to ${status}`, data: patient });
    } catch (err) {
      console.error("PUT error:", err);
      return res.status(err.status || 500).json({ success: false, message: err.message || "Server error" });
    }
  }

  res.setHeader("Allow", ["GET", "PUT"]);
  return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
}

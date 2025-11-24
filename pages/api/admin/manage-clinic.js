// pages/api/admin/manage-clinic.ts
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { clinicId, action } = req.body;
  if (!["approve", "decline", "delete"].includes(action)) {
    return res.status(400).json({ message: "Invalid action" });
  }

  try {
    const clinic = await Clinic.findById(clinicId);
    if (!clinic) return res.status(404).json({ message: "Clinic not found" });

    if (action === "approve") {
      clinic.isApproved = true;
      clinic.declined = false;
      await clinic.save();
      return res.status(200).json({ message: "Clinic approved" });
    }

    if (action === "decline") {
      clinic.isApproved = false;
      clinic.declined = true;
      await clinic.save();
      return res.status(200).json({ message: "Clinic declined" });
    }

    if (action === "delete") {
      await clinic.deleteOne();
      return res.status(200).json({ message: "Clinic deleted" });
    }

  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
}

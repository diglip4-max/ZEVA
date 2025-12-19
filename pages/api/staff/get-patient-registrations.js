import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";

export default async function handler(req, res) {
  await dbConnect();

  // ---------------- GET: fetch patients ----------------
  if (req.method === "GET") {
    try {
      const user = await getAuthorizedStaffUser(req, {
        allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent", "admin"],
      });

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

      // Fetch patients without populate first
      const patients = await PatientRegistration.find(query)
        .sort({ createdAt: -1 })
        .lean();

      // 🔹 Map doctor name - handle both ObjectId references and string names
      const patientDetails = patients.map((p) => {
        const patientObj = { ...p };
        // If doctor is already a string, use it; otherwise try to get name from populated object
        if (typeof patientObj.doctor === 'string') {
          // Doctor is already a string (name), use it as-is
          patientObj.doctor = patientObj.doctor || "-";
        } else if (patientObj.doctor && patientObj.doctor.name) {
          // Doctor is populated object, extract name
          patientObj.doctor = patientObj.doctor.name;
        } else {
          // No doctor info
          patientObj.doctor = "-";
        }
        return patientObj;
      });

      return res.status(200).json({ success: true, count: patients.length, data: patientDetails });
    } catch (err) {
      console.error("GET error:", err);
      return res.status(err.status || 500).json({ success: false, message: err.message || "Server error" });
    }
  }


  // ---------------- PUT: update status ----------------
  if (req.method === "PUT") {
    try {
      const user = await getAuthorizedStaffUser(req, {
        allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent", "admin"],
      });
      const { id, status } = req.body;

      if (!id || !status) {
        return res.status(400).json({ success: false, message: "id and status required" });
      }

      const query = { userId: user._id };
      const patient = await PatientRegistration.findOne({ _id: id, ...query });
      if (!patient) return res.status(404).json({ success: false, message: "Patient not found or unauthorized" });

      patient.status = status;
      await patient.save();

      return res.status(200).json({ success: true, message: `Patient status updated to ${status}`, data: patient });
    } catch (err) {
      console.error("PUT error:", err);
      return res.status(err.status || 500).json({ success: false, message: err.message || "Server error" });
    }
  }

  // ---------------- DELETE: delete patient ----------------
  if (req.method === "DELETE") {
    try {
      const user = await getAuthorizedStaffUser(req, {
        allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent", "admin"],
      });
      const { id } = req.body;

      if (!id) {
        return res.status(400).json({ success: false, message: "id is required" });
      }

      const query = { userId: user._id };
      const patient = await PatientRegistration.findOneAndDelete({ _id: id, ...query });
      
      if (!patient) {
        return res.status(404).json({ success: false, message: "Patient not found or unauthorized" });
      }

      return res.status(200).json({ success: true, message: "Patient deleted successfully" });
    } catch (err) {
      console.error("DELETE error:", err);
      return res.status(err.status || 500).json({ success: false, message: err.message || "Server error" });
    }
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
}

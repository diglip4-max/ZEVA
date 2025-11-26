import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export default async function handler(req, res) {
  await dbConnect();
  try {
    await getAuthorizedStaffUser(req, {
      allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent", "admin"],
    });
  } catch (err) {
    return res.status(err.status || 401).json({ success: false, message: err.message || "Authentication error" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const q = (req.query.q || "").trim();
    if (!q || q.length < 2) {
      return res.status(200).json({ success: true, data: [] });
    }

    const regex = new RegExp("^" + escapeRegex(q), "i");
    const results = await PatientRegistration.find({ emrNumber: { $regex: regex } })
      .select("emrNumber firstName lastName mobileNumber")
      .limit(10)
      .lean();

    // Deduplicate by emrNumber in case of multiple invoices per EMR
    const seen = new Set();
    const unique = [];
    for (const r of results) {
      if (r.emrNumber && !seen.has(r.emrNumber)) {
        seen.add(r.emrNumber);
        unique.push(r);
      }
    }

    return res.status(200).json({ success: true, data: unique });
  } catch (err) {
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
}



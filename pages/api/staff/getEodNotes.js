import dbConnect from "../../../lib/database";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  let user;
  try {
    user = await getAuthorizedStaffUser(req, {
      allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent"],
    });
  } catch (error) {
    return res.status(error.status || 401).json({ message: error.message });
  }

    // ✅ Date filter (optional)
    const { date } = req.query;

    let filteredNotes = user.eodNotes || [];

    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filteredNotes = filteredNotes.filter((n) => {
        const noteDate = new Date(n.createdAt);
        return noteDate >= startOfDay && noteDate <= endOfDay;
      });
    }

    // Sort newest first
    filteredNotes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({
      message: "EOD notes fetched successfully",
      eodNotes: filteredNotes,
    });
  } catch (error) {
    console.error("Get EOD Notes Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

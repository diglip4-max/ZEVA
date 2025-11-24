import dbConnect from "../../../lib/database";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
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

    const { note } = req.body;
    if (!note || note.trim() === "") {
      return res.status(400).json({ message: "Note cannot be empty" });
    }

    user.eodNotes.push({ note });
    await user.save();

    return res.status(200).json({
      message: "EOD note added successfully",
      eodNotes: user.eodNotes,
    });
  } catch (error) {
    console.error("EOD Error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

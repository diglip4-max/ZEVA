// pages/api/agents/getA.js
import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";  
import { getUserFromReq, requireRole } from "./auth";

export default async function handler(req, res) {
  await dbConnect();

  const user = await getUserFromReq(req);
  if (!user) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  // ✅ Allow admin, clinic, agent, or doctor
  if (!requireRole(user, ["admin", "clinic", "agent", "doctor"])) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  if (req.method === "GET") {
    try {
      let query = { role: "agent", isApproved: true };

      if (user.role === "clinic") {
        // Fetch agents only from this clinic
        const clinic = await Clinic.findOne({ owner: user._id }).select("_id");
        if (!clinic) {
          return res.status(400).json({ success: false, message: "Clinic not found for this user" });
        }
        query.clinicId = clinic._id;
      } else if (user.role === "agent") {
        // Agents can see other agents in their clinic
        if (!user.clinicId) {
          return res.status(403).json({ success: false, message: "Agent not linked to any clinic" });
        }
        query.clinicId = user.clinicId;
        // Optionally exclude self from results if needed:
        // query._id = { $ne: user._id };
      } else if (user.role === "doctor") {
        // Doctors can see agents from their clinic or all agents if no clinic linked
        if (user.clinicId) {
          query.clinicId = user.clinicId;
        }
        // If no clinicId, doctor can see all agents (admin-like access)
      }

      const agents = await User.find(query).select("_id name email clinicId");

      return res.status(200).json({ success: true, agents });
    } catch (err) {
      console.error("Error fetching agents:", err);
      return res.status(500).json({ success: false, message: "Failed to fetch agents" });
    }
  }

  return res.status(405).json({ success: false, message: "Method not allowed" });
}

import crypto from "crypto";
import dbConnect from "../../../lib/database";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import redis from "../../../bullmq/redis.js";
import Clinic from "../../../models/Clinic.js";

export default async function handler(req, res) {
  res.setHeader("Allow", ["POST"]);
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  try {
    await dbConnect();

    // Step 1: confirm user is logged into Zeva Clinic (existing session check)
    const user = await getUserFromReq(req);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    }

    // Get clinicId based on user role
    let clinicId;
    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id });
      if (!clinic) {
        return res.status(400).json({
          success: false,
          message: "Clinic not found for this user",
        });
      }
      clinicId = clinic._id;
    } else if (user.role === "agent") {
      if (!user.clinicId) {
        return res
          .status(400)
          .json({ success: false, message: "Agent not tied to a clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "doctor" || user.role === "doctorStaff") {
      if (!user.clinicId) {
        return res
          .status(400)
          .json({ success: false, message: "Doctor not tied to a clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "admin") {
      clinicId = req.body.clinicId;
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required for admin",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (
      !requireRole(user, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Step 2: generate a random, unguessable one-time ticket
    const ticket = crypto.randomBytes(32).toString("hex");
    // Step 3: store ticket -> user payload in Redis, with short TTL
    const payload = {
      zevaUserId: user.id,
      clinicId: clinicId,
      name: user.name,
      avatarUrl: user.avatarUrl || null,
      role: user.role, // "doctor" | "receptionist" | "staff" | "admin"
    };

    const TICKET_EXPIRY_SECONDS = 60;

    const result = await redis.set(
      `sso_ticket:${ticket}`,
      JSON.stringify(payload),
      "EX",
      TICKET_EXPIRY_SECONDS,
    );

    if (!result) {
      return res
        .status(500)
        .json({ success: false, message: "Ticket creation failed" });
    }

    // Step 4: return the messenger URL with the ticket
    const zevaConnectUrl = `${process.env.ZEVA_CONNECT_URL}/auth/sso?ticket=${ticket}`;

    // Step 4: return user object
    return res.status(200).json({
      success: true,
      message: "Ticket created successfully",
      redirectUrl: zevaConnectUrl,
    });
  } catch (err) {
    console.error("Ticket creation failed", err);
    return res
      .status(500)
      .json({ success: false, message: "Verification failed" });
  }
}

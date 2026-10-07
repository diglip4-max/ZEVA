// //pages/api/clinic/auth-settings.js
import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import { getUserFromReq, requireRole } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  let me;
  try {
    me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  let clinicId;
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res.status(400).json({
        success: false,
        message: "Clinic not found for this user",
      });
    }
    clinicId = clinic._id;
  } else if (me.role === "agent") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Agent not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "doctor" || me.role === "doctorStaff") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = req.body.clinicId || req.query.clinicId;
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

  // GET - Fetch settings
  if (req.method === "GET") {
    try {
      const clinic = await Clinic.findById(clinicId)
        .select("otpWhatsAppNumber otpEmail")
        .lean();

      const staff = await User.find({
        clinicId,
        role: { $in: ["staff", "doctorStaff", "agent"] },
      })
        .select("name email role otpEnabled")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        settings: clinic || {},
        staff: staff || [],
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch settings",
        error: error.message,
      });
    }
  }

  // POST - Update settings
  if (req.method === "POST") {
    try {
      const { otpWhatsAppNumber, otpEmail, staffOtp } = req.body || {};

      // Update clinic settings
      const update = {};
      if (typeof otpWhatsAppNumber === "string")
        update.otpWhatsAppNumber = otpWhatsAppNumber;
      if (typeof otpEmail === "string") update.otpEmail = otpEmail;

      if (Object.keys(update).length > 0) {
        await Clinic.findByIdAndUpdate(clinicId, update, { new: true });
      }

      // Update staff OTP permissions
      if (Array.isArray(staffOtp) && staffOtp.length > 0) {
        const ops = staffOtp.map((s) => ({
          updateOne: {
            filter: { clinicId, email: s.email },
            update: { $set: { otpEnabled: !!s.enabled } },
          },
        }));

        if (ops.length) {
          await User.bulkWrite(ops, { ordered: false });
        }
      }

      // Fetch updated data to return
      const clinic = await Clinic.findById(clinicId)
        .select("otpWhatsAppNumber otpEmail")
        .lean();

      const staff = await User.find({
        clinicId,
        role: { $in: ["staff", "doctorStaff", "agent"] },
      })
        .select("name email role otpEnabled")
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({
        success: true,
        settings: clinic || {},
        staff: staff || [],
        message: "Settings updated successfully",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to update settings",
        error: error.message,
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: "Method not allowed",
  });
}

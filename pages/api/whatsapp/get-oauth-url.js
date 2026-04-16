// import dbConnect from "../../../lib/database";
// import Clinic from "../../../models/Clinic";
// import Conversation from "../../../models/Conversation";
// import { getUserFromReq, requireRole } from "../lead-ms/auth";

// export default async function handler(req, res) {
//   if (req.method !== "GET") {
//     return res
//       .status(405)
//       .json({ success: false, message: `${req.method} - Method not allowed` });
//   }
//   try {
//     await dbConnect();

//     const me = await getUserFromReq(req);
//     if (
//       !requireRole(me, [
//         "clinic",
//         "agent",
//         "admin",
//         "doctor",
//         "doctorStaff",
//         "staff",
//       ])
//     ) {
//       return res.status(403).json({ success: false, message: "Access denied" });
//     }

//     // ✅ Resolve clinicId based on role
//     let clinic;
//     if (me.role === "clinic") {
//       clinic = await Clinic.findOne({ owner: me._id });
//     } else if (me.role === "agent") {
//       if (!me.clinicId) {
//         return res
//           .status(403)
//           .json({ success: false, message: "Agent not linked to any clinic" });
//       }
//       clinic = await Clinic.findById(me.clinicId);
//     } else if (me.role === "doctor") {
//       // Doctor uses their clinicId if they have one
//       if (!me.clinicId) {
//         return res
//           .status(403)
//           .json({ success: false, message: "Doctor not linked to any clinic" });
//       }
//       clinic = await Clinic.findById(me.clinicId);
//     } else if (me.role === "doctorStaff" || me.role === "staff") {
//       // DoctorStaff/Staff uses their clinicId if they have one
//       if (!me.clinicId) {
//         return res
//           .status(403)
//           .json({ success: false, message: "Staff not linked to any clinic" });
//       }
//       clinic = await Clinic.findById(me.clinicId);
//     } else if (me.role === "admin") {
//       // Admin can access all leads, but we still need clinicId if provided
//       const { clinicId: adminClinicId } = req.query;
//       if (adminClinicId) {
//         clinic = await Clinic.findById(adminClinicId);
//       }
//     }

//     if (!clinic) {
//       return res
//         .status(404)
//         .json({ success: false, message: "Clinic not found for this user" });
//     }

//     try {
//       const clientId = process.env.FACEBOOK_CLIENT_ID;
//       const redirectUri = process.env.FACEBOOK_REDIRECT_URI;

//       if (!clientId || !redirectUri) {
//         return res.status(500).json({
//           success: false,
//           message: "Facebook OAuth configuration is missing",
//         });
//       }

//       // Generate a secure state parameter to prevent CSRF attacks
//       const state = JSON.stringify({
//         clinicId: clinic._id.toString(),
//         userId: me._id.toString(),
//         timestamp: Date.now(),
//       });
//       const encodedState = Buffer.from(state).toString("base64");

//       const oauthUrl = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&config_id=1727266851980925&response_type=code&scope=whatsapp_business_management,whatsapp_business_messaging,business_management&state=${encodeURIComponent(encodedState)}`;

//       res.status(200).json({
//         success: true,
//         message: "OAuth URL generated successfully",
//         oauthUrl,
//         clinicId: clinic._id,
//         expiresIn: 600, // URL expires in 10 minutes
//       });
//     } catch (error) {
//       console.error("Error generating OAuth URL:", error);
//       return res
//         .status(500)
//         .json({ success: false, message: "Failed to generate OAuth URL" });
//     }
//   } catch (error) {
//     console.error("Get Providers error: ", error);
//     return res.status(500).json({
//       success: false,
//       message: error?.message || "Internal server error",
//     });
//   }
// }

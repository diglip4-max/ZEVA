//pages/api/auth/request-otp.js
import dbConnect from '../../../lib/database';
import User from "../../../models/Users";
import Clinic from "../../../models/Clinic";
import bcrypt from 'bcryptjs';
import Notification from "../../../models/Notification";
import { emitNotificationToUser } from "../push-notification/socketio";
import { sendWhatsAppViaTwilio, sendEmailViaSMTP } from "../../../lib/notify/sendOtp";

export default async function handler(req, res) {
  await dbConnect();
  if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });
  const user = await User.findOne({ email }).lean();
  if (!user) return res.status(404).json({ success: false, message: "User not found" });
  const match = await bcrypt.compare(password, user.password || "");
  if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });
  if (!user.otpEnabled) return res.status(400).json({ success: false, message: "OTP not enabled" });
  const clinic = user.clinicId ? await Clinic.findById(user.clinicId).lean() : null;
  const phoneCode = String(Math.floor(1000 + Math.random() * 9000));
  const emailCode = String(Math.floor(1000 + Math.random() * 9000));
  const expires = new Date(Date.now() + 5 * 60 * 1000);
  await User.updateOne(
    { _id: user._id },
    { 
      $set: { 
        otpCode: null, 
        otpExpires: null,
        otpCodePhone: clinic?.otpWhatsAppNumber ? phoneCode : null,
        otpCodeEmail: clinic?.otpEmail ? emailCode : null,
        otpExpiresPhone: clinic?.otpWhatsAppNumber ? expires : null,
        otpExpiresEmail: clinic?.otpEmail ? expires : null
      } 
    }
  );
  try {
    if (clinic?.owner) {
      const adminId = clinic.owner.toString();
      const msg = `Login OTP for ${user.name || user.email}: Phone=${clinic?.otpWhatsAppNumber ? phoneCode : "N/A"}, Email=${clinic?.otpEmail ? emailCode : "N/A"}`;
      const notif = await Notification.create({ user: adminId, message: msg, type: "acknowledgment" });
      emitNotificationToUser(adminId, { message: msg, type: "acknowledgment", createdAt: new Date() });
    }
  } catch {}
  let whatsappSent = false;
  let emailSent = false;
  const msgTextPhone = `ZEVA OTP: ${phoneCode}\nValid 5 minutes\nDo not share this code.`;
  if (clinic?.otpWhatsAppNumber) {
    const contentSid = process.env.TWILIO_CONTENT_SID_OTP;
    let waOptions = { body: msgTextPhone };
    if (contentSid) {
      const names = String(process.env.TWILIO_OTP_VAR_NAMES || "1")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
      const vars = {};
      for (const n of names) vars[n] = phoneCode;
      waOptions = { contentSid, contentVariables: vars };
    }
    const r = await sendWhatsAppViaTwilio(clinic.otpWhatsAppNumber, waOptions);
    whatsappSent = !!r.success;
  }
  if (clinic?.otpEmail) {
    const html = `
      <div style="background:#f7f7f9;padding:24px;font-family:Inter,Segoe UI,Arial,sans-serif;color:#111827">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden">
          <div style="padding:20px 24px;border-bottom:1px solid #eef2f7">
            <div style="font-weight:600;font-size:16px;display:flex;align-items:center;gap:8px;color:#111827">
              <span style="display:inline-block;padding:6px 10px;background:#eef2ff;color:#3b82f6;border-radius:8px;font-weight:600">ZEVA</span>
              OTP Verification
            </div>
            <div style="margin-top:4px;font-size:12px;color:#6b7280">Secure login verification for your account</div>
          </div>
          <div style="padding:24px">
            <div style="font-size:12px;color:#6b7280;margin-bottom:8px">Verification code</div>
            <div style="font-weight:700;letter-spacing:0.2em;font-size:28px;color:#111827;background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;text-align:center">${emailCode}</div>
            <div style="margin-top:12px;font-size:12px;color:#6b7280">Valid for 5 minutes</div>
            <div style="margin-top:16px;font-size:13px;color:#374151">
              User: <strong>${user.name || user.email}</strong><br/>
              Clinic: <strong>${clinic?.name || "Clinic"}</strong>
            </div>
            <div style="margin-top:16px;padding:12px 14px;background:#fff7ed;border:1px solid #fde68a;border-radius:10px;color:#92400e;font-size:12px">
              Do not share this code. ZEVA will never ask you for your OTP.
            </div>
          </div>
          <div style="padding:16px 24px;border-top:1px solid #eef2f7;font-size:12px;color:#6b7280">
            © ZEVA
          </div>
        </div>
      </div>`;
    const r = await sendEmailViaSMTP(clinic.otpEmail, "ZEVA OTP Verification", { text: `ZEVA • OTP: ${emailCode} | Valid 5 minutes | User: ${user.name || user.email}`, html });
    emailSent = !!r.success;
  }
  const isDev = process.env.NODE_ENV !== "production";
  return res.status(200).json({ success: true, sent: true, delivery: { notification: true, whatsapp: whatsappSent, email: emailSent }, debugPhoneOtp: isDev ? phoneCode : undefined, debugEmailOtp: isDev ? emailCode : undefined });
}
// pages/api/auth/request-otp.js
// import dbConnect from '../../../lib/database';
// import User from "../../../models/Users";
// import Clinic from "../../../models/Clinic";
// import bcrypt from 'bcryptjs';
// import Notification from "../../../models/Notification";
// import { emitNotificationToUser } from "../push-notification/socketio";
// import { sendWhatsAppViaTwilio, sendEmailViaSMTP } from "../../../lib/notify/sendOtp";

// export default async function handler(req, res) {
//   await dbConnect();
//   if (req.method !== "POST") return res.status(405).json({ success: false, message: "Method not allowed" });
  
//   const { email, password } = req.body || {};
//   if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });
  
//   const user = await User.findOne({ email }).lean();
//   if (!user) return res.status(404).json({ success: false, message: "User not found" });
  
//   const match = await bcrypt.compare(password, user.password || "");
//   if (!match) return res.status(401).json({ success: false, message: "Invalid credentials" });
  
//   if (!user.otpEnabled) return res.status(400).json({ success: false, message: "OTP not enabled" });
  
//   const clinic = user.clinicId ? await Clinic.findById(user.clinicId).lean() : null;
//   const phoneCode = String(Math.floor(1000 + Math.random() * 9000));
//   const emailCode = String(Math.floor(1000 + Math.random() * 9000));
//   const expires = new Date(Date.now() + 5 * 60 * 1000);
  
//   await User.updateOne(
//     { _id: user._id },
//     { 
//       $set: { 
//         otpCode: null, 
//         otpExpires: null,
//         otpCodePhone: clinic?.otpWhatsAppNumber ? phoneCode : null,
//         otpCodeEmail: clinic?.otpEmail ? emailCode : null,
//         otpExpiresPhone: clinic?.otpWhatsAppNumber ? expires : null,
//         otpExpiresEmail: clinic?.otpEmail ? expires : null
//       } 
//     }
//   );
  
//   try {
//     if (clinic?.owner) {
//       const adminId = clinic.owner.toString();
//       const msg = `Login OTP for ${user.name || user.email}: Phone=${clinic?.otpWhatsAppNumber ? phoneCode : "N/A"}, Email=${clinic?.otpEmail ? emailCode : "N/A"}`;
//       const notif = await Notification.create({ user: adminId, message: msg, type: "acknowledgment" });
//       emitNotificationToUser(adminId, { message: msg, type: "acknowledgment", createdAt: new Date() });
//     }
//   } catch {}
  
//   let whatsappSent = false;
//   let emailSent = false;
  
//   // Enhanced WhatsApp Template - Looks like real production message
//   const whatsappTemplate = {
//     // Using Twilio's template capabilities for best results
//     contentSid: process.env.TWILIO_CONTENT_SID_OTP,
//     contentVariables: JSON.stringify({
//       1: phoneCode,
//       2: user.name?.split(' ')[0] || 'User',
//       3: '5 minutes',
//       4: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
//     })
//   };

//   // Fallback plain text template that looks like real WhatsApp
//   const whatsappFallback = `
// 🔐 *ZEVA Verification Code*

// Hi ${user.name?.split(' ')[0] || 'there'},

// Your one-time password (OTP) to access your ZEVA account is:

// *${phoneCode}*

// ⏱️ Valid for: 5 minutes
// 🕐 Generated at: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}

// ⚠️ *Security Notice*
// • Never share this code with anyone
// • ZEVA will never ask for your OTP
// • If you didn't request this, please ignore

// Need help? Contact support@zeva.com

// © ${new Date().getFullYear()} ZEVA - Secure Healthcare Platform
//   `.trim();

//   if (clinic?.otpWhatsAppNumber) {
//     // Try using template first, fallback to plain text
//     let waOptions = {};
    
//     if (process.env.TWILIO_CONTENT_SID_OTP) {
//       waOptions = {
//         contentSid: process.env.TWILIO_CONTENT_SID_OTP,
//         contentVariables: JSON.stringify({
//           otp_code: phoneCode,
//           user_name: user.name?.split(' ')[0] || 'User',
//           expiry_time: '5',
//           generated_at: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
//         })
//       };
//     } else {
//       waOptions = { body: whatsappFallback };
//     }
    
//     const r = await sendWhatsAppViaTwilio(clinic.otpWhatsAppNumber, waOptions);
//     whatsappSent = !!r.success;
//   }
  
//   // Enhanced Email Template - Production Ready
//   if (clinic?.otpEmail) {
//     const currentYear = new Date().getFullYear();
//     const userName = user.name?.split(' ')[0] || 'Valued User';
//     const clinicName = clinic?.name || 'ZEVA Healthcare';
//     const loginTime = new Date().toLocaleString('en-US', { 
//       dateStyle: 'full', 
//       timeStyle: 'short' 
//     });
    
//     const html = `
//       <!DOCTYPE html>
//       <html lang="en">
//       <head>
//         <meta charset="UTF-8">
//         <meta name="viewport" content="width=device-width, initial-scale=1.0">
//         <meta http-equiv="X-UA-Compatible" content="IE=edge">
//         <title>ZEVA OTP Verification</title>
//       </head>
//       <body style="margin:0; padding:0; background-color:#f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
//         <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f3f4f6; padding:40px 20px;">
//           <tr>
//             <td align="center">
//               <table width="100%" max-width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:16px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);">
//                 <!-- Header -->
//                 <tr>
//                   <td style="padding:32px 32px 24px 32px; border-bottom:1px solid #e5e7eb;">
//                     <table width="100%" cellpadding="0" cellspacing="0" border="0">
//                       <tr>
//                         <td>
//                           <div style="display:inline-block; background:linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); padding:8px 16px; border-radius:40px;">
//                             <span style="color:#ffffff; font-weight:600; font-size:14px;">🔐 ZEVA SECURE</span>
//                           </div>
//                         </td>
//                         <td align="right">
//                           <span style="color:#6b7280; font-size:12px;">${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
//                         </td>
//                       </tr>
//                     </table>
//                     <h1 style="margin:24px 0 0 0; font-size:24px; font-weight:600; color:#111827;">Verify your login</h1>
//                     <p style="margin:8px 0 0 0; color:#6b7280; font-size:16px;">Secure access to ${clinicName}</p>
//                   </td>
//                 </tr>
                
//                 <!-- Main Content -->
//                 <tr>
//                   <td style="padding:32px;">
//                     <!-- Greeting -->
//                     <p style="margin:0 0 24px 0; color:#374151; font-size:16px;">Hello <strong style="color:#111827;">${userName}</strong>,</p>
                    
//                     <!-- OTP Container -->
//                     <div style="background:linear-gradient(135deg, #f9fafb 0%, #f3f4f6 100%); border:1px solid #e5e7eb; border-radius:12px; padding:24px; text-align:center; margin-bottom:24px;">
//                       <p style="margin:0 0 12px 0; color:#6b7280; font-size:14px; text-transform:uppercase; letter-spacing:0.05em;">Verification Code</p>
//                       <div style="font-size:48px; font-weight:700; letter-spacing:8px; color:#111827; line-height:1.2; margin:0 0 16px 0;">${emailCode}</div>
                      
//                       <!-- Timer Info -->
//                       <div style="display:inline-block; background-color:#ffffff; border:1px solid #e5e7eb; border-radius:40px; padding:8px 16px;">
//                         <span style="color:#374151; font-size:14px;">⏱️ Expires in <strong style="color:#3b82f6;">5 minutes</strong></span>
//                       </div>
//                     </div>
                    
//                     <!-- Login Details -->
//                     <div style="background-color:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:16px; margin-bottom:24px;">
//                       <h3 style="margin:0 0 12px 0; font-size:14px; font-weight:600; color:#374151;">Login Details</h3>
//                       <table width="100%" cellpadding="0" cellspacing="0" border="0">
//                         <tr>
//                           <td width="100" style="padding:4px 0;"><span style="color:#6b7280; font-size:14px;">Account:</span></td>
//                           <td style="padding:4px 0;"><span style="color:#111827; font-size:14px; font-weight:500;">${user.email}</span></td>
//                         </tr>
//                         <tr>
//                           <td style="padding:4px 0;"><span style="color:#6b7280; font-size:14px;">Clinic:</span></td>
//                           <td style="padding:4px 0;"><span style="color:#111827; font-size:14px; font-weight:500;">${clinicName}</span></td>
//                         </tr>
//                         <tr>
//                           <td style="padding:4px 0;"><span style="color:#6b7280; font-size:14px;">Time:</span></td>
//                           <td style="padding:4px 0;"><span style="color:#111827; font-size:14px; font-weight:500;">${loginTime}</span></td>
//                         </tr>
//                       </table>
//                     </div>
                    
//                     <!-- Security Alert -->
//                     <div style="background-color:#fff7ed; border-left:4px solid #f59e0b; border-radius:4px; padding:16px; margin-bottom:24px;">
//                       <div style="display:flex; align-items:flex-start; gap:12px;">
//                         <span style="font-size:20px;">⚠️</span>
//                         <div>
//                           <p style="margin:0 0 4px 0; color:#92400e; font-weight:600; font-size:14px;">Security Alert</p>
//                           <p style="margin:0; color:#b45309; font-size:13px;">Never share this code. ZEVA will never ask for your password or OTP via email or phone.</p>
//                         </div>
//                       </div>
//                     </div>
                    
//                     <!-- Didn't request this? -->
//                     <div style="text-align:center; padding-top:16px; border-top:1px solid #e5e7eb;">
//                       <p style="margin:0 0 8px 0; color:#6b7280; font-size:13px;">Didn't request this code?</p>
//                       <p style="margin:0; color:#6b7280; font-size:13px;">Please <a href="mailto:support@zeva.com" style="color:#3b82f6; text-decoration:none;">contact support</a> immediately if you didn't attempt to login.</p>
//                     </div>
//                   </td>
//                 </tr>
                
//                 <!-- Footer -->
//                 <tr>
//                   <td style="padding:24px 32px; background-color:#f9fafb; border-top:1px solid #e5e7eb; border-radius:0 0 16px 16px;">
//                     <table width="100%" cellpadding="0" cellspacing="0" border="0">
//                       <tr>
//                         <td>
//                           <div style="display:flex; align-items:center; gap:8px; margin-bottom:12px;">
//                             <span style="color:#3b82f6; font-weight:600;">ZEVA</span>
//                             <span style="color:#9ca3af;">•</span>
//                             <span style="color:#6b7280; font-size:12px;">Secure Healthcare Platform</span>
//                           </div>
//                           <p style="margin:0 0 8px 0; color:#9ca3af; font-size:11px;">
//                             © ${currentYear} ZEVA Health Technologies. All rights reserved.
//                           </p>
//                           <p style="margin:0; color:#9ca3af; font-size:11px;">
//                             123 Healthcare Ave, Suite 100 • San Francisco, CA 94105
//                           </p>
//                         </td>
//                         <td align="right">
//                           <div style="display:inline-block;">
//                             <span style="color:#6b7280; font-size:11px; display:block; margin-bottom:4px;">Secure by</span>
//                             <span style="color:#3b82f6; font-size:12px; font-weight:600;">256-bit encryption</span>
//                           </div>
//                         </td>
//                       </tr>
//                     </table>
//                   </td>
//                 </tr>
//               </table>
              
//               <!-- Post Script -->
//               <table width="100%" max-width="600" style="max-width:600px; width:100%; margin-top:24px;">
//                 <tr>
//                   <td align="center" style="padding:0 20px;">
//                     <p style="margin:0 0 8px 0; color:#9ca3af; font-size:11px;">
//                       This is an automated message from ZEVA. Please do not reply to this email.
//                     </p>
//                     <p style="margin:0; color:#9ca3af; font-size:11px;">
//                       <a href="#" style="color:#9ca3af; text-decoration:underline;">Privacy Policy</a> • 
//                       <a href="#" style="color:#9ca3af; text-decoration:underline;">Terms of Service</a>
//                     </p>
//                   </td>
//                 </tr>
//               </table>
//             </td>
//           </tr>
//         </table>
//       </body>
//       </html>
//     `;
    
//     // Plain text version for email clients that don't support HTML
//     const text = `
// ZEVA OTP VERIFICATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Hello ${userName},

// Your one-time password (OTP) to access ${clinicName} is:

// ┌─────────────────────────────┐
// │         ${emailCode}          │
// └─────────────────────────────┘

// ⏱️ Expires in: 5 minutes
// 🕐 Generated at: ${loginTime}

// Account Details:
// • Email: ${user.email}
// • Clinic: ${clinicName}

// ⚠️ SECURITY NOTICE
// Never share this code. ZEVA will never ask for your OTP.

// Didn't request this? Contact support@zeva.com immediately.

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// © ${currentYear} ZEVA Health Technologies
// Secure Healthcare Platform
//     `;
    
//     const r = await sendEmailViaSMTP(
//       clinic.otpEmail, 
//       `🔐 Your ZEVA Verification Code: ${emailCode}`, 
//       { text, html }
//     );
//     emailSent = !!r.success;
//   }
  
//   const isDev = process.env.NODE_ENV !== "production";
  
//   return res.status(200).json({ 
//     success: true, 
//     sent: true, 
//     delivery: { 
//       notification: true, 
//       whatsapp: whatsappSent, 
//       email: emailSent 
//     },
//     message: "OTP sent successfully",
//     debugPhoneOtp: isDev ? phoneCode : undefined, 
//     debugEmailOtp: isDev ? emailCode : undefined 
//   });
// }
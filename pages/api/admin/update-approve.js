// pages/api/admin/approve-clinic.ts
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";
import { approveClinicSeo } from "../../../lib/clinicApprovalSeoService";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { clinicId } = req.body;

  if (!clinicId) {
    return res.status(400).json({ success: false, message: "Clinic ID is required" });
  }

  try {
    // Get the logged-in user
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
    }

    // If user is an agent, check approve permission for approval_clinic module
    if (['agent', 'doctorStaff'].includes(me.role)) {
      const { hasPermission, error: permissionError } = await checkAgentPermission(
        me._id,
        "approval_clinic", // moduleKey
        "approve", // action
        null // subModuleName
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permissionError || "You do not have permission to approve clinics"
        });
      }
    }
    // Admin users bypass permission checks
    
    // First, fetch the clinic to get its name
    const clinicBeforeUpdate = await Clinic.findById(clinicId);
    if (!clinicBeforeUpdate) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Step 1: First approve the clinic (slug generation requires approval)
    const clinic = await Clinic.findByIdAndUpdate(
      clinicId,
      {
        isApproved: true,
        declined: false,
      },
      { new: true }
    );

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // Step 2: Generate + lock the city-based SEO slug and run the SEO pipeline.
    // Shared with clinic self-registration via lib/clinicApprovalSeoService.
    let slugGenerated = false;
    let finalClinic = clinic;
    let seoMessages = [];
    let seoResult = null;

    try {
      const seo = await approveClinicSeo(clinicId);
      finalClinic = seo.finalClinic;
      slugGenerated = seo.slugGenerated;
      seoMessages = seo.seoMessages;
      seoResult = seo.seoResult;
    } catch (slugError) {
      // If slug generation fails but clinic is approved, continue with approval
      console.error("❌ Slug generation error (non-fatal):", slugError.message);
    }

    const slugMessage = slugGenerated && finalClinic.slugLocked 
      ? " and slug generated" 
      : "";

    // Generate final response with SEO information
    const response = {
      success: true,
      message: "Clinic approved" + slugMessage,
      clinic: finalClinic,
    };
    
    // Add SEO messages if available
    if (seoMessages.length > 0) {
      response.seo_messages = seoMessages;
      response.seo_result = seoResult;
    }
    
    // Add slug lock message
    if (slugGenerated && finalClinic.slugLocked) {
      response.slug_locked = true;
      response.slug_lock_message = "🔒 Your clinic link is now permanent and cannot be changed to protect SEO rankings.";
    }

    res.status(200).json(response);
  } catch (error) {
    // console.error("❌ Clinic Approval Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

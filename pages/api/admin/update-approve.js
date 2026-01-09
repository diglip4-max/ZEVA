// pages/api/admin/approve-clinic.ts
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";
import { generateAndLockSlug } from "../../../lib/slugService";

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

    // Step 2: Generate and lock slug using central slug service (after approval)
    let slugGenerated = false;
    let finalClinic = clinic;
    
    try {
      if (!clinic.slugLocked && clinic.isApproved) {
        console.log(`🔄 Generating slug for clinic: ${clinic.name} (ID: ${clinicId})`);
        
        // Use central slug service to generate and lock slug
        const updatedClinic = await generateAndLockSlug('clinic', clinicId.toString());
        slugGenerated = !!updatedClinic.slug && updatedClinic.slugLocked;
        
        // Refresh clinic data to get updated slug
        finalClinic = await Clinic.findById(clinicId);
        
        if (slugGenerated) {
          console.log(`✅ Slug generated successfully: ${finalClinic.slug}`);
        } else {
          console.log(`⚠️ Slug generation completed but slugLocked is false`);
        }
      } else {
        console.log(`⏭️ Skipping slug generation - slugLocked: ${clinic.slugLocked}, isApproved: ${clinic.isApproved}`);
      }
    } catch (slugError) {
      // If slug generation fails but clinic is approved, continue with approval
      console.error("❌ Slug generation error (non-fatal):", slugError.message);
      console.error("Error stack:", slugError.stack);
      // Continue with approval even if slug generation fails
    }

    const slugMessage = slugGenerated && finalClinic.slugLocked 
      ? " and slug generated" 
      : "";

    res.status(200).json({
      success: true,
      message: "Clinic approved" + slugMessage,
      clinic: finalClinic,
    });
  } catch (error) {
    console.error("❌ Clinic Approval Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
}

// pages/api/admin/approve-clinic.ts
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";
import { slugify, generateUniqueSlug } from "../../../lib/utils";

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

    // Generate slug if not already locked
    let slug = clinicBeforeUpdate.slug;
    if (!clinicBeforeUpdate.slug || !clinicBeforeUpdate.slugLocked) {
      if (clinicBeforeUpdate.name) {
        const baseSlug = slugify(clinicBeforeUpdate.name);
        
        if (baseSlug) {
          // Check if slug exists (excluding current clinic)
          const checkSlugExists = async (slugToCheck) => {
            const existing = await Clinic.findOne({
              slug: slugToCheck,
              _id: { $ne: clinicId },
              slugLocked: true // Only check locked slugs to avoid conflicts
            });
            return !!existing;
          };

          // Generate unique slug
          slug = await generateUniqueSlug(baseSlug, checkSlugExists);
        }
      }
    }

    // ✅ Handle duplicate key race condition
    // Retry logic for MongoDB duplicate key errors (E11000)
    let retries = 3;
    let updateSuccess = false;
    let finalSlug = slug;
    let clinic = null;

    while (retries > 0 && !updateSuccess) {
      try {
        // ✅ Update clinic with approval status and slug
        clinic = await Clinic.findByIdAndUpdate(
          clinicId,
          {
            isApproved: true,
            declined: false,
            ...(finalSlug && !clinicBeforeUpdate.slugLocked ? { 
              slug: finalSlug,
              slugLocked: true 
            } : {}),
          },
          { new: true } // ✅ Return the updated document
        );

        if (clinic) {
          updateSuccess = true;
        }
      } catch (updateError) {
        // Handle duplicate key error (E11000)
        if (updateError.code === 11000 || updateError.codeName === 'DuplicateKey') {
          // Slug was taken by another process, generate a new one
          retries--;
          if (retries > 0 && finalSlug && !clinicBeforeUpdate.slugLocked) {
            // Generate a new unique slug with a different counter
            const baseSlug = slugify(clinicBeforeUpdate.name);
            if (baseSlug) {
              const checkSlugExists = async (slugToCheck) => {
                const existing = await Clinic.findOne({
                  slug: slugToCheck,
                  _id: { $ne: clinicId },
                  slugLocked: true
                });
                return !!existing;
              };
              const newBaseSlug = `${baseSlug}-${Date.now()}`;
              finalSlug = await generateUniqueSlug(newBaseSlug, checkSlugExists);
              continue;
            }
          }
          // If retries exhausted or slug generation failed, fetch current state
          clinic = await Clinic.findById(clinicId);
          if (clinic && clinic.slug && clinic.slugLocked) {
            // Slug was set by another process, use it
            updateSuccess = true;
            break;
          }
        } else {
          // Other error, throw it
          throw updateError;
        }
      }
    }

    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: "Clinic not found",
      });
    }

    // If slug was set by another process during race condition, use it
    const actualSlug = clinic.slug || finalSlug;
    const slugMessage = actualSlug && clinic.slugLocked 
      ? " and slug generated" 
      : "";

    res.status(200).json({
      success: true,
      message: "Clinic approved" + slugMessage,
      clinic,
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

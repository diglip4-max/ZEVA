import dbConnect from "../../../lib/database";
import Offer from "../../../models/CreateOffer";
import Treatment from "../../../models/Treatment";
import Clinic from "../../../models/Clinic";  
import { getUserFromReq, requireRole } from "./auth";
import { getClinicIdFromUser, checkClinicPermission } from "./permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

   if (!requireRole(user, ["clinic", "admin", "agent", "doctor"])) {
  return res.status(403).json({ success: false, message: "Access denied" });
}

    if (req.method !== "POST") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const data = req.body;
    const requiredFields = ["title", "type", "value", "startsAt", "endsAt"];
    for (const field of requiredFields) {
      if (!data[field]) {
        return res.status(400).json({ success: false, message: `${field} is required` });
      }
    }

    // ✅ Resolve clinicId based on role
    const { clinicId, error, isAdmin } = await getClinicIdFromUser(user);
    let resolvedClinicId = clinicId;

    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    if (isAdmin) {
      if (!data.clinicId) {
        return res.status(400).json({ success: false, message: "clinicId is required for admins" });
      }
      const clinic = await Clinic.findById(data.clinicId);
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      resolvedClinicId = clinic._id;
    }

    if (!resolvedClinicId) {
      return res.status(400).json({ success: false, message: "Clinic not found for this user" });
    }

    // ✅ Check permission for creating offers (only for clinic and agent, admin bypasses)
    if (!isAdmin) {
      // First check if clinic has create permission
      const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
        resolvedClinicId,
        "create_offers",
        "create"
      );

      if (!clinicHasPermission) {
        return res.status(403).json({
          success: false,
          message: clinicError || "You do not have permission to create offers"
        });
      }

      // If user is an agent, also check agent-specific permissions
      if (user.role === "agent") {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "create_offers",
          "create"
        );

        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to create offers"
          });
        }
      }
    }


    // ✅ Resolve treatments & subtreatments
    let treatmentIds = [];
    let subTreatments = [];

    if (Array.isArray(data.treatments) && data.treatments.length > 0) {
      for (const slug of data.treatments) {
        const treatment = await Treatment.findOne({
          $or: [{ slug }, { "subcategories.slug": slug }],
        });

        if (!treatment) {
          return res.status(400).json({ success: false, message: `Treatment not found: ${slug}` });
        }

        if (treatment.slug === slug) {
          treatmentIds.push(treatment._id);
        }

        const sub = treatment.subcategories.find((s) => s.slug === slug);
        if (sub) {
          treatmentIds.push(treatment._id);
          subTreatments.push({
            treatmentId: treatment._id,
            slug: sub.slug,
            name: sub.name,
          });
        }
      }

      treatmentIds = Array.from(new Set(treatmentIds.map((id) => id.toString()))).map(
        (id) => new mongoose.Types.ObjectId(id)
      );
    }

    const offer = new Offer({
      clinicId: resolvedClinicId,
      title: data.title,
      description: data.description || "",
      type: data.type,
      value: Number(data.value),
      currency: data.currency || "INR",
      code: data.code || undefined,
      slug: data.slug || undefined,
      startsAt: new Date(data.startsAt),
      endsAt: new Date(data.endsAt),
      timezone: data.timezone || "Asia/Kolkata",
      maxUses: data.maxUses ? Number(data.maxUses) : null,
      perUserLimit: data.perUserLimit ? Number(data.perUserLimit) : 1,
      channels: data.channels || [],
      utm: data.utm || { source: "clinic", medium: "email", campaign: "" },
      conditions: data.conditions || {},
      status: data.status || "draft",
      treatments: treatmentIds,
      subTreatments,
      createdBy: user._id,
      updatedBy: user._id,
    });

    await offer.save();
    return res.status(201).json({ success: true, offer });
  } catch (err) {
    console.error("Error creating offer:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}

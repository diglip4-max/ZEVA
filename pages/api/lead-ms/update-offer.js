// File: /pages/api/lead-ms/update-offer.js
import dbConnect from "../../../lib/database";
import Offer from "../../../models/CreateOffer";
import Treatment from "../../../models/Treatment";
import Clinic from "../../../models/Clinic";
import { getUserFromReq, requireRole } from "./auth";
import { checkClinicPermission } from "./permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  try {
    const user = await getUserFromReq(req);
    if (!user)
      return res.status(401).json({ success: false, message: "User not authenticated" });

    // ✅ Allow both clinic and agent
    if (!requireRole(user, ["clinic", "agent", "admin", "doctor"]))
      return res.status(403).json({ success: false, message: "Access denied" });

    const { id } = req.query;
    if (!id || !mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: "Valid offerId is required" });

    // ✅ First, get the offer to determine which clinic it belongs to
    const offer = await Offer.findById(id);
    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    // ✅ Resolve clinic based on role
    let clinic;
    if (user.role === "clinic") {
      clinic = await Clinic.findOne({ owner: user._id }).select("_id");
      // Ensure the offer belongs to this clinic
      if (offer.clinicId.toString() !== clinic._id.toString()) {
        return res.status(403).json({ success: false, message: "Not allowed to access this offer" });
      }
    } else if (user.role === "agent") {
      if (!user.clinicId)
        return res.status(403).json({ success: false, message: "Agent not linked to a clinic" });
      clinic = await Clinic.findById(user.clinicId).select("_id");
      // Ensure the offer belongs to this clinic
      if (offer.clinicId.toString() !== clinic._id.toString()) {
        return res.status(403).json({ success: false, message: "Not allowed to access this offer" });
      }
    } else if (user.role === "doctor") {
      if (!user.clinicId)
        return res.status(403).json({ success: false, message: "Doctor not linked to a clinic" });
      clinic = await Clinic.findById(user.clinicId).select("_id");
      if (!clinic) {
        return res.status(403).json({ success: false, message: "Clinic not found" });
      }
      if (offer.clinicId.toString() !== clinic._id.toString()) {
        return res.status(403).json({ success: false, message: "Not allowed to access this offer" });
      }
    } else if (user.role === "admin") {
      // Admin can access any offer
      clinic = await Clinic.findById(offer.clinicId).select("_id");
      if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });

    // ✅ Check permission for reading/updating offers (only for clinic and agent, admin bypasses)
    const action = req.method === "GET" ? "read" : "update";
    if (user.role !== "admin") {
      // First check if clinic has the required permission
      const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
        clinic._id,
        "create_offers",
        action
      );

      if (!clinicHasPermission) {
        return res.status(403).json({
          success: false,
          message: clinicError || `You do not have permission to ${action} offers`
        });
      }

      // If user is an agent, also check agent-specific permissions
      if (user.role === "agent") {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "create_offers",
          action
        );

        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || `You do not have permission to ${action} offers`
          });
        }
      }
    }

    // 🔹 GET: Fetch offer for editing
    if (req.method === "GET") {
      // Ensure expired status is reflected if end date passed
      if (offer.endsAt && new Date(offer.endsAt) < new Date() && offer.status !== "expired") {
        offer.status = "expired";
        await offer.save();
      }
      const treatments = await Treatment.find({ _id: { $in: offer.treatments } })
        .select("name slug subcategories duration price")
        .lean();

      const mappedTreatments = treatments.map((t) => {
        const relatedSubTreatments =
          offer.subTreatments
            ?.filter((st) => st.treatmentId.toString() === t._id.toString())
            .map((st) => ({
              name: st.name,
              slug: st.slug,
              price: st.price || null,
            })) || [];
        return {
          mainTreatment: t.name,
          mainTreatmentSlug: t.slug,
          duration: t.duration || null,
          subTreatments: relatedSubTreatments,
        };
      });

      return res.status(200).json({
        success: true,
        offer: {
          ...offer.toObject(),
          treatments: mappedTreatments,
        },
      });
    }

    // 🔹 PUT: Update offer
    if (req.method === "PUT") {
      const data = req.body;

      let treatmentIds = [];
      let subTreatments = [];

      if (Array.isArray(data.treatments) && data.treatments.length > 0) {
        for (const item of data.treatments) {
          let treatment = null;

          if (mongoose.Types.ObjectId.isValid(item)) {
            treatment = await Treatment.findById(item);
          } else {
            const slug = typeof item === "string" ? item : item.slug;
            if (slug) {
              treatment = await Treatment.findOne({
                $or: [{ slug }, { "subcategories.slug": slug }],
              });
            }
          }

          if (!treatment) {
            return res.status(400).json({
              success: false,
              message: `Treatment not found: ${JSON.stringify(item)}`,
            });
          }

          if (treatment.slug === (typeof item === "string" ? item : item.slug)) {
            treatmentIds.push(treatment._id);
          }

          if (treatment.subcategories && treatment.subcategories.length > 0) {
            const sub = treatment.subcategories.find(
              (s) => s.slug === (typeof item === "string" ? item : item.slug)
            );
            if (sub) {
              treatmentIds.push(treatment._id);
              subTreatments.push({
                treatmentId: treatment._id,
                slug: sub.slug,
                name: sub.name,
                price: sub.price || null,
              });
            }
          }
        }

        treatmentIds = Array.from(new Set(treatmentIds.map((id) => id.toString()))).map(
          (id) => new mongoose.Types.ObjectId(id)
        );
      }

      // Update fields
      offer.title = data.title ?? offer.title;
      offer.description = data.description ?? offer.description;
      offer.type = data.type ?? offer.type;
      offer.value = data.value !== undefined ? Number(data.value) : offer.value;
      offer.currency = data.currency ?? offer.currency;
      offer.code = data.code ?? offer.code;
      offer.slug = data.slug ?? offer.slug;
      offer.startsAt = data.startsAt ? new Date(data.startsAt) : offer.startsAt;
      offer.endsAt = data.endsAt ? new Date(data.endsAt) : offer.endsAt;
      offer.timezone = data.timezone ?? offer.timezone;
      offer.maxUses = data.maxUses !== undefined ? Number(data.maxUses) : offer.maxUses;
      offer.perUserLimit = data.perUserLimit !== undefined ? Number(data.perUserLimit) : offer.perUserLimit;
      offer.channels = data.channels ?? offer.channels;
      offer.utm = data.utm ?? offer.utm;
      offer.conditions = data.conditions ?? offer.conditions;
      offer.status = data.status ?? offer.status;

      if (treatmentIds.length > 0) offer.treatments = treatmentIds;
      if (subTreatments.length > 0) offer.subTreatments = subTreatments;

      offer.updatedBy = user._id;
      offer.updatedAt = new Date();

      await offer.save();

      return res.status(200).json({ success: true, offer });
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (err) {
    console.error("Error in update-offer:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}

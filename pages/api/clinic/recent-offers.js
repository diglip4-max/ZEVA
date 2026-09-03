import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import CreateOffer from "../../../models/CreateOffer";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/recent-offers
 *
 * Fetches the most recently created offers for the clinic.
 * Returns up to 4 offers sorted by createdAt descending.
 */

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // 1. Auth
    const authUser = await getUserFromReq(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. AuthZ
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) {
      return res.status(404).json({ message: error });
    }

    if (!clinicId && authUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: authUser._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    }

    if (!clinicId) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());

    // 3. Fetch most recent offers (up to 4)
    const offers = await CreateOffer.find({
      clinicId: clinicObjectId,
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .select("title offerType status code discountValue discountValue cashbackAmount buyQty freeQty startsAt endsAt usesCount maxUses createdAt")
      .lean();

    // 4. Format offers for display
    const formattedOffers = offers.map((offer) => {
      let offerDetail = "";
      if (offer.offerType === "instant_discount") {
        offerDetail = offer.discountMode === "percentage"
          ? `${offer.discountValue}% off`
          : `AED ${offer.discountValue} off`;
      } else if (offer.offerType === "cashback") {
        offerDetail = `AED ${offer.cashbackAmount} cashback`;
      } else if (offer.offerType === "bundle") {
        offerDetail = `Buy ${offer.buyQty} Get ${offer.freeQty} Free`;
      }

      return {
        id: offer._id.toString(),
        title: offer.title,
        offerType: offer.offerType,
        status: offer.status,
        code: offer.code || null,
        detail: offerDetail,
        discountValue: offer.discountValue || 0,
        cashbackAmount: offer.cashbackAmount || 0,
        usesCount: offer.usesCount || 0,
        maxUses: offer.maxUses,
        startsAt: offer.startsAt,
        endsAt: offer.endsAt,
        createdAt: offer.createdAt,
      };
    });

    return res.status(200).json({
      success: true,
      data: formattedOffers,
    });
  } catch (err) {
    console.error("Error in recent-offers:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import Service from "../../../models/Service";
import Treatment from "../../../models/Treatment";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  try {
    await dbConnect();

    if (req.method !== "GET") {
      return res.status(405).json({ success: false, message: "Method not allowed" });
    }

    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "User not authenticated" });
    }

    if (!requireRole(user, ["clinic", "agent", "admin", "doctor", "doctorStaff", "staff"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;

    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id;
    } else if (user.role === "agent" || user.role === "doctorStaff" || user.role === "staff") {
      if (!user.clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "doctor") {
      if (!user.clinicId) {
        return res.status(403).json({ success: false, message: "Doctor not linked to any clinic" });
      }
      clinicId = user.clinicId;
    } else if (user.role === "admin") {
      const { clinicId: adminClinicId } = req.query;
      if (adminClinicId) {
        clinicId = adminClinicId;
      }
    }

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "Clinic ID is required" });
    }

    // Parse date range
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.invoicedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Build price map from Treatment and Service models
    const treatmentPriceMap = new Map();

    const servicesList = await Service.find({ clinicId, isDeleted: { $ne: true } }).lean();
    for (const s of servicesList) {
      const p = s.clinicPrice ?? s.price ?? 0;
      if (s.name) treatmentPriceMap.set(s.name.toLowerCase().trim(), p);
      if (s.serviceSlug) treatmentPriceMap.set(s.serviceSlug.toLowerCase().trim(), p);
    }

    const treatmentsList = await Treatment.find({}).lean();
    for (const t of treatmentsList) {
      if (t.name) treatmentPriceMap.set(t.name.toLowerCase().trim(), t.price || 0);
      if (t.slug) treatmentPriceMap.set(t.slug.toLowerCase().trim(), t.price || 0);
      if (Array.isArray(t.subcategories)) {
        for (const sub of t.subcategories) {
          const subP = sub.price || 0;
          if (sub.name) treatmentPriceMap.set(sub.name.toLowerCase().trim(), subP);
          if (sub.slug) treatmentPriceMap.set(sub.slug.toLowerCase().trim(), subP);
        }
      }
    }

    // Find all billing records with offerFreeSession for this clinic
    const freeSessionBillings = await Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      offerFreeSession: { $exists: true, $not: { $size: 0 } },
      ...dateFilter,
    }).lean();

    let freeSessionLiability = 0;
    let freeSessionsRemaining = 0;

    for (const b of freeSessionBillings) {
      const freeSessions = Array.isArray(b.offerFreeSession) ? b.offerFreeSession : [];
      const usedSessions = Array.isArray(b.usedFreeSessions) ? b.usedFreeSessions : [];

      let remainingSessions = [...freeSessions];
      for (const used of usedSessions) {
        const idx = remainingSessions.findIndex(s => String(s).toLowerCase().trim() === String(used).toLowerCase().trim());
        if (idx !== -1) {
          remainingSessions.splice(idx, 1);
        }
      }

      freeSessionsRemaining += remainingSessions.length;

      for (const item of remainingSessions) {
        const key = String(item).toLowerCase().trim();
        const price = treatmentPriceMap.get(key) || 0;
        freeSessionLiability += price;
      }
    }

    // Calculate wallet/cashback liability
    const walletLiabilityPipeline = [
      {
        $match: {
          clinicId: clinicId,
          isAdvanceOnly: { $ne: true },
          $or: [
            { offerApplied: true, offerType: "cashback" },
            { isCashbackApplied: true },
          ],
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: null,
          totalCashbackEarned: { $sum: "$cashbackAmount" },
          totalWalletUsed: { $sum: "$cashbackWalletUsed" },
        },
      },
    ];

    const walletResult = await Billing.aggregate(walletLiabilityPipeline);
    const walletData = walletResult[0] || { totalCashbackEarned: 0, totalWalletUsed: 0 };
    const walletLiability = Math.max(0, walletData.totalCashbackEarned - walletData.totalWalletUsed);

    res.status(200).json({
      success: true,
      data: {
        freeSessionLiability: Math.max(0, freeSessionLiability),
        walletLiability: Math.max(0, walletLiability),
        freeSessionsRemaining: Math.max(0, freeSessionsRemaining),
        totalLiability: Math.max(0, walletLiability + freeSessionLiability),
      },
    });
  } catch (err) {
    console.error("Error in offer-liability:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}

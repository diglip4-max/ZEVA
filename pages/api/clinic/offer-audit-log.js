import dbConnect from "../../../lib/database";
import Offer from "../../../models/CreateOffer";
import Billing from "../../../models/Billing";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

function getInitials(name) {
  if (!name || typeof name !== 'string') return 'AU';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default async function handler(req, res) {
  await dbConnect();

  try {
    const user = await getUserFromReq(req);
    let clinicId = req.query.clinicId;

    if (user) {
      const clinicRes = await getClinicIdFromUser(user);
      if (clinicRes.clinicId) {
        clinicId = clinicRes.clinicId;
      }
    }

    if (!clinicId) {
      return res.status(400).json({ success: false, message: "Clinic ID is required" });
    }

    // 1. Fetch all offers for this clinic
    const offers = await Offer.find({ clinicId })
      .populate({ path: "createdBy", select: "firstName lastName email role" })
      .populate({ path: "updatedBy", select: "firstName lastName email role" })
      .sort({ updatedAt: -1 })
      .lean();

    // 2. Fetch billings where an offer was applied
    const offerBillings = await Billing.find({
      clinicId,
      $or: [
        { offerApplied: true },
        { isCashbackApplied: true },
        { offerName: { $exists: true, $ne: "" } },
      ],
    })
      .populate({ path: "patientId", select: "firstName lastName emrNumber" })
      .sort({ invoicedDate: -1, createdAt: -1 })
      .limit(50)
      .lean();

    const auditLogs = [];

    // Process Offers (Creation, Updates, Status Changes)
    offers.forEach((offer) => {
      const createdByObj = offer.createdBy;
      const createdByName = offer.createdByName ||
        (createdByObj ? [createdByObj.firstName, createdByObj.lastName].filter(Boolean).join(" ") : null) ||
        "Clinic Staff";
      
      const updatedByObj = offer.updatedBy;
      const updatedByName = offer.updatedByName ||
        (updatedByObj ? [updatedByObj.firstName, updatedByObj.lastName].filter(Boolean).join(" ") : null) ||
        createdByName;

      const offerTitle = offer.title || "Special Offer";

      // A. Creation Log
      auditLogs.push({
        id: `${offer._id}-create`,
        actionTitle: "Created offer",
        performedBy: createdByName,
        offerTitle,
        initials: getInitials(createdByName),
        mainText: `${createdByName} → ${offerTitle}`,
        reason: `Reason: New ${offer.offerType ? offer.offerType.replace("_", " ") : "campaign"} offer created · Status: ${offer.status || "active"}`,
        timestamp: new Date(offer.createdAt).getTime(),
        createdAt: offer.createdAt,
        badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
      });

      // B. Update Log (if updated after creation)
      if (offer.updatedAt && new Date(offer.updatedAt).getTime() - new Date(offer.createdAt).getTime() > 5000) {
        const isPaused = offer.status === 'paused';
        const actionTitle = isPaused ? "Paused offer" : "Updated offer";
        const mainText = isPaused 
          ? `${updatedByName} · Active → Paused` 
          : `${updatedByName} · Modified ${offerTitle}`;

        auditLogs.push({
          id: `${offer._id}-update`,
          actionTitle,
          performedBy: updatedByName,
          offerTitle,
          initials: getInitials(updatedByName),
          mainText,
          reason: isPaused 
            ? `Reason: Offer status updated to Paused · Offer: ${offerTitle}` 
            : `Reason: Offer settings updated · Approved by Admin`,
          timestamp: new Date(offer.updatedAt).getTime(),
          createdAt: offer.updatedAt,
          badgeColor: isPaused ? "bg-rose-100 text-rose-800 border-rose-200" : "bg-blue-100 text-blue-800 border-blue-200",
        });
      }
    });

    // Process Applied Offers from Billings
    offerBillings.forEach((billing) => {
      const patient = billing.patientId;
      const patientName = typeof patient === "object"
        ? [patient.firstName, patient.lastName].filter(Boolean).join(" ") || "Patient"
        : "Patient";
      const offerName = billing.offerName || billing.cashbackOfferName || "Discount Offer";
      const invDate = billing.invoicedDate || billing.createdAt;

      auditLogs.push({
        id: `${billing._id}-applied`,
        actionTitle: "Applied offer",
        performedBy: patientName,
        offerTitle: offerName,
        initials: getInitials(patientName),
        mainText: `${patientName} → ${offerName}`,
        reason: `Reason: Applied at billing checkout (Invoice ${billing.invoiceNumber || "—"}) · Auto-approved`,
        timestamp: new Date(invDate).getTime(),
        createdAt: invDate,
        badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      });
    });

    // Sort by timestamp descending
    auditLogs.sort((a, b) => b.timestamp - a.timestamp);

    return res.status(200).json({
      success: true,
      logs: auditLogs,
    });
  } catch (err) {
    // console.error("Error fetching offer audit logs:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}

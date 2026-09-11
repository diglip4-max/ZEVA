import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import Users from "../../../models/Users";
import Offer from "../../../models/CreateOffer";
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

    const { startDate, endDate } = req.query;
    const billingDateFilter = {};
    const offerDateFilter = {};
    if (startDate && endDate) {
      billingDateFilter.invoicedDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
      offerDateFilter.updatedAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const getCurrencySymbol = (code) => {
      const symbols = { AED: 'AED', USD: '$', EUR: '€', GBP: '£', SAR: 'SAR' };
      return symbols[code] || 'AED';
    };

    const formatRoleLabel = (role) => {
      if (!role) return 'Staff';
      const roleMap = {
        clinic: 'Clinic Owner',
        agent: 'Agent',
        doctor: 'Doctor',
        doctorStaff: 'Doctor Staff',
        staff: 'Staff',
        admin: 'Admin',
      };
      return roleMap[role] || role.charAt(0).toUpperCase() + role.slice(1);
    };

    const offerUpdateRecords = await Offer.find({
      clinicId: clinicId,
      updatedBy: { $exists: true, $ne: null },
      ...offerDateFilter,
    })
      .select("title offerType status updatedBy updatedAt createdAt discountValue discountMode cashbackAmount buyQty freeQty createdBy createdByName createdByRole updatedByName updatedByRole startsAt endsAt")
      .populate({ path: "updatedBy", model: "User", select: "name role" })
      .populate({ path: "createdBy", model: "User", select: "name role" })
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    const manualOverrideBillings = await Billing.find({
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true },
      isManualOverride: true,
      ...billingDateFilter,
    })
      .select("offerId offerName offerType offerDiscountAmount cashbackAmount originalDiscountAmount originalOfferDiscount isOverride overrideReason overrideApprovedBy invoicedDate createdAt invoiceNumber patientId")
      .populate({ path: "patientId", select: "firstName lastName emrNumber" })
      .populate({
        path: "offerId",
        select: "title offerType updatedBy updatedAt discountValue discountMode cashbackAmount buyQty freeQty",
        populate: {
          path: "updatedBy",
          model: "User",
          select: "name role",
        },
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const formatValueFromBilling = (billing, offer) => {
      const offerType = (offer?.offerType) || billing.offerType || 'instant_discount';
      if (offerType === 'cashback') {
        const before = billing.originalDiscountAmount && billing.originalDiscountAmount > 0 ? `${getCurrencySymbol()} ${Math.round(billing.originalDiscountAmount)}` : `${getCurrencySymbol()} 0`;
        const after = billing.cashbackAmount ? `${getCurrencySymbol()} ${Math.round(billing.cashbackAmount)}` : before;
        return { before, after };
      }
      if (offerType === 'bundle') {
        const before = offer?.buyQty ? `Buy ${offer.buyQty} Get ${offer.freeQty || 0}` : '1 free session';
        const after = '2 free sessions';
        return { before, after };
      }
      const beforePct = billing.originalDiscountAmount && billing.originalDiscountAmount > 0
        ? `${Math.round(billing.originalDiscountAmount)}%`
        : billing.originalOfferDiscount && billing.originalOfferDiscount > 0
          ? `${Math.round(billing.originalOfferDiscount)}%`
          : offer?.discountValue
            ? (offer.discountMode === 'flat' ? `${getCurrencySymbol()} ${Math.round(offer.discountValue)}` : `${Math.round(offer.discountValue)}%`)
            : '10% receptionist';
      const afterPct = billing.offerDiscountAmount && billing.offerDiscountAmount > 0
        ? `${Math.round(billing.offerDiscountAmount)}%`
        : '20%';
      return { before: beforePct, after: afterPct };
    };

    const formatValueFromOffer = (offer) => {
      if (!offer) return { before: '—', after: '—' };
      const offerType = offer.offerType || 'instant_discount';
      if (offerType === 'cashback') {
        const before = offer.cashbackAmount ? `${getCurrencySymbol()} ${Math.round(offer.cashbackAmount)}` : `${getCurrencySymbol()} 0`;
        return { before, after: before };
      }
      if (offerType === 'bundle') {
        const val = offer.buyQty ? `Buy ${offer.buyQty} Get ${offer.freeQty || 0}` : 'Bundle';
        return { before: val, after: val };
      }
      const value = offer.discountValue
        ? (offer.discountMode === 'flat' ? `${getCurrencySymbol()} ${Math.round(offer.discountValue)}` : `${Math.round(offer.discountValue)}%`)
        : '10% receptionist';
      return { before: value, after: value };
    };

    const offerRecords = offerUpdateRecords.map((offer, index) => {
      const updatedByUser = offer.updatedBy;
      const staffName = updatedByUser?.name || offer.updatedByName || offer.createdByName || 'Unknown staff';
      const staffRole = updatedByUser?.role || offer.updatedByRole || offer.createdByRole || '';
      const { before, after } = formatValueFromOffer(offer);
      return {
        id: offer._id ? `offer-${offer._id.toString()}` : `offer-update-${index}`,
        staffName: staffName,
        staffRole: staffRole,
        staffRoleLabel: formatRoleLabel(staffRole),
        timestamp: offer.updatedAt || offer.createdAt || new Date().toISOString(),
        offerName: offer.title || 'Offer',
        offerType: offer.offerType || 'instant_discount',
        offerId: offer._id ? offer._id.toString() : null,
        invoiceNumber: '',
        beforeValue: before,
        afterValue: after,
        reason: offer.status ? `Offer ${offer.status}` : 'Offer details updated',
        approvedBy: staffName || '—',
        patientId: null,
        patientName: '',
        patientEmrNumber: '',
      };
    });

    const billingRecords = manualOverrideBillings.map((billing, index) => {
      const offer = billing.offerId;
      const updatedByUser = offer?.updatedBy;
      const offerTitle = offer?.title || billing.offerName || 'Manual Override Offer';
      const staffName = updatedByUser?.name || offer?.updatedByName || 'Unknown staff';
      const staffRole = updatedByUser?.role || offer?.updatedByRole || '';
      const updatedDate = offer?.updatedAt || offer?.createdAt || billing.invoicedDate || billing.createdAt || new Date().toISOString();

      const { before, after } = formatValueFromBilling(billing, offer);

      const patientName = billing.patientId
        ? `${billing.patientId.firstName || ''} ${billing.patientId.lastName || ''}`.trim()
        : '';

      return {
        id: billing._id ? `billing-${billing._id.toString()}` : `override-${index}`,
        staffName: staffName,
        staffRole: staffRole,
        staffRoleLabel: formatRoleLabel(staffRole),
        timestamp: updatedDate,
        offerName: offerTitle,
        offerType: (offer?.offerType) || billing.offerType || 'instant_discount',
        offerId: billing.offerId?._id ? billing.offerId._id.toString() : null,
        invoiceNumber: billing.invoiceNumber || '',
        beforeValue: before,
        afterValue: after,
        reason: billing.overrideReason || 'Discretionary adjustment',
        approvedBy: billing.overrideApprovedBy || 'Admin',
        patientId: billing.patientId?._id ? billing.patientId._id.toString() : null,
        patientName: patientName || 'Unknown patient',
        patientEmrNumber: billing.patientId?.emrNumber || '',
      };
    });

    const records = [...offerRecords, ...billingRecords]
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 30);

    res.status(200).json({
      success: true,
      records,
      count: records.length,
    });
  } catch (err) {
    console.error("Error in offer-manual-overrides:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  }
}

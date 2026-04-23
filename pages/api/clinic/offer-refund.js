import dbConnect from '../../../lib/database';
import Billing from '../../../models/Billing';
import PatientRegistration from '../../../models/PatientRegistration';
import { getUserFromReq } from '../lead-ms/auth';
import { getClinicIdFromUser } from '../lead-ms/permissions-helper';

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const authUser = await getUserFromReq(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await getClinicIdFromUser(authUser);
    const clinicId = result.clinicId;
    if (!clinicId && authUser.role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Clinic ID not found' });
    }

    const { billingId } = req.body;
    if (!billingId) {
      return res.status(400).json({ success: false, message: 'Billing ID is required' });
    }

    const billing = await Billing.findById(billingId);
    if (!billing) {
      return res.status(404).json({ success: false, message: 'Billing record not found' });
    }

    if (billing.clinicId.toString() !== clinicId?.toString() && authUser.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (billing.isOfferRefunded) {
      return res.status(400).json({ success: false, message: 'Offers already refunded' });
    }

    const refundedOffers = [];
    let totalCashbackRefunded = 0;
    let totalCashbackWalletReversed = 0;
    const freeSessionsRefunded = [];

    // Handle Bundle Offer - Restore Free Sessions
    if (billing.offerType === 'bundle' && billing.offerFreeSession?.length > 0) {
      freeSessionsRefunded.push(...billing.offerFreeSession);
      refundedOffers.push({
        offerType: 'bundle',
        offerId: billing.offerId || null,
        offerName: billing.offerName || 'Bundle Offer',
        amount: 0,
        freeSessionsRefunded: [...billing.offerFreeSession],
        cashbackRefunded: 0,
        cashbackWalletUsageReversed: 0
      });
    }

    // Handle Cashback Earned - Refund to Patient Wallet
    if (billing.isCashbackApplied && billing.cashbackAmount > 0) {
      const patient = await PatientRegistration.findById(billing.patientId);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const refundAmount = billing.cashbackAmount;
      patient.walletBalance = (patient.walletBalance || 0) + refundAmount;
      patient.walletTransactions = patient.walletTransactions || [];
      patient.walletTransactions.push({
        amount: refundAmount,
        type: 'credit',
        source: 'refund',
        offerId: billing.cashbackOfferId || null,
        offerName: billing.cashbackOfferName || 'Cashback Refund',
        billingId: billing._id,
        invoiceNumber: billing.invoiceNumber,
        description: `Cashback refund for invoice ${billing.invoiceNumber}`,
        createdAt: new Date()
      });
      
      await patient.save();
      totalCashbackRefunded = refundAmount;
      
      refundedOffers.push({
        offerType: 'cashback',
        offerId: billing.cashbackOfferId || null,
        offerName: billing.cashbackOfferName || 'Cashback Offer',
        amount: refundAmount,
        freeSessionsRefunded: [],
        cashbackRefunded: refundAmount,
        cashbackWalletUsageReversed: 0
      });
    }

    // Handle Cashback Wallet Usage - Reverse the usage
    if (billing.cashbackWalletUsed > 0) {
      const patient = await PatientRegistration.findById(billing.patientId);
      if (!patient) {
        return res.status(404).json({ success: false, message: 'Patient not found' });
      }

      const reversalAmount = billing.cashbackWalletUsed;
      patient.walletBalance = (patient.walletBalance || 0) + reversalAmount;
      patient.walletTransactions = patient.walletTransactions || [];
      patient.walletTransactions.push({
        amount: reversalAmount,
        type: 'credit',
        source: 'refund',
        offerId: null,
        offerName: 'Cashback Wallet Reversal',
        billingId: billing._id,
        invoiceNumber: billing.invoiceNumber,
        description: `Cashback wallet reversal for invoice ${billing.invoiceNumber}`,
        createdAt: new Date()
      });
      
      await patient.save();
      totalCashbackWalletReversed = reversalAmount;
      
      const existingCashbackEntry = refundedOffers.find(o => o.offerType === 'cashback');
      if (existingCashbackEntry) {
        existingCashbackEntry.cashbackWalletUsageReversed = reversalAmount;
      } else {
        refundedOffers.push({
          offerType: 'cashback',
          offerId: null,
          offerName: 'Cashback Wallet Reversal',
          amount: 0,
          freeSessionsRefunded: [],
          cashbackRefunded: 0,
          cashbackWalletUsageReversed: reversalAmount
        });
      }
    }

    // Handle Instant Discount - Record the refund
    if (billing.offerApplied && billing.offerType === 'instant_discount' && billing.offerDiscountAmount > 0) {
      refundedOffers.push({
        offerType: 'instant_discount',
        offerId: billing.offerId || null,
        offerName: billing.offerName || 'Instant Discount',
        amount: billing.offerDiscountAmount,
        freeSessionsRefunded: [],
        cashbackRefunded: 0,
        cashbackWalletUsageReversed: 0
      });
    }

    // Update the billing record
    const totalRefundedAmount = totalCashbackRefunded + totalCashbackWalletReversed;
    
    await Billing.findByIdAndUpdate(billingId, {
      $set: {
        isOfferRefunded: true,
        refundedAt: new Date(),
        refundedBy: authUser.name || 'Clinic Staff',
        refundedAmount: totalRefundedAmount,
        refundedOffers: refundedOffers
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Offer refund processed successfully',
      data: {
        billingId: billing._id,
        invoiceNumber: billing.invoiceNumber,
        freeSessionsRestored: freeSessionsRefunded.length,
        freeSessionNames: freeSessionsRefunded,
        cashbackRefunded: totalCashbackRefunded,
        cashbackWalletReversed: totalCashbackWalletReversed,
        totalRefunded: totalRefundedAmount,
        refundedOffers
      }
    });

  } catch (error) {
    console.error('Error processing offer refund:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to process refund'
    });
  }
}
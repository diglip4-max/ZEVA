import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import InsuranceClaim from "../../../../models/InsuranceClaim";
import { getUserFromReq } from "../../lead-ms/auth";
import {
  aggregatePatientPending,
  pendingLedgerPreview,
} from "../../../../lib/pendingLedger";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (
      !["clinic", "agent", "doctorStaff", "staff", "admin"].includes(
        clinicUser.role,
      )
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { patientId } = req.query;
    if (!patientId) {
      return res
        .status(400)
        .json({ success: false, message: "Patient ID is required" });
    }

    // Determine clinicId
    let clinicId;
    if (clinicUser.role === "clinic") {
      const Clinic = (await import("../../../../models/Clinic")).default;
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (clinicUser.role === "admin") {
      // Admin can view across clinics if clinicId provided (optional)
      clinicId = req.query.clinicId || undefined;
    } else {
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "User not linked to a clinic" });
      }
    }

    const match = { 
      patientId: patientId,
      clinicId: clinicId,
      isAdvanceOnly: { $ne: true }
    };

    // We track advance and pending separately (not net)
    const billings = await Billing.find(match)
      .select(
        "pending advance advanceUsed pendingUsed pendingClaimUsed pastAdvance pastAdvanceUsed pastAdvanceType pendingBalanceImage claimAmountUsed createdAt",
      )
      .sort({ createdAt: -1 }) // Sort by newest first
      .lean();

    // Debug logging
   
    
    // Log all billing records to see their pending amounts
    if (billings.length > 0) {
      const pendingAmounts = billings.map(b => ({ invoice: b.invoiceNumber, pending: b.pending, pendingUsed: b.pendingUsed }));
      // console.log(`[Patient Balance] All billing records pending amounts:`, JSON.stringify(pendingAmounts, null, 2));
      
      // Log advance amounts
      const advanceAmounts = billings.map(b => ({ 
        invoice: b.invoiceNumber, 
        treatment: b.treatment,
        isAdvanceOnly: b.isAdvanceOnly,
        advance: b.advance, 
        advanceUsed: b.advanceUsed 
      }));
      // console.log(`[Patient Balance] All billing records advance amounts:`, JSON.stringify(advanceAmounts, null, 2));
    }
    const recordsWithImages = billings.filter(b => b.pendingBalanceImage && b.pendingBalanceImage.length > 0);
    // console.log(`[Patient Balance] Records with images: ${recordsWithImages.length}`);
    if (recordsWithImages.length > 0) {
      // console.log(`[Patient Balance] Sample images from first record:`, JSON.stringify(recordsWithImages[0].pendingBalanceImage));
    }
    
    // Log all billing records to see their structure
    if (billings.length > 0) {
      // console.log(`[Patient Balance] First billing record keys:`, Object.keys(billings[0]));
      // console.log(`[Patient Balance] First record pendingBalanceImage field:`, billings[0].pendingBalanceImage);
      // console.log(`[Patient Balance] Has pendingBalanceImage property:`, 'pendingBalanceImage' in billings[0]);
    }

    let totalPending = 0;
    let totalPendingUsed = 0;
    let totalAdvanceGenerated = 0;
    let totalAdvanceUsed = 0;

    // Track past advance and its usage
    let totalPastAdvanceGenerated = 0;
    let totalPastAdvanceUsed = 0;
    let total50PercentOfferPastAdvanceGenerated = 0;
    let total50PercentOfferPastAdvanceUsed = 0;
    let total54PercentOfferPastAdvanceGenerated = 0;
    let total54PercentOfferPastAdvanceUsed = 0;
    let total159FlatPastAdvanceGenerated = 0;
    let total159FlatPastAdvanceUsed = 0;

    // Collect all pending balance images
    const allPendingBalanceImages = [];

    for (const b of billings) {
      totalPending += Number(b.pending || 0);
      totalPendingUsed += Number(b.pendingUsed || 0);
      totalAdvanceGenerated += Number(b.advance || 0);
      totalAdvanceUsed += Number(b.advanceUsed || 0);

      // Track past advance
      totalPastAdvanceGenerated += Number(b.pastAdvance || 0);
      totalPastAdvanceUsed += Number(b.pastAdvanceUsed || 0);

      if (b.pastAdvanceType === "50% Offer") {
        total50PercentOfferPastAdvanceGenerated += Number(b.pastAdvance || 0);
        total50PercentOfferPastAdvanceUsed += Number(b.pastAdvanceUsed || 0);
      }
      if (b.pastAdvanceType === "54% Offer") {
        total54PercentOfferPastAdvanceGenerated += Number(b.pastAdvance || 0);
        total54PercentOfferPastAdvanceUsed += Number(b.pastAdvanceUsed || 0);
      }
      if (b.pastAdvanceType === "159 Flat") {
        total159FlatPastAdvanceGenerated += Number(b.pastAdvance || 0);
        total159FlatPastAdvanceUsed += Number(b.pastAdvanceUsed || 0);
      }

      // Collect pending balance images
      if (b.pendingBalanceImage && Array.isArray(b.pendingBalanceImage)) {
        allPendingBalanceImages.push(...b.pendingBalanceImage);
      }
    }

    

    // Pending balance is sum of actual pending fields from each invoice
    const pendingBalance = Math.max(
      0,
      Number(totalPending.toFixed(2)),
    );
    const advanceBalance = Math.max(
      0,
      Number((totalAdvanceGenerated - totalAdvanceUsed).toFixed(2)),
    );

    // Calculate past advance balance
    const pastAdvanceBalance = Math.max(
      0,
      Number((totalPastAdvanceGenerated - totalPastAdvanceUsed).toFixed(2)),
    );

    // Calculate past advance balance for each type
    const pastAdvance50PercentBalance = Math.max(
      0,
      Number(
        (
          total50PercentOfferPastAdvanceGenerated -
          total50PercentOfferPastAdvanceUsed
        ).toFixed(2),
      ),
    );
    const pastAdvance54PercentBalance = Math.max(
      0,
      Number(
        (
          total54PercentOfferPastAdvanceGenerated -
          total54PercentOfferPastAdvanceUsed
        ).toFixed(2),
      ),
    );
    const pastAdvance159FlatBalance = Math.max(
      0,
      Number(
        (
          total159FlatPastAdvanceGenerated - total159FlatPastAdvanceUsed
        ).toFixed(2),
      ),
    );

    // Aggregate insurance claim amounts - ONLY include "Released" claims
    const claimMatch = { patientId, status: "Released" };
    // Don't filter by clinicId for now to see all claims
    const claims = await InsuranceClaim.find(claimMatch)
      .select("claimAmount advanceAmount claimType status pendingClaim")
      .lean();
    
    
    
    let totalClaimAmount = 0;
    for (const c of claims) {
     
      // For Advance type: use claimAmount, for Paid type: use advanceAmount
      if (c.claimType === "Advance") {
        totalClaimAmount += Number(c.claimAmount || 0);
      } else if (c.claimType === "Paid") {
        totalClaimAmount += Number(c.advanceAmount || 0);
      } else {
      }
    }
    
    
    // Calculate total claimAmountUsed from all billings
    const totalClaimAmountUsed = billings.reduce(
      (sum, b) => sum + Number(b.claimAmountUsed || 0), 0
    );
    
    
    // Calculate remaining claim amount
    const claimAmount = Math.max(0, Number((totalClaimAmount - totalClaimAmountUsed).toFixed(2)));
    
    // Calculate total pending claim amount from released claims
    // The claim's pendingClaim field is the authoritative source - it is directly updated
    // by create-patient-registration and pay-pending-claim APIs when payments are made.
    // No need to subtract pendingClaimUsed from billings (that would cause double-deduction
    // since the claim record is already reduced).
    const totalPendingClaim = claims.reduce(
      (sum, c) => sum + Number(c.pendingClaim || 0), 0
    );
    
    // Final pending claim = direct sum from claim records (already reduced by billing/payment APIs)
    const finalPendingClaim = Math.max(0, Number(totalPendingClaim.toFixed(2)));

    // ============================================================
    // Enterprise Pending Ledger aggregation (additive layer).
    // We query the PatientPendingLedger collection for the same
    // patient and clinic and produce:
    //   - ledgerPendingBalance: sum(remainingAmount) over Open|Partial
    //   - ledgerOpenCount:      count of Open|Partial rows
    //   - ledgerTotalCleared:   lifetime sum(paidAmount) across all rows
    //   - ledgerPreview:        oldest 5 Open|Partial rows for the UI
    // These run independently of the legacy aggregation above so a
    // failure here cannot break the existing patient-balance card.
    // ============================================================
    let ledgerPendingBalance = 0;
    let ledgerOpenCount = 0;
    let ledgerTotalCleared = 0;
    let ledgerPreview = [];
    try {
      const agg = await aggregatePatientPending(patientId, clinicId || null);
      ledgerPendingBalance = Number(agg.totalPending || 0);
      ledgerOpenCount = Number(agg.openCount || 0);
      ledgerTotalCleared = Number(agg.totalCleared || 0);
      ledgerPreview = await pendingLedgerPreview(patientId, clinicId || null, {
        limit: 5,
      });
      
    } catch (ledgerErr) {
      console.warn(
        "[Patient Balance] Ledger aggregation failed (using legacy only):",
        ledgerErr.message,
      );
    }

    return res.status(200).json({
      success: true,
      balances: {
        advanceBalance,
        pendingBalance,
        claimAmount,
        pendingClaim: finalPendingClaim,
        pastAdvanceBalance,
        pastAdvance50PercentBalance,
        pastAdvance54PercentBalance,
        pastAdvance159FlatBalance,
        pendingBalanceImages: allPendingBalanceImages,
        // ============================================================
        // Enterprise Pending Ledger (additive, non-breaking).
        // The legacy pendingBalance above (computed from billing.pending)
        // is preserved as-is for backward compatibility with every UI
        // that reads `balances.pendingBalance`.
        // The new fields below come from the PatientPendingLedger
        // collection and give the UI per-treatment / per-package
        // granularity, status counts, and a small preview list.
        // UI can prefer ledger* when available, otherwise fall back
        // to the legacy value.
        // ============================================================
        ledgerPendingBalance,
        ledgerOpenCount,
        ledgerTotalCleared,
        ledgerPreview,
      },
      count: billings.length,
    });
  } catch (error) {
    console.error("Error computing patient balance:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to compute patient balance",
    });
  }
}

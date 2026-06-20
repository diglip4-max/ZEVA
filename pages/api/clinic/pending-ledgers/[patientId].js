import dbConnect from "../../../../lib/database";
import PatientPendingLedger from "../../../../models/PatientPendingLedger";
import Billing from "../../../../models/Billing";
import Clinic from "../../../../models/Clinic";
import { getUserFromReq } from "../../lead-ms/auth";
import {
  aggregatePatientPending,
  pendingLedgerPreview,
} from "../../../../lib/pendingLedger";

/**
 * GET /api/clinic/pending-ledgers/[patientId]
 *
 * Returns the patient's open / partial pending ledgers (oldest first),
 * plus a small preview summary. Backed by the PatientPendingLedger
 * collection (separate from Billing) so the response is fast and
 * independent of billing count.
 *
 * Query params:
 *   - includeClosed=true   -> include Closed/Refunded rows in `all`
 *   - limit=<n>            -> cap returned rows (default 100, max 500)
 *   - summary=true         -> only return summary aggregates
 */
export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Unauthorized" });
    }

    if (!["clinic", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res
        .status(403)
        .json({ success: false, message: "Access denied" });
    }

    const { patientId } = req.query;
    if (!patientId) {
      return res
        .status(400)
        .json({ success: false, message: "Patient ID is required" });
    }

    // Resolve clinic scope
    let clinicId = null;
    if (user.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: user._id });
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (user.role === "admin") {
      clinicId = req.query.clinicId || null;
    } else {
      clinicId = user.clinicId || null;
    }

    const includeClosed = String(req.query.includeClosed || "").toLowerCase() === "true";
    const summaryOnly = String(req.query.summary || "").toLowerCase() === "true";
    const limit = Math.min(parseInt(req.query.limit || "100", 10) || 100, 500);
    const previewLimit = Math.min(parseInt(req.query.previewLimit || "5", 10) || 5, 20);

    const match = { patientId };
    if (clinicId) match.clinicId = clinicId;

    if (summaryOnly) {
      const summary = await aggregatePatientPending(patientId, clinicId);
      return res.status(200).json({ success: true, summary, patientId });
    }

    // Active (Open / Partial) ledgers
    const openMatch = {
      ...match,
      status: { $in: ["Open", "Partial"] },
    };
    const openLedgers = await PatientPendingLedger.find(openMatch)
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    // Optional: closed/older rows for audit display
    let closedLedgers = [];
    if (includeClosed) {
      const closedMatch = {
        ...match,
        status: { $in: ["Closed", "Refunded", "WrittenOff", "Disputed"] },
      };
      closedLedgers = await PatientPendingLedger.find(closedMatch)
        .sort({ createdAt: -1 })
        .limit(Math.min(limit, 100))
        .lean();
    }

    // Hydrate the parent billing so the UI can show service + invoice metadata
    const billingIds = Array.from(
      new Set(
        [...openLedgers, ...closedLedgers]
          .map((l) => String(l.parentBillingId))
          .filter(Boolean),
      ),
    );
    const billings = billingIds.length
      ? await Billing.find({ _id: { $in: billingIds } })
          .select(
            "invoiceNumber invoicedDate service treatment package pending pendingUsed patientPackageId patientPackageSubId",
          )
          .lean()
      : [];
    const billingById = new Map(billings.map((b) => [String(b._id), b]));

    const decorate = (row) => {
      const parent = billingById.get(String(row.parentBillingId));
      return {
        ...row,
        parentBilling: parent
          ? {
              _id: parent._id,
              invoiceNumber: parent.invoiceNumber,
              invoicedDate: parent.invoicedDate,
              service: parent.service,
              treatment: parent.treatment,
              package: parent.package,
              patientPackageId: parent.patientPackageId,
              patientPackageSubId: parent.patientPackageSubId,
            }
          : null,
      };
    };

    const summary = await aggregatePatientPending(patientId, clinicId);
    const preview = await pendingLedgerPreview(patientId, clinicId, {
      limit: previewLimit,
    });

    return res.status(200).json({
      success: true,
      patientId,
      clinicId,
      summary,
      preview,
      openLedgers: openLedgers.map(decorate),
      closedLedgers: closedLedgers.map(decorate),
      counts: {
        open: openLedgers.length,
        closed: closedLedgers.length,
        totalReturned: openLedgers.length + closedLedgers.length,
      },
    });
  } catch (error) {
    console.error("[pending-ledgers] GET error:", error);
    return res
      .status(500)
      .json({ success: false, message: error.message || "Failed to fetch ledgers" });
  }
}

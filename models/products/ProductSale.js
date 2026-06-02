import mongoose from "mongoose";

/**
 * ProductSale Model (Phase 1 - MVP - Product Sales Module)
 *
 * PURPOSE
 * -------
 * One document = ONE product line sold to a patient/customer.
 * This is the source-of-truth for:
 *   - Daily Sales Report
 *   - Product Sales Report (Top-Selling Product)
 *   - Staff Sales Report
 *   - Commission Report
 *   - Dashboard product KPIs
 *
 * LINKAGE (no duplication of upstream truth)
 * -----------------------------------------
 *   Billing      → invoiceNumber, paymentMethod, payment totals (header)
 *   Product      → catalog, commission rule, sellingPrice override
 *   StockItem    → cost, VAT %, code, brand (via Product.stockItemId)
 *   AllocatedSI  → real stock decrement (we keep the consumed allocation refs
 *                  here so refunds can restore the same batches)
 *   Commission   → staff payout doc (we keep its _id once created)
 *   InsuranceClaim → claim apportioned to this line
 *
 * SNAPSHOT POLICY
 * ---------------
 * Every reference also stores a *Name / *Number copy at sale time.
 * Reports must NEVER need to populate to render a row. If the underlying
 * entity is later renamed/deleted, the historical record stays accurate.
 *
 * IMMUTABLE FINANCIALS
 * --------------------
 * unitPrice / quantity / discountAmount / vatAmount / netAmount / totalAmount
 * are frozen at sale time. Any change is modelled as a Refund (separate doc /
 * fields), never an in-place edit.
 */

const Schema = mongoose.Schema;

/* ------------------------------------------------------------------ *
 *  Sub-schemas
 * ------------------------------------------------------------------ */

// Which AllocatedStockItem batches were consumed for this sale line.
// Stored so refunds can restore the exact batches (FIFO / expiry-aware).
const stockAllocationSchema = new Schema(
  {
    allocatedStockItemId: {
      type: Schema.Types.ObjectId,
      ref: "AllocatedStockItem",
      required: true,
    },
    quantity: { type: Number, required: true, min: 0 },
    uom: { type: String, trim: true },
    expiryDate: { type: Date },
  },
  { _id: false },
);

// Commission snapshot on the sale line.
const commissionSnapshotSchema = new Schema(
  {
    applicable: { type: Boolean, default: false },
    ruleType: { type: String, enum: ["flat", "percentage"], default: "flat" },
    ruleValue: { type: Number, min: 0, default: 0 },
    // Final accrued commission amount for this sale line.
    amount: { type: Number, min: 0, default: 0 },
    // Reference to the Commission document once created by the sales API.
    commissionId: { type: Schema.Types.ObjectId, ref: "Commission" },
    // Payout lifecycle (mirrors Commission.isSubmitted/isApproved/paid).
    status: {
      type: String,
      enum: ["Pending", "Submitted", "Approved", "Paid", "Reversed"],
      default: "Pending",
    },
    paidAt: { type: Date },
  },
  { _id: false },
);

// Refund history entries (multiple partial refunds allowed).
const refundEntrySchema = new Schema(
  {
    refundedQty: { type: Number, required: true, min: 0 },
    refundAmount: { type: Number, required: true, min: 0 },
    commissionReversed: { type: Number, min: 0, default: 0 },
    reason: { type: String, trim: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedByName: { type: String, trim: true },
    refundedAt: { type: Date, default: Date.now },
    // Stock that was returned to inventory by this refund event.
    stockRestored: [stockAllocationSchema],
    notes: { type: String, trim: true },
  },
  { _id: true },
);

/* ------------------------------------------------------------------ *
 *  Main schema
 * ------------------------------------------------------------------ */

const ProductSaleSchema = new Schema(
  {
    /* ---------------- Multi-tenant ---------------- */
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },

    /* ---------------- Sale identity ---------------- */
    // Unique per-clinic running number for standalone product sales (e.g. PS-000123).
    // When the sale is part of a treatment / room invoice this still gets a number
    // for traceability, but `billingId` is the primary invoice link.
    saleNumber: { type: String, required: true, trim: true, index: true },

    // Source screen that created the sale.
    source: {
      type: String,
      enum: ["POS", "PatientInvoice", "TreatmentInvoice", "RoomBill"],
      default: "POS",
      index: true,
    },

    saleDate: { type: Date, default: Date.now, required: true, index: true },

    /* ---------------- Invoice linkage ---------------- */
    billingId: {
      type: Schema.Types.ObjectId,
      ref: "Billing",
      index: true,
    },
    invoiceNumber: { type: String, trim: true, index: true }, // snapshot of Billing.invoiceNumber

    /* ---------------- Patient ---------------- */
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "PatientRegistration",
      required: true,
      index: true,
    },
    patientName: { type: String, trim: true }, // snapshot
    patientCode: { type: String, trim: true }, // snapshot (MRN / patient code)
    patientPhone: { type: String, trim: true }, // snapshot

    // Derived once at sale time. "New" if patient was created within
    // NEW_PATIENT_WINDOW_DAYS of the sale date.
    patientType: {
      type: String,
      enum: ["New", "Existing"],
      default: "Existing",
      index: true,
    },

    /* ---------------- Product ---------------- */
    productId: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },
    stockItemId: {
      type: Schema.Types.ObjectId,
      ref: "StockItem",
      required: true,
      index: true,
    },
    productName: { type: String, required: true, trim: true }, // snapshot
    productCode: { type: String, trim: true }, // snapshot
    productCategory: { type: String, trim: true }, // snapshot

    /* ---------------- Quantity & pricing (immutable) ---------------- */
    quantity: { type: Number, required: true, min: 1 },
    uom: { type: String, trim: true }, // snapshot from StockItem level0.uom

    unitPrice: { type: Number, required: true, min: 0 },

    // Discount (line-level)
    discountType: {
      type: String,
      enum: ["None", "Flat", "Percentage"],
      default: "None",
    },
    discountValue: { type: Number, min: 0, default: 0 }, // raw input (AED or %)
    discountAmount: { type: Number, min: 0, default: 0 }, // resolved AED

    // VAT
    vatPercentage: { type: Number, min: 0, default: 0 },
    vatType: {
      type: String,
      enum: ["Exclusive", "Inclusive"],
      default: "Exclusive",
    },
    vatAmount: { type: Number, min: 0, default: 0 },

    // Computed by pre-save hook:
    //   netAmount   = (unitPrice * qty) - discountAmount      (pre-VAT)
    //   totalAmount = netAmount + vatAmount                   (final line total)
    netAmount: { type: Number, min: 0, default: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    // Cost snapshot (for profit reports).
    unitCost: { type: Number, min: 0, default: 0 },
    totalCost: { type: Number, min: 0, default: 0 },
    grossProfit: { type: Number, default: 0 },

    /* ---------------- People & department ---------------- */
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: "Department",
      index: true,
    },
    departmentName: { type: String, trim: true }, // snapshot

    // Staff who actually rang up / added the product to the bill.
    soldBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    soldByName: { type: String, trim: true }, // snapshot
    soldByRole: { type: String, trim: true }, // snapshot (Receptionist/Therapist/Doctor/...)

    // Doctor on the appointment / overseeing the sale (optional).
    doctorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    doctorName: { type: String, trim: true },

    // Referrer (external/internal source of the patient that led to this sale).
    referralId: { type: Schema.Types.ObjectId, ref: "Referral", index: true },
    referralName: { type: String, trim: true },

    /* ---------------- Payment (header lives on Billing) ---------------- */
    // Denormalized for reports; not source-of-truth.
    paymentMethod: {
      type: String,
      enum: [
        "Cash",
        "Card",
        "BT",
        "Tabby",
        "Tamara",
        "Insurance",
        "Advance Balance",
        "Cashback Wallet",
        "Mixed",
      ],
    },

    /* ---------------- Insurance ---------------- */
    insuranceClaimId: {
      type: Schema.Types.ObjectId,
      ref: "InsuranceClaim",
      index: true,
    },
    insuranceName: { type: String, trim: true }, // snapshot of InsuranceClaim.insuranceProvider
    insuranceClaimAmount: { type: Number, min: 0, default: 0 }, // portion of totalAmount claimed
    insuranceCoPayAmount: { type: Number, min: 0, default: 0 }, // patient share
    insuranceStatus: {
      type: String,
      enum: ["NotApplicable", "Pending", "Submitted", "Approved", "Rejected", "Settled"],
      default: "NotApplicable",
    },

    /* ---------------- Commission ---------------- */
    commission: { type: commissionSnapshotSchema, default: () => ({}) },

    /* ---------------- Stock decrement audit ---------------- */
    stockAllocations: { type: [stockAllocationSchema], default: [] },

    /* ---------------- Lifecycle / status ---------------- */
    status: {
      type: String,
      enum: ["Active", "PartiallyRefunded", "Refunded", "Cancelled"],
      default: "Active",
      index: true,
    },

    /* ---------------- Refunds ---------------- */
    refundedQty: { type: Number, min: 0, default: 0 },
    refundedAmount: { type: Number, min: 0, default: 0 },
    refunds: { type: [refundEntrySchema], default: [] },

    /* ---------------- Free-text ---------------- */
    remarks: { type: String, trim: true },

    /* ---------------- Audit ---------------- */
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledBy: { type: Schema.Types.ObjectId, ref: "User" },
    cancelledAt: { type: Date },
    cancelReason: { type: String, trim: true },
  },
  { timestamps: true },
);

/* ------------------------------------------------------------------ *
 *  Indexes (reports + uniqueness)
 * ------------------------------------------------------------------ */

// Per-clinic running number must be unique.
ProductSaleSchema.index({ clinicId: 1, saleNumber: 1 }, { unique: true });

// Daily Sales Report
ProductSaleSchema.index({ clinicId: 1, saleDate: -1 });
// Product Sales / Top-Selling Product
ProductSaleSchema.index({ clinicId: 1, productId: 1, saleDate: -1 });
// Staff Sales / Commission Report
ProductSaleSchema.index({ clinicId: 1, soldBy: 1, saleDate: -1 });
// Doctor product sales
ProductSaleSchema.index({ clinicId: 1, doctorId: 1, saleDate: -1 });
// Department-wise sales
ProductSaleSchema.index({ clinicId: 1, departmentId: 1, saleDate: -1 });
// Lookup by invoice
ProductSaleSchema.index({ clinicId: 1, invoiceNumber: 1 });
// Insurance claim reconciliation
ProductSaleSchema.index({ clinicId: 1, insuranceClaimId: 1 });

/* ------------------------------------------------------------------ *
 *  Constants
 * ------------------------------------------------------------------ */

// Window for marking a patient "New" relative to the sale date.
const NEW_PATIENT_WINDOW_DAYS = 30;

/* ------------------------------------------------------------------ *
 *  Pre-save hook : compute monetary derivatives + lifecycle status
 * ------------------------------------------------------------------ */

ProductSaleSchema.pre("save", function (next) {
  const qty = Number(this.quantity) || 0;
  const price = Number(this.unitPrice) || 0;
  const gross = qty * price;

  // ---- Discount resolution ----
  let discount = 0;
  if (this.discountType === "Flat") {
    discount = Number(this.discountValue) || 0;
  } else if (this.discountType === "Percentage") {
    discount = (gross * (Number(this.discountValue) || 0)) / 100;
  }
  if (discount > gross) discount = gross;
  this.discountAmount = Number(discount.toFixed(2));

  // ---- Net + VAT + Total ----
  const net = gross - this.discountAmount;
  this.netAmount = Number(Math.max(0, net).toFixed(2));

  const vatPct = Number(this.vatPercentage) || 0;
  if (vatPct > 0) {
    if (this.vatType === "Inclusive") {
      // VAT is inside the net amount.
      const base = this.netAmount / (1 + vatPct / 100);
      this.vatAmount = Number((this.netAmount - base).toFixed(2));
      this.totalAmount = this.netAmount;
    } else {
      this.vatAmount = Number(((this.netAmount * vatPct) / 100).toFixed(2));
      this.totalAmount = Number((this.netAmount + this.vatAmount).toFixed(2));
    }
  } else {
    this.vatAmount = 0;
    this.totalAmount = this.netAmount;
  }

  // ---- Cost + Profit ----
  this.totalCost = Number(((Number(this.unitCost) || 0) * qty).toFixed(2));
  this.grossProfit = Number((this.netAmount - this.totalCost).toFixed(2));

  // ---- Refund-driven status ----
  const refundedQty = Number(this.refundedQty) || 0;
  if (refundedQty <= 0 && this.status !== "Cancelled") {
    this.status = "Active";
  } else if (refundedQty > 0 && refundedQty < qty) {
    this.status = "PartiallyRefunded";
  } else if (refundedQty >= qty) {
    this.status = "Refunded";
  }

  // ---- Insurance default state ----
  if (this.insuranceClaimAmount > 0 && this.insuranceStatus === "NotApplicable") {
    this.insuranceStatus = "Pending";
  }

  next();
});

/* ------------------------------------------------------------------ *
 *  Statics
 * ------------------------------------------------------------------ */

/**
 * Generate the next per-clinic sale number (PS-000001 ...).
 * Uses a count-based scheme; collisions are guarded by the unique
 * (clinicId, saleNumber) index — caller should retry on E11000.
 */
ProductSaleSchema.statics.generateSaleNumber = async function (clinicId) {
  const count = await this.countDocuments({ clinicId });
  const seq = String(count + 1).padStart(6, "0");
  return `PS-${seq}`;
};

/**
 * Resolve "New" vs "Existing" patient at sale time.
 * Pass either a patient registration date or a patientId.
 */
ProductSaleSchema.statics.resolvePatientType = async function ({
  patientId,
  patientCreatedAt,
  saleDate = new Date(),
}) {
  let createdAt = patientCreatedAt;
  if (!createdAt && patientId) {
    const PR = mongoose.models.PatientRegistration;
    if (PR) {
      const p = await PR.findById(patientId).select("createdAt").lean();
      createdAt = p?.createdAt;
    }
  }
  if (!createdAt) return "Existing";
  const diffDays = (new Date(saleDate) - new Date(createdAt)) / (1000 * 60 * 60 * 24);
  return diffDays <= NEW_PATIENT_WINDOW_DAYS ? "New" : "Existing";
};

/**
 * Daily totals (used by dashboard + Daily Sales Report).
 */
ProductSaleSchema.statics.getDailyTotals = async function (clinicId, from, to) {
  return this.aggregate([
    {
      $match: {
        clinicId: new mongoose.Types.ObjectId(clinicId),
        saleDate: { $gte: new Date(from), $lte: new Date(to) },
        status: { $ne: "Cancelled" },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$saleDate" },
        },
        totalQty: { $sum: "$quantity" },
        totalSales: { $sum: "$totalAmount" },
        totalRefunds: { $sum: "$refundedAmount" },
        totalCommission: { $sum: "$commission.amount" },
        salesCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);
};

/**
 * Top selling products (dashboard + Product Sales Report).
 */
ProductSaleSchema.statics.getTopProducts = async function (clinicId, from, to, limit = 10) {
  return this.aggregate([
    {
      $match: {
        clinicId: new mongoose.Types.ObjectId(clinicId),
        saleDate: { $gte: new Date(from), $lte: new Date(to) },
        status: { $ne: "Cancelled" },
      },
    },
    {
      $group: {
        _id: "$productId",
        productName: { $first: "$productName" },
        productCode: { $first: "$productCode" },
        totalQty: { $sum: "$quantity" },
        totalSales: { $sum: "$totalAmount" },
      },
    },
    { $sort: { totalQty: -1 } },
    { $limit: limit },
  ]);
};

/**
 * Staff sales (Staff Sales Report + Commission Report).
 */
ProductSaleSchema.statics.getStaffPerformance = async function (clinicId, from, to) {
  return this.aggregate([
    {
      $match: {
        clinicId: new mongoose.Types.ObjectId(clinicId),
        saleDate: { $gte: new Date(from), $lte: new Date(to) },
        status: { $ne: "Cancelled" },
      },
    },
    {
      $group: {
        _id: "$soldBy",
        staffName: { $first: "$soldByName" },
        productsSold: { $sum: "$quantity" },
        salesAmount: { $sum: "$totalAmount" },
        commissionEarned: { $sum: "$commission.amount" },
      },
    },
    { $sort: { salesAmount: -1 } },
  ]);
};

/* ------------------------------------------------------------------ *
 *  Methods
 * ------------------------------------------------------------------ */

/**
 * Append a refund entry. Caller is still responsible for:
 *   - restoring stock via AllocatedStockItem
 *   - reversing/decrementing the Commission document
 *   - updating the parent Billing
 * This method only mutates the sale-line record itself.
 */
ProductSaleSchema.methods.addRefund = function ({
  refundedQty,
  refundAmount,
  commissionReversed = 0,
  reason,
  approvedBy,
  approvedByName,
  stockRestored = [],
  notes,
}) {
  const remaining = (Number(this.quantity) || 0) - (Number(this.refundedQty) || 0);
  if (refundedQty <= 0) throw new Error("refundedQty must be > 0");
  if (refundedQty > remaining) throw new Error("Refund exceeds remaining quantity");

  this.refunds.push({
    refundedQty,
    refundAmount,
    commissionReversed,
    reason,
    approvedBy,
    approvedByName,
    stockRestored,
    notes,
  });

  this.refundedQty = (Number(this.refundedQty) || 0) + Number(refundedQty);
  this.refundedAmount = (Number(this.refundedAmount) || 0) + Number(refundAmount || 0);

  if (commissionReversed && this.commission) {
    const remainingCommission = Math.max(
      0,
      (Number(this.commission.amount) || 0) - Number(commissionReversed),
    );
    this.commission.amount = Number(remainingCommission.toFixed(2));
    if (remainingCommission === 0) {
      this.commission.status = "Reversed";
    }
  }

  return this;
};

/* ------------------------------------------------------------------ *
 *  Hot-reload safety (Next.js dev)
 * ------------------------------------------------------------------ */

// Reuse existing compiled model on hot-reload, otherwise compile a fresh one.
const ProductSale =
  mongoose.models.ProductSale ||
  mongoose.model(
    "ProductSale",
    ProductSaleSchema
  );

export default ProductSale;

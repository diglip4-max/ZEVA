import mongoose from "mongoose";

/**
 * Product Model (Phase 1 - MVP - Product Sales Module)
 *
 * DESIGN NOTES
 * ------------
 * 1. STOCK is owned by `StockItem` (master) + `AllocatedStockItem` (on-hand qty by location).
 *    => Product MUST link to a StockItem via `stockItemId`. Stock, costPrice, VAT %, code,
 *       imageUrl, brand etc. live there. We DO NOT duplicate them; we expose them via
 *       virtuals / population so reports & POS reads stay consistent.
 *
 * 2. COMMISSION is owned by the existing `Commission` collection. This Product model only
 *    stores the commission RULE (flat amount or percentage). On every sale, a Commission
 *    document will be created (source: "staff") referencing the staff member who sold it.
 *
 * 3. BILLING / INVOICE lives in the existing `Billing` collection. A product sale will
 *    be appended to a patient invoice (Treatment / Room / Standalone). This model only
 *    keeps lightweight aggregate counters for fast dashboard / "Top Selling Product" reads.
 *
 * 4. Multi-tenant: every doc carries `clinicId` and is indexed by it.
 */

const Schema = mongoose.Schema;

const commissionRuleSchema = new Schema(
  {
    enabled: { type: Boolean, default: false },
    type: { type: String, enum: ["flat", "percentage"], default: "flat" },
    // Flat amount (AED) per unit sold OR percentage of selling price
    value: { type: Number, min: 0, default: 0 },
    // Optional cap on commission per single sale line (0 = no cap)
    maxPerSale: { type: Number, min: 0, default: 0 },
  },
  { _id: false },
);

const ProductSchema = new Schema(
  {
    // -------- Multi-tenant ----------
    clinicId: {
      type: Schema.Types.ObjectId,
      ref: "Clinic",
      required: true,
      index: true,
    },

    // -------- Stock linkage (source of truth) ----------
    // Every Product is backed by exactly one StockItem. Stock deduction on sale
    // happens against this StockItem via the existing AllocatedStockItem flow.
    stockItemId: {
      type: Schema.Types.ObjectId,
      ref: "StockItem",
      required: true,
      index: true,
    },

    // -------- Denormalized snapshot (for fast list / search / reports) ----------
    // Kept in sync with StockItem on create/update to avoid populate on every read.
    name: { type: String, required: true, trim: true, index: true },
    code: { type: String, trim: true, index: true },
    // VAT % is a copy of StockItem.vatPercentage at creation; can be overridden
    // by admin if a product needs a different VAT than the underlying stock item.
    vatPercentage: { type: Number, min: 0, default: 0 },

    // -------- Sales-specific fields (NEW – not on StockItem) ----------
    // Sales-facing category (e.g. "Skincare", "Supplements", "Devices") –
    // distinct from stock's purchasing category.
    category: { type: String, trim: true, index: true },

    // Optional marketing description shown on POS / invoice line.
    salesDescription: { type: String, trim: true },

    // Selling price for POS. If null/0, fall back to StockItem.level0.salePrice
    // at runtime. Stored here so admin can sell at a different price than the
    // stock master sale price without polluting stock records.
    sellingPrice: { type: Number, min: 0, default: 0 },

    // Commission rule per unit sold. Used by sales API to create Commission docs.
    commission: { type: commissionRuleSchema, default: () => ({}) },

    // Sellable flag (independent from StockItem.status which controls stock visibility).
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
      index: true,
    },

    // -------- Performance counters (denormalized for dashboard) ----------
    // Updated atomically by sales / refund APIs ($inc). NOT the source of truth –
    // ProductSale collection is. These are just for fast dashboard reads.
    totalQuantitySold: { type: Number, min: 0, default: 0 },
    totalSalesValue: { type: Number, min: 0, default: 0 },
    totalCommissionAccrued: { type: Number, min: 0, default: 0 },
    totalRefundedQty: { type: Number, min: 0, default: 0 },
    totalRefundedValue: { type: Number, min: 0, default: 0 },
    lastSoldAt: { type: Date },

    // -------- Audit ----------
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// ---------------- Indexes ----------------
// One product per stock item per clinic (prevents duplicate Product entries
// pointing to the same StockItem within the same clinic).
ProductSchema.index({ clinicId: 1, stockItemId: 1 }, { unique: true });

// Unique product code per clinic. Sparse so products without a code are allowed
// (e.g. drafts), but any two products in the same clinic that DO have a code
// must have a distinct one — prevents duplicates like FS001 / FS001 / FS001.
ProductSchema.index({ clinicId: 1, code: 1 }, { unique: true, sparse: true });

// Status + category filter (admin product list, dashboard category breakdown).
ProductSchema.index({ clinicId: 1, status: 1, category: 1 });

// Plain B-tree index on name for POS prefix / regex search (faster than $text
// for short queries and supports sort by name).
ProductSchema.index({ clinicId: 1, name: 1 });

// Full-text search for POS free-text lookup ("face serum", "FS001", etc.).
ProductSchema.index({ clinicId: 1, name: "text", code: "text" });

// ---------------- Virtuals ----------------
// Live stock qty must always be read from AllocatedStockItem. We expose a
// helper that other code/services can call instead of querying directly.
// (Kept on the model, not as a virtual populate, because qty needs aggregation.)
ProductSchema.statics.getCurrentStock = async function (productId) {
  const product = await this.findById(productId).select("clinicId stockItemId").lean();
  if (!product) return 0;
  const AllocatedStockItem = mongoose.models.AllocatedStockItem;
  if (!AllocatedStockItem) return 0;
  const result = await AllocatedStockItem.aggregate([
    {
      $match: {
        clinicId: product.clinicId,
        "item.itemId": product.stockItemId,
        status: { $in: ["Allocated", "Issued", "Partially_Used"] },
      },
    },
    { $group: { _id: null, qty: { $sum: "$quantity" } } },
  ]);
  return result?.[0]?.qty || 0;
};

// Resolve effective selling price (override -> StockItem.level0.salePrice -> 0)
ProductSchema.methods.getEffectiveSellingPrice = async function () {
  if (this.sellingPrice && this.sellingPrice > 0) return this.sellingPrice;
  const StockItem = mongoose.models.StockItem;
  if (!StockItem) return 0;
  const si = await StockItem.findById(this.stockItemId).select("level0.salePrice").lean();
  return si?.level0?.salePrice || 0;
};

// Compute commission for a given sale line (qty + unit price).
ProductSchema.methods.computeCommission = function (quantity, unitPrice) {
  if (!this.commission?.enabled) return 0;
  const qty = Number(quantity) || 0;
  const price = Number(unitPrice) || 0;
  let perUnit = 0;
  if (this.commission.type === "flat") {
    perUnit = Number(this.commission.value) || 0;
  } else {
    // percentage of unit selling price
    perUnit = (price * (Number(this.commission.value) || 0)) / 100;
  }
  let total = perUnit * qty;
  if (this.commission.maxPerSale && total > this.commission.maxPerSale) {
    total = this.commission.maxPerSale;
  }
  return Math.max(0, Number(total.toFixed(2)));
};

// Reuse existing compiled model on hot-reload, otherwise compile a fresh one.
const Product =
  mongoose.models.Product ||
  mongoose.model(
    "Product",
    ProductSchema
  );

export default Product;

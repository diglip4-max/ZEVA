import dbConnect from "../../../../lib/database";
import mongoose from "mongoose";
import Clinic from "../../../../models/Clinic";
import StockLocation from "../../../../models/stocks/StockLocation";
import StockItem from "../../../../models/stocks/StockItem";
import CustomStockItem from "../../../../models/stocks/CustomStockItem";
import User from "../../../../models/Users";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";
import AllocatedStockItem, {
  AllocatedStockItemDetails,
} from "../../../../models/stocks/AllocatedStockItem";
import PurchaseRecord from "../../../../models/stocks/PurchaseRecord";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const me = await getUserFromReq(req);
    if (!me)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });
    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id });
      if (!clinic) {
        return res
          .status(400)
          .json({ success: false, message: "Clinic not found for this user" });
      }
      clinicId = clinic._id.toString();
    } else if (
      me.role === "agent" ||
      me.role === "doctor" ||
      me.role === "doctorStaff"
    ) {
      if (!me.clinicId) {
        return res
          .status(400)
          .json({ success: false, message: "User not tied to a clinic" });
      }
      clinicId = me.clinicId.toString();
    } else if (me.role === "admin") {
      clinicId = req.body?.clinicId;
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required for admin in request body",
        });
      }
    }

    const {
      allocatedStockItems,
      purchaseRecord,
      customStockItem,
      sourceType, // "Purchase_Order" or "Custom_Stock_Item"
      allocatedBy,
      notes = "",
    } = req.body || {};

    if (!allocatedStockItems || !Array.isArray(allocatedStockItems)) {
      return res.status(400).json({
        success: false,
        message: "Valid allocatedStockItems is required",
      });
    }
    if (!sourceType) {
      return res.status(400).json({
        success: false,
        message: "sourceType is required (Purchase_Order or Custom_Stock_Item)",
      });
    }

    if (sourceType === "Purchase_Order") {
      if (!purchaseRecord || !mongoose.Types.ObjectId.isValid(purchaseRecord)) {
        return res.status(400).json({
          success: false,
          message: "Valid purchaseRecord is required for Purchase_Order source",
        });
      }
    } else if (sourceType === "Custom_Stock_Item") {
      if (
        !customStockItem ||
        !mongoose.Types.ObjectId.isValid(customStockItem)
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Valid customStockItem is required for Custom_Stock_Item source",
        });
      }
    }

    if (!allocatedBy || !mongoose.Types.ObjectId.isValid(allocatedBy)) {
      return res.status(400).json({
        success: false,
        message: "Valid allocatedBy is required",
      });
    }

    // Validate input entries
    let allocatedItemIds = [];
    for (let itemData of allocatedStockItems) {
      const { item, quantity, user, location, expiryDate } = itemData || {};

      const itemId =
        item && item.itemId && mongoose.Types.ObjectId.isValid(item.itemId)
          ? item.itemId
          : item &&
              item.customStockItemId &&
              mongoose.Types.ObjectId.isValid(item.customStockItemId)
            ? item.customStockItemId
            : null;

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: "Valid itemId or customStockItemId is required",
        });
      }
      if (
        !quantity ||
        !Number.isFinite(Number(quantity)) ||
        Number(quantity) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Valid quantity is required",
        });
      }
      if (!user || !mongoose.Types.ObjectId.isValid(user)) {
        return res.status(400).json({
          success: false,
          message: "Valid user is required",
        });
      }
    }

    let sourceData;
    if (sourceType === "Purchase_Order") {
      const pr = await PurchaseRecord.findOne({
        _id: purchaseRecord,
        clinicId,
      }).lean();
      if (!pr) {
        return res
          .status(404)
          .json({ success: false, message: "Purchase record not found" });
      }
      sourceData = { type: "Purchase_Order", data: pr };

      // Check availability and create allocated items (existing logic)
      const prQtyMap = new Map();
      (pr.items || []).forEach((it) => {
        const key = (it.itemId || it._id || "").toString();
        if (key)
          prQtyMap.set(key, Number(it.quantity || 0) + (it?.freeQuantity || 0));
      });

      const newTotals = new Map();
      for (const entry of allocatedStockItems) {
        const itemId =
          (entry.item?.itemId &&
            mongoose.Types.ObjectId.isValid(entry.item.itemId) &&
            entry.item.itemId.toString()) ||
          (entry.stockItem &&
            mongoose.Types.ObjectId.isValid(entry.stockItem) &&
            entry.stockItem.toString());
        if (!itemId) {
          return res.status(400).json({
            success: false,
            message: "Valid itemId/stockItem is required in entries",
          });
        }
        const key = itemId.toString();
        const prev = newTotals.get(key) || 0;
        newTotals.set(key, prev + Number(entry.quantity || 0));
      }

      for (const [itemId, newTotal] of newTotals.entries()) {
        const allowed = prQtyMap.get(itemId);
        if (typeof allowed !== "number") {
          return res.status(400).json({
            success: false,
            message: "Stock item not present in purchase record",
          });
        }
        const existing = await AllocatedStockItem.find({
          clinicId,
          purchaseRecord,
          $or: [{ stockItem: itemId }, { "item.itemId": itemId }],
          status: { $nin: ["Cancelled", "Deleted"] },
        })
          .select("quantity")
          .lean();
        const existingSum = existing.reduce(
          (sum, doc) => sum + Number(doc.quantity || 0),
          0,
        );
        if (existingSum + newTotal > allowed) {
          return res.status(400).json({
            success: false,
            message:
              "Allocated quantity exceeds available quantity in purchase order",
          });
        }
      }

      // Create allocated records from entries
      for (let itemData of allocatedStockItems) {
        const { item, stockItem, quantity, user, location, expiryDate } =
          itemData || {};
        const itemId =
          (item && item.itemId && mongoose.Types.ObjectId.isValid(item.itemId)
            ? item.itemId
            : null) ||
          (stockItem && mongoose.Types.ObjectId.isValid(stockItem)
            ? stockItem
            : null);
        const prItem =
          (pr.items || []).find(
            (it) =>
              it.itemId?.toString() === itemId?.toString() ||
              it._id?.toString() === itemId?.toString(),
          ) || null;
        if (!prItem) {
          return res.status(400).json({
            success: false,
            message: "Stock item not present in purchase record",
          });
        }
        const qty = Number(quantity || 0);
        const unit = Number(prItem.unitPrice || 0);
        const total = Number((qty * unit).toFixed(2));
        const discountType =
          prItem.discountType === "Percentage" ? "Percentage" : "Fixed";
        const discount = Number(prItem.discount || 0);
        const discountAmount =
          prItem.discountAmount !== undefined
            ? Number(prItem.discountAmount || 0)
            : discountType === "Percentage"
              ? Number(((total * discount) / 100).toFixed(2))
              : Number(discount);
        const netPrice =
          prItem.netPrice !== undefined
            ? Number(prItem.netPrice || 0)
            : Number((total - discountAmount).toFixed(2));
        const vatType =
          prItem.vatType === "Inclusive" ? "Inclusive" : "Exclusive";
        const vatPercentage = Number(prItem.vatPercentage || 0);
        const vatAmount =
          prItem.vatAmount !== undefined
            ? Number(prItem.vatAmount || 0)
            : vatType === "Exclusive"
              ? Number(((netPrice * vatPercentage) / 100).toFixed(2))
              : Number(0);
        const netPlusVat =
          prItem.netPlusVat !== undefined
            ? Number(prItem.netPlusVat || 0)
            : Number((netPrice + vatAmount).toFixed(2));

        const itemSubdoc = {
          itemId,
          code: prItem.code || "",
          name: prItem.name || "",
          description: prItem.description || "",
          quantity: qty,
          uom: prItem.uom || "",
          unitPrice: unit,
          totalPrice: total,
          discount,
          discountType,
          discountAmount,
          netPrice,
          vatAmount,
          vatType,
          vatPercentage,
          netPlusVat,
          freeQuantity: Number(prItem.freeQuantity || 0),
          freeQuantityExpiryDate: prItem.freeQuantityExpiryDate || null,
          level0: prItem.level0,
          packagingStructure: prItem.packagingStructure,
        };

        let quantitiesByUom = [];
        if (prItem?.uom) {
          quantitiesByUom.push({
            uom: prItem.uom || "",
            quantity: quantity,
          });
        }

        if (
          prItem &&
          prItem?.packagingStructure?.level1?.uom &&
          prItem?.packagingStructure?.level1?.quantity &&
          prItem?.packagingStructure?.level1?.price > 0
        ) {
          quantitiesByUom.push({
            uom: prItem?.packagingStructure?.level1?.uom || "",
            quantity: Number(
              (prItem?.packagingStructure?.level1?.quantity || 0) * quantity,
            ),
          });
        }

        if (
          prItem &&
          prItem?.packagingStructure?.level2?.uom &&
          prItem?.packagingStructure?.level2?.quantity &&
          prItem?.packagingStructure?.level2?.price > 0
        ) {
          quantitiesByUom.push({
            uom: prItem?.packagingStructure?.level2?.uom || "",
            quantity: Number(
              (prItem?.packagingStructure?.level2?.quantity || 0) *
                quantitiesByUom[quantitiesByUom?.length - 1]?.quantity,
            ),
          });
        }

        const newAllocatedItem = new AllocatedStockItem({
          clinicId,
          item: itemSubdoc,
          quantity,
          user,
          purchaseRecord,
          allocatedBy: me._id,
          location,
          expiryDate,
          quantitiesByUom,
        });

        await newAllocatedItem.save();
        allocatedItemIds.push(newAllocatedItem._id);
      }

      const allocatedItemDetails = new AllocatedStockItemDetails({
        allocatedStockItems: allocatedItemIds,
        purchaseRecord,
        allocatedBy: me._id,
        notes,
      });
      await allocatedItemDetails.save();

      await PurchaseRecord.findByIdAndUpdate(purchaseRecord, {
        status: "Allocated",
      });
    } else if (sourceType === "Custom_Stock_Item") {
      const csi = await CustomStockItem.findOne({
        _id: customStockItem,
        clinicId,
        status: "New", // Ensure only New items can be allocated
      }).lean();

      if (!csi) {
        return res.status(404).json({
          success: false,
          message: "Custom Stock Item not found or already allocated",
        });
      }

      sourceData = { type: "Custom_Stock_Item", data: csi };

      // Check quantity availability (sum all allocated quantities for this custom stock item)
      const newTotals = new Map();
      for (const entry of allocatedStockItems) {
        const itemId =
          entry.item?.customStockItemId?.toString() ||
          customStockItem.toString();
        const key = itemId;
        const prev = newTotals.get(key) || 0;
        newTotals.set(key, prev + Number(entry.quantity || 0));
      }

      for (const [itemId, newTotal] of newTotals.entries()) {
        // Check existing allocated items for this custom stock item
        const existing = await AllocatedStockItem.find({
          clinicId,
          "item.customStockItemId": itemId,
          status: { $nin: ["Cancelled", "Deleted"] },
        })
          .select("quantity")
          .lean();

        const existingSum = existing.reduce(
          (sum, doc) => sum + Number(doc.quantity || 0),
          0,
        );

        if (existingSum + newTotal > csi.quantity) {
          return res.status(400).json({
            success: false,
            message:
              "Allocated quantity exceeds available quantity in custom stock item",
          });
        }
      }

      // Create allocated records from custom stock item
      for (let itemData of allocatedStockItems) {
        const { quantity, user, location, expiryDate } = itemData || {};
        const qty = Number(quantity || 0);
        const unit = Number(csi.unitPrice || 0);
        const total = Number((qty * unit).toFixed(2));
        const discountType =
          csi.discountType === "Percentage" ? "Percentage" : "Fixed";
        const discount = Number(csi.discount || 0);
        const discountAmount =
          csi.discountAmount !== undefined
            ? Number(csi.discountAmount || 0)
            : discountType === "Percentage"
              ? Number(((total * discount) / 100).toFixed(2))
              : Number(discount);
        const netPrice =
          csi.netPrice !== undefined
            ? Number(csi.netPrice || 0)
            : Number((total - discountAmount).toFixed(2));
        const vatType = csi.vatType === "Inclusive" ? "Inclusive" : "Exclusive";
        const vatPercentage = Number(csi.vatPercentage || 0);
        const vatAmount =
          csi.vatAmount !== undefined
            ? Number(csi.vatAmount || 0)
            : vatType === "Exclusive"
              ? Number(((netPrice * vatPercentage) / 100).toFixed(2))
              : Number(0);
        const netPlusVat =
          csi.netPlusVat !== undefined
            ? Number(csi.netPlusVat || 0)
            : Number((netPrice + vatAmount).toFixed(2));

        const itemSubdoc = {
          customStockItemId: csi._id,
          code: csi.code || "",
          name: csi.name || "",
          description: csi.description || "",
          quantity: qty,
          uom: csi.uom || "",
          unitPrice: unit,
          totalPrice: total,
          discount,
          discountType,
          discountAmount,
          netPrice,
          vatAmount,
          vatType,
          vatPercentage,
          netPlusVat,
          freeQuantity: Number(csi.freeQuantity || 0),
          freeQuantityExpiryDate: csi.freeQuantityExpiryDate || null,
          level0: csi.level0,
          packagingStructure: csi.packagingStructure,
        };

        let quantitiesByUom = [];
        if (csi?.uom) {
          quantitiesByUom.push({
            uom: csi.uom || "",
            quantity: quantity,
          });
        }

        if (
          csi &&
          csi?.packagingStructure?.level1?.uom &&
          csi?.packagingStructure?.level1?.quantity &&
          csi?.packagingStructure?.level1?.price > 0
        ) {
          quantitiesByUom.push({
            uom: csi?.packagingStructure?.level1?.uom || "",
            quantity: Number(
              (csi?.packagingStructure?.level1?.quantity || 0) * quantity,
            ),
          });
        }

        if (
          csi &&
          csi?.packagingStructure?.level2?.uom &&
          csi?.packagingStructure?.level2?.quantity &&
          csi?.packagingStructure?.level2?.price > 0
        ) {
          quantitiesByUom.push({
            uom: csi?.packagingStructure?.level2?.uom || "",
            quantity: Number(
              (csi?.packagingStructure?.level2?.quantity || 0) *
                quantitiesByUom[quantitiesByUom?.length - 1]?.quantity,
            ),
          });
        }

        const newAllocatedItem = new AllocatedStockItem({
          clinicId,
          item: itemSubdoc,
          quantity,
          user,
          allocatedBy: me._id,
          location,
          expiryDate,
          quantitiesByUom,
        });

        await newAllocatedItem.save();
        allocatedItemIds.push(newAllocatedItem._id);
      }

      // First, let's update CustomStockItem status to Allocated!
      await CustomStockItem.findByIdAndUpdate(customStockItem, {
        status: "Allocated",
      });

      // Create allocated item details
      const allocatedItemDetails = new AllocatedStockItemDetails({
        allocatedStockItems: allocatedItemIds,
        customStockItem,
        allocatedBy: me._id,
        notes,
      });
      await allocatedItemDetails.save();
    }

    // Populate references
    const allocatedItems = await AllocatedStockItem.find({
      _id: { $in: allocatedItemIds },
    })
      .populate("user")
      .populate("location")
      .populate("allocatedBy")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Allocated item created",
      allocatedItems,
    });
  } catch (err) {
    console.error("Error in add allocated stock item: ", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Server error" });
  }
}

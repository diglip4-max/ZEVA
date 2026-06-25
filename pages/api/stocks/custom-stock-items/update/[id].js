import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import CustomStockItem from "../../../../../models/stocks/CustomStockItem";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  res.setHeader("Allow", ["PUT"]);

  if (req.method !== "PUT") {
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
      });
    }

    // Get clinicId based on user role
    let clinicId;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id });
      if (!clinic) {
        return res.status(400).json({
          success: false,
          message: "Clinic not found for this user",
        });
      }
      clinicId = clinic._id;
    } else if (
      me.role === "agent" ||
      me.role === "doctor" ||
      me.role === "doctorStaff"
    ) {
      if (!me.clinicId) {
        return res.status(400).json({
          success: false,
          message: `${me.role} not tied to a clinic`,
        });
      }
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      clinicId = req.body.clinicId;
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required for admin in request body",
        });
      }
    }

    // Check if item exists
    const existingItem = await CustomStockItem.findOne({
      _id: id,
      clinicId,
    });

    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: "Custom stock item not found",
      });
    }

    // Validate numeric fields
    const numericFields = [
      "quantity",
      "unitPrice",
      "totalPrice",
      "discount",
      "discountAmount",
      "netPrice",
      "vatAmount",
      "vatPercentage",
      "netPlusVat",
      "freeQuantity",
      "level0.price",
      "packagingStructure.level1.quantity",
      "packagingStructure.level1.price",
      "packagingStructure.level2.quantity",
      "packagingStructure.level2.price",
    ];

    for (const field of numericFields) {
      const value = getNestedValue(req.body, field);
      if (
        value !== undefined &&
        value !== null &&
        value !== "" &&
        typeof value !== "number"
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a number`,
        });
      }
      if (value !== undefined && value !== null && value !== "" && value < 0) {
        return res.status(400).json({
          success: false,
          message: `${field} cannot be negative`,
        });
      }
    }

    // Validate discount type
    if (
      req.body.discountType &&
      !["Fixed", "Percentage"].includes(req.body.discountType)
    ) {
      return res.status(400).json({
        success: false,
        message: "discountType must be one of: Fixed, Percentage",
      });
    }

    // Validate vat type
    if (
      req.body.vatType &&
      !["Exclusive", "Inclusive"].includes(req.body.vatType)
    ) {
      return res.status(400).json({
        success: false,
        message: "vatType must be one of: Exclusive, Inclusive",
      });
    }

    // Prepare update data
    const updateData = {
      status: "New",
      ...(req.body.name && { name: req.body.name.trim() }),
      ...(req.body.description !== undefined && {
        description: req.body.description?.trim() || "",
      }),
      ...(req.body.code !== undefined && { code: req.body.code?.trim() || "" }),
      ...(req.body.expiryDate !== undefined && {
        expiryDate: req.body.expiryDate || null,
      }),
      ...(req.body.quantity !== undefined && { quantity: req.body.quantity }),
      ...(req.body.uom !== undefined && { uom: req.body.uom?.trim() || "" }),
      ...(req.body.unitPrice !== undefined && {
        unitPrice: req.body.unitPrice,
      }),
      ...(req.body.totalPrice !== undefined && {
        totalPrice: req.body.totalPrice,
      }),
      ...(req.body.discount !== undefined && {
        discount: req.body.discount || 0,
      }),
      ...(req.body.discountType !== undefined && {
        discountType: req.body.discountType || "Fixed",
      }),
      ...(req.body.discountAmount !== undefined && {
        discountAmount: req.body.discountAmount || 0,
      }),
      ...(req.body.netPrice !== undefined && { netPrice: req.body.netPrice }),
      ...(req.body.vatAmount !== undefined && {
        vatAmount: req.body.vatAmount || 0,
      }),
      ...(req.body.vatType !== undefined && {
        vatType: req.body.vatType || "Exclusive",
      }),
      ...(req.body.vatPercentage !== undefined && {
        vatPercentage: req.body.vatPercentage || 0,
      }),
      ...(req.body.netPlusVat !== undefined && {
        netPlusVat: req.body.netPlusVat || 0,
      }),
      ...(req.body.freeQuantity !== undefined && {
        freeQuantity: req.body.freeQuantity || 0,
      }),
      ...(req.body.freeQuantityExpiryDate !== undefined && {
        freeQuantityExpiryDate: req.body.freeQuantityExpiryDate || null,
      }),
    };

    // Handle nested objects
    if (req.body.level0) {
      updateData.level0 = {
        price:
          req.body.level0.price !== undefined
            ? req.body.level0.price
            : existingItem.level0?.price,
        uom:
          req.body.level0.uom !== undefined
            ? req.body.level0.uom?.trim() || ""
            : existingItem.level0?.uom,
      };
    }

    if (req.body.packagingStructure) {
      updateData.packagingStructure = {
        level1: {
          quantity:
            req.body.packagingStructure.level1?.quantity !== undefined
              ? req.body.packagingStructure.level1.quantity
              : existingItem.packagingStructure?.level1?.quantity,
          price:
            req.body.packagingStructure.level1?.price !== undefined
              ? req.body.packagingStructure.level1.price
              : existingItem.packagingStructure?.level1?.price,
          uom:
            req.body.packagingStructure.level1?.uom !== undefined
              ? req.body.packagingStructure.level1.uom?.trim() || ""
              : existingItem.packagingStructure?.level1?.uom,
        },
        level2: {
          quantity:
            req.body.packagingStructure.level2?.quantity !== undefined
              ? req.body.packagingStructure.level2.quantity
              : existingItem.packagingStructure?.level2?.quantity,
          price:
            req.body.packagingStructure.level2?.price !== undefined
              ? req.body.packagingStructure.level2.price
              : existingItem.packagingStructure?.level2?.price,
          uom:
            req.body.packagingStructure.level2?.uom !== undefined
              ? req.body.packagingStructure.level2.uom?.trim() || ""
              : existingItem.packagingStructure?.level2?.uom,
        },
      };
    }

    // Update the item
    const updatedItem = await CustomStockItem.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      message: "Custom stock item updated successfully",
      data: updatedItem,
    });
  } catch (error) {
    console.error("Error updating custom stock item: ", error);

    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    return res.status(500).json({
      success: false,
      message: error?.message || "Internal Server Error",
    });
  }
}

// Helper function to get nested values
function getNestedValue(obj, path) {
  return path.split(".").reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

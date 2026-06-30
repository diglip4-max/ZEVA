import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import CustomStockItem from "../../../../models/stocks/CustomStockItem";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  res.setHeader("Allow", ["POST"]);

  if (req.method !== "POST") {
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

    // Validate required fields
    const requiredFields = [
      "name",
      "quantity",
      "unitPrice",
      "totalPrice",
      "netPrice",
    ];

    for (const field of requiredFields) {
      if (
        req.body[field] === undefined ||
        req.body[field] === null ||
        req.body[field] === ""
      ) {
        return res.status(400).json({
          success: false,
          message: `${field} is required`,
        });
      }
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

    // Prepare custom stock item data
    const customStockItemData = {
      clinicId,
      name: req.body.name.trim(),
      description: req.body.description?.trim() || "",
      code: req.body.code?.trim() || "",
      expiryDate: req.body.expiryDate || null,
      quantity: req.body.quantity,
      uom: req.body.uom?.trim() || "",
      unitPrice: req.body.unitPrice,
      totalPrice: req.body.totalPrice,
      discount: req.body.discount || 0,
      discountType: req.body.discountType || "Fixed",
      discountAmount: req.body.discountAmount || 0,
      netPrice: req.body.netPrice,
      vatAmount: req.body.vatAmount || 0,
      vatType: req.body.vatType || "Exclusive",
      vatPercentage: req.body.vatPercentage || 0,
      netPlusVat: req.body.netPlusVat || 0,
      freeQuantity: req.body.freeQuantity || 0,
      freeQuantityExpiryDate: req.body.freeQuantityExpiryDate || null,
      level0: {
        price: req.body.level0?.price || 0,
        uom: req.body.level0?.uom?.trim() || "",
      },
      packagingStructure: {
        level1: {
          quantity: req.body.packagingStructure?.level1?.quantity || 1,
          price: req.body.packagingStructure?.level1?.price || 0,
          uom: req.body.packagingStructure?.level1?.uom?.trim() || "",
        },
        level2: {
          quantity: req.body.packagingStructure?.level2?.quantity || 1,
          price: req.body.packagingStructure?.level2?.price || 0,
          uom: req.body.packagingStructure?.level2?.uom?.trim() || "",
        },
      },
      createdBy: me._id,
    };

    // Create new custom stock item
    const newCustomStockItem =
      await CustomStockItem.create(customStockItemData);

    res.status(201).json({
      success: true,
      message: "Custom stock item created successfully",
      data: newCustomStockItem,
    });
  } catch (error) {
    console.error("Error creating custom stock item: ", error);

    // Handle mongoose validation errors
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

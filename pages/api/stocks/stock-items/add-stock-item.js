import dbConnect from "@/lib/database";
import StockItem from "@/models/stocks/StockItem";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);

  if (!session) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const { method } = req;
  const { clinicId } = req.query;

  if (!clinicId) {
    return res.status(400).json({ message: "Clinic ID is required" });
  }

  await dbConnect();

  switch (method) {
    case "POST":
      try {
        const stockItemData = req.body;

        // Validate required fields
        if (!stockItemData.name) {
          return res.status(400).json({ message: "Item name is required" });
        }

        if (!stockItemData.location) {
          return res.status(400).json({ message: "Location is required" });
        }

        // Check if item with same code already exists
        if (stockItemData.code) {
          const existingItem = await StockItem.findOne({
            clinicId,
            code: stockItemData.code,
          });
          if (existingItem) {
            return res.status(400).json({
              message: "Item with this code already exists",
              field: "code",
            });
          }
        }

        // Check if item with same name already exists
        const existingItemByName = await StockItem.findOne({
          clinicId,
          name: stockItemData.name,
        });
        if (existingItemByName) {
          return res.status(400).json({
            message: "Item with this name already exists",
            field: "name",
          });
        }

        // Validate VAT percentage
        if (
          stockItemData.vatPercentage < 0 ||
          stockItemData.vatPercentage > 100
        ) {
          return res.status(400).json({
            message: "VAT percentage must be between 0 and 100",
            field: "vatPercentage",
          });
        }

        // Validate quantities
        if (stockItemData.minQuantity < 0) {
          return res.status(400).json({
            message: "Minimum quantity cannot be negative",
            field: "minQuantity",
          });
        }

        if (stockItemData.maxQuantity < 0) {
          return res.status(400).json({
            message: "Maximum quantity cannot be negative",
            field: "maxQuantity",
          });
        }

        if (stockItemData.minQuantity > stockItemData.maxQuantity) {
          return res.status(400).json({
            message: "Minimum quantity cannot be greater than maximum quantity",
            field: "minQuantity",
          });
        }

        // Validate level0 data
        if (stockItemData.level0) {
          if (stockItemData.level0.quantity < 0) {
            return res.status(400).json({
              message: "Level 0 quantity cannot be negative",
              field: "level0.quantity",
            });
          }
          if (stockItemData.level0.costPrice < 0) {
            return res.status(400).json({
              message: "Level 0 cost price cannot be negative",
              field: "level0.costPrice",
            });
          }
          if (stockItemData.level0.salePrice < 0) {
            return res.status(400).json({
              message: "Level 0 sale price cannot be negative",
              field: "level0.salePrice",
            });
          }
        }

        // Create new stock item
        const newStockItem = new StockItem({
          ...stockItemData,
          clinicId,
          createdBy: session.user.id,
          status: stockItemData.status || "Active", // Default to Active if not provided
        });

        const savedItem = await newStockItem.save();

        // Populate references for response
        const populatedItem = await StockItem.findById(savedItem._id)
          .populate("location", "name code")
          .populate("createdBy", "name email");

        res.status(201).json({
          success: true,
          message: "Stock item created successfully",
          data: populatedItem,
        });
      } catch (error) {
        console.error("Error creating stock item:", error);
        if (error.code === 11000) {
          const field = Object.keys(error.keyPattern)[0];
          res.status(400).json({
            message: `Item with this ${field} already exists`,
            field: field,
          });
        } else {
          res.status(500).json({
            message: "Error creating stock item",
            error: error.message,
          });
        }
      }
      break;

    default:
      res.status(405).json({ message: "Method not allowed" });
      break;
  }
}

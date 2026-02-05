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
  const { id, clinicId } = req.query;

  if (!clinicId) {
    return res.status(400).json({ message: "Clinic ID is required" });
  }

  if (!id) {
    return res.status(400).json({ message: "Item ID is required" });
  }

  await dbConnect();

  switch (method) {
    case "GET":
      try {
        const stockItem = await StockItem.findOne({ _id: id, clinicId })
          .populate("location", "name code")
          .populate("createdBy", "name email");

        if (!stockItem) {
          return res.status(404).json({ message: "Stock item not found" });
        }

        res.status(200).json({
          success: true,
          data: stockItem,
        });
      } catch (error) {
        console.error("Error fetching stock item:", error);
        res
          .status(500)
          .json({ message: "Error fetching stock item", error: error.message });
      }
      break;

    case "PUT":
      try {
        const updateData = req.body;

        // Remove fields that shouldn't be updated
        delete updateData._id;
        delete updateData.clinicId;
        delete updateData.createdBy;
        delete updateData.createdAt;

        // Validate VAT percentage if provided
        if (
          updateData.vatPercentage !== undefined &&
          (updateData.vatPercentage < 0 || updateData.vatPercentage > 100)
        ) {
          return res.status(400).json({
            message: "VAT percentage must be between 0 and 100",
            field: "vatPercentage",
          });
        }

        // Validate quantities if provided
        if (
          updateData.minQuantity !== undefined &&
          updateData.minQuantity < 0
        ) {
          return res.status(400).json({
            message: "Minimum quantity cannot be negative",
            field: "minQuantity",
          });
        }

        if (
          updateData.maxQuantity !== undefined &&
          updateData.maxQuantity < 0
        ) {
          return res.status(400).json({
            message: "Maximum quantity cannot be negative",
            field: "maxQuantity",
          });
        }

        if (
          updateData.minQuantity !== undefined &&
          updateData.maxQuantity !== undefined &&
          updateData.minQuantity > updateData.maxQuantity
        ) {
          return res.status(400).json({
            message: "Minimum quantity cannot be greater than maximum quantity",
            field: "minQuantity",
          });
        }

        // Validate level0 data if provided
        if (updateData.level0) {
          if (
            updateData.level0.quantity !== undefined &&
            updateData.level0.quantity < 0
          ) {
            return res.status(400).json({
              message: "Level 0 quantity cannot be negative",
              field: "level0.quantity",
            });
          }
          if (
            updateData.level0.costPrice !== undefined &&
            updateData.level0.costPrice < 0
          ) {
            return res.status(400).json({
              message: "Level 0 cost price cannot be negative",
              field: "level0.costPrice",
            });
          }
          if (
            updateData.level0.salePrice !== undefined &&
            updateData.level0.salePrice < 0
          ) {
            return res.status(400).json({
              message: "Level 0 sale price cannot be negative",
              field: "level0.salePrice",
            });
          }
        }

        // Check if updating name and it already exists
        if (updateData.name) {
          const existingItem = await StockItem.findOne({
            clinicId,
            name: updateData.name,
            _id: { $ne: id },
          });
          if (existingItem) {
            return res.status(400).json({
              message: "Item with this name already exists",
              field: "name",
            });
          }
        }

        // Check if updating code and it already exists
        if (updateData.code) {
          const existingItem = await StockItem.findOne({
            clinicId,
            code: updateData.code,
            _id: { $ne: id },
          });
          if (existingItem) {
            return res.status(400).json({
              message: "Item with this code already exists",
              field: "code",
            });
          }
        }

        const updatedItem = await StockItem.findOneAndUpdate(
          { _id: id, clinicId },
          { ...updateData, updatedAt: new Date() },
          { new: true, runValidators: true }
        )
          .populate("location", "name code")
          .populate("createdBy", "name email");

        if (!updatedItem) {
          return res.status(404).json({ message: "Stock item not found" });
        }

        res.status(200).json({
          success: true,
          message: "Stock item updated successfully",
          data: updatedItem,
        });
      } catch (error) {
        console.error("Error updating stock item:", error);
        if (error.code === 11000) {
          const field = Object.keys(error.keyPattern)[0];
          res.status(400).json({
            message: `Item with this ${field} already exists`,
            field: field,
          });
        } else {
          res
            .status(500)
            .json({
              message: "Error updating stock item",
              error: error.message,
            });
        }
      }
      break;

    case "DELETE":
      try {
        const deletedItem = await StockItem.findOneAndDelete({
          _id: id,
          clinicId,
        });

        if (!deletedItem) {
          return res.status(404).json({ message: "Stock item not found" });
        }

        res.status(200).json({
          success: true,
          message: "Stock item deleted successfully",
          data: deletedItem,
        });
      } catch (error) {
        console.error("Error deleting stock item:", error);
        res
          .status(500)
          .json({ message: "Error deleting stock item", error: error.message });
      }
      break;

    default:
      res.status(405).json({ message: "Method not allowed" });
      break;
  }
}

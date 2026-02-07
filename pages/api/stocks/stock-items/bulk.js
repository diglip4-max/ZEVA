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
        const { items, action } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
          return res.status(400).json({ message: "Items array is required" });
        }

        if (!action) {
          return res.status(400).json({ message: "Action is required" });
        }

        let result = {};

        switch (action) {
          case "delete":
            const deleteIds = items.map((item) => item._id || item.id);
            const deleteResult = await StockItem.deleteMany({
              _id: { $in: deleteIds },
              clinicId,
            });
            result = {
              deletedCount: deleteResult.deletedCount,
              message: `${deleteResult.deletedCount} items deleted successfully`,
            };
            break;

          case "updateStatus":
            const { status } = req.body;
            if (!status) {
              return res
                .status(400)
                .json({ message: "Status is required for status update" });
            }
            const updateIds = items.map((item) => item._id || item.id);
            const updateResult = await StockItem.updateMany(
              { _id: { $in: updateIds }, clinicId },
              { status, updatedAt: new Date() }
            );
            result = {
              modifiedCount: updateResult.modifiedCount,
              message: `${updateResult.modifiedCount} items updated successfully`,
            };
            break;

          case "import":
            const createdItems = [];
            const errors = [];

            for (let i = 0; i < items.length; i++) {
              const itemData = items[i];

              try {
                // Validate required fields
                if (!itemData.name) {
                  errors.push({ index: i, message: "Item name is required" });
                  continue;
                }

                if (!itemData.location) {
                  errors.push({ index: i, message: "Location is required" });
                  continue;
                }

                // Check for duplicates
                const existingItem = await StockItem.findOne({
                  clinicId,
                  $or: [{ name: itemData.name }, { code: itemData.code }],
                });

                if (existingItem) {
                  errors.push({
                    index: i,
                    message: `Item with name "${itemData.name}" or code "${itemData.code}" already exists`,
                  });
                  continue;
                }

                // Create item
                const newItem = new StockItem({
                  ...itemData,
                  clinicId,
                  createdBy: session.user.id,
                  status: itemData.status || "Active",
                });

                const savedItem = await newItem.save();
                createdItems.push(savedItem);
              } catch (error) {
                errors.push({ index: i, message: error.message });
              }
            }

            result = {
              createdCount: createdItems.length,
              errorCount: errors.length,
              createdItems,
              errors,
              message: `${createdItems.length} items imported successfully, ${errors.length} errors`,
            };
            break;

          default:
            return res.status(400).json({ message: "Invalid action" });
        }

        res.status(200).json({
          success: true,
          ...result,
        });
      } catch (error) {
        console.error("Error in bulk operation:", error);
        res
          .status(500)
          .json({ message: "Error in bulk operation", error: error.message });
      }
      break;

    default:
      res.status(405).json({ message: "Method not allowed" });
      break;
  }
}

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
    case "GET":
      try {
        const {
          page = 1,
          limit = 10,
          search = "",
          status = "",
          type = "",
          sortBy = "name",
          sortOrder = "asc",
        } = req.query;

        // Build filter object
        let filter = { clinicId };

        if (search) {
          filter.$or = [
            { name: { $regex: search, $options: "i" } },
            { code: { $regex: search, $options: "i" } },
            { brand: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
          ];
        }

        if (status) {
          filter.status = status;
        }

        if (type) {
          filter.type = type;
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const stockItems = await StockItem.find(filter)
          .sort(sort)
          .skip(skip)
          .limit(parseInt(limit))
          .populate("location", "name")
          .populate("createdBy", "name email");

        const total = await StockItem.countDocuments(filter);

        res.status(200).json({
          success: true,
          data: stockItems,
          pagination: {
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            totalItems: total,
            itemsPerPage: parseInt(limit),
          },
        });
      } catch (error) {
        console.error("Error fetching stock items:", error);
        res
          .status(500)
          .json({
            message: "Error fetching stock items",
            error: error.message,
          });
      }
      break;

    case "POST":
      try {
        const stockItemData = req.body;

        // Validate required fields
        if (!stockItemData.name) {
          return res.status(400).json({ message: "Item name is required" });
        }

        // Check if item with same code already exists
        if (stockItemData.code) {
          const existingItem = await StockItem.findOne({
            clinicId,
            code: stockItemData.code,
          });
          if (existingItem) {
            return res
              .status(400)
              .json({ message: "Item with this code already exists" });
          }
        }

        // Check if item with same name already exists
        const existingItemByName = await StockItem.findOne({
          clinicId,
          name: stockItemData.name,
        });
        if (existingItemByName) {
          return res
            .status(400)
            .json({ message: "Item with this name already exists" });
        }

        const newStockItem = new StockItem({
          ...stockItemData,
          clinicId,
          createdBy: session.user.id,
        });

        const savedItem = await newStockItem.save();

        // Populate references for response
        const populatedItem = await StockItem.findById(savedItem._id)
          .populate("location", "name")
          .populate("createdBy", "name email");

        res.status(201).json({
          success: true,
          message: "Stock item created successfully",
          data: populatedItem,
        });
      } catch (error) {
        console.error("Error creating stock item:", error);
        if (error.code === 11000) {
          res
            .status(400)
            .json({ message: "Item with this code already exists" });
        } else {
          res
            .status(500)
            .json({
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

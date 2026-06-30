import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import User from "../../../../models/Users";
import PatientRegistration from "../../../../models/PatientRegistration";
import PaymentMethod from "../../../../models/PaymentMethod";
import ProductSale from "../../../../models/stocks/ProductSale";
import AllocatedStockItem from "../../../../models/stocks/AllocatedStockItem";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";
import {
  calculateTotalAmount,
  reduceQuantity,
} from "../../../../lib/stockUtils";

export default async function handler(req, res) {
  await dbConnect();

  res.setHeader("Allow", ["GET", "POST"]);

  if (req.method === "GET") {
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
            message: "User not tied to a clinic",
          });
        }
        clinicId = me.clinicId;
      } else if (me.role === "admin") {
        clinicId = req.query.clinicId;
        if (!clinicId) {
          return res.status(400).json({
            success: false,
            message: "clinicId is required for admin in query parameters",
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      // Pagination parameters
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;

      // Search and filter parameters
      const search = req.query.search
        ? req.query.search.trim().toLowerCase()
        : null;
      const status = req.query.status;
      const paymentStatus = req.query.paymentStatus;
      const patientId = req.query.patientId;
      const paymentMethodId = req.query.paymentMethodId;
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      const userId = req.query.userId;

      // Sort parameters
      const sortBy = req.query.sortBy || "createdAt";
      const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;

      const allowedSortFields = [
        "createdAt",
        "updatedAt",
        "totalPrice",
        "status",
        "paymentStatus",
      ];
      const finalSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";

      // Build query - ensure clinicId is string
      const clinicIdStr = String(clinicId);
      let query = { clinicId: clinicIdStr };

      if (search) {
        // First find patient IDs that match search
        const matchingPatients = await PatientRegistration.find(
          { clinicId },
          { _id: 1 },
        ).or([
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ]);
        const patientIds = matchingPatients.map((p) => p._id);

        const orConditions = [
          { "items.name": { $regex: search, $options: "i" } },
          { "items.code": { $regex: search, $options: "i" } },
          { "items.notes": { $regex: search, $options: "i" } },
        ];

        if (patientIds.length > 0) {
          orConditions.push({ patientId: { $in: patientIds } });
        }

        query.$or = orConditions;
      }

      if (status) {
        query.status = status;
      }

      if (paymentStatus) {
        query.paymentStatus = paymentStatus;
      }

      if (patientId) {
        query.patientId = patientId;
      }

      if (paymentMethodId) {
        query.paymentMethodId = paymentMethodId;
      }

      if (userId) {
        query.soldBy = userId;
      }

      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) {
          query.createdAt.$gte = new Date(startDate);
        }
        if (endDate) {
          query.createdAt.$lte = new Date(endDate);
        }
      }

      // Execute queries
      const totalRecords = await ProductSale.countDocuments(query);
      const sales = await ProductSale.find(query)
        .populate(
          "patientId",
          "firstName lastName phone email age gender",
          PatientRegistration,
        )
        .populate("paymentMethodId", "name uniqueName status", PaymentMethod)
        .populate("soldBy", "name email", User)
        .sort({ [finalSortBy]: sortOrder })
        .skip(skip)
        .limit(limit)
        .lean();

      // Statistics - use the full query (including all filters)
      // Create a copy of query for aggregation, ensuring clinicId is string
      const aggQuery = { ...query };
      aggQuery.clinicId = clinicIdStr;

      const stats = await ProductSale.aggregate([
        { $match: aggQuery },
        {
          $group: {
            _id: null,
            totalSales: { $sum: 1 },
            totalValue: { $sum: "$totalPrice" },
            uniquePatients: { $addToSet: "$patientId" },
            uniquePaymentMethods: { $addToSet: "$paymentMethodId" },
            totalItemsSold: { $sum: { $sum: "$items.quantity" } },
          },
        },
        {
          $project: {
            totalSales: 1,
            totalValue: { $round: ["$totalValue", 2] },
            avgValuePerSale: {
              $round: [
                {
                  $cond: [
                    { $eq: ["$totalSales", 0] },
                    0,
                    { $divide: ["$totalValue", "$totalSales"] },
                  ],
                },
                2,
              ],
            },
            uniquePatientsCount: { $size: "$uniquePatients" },
            uniquePaymentMethodsCount: { $size: "$uniquePaymentMethods" },
            totalItemsSold: 1,
          },
        },
      ]);

      const totalPages = Math.ceil(totalRecords / limit);
      const hasMore = page < totalPages;

      // Distinct filters
      const distinctStatuses = await ProductSale.distinct("status", {
        clinicId: clinicIdStr,
      });
      const distinctPaymentStatuses = await ProductSale.distinct(
        "paymentStatus",
        { clinicId: clinicIdStr },
      );
      const distinctPaymentMethods = await ProductSale.distinct(
        "paymentMethodId",
        { clinicId: clinicIdStr },
      );

      // Get all users for filter dropdown
      const users = await User.find({
        $or: [
          { clinicId: clinicId },
          { _id: (await Clinic.findOne({ _id: clinicId }))?.owner },
        ],
      }).select("_id name email");

      // Chart data aggregations
      const topProductsAgg = await ProductSale.aggregate([
        { $match: aggQuery },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            totalQuantity: { $sum: "$items.quantity" },
            totalValue: { $sum: "$items.totalPrice" },
            code: { $first: "$items.code" },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
      ]);

      const topSellersAgg = await ProductSale.aggregate([
        { $match: aggQuery },
        {
          $group: {
            _id: "$soldBy",
            totalSales: { $sum: 1 },
            totalValue: { $sum: "$totalPrice" },
          },
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $unwind: "$user" },
        {
          $project: {
            _id: 0,
            userId: "$_id",
            name: "$user.name",
            email: "$user.email",
            totalSales: 1,
            totalValue: 1,
          },
        },
        { $sort: { totalValue: -1 } },
        { $limit: 10 },
      ]);

      const monthlySalesAgg = await ProductSale.aggregate([
        { $match: aggQuery },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
            },
            totalSales: { $sum: 1 },
            totalValue: { $sum: "$totalPrice" },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]);

      const monthlySales = monthlySalesAgg.map((item) => ({
        month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`,
        monthName: new Date(item._id.year, item._id.month - 1).toLocaleString(
          "default",
          { month: "short" },
        ),
        year: item._id.year,
        totalSales: item.totalSales,
        totalValue: item.totalValue,
      }));

      const topProducts = topProductsAgg.map((item) => ({
        name: item._id,
        code: item.code,
        totalQuantity: item.totalQuantity,
        totalValue: item.totalValue,
      }));

      const topSellers = topSellersAgg;

      console.log({ stats });

      return res.status(200).json({
        success: true,
        message: "Product sales fetched successfully",
        data: {
          sales,
          statistics: stats[0] || {
            totalSales: 0,
            totalValue: 0,
            avgValuePerSale: 0,
            uniquePatientsCount: 0,
            uniquePaymentMethodsCount: 0,
            totalItemsSold: 0,
          },
          filters: {
            statuses: distinctStatuses.filter((s) => s),
            paymentStatuses: distinctPaymentStatuses.filter((s) => s),
            paymentMethods: distinctPaymentMethods.filter((p) => p),
            users: users,
          },
          charts: {
            topProducts,
            topSellers,
            monthlySales,
          },
          pagination: {
            totalResults: totalRecords,
            totalPages,
            currentPage: page,
            limit,
            hasMore,
            nextPage: hasMore ? page + 1 : null,
            prevPage: page > 1 ? page - 1 : null,
          },
          queryInfo: {
            search,
            status,
            paymentStatus,
            patientId,
            paymentMethodId,
            userId,
            startDate,
            endDate,
            sortBy: finalSortBy,
            sortOrder: sortOrder === 1 ? "asc" : "desc",
          },
        },
      });
    } catch (err) {
      console.error("Error in fetch product sales:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  } else if (req.method === "POST") {
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
          message:
            "Access denied. Only clinic, agent, admin, doctor or doctorStaff can create product sale.",
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
            message: "User not tied to a clinic",
          });
        }
        clinicId = me.clinicId;
      } else if (me.role === "admin") {
        clinicId = req.body.clinicId;
        if (!clinicId) {
          return res.status(400).json({
            success: false,
            message: "clinicId is required in request body for admin",
          });
        }
      } else {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }
      const clinicIdStr = String(clinicId);

      // Validate required fields
      const {
        patientId,
        paymentMethodId,
        items,
        status = "pending",
        paymentStatus = "pending",
      } = req.body;

      if (!patientId) {
        return res.status(400).json({
          success: false,
          message: "Patient is required",
        });
      }

      if (!paymentMethodId) {
        return res.status(400).json({
          success: false,
          message: "Payment method is required",
        });
      }

      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one item is required",
        });
      }

      // Validate patient exists
      const patient = await PatientRegistration.findOne({
        _id: patientId,
        clinicId,
      });

      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found or doesn't belong to this clinic",
        });
      }

      // Validate payment method exists
      const paymentMethod = await PaymentMethod.findOne({
        _id: paymentMethodId,
        clinicId,
        status: "active",
      });

      console.log({ paymentMethod, paymentMethodId });

      if (!paymentMethod) {
        return res.status(404).json({
          success: false,
          message: "Payment method not found or inactive",
        });
      }

      // Validate and normalize items
      const normalizedItems = [];
      let totalPrice = 0;

      // Process each item to calculate totals and validate stock
      if (items && items.length > 0) {
        for (let i = 0; i < items.length; i++) {
          const it = items[i] || {};
          const { allocatedItemId, uom, quantity } = it;

          if (!allocatedItemId) {
            return res.status(400).json({
              success: false,
              message: `Item ${i + 1}: allocatedItemId is required`,
            });
          }

          // Check if allocated item exists
          const allocatedItem = await AllocatedStockItem.findOne({
            _id: allocatedItemId,
            clinicId,
            status: { $in: ["Allocated", "Issued", "Partially_Used"] },
          });

          if (!allocatedItem) {
            return res.status(404).json({
              success: false,
              message: `Item ${i + 1}: Allocated stock item not found for itemId: ${allocatedItemId}`,
            });
          }

          // Validate required fields
          if (!it.name || !it.name.trim()) {
            return res.status(400).json({
              success: false,
              message: `Item ${i + 1}: name is required`,
            });
          }

          if (!it.code || !it.code.trim()) {
            return res.status(400).json({
              success: false,
              message: `Item ${i + 1}: code is required`,
            });
          }

          if (!it.description || !it.description.trim()) {
            return res.status(400).json({
              success: false,
              message: `Item ${i + 1}: description is required`,
            });
          }

          const qty = Number(quantity || 0);
          if (qty <= 0) {
            return res.status(400).json({
              success: false,
              message: `Item ${i + 1}: quantity must be greater than 0`,
            });
          }

          if (!uom) {
            return res.status(400).json({
              success: false,
              message: `Item ${i + 1}: uom is required`,
            });
          }

          // Use stockUtils to reduce quantity
          const updatedQtyByUom = await reduceQuantity(
            allocatedItem.quantitiesByUom,
            uom,
            qty,
            allocatedItem?.item?.level0,
            allocatedItem?.item?.packagingStructure,
          );

          // Calculate total amount for this item
          const itemTotalAmount = await calculateTotalAmount(
            allocatedItemId,
            uom,
            qty,
          );

          // Update allocated item in DB
          let status = "Partially_Used";
          const checkFullyUsed = updatedQtyByUom.every(
            (qtyItem) => qtyItem.quantity === 0,
          );
          if (checkFullyUsed) {
            status = "Used";
          }
          await AllocatedStockItem.findByIdAndUpdate(
            allocatedItemId,
            {
              quantitiesByUom: updatedQtyByUom,
              status: status,
            },
            { new: true },
          );

          // Add item to normalized items
          normalizedItems.push({
            allocatedItemId: allocatedItemId,
            name: it.name.trim(),
            code: it.code.trim(),
            description: it.description.trim(),
            quantity: qty,
            uom: uom,
            unitPrice: await calculateTotalAmount(allocatedItemId, uom, 1), // Unit price for 1 unit
            totalPrice: itemTotalAmount,
            currency: it.currency || "AED",
            notes: it.notes ? it.notes.trim() : "",
          });

          totalPrice += itemTotalAmount;
        }
      }

      // Validate status and payment status
      const validStatuses = [
        "pending",
        "completed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }

      const validPaymentStatuses = [
        "pending",
        "paid",
        "failed",
        "partially_refunded",
        "refunded",
      ];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return res.status(400).json({
          success: false,
          message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(", ")}`,
        });
      }

      // Create product sale
      const productSaleData = {
        clinicId: clinicIdStr,
        patientId,
        paymentMethodId,
        paymentMethodName: paymentMethod.name,
        items: normalizedItems,
        totalPrice: parseFloat(totalPrice.toFixed(2)),
        status,
        paymentStatus,
        invoiceDate: new Date(),
        soldBy: me._id || "",
      };

      const newProductSale = new ProductSale(productSaleData);
      const savedProductSale = await newProductSale.save();

      // Populate and return
      const populatedSale = await ProductSale.findById(savedProductSale._id)
        .populate(
          "patientId",
          "firstName lastName phone email age gender",
          PatientRegistration,
        )
        .populate("paymentMethodId", "name uniqueName status", PaymentMethod)
        .lean();

      return res.status(201).json({
        success: true,
        message: "Product sale created successfully",
        data: populatedSale,
      });
    } catch (err) {
      console.error("Error in create product sale:", err);

      if (err.name === "ValidationError") {
        const errors = Object.values(err.errors).map((error) => error.message);
        return res.status(400).json({
          success: false,
          message: "Validation error",
          errors,
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  } else {
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }
}

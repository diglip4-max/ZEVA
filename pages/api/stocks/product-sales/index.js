import dbConnect from "../../../../lib/database";
import mongoose from "mongoose";
import Clinic from "../../../../models/Clinic";
import User from "../../../../models/Users";
import PatientRegistration from "../../../../models/PatientRegistration";
import PaymentMethod from "../../../../models/PaymentMethod";
import ProductSale from "../../../../models/stocks/ProductSale";
import AllocatedStockItem from "../../../../models/stocks/AllocatedStockItem";
import Commission from "../../../../models/Commission";
import Billing from "../../../../models/Billing";
import PettyCash from "../../../../models/PettyCash";
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
            totalValue: { $sum: { $min: ["$totalPrice", "$totalPaidAmount"] } },
            totalCommission: { $sum: "$totalCommission" },
            uniquePatients: { $addToSet: "$patientId" },
            uniquePaymentMethods: { $addToSet: "$paymentMethodId" },
            totalItemsSold: { $sum: { $sum: "$items.quantity" } },
          },
        },
        {
          $project: {
            totalSales: 1,
            totalValue: { $round: ["$totalValue", 2] },
            totalCommission: { $round: ["$totalCommission", 2] },
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
            totalCommission: { $sum: "$items.commission" },
            code: { $first: "$items.code" },
          },
        },
        { $sort: { totalQuantity: -1 } },
        { $limit: 10 },
      ]);

      const topProductsByCommissionAgg = await ProductSale.aggregate([
        { $match: aggQuery },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            totalCommission: { $sum: "$items.commission" },
            code: { $first: "$items.code" },
          },
        },
        { $sort: { totalCommission: -1 } },
        { $limit: 10 },
      ]);

      const topSellersAgg = await ProductSale.aggregate([
        { $match: aggQuery },
        {
          $group: {
            _id: "$soldBy",
            totalSales: { $sum: 1 },
            totalValue: { $sum: { $min: ["$totalPrice", "$totalPaidAmount"] } },
            totalCommission: { $sum: "$totalCommission" },
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
            totalCommission: 1,
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
            totalValue: { $sum: { $min: ["$totalPrice", "$totalPaidAmount"] } },
            totalCommission: { $sum: "$totalCommission" },
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
        totalCommission: item.totalCommission,
      }));

      const topProducts = topProductsAgg.map((item) => ({
        name: item._id,
        code: item.code,
        totalQuantity: item.totalQuantity,
        totalValue: item.totalValue,
        totalCommission: item.totalCommission,
      }));

      const topProductsByCommission = topProductsByCommissionAgg.map(
        (item) => ({
          name: item._id,
          code: item.code,
          totalCommission: item.totalCommission,
        }),
      );

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
            topProductsByCommission,
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
        paidAmount,
        advanceUsed,
        claimAmountUsed,
        pendingUsed,
        multiplePayments,
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

      // Start MongoDB transaction
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Validate and normalize items
        const normalizedItems = [];
        let totalPrice = 0;
        let totalCommission = 0;

        // Process each item to calculate totals and validate stock
        if (items && items.length > 0) {
          for (let i = 0; i < items.length; i++) {
            const it = items[i] || {};
            const {
              allocatedItemId,
              uom,
              quantity,
              unitPrice,
              totalPrice: itemTotalPrice,
              commission,
            } = it;

            if (!allocatedItemId) {
              await session.abortTransaction();
              session.endSession();
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
            }).session(session);

            if (!allocatedItem) {
              await session.abortTransaction();
              session.endSession();
              return res.status(404).json({
                success: false,
                message: `Item ${i + 1}: Allocated stock item not found for itemId: ${allocatedItemId}`,
              });
            }

            // Validate required fields
            if (!it.name || !it.name.trim()) {
              await session.abortTransaction();
              session.endSession();
              return res.status(400).json({
                success: false,
                message: `Item ${i + 1}: name is required`,
              });
            }

            if (!it.code || !it.code.trim()) {
              await session.abortTransaction();
              session.endSession();
              return res.status(400).json({
                success: false,
                message: `Item ${i + 1}: code is required`,
              });
            }

            if (!it.description || !it.description.trim()) {
              await session.abortTransaction();
              session.endSession();
              return res.status(400).json({
                success: false,
                message: `Item ${i + 1}: description is required`,
              });
            }

            const qty = Number(quantity || 0);
            if (qty <= 0) {
              await session.abortTransaction();
              session.endSession();
              return res.status(400).json({
                success: false,
                message: `Item ${i + 1}: quantity must be greater than 0`,
              });
            }

            if (!uom) {
              await session.abortTransaction();
              session.endSession();
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

            // Calculate total amount for this item if not provided
            const finalUnitPrice =
              unitPrice ||
              (await calculateTotalAmount(allocatedItemId, uom, 1));
            const finalItemTotal = itemTotalPrice || finalUnitPrice * qty;
            const finalCommission = commission || 0;

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
              { new: true, session },
            );

            // Add item to normalized items
            normalizedItems.push({
              allocatedItemId: allocatedItemId,
              name: it.name.trim(),
              code: it.code.trim(),
              description: it.description.trim(),
              quantity: qty,
              uom: uom,
              unitPrice: finalUnitPrice,
              totalPrice: finalItemTotal,
              currency: it.currency || "AED",
              notes: it.notes ? it.notes.trim() : "",
              commission: finalCommission,
            });

            totalPrice += finalItemTotal;
            totalCommission += finalCommission;
          }
        }

        console.log({ totalCommission });

        // Validate status and payment status
        const validStatuses = [
          "pending",
          "completed",
          "cancelled",
          "refunded",
          "partially_refunded",
        ];
        if (!validStatuses.includes(status)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          });
        }

        const validPaymentStatuses = [
          "pending",
          "paid",
          "partially_paid",
          "failed",
          "partially_refunded",
          "refunded",
        ];
        if (!validPaymentStatuses.includes(paymentStatus)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            success: false,
            message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(", ")}`,
          });
        }

        // Calculate payment details - NEW LOGIC
        // First, get the patient's current balances
        const patientBillings = await Billing.find({
          patientId,
          clinicId: clinicIdStr,
          isAdvanceOnly: { $ne: true },
        })
          .select("pending advance advanceUsed")
          .lean();

        let currentPendingBalance = 0;
        let currentAdvanceBalance = 0;

        for (const b of patientBillings) {
          currentPendingBalance += Number(b.pending || 0);
          currentAdvanceBalance +=
            Number(b.advance || 0) - Number(b.advanceUsed || 0);
        }

        // The total we need to account for: current sale + previous pending
        const totalObligation = totalPrice + (pendingUsed || 0); // pendingUsed is previous pending

        // Calculate how much is being paid in this transaction
        const totalPaidNow =
          (paidAmount || 0) + (advanceUsed || 0) + (claimAmountUsed || 0);

        // Determine how to allocate the payment
        let remainingPayment = totalPaidNow;
        let newPendingAmount = 0;
        let newAdvanceAmount = 0;
        let pendingCleared = 0;

        // First cover the current product sale
        if (remainingPayment >= totalPrice) {
          // Current sale is fully paid
          remainingPayment -= totalPrice;
          // Now try to clear previous pending
          if (remainingPayment > 0 && (pendingUsed || 0) > 0) {
            const canClear = Math.min(remainingPayment, pendingUsed || 0);
            pendingCleared = canClear;
            remainingPayment -= canClear;
          }
          // If still remaining, add as advance
          if (remainingPayment > 0) {
            newAdvanceAmount = remainingPayment;
          }
        } else {
          // Not enough to cover current sale - add to pending
          newPendingAmount = totalPrice - remainingPayment;
        }
        // Create product sale
        const productSaleData = {
          clinicId: clinicIdStr,
          patientId,
          paymentMethodId,
          paymentMethodName: paymentMethod.name,
          items: normalizedItems,
          totalPrice: parseFloat(totalPrice.toFixed(2)),
          totalPaidAmount: parseFloat((totalPaidNow || 0).toFixed(2)),
          totalCommission: parseFloat(totalCommission.toFixed(2)),
          status,
          paymentStatus: newPendingAmount === 0 ? "paid" : "partially_paid",
          invoiceDate: new Date(),
          soldBy: me._id || "",
        };

        const newProductSale = new ProductSale(productSaleData);
        const savedProductSale = await newProductSale.save({ session });

        // Determine payment status for billing
        let actualPaymentStatus = "Unpaid";
        if (newPendingAmount === 0) {
          actualPaymentStatus = "Full";
        } else if (totalPaidNow > 0) {
          actualPaymentStatus = "Partial";
        }

        // Generate invoice number for billing
        const billingCount = await Billing.countDocuments({ clinicId });
        const billingInvoiceNumber = `PS-BILL-${Date.now()}-${billingCount + 1}`;

        // Prepare multiple payments for billing
        const billingMultiplePayments = [];
        if (paidAmount > 0) {
          billingMultiplePayments.push({
            paymentMethod: paymentMethod.name,
            amount: paidAmount,
            paidAt: new Date(),
            paidBy: me._id,
            transactionType: "PAYMENT",
          });
        }
        if (advanceUsed > 0) {
          billingMultiplePayments.push({
            paymentMethod: "Advance Balance",
            amount: advanceUsed,
            paidAt: new Date(),
            paidBy: me._id,
            transactionType: "ADVANCE_USAGE",
          });
        }
        if (claimAmountUsed > 0) {
          billingMultiplePayments.push({
            paymentMethod: "Insurance Claim",
            amount: claimAmountUsed,
            paidAt: new Date(),
            paidBy: me._id,
            transactionType: "CLAIM_USAGE",
          });
        }
        if (pendingCleared > 0) {
          billingMultiplePayments.push({
            paymentMethod: "Pending Clearance",
            amount: pendingCleared,
            paidAt: new Date(),
            paidBy: me._id,
            transactionType: "PENDING_CLEARANCE",
          });
        }

        // Create billing record
        const billingRecord = new Billing({
          clinicId: clinicIdStr,
          patientId,
          productSaleId: savedProductSale._id,
          invoiceNumber: billingInvoiceNumber,
          invoicedDate: new Date(),
          invoicedBy: me.name || me.email || "System",
          invoicedById: me._id,
          service: "Product",
          quantity: 1,
          amount: totalPrice,
          paid: paidAmount || 0,
          advanceUsed: advanceUsed || 0,
          claimAmountUsed: claimAmountUsed || 0,
          pending: newPendingAmount,
          pendingUsed: pendingCleared, // Amount of previous pending cleared in this sale
          advance: newAdvanceAmount, // Any extra payment added as advance
          paymentMethod: paymentMethod.name,
          paymentStatus: actualPaymentStatus,
          notes: `Product sale - ${actualPaymentStatus} payment. Total: ${totalPrice}, Cash/Card: ${paidAmount || 0}, Advance used: ${advanceUsed || 0}, Claim used: ${claimAmountUsed || 0}, Pending cleared: ${pendingCleared || 0}, New advance: ${newAdvanceAmount || 0}`,
          multiplePayments: billingMultiplePayments,
          paymentHistory: [
            {
              amount: totalPrice,
              paid:
                (paidAmount || 0) +
                (advanceUsed || 0) +
                (claimAmountUsed || 0) +
                pendingCleared,
              pending: newPendingAmount,
              paymentMethod: paymentMethod.name,
              status: actualPaymentStatus === "Full" ? "Completed" : "Active",
              updatedAt: new Date(),
              transactionType:
                actualPaymentStatus === "Full"
                  ? "FULL_PAYMENT"
                  : "PARTIAL_PAYMENT",
              amountPaid: paidAmount || 0,
              advanceAmountUsed: advanceUsed || 0,
              paidBy: me._id,
              paidByName: me.name || me.email || "System",
              remainingPending: newPendingAmount,
              multiplePayments: billingMultiplePayments,
            },
          ],
        });

        const savedBilling = await billingRecord.save({ session });
        console.log({ savedBilling });

        // If we cleared pending, update the previous billing records to clear it
        if (pendingCleared > 0) {
          try {
            // Get all billing records with pending > 0, sorted oldest first
            const pendingBillings = await Billing.find({
              patientId,
              clinicId: clinicIdStr,
              pending: { $gt: 0 },
              _id: { $ne: savedBilling._id }, // Exclude the one we just created
            })
              .sort({ createdAt: 1 })
              .session(session);

            let remainingToClear = pendingCleared;

            for (const billing of pendingBillings) {
              if (remainingToClear <= 0) break;

              const canClearFromThis = Math.min(
                remainingToClear,
                billing.pending,
              );

              // Update this billing record
              billing.pending = Number(
                (billing.pending - canClearFromThis).toFixed(2),
              );
              billing.pendingUsed = Number(
                (billing.pendingUsed || 0) + canClearFromThis,
              );

              // Also update payment history
              if (!billing.paymentHistory) {
                billing.paymentHistory = [];
              }

              billing.paymentHistory.push({
                amount: billing.amount,
                paid: Number((billing.paid + canClearFromThis).toFixed(2)),
                pending: billing.pending,
                paymentMethod: paymentMethod.name,
                status: billing.pending === 0 ? "Completed" : "Partial",
                updatedAt: new Date(),
                transactionType: "PENDING_CLEARANCE",
                amountPaid: 0, // This was cleared from previous payment, not new cash
                advanceAmountUsed: 0,
                paidBy: me._id,
                paidByName: me.name || me.email || "System",
                remainingPending: billing.pending,
              });

              await billing.save({ session });

              // Also update the ledger entry if this billing has one
              try {
                const PatientPendingLedger = (
                  await import("../../../../models/PatientPendingLedger")
                ).default;
                const openLedgers = await PatientPendingLedger.find({
                  parentBillingId: billing._id,
                  status: { $in: ["Open", "Partial"] },
                }).session(session);

                let ledgerRemainingToClear = canClearFromThis;
                for (const ledger of openLedgers) {
                  if (ledgerRemainingToClear <= 0) break;

                  const canClearFromLedger = Math.min(
                    ledgerRemainingToClear,
                    Number(ledger.remainingAmount || 0),
                  );

                  if (canClearFromLedger > 0) {
                    const { applyClearance } =
                      await import("../../../../lib/pendingLedger");
                    await applyClearance({
                      allocations: [
                        {
                          ledgerId: ledger.ledgerId,
                          amount: canClearFromLedger,
                        },
                      ],
                      clearingBillingId: savedBilling._id,
                      clearingInvoiceNumber: billingInvoiceNumber,
                      paymentMethod: paymentMethod.name,
                      paidBy: me._id,
                      paidByName: me.name || me.email || "System",
                      transactionType: "PENDING_CLEARANCE",
                      useTransaction: true,
                      session,
                    });

                    ledgerRemainingToClear -= canClearFromLedger;
                  }
                }
              } catch (ledgerErr) {
                console.error(
                  "Failed to update ledger for pending clearance:",
                  ledgerErr,
                );
                // Continue even if ledger update fails
              }

              remainingToClear -= canClearFromThis;
            }
          } catch (clearErr) {
            console.error("Failed to clear pending balances:", clearErr);
            // Don't fail the whole transaction for this, just log it
          }
        }

        // Create ledger entry if pending amount > 0
        if (newPendingAmount > 0) {
          try {
            const { createLedgerEntry } =
              await import("../../../../lib/pendingLedger");
            await createLedgerEntry({
              clinicId,
              branchId: null,
              patientId,
              parentBillingId: savedBilling._id,
              appointmentId: null,
              invoiceNumber: billingInvoiceNumber,
              service: "Product",
              treatmentSlug: null,
              treatmentName: null,
              packageId: null,
              packageName: null,
              serviceId: null,
              patientPackageId: null,
              patientPackageSubId: null,
              amount: newPendingAmount,
              createdBy: me._id,
            });
          } catch (ledgerErr) {
            console.error(
              "Failed to create ledger entry for product sale billing:",
              ledgerErr,
            );
            // Don't fail the whole transaction if ledger creation fails
          }
        }

        // Add to petty cash if paid amount > 0 and payment method is cash
        if (
          paidAmount > 0 &&
          paymentMethod.name.toLowerCase().includes("cash")
        ) {
          try {
            const pettyCashRecord = await PettyCash.create({
              clinicId,
              staffId: me._id,
              patientName:
                `${patient.firstName || ""} ${patient.lastName || ""}`.trim(),
              patientEmail: patient.email || "",
              patientPhone: patient.mobileNumber || "",
              note: `Auto-added from product sale - Invoice: ${billingInvoiceNumber}`,
              allocatedAmounts: [
                {
                  amount: paidAmount,
                  receipts: [],
                  date: new Date(),
                },
              ],
              expenses: [],
            });
            await PettyCash.updateGlobalTotalAmount(
              clinicId,
              paidAmount,
              "add",
            );
          } catch (pettyCashErr) {
            console.error(
              "Error adding product sale to petty cash:",
              pettyCashErr,
            );
            // Don't fail the whole transaction if petty cash fails
          }
        }

        // Create commission
        const commissionData = {
          clinicId: clinicIdStr,
          source: "product",
          staffId: me._id || null,
          productSaleId: savedProductSale._id,
          patientId,
          commissionType: "flat",
          commissionPercent: 0,
          amountPaid: parseFloat((totalPaidNow || 0).toFixed(2)),
          commissionAmount: parseFloat(totalCommission.toFixed(2)),
          invoiceDate: new Date(),
          notes: "",
          createdBy: me._id || null,
          finalCommissionAmount: parseFloat(totalCommission.toFixed(2)),
          isSubmitted: true,
          isApproved: true,
          paymentMethod: paymentMethod.name,
        };

        const newCommission = new Commission(commissionData);
        const savedCommission = await newCommission.save({ session });

        savedProductSale.commissions = savedProductSale.commissions || [];
        savedProductSale.commissions.push(savedCommission._id);
        await savedProductSale.save({ session });

        // Commit transaction
        await session.commitTransaction();
        session.endSession();

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
      } catch (transactionErr) {
        await session.abortTransaction();
        session.endSession();
        throw transactionErr;
      }
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

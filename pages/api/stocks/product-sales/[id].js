import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
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

  const { id } = req.query;

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);

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

      // Find product sale - ensure clinicId is string
      const clinicIdStr = String(clinicId);
      const productSale = await ProductSale.findOne({
        _id: id,
        clinicId: clinicIdStr,
      })
        .populate(
          "patientId",
          "firstName lastName phone mobileNumber email age gender",
          PatientRegistration,
        )
        .populate("paymentMethodId", "name uniqueName status", PaymentMethod)
        .lean();

      if (!productSale) {
        return res.status(404).json({
          success: false,
          message: "Product sale not found",
        });
      }

      return res.status(200).json({
        success: true,
        message: "Product sale fetched successfully",
        data: productSale,
      });
    } catch (err) {
      console.error("Error in fetch product sale:", err);
      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  } else if (req.method === "PUT") {
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

      // Find existing product sale
      const existingSale = await ProductSale.findOne({
        _id: id,
        clinicId,
      });

      if (!existingSale) {
        return res.status(404).json({
          success: false,
          message: "Product sale not found",
        });
      }

      const { patientId, paymentMethodId, items, status, paymentStatus } =
        req.body;

      const updateData = {};

      if (patientId) {
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
        updateData.patientId = patientId;
      }

      if (paymentMethodId) {
        const paymentMethod = await PaymentMethod.findOne({
          _id: paymentMethodId,
          clinicId,
          status: "active",
        });
        if (!paymentMethod) {
          return res.status(404).json({
            success: false,
            message: "Payment method not found or inactive",
          });
        }
        updateData.paymentMethodId = paymentMethodId;
        updateData.paymentMethodName = paymentMethod.name;
      }

      // Validate status and payment status
      const validStatuses = [
        "pending",
        "completed",
        "cancelled",
        "refunded",
        "partially_refunded",
      ];
      if (status !== undefined) {
        if (!validStatuses.includes(status)) {
          return res.status(400).json({
            success: false,
            message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
          });
        }
        updateData.status = status;
      }

      const validPaymentStatuses = [
        "pending",
        "paid",
        "failed",
        "partially_refunded",
        "refunded",
      ];
      if (paymentStatus !== undefined) {
        if (!validPaymentStatuses.includes(paymentStatus)) {
          return res.status(400).json({
            success: false,
            message: `Invalid payment status. Must be one of: ${validPaymentStatuses.join(", ")}`,
          });
        }
        updateData.paymentStatus = paymentStatus;
      }

      if (items) {
        // If items are being updated, revert quantities first
        for (const item of existingSale.items) {
          const allocatedItem = await AllocatedStockItem.findById(
            item.allocatedItemId,
          );
          if (allocatedItem) {
            // Calculate the revert: add back the quantity using negative targetQty in reduceQuantity
            const revertedQtyByUom = await reduceQuantity(
              allocatedItem.quantitiesByUom,
              item.uom,
              -item.quantity, // Negative quantity to add back
              allocatedItem?.item?.level0,
              allocatedItem?.item?.packagingStructure,
            );

            // Update allocated item status when reverting
            let status = "Allocated";
            const checkFullyAllocated = revertedQtyByUom.some(
              (qtyItem) => qtyItem.quantity > 0,
            );
            if (checkFullyAllocated) {
              status = "Partially_Used";
            }
            const checkAllZero = revertedQtyByUom.every(
              (qtyItem) => qtyItem.quantity === 0,
            );
            if (checkAllZero) {
              status = "Used";
            }
            await AllocatedStockItem.findByIdAndUpdate(
              item.allocatedItemId,
              {
                quantitiesByUom: revertedQtyByUom,
                status: status,
              },
              { new: true },
            );
          }
        }

        // Validate and process new items
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

        updateData.items = normalizedItems;
        updateData.totalPrice = parseFloat(totalPrice.toFixed(2));
      }

      // Update product sale
      const updatedSale = await ProductSale.findByIdAndUpdate(id, updateData, {
        new: true,
      })
        .populate(
          "patientId",
          "firstName lastName phone email age gender",
          PatientRegistration,
        )
        .populate("paymentMethodId", "name uniqueName status", PaymentMethod)
        .lean();

      return res.status(200).json({
        success: true,
        message: "Product sale updated successfully",
        data: updatedSale,
      });
    } catch (err) {
      console.error("Error in update product sale:", err);
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
  } else if (req.method === "DELETE") {
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

      // Find and delete product sale
      const productSale = await ProductSale.findOneAndDelete({
        _id: id,
        clinicId,
      });

      if (!productSale) {
        return res.status(404).json({
          success: false,
          message: "Product sale not found",
        });
      }

      // Revert quantities
      for (const item of productSale.items) {
        const allocatedItem = await AllocatedStockItem.findById(
          item.allocatedItemId,
        );
        if (allocatedItem) {
          // Calculate the revert: add back the quantity using negative targetQty in reduceQuantity
          const revertedQtyByUom = await reduceQuantity(
            allocatedItem.quantitiesByUom,
            item.uom,
            -item.quantity, // Negative quantity to add back
            allocatedItem?.item?.level0,
            allocatedItem?.item?.packagingStructure,
          );

          // Update allocated item status when reverting
          let status = "Allocated";
          const checkFullyAllocated = revertedQtyByUom.some(
            (qtyItem) => qtyItem.quantity > 0,
          );
          if (checkFullyAllocated) {
            status = "Partially_Used";
          }
          const checkAllZero = revertedQtyByUom.every(
            (qtyItem) => qtyItem.quantity === 0,
          );
          if (checkAllZero) {
            status = "Used";
          }
          await AllocatedStockItem.findByIdAndUpdate(
            item.allocatedItemId,
            {
              quantitiesByUom: revertedQtyByUom,
              status: status,
            },
            { new: true },
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Product sale deleted successfully",
      });
    } catch (err) {
      console.error("Error in delete product sale:", err);
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

import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import GRN from "../../../../../models/stocks/GRN";
import PurchaseRecord from "../../../../../models/stocks/PurchaseRecord";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  const { grnId } = req.query;

  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
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
    } else if (me.role === "agent") {
      if (!me.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Agent not tied to a clinic",
        });
      }
      clinicId = me.clinicId;
    } else if (me.role === "doctor") {
      if (!me.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Doctor not tied to a clinic",
        });
      }
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      clinicId = req.body.clinicId;
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required for admin",
        });
      }
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    // Validate grnId is provided
    if (!grnId) {
      return res.status(400).json({
        success: false,
        message: "grnId is required in query parameters",
      });
    }

    // Check if GRN exists and belongs to clinic
    const existingGRN = await GRN.findOne({
      _id: grnId,
      clinicId,
    });

    if (!existingGRN) {
      return res.status(404).json({
        success: false,
        message: "GRN not found or you do not have access to it",
      });
    }

    const {
      grnNo,
      branch,
      purchasedOrder,
      grnDate,
      supplierInvoiceNo,
      supplierGrnDate,
      notes,
      status,
    } = req.body;

    // Validation for required fields
    if (grnNo !== undefined && !grnNo.trim()) {
      return res.status(400).json({
        success: false,
        message: "GRN number cannot be empty",
      });
    }

    // Check for duplicate GRN number if being changed
    if (grnNo && grnNo !== existingGRN.grnNo) {
      const duplicateGRN = await GRN.findOne({
        clinicId,
        grnNo: grnNo.trim(),
        _id: { $ne: grnId },
      });

      if (duplicateGRN) {
        return res.status(400).json({
          success: false,
          message: "GRN number already exists for this clinic",
        });
      }
    }

    // Validate branch if provided
    if (branch) {
      const branchExists = await Clinic.findOne({
        _id: branch,
        $or: [
          { _id: clinicId }, // Main clinic
          { parentClinic: clinicId }, // Sub-branch
        ],
      });

      if (!branchExists) {
        return res.status(404).json({
          success: false,
          message: "Branch not found or does not belong to this clinic",
        });
      }
    }

    // Validate purchase order if provided
    if (purchasedOrder) {
      const purchaseOrderExists = await PurchaseRecord.findOne({
        _id: purchasedOrder,
        clinicId,
      });

      if (!purchaseOrderExists) {
        return res.status(404).json({
          success: false,
          message: "Purchase order not found or does not belong to this clinic",
        });
      }
    }

    // Validate supplierInvoiceNo is provided when required
    if (supplierInvoiceNo !== undefined && !supplierInvoiceNo.trim()) {
      return res.status(400).json({
        success: false,
        message: "Supplier invoice number cannot be empty",
      });
    }

    // Validate dates
    if (grnDate && isNaN(new Date(grnDate).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid GRN date format",
      });
    }

    if (supplierGrnDate && isNaN(new Date(supplierGrnDate).getTime())) {
      return res.status(400).json({
        success: false,
        message: "Invalid supplier GRN date format",
      });
    }

    // Validate status if provided
    if (status) {
      const validStatuses = [
        "New",
        "Partly_Invoiced",
        "Invoiced",
        "Partly_Paid",
        "Paid",
        "Deleted",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Valid statuses are: ${validStatuses.join(
            ", "
          )}`,
        });
      }

      // Prevent status changes to "Deleted" for non-admin/clinic users
      if (status === "Deleted" && me.role !== "admin" && me.role !== "clinic") {
        return res.status(403).json({
          success: false,
          message: "Only admin or clinic owner can delete GRN",
        });
      }
    }

    // Check if GRN is deletable (prevent updates on Deleted status)
    if (
      existingGRN.status === "Deleted" &&
      me.role !== "admin" &&
      me.role !== "clinic"
    ) {
      return res.status(403).json({
        success: false,
        message: "Cannot update a deleted GRN",
      });
    }

    // Prepare update object with only provided fields
    const updateData = {};

    if (grnNo !== undefined) updateData.grnNo = grnNo.trim();
    if (branch) updateData.branch = branch;
    if (purchasedOrder) updateData.purchasedOrder = purchasedOrder;
    if (grnDate) updateData.grnDate = new Date(grnDate);
    if (supplierInvoiceNo !== undefined)
      updateData.supplierInvoiceNo = supplierInvoiceNo.trim();
    if (supplierGrnDate) updateData.supplierGrnDate = new Date(supplierGrnDate);
    if (notes !== undefined) updateData.notes = notes.trim();
    if (status) updateData.status = status;

    // Update the GRN
    const updatedGRN = await GRN.findOneAndUpdate(
      { _id: grnId, clinicId },
      { ...updateData },
      { new: true, runValidators: true }
    )
      .populate("branch", "name")
      .populate("purchasedOrder", "orderNo date supplier")
      .populate("purchasedOrder.supplier", "name")
      .populate("createdBy", "name email");

    if (!updatedGRN) {
      return res.status(404).json({
        success: false,
        message: "GRN not found after update",
      });
    }

    return res.status(200).json({
      success: true,
      message: "GRN updated successfully",
      data: updatedGRN,
    });
  } catch (err) {
    console.error("Error in update GRN:", err);

    // Handle duplicate key errors
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: "GRN number already exists for this clinic",
      });
    }

    // Handle validation errors
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
}

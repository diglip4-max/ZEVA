import dbConnect from "../../../../lib/database";
import GRN from "../../../../models/stocks/GRN";
import Clinic from "../../../../models/Clinic";
import PurchaseRecord from "../../../../models/stocks/PurchaseRecord";
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

    // Only clinic, agent, admin, and doctor can add GRN
    if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
      return res.status(403).json({
        success: false,
        message:
          "Access denied. Only clinic, agent, admin, or doctor can add GRN.",
      });
    }

    // Get clinicId based on user role
    let clinicId;
    let branchId;

    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id });
      if (!clinic) {
        return res.status(400).json({
          success: false,
          message: "Clinic not found for this user",
        });
      }
      clinicId = clinic._id;
      // For clinic owner, use the clinic as the default branch
      branchId = req.body.branch || clinic._id;
    } else if (me.role === "agent" || me.role === "doctor") {
      if (!me.clinicId) {
        return res.status(400).json({
          success: false,
          message: "User not tied to a clinic",
        });
      }
      clinicId = me.clinicId;
      branchId = req.body.branch || me.clinicId;
    } else if (me.role === "admin") {
      // Admin must specify clinicId and branch in request body
      clinicId = req.body.clinicId;
      branchId = req.body.branch;

      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required in request body for admin",
        });
      }
      if (!branchId) {
        return res.status(400).json({
          success: false,
          message: "branch is required in request body for admin",
        });
      }
    }

    // Validate required fields
    const {
      purchasedOrder,
      grnDate,
      supplierInvoiceNo,
      supplierGrnDate,
      notes = "",
      status = "New",
    } = req.body;

    if (!purchasedOrder) {
      return res.status(400).json({
        success: false,
        message: "Purchase Order reference is required",
      });
    }

    if (!grnDate) {
      return res.status(400).json({
        success: false,
        message: "GRN date is required",
      });
    }

    if (!supplierInvoiceNo) {
      return res.status(400).json({
        success: false,
        message: "Supplier invoice number is required",
      });
    }

    if (!supplierGrnDate) {
      return res.status(400).json({
        success: false,
        message: "Supplier GRN date is required",
      });
    }

    // Validate status
    const validStatuses = [
      "New",
      "Partly_Invoiced",
      "Invoiced",
      "Partly_Paid",
      "Paid",
      "Deleted",
    ];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      });
    }

    // Validate that the purchase order exists and belongs to the same clinic
    const purchaseOrder = await PurchaseRecord.findOne({
      _id: purchasedOrder,
      clinicId,
    });

    if (!purchaseOrder) {
      return res.status(404).json({
        success: false,
        message: "Purchase Order not found or doesn't belong to this clinic",
      });
    }

    // Validate that the branch exists and belongs to the clinic
    const branch = await Clinic.findOne({
      _id: branchId,
      $or: [
        { _id: clinicId }, // Main clinic can be used as branch
        { parentClinic: clinicId }, // Or a sub-branch of the clinic
      ],
    });

    if (!branch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found or doesn't belong to this clinic",
      });
    }

    // Create GRN document
    const grnData = {
      clinicId,
      branch: branchId,
      purchasedOrder,
      grnDate: new Date(grnDate),
      supplierInvoiceNo: supplierInvoiceNo.trim(),
      supplierGrnDate: new Date(supplierGrnDate),
      notes: notes.trim(),
      status,
      createdBy: me._id,
    };

    const newGRN = new GRN(grnData);
    const savedGRN = await newGRN.save();

    // Populate references for the response
    const populatedGRN = await GRN.findById(savedGRN._id)
      .populate("branch", "name")
      .populate("purchasedOrder", "orderNo date supplier")
      .populate("purchasedOrder.supplier", "name")
      .populate("createdBy", "name email")
      .lean();

    return res.status(201).json({
      success: true,
      message: "GRN created successfully",
      data: populatedGRN,
    });
  } catch (err) {
    console.error("Error in add GRN:", err);

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

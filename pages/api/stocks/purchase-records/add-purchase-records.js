import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import PurchaseRecord from "../../../../models/stocks/PurchaseRecord";
import Supplier from "../../../../models/stocks/Supplier";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
    return res.status(403).json({ success: false, message: "Access denied" });
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
      return res
        .status(400)
        .json({ success: false, message: "Agent not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "doctor") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor not tied to a clinic" });
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

  try {
    const {
      orderNo,
      branch,
      date,
      enqNo,
      quotationNo,
      quotationDate,
      validityDays,
      paymentTermsDays,
      supplier,
      type,
      supplierInvoiceNo,
      notes,
      status,
      shipTo,
      billTo,
      contactInfoOfBuyer,
      items,
    } = req.body;

    if (!branch) {
      return res.status(400).json({
        success: false,
        message: "Branch is required",
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: "Date is required",
      });
    }

    if (!supplier) {
      return res.status(400).json({
        success: false,
        message: "Supplier is required",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one item is required",
      });
    }

    // Validate branch exists
    const findBranch = await Clinic.findById(branch);
    if (!findBranch) {
      return res.status(404).json({
        success: false,
        message: "Branch not found",
      });
    }

    // Validate supplier exists and belongs to clinic
    const findSupplier = await Supplier.findOne({
      _id: supplier,
      clinicId: clinicId,
    });
    if (!findSupplier) {
      return res.status(404).json({
        success: false,
        message: "Supplier not found or does not belong to this clinic",
      });
    }

    // Validate type is valid
    const validTypes = [
      "Purchase_Order",
      "Purchase_Request",
      "Purchase_Invoice",
      "GRN_Regular",
    ];
    if (type && !validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Valid types are: ${validTypes.join(", ")}`,
      });
    }

    // Validate supplierInvoiceNo is provided when required
    if (
      (type === "Purchase_Invoice" || type === "GRN_Regular") &&
      !supplierInvoiceNo
    ) {
      return res.status(400).json({
        success: false,
        message: "Supplier invoice number is required for this type",
      });
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      if (!item.name) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: Name is required`,
        });
      }

      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: Quantity must be a positive number`,
        });
      }

      if (typeof item.unitPrice !== "number" || item.unitPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: Unit price must be a non-negative number`,
        });
      }

      if (typeof item.totalPrice !== "number" || item.totalPrice < 0) {
        return res.status(400).json({
          success: false,
          message: `Item ${i + 1}: Total price must be a non-negative number`,
        });
      }
    }

    const newPurchaseRecord = new PurchaseRecord({
      clinicId,
      orderNo,
      branch,
      date: new Date(date),
      enqNo,
      quotationNo,
      quotationDate,
      validityDays,
      paymentTermsDays,
      supplier,
      type: type || "Purchase_Request", // Default type
      supplierInvoiceNo,
      notes,
      status: status || "New", // Default status
      shipTo,
      billTo,
      contactInfoOfBuyer,
      items,
      createdBy: me._id,
    });

    await newPurchaseRecord.save();

    // if convert purchase request then change their status
    if (req.body?.purchaseRequestId) {
      const updatedStatus =
        type === "Purchase_Order"
          ? "Converted_To_PO"
          : type === "Purchase_Invoice"
            ? "Converted_To_PI"
            : "Converted_To_GRN";
      await PurchaseRecord.updateOne(
        { _id: req.body.purchaseRequestId },
        { status: updatedStatus },
      );
    }

    const recordWithPopulate = await PurchaseRecord.findById(
      newPurchaseRecord._id,
    )
      .populate("branch", "name")
      .populate("supplier", "name")
      .populate("createdBy", "name email");

    res.status(200).json({
      success: true,
      message: "Purchase record added successfully",
      data: recordWithPopulate,
    });
  } catch (err) {
    console.error("Error in add purchase record:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}

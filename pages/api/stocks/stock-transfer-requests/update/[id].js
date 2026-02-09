import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import StockTransferRequest from "../../../../../models/stocks/StockTransferRequest";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "PUT") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const me = await getUserFromReq(req);
    if (!me)
      return res
        .status(401)
        .json({ success: false, message: "Not authenticated" });

    if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Resolve clinicId based on user role
    let clinicId;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id });
      if (!clinic)
        return res
          .status(400)
          .json({ success: false, message: "Clinic not found for this user" });
      clinicId = clinic._id;
    } else if (me.role === "agent" || me.role === "doctor") {
      if (!me.clinicId)
        return res
          .status(400)
          .json({ success: false, message: "User not tied to a clinic" });
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      clinicId = req.body.clinicId;
      if (!clinicId)
        return res.status(400).json({
          success: false,
          message: "clinicId is required for admin",
        });
    }

    const { id } = req.query;
    const {
      transferType,
      requestingBranch,
      fromBranch,
      requestingEmployee,
      date,
      notes,
      items,
      status,
    } = req.body;

    // Find request (must belong to clinic)
    const request = await StockTransferRequest.findOne({
      _id: id,
      clinicId,
    });

    if (!request) {
      return res.status(404).json({
        success: false,
        message: "Stock transfer request not found",
      });
    }

    // Update fields
    if (transferType !== undefined) request.transferType = transferType;
    if (requestingBranch !== undefined) {
      request.requestingBranch = requestingBranch || null;
    }
    if (fromBranch !== undefined) {
      request.fromBranch = fromBranch;
    }
    if (requestingEmployee) {
      request.requestingEmployee = requestingEmployee || null;
    }
    if (date !== undefined) request.date = new Date(date);
    if (notes !== undefined) request.notes = notes;
    if (status !== undefined && request.status !== "Deleted") {
      request.status = status;
    }

    // Update items if provided
    if (items !== undefined && Array.isArray(items) && items.length > 0) {
      // Validate items
      for (const item of items) {
        if (!item.name || !item.quantity) {
          return res.status(400).json({
            success: false,
            message: "Each item must have name and quantity",
          });
        }
      }
      request.items = items;
    }

    // Save
    await request.save();

    // Populate and return
    const updatedRequest = await StockTransferRequest.findById(request._id)
      .populate("requestingBranch", "name")
      .populate("fromBranch", "name")
      .populate("requestingEmployee", "name email")
      .populate("createdBy", "name email")
      .lean();

    res.status(200).json({
      success: true,
      message: "Stock transfer request updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating stock transfer request:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update stock transfer request",
      error: error.message,
    });
  }
}

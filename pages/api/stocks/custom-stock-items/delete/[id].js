import dbConnect from "../../../../../lib/database";
import Clinic from "../../../../../models/Clinic";
import CustomStockItem from "../../../../../models/stocks/CustomStockItem";
import { getUserFromReq, requireRole } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  res.setHeader("Allow", ["DELETE"]);

  if (req.method !== "DELETE") {
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

    if (
      !requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Item ID is required",
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
          message: `${me.role} not tied to a clinic`,
        });
      }
      clinicId = me.clinicId;
    } else if (me.role === "admin") {
      clinicId = req.body.clinicId;
      if (!clinicId) {
        return res.status(400).json({
          success: false,
          message: "clinicId is required for admin in request body",
        });
      }
    }

    // Check if item exists and delete
    const deletedItem = await CustomStockItem.findOneAndDelete({
      _id: id,
      clinicId,
    });

    if (!deletedItem) {
      return res.status(404).json({
        success: false,
        message: "Custom stock item not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Custom stock item deleted successfully",
      data: deletedItem,
    });
  } catch (error) {
    console.error("Error deleting custom stock item: ", error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal Server Error",
    });
  }
}

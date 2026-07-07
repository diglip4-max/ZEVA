import dbConnect from "../../../../lib/database";
import Clinic from "../../../../models/Clinic";
import User from "../../../../models/Users";
import PatientRegistration from "../../../../models/PatientRegistration";
import PaymentMethod from "../../../../models/PaymentMethod";
import ProductSale from "../../../../models/stocks/ProductSale";
import { getUserFromReq, requireRole } from "../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  res.setHeader("Allow", ["GET"]);

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
      const clinicIdStr = String(clinicId);

      // Get filters from query params
      const search = req.query.search?.trim().toLowerCase() || null;
      const status = req.query.status || null;
      const paymentStatus = req.query.paymentStatus || null;
      const patientId = req.query.patientId || null;
      const paymentMethodId = req.query.paymentMethodId || null;
      const userId = req.query.userId || null;
      const startDate = req.query.startDate || null;
      const endDate = req.query.endDate || null;

      // Build query
      let query = { clinicId: clinicIdStr };

      if (search) {
        const matchingPatients = await PatientRegistration.find(
          { clinicId },
          { _id: 1 },
        ).or([
          { firstName: { $regex: search, $options: "i" } },
          { lastName: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
          { mobileNumber: { $regex: search, $options: "i" } },
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

      // Fetch product sales with population
      const sales = await ProductSale.find(query)
        .populate(
          "patientId",
          "firstName lastName phone mobileNumber email age gender",
          PatientRegistration,
        )
        .populate("paymentMethodId", "name uniqueName status", PaymentMethod)
        .populate("soldBy", "name email", User)
        .sort({ createdAt: -1 })
        .lean();

      // Generate CSV
      const csvHeaders = [
        "Invoice Number",
        "Date",
        "Patient Name",
        "Patient Phone",
        "Payment Method",
        "Sold By",
        "Total Amount",
        "Total Commission",
        "Status",
        "Payment Status",
      ];

      // Escape CSV values
      const escapeCSV = (value) => {
        if (value === null || value === undefined) return "";
        const stringValue = String(value);
        if (
          stringValue.includes(",") ||
          stringValue.includes('"') ||
          stringValue.includes("\n") ||
          stringValue.includes("\r")
        ) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      };

      const csvRows = sales.map((sale) => {
        const patient = sale.patientId
          ? `${sale.patientId.firstName || ""} ${sale.patientId.lastName || ""}`.trim()
          : "";
        const patientPhone =
          sale.patientId?.phone || sale.patientId?.mobileNumber || "";
        const paymentMethod =
          sale.paymentMethodId?.name || sale.paymentMethodName || "";
        const soldBy = sale.soldBy?.name || "";
        const totalAmount = sale.totalPrice
          ? Number(sale.totalPrice).toFixed(2)
          : "0.00";
        const totalCommission = sale.totalCommission
          ? Number(sale.totalCommission).toFixed(2)
          : "0.00";
        const date = sale.createdAt
          ? new Date(sale.createdAt).toLocaleString()
          : "";

        return [
          escapeCSV(sale.invoiceNo || ""),
          escapeCSV(date),
          escapeCSV(patient),
          escapeCSV(patientPhone),
          escapeCSV(paymentMethod),
          escapeCSV(soldBy),
          escapeCSV(totalAmount),
          escapeCSV(totalCommission),
          escapeCSV(sale.status || ""),
          escapeCSV(sale.paymentStatus || ""),
        ];
      });

      const csvContent = [
        csvHeaders.join(","),
        ...csvRows.map((row) => row.join(",")),
      ].join("\n");

      // Set headers for file download
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="product-sales-export-${new Date().toISOString().split("T")[0]}.csv"`,
      );
      res.status(200).send(csvContent);
    } catch (err) {
      console.error("Error in export product sales:", err);
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

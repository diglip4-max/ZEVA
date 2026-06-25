import { getUserFromReq, requireRole } from "../lead-ms/auth";
import Clinic from "../../../models/Clinic";
import PaymentMethod from "../../../models/PaymentMethod";
import dbConnect from "../../../lib/database";

// Function to generate uniqueName from name
const generateUniqueName = (name) => {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
};

export default async function handler(req, res) {
  await dbConnect();

  res.setHeader("Allow", ["POST", "GET"]);

  if (!["POST", "GET"].includes(req.method)) {
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])) {
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
  } else if (me.role === "doctor" || me.role === "doctorStaff") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = req.body.clinicId || req.query.clinicId;
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

  if (req.method === "POST") {
    try {
      const { name, status } = req.body;

      // Validation
      if (!name || typeof name !== "string" || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Valid name is required",
        });
      }

      if (status && !["active", "inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid status value, must be 'active' or 'inactive'",
        });
      }

      // Generate uniqueName
      const uniqueName = generateUniqueName(name);

      // Check for duplicate uniqueName in same clinic
      const existingPaymentMethod = await PaymentMethod.findOne({
        clinicId,
        uniqueName,
      });

      if (existingPaymentMethod) {
        return res.status(409).json({
          success: false,
          message: "Payment method with this name already exists",
        });
      }

      const newPaymentMethod = new PaymentMethod({
        clinicId,
        name: name.trim(),
        uniqueName,
        status: status || "active",
        createdBy: me._id,
      });

      await newPaymentMethod.save();

      return res.status(201).json({
        success: true,
        message: "Payment method added successfully.",
        data: newPaymentMethod,
      });
    } catch (err) {
      console.error("Error in add payment method:", err);

      // Handle mongoose validation errors
      if (err.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: Object.values(err.errors)
            .map((e) => e.message)
            .join(", "),
        });
      }

      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  } else if (req.method === "GET") {
    try {
      // Default payment methods to ensure exist
      const defaultPaymentMethods = [
        "Cash",
        "Card",
        "BT",
        "Tabby",
        "Tamara",
        "Advance Balance",
        "Insurance Claim",
        "Pending Claim",
        "Cashback Wallet",
        "Package Full Paid",
      ];

      // Check for existing payment methods for this clinic
      const existingUniqueNames = defaultPaymentMethods.map((name) =>
        generateUniqueName(name),
      );
      const existingPaymentMethods = await PaymentMethod.find({
        clinicId,
        uniqueName: { $in: existingUniqueNames },
      }).lean();

      const existingUniqueNamesSet = new Set(
        existingPaymentMethods.map((pm) => pm.uniqueName),
      );

      // Create missing default payment methods
      const missingPaymentMethods = defaultPaymentMethods
        .filter((name) => !existingUniqueNamesSet.has(generateUniqueName(name)))
        .map((name) => ({
          clinicId,
          name,
          uniqueName: generateUniqueName(name),
          status: "active",
          isEditable: false,
          isDeleteable: false,
          createdBy: me._id,
        }));

      if (missingPaymentMethods.length > 0) {
        await PaymentMethod.insertMany(missingPaymentMethods);
      }

      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 20));
      const skip = (page - 1) * limit;
      const search = req.query.search?.trim() || null;
      const status = req.query.status; // Optional filter by status

      let query = { clinicId };

      // Search functionality
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: "i" } },
          { uniqueName: { $regex: search, $options: "i" } },
        ];
      }

      // Filter by status
      if (status && ["active", "inactive"].includes(status)) {
        query.status = status;
      }

      // Execute all queries in parallel for maximum performance
      const [totalPaymentMethods, paymentMethods, activeCount, inactiveCount] =
        await Promise.all([
          PaymentMethod.countDocuments(query),
          PaymentMethod.find(query)
            .sort({ createdAt: 1 })
            .skip(skip)
            .limit(limit)
            .lean(),
          PaymentMethod.countDocuments({ ...query, status: "active" }),
          PaymentMethod.countDocuments({ ...query, status: "inactive" }),
        ]);

      const totalPages = Math.ceil(totalPaymentMethods / limit);
      const hasMore = page < totalPages;

      return res.status(200).json({
        success: true,
        message: "Payment methods fetched successfully.",
        data: {
          paymentMethods,
          statistics: {
            total: totalPaymentMethods,
            active: activeCount,
            inactive: inactiveCount,
          },
          pagination: {
            totalResults: totalPaymentMethods,
            totalPages,
            currentPage: page,
            limit,
            hasMore,
          },
        },
      });
    } catch (err) {
      console.error("Error in fetch payment methods:", err);

      return res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
      });
    }
  }
}

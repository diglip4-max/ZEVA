import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import PaymentMethod from "../../../models/PaymentMethod";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

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

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);

  if (!["GET", "PUT", "DELETE"].includes(req.method)) {
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
    } else if (me.role === "doctor" || me.role === "doctorStaff") {
      if (!me.clinicId) {
        return res.status(400).json({
          success: false,
          message: "Doctor not tied to a clinic",
        });
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

    const { paymentMethodId } = req.query;

    // Validate paymentMethodId
    if (!paymentMethodId) {
      return res.status(400).json({
        success: false,
        message: "paymentMethodId is required in query parameters",
      });
    }

    // Find the Payment Method and verify it belongs to the clinic
    const existingPaymentMethod = await PaymentMethod.findOne({
      _id: paymentMethodId,
      clinicId,
    });

    if (!existingPaymentMethod) {
      return res.status(404).json({
        success: false,
        message: "Payment method not found or you do not have access to it",
      });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case "GET": {
        // Get single payment method
        return res.status(200).json({
          success: true,
          message: "Payment method fetched successfully",
          data: existingPaymentMethod,
        });
      }

      case "PUT": {
        // Update payment method
        const { name, status } = req.body;

        // Prepare update data with validation
        const updateData = {};
        let hasUpdates = false;

        // Update name if provided and different
        if (name !== undefined) {
          if (typeof name !== "string" || name.trim().length === 0) {
            return res.status(400).json({
              success: false,
              message: "Name must be a non-empty string",
            });
          }

          const trimmedName = name.trim();
          const newUniqueName = generateUniqueName(trimmedName);

          // Check for duplicate uniqueName (excluding current payment method)
          if (newUniqueName !== existingPaymentMethod.uniqueName) {
            const duplicatePaymentMethod = await PaymentMethod.findOne({
              clinicId,
              uniqueName: newUniqueName,
              _id: { $ne: paymentMethodId },
            });

            if (duplicatePaymentMethod) {
              return res.status(409).json({
                success: false,
                message: "Another payment method with this name already exists",
              });
            }

            updateData.name = trimmedName;
            updateData.uniqueName = newUniqueName;
            hasUpdates = true;
          }
        }

        // Update status if provided and valid
        if (status !== undefined) {
          if (!["active", "inactive"].includes(status)) {
            return res.status(400).json({
              success: false,
              message: "Status must be either 'active' or 'inactive'",
            });
          }

          if (status !== existingPaymentMethod.status) {
            updateData.status = status;
            hasUpdates = true;
          }
        }

        // Check if there are any updates
        if (!hasUpdates) {
          return res.status(400).json({
            success: false,
            message: "No changes provided for update",
          });
        }

        // Perform the update
        const updatedPaymentMethod = await PaymentMethod.findByIdAndUpdate(
          paymentMethodId,
          updateData,
          {
            new: true, // Return updated document
            runValidators: true, // Run schema validators
          },
        ).lean();

        return res.status(200).json({
          success: true,
          message: "Payment method updated successfully",
          data: updatedPaymentMethod,
        });
      }

      case "DELETE": {
        // Delete payment method
        await PaymentMethod.findByIdAndDelete(paymentMethodId);

        return res.status(200).json({
          success: true,
          message: "Payment method deleted successfully",
          data: {
            deletedId: paymentMethodId,
            deletedName: existingPaymentMethod.name,
            timestamp: new Date().toISOString(),
          },
        });
      }

      default: {
        return res.status(405).json({
          success: false,
          message: `Method ${req.method} Not Allowed`,
        });
      }
    }
  } catch (err) {
    console.error("Error in payment method operation:", err);

    // Handle specific error types
    if (err.name === "ValidationError") {
      return res.status(400).json({
        success: false,
        message: Object.values(err.errors)
          .map((e) => e.message)
          .join(", "),
      });
    }

    if (err.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid payment method ID format",
      });
    }

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}

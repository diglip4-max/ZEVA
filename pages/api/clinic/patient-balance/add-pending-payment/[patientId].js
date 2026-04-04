import dbConnect from "../../../../../lib/database";
import Billing from "../../../../../models/Billing";
import Clinic from "../../../../../models/Clinic";
import PatientRegistration from "../../../../../models/PatientRegistration";
import { getUserFromReq } from "../../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (
      !["clinic", "agent", "doctorStaff", "staff", "admin"].includes(
        clinicUser.role,
      )
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { patientId } = req.query;
    if (!patientId) {
      return res
        .status(400)
        .json({ success: false, message: "Patient ID is required" });
    }

    const { amount, paymentMethod, notes, invoicedBy, multiplePayments } =
      req.body;
    if (!amount || isNaN(amount) || Number(amount) <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Valid amount is required" });
    }
    if (
      !paymentMethod &&
      (!multiplePayments || multiplePayments.length === 0)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "Payment method is required" });
    }

    // Verify patient
    const patient = await PatientRegistration.findById(patientId);
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    // Determine clinicId
    let clinicId;
    if (clinicUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else if (clinicUser.role === "admin") {
      clinicId = req.body.clinicId || patient.clinicId;
    } else {
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res
          .status(403)
          .json({ success: false, message: "User not linked to a clinic" });
      }
    }

    // Create billing record for pending payment
    const invoiceNumber = `PAY-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const initialMultiplePayments =
      multiplePayments && multiplePayments.length > 0
        ? multiplePayments
        : [{ paymentMethod, amount: Number(amount) }];

    const billing = new Billing({
      clinicId,
      patientId,
      appointmentId: null,
      invoiceNumber,
      invoicedBy: invoicedBy || clinicUser.name || "System",
      service: "Service",
      treatment: notes || "Pending Balance Payment",
      amount: Number(amount), // Set amount to payment so that effectiveDue = paid and advance becomes 0
      paid: Number(amount),
      pendingUsed: Number(amount), // This reduces the historical pending balance
      isAdvanceOnly: true, // Use this flag to hide from service invoices list
      pending: 0, // Explicitly set to 0 to satisfy schema requirements
      paymentMethod: paymentMethod || initialMultiplePayments[0].paymentMethod,
      status: "Completed",
      multiplePayments: initialMultiplePayments,
      paymentHistory: [
        {
          amount: Number(amount),
          paid: Number(amount),
          pending: 0,
          paymentMethod:
            paymentMethod || initialMultiplePayments[0].paymentMethod,
          multiplePayments: initialMultiplePayments,
          status: "Completed",
          updatedAt: new Date(),
        },
      ],
      notes: notes,
    });

    await billing.save();

    return res.status(200).json({
      success: true,
      message: "Pending payment recorded successfully",
      data: billing,
    });
  } catch (error) {
    console.error("Error adding pending payment:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to add pending payment",
    });
  }
}

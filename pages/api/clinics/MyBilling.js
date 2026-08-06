// /api/agent/receptionist/my-billings.js
//
// Lists billing records created by the currently authenticated receptionist
// (role: "agent"). Scoped by invoicedById — the indexed ObjectId reference —
// NOT by invoicedBy, which is a free-text name snapshot with no referential
// integrity (two receptionists could share a first name, and a renamed
// account would silently split old and new billings into different buckets
// if matched by name string).
//
// invoicedById is ALWAYS derived from the verified Bearer token. It is never
// accepted as a request parameter, so it cannot be spoofed via the query
// string or a client-side value.

import dbConnect from "../../../lib/database";
import Billing from "../../../models/Billing";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";
import PatientRegistration from "../../../models/PatientRegistration";

export default async function handler(req, res) {
  let user;
  try {
    await dbConnect();
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (user.role !== "agent") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    console.error("Auth/connection error in my-billings:", error);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  // invoicedById comes ONLY from the verified token payload.
  const invoicedById = user.userId || user._id?.toString();
  if (!invoicedById) {
    return res.status(400).json({
      success: false,
      message: "Unable to resolve receptionist identity from token",
    });
  }

  let clinicId;
  try {
    const receptionistUser = await User.findById(invoicedById)
      .select("clinicId name")
      .lean();
    if (!receptionistUser) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }
    clinicId = receptionistUser.clinicId;
    if (!clinicId) {
      return res.status(403).json({
        success: false,
        message: "Access denied. User not linked to a clinic.",
      });
    }
  } catch (error) {
    console.error("Error resolving receptionist's clinic:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to resolve clinic" });
  }

  // Optional narrowing filters — none of these can widen the query past
  // this receptionist's own invoicedById, because that field is fixed and
  // always AND-ed in below.
  const { patientId, fromDate, toDate, page = 1, limit = 20 } = req.query;

  try {
    const query = { clinicId, invoicedById }; // <-- the containment boundary

    if (patientId) query.patientId = patientId;

    if (fromDate || toDate) {
      query.invoicedDate = {};
      if (fromDate) {
        const start = new Date(fromDate);
        if (isNaN(start.getTime())) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid fromDate parameter" });
        }
        start.setHours(0, 0, 0, 0);
        query.invoicedDate.$gte = start;
      }
      if (toDate) {
        const end = new Date(toDate);
        if (isNaN(end.getTime())) {
          return res
            .status(400)
            .json({ success: false, message: "Invalid toDate parameter" });
        }
        end.setHours(23, 59, 59, 999);
        query.invoicedDate.$lte = end;
      }
    }

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 20, 1), 100);

    const total = await Billing.countDocuments(query);
    const totalAmountAgg = await Billing.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: "$amount" },
          totalPaid: { $sum: "$paid" },
          totalPending: { $sum: "$pending" },
        },
      },
    ]);
    const totals = totalAmountAgg[0] || {
      totalAmount: 0,
      totalPaid: 0,
      totalPending: 0,
    };

    const billings = await Billing.find(query)
      .populate({
        path: "patientId",
        select: "firstName lastName mobileNumber emrNumber",
      })
      .populate({ path: "doctorId", select: "name" })
      .sort({ invoicedDate: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const formatted = billings.map((b) => {
      const patient = b.patientId || {};
      const doctor = b.doctorId || {};
      return {
        _id: b._id.toString(),
        invoiceNumber: b.invoiceNumber,
        invoicedDate: b.invoicedDate,
        patientName:
          `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
          "Unknown",
        patientNumber: patient.mobileNumber || "",
        emrNumber: patient.emrNumber || "",
        doctorName: doctor.name || "",
        service: b.service,
        treatment: b.treatment || "",
        package: b.package || "",
        amount: b.amount,
        paid: b.paid,
        pending: b.pending,
        paymentMethod: b.paymentMethod || "",
      };
    });

    return res.status(200).json({
      success: true,
      billings: formatted,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum) || 1,
      totals: {
        totalAmount: totals.totalAmount,
        totalPaid: totals.totalPaid,
        totalPending: totals.totalPending,
      },
    });
  } catch (error) {
    console.error("Error fetching receptionist's billings:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch billings",
      error: error.message,
    });
  }
}

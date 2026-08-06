import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import User from "../../../models/Users";
import Billing from "../../../models/Billing";
import { getUserFromReq } from "../lead-ms/auth";
import dayjs from "dayjs";
import mongoose from "mongoose";

export default async function handler(req, res) {
  let user;
  try {
    await dbConnect();
    user = await getUserFromReq(req);
    console.log("DEBUG /my-performance user:", JSON.stringify(user));

    if (!user)
      return res.status(401).json({ success: false, message: "Unauthorized" });
    if (user.role !== "doctorStaff") {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    console.error("Auth/connection error:", error);
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
  // doctorId comes ONLY from the verified token payload — userId field,
  // matching what your decoded JWT actually contains
  const doctorId = user.userId || user._id?.toString();
  if (!doctorId) {
    return res.status(400).json({
      success: false,
      message: "Unable to resolve doctor identity from token",
    });
  }

  // need clinicId too — check what getUserFromReq actually returns here;
  // if the token payload doesn't include clinicId, you'll need to look
  // the User doc up by doctorId to get it
  const doctorUser = await User.findById(doctorId)
    .select("clinicId name email")
    .lean();
  if (!doctorUser) {
    return res
      .status(404)
      .json({ success: false, message: "Doctor not found" });
  }
  const clinicId = doctorUser.clinicId;

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res
      .status(405)
      .json({ success: false, message: "Method not allowed" });
  }

  const { filter = "month", date, startDate, endDate } = req.query;
  // no doctorId accepted as a query param — not part of this endpoint's contract at all

  let queryStartDate = null,
    queryEndDate = null;
  if (filter === "today") {
    const baseDate = date ? dayjs(date) : dayjs();
    queryStartDate = baseDate.startOf("day").toDate();
    queryEndDate = baseDate.endOf("day").toDate();
  } else if (filter === "week") {
    const end = date ? dayjs(date) : dayjs();
    queryStartDate = end.subtract(6, "day").startOf("day").toDate();
    queryEndDate = end.endOf("day").toDate();
  } else if (filter === "month") {
    const end = date ? dayjs(date) : dayjs();
    queryStartDate = end.subtract(30, "day").startOf("day").toDate();
    queryEndDate = end.endOf("day").toDate();
  } else if (filter === "all" || filter === "lifetime") {
    queryStartDate = null;
    queryEndDate = null;
  }
  if (startDate && endDate) {
    queryStartDate = dayjs(startDate).startOf("day").toDate();
    queryEndDate = dayjs(endDate).endOf("day").toDate();
  }

  try {
    const apptQuery = {
      clinicId,
      doctorId, // hardcoded to token identity — always this one doctor
      status: { $nin: ["Cancelled", "Rejected"] },
      ...(queryStartDate && queryEndDate
        ? { startDate: { $gte: queryStartDate, $lte: queryEndDate } }
        : {}),
    };
    const appointments = await Appointment.find(apptQuery).lean();

    const appointmentCount = appointments.length;
    const completedAppointments = appointments.filter((a) =>
      ["Completed", "Discharge", "invoice"].includes(a.status),
    ).length;
    const pendingAppointments = appointmentCount - completedAppointments;

    // Revenue — same billing join pattern as doctor-performance.js,
    // but $match on this doctorId from the start
    const billingMatch = { clinicId };
    if (queryStartDate && queryEndDate) {
      billingMatch.$or = [
        { invoicedDate: { $gte: queryStartDate, $lte: queryEndDate } },
        { createdAt: { $gte: queryStartDate, $lte: queryEndDate } },
      ];
    }
    const revenueAgg = await Billing.aggregate([
      { $match: billingMatch },
      { $match: { invoiceNumber: { $not: /^(PAST-ADV|ADV-)/ } } },
      {
        $lookup: {
          from: "appointments",
          localField: "appointmentId",
          foreignField: "_id",
          as: "aptById",
        },
      },
      {
        $lookup: {
          from: "appointments",
          localField: "patientId",
          foreignField: "patientId",
          as: "aptByPatient",
        },
      },
      {
        $addFields: {
          refApt: {
            $cond: [
              { $gt: [{ $size: "$aptById" }, 0] },
              { $arrayElemAt: ["$aptById", 0] },
              { $arrayElemAt: ["$aptByPatient", 0] },
            ],
          },
        },
      },
      {
        $match: {
          "refApt.clinicId": clinicId,
          "refApt.doctorId": new mongoose.Types.ObjectId(doctorId),
        },
      },
      {
        $group: {
          _id: "$refApt.doctorId",
          totalAmount: { $sum: { $ifNull: ["$paid", 0] } },
        },
      },
    ]);
    const estimatedRevenue = revenueAgg[0]?.totalAmount || 0;

    return res.status(200).json({
      success: true,
      data: {
        doctorId,
        doctorName: doctorUser.name,
        appointmentCount,
        completedAppointments,
        pendingAppointments,
        estimatedRevenue,
      },
    });
  } catch (error) {
    console.error("Error fetching doctor's own performance:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch data",
      error: error.message,
    });
  }
}

import dbConnect from "../../../../lib/database";
import InsuranceClaim from "../../../../models/InsuranceClaim";
import User from "../../../../models/Users";
import PatientRegistration from "../../../../models/PatientRegistration";
import { getUserFromReq } from "../../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../../lead-ms/permissions-helper";
import mongoose from "mongoose";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();
  } catch {
    return res.status(500).json({ success: false, message: "Database connection failed" });
  }

  let me;
  try {
    me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(me);
  if (clinicError && me.role !== "admin") {
    return res.status(403).json({ success: false, message: clinicError });
  }

  const { hasPermission } = await checkClinicPermission(clinicId, "clinic_reporting", "read");
  if (!hasPermission) {
    return res.status(403).json({ success: false, message: "You do not have permission to view reports" });
  }

  const { startDate, endDate } = req.query;
  const start = startDate ? new Date(startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate ? new Date(endDate) : new Date();
  const startAt = new Date(start);
  startAt.setHours(0, 0, 0, 0);
  const endAt = new Date(end);
  endAt.setHours(23, 59, 59, 999);

  try {
    // Build match conditions
    const clinicMatch = clinicId 
      ? { clinicId: new mongoose.Types.ObjectId(String(clinicId)) } 
      : {};
    const dateMatch = {
      createdAt: { $gte: startAt, $lte: endAt }
    };
    const baseMatch = { ...clinicMatch, ...dateMatch };

    // 1. Overall Statistics
    const [
      totalClaims,
      pendingClaims,
      approvedClaims,
      releasedClaims,
      completedClaims,
      rejectedClaims,
      advanceClaims,
      totalClaimAmount,
      pendingClaimAmount,
    ] = await Promise.all([
      InsuranceClaim.countDocuments(baseMatch),
      InsuranceClaim.countDocuments({ ...baseMatch, status: "Under Review" }),
      InsuranceClaim.countDocuments({ ...baseMatch, status: "Approved" }),
      InsuranceClaim.countDocuments({ ...baseMatch, status: "Released" }),
      InsuranceClaim.countDocuments({ ...baseMatch, status: "Completed" }),
      InsuranceClaim.countDocuments({ ...baseMatch, status: "Rejected" }),
      InsuranceClaim.countDocuments({ ...baseMatch, claimType: "Advance" }),
      InsuranceClaim.aggregate([
        { $match: baseMatch },
        { $group: { _id: null, total: { $sum: "$claimAmount" } } }
      ]),
      InsuranceClaim.aggregate([
        { $match: { ...baseMatch, status: "Under Review" } },
        { $group: { _id: null, total: { $sum: "$claimAmount" } } }
      ]),
    ]);

    // 2. Top 5 Doctors by Claims Count
    const topDoctorsByClaims = await InsuranceClaim.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$doctorId",
          doctorName: { $first: "$doctorName" },
          claimsCount: { $sum: 1 },
          totalClaimAmount: { $sum: "$claimAmount" },
          pendingClaims: {
            $sum: { $cond: [{ $eq: ["$status", "Under Review"] }, 1, 0] }
          },
          approvedClaims: {
            $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] }
          },
          releasedClaims: {
            $sum: { $cond: [{ $eq: ["$status", "Released"] }, 1, 0] }
          },
          completedClaims: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] }
          },
        }
      },
      { $sort: { claimsCount: -1 } },
      { $limit: 5 }
    ]);

    // 3. Claims by Status (for pie chart)
    const claimsByStatus = await InsuranceClaim.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$claimAmount" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // 4. Claims by Claim Type
    const claimsByType = await InsuranceClaim.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$claimType",
          count: { $sum: 1 },
          amount: { $sum: "$claimAmount" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // 5. Claims by Insurance Provider
    const claimsByProvider = await InsuranceClaim.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$insuranceProvider",
          count: { $sum: 1 },
          amount: { $sum: "$claimAmount" }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // 6. Monthly Trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const monthlyTrend = await InsuranceClaim.aggregate([
      { 
        $match: { 
          ...baseMatch,
          createdAt: { $gte: sixMonthsAgo }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" }
          },
          count: { $sum: 1 },
          amount: { $sum: "$claimAmount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // 7. Patients with Pending/Advance Claims
    const patientClaims = await InsuranceClaim.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$patientId",
          patientName: { $first: { $concat: ["$patientFirstName", " ", "$patientLastName"] } },
          patientMobile: { $first: "$patientMobileNumber" },
          totalClaims: { $sum: 1 },
          pendingClaims: {
            $sum: { $cond: [{ $eq: ["$status", "Under Review"] }, 1, 0] }
          },
          advanceClaims: {
            $sum: { $cond: [{ $and: [{ $eq: ["$claimType", "Advance"] }] }, 1, 0] }
          },
          totalAmount: { $sum: "$claimAmount" },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ["$status", "Under Review"] }, "$claimAmount", 0] }
          },
          advanceAmount: {
            $sum: { $cond: [{ $eq: ["$claimType", "Advance"] }, "$claimAmount", 0] }
          },
        }
      },
      {
        $match: {
          $or: [
            { pendingClaims: { $gt: 0 } },
            { advanceClaims: { $gt: 0 } }
          ]
        }
      },
      { $sort: { totalAmount: -1 } },
      { $limit: 10 }
    ]);

    // 8. All Patients with Claims Summary
    const allPatientClaims = await InsuranceClaim.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$patientId",
          patientName: { $first: { $concat: ["$patientFirstName", " ", "$patientLastName"] } },
          patientMobile: { $first: "$patientMobileNumber" },
          totalClaims: { $sum: 1 },
          pendingClaims: {
            $sum: { $cond: [{ $eq: ["$status", "Under Review"] }, 1, 0] }
          },
          advanceClaims: {
            $sum: { $cond: [{ $eq: ["$claimType", "Advance"] }, 1, 0] }
          },
          totalAmount: { $sum: "$claimAmount" },
          pendingAmount: {
            $sum: { $cond: [{ $eq: ["$status", "Under Review"] }, "$claimAmount", 0] }
          },
        }
      },
      { $sort: { totalClaims: -1 } },
      { $limit: 20 }
    ]);

    // 9. Department-wise Claims
    const claimsByDepartment = await InsuranceClaim.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: "$departmentName",
          count: { $sum: 1 },
          amount: { $sum: "$claimAmount" }
        }
      },
      { $match: { _id: { $ne: "" } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // 10. Recent Claims
    const recentClaims = await InsuranceClaim.find(baseMatch)
      .sort({ createdAt: -1 })
      .limit(10)
      .select("patientFirstName patientLastName patientMobileNumber doctorName insuranceProvider claimAmount claimType status createdAt")
      .lean();

    // Format response data
    const stats = {
      totalClaims,
      pendingClaims,
      approvedClaims,
      releasedClaims,
      completedClaims,
      rejectedClaims,
      advanceClaims,
      totalClaimAmount: totalClaimAmount[0]?.total || 0,
      pendingClaimAmount: pendingClaimAmount[0]?.total || 0,
    };

    const topDoctors = topDoctorsByClaims.map(d => ({
      doctorId: String(d._id || ""),
      doctorName: d.doctorName || "Unknown Doctor",
      claimsCount: d.claimsCount,
      totalClaimAmount: d.totalClaimAmount,
      pendingClaims: d.pendingClaims,
      approvedClaims: d.approvedClaims,
      releasedClaims: d.releasedClaims,
      completedClaims: d.completedClaims,
    }));

    const statusData = claimsByStatus.map(s => ({
      status: s._id || "Unknown",
      count: s.count,
      amount: s.amount
    }));

    const typeData = claimsByType.map(t => ({
      type: t._id || "Unknown",
      count: t.count,
      amount: t.amount
    }));

    const providerData = claimsByProvider.map(p => ({
      provider: p._id || "Unknown",
      count: p.count,
      amount: p.amount
    }));

    const trendData = monthlyTrend.map(m => ({
      month: `${m._id.year}-${String(m._id.month).padStart(2, '0')}`,
      count: m.count,
      amount: m.amount
    }));

    const patientsWithPending = patientClaims.map(p => ({
      patientId: String(p._id || ""),
      patientName: (p.patientName || "Unknown Patient").trim(),
      patientMobile: p.patientMobile || "",
      totalClaims: p.totalClaims,
      pendingClaims: p.pendingClaims,
      advanceClaims: p.advanceClaims,
      totalAmount: p.totalAmount,
      pendingAmount: p.pendingAmount,
      advanceAmount: p.advanceAmount,
    }));

    const allPatientsData = allPatientClaims.map(p => ({
      patientId: String(p._id || ""),
      patientName: (p.patientName || "Unknown Patient").trim(),
      patientMobile: p.patientMobile || "",
      totalClaims: p.totalClaims,
      pendingClaims: p.pendingClaims,
      advanceClaims: p.advanceClaims,
      totalAmount: p.totalAmount,
      pendingAmount: p.pendingAmount,
    }));

    const departmentData = claimsByDepartment.map(d => ({
      department: d._id || "Unknown",
      count: d.count,
      amount: d.amount
    }));

    const recent = recentClaims.map(c => ({
      id: String(c._id),
      patientName: `${c.patientFirstName || ""} ${c.patientLastName || ""}`.trim() || "Unknown",
      patientMobile: c.patientMobileNumber || "",
      doctorName: c.doctorName || "Unknown",
      provider: c.insuranceProvider || "Unknown",
      claimAmount: c.claimAmount || 0,
      claimType: c.claimType || "Unknown",
      status: c.status || "Unknown",
      createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : null
    }));

    return res.status(200).json({
      success: true,
      data: {
        stats,
        topDoctors,
        claimsByStatus: statusData,
        claimsByType: typeData,
        claimsByProvider: providerData,
        monthlyTrend: trendData,
        patientsWithPending,
        allPatients: allPatientsData,
        claimsByDepartment: departmentData,
        recentClaims: recent,
      }
    });
  } catch (err) {
    console.error("Insurance claims report error:", err);
    return res.status(500).json({ success: false, message: "Failed to load insurance claims report" });
  }
}
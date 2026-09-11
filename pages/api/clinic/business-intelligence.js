import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Billing from "../../../models/Billing";
import PatientRegistration from "../../../models/PatientRegistration";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/business-intelligence?date=YYYY-MM-DD
 *
 * Returns revenue breakdown for the selected date:
 *   - newPatientCount, newPatientRevenue (patientType "New" appointments)
 *   - cancelledPatientCount, cancelledRevenue (cancelled appointments + service prices)
 *   - expiringPackageCount, expiringPackageRevenue (packages expiring on selected date)
 *   - referralCount, referralRevenue (referred patients with appointments + service prices)
 *   - existingServiceCount, existingServiceRevenue (all appointments + service prices)
 *   - totalPatientCount, totalRevenue
 */

// ─── helpers ────────────────────────────────────────────────────────────

function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function getDayRange(dateObj) {
  const start = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0)
  );
  const end = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999)
  );
  return { start, end };
}

// Build a map of appointmentId → total billing amount
async function buildBillingMap(clinicObjectId, appointmentIds) {
  const billingMap = {};
  if (appointmentIds.length === 0) return billingMap;

  const billings = await Billing.find({
    clinicId: clinicObjectId,
    appointmentId: { $in: appointmentIds },
  })
    .select("appointmentId amount")
    .lean();

  for (const bill of billings) {
    const aid = bill.appointmentId?.toString();
    if (aid) {
      billingMap[aid] = (billingMap[aid] || 0) + (bill.amount || 0);
    }
  }
  return billingMap;
}

// Sum billing amounts for a subset of appointments
function sumBillingForAppointments(appointments, billingMap) {
  let total = 0;
  for (const apt of appointments) {
    const aid = apt._id.toString();
    total += billingMap[aid] || 0;
  }
  return total;
}

// ─── handler ────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // 1. Auth
    const authUser = await getUserFromReq(req);
    if (!authUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. AuthZ
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) {
      return res.status(404).json({ message: error });
    }

    if (!clinicId && authUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: authUser._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    }

    if (!clinicId) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());

    // 3. Parse date
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

    // 4. Get ALL appointments for the selected date
    const allAppointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
    })
      .select("patientId status")
      .lean();

    // 5. Build billing map: appointmentId → total billing amount
    const allAppointmentIds = allAppointments.map((a) => a._id);
    const billingMap = await buildBillingMap(clinicObjectId, allAppointmentIds);

    // ── Existing patient services: all appointments + sum of billing amounts ──
    const existingServiceCount = allAppointments.length;
    const existingServiceRevenue = sumBillingForAppointments(allAppointments, billingMap);

    // ── Collect unique patient IDs ──
    const patientIdSet = new Set();
    for (const apt of allAppointments) {
      if (apt.patientId) {
        patientIdSet.add(apt.patientId.toString());
      }
    }
    const uniquePatientIds = Array.from(patientIdSet);

    // ── New patients (patientType "New") ──
    let newPatientCount = 0;
    let newPatientRevenue = 0;
    if (uniquePatientIds.length > 0) {
      const patients = await PatientRegistration.find({
        _id: { $in: uniquePatientIds.map((id) => new mongoose.Types.ObjectId(id)) },
      })
        .select("_id patientType")
        .lean();

      const newPatientIds = new Set();
      for (const p of patients) {
        if (p.patientType === "New") {
          newPatientIds.add(p._id.toString());
        }
      }
      newPatientCount = newPatientIds.size;

      // Revenue for new patients: sum service prices of their appointments
      const newPatientAppointments = allAppointments.filter((apt) => {
        const pid = apt.patientId?.toString();
        return pid && newPatientIds.has(pid);
      });
      newPatientRevenue = sumBillingForAppointments(newPatientAppointments, billingMap);
    }

    // ── Returning patients: cancelled appointments ──
    const cancelledAppointments = allAppointments.filter((apt) => apt.status === "Cancelled");
    const cancelledPatientSet = new Set();
    for (const apt of cancelledAppointments) {
      if (apt.patientId) {
        cancelledPatientSet.add(apt.patientId.toString());
      }
    }
    const cancelledPatientCount = cancelledPatientSet.size;
    const cancelledRevenue = sumBillingForAppointments(cancelledAppointments, billingMap);

    // ── Packages expiring on selected date ──
    // Check packages array in PatientRegistration where endDate falls on selected date
    const patientsWithPackages = await PatientRegistration.find({
      clinicId: clinicObjectId,
      "packages.endDate": { $gte: dayStart, $lte: dayEnd },
    })
      .select("packages")
      .lean();

    let expiringPackageCount = 0;
    let expiringPackageRevenue = 0;
    for (const patient of patientsWithPackages) {
      if (Array.isArray(patient.packages)) {
        for (const pkg of patient.packages) {
          if (pkg.endDate && pkg.endDate >= dayStart && pkg.endDate <= dayEnd) {
            expiringPackageCount++;
            expiringPackageRevenue += pkg.totalPrice || 0;
          }
        }
      }
    }

    // ── Referrals: patients with referredBy who have appointments on selected date ──
    const referredPatients = await PatientRegistration.find({
      clinicId: clinicObjectId,
      referredBy: { $exists: true, $ne: "", $ne: null },
    })
      .select("_id")
      .lean();

    const referredPatientIds = new Set(referredPatients.map((p) => p._id.toString()));

    // Filter appointments for referred patients
    const referralAppointments = allAppointments.filter((apt) => {
      const pid = apt.patientId?.toString();
      return pid && referredPatientIds.has(pid);
    });

    const referralCount = new Set(referralAppointments.map((apt) => apt.patientId?.toString())).size;
    const referralRevenue = sumBillingForAppointments(referralAppointments, billingMap);

    // ── Why Revenue Changed metrics (current day) ──
    const completedAppointments = allAppointments.filter((apt) => apt.status === "Completed");
    const completedVisitCount = completedAppointments.length;
    const noShowCount = allAppointments.filter((apt) => apt.status === "No Show").length;

    // Average bill: average Billing.paid for appointments on selected date
    const allBillingRecords = await Billing.find({
      clinicId: clinicObjectId,
      appointmentId: { $in: allAppointmentIds },
    })
      .select("paid")
      .lean();

    let totalPaid = 0;
    let paidCount = 0;
    for (const bill of allBillingRecords) {
      if (bill.paid > 0) {
        totalPaid += bill.paid;
        paidCount++;
      }
    }
    const averageBill = paidCount > 0 ? Math.round(totalPaid / paidCount) : 0;

    // Package sales: packages with paymentStatus "Full" assigned on selected date
    const patientsWithFullPackages = await PatientRegistration.find({
      clinicId: clinicObjectId,
      "packages.paymentStatus": "Full",
      "packages.assignedDate": { $gte: dayStart, $lte: dayEnd },
    })
      .select("packages")
      .lean();

    let packageSalesCount = 0;
    for (const patient of patientsWithFullPackages) {
      if (Array.isArray(patient.packages)) {
        for (const pkg of patient.packages) {
          if (
            pkg.paymentStatus === "Full" &&
            pkg.assignedDate &&
            pkg.assignedDate >= dayStart &&
            pkg.assignedDate <= dayEnd
          ) {
            packageSalesCount++;
          }
        }
      }
    }

    // ── Previous day data for comparison ──
    const prevDate = new Date(targetDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const { start: prevDayStart, end: prevDayEnd } = getDayRange(prevDate);

    const prevAppointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: prevDayStart, $lte: prevDayEnd },
    })
      .select("patientId status")
      .lean();

    const prevCompletedCount = prevAppointments.filter((apt) => apt.status === "Completed").length;
    const prevNoShowCount = prevAppointments.filter((apt) => apt.status === "No Show").length;
    const prevCancelledCount = new Set(
      prevAppointments.filter((apt) => apt.status === "Cancelled").map((apt) => apt.patientId?.toString())
    ).size;

    const prevAppointmentIds = prevAppointments.map((a) => a._id);
    const prevBillingRecords = await Billing.find({
      clinicId: clinicObjectId,
      appointmentId: { $in: prevAppointmentIds },
    })
      .select("paid")
      .lean();

    let prevTotalPaid = 0;
    let prevPaidCount = 0;
    for (const bill of prevBillingRecords) {
      if (bill.paid > 0) {
        prevTotalPaid += bill.paid;
        prevPaidCount++;
      }
    }
    const prevAverageBill = prevPaidCount > 0 ? Math.round(prevTotalPaid / prevPaidCount) : 0;

    // Previous day package sales
    const prevPatientsWithFullPackages = await PatientRegistration.find({
      clinicId: clinicObjectId,
      "packages.paymentStatus": "Full",
      "packages.assignedDate": { $gte: prevDayStart, $lte: prevDayEnd },
    })
      .select("packages")
      .lean();

    let prevPackageSalesCount = 0;
    for (const patient of prevPatientsWithFullPackages) {
      if (Array.isArray(patient.packages)) {
        for (const pkg of patient.packages) {
          if (
            pkg.paymentStatus === "Full" &&
            pkg.assignedDate &&
            pkg.assignedDate >= prevDayStart &&
            pkg.assignedDate <= prevDayEnd
          ) {
            prevPackageSalesCount++;
          }
        }
      }
    }

    // Calculate percentage changes
    function calcChange(current, previous) {
      if (previous === 0 && current === 0) return 0;
      if (previous === 0) return 100;
      return Math.round(((current - previous) / previous) * 100);
    }

    const completedVisitsChange = calcChange(completedVisitCount, prevCompletedCount);
    const averageBillChange = calcChange(averageBill, prevAverageBill);
    const noShowsChange = calcChange(noShowCount, prevNoShowCount);
    const packageSalesChange = calcChange(packageSalesCount, prevPackageSalesCount);
    const returningPatientsChange = calcChange(cancelledPatientCount, prevCancelledCount);

    const totalRevenue = newPatientRevenue + cancelledRevenue + expiringPackageRevenue + referralRevenue + existingServiceRevenue;

    return res.status(200).json({
      success: true,
      data: {
        newPatientCount,
        newPatientRevenue,
        returningPatientCount: cancelledPatientCount,
        returningPatientRevenue: cancelledRevenue,
        expiringPackageCount,
        expiringPackageRevenue,
        referralCount,
        referralRevenue,
        existingServiceCount,
        existingServiceRevenue,
        totalPatientCount: uniquePatientIds.length,
        totalRevenue,
        // Why Revenue Changed
        completedVisitCount,
        completedVisitsChange,
        averageBill,
        averageBillChange,
        noShowCount,
        noShowsChange,
        packageSalesCount,
        packageSalesChange,
        returningPatientsChange,
      },
    });
  } catch (err) {
    console.error("Error in business-intelligence:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

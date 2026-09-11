import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import Billing from "../../../models/Billing";
import PatientRegistration from "../../../models/PatientRegistration";
import Package from "../../../models/Package";
import Service from "../../../models/Service";
import Clinic from "../../../models/Clinic";
import Lead from "../../../models/Lead";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

/**
 * GET /api/clinic/revenue-leakage?date=YYYY-MM-DD
 *
 * Calculates revenue leakage metrics:
 *   - unbilledServices: appointments with services but no billing record
 *   - uncollectedBalances: billed appointments with pending > 0
 *   - missedRebooking: rescheduled yesterday but not booked today
 *   - packageLeakage: partial-payment packages where package price > paid price
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
    if (!authUser) return res.status(401).json({ success: false, message: "Unauthorized" });

    // 2. AuthZ
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(authUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(authUser);
    if (error && !isAdmin) return res.status(404).json({ message: error });

    if (!clinicId && authUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: authUser._id }).select("_id");
      if (!clinic) return res.status(404).json({ success: false, message: "Clinic not found" });
      clinicId = clinic._id;
    }
    if (!clinicId) return res.status(404).json({ success: false, message: "Clinic not found" });

    const clinicObjectId = new mongoose.Types.ObjectId(clinicId.toString());

    // 3. Parse date
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const { start: dayStart, end: dayEnd } = getDayRange(targetDate);

    // ── Load service price map for unbilled valuation ──
    const allServices = await Service.find({ clinicId: clinicObjectId }).select("_id price clinicPrice name").lean();
    const servicePriceMap = {};
    const serviceNameMap = {};
    for (const svc of allServices) {
      const sid = svc._id.toString();
      servicePriceMap[sid] = svc.clinicPrice != null ? svc.clinicPrice : svc.price;
      serviceNameMap[sid] = svc.name;
    }

    // ── Get all appointments for selected date ──
    const todayAppointments = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: dayStart, $lte: dayEnd },
    }).select("patientId status services serviceIds serviceId").lean();

    const todayAppointmentIds = todayAppointments.map((a) => a._id);

    // ════════════════════════════════════════════════════════════════════
    // 1. UNBILLED SERVICES: appointments with services but no billing
    // ════════════════════════════════════════════════════════════════════
    const billedAppointmentIds = new Set();
    const billings = await Billing.find({
      clinicId: clinicObjectId,
      appointmentId: { $in: todayAppointmentIds },
    }).select("appointmentId patientId amount paid pending").lean();

    for (const bill of billings) {
      if (bill.appointmentId) billedAppointmentIds.add(bill.appointmentId.toString());
    }

    const unbilledAppointments = todayAppointments.filter((apt) => {
      const aid = apt._id.toString();
      const hasServices = (Array.isArray(apt.services) && apt.services.length > 0) ||
        (Array.isArray(apt.serviceIds) && apt.serviceIds.length > 0) ||
        apt.serviceId;
      return hasServices && !billedAppointmentIds.has(aid);
    });

    let unbilledAmount = 0;
    const unbilledDetails = [];
    for (const apt of unbilledAppointments) {
      let aptServiceValue = 0;
      const serviceNames = [];
      // From services array
      if (Array.isArray(apt.services) && apt.services.length > 0) {
        for (const s of apt.services) {
          if (s.serviceId) {
            const sid = s.serviceId.toString();
            aptServiceValue += (servicePriceMap[sid] || 0) * (s.quantity || 1);
            if (serviceNameMap[sid]) serviceNames.push(serviceNameMap[sid]);
          }
        }
      }
      // From serviceIds array
      if (Array.isArray(apt.serviceIds) && apt.serviceIds.length > 0) {
        for (const sid of apt.serviceIds) {
          if (sid) {
            const sidStr = sid.toString();
            const alreadyCounted = Array.isArray(apt.services) && apt.services.some(
              (s) => s.serviceId?.toString() === sidStr
            );
            if (!alreadyCounted) {
              aptServiceValue += servicePriceMap[sidStr] || 0;
              if (serviceNameMap[sidStr]) serviceNames.push(serviceNameMap[sidStr]);
            }
          }
        }
      }
      // From single serviceId
      if (apt.serviceId && (!Array.isArray(apt.services) || apt.services.length === 0) && (!Array.isArray(apt.serviceIds) || apt.serviceIds.length === 0)) {
        const sidStr = apt.serviceId.toString();
        aptServiceValue += servicePriceMap[sidStr] || 0;
        if (serviceNameMap[sidStr]) serviceNames.push(serviceNameMap[sidStr]);
      }
      unbilledAmount += aptServiceValue;
      unbilledDetails.push({
        appointmentId: apt._id.toString(),
        patientId: apt.patientId?.toString() || "",
        services: serviceNames.join(", ") || "Unknown",
        amount: aptServiceValue,
        status: apt.status,
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // 2. UNCOLLECTED BALANCES: billed appointments with pending > 0
    // ════════════════════════════════════════════════════════════════════
    let uncollectedAmount = 0;
    const uncollectedDetails = [];
    for (const bill of billings) {
      if (bill.pending > 0) {
        uncollectedAmount += bill.pending;
        uncollectedDetails.push({
          billingId: bill._id.toString(),
          appointmentId: bill.appointmentId?.toString() || "",
          patientId: bill.patientId?.toString() || "",
          amount: bill.amount || 0,
          paid: bill.paid || 0,
          pending: bill.pending || 0,
        });
      }
    }

    // ── Resolve patient names for unbilled + uncollected ──
    const allPatientIds = new Set();
    for (const d of unbilledDetails) { if (d.patientId) allPatientIds.add(d.patientId); }
    for (const d of uncollectedDetails) { if (d.patientId) allPatientIds.add(d.patientId); }

    const patientNameMap = {};
    if (allPatientIds.size > 0) {
      const patients = await PatientRegistration.find({
        _id: { $in: Array.from(allPatientIds).map((id) => new mongoose.Types.ObjectId(id)) },
      }).select("_id firstName lastName").lean();
      for (const p of patients) {
        patientNameMap[p._id.toString()] = `${p.firstName || ""} ${p.lastName || ""}`.trim() || "Unknown";
      }
    }

    for (const d of unbilledDetails) {
      d.patientName = patientNameMap[d.patientId] || "Unknown";
    }
    for (const d of uncollectedDetails) {
      d.patientName = patientNameMap[d.patientId] || "Unknown";
    }

    // ════════════════════════════════════════════════════════════════════
    // 3. MISSED REBOOKING: rescheduled yesterday, not booked today
    // ════════════════════════════════════════════════════════════════════
    const prevDate = new Date(targetDate);
    prevDate.setUTCDate(prevDate.getUTCDate() - 1);
    const { start: prevDayStart, end: prevDayEnd } = getDayRange(prevDate);

    const yesterdayRescheduled = await Appointment.find({
      clinicId: clinicObjectId,
      startDate: { $gte: prevDayStart, $lte: prevDayEnd },
      status: "Rescheduled",
    }).select("patientId").lean();

    const rescheduledPatientIds = new Set(yesterdayRescheduled.map((a) => a.patientId?.toString()));

    // Check which rescheduled patients have appointments today
    const todayPatientIds = new Set(todayAppointments.map((a) => a.patientId?.toString()));

    const missedRebookingPatients = [];
    for (const pid of rescheduledPatientIds) {
      if (pid && !todayPatientIds.has(pid)) {
        missedRebookingPatients.push(pid);
      }
    }

    // Estimate missed revenue: average service price * missed count
    const missedRebookingCount = missedRebookingPatients.length;
    // Use average billing amount as estimate
    let avgServicePrice = 0;
    if (billings.length > 0) {
      const totalBillingAmount = billings.reduce((sum, b) => sum + (b.amount || 0), 0);
      avgServicePrice = Math.round(totalBillingAmount / billings.length);
    }
    const missedRebookingAmount = missedRebookingCount * avgServicePrice;

    // ════════════════════════════════════════════════════════════════════
    // 4. PACKAGE LEAKAGE: partial-payment packages where price > paid
    // ════════════════════════════════════════════════════════════════════
    const partialPackagePatients = await PatientRegistration.find({
      clinicId: clinicObjectId,
      "packages.paymentStatus": "Partial",
      "packages.assignedDate": { $gte: dayStart, $lte: dayEnd },
    }).select("firstName lastName mobileNumber packages").lean();

    let packageLeakageAmount = 0;
    const packageLeakageDetails = [];

    // Get all package IDs for lookup
    const allPackageIds = new Set();
    for (const patient of partialPackagePatients) {
      if (Array.isArray(patient.packages)) {
        for (const pkg of patient.packages) {
          if (
            pkg.paymentStatus === "Partial" &&
            pkg.packageId &&
            pkg.assignedDate &&
            pkg.assignedDate >= dayStart &&
            pkg.assignedDate <= dayEnd
          ) {
            allPackageIds.add(pkg.packageId.toString());
          }
        }
      }
    }

    // Load package master data
    const packagePriceMap = {};
    if (allPackageIds.size > 0) {
      const packages = await Package.find({
        _id: { $in: Array.from(allPackageIds).map((id) => new mongoose.Types.ObjectId(id)) },
      }).select("_id name totalPrice").lean();
      for (const pkg of packages) {
        packagePriceMap[pkg._id.toString()] = { name: pkg.name, totalPrice: pkg.totalPrice };
      }
    }

    for (const patient of partialPackagePatients) {
      if (Array.isArray(patient.packages)) {
        for (const pkg of patient.packages) {
          if (
            pkg.paymentStatus === "Partial" &&
            pkg.assignedDate &&
            pkg.assignedDate >= dayStart &&
            pkg.assignedDate <= dayEnd
          ) {
            const pkgId = pkg.packageId?.toString();
            const masterData = packagePriceMap[pkgId];
            const masterPrice = masterData?.totalPrice || pkg.totalPrice || 0;
            const paidAmount = pkg.paidAmount || 0;
            const leakage = masterPrice - paidAmount;

            if (leakage > 0) {
              packageLeakageAmount += leakage;
              packageLeakageDetails.push({
                patientId: patient._id.toString(),
                patientName: `${patient.firstName || ""} ${patient.lastName || ""}`.trim() || "Unknown",
                mobile: patient.mobileNumber || "",
                packageName: masterData?.name || pkg.packageName || "Unknown",
                masterPrice,
                paidAmount,
                leakage,
              });
            }
          }
        }
      }
    }

    // ── Total leakage ──
    const totalLeakage = unbilledAmount + uncollectedAmount + missedRebookingAmount + packageLeakageAmount;

    // ════════════════════════════════════════════════════════════════════
    // PATIENT JOURNEY FUNNEL METRICS
    // ════════════════════════════════════════════════════════════════════

    // 1. Lead: count leads created on selected date
    const leadCount = await Lead.countDocuments({
      clinicId: clinicObjectId,
      createdAt: { $gte: dayStart, $lte: dayEnd },
    });

    // 2. Booking: total appointments booked on selected date
    const bookingCount = todayAppointments.length;

    // 3. Visit: appointments with status "Arrived" on selected date
    const visitCount = todayAppointments.filter((apt) => apt.status === "Arrived").length;

    // 4. Treatment: appointments that have treatments/services added
    const treatmentCount = todayAppointments.filter((apt) => {
      const hasServices = (Array.isArray(apt.services) && apt.services.length > 0) ||
        (Array.isArray(apt.serviceIds) && apt.serviceIds.length > 0) ||
        apt.serviceId;
      return hasServices;
    }).length;

    // 5. Package: packages sold on selected date (from PatientRegistration)
    const patientsWithPackages = await PatientRegistration.find({
      clinicId: clinicObjectId,
      "packages.assignedDate": { $gte: dayStart, $lte: dayEnd },
    }).select("packages").lean();

    let packageCount = 0;
    for (const patient of patientsWithPackages) {
      if (Array.isArray(patient.packages)) {
        for (const pkg of patient.packages) {
          if (pkg.assignedDate && pkg.assignedDate >= dayStart && pkg.assignedDate <= dayEnd) {
            packageCount++;
          }
        }
      }
    }

    // 6. Repeat visit: patients who have multiple appointments (booked repeatedly)
    // Check all appointments for the clinic and find patients with more than 1 appointment
    const allAppointments = await Appointment.find({
      clinicId: clinicObjectId,
    }).select("patientId").lean();

    const patientAppointmentCount = {};
    for (const apt of allAppointments) {
      const pid = apt.patientId?.toString();
      if (pid) {
        patientAppointmentCount[pid] = (patientAppointmentCount[pid] || 0) + 1;
      }
    }

    // Count patients with more than 1 appointment who also have appointments today
    const todayPatientSet = new Set(todayAppointments.map((a) => a.patientId?.toString()));
    let repeatVisitCount = 0;
    for (const pid of todayPatientSet) {
      if (pid && patientAppointmentCount[pid] > 1) {
        repeatVisitCount++;
      }
    }

    // Calculate percentages relative to the highest funnel step value
    const allCounts = [leadCount, bookingCount, visitCount, treatmentCount, packageCount, repeatVisitCount];
    const maxCount = Math.max(...allCounts, 1); // at least 1 to avoid division by zero
    const getPercent = (value) => Math.round((value / maxCount) * 100);

    // Status breakdown for booking
    const statusCounts = {};
    for (const apt of todayAppointments) {
      const s = apt.status || "Unknown";
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    return res.status(200).json({
      success: true,
      data: {
        unbilledAmount,
        unbilledCount: unbilledAppointments.length,
        uncollectedAmount,
        uncollectedCount: uncollectedDetails.length,
        missedRebookingCount,
        missedRebookingAmount,
        packageLeakageAmount,
        packageLeakageCount: packageLeakageDetails.length,
        totalLeakage,
        // Details for modal
        unbilledDetails,
        uncollectedDetails,
        missedRebookingPatients,
        packageLeakageDetails,
        // Funnel metrics
        funnel: {
          leadCount,
          bookingCount,
          visitCount,
          treatmentCount,
          packageCount,
          repeatVisitCount,
          leadPercent: getPercent(leadCount),
          bookingPercent: getPercent(bookingCount),
          visitPercent: getPercent(visitCount),
          treatmentPercent: getPercent(treatmentCount),
          packagePercent: getPercent(packageCount),
          repeatPercent: getPercent(repeatVisitCount),
          statusCounts,
        },
      },
    });
  } catch (err) {
    console.error("Error in revenue-leakage:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal Server Error" });
  }
}

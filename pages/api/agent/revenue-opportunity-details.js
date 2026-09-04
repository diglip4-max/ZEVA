import mongoose from "mongoose";
import dbConnect from "../../../lib/database";
import Appointment from "../../../models/Appointment";
import PatientRegistration from "../../../models/PatientRegistration";
import Service from "../../../models/Service";
import User from "../../../models/Users";
import Billing from "../../../models/Billing";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";

/**
 * GET /api/agent/revenue-opportunity-details
 *
 * Returns the per-line breakdown that makes up today's revenue opportunity:
 *   1. Today's appointments in this clinic that have a treatment selected
 *      (each row = appointment time, patient, status, treatment, price)
 *   2. Expired packages across patients in this clinic
 *      (each row = patient, package name, expired date, total price)
 *
 * Query parameters (all optional):
 *   appointmentLimit (default 100, max 500)
 *   packageLimit    (default 100, max 500)
 *
 * Performance:
 *   - Patient names are joined server-side via $lookup (no client-side N+1)
 *   - Doctor names joined via $lookup on User
 *   - Service prices resolved in a single bulk Service.find call
 *   - Expired packages returned as a separate flat list (small dataset)
 */

const NON_REVENUE_STATUSES = ["Cancelled", "Rejected", "No Show"];
const NON_EXPIRED_PACKAGE_STATUSES = ["Cancelled"];

const MAX_APPOINTMENT_LIMIT = 500;
const MAX_PACKAGE_LIMIT = 500;

/** Parse a YYYY-MM-DD string into a Date, or return null if invalid. */
function parseDateInput(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** Returns UTC start-of-day and end-of-day for a given Date. */
function getDayRange(dateObj) {
  const start = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 0, 0, 0, 0),
  );
  const end = new Date(
    Date.UTC(dateObj.getUTCFullYear(), dateObj.getUTCMonth(), dateObj.getUTCDate(), 23, 59, 59, 999),
  );
  return { start, end };
}

/** Returns the day-range pair for "today" (UTC). */
function getTodayRange() {
  return getDayRange(new Date());
}

function clampInt(raw, fallback, max) {
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, max);
}

async function resolveClinicId(req, me) {
  if (me.role === "admin") {
    const qClinicId = req.query.clinicId;
    if (!qClinicId) return { error: { status: 400, message: "Admin must provide clinicId" } };
    if (!mongoose.Types.ObjectId.isValid(qClinicId)) {
      return { error: { status: 400, message: "Invalid clinicId" } };
    }
    return { clinicId: qClinicId };
  }
  // Clinic role: clinic is found by owner, not by user.clinicId
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
    if (!clinic) {
      return { error: { status: 403, message: "Clinic not found for this user" } };
    }
    return { clinicId: clinic._id.toString() };
  }
  if (!me.clinicId) return { error: { status: 403, message: "User not linked to a clinic" } };
  return { clinicId: me.clinicId.toString() };
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    await dbConnect();

    // 1. AuthN
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // 2. AuthZ
    const allowedRoles = ["agent", "doctorStaff", "doctor", "staff", "admin", "clinic"];
    if (!allowedRoles.includes(me.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // 3. Resolve clinicId
    const resolved = await resolveClinicId(req, me);
    if (resolved.error) {
      return res
        .status(resolved.error.status)
        .json({ success: false, message: resolved.error.message });
    }
    const clinicObjectId = new mongoose.Types.ObjectId(resolved.clinicId);

    // 4. Limits
    const appointmentLimit = clampInt(
      req.query.appointmentLimit,
      100,
      MAX_APPOINTMENT_LIMIT,
    );
    const packageLimit = clampInt(req.query.packageLimit, 100, MAX_PACKAGE_LIMIT);

    // Resolve target date from query string (defaults to today)
    const requestedDate = parseDateInput(req.query.date);
    const targetDate = requestedDate || new Date();
    const now = new Date();
    const today = new Date();
    const isToday =
      targetDate.getUTCFullYear() === today.getUTCFullYear() &&
      targetDate.getUTCMonth() === today.getUTCMonth() &&
      targetDate.getUTCDate() === today.getUTCDate();
    const { start: startOfTarget, end: endOfTarget } = getDayRange(targetDate);
    // Backwards-compat aliases (other parts of the function still use these names)
    const startOfToday = startOfTarget;
    const endOfToday = endOfTarget;

    // 4b. Role-based scope for appointment revenue.
    // `doctorStaff` and `doctor` see only appointments booked under their own
    // `doctorId` (i.e. themselves). `agent` / `staff` / `admin` see all
    // appointments in the clinic. Expired-package list is NEVER filtered by
    // doctor — packages are patient-level, not doctor-level.
    const doctorScopedRoles = ["doctorStaff", "doctor"];
    const isDoctorScoped = doctorScopedRoles.includes(me.role);
    const doctorMatchStage = isDoctorScoped
      ? [{ $match: { doctorId: me._id } }]
      : [];

    // 5. Parallel data fetch
    const [appointmentsAgg, expiredPackagesAgg, todaysBillingsAgg] = await Promise.all([
      // 5a. Today's appointments with treatment/service, joined with patient + doctor.
      // "Treatment selected" = (a) `treatment` text non-empty, (b) `serviceId`
      // is set, or (c) `services.0` exists. Real-world appointments frequently
      // use serviceId/services without populating the free-text `treatment`.
      Appointment.aggregate([
        {
          $match: {
            clinicId: clinicObjectId,
            startDate: { $gte: startOfToday, $lte: endOfToday },
            status: { $nin: NON_REVENUE_STATUSES },
            $or: [
              { treatment: { $exists: true, $nin: ["", null] } },
              { serviceId: { $exists: true, $ne: null } },
              { "services.0": { $exists: true } },
            ],
          },
        },
        // Apply role-based doctor filter right after the initial $match
        ...doctorMatchStage,
        { $sort: { startDate: 1, fromTime: 1 } },
        { $limit: appointmentLimit },
        {
          $lookup: {
            from: "patientregistrations",
            localField: "patientId",
            foreignField: "_id",
            as: "patient",
          },
        },
        { $unwind: { path: "$patient", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "users",
            localField: "doctorId",
            foreignField: "_id",
            as: "doctor",
          },
        },
        { $unwind: { path: "$doctor", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 1,
            startDate: 1,
            fromTime: 1,
            toTime: 1,
            status: 1,
            treatment: 1,
            serviceId: 1,
            services: 1,
            patientName: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ["$patient.firstName", ""] },
                    " ",
                    { $ifNull: ["$patient.lastName", ""] },
                  ],
                },
              },
            },
            patientMobile: { $ifNull: ["$patient.mobileNumber", ""] },
            doctorName: { $ifNull: ["$doctor.name", ""] },
          },
        },
      ]),

      // 5b. Expired packages: patient + per-package detail, filtered & limited
      PatientRegistration.aggregate([
        { $match: { clinicId: clinicObjectId } },
        { $unwind: "$packages" },
        {
          $match: {
            "packages.endDate": { $lt: now, $ne: null },
            "packages.paymentStatus": { $nin: NON_EXPIRED_PACKAGE_STATUSES },
          },
        },
        // Limit BEFORE the per-package rename to keep the response small
        { $limit: packageLimit },
        {
          $project: {
            _id: 0,
            patientRegistrationId: "$_id",
            patientName: {
              $trim: {
                input: {
                  $concat: [
                    { $ifNull: ["$firstName", ""] },
                    " ",
                    { $ifNull: ["$lastName", ""] },
                  ],
                },
              },
            },
            patientMobile: { $ifNull: ["$mobileNumber", ""] },
            packageId: "$packages.packageId",
            packageName: { $ifNull: ["$packages.packageName", "Package"] },
            assignedDate: "$packages.assignedDate",
            startDate: "$packages.startDate",
            endDate: "$packages.endDate",
            totalPrice: { $ifNull: ["$packages.totalPrice", 0] },
            paidAmount: { $ifNull: ["$packages.paidAmount", 0] },
            paymentStatus: { $ifNull: ["$packages.paymentStatus", "Unpaid"] },
          },
        },
        { $sort: { endDate: 1 } },
      ]),

      // 5c. Today's billings for the clinic — used to determine whether
      // each appointment has been Paid and each expired package has been
      // Recovered. Uses $expr+$ifNull to safely fall back to createdAt
      // for legacy records that lack invoicedDate.
      Billing.aggregate([
        {
          $match: {
            clinicId: clinicObjectId,
            $expr: {
              $and: [
                {
                  $gte: [
                    { $ifNull: ["$invoicedDate", "$createdAt"] },
                    startOfToday,
                  ],
                },
                {
                  $lte: [
                    { $ifNull: ["$invoicedDate", "$createdAt"] },
                    endOfToday,
                  ],
                },
              ],
            },
          },
        },
        {
          $project: {
            appointmentId: 1,
            packageId: 1,
            unpaidPackagesPaid: 1,
            paid: { $ifNull: ["$paid", 0] },
            amount: { $ifNull: ["$amount", 0] },
          },
        },
      ]),
    ]);

    // 5d. Build lookup maps for "Paid" (appointments) and "Recovered" (packages)
    // A billing is considered effective only if it has any paid amount > 0.
    // Cancelled / zero-paid billings do NOT count.
    const paidAppointmentIds = new Set();
    const paidAppointmentAmount = new Map();
    const recoveredPackageIds = new Set();
    const recoveredPackageAmount = new Map();

    for (const b of todaysBillingsAgg) {
      const paid = Number(b.paid || 0);
      if (paid <= 0) continue;

      if (b.appointmentId) {
        const id = b.appointmentId.toString();
        paidAppointmentIds.add(id);
        paidAppointmentAmount.set(
          id,
          (paidAppointmentAmount.get(id) || 0) + paid,
        );
      }

      // Package recovery: check BOTH the top-level `packageId` AND any
      // entries in `unpaidPackagesPaid[]` (used by package-billing flows
      // that record previously-unpaid packages now being paid).
      const packageIdsToMark = [];
      if (b.packageId) packageIdsToMark.push(b.packageId.toString());
      if (Array.isArray(b.unpaidPackagesPaid)) {
        for (const u of b.unpaidPackagesPaid) {
          if (u && u.packageId) packageIdsToMark.push(u.packageId.toString());
        }
      }
      for (const pkgId of packageIdsToMark) {
        recoveredPackageIds.add(pkgId);
        recoveredPackageAmount.set(
          pkgId,
          (recoveredPackageAmount.get(pkgId) || 0) + paid,
        );
      }
    }

    // 6. Bulk price lookup for appointments
    const serviceIdSet = new Set();
    const treatmentNameSet = new Set();
    for (const appt of appointmentsAgg) {
      if (appt.serviceId) serviceIdSet.add(appt.serviceId.toString());
      if (Array.isArray(appt.services)) {
        for (const s of appt.services) {
          if (s && s.serviceId) serviceIdSet.add(s.serviceId.toString());
        }
      }
      if (appt.treatment) treatmentNameSet.add(appt.treatment);
    }

    const serviceIds = [...serviceIdSet];
    const treatmentNames = [...treatmentNameSet];

    const services = await Service.find({
      clinicId: clinicObjectId,
      $or: [
        ...(serviceIds.length > 0 ? [{ _id: { $in: serviceIds } }] : [{ _id: null }]),
        ...(treatmentNames.length > 0 ? [{ name: { $in: treatmentNames } }] : [{ name: null }]),
      ],
      isActive: { $ne: false },
      isDeleted: { $ne: true },
    })
      .select("name price clinicPrice")
      .lean();

    const priceById = new Map();
    const priceByName = new Map();
    const nameById = new Map();
    for (const svc of services) {
      const price = Number(svc.clinicPrice ?? svc.price ?? 0);
      if (Number.isFinite(price) && price >= 0) {
        priceById.set(svc._id.toString(), price);
        priceByName.set(svc.name, price);
      }
      if (svc.name) nameById.set(svc._id.toString(), svc.name);
    }

    // 7. Resolve price + display name per appointment
    const resolveAppointment = (appt) => {
      if (appt.serviceId) {
        const id = appt.serviceId.toString();
        if (priceById.has(id)) {
          return { price: priceById.get(id), serviceName: nameById.get(id) || "" };
        }
      }
      if (Array.isArray(appt.services) && appt.services.length > 0) {
        for (const s of appt.services) {
          if (s && s.serviceId) {
            const id = s.serviceId.toString();
            if (priceById.has(id)) {
              return { price: priceById.get(id), serviceName: nameById.get(id) || "" };
            }
          }
        }
      }
      if (appt.treatment && priceByName.has(appt.treatment)) {
        return { price: priceByName.get(appt.treatment), serviceName: appt.treatment };
      }
      return { price: 0, serviceName: "" };
    };

    // 8. Shape the appointment rows for the UI
    let paidAppointmentCount = 0;
    let paidAppointmentRevenue = 0;
    const appointmentRows = appointmentsAgg.map((appt) => {
      const { price, serviceName } = resolveAppointment(appt);
      // Display "treatment" as: free-text field, or serviceName we resolved
      const displayTreatment = (appt.treatment && appt.treatment.trim()) || serviceName || "";
      const apptIdStr = (appt._id?.toString?.() || appt._id || "").toString();
      const isPaid = paidAppointmentIds.has(apptIdStr);
      const recoveredAmt = Number(paidAppointmentAmount.get(apptIdStr) || 0);
      // Recovery status precedence: Paid > Pending (billing exists but
      // not yet paid in full) > Not Billed.
      const billingStatus = isPaid ? "Paid" : "Not Billed";
      if (isPaid) {
        paidAppointmentCount += 1;
        paidAppointmentRevenue += recoveredAmt;
      }
      return {
        id: apptIdStr,
        date: appt.startDate,
        fromTime: appt.fromTime || "",
        toTime: appt.toTime || "",
        patientName: appt.patientName || "Unknown patient",
        patientMobile: appt.patientMobile || "",
        doctorName: appt.doctorName || "",
        status: appt.status || "",
        treatment: displayTreatment,
        serviceName,
        price: Number(price.toFixed(2)),
        billingStatus,
        paidAmount: Number(recoveredAmt.toFixed(2)),
        type: "appointment",
      };
    });

    const appointmentTotal = appointmentRows.reduce((s, r) => s + r.price, 0);

    // 9. Shape the expired package rows for the UI
    let recoveredPackageCount = 0;
    let recoveredPackageRevenue = 0;
    const packageRows = expiredPackagesAgg.map((p) => {
      const pkgIdStr = p.packageId ? p.packageId.toString() : "";
      const isRecovered = pkgIdStr ? recoveredPackageIds.has(pkgIdStr) : false;
      const recoveredAmt = pkgIdStr
        ? Number(recoveredPackageAmount.get(pkgIdStr) || 0)
        : 0;
      const billingStatus = isRecovered ? "Recovered" : "Expired";
      if (isRecovered) {
        recoveredPackageCount += 1;
        recoveredPackageRevenue += recoveredAmt;
      }
      return {
        id: `${p.patientRegistrationId}-${p.packageId || p.packageName}`,
        patientName: p.patientName || "Unknown patient",
        patientMobile: p.patientMobile || "",
        packageName: p.packageName || "Package",
        endDate: p.endDate,
        assignedDate: p.assignedDate,
        totalPrice: Number(Number(p.totalPrice || 0).toFixed(2)),
        paidAmount: Number(Number(p.paidAmount || 0).toFixed(2)),
        paymentStatus: p.paymentStatus || "Unpaid",
        billingStatus,
        recoveredAmount: Number(recoveredAmt.toFixed(2)),
        type: "expiredPackage",
      };
    });

    const expiredPackageTotal = packageRows.reduce((s, r) => s + r.totalPrice, 0);
    const totalRecovered = Number(
      (paidAppointmentRevenue + recoveredPackageRevenue).toFixed(2),
    );

    return res.status(200).json({
      success: true,
      data: {
        date: startOfTarget.toISOString().slice(0, 10),
        isToday,
        scope: isDoctorScoped ? "doctor" : "clinic",
        scopeNote: isDoctorScoped
          ? "Showing only appointments booked under you"
          : "Showing all clinic appointments",
        appointments: appointmentRows,
        expiredPackages: packageRows,
        totals: {
          appointmentCount: appointmentRows.length,
          appointmentTotal: Number(appointmentTotal.toFixed(2)),
          paidAppointmentCount,
          paidAppointmentRevenue: Number(paidAppointmentRevenue.toFixed(2)),
          expiredPackageCount: packageRows.length,
          expiredPackageTotal: Number(expiredPackageTotal.toFixed(2)),
          recoveredPackageCount,
          recoveredPackageRevenue: Number(recoveredPackageRevenue.toFixed(2)),
          totalRecovered,
          grandTotal: Number((appointmentTotal + expiredPackageTotal).toFixed(2)),
        },
        limits: {
          appointmentLimit,
          packageLimit,
        },
      },
    });
  } catch (err) {
    // console.error("[/api/agent/revenue-opportunity-details]", err);
    return res
      .status(500)
      .json({ success: false, message: err.message || "Internal Server Error" });
  }
}


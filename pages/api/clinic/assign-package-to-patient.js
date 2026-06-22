import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import Package from "../../../models/Package";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) return res.status(401).json({ success: false, message: "Unauthorized" });
    if (!["clinic", "doctor", "agent", "doctorStaff", "staff"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(user);
  if (clinicError || !clinicId) {
    return res.status(403).json({ success: false, message: clinicError || "Unable to determine clinic" });
  }

  const {
    patientId, packageId,
    validityInMonths, startDate, endDate,
    totalPrice, paidAmount, paymentStatus, paymentMethod,
    advanceBalanceUsed, claimAmountUsed,
    // Optional: client may pass full package data for snapshot (avoids DB round-trip race)
    packageName: bodyPackageName,
    packageTotalSessions: bodyTotalSessions,
    packageSessionPrice: bodySessionPrice,
    packageTreatments: bodyTreatments,
  } = req.body;
  if (!patientId || !packageId) {
    return res.status(400).json({ success: false, message: "patientId and packageId are required" });
  }

  try {
    // Verify the package belongs to this clinic
    const pkg = await Package.findOne({ _id: packageId, clinicId });
    if (!pkg) {
      return res.status(404).json({ success: false, message: "Package not found or does not belong to this clinic" });
    }

    // Verify the patient belongs to this clinic
    const patient = await PatientRegistration.findOne({ _id: patientId, clinicId });
    if (!patient) {
      return res.status(404).json({ success: false, message: "Patient not found or does not belong to this clinic" });
    }

    // Build an immutable snapshot of the package master data at time of assignment.
    // This ensures the patient retains full access to all package benefits (treatments,
    // sessions, prices) even if the clinic later deletes the package from services_setup.
    //
    // Priority: body-provided fields (sent by client right after package creation, always fresh)
    //           then pkg from DB (fallback if client didn't send them)
    const snapshotName       = bodyPackageName      || pkg.name        || '';
    const snapshotTotalPrice = totalPrice           ?? pkg.totalPrice  ?? 0;
    const snapshotTotalSess  = bodyTotalSessions    ?? pkg.totalSessions ?? 0;
    const snapshotSessPrice  = bodySessionPrice     ?? pkg.sessionPrice  ?? 0;
    const snapshotValidity   = validityInMonths     ?? pkg.validityInMonths ?? 0;
    const snapshotTreatments = Array.isArray(bodyTreatments) ? bodyTreatments
      : Array.isArray(pkg.treatments) ? pkg.treatments.map((t) => ({
          treatmentName: t.treatmentName || '',
          treatmentSlug: t.treatmentSlug || '',
          allocatedPrice: t.allocatedPrice || 0,
          sessions: t.sessions || 1,
          sessionPrice: t.sessionPrice || 0,
        }))
      : [];

    const packageSnapshot = {
      name: snapshotName,
      totalPrice: Number(snapshotTotalPrice) || 0,
      totalSessions: Number(snapshotTotalSess) || 0,
      sessionPrice: Number(snapshotSessPrice) || 0,
      validityInMonths: Number(snapshotValidity) || 0,
      startDate: startDate ? new Date(startDate) : (pkg.startDate || null),
      endDate: endDate ? new Date(endDate) : (pkg.endDate || null),
      treatments: snapshotTreatments,
      snapshotCreatedAt: new Date(),
    };

    const packageData = {
      packageId,
      packageName: snapshotName, // Use same resolved name as snapshot (body-first, DB-fallback)
      packageSoldBy: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Unknown', // Name of person who added package
      packageSoldByUserId: user._id, // User ID of the person who added package
      assignedDate: new Date(),
      validityInMonths: validityInMonths !== undefined ? parseInt(validityInMonths) : (pkg.validityInMonths || 0),
      startDate: startDate ? new Date(startDate) : (pkg.startDate || new Date()),
      endDate: endDate ? new Date(endDate) : (pkg.endDate || null),
      totalPrice: totalPrice !== undefined ? parseFloat(totalPrice) : (pkg.totalPrice || 0),
      paidAmount: paidAmount !== undefined ? parseFloat(paidAmount) : 0,
      paymentStatus: paymentStatus || "Unpaid",
      paymentMethod: paymentMethod || "",
      advanceBalanceUsed: advanceBalanceUsed !== undefined ? parseFloat(advanceBalanceUsed) : 0,
      claimAmountUsed: claimAmountUsed !== undefined ? parseFloat(claimAmountUsed) : 0,
      // Store immutable snapshot for resilience against master package deletion
      packageSnapshot,
    };

    // Push package to patient's packages array
    const updatedPatient = await PatientRegistration.findByIdAndUpdate(
      patientId,
      {
        $push: { packages: packageData },
        $set: { package: "Yes" },
      },
      { new: true }
    ).lean();

    return res.status(200).json({ 
      success: true, 
      message: "Package assigned to patient successfully",
      package: packageData 
    });
  } catch (error) {
    console.error("Error assigning package to patient:", error);
    return res.status(500).json({ success: false, message: "Failed to assign package to patient" });
  }
}

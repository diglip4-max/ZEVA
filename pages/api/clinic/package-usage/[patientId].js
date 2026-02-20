import dbConnect from "../../../../lib/database";
import Billing from "../../../../models/Billing";
import { getUserFromReq } from "../../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // Check if user has access (clinic, agent, doctorStaff, staff)
    if (!["clinic", "agent", "doctorStaff", "staff"].includes(clinicUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { patientId } = req.query;
    const { packageName } = req.query;

    if (!patientId) {
      return res.status(400).json({ success: false, message: "Patient ID is required" });
    }

    // Determine clinicId
    let clinicId;
    if (clinicUser.role === "clinic") {
      // For clinic role, find clinic by owner
      const Clinic = (await import("../../../../models/Clinic")).default;
      const clinic = await Clinic.findOne({ owner: clinicUser._id });
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    } else {
      // For agent, doctorStaff, staff - use clinicId from user
      clinicId = clinicUser.clinicId;
      if (!clinicId) {
        return res.status(403).json({ success: false, message: "User not linked to a clinic" });
      }
    }

    // Build query
    const query = {
      patientId: patientId,
      clinicId: clinicId,
      service: "Package",
    };

    // If packageName is provided, filter by it
    if (packageName) {
      query.package = packageName;
    }

    // Fetch all package billing records for this patient
    const billings = await Billing.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .select("package selectedPackageTreatments sessions createdAt invoiceNumber amount paid pending")
      .lean();

    // Fetch package definitions to get max sessions for each treatment
    const Package = (await import("../../../../models/Package")).default;
    const packageNames = [...new Set(billings.map(b => b.package).filter(Boolean))];
    const packageDefinitions = await Package.find({
      clinicId: clinicId,
      name: { $in: packageNames }
    }).select("name treatments").lean();

    // Create a map of package name to its treatment definitions
    const packageDefMap = {};
    packageDefinitions.forEach(pkg => {
      packageDefMap[pkg.name] = pkg.treatments || [];
    });

    // Aggregate usage by package and treatment
    const packageUsage = {};

    billings.forEach((billing) => {
      const pkgName = billing.package;
      if (!pkgName) return;

      if (!packageUsage[pkgName]) {
        packageUsage[pkgName] = {
          packageName: pkgName,
          treatments: {},
          totalSessions: 0,
          billingHistory: [],
        };
      }

      // Add to billing history
      packageUsage[pkgName].billingHistory.push({
        invoiceNumber: billing.invoiceNumber,
        sessions: billing.sessions || 0,
        date: billing.createdAt,
        amount: billing.amount || 0,
        paid: billing.paid || 0,
        pending: billing.pending || 0,
        treatments: billing.selectedPackageTreatments || [],
      });

      // Aggregate treatment sessions
      if (Array.isArray(billing.selectedPackageTreatments)) {
        billing.selectedPackageTreatments.forEach((treatment) => {
          const slug = treatment.treatmentSlug;
          if (!slug) return;

          if (!packageUsage[pkgName].treatments[slug]) {
            // Get max sessions from package definition
            const pkgTreatments = packageDefMap[pkgName] || [];
            const treatmentDef = pkgTreatments.find(t => t.treatmentSlug === slug);
            
            packageUsage[pkgName].treatments[slug] = {
              treatmentName: treatment.treatmentName,
              treatmentSlug: treatment.treatmentSlug,
              totalUsedSessions: 0,
              maxSessions: treatmentDef?.sessions || 0,
              usageDetails: [], // Track each billing's usage
            };
          }

          packageUsage[pkgName].treatments[slug].totalUsedSessions += treatment.sessions || 0;
          
          // Add usage detail for this billing
          packageUsage[pkgName].treatments[slug].usageDetails.push({
            invoiceNumber: billing.invoiceNumber,
            sessions: treatment.sessions || 0,
            date: billing.createdAt,
          });
        });
      }

      packageUsage[pkgName].totalSessions += billing.sessions || 0;
    });

    // Convert treatments object to array
    Object.keys(packageUsage).forEach((pkgName) => {
      packageUsage[pkgName].treatments = Object.values(packageUsage[pkgName].treatments);
    });

    // Apply transferred allowances if present
    const PatientRegistration = (await import("../../../../models/PatientRegistration")).default;
    const patient = await PatientRegistration.findById(patientId).lean();
    const transfersIn = Array.isArray(patient?.packageTransfers)
      ? patient.packageTransfers.filter(t => t.type === 'in')
      : [];
    const transfersMap = {};
    transfersIn.forEach(t => {
      const key = t.packageName || String(t.packageId || "");
      transfersMap[key] = t.transferredSessions || 0;
    });

    Object.keys(packageUsage).forEach((pkgName) => {
      const allowed = transfersMap[pkgName];
      if (typeof allowed === 'number') {
        const used = packageUsage[pkgName].totalSessions || 0;
        const remaining = Math.max(0, allowed - used);
        packageUsage[pkgName].totalAllowedSessions = allowed;
        packageUsage[pkgName].remainingSessions = remaining;
      }
    });

    return res.status(200).json({
      success: true,
      packageUsage: Object.values(packageUsage),
    });
  } catch (error) {
    console.error("Error fetching package usage:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch package usage",
    });
  }
}

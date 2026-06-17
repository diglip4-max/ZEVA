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

    // Fetch patient details to check for transfers
    const PatientRegistration = (await import("../../../../models/PatientRegistration")).default;
    const patient = await PatientRegistration.findById(patientId).lean();
    
    // Get original transfers first
    const transfersIn = Array.isArray(patient?.packageTransfers)
      ? patient.packageTransfers.filter(t => t.type === 'in')
      : [];
    const transfersOut = Array.isArray(patient?.packageTransfers)
      ? patient.packageTransfers.filter(t => t.type === 'out')
      : [];
    
    // Aggregate transfersIn by package key (sum sessions if multiple transfers for same package)
    const transfersInAggregated = {};
    transfersIn.forEach(t => {
      const key = t.packageName || String(t.packageId || "");
      if (!transfersInAggregated[key]) {
        transfersInAggregated[key] = {
          ...t,
          transferredSessions: t.transferredSessions || 0,
        };
      } else {
        transfersInAggregated[key].transferredSessions += t.transferredSessions || 0;
        // Keep the latest transfer date
        if (t.transferDate && (!transfersInAggregated[key].transferDate || new Date(t.transferDate) > new Date(transfersInAggregated[key].transferDate))) {
          transfersInAggregated[key].transferDate = t.transferDate;
        }
      }
    });
    const aggregatedTransfersIn = Object.values(transfersInAggregated);
         
    // Get packages transferred OUT by this patient, aggregated by package key
    const transfersOutAggregated = {};
    transfersOut.forEach(t => {
      const key = t.packageName || String(t.packageId || "");
      if (!transfersOutAggregated[key]) {
        transfersOutAggregated[key] = {
          ...t,
          transferredSessions: t.transferredSessions || 0,
        };
      } else {
        transfersOutAggregated[key].transferredSessions += t.transferredSessions || 0;
        // Keep the latest transfer date
        if (t.transferDate && (!transfersOutAggregated[key].transferDate || new Date(t.transferDate) > new Date(transfersOutAggregated[key].transferDate))) {
          transfersOutAggregated[key].transferDate = t.transferDate;
        }
      }
    });
    const aggregatedTransfersOut = Object.values(transfersOutAggregated);

    // Import Package model early so we can fill in missing packageNames
    const Package = (await import("../../../../models/Package")).default;

    // Fill in missing packageNames for transfers that only have packageId
    const allMissingNameIds = [
      ...aggregatedTransfersIn.filter(t => !t.packageName && t.packageId).map(t => t.packageId),
      ...aggregatedTransfersOut.filter(t => !t.packageName && t.packageId).map(t => t.packageId),
    ];
    if (allMissingNameIds.length > 0) {
      const pkgsForNames = await Package.find({ _id: { $in: allMissingNameIds } }).select('name').lean();
      const pkgIdToName = {};
      pkgsForNames.forEach(p => { pkgIdToName[String(p._id)] = p.name; });
      [...aggregatedTransfersIn, ...aggregatedTransfersOut].forEach(t => {
        if (!t.packageName && t.packageId) {
          t.packageName = pkgIdToName[String(t.packageId)] || null;
        }
      });
    }

    const transferredOutPackageIds = aggregatedTransfersOut.map(t => String(t.packageId));
    const transferredOutPackageNames = aggregatedTransfersOut.map(t => t.packageName).filter(Boolean);
    
    // Build a map of packageId -> payment info for normal packages
    const patientPackageMap = {};
    if (Array.isArray(patient?.packages)) {
      patient.packages.forEach(p => {
        patientPackageMap[String(p.packageId)] = {
          paymentStatus: p.paymentStatus || "Unpaid",
          paidAmount: p.paidAmount || 0,
          paymentMethod: p.paymentMethod || "",
        };
      });
    }

    // Build a map of packageName -> source patient info for transfers
    const transferSourceMap = {};
    aggregatedTransfersIn.forEach(t => {
      const key = t.packageName || String(t.packageId || "");
      transferSourceMap[key] = {
        fromPatientId: t.fromPatientId,
        transferredSessions: t.transferredSessions || 0,
        packageId: t.packageId,
        packageName: t.packageName,
        paymentStatus: t.paymentStatus || "Unpaid",
        paidAmount: t.paidAmount || 0,
        paymentMethod: t.paymentMethod || "",
      };
    });

    // Fetch names for all source patients in transfers
    const sourceIds = Array.from(new Set(aggregatedTransfersIn.map(t => String(t.fromPatientId || "")).filter(Boolean)));
    const sourcePatients = sourceIds.length
      ? await PatientRegistration.find({ _id: { $in: sourceIds } }).select("firstName lastName").lean()
      : [];
    const sourceNameMap = {};
    sourcePatients.forEach(sp => {
      const fn = (sp.firstName || "").trim();
      const ln = (sp.lastName || "").trim();
      sourceNameMap[String(sp._id)] = `${fn} ${ln}`.trim() || "Unknown";
    });

    // Collect all patient IDs to query (current patient + source patients from transfers)
    const patientIdsToQuery = [patientId];
    aggregatedTransfersIn.forEach(t => {
      if (t.fromPatientId && !patientIdsToQuery.includes(String(t.fromPatientId))) {
        patientIdsToQuery.push(String(t.fromPatientId));
      }
    });

    // Build query
    const query = {
      patientId: { $in: patientIdsToQuery },
      clinicId: clinicId,
      service: "Package",
    };

    // If packageName is provided, filter by it
    if (packageName) {
      query.package = packageName;
    }

    // Fetch names for all target patients in transfersOut
    const targetIds = Array.from(new Set(aggregatedTransfersOut.map(t => String(t.toPatientId || "")).filter(Boolean)));
    const targetPatients = targetIds.length
      ? await PatientRegistration.find({ _id: { $in: targetIds } }).select("firstName lastName").lean()
      : [];
    const targetNameMap = {};
    targetPatients.forEach(tp => {
      const fn = (tp.firstName || "").trim();
      const ln = (tp.lastName || "").trim();
      targetNameMap[String(tp._id)] = `${fn} ${ln}`.trim() || "Unknown";
    });

    // Build transferredOut map for quick lookup
    const transferredOutMap = {};
    aggregatedTransfersOut.forEach(t => {
      const key = t.packageName || String(t.packageId || "");
      transferredOutMap[key] = {
        toPatientId: t.toPatientId,
        transferredToName: targetNameMap[String(t.toPatientId)] || null,
        transferredSessions: t.transferredSessions || 0,
        packageId: t.packageId,
        packageName: t.packageName
      };
    });

    // Fetch all package billing records for this patient and source patients
    const billings = await Billing.find(query)
      .sort({ createdAt: -1 }) // Most recent first
      .select("package selectedPackageTreatments sessions createdAt invoiceNumber amount paid pending patientId originalAmount isDoctorDiscountApplied isAgentDiscountApplied membershipDiscountApplied discountPercent paymentMethod multiplePayments advanceUsed")
      .lean();

    // Fetch package definitions to get max sessions for each treatment (include packages from patient.packages too)
    const patientPackageIds = (Array.isArray(patient?.packages) ? patient.packages.map(p => String(p.packageId)) : []);
    const billingPackageNames = [...new Set(billings.map(b => b.package).filter(Boolean))];
    const allPackageIds = [...new Set([...patientPackageIds, ...aggregatedTransfersIn.map(t => String(t.packageId)), ...aggregatedTransfersOut.map(t => String(t.packageId))])].filter(Boolean);
    const packageDefinitions = await Package.find({
      $or: [
        { clinicId: clinicId, name: { $in: billingPackageNames } },
        { clinicId: clinicId, _id: { $in: allPackageIds } }
      ]
    }).select("_id name treatments totalSessions totalPrice").lean();

    // Create a map of package name to its treatment definitions and totalSessions
    const packageDefMap = {};
    const packageIdToNameMap = {};
    packageDefinitions.forEach(pkg => {
      packageDefMap[pkg.name] = {
        treatments: pkg.treatments || [],
        totalSessions: pkg.totalSessions || 0,
        totalPrice: pkg.totalPrice || 0
      };
      packageIdToNameMap[String(pkg._id)] = pkg.name;
    });

    // Aggregate usage by package and treatment
    const packageUsage = {};

    // Initialize packageUsage with all packages from patient.packages first
    if (Array.isArray(patient?.packages)) {
      patient.packages.forEach(p => {
        const pkgName = p.packageName || packageIdToNameMap[String(p.packageId)];
        if (!pkgName) return;
        const pkgDef = packageDefMap[pkgName];
        
        // Initialize treatments object
        const treatments = {};
        if (pkgDef?.treatments) {
          pkgDef.treatments.forEach(treatment => {
            treatments[treatment.treatmentSlug] = {
              treatmentName: treatment.treatmentName,
              treatmentSlug: treatment.treatmentSlug,
              totalUsedSessions: 0,
              maxSessions: treatment.sessions || 0,
              usageDetails: []
            };
          });
        }

        packageUsage[pkgName] = {
          packageName: pkgName,
          treatments: treatments,
          totalSessions: 0,
          billingHistory: [],
          isTransferred: false,
          transferredFrom: null,
          transferredFromName: null,
          transferredPackageName: null,
          transferredSessions: 0,
          paymentStatus: p.paymentStatus || "Unpaid",
          paidAmount: p.paidAmount || 0,
          paymentMethod: p.paymentMethod || ""
        };
      });
    }

    // Initialize packageUsage with all transferred-in packages to ensure they show up even without billings, and update existing ones
    aggregatedTransfersIn.forEach(t => {
      const pkgName = t.packageName || packageIdToNameMap[String(t.packageId)];
      if (!pkgName) return;
      
      const fromPatientName = sourceNameMap[String(t.fromPatientId)] || null;
      
      if (packageUsage[pkgName]) {
        // If package already exists (from patient.packages), update it with transferred-in details (sum sessions)
        packageUsage[pkgName].isTransferred = true;
        packageUsage[pkgName].transferredFrom = t.fromPatientId;
        packageUsage[pkgName].transferredFromName = fromPatientName;
        packageUsage[pkgName].transferredPackageName = pkgName;
        packageUsage[pkgName].transferredSessions = (packageUsage[pkgName].transferredSessions || 0) + (t.transferredSessions || 0);
        packageUsage[pkgName].totalAllowedSessions = packageUsage[pkgName].transferredSessions;
        packageUsage[pkgName].remainingSessions = packageUsage[pkgName].transferredSessions;
      } else {
        // If package doesn't exist yet, initialize it
        packageUsage[pkgName] = {
          packageName: pkgName,
          treatments: {},
          totalSessions: 0,
          billingHistory: [],
          isTransferred: true,
          transferredFrom: t.fromPatientId,
          transferredFromName: fromPatientName,
          transferredPackageName: pkgName,
          transferredSessions: t.transferredSessions || 0,
          paymentStatus: t.paymentStatus || "Unpaid",
          paidAmount: t.paidAmount || 0,
          paymentMethod: t.paymentMethod || "",
          totalAllowedSessions: t.transferredSessions || 0,
          remainingSessions: t.transferredSessions || 0
        };
      }
    });

    billings.forEach((billing) => {
      const pkgName = billing.package;
      if (!pkgName) return;

      // Check if this billing is from a transfer source patient
      const isFromSourcePatient = String(billing.patientId) !== String(patientId);
      const transferInfo = transferSourceMap[pkgName];
      
      // Also check if it's a normal package assigned to this patient
      const packageIdForName = packageDefinitions.find(pd => pd.name === pkgName)?._id;
      const normalPackageInfo = packageIdForName ? patientPackageMap[String(packageIdForName)] : null;

      if (!packageUsage[pkgName]) {
        packageUsage[pkgName] = {
          packageName: pkgName,
          treatments: {},
          totalSessions: 0,
          billingHistory: [],
          isTransferred: !!transferInfo,
          transferredFrom: transferInfo ? transferInfo.fromPatientId : null,
          transferredFromName: transferInfo && transferInfo.fromPatientId ? (sourceNameMap[String(transferInfo.fromPatientId)] || null) : null,
          transferredPackageName: transferInfo ? transferInfo.packageName || null : null,
          transferredSessions: transferInfo ? transferInfo.transferredSessions : 0,
          paymentStatus: transferInfo ? transferInfo.paymentStatus : (normalPackageInfo ? normalPackageInfo.paymentStatus : "Unpaid"),
          paidAmount: transferInfo ? transferInfo.paidAmount : (normalPackageInfo ? normalPackageInfo.paidAmount : 0),
          paymentMethod: transferInfo ? transferInfo.paymentMethod : (normalPackageInfo ? normalPackageInfo.paymentMethod : ""),
        };
      }

      // Add to billing history with source patient info
      packageUsage[pkgName].billingHistory.push({
        invoiceNumber: billing.invoiceNumber,
        sessions: billing.sessions || 0,
        date: billing.createdAt,
        amount: billing.amount || 0,
        paid: billing.paid || 0,
        pending: billing.pending || 0,
        originalAmount: billing.originalAmount || billing.amount || 0,
        isDoctorDiscountApplied: billing.isDoctorDiscountApplied || false,
        isAgentDiscountApplied: billing.isAgentDiscountApplied || false,
        membershipDiscountApplied: billing.membershipDiscountApplied || 0,
        discountPercent: billing.discountPercent || 0,
        paymentMethod: billing.paymentMethod || "",
        multiplePayments: billing.multiplePayments || [],
        treatments: billing.selectedPackageTreatments || [],
        isFromSourcePatient: isFromSourcePatient,
        sourcePatientId: isFromSourcePatient ? billing.patientId : null,
      });

      // Only count usage for this patient, not source patients of transfers!
      if (!isFromSourcePatient) {
        // Aggregate treatment sessions
        if (Array.isArray(billing.selectedPackageTreatments)) {
          billing.selectedPackageTreatments.forEach((treatment) => {
            const slug = treatment.treatmentSlug;
            if (!slug) return;

            if (!packageUsage[pkgName].treatments[slug]) {
              // Get max sessions from package definition
              const pkgDef = packageDefMap[pkgName] || { treatments: [] };
              const pkgTreatments = pkgDef.treatments || [];
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
            
            // Add usage detail for this billing with source patient info
            packageUsage[pkgName].treatments[slug].usageDetails.push({
              invoiceNumber: billing.invoiceNumber,
              sessions: treatment.sessions || 0,
              date: billing.createdAt,
              amount: billing.amount || 0,
              paid: billing.paid || 0,
              originalAmount: billing.originalAmount || billing.amount || 0,
              isDoctorDiscountApplied: billing.isDoctorDiscountApplied || false,
              isAgentDiscountApplied: billing.isAgentDiscountApplied || false,
              membershipDiscountApplied: billing.membershipDiscountApplied || 0,
              discountPercent: billing.discountPercent || 0,
              paymentMethod: billing.paymentMethod || "",
              multiplePayments: billing.multiplePayments || [],
              isFromSourcePatient: isFromSourcePatient,
              sourcePatientId: isFromSourcePatient ? billing.patientId : null,
            });
          });
        }

        packageUsage[pkgName].totalSessions += billing.sessions || 0;
      }
    });

    // Convert treatments object to array
    Object.keys(packageUsage).forEach((pkgName) => {
      packageUsage[pkgName].treatments = Object.values(packageUsage[pkgName].treatments);
    });

    // Build a map of transferred out packages and total sessions transferred
    const transferredOutSessionsMap = {};
    aggregatedTransfersOut.forEach(t => {
      const key = t.packageName || String(t.packageId || "");
      if (!transferredOutSessionsMap[key]) {
        transferredOutSessionsMap[key] = 0;
      }
      transferredOutSessionsMap[key] += t.transferredSessions || 0;
    });

    // Calculate payment status from billing history and apply transferred allowances
    Object.keys(packageUsage).forEach((pkgName) => {
      const pkgData = packageUsage[pkgName];
      const pkgDef = packageDefMap[pkgName];
      
      if (!pkgData.isTransferred) {
        // Calculate payment status from billing history for regular packages
        // Filter billings for this package and current patient
        const packageBillingsForPkg = billings.filter((billing) =>
          String(billing.patientId) === String(patientId) && billing.package === pkgName
        );
        
        const totalCashPaidFromBillings = packageBillingsForPkg.reduce(
          (sum, billing) => sum + (Number(billing.paid) || 0), 0
        );
        const totalAdvanceUsedFromBillings = packageBillingsForPkg.reduce(
          (sum, billing) => sum + (Number(billing.advanceUsed) || 0), 0
        );
        const totalPaidIncludingAdvance = totalCashPaidFromBillings + totalAdvanceUsedFromBillings;
        
        // Get package total price - try to get from patient.packages first, then packageDef
        let packagePrice = 0;
        const patientPkgEntry = (patient?.packages || []).find(p => {
          const entryPkgName = p.packageName || packageIdToNameMap[String(p.packageId)];
          return entryPkgName === pkgName;
        });
        if (patientPkgEntry?.totalPrice) {
          packagePrice = patientPkgEntry.totalPrice;
        } else if (pkgDef?.totalPrice) {
          packagePrice = pkgDef.totalPrice;
        }
        
        if (packagePrice > 0) {
          if (totalPaidIncludingAdvance >= packagePrice) {
            pkgData.paymentStatus = "Full";
          } else if (totalPaidIncludingAdvance > 0) {
            pkgData.paymentStatus = "Partial";
          }
        }
      }
      
      if (pkgData.isTransferred) {
        // Transferred package — use transferred sessions as the allowance
        const used = pkgData.totalSessions || 0;
        const remaining = Math.max(0, (pkgData.transferredSessions || 0) - used);
        pkgData.totalAllowedSessions = pkgData.transferredSessions || 0;
        pkgData.remainingSessions = remaining;
      } else {
        // Regular package — calculate total allowed sessions
        const treatments = pkgData.treatments || [];
        let totalAllowed = treatments.reduce((sum, t) => sum + (t.maxSessions || 0), 0);
        
        // If treatment sum is 0, use pkgDef.totalSessions
        if (totalAllowed === 0 && pkgDef?.totalSessions) {
          totalAllowed = pkgDef.totalSessions;
        }

        const used = treatments.reduce((sum, t) => sum + (t.totalUsedSessions || 0), 0);
        const transferredOutSessions = transferredOutSessionsMap[pkgName] || 0;

        if (totalAllowed > 0) {
          pkgData.totalAllowedSessions = totalAllowed - transferredOutSessions;
          pkgData.remainingSessions = Math.max(0, totalAllowed - used - transferredOutSessions);
        } else {
          // Fallback: use top-level billing.sessions as total allowed
          const billingHistory = pkgData.billingHistory || [];
          const totalBilledSessions = billingHistory.reduce((sum, b) => sum + (b.sessions || 0), 0);
          const usedFallback = billingHistory.reduce((sum, b) => {
            return sum + (b.treatments || []).reduce((s, t) => s + (t.sessions || 0), 0);
          }, 0);
          pkgData.totalAllowedSessions = totalBilledSessions - transferredOutSessions;
          pkgData.remainingSessions = Math.max(0, totalBilledSessions - usedFallback - transferredOutSessions);
        }
      }
    });

    return res.status(200).json({
      success: true,
      packageUsage: Object.values(packageUsage),
      transferredOut: Object.keys(transferredOutMap).length > 0 ? Object.values(transferredOutMap) : [],
    });
  } catch (error) {
    console.error("Error fetching package usage:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch package usage",
    });
  }
}

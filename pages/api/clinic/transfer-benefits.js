import dbConnect from "../../../lib/database";
import { getUserFromReq } from "../lead-ms/auth";
import PatientRegistration from "../../../models/PatientRegistration";
import MembershipPlan from "../../../models/MembershipPlan";
import Package from "../../../models/Package";
import Billing from "../../../models/Billing";
import mongoose from "mongoose";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  try {
    const user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    if (!["clinic", "agent", "doctor", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const { type, sourcePatientId, targetPatientId, membershipId, packageId } = req.body || {};
    if (!type || !sourcePatientId || !targetPatientId) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    if (sourcePatientId === targetPatientId) {
      return res.status(400).json({ success: false, message: "Cannot transfer to the same patient" });
    }

    const source = await PatientRegistration.findById(sourcePatientId);
    const target = await PatientRegistration.findById(targetPatientId);
    if (!source || !target) {
      return res.status(404).json({ success: false, message: "Source or target patient not found" });
    }

    if (type === "membership") {
      if (!membershipId) {
        return res.status(400).json({ success: false, message: "membershipId is required" });
      }
      const hasSelectedInArray = Array.isArray(source.memberships) && source.memberships.some(m => String(m.membershipId) === String(membershipId));
      const hasSelectedAsSingle = source.membership === "Yes" && String(source.membershipId) === String(membershipId);
      if (!hasSelectedInArray && !hasSelectedAsSingle) {
        return res.status(400).json({ success: false, message: "Source patient does not have selected membership" });
      }

      const plan = await MembershipPlan.findById(membershipId);
      if (!plan) {
        return res.status(404).json({ success: false, message: "Membership plan not found" });
      }

      const total = plan.benefits?.freeConsultations || 0;
      // Determine selected membership time window to count used consultations correctly
      let startDate = null;
      let endDate = null;
      if (hasSelectedInArray) {
        const entry = source.memberships.find(m => String(m.membershipId) === String(membershipId));
        startDate = entry?.startDate || null;
        endDate = entry?.endDate || null;
      } else if (hasSelectedAsSingle) {
        startDate = source.membershipStartDate || null;
        endDate = source.membershipEndDate || null;
      }
      const dateFilter = {};
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);

      const freeBills = await Billing.find({
        patientId: sourcePatientId,
        isFreeConsultation: true,
        ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
      }).select("sessions createdAt");
      let used = 0;
      freeBills.forEach(b => { used += (b.sessions || 1); });
      if (used === 0) {
        const allBills = await Billing.find({
          patientId: sourcePatientId,
          $or: [{ service: "Treatment" }, { service: "Package" }],
          ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
        }).select("sessions createdAt").sort({ createdAt: 1 });
        for (const b of allBills) {
          if (used >= total) break;
          const s = b.sessions || 1;
          const remainingAllowed = total - used;
          used += Math.min(s, remainingAllowed);
        }
      }
      const remaining = Math.max(0, total - used);
      if (remaining <= 0) {
        return res.status(400).json({ success: false, message: "No remaining membership benefits to transfer" });
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        // Remove only the selected membership entry
        if (hasSelectedAsSingle) {
          source.membership = "No";
          source.membershipId = undefined;
          source.membershipStartDate = undefined;
          source.membershipEndDate = undefined;
        }
        source.memberships = (Array.isArray(source.memberships) ? source.memberships.filter(m => String(m.membershipId) !== String(membershipId)) : []);
        source.hasTransferredOut = true;
        if (plan?.benefits?.priorityBooking) {
          source.transferredOutMembershipPriority = true;
        }
        source.membershipTransfers = source.membershipTransfers || [];
        source.membershipTransfers.push({
          type: "out",
          membershipId,
          membershipName: plan.name,
          startDate,
          endDate,
          toPatientId: target._id,
          transferredFreeConsultations: remaining,
          discountPercentageTransferred: plan.benefits?.discountPercentage || 0,
          transferDate: new Date(),
        });
        await source.save({ session });

        // Assign to target: preserve source membership period, and allow multiple entries (even same plan)
        target.membership = "Yes";
        if (!target.membershipId) {
          target.membershipId = membershipId; // keep single for backward-compat only if empty
        }
        target.memberships = Array.isArray(target.memberships) ? target.memberships : [];
        target.memberships.push({ membershipId, startDate, endDate });
        target.membershipTransfers = target.membershipTransfers || [];
        target.membershipTransfers.push({
          type: "in",
          membershipId,
          membershipName: plan.name,
          startDate,
          endDate,
          fromPatientId: source._id,
          transferredFreeConsultations: remaining,
          discountPercentageTransferred: plan.benefits?.discountPercentage || 0,
          transferDate: new Date(),
        });
        await target.save({ session });

        await session.commitTransaction();
      } catch (e) {
        await session.abortTransaction();
        throw e;
      } finally {
        session.endSession();
      }

      return res.status(200).json({
        success: true,
        message: `Transferred ${remaining} free consultation(s)`,
        data: { type, remainingTransferred: remaining }
      });
    }

    if (type === "package") {
      if (!packageId) {
        return res.status(400).json({ success: false, message: "packageId is required" });
      }
      const hasPackage = Array.isArray(source.packages) && source.packages.some(p => String(p.packageId) === String(packageId));
      if (!hasPackage) {
        return res.status(400).json({ success: false, message: "Source patient does not have selected package" });
      }

      const pkg = await Package.findById(packageId);
      if (!pkg) {
        return res.status(404).json({ success: false, message: "Package not found" });
      }
      const total = Number(pkg.totalSessions) || 0;

      const billings = await Billing.find({
        patientId: sourcePatientId,
        service: "Package",
        package: pkg.name,
      }).select("sessions");
      let used = 0;
      billings.forEach(b => { used += (b.sessions || 0); });
      const remaining = Math.max(0, total - used);
      if (remaining <= 0) {
        return res.status(400).json({ success: false, message: "No remaining package sessions to transfer" });
      }

      const session = await mongoose.startSession();
      session.startTransaction();
      try {
        source.packages = (Array.isArray(source.packages) ? source.packages.filter(p => String(p.packageId) !== String(packageId)) : []);
        source.hasTransferredOut = true;
        source.packageTransfers = source.packageTransfers || [];
        source.packageTransfers.push({
          type: "out",
          packageId,
          packageName: pkg.name,
          toPatientId: target._id,
          transferredSessions: remaining,
          transferDate: new Date(),
        });
        await source.save({ session });

        target.packages = Array.isArray(target.packages) ? target.packages : [];
        target.packages.push({ packageId, assignedDate: new Date() });
        target.packageTransfers = target.packageTransfers || [];
        target.packageTransfers.push({
          type: "in",
          packageId,
          packageName: pkg.name,
          fromPatientId: source._id,
          transferredSessions: remaining,
          transferDate: new Date(),
        });
        await target.save({ session });

        await session.commitTransaction();
      } catch (e) {
        await session.abortTransaction();
        throw e;
      } finally {
        session.endSession();
      }

      return res.status(200).json({
        success: true,
        message: `Transferred ${remaining} package session(s)`,
        data: { type, remainingTransferred: remaining }
      });
    }

    return res.status(400).json({ success: false, message: "Invalid transfer type" });
  } catch (error) {
    console.error("Error transferring benefits:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to transfer benefits" });
  }
}

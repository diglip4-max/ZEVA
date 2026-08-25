import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import Clinic from "../../../models/Clinic";
import Users from "../../../models/Users";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";

// ── Text index for fast search (runs once per process) ──
let indexesEnsured = false;
const ensureSearchIndexes = () => {
  if (indexesEnsured) return;
  indexesEnsured = true;
  // Compound index for sorted paginated queries
  PatientRegistration.collection.createIndex({ userId: 1, createdAt: -1 }).catch(() => {});
  // Text index for fast full-text search across multiple fields
  PatientRegistration.collection.createIndex(
    { firstName: "text", lastName: "text", email: "text", emrNumber: "text", invoiceNumber: "text" },
    { name: "patient_search_text_idx", default_language: "none" }
  ).catch(() => {});
  // Individual field indexes for regex fallback (phone search)
  PatientRegistration.collection.createIndex({ mobileNumber: 1 }).catch(() => {});
};

// ── In-memory cache for clinic user IDs (avoids repeated DB lookups) ──
const clinicUserCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const getCachedClinicUserIds = async (clinicId, ownerUserId) => {
  const cacheKey = clinicId?.toString() || ownerUserId?.toString();
  const cached = clinicUserCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.ids;
  const clinicUsers = await Users.find({
    $or: [{ _id: ownerUserId }, { clinicId: clinicId }],
  }).select("_id");
  const ids = clinicUsers.map((u) => u._id);
  clinicUserCache.set(cacheKey, { ids, ts: Date.now() });
  return ids;
};

export default async function handler(req, res) {
  await dbConnect();

  // ---------------- GET: fetch patients ----------------
  if (req.method === "GET") {
    try {
      const user = await getAuthorizedStaffUser(req, {
        allowedRoles: [
          "staff",
          "doctorStaff",
          "doctor",
          "clinic",
          "agent",
          "admin",
        ],
      });

      const {
        emrNumber,
        invoiceNumber,
        name,
        phone,
        claimStatus,
        applicationStatus,
        id,
        email,
        page = 1,
        pageSize = 0,
      } = req.query;

      // Build query based on user role - CRITICAL: userId filter must be applied first
      let query = {};

      // Ensure search indexes exist (runs once per process)
      ensureSearchIndexes();

      // For clinic role: show all patients belonging to the clinic (clinic owner + all agents/doctorStaff linked to clinic)
      if (user.role === "clinic") {
        const clinic = await Clinic.findOne({ owner: user._id });
        if (clinic) {
          // Use cached clinic user IDs to avoid repeated DB lookups
          const clinicUserIds = await getCachedClinicUserIds(clinic._id, user._id);
          query.userId = { $in: clinicUserIds };
        } else {
          // Fallback: only show clinic owner's patients
          query.userId = user._id;
        }
      }
      // For agent/doctorStaff: show all patients belonging to the clinic
      else if (user.role === "agent" || user.role === "doctorStaff") {
        if (user.clinicId) {
          const clinic = await Clinic.findById(user.clinicId);
          if (clinic) {
            // Use cached clinic user IDs to avoid repeated DB lookups
            const clinicUserIds = await getCachedClinicUserIds(clinic._id, clinic.owner);
            query.userId = { $in: clinicUserIds };
          } else {
            query.userId = user._id;
          }
        } else {
          query.userId = user._id;
        }
      }
      // For other roles: show their own patients
      else {
        query.userId = user._id;
      }

      // If id is provided, fetch single patient
      if (id) {
        const patient = await PatientRegistration.findOne({
          _id: id,
          ...query,
        }).lean();
        if (!patient) {
          return res
            .status(404)
            .json({ success: false, message: "Patient not found" });
        }
        return res.status(200).json({ success: true, patient });
      }

      // Build unified $and array combining userId + all filters
      const andClauses = [];
      andClauses.push({ userId: query.userId });

      // ── Optimized search logic ──
      // Uses $text index for alphabetic queries (10-100x faster than $regex)
      // Falls back to prefix regex for phone numbers and short queries (< 3 chars)
      if (name) {
        const trimmed = name.trim();
        const sanitized = trimmed.replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
        const hasDigits = /\d/.test(trimmed);

        if (!hasDigits && sanitized.length >= 3) {
          // ✅ FAST PATH: Use $text index for alphabetic queries (3+ chars)
          // Text index searches across firstName, lastName, email, emrNumber, invoiceNumber
          // MongoDB tokenizer splits on whitespace/special chars, so partial tokens match
          // e.g. "mus" matches "Mushtaq" because text index stores word tokens
          const textTerms = sanitized.split(/\s+/).filter(Boolean);
          const textSearch = textTerms.map((t) => `"${t}"`).join(" ");
          andClauses.push({ $text: { $search: textSearch } });
        } else {
          // 🔁 FALLBACK: Regex for phone numbers or short queries (< 3 chars)
          // Uses prefix regex (^term) which can leverage field indexes
          const orClauses = [];
          const escRegex = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

          if (trimmed.length >= 2) {
            // Prefix regex for name fields — can use single-field indexes
            orClauses.push(
              { firstName: { $regex: `^${escRegex}`, $options: "i" } },
              { lastName: { $regex: `^${escRegex}`, $options: "i" } },
              { email: { $regex: `^${escRegex}`, $options: "i" } },
              { emrNumber: { $regex: `^${escRegex}`, $options: "i" } },
              { invoiceNumber: { $regex: `^${escRegex}`, $options: "i" } },
            );
          } else {
            // Single char — broader match
            orClauses.push(
              { firstName: { $regex: escRegex, $options: "i" } },
              { lastName: { $regex: escRegex, $options: "i" } },
              { email: { $regex: escRegex, $options: "i" } },
              { emrNumber: { $regex: escRegex, $options: "i" } },
              { invoiceNumber: { $regex: escRegex, $options: "i" } },
            );
          }

          // Phone number flexible matching (handles +91 98765-43210 etc.)
          const digitsOnly = trimmed.replace(/[^\d]/g, "");
          if (digitsOnly) {
            const flexiblePattern = digitsOnly.split("").join("[\\s\\-+()]*");
            orClauses.push({ mobileNumber: { $regex: flexiblePattern, $options: "i" } });
          }

          andClauses.push({ $or: orClauses });
        }
      } else {
        // Dedicated filters when `name` is not used as omnibar
        if (emrNumber)
          andClauses.push({ emrNumber: { $regex: emrNumber, $options: "i" } });
        if (invoiceNumber)
          andClauses.push({
            invoiceNumber: { $regex: invoiceNumber, $options: "i" },
          });
        if (email) andClauses.push({ email: { $regex: email, $options: "i" } });
        if (phone) {
          const digitsOnly = phone.replace(/[^\d]/g, "");
          if (digitsOnly) {
            const flexiblePattern = digitsOnly.split("").join("[\\s\\-+()]*");
            andClauses.push(
              { mobileNumber: { $regex: flexiblePattern, $options: "i" } },
            );
          }
        }
      }

      if (claimStatus) andClauses.push({ advanceClaimStatus: claimStatus });
      if (applicationStatus) andClauses.push({ status: applicationStatus });

      query = { $and: andClauses };

      // Pagination
      const pageNum = parseInt(page, 10) || 1;
      const sizeNum = parseInt(pageSize, 10) || 0;
      const skip = sizeNum > 0 ? (pageNum - 1) * sizeNum : 0;
      const limit = sizeNum > 0 ? sizeNum : 0;

      // Run count and data fetch in parallel (both evaluate same query)
      const patientsQuery = PatientRegistration.find(query)
        .sort({ createdAt: -1 })
        .lean();
      if (skip > 0) patientsQuery.skip(skip);
      if (limit > 0) patientsQuery.limit(limit);

      const [totalCount, patients] = await Promise.all([
        PatientRegistration.countDocuments(query),
        patientsQuery,
      ]);

      // 🔹 Map doctor name - handle both ObjectId references and string names
      const patientDetails = patients.map((p) => {
        const patientObj = { ...p };
        // If doctor is already a string, use it; otherwise try to get name from populated object
        if (typeof patientObj.doctor === "string") {
          // Doctor is already a string (name), use it as-is
          patientObj.doctor = patientObj.doctor || "-";
        } else if (patientObj.doctor && patientObj.doctor.name) {
          // Doctor is populated object, extract name
          patientObj.doctor = patientObj.doctor.name;
        } else {
          // No doctor info
          patientObj.doctor = "-";
        }
        return patientObj;
      });

      const totalPages = sizeNum > 0 ? Math.ceil(totalCount / sizeNum) : 1;

      return res.status(200).json({
        success: true,
        count: totalCount,
        data: patientDetails,
        pagination: {
          page: pageNum,
          pageSize: sizeNum || totalCount,
          totalCount,
          totalPages,
          hasNextPage: sizeNum > 0 ? pageNum < totalPages : false,
          hasPrevPage: sizeNum > 0 ? pageNum > 1 : false,
        },
      });
    } catch (err) {
      console.error("GET error:", err);
      return res
        .status(err.status || 500)
        .json({ success: false, message: err.message || "Server error" });
    }
  }

  // ---------------- PUT: update status ----------------
  if (req.method === "PUT") {
    try {
      const user = await getAuthorizedStaffUser(req, {
        allowedRoles: [
          "staff",
          "doctorStaff",
          "doctor",
          "clinic",
          "agent",
          "admin",
        ],
      });
      const { id, status } = req.body;

      if (!id || !status) {
        return res
          .status(400)
          .json({ success: false, message: "id and status required" });
      }

      // Build query based on user role for authorization
      let query = { _id: id };
      if (user.role === "clinic") {
        const Clinic = (await import("../../../models/Clinic")).default;
        const clinic = await Clinic.findOne({ owner: user._id });
        if (clinic) {
          const User = (await import("../../../models/Users")).default;
          const clinicUsers = await User.find({
            $or: [{ _id: user._id }, { clinicId: clinic._id }],
          }).select("_id");
          const clinicUserIds = clinicUsers.map((u) => u._id);
          query.userId = { $in: clinicUserIds };
        } else {
          query.userId = user._id;
        }
      } else if (user.role === "agent" || user.role === "doctorStaff") {
        if (user.clinicId) {
          const Clinic = (await import("../../../models/Clinic")).default;
          const clinic = await Clinic.findById(user.clinicId);
          if (clinic) {
            const User = (await import("../../../models/Users")).default;
            const clinicUsers = await User.find({
              $or: [{ _id: clinic.owner }, { clinicId: user.clinicId }],
            }).select("_id");
            query.userId = { $in: clinicUsers.map((u) => u._id) };
          } else {
            query.userId = user._id;
          }
        } else {
          query.userId = user._id;
        }
      } else {
        query.userId = user._id;
      }

      const patient = await PatientRegistration.findOne(query);
      if (!patient)
        return res.status(404).json({
          success: false,
          message: "Patient not found or unauthorized",
        });

      patient.status = status;
      await patient.save();

      return res.status(200).json({
        success: true,
        message: `Patient status updated to ${status}`,
        data: patient,
      });
    } catch (err) {
      console.error("PUT error:", err);
      return res
        .status(err.status || 500)
        .json({ success: false, message: err.message || "Server error" });
    }
  }

  // ---------------- DELETE: delete patient ----------------
  if (req.method === "DELETE") {
    try {
      const user = await getAuthorizedStaffUser(req, {
        allowedRoles: [
          "staff",
          "doctorStaff",
          "doctor",
          "clinic",
          "agent",
          "admin",
        ],
      });
      const { id } = req.body;

      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "id is required" });
      }

      // ✅ Check permissions for deleting patients (admin bypasses all checks)
      if (user.role !== "admin") {
        const { checkClinicPermission } =
          await import("../lead-ms/permissions-helper");
        const { checkAgentPermission } =
          await import("../agent/permissions-helper");
        const Clinic = (await import("../../../models/Clinic")).default;

        // For clinic role: Check clinic permissions
        if (user.role === "clinic") {
          const clinic = await Clinic.findOne({ owner: user._id });
          if (clinic) {
            const { hasPermission: clinicHasPermission, error: clinicError } =
              await checkClinicPermission(
                clinic._id,
                "patient_registration",
                "delete",
              );
            if (!clinicHasPermission) {
              return res.status(403).json({
                success: false,
                message:
                  clinicError ||
                  "You do not have permission to delete patients",
              });
            }
          }
        }
        // For agent role (agentToken): Check agent permissions
        else if (user.role === "agent") {
          const { hasPermission: agentHasPermission, error: agentError } =
            await checkAgentPermission(
              user._id,
              "patient_registration",
              "delete",
            );
          if (!agentHasPermission) {
            return res.status(403).json({
              success: false,
              message:
                agentError || "You do not have permission to delete patients",
            });
          }
        }
        // For doctorStaff role (userToken): Check agent permissions
        else if (user.role === "doctorStaff") {
          const { hasPermission: agentHasPermission, error: agentError } =
            await checkAgentPermission(
              user._id,
              "patient_registration",
              "delete",
            );
          if (!agentHasPermission) {
            return res.status(403).json({
              success: false,
              message:
                agentError || "You do not have permission to delete patients",
            });
          }
        }
      }

      // Build query based on user role for authorization
      let query = { _id: id };
      if (user.role === "clinic") {
        const Clinic = (await import("../../../models/Clinic")).default;
        const clinic = await Clinic.findOne({ owner: user._id });
        if (clinic) {
          const User = (await import("../../../models/Users")).default;
          const clinicUsers = await User.find({
            $or: [{ _id: user._id }, { clinicId: clinic._id }],
          }).select("_id");
          const clinicUserIds = clinicUsers.map((u) => u._id);
          query.userId = { $in: clinicUserIds };
        } else {
          query.userId = user._id;
        }
      } else if (user.role === "agent" || user.role === "doctorStaff") {
        // Agent/doctorStaff can only delete their own patients
        query.userId = user._id;
      } else {
        query.userId = user._id;
      }

      const patient = await PatientRegistration.findOne(query);
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: "Patient not found or unauthorized",
        });
      }

      const Appointment = (await import("../../../models/Appointment")).default;
      const Billing = (await import("../../../models/Billing")).default;
      const AppointmentReport = (
        await import("../../../models/AppointmentReport")
      ).default;

      await Promise.all([
        Appointment.deleteMany({ patientId: patient._id }),
        Billing.deleteMany({ patientId: patient._id }),
        AppointmentReport.deleteMany({ patientId: patient._id }),
      ]);

      await PatientRegistration.findByIdAndDelete(id);

      return res
        .status(200)
        .json({ success: true, message: "Patient deleted successfully" });
    } catch (err) {
      console.error("DELETE error:", err);
      return res
        .status(err.status || 500)
        .json({ success: false, message: err.message || "Server error" });
    }
  }

  res.setHeader("Allow", ["GET", "PUT", "DELETE"]);
  return res
    .status(405)
    .json({ success: false, message: `Method ${req.method} Not Allowed` });
}

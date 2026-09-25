import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import Clinic from "../../../models/Clinic";
import Users from "../../../models/Users";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";
import mongoose from "mongoose";

// ── Text & compound indexes (run once per process) ──
let indexesEnsured = false;
const ensureSearchIndexes = async () => {
  if (indexesEnsured) return;
  indexesEnsured = true;
  // Compound index for the most common query: clinic/userId + sort by createdAt desc
  PatientRegistration.collection.createIndex(
    { userId: 1, createdAt: -1 },
    { name: "userId_createdAt_idx" }
  ).catch(() => {});
  // Compound index for status-filtered + sorted queries
  PatientRegistration.collection.createIndex(
    { userId: 1, status: 1, createdAt: -1 },
    { name: "userId_status_createdAt_idx" }
  ).catch(() => {});
  // Compound index for advance-claim-filtered + sorted queries
  PatientRegistration.collection.createIndex(
    { userId: 1, advanceClaimStatus: 1, createdAt: -1 },
    { name: "userId_claim_createdAt_idx" }
  ).catch(() => {});
  // Compound index for combined status + claim + sort
  PatientRegistration.collection.createIndex(
    { userId: 1, status: 1, advanceClaimStatus: 1, createdAt: -1 },
    { name: "userId_status_claim_createdAt_idx" }
  ).catch(() => {});
  // Text index for fast full-text search across multiple fields
  PatientRegistration.collection.createIndex(
    { firstName: "text", lastName: "text", email: "text", emrNumber: "text", invoiceNumber: "text" },
    { name: "patient_search_text_idx", default_language: "none" }
  ).catch(() => {});
  // Individual field indexes for regex fallback (phone / emr search)
  PatientRegistration.collection.createIndex({ mobileNumber: 1 }).catch(() => {});
  PatientRegistration.collection.createIndex({ emrNumber: 1 }).catch(() => {});
  PatientRegistration.collection.createIndex({ invoiceNumber: 1 }).catch(() => {});
};

// ── Field projection for list view (skip heavy arrays / long strings) ──
// Critical: returning only fields the list UI uses keeps payload small & fast.
const LIST_PROJECTION = {
  _id: 1,
  firstName: 1,
  lastName: 1,
  email: 1,
  mobileNumber: 1,
  countryCode: 1,
  emrNumber: 1,
  invoiceNumber: 1,
  doctor: 1,
  status: 1,
  advanceClaimStatus: 1,
  profileImage: 1,
  gender: 1,
  dateOfBirth: 1,
  city: 1,
  createdAt: 1,
  updatedAt: 1,
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
  }).select("_id").lean();
  // Keep as ObjectIds for proper MongoDB type matching
  const ids = clinicUsers.map((u) => u._id);
  clinicUserCache.set(cacheKey, { ids, ts: Date.now() });
  return ids;
};

// ── Short-lived count cache for the unfiltered base query ──
// On a 1000+ row collection, countDocuments() is the slowest part of the request.
// For the most common case (no search/filter, just pagination), cache the count.
const countCache = new Map();
const COUNT_CACHE_TTL = 30 * 1000; // 30 seconds
const buildCountCacheKey = (userId, query) =>
  `${userId?.toString?.() || userId}|${JSON.stringify(query)}`;

// arched Escape user input before embedding it in a regex (prevents regex injection / crashes)
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

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
        const clinic = await Clinic.findOne({ owner: user._id }).select("_id name").lean();
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
          const clinic = await Clinic.findById(user.clinicId).select("_id owner").lean();
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

      // Build query: put userId at top level (avoids $and wrapper that causes optimizer issues with $or)
      query = { userId: query.userId };

      // ── Robust omnibar search ──
      // The trimmed term is classified into one of three modes:
      //   digits     "99" | "9" | "0552730991"
      //              -> emrNumber / mobileNumber matched by CONSECUTIVE digit substring.
      //                 Digits are never split per-character, so "99" only returns records
      //                 that actually contain "99". invoiceNumber is deliberately EXCLUDED
      //                 here: invoice numbers embed 13-digit millisecond timestamps
      //                 (INV-1789109131836-781), so any 3+ digit query matches piles of
      //                 invoices that are invisible in the patient list and look like
      //                 false positives to the user.
      //   identifier "EMR-99" | "inv-12" (term starts with EMR/INV)
      //              -> emrNumber / invoiceNumber only. Kept narrow on purpose so an
      //                 identifier hit is not flooded by unrelated phone matches.
      //   text       "carolina" | "+971 55" (anything else)
      //              -> firstName / lastName / email + emrNumber / invoiceNumber /
      //                 mobileNumber substring match, newest first.
      // Digit & identifier modes run through an aggregation that assigns matchPriority
      // (0 = exact id match, 1 = id contains term, 2 = phone only) so the strongest
      // matches always land on page 1 regardless of createdAt.
      let searchMode = null; // "digits" | "identifier" | "text"
      let rankPatterns = []; // regex-escaped terms (raw digits need no escaping) used by the ranking stage

      if (name) {
        const trimmed = name.trim();
        if (/^\d+$/.test(trimmed)) {
          searchMode = "digits";
          rankPatterns = [trimmed]; // plain digits need no regex escaping
          query.$or = [
            { emrNumber: { $regex: trimmed, $options: "i" } },
            { mobileNumber: { $regex: trimmed, $options: "i" } },
          ];
        } else if (/^(EMR|INV)/i.test(trimmed)) {
          searchMode = "identifier";
          rankPatterns = [escapeRegExp(trimmed)];
          const orClauses = [
            { emrNumber: { $regex: rankPatterns[0], $options: "i" } },
            { invoiceNumber: { $regex: rankPatterns[0], $options: "i" } },
          ];
          const idDigits = trimmed.replace(/[^\d]/g, "");
          if (idDigits) {
            // tolerate "EMR 99" as well as "EMR-99" by also matching the bare digits
            orClauses.push(
              { emrNumber: { $regex: idDigits, $options: "i" } },
              { invoiceNumber: { $regex: idDigits, $options: "i" } }
            );
            rankPatterns.push(idDigits); // keep ranking consistent with the fallback clause
          }
          query.$or = orClauses;
        } else if (trimmed) {
          searchMode = "text";
          rankPatterns = [escapeRegExp(trimmed)]; // unused: text mode sorts by createdAt
          const orClauses = [
            { firstName: { $regex: rankPatterns[0], $options: "i" } },
            { lastName: { $regex: rankPatterns[0], $options: "i" } },
            { email: { $regex: rankPatterns[0], $options: "i" } },
            { emrNumber: { $regex: rankPatterns[0], $options: "i" } },
            { invoiceNumber: { $regex: rankPatterns[0], $options: "i" } },
            { mobileNumber: { $regex: rankPatterns[0], $options: "i" } },
          ];
          const textDigits = trimmed.replace(/[^\d]/g, "");
          if (textDigits) {
            // mixed input like "+971 55" still matches id/phone digit runs
            orClauses.push(
              { emrNumber: { $regex: textDigits, $options: "i" } },
              { invoiceNumber: { $regex: textDigits, $options: "i" } },
              { mobileNumber: { $regex: textDigits, $options: "i" } }
            );
          }
          query.$or = orClauses;
        }
      } else {
        // Dedicated filters when `name` is not used as omnibar
        if (emrNumber) query.emrNumber = { $regex: escapeRegExp(emrNumber), $options: "i" };
        if (invoiceNumber) query.invoiceNumber = { $regex: escapeRegExp(invoiceNumber), $options: "i" };
        if (email) query.email = { $regex: escapeRegExp(email), $options: "i" };
        if (phone) {
          const phoneDigits = phone.replace(/[^\d]/g, "");
          if (phoneDigits) query.mobileNumber = { $regex: phoneDigits, $options: "i" };
        }
      }

      if (claimStatus) query.advanceClaimStatus = claimStatus;
      if (applicationStatus) query.status = applicationStatus;

      // Pagination
      const pageNum = parseInt(page, 10) || 1;
      const sizeNum = parseInt(pageSize, 10) || 0;
      const skip = sizeNum > 0 ? (pageNum - 1) * sizeNum : 0;
      const limit = sizeNum > 0 ? sizeNum : 0;

      // ── Deep-pagination guard ──
      // Skipping tens of thousands of docs is slow even with an index.
      // Clamp the skip to a reasonable max and surface a flag so the client
      // can warn the user / switch to a search-based fetch.
      const MAX_SKIP = 5000;
      let skipClamped = false;
      let effectiveSkip = skip;
      if (skip > MAX_SKIP) {
        effectiveSkip = MAX_SKIP;
        skipClamped = true;
      }

      // 🔹 Try to serve the count from cache (only when no extra filters applied
      // beyond the userId scope, which is the most common case on the list view).
      const noExtraFilters = Object.keys(query).length === 1 && query.userId; // only { userId: ... }
      const countCacheKey = buildCountCacheKey(user._id, query);
      let totalCount = null;
      if (noExtraFilters) {
        const cached = countCache.get(countCacheKey);
        if (cached && Date.now() - cached.ts < COUNT_CACHE_TTL) {
          totalCount = cached.count;
        }
      }

      // Build the data query:
      //   - select()/project => small payload (skip heavy fields like selectedTreatments)
      //   - lean() / aggregation => plain JS objects, no Mongoose overhead
      //   - allowDiskUse() => fallback for sorts that exceed RAM on huge collections
      //   - digit & identifier searches are relevance-ranked through an aggregation
      //     (matchPriority 0/1/2) so exact id matches always surface on page 1
      let patients;
      if (searchMode === "digits" || searchMode === "identifier") {
        // Fields that count as "identifier" hits for ranking. Digits mode excludes
        // invoiceNumber because invoices never match in that mode (see search build above).
        const idFields = searchMode === "digits" ? ["emrNumber"] : ["emrNumber", "invoiceNumber"];
        const exactCheck = (field) => ({
          $or: rankPatterns.map((p) => ({
            $regexMatch: {
              input: { $ifNull: ["$" + field, ""] },
              regex: "^" + p + "$",
              options: "i",
            },
          })),
        });
        const containsCheck = (field) => ({
          $or: rankPatterns.map((p) => ({
            $regexMatch: {
              input: { $ifNull: ["$" + field, ""] },
              regex: p,
              options: "i",
            },
          })),
        });
        const pipeline = [
          { $match: query },
          {
            $addFields: {
              __mp: {
                $cond: [
                  { $or: idFields.map((f) => exactCheck(f)) },
                  0,
                  {
                    $cond: [
                      { $or: idFields.map((f) => containsCheck(f)) },
                      1,
                      2,
                    ],
                  },
                ],
              },
            },
          },
          { $sort: { __mp: 1, createdAt: -1 } },
          ...(effectiveSkip > 0 ? [{ $skip: effectiveSkip }] : []),
          ...(limit > 0 ? [{ $limit: limit }] : []),
          { $project: LIST_PROJECTION },
        ];
        // Ranked page + accurate total in parallel; count cache only serves filter-free lists
        const [rankedPatients, matchCount] = await Promise.all([
          PatientRegistration.aggregate(pipeline).allowDiskUse(true),
          PatientRegistration.countDocuments(query).allowDiskUse(true),
        ]);
        patients = rankedPatients;
        totalCount = matchCount;
      } else {
        // Standard find query for text searches and unfiltered lists (sort by createdAt desc)
        const patientsQuery = PatientRegistration.find(query)
          .select(LIST_PROJECTION)
          .sort({ createdAt: -1 })
          .lean({ getters: false })
          .allowDiskUse(true);
        if (effectiveSkip > 0) patientsQuery.skip(effectiveSkip);
        if (limit > 0) patientsQuery.limit(limit);

        // Run count and data fetch in parallel (only fetch count if not cached)
        const dbCalls = [patientsQuery];
        if (totalCount === null) {
          dbCalls.push(PatientRegistration.countDocuments(query).allowDiskUse(true));
        }
        const results = await Promise.all(dbCalls);
        patients = results[0];
        if (totalCount === null) {
          totalCount = results[1];
          if (noExtraFilters) {
            countCache.set(countCacheKey, { count: totalCount, ts: Date.now() });
          }
        }
      }

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

      // 🔹 Short-lived HTTP cache so the browser/CDN can serve repeat page-1 hits
      // without hitting Node. First page with no filters is the most cacheable.
      if (noExtraFilters && pageNum === 1) {
        res.setHeader("Cache-Control", "private, max-age=10");
      } else {
        res.setHeader("Cache-Control", "no-store");
      }

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
        ...(skipClamped ? { skipClamped: true, maxSkip: MAX_SKIP } : {}),
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

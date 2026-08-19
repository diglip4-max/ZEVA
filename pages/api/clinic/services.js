import dbConnect from "../../../lib/database";
import Service from "../../../models/Service";
import Department from "../../../models/Department";
import { getUserFromReq } from "../lead-ms/auth";
import {
  getClinicIdFromUser,
  checkClinicPermission,
} from "../lead-ms/permissions-helper";

// ── Constants ────────────────────────────────────────────────────────────────
const ALLOWED_ROLES = new Set([
  "clinic",
  "doctor",
  "agent",
  "doctorStaff",
  "staff",
  "admin",
]);

const MODULE_KEY = "Clinic_services_setup";

// Roles that bypass permission checks (agent/doctorStaff need read for Smart Recommendations)
const READ_BYPASS_ROLES = new Set(["agent", "doctorStaff"]);

// ── Helpers ──────────────────────────────────────────────────────────────────
const sendError = (res, status, message, extra = {}) => {
  return res.status(status).json({ success: false, message, ...extra });
};

const slugify = (text = "") =>
  String(text)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const parsePrice = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : null;
};

const parseDuration = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const num = parseInt(value, 10);
  return Number.isFinite(num) && num >= 5 ? num : null;
};

const isDuplicateKeyError = (error) =>
  error?.code === 11000 ||
  (error?.writeErrors &&
    Array.isArray(error.writeErrors) &&
    error.writeErrors.some((w) => w.code === 11000));

// ── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  await dbConnect();

  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) {
      return sendError(res, 401, "Unauthorized");
    }
    if (!ALLOWED_ROLES.has(user.role)) {
      return sendError(res, 403, "Access denied");
    }
  } catch {
    return sendError(res, 401, "Invalid token");
  }

  const { clinicId, error: clinicError } = await getClinicIdFromUser(user);
  if (clinicError || (!clinicId && user.role !== "admin")) {
    return sendError(res, 403, clinicError || "Unable to determine clinic access");
  }

  // ── GET ──────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    try {
      if (user.role !== "admin" && !READ_BYPASS_ROLES.has(user.role)) {
        const { hasPermission, error: permError } = await checkClinicPermission(
          clinicId,
          MODULE_KEY,
          "read",
        );
        if (!hasPermission) {
          return sendError(res, 403, permError || "You do not have permission to view services");
        }
      }

      const { departmentId } = req.query;
      const criteria = { clinicId, isDeleted: { $ne: true } };
      if (departmentId) {
        criteria.departmentId = departmentId;
      }

      const services = await Service.find(criteria)
        .select(
          "_id clinicId departmentId name serviceSlug price clinicPrice durationMinutes isActive createdAt updatedAt",
        )
        .populate({
          path: "departmentId",
          select: "_id name",
        })
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json({ success: true, services });
    } catch (error) {
      console.error("[services GET]", error);
      return sendError(res, 500, "Failed to fetch services");
    }
  }

  // ── POST ─────────────────────────────────────────────────────────────────
  if (req.method === "POST") {
    try {
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        MODULE_KEY,
        "create",
      );
      if (!hasPermission) {
        return sendError(res, 403, permError || "You do not have permission to create services");
      }

      const {
        name,
        serviceSlug,
        price,
        durationMinutes,
        departmentId,
        clinicPrice,
        items,
      } = req.body;

      // ── Batch create path ──────────────────────────────────────────────
      if (Array.isArray(items) && items.length > 0) {
        if (!departmentId) {
          return sendError(res, 400, "Department is required for batch service creation");
        }

        const docs = [];
        const seenNames = new Set();

        for (const it of items) {
          const n = (it?.name || "").trim();
          if (!n) {
            return sendError(res, 400, "Each item must have a name");
          }

          const normalizedName = n.toLowerCase();
          if (seenNames.has(normalizedName)) {
            return sendError(res, 400, `Duplicate service "${n}" in request`);
          }
          seenNames.add(normalizedName);

          const p = parsePrice(it?.price);
          if (p === null) {
            return sendError(res, 400, `Invalid price for service "${n}"`);
          }

          const d = parseDuration(it?.durationMinutes);
          if (d === null) {
            return sendError(res, 400, `Invalid duration for service "${n}"`);
          }

          const cPrice = parsePrice(it?.clinicPrice);
          if (it?.clinicPrice !== undefined && it?.clinicPrice !== null && it?.clinicPrice !== "" && cPrice === null) {
            return sendError(res, 400, `Invalid clinic price for service "${n}"`);
          }

          docs.push({
            clinicId,
            departmentId,
            name: n,
            serviceSlug: slugify(n),
            price: p,
            clinicPrice: cPrice,
            durationMinutes: d,
            createdBy: user._id,
            isActive: true,
          });
        }

        try {
          const inserted = await Service.insertMany(docs, { ordered: false });
          return res.status(201).json({
            success: true,
            message: "Services created",
            services: inserted,
          });
        } catch (e) {
          if (e?.writeErrors && Array.isArray(e.writeErrors)) {
            const dupCount = e.writeErrors.filter((w) => w.code === 11000).length;
            const otherErrors = e.writeErrors.length - dupCount;
            const parts = [];
            if (dupCount) parts.push(`${dupCount} duplicate name(s) skipped`);
            if (otherErrors) parts.push(`${otherErrors} invalid record(s) skipped`);
            return res.status(201).json({
              success: true,
              message: `Services created with partial success (${parts.join(", ")})`,
            });
          }
          if (isDuplicateKeyError(e)) {
            return sendError(res, 409, "One or more services already exist for this department");
          }
          console.error("[services POST batch]", e);
          return sendError(res, 500, "Failed to create services");
        }
      }

      // ── Single create path ─────────────────────────────────────────────
      if (!name || !name.trim()) {
        return sendError(res, 400, "Service name is required");
      }

      const priceNum = parsePrice(price);
      if (priceNum === null) {
        return sendError(res, 400, "Valid price is required");
      }

      const durationNum = parseDuration(durationMinutes);
      if (durationNum === null) {
        return sendError(res, 400, "Valid duration (min 5) is required");
      }

      const clinicPriceNum = parsePrice(clinicPrice);
      if (clinicPrice !== undefined && clinicPrice !== null && clinicPrice !== "" && clinicPriceNum === null) {
        return sendError(res, 400, "Valid clinic price is required");
      }

      // No pre-check findOne — unique index enforces this atomically
      const service = await Service.create({
        clinicId,
        departmentId: departmentId || null,
        name: name.trim(),
        serviceSlug: (serviceSlug && serviceSlug.trim()) || slugify(name),
        price: priceNum,
        clinicPrice: clinicPriceNum,
        durationMinutes: durationNum,
        createdBy: user._id,
        isActive: true,
      });

      return res.status(201).json({ success: true, message: "Service created", service });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return sendError(
          res,
          409,
          "A service with this name or slug already exists in this department",
        );
      }
      if (error.name === "ValidationError") {
        return sendError(res, 400, error.message || "Validation error");
      }
      console.error("[services POST]", error);
      return sendError(res, 500, "Failed to create service");
    }
  }

  // ── PUT ──────────────────────────────────────────────────────────────────
  if (req.method === "PUT") {
    try {
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        MODULE_KEY,
        "update",
      );
      if (!hasPermission) {
        return sendError(res, 403, permError || "You do not have permission to update services");
      }

      const {
        serviceId,
        name,
        serviceSlug,
        price,
        durationMinutes,
        isActive,
        departmentId,
        clinicPrice,
      } = req.body;

      if (!serviceId) {
        return sendError(res, 400, "Service ID is required");
      }
      if (!name || !name.trim()) {
        return sendError(res, 400, "Service name is required");
      }

      const priceNum = parsePrice(price);
      if (priceNum === null) {
        return sendError(res, 400, "Valid price is required");
      }

      const durationNum = parseDuration(durationMinutes);
      if (durationNum === null) {
        return sendError(res, 400, "Valid duration (min 5) is required");
      }

      const clinicPriceNum = parsePrice(clinicPrice);
      if (clinicPrice !== undefined && clinicPrice !== null && clinicPrice !== "" && clinicPriceNum === null) {
        return sendError(res, 400, "Valid clinic price is required");
      }

      const update = {
        name: name.trim(),
        serviceSlug: (serviceSlug && serviceSlug.trim()) || slugify(name),
        price: priceNum,
        clinicPrice: clinicPriceNum,
        durationMinutes: durationNum,
      };

      if (departmentId !== undefined) {
        update.departmentId = departmentId || null;
      }
      if (typeof isActive === "boolean") {
        update.isActive = isActive;
      }

      // Single atomic operation replaces: findOne → duplicate findOne → save
      const service = await Service.findOneAndUpdate(
        { _id: serviceId, clinicId, isDeleted: { $ne: true } },
        { $set: update },
        { new: true, runValidators: true },
      ).lean();

      if (!service) {
        return sendError(res, 404, "Service not found");
      }

      return res.status(200).json({ success: true, message: "Service updated", service });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return sendError(
          res,
          409,
          "Another service with this name or slug exists in this department",
        );
      }
      if (error.name === "ValidationError") {
        const msgs = Object.values(error.errors || {})
          .map((e) => e.message)
          .join(", ");
        return sendError(res, 400, msgs || error.message || "Validation error");
      }
      if (error.name === "CastError") {
        return sendError(res, 400, `Invalid value for field: ${error.path}`);
      }
      console.error("[services PUT]", error);
      return sendError(res, 500, "Internal server error");
    }
  }

  // ── DELETE ───────────────────────────────────────────────────────────────
  if (req.method === "DELETE") {
    try {
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        MODULE_KEY,
        "delete",
      );
      if (!hasPermission) {
        return sendError(res, 403, permError || "You do not have permission to delete services");
      }

      const { serviceId } = req.query;
      if (!serviceId) {
        return sendError(res, 400, "Service ID is required");
      }

      // Atomic find + soft-delete in a single operation
      const deleted = await Service.findOneAndUpdate(
        { _id: serviceId, clinicId, isDeleted: { $ne: true } },
        { $set: { isDeleted: true } },
        { new: true },
      ).lean();

      if (!deleted) {
        return sendError(res, 404, "Service not found");
      }

      return res.status(200).json({ success: true, message: "Service deleted" });
    } catch (error) {
      console.error("[services DELETE]", error);
      return sendError(res, 500, "Failed to delete service");
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return sendError(res, 405, "Method not allowed");
}


import dbConnect from "../../../lib/database";
import Package from "../../../models/Package";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser, checkClinicPermission } from "../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  // Verify authentication
  let user;
  try {
    user = await getUserFromReq(req);
    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    // Allow clinic, doctor, agent, doctorStaff, and staff roles
    if (!["clinic", "doctor", "agent", "doctorStaff", "staff"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  // Get clinic ID from user
  const { clinicId, error: clinicError } = await getClinicIdFromUser(user);
  if (clinicError || !clinicId) {
    return res.status(403).json({ 
      success: false,
      message: clinicError || "Unable to determine clinic access" 
    });
  }

  // GET: Fetch all packages for this clinic
  if (req.method === "GET") {
    try {
      // Check read permission
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        "clinic_addRoom",
        "read"
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permError || "You do not have permission to view packages",
        });
      }

      const packages = await Package.find({ clinicId })
        .sort({ createdAt: -1 })
        .lean();

      const normalized = packages
        .filter((pkg) => pkg.clinicId && pkg.clinicId.toString() === clinicId.toString())
        .map((pkg) => {
          const totalSessions =
            pkg.totalSessions ??
            (Array.isArray(pkg.treatments)
              ? pkg.treatments.reduce((sum, t) => sum + (parseInt(t.sessions) || 1), 0)
              : 0);
          const sessionPrice =
            pkg.sessionPrice ??
            (pkg.totalPrice && totalSessions > 0
              ? Number((pkg.totalPrice / totalSessions).toFixed(2))
              : (pkg.price ?? 0)); // fallback for legacy "price"
          const totalPrice =
            pkg.totalPrice ??
            (sessionPrice && totalSessions > 0
              ? Number((sessionPrice * totalSessions).toFixed(2))
              : (pkg.price ?? 0));
          return {
            _id: pkg._id.toString(),
            name: pkg.name,
            price: sessionPrice, // backward compatible field used by UI
            totalPrice,
            totalSessions,
            sessionPrice,
            treatments: pkg.treatments || [],
            createdAt: pkg.createdAt,
            updatedAt: pkg.updatedAt,
          };
        });

      return res.status(200).json({ success: true, packages: normalized });
    } catch (error) {
      console.error("Error fetching packages:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch packages" });
    }
  }

  // POST: Create a new package
  if (req.method === "POST") {
    try {
      // Check create permission
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        "clinic_addRoom",
        "create",
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permError || "You do not have permission to create packages",
        });
      }

      const { name, totalPrice: bodyTotalPrice, price: legacyPrice, treatments } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: "Package name is required" });
      }

      const totalPrice = bodyTotalPrice !== undefined ? parseFloat(bodyTotalPrice) : parseFloat(legacyPrice);
      if (totalPrice === undefined || totalPrice === null || isNaN(totalPrice) || totalPrice < 0) {
        return res.status(400).json({ success: false, message: "Valid totalPrice is required" });
      }

      if (!treatments || !Array.isArray(treatments) || treatments.length === 0) {
        return res.status(400).json({ success: false, message: "At least one treatment is required" });
      }

      for (const treatment of treatments) {
        if (!treatment.treatmentName || !treatment.treatmentName.trim()) {
          return res.status(400).json({ success: false, message: "Treatment name is required for all treatments" });
        }
        if (!treatment.sessions || treatment.sessions < 1) {
          return res.status(400).json({ success: false, message: "Valid sessions (minimum 1) is required for all treatments" });
        }
      }

      // Check if package with same name already exists for this clinic
      const existingPackage = await Package.findOne({
        clinicId,
        name: name.trim(),
      });

      if (existingPackage) {
        return res.status(400).json({
          success: false,
          message: "A package with this name already exists",
        });
      }

      const normalizedTreatments = treatments.map((t) => ({
        treatmentName: t.treatmentName.trim(),
        treatmentSlug: t.treatmentSlug || "",
        sessions: parseInt(t.sessions) || 1,
      }));
      const totalSessions = normalizedTreatments.reduce((sum, t) => sum + (t.sessions || 1), 0);
      const sessionPrice = totalSessions > 0 ? Number((totalPrice / totalSessions).toFixed(2)) : Number(totalPrice.toFixed(2));
      const newPackage = await Package.create({
        clinicId,
        name: name.trim(),
        totalPrice,
        totalSessions,
        sessionPrice,
        treatments: normalizedTreatments,
        createdBy: user._id,
      });

      return res.status(201).json({
        success: true,
        message: "Package created successfully",
        package: {
          _id: newPackage._id.toString(),
          name: newPackage.name,
          price: newPackage.sessionPrice,
          totalPrice: newPackage.totalPrice,
          totalSessions: newPackage.totalSessions,
          sessionPrice: newPackage.sessionPrice,
          treatments: newPackage.treatments || [],
          createdAt: newPackage.createdAt,
          updatedAt: newPackage.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error creating package:", error);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "A package with this name already exists",
        });
      }
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: error.message || "Validation error creating package",
        });
      }
      return res.status(500).json({
        success: false,
        message: "Failed to create package",
        error: error.message || "Unknown error",
      });
    }
  }

  // PUT: Update an existing package
  if (req.method === "PUT") {
    try {
      // Check update permission
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        "clinic_addRoom",
        "update",
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permError || "You do not have permission to update packages",
        });
      }

      const { packageId, name } = req.body;

      if (!packageId || !name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Package ID and name are required",
        });
      }

      // Editing is restricted to name only. Ignore totalPrice/treatments changes from client.

      const pkg = await Package.findOne({ _id: packageId, clinicId });
      if (!pkg) {
        return res.status(404).json({ success: false, message: "Package not found" });
      }

      const normalizedName = name.trim();
      const duplicatePackage = await Package.findOne({
        clinicId,
        name: normalizedName,
        _id: { $ne: packageId },
      });

      if (duplicatePackage) {
        return res.status(400).json({
          success: false,
          message: "Another package with this name already exists",
        });
      }

      pkg.name = normalizedName;
      await pkg.save();

      return res.status(200).json({
        success: true,
        message: "Package updated successfully",
        package: {
          _id: pkg._id.toString(),
          name: pkg.name,
          price: pkg.sessionPrice,
          totalPrice: pkg.totalPrice,
          totalSessions: pkg.totalSessions,
          sessionPrice: pkg.sessionPrice,
          treatments: pkg.treatments || [],
          createdAt: pkg.createdAt,
          updatedAt: pkg.updatedAt,
        },
      });
    } catch (error) {
      console.error("Error updating package:", error);
      return res.status(500).json({ success: false, message: "Failed to update package" });
    }
  }

  // DELETE: Delete a package
  if (req.method === "DELETE") {
    try {
      // Check delete permission
      const { hasPermission, error: permError } = await checkClinicPermission(
        clinicId,
        "clinic_addRoom",
        "delete",
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permError || "You do not have permission to delete packages",
        });
      }

      const { packageId } = req.query;

      if (!packageId) {
        return res.status(400).json({ success: false, message: "Package ID is required" });
      }

      // Verify the package belongs to this clinic
      const pkg = await Package.findOne({ _id: packageId, clinicId });
      if (!pkg) {
        return res.status(404).json({ success: false, message: "Package not found" });
      }

      await Package.findByIdAndDelete(packageId);

      return res.status(200).json({
        success: true,
        message: "Package deleted successfully",
      });
    } catch (error) {
      console.error("Error deleting package:", error);
      return res.status(500).json({ success: false, message: "Failed to delete package" });
    }
  }

  res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}


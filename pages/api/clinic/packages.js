import dbConnect from "../../../lib/database";
import Package from "../../../models/Package";
import Clinic from "../../../models/Clinic";
import User from "../../../models/Users";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  // Verify clinic authentication
  let clinicUser;
  try {
    clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }

  // Find the clinic associated with this user
  let clinic;
  let clinicId;
  
  if (clinicUser.role === "clinic") {
    clinic = await Clinic.findOne({ owner: clinicUser._id });
    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }
    clinicId = clinic._id;
  } else if (["agent", "doctorStaff", "staff"].includes(clinicUser.role)) {
    if (!clinicUser.clinicId) {
      return res.status(403).json({ success: false, message: "User not linked to a clinic" });
    }
    clinic = await Clinic.findById(clinicUser.clinicId);
    if (!clinic) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }
    clinicId = clinic._id;
  } else {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // GET: Fetch all packages for this clinic
  if (req.method === "GET") {
    try {
      // Check read permission
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "room_management",
        "read",
        null,
        clinicUser.role
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to view packages",
        });
      }

      // Only fetch packages that belong to this specific clinic
      const packages = await Package.find({ 
        clinicId: clinicId // Explicitly filter by clinicId to show only this clinic's packages
      })
        .sort({ createdAt: -1 })
        .lean();

      // Return only packages created for this clinic
      return res.status(200).json({
        success: true,
        packages: packages
          .filter((pkg) => pkg.clinicId && pkg.clinicId.toString() === clinicId.toString()) // Additional safety check
          .map((pkg) => ({
            _id: pkg._id.toString(),
            name: pkg.name,
            price: pkg.price,
            treatments: pkg.treatments || [],
            createdAt: pkg.createdAt,
            updatedAt: pkg.updatedAt,
          })),
      });
    } catch (error) {
      console.error("Error fetching packages:", error);
      return res.status(500).json({ success: false, message: "Failed to fetch packages" });
    }
  }

  // POST: Create a new package
  if (req.method === "POST") {
    try {
      // Check create permission
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "room_management",
        "create",
        null,
        clinicUser.role
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to create packages",
        });
      }

      const { name, price, treatments } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: "Package name is required" });
      }

      if (price === undefined || price === null || isNaN(price) || parseFloat(price) < 0) {
        return res.status(400).json({ success: false, message: "Valid price is required" });
      }

      if (!treatments || !Array.isArray(treatments) || treatments.length === 0) {
        return res.status(400).json({ success: false, message: "At least one treatment is required" });
      }

      // Validate treatments structure
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

      const newPackage = await Package.create({
        clinicId,
        name: name.trim(),
        price: parseFloat(price),
        treatments: treatments.map((t) => ({
          treatmentName: t.treatmentName.trim(),
          treatmentSlug: t.treatmentSlug || "",
          sessions: parseInt(t.sessions) || 1,
        })),
        createdBy: clinicUser._id,
      });

      return res.status(201).json({
        success: true,
        message: "Package created successfully",
        package: {
          _id: newPackage._id.toString(),
          name: newPackage.name,
          price: newPackage.price,
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
      return res.status(500).json({ success: false, message: "Failed to create package" });
    }
  }

  // PUT: Update an existing package
  if (req.method === "PUT") {
    try {
      // Check update permission
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "room_management",
        "update",
        null,
        clinicUser.role
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to update packages",
        });
      }

      const { packageId, name, price, treatments } = req.body;

      if (!packageId || !name || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Package ID and name are required",
        });
      }

      if (price === undefined || price === null || isNaN(price) || parseFloat(price) < 0) {
        return res.status(400).json({
          success: false,
          message: "Valid price is required",
        });
      }

      if (!treatments || !Array.isArray(treatments) || treatments.length === 0) {
        return res.status(400).json({ success: false, message: "At least one treatment is required" });
      }

      // Validate treatments structure
      for (const treatment of treatments) {
        if (!treatment.treatmentName || !treatment.treatmentName.trim()) {
          return res.status(400).json({ success: false, message: "Treatment name is required for all treatments" });
        }
        if (!treatment.sessions || treatment.sessions < 1) {
          return res.status(400).json({ success: false, message: "Valid sessions (minimum 1) is required for all treatments" });
        }
      }

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
      pkg.price = parseFloat(price);
      pkg.treatments = treatments.map((t) => ({
        treatmentName: t.treatmentName.trim(),
        treatmentSlug: t.treatmentSlug || "",
        sessions: parseInt(t.sessions) || 1,
      }));
      await pkg.save();

      return res.status(200).json({
        success: true,
        message: "Package updated successfully",
        package: {
          _id: pkg._id.toString(),
          name: pkg.name,
          price: pkg.price,
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
      const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
      const { hasPermission, error } = await checkClinicPermission(
        clinicId,
        "room_management",
        "delete",
        null,
        clinicUser.role
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: error || "You do not have permission to delete packages",
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


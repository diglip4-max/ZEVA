import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import jwt from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(process.cwd(), "public/uploads/clinic");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "clinic-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Helper function to run middleware
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) {
        return reject(result);
      }
      return resolve(result);
    });
  });
}

// Helper to get base URL
function getBaseUrl() {
  if (process.env.NODE_ENV === "production") {
    return "https://zeva360.com";
  }
 return process.env.NEXT_PUBLIC_BASE_URL ;
}

export default async function handler(req, res) {
  await dbConnect();

  const {
    query: { id },
    method,
  } = req;

  let me = null;
  try {
    me = await getUserFromReq(req);
  } catch (err) {
    me = null;
  }

  if (method !== "GET") {
    if (!me || !requireRole(me, ["clinic", "admin"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
  }

  // GET - Fetch clinic by ID
  if (method === "GET") {
    try {
      // ✅ Resolve clinicId for permission check
      if (me) {
        let clinicId;
        if (me.role === "clinic") {
          const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
          if (!clinic) {
            return res.status(404).json({ success: false, message: "Clinic not found for this user" });
          }
          clinicId = clinic._id;
        } else if (me.role === "admin") {
          clinicId = id;
        }

        if (me.role !== "admin" && clinicId) {
          const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
          const { hasPermission, error } = await checkClinicPermission(
            clinicId,
            "health_center",
            "read"
          );

          if (!hasPermission) {
            return res.status(403).json({
              success: false,
              message: error || "You do not have permission to view clinic information"
            });
          }
        }
      }
      if (me && me.role === "clinic") {
        const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
        if (!clinic) {
          return res.status(404).json({ success: false, message: "Clinic not found for this user" });
        }
        clinicId = clinic._id;
      } else if (me && me.role === "admin") {
        // Admin can view any clinic, use the ID from URL
        clinicId = id;
      }

      // ✅ Check permission for reading clinic (only for clinic, admin bypasses)
      if (me && me.role !== "admin" && clinicId) {
        const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
        const { hasPermission, error } = await checkClinicPermission(
          clinicId,
          "health_center",
          "read"
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: error || "You do not have permission to view clinic information"
          });
        }
      }

      const clinic = await Clinic.findById(id).lean();

      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }

      // Ensure photos are absolute URLs
      if (clinic.photos && Array.isArray(clinic.photos)) {
        clinic.photos = clinic.photos.map((photo) =>
          photo.startsWith("http") ? photo : `${getBaseUrl()}${photo}`
        );
      }
      if (clinic.licenseDocumentUrl) {
        clinic.licenseDocumentUrl = clinic.licenseDocumentUrl.startsWith("http")
          ? clinic.licenseDocumentUrl
          : `${getBaseUrl()}${clinic.licenseDocumentUrl}`;
      }

      return res.status(200).json({ success: true, clinic });
    } catch (error) {
      console.error("Error fetching clinic by ID:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // PUT - Update clinic
  if (method === "PUT") {
    try {
      console.log("🔄 Starting PUT request for clinic ID:", id);

      // ✅ Resolve clinicId
      let clinicId;
      if (me.role === "clinic") {
        const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
        if (!clinic) {
          return res.status(404).json({ success: false, message: "Clinic not found for this user" });
        }
        clinicId = clinic._id;
      } else if (me.role === "admin") {
        // Admin can update any clinic, use the ID from URL
        clinicId = id;
      }

      // ✅ Check permission for updating clinic (only for clinic, admin bypasses)
      if (me.role !== "admin" && clinicId) {
        const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
        const { hasPermission, error } = await checkClinicPermission(
          clinicId,
          "health_center",
          "update"
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: error || "You do not have permission to update clinic information"
          });
        }
      }

      // Find the clinic by ID and verify ownership (for clinic users)
      let existingClinic;
      if (me.role === "clinic") {
        existingClinic = await Clinic.findOne({
        _id: id,
          owner: me._id,
      });
      } else if (me.role === "admin") {
        existingClinic = await Clinic.findById(id);
      }

      if (!existingClinic) {
        console.log("❌ Clinic not found for user:", me._id);
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found or access denied" });
      }

      console.log("✅ Found existing clinic:", existingClinic._id);

      // Handle file upload if present
      let photoPath = null;
      if (req.headers["content-type"]?.includes("multipart/form-data")) {
        try {
          await runMiddleware(req, res, upload.single("photo"));
          if (req.file) {
            photoPath = `/uploads/clinic/${req.file.filename}`;
            console.log("📸 File uploaded:", photoPath);
          }
        } catch (uploadError) {
          console.error("File upload error:", uploadError);
          return res.status(400).json({ message: "File upload failed" });
        }
      }

      // Parse the request body
      const updateData = { ...req.body };

      // Parse JSON fields that come as strings from FormData
      if (typeof updateData.servicesName === "string") {
        try {
          updateData.servicesName = JSON.parse(updateData.servicesName);
        } catch {
          updateData.servicesName = updateData.servicesName
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s);
        }
      }

      if (typeof updateData.treatments === "string") {
        try {
          updateData.treatments = JSON.parse(updateData.treatments);
          // Ensure each treatment has the correct structure
          if (Array.isArray(updateData.treatments)) {
            updateData.treatments = updateData.treatments.map((treatment) => {
              if (typeof treatment === "string") {
                // Convert string to object format
                return {
                  mainTreatment: treatment,
                  mainTreatmentSlug: treatment
                    .toLowerCase()
                    .replace(/\s+/g, "-"),
                  subTreatments: [],
                };
              } else if (
                treatment.mainTreatment &&
                treatment.mainTreatmentSlug
              ) {
                // Ensure subTreatments array exists and has correct structure
                return {
                  ...treatment,
                  subTreatments: (treatment.subTreatments || []).map(
                    (subTreatment) => {
                      if (typeof subTreatment === "string") {
                        return {
                          name: subTreatment,
                          slug: subTreatment.toLowerCase().replace(/\s+/g, "-"),
                        };
                      }
                      return subTreatment;
                    }
                  ),
                };
              }
              return treatment;
            });
          }
        } catch (error) {
          console.error("Error parsing treatments:", error);
          // Fallback: convert comma-separated strings to treatment objects
          updateData.treatments = updateData.treatments
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s)
            .map((treatment) => ({
              mainTreatment: treatment,
              mainTreatmentSlug: treatment.toLowerCase().replace(/\s+/g, "-"),
              subTreatments: [],
            }));
        }
      }

      if (typeof updateData.location === "string") {
        try {
          updateData.location = JSON.parse(updateData.location);
        } catch {
          console.error("Error parsing location:", e);
        }
      }

      // Add photo to update data if uploaded
      if (photoPath) {
        updateData.photos = [photoPath];
      }

      // Remove undefined/empty fields
      Object.keys(updateData).forEach((key) => {
        if (
          updateData[key] === undefined ||
          updateData[key] === "undefined" ||
          updateData[key] === ""
        ) {
          delete updateData[key];
        }
      });

      console.log("🔄 Updating clinic with data:", updateData);

      // Update the clinic
      const updatedClinic = await Clinic.findByIdAndUpdate(
        existingClinic._id,
        updateData,
        { new: true, runValidators: true }
      );

      // Ensure photos are absolute URLs
      if (
        updatedClinic &&
        updatedClinic.photos &&
        Array.isArray(updatedClinic.photos)
      ) {
        updatedClinic.photos = updatedClinic.photos.map((photo) =>
          photo.startsWith("http") ? photo : `${getBaseUrl()}${photo}`
        );
      }
      if (updatedClinic && updatedClinic.licenseDocumentUrl) {
        updatedClinic.licenseDocumentUrl =
          updatedClinic.licenseDocumentUrl.startsWith("http")
            ? updatedClinic.licenseDocumentUrl
            : `${getBaseUrl()}${updatedClinic.licenseDocumentUrl}`;
      }

      console.log("✅ Clinic updated successfully:", updatedClinic);

      return res.status(200).json({
        success: true,
        clinic: updatedClinic,
        message: "Clinic updated successfully",
      });
    } catch (error) {
      console.error("❌ Error updating clinic:", error);
      if (error.name === "ValidationError") {
        return res
          .status(400)
          .json({ success: false, message: "Validation error", details: error.errors });
      }
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // DELETE - Delete clinic
  if (method === "DELETE") {
    try {
      console.log("🗑️ Starting DELETE request for clinic ID:", id);

      // ✅ Resolve clinicId
      let clinicId;
      if (me.role === "clinic") {
        const clinic = await Clinic.findOne({ owner: me._id }).select("_id");
        if (!clinic) {
          return res.status(404).json({ success: false, message: "Clinic not found for this user" });
        }
        clinicId = clinic._id;
      } else if (me.role === "admin") {
        // Admin can delete any clinic, use the ID from URL
        clinicId = id;
      }

      // ✅ Check permission for deleting clinic (only for clinic, admin bypasses)
      if (me.role !== "admin" && clinicId) {
        const { checkClinicPermission } = await import("../lead-ms/permissions-helper");
        const { hasPermission, error } = await checkClinicPermission(
          clinicId,
          "health_center",
          "delete"
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: error || "You do not have permission to delete clinic"
          });
        }
      }

      // Find the clinic by ID and verify ownership (for clinic users)
      let existingClinic;
      if (me.role === "clinic") {
        existingClinic = await Clinic.findOne({
          _id: id,
          owner: me._id,
        });
      } else if (me.role === "admin") {
        existingClinic = await Clinic.findById(id);
      }

      if (!existingClinic) {
        console.log("❌ Clinic not found for user:", me._id);
        return res
          .status(404)
          .json({ success: false, message: "Clinic not found or access denied" });
      }

      console.log("✅ Found clinic to delete:", existingClinic._id);

      // Delete associated photos from filesystem
      if (existingClinic.photos && existingClinic.photos.length > 0) {
        existingClinic.photos.forEach((photoPath) => {
          if (photoPath && photoPath.startsWith("/uploads/clinic/")) {
            const fullPath = path.join(process.cwd(), "public", photoPath);
            fs.unlink(fullPath, (err) => {
              if (err) console.error("Error deleting photo:", err);
              else console.log("📸 Photo deleted:", photoPath);
            });
          }
        });
      }

      // Delete license document if exists
      if (existingClinic.licenseDocumentUrl) {
        const licensePath = path.join(
          process.cwd(),
          "public",
          existingClinic.licenseDocumentUrl
        );
        fs.unlink(licensePath, (err) => {
          if (err) console.error("Error deleting license document:", err);
          else console.log("📄 License document deleted");
        });
      }

      // Delete the clinic from database
      await Clinic.findByIdAndDelete(existingClinic._id);

      console.log("✅ Clinic deleted successfully");

      return res.status(200).json({
        success: true,
        message: "Clinic deleted successfully",
      });
    } catch (error) {
      console.error("❌ Error deleting clinic:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  }

  // Method not allowed
  console.log("❌ Method not allowed:", method);
  return res.status(405).json({ success: false, message: "Method not allowed" });
}

// Important: Disable body parser for file uploads (needed for PUT method with file upload)
export const config = {
  api: {
    bodyParser: false,
  },
};

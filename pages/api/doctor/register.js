import fs from "fs";
import path from "path";
import multer from "multer";
import axios from "axios";
import dbConnect from "../../../lib/database";
import User from "../../../models/Users";
import DoctorProfile from "../../../models/DoctorProfile";

export const config = {
  api: {
    bodyParser: false,
  },
};

const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), "public/uploads/clinic");
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + "-" + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

const uploadMiddleware = upload.fields([{ name: "resume", maxCount: 1 }]);

const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  await dbConnect();
  await runMiddleware(req, res, uploadMiddleware);

  try {
    const { name, phone, email, specialization, degree, experience, address } =
      req.body;

    // Validate experience
    const parsedExperience = parseInt(experience);
    if (isNaN(parsedExperience)) {
      return res
        .status(400)
        .json({ message: "Experience must be a valid number" });
    }

    const existingUser = await User.findOne({ email, role: "doctor" });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "A doctor with this email already exists" });
    }

    const resumePath = req.files?.["resume"]?.[0]?.path
      ? req.files["resume"][0].path.replace("public", "").replace(/\\/g, "/")
      : "";

    // Use Google Maps API to get coordinates
    const geoRes = await axios.get(
      "https://maps.googleapis.com/maps/api/geocode/json",
      {
        params: {
          address,
          key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      }
    );

    const location = geoRes.data.results[0]?.geometry.location;
    if (!location) {
      return res.status(400).json({ message: "Invalid address" });
    }

    // Create user
    const user = await User.create({
      name,
      phone,
      email,
      role: "doctor",
      isApproved: false,
      declined: false,
    });

    try {
      // Handle treatments - convert specialization to treatments structure
      let treatments = [];
      if (specialization && specialization.trim()) {
        treatments = [
          {
            mainTreatment: specialization.trim(),
            mainTreatmentSlug: specialization
              .trim()
              .toLowerCase()
              .replace(/\s+/g, "-"),
            subTreatments: [],
          },
        ];
      }

      // Create doctor profile
      const doctor = await DoctorProfile.create({
        user: user._id,
        degree,
        experience: parsedExperience,
        address,
        treatments,
        location: {
          type: "Point",
          coordinates: [location.lng, location.lat],
        },
        resumeUrl: resumePath,
      });

      return res.status(201).json({
        message: "Doctor registered successfully",
        user,
        doctor,
      });
    } catch (err) {
      // Rollback user if doctor profile fails
      await User.findByIdAndDelete(user._id);
      console.error("DoctorProfile creation failed, rolled back user:", err);
      return res.status(500).json({
        message: "Failed to create doctor profile",
        error: err.message,
      });
    }
  } catch (error) {
    console.error("Unhandled error:", error);
    return res
      .status(500)
      .json({ message: "Server error", error: error.message });
  }
}

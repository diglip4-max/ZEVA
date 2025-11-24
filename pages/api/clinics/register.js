import path from 'path';
import fs from 'fs';
import multer from 'multer';
import dbConnect from '../../../lib/database';
import Clinic from '../../../models/Clinic';
import User from '../../../models/Users';
import Treatment from '../../../models/Treatment';


// Disable default body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};

// Ensure directory exists
const ensureDirectoryExists = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(process.cwd(), 'public/uploads/clinic');
    ensureDirectoryExists(uploadDir);
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });
const uploadMiddleware = upload.fields([
  { name: 'clinicPhoto', maxCount: 1 },
  { name: 'licenseDocument', maxCount: 1 },
]);

const runMiddleware = (req, res, fn) => {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    await dbConnect();

    await runMiddleware(req, res, uploadMiddleware);

    const {
      email,
      name,
      address,
      pricing,
      timings,
      treatments, // Expecting JSON stringified array of treatment refs
      latitude,
      longitude,
    } = req.body;

    const user = await User.findOne({ email, role: 'clinic' });
    if (!user) {
      return res.status(404).json({ message: 'Clinic user not found' });
    }

    const clinicPhotoPath = req.files?.['clinicPhoto']?.[0]?.path
      ? req.files['clinicPhoto'][0].path.replace('public', '').replace(/\\/g, '/')
      : '';

    const licensePath = req.files?.['licenseDocument']?.[0]?.path
      ? req.files['licenseDocument'][0].path.replace('public', '').replace(/\\/g, '/')
      : '';

    // 🧠 Parse the treatment references (array of { mainTreatment, mainTreatmentSlug, subTreatments })
    let parsedTreatments = [];
    try {
      parsedTreatments = JSON.parse(treatments); // from JSON.stringify on frontend
      
      // Ensure each treatment has the correct structure
      if (Array.isArray(parsedTreatments)) {
        parsedTreatments = parsedTreatments.map(treatment => {
          if (typeof treatment === 'string') {
            // Convert string to object format
            return {
              mainTreatment: treatment,
              mainTreatmentSlug: treatment.toLowerCase().replace(/\s+/g, '-'),
              subTreatments: []
            };
          } else if (treatment.mainTreatment && treatment.mainTreatmentSlug) {
            // Ensure subTreatments array exists
            return {
              ...treatment,
              subTreatments: treatment.subTreatments || []
            };
          }
          return treatment;
        });
      }
    } catch {
      return res.status(400).json({ message: 'Invalid treatment format' });
    }

    // ✅ Optional validation: check if mainTreatment exists in DB
    for (let t of parsedTreatments) {
      let found = await Treatment.findOne({ name: t.mainTreatment });
      if (!found) {
        // Add the custom treatment to the database if it doesn't exist
        found = await Treatment.create({
          name: t.mainTreatment,
          slug: t.mainTreatmentSlug,
          subTreatments: t.subTreatments
        });
      }
    }

    // Create clinic
    const clinic = await Clinic.create({
      owner: user._id,
      name,
      address,
      treatments: parsedTreatments,
      pricing,
      timings,
      photos: clinicPhotoPath ? [clinicPhotoPath] : [],
      licenseDocumentUrl: licensePath || null,
      location: {
        type: 'Point',
        coordinates: [parseFloat(longitude), parseFloat(latitude)],
      },
    });

    return res.status(200).json({ message: 'Clinic saved', clinic });
  } catch (err) {
    console.error('❌ Clinic Save Error:', err);
    return res.status(500).json({
      message: 'Error saving clinic',
      error: err.message || 'Internal server error',
    });
  }
}

// import jwt from "jsonwebtoken";
// import dbConnect from "../../../lib/database";
// import PettyCash from "../../../models/PettyCash";
// import User from "../../../models/Users";

// export default async function handler(req, res) {
//   await dbConnect();

//   if (req.method !== "POST") {
//     return res.status(405).json({ message: "Method Not Allowed" });
//   }

//   try {
//     const token = req.headers.authorization?.split(" ")[1];
//     if (!token) {
//       return res.status(401).json({ message: "Token missing" });
//     }

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const staffId = decoded.userId;

//     const staffUser = await User.findById(staffId);
//     if (!staffUser || staffUser.role !== "staff") {
//       return res.status(403).json({ message: "Access denied" });
//     }

//     const { pettyCashId, description, spentAmount } = req.body;

//     if (!pettyCashId || !description || !spentAmount) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     const pettyCash = await PettyCash.findById(pettyCashId);

//     if (!pettyCash) {
//       return res.status(404).json({ message: "Petty cash record not found" });
//     }

//     if (pettyCash.staffId.toString() !== staffId.toString()) {
//       return res.status(403).json({ message: "You are not authorized to add expense to this record" });
//     }

//     pettyCash.expenses.push({
//       description,
//       spentAmount: Number(spentAmount),
//       date: new Date(),
//     });

//     await pettyCash.save();

//     res.status(200).json({
//       message: "Expense added successfully",
//       pettyCash,
//     });
//   } catch (error) {
//     console.error("Error adding expense:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// }



// import jwt from "jsonwebtoken";
// import dbConnect from "../../../lib/database";
// import PettyCash from "../../../models/PettyCash";
// import User from "../../../models/Users";
// import multer from "multer";
// import nextConnect from "next-connect";

// // Configure multer for file upload
// const upload = multer({ storage: multer.memoryStorage() }); // You can switch to diskStorage or Cloudinary integration

// const apiRoute = nextConnect({
//   onError(error, req, res) {
//     console.error(error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   },
//   onNoMatch(req, res) {
//     res.status(405).json({ message: `Method ${req.method} Not Allowed` });
//   },
// });

// apiRoute.use(upload.array("receipts")); // Expect receipts files in form-data

// apiRoute.post(async (req, res) => {
//   await dbConnect();

//   try {
//     const token = req.headers.authorization?.split(" ")[1];
//     if (!token) return res.status(401).json({ message: "Token missing" });

//     const decoded = jwt.verify(token, process.env.JWT_SECRET);
//     const staffId = decoded.userId;

//     const staffUser = await User.findById(staffId);
//     if (!staffUser || staffUser.role !== "staff") {
//       return res.status(403).json({ message: "Access denied" });
//     }

//     const { pettyCashId, description, spentAmount } = req.body;
//     if (!pettyCashId || !description || !spentAmount) {
//       return res.status(400).json({ message: "All fields are required" });
//     }

//     const pettyCash = await PettyCash.findById(pettyCashId);
//     if (!pettyCash) return res.status(404).json({ message: "Petty cash record not found" });

//     if (pettyCash.staffId.toString() !== staffId.toString()) {
//       return res.status(403).json({ message: "You are not authorized to add expense to this record" });
//     }

//     // Convert uploaded files to URLs (replace this with Cloudinary or S3 upload logic)
//     const receiptUrls = (req.files || []).map((file) => `uploaded_url_placeholder/${file.originalname}`);

//     pettyCash.expenses.push({
//       description,
//       spentAmount: Number(spentAmount),
//       receipts: receiptUrls,
//       date: new Date(),
//     });

//     await pettyCash.save();

//     res.status(200).json({
//       message: "Expense added successfully",
//       pettyCash,
//     });
//   } catch (error) {
//     console.error("Error adding expense:", error);
//     res.status(500).json({ message: "Server error", error: error.message });
//   }
// });

// export default apiRoute;

// // Disable default body parsing for multer
// export const config = {
//   api: {
//     bodyParser: false,
//   },
// };


import jwt from "jsonwebtoken";
import dbConnect from "../../../lib/database";
import PettyCash from "../../../models/PettyCash";
import User from "../../../models/Users";
import Vendor from "../../../models/VendorProfile";
import multer from "multer";
import FormData from "form-data";
import fetch from "node-fetch";

// Multer config for memory storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Disable default body parser
export const config = {
  api: {
    bodyParser: false,
  },
};

// Helper to run multer
const runMiddleware = (req, res, fn) =>
  new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) reject(result);
      else resolve(result);
    });
  });

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST")
    return res.status(405).json({ message: "Method Not Allowed" });

  try {
    // Parse multipart/form-data
    await runMiddleware(req, res, upload.array("receipts"));

    // Access fields from req.body safely
    const pettyCashId = req.body ? req.body.pettyCashId : undefined;
    const description = req.body.description;
    const spentAmount = req.body.spentAmount;
    const vendor = req.body.vendor;

    // Validate required fields
    if (
      !description ||
      spentAmount === undefined ||
      spentAmount === ""
    ) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Verify JWT
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ message: "Token missing" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const staffId = decoded.userId;

    const staffUser = await User.findById(staffId);
    if (!staffUser || staffUser.role !== "staff") {
      return res.status(403).json({ message: "Access denied" });
    }

    let pettyCash = null;
    if (pettyCashId) {
      pettyCash = await PettyCash.findById(pettyCashId);
      if (!pettyCash)
        return res
          .status(404)
          .json({ message: "Petty cash record not found" });

      if (pettyCash.staffId.toString() !== staffId.toString()) {
        return res
          .status(403)
          .json({ message: "You are not authorized to add expense to this record" });
      }
    } else {
      // Create a new PettyCash record for each expense entry
      pettyCash = await PettyCash.create({
        staffId,
        note: `Expense: ${description}`,
        allocatedAmounts: [],
        expenses: [],
      });
    }

    // Upload receipts to Cloudinary (skip gracefully if env not configured)
    const receiptFiles = req.files || [];
    const receiptUrls = [];
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (cloudName && uploadPreset && receiptFiles.length > 0) {
      for (const file of receiptFiles) {
        if (!file || !file.buffer) continue;
        const safeFilename = (file && typeof file.originalname === 'string' && file.originalname.trim())
          ? file.originalname
          : `receipt-${Date.now()}.bin`;
        const formData = new FormData();
        formData.append("file", file.buffer, safeFilename);
        formData.append("upload_preset", uploadPreset);

        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/upload`,
          { method: "POST", body: formData }
        );
        const data = await response.json();
        if (data && data.secure_url) receiptUrls.push(data.secure_url);
      }
    }

    // Get vendor name if vendor ID is provided
    let vendorName = null;
    if (vendor) {
      try {
        // Validate ObjectId to avoid server errors in production
        const isValidId = Vendor.db && Vendor.db.base && Vendor.db.base.Types && Vendor.db.base.Types.ObjectId.isValid
          ? Vendor.db.base.Types.ObjectId.isValid(vendor)
          : true;
        if (isValidId) {
          const vendorDoc = await Vendor.findById(vendor).lean();
          vendorName = vendorDoc && typeof vendorDoc.name === 'string' ? vendorDoc.name : null;
        }
      } catch {
        vendorName = null;
      }
    }

    // Add expense
    pettyCash.expenses.push({
      description,
      spentAmount: Number(spentAmount),
      vendor: vendor || null,
      vendorName: vendorName,
      receipts: receiptUrls,
      date: new Date(),
    });

    await pettyCash.save();

    // Update global spent amount
    await PettyCash.updateGlobalSpentAmount(Number(spentAmount), 'add');

    res.status(200).json({
      message: "Expense added successfully",
      pettyCash,
    });
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
}

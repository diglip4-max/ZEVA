// import-patients.js
import dbConnect from "../../../lib/database";
import PatientRegistration from "../../../models/PatientRegistration";
import { getAuthorizedStaffUser } from "../../../server/staff/authHelpers";
import { checkClinicPermission } from "../lead-ms/permissions-helper";
import { checkAgentPermission } from "../agent/permissions-helper";
import Clinic from "../../../models/Clinic";
import csv from "csvtojson";
import multer from "multer";
import * as XLSX from "xlsx";
import { importPatientsFromFileQueue } from "../../../bullmq/queue.js";

// Multer setup
const upload = multer({ storage: multer.memoryStorage() });

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

// Disable Next.js bodyParser for file upload
export const config = {
  api: {
    bodyParser: false,
  },
};

const hasRole = (user, roles = []) => roles.includes(user.role);

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // Get authenticated user
    let user;
    try {
      user = await getAuthorizedStaffUser(req, {
        allowedRoles: ["staff", "doctorStaff", "doctor", "clinic", "agent", "admin"],
      });
    } catch (err) {
      return res.status(err.status || 401).json({ success: false, message: err.message || "Authentication error" });
    }

    if (!hasRole(user, ["clinic", "staff", "admin", "agent", "doctorStaff", "doctor"])) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // Check permissions for creating patients (admin bypasses all checks)
    if (user.role !== 'admin') {
      // For clinic role: Check clinic permissions
      if (user.role === 'clinic') {
        const clinic = await Clinic.findOne({ owner: user._id });
        if (clinic) {
          const { hasPermission: clinicHasPermission, error: clinicError } = await checkClinicPermission(
            clinic._id,
            "patient_registration",
            "create"
          );
          if (!clinicHasPermission) {
            return res.status(403).json({
              success: false,
              message: clinicError || "You do not have permission to import patients"
            });
          }
        }
      }
      // For agent role: Check agent permissions
      else if (user.role === 'agent') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "patient_registration",
          "create"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to import patients"
          });
        }
      }
      // For doctorStaff role: Check agent permissions
      else if (user.role === 'doctorStaff') {
        const { hasPermission: agentHasPermission, error: agentError } = await checkAgentPermission(
          user._id,
          "patient_registration",
          "create"
        );
        if (!agentHasPermission) {
          return res.status(403).json({
            success: false,
            message: agentError || "You do not have permission to import patients"
          });
        }
      }
    }

    // Handle file upload
    await runMiddleware(req, res, upload.single("file"));

    if (!req.file) {
      return res.status(400).json({ success: false, message: "File is required for import" });
    }

    // Check file size (5MB limit)
    const MAX_FILE_SIZE = 5 * 1024 * 1024;
    if (req.file.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: `File size too large. Maximum allowed size is 5MB. Your file is ${(
          req.file.size / (1024 * 1024)
        ).toFixed(2)}MB.`,
      });
    }

    // Check file extension
    const validExtensions = [".csv", ".xlsx", ".xls"];
    const fileExt = req.file.originalname
      .toLowerCase()
      .substring(req.file.originalname.lastIndexOf("."));
    if (!validExtensions.includes(fileExt)) {
      return res.status(400).json({
        success: false,
        message: "Please upload a CSV or Excel file (.csv, .xlsx, .xls)",
      });
    }

    // Parse column mapping from form data
    let columnMapping = {};
    if (req.body.columnMapping) {
      try {
        columnMapping = typeof req.body.columnMapping === 'string' 
          ? JSON.parse(req.body.columnMapping) 
          : req.body.columnMapping;
      } catch (e) {
        return res.status(400).json({
          success: false,
          message: "Invalid column mapping format",
        });
      }
    }

    // Parse the file
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname.toLowerCase();
    let jsonArray = [];

    if (fileName.endsWith(".csv")) {
      jsonArray = await csv().fromString(fileBuffer.toString());
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const workbook = XLSX.read(fileBuffer, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      jsonArray = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      return res.status(400).json({
        success: false,
        message: "Unsupported file format. Upload CSV or Excel.",
      });
    }

    if (!jsonArray || jsonArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: "File is empty or has no data",
      });
    }

    // Get user name for invoicedBy
    const computedInvoicedBy =
      user.name ||
      user.fullName ||
      user.email ||
      user.username ||
      user.mobileNumber ||
      String(user._id);

    // Get current max invoice number for today to start sequential generation
    const date = new Date();
    const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
    const invoicePattern = new RegExp(`^INV-${dateStr}-(\\d+)$`);
    
    const patientsWithInvoice = await PatientRegistration.find({
      invoiceNumber: { $regex: invoicePattern },
    })
      .select("invoiceNumber")
      .lean();

    let maxInvoiceSeq = 0;
    for (const patient of patientsWithInvoice) {
      if (patient.invoiceNumber) {
        const match = patient.invoiceNumber.match(invoicePattern);
        if (match) {
          const num = parseInt(match[1], 10);
          if (num > maxInvoiceSeq) {
            maxInvoiceSeq = num;
          }
        }
      }
    }

    // Validate and prepare patient data for queue
    const patientsToInsert = [];
    const validationErrors = [];

    for (let i = 0; i < jsonArray.length; i++) {
      const row = jsonArray[i];
      const errors = [];

      try {
        // Map columns
        const mapped = {};
        Object.entries(columnMapping).forEach(([excelCol, ourField]) => {
          mapped[ourField] = row[excelCol];
        });

        // Validate required fields
        if (!mapped.firstName || String(mapped.firstName).trim() === "") {
          errors.push("First name is required");
        }
        if (!mapped.mobileNumber || String(mapped.mobileNumber).trim() === "") {
          errors.push("Mobile number is required");
        }
        if (!mapped.gender || String(mapped.gender).trim() === "") {
          errors.push("Gender is required");
        }

        if (errors.length > 0) {
          validationErrors.push(`Row ${i + 2}: ${errors.join(", ")}`);
          continue;
        }

        // Validate and normalize phone number
        const patientPhone = String(mapped.mobileNumber).trim().replace(/\D/g, "");
        if (patientPhone.length !== 10) {
          validationErrors.push(`Row ${i + 2}: Invalid phone number. Must be exactly 10 digits.`);
          continue;
        }

        // Validate gender
        const gender = String(mapped.gender).trim();
        if (!["Male", "Female", "Other"].includes(gender)) {
          validationErrors.push(`Row ${i + 2}: Invalid gender. Must be Male, Female, or Other.`);
          continue;
        }

        // Prepare patient data (without invoice/EMR numbers - will be generated in worker)
        const patientData = {
          invoicedDate: mapped.invoicedDate ? new Date(mapped.invoicedDate) : new Date(),
          firstName: String(mapped.firstName).trim(),
          lastName: mapped.lastName ? String(mapped.lastName).trim() : "",
          gender: gender,
          email: mapped.email ? String(mapped.email).trim().toLowerCase() : "",
          mobileNumber: patientPhone,
          referredBy: mapped.referredBy ? String(mapped.referredBy).trim() : "",
          patientType: mapped.patientType && ["New", "Old"].includes(String(mapped.patientType).trim()) 
            ? String(mapped.patientType).trim() 
            : "New",
          insurance: mapped.insurance && ["Yes", "No"].includes(String(mapped.insurance).trim())
            ? String(mapped.insurance).trim()
            : "No",
          insuranceType: mapped.insuranceType && ["Paid", "Advance"].includes(String(mapped.insuranceType).trim())
            ? String(mapped.insuranceType).trim()
            : "Paid",
          advanceGivenAmount: mapped.advanceGivenAmount ? parseFloat(mapped.advanceGivenAmount) || 0 : 0,
          coPayPercent: mapped.coPayPercent ? parseFloat(mapped.coPayPercent) || 0 : 0,
          advanceClaimStatus: mapped.insurance === "Yes" 
            ? (mapped.advanceClaimStatus && ["Pending", "Released", "Cancelled", "Approved by doctor"].includes(String(mapped.advanceClaimStatus).trim())
              ? String(mapped.advanceClaimStatus).trim()
              : "Pending")
            : null,
          advanceClaimReleasedBy: mapped.advanceClaimReleasedBy ? String(mapped.advanceClaimReleasedBy).trim() : null,
          notes: mapped.notes ? String(mapped.notes).trim() : "",
        };

        patientsToInsert.push(patientData);
      } catch (error) {
        validationErrors.push(`Row ${i + 2}: ${error.message || "Unknown error"}`);
      }
    }

    // If there are validation errors, return them immediately
    if (validationErrors.length > 0 && patientsToInsert.length === 0) {
      return res.status(400).json({
        success: false,
        message: "All rows have validation errors",
        data: {
          total: jsonArray.length,
          imported: 0,
          failed: validationErrors.length,
          errors: validationErrors,
        },
      });
    }

    // Queue the job for background processing
    try {
      const job = await importPatientsFromFileQueue.add(
        "importPatients",
        {
          patientsToInsert,
          userId: user._id,
          computedInvoicedBy,
          dateStr,
          maxInvoiceSeq,
        },
        {
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
          removeOnComplete: {
            age: 24 * 3600, // Keep completed jobs for 24 hours
            count: 1000, // Keep max 1000 completed jobs
          },
          removeOnFail: {
            age: 7 * 24 * 3600, // Keep failed jobs for 7 days
          },
        }
      );

      return res.status(202).json({
        success: true,
        message: `Patient import job queued. ${patientsToInsert.length} patients will be processed in the background.`,
        jobId: job.id,
        data: {
          total: jsonArray.length,
          queued: patientsToInsert.length,
          validationErrors: validationErrors.length,
          errors: validationErrors.slice(0, 10), // Return first 10 validation errors
        },
      });
    } catch (queueError) {
      console.error("Error queueing patient import job:", queueError);
      
      // If Redis is not available, fall back to synchronous processing
      if (queueError.code === "ECONNREFUSED" || queueError.message?.includes("ECONNREFUSED")) {
        console.warn("⚠️ Redis not available, falling back to synchronous processing");
        
        // Process synchronously (fallback)
        const results = {
          total: jsonArray.length,
          imported: 0,
          failed: validationErrors.length,
          errors: validationErrors,
        };

        // Import patients synchronously
        const date = new Date();
        const dateStrSync = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
        const invoicePattern = new RegExp(`^INV-${dateStrSync}-(\\d+)$`);
        
        const patientsWithInvoice = await PatientRegistration.find({
          invoiceNumber: { $regex: invoicePattern },
        })
          .select("invoiceNumber")
          .lean();

        let maxInvoiceSeqSync = 0;
        for (const patient of patientsWithInvoice) {
          if (patient.invoiceNumber) {
            const match = patient.invoiceNumber.match(invoicePattern);
            if (match) {
              const num = parseInt(match[1], 10);
              if (num > maxInvoiceSeqSync) {
                maxInvoiceSeqSync = num;
              }
            }
          }
        }

        let invoiceSequence = maxInvoiceSeqSync;
        const getNextInvoiceNumber = () => {
          invoiceSequence++;
          return `INV-${dateStrSync}-${String(invoiceSequence).padStart(3, "0")}`;
        };

        const { generateEmrNumber } = await import("../../../lib/generateEmrNumber.js");

        for (let i = 0; i < patientsToInsert.length; i++) {
          try {
            let invoiceNumber = getNextInvoiceNumber();
            let existingInvoice = await PatientRegistration.findOne({ invoiceNumber });
            if (existingInvoice) {
              let attempts = 0;
              while (existingInvoice && attempts < 100) {
                invoiceSequence++;
                invoiceNumber = getNextInvoiceNumber();
                existingInvoice = await PatientRegistration.findOne({ invoiceNumber });
                if (!existingInvoice) break;
                attempts++;
              }
            }

            const emrNumber = await generateEmrNumber();
            const finalPatientData = {
              ...patientsToInsert[i],
              invoiceNumber,
              emrNumber,
              userId: user._id,
              invoicedBy: computedInvoicedBy,
            };

            await PatientRegistration.create(finalPatientData);
            results.imported++;
          } catch (patientError) {
            results.failed++;
            if (patientError.name === 'ValidationError') {
              const validationErrors = Object.values(patientError.errors).map(e => e.message).join(", ");
              results.errors.push(`Row ${i + 2}: Patient validation failed: ${validationErrors}`);
            } else if (patientError.code === 11000) {
              const field = Object.keys(patientError.keyPattern)[0];
              results.errors.push(`Row ${i + 2}: ${field} already exists`);
            } else {
              results.errors.push(`Row ${i + 2}: Failed to create patient: ${patientError.message || "Unknown error"}`);
            }
          }
        }

        return res.status(200).json({
          success: true,
          message: `Imported ${results.imported} patients synchronously (Redis not available). ${results.failed} failed.`,
          data: results,
          warning: "Processed synchronously because Redis is not available. For better performance, please start Redis server.",
        });
      }
      
      // Re-throw other queue errors
      throw queueError;
    }
  } catch (error) {
    console.error("Error importing patients:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to import patients",
    });
  }
}

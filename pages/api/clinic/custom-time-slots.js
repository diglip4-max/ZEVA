import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  try {
    // Verify clinic authentication
    const clinicUser = await getUserFromReq(req);
    if (!clinicUser) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }
    if (!["clinic", "admin", "agent", "doctor", "doctorStaff", "staff"].includes(clinicUser.role)) {
      return res.status(403).json({ success: false, message: "Access denied. Clinic role required." });
    }

    let { clinicId, error, isAdmin } = await getClinicIdFromUser(clinicUser);
    if (error && !isAdmin) {
      return res.status(404).json({ success: false, message: error });
    }

    // Ensure clinicId is set correctly
    if (!clinicId && clinicUser.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: clinicUser._id }).select("_id");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }
      clinicId = clinic._id;
    }

    if (!clinicId) {
      return res.status(404).json({ success: false, message: "Clinic not found" });
    }

    // GET: Fetch custom time slot settings from timings field
    if (req.method === "GET") {
      const clinic = await Clinic.findById(clinicId).select("timings");
      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }

      const timings = clinic.timings || "";
      
      // Check if timings is in custom format: "H:MM AM - H:MM PM" or "HH:MM AM - HH:MM PM"
      // Examples: "8:00 AM - 11:00 PM", "08:00 AM - 11:00 PM"
      const customTimeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const customMatch = timings.trim().match(customTimeRegex);
      
      if (customMatch) {
        // Custom time slots format - return in 12-hour format with AM/PM as stored
        const startHour = parseInt(customMatch[1]);
        const startMin = customMatch[2];
        const startPeriod = customMatch[3].toUpperCase();
        const endHour = parseInt(customMatch[4]);
        const endMin = customMatch[5];
        const endPeriod = customMatch[6].toUpperCase();
        
        // Return in 12-hour format with AM/PM (as stored in database)
        const start12Hour = `${startHour}:${startMin} ${startPeriod}`;
        const end12Hour = `${endHour}:${endMin} ${endPeriod}`;
        
        // Also convert to 24-hour format for UI time input compatibility
        let start24Hour = startHour === 12 ? 0 : startHour;
        if (startPeriod === "PM") start24Hour += 12;
        let end24Hour = endHour === 12 ? 0 : endHour;
        if (endPeriod === "PM") end24Hour += 12;
        
        const start24 = `${String(start24Hour).padStart(2, "0")}:${startMin}`;
        const end24 = `${String(end24Hour).padStart(2, "0")}:${endMin}`;
        
        return res.status(200).json({
          success: true,
          appointmentTimeSlots: {
            useCustomTimeSlots: true,
            customStartTime: start12Hour, // Return in 12-hour format with AM/PM (e.g., "10:00 PM")
            customEndTime: end12Hour, // Return in 12-hour format with AM/PM (e.g., "11:00 PM")
            customStartTime24: start24, // Also provide 24-hour format for UI time input
            customEndTime24: end24, // Also provide 24-hour format for UI time input
          },
        });
      } else {
        // Regular timings format or empty
        return res.status(200).json({
          success: true,
          appointmentTimeSlots: {
            useCustomTimeSlots: false,
            customStartTime: "",
            customEndTime: "",
          },
        });
      }
    }

    // PUT: Update custom time slot settings in timings field
    if (req.method === "PUT") {
      const { useCustomTimeSlots, customStartTime, customEndTime } = req.body;

      // Validate input
      if (useCustomTimeSlots === undefined) {
        return res.status(400).json({
          success: false,
          message: "useCustomTimeSlots is required",
        });
      }

      // If custom time slots are enabled, validate start and end times
      if (useCustomTimeSlots) {
        if (!customStartTime || !customEndTime) {
          return res.status(400).json({
            success: false,
            message: "customStartTime and customEndTime are required when useCustomTimeSlots is true",
          });
        }

        // Validate time format (HH:MM)
        const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;
        if (!timeRegex.test(customStartTime) || !timeRegex.test(customEndTime)) {
          return res.status(400).json({
            success: false,
            message: "Invalid time format. Use HH:MM (24-hour format)",
          });
        }

        // Validate that end time is after start time
        const [startHour, startMin] = customStartTime.split(":").map(Number);
        const [endHour, endMin] = customEndTime.split(":").map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
          return res.status(400).json({
            success: false,
            message: "End time must be after start time",
          });
        }
      }

      // Get existing clinic to preserve regular timings if needed
      const existingClinic = await Clinic.findById(clinicId).select("timings");
      if (!existingClinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }

      // Helper function to convert 24-hour format to 12-hour format with AM/PM
      const convertTo12Hour = (time24) => {
        const [hour, min] = time24.split(":").map(Number);
        const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const period = hour >= 12 ? "PM" : "AM";
        return `${hour12}:${String(min).padStart(2, "0")} ${period}`;
      };

      // Update clinic timings field
      // If custom time slots are enabled, store as "H:MM AM - H:MM PM" format
      // Otherwise, keep existing timings or set to empty
      let updatedTimings = "";
      if (useCustomTimeSlots && customStartTime && customEndTime) {
        // Convert 24-hour format to 12-hour format with AM/PM
        const start12Hour = convertTo12Hour(customStartTime);
        const end12Hour = convertTo12Hour(customEndTime);
        updatedTimings = `${start12Hour} - ${end12Hour}`;
      } else {
        // Keep existing timings if available and not in custom format
        const customTimeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
        if (existingClinic.timings && !customTimeRegex.test(existingClinic.timings.trim())) {
          updatedTimings = existingClinic.timings; // Keep original format
        } else {
          updatedTimings = ""; // Clear if was custom format
        }
      }

      const clinic = await Clinic.findByIdAndUpdate(
        clinicId,
        {
          $set: {
            timings: updatedTimings,
          },
        },
        { new: true, runValidators: true }
      ).select("timings");

      if (!clinic) {
        return res.status(404).json({ success: false, message: "Clinic not found" });
      }

      // Return the parsed format (convert back to 24-hour for UI)
      const customTimeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
      const customMatch = clinic.timings?.trim().match(customTimeRegex);

        if (customMatch) {
        // Return in 12-hour format with AM/PM (as stored in database)
        const startHour = parseInt(customMatch[1]);
        const startMin = customMatch[2];
        const startPeriod = customMatch[3].toUpperCase();
        const endHour = parseInt(customMatch[4]);
        const endMin = customMatch[5];
        const endPeriod = customMatch[6].toUpperCase();
        
        const start12Hour = `${startHour}:${startMin} ${startPeriod}`;
        const end12Hour = `${endHour}:${endMin} ${endPeriod}`;
        
        // Also convert to 24-hour format for UI time input compatibility
        let start24Hour = startHour === 12 ? 0 : startHour;
        if (startPeriod === "PM") start24Hour += 12;
        let end24Hour = endHour === 12 ? 0 : endHour;
        if (endPeriod === "PM") end24Hour += 12;
        
        const start24 = `${String(start24Hour).padStart(2, "0")}:${startMin}`;
        const end24 = `${String(end24Hour).padStart(2, "0")}:${endMin}`;

        return res.status(200).json({
          success: true,
          message: "Custom time slots updated successfully",
          appointmentTimeSlots: {
            useCustomTimeSlots: true,
            customStartTime: start12Hour, // Return in 12-hour format with AM/PM (e.g., "10:00 PM")
            customEndTime: end12Hour, // Return in 12-hour format with AM/PM (e.g., "11:00 PM")
            customStartTime24: start24, // Also provide 24-hour format for UI time input
            customEndTime24: end24, // Also provide 24-hour format for UI time input
          },
        });
      } else {
        return res.status(200).json({
          success: true,
          message: "Custom time slots updated successfully",
          appointmentTimeSlots: {
            useCustomTimeSlots: false,
            customStartTime: "",
            customEndTime: "",
          },
        });
      }
    }

    return res.status(405).json({ success: false, message: "Method not allowed" });
  } catch (error) {
    console.error("Error in custom-time-slots API:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
}


import moment from "moment-timezone";

export const calculateBullMQDelay = (
  scheduledDate,
  scheduledTime,
  timezone
) => {
  try {
    // Validate inputs
    if (!scheduledDate || !scheduledTime || !timezone) {
      throw new Error("Date, time, and timezone are required");
    }

    // Combine date and time
    const dateTimeString = `${scheduledDate} ${scheduledTime}`;

    // Parse in the specified timezone
    const scheduledMoment = moment.tz(
      dateTimeString,
      "YYYY-MM-DD HH:mm",
      timezone
    );

    // Check if moment parsed correctly
    if (!scheduledMoment.isValid()) {
      throw new Error(
        `Invalid date/time format: ${dateTimeString} in timezone ${timezone}`
      );
    }

    // Get current time in UTC
    const nowUTC = moment.utc();

    // Convert scheduled time to UTC
    const scheduledUTC = scheduledMoment.clone().utc();

    // Calculate delay in milliseconds
    const delayInMs = scheduledUTC.valueOf() - nowUTC.valueOf();

    // Return delay (BullMQ will handle negative delays as immediate execution)
    return delayInMs;
  } catch (error) {
    console.error("Error calculating delay:", error);
    throw error;
  }
};

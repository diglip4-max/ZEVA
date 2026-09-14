import { notificationQueue } from "../bullmq/queue.js";
import Lead from "../models/Lead.js";
import PatientRegistration from "../models/PatientRegistration.js";
import { Setting } from "../models/settings/Setting";

export const dispatchNotifications = async ({
  clinicId,
  patientId,
  packageId,
  appointmentId,
  notificationTypeKey,
  notificationCategory,
}) => {
  console.log("dispatchNotifications", {
    clinicId,
    patientId,
    packageId,
    // Package ID for package related notifications
    appointmentId,
    notificationTypeKey,
    notificationCategory,
  });
  if (!clinicId) {
    console.log("clinicId is required for dispatch notification");
    return;
  }
  if (!notificationTypeKey) {
    console.log("notificationTypeKey is required for dispatch notification");
    return;
  }
  if (!notificationCategory) {
    console.log("notificationCategory is required for dispatch notification");
    return;
  }

  try {
    // Find Setting for the clinic
    const setting = await Setting.findOne({
      clinicId,
    }).lean();
    if (!setting) {
      console.log("Setting not found for clinic");
      return;
    }

    // Find Notification Setting for the notification type
    const notificationSetting = setting.notificationSetting?.find(
      (item) =>
        item.notificationTypeKey === notificationTypeKey &&
        item.category === notificationCategory,
    );
    if (!notificationSetting) {
      console.log(
        "Notification Setting not found for notification type and category",
      );
      return;
    }

    // Dispatch notification
    const channels = notificationSetting.channels;
    if (!channels || channels.length === 0) {
      console.log("Notification Setting does not have any channels enabled");
      return;
    }

    let patient = await PatientRegistration.findById(patientId);

    let leadId = patient?.leadId || "";
    let mobileNumber = patient?.mobileNumber || "";

    let lead = null;
    if (leadId) {
      lead = await Lead.findById(leadId);
    }
    if (!lead && mobileNumber) {
      lead = await Lead.findOne({
        clinicId,
        phone: mobileNumber,
      });
      if (!lead) {
        console.log("Patient does not have mobile number");
      }
      console.log({ mobileNumber });
      console.log("Patient", patient);
      console.log("Lead", lead);
      return;
    }

    for (let item of channels) {
      const {
        channel,
        isEnabled,
        recipient,
        priority,
        providerId,
        templateId,
        mediaType,
        mediaUrl,
        variableMappings,
        headerVariableMappings,
        buttonVariableMappings,
        attachments,
      } = item;
      if (!isEnabled) {
        console.log(
          `Channel ${channel} is not enabled on Notification: ${notificationTypeKey} and Category: ${notificationCategory}`,
        );
        continue;
      }
      if (recipient === "patient" && !lead) {
        continue;
      }
      if (recipient === "staff") {
        // TODO: Currently Staff notification is not implemented
        continue;
      }
      console.log(`Dispatching notification to channel: ${item.channel}`);

      const timingMode = notificationSetting.timing?.mode || "immediate";
      const timingOffsetMinutes =
        notificationSetting.timing?.offsetMinutes || 0;

      let job = null;
      if (timingMode === "immediate") {
        job = await notificationQueue.add(
          `dispatchNotification:${channel}`,
          {
            // Notification Job Data
            clinicId,
            notificationTypeKey,
            notificationCategory,
            label: notificationSetting.label,
            trigger: notificationSetting.trigger,
            sourceId: appointmentId,
            channel,
            recipient,
            leadId: recipient === "patient" ? lead?.id : "",
            patientId, // Patient ID for patient related notifications
            packageId: packageId || null, // Package ID for package related notifications
            priority,
            providerId,
            templateId,
            mediaType,
            mediaUrl,
            variableMappings,
            headerVariableMappings,
            buttonVariableMappings,
            attachments,
            delay,
          },
          {
            delay: 0,
            removeOnComplete: true,
          },
        );
      } else {
        let eventStartDate = null;
        let eventEndDate = null;
        let appointment = null;
        let delayInMs = 0;
        if (appointmentId) {
          appointment = await Appointment.findById(appointmentId);
        }
        if (appointment) {
          const appointmentStartDate = new Date(appointment.startDate);
          const appointmentStartTime = new Date(appointment.fromDate);
          const appointmentEndTime = new Date(appointment.toTime);
          const { startDate, endDate } = getTimeRange(
            appointmentStartDate,
            appointmentStartTime,
            appointmentEndTime,
          );
          eventStartDate = startDate;
          eventEndDate = endDate;
        }
        if (
          notificationCategory === "package" &&
          appointment &&
          eventStartDate &&
          eventEndDate
        ) {
          if (timingMode === "before_event") {
            delayInMs = getEventDelayInMs(
              eventStartDate,
              timingOffsetMinutes,
              timingMode,
            );
          } else if (timingMode === "after_event") {
            delayInMs = getEventDelayInMs(
              eventEndDate,
              timingOffsetMinutes,
              timingMode,
            );
          } else {
            delayInMs = 0;
          }
        }

        job = await notificationQueue.add(
          `dispatchNotification:${channel}`,
          {
            // Notification Job Data
            clinicId,
            notificationTypeKey,
            notificationCategory,
            label: notificationSetting.label,
            trigger: notificationSetting.trigger,
            sourceId: appointmentId,
            channel,
            recipient,
            leadId: recipient === "patient" ? lead?.id : "",
            patientId, // Patient ID for patient related notifications
            packageId: packageId || null, // Package ID for package related notifications
            priority,
            providerId,
            templateId,
            mediaType,
            mediaUrl,
            variableMappings,
            headerVariableMappings,
            buttonVariableMappings,
            attachments,
            delay,
          },
          {
            delay: delayInMs,
            removeOnComplete: true,
          },
        );
      }

      console.log(`Notification job added with ID: ${job.id}`);
    }
  } catch (err) {
    console.log("Error dispatching notification:", err);
  }
};

// Update Notification status when message sent, delivered, read, clicked
export const updateNotificationStatus = async ({
  messageId,
  status,
  error,
}) => {
  if (!messageId) {
    console.log("messageId is required for update notification status");
    return;
  }
  if (!status) {
    console.log("status is required for update notification status");
    return;
  }
  if (!error) {
    console.log("error is required for update notification status");
    return;
  }

  try {
    // Find Notification Log for the message
    const notificationLog = await NotificationLog.findOne({
      messageId,
    });
    if (!notificationLog) {
      console.log("Notification Log not found for message");
      return;
    }
    // Update Notification Log status
    if (status === "failed") {
      notificationLog.status = status;
      notificationLog.error = error;
    } else if (status === "sent") {
      notificationLog.status = status;
      notificationLog.sentAt = new Date();
    } else if (status === "delivered") {
      notificationLog.status = status;
      notificationLog.deliveredAt = new Date();
    } else if (status === "read") {
      notificationLog.status = status;
      notificationLog.readAt = new Date();
    } else if (status === "opened") {
      notificationLog.status = status;
      notificationLog.openedAt = new Date();
    } else if (status === "clicked") {
      notificationLog.status = status;
      notificationLog.clickedAt = new Date();
    }
    await notificationLog.save();
    console.log("Notification status updated successfully");
  } catch (err) {
    console.log("Error updating notification status:", err);
  }
};

const minutesToMs = (minutes) => {
  return minutes * 60 * 1000;
};

const getTimeRange = (startDate, fromTime, toTime) => {
  const parse = (t) => {
    const m = t?.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) throw new Error(`Invalid time: ${t}`);
    const h = Number(m[1]);
    const min = Number(m[2]);
    if (h > 23 || min > 59) throw new Error(`Invalid time: ${t}`);
    return { h, min };
  };

  const base = new Date(startDate);
  if (isNaN(base.getTime())) throw new Error("Invalid startDate");

  const f = parse(fromTime);
  const t = parse(toTime);

  const start = new Date(base);
  start.setHours(f.h, f.min, 0, 0);

  const end = new Date(base);
  end.setHours(t.h, t.min, 0, 0);

  if (end <= start) end.setDate(end.getDate() + 1);

  return { start, end };
};

const getEventDelayInMs = (eventDate, offsetMinutes, eventMode) => {
  const eventTime = new Date(eventDate).getTime();
  if (isNaN(eventTime)) {
    console.log("Invalid eventDate");
    return 0;
  }
  if (isNaN(offsetMinutes)) {
    console.log("Invalid offsetMinutes");
    return 0;
  }
  if (!eventMode) {
    console.log("Invalid eventMode");
    return 0;
  }

  const absMinutes = Math.abs(offsetMinutes);
  const offsetMs = absMinutes * 60 * 1000;

  // before_event → event se pehle, after_event → event ke baad
  const targetTime =
    eventMode === "before_event" ? eventTime - offsetMs : eventTime + offsetMs;

  // Ab se target tak ka delay
  return targetTime - Date.now();
};

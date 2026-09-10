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
      const job = await notificationQueue.add(
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
        },
      );

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

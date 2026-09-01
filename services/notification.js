import { notificationQueue } from "../bullmq/queue.js";
import { Setting } from "../models/settings/Setting";

export const dispatchNotification = async ({
  clinicId,
  notificationTypeKey,
  notificationCategory,
}) => {
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
    });
    if (!setting) {
      console.log("Setting not found for clinic");
      return;
    }
    // Find Notification Setting for the notification type
    const notificationSetting = setting.notificationSettings.find(
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
    for (let item of channels) {
      const {
        clinicId,
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
      console.log(`Dispatching notification to channel: ${item.channel}`);
      const job = await notificationQueue.add({
        clinicId,
        notificationTypeKey,
        notificationCategory,
        channel,
        recipient,
        // leadId,
        priority,
        providerId,
        templateId,
        mediaType,
        mediaUrl,
        variableMappings,
        headerVariableMappings,
        buttonVariableMappings,
        attachments,
      });

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

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
    }
  } catch (err) {
    console.log("Error dispatching notification:", err);
  }
};

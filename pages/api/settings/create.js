import dbConnect from "../../../lib/database";
import { notificationData } from "../../../lib/notifications";
import Clinic from "../../../models/Clinic";
import { Setting } from "../../../models/settings/Setting";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

export default async function handler(req, res) {
  if (!["POST"].includes(req.method)) {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  try {
    await dbConnect();
  } catch (error) {
    console.error("Error connecting to database:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal Server Error" });
  }

  // ---- shared: resolve clinicId based on role (used by both GET and POST) ----
  const me = await getUserFromReq(req);
  if (!me) {
    return res.status(401).json({
      success: false,
      message: "Not authenticated",
    });
  }

  if (!requireRole(me, ["clinic"])) {
    return res.status(403).json({
      success: false,
      message: "Access denied. Only clinic can update settings.",
    });
  }

  let clinicId;
  if (me.role === "clinic") {
    const clinic = await Clinic.findOne({ owner: me._id });
    if (!clinic) {
      return res.status(400).json({
        success: false,
        message: "Clinic not found for this user",
      });
    }
    clinicId = clinic._id;
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  try {
    const notificationSettingsData = notificationData.map((item) => ({
      clinicId,
      notificationTypeKey: item.notificationTypeKey,
      category: item.category,
      label: item.label,
      isEnabled: false,
      isProtected: item.isProtected,
      trigger: item.trigger,
      channels: item.channels.map((channel, index) => ({
        channel: channel.channel,
        recipient: channel.recipient,
        isEnabled: false,
        providerId: null,
        templateId: null,
        priority: channel.priority || index + 1,
      })),
      timing: item.timing,
      bypassQuietHours: item.bypassQuietHours,
      respectMarketingPreference: item.respectMarketingPreference,
      preventDuplicateForSameEvent: item.preventDuplicateForSameEvent,
    }));

    const setting = await Setting.findOne({ clinicId });

    if (!setting) {
      // Create new setting
      const newSetting = await Setting.create({
        clinicId,
        notificationSetting: notificationSettingsData,
      });
      return res.status(200).json({
        success: true,
        message: "Settings created successfully",
        data: newSetting,
      });
    } else {
      // Update existing setting
      const updatedNotificationSettingData = notificationSettingsData.map(
        (item) => ({
          ...item,
        }),
      );
      const updatedSetting = await setting.updateOne({
        notificationSetting: updatedNotificationSettingData,
      });
      return res.status(200).json({
        success: true,
        message: "Settings updated successfully",
        data: updatedSetting,
      });
    }
  } catch (error) {
    console.error("Error updating settings:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
    });
  }
}

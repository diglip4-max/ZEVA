import {
  notificationQueue,
  scheduleWhatsappCampaignQueue,
} from "../bullmq/queue.js";
import Lead from "../models/Lead.js";
import Package from "../models/Package.js";
import PatientRegistration from "../models/PatientRegistration.js";
import Appointment from "../models/Appointment.js";
import { Setting } from "../models/settings/Setting";
import Segment from "../models/Segment.js";
import Offer from "../models/CreateOffer.js";
import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_TYPES,
} from "../lib/notifications/index.js";
import Campaign from "../models/Campaign.js";
import Template from "../models/Template.js";
import Provider from "../models/Provider.js";

export const dispatchNotifications = async ({
  clinicId,
  patientId,
  packageId,
  offerId,
  appointmentId,
  billingId,
  notificationTypeKey,
  notificationCategory,
}) => {
  console.log("dispatchNotifications", {
    clinicId,
    patientId,
    packageId,
    offerId,
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
    console.log({ channels });
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
      if (!lead && mobileNumber && patient) {
        console.log("Patient does not have mobile number");
        let withoutPlusNumber = mobileNumber.replace("+", "");
        lead = await Lead.create({
          clinicId,
          patientId: patient._id,
          name:
            `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
            withoutPlusNumber,
          phone: withoutPlusNumber,
          email: patient.email || "",
          gender: patient.gender,
          source: "Other",
          customSource: "Campaign Auto-Segment",
          segments: [],
        });
        patient.leadId = lead._id;
        await patient.save();
        await lead.save();
      }
      console.log({ mobileNumber });
      console.log("Patient", patient);
      console.log("Lead", lead);
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

      if (recipient === "staff") {
        // TODO: Currently Staff notification is not implemented
        continue;
      }
      console.log(`Dispatching notification to channel: ${item.channel}`);

      const timingMode = notificationSetting.timing?.mode || "immediate";
      const timingOffsetMinutes =
        notificationSetting.timing?.offsetMinutes || 0;

      console.log({
        timingMode,
        timingOffsetMinutes,
      });

      let job = null;
      if (timingMode === "immediate" && recipient === "patient" && lead) {
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
            leadId: recipient === "patient" ? lead?._id : "",
            patientId, // Patient ID for patient related notifications
            packageId: packageId || null, // Package ID for package related notifications
            offerId: offerId || null, // Offer ID for offer related notifications
            billingId: billingId || null, // Billing ID for billing related notifications
            appointmentId: appointmentId || null, // Appointment ID for appointment related notifications
            priority,
            providerId,
            templateId,
            mediaType,
            mediaUrl,
            variableMappings,
            headerVariableMappings,
            buttonVariableMappings,
            attachments,
            delay: 0,
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
          (notificationCategory === "package" ||
            (notificationCategory === "appointment" &&
              notificationTypeKey === "appointment.reminder")) &&
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
          if (delayInMs < 0) {
            return;
          }
        }

        // in case of package activated notification, set delay to package start date + offset minutes
        if (notificationCategory === "package" && packageId) {
          // Nor event start and end date will be based on package start and end date
          const packageData = await Package.findById(packageId);
          if (packageData) {
            eventStartDate = new Date(packageData.startDate);
            eventEndDate = new Date(packageData.endDate);

            if (notificationTypeKey === "package.activated") {
              delayInMs = getEventDelayInMs(
                eventStartDate,
                timingOffsetMinutes,
                timingMode,
              );
            } else if (notificationTypeKey === "package.expiring_30days") {
              const minutesBeforeExpiry = 30 * 24 * 60; // 30 days in minutes = 43200 minutes
              delayInMs = getEventDelayInMs(
                eventEndDate,
                minutesBeforeExpiry,
                timingMode,
              );
            } else if (notificationTypeKey === "package.expiring_7days") {
              const minutesBeforeExpiry = 7 * 24 * 60; // 7 days in minutes = 10080 minutes
              delayInMs = getEventDelayInMs(
                eventEndDate,
                minutesBeforeExpiry,
                timingMode,
              );
            } else if (notificationTypeKey === "package.expiring_1day") {
              const minutesBeforeExpiry = 1 * 24 * 60; // 1 day in minutes = 1440 minutes
              delayInMs = getEventDelayInMs(
                eventEndDate,
                minutesBeforeExpiry,
                timingMode,
              );
            } else if (notificationTypeKey === "package.expired") {
              delayInMs = getEventDelayInMs(
                eventEndDate,
                timingOffsetMinutes,
                timingMode,
              );
            }
          }
        }

        // In Case of offer notification
        if (
          notificationCategory === NOTIFICATION_CATEGORIES.OFFER &&
          (notificationTypeKey === NOTIFICATION_TYPES.NEW_OFFER ||
            notificationTypeKey === NOTIFICATION_TYPES.OFFER_EXPIRING) &&
          offerId
        ) {
          const offer = await Offer.findById(offerId);
          if (notificationTypeKey === NOTIFICATION_TYPES.NEW_OFFER) {
            delayInMs = 0;
          }
          if (notificationTypeKey === NOTIFICATION_TYPES.OFFER_EXPIRING) {
            const offerEndDate = new Date(offer.endsAt);
            if (offerEndDate < new Date()) {
              continue;
            }
            delayInMs = getEventDelayInMs(
              offerEndDate,
              timingOffsetMinutes,
              timingMode,
            );
          }
          let recipientType = "patient";
          dispatchCampaignNotification({
            clinicId,
            offerId,
            billingId,
            appointmentId,
            packageId,
            channel,
            notificationTypeKey,
            notificationCategory,
            delayInMs,
            recipientType,
            providerId,
            templateId,
            mediaType,
            mediaUrl,
            variableMappings,
            headerVariableMappings,
            buttonVariableMappings,
            attachments,
          });
          return;
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

export const dispatchCampaignNotification = async ({
  clinicId,
  offerId,
  channel,
  notificationTypeKey,
  notificationCategory,
  delayInMs,
  recipientType,
  providerId,
  templateId,
  mediaType,
  mediaUrl,
  variableMappings,
  headerVariableMappings,
  buttonVariableMappings,
  attachments = [],
  headerParameters = [],
  bodyParameters = [],
}) => {
  console.log("dispatchCampaignNotification: ", {
    clinicId,
    offerId,
    channel,
    notificationTypeKey,
    notificationCategory,
    delayInMs,
    recipientType,
    providerId,
    templateId,
    mediaType,
    mediaUrl,
    variableMappings,
    headerVariableMappings,
    buttonVariableMappings,
  });
  // ---- Validation ----
  if (!clinicId) {
    console.log("clinicId is required for dispatch campaign notification");
    return;
  }
  if (!offerId) {
    console.log("offerId is required for dispatch campaign notification");
    return;
  }
  if (!channel) {
    console.log("channel is required for dispatch campaign notification");
    return;
  }
  if (!notificationTypeKey) {
    console.log(
      "notificationTypeKey is required for dispatch campaign notification",
    );
    return;
  }
  if (!notificationCategory) {
    console.log(
      "notificationCategory is required for dispatch campaign notification",
    );
    return;
  }
  if (!recipientType) {
    console.log("recipientType is required for dispatch campaign notification");
    return;
  }
  if (!providerId) {
    console.log("providerId is required for dispatch campaign notification");
    return;
  }
  if (!templateId) {
    console.log("templateId is required for dispatch campaign notification");
    return;
  }

  try {
    // ---- Step 1: Define the 90-day window ----
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    // ---- Step 2: Find all appointments from the last 90 days for this clinic ----
    const appointments = await Appointment.find({
      clinicId,
      createdAt: { $gte: ninetyDaysAgo, $lte: now },
    })
      .select("patientId")
      .lean();

    if (!appointments || appointments.length === 0) {
      console.log("No appointments found in the last 90 days for this clinic");
      return;
    }

    // ---- Step 3: Extract unique patient IDs ----
    const uniquePatientIds = [
      ...new Set(
        appointments.map((a) => a.patientId?.toString()).filter(Boolean),
      ),
    ];

    if (uniquePatientIds.length === 0) {
      console.log("No unique patients found from appointments");
      return;
    }

    console.log(
      `Found ${uniquePatientIds.length} unique patients in last 90 days`,
    );

    // ---- Step 4: Fetch patient details (to map into leads) ----
    const patients = await PatientRegistration.find({
      _id: { $in: uniquePatientIds },
      clinicId,
    }).lean();

    if (!patients || patients.length === 0) {
      console.log("No recipient patients found for campaign notification");
      return;
    }

    // ---- Step 5: Create or find a Segment for this campaign ----

    const offer = await Offer.findById(offerId);

    let segment = await Segment.create({
      clinicId,
      name: offer?.title || `Campaign Segment - ${offerId}`,
      description:
        offer?.description || `Auto-generated segment for campaign ${offerId}`,
    });

    const leadIds = [];
    for (const patient of patients) {
      if (patient.leadId) {
        leadIds.push(patient.leadId);
      } else {
        // Find lead by mobile number
        const phone = patient.mobileNumber || "";
        if (!phone) {
          continue;
        }
        const withPlusNumber = phone.startsWith("+") ? phone : `+${phone}`;
        const withoutPlusNumber = withPlusNumber.replace("+", "");
        let lead = await Lead.findOne({
          clinicId,
          phone: withoutPlusNumber,
        });
        if (withPlusNumber && !lead) {
          lead = await Lead.findOne({
            clinicId,
            phone: withPlusNumber,
          });
        }
        if (!lead) {
          // Create a new lead with that patient detail
          lead = await Lead.create({
            clinicId,
            patientId: patient._id,
            name:
              `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
              withoutPlusNumber,
            phone: withoutPlusNumber,
            email: patient.email || "",
            gender: patient.gender,
            source: "Other",
            customSource: "Campaign Auto-Segment",
            segments: [segment._id],
          });
          await lead.save();
        }
        leadIds.push(lead._id);
        segment.leads.push(lead._id);
      }
    }
    // remove duplicate leads from segment
    segment.leads = [...new Set(segment.leads.map((id) => id.toString()))];
    await segment.save();

    const template = await Template.findById(templateId);
    if (!template) {
      console.log("Template not found");
      return;
    }
    const provider = await Provider.findById(providerId);
    if (!provider) {
      console.log("Provider not found");
      return;
    }
    if (segment.leads.length === 0) {
      console.log("No leads found for campaign notification");
      return;
    }

    // Step:6 Create a campaign and schedule based on delayms
    const campaign = await Campaign.create({
      clinicId,
      userId: provider?.userId || provider?.owners?.[0] || null,
      offerId,
      name:
        notificationTypeKey === NOTIFICATION_TYPES.NEW_OFFER
          ? `New Offer - ${offer?.title || offerId}`
          : notificationTypeKey === NOTIFICATION_TYPES.OFFER_EXPIRING
            ? `Offer Expiring - ${offer?.title || offerId}`
            : `Campaign Expire - ${offerId}`,
      description:
        offer?.description ||
        `Auto-generated campaign for campaign ${offer?.title || offerId}`,
      offerId: offerId,
      purpose:
        notificationTypeKey === NOTIFICATION_TYPES.NEW_OFFER
          ? "create_offer"
          : notificationTypeKey === NOTIFICATION_TYPES.OFFER_EXPIRING
            ? "expire_offer"
            : "other",
      sender: providerId,
      segmentId: segment._id,
      recipients: segment?.leads || [],
      recipientType: "segment",
      template: templateId,
      type: channel,
      mediaType: mediaType,
      mediaUrl: mediaUrl,
      attachments: attachments || [],
      variableMappings: variableMappings,
      headerVariableMappings: headerVariableMappings,
      buttonVariableMappings: buttonVariableMappings,
      bodyParameters: bodyParameters,
      headerParameters: headerParameters,
      status: "draft",
    });
    await campaign.save();

    if (delayInMs > 0) {
      const scheduleDate = new Date(Date.now() + delayInMs);

      // Get YYYY-MM-DD in IST
      const datePart = scheduleDate.toLocaleDateString("en-CA", {
        timeZone: "Asia/Kolkata",
      }); // "2026-09-30" (en-CA gives YYYY-MM-DD)

      // Get HH:MM in IST
      const timePart = scheduleDate.toLocaleTimeString("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }); // "13:33"

      campaign.scheduleType = "later";
      campaign.scheduleTime = {
        date: datePart, // "2026-09-30"
        time: timePart, // "13:33"
      };
      await campaign.save();
    }

    // ---- Step 7: Dispatch notifications (implement your provider logic here) ----
    let queueJob;
    const customJobId = `${campaign._id}-${Date.now()}`;
    if (campaign.type === "whatsapp") {
      queueJob = await scheduleWhatsappCampaignQueue.add(
        "scheduleWhatsappQueue",
        {
          campaignId: campaign._id,
        },
        {
          delay:
            campaign.scheduleType === "later"
              ? delayInMs > 0
                ? delayInMs
                : 0
              : 0,
          attempts: 3,
          backoff: 5000,
          removeOnComplete: true,
          jobId: customJobId,
        },
      );
    }

    return {
      success: true,
      totalRecipients: patients.length,
      segmentId: segment._id,
      jobId: customJobId,
      campaignId: campaign._id,
    };
  } catch (error) {
    console.log("Error dispatching campaign notification:", error);
    return;
  }
};

// ========================================
// For Patient Engagement
// ========================================

export const dispatchPatientEngagementNotification = async (
  notificationData,
) => {
  const { clinicId, notificationTypeKey, notificationCategory } =
    notificationData;

  try {
    const setting = await Setting.findOne({ clinicId });

    if (!setting) {
      console.log("Setting not found");
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
    console.log({ channels });
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

      if (recipient === "staff") {
        // TODO: Currently Staff notification is not implemented
        continue;
      }

      console.log(`Dispatching notification to channel: ${channel}`);

      const timingMode = notificationSetting.timing?.mode || "immediate";
      const timingOffsetMinutes =
        notificationSetting.timing?.offsetMinutes || 0;

      console.log({
        timingMode,
        timingOffsetMinutes,
      });

      // ---- Step 1: Define the 90-day window ----
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
      let patients = [];
      if (
        notificationTypeKey === NOTIFICATION_TYPES.BIRTHDAY_GREETING ||
        notificationTypeKey === NOTIFICATION_TYPES.BIRTHDAY_OFFER
      ) {
        const today = new Date();
        const month = today.getMonth() + 1; // JS me 0-11 hota hai, isliye +1
        const day = today.getDate();

        patients = await PatientRegistration.aggregate([
          {
            $match: {
              clinicId: clinicId, // agar ObjectId hai to mongoose.Types.ObjectId(clinicId) karo
              dateOfBirth: { $ne: null },
            },
          },
          {
            $addFields: {
              birthMonth: { $month: "$dateOfBirth" },
              birthDay: { $dayOfMonth: "$dateOfBirth" },
            },
          },
          {
            $match: {
              birthMonth: month,
              birthDay: day,
            },
          },
          {
            $project: {
              birthMonth: 0,
              birthDay: 0,
            },
          },
        ]);
      } else {
        // ---- Step 2: Find all appointments from the last 90 days for this clinic ----
        const appointments = await Appointment.find({
          clinicId,
          createdAt: { $gte: ninetyDaysAgo, $lte: now },
        })
          .select("patientId")
          .lean();

        if (!appointments || appointments.length === 0) {
          console.log(
            "No appointments found in the last 90 days for this clinic",
          );
          return;
        }
        // ---- Step 3: Extract unique patient IDs ----
        const uniquePatientIds = [
          ...new Set(
            appointments.map((a) => a.patientId?.toString()).filter(Boolean),
          ),
        ];

        if (uniquePatientIds.length === 0) {
          console.log("No unique patients found from appointments");
          return;
        }

        console.log(
          `Found ${uniquePatientIds.length} unique patients in last 90 days`,
        );

        // ---- Step 4: Fetch patient details (to map into leads) ----
        patients = await PatientRegistration.find({
          _id: { $in: uniquePatientIds },
          clinicId,
        }).lean();
      }

      if (!patients || patients.length === 0) {
        console.log("No recipient patients found for campaign notification");
        return;
      }

      let segment = await Segment.create({
        clinicId,
        name:
          notificationTypeKey === NOTIFICATION_TYPES.BIRTHDAY_GREETING
            ? `Birthday Greeting ${new Date().toLocaleDateString()}`
            : notificationTypeKey === NOTIFICATION_TYPES.BIRTHDAY_OFFER
              ? `Birthday Offer ${new Date().toLocaleDateString()}`
              : `Campaign Segment - ${notificationTypeKey}`,
        description:
          notificationSetting.label ||
          `Auto-generated segment for campaign ${notificationTypeKey}`,
      });

      // Find leads from patients
      const leadIds = [];
      for (const patient of patients) {
        if (patient.leadId) {
          leadIds.push(patient.leadId);
        } else {
          // Find lead by mobile number
          const phone = patient.mobileNumber || "";
          if (!phone) {
            continue;
          }
          const withPlusNumber = phone.startsWith("+") ? phone : `+${phone}`;
          const withoutPlusNumber = withPlusNumber.replace("+", "");
          let lead = await Lead.findOne({
            clinicId,
            phone: withoutPlusNumber,
          });
          if (withPlusNumber && !lead) {
            lead = await Lead.findOne({
              clinicId,
              phone: withPlusNumber,
            });
          }
          if (!lead) {
            // Create a new lead with that patient detail
            lead = await Lead.create({
              clinicId,
              patientId: patient._id,
              name:
                `${patient.firstName || ""} ${patient.lastName || ""}`.trim() ||
                withoutPlusNumber,
              phone: withoutPlusNumber,
              email: patient.email || "",
              gender: patient.gender,
              source: "Other",
              customSource: "Campaign Auto-Segment",
              segments: [segment._id],
            });
            await lead.save();
          }
          leadIds.push(lead._id);
          segment.leads.push(lead._id);
        }
      }
      // remove duplicate leads from segment
      segment.leads = [...new Set(segment.leads.map((id) => id.toString()))];
      await segment.save();

      const template = await Template.findById(templateId);
      if (!template) {
        console.log("Template not found");
        return;
      }
      const provider = await Provider.findById(providerId);
      if (!provider) {
        console.log("Provider not found");
        return;
      }

      // Check if segment has any leads
      if (segment.leads.length === 0) {
        console.log("No leads found for campaign notification");
        return;
      }

      // Step:6 Create a campaign and schedule based on delayms
      const campaign = await Campaign.create({
        clinicId,
        userId: provider?.userId || provider?.owners?.[0] || null,
        name:
          notificationTypeKey === NOTIFICATION_TYPES.BIRTHDAY_GREETING
            ? `Birthday Greeting - ${new Date().toLocaleDateString()}`
            : notificationTypeKey === NOTIFICATION_TYPES.BIRTHDAY_OFFER
              ? `Birthday Offer - ${new Date().toLocaleDateString()}`
              : `Campaign - ${notificationTypeKey}`,
        description:
          notificationSetting.label ||
          `Auto-generated campaign for campaign ${notificationTypeKey}`,
        sender: providerId,
        segmentId: segment._id,
        recipients: segment?.leads || [],
        recipientType: "segment",
        template: templateId,
        type: channel,
        mediaType: mediaType,
        mediaUrl: mediaUrl,
        attachments: attachments || [],
        variableMappings: variableMappings,
        headerVariableMappings: headerVariableMappings,
        buttonVariableMappings: buttonVariableMappings,
        bodyParameters: bodyParameters,
        headerParameters: headerParameters,
        status: "draft",
      });
      await campaign.save();

      // ---- Step 7: Dispatch notifications (implement your provider logic here) ----
      let queueJob;
      const customJobId = `${campaign._id}-${Date.now()}`;
      if (campaign.type === "whatsapp") {
        queueJob = await scheduleWhatsappCampaignQueue.add(
          "scheduleWhatsappQueue",
          {
            campaignId: campaign._id,
          },
          {
            delay: 0,
            attempts: 3,
            backoff: 5000,
            removeOnComplete: true,
            jobId: customJobId,
          },
        );
      }
    }
  } catch (error) {
    console.log("Error dispatching patient engagement notification:", error);
    return;
  }
};

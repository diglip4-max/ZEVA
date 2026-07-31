import { getUserFromReq, requireRole } from "../lead-ms/auth";
import Clinic from "../../../models/Clinic";
import Conversation from "../../../models/Conversation";
import dbConnect from "../../../lib/database";
import Provider from "../../../models/Provider";
import Lead from "../../../models/Lead";
import Message from "../../../models/Message";
import PatientRegistration from "../../../models/PatientRegistration";
import {
  getLeadDetails,
  getSystemDetails,
  replaceVariableInString,
} from "../../../bullmq/workflow";
import { validateEmail } from "../../../services/validate";
import {
  replaceUrlsWithTrackingUrlsInContent,
  sendEmailViaSmtpMultiple,
} from "../../../services/smtp";
import { sendEmailViaGmailMultiple } from "../../../services/gmail";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor", "doctorStaff"])) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // Get clinicId based on user role
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
  } else if (me.role === "agent") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Agent not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "doctor" || me.role === "doctorStaff") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor/Staff not tied to a clinic" });
    }
    clinicId = me.clinicId;
  } else if (me.role === "admin") {
    clinicId = req.body.clinicId;
    if (!clinicId) {
      return res.status(400).json({
        success: false,
        message: "clinicId is required for admin",
      });
    }
  } else {
    return res.status(403).json({
      success: false,
      message: "Access denied",
    });
  }

  let {
    conversationId,
    recipientIds = [],
    channel = "email",
    subject,
    preheader,
    content,
    mediaUrl,
    mediaType,
    source,
    providerId,
    attachments,
    replyToMessageId, // it is MongodbMsg _id on that reply
    quotedMessageId, // it is reply msg id of provider
    threadId, // for keep email in same group if you reply
    signature,
    cc,
    bcc,
    ...rest
  } = req.body;

  try {
    // If Only given toEmail, then find lead with that email if not then create lead and find conversation and then used
    if (recipientIds?.length === 0 && rest.to && !conversationId) {
      const findLead = await Lead.findOne({
        clinicId: clinicId,
        email: rest.to,
      }).select("_id email");

      if (findLead) {
        recipientIds.push(findLead._id);
      } else {
        const lead = new Lead({
          clinicId,
          name: rest.to,
          email: rest.to,
          source: "Other",
        });
        await lead.save();
        recipientIds.push(lead._id);
      }

      // Find conversation with that lead
      let conversation = await Conversation.findOne({
        clinicId,
        leadId: recipientIds[0],
      }).select("_id");

      if (!conversation) {
        conversation = new Conversation({
          leadId: recipientIds[0],
          clinicId,
          ownerId: me._id,
        });
        await conversation.save();
      }

      conversationId = conversation._id;
    }

    if (!providerId) {
      return res.status(400).json({
        success: false,
        message: "Provider is required",
      });
    }
    let lastMessageId = "";
    if (!Array.isArray(recipientIds) || recipientIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one recipientId is required",
      });
    }

    let recipientId = recipientIds[0];
    let conversation = conversationId
      ? await Conversation.findById(conversationId).select("_id leadId")
      : null;

    // If i want to send message to patient
    if (req.body.patientId) {
      const patient = await PatientRegistration.findById(req.body.patientId);
      if (patient && patient.leadId) {
        recipientId = patient.leadId;
        conversation = await Conversation.findOne({
          leadId: patient.leadId,
          clinicId,
        }).select("_id leadId");
        if (!conversation) {
          conversation = await new Conversation({
            leadId: patient.leadId,
            clinicId,
            ownerId: me._id,
          }).save();
        }
      } else if (patient) {
        const newLead = new Lead({
          clinicId,
          name: `${patient.firstName} ${patient.lastName}`,
          phone: patient.mobileNumber,
          email: patient.email,
          gender: patient.gender,
          source: "Other",
          patientId: patient._id,
        });
        await newLead.save();
        recipientId = newLead._id;
        patient.leadId = newLead._id;
        await patient.save();
        conversation = await Conversation.findOne({
          leadId: newLead._id,
          clinicId,
        }).select("_id leadId");
        if (!conversation) {
          conversation = await new Conversation({
            leadId: newLead._id,
            clinicId,
            ownerId: me._id,
          }).save();
        }
      }
    }

    if (req.body.leadId) {
      conversation = await Conversation.findOne({
        leadId: req.body.leadId,
        clinicId,
      }).select("_id leadId");
      conversationId = conversation?._id;
    }

    if (!conversation && conversationId) {
      conversation =
        await Conversation.findById(conversationId).select("_id leadId");
    }

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const recipientLeads = await Lead.find({
      _id: { $in: recipientIds },
    })
      .select("email")
      .lean();
    if (recipientLeads.length !== recipientIds.length) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    const toEmails = [
      ...new Set(recipientLeads.map((lead) => lead.email).filter(Boolean)),
    ];

    const [clinic, provider, lead] = await Promise.all([
      Clinic.findById(clinicId).lean(),
      Provider.findById(providerId).lean(),
      Lead.findById(recipientId).lean(),
    ]);

    if (!clinic) {
      return res.status(400).json({
        success: false,
        message: "Clinic not found",
      });
    }
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: "Provider not found",
      });
    }
    if (!lead) {
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }
    const leadId = conversation.leadId;

    const [leadPayload, systemPayload] = await Promise.all([
      getLeadDetails(lead._id),
      getSystemDetails(),
    ]);

    const senderId = me._id;
    const messageType = "conversational";
    const direction = "outgoing";

    if (signature) {
      content = `${content}<br>${signature}`;
      content = content
        ?.replace(/<p><br><\/p>/g, "<br>")
        .replace(/<p>/g, "")
        .replace(/<\/p>/g, "<br>");
    }
    subject = replaceVariableInString(subject, "lead", leadPayload);
    content = replaceVariableInString(content, "lead", leadPayload);
    subject = replaceVariableInString(subject, "system", systemPayload);
    content = replaceVariableInString(content, "system", systemPayload);

    const toEmail = lead.email;
    const isValidToEmail = validateEmail(toEmail);

    const newMessage = new Message({
      clinicId,
      conversationId: conversation._id,
      leadId,
      senderId,
      recipientId,
      channel,
      messageType: "conversational",
      direction: "outgoing",
      subject,
      preheader,
      content,
      source,
      status: "sending",
      provider: providerId,
      attachments,
      mediaType: attachments?.length > 0 ? attachments[0]?.mediaType : "",
      mediaUrl: attachments?.length > 0 ? attachments[0]?.mediaUrl : "",
      replyToMessageId,
      ...(cc && { cc }),
      ...(bcc && { bcc }),
    });

    conversation.recentMessage = newMessage._id;

    const openTrackUrl = `https://zeva360.com/api/email/track/open?emailId=${newMessage._id}`;
    const unsubscribeLink = `https://zeva360.com/unsubscribe/${lead._id}/${encodeURIComponent(
      provider.email,
    )}/${encodeURIComponent(toEmail)}?emailId=${newMessage._id}`;

    const sanitizedContent = replaceUrlsWithTrackingUrlsInContent(
      content,
      newMessage?._id,
    );

    const htmlContent = `<div>${
      preheader
        ? `<div style="display:none;visibility:hidden;">${preheader}</div>`
        : ""
    }${sanitizedContent}<img src="${openTrackUrl}" width="1" height="1" style="display:none;" alt="tracking pixel"/></div>`;

    // Handle email sending logic
    let emailSent = false;
    let providerMessageId = undefined;
    let providerThreadId = undefined;
    let senderName = `${me.name}`;
    if (provider.label && !validateEmail(provider.label)) {
      senderName = provider.label;
    }

    const replyToMsg = replyToMessageId
      ? await Message.findById(replyToMessageId)
          .select("threadId providerMessageId")
          .lean()
      : null;

    try {
      if (provider.emailProviderType === "gmail" && isValidToEmail) {
        const emailResponse = await sendEmailViaGmailMultiple({
          providerId: provider._id,
          to: toEmails,
          from: provider.email,
          senderName,
          subject,
          content: htmlContent,
          attachments,
          originalMessageId: quotedMessageId || replyToMsg?.providerMessageId,
          threadId: replyToMsg?.threadId || "",
        });

        if (emailResponse?.id && emailResponse?.threadId) {
          emailSent = true;
          providerMessageId = emailResponse.id;
          providerThreadId = emailResponse.threadId;
        }
      } else if (provider.emailProviderType === "other" && isValidToEmail) {
        const emailResponse = await sendEmailViaSmtpMultiple({
          providerId: provider._id,
          to: toEmails,
          from: provider.email,
          senderName,
          subject,
          content: htmlContent,
          attachments,
          originalMessageId: quotedMessageId || replyToMsg?.providerMessageId,
          cc,
          bcc,
        });

        if (emailResponse?.messageId) {
          emailSent = true;
          providerMessageId = emailResponse.messageId;
        }
      }
    } catch (emailError) {
      console.error(`Error sending email to ${toEmail}:`, emailError.message);
    }

    newMessage.status = emailSent ? "sent" : "failed";
    if (providerMessageId) newMessage.providerMessageId = providerMessageId;
    if (providerThreadId) newMessage.threadId = providerThreadId;

    await Promise.all([newMessage.save(), conversation.save()]);

    const findMessage = await Message.findById(newMessage._id)
      .populate("senderId", "name email phone")
      .populate("recipientId", "name email phone")
      .populate("provider", "name label email phone")
      .populate({
        path: "replyToMessageId",
        select: "content mediaType mediaUrl channel direction", // Fields of the reply message
        populate: [
          {
            path: "senderId",
            select: "name email phone", // Specific fields of sender in the reply
          },
          {
            path: "recipientId",
            select: "name email phone", // Specific fields of recipient in the reply
          },
        ],
      })
      .lean();

    res.status(200).json({
      success: true,
      message: "Message sent successfully",
      data: findMessage,
    });
  } catch (err) {
    // console.error("Error in send message:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}

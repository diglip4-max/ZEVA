import {
  executeWorkflows,
  WORKFLOW_ENTITY_TYPE,
  WORKFLOW_TRIGGER_TYPE,
} from "../../../bullmq/workflow";
import dbConnect from "../../../lib/database";
import Conversation from "../../../models/Conversation";
import Lead from "../../../models/Lead";
import Message from "../../../models/Message";
import Provider from "../../../models/Provider";
import {
  extractEmailReplyBody,
  extractEmailsFromCC,
  getGmailClientForUser,
  getIncomingGmailBody,
  getMediaTypeFromMime,
} from "../../../services/gmail";
import { uploadMedia } from "../../../services/upload";

// Helper to format file size to human readable format
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export default async function handler(req, res) {
  if (req.method === "POST") {
    res.status(200).json({ message: "Notification received" });
    processNotification(req);
    return;
  }

  return res.status(200).json({ message: "Notification received" });
}

const processNotification = async (req) => {
  // ensure mongoose connection is established before using models
  try {
    await dbConnect();
  } catch (err) {
    console.error("Failed to connect to DB in WhatsApp webhook:", err);
    return;
  }

  console.log("Processing email notification...", req.body);
  try {
    const messageData = JSON.parse(
      Buffer.from(req.body.message.data, "base64").toString("utf-8"),
    );

    const { emailAddress, historyId } = messageData;
    console.log({ emailAddress, historyId });

    const provider = await Provider.findOne({
      email: emailAddress,
      emailProviderType: "gmail",
    });
    console.log({ provider });

    if (!provider) {
      return;
    }

    const userId = provider?.userId?.toString();

    const gmail = await getGmailClientForUser(provider._id);

    let messageIds = [];

    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: 10,
      q: "newer_than:1d",
    });

    messageIds =
      listRes?.data?.messages?.map((item) => item.id).reverse() || [];

    // check for every messageIds
    for (let messageId of messageIds) {
      const messageRes = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const payload = messageRes.data.payload;
      const headers = payload.headers;

      // Extract headers
      const getHeader = (name) =>
        headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;

      const subject = getHeader("Subject") || "(No subject)";
      const from = getHeader("From") || "";
      const to = getHeader("To") || "";
      const ccRaw = getHeader("Cc") || "";
      const cc = extractEmailsFromCC(ccRaw);
      const inReplyTo = getHeader("In-Reply-To") || null;
      const references = getHeader("References") || null;
      const threadId = messageRes.data.threadId;
      const internalDate = parseInt(messageRes.data.internalDate); // timestamp

      const receivedAt = new Date(internalDate);
      console.log({ receivedAt, subject });

      // Parse fromName and fromEmail
      let fromName = "";
      let fromEmail = "";
      const emailRegex = /(.*)?<(.+)>/;
      const match = from.match(emailRegex);
      if (match) {
        fromName = match[1].trim();
        fromEmail = match[2].trim();
      } else {
        fromEmail = from.trim();
      }

      // Extract plain text body
      const parts = payload.parts || [];
      // const plainPart = parts.find(
      //   (p) => p.mimeType === "text/plain" || p.mimeType === "text/html"
      // );
      // const bodyData = plainPart?.body?.data;

      // let body = bodyData
      //   ? Buffer.from(bodyData, "base64").toString("utf-8")
      //   : "";

      let body = getIncomingGmailBody(payload);

      // Ensure body is always a string
      if (typeof body !== "string") {
        body = "";
      }

      // Determine if it's a reply
      const isReply = !!(inReplyTo || references);
      body = isReply ? extractEmailReplyBody(body) : body; // it means extract actuall message of replied

      const clinicId = provider?.clinicId;

      let replyToMessageId = null;
      let findMessage = await Message.findOne({
        clinicId: provider?.clinicId,
        providerMessageId: messageId,
      });
      if (findMessage) {
        continue;
      }
      if (isReply) {
        findMessage = await Message.findOne({
          clinicId: provider?.clinicId,
          threadId,
        });

        replyToMessageId = findMessage?._id ?? null;
      }

      let lead = await Lead.findOne({
        email: fromEmail,
        clinicId: provider?.clinicId,
      });
      //   if (!provider?.inboxAutomation && !lead) {
      //     console.log("Inbox automation disabled");
      //     continue;
      //   }
      if (!lead) {
        lead = new Lead({
          clinicId: provider?.clinicId,
          name: fromName,
          email: fromEmail,
          source: "Other",
          customSource: "Gmail",
        });
        await lead.save();
      }
      let conversation = await Conversation.findOne({
        clinicId: provider?.clinicId,
        leadId: lead?._id,
      });

      if (!conversation) {
        conversation = new Conversation({
          clinicId: provider?.clinicId,
          leadId: lead?._id,
        });

        await conversation.save();
      }

      // first of all find all attachments - start
      let attachments = [];
      if (parts && parts.length > 0) {
        for (const part of parts) {
          if (part.filename && part.body?.attachmentId) {
            try {
              const attachmentRes = await gmail.users.messages.attachments.get({
                userId: "me",
                messageId,
                id: part.body.attachmentId,
              });

              const dataBuffer = Buffer.from(attachmentRes.data.data, "base64");
              const fileSizeInBytes = dataBuffer.length; // Get the file size in bytes
              const formattedFileSize = formatFileSize(fileSizeInBytes); // Convert to human-readable format

              // Extract extension from filename
              const ext = part.filename.includes(".")
                ? part.filename.split(".").pop()
                : null;

              const url = await uploadMedia(dataBuffer, ext, part.filename);

              attachments.push({
                fileName: part.filename,
                fileSize: formattedFileSize,
                mimeType: part.mimeType,
                mediaUrl: url,
                mediaType: getMediaTypeFromMime(part.mimeType),
              });
            } catch (attachmentErr) {
              console.error("Error processing attachment:", attachmentErr);
              // Continue processing even if one attachment fails
            }
          }
        }
      }

      // first of all find all attachments - end

      const newMessage = new Message({
        clinicId: provider?.clinicId,
        conversationId: conversation?._id,
        leadId: lead?._id,
        provider: provider?._id,
        channel: "email",
        messageType: "conversational",
        senderId: userId,
        recipientId: lead?._id,
        direction: "incoming",
        subject,
        cc,
        content: body || "",
        status: "received",
        providerMessageId: messageId,
        replyToMessageId, // for email reply
        mediaType: attachments?.length > 0 ? attachments[0]?.mediaType : "",
        mediaUrl: attachments?.length > 0 ? attachments[0]?.mediaUrl : "",
        threadId,
        attachments,
        emailReceivedAt: receivedAt,
        source: "Zeva",
      });

      conversation.recentMessage = newMessage?._id;
      conversation.unreadMessages.push(newMessage?._id);

      await Promise.all([newMessage.save(), conversation.save()]);

      // Note: Execute workflow for the incoming message
      executeWorkflows({
        entity: WORKFLOW_ENTITY_TYPE.MESSAGE,
        trigger: WORKFLOW_TRIGGER_TYPE.INCOMING_MESSAGE,
        leadId: lead._id?.toString(),
        clinicId: provider?.clinicId?.toString(),
        channel: "email",
        providerId: provider._id?.toString(),
        messageId: newMessage._id?.toString(),
        conversationId: conversation._id?.toString(),
      });
    }
  } catch (err) {
    console.error("Error processing email notification:", err);
    return;
  }
};

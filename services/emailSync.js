
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import Provider from "../models/Provider.js";
import Message from "../models/Message.js";
import Lead from "../models/Lead.js";
import Conversation from "../models/Conversation.js";
import Users from "../models/Users.js";
import { uploadMedia } from "./upload.js";

// Helper functions (copied from existing codebase for self-containment)
export const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
};

export const getMediaTypeFromMime = (mimeType) => {
  if (!mimeType) return "";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (
    mimeType.includes("pdf") ||
    mimeType.includes("msword") ||
    mimeType.includes("officedocument")
  )
    return "document";
  return "file";
};

export async function syncImapEmails(providerIds) {
  console.log(`[EmailSyncService] Starting sync for ${providerIds.length} providers`);
  
  const results = {
    processed: 0,
    errors: [],
    details: []
  };

  for (const providerId of providerIds) {
    try {
      const provider = await Provider.findById(providerId);
      if (!provider) {
        results.errors.push(`Provider not found: ${providerId}`);
        continue;
      }

      if (provider.emailProviderType !== "other") {
        continue;
      }

      const { imapHost, imapPort, imapUsername, imapPassword } = provider.secrets || {};
      if (!imapHost || !imapPort || !imapUsername || !imapPassword) {
        results.errors.push(`Missing secrets for provider: ${provider.email}`);
        continue;
      }

      const client = new ImapFlow({
        host: imapHost,
        port: imapPort,
        secure: imapPort === 993,
        auth: {
          user: imapUsername,
          pass: imapPassword,
        },
        logger: false,
        tls: {
          rejectUnauthorized: false,
        },
      });

      // Without an 'error' listener, a transient IMAP socket reset (ECONNRESET)
      // is emitted as an UNHANDLED 'error' event and crashes the whole process,
      // so no mail ever gets imported. Log it and let the per-message try/catch
      // handle any in-flight fetch instead.
      client.on("error", (err) => {
        console.error(
          `[EmailSyncService] IMAP connection error for ${provider.email}:`,
          err?.message || err,
        );
      });

      await client.connect();

      const folderPaths = ["INBOX"];
      try {
        const mailboxes = await client.list();
        const seenFolders = new Set(folderPaths);
        for (const mb of mailboxes || []) {
          const path = mb?.path || "";
          const name = mb?.name || "";
          const specialUse = mb?.specialUse || "";
          const isJunk =
            specialUse === "\\Junk" ||
            /spam|junk/i.test(path) ||
            /spam|junk/i.test(name);
          if (isJunk && path && !seenFolders.has(path)) {
            seenFolders.add(path);
            folderPaths.push(path);
          }
        }
      } catch (listErr) {
        console.error("Error listing IMAP mailboxes:", listErr);
      }

      const messages = [];

      // Normalize a Message-ID so the envelope ID and the stored
      // providerMessageId compare reliably regardless of angle-bracket format.
      const normMid = (id) =>
        (id || "")
          .toString()
          .replace(/^[<]+/, "")
          .replace(/[>]+$/, "")
          .trim()
          .toLowerCase();

      for (const folderPath of folderPaths) {
        let lock;
        try {
          lock = await client.getMailboxLock(folderPath);
          const mailbox = await client.mailboxOpen(folderPath);
          console.log(`[EmailSyncService] ${provider.email}: Opened ${folderPath} (${mailbox.exists} msgs)`);

          const messagesToFetch = Math.min(100, mailbox.exists);
          const startSeq = Math.max(1, mailbox.exists - messagesToFetch + 1);

          // PASS 1 - cheap metadata only. The envelope carries the Message-ID,
          // which is what we dedup on. Downloading the FULL body (with
          // attachments) of the latest 100 messages every single sync was what
          // made a refresh take 15-20 minutes.
          const envelopes = [];
          for (let i = mailbox.exists; i >= startSeq; i--) {
            try {
              const m = await client.fetchOne(i, { uid: true, envelope: true });
              if (m && m.envelope) {
                envelopes.push({ seq: i, uid: m.uid, envelope: m.envelope });
              }
            } catch (err) {
              console.error(`Error fetching envelope ${i} from ${folderPath}:`, err);
            }
          }

          // Find which Message-IDs are NOT already stored. Only those need a
          // full download. Query with bracketed + bare variants so a format
          // difference never causes us to re-download existing mail.
          const queryIds = new Set();
          for (const e of envelopes) {
            const id = e.envelope.messageId;
            if (!id) continue;
            const bare = id.replace(/^[<]+/, "").replace(/[>]+$/, "");
            queryIds.add(id);
            queryIds.add(`<${bare}>`);
            queryIds.add(bare);
          }
          const existingSet = new Set();
          if (queryIds.size) {
            const existing = await Message.find({
              clinicId: provider.clinicId,
              providerMessageId: { $in: [...queryIds] },
            })
              .select("providerMessageId")
              .lean();
            for (const x of existing) existingSet.add(normMid(x.providerMessageId));
          }

          const toDownload = envelopes.filter((e) => {
            const id = normMid(e.envelope.messageId);
            // No usable id -> download to be safe; otherwise only if new.
            return !id || !existingSet.has(id);
          });

          console.log(
            `[EmailSyncService] ${provider.email}: ${folderPath} -> ${envelopes.length} scanned, ${toDownload.length} new`,
          );

          // PASS 2 - download the full source ONLY for the new messages.
          for (const e of toDownload) {
            try {
              const message = await client.fetchOne(e.seq, {
                source: true,
                bodyStructure: true,
                uid: true,
                internalDate: true,
                size: true,
              });

              if (message && message.source) {
                const parsed = await simpleParser(message.source);
                messages.push({
                  uid: message.uid ?? e.uid,
                  seq: e.seq,
                  parsed,
                  internalDate: message.internalDate,
                  size: message.size,
                });
              }
            } catch (err) {
              console.error(`Error fetching message ${e.seq} from ${folderPath}:`, err);
            }
          }
        } catch (folderErr) {
          console.error(`Error in folder ${folderPath}:`, folderErr);
        } finally {
          if (lock) lock.release();
        }
      }

      // All message sources are now in memory. Close the IMAP connection BEFORE
      // the (slow) DB + attachment import loop so an idle socket reset during
      // imports can't abort the run.
      try {
        if (client.connected) await client.logout();
      } catch (logoutErr) {
        try {
          client.close();
        } catch (_) {}
      }

      messages.sort(
        (a, b) =>
          new Date(a.parsed?.date || a.internalDate || 0).getTime() -
          new Date(b.parsed?.date || b.internalDate || 0).getTime(),
      );

      for (const msg of messages) {
        try {
          const parsed = msg.parsed;
          const messageId = parsed.messageId;
          const threadId = Array.isArray(parsed.references)
            ? parsed.references[0]
            : parsed.references ||
              (Array.isArray(parsed.inReplyTo)
                ? parsed.inReplyTo[0]
                : parsed.inReplyTo) ||
              messageId;
          const subject = parsed.subject || "(No subject)";
          const inReplyTo = Array.isArray(parsed.inReplyTo)
            ? parsed.inReplyTo[0]
            : parsed.inReplyTo;
          const references = Array.isArray(parsed.references)
            ? parsed.references[0]
            : parsed.references;
          const receivedAt = parsed.date || msg.internalDate || new Date();

          let fromName = "";
          let fromEmail = "";
          if (parsed.from?.value?.[0]) {
            fromName = parsed.from.value[0].name || "";
            fromEmail = parsed.from.value[0].address || "";
          }

          let body = parsed.html || parsed.htmlAsText || parsed.text || "";
          const isReply = !!(inReplyTo || references);

          if (isReply && body) {
            const lines = body.split("\n");
            const cleanedLines = [];
            let inQuote = false;
            for (const line of lines) {
              if (line.startsWith(">") || (line.startsWith("On ") && line.includes(" wrote:"))) {
                inQuote = true;
              }
              if (!inQuote && line.trim()) cleanedLines.push(line);
              if (inQuote && line.trim() === "") inQuote = false;
            }
            body = cleanedLines.join("\n").trim();
            if (!body) body = parsed.text?.replace(/^>.*$/gm, "").trim() || "";
          }

          const existingMessage = await Message.findOne({
            clinicId: provider.clinicId,
            providerMessageId: messageId,
          });

          if (existingMessage) continue;

          let lead = await Lead.findOne({
            email: fromEmail,
            clinicId: provider.clinicId,
          });

          if (!lead) {
            lead = new Lead({
              clinicId: provider.clinicId,
              name: fromName || fromEmail,
              email: fromEmail,
              source: "Other",
              customSource: "IMAP Email",
            });
            await lead.save();
          }

          let conversation = await Conversation.findOne({
            clinicId: provider.clinicId,
            leadId: lead._id,
            status: { $ne: "trashed" },
          });

          if (conversation?.status === "closed" || conversation?.status === "archived") {
            conversation.status = "open";
            await conversation.save();
          }

          if (!conversation) {
            conversation = new Conversation({
              clinicId: provider.clinicId,
              leadId: lead._id,
            });
            await conversation.save();
          }

          const owners = provider.owners || [];
          const convOwners = conversation.owners || [];
          let clinicUserIds = [];
          if (convOwners.length === 0) {
            try {
              clinicUserIds = await Users.find({
                clinicId: provider.clinicId,
                isApproved: true,
              }).distinct("_id");
            } catch (userErr) {}
          }

          const allOwners = new Set([
            provider.userId?.toString(),
            ...clinicUserIds.map((id) => id.toString()),
            ...(owners?.map((i) => i.toString()) || []),
            ...(convOwners?.map((i) => i.toString()) || []),
          ].filter(Boolean));
          
          conversation.owners = [...allOwners];
          if (conversation.owners.length > 0 && !conversation.ownerId) {
            conversation.ownerId = conversation.owners[0];
          }
          await conversation.save();

          let replyToMessageId = null;
          if (isReply && (inReplyTo || references)) {
            const replyMessage = await Message.findOne({
              clinicId: provider.clinicId,
              $or: [
                { providerMessageId: inReplyTo },
                { threadId: references || inReplyTo },
              ],
            });
            replyToMessageId = replyMessage?._id || null;

            if (replyToMessageId) {
              await Message.updateMany(
                { threadId: references || inReplyTo, clinicId: provider.clinicId },
                { emailReceivedAt: receivedAt }
              );
            }
          }

          const extractEmailsFromCC = (ccString) => {
            if (!ccString) return [];
            const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
            return ccString.match(emailRegex) || [];
          };

          const ccEmails = extractEmailsFromCC(parsed.cc?.text);

          let attachments = [];
          if (parsed.attachments && parsed.attachments.length > 0) {
            for (const attachment of parsed.attachments) {
              try {
                const ext = attachment.filename?.includes(".") ? attachment.filename.split(".").pop() : null;
                let attachmentBuffer = attachment.content;
                if (attachment.content && !Buffer.isBuffer(attachment.content)) {
                  attachmentBuffer = Buffer.from(attachment.content);
                }
                const url = await uploadMedia(attachmentBuffer, ext, attachment.filename);

                attachments.push({
                  fileName: attachment.filename,
                  fileSize: formatFileSize(attachment.size),
                  mimeType: attachment.contentType,
                  mediaUrl: url,
                  mediaType: getMediaTypeFromMime(attachment.contentType),
                });
              } catch (attachmentErr) {}
            }
          }

          const newMessage = new Message({
            clinicId: provider.clinicId,
            conversationId: conversation._id,
            leadId: lead._id,
            provider: provider._id,
            channel: "email",
            messageType: "conversational",
            senderId: provider.userId?.toString(),
            recipientId: lead._id,
            direction: "incoming",
            subject: subject,
            cc: ccEmails,
            content: body || "",
            status: "received",
            providerMessageId: messageId,
            replyToMessageId: replyToMessageId,
            mediaType: attachments.length > 0 ? attachments[0].mediaType : "",
            mediaUrl: attachments.length > 0 ? attachments[0].mediaUrl : "",
            threadId: threadId,
            attachments: attachments,
            emailReceivedAt: receivedAt,
            source: "Zeva",
          });

          conversation.recentMessage = newMessage._id;
          if (!conversation.unreadMessages) conversation.unreadMessages = [];
          conversation.unreadMessages.push(newMessage._id);

          await Promise.all([newMessage.save(), conversation.save()]);
          results.processed++;
        } catch (emailError) {
          console.error(`Error processing email:`, emailError);
        }
      }
      
      try {
        if (client.connected) await client.logout();
      } catch (_) {}
      results.details.push({ email: provider.email, status: "success" });
    } catch (providerErr) {
      console.error(`Error with provider ${providerId}:`, providerErr);
      results.errors.push(`Provider error (${providerId}): ${providerErr.message}`);
    }
  }

  return results;
}

/**
 * READ-ONLY diagnostic endpoint.
 *
 * Purpose: pin down WHY a WhatsApp notification template renders its body
 * variables in the wrong slots (e.g. appointment.booked showing the time in
 * the patient-name position). It dumps the three things that must line up:
 *
 *   1. storedMapping   -> Setting.notificationSetting[].channels[whatsapp]
 *                         .variableMappings (what the clinic saved in /clinic/settings)
 *   2. sentMessage     -> the most recent Message.bodyParameters actually
 *                         handed to WhatsApp Cloud API (what got sent)
 *   3. metaTemplate    -> the approved template body pulled live from Meta, so
 *                         we can see the real {{1}}/{{2}}/{{3}} numbering.
 *
 * WhatsApp fills {{n}} strictly by array position (params[n-1]), so a mismatch
 * between the mapping order, the sent array order, and the Meta numbering is
 * what scrambles the message.
 *
 * Usage:
 *   GET /api/settings/diagnose-order
 *   GET /api/settings/diagnose-order?notificationTypeKey=appointment.booked&category=appointment
 *   GET /api/settings/diagnose-order?messageId=<id>   (inspect a specific send)
 *   GET /api/settings/diagnose-order?clinicId=<id>     (admin only)
 *
 * This endpoint performs no writes.
 */
import axios from "axios";
import dbConnect from "../../../lib/database";
import Clinic from "../../../models/Clinic";
import Provider from "../../../models/Provider";
import Template from "../../../models/Template";
import Message from "../../../models/Message";
import { Setting } from "../../../models/settings/Setting";
import { NotificationLog } from "../../../models/notification/NotificationLog";
import { getUserFromReq, requireRole } from "../lead-ms/auth";

const GRAPH_VERSION = "v19.0";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: `${req.method} - Method not allowed` });
  }

  try {
    await dbConnect();

    const me = await getUserFromReq(req);
    if (
      !requireRole(me, [
        "clinic",
        "agent",
        "admin",
        "doctor",
        "doctorStaff",
        "staff",
      ])
    ) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    // ---- Resolve clinicId (mirrors the other clinic-scoped endpoints) ----
    let clinicId = null;
    if (me.role === "clinic") {
      const clinic = await Clinic.findOne({ owner: me._id });
      clinicId = clinic?._id || null;
    } else if (me.role === "admin") {
      clinicId = req.query.clinicId || me.clinicId || null;
    } else {
      clinicId = me.clinicId || null;
    }

    if (!clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Could not resolve a clinic for this user" });
    }

    const notificationTypeKey =
      req.query.notificationTypeKey || "appointment.booked";
    const category = req.query.category || "appointment";

    const result = {
      success: true,
      context: { clinicId, notificationTypeKey, category },
      storedMapping: null,
      template: null,
      sentMessage: null,
      metaTemplate: null,
      warnings: [],
    };

    // ---- 1. Stored mapping from the clinic's notification settings ----
    const setting = await Setting.findOne({ clinicId }).lean();
    const notificationSetting = setting?.notificationSetting?.find(
      (s) =>
        s.notificationTypeKey === notificationTypeKey && s.category === category,
    );

    if (!notificationSetting) {
      result.warnings.push(
        `No notificationSetting found for ${notificationTypeKey}/${category}`,
      );
    } else {
      const waChannel = (notificationSetting.channels || []).find(
        (c) => c.channel === "whatsapp",
      );

      if (!waChannel) {
        result.warnings.push("No WhatsApp channel configured on this notification");
      } else {
        const mappings = waChannel.variableMappings || {};
        result.storedMapping = {
          isEnabled: waChannel.isEnabled,
          recipient: waChannel.recipient,
          providerId: waChannel.providerId,
          templateId: waChannel.templateId,
          variableMappings: mappings,
          headerVariableMappings: waChannel.headerVariableMappings || {},
          buttonVariableMappings: waChannel.buttonVariableMappings || {},
          // The order Object.entries() will produce — this is the exact order
          // the worker uses to build bodyParameters, so it reveals any scramble.
          entriesOrder: Object.entries(mappings).map(([k, v]) => ({
            key: k,
            value: v,
          })),
        };

        // ---- 2. The referenced template (variables + local content) ----
        if (waChannel.templateId) {
          const template = await Template.findById(waChannel.templateId).lean();
          if (template) {
            result.template = {
              _id: template._id,
              name: template.name,
              uniqueName: template.uniqueName,
              metaTemplateId: template.templateId,
              status: template.status,
              variables: template.variables,
              content: template.content,
              bodyVariableSampleValues: template.bodyVariableSampleValues,
              isHeader: template.isHeader,
              headerType: template.headerType,
              headerText: template.headerText,
              headerVariables: template.headerVariables,
            };

            // Sanity check: does the mapping cover every template variable,
            // and are the keys in the same numeric order the template expects?
            const tplVars = (template.variables || []).map((v) =>
              String(v).replace(/\D/g, ""),
            );
            const mapKeys = Object.keys(mappings).map((k) =>
              String(k).replace(/\D/g, ""),
            );
            const missing = tplVars.filter((v) => v && !mapKeys.includes(v));
            if (missing.length) {
              result.warnings.push(
                `Template variables with no mapping entry: ${missing.join(", ")}`,
              );
            }
          } else {
            result.warnings.push("Template referenced by the channel was not found");
          }
        }
      }
    }

    // ---- 3. The last message actually sent for this notification ----
    let message = null;
    if (req.query.messageId) {
      message = await Message.findById(req.query.messageId).lean();
    } else {
      const log = await NotificationLog.findOne({
        clinicId,
        notificationTypeKey,
        category,
        channel: "whatsapp",
      })
        .sort({ createdAt: -1 })
        .lean();
      if (log?.messageId) {
        message = await Message.findById(log.messageId).lean();
        result.sentMessageLogMeta = {
          logId: log._id,
          status: log.status,
          sourceId: log.sourceId,
          createdAt: log.createdAt,
        };
      }
    }

    if (message) {
      result.sentMessage = {
        _id: message._id,
        content: message.content,
        bodyParameters: message.bodyParameters,
        headerParameters: message.headerParameters,
        headerText: message.headerText,
        footerText: message.footerText,
        providerMessageId: message.providerMessageId,
        status: message.status,
        createdAt: message.createdAt,
      };
    } else {
      result.warnings.push(
        "No prior WhatsApp message found for this notification yet (book an appointment to generate one)",
      );
    }

    // ---- 4. Best-effort: pull the APPROVED template body live from Meta ----
    // This is the ground truth for {{1}}/{{2}}/{{3}} numbering. Wrapped so a
    // token/network failure never breaks the diagnostic.
    try {
      const metaTemplateId = result.template?.metaTemplateId;
      const providerId =
        result.storedMapping?.providerId || req.query.providerId;
      if (metaTemplateId && providerId) {
        const provider = await Provider.findById(providerId).lean();
        const accessToken = provider?.secrets?.whatsappAccessToken;
        if (accessToken) {
          const { data } = await axios.get(
            `https://graph.facebook.com/${GRAPH_VERSION}/${metaTemplateId}`,
            {
              params: {
                fields: "name,status,language,components",
                access_token: accessToken,
              },
            },
          );
          const bodyComponent = (data?.components || []).find(
            (c) => c.type === "BODY",
          );
          result.metaTemplate = {
            name: data?.name,
            status: data?.status,
            language: data?.language,
            bodyText: bodyComponent?.text || null,
            // Extract the {{n}} placeholders in the order they appear in text
            placeholdersInTextOrder: (
              (bodyComponent?.text || "").match(/\{\{\d+\}\}/g) || []
            ).map((p) => p.replace(/\D/g, "")),
          };
        } else {
          result.warnings.push("Provider has no WhatsApp access token to query Meta");
        }
      } else {
        result.warnings.push(
          "Skipped live Meta lookup (need a template with a metaTemplateId and a providerId)",
        );
      }
    } catch (metaErr) {
      result.warnings.push(
        `Meta lookup failed: ${metaErr?.response?.data?.error?.message || metaErr.message}`,
      );
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error?.message || "Internal server error",
    });
  }
}

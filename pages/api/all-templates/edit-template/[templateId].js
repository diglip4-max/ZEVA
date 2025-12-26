import { getUserFromReq, requireRole } from "../../lead-ms/auth";
import Clinic from "../../../../models/Clinic";
import Provider from "../../../../models/Provider";
import Template from "../../../../models/Template";
import {
  getWhatsappHandlerId,
  getWhatsappUploadId,
  updateWhatsAppTemplate,
} from "../../../../services/whatsapp";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "PUT") {
    res.setHeader("Allow", ["PUT"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const me = await getUserFromReq(req);
  if (!me) {
    return res
      .status(401)
      .json({ success: false, message: "Not authenticated" });
  }

  if (!requireRole(me, ["clinic", "agent", "admin", "doctor"])) {
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
  } else if (me.role === "doctor") {
    if (!me.clinicId) {
      return res
        .status(400)
        .json({ success: false, message: "Doctor not tied to a clinic" });
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

  try {
    const { templateId } = req.query;
    const {
      templateType,
      name,
      uniqueName,
      category,
      language,
      subject,
      preheader,
      content,
      designJson,
      editorType,
      provider,
      variables,
      bodyVariableSampleValues,
      headerVariables,
      headerVariableSampleValues,
      templateButtons,
      emailTemplateType, // for email editor type
      ...rest
    } = req.body;

    variables = Array.isArray(req.body?.variables)
      ? req.body.variables
      : JSON.parse(req.body?.variables || "[]");
    headerVariables = Array.isArray(headerVariables)
      ? headerVariables
      : JSON.parse(headerVariables || "[]");
    bodyVariableSampleValues = Array.isArray(bodyVariableSampleValues)
      ? bodyVariableSampleValues
      : JSON.parse(bodyVariableSampleValues || "[]");
    headerVariableSampleValues = Array.isArray(headerVariableSampleValues)
      ? headerVariableSampleValues
      : JSON.parse(headerVariableSampleValues || "[]");
    templateButtons = templateButtons ? JSON.parse(templateButtons) : [];

    let template = await Template.findById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found",
      });
    }

    // Update Template
    template.category = category || template.category;
    template.subject = subject || template.subject;
    template.preheader = preheader || template.preheader;
    template.content = content || template.content;
    template.designJson = designJson || template.designJson;
    template.editorType = editorType || template.editorType;
    template.variables = variables || template.variables;
    template.headerVariables = headerVariables || template.headerVariables;
    template.templateButtons = templateButtons || template.templateButtons;
    template.bodyVariableSampleValues =
      bodyVariableSampleValues || template.bodyVariableSampleValues;
    template.headerVariableSampleValues =
      headerVariableSampleValues || template.headerVariableSampleValues;

    // for email template type
    template.emailTemplateType =
      emailTemplateType || template.emailTemplateType;

    if (templateType === "whatsapp") {
      const findProvider = await Provider.findById(template.provider);
      if (!findProvider) {
        return res.status(404).json({
          success: false,
          message: "Provider not found",
        });
      }

      const whatsappTemplateId = template.templateId;
      const accessToken = findProvider?.secrets?.whatsappAccessToken;
      const whatsappNumberId = findProvider?.secrets?.wabaId;

      if (!accessToken || !whatsappNumberId) {
        return res.status(400).json({
          success: false,
          message: "Invalid provider credentials",
        });
      }

      let resData;
      if (!rest.isHeader || (rest.isHeader && rest.headerType === "text")) {
        resData = await updateWhatsAppTemplate(
          whatsappTemplateId,
          accessToken,
          {
            templateId: template.templateId, // Pass existing WhatsApp template ID
            uniqueName,
            category,
            language,
            content,
            variables,
            bodyVariableSampleValues,
            headerVariables,
            headerVariableSampleValues,
            templateButtons,
            ...rest,
          }
        );
      } else {
        if (!req.file) {
          return res
            .status(400)
            .json({ success: false, message: "No file uploaded" });
        }

        const { originalname, mimetype, buffer, size } = req.file;
        const sanitizedFilename = originalname.replace(/\s+/g, "_");

        let whatsappUploadId = await getWhatsappUploadId(
          size,
          mimetype,
          accessToken
        );
        if (whatsappUploadId) {
          let whatsappHandlerId = await getWhatsappHandlerId(
            whatsappUploadId,
            buffer,
            accessToken
          );

          resData = await updateWhatsAppTemplate(
            whatsappTemplateId,
            accessToken,
            {
              templateId: template.templateId, // Pass existing WhatsApp template ID
              uniqueName,
              category,
              language,
              content,
              variables,
              bodyVariableSampleValues,
              headerVariables,
              headerVariableSampleValues,
              whatsappHandlerId,
              templateButtons,
              ...rest,
            }
          );
        }
      }

      if (!resData) {
        return res.status(500).json({
          success: false,
          message: "Failed to update WhatsApp template",
        });
      }

      template.status = resData?.status?.toLowerCase() || "pending";
    }

    await template.save();

    return res.status(200).json({
      success: true,
      message: "Template updated successfully",
      data: template,
    });
  } catch (err) {
    console.error("Error updating template:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal Server Error",
    });
  }
}

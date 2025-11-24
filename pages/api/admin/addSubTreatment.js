import dbConnect from "../../../lib/database";
import Treatment from "../../../models/Treatment";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "POST") {
    const { mainTreatmentId, subTreatmentName, subTreatmentSlug } = req.body;

    if (!mainTreatmentId || !subTreatmentName) {
      return res
        .status(400)
        .json({
          message: "Main treatment ID and sub-treatment name are required",
        });
    }

    try {
      // Get the logged-in user
      const me = await getUserFromReq(req);
      if (!me) {
        return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
      }

      // If user is an agent, check create permission for add_treatment module
      if (['agent', 'doctorStaff'].includes(me.role)) {
        const { hasPermission, error: permissionError } = await checkAgentPermission(
          me._id,
          "add_treatment", // moduleKey
          "create", // action
          null // subModuleName
        );

        if (!hasPermission) {
          return res.status(403).json({
            success: false,
            message: permissionError || "You do not have permission to create sub-treatments"
          });
        }
      }
      // Admin users bypass permission checks
      const mainTreatment = await Treatment.findById(mainTreatmentId);
      if (!mainTreatment) {
        return res.status(404).json({ message: "Main treatment not found" });
      }

      // Check if sub-treatment already exists
      const existingSubTreatment = mainTreatment.subcategories.find(
        (sub) => sub.name.toLowerCase() === subTreatmentName.toLowerCase()
      );

      if (existingSubTreatment) {
        return res
          .status(409)
          .json({
            message: "Sub-treatment already exists for this main treatment",
          });
      }

      // Add new sub-treatment
      mainTreatment.subcategories.push({
        name: subTreatmentName,
        slug:
          subTreatmentSlug ||
          subTreatmentName.toLowerCase().replace(/\s+/g, "-"),
      });

      await mainTreatment.save();

      return res.status(201).json({
        message: "Sub-treatment added successfully",
        treatment: mainTreatment,
      });
    } catch (error) {
      console.error("Error adding sub-treatment:", error);
      return res
        .status(500)
        .json({ success: false, message: "Failed to add sub-treatment" });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}

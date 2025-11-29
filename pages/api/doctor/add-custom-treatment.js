import dbConnect from "../../../lib/database";
import Treatment from "../../../models/Treatment";
import { getUserFromReq } from "../lead-ms/auth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "POST") {
    try {
      // Verify authentication
      const authUser = await getUserFromReq(req);
      if (!authUser) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Allow doctor, lead, clinic, agent, doctorStaff, and staff roles
      if (!["doctor", "lead", "clinic", "agent", "doctorStaff", "staff"].includes(authUser.role)) {
        return res.status(403).json({ message: "Access denied" });
      }
    } catch (error) {
      console.error("Auth error:", error);
      return res.status(401).json({ message: "Invalid token" });
    }

    const { mainTreatment, subTreatments } = req.body;

    if (!mainTreatment) {
      return res
        .status(400)
        .json({ message: "Main treatment name is required" });
    }

    try {
      // Check if treatment already exists
      const existingTreatment = await Treatment.findOne({
        name: mainTreatment,
      });

      if (existingTreatment) {
        // If treatment exists, add subcategories if provided
        if (subTreatments && Array.isArray(subTreatments)) {
          const newSubcategories = subTreatments.filter(
            (subTreatment) =>
              !existingTreatment.subcategories.some(
                (existing) => existing.name === subTreatment.name
              )
          );

          if (newSubcategories.length > 0) {
            existingTreatment.subcategories.push(...newSubcategories);
            await existingTreatment.save();
          }
        }

        return res.status(200).json({
          success: true,
          message: "Treatment updated successfully",
          treatment: existingTreatment,
        });
      } else {
        // Create new treatment with subcategories
        const newTreatment = new Treatment({
          name: mainTreatment,
          slug: mainTreatment.toLowerCase().replace(/\s+/g, "-"),
          subcategories: subTreatments || [],
        });

        await newTreatment.save();

        return res.status(201).json({
          success: true,
          message: "Treatment added successfully",
          treatment: newTreatment,
        });
      }
    } catch (error) {
      console.error("Error adding custom treatment:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to add treatment",
      });
    }
  }

  return res.status(405).json({ message: "Method not allowed" });
}

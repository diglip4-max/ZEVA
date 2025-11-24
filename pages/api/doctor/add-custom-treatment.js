import dbConnect from "../../../lib/database";
import Treatment from "../../../models/Treatment";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method === "POST") {
    // Verify doctor authentication
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("Decoded token role:", decoded.role);
      if (
        decoded.role !== "doctor" &&
        decoded.role !== "lead" &&
        decoded.role !== "clinic"
      ) {
        return res.status(403).json({ message: "Access denied" });
      }
    } catch  {
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

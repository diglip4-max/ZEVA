import dbConnect from "../../../lib/database";
import Treatment from "../../../models/Treatment";

export default async function handler(req, res) {
  await dbConnect();
  const { q } = req.query;

  if (!q) return res.status(400).json({ message: "Query is required" });

  const regex = new RegExp(q, "i");
  const results = await Treatment.find({
    $or: [{ name: regex }, { "subcategories.name": regex }],
  })
    .limit(10)
    .lean();

  // Map results to return formatted treatment names
  const treatments = results
    .map((t) => {
      if (t.subcategories && t.subcategories.length > 0) {
        // Return sub-treatment names with main treatment in parentheses
        return t.subcategories.map((sub) => `${sub.name} (${t.name})`);
      }
      return t.name;
    })
    .flat();

  res.status(200).json({ success: true, treatments });
}

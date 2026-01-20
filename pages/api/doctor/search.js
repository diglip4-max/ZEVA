import dbConnect from "../../../lib/database";
import Treatment from "../../../models/Treatment";

export default async function handler(req, res) {
  await dbConnect();
  const { q } = req.query;

  if (!q) return res.status(400).json({ message: "Query is required" });

  const regex = new RegExp(q, "i");
  const results = await Treatment.find({
    name: regex, // Only search main treatments, not sub-treatments
  })
    .limit(10)
    .lean();

  // Map results to return only main treatment names (no sub-treatments)
  const treatments = results
    .map((t) => {
      // Only return main treatment name, ignore sub-treatments
      return t.name;
    })
    .filter(Boolean); // Remove any null/undefined values

  res.status(200).json({ success: true, treatments });
}

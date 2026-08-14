export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res
      .status(405)
      .json({ success: false, message: "Method Not Allowed" });
  }

  try {
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
}

import dbConnect from "../../../lib/database";
import Blog from "../../../models/Blog";
import { getUserFromReq } from "../lead-ms/auth";
import { checkAgentPermission } from "../agent/permissions-helper";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Get the logged-in user
    const me = await getUserFromReq(req);
    if (!me) {
      return res.status(401).json({ success: false, message: "Unauthorized: Missing or invalid token" });
    }

    // If user is an agent, check read permission for all_blogs module
    if (['agent', 'doctorStaff'].includes(me.role)) {
      const { hasPermission, error: permissionError } = await checkAgentPermission(
        me._id,
        "all_blogs", // moduleKey
        "read", // action
        null // subModuleName
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: permissionError || "You do not have permission to view blogs"
        });
      }
    }
    // Admin users bypass permission checks

    const blogs = await Blog.find({ status: "published" }) // ✅ Only published
      .populate("postedBy", "name email role")
      .populate("comments.user", "name email")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, blogs });
  } catch (error) {
    console.error("Error fetching blogs:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
}

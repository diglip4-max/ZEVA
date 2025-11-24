// pages/api/blog/likeBlog.js
import dbConnect from "../../../lib/database";
import Blog from "../../../models/Blog";
import { verifyAuth } from "./verifyAuth";

export default async function handler(req, res) {
  await dbConnect();

  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ success: false, error: "Method not allowed" });
  }

  const user = await verifyAuth(req, res);
  if (!user) return;

  const { blogId } = req.body;
  if (!blogId) {
    return res
      .status(400)
      .json({ success: false, error: "Blog ID is required" });
  }

  const blog = await Blog.findById(blogId);
  if (!blog) {
    return res.status(404).json({ success: false, error: "Blog not found" });
  }

  const alreadyLiked = blog.likes.some((id) => id.equals(user._id));

  if (alreadyLiked) {
    blog.likes = blog.likes.filter((id) => !id.equals(user._id)); // unlike
  } else {
    blog.likes.push(user._id); // like
  }

  await blog.save();

  res.status(200).json({
    success: true,
    likesCount: blog.likes.length,
    liked: !alreadyLiked,
  });
}

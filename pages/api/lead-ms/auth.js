// /lib/auth.js
import jwt from "jsonwebtoken";
import dbConnect from "../../../lib/database";
import User from "../../../models/Users";

export async function getUserFromReq(req) {
  await dbConnect();
  try { 
    const auth = req.headers.authorization || "";
    // console.log("Authorization header:", req.headers.authorization);

 const token = auth?.toLowerCase().startsWith("bearer ")
    ? auth.slice(7)
    : null;
    // console.log("Extracted token:", token);
    if (!token) return null;

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    
    // Handle different token formats:
    // Admin uses 'id', others use 'userId'
    const userId = payload?.userId || payload?.id;
    if (!userId) return null;

    const user = await User.findById(userId);
    return user || null;
  } catch (e) {
    console.error("Auth error:", e.message);
    return null;
  }
}

export function signToken(user) {
  return jwt.sign(
    { userId: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
 );
}

export function requireRole(user, roles = []) {
  if (!user) return false;
  if (!roles.length) return true;
  return roles.includes(user.role);
}
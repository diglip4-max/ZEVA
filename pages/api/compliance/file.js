import fs from "fs";
import path from "path";
import dbConnect from "../../../lib/database";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";
import SOP from "../../../models/SOP";
import Playbook from "../../../models/Playbook";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }
  await dbConnect();
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader) {
      console.error("api/compliance/file: missing Authorization header");
      return res.status(401).json({ success: false, message: "Authorization header missing" });
    }
    let user;
    user = await getUserFromReq(req);
    if (!user) {
      console.error("api/compliance/file: invalid or expired token");
      return res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
    if (!["clinic", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    let clinicId;
    if (user.role === "admin") {
      clinicId = req.query.clinicId || req.body?.clinicId;
    } else {
      const resolved = await getClinicIdFromUser(user);
      clinicId = resolved.clinicId;
      if (resolved.error || !clinicId) {
        return res.status(403).json({ success: false, message: resolved.error || "Unable to determine clinic access" });
      }
    }

    const type = String(req.query.type || "").toLowerCase();
    const id = String(req.query.id || "");
    if (!id || !type) {
      return res.status(400).json({ success: false, message: "Missing id or type" });
    }

    let item;
    if (type === "sops") {
      item = await SOP.findOne({ _id: id, clinicId }).lean();
    } else if (type === "playbooks") {
      item = await Playbook.findOne({ _id: id, clinicId }).lean();
    } else {
      return res.status(400).json({ success: false, message: "Invalid type" });
    }
    if (!item) {
      return res.status(404).json({ success: false, message: "Not found" });
    }

    const cleanUrl = (v) => {
      if (!v) return "";
      let s = String(v).trim();
      s = s.replace(/^['"`]+\s*|\s*['"`]+$/g, "");
      s = s.replace(/^\(+|\)+$/g, "");
      return s;
    };
    const rawDocUrl = item.documentUrl || (Array.isArray(item.attachments) ? item.attachments[0] : "");
    const docUrl = cleanUrl(rawDocUrl);
    if (!docUrl) {
      console.error("api/compliance/file: document URL missing for item", { type, id });
      return res.status(404).json({ success: false, message: "Document URL missing" });
    }

    // Detect MIME type from file extension
    const getMimeType = (filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".ppt": "application/vnd.ms-powerpoint",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".ogg": "video/ogg",
        ".mov": "video/quicktime",
        ".avi": "video/x-msvideo",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".txt": "text/plain",
        ".csv": "text/csv",
      };
      return mimeMap[ext] || "application/octet-stream";
    };

    const getFileExtFromUrl = (url) => {
      try {
        const urlPath = new URL(url, "http://localhost").pathname;
        return path.extname(urlPath).toLowerCase();
      } catch {
        return path.extname(url).toLowerCase();
      }
    };

    const sendBuffer = async (buf) => {
      const ext = getFileExtFromUrl(docUrl);
      const mime = getMimeType(docUrl);
      const safeName = `document${ext || ".pdf"}`;
      res.setHeader("Content-Type", mime);
      res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(buf);
    };

    const isDataUrl = typeof docUrl === "string" && docUrl.startsWith("data:");
    if (isDataUrl) {
      try {
        const base64 = docUrl.includes("base64,") ? docUrl.split("base64,")[1] : "";
        if (!base64) {
          return res.status(502).json({ success: false, message: "Invalid data URL" });
        }
        const buf = Buffer.from(base64, "base64");
        return await sendBuffer(buf);
      } catch {
        return res.status(502).json({ success: false, message: "Failed to decode data URL" });
      }
    }

    function getBaseUrl() {
      if (process.env.NODE_ENV === "production") {
        return process.env.NEXT_PUBLIC_BASE_URL || "https://zeva360.com";
      }
      return process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    }
    const baseUrl = getBaseUrl();
    const absoluteUrl = (() => {
      try {
        return new URL(docUrl).toString();
      } catch {
        return new URL(docUrl, baseUrl).toString();
      }
    })();
    const urlObj = new URL(absoluteUrl);
    const sameHost = urlObj.host === new URL(baseUrl).host || urlObj.hostname === "localhost";
    if (!sameHost) {
      return res.status(404).json({ success: false, message: "External storage not supported for documentUrl" });
    }
    const publicRoot = path.join(process.cwd(), "public");
    const normalizedPath = urlObj.pathname.replace(/\/+/g, "/");
    const diskPath = path.join(publicRoot, normalizedPath.replace(/^\//, ""));
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({ success: false, message: "Local file not found" });
    }
    const stat = fs.statSync(diskPath);
    const fileMime = getMimeType(diskPath);
    const fileExt = path.extname(diskPath).toLowerCase();
    const safeName = `document${fileExt || ""}`;
    res.setHeader("Content-Type", fileMime);
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    const stream = fs.createReadStream(diskPath);
    stream.on("error", () => res.status(500).end());
    stream.pipe(res);
    return;
  } catch (err) {
    console.error("api/compliance/file: internal error", err);
    return res.status(500).json({ success: false, message: err.message || "Internal error" });
  }
}

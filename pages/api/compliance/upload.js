// api/compliance/upload
import fs from "fs";
import path from "path";
import formidable from "formidable";
import dbConnect from "../../../lib/database";
import { getUserFromReq } from "../lead-ms/auth";
import { getClinicIdFromUser } from "../lead-ms/permissions-helper";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, message: "Method not allowed" });
  }

  await dbConnect();

  try {
    let user;
    try {
      user = await getUserFromReq(req);
      if (!user) {
        return res.status(401).json({ success: false, message: "Unauthorized" });
      }
      if (!["clinic", "agent", "doctorStaff", "staff", "admin"].includes(user.role)) {
        return res.status(403).json({ success: false, message: "Access denied" });
      }
    } catch {
      return res.status(401).json({ success: false, message: "Invalid token" });
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

    const typeParam = String(req.query.type || "sops").toLowerCase();
    const subfolder = typeParam === "playbooks" ? "playbooks" : "sops";
    const uploadDir = path.join(process.cwd(), "public", "uploads", "compliance", subfolder);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const form = formidable({
      uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024, // 50MB
      filename: (name, ext, part) => {
        const timestamp = Date.now();
        const originalName = part.originalFilename || "file";
        const sanitizedName = originalName.replace(/[^a-zA-Z0-9.-]/g, "_");
        return `${clinicId}-${timestamp}-${sanitizedName}`;
      },
    });

    const [fields, files] = await form.parse(req);

    let file;
    if (files.file) {
      file = Array.isArray(files.file) ? files.file[0] : files.file;
    } else {
      const keys = Object.keys(files);
      if (keys.length) {
        const k = keys[0];
        file = Array.isArray(files[k]) ? files[k][0] : files[k];
      }
    }

    if (!file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const filepath = file.filepath || file.path;
    if (!filepath || !fs.existsSync(filepath)) {
      return res.status(500).json({ success: false, message: "Upload failed" });
    }

    const filename = path.basename(filepath);
    const fileUrl = `/uploads/compliance/${subfolder}/${filename}`;

    return res.status(200).json({ success: true, url: fileUrl });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Internal error" });
  }
}

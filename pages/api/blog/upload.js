import fs from 'fs';
import path from 'path';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

  const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'blog');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const form = new formidable.IncomingForm({
    uploadDir,
    keepExtensions: true,
    filename: (name, ext, part) => `${Date.now()}-${part.originalFilename}`,
  });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Upload failed' });
    }

    const file = files.file[0];
    const filename = path.basename(file.filepath);
    const fileUrl = `/uploads/blog/${filename}`;

    res.status(200).json({ url: fileUrl });
  });
}

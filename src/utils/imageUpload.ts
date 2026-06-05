import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Request } from 'express';

const imagesDir = path.join(process.cwd(), 'uploads', 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imagesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `image-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

export const courseImageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp|gif)/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
  },
});

/** Pick uploaded course cover from common multipart field names. */
export function pickUploadedImage(req: Request): Express.Multer.File | null {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return (
    req.file ??
    files?.image?.[0] ??
    files?.thumbnail?.[0] ??
    files?.file?.[0] ??
    null
  );
}

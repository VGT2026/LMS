import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, requireInstructorOrAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';
import { buildUploadFileUrl } from '../utils/uploadUrls';

const router = Router();

const videosDir = path.join(process.cwd(), 'uploads', 'videos');
const pdfsDir = path.join(process.cwd(), 'uploads', 'pdfs');
const imagesDir = path.join(process.cwd(), 'uploads', 'images');
[videosDir, pdfsDir, imagesDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, videosDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `video-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const pdfStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, pdfsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `pdf-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, imagesDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `image-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const videoUpload = multer({
  storage: videoStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /video\/(mp4|webm|ogg|quicktime|x-msvideo)/i;
    if (allowed.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only video files (mp4, webm, ogg, mov, avi) are allowed'));
  },
});

const pdfUpload = multer({
  storage: pdfStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
});

const imageUpload = multer({
  storage: imageStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|jpg|png|webp|gif)/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files (JPEG, PNG, WebP, GIF) are allowed'));
  },
});

function pickUploadedImage(req: Request): Express.Multer.File | null {
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  return (
    req.file ??
    files?.image?.[0] ??
    files?.thumbnail?.[0] ??
    files?.file?.[0] ??
    null
  );
}

router.post('/video', authenticate, requireInstructorOrAdmin, videoUpload.single('video'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      sendError(res, 'No video file uploaded', 400);
      return;
    }
    const videoUrl = buildUploadFileUrl('videos', req.file.filename);
    sendSuccess(res, { url: videoUrl, filename: req.file.filename }, 'Video uploaded successfully', 201);
  } catch (error) {
    console.error('Upload video error:', error);
    sendError(res, 'Failed to upload video', 500);
  }
});

router.post('/pdf', authenticate, requireInstructorOrAdmin, pdfUpload.single('pdf'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      sendError(res, 'No PDF file uploaded', 400);
      return;
    }
    const pdfUrl = buildUploadFileUrl('pdfs', req.file.filename);
    sendSuccess(res, { url: pdfUrl, filename: req.file.filename }, 'PDF uploaded successfully', 201);
  } catch (error) {
    console.error('Upload PDF error:', error);
    sendError(res, 'Failed to upload PDF', 500);
  }
});

/** Course thumbnail / cover — form field: image, thumbnail, or file */
router.post('/image', authenticate, requireInstructorOrAdmin, (req: Request, res: Response) => {
  imageUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      sendError(res, err.message, 400);
      return;
    }
    if (err instanceof Error) {
      sendError(res, err.message, 400);
      return;
    }

    try {
      const file = pickUploadedImage(req);
      if (!file) {
        sendError(res, 'No image file uploaded', 400);
        return;
      }
      const url = buildUploadFileUrl('images', file.filename);
      sendSuccess(res, { url, filename: file.filename }, 'Image uploaded successfully', 201);
    } catch (error) {
      console.error('Upload image error:', error);
      sendError(res, 'Failed to upload image', 500);
    }
  });
});

export default router;

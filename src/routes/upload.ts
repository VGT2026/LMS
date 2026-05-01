import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, requireInstructorOrAdmin } from '../middleware/auth';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// Ensure uploads directory exists
const videosDir = path.join(process.cwd(), 'uploads', 'videos');
const pdfsDir = path.join(process.cwd(), 'uploads', 'pdfs');
[videosDir, pdfsDir].forEach((dir) => {
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

router.post('/video', authenticate, requireInstructorOrAdmin, videoUpload.single('video'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      sendError(res, 'No video file uploaded', 400);
      return;
    }
    const port = process.env.PORT || 3001;
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${port}`;
    const videoUrl = `${baseUrl}/uploads/videos/${req.file.filename}`;
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
    const port = process.env.PORT || 3001;
    const baseUrl = process.env.API_BASE_URL || `http://localhost:${port}`;
    const pdfUrl = `${baseUrl}/uploads/pdfs/${req.file.filename}`;
    sendSuccess(res, { url: pdfUrl, filename: req.file.filename }, 'PDF uploaded successfully', 201);
  } catch (error) {
    console.error('Upload PDF error:', error);
    sendError(res, 'Failed to upload PDF', 500);
  }
});

export default router;

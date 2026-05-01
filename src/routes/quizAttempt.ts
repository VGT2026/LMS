import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth';
import {
  saveQuizAttempt,
  submitQuizAttempt,
  appendExamLog,
  uploadProctorFrame,
  getMyQuizAttempts,
} from '../controllers/quizExamController';

const router = Router();
router.use(authenticate);

const proctorRoot = path.join(process.cwd(), 'uploads', 'quiz-proctor');
if (!fs.existsSync(proctorRoot)) fs.mkdirSync(proctorRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const attemptId = req.params.id;
    const dir = path.join(proctorRoot, String(attemptId));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `frame-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|png|webp)/i.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only JPEG/PNG/WebP images'));
  },
});

router.get('/my', getMyQuizAttempts);
router.patch('/:id/save', saveQuizAttempt);
router.post('/:id/submit', submitQuizAttempt);
router.post('/:id/log', appendExamLog);
router.post('/:id/proctor-frame', upload.single('frame'), uploadProctorFrame);

export default router;

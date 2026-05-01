import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import {
  listQuizzes,
  getQuizById,
  createQuiz,
  updateQuiz,
  deleteQuiz,
} from '../controllers/quizController';
import { getExamQuiz, startQuizAttempt } from '../controllers/quizExamController';
import { authenticate, requireInstructorOrAdmin } from '../middleware/auth';

const router = Router();

const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map((e: any) => e.msg || e.path).join(', ');
    return res.status(400).json({ success: false, message: msg || 'Validation failed' });
  }
  next();
};

router.use(authenticate);

router.get('/', listQuizzes);
router.get('/:id/exam', getExamQuiz);
router.post('/:id/start', startQuizAttempt);
router.get('/:id', getQuizById);
router.post('/', requireInstructorOrAdmin, [
  body('course_id').isInt({ min: 1 }),
  body('title').trim().isLength({ min: 1, max: 255 }),
], handleValidation, createQuiz);
router.patch('/:id', requireInstructorOrAdmin, updateQuiz);
router.delete('/:id', requireInstructorOrAdmin, deleteQuiz);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import {
  listAssignments,
  listAllSubmissions,
  listMySubmissions,
  getAssignmentById,
  createAssignment,
  publishAssignment,
  submitAssignment,
  getSubmission,
  gradeSubmission,
} from '../controllers/assignmentController';
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

router.get('/', listAssignments);
router.get('/submissions', requireInstructorOrAdmin, listAllSubmissions);
router.get('/my-submissions', listMySubmissions);
router.post('/', requireInstructorOrAdmin, [
  body('course_id').isInt({ min: 1 }),
  body('title').trim().isLength({ min: 1, max: 255 }),
  body('due_date').notEmpty(),
], handleValidation, createAssignment);
router.patch('/submissions/:submissionId/grade', requireInstructorOrAdmin, [
  body('grade').isFloat({ min: 0, max: 100 }),
], handleValidation, gradeSubmission);
router.patch('/:id/publish', requireInstructorOrAdmin, publishAssignment);
router.post('/:id/submit', [
  body('content').notEmpty(),
], handleValidation, submitAssignment);
router.get('/:id/submission', getSubmission);
router.get('/:id', getAssignmentById);

export default router;

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { getEnrollmentByCourse, updateEnrollmentProgress, getEnrollmentsByCourse } from '../controllers/enrollmentController';

const router = Router();

// Get all enrollments for a course (instructor only)
router.get('/course/:courseId', authenticate, getEnrollmentsByCourse);

// Get current user's enrollment in a course
router.get('/me/:courseId', authenticate, getEnrollmentByCourse);
router.patch('/me/:courseId/progress', authenticate, updateEnrollmentProgress);

export default router;

import { Router } from 'express';
import { getStudentStats, getInstructorStats, getAdminStats, getEnrolledCourses } from '../controllers/dashboardController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.get('/student/enrolled-courses', authenticate, getEnrolledCourses);
router.get('/student', authenticate, getStudentStats);
router.get('/instructor', authenticate, getInstructorStats);
router.get('/admin', authenticate, getAdminStats);

export default router;

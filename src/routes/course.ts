import { Router } from 'express';
import {
  getAllCourses,
  getPendingCourses,
  getCourseById,
  createCourse,
  updateCourse,
  assignInstructor,
  approveCourse,
  publishCourse,
  unpublishCourse,
  toggleCourseStatus,
  enrollInCourse,
  getAllCategories
} from '../controllers/courseController';
import { authenticate, optionalAuthenticate, requireAdmin, requireInstructorOrAdmin } from '../middleware/auth';
import { body } from 'express-validator';

const router = Router();

// Public routes
router.get('/', getAllCourses);
router.get('/categories/all', getAllCategories);
router.get('/pending', authenticate, requireAdmin, getPendingCourses);
router.get('/:id', optionalAuthenticate, getCourseById);
router.post('/:id/enroll', authenticate, enrollInCourse);

router.post('/', authenticate, requireInstructorOrAdmin, [
  body('title').trim().isLength({ min: 3, max: 255 }),
  body('category').notEmpty(),
  body('level').optional().isIn(['beginner', 'intermediate', 'advanced']),
  body('price').optional().isFloat({ min: 0 }),
], createCourse);

router.put('/:id', authenticate, requireInstructorOrAdmin, updateCourse);

router.patch('/:id/assign-instructor', authenticate, requireAdmin, [
  body('instructor_id').optional().isInt({ min: 1 })
], assignInstructor);

router.patch('/:id/approve', authenticate, requireAdmin, [
  body('status').isIn(['approved', 'rejected'])
], approveCourse);

router.patch('/:id/publish', authenticate, requireInstructorOrAdmin, publishCourse);
router.patch('/:id/unpublish', authenticate, requireAdmin, unpublishCourse);
router.patch('/:id/toggle-status', authenticate, requireAdmin, toggleCourseStatus);

export default router;
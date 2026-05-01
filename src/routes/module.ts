import { Router } from 'express';
import {
  getModulesByCourse,
  createModule,
  updateModule,
  deleteModule,
  createLesson,
  updateLesson,
  deleteLesson,
} from '../controllers/moduleController';
import { authenticate, requireInstructorOrAdmin } from '../middleware/auth';

const router = Router();

// Get modules for a course (public for published, instructor for draft)
router.get('/course/:courseId', getModulesByCourse);

// Module CRUD - instructors can add/edit/delete on their draft courses
router.post('/course/:courseId', authenticate, requireInstructorOrAdmin, createModule);

// Lesson routes must come before /:moduleId to avoid "lessons" being matched as moduleId
router.put('/lessons/:lessonId', authenticate, requireInstructorOrAdmin, updateLesson);
router.delete('/lessons/:lessonId', authenticate, requireInstructorOrAdmin, deleteLesson);

router.put('/:moduleId', authenticate, requireInstructorOrAdmin, updateModule);
router.delete('/:moduleId', authenticate, requireInstructorOrAdmin, deleteModule);
router.post('/:moduleId/lessons', authenticate, requireInstructorOrAdmin, createLesson);

export default router;

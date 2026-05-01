import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { listAnnouncements, createAnnouncement, deleteAnnouncement } from '../controllers/announcementController';

const router = Router();

// List announcements for a course (any authenticated user)
router.get('/course/:courseId', authenticate, listAnnouncements);

// Create announcement for a course (instructor or admin only)
router.post('/course/:courseId', authenticate, createAnnouncement);

// Delete an announcement (instructor or admin only)
router.delete('/:id', authenticate, deleteAnnouncement);

export default router;

import { Router } from 'express';
import { authenticate, requireInstructorOrAdmin } from '../middleware/auth';
import * as discussionController from '../controllers/discussionController';

const router = Router();

router.get('/', authenticate, discussionController.getPosts);
router.post('/', authenticate, discussionController.createPost);
router.get('/:id', authenticate, discussionController.getPostDetails);
router.post('/:id/like', authenticate, discussionController.toggleLike);
router.post('/:id/reply', authenticate, discussionController.createReply);
router.patch('/:id/pin', authenticate, requireInstructorOrAdmin, discussionController.togglePin);

export default router;

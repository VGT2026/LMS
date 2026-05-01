import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as messageController from '../controllers/messageController';

const router = Router();

router.get('/conversations', authenticate, messageController.getConversations);
router.get('/conversations/:conversationId/messages', authenticate, messageController.getMessages);
router.post('/messages', authenticate, messageController.sendMessage);
router.put('/conversations/:conversationId/read', authenticate, messageController.markAsRead);

export default router;

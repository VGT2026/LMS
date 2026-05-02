import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth';
import { createTicket, listTickets } from '../controllers/supportController';

const router = Router();

// Any authenticated user can submit a ticket.
router.post('/tickets', authenticate, createTicket);

// Admin can view recent tickets.
router.get('/tickets', authenticate, requireAdmin, listTickets);

// Alias for frontend clients that call /issues (same payload as GET /tickets).
router.get('/issues', authenticate, requireAdmin, listTickets);

export default router;


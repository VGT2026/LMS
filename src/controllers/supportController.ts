import { Request, Response } from 'express';
import { sendError, sendSuccess } from '../utils/response';
import { SupportTicketModel } from '../models/SupportTicket';

export const createTicket = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Admin should not submit support tickets; students/instructors can.
    if (user.role === 'admin') {
      sendError(res, 'Admins cannot submit support tickets', 403);
      return;
    }

    const { subject, category, message } = req.body as {
      subject?: string;
      category?: string;
      message?: string;
    };

    if (!subject?.trim() || !category?.trim() || !message?.trim()) {
      sendError(res, 'Subject, category, and message are required', 400);
      return;
    }

    if (message.trim().length > 20000) {
      sendError(res, 'Message is too long', 400);
      return;
    }

    const ticket = await SupportTicketModel.create({
      user_id: user.userId,
      subject,
      category,
      message,
    });

    sendSuccess(res, { ticket }, 'Support ticket submitted', 201);
  } catch (error) {
    console.error('Create support ticket error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const listTickets = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      sendError(res, 'Admin access only', 403);
      return;
    }

    const limit = parseInt(String(req.query.limit || '10'), 10) || 10;
    const tickets = await SupportTicketModel.findRecentWithUser(limit);
    sendSuccess(res, { tickets }, 'Support tickets retrieved');
  } catch (error) {
    console.error('List support tickets error:', error);
    sendError(res, 'Internal server error', 500);
  }
};


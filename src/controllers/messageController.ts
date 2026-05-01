import { Request, Response } from 'express';
import { ConversationModel } from '../models/Conversation';
import { MessageModel } from '../models/Message';
import { UserModel } from '../models/User';

export const getConversations = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const conversations = await ConversationModel.findByUser(userId);
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Failed to fetch conversations' });
  }
};

export const getMessages = async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.conversationId as string);
    const userId = (req as any).user?.userId;

    // Verify participation
    const participants = await ConversationModel.getParticipants(conversationId);
    if (!participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to view this conversation' });
    }

    const messages = await MessageModel.findByConversation(conversationId);
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Failed to fetch messages' });
  }
};

export const sendMessage = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const { conversationId, content, recipientId } = req.body;

    let targetConversationId = conversationId;

    // Students are not allowed to message admins.
    if (!targetConversationId && recipientId) {
      const recipient = await UserModel.findById(Number(recipientId));
      if (!recipient) {
        return res.status(404).json({ message: 'Recipient not found' });
      }
      if (userRole === 'student' && recipient.role === 'admin') {
        return res.status(403).json({ message: 'Students are not allowed to message admins' });
      }
    }

    // If no conversationId, create one with recipientId
    if (!targetConversationId && recipientId) {
      // Check if conversation already exists (simplified: just create new for now or find existing)
      // For this MVP, let's assume we create a new one if not provided, 
      // but ideally we should check if a 1-on-1 exists.
      // TODO: Check for existing 1-on-1 conversation
      targetConversationId = await ConversationModel.create([userId, recipientId]);
    }

    if (!targetConversationId) {
      return res.status(400).json({ message: 'Conversation ID or Recipient ID required' });
    }

    // Block messages that are only numbers or contain phone numbers
    if (content && typeof content === 'string') {
      const trimmed = content.trim();
      const onlyDigits = /^\d+$/;
      const hasLongDigitString = /\d{6,}/;
      const hasPhoneNumber = /\b\d{10,}\b|(?:\+?\d{1,4}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{4}/;
      if (onlyDigits.test(trimmed) || hasLongDigitString.test(trimmed) || hasPhoneNumber.test(trimmed)) {
        return res.status(400).json({ message: 'Sharing numbers is not allowed. Use text like "My score is 85" to share scores.' });
      }
    }

    // Verify participation
    const participants = await ConversationModel.getParticipants(targetConversationId);
    if (!participants.includes(userId)) {
      return res.status(403).json({ message: 'Not authorized to send to this conversation' });
    }

    // Students are not allowed to send messages into conversations that include admins.
    if (userRole === 'student') {
      const recipientIds = participants.filter((id) => id !== userId);
      for (const pid of recipientIds) {
        const recipient = await UserModel.findById(pid);
        if (recipient?.role === 'admin') {
          return res.status(403).json({ message: 'Students are not allowed to message admins' });
        }
      }
    }

    const message = await MessageModel.create(targetConversationId, userId, content);
    res.status(201).json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Failed to send message' });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const conversationId = parseInt(req.params.conversationId as string);
    const userId = (req as any).user?.userId;

    await MessageModel.markAsRead(conversationId, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ message: 'Failed to mark messages as read' });
  }
};

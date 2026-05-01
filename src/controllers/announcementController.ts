import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { AnnouncementModel } from '../models/Announcement';

export const listAnnouncements = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const courseIdNum = Number(courseId);
    if (isNaN(courseIdNum)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }
    const announcements = await AnnouncementModel.findByCourse(courseIdNum);
    sendSuccess(res, announcements, 'Announcements retrieved');
  } catch (error) {
    console.error('List announcements error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const createAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (user.role !== 'instructor' && user.role !== 'admin') {
      sendError(res, 'Instructor access required', 403);
      return;
    }

    const { courseId } = req.params;
    const courseIdNum = Number(courseId);
    if (isNaN(courseIdNum)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const { title, content, type } = req.body;
    if (!title?.trim() || !content?.trim()) {
      sendError(res, 'Title and content are required', 400);
      return;
    }

    const announcement = await AnnouncementModel.create({
      course_id: courseIdNum,
      user_id: user.userId,
      title: title.trim(),
      content: content.trim(),
      type: type ?? 'info',
    });
    sendSuccess(res, announcement, 'Announcement created', 201);
  } catch (error) {
    console.error('Create announcement error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const deleteAnnouncement = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (user.role !== 'instructor' && user.role !== 'admin') {
      sendError(res, 'Instructor access required', 403);
      return;
    }

    const { id } = req.params;
    const idNum = Number(id);
    if (isNaN(idNum)) {
      sendError(res, 'Invalid announcement ID', 400);
      return;
    }

    await AnnouncementModel.delete(idNum);
    sendSuccess(res, null, 'Announcement deleted');
  } catch (error) {
    console.error('Delete announcement error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

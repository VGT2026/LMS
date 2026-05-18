import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { EnrollmentModel } from '../models/Enrollment';
import { UserModel } from '../models/User';
import { CourseModel } from '../models/Course';
import DatabaseHelper from '../utils/database';
import { hasAdminPanelAccess } from '../utils/rolePolicy';

export const getEnrolledCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (user.role !== 'student') {
      sendError(res, 'Student access only', 403);
      return;
    }

    const courses = await EnrollmentModel.getEnrolledCoursesWithDetails(user.userId);
    sendSuccess(res, courses, 'Enrolled courses retrieved');
  } catch (error) {
    console.error('Get enrolled courses error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getStudentStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (user.role !== 'student') {
      sendError(res, 'Student access only', 403);
      return;
    }

    const stats = await EnrollmentModel.getStudentStats(user.userId);
    sendSuccess(res, stats, 'Student stats retrieved');
  } catch (error) {
    console.error('Get student stats error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getInstructorStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (user.role !== 'instructor') {
      sendError(res, 'Instructor access only', 403);
      return;
    }

    const stats = await EnrollmentModel.getInstructorStats(user.userId);
    sendSuccess(res, stats, 'Instructor stats retrieved');
  } catch (error) {
    console.error('Get instructor stats error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getAdminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    if (!hasAdminPanelAccess(user.role)) {
      sendError(res, 'Admin access only', 403);
      return;
    }

    // Use aggregates only — avoids querying optional columns like approval_status required by findAll().
    const [userStats, courseCounts] = await Promise.all([
      UserModel.getStats(),
      CourseModel.getDashboardCounts(),
    ]);

    sendSuccess(
      res,
      {
        totalUsers: Number(userStats.total),
        activeUsers: Number(userStats.active),
        totalCourses: Number(courseCounts.total),
        activeCourses: Number(courseCounts.active),
      },
      'Admin stats retrieved'
    );
  } catch (error) {
    console.error('Get admin stats error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    sendError(
      res,
      process.env.NODE_ENV === 'development' ? `Internal server error: ${detail}` : 'Internal server error',
      500,
      process.env.NODE_ENV === 'development' ? detail : undefined
    );
  }
};

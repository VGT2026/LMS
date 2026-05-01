import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { EnrollmentModel } from '../models/Enrollment';
import { CourseModel } from '../models/Course';

export const getEnrollmentsByCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    // Only instructors and admins can view course enrollments
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

    const course = await CourseModel.findById(courseIdNum);
    if (!course) {
      console.log(`Course ${courseIdNum} not found`);
      sendError(res, 'Course not found', 404);
      return;
    }

    // Verify instructor owns this course (unless admin)
    if (user.role === 'instructor' && (course as any).instructor_id !== user.userId) {
      console.log(`Instructor ${user.userId} does not own course ${courseIdNum}`);
      sendError(res, 'You do not have access to this course', 403);
      return;
    }

    console.log(`Fetching enrollments for course ${courseIdNum}`);
    const enrollments = await EnrollmentModel.findByCourseWithUserDetails(courseIdNum);
    console.log(`Found ${enrollments.length} enrollments for course ${courseIdNum}:`, enrollments);
    
    sendSuccess(res, enrollments, 'Course enrollments retrieved');
  } catch (error) {
    console.error('Get course enrollments error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getEnrollmentByCourse = async (req: Request, res: Response): Promise<void> => {
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

    const { courseId } = req.params;
    const courseIdNum = Number(courseId);
    if (isNaN(courseIdNum)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const course = await CourseModel.findById(courseIdNum);
    if (!course || !course.is_active) {
      sendError(res, 'This course is not available', 403);
      return;
    }

    const enrollment = await EnrollmentModel.findByUserAndCourse(user.userId, courseIdNum);
    if (!enrollment) {
      sendError(res, 'Not enrolled in this course', 404);
      return;
    }

    sendSuccess(res, {
      id: enrollment.id,
      course_id: enrollment.course_id,
      progress_percentage: enrollment.progress_percentage,
      completed_lessons: enrollment.completed_lessons ?? [],
      completed_at: enrollment.completed_at,
    }, 'Enrollment retrieved');
  } catch (error) {
    console.error('Get enrollment by course error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const updateEnrollmentProgress = async (req: Request, res: Response): Promise<void> => {
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

    const { courseId } = req.params;
    const courseIdNum = Number(courseId);
    if (isNaN(courseIdNum)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const course = await CourseModel.findById(courseIdNum);
    if (!course || !course.is_active) {
      sendError(res, 'This course is not available', 403);
      return;
    }

    const { completed_lessons } = req.body;
    if (!Array.isArray(completed_lessons)) {
      sendError(res, 'completed_lessons must be an array of module IDs', 400);
      return;
    }

    const completedLessons = completed_lessons.map((id: any) => String(id));
    const totalModules = req.body.total_modules as number | undefined;
    const progressPercentage = totalModules && totalModules > 0
      ? Math.round((completedLessons.length / totalModules) * 100)
      : 0;

    const updated = await EnrollmentModel.updateProgress(
      user.userId,
      courseIdNum,
      Math.min(100, progressPercentage),
      completedLessons
    );

    if (!updated) {
      sendError(res, 'Not enrolled in this course', 404);
      return;
    }

    sendSuccess(res, {
      progress_percentage: updated.progress_percentage,
      completed_lessons: updated.completed_lessons ?? [],
      completed_at: updated.completed_at,
    }, 'Progress updated');
  } catch (error) {
    console.error('Update enrollment progress error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

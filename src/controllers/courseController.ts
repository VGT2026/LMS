import { Request, Response } from 'express';
import { sendSuccess, sendError, sendPagination } from '../utils/response';
import { CourseModel } from '../models/Course';
import { UserModel } from '../models/User';
import { EnrollmentModel } from '../models/Enrollment';
import { Course } from '../types';
import { parsePageLimit } from '../utils/queryParse';

export const getAllCourses = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page: qPage, limit: qLimit, category, instructor_id, is_active, include_inactive, search } =
      req.query;

    const { page, limit } = parsePageLimit(qPage, qLimit);
    const options: Record<string, unknown> = { page, limit };

    const catRaw = Array.isArray(category) ? category[0] : category;
    if (typeof catRaw === 'string' && catRaw.trim()) {
      options.category = catRaw.trim();
    }

    const instrRaw = Array.isArray(instructor_id) ? instructor_id[0] : instructor_id;
    if (instrRaw !== undefined && instrRaw !== '' && typeof instrRaw === 'string') {
      const n = Number(instrRaw);
      if (Number.isFinite(n) && n > 0) {
        options.instructor_id = n;
      }
    } else if (typeof instrRaw === 'number' && Number.isFinite(instrRaw) && instrRaw > 0) {
      options.instructor_id = instrRaw;
    }

    const incRaw = Array.isArray(include_inactive) ? include_inactive[0] : include_inactive;
    if (incRaw !== undefined) {
      options.include_inactive = incRaw === 'true';
    }

    const activeRaw = Array.isArray(is_active) ? is_active[0] : is_active;
    if (activeRaw !== undefined) {
      options.is_active = activeRaw === 'true';
    }

    const searchRaw = Array.isArray(search) ? search[0] : search;
    if (typeof searchRaw === 'string' && searchRaw.trim()) {
      options.search = searchRaw.trim();
    }

    const result = await CourseModel.findAll(options as Parameters<typeof CourseModel.findAll>[0]);

    sendPagination(res, result.courses, result.page, result.limit, result.total, 'Courses retrieved successfully');
  } catch (error) {
    console.error('Get all courses error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getCourseById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const courseId = Number(id);

    if (isNaN(courseId)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const course = await CourseModel.findByIdWithModules(courseId);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    // Students and unauthenticated users cannot access deactivated courses
    if (!course.is_active) {
      const user = req.user;
      const instructorId = (course as any).instructor_id;
      if (!user) {
        sendError(res, 'This course is not available', 403);
        return;
      }
      if (user.role === 'student') {
        sendError(res, 'This course is not available', 403);
        return;
      }
      if (user.role === 'instructor' && instructorId !== user.userId) {
        sendError(res, 'This course is not available', 403);
        return;
      }
    }

    sendSuccess(res, course, 'Course retrieved successfully');
  } catch (error) {
    console.error('Get course by ID error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const createCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const { title, description, instructor_id: instructorIdParam, instructor_name, category, thumbnail, duration, price, level }: {
      title: string;
      description?: string;
      instructor_id?: number | string;
      instructor_name?: string;
      category: string;
      thumbnail?: string;
      duration?: string;
      price?: number;
      level?: 'beginner' | 'intermediate' | 'advanced';
    } = req.body;

    if (!title || !category) {
      sendError(res, 'Title and category are required', 400);
      return;
    }

    // Trim category to prevent whitespace issues
    const trimmedCategory = String(category).trim();
    if (!trimmedCategory) {
      sendError(res, 'Category cannot be empty or just whitespace', 400);
      return;
    }

    let instructor_id: number;

    if (user.role === 'instructor') {
      instructor_id = user.userId;
    } else if (user.role === 'admin') {
      if (instructorIdParam != null) {
        const parsed = typeof instructorIdParam === 'number' ? instructorIdParam : parseInt(String(instructorIdParam));
        if (isNaN(parsed)) {
          sendError(res, 'Invalid instructor ID', 400);
          return;
        }
        instructor_id = parsed;
      } else if (instructor_name && typeof instructor_name === 'string') {
        const instructors = await UserModel.findByRole('instructor');
        const match = instructors.find(u => u.name === instructor_name);
        if (!match) {
          sendError(res, 'Instructor not found. Please select a valid instructor.', 400);
          return;
        }
        instructor_id = match.id!;
      } else {
        sendError(res, 'Instructor is required. Please select an instructor.', 400);
        return;
      }
    } else {
      sendError(res, 'Access denied.', 403);
      return;
    }

    const instructor = await UserModel.findById(instructor_id);
    if (!instructor || instructor.role !== 'instructor') {
      sendError(res, 'Invalid instructor. Please select a valid instructor.', 400);
      return;
    }
    if (!instructor.is_active) {
      sendError(res, 'Selected instructor is inactive. Please choose an active instructor.', 400);
      return;
    }

    const courseData = {
      title,
      description,
      instructor_id,
      category: trimmedCategory,
      thumbnail,
      duration: duration || '8 weeks',
      price: price ?? 0,
      level: level || 'beginner',
      is_active: false, // draft until published
      approval_status: user.role === 'instructor' ? 'pending' : 'approved', // instructor-created needs admin approval
    } as Omit<Course, 'id' | 'created_at' | 'updated_at' | 'instructor'>;

    const newCourse = await CourseModel.create(courseData);

    sendSuccess(res, newCourse, 'Course created successfully', 201);
  } catch (error) {
    console.error('Create course error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const { id } = req.params;
    const courseId = Number(id);

    if (isNaN(courseId)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const existingCourse = await CourseModel.findById(courseId);
    if (!existingCourse) {
      sendError(res, 'Course not found', 404);
      return;
    }

    let updates: Partial<Course> = req.body;

    // Instructors can only update their own DRAFT courses (title, description, category, thumbnail) within 15 days
    if (user.role === 'instructor') {
      if (existingCourse.instructor_id !== user.userId) {
        sendError(res, 'You can only edit your own courses', 403);
        return;
      }
      if (existingCourse.is_active) {
        sendError(res, 'Cannot edit published course. Only draft courses can be edited by instructor.', 403);
        return;
      }
      const created = new Date((existingCourse as any).created_at).getTime();
      const daysSinceCreation = (Date.now() - created) / (1000 * 60 * 60 * 24);
      if (daysSinceCreation > 15) {
        sendError(res, 'Course cannot be edited after 15 days. The edit window has expired.', 403);
        return;
      }
      const { instructor_id, is_active, ...instructorAllowed } = updates as any;
      updates = instructorAllowed;
    }

    const updatedCourse = await CourseModel.update(courseId, updates);
    if (!updatedCourse) {
      sendError(res, 'Course not found', 404);
      return;
    }

    sendSuccess(res, updatedCourse, 'Course updated successfully');
  } catch (error) {
    console.error('Update course error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const assignInstructor = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only admin can assign instructors to courses
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const { id } = req.params;
    const courseId = Number(id);

    if (isNaN(courseId)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const { instructor_id }: { instructor_id: number | null } = req.body;

    // Validate instructor exists if provided
    if (instructor_id) {
      const instructor = await UserModel.findById(instructor_id);
      if (!instructor || instructor.role !== 'instructor') {
        sendError(res, 'Invalid instructor ID', 400);
        return;
      }
    }

    const updatedCourse = await CourseModel.assignInstructor(courseId, instructor_id);
    if (!updatedCourse) {
      sendError(res, 'Course not found', 404);
      return;
    }

    sendSuccess(res, updatedCourse, 'Instructor assigned successfully');
  } catch (error) {
    console.error('Assign instructor error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const approveCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const { id } = req.params;
    const courseId = Number(id);
    const { status }: { status: 'approved' | 'rejected' } = req.body;

    if (isNaN(courseId)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }
    if (!status || !['approved', 'rejected'].includes(status)) {
      sendError(res, 'Status must be "approved" or "rejected"', 400);
      return;
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    const updatedCourse = await CourseModel.update(courseId, { approval_status: status });
    if (!updatedCourse) {
      sendError(res, 'Failed to update course approval', 500);
      return;
    }

    sendSuccess(res, updatedCourse, status === 'approved' ? 'Course approved. Instructor can now add modules.' : 'Course rejected.');
  } catch (error) {
    console.error('Approve course error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const publishCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const { id } = req.params;
    const courseId = Number(id);

    if (isNaN(courseId)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    if (user.role === 'instructor') {
      if (course.instructor_id !== user.userId) {
        sendError(res, 'You can only publish your own courses', 403);
        return;
      }
      if (course.is_active) {
        sendError(res, 'Course is already published', 400);
        return;
      }
      if (course.approval_status !== 'approved') {
        sendError(res, 'Course must be approved by an admin before publishing', 403);
        return;
      }
    }

    const updatedCourse = await CourseModel.update(courseId, { is_active: true });
    if (!updatedCourse) {
      sendError(res, 'Failed to publish course', 500);
      return;
    }

    sendSuccess(res, updatedCourse, 'Course published successfully');
  } catch (error) {
    console.error('Publish course error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const unpublishCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const { id } = req.params;
    const courseId = Number(id);

    if (isNaN(courseId)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const updatedCourse = await CourseModel.update(courseId, { is_active: false });
    if (!updatedCourse) {
      sendError(res, 'Failed to unpublish course', 500);
      return;
    }

    sendSuccess(res, updatedCourse, 'Course unpublished (draft) successfully');
  } catch (error) {
    console.error('Unpublish course error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const enrollInCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      sendError(res, 'Only students can enroll in courses', 403);
      return;
    }

    const { id } = req.params;
    const courseId = Number(id);

    if (isNaN(courseId)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    if (!course.is_active) {
      sendError(res, 'Course is not published. Enrollment is only available for published courses.', 400);
      return;
    }

    const existing = await EnrollmentModel.findByUserAndCourse(user.userId, courseId);
    if (existing) {
      sendError(res, 'You are already enrolled in this course', 400);
      return;
    }

    const enrollment = await EnrollmentModel.create(user.userId, courseId);
    if (!enrollment) {
      sendError(res, 'Failed to enroll in course', 500);
      return;
    }

    sendSuccess(res, { enrollment, course }, 'Successfully enrolled in course');
  } catch (error) {
    console.error('Enroll in course error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const toggleCourseStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const { id } = req.params;
    const courseId = Number(id);

    if (isNaN(courseId)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }

    const course = await CourseModel.findById(courseId);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    const newStatus = !course.is_active;
    const updatedCourse = await CourseModel.update(courseId, {
      is_active: newStatus,
      // Sync approval_status with active state so instructors can add modules when course is enabled
      approval_status: newStatus ? 'approved' : 'rejected',
    });

    if (!updatedCourse) {
      sendError(res, 'Failed to update course status', 500);
      return;
    }

    sendSuccess(res, updatedCourse, `Course ${newStatus ? 'published' : 'unpublished'} successfully`);
  } catch (error) {
    console.error('Toggle course status error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getInstructors = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only admin can view instructors list
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const instructors = await UserModel.findByRole('instructor');

    // Return instructors without passwords
    const instructorsWithoutPasswords = instructors.map(instructor => {
      const { password, ...instructorWithoutPassword } = instructor;
      return instructorWithoutPassword;
    });

    sendSuccess(res, instructorsWithoutPasswords, 'Instructors retrieved successfully');
  } catch (error) {
    console.error('Get instructors error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getAllCategories = async (req: Request, res: Response): Promise<void> => {
  try {
    const categories = await CourseModel.getAllCategories();

    sendSuccess(res, categories, 'Categories retrieved successfully');
  } catch (error) {
    console.error('Get categories error:', error);
    sendError(res, 'Internal server error', 500);
  }
};
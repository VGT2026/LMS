import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { CourseModel } from '../models/Course';
import { ModuleModel } from '../models/Module';
import { LessonModel } from '../models/Lesson';

const EDIT_WINDOW_DAYS = 15;

const ensureInstructorCanEditCourse = async (req: Request, courseId: number): Promise<string | null> => {
  const user = req.user;
  if (!user) return 'Authentication required';
  const course = await CourseModel.findById(courseId);
  if (!course) return 'Course not found';
  if (user.role === 'admin') return null;
  if (user.role !== 'instructor') return 'Instructor access required';
  if (course.instructor_id !== user.userId) return 'You can only edit your own courses';
  const created = new Date((course as any).created_at).getTime();
  const now = Date.now();
  const daysSinceCreation = (now - created) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation > EDIT_WINDOW_DAYS) {
    return `Course cannot be edited after ${EDIT_WINDOW_DAYS} days. The edit window has expired.`;
  }
  return null;
};

const ensureCourseApprovedForModules = async (courseId: number): Promise<string | null> => {
  const course = await CourseModel.findById(courseId);
  if (!course) return 'Course not found';
  if (course.approval_status !== 'approved') {
    return 'This course is pending admin approval. You can add modules and lessons after the course is approved.';
  }
  return null;
};

export const getModulesByCourse = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const id = Number(courseId);
    if (isNaN(id)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }
    const modules = await ModuleModel.findByCourseId(id);
    sendSuccess(res, modules, 'Modules retrieved');
  } catch (error) {
    console.error('Get modules error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const createModule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { courseId } = req.params;
    const id = Number(courseId);
    if (isNaN(id)) {
      sendError(res, 'Invalid course ID', 400);
      return;
    }
    const err = await ensureInstructorCanEditCourse(req, id);
    if (err) {
      sendError(res, err, 403);
      return;
    }
    const approvalErr = await ensureCourseApprovedForModules(id);
    if (approvalErr) {
      sendError(res, approvalErr, 403);
      return;
    }
    const { title, description, pdf_url, order_index } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      sendError(res, 'Module title is required', 400);
      return;
    }
    const module = await ModuleModel.create(id, { title: title.trim(), description: description?.trim(), pdf_url: pdf_url?.trim(), order_index });
    sendSuccess(res, module, 'Module created', 201);
  } catch (error) {
    console.error('Create module error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const updateModule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { moduleId } = req.params;
    const id = Number(moduleId);
    if (isNaN(id)) {
      sendError(res, 'Invalid module ID', 400);
      return;
    }
    const courseId = await ModuleModel.getCourseId(id);
    if (!courseId) {
      sendError(res, 'Module not found', 404);
      return;
    }
    const err = await ensureInstructorCanEditCourse(req, courseId);
    if (err) {
      sendError(res, err, 403);
      return;
    }
    const { title, description, pdf_url, order_index } = req.body;
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (pdf_url !== undefined) updates.pdf_url = pdf_url;
    if (order_index !== undefined) updates.order_index = order_index;
    const module = await ModuleModel.update(id, updates);
    if (!module) {
      sendError(res, 'Module not found', 404);
      return;
    }
    sendSuccess(res, module, 'Module updated');
  } catch (error) {
    console.error('Update module error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const deleteModule = async (req: Request, res: Response): Promise<void> => {
  try {
    const { moduleId } = req.params;
    const id = Number(moduleId);
    if (isNaN(id)) {
      sendError(res, 'Invalid module ID', 400);
      return;
    }
    const courseId = await ModuleModel.getCourseId(id);
    if (!courseId) {
      sendError(res, 'Module not found', 404);
      return;
    }
    const err = await ensureInstructorCanEditCourse(req, courseId);
    if (err) {
      sendError(res, err, 403);
      return;
    }
    await ModuleModel.delete(id);
    sendSuccess(res, { deleted: true }, 'Module deleted');
  } catch (error) {
    console.error('Delete module error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const createLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { moduleId } = req.params;
    const id = Number(moduleId);
    if (isNaN(id)) {
      sendError(res, 'Invalid module ID', 400);
      return;
    }
    const courseId = await ModuleModel.getCourseId(id);
    if (!courseId) {
      sendError(res, 'Module not found', 404);
      return;
    }
    const err = await ensureInstructorCanEditCourse(req, courseId);
    if (err) {
      sendError(res, err, 403);
      return;
    }
    const approvalErr = await ensureCourseApprovedForModules(courseId);
    if (approvalErr) {
      sendError(res, approvalErr, 403);
      return;
    }
    const { title, content, video_url, pdf_url, duration, is_free, order_index } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      sendError(res, 'Lesson title is required', 400);
      return;
    }
    const lesson = await LessonModel.create(id, {
      title: title.trim(),
      content: content?.trim(),
      video_url: video_url?.trim() || undefined,
      pdf_url: pdf_url?.trim() || undefined,
      duration: duration ? Number(duration) : undefined,
      is_free: is_free ?? false,
      order_index,
    });
    sendSuccess(res, lesson, 'Lesson created', 201);
  } catch (error) {
    console.error('Create lesson error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const updateLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.params;
    const id = Number(lessonId);
    if (isNaN(id)) {
      sendError(res, 'Invalid lesson ID', 400);
      return;
    }
    const moduleId = await LessonModel.getModuleId(id);
    if (!moduleId) {
      sendError(res, 'Lesson not found', 404);
      return;
    }
    const courseId = await ModuleModel.getCourseId(moduleId);
    if (!courseId) {
      sendError(res, 'Course not found', 404);
      return;
    }
    const err = await ensureInstructorCanEditCourse(req, courseId);
    if (err) {
      sendError(res, err, 403);
      return;
    }
    const { title, content, video_url, pdf_url, duration, is_free, order_index } = req.body;
    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (video_url !== undefined) updates.video_url = video_url;
    if (pdf_url !== undefined) updates.pdf_url = pdf_url;
    if (duration !== undefined) updates.duration = duration;
    if (is_free !== undefined) updates.is_free = is_free;
    if (order_index !== undefined) updates.order_index = order_index;
    const lesson = await LessonModel.update(id, updates);
    if (!lesson) {
      sendError(res, 'Lesson not found', 404);
      return;
    }
    sendSuccess(res, lesson, 'Lesson updated');
  } catch (error) {
    console.error('Update lesson error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const deleteLesson = async (req: Request, res: Response): Promise<void> => {
  try {
    const { lessonId } = req.params;
    const id = Number(lessonId);
    if (isNaN(id)) {
      sendError(res, 'Invalid lesson ID', 400);
      return;
    }
    const moduleId = await LessonModel.getModuleId(id);
    if (!moduleId) {
      sendError(res, 'Lesson not found', 404);
      return;
    }
    const courseId = await ModuleModel.getCourseId(moduleId);
    if (!courseId) {
      sendError(res, 'Course not found', 404);
      return;
    }
    const err = await ensureInstructorCanEditCourse(req, courseId);
    if (err) {
      sendError(res, err, 403);
      return;
    }
    await LessonModel.delete(id);
    sendSuccess(res, { deleted: true }, 'Lesson deleted');
  } catch (error) {
    console.error('Delete lesson error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

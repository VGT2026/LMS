import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { QuizModel } from '../models/Quiz';
import { CourseModel } from '../models/Course';

/** GET /api/quizzes - List quizzes (student: enrolled courses; instructor: own courses) */
export const listQuizzes = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    let quizzes;
    if (user.role === 'student') {
      quizzes = await QuizModel.findForStudent(user.userId);
    } else if (user.role === 'instructor') {
      const courseId = req.query.courseId ? Number(req.query.courseId) : null;
      if (courseId) {
        const course = await CourseModel.findById(courseId);
        if (course && (course as any).instructor_id === user.userId) {
          quizzes = await QuizModel.findByCourse(courseId);
        } else {
          quizzes = [];
        }
      } else {
        const courses = await CourseModel.findByInstructor(user.userId);
        const all: any[] = [];
        for (const c of courses) {
          const list = await QuizModel.findByCourse(c.id!);
          all.push(...list);
        }
        quizzes = all.sort((a, b) => {
          const da = a.due_date ? new Date(a.due_date).getTime() : 9999999999999;
          const db = b.due_date ? new Date(b.due_date).getTime() : 9999999999999;
          return da - db;
        });
      }
    } else if (user.role === 'admin') {
      const { courseId } = req.query;
      if (courseId) {
        quizzes = await QuizModel.findByCourse(Number(courseId));
      } else {
        quizzes = [];
      }
    } else {
      quizzes = [];
    }

    sendSuccess(res, quizzes, 'Quizzes retrieved');
  } catch (err) {
    console.error('List quizzes error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** GET /api/quizzes/:id - Get quiz by ID */
export const getQuizById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      sendError(res, 'Invalid quiz ID', 400);
      return;
    }

    const quiz = await QuizModel.findById(id);
    if (!quiz) {
      sendError(res, 'Quiz not found', 404);
      return;
    }

    const user = req.user;
    if (user?.role === 'student') {
      const { questions_json: _q, ...safe } = quiz as any;
      sendSuccess(res, safe, 'Quiz retrieved');
      return;
    }

    sendSuccess(res, quiz, 'Quiz retrieved');
  } catch (err) {
    console.error('Get quiz error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/quizzes - Create quiz (instructor only) */
export const createQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      sendError(res, 'Instructor or admin access required', 403);
      return;
    }

    const { course_id, title, description, due_date, time_limit, total_points, passing_score } = req.body || {};

    if (!course_id || !title) {
      sendError(res, 'course_id and title are required', 400);
      return;
    }

    const course = await CourseModel.findById(course_id);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    if (user.role === 'instructor' && course.instructor_id !== user.userId) {
      sendError(res, 'You can only add quizzes to your own courses', 403);
      return;
    }

    const quiz = await QuizModel.create({
      course_id,
      title,
      description,
      due_date: due_date || null,
      time_limit: time_limit ?? 30,
      total_points: total_points ?? 100,
      passing_score: passing_score ?? 60,
    });

    sendSuccess(res, quiz, 'Quiz created', 201);
  } catch (err) {
    console.error('Create quiz error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** PATCH /api/quizzes/:id - Update quiz (instructor only) */
export const updateQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      sendError(res, 'Instructor or admin access required', 403);
      return;
    }

    const id = Number(req.params.id);
    if (isNaN(id)) {
      sendError(res, 'Invalid quiz ID', 400);
      return;
    }

    const existing = await QuizModel.findById(id);
    if (!existing) {
      sendError(res, 'Quiz not found', 404);
      return;
    }

    const course = await CourseModel.findById(existing.course_id);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    if (user.role === 'instructor' && course.instructor_id !== user.userId) {
      sendError(res, 'You can only edit quizzes in your own courses', 403);
      return;
    }

    const {
      title,
      description,
      due_date,
      time_limit,
      total_points,
      passing_score,
      is_active,
      available_from,
      available_until,
      questions_json,
    } = req.body || {};

    const quiz = await QuizModel.update(id, {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(due_date !== undefined && { due_date }),
      ...(time_limit !== undefined && { time_limit }),
      ...(total_points !== undefined && { total_points }),
      ...(passing_score !== undefined && { passing_score }),
      ...(is_active !== undefined && { is_active }),
      ...(available_from !== undefined && { available_from }),
      ...(available_until !== undefined && { available_until }),
      ...(questions_json !== undefined && { questions_json }),
    });

    sendSuccess(res, quiz, 'Quiz updated');
  } catch (err) {
    console.error('Update quiz error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** DELETE /api/quizzes/:id - Delete quiz (instructor only) */
export const deleteQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      sendError(res, 'Instructor or admin access required', 403);
      return;
    }

    const id = Number(req.params.id);
    if (isNaN(id)) {
      sendError(res, 'Invalid quiz ID', 400);
      return;
    }

    const existing = await QuizModel.findById(id);
    if (!existing) {
      sendError(res, 'Quiz not found', 404);
      return;
    }

    const course = await CourseModel.findById(existing.course_id);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    if (user.role === 'instructor' && course.instructor_id !== user.userId) {
      sendError(res, 'You can only delete quizzes from your own courses', 403);
      return;
    }

    await QuizModel.delete(id);
    sendSuccess(res, null, 'Quiz deleted');
  } catch (err) {
    console.error('Delete quiz error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { sendSuccess, sendError } from '../utils/response';
import { QuizModel } from '../models/Quiz';
import { QuizAttemptModel } from '../models/QuizAttempt';
import { EnrollmentModel } from '../models/Enrollment';

type QuizQuestion = {
  id: string;
  prompt?: string;
  question?: string;
  options?: string[];
  correct?: number;
  type?: 'multiple_choice' | 'short_answer';
  points?: number;
};

/**
 * Grade quiz answers - local implementation
 * Calculates score based on correct answers
 */
async function gradeQuizAnswers(
  questions: QuizQuestion[],
  answers: Record<string, any>,
  totalPoints: number
): Promise<{ score: number; correct_count: number; wrong_count: number }> {
  let correct = 0;
  let wrong = 0;
  let earned = 0;

  for (const q of questions) {
    const sel = answers[q.id];
    const pts = q.points ?? 1;
    
    if (sel === undefined || sel === null) {
      wrong += 1;
    } else if (q.correct !== undefined && q.correct !== null && Number(sel) === Number(q.correct)) {
      correct += 1;
      earned += pts;
    } else {
      wrong += 1;
    }
  }

  const score = earned;
  return { score, correct_count: correct, wrong_count: wrong };
}

function parseQuestions(raw: unknown): QuizQuestion[] {
  if (raw == null) return [];
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try {
      arr = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(arr)) return [];
  return arr.map((q: any, i: number) => ({
    id: String(q.id ?? i + 1),
    prompt: q.prompt ?? q.question ?? '',
    question: q.question,
    options: Array.isArray(q.options) ? q.options : [],
    correct: Number(q.correct ?? q.correct_answer ?? q.correctAnswer ?? 0),
    type: q.type ?? 'multiple_choice',
    points: q.points != null ? Number(q.points) : 1,
  }));
}

function sanitizeQuestions(questions: QuizQuestion[]) {
  return questions.map((q) => ({
    id: q.id,
    prompt: q.prompt || q.question || '',
    options: q.options,
    points: q.points ?? 1,
  }));
}

function inTimeWindow(availableFrom: Date | string | null | undefined, availableUntil: Date | string | null | undefined): boolean {
  const now = Date.now();
  if (availableFrom) {
    const t = new Date(availableFrom).getTime();
    if (!Number.isNaN(t) && now < t) return false;
  }
  if (availableUntil) {
    const t = new Date(availableUntil).getTime();
    if (!Number.isNaN(t) && now > t) return false;
  }
  return true;
}

export async function expireStaleQuizAttempt(quizId: number, userId: number): Promise<void> {
  const quiz = await QuizModel.findById(quizId);
  if (!quiz) return;
  const active = await QuizAttemptModel.findActiveByQuizAndUser(quizId, userId);
  if (!active || active.submitted_at) return;
  const started = new Date(active.started_at).getTime();
  const endsMs = started + (quiz.time_limit ?? 30) * 60 * 1000;
  if (Date.now() <= endsMs) return;
  const questions = parseQuestions(quiz.questions_json);
  let answers: Record<string, any> = {};
  try {
    const raw = active.answers_json;
    answers = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, any>) || {};
  } catch {
    answers = {};
  }

  // Use AI-powered grading
  console.log(`[Quiz] Auto-submitting expired attempt ${active.id} using AI grading...`);
  const gradingResult = await gradeQuizAnswers(questions, answers, quiz.total_points ?? 100);

  await QuizAttemptModel.appendLog(active.id!, {
    t: new Date().toISOString(),
    type: 'auto_submit',
    detail: 'time_expired_ai_graded',
  });
  await QuizAttemptModel.submit(active.id!, {
    score: gradingResult.score,
    correct_count: gradingResult.correct_count,
    wrong_count: gradingResult.wrong_count,
    answers,
  });
}

function gradeAttempt(questions: QuizQuestion[], answers: Record<string, number>) {
  let correct = 0;
  let wrong = 0;
  let earned = 0;
  for (const q of questions) {
    const sel = answers[q.id];
    const pts = q.points ?? 1;
    if (sel === undefined || sel === null) {
      wrong += 1;
    } else if (Number(sel) === Number(q.correct)) {
      correct += 1;
      earned += pts;
    } else {
      wrong += 1;
    }
  }
  return { correct, wrong, earned };
}

/** GET /api/quizzes/:id/exam — student: exam shell + sanitized questions (no correct), or resume */
export const getExamQuiz = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      sendError(res, 'Student access required', 403);
      return;
    }
    const quizId = Number(req.params.id);
    if (isNaN(quizId)) {
      sendError(res, 'Invalid quiz ID', 400);
      return;
    }

    const quiz = await QuizModel.findById(quizId);
    if (!quiz || !quiz.is_active) {
      sendError(res, 'Quiz not found', 404);
      return;
    }

    await expireStaleQuizAttempt(quizId, user.userId);

    const enr = await EnrollmentModel.findByUserAndCourse(user.userId, quiz.course_id);
    if (!enr) {
      sendError(res, 'You must be enrolled in this course to take the exam', 403);
      return;
    }

    if (!inTimeWindow(quiz.available_from as any, quiz.available_until as any)) {
      sendError(res, 'Exam is not available at this time', 403);
      return;
    }

    const questions = parseQuestions(quiz.questions_json);
    if (questions.length === 0) {
      sendError(res, 'This exam has no questions configured yet', 400);
      return;
    }

    let active = await QuizAttemptModel.findActiveByQuizAndUser(quizId, user.userId);
    const submitted = await QuizAttemptModel.findSubmittedByQuizAndUser(quizId, user.userId);

    const timeLimitMin = quiz.time_limit ?? 30;
    const serverNow = new Date().toISOString();

    let resume: { attemptId: number; answers: Record<string, number>; endsAt: string; startedAt: string } | null = null;
    if (active) {
      const started = new Date(active.started_at).getTime();
      const endsMs = started + timeLimitMin * 60 * 1000;
      if (Date.now() > endsMs) {
        await expireStaleQuizAttempt(quizId, user.userId);
        active = await QuizAttemptModel.findActiveByQuizAndUser(quizId, user.userId);
      }
    }
    if (active) {
      const started = new Date(active.started_at).getTime();
      const endsMs = started + timeLimitMin * 60 * 1000;
      if (Date.now() <= endsMs) {
        let answers: Record<string, number> = {};
        try {
          const raw = active.answers_json;
          answers = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, number>) || {};
        } catch {
          answers = {};
        }
        resume = {
          attemptId: active.id!,
          answers,
          endsAt: new Date(endsMs).toISOString(),
          startedAt: new Date(started).toISOString(),
        };
      }
    }

    sendSuccess(
      res,
      {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          course_title: quiz.course_title,
          course_id: quiz.course_id,
          time_limit_minutes: timeLimitMin,
          total_points: quiz.total_points,
          passing_score: quiz.passing_score,
          available_from: quiz.available_from,
          available_until: quiz.available_until,
        },
        questions: sanitizeQuestions(questions),
        serverTime: serverNow,
        resume,
        lastSubmitted: submitted
          ? {
              score: submitted.score,
              correct_count: submitted.correct_count,
              wrong_count: submitted.wrong_count,
              submitted_at: submitted.submitted_at,
            }
          : null,
      },
      'Exam data'
    );
  } catch (err) {
    console.error('getExamQuiz error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/quizzes/:id/start */
export const startQuizAttempt = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      sendError(res, 'Student access required', 403);
      return;
    }
    const quizId = Number(req.params.id);
    const tabLockId = typeof req.body?.tab_lock_id === 'string' ? req.body.tab_lock_id : null;

    const quiz = await QuizModel.findById(quizId);
    if (!quiz || !quiz.is_active) {
      sendError(res, 'Quiz not found', 404);
      return;
    }

    await expireStaleQuizAttempt(quizId, user.userId);

    const enr = await EnrollmentModel.findByUserAndCourse(user.userId, quiz.course_id);
    if (!enr) {
      sendError(res, 'You must be enrolled in this course', 403);
      return;
    }

    if (!inTimeWindow(quiz.available_from as any, quiz.available_until as any)) {
      sendError(res, 'Exam is not available at this time', 403);
      return;
    }

    const questions = parseQuestions(quiz.questions_json);
    if (questions.length === 0) {
      sendError(res, 'This exam has no questions', 400);
      return;
    }

    const existing = await QuizAttemptModel.findActiveByQuizAndUser(quizId, user.userId);
    if (existing) {
      if (tabLockId && existing.tab_lock_id && existing.tab_lock_id !== tabLockId) {
        sendError(res, 'Exam is already open in another tab or window', 409);
        return;
      }
      const timeLimitMin = quiz.time_limit ?? 30;
      const started = new Date(existing.started_at).getTime();
      const endsMs = started + timeLimitMin * 60 * 1000;
      if (Date.now() > endsMs) {
        sendError(res, 'Session expired', 400);
        return;
      }
      if (tabLockId && !existing.tab_lock_id) {
        await QuizAttemptModel.setTabLock(existing.id!, tabLockId);
      }
      await QuizAttemptModel.appendLog(existing.id!, {
        t: new Date().toISOString(),
        type: 'session_resume',
        detail: 'start endpoint called',
      });
      sendSuccess(
        res,
        {
          attemptId: existing.id,
          endsAt: new Date(endsMs).toISOString(),
          startedAt: new Date(started).toISOString(),
          serverTime: new Date().toISOString(),
        },
        'Attempt resumed'
      );
      return;
    }

    const prevSubmitted = await QuizAttemptModel.findSubmittedByQuizAndUser(quizId, user.userId);
    if (prevSubmitted) {
      sendError(res, 'You have already submitted this exam', 400);
      return;
    }

    const attempt = await QuizAttemptModel.create({
      quiz_id: quizId,
      user_id: user.userId,
      tab_lock_id: tabLockId,
      answers_json: {},
      logs_json: [{ t: new Date().toISOString(), type: 'exam_start', detail: 'timer_started' }],
    });

    if (!attempt) {
      sendError(res, 'Could not start attempt', 500);
      return;
    }

    const timeLimitMin = quiz.time_limit ?? 30;
    const started = new Date(attempt.started_at).getTime();
    const endsMs = started + timeLimitMin * 60 * 1000;

    await QuizAttemptModel.appendLog(attempt.id!, {
      t: new Date().toISOString(),
      type: 'exam_start',
      detail: 'attempt_created',
    });

    sendSuccess(
      res,
      {
        attemptId: attempt.id,
        endsAt: new Date(endsMs).toISOString(),
        startedAt: new Date(started).toISOString(),
        serverTime: new Date().toISOString(),
      },
      'Attempt started',
      201
    );
  } catch (err) {
    console.error('startQuizAttempt error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** PATCH /api/quiz-attempts/:id/save */
export const saveQuizAttempt = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      sendError(res, 'Student access required', 403);
      return;
    }
    const attemptId = Number(req.params.id);
    const answers = req.body?.answers;
    if (typeof answers !== 'object' || answers === null) {
      sendError(res, 'answers object required', 400);
      return;
    }

    const att = await QuizAttemptModel.findById(attemptId);
    if (!att || att.user_id !== user.userId) {
      sendError(res, 'Attempt not found', 404);
      return;
    }
    if (att.submitted_at) {
      sendError(res, 'Already submitted', 400);
      return;
    }

    await QuizAttemptModel.updateAnswers(attemptId, answers);
    sendSuccess(res, { saved: true }, 'Progress saved');
  } catch (err) {
    console.error('saveQuizAttempt error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/quiz-attempts/:id/submit */
export const submitQuizAttempt = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      sendError(res, 'Student access required', 403);
      return;
    }
    const attemptId = Number(req.params.id);
    const att = await QuizAttemptModel.findById(attemptId);
    if (!att || att.user_id !== user.userId) {
      sendError(res, 'Attempt not found', 404);
      return;
    }
    if (att.submitted_at) {
      sendError(res, 'Already submitted', 400);
      return;
    }

    const quiz = await QuizModel.findById(att.quiz_id);
    if (!quiz) {
      sendError(res, 'Quiz not found', 404);
      return;
    }

    const questions = parseQuestions(quiz.questions_json);
    let answers: Record<string, any> = {};
    try {
      const raw = req.body?.answers ?? att.answers_json;
      answers = typeof raw === 'string' ? JSON.parse(raw) : (raw as Record<string, any>) || {};
    } catch {
      answers = {};
    }

    // Use AI-powered grading
    console.log(`[Quiz] Grading attempt ${attemptId} for quiz ${att.quiz_id} using AI...`);
    const gradingResult = await gradeQuizAnswers(questions, answers, quiz.total_points ?? 100);

    await QuizAttemptModel.appendLog(attemptId, {
      t: new Date().toISOString(),
      type: 'submit',
      detail: 'ai_graded',
    });

    const out = await QuizAttemptModel.submit(attemptId, {
      score: gradingResult.score,
      correct_count: gradingResult.correct_count,
      wrong_count: gradingResult.wrong_count,
      answers,
    });

    sendSuccess(
      res,
      {
        result: {
          score: gradingResult.score,
          correct_count: gradingResult.correct_count,
          wrong_count: gradingResult.wrong_count,
          passing_score: quiz.passing_score,
          submitted_at: out?.submitted_at,
        },
        review: questions.map((q) => ({
          id: q.id,
          prompt: q.prompt || q.question,
          type: q.type || 'multiple_choice',
          options: q.options,
          correctIndex: q.correct,
          selectedIndex: answers[q.id],
          isCorrect: Number(answers[q.id]) === Number(q.correct),
        })),
      },
      'Submitted'
    );
  } catch (err) {
    console.error('submitQuizAttempt error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/quiz-attempts/:id/log */
export const appendExamLog = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      sendError(res, 'Student access required', 403);
      return;
    }
    const attemptId = Number(req.params.id);
    const { type, detail } = req.body || {};
    if (!type || typeof type !== 'string') {
      sendError(res, 'type required', 400);
      return;
    }

    const att = await QuizAttemptModel.findById(attemptId);
    if (!att || att.user_id !== user.userId) {
      sendError(res, 'Attempt not found', 404);
      return;
    }
    if (att.submitted_at) {
      sendError(res, 'Already submitted', 400);
      return;
    }

    await QuizAttemptModel.appendLog(attemptId, {
      t: new Date().toISOString(),
      type: String(type).slice(0, 64),
      detail: detail != null ? String(detail).slice(0, 500) : undefined,
    });
    sendSuccess(res, { ok: true }, 'Logged');
  } catch (err) {
    console.error('appendExamLog error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/quiz-attempts/:id/proctor-frame — multipart image */
export const uploadProctorFrame = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      sendError(res, 'Student access required', 403);
      return;
    }
    const attemptId = Number(req.params.id);
    const att = await QuizAttemptModel.findById(attemptId);
    if (!att || att.user_id !== user.userId) {
      sendError(res, 'Attempt not found', 404);
      return;
    }
    if (att.submitted_at) {
      sendError(res, 'Already submitted', 400);
      return;
    }

    const file = (req as { file?: { filename: string } }).file;
    if (!file) {
      sendError(res, 'No image file', 400);
      return;
    }

    const rel = `/uploads/quiz-proctor/${attemptId}/${file.filename}`;
    await QuizAttemptModel.appendLog(attemptId, {
      t: new Date().toISOString(),
      type: 'proctor_snapshot',
      detail: rel,
    });

    sendSuccess(res, { path: rel }, 'Snapshot stored');
  } catch (err) {
    console.error('uploadProctorFrame error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/**
 * GET /api/quiz-attempts/my
 * Return all submitted quiz attempts for the authenticated student
 */
export const getMyQuizAttempts = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const attempts = await QuizAttemptModel.findByUser(userId);
    sendSuccess(res, attempts, 'Quiz attempts retrieved');
  } catch (err) {
    console.error('getMyQuizAttempts error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

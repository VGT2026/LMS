import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { AssignmentModel } from '../models/Assignment';
import { SubmissionModel } from '../models/Submission';
import { CourseModel } from '../models/Course';

/** GET /api/assignments - List assignments for current user (student: enrolled courses only; instructor: own courses) */
export const listAssignments = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    let assignments;
    if (user.role === 'student') {
      assignments = await AssignmentModel.findForStudent(user.userId);
    } else if (user.role === 'instructor') {
      const courses = await CourseModel.findByInstructor(user.userId);
      const all: any[] = [];
      for (const c of courses) {
        const list = await AssignmentModel.findByCourse(c.id!);
        all.push(...list);
      }
      assignments = all.sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
    } else if (user.role === 'admin') {
      const { courseId } = req.query;
      if (courseId) {
        assignments = await AssignmentModel.findByCourse(Number(courseId));
      } else {
        assignments = [];
      }
    } else {
      assignments = [];
    }

    sendSuccess(res, assignments, 'Assignments retrieved');
  } catch (err) {
    console.error('List assignments error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** GET /api/assignments/:id - Get assignment by ID */
export const getAssignmentById = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const id = Number(req.params.id);
    if (isNaN(id)) {
      sendError(res, 'Invalid assignment ID', 400);
      return;
    }

    const assignment = await AssignmentModel.findById(id);
    if (!assignment) {
      sendError(res, 'Assignment not found', 404);
      return;
    }

    if (user.role === 'student' && !assignment.is_published) {
      sendError(res, 'This assignment is not yet published', 403);
      return;
    }

    sendSuccess(res, assignment, 'Assignment retrieved');
  } catch (err) {
    console.error('Get assignment error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/assignments - Create assignment (instructor only) */
export const createAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      sendError(res, 'Instructor or admin access required', 403);
      return;
    }

    const { course_id, title, description, due_date, max_points, questions } = req.body || {};

    if (!course_id || !title || !due_date) {
      sendError(res, 'course_id, title, and due_date are required', 400);
      return;
    }

    const courseId = Number(course_id);
    const course = await CourseModel.findById(courseId);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }

    if (user.role === 'instructor' && course.instructor_id !== user.userId) {
      sendError(res, 'You can only create assignments for your own courses', 403);
      return;
    }

    const assignment = await AssignmentModel.create({
      course_id: courseId,
      title: String(title).trim(),
      description: description ? String(description).trim() : undefined,
      due_date: new Date(due_date),
      max_points: max_points != null ? Number(max_points) : 100,
      questions: Array.isArray(questions) ? questions : undefined,
    });

    sendSuccess(res, assignment, 'Assignment created (draft)', 201);
  } catch (err) {
    console.error('Create assignment error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** PATCH /api/assignments/:id/publish - Publish assignment (instructor only) */
export const publishAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      sendError(res, 'Instructor or admin access required', 403);
      return;
    }

    const id = Number(req.params.id);
    if (isNaN(id)) {
      sendError(res, 'Invalid assignment ID', 400);
      return;
    }

    const assignment = await AssignmentModel.findById(id);
    if (!assignment) {
      sendError(res, 'Assignment not found', 404);
      return;
    }

    const course = await CourseModel.findById(assignment.course_id);
    if (!course) {
      sendError(res, 'Course not found', 404);
      return;
    }
    if (user.role === 'instructor' && course.instructor_id !== user.userId) {
      sendError(res, 'You can only publish assignments for your own courses', 403);
      return;
    }

    const updated = await AssignmentModel.update(id, { is_published: true });
    sendSuccess(res, updated, 'Assignment published');
  } catch (err) {
    console.error('Publish assignment error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/assignments/:id/submit - Submit assignment (student only) */
export const submitAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || user.role !== 'student') {
      sendError(res, 'Student access required', 403);
      return;
    }

    const id = Number(req.params.id);
    if (isNaN(id)) {
      sendError(res, 'Invalid assignment ID', 400);
      return;
    }

    const { content } = req.body || {};
    if (!content || typeof content !== 'string') {
      sendError(res, 'content (JSON string of answers) is required', 400);
      return;
    }

    const assignment = await AssignmentModel.findById(id);
    if (!assignment) {
      sendError(res, 'Assignment not found', 404);
      return;
    }
    if (!assignment.is_published) {
      sendError(res, 'This assignment is not yet published', 403);
      return;
    }

    const existing = await SubmissionModel.findByAssignmentAndUser(id, user.userId);
    if (existing) {
      sendError(res, 'You have already submitted this assignment', 400);
      return;
    }

    console.log(`[ASSIGNMENT SUBMIT] user=${user.userId} assignment=${id} contentLen=${content.length}`);

    const submission = await SubmissionModel.create(id, user.userId, content);
    if (!submission) {
      console.error('Submit assignment error: failed to create submission record', { userId: user.userId, assignmentId: id });
      sendError(res, 'Unable to record submission', 500);
      return;
    }

    let gradedSubmission = submission;
    let aiGrade: number | null = null;
    let aiFeedback: string | null = null;

    try {
      // For MCQ assignments with questions JSON, auto-grade by comparing answers
      const mcqResult = gradeMCQAssignment(assignment, content);
      if (mcqResult) {
        aiGrade = mcqResult.grade;
        aiFeedback = mcqResult.feedback;
        const updated = await SubmissionModel.updateGrade(submission.id, aiGrade, aiFeedback, null);
        if (updated) gradedSubmission = updated;
      } else {
        // Fallback to AI grading for non-MCQ assignments
        const gradingResult = await gradeAssignmentWithAI(assignment, content);
        if (gradingResult) {
          aiGrade = gradingResult.grade;
          aiFeedback = gradingResult.feedback;
          const updated = await SubmissionModel.updateGrade(submission.id, aiGrade, aiFeedback, null);
          if (updated) gradedSubmission = updated;
        }
      }
    } catch (gradeErr) {
      console.error('Grading failed:', gradeErr);
    }

    sendSuccess(res, {
      ...(gradedSubmission || submission),
      aiGrade,
      aiFeedback,
    }, 'Assignment submitted', 201);
  } catch (err) {
    console.error('Submit assignment error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/**
 * Auto-grade MCQ assignments by comparing student answers to correctOption.
 * Returns null if the assignment doesn't have questions JSON.
 */
function gradeMCQAssignment(assignment: any, submissionContent: string): { grade: number; feedback: string } | null {
  let questions: any[];
  try {
    questions = typeof assignment.questions === 'string'
      ? JSON.parse(assignment.questions)
      : assignment.questions;
  } catch {
    return null;
  }
  if (!Array.isArray(questions) || questions.length === 0) return null;

  // Check that at least some questions have correctOption (MCQ format)
  const mcqQuestions = questions.filter(q => q.correctOption != null);
  if (mcqQuestions.length === 0) return null;

  let answers: Record<string, string>;
  try {
    answers = typeof submissionContent === 'string' ? JSON.parse(submissionContent) : submissionContent;
  } catch {
    return null;
  }
  if (!answers || typeof answers !== 'object') return null;

  let totalPoints = 0;
  let earnedPoints = 0;
  let correct = 0;
  let wrong = 0;

  for (const q of mcqQuestions) {
    const pts = Number(q.points) || 10;
    totalPoints += pts;
    const studentAnswer = answers[q.id];
    if (studentAnswer != null && Number(studentAnswer) === Number(q.correctOption)) {
      earnedPoints += pts;
      correct++;
    } else {
      wrong++;
    }
  }

  const percentage = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0;

  return { grade: percentage, feedback: '' };
}

async function gradeAssignmentWithAI(assignment: any, submissionContent: string): Promise<{grade: number; feedback: string} | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn('[AI GRADER] OPENAI_API_KEY is missing; skipping AI grading.');
    return null;
  }

  const maxPoints = assignment.max_points || 100;
  const requestPayload = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an expert teacher grading student assignment submissions with fairness and clarity.' },
      {
        role: 'user',
        content: `Grade this student assignment.
Assignment Title: ${assignment.title}
Description: ${assignment.description || 'N/A'}
Max Points: ${maxPoints}
Submission:
${submissionContent}

Return only valid JSON in this exact format: {"score":<0-100>,"feedback":"..."}.`
      }
    ],
    temperature: 0.2,
    max_tokens: 400,
  };

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestPayload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI grading error: ${response.status} ${text}`);
  }

  const data = await response.json() as any;
  const aiOutput = data?.choices?.[0]?.message?.content || '';

  let result;
  try {
    result = JSON.parse(aiOutput.trim());
  } catch (parseErr) {
    throw new Error(`Failed to parse AI grading output as JSON: ${aiOutput}`);
  }

  const score = Number(result.score);
  if (Number.isNaN(score)) {
    throw new Error(`Invalid score from AI: ${result.score}`);
  }

  const normalizedScore = Math.max(0, Math.min(100, Math.round(score)));
  return {
    grade: normalizedScore,
    feedback: (result.feedback || 'No feedback provided by AI.').toString(),
  };
}

/** GET /api/assignments/submissions - List all submissions for instructor's assignments */
export const listAllSubmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      sendError(res, 'Instructor or admin access required', 403);
      return;
    }

    const courses = await CourseModel.findByInstructor(user.userId);
    const all: any[] = [];
    for (const c of courses) {
      const assignments = await AssignmentModel.findByCourse(c.id!);
      for (const a of assignments) {
        const subs = await SubmissionModel.findByAssignmentWithUsers(a.id!);
        for (const s of subs) {
          all.push({
            ...s,
            assignment_title: a.title,
            course_id: a.course_id,
            course_title: a.course_title,
          });
        }
      }
    }
    sendSuccess(res, all, 'Submissions retrieved');
  } catch (err) {
    console.error('List submissions error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** GET /api/assignments/my-submissions - List all own submissions (student) */
export const listMySubmissions = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }
    const submissions = await SubmissionModel.findByUser(user.userId);
    sendSuccess(res, submissions, 'Submissions retrieved');
  } catch (err) {
    console.error('List my submissions error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** GET /api/assignments/:id/submission - Get own submission (student) or list all (instructor) */
export const getSubmission = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const id = Number(req.params.id);
    if (isNaN(id)) {
      sendError(res, 'Invalid assignment ID', 400);
      return;
    }

    if (user.role === 'student') {
      const sub = await SubmissionModel.findByAssignmentAndUser(id, user.userId);
      sendSuccess(res, sub || null, 'Submission retrieved');
    } else {
      const subs = await SubmissionModel.findByAssignmentWithUsers(id);
      sendSuccess(res, subs, 'Submissions retrieved');
    }
  } catch (err) {
    console.error('Get submission error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** PATCH /api/assignments/submissions/:submissionId/grade - Grade submission (instructor) */
export const gradeSubmission = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user || (user.role !== 'instructor' && user.role !== 'admin')) {
      sendError(res, 'Instructor or admin access required', 403);
      return;
    }

    const submissionId = Number(req.params.submissionId);
    const { grade, feedback } = req.body || {};

    if (isNaN(submissionId) || grade == null) {
      sendError(res, 'submissionId and grade are required', 400);
      return;
    }

    const g = Number(grade);
    if (isNaN(g) || g < 0 || g > 100) {
      sendError(res, 'Grade must be between 0 and 100', 400);
      return;
    }

    const sub = await SubmissionModel.findById(submissionId);
    if (!sub) {
      sendError(res, 'Submission not found', 404);
      return;
    }

    const updated = await SubmissionModel.updateGrade(
      submissionId,
      g,
      feedback ? String(feedback) : '',
      user.userId
    );
    sendSuccess(res, updated, 'Submission graded');
  } catch (err) {
    console.error('Grade submission error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

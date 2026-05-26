import express, { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  askAITutor,
  summarizeContent,
  generateQuizQuestions,
  gradeAssignment,
  checkAIHealth,
  getUserSummaries,
} from '../controllers/aiControllerOpenAI';
import { recommendCareerRoadmap } from '../controllers/aiRoadmapController';

console.log('✅ [AIOPENAI.TS] Routes file loaded - NEW OpenAI routes are ready!');

const router: Router = express.Router();

const methodNotAllowedForAsk = (_req: express.Request, res: express.Response) => {
  res.status(405).json({
    success: false,
    message: 'Method not allowed. Use POST /api/ai/ask with JSON body { question, context?, courseId?, courseTitle? }',
  });
};

/**
 * AI Routes with OpenAI Integration
 * All endpoints require authentication except health check
 */

/**
 * POST /api/ai/ask
 * Ask AI Tutor a question using OpenAI
 *
 * Request body:
 * {
 *   question: string (required),
 *   context?: string (optional),
 *   courseId?: number (optional),
 *   courseTitle?: string (optional)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     answer: string,
 *     question: string,
 *     timestamp: string,
 *     source: 'openai'
 *   }
 * }
 */
router.post('/ask', authenticate, askAITutor);
// Compatibility aliases used by some frontend builds
router.post('/tutor', authenticate, askAITutor);
router.post('/chat', authenticate, askAITutor);
// Helpful response when request method is wrong
router.get('/ask', authenticate, methodNotAllowedForAsk);
router.get('/tutor', authenticate, methodNotAllowedForAsk);
router.get('/chat', authenticate, methodNotAllowedForAsk);

/**
 * POST /api/ai/summarize
 * Summarize content using OpenAI
 *
 * Request body:
 * {
 *   content: string (required, max 50,000 chars),
 *   type?: 'text' | 'pdf' (optional),
 *   courseId?: number (optional),
 *   lessonId?: number (optional),
 *   saveToDb?: boolean (optional, default: true)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     title: string,
 *     shortSummary: string,
 *     keyPoints: string[],
 *     studyNotes: string,
 *     wordCount: number,
 *     readingTime: string
 *   },
 *   summaryId?: number (if saved to DB)
 * }
 */
router.post('/summarize', authenticate, summarizeContent);

/**
 * POST /api/ai/roadmap/recommend
 * Career roadmap AI — rank real courses and suggest study order (tenant-scoped, published only).
 *
 * Body: { "courseIds": [1, 2, 3] }  (min 1, max 20)
 * Query (superadmin only): ?tenant_id=
 */
router.post('/roadmap/recommend', authenticate, recommendCareerRoadmap);
// Compatibility aliases (some frontend builds use hyphen or flat path)
router.post('/roadmap-recommend', authenticate, recommendCareerRoadmap);
router.post('/career-roadmap/recommend', authenticate, recommendCareerRoadmap);

/**
 * POST /api/ai/generate-quiz
 * Generate quiz questions using OpenAI
 *
 * Request body:
 * {
 *   content: string (required),
 *   topicName: string (required),
 *   numberOfQuestions?: number (optional, default: 5, max: 20)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     questions: Array<{
 *       question: string,
 *       options: string[],
 *       correctAnswer: number,
 *       explanation: string
 *     }>,
 *     topicName: string,
 *     count: number,
 *     timestamp: string
 *   }
 * }
 */
router.post('/generate-quiz', authenticate, generateQuizQuestions);

/**
 * POST /api/ai/grade-assignment
 * Grade assignment using OpenAI
 *
 * Request body:
 * {
 *   studentAnswer: string (required),
 *   rubric: string (required),
 *   courseContext?: string (optional),
 *   assignmentId?: number (optional)
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     score: number (0-100),
 *     feedback: string,
 *     strengths: string[],
 *     improvements: string[],
 *     gradedBy: 'openai',
 *     timestamp: string
 *   }
 * }
 */
router.post('/grade-assignment', authenticate, gradeAssignment);

/**
 * GET /api/ai/health
 * Check AI service health and configuration
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   features: string[],
 *   apiKeyConfigured: boolean,
 *   apiProvider: 'openai'
 * }
 */
router.get('/health', checkAIHealth);

/**
 * GET /api/ai/summaries
 * Get all summary history for authenticated user
 *
 * Query params:
 * - limit: number (default: 20, max: 100)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   success: boolean,
 *   data: Array<summary>,
 *   pagination: {
 *     limit: number,
 *     offset: number,
 *     total: number
 *   }
 * }
 */
router.get('/summaries', authenticate, getUserSummaries);

export default router;

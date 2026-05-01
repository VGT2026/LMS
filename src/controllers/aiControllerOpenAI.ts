import { Request, Response } from 'express';
import { AISummaryModel } from '../models/AISummary';
import { askOpenAITutor, generateQuizQuestionsWithOpenAI, gradeAssignmentWithOpenAI } from '../services/openaiService';

/**
 * AI Controller - Uses OpenAI API for all AI features
 */

interface AskTutorRequest {
  question: string;
  context?: string;
  courseId?: number;
  courseTitle?: string;
}

/**
 * POST /api/ai/ask
 * Ask AI Tutor using OpenAI
 */
export const askAITutor = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('🚀 [AI TUTOR - NEW CONTROLLER] Request received!');
    console.log('🚀 [AI TUTOR - NEW CONTROLLER] Body:', req.body);
    
    const { question, context, courseId, courseTitle } = req.body as AskTutorRequest;
    const userId = (req as any).user?.userId;

    // Validate input
    if (!question || typeof question !== 'string' || question.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Question is required and must be a non-empty string',
      });
      return;
    }

    if (question.length > 5000) {
      res.status(400).json({
        success: false,
        message: 'Question is too long (max 5000 characters)',
      });
      return;
    }

    console.log(`[AI TUTOR] Asking question - User: ${userId}, Question length: ${question.length}`);

    // Call OpenAI API
    const answer = await askOpenAITutor(question, context, courseTitle);

    console.log(`[AI TUTOR] ✅ Received answer from OpenAI - Length: ${answer.length}`);

    res.status(200).json({
      success: true,
      data: {
        answer,
        question,
        timestamp: new Date().toISOString(),
        source: 'openai',
      },
    });
  } catch (error) {
    console.error('[AI TUTOR] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to get AI response';

    res.status(500).json({
      success: false,
      message: 'Failed to generate response from AI tutor',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
};

/**
 * POST /api/ai/generate-quiz
 * Generate quiz questions using OpenAI
 */
export const generateQuizQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, topicName, numberOfQuestions = 5 } = req.body;
    const userId = (req as any).user?.userId;

    if (!content || !topicName) {
      res.status(400).json({
        success: false,
        message: 'Content and topicName are required',
      });
      return;
    }

    if (numberOfQuestions < 1 || numberOfQuestions > 50) {
      res.status(400).json({
        success: false,
        message: 'Number of questions must be between 1 and 50',
      });
      return;
    }

    console.log(`[QUIZ GEN] Generating ${numberOfQuestions} questions for topic: ${topicName}`);

    const questions = await generateQuizQuestionsWithOpenAI(content, topicName, numberOfQuestions);

    console.log(`[QUIZ GEN] ✅ Generated ${questions.length} questions`);

    res.status(200).json({
      success: true,
      data: {
        questions,
        topicName,
        count: questions.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[QUIZ GEN] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to generate questions';

    res.status(500).json({
      success: false,
      message: 'Failed to generate quiz questions',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
};

/**
 * POST /api/ai/grade-assignment
 * Grade assignment using OpenAI
 */
export const gradeAssignment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { studentAnswer, rubric, courseContext, assignmentId } = req.body;
    const userId = (req as any).user?.userId;

    if (!studentAnswer || !rubric) {
      res.status(400).json({
        success: false,
        message: 'Student answer and rubric are required',
      });
      return;
    }

    console.log(`[GRADER] Grading assignment - User: ${userId}, Assignment: ${assignmentId}`);

    const grading = await gradeAssignmentWithOpenAI(studentAnswer, rubric, courseContext);

    console.log(`[GRADER] ✅ Assignment graded - Score: ${grading.score}`);

    res.status(200).json({
      success: true,
      data: {
        ...grading,
        gradedBy: 'openai',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[GRADER] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to grade assignment';

    res.status(500).json({
      success: false,
      message: 'Failed to grade assignment',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
};

/**
 * POST /api/ai/summarize
 * Summarize content using OpenAI (existing from original ai.ts)
 */
export const summarizeContent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { content, type = 'text', courseId, lessonId, saveToDb = true } = req.body;
    const userId = (req as any).user?.userId;

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({
        success: false,
        message: 'Content is required and must be a non-empty string',
      });
      return;
    }

    if (content.length > 50000) {
      res.status(400).json({
        success: false,
        message: 'Content too large (max 50,000 characters)',
      });
      return;
    }

    console.log(`[SUMMARIZE] Summarizing content - Type: ${type}, Length: ${content.length}, User: ${userId}`);

    // Call OpenAI summarization (from original implementation)
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational content summarizer. Provide output in JSON format only. No markdown, no code blocks, pure JSON.',
          },
          {
            role: 'user',
            content: `Summarize this educational content and provide output as valid JSON with these exact fields: "title" (string), "shortSummary" (string), "keyPoints" (array of strings), "studyNotes" (string).\n\nContent:\n${content}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI error: ${response.status}`);
    }

    const data: any = await response.json();
    const responseText = data?.choices?.[0]?.message?.content;

    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    let parsed;
    try {
      // Strip markdown code fences in case the model wraps JSON in ```json ... ```
      const cleanedText = responseText
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();
      parsed = JSON.parse(cleanedText);
    } catch (e) {
      console.error('[SUMMARIZE] JSON parse error:', e);
      throw new Error('Invalid JSON response from OpenAI');
    }

    const words = content.split(/\s+/).filter(Boolean);
    const wordCount = words.length;
    const readingTime = `${Math.max(1, Math.ceil(wordCount / 200))} min`;

    const summary = {
      title: parsed.title || 'Content Summary',
      shortSummary: parsed.shortSummary || 'Summary unavailable',
      keyPoints: Array.isArray(parsed.keyPoints) ? parsed.keyPoints : [],
      studyNotes: parsed.studyNotes || 'Study notes unavailable',
      wordCount,
      readingTime,
    };

    let savedSummary = null;

    if (saveToDb && userId) {
      try {
        const summaryData = {
          user_id: userId,
          course_id: courseId,
          lesson_id: lessonId,
          original_content: content,
          original_content_length: content.length,
          title: summary.title,
          short_summary: summary.shortSummary,
          key_points: summary.keyPoints,
          study_notes: summary.studyNotes,
          word_count: summary.wordCount,
          reading_time: summary.readingTime,
          content_type: type,
        };

        savedSummary = await AISummaryModel.create(summaryData);
        console.log(`[SUMMARIZE] ✅ Saved to DB - ID: ${savedSummary?.id}`);
      } catch (dbError) {
        console.error('[SUMMARIZE] DB save failed:', dbError);
      }
    }

    res.status(200).json({
      success: true,
      data: summary,
      summaryId: savedSummary?.id,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[SUMMARIZE] Error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to summarize';

    res.status(500).json({
      success: false,
      message: 'Failed to summarize content',
      error: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
};

/**
 * GET /api/ai/health
 * Check AI service health
 */
export const checkAIHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;

    res.status(200).json({
      success: true,
      message: 'AI service is available',
      features: ['tutoring', 'summarization', 'quiz-generation', 'assignment-grading'],
      apiKeyConfigured: hasOpenAIKey,
      apiProvider: 'openai',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'AI service health check failed',
    });
  }
};

/**
 * GET /api/ai/summaries
 * Get user's saved summaries
 */
export const getUserSummaries = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const limitParam = Array.isArray(req.query.limit)
      ? req.query.limit[0]
      : req.query.limit || '20';
    const offsetParam = Array.isArray(req.query.offset)
      ? req.query.offset[0]
      : req.query.offset || '0';

    const limit = Math.min(parseInt(limitParam as string) || 20, 100);
    const offset = Math.max(parseInt(offsetParam as string) || 0, 0);

    console.log(`[SUMMARIES] Fetching for user ${userId} - limit: ${limit}, offset: ${offset}`);

    const summaries = await AISummaryModel.findByUserId(userId, limit, offset);
    const totalCount = await AISummaryModel.countByUserId(userId);

    res.status(200).json({
      success: true,
      data: summaries,
      pagination: {
        limit,
        offset,
        total: totalCount,
      },
    });
  } catch (error) {
    console.error('[SUMMARIES] Error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to fetch summaries',
    });
  }
};

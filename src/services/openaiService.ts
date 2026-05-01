/**
 * OpenAI Service
 * Handles all OpenAI API calls for AI Tutor, question generation, and content summarization
 */

interface OpenAIResponse {
  success: boolean;
  message: string;
  data?: any;
}

interface TutorQuestion {
  question: string;
  context?: string;
  courseId?: number;
}

/**
 * Call OpenAI API for AI Tutor responses
 * Works with ANY IT/CS course - React, Python, Database, DevOps, ML, etc.
 * @param question User's question about any IT course topic
 * @param context Optional course/lesson context
 * @param courseTitle Course name (any IT/CS subject)
 */
export async function askOpenAITutor(
  question: string,
  context?: string,
  courseTitle?: string
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const systemPrompt = `You are an expert AI tutor for IT and Computer Science courses.
You can tutor students on ANY IT/CS topic including:
- Programming Languages (Python, JavaScript, Java, C++, Go, Rust, etc.)
- Web Development (React, Vue, Angular, Node.js, Django, Flask, Spring, etc.)
- Databases (SQL, PostgreSQL, MySQL, MongoDB, Redis, Neo4j, etc.)
- DevOps & Cloud (Docker, Kubernetes, AWS, Azure, GCP, CI/CD, etc.)
- Machine Learning & AI (TensorFlow, PyTorch, Scikit-learn, NLP, etc.)
- Mobile Development (Android, iOS, React Native, Flutter, etc.)
- Data Science & Analytics
- System Design & Architecture
- Software Engineering Principles
- And any other IT/CS subject

${courseTitle ? `Current course: ${courseTitle}` : 'Tutoring mode'}
${context ? `Context: ${context}` : ''}

Teaching approach:
- Adapt complexity to student's level (from beginner to expert)
- Use code examples when explaining programming topics
- Provide conceptual explanations for system design & architecture
- Use diagrams in text format when helpful
- Answer follow-up questions to deepen understanding
- Be encouraging and supportive
- Focus on understanding, not just memorizing
- Relate concepts to real-world applications
- For any IT topic, provide practical, implementable advice`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('[OpenAI] Error response:', response.status, errorBody);
      throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const data: any = await response.json();
    const message = data?.choices?.[0]?.message?.content;

    if (!message) {
      throw new Error('No response content from OpenAI');
    }

    return message;
  } catch (error) {
    console.error('[OpenAI] Request failed:', error);
    throw error;
  }
}

/**
 * Generate quiz questions using OpenAI
 * Works with ANY IT/CS course content
 * @param content Course content about any IT topic (code, concepts, tutorials, etc.)
 * @param topicName Name of the topic (can be from any IT/CS course)
 * @param numberOfQuestions How many questions to generate
 */
export async function generateQuizQuestionsWithOpenAI(
  content: string,
  topicName: string,
  numberOfQuestions: number = 5
): Promise<any[]> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const prompt = `You are an expert IT/CS instructor creating assessment questions.
Topic: "${topicName}"
Create exactly ${numberOfQuestions} multiple-choice quiz questions that test understanding of the material below.

The questions should be appropriate for:
- Programming/coding concepts (write working code)
- System design (architecture decisions)
- Database design (schema and queries)
- DevOps/infrastructure (deployment strategies)
- Data science (algorithms and techniques)
- Web development (frontend/backend concepts)
- Any other IT/CS subject

Content to create questions from:
${content}

Return ONLY valid JSON array with this structure (no markdown, no extra text):
[
  {
    "question": "Clear, specific question about the topic?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct and what the other options test"
  }
]`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational content creator. Generate high-quality quiz questions.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.5,
        max_tokens: 8000,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const data: any = await response.json();
    const responseText = data?.choices?.[0]?.message?.content;

    if (!responseText) {
      throw new Error('No response content from OpenAI');
    }

    // Parse JSON from response
    let questions;
    try {
      questions = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[OpenAI] Failed to parse JSON response:', responseText);
      throw new Error('Invalid JSON response from OpenAI');
    }

    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    console.error('[OpenAI] Quiz generation failed:', error);
    throw error;
  }
}

/**
 * Grade assignment using OpenAI
 * Works with ANY IT/CS assignment type (code, essays, projects, etc.)
 * @param studentAnswer Student's submission (code, answer, project description, etc.)
 * @param rubric Grading rubric/criteria for any IT assignment
 * @param courseContext Course information (can be from any IT/CS course)
 */
export async function gradeAssignmentWithOpenAI(
  studentAnswer: string,
  rubric: string,
  courseContext?: string
): Promise<{
  score: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const prompt = `You are an expert instructor grading an IT/CS assignment.
You have experience grading:
- Programming assignments (any language)
- System design documents
- Database schema designs
- DevOps/infrastructure setups
- Data science/ML projects
- Web development projects
- Technical essays and reflections
- Any IT/CS assessment type

${courseContext ? `Course Context: ${courseContext}\n` : ''}

Grading Rubric:
${rubric}

Student Submission:
${studentAnswer}

Evaluate fairly and thoroughly. Provide your assessment in JSON format (valid JSON only, no markdown):
{
  "score": 85,
  "feedback": "Overall assessment - be specific about what was done well and what could improve",
  "strengths": ["Specific strength 1", "Specific strength 2", "..."],
  "improvements": ["Specific area to improve 1", "Specific area to improve 2", "..."]
}

Score should be 0-100 based on the rubric.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are an expert educator providing constructive feedback on student work. Be fair, encouraging, and specific.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.6,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorBody}`);
    }

    const data: any = await response.json();
    const responseText = data?.choices?.[0]?.message?.content;

    if (!responseText) {
      throw new Error('No response content from OpenAI');
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('[OpenAI] Failed to parse grading response:', responseText);
      throw new Error('Invalid JSON response from OpenAI grading');
    }

    return {
      score: result.score || 0,
      feedback: result.feedback || 'No feedback available',
      strengths: Array.isArray(result.strengths) ? result.strengths : [],
      improvements: Array.isArray(result.improvements) ? result.improvements : [],
    };
  } catch (error) {
    console.error('[OpenAI] Grading failed:', error);
    throw error;
  }
}

/**
 * Check if OpenAI is available and API key is valid
 */
export async function validateOpenAIConnection(): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.warn('[OpenAI] API key not configured');
    return false;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error('[OpenAI] Validation failed:', error);
    return false;
  }
}

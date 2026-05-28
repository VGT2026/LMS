export const ROADMAP_RECOMMEND_MAX_COURSES = 20;

export type RoadmapCourseInput = {
  id: number;
  title: string;
  description?: string | null;
  category: string;
  instructor_name?: string | null;
  duration?: string | null;
  thumbnail?: string | null;
};

export type RankedRoadmapCourse = {
  courseId: number;
  title: string;
  category: string;
  score: number;
  reason: string;
};

export type RoadmapRecommendResult = {
  answer: string;
  recommendedCourseId: number;
  ranked: RankedRoadmapCourse[];
  studyOrder: number[];
  topPick: {
    courseId: number;
    title: string;
    category: string;
    reason: string;
  };
  /** Whether OpenAI or local heuristic produced the ranking */
  source: 'openai' | 'offline';
  aiSummary?: string;
};

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'this',
  'that',
  'your',
  'course',
  'introduction',
  'into',
]);

const BEGINNER_PATTERN =
  /\b(intro|introduction|fundamental|fundamentals|beginner|basics?|getting started|101|overview|essentials?)\b/i;

export function parseRecommendCourseIds(raw: unknown): number[] | null {
  if (!Array.isArray(raw)) return null;
  const out: number[] = [];
  const seen = new Set<number>();
  for (const item of raw) {
    let n: number;
    if (typeof item === 'number') {
      n = item;
    } else {
      const s = String(item).trim();
      if (!/^\d+$/.test(s)) return null;
      n = parseInt(s, 10);
    }
    if (!Number.isFinite(n) || n <= 0) return null;
    if (!seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

function tokenize(text: string): Set<string> {
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  return new Set(tokens);
}

function parseDurationWeeks(duration?: string | null): number {
  if (!duration) return 8;
  const match = String(duration).match(/(\d+(?:\.\d+)?)/);
  if (!match) return 8;
  const n = parseFloat(match[1]);
  return Number.isFinite(n) ? n : 8;
}

function categoryCounts(courses: RoadmapCourseInput[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of courses) {
    const key = (c.category || 'General').trim().toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function overlapScore(course: RoadmapCourseInput, others: RoadmapCourseInput[]): number {
  const tokens = tokenize(`${course.title} ${course.description || ''} ${course.category}`);
  if (tokens.size === 0 || others.length === 0) return 0;

  let totalShared = 0;
  let comparisons = 0;
  for (const other of others) {
    if (other.id === course.id) continue;
    const otherTokens = tokenize(`${other.title} ${other.description || ''} ${other.category}`);
    let shared = 0;
    for (const t of tokens) {
      if (otherTokens.has(t)) shared += 1;
    }
    totalShared += shared;
    comparisons += 1;
  }
  return comparisons > 0 ? totalShared / comparisons : 0;
}

/** Heuristic ranking when OpenAI is unavailable (keyword overlap + category + beginner-friendly). */
export function recommendRoadmapFallback(courses: RoadmapCourseInput[]): RoadmapRecommendResult {
  const counts = categoryCounts(courses);
  const scored = courses.map((course) => {
    const others = courses.filter((c) => c.id !== course.id);
    const overlap = overlapScore(course, others);
    const catKey = (course.category || 'General').trim().toLowerCase();
    const categoryBoost = (counts.get(catKey) || 0) > 1 ? 1.5 : 0;
    const beginnerBoost = BEGINNER_PATTERN.test(`${course.title} ${course.description || ''}`) ? 2 : 0;
    const durationWeeks = parseDurationWeeks(course.duration);
    const durationBoost = durationWeeks <= 6 ? 1 : durationWeeks <= 10 ? 0.5 : 0;
    const score = Number((overlap * 3 + categoryBoost + beginnerBoost + durationBoost).toFixed(2));

    const reasonParts: string[] = [];
    if (beginnerBoost > 0) reasonParts.push('foundational topic in your selection');
    if (categoryBoost > 0) reasonParts.push(`aligns with your ${course.category} focus`);
    if (overlap > 0.5) reasonParts.push('strong keyword overlap with your other courses');
    if (reasonParts.length === 0) reasonParts.push('balanced starting point for your roadmap');

    return {
      courseId: course.id,
      title: course.title,
      category: course.category,
      score,
      reason: reasonParts.join('; '),
    };
  });

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const top = scored[0];

  const studyOrder = scored.map((c) => c.courseId);
  const recommendedCourseId = top.courseId;
  const answer = top.score >= 4
    ? `Start with "${top.title}" first. It best matches the themes across your selected courses and is the strongest foundation to build on.`
    : `Start with "${top.title}" first. It connects well with your other selections and sets you up for the next steps in your roadmap.`;

  return {
    answer,
    recommendedCourseId,
    topPick: {
      courseId: top.courseId,
      title: top.title,
      category: top.category,
      reason:
        top.score >= 4
          ? `${top.title} is the best first step: ${top.reason}.`
          : `Start with ${top.title} — ${top.reason}.`,
    },
    ranked: scored,
    studyOrder,
    source: 'offline',
    aiSummary: `Based on your ${courses.length} selected courses, start with "${top.title}" then follow the suggested order. Courses in the same category were prioritized, with beginner-friendly titles ranked higher.`,
  };
}

type OpenAiRankPayload = {
  answer?: string;
  recommendedCourseId?: number;
  studyOrder?: number[];
  ranked?: Array<{
    courseId: number;
    reason: string;
    score?: number;
  }>;
};

async function recommendRoadmapWithOpenAI(
  courses: RoadmapCourseInput[]
): Promise<RoadmapRecommendResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const catalog = courses.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    description: (c.description || '').slice(0, 400),
    instructor: c.instructor_name || 'Unassigned',
    duration: c.duration || 'unknown',
  }));

  const prompt = `You are a career learning advisor for an LMS.

${JSON.stringify(catalog, null, 2)}

Return ONLY valid JSON with this shape:
{
  "answer": "<2-3 sentence recommendation>",
  "recommendedCourseId": <number>,
  "studyOrder": [<number>, ...],
  "ranked": [
    { "courseId": <number>, "reason": "<short reason>", "score": <number> }
  ]
}

Rules:
- Use ONLY the course IDs provided.
- ranked must include every selected course exactly once.
- recommendedCourseId must be one of the provided course IDs.
- studyOrder must list all provided course IDs exactly once in recommended study order.`;

  try {
    const apiKey = process.env.OPENAI_API_KEY;
    const controller = new AbortController();
    const timeoutMs = Number(process.env.OPENAI_ROADMAP_TIMEOUT_MS) || 20000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You return JSON only. Do not include markdown. No extra keys. Validate that ranked and studyOrder include all course IDs exactly once.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 800,
      }),
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn('[RoadmapAI] OpenAI error response:', response.status, errorBody);
      return null;
    }

    const data: any = await response.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string' || raw.trim().length === 0) return null;

    const parsed = JSON.parse(raw) as OpenAiRankPayload;

    const byId = new Map(courses.map((c) => [c.id, c]));
    const fallback = recommendRoadmapFallback(courses);

    const rankedRaw = Array.isArray(parsed.ranked) ? parsed.ranked : null;
    const studyOrderRaw = Array.isArray(parsed.studyOrder) ? parsed.studyOrder : null;
    const recommendedCourseId = Number(parsed.recommendedCourseId);

    const allIds = new Set(courses.map((c) => c.id));
    if (!Number.isFinite(recommendedCourseId) || !allIds.has(recommendedCourseId)) return null;

    const rankedIds = rankedRaw
      ? rankedRaw.map((r) => Number(r.courseId)).filter((id) => allIds.has(id))
      : [];
    if (rankedRaw == null || rankedIds.length !== courses.length) return null;

    // Validate studyOrder
    const studyOrder = studyOrderRaw
      ? studyOrderRaw.map((id) => Number(id)).filter((id) => allIds.has(id))
      : [];
    if (studyOrder.length !== courses.length) return null;

    const ranked: RankedRoadmapCourse[] = rankedRaw!.map((r) => {
      const course = byId.get(Number(r.courseId))!;
      const heuristic = fallback.ranked.find((hr) => hr.courseId === course.id);
      return {
        courseId: course.id,
        title: course.title,
        category: course.category,
        score: Number.isFinite(r.score as number) ? Number(r.score) : heuristic?.score ?? 5,
        reason:
          typeof r.reason === 'string' && r.reason.trim().length > 0
            ? r.reason.trim()
            : heuristic?.reason || 'Recommended for your roadmap.',
      };
    });

    const topCourseFromMap = byId.get(recommendedCourseId);
    const topPick = topCourseFromMap
      ? {
          courseId: topCourseFromMap.id,
          title: topCourseFromMap.title,
          category: topCourseFromMap.category,
          reason: fallback.topPick.reason,
        }
      : fallback.topPick;

    const answer =
      typeof parsed.answer === 'string' && parsed.answer.trim().length > 0
        ? parsed.answer.trim()
        : fallback.answer;

    return {
      answer,
      recommendedCourseId,
      topPick,
      ranked,
      studyOrder,
      source: 'openai',
      aiSummary: typeof parsed.answer === 'string' ? parsed.answer.trim() : undefined,
    };
  } catch (err) {
    console.warn('[RoadmapAI] OpenAI recommend failed, using fallback:', (err as Error)?.message ?? err);
    return null;
  }
}

export async function buildRoadmapRecommendation(
  courses: RoadmapCourseInput[]
): Promise<RoadmapRecommendResult> {
  const fromAi = await recommendRoadmapWithOpenAI(courses);
  return fromAi ?? recommendRoadmapFallback(courses);
}

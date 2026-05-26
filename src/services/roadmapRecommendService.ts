import { askOpenAITutor } from './openaiService';

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
  topPick: {
    courseId: number;
    title: string;
    reason: string;
  };
  ranked: RankedRoadmapCourse[];
  studyOrder: string[];
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
    const n = typeof item === 'number' ? item : parseInt(String(item), 10);
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

  return {
    topPick: {
      courseId: top.courseId,
      title: top.title,
      reason:
        top.score >= 4
          ? `${top.title} is the best first step: ${top.reason}.`
          : `Start with ${top.title} — ${top.reason}.`,
    },
    ranked: scored,
    studyOrder: scored.map((c) => c.title),
    aiSummary: `Based on your ${courses.length} selected courses, start with "${top.title}" then follow the suggested order. Courses in the same category were prioritized, with beginner-friendly titles ranked higher.`,
  };
}

type OpenAiRankPayload = {
  topPickCourseId?: number;
  rankedCourseIds?: number[];
  reasons?: Record<string, string>;
  studyOrderTitles?: string[];
  summary?: string;
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

  const prompt = `You are a career learning advisor for an LMS. The student selected these real courses (IDs are database IDs — use only these):

${JSON.stringify(catalog, null, 2)}

Return ONLY valid JSON with this shape:
{
  "topPickCourseId": <number>,
  "rankedCourseIds": [<number>, ...],
  "reasons": { "<courseId>": "<short reason>", ... },
  "studyOrderTitles": ["<title>", ...],
  "summary": "<one paragraph>"
}

Rules:
- Use ONLY the course IDs provided.
- rankedCourseIds must include every selected course exactly once.
- Pick the best FIRST course to start (topPickCourseId).
- studyOrderTitles must list titles in recommended study order.`;

  try {
    const raw = await askOpenAITutor(
      prompt,
      'Respond with JSON only. No markdown.',
      'Career Roadmap Planning'
    );
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/, '')
      .trim();
    const parsed = JSON.parse(cleaned) as OpenAiRankPayload;

    const byId = new Map(courses.map((c) => [c.id, c]));
    const fallback = recommendRoadmapFallback(courses);

    const rankedIds =
      Array.isArray(parsed.rankedCourseIds) && parsed.rankedCourseIds.length === courses.length
        ? parsed.rankedCourseIds.map((id) => Number(id)).filter((id) => byId.has(id))
        : fallback.ranked.map((r) => r.courseId);

    if (rankedIds.length !== courses.length) {
      return null;
    }

    const ranked: RankedRoadmapCourse[] = rankedIds.map((id) => {
      const course = byId.get(id)!;
      const heuristic = fallback.ranked.find((r) => r.courseId === id);
      const reasonKey = String(id);
      const aiReason = parsed.reasons?.[reasonKey] || parsed.reasons?.[id as unknown as string];
      return {
        courseId: id,
        title: course.title,
        category: course.category,
        score: heuristic?.score ?? 5,
        reason: typeof aiReason === 'string' && aiReason.trim() ? aiReason.trim() : heuristic?.reason || 'Recommended for your roadmap.',
      };
    });

    const topId = Number(parsed.topPickCourseId);
    const topPickCourse = byId.get(topId) || byId.get(ranked[0].courseId)!;
    const topReason =
      parsed.reasons?.[String(topPickCourse.id)] ||
      ranked.find((r) => r.courseId === topPickCourse.id)?.reason ||
      fallback.topPick.reason;

    const studyOrder =
      Array.isArray(parsed.studyOrderTitles) && parsed.studyOrderTitles.length > 0
        ? parsed.studyOrderTitles.map(String)
        : ranked.map((r) => r.title);

    return {
      topPick: {
        courseId: topPickCourse.id,
        title: topPickCourse.title,
        reason: topReason,
      },
      ranked,
      studyOrder,
      aiSummary: typeof parsed.summary === 'string' ? parsed.summary.trim() : undefined,
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

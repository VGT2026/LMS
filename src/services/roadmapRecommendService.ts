export const ROADMAP_RECOMMEND_MAX_COURSES = 20;
export const ROADMAP_RELATED_MAX_COURSES = 6;

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

export type RelatedRoadmapCourse = RankedRoadmapCourse & {
  thumbnail?: string | null;
  duration?: string | null;
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
  /** Additional catalog courses related to the selection (not in courseIds input) */
  relatedCourses: RelatedRoadmapCourse[];
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

function selectionKeywordPool(selected: RoadmapCourseInput[]): Set<string> {
  const pool = tokenize(
    selected.map((c) => `${c.title} ${c.description || ''} ${c.category}`).join(' ')
  );
  return pool;
}

function selectionCategories(selected: RoadmapCourseInput[]): Set<string> {
  return new Set(
    selected.map((c) => (c.category || 'General').trim().toLowerCase()).filter(Boolean)
  );
}

/** Score catalog courses by relevance to the user's selection (excludes selected IDs). */
export function scoreRelatedCatalogCourses(
  selected: RoadmapCourseInput[],
  catalog: RoadmapCourseInput[],
  max = ROADMAP_RELATED_MAX_COURSES
): RelatedRoadmapCourse[] {
  if (selected.length === 0 || catalog.length === 0) return [];

  const selectedIds = new Set(selected.map((c) => c.id));
  const pool = selectionKeywordPool(selected);
  const categories = selectionCategories(selected);

  const scored = catalog
    .filter((c) => !selectedIds.has(c.id))
    .map((course) => {
      const courseTokens = tokenize(
        `${course.title} ${course.description || ''} ${course.category}`
      );
      let overlap = 0;
      for (const t of courseTokens) {
        if (pool.has(t)) overlap += 1;
      }
      const catKey = (course.category || 'General').trim().toLowerCase();
      const categoryBoost = categories.has(catKey) ? 2.5 : 0;
      const beginnerBoost = BEGINNER_PATTERN.test(`${course.title} ${course.description || ''}`)
        ? 0.5
        : 0;
      const score = Number((overlap * 2 + categoryBoost + beginnerBoost).toFixed(2));

      const reasonParts: string[] = [];
      if (categoryBoost > 0) reasonParts.push(`extends your ${course.category} learning path`);
      if (overlap >= 2) reasonParts.push('strong topic match with your selected courses');
      else if (overlap > 0) reasonParts.push('complements themes in your selection');
      if (reasonParts.length === 0) reasonParts.push('popular next step in your organization catalog');

      return {
        courseId: course.id,
        title: course.title,
        category: course.category,
        score,
        reason: reasonParts.join('; '),
        thumbnail: course.thumbnail ?? null,
        duration: course.duration ?? null,
      };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  const withScore = scored.filter((r) => r.score > 0);
  if (withScore.length > 0) return withScore.slice(0, max);

  // Same-category catalog picks when keyword overlap is weak
  return scored
    .filter((r) => categories.has((r.category || 'General').trim().toLowerCase()))
    .slice(0, max);
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

function attachRelatedCourses(
  base: Omit<RoadmapRecommendResult, 'relatedCourses'>,
  selected: RoadmapCourseInput[],
  catalog: RoadmapCourseInput[]
): RoadmapRecommendResult {
  const relatedCourses = scoreRelatedCatalogCourses(selected, catalog);
  const relatedNote =
    relatedCourses.length > 0
      ? ` We also suggest ${relatedCourses.length} more course${relatedCourses.length > 1 ? 's' : ''} from your catalog that pair well with your picks.`
      : '';
  const answer = relatedNote
    ? base.answer.endsWith('.')
      ? `${base.answer}${relatedNote}`
      : `${base.answer}.${relatedNote}`
    : base.answer;
  return {
    ...base,
    answer,
    relatedCourses,
  };
}

/** Heuristic ranking when OpenAI is unavailable (keyword overlap + category + beginner-friendly). */
export function recommendRoadmapFallback(
  courses: RoadmapCourseInput[],
  catalog: RoadmapCourseInput[] = []
): RoadmapRecommendResult {
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

  return attachRelatedCourses(
    {
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
    },
    courses,
    catalog
  );
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
  relatedCourseIds?: number[];
};

function mapRelatedFromIds(
  ids: number[],
  catalogById: Map<number, RoadmapCourseInput>,
  selectedIds: Set<number>,
  fallbackScored: RelatedRoadmapCourse[]
): RelatedRoadmapCourse[] {
  const out: RelatedRoadmapCourse[] = [];
  const seen = new Set<number>();
  for (const rawId of ids) {
    const id = Number(rawId);
    if (!Number.isFinite(id) || selectedIds.has(id) || seen.has(id)) continue;
    const course = catalogById.get(id);
    if (!course) continue;
    seen.add(id);
    const heuristic = fallbackScored.find((r) => r.courseId === id);
    out.push({
      courseId: course.id,
      title: course.title,
      category: course.category,
      score: heuristic?.score ?? 5,
      reason: heuristic?.reason ?? 'Recommended based on your course selection.',
      thumbnail: course.thumbnail ?? null,
      duration: course.duration ?? null,
    });
    if (out.length >= ROADMAP_RELATED_MAX_COURSES) break;
  }
  return out;
}

async function recommendRoadmapWithOpenAI(
  courses: RoadmapCourseInput[],
  catalog: RoadmapCourseInput[] = []
): Promise<RoadmapRecommendResult | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const selectedPayload = courses.map((c) => ({
    id: c.id,
    title: c.title,
    category: c.category,
    description: (c.description || '').slice(0, 400),
    instructor: c.instructor_name || 'Unassigned',
    duration: c.duration || 'unknown',
  }));

  const catalogById = new Map(catalog.map((c) => [c.id, c]));
  const preScoredRelated = scoreRelatedCatalogCourses(courses, catalog);
  const catalogForPrompt = preScoredRelated.length > 0
    ? preScoredRelated.map((r) => {
        const c = catalogById.get(r.courseId)!;
        return {
          id: c.id,
          title: c.title,
          category: c.category,
          description: (c.description || '').slice(0, 200),
        };
      })
    : catalog.slice(0, 30).map((c) => ({
        id: c.id,
        title: c.title,
        category: c.category,
        description: (c.description || '').slice(0, 200),
      }));

  const prompt = `You are a career learning advisor for an LMS.

SELECTED COURSES (student already chose these — rank and order them):
${JSON.stringify(selectedPayload, null, 2)}

OTHER CATALOG COURSES (suggest up to ${ROADMAP_RELATED_MAX_COURSES} that complement the selection; do NOT repeat selected IDs):
${JSON.stringify(catalogForPrompt, null, 2)}

Return ONLY valid JSON with this shape:
{
  "answer": "<2-3 sentence recommendation mentioning study order and any extra catalog picks>",
  "recommendedCourseId": <number from SELECTED only>,
  "studyOrder": [<selected course ids in order>],
  "ranked": [
    { "courseId": <number>, "reason": "<short reason>", "score": <number> }
  ],
  "relatedCourseIds": [<up to ${ROADMAP_RELATED_MAX_COURSES} ids from OTHER CATALOG only>]
}

Rules:
- ranked must include every SELECTED course id exactly once.
- recommendedCourseId must be one of the SELECTED course ids.
- studyOrder must list all SELECTED course ids exactly once.
- relatedCourseIds must use ONLY ids from OTHER CATALOG (not selected).`;

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
        max_tokens: 1200,
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
    const selectedIdSet = new Set(courses.map((c) => c.id));
    const fallback = recommendRoadmapFallback(courses, catalog);

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

    const relatedRaw = Array.isArray(parsed.relatedCourseIds) ? parsed.relatedCourseIds : [];
    let relatedCourses = mapRelatedFromIds(
      relatedRaw,
      catalogById,
      selectedIdSet,
      preScoredRelated
    );
    if (relatedCourses.length === 0) {
      relatedCourses = preScoredRelated;
    }

    const relatedNote =
      relatedCourses.length > 0
        ? ` We also suggest ${relatedCourses.length} more course${relatedCourses.length > 1 ? 's' : ''} from your catalog.`
        : '';

    return {
      answer: answer.endsWith('.') ? `${answer}${relatedNote}` : `${answer}.${relatedNote}`,
      recommendedCourseId,
      topPick,
      ranked,
      studyOrder,
      relatedCourses,
      source: 'openai',
      aiSummary: typeof parsed.answer === 'string' ? parsed.answer.trim() : undefined,
    };
  } catch (err) {
    console.warn('[RoadmapAI] OpenAI recommend failed, using fallback:', (err as Error)?.message ?? err);
    return null;
  }
}

export async function buildRoadmapRecommendation(
  courses: RoadmapCourseInput[],
  catalog: RoadmapCourseInput[] = []
): Promise<RoadmapRecommendResult> {
  const fromAi = await recommendRoadmapWithOpenAI(courses, catalog);
  return fromAi ?? recommendRoadmapFallback(courses, catalog);
}

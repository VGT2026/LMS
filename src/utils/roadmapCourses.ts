import { CourseModel } from '../models/Course';
import { UserModel } from '../models/User';

export const ROADMAP_MAX_COURSES = 50;

/** Parse :courseId route param — rejects non-numeric values like "abc" or "12abc". */
export function parseRouteCourseIdParam(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null;
  const s = String(Array.isArray(raw) ? raw[0] : raw).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizeRoadmapCourseIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const n = parseInt(String(item), 10);
    if (!Number.isFinite(n) || n <= 0) continue;
    const s = String(n);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= ROADMAP_MAX_COURSES) break;
  }
  return out;
}

export type RoadmapValidationResult =
  | { ok: true; ids: string[] }
  | { ok: false; message: string };

export async function validateRoadmapCourseIds(
  userId: number,
  rawIds: unknown
): Promise<RoadmapValidationResult> {
  const ids = normalizeRoadmapCourseIds(rawIds);
  if (ids.length === 0) {
    return { ok: true, ids: [] };
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    return { ok: false, message: 'User not found' };
  }

  const numericIds = ids.map((id) => parseInt(id, 10));
  const tenantId =
    user.tenant_id != null && Number(user.tenant_id) > 0 ? Number(user.tenant_id) : null;

  const { invalid } = await CourseModel.validateIdsForTenant(numericIds, tenantId);
  if (invalid.length > 0) {
    return {
      ok: false,
      message: `Invalid or inaccessible course IDs: ${invalid.join(', ')}`,
    };
  }

  return { ok: true, ids };
}

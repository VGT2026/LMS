import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { CourseModel } from '../models/Course';
import { AuditLogModel } from '../models/AuditLog';
import {
  buildRoadmapRecommendation,
  parseRecommendCourseIds,
  recommendRoadmapFallback,
  ROADMAP_RECOMMEND_MAX_COURSES,
  RoadmapCourseInput,
} from '../services/roadmapRecommendService';
import { isSuperadmin, parseOptionalTenantId, resolveTenantFilter } from '../utils/tenantScope';

/**
 * POST /api/ai/roadmap/recommend
 * Career roadmap AI: rank selected real courses and suggest study order.
 */
export const recommendCareerRoadmap = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const rawIds =
      req.body?.courseIds ?? req.body?.course_ids ?? req.body?.selectedCourseIds;
    const courseIds = parseRecommendCourseIds(rawIds);

    if (courseIds == null) {
      sendError(res, 'courseIds must be an array of valid positive integer course IDs', 400);
      return;
    }
    if (courseIds.length === 0) {
      sendError(res, 'courseIds is required and must be a non-empty array of course IDs', 400);
      return;
    }
    if (courseIds.length > ROADMAP_RECOMMEND_MAX_COURSES) {
      sendError(res, `courseIds cannot exceed ${ROADMAP_RECOMMEND_MAX_COURSES} courses`, 400);
      return;
    }

    const tenantFilter = resolveTenantFilter(
      authUser,
      parseOptionalTenantId(req.query.tenant_id)
    );

    if (!isSuperadmin(authUser.role) && tenantFilter == null) {
      sendError(res, 'Your account is not assigned to an organization', 403);
      return;
    }

    const rows = await CourseModel.findPublishableByIds(courseIds, tenantFilter);
    const foundIds = new Set(rows.map((r) => Number(r.id)));

    const notFoundOrInaccessible = courseIds.filter((id) => !foundIds.has(id));
    if (notFoundOrInaccessible.length > 0) {
      sendError(
        res,
        `Invalid course IDs: ${notFoundOrInaccessible.join(', ')}`,
        400
      );
      return;
    }

    if (isSuperadmin(authUser.role) && tenantFilter == null) {
      const tenantIds = new Set(
        rows.map((r) => (r.tenant_id != null ? Number(r.tenant_id) : null)).filter((t) => t != null)
      );
      if (tenantIds.size > 1) {
        sendError(res, 'All courseIds must belong to the same organization', 400);
        return;
      }
    }

    const orderMap = new Map(courseIds.map((id, idx) => [id, idx]));
    const mapRow = (r: (typeof rows)[number]): RoadmapCourseInput => ({
      id: Number(r.id),
      title: r.title,
      description: r.description ?? null,
      category: r.category,
      instructor_name: r.instructor_name ?? null,
      duration: r.duration ?? null,
      thumbnail: r.thumbnail ?? null,
    });

    const courses: RoadmapCourseInput[] = [...rows]
      .sort((a, b) => (orderMap.get(Number(a.id)) ?? 0) - (orderMap.get(Number(b.id)) ?? 0))
      .map(mapRow);

    const catalogTenantId =
      tenantFilter ??
      (rows[0]?.tenant_id != null && Number(rows[0].tenant_id) > 0
        ? Number(rows[0].tenant_id)
        : null);

    const catalogRows = await CourseModel.findPublishableCatalog(catalogTenantId, {
      excludeIds: courseIds,
      limit: 80,
    });
    const catalog = catalogRows.map(mapRow);

    let result;
    try {
      result = await buildRoadmapRecommendation(courses, catalog);
    } catch (buildErr) {
      console.warn(
        'recommendCareerRoadmap build failed, using offline fallback:',
        (buildErr as Error)?.message ?? buildErr
      );
      result = recommendRoadmapFallback(courses, catalog);
    }

    await AuditLogModel.record({
      actor_id: authUser.userId,
      action: 'roadmap_ai_recommend',
      metadata: {
        courseIds,
        topPick: result.topPick.courseId,
        tenantId: tenantFilter ?? rows[0]?.tenant_id ?? null,
      },
    });

    sendSuccess(res, result, 'Roadmap recommendation generated');
  } catch (err) {
    console.error('recommendCareerRoadmap error:', err);
    sendError(
      res,
      process.env.NODE_ENV === 'development'
        ? `Internal server error: ${(err as Error).message}`
        : 'Internal server error',
      500
    );
  }
};

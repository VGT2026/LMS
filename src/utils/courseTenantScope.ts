import { Request, Response } from 'express';
import { CourseModel } from '../models/Course';
import {
  assertCourseInTenant,
  getJwtTenantId,
  isSuperadmin,
  parseTenantIdQuery,
  requiresTenant,
  resolveTenantFilter,
} from './tenantScope';
import { sendError } from './response';

/**
 * Org users see only their tenant's courses (strict SQL match).
 * Platform-wide (tenant_id IS NULL) rows are excluded unless ?include_platform=1.
 * Superadmin without ?tenant_id= sees all; with ?tenant_id= sees that org only.
 */
export function denyCrossTenantCourse(
  req: Request,
  res: Response,
  course: { tenant_id?: number | null }
): boolean {
  const user = req.user;
  if (!user || isSuperadmin(user.role)) return false;
  if (!assertCourseInTenant(user, course)) {
    sendError(res, 'Course not found', 404);
    return true;
  }
  return false;
}

/** Anonymous read: course must match ?tenant_id= or be platform-wide. */
export function denyAnonymousCourseAccess(
  req: Request,
  res: Response,
  course: { tenant_id?: number | null; is_active?: boolean }
): boolean {
  if (req.user) return denyCrossTenantCourse(req, res, course);

  const queryTenant = parseTenantIdQuery(req.query as Record<string, unknown>);
  if (course.tenant_id != null && Number(course.tenant_id) > 0) {
    if (queryTenant == null || Number(course.tenant_id) !== queryTenant) {
      sendError(res, 'Course not found', 404);
      return true;
    }
  }
  if (!course.is_active) {
    sendError(res, 'This course is not available', 403);
    return true;
  }
  return false;
}

function includePlatformWideFromQuery(query: Record<string, unknown>): boolean {
  const raw = query.include_platform ?? query.includePlatform;
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === 'true' || v === '1';
}

export function applyCourseListTenantScope(
  req: Request,
  options: Parameters<typeof CourseModel.findAll>[0]
): Parameters<typeof CourseModel.findAll>[0] {
  const user = req.user;
  const queryTenant = parseTenantIdQuery(req.query as Record<string, unknown>);
  const allowPlatformWide = includePlatformWideFromQuery(req.query as Record<string, unknown>);

  if (!user) {
    if (queryTenant != null) {
      return {
        ...options,
        tenant_id: queryTenant,
        include_platform_wide: allowPlatformWide,
        tenant_strict: !allowPlatformWide,
      };
    }
    return { ...options, platform_wide_only: true };
  }

  if (requiresTenant(user.role)) {
    const jwtTenant = getJwtTenantId(user);
    if (jwtTenant == null) {
      return { ...options, tenant_id: -1 };
    }
    return {
      ...options,
      tenant_id: jwtTenant,
      tenant_strict: true,
      include_platform_wide: allowPlatformWide,
      ...(user.role === 'instructor' ? { instructor_id: user.userId } : {}),
      ...(user.role === 'student' &&
      (req.query.enrolled_only === 'true' || req.query.enrolled_only === '1')
        ? { enrolled_user_id: user.userId }
        : {}),
    };
  }

  const tenantId = resolveTenantFilter(user, queryTenant);
  if (tenantId != null) {
    options = {
      ...options,
      tenant_id: tenantId,
      tenant_strict: true,
      include_platform_wide: false,
    };
  }

  if (user.role === 'instructor') {
    options = { ...options, instructor_id: user.userId };
  }

  return options;
}

/** Non-response tenant gate for write paths in other controllers. */
export function cannotAccessCourse(
  req: Request,
  course: { tenant_id?: number | null }
): boolean {
  const user = req.user;
  if (!user || isSuperadmin(user.role)) return false;
  return !assertCourseInTenant(user, course);
}

export type CourseTenantListScope = {
  tenant_id?: number | null;
  platform_wide_only?: boolean;
  tenant_strict?: boolean;
  include_platform_wide?: boolean;
};

export function courseListScopeFromUser(
  user: Parameters<typeof resolveTenantFilter>[0],
  queryTenant?: number | null,
  allowPlatformWide = false
): CourseTenantListScope {
  if (!user) {
    if (queryTenant != null) {
      return {
        tenant_id: queryTenant,
        include_platform_wide: allowPlatformWide,
        tenant_strict: !allowPlatformWide,
      };
    }
    return { platform_wide_only: true };
  }
  if (requiresTenant(user.role)) {
    const jwtTenant = getJwtTenantId(user);
    if (jwtTenant == null) return { tenant_id: -1 };
    return { tenant_id: jwtTenant, tenant_strict: true, include_platform_wide: allowPlatformWide };
  }
  const tenantId = resolveTenantFilter(user, queryTenant);
  if (tenantId == null) return {};
  return { tenant_id: tenantId, tenant_strict: true, include_platform_wide: false };
}

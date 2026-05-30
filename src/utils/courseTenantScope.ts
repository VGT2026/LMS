import { Request, Response } from 'express';
import { CourseModel } from '../models/Course';
import {
  assertCourseInTenant,
  isSuperadmin,
  parseTenantIdQuery,
  resolveTenantFilter,
} from './tenantScope';
import { sendError } from './response';

/**
 * Platform-wide courses (tenant_id IS NULL) are visible in catalog lists for every org.
 * Superadmin ?tenant_id= filters to that org only (strict, excludes platform-wide).
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

export function applyCourseListTenantScope(
  req: Request,
  options: Parameters<typeof CourseModel.findAll>[0]
): Parameters<typeof CourseModel.findAll>[0] {
  const user = req.user;
  const queryTenant = parseTenantIdQuery(req.query as Record<string, unknown>);

  if (!user) {
    if (queryTenant != null) {
      return {
        ...options,
        tenant_id: queryTenant,
        include_platform_wide: true,
        tenant_strict: false,
      };
    }
    return { ...options, platform_wide_only: true };
  }

  const tenantId = resolveTenantFilter(user, queryTenant);
  if (tenantId != null) {
    options = {
      ...options,
      tenant_id: tenantId,
      tenant_strict: isSuperadmin(user.role),
      include_platform_wide: !isSuperadmin(user.role),
    };
  }

  if (user.role === 'instructor') {
    options = { ...options, instructor_id: user.userId };
  } else if (user.role === 'student') {
    const enrolledOnly =
      req.query.enrolled_only === 'true' || req.query.enrolled_only === '1';
    if (enrolledOnly) {
      options = { ...options, enrolled_user_id: user.userId };
    }
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
  queryTenant?: number | null
): CourseTenantListScope {
  if (!user) {
    if (queryTenant != null) {
      return { tenant_id: queryTenant, include_platform_wide: true, tenant_strict: false };
    }
    return { platform_wide_only: true };
  }
  const tenantId = resolveTenantFilter(user, queryTenant);
  if (tenantId == null) return {};
  return {
    tenant_id: tenantId,
    tenant_strict: isSuperadmin(user.role),
    include_platform_wide: !isSuperadmin(user.role),
  };
}

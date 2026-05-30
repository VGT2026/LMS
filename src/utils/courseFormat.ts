import { Course } from '../types';
import { publicTenantFields } from './tenantDisplay';

type CourseRow = Course & {
  tenant_name?: string | null;
  tenant_slug?: string | null;
  instructor_name?: string;
  instructor_email?: string;
};

/** Normalize course API payload with tenant_id and tenant_name on every row. */
export function formatCourseForApi(course: CourseRow): CourseRow & { tenant_id: number | null } {
  const tenantName = course.tenant_name ?? undefined;
  const tenantSlug = course.tenant_slug ?? undefined;
  return {
    ...course,
    instructor: course.instructor ?? course.instructor_name ?? 'Unassigned',
    ...publicTenantFields(course.tenant_id, tenantName, tenantSlug),
  } as CourseRow & { tenant_id: number | null };
}

export function formatCoursesForApi(courses: CourseRow[]): Array<CourseRow & { tenant_id: number | null }> {
  return courses.map(formatCourseForApi);
}

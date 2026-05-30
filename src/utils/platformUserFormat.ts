import { UserRole } from '../types';
import { userIsActive } from './userActive';
import { parseIdStringArray, parseJsonArray } from './jsonArrayFields';
import { publicTenantFields } from './tenantDisplay';

/** Public user row for superadmin student/instructor lists (no password). */
export function formatPlatformUser(
  user: {
    id?: number;
    name: string;
    email: string;
    role: UserRole | string;
    tenant_id?: number | null;
    is_active?: boolean | number | string | null;
    enrolled?: number | bigint;
    preferred_categories?: unknown;
    completed_course_ids?: unknown;
    roadmap_course_ids?: unknown;
    target_job_role_id?: number | string | null;
    created_at?: Date | string | null;
    updated_at?: Date | string | null;
  },
  tenant?: { name?: string | null; slug?: string | null }
) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: userIsActive(user.is_active),
    enrolled: Number(user.enrolled ?? 0),
    preferred_categories: parseJsonArray(user.preferred_categories),
    completed_course_ids: parseIdStringArray(user.completed_course_ids),
    roadmap_course_ids: parseIdStringArray(user.roadmap_course_ids),
    target_job_role_id: user.target_job_role_id ?? null,
    ...(user.created_at != null && { created_at: new Date(user.created_at).toISOString() }),
    ...(user.updated_at != null && { updated_at: new Date(user.updated_at).toISOString() }),
    ...publicTenantFields(user.tenant_id, tenant?.name, tenant?.slug),
  };
}

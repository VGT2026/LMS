import { User } from '../types';
import { parseIdStringArray, parseJsonArray, parseTargetJobRoleId } from './jsonArrayFields';
import { userIsActive } from './userActive';

/** Public profile shape (no password). */
export function formatPublicProfile(user: User) {
  const { password: _pw, ...rest } = user;
  return {
    id: Number(rest.id),
    name: rest.name,
    email: rest.email,
    role: rest.role,
    tenant_id: rest.tenant_id != null ? Number(rest.tenant_id) : null,
    avatar: rest.avatar ?? null,
    is_active: userIsActive(rest.is_active),
    preferred_categories: parseJsonArray(rest.preferred_categories) as string[],
    completed_course_ids: parseIdStringArray(rest.completed_course_ids),
    roadmap_course_ids: parseIdStringArray((rest as User).roadmap_course_ids),
    target_job_role_id: parseTargetJobRoleId(rest.target_job_role_id) ?? rest.target_job_role_id ?? null,
    ...(rest.created_at != null && {
      created_at: new Date(rest.created_at).toISOString(),
    }),
    ...(rest.updated_at != null && {
      updated_at: new Date(rest.updated_at).toISOString(),
    }),
  };
}

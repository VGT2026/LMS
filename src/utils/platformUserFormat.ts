import { UserRole } from '../types';
import { userIsActive } from './userActive';

function parseJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** Public user row for superadmin student/instructor lists (no password). */
export function formatPlatformUser(user: {
  id?: number;
  name: string;
  email: string;
  role: UserRole | string;
  is_active?: boolean | number | string | null;
  enrolled?: number | bigint;
  preferred_categories?: unknown;
  completed_course_ids?: unknown;
  target_job_role_id?: number | null;
  created_at?: Date | string | null;
  updated_at?: Date | string | null;
}) {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: userIsActive(user.is_active),
    enrolled: Number(user.enrolled ?? 0),
    preferred_categories: parseJsonArray(user.preferred_categories),
    completed_course_ids: parseJsonArray(user.completed_course_ids),
    target_job_role_id: user.target_job_role_id ?? null,
    ...(user.created_at != null && { created_at: new Date(user.created_at).toISOString() }),
    ...(user.updated_at != null && { updated_at: new Date(user.updated_at).toISOString() }),
  };
}

import { Request, Response } from 'express';
import { JWTPayload, User, UserRole } from '../types';
import { sendError } from './response';

export function isSuperadmin(role: UserRole): boolean {
  return role === 'superadmin';
}

export function requiresTenant(role: UserRole): boolean {
  return role === 'admin' || role === 'instructor' || role === 'student';
}

export function getJwtTenantId(user?: JWTPayload): number | null {
  if (!user?.tenantId) return null;
  const n = Number(user.tenantId);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Effective tenant filter for DB queries (null = no filter / platform-wide for superadmin). */
export function resolveTenantFilter(
  user: JWTPayload | undefined,
  queryTenantId?: number | null
): number | null {
  if (!user) return null;
  if (isSuperadmin(user.role)) {
    if (queryTenantId != null && queryTenantId > 0) return queryTenantId;
    return null;
  }
  return getJwtTenantId(user);
}

export function assertUserInTenant(actor: JWTPayload, target: Pick<User, 'tenant_id' | 'role'>): boolean {
  if (isSuperadmin(actor.role)) return true;
  const actorTenant = getJwtTenantId(actor);
  if (actorTenant == null) return false;
  if (target.role === 'superadmin') return false;
  if (target.tenant_id == null) return false;
  return Number(target.tenant_id) === actorTenant;
}

export function assertCourseInTenant(
  actor: JWTPayload,
  course: { tenant_id?: number | null }
): boolean {
  if (isSuperadmin(actor.role)) return true;
  const actorTenant = getJwtTenantId(actor);
  if (actorTenant == null) return false;
  if (course.tenant_id == null) return false;
  return Number(course.tenant_id) === actorTenant;
}

export function parseOptionalTenantId(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = parseInt(String(Array.isArray(raw) ? raw[0] : raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Read tenant filter from query (?tenant_id= or ?tenantId=). */
export function parseTenantIdQuery(query: Record<string, unknown>): number | null {
  return (
    parseOptionalTenantId(query.tenant_id) ?? parseOptionalTenantId(query.tenantId)
  );
}

export function forbidClientTenantOverride(req: Request, res: Response): boolean {
  const body = req.body || {};
  if (
    isSuperadmin(req.user?.role as UserRole) ||
    (body.tenant_id === undefined && body.tenantId === undefined)
  ) {
    return false;
  }
  sendError(res, 'tenant_id cannot be set on this request', 403);
  return true;
}

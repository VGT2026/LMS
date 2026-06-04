import { JWTPayload, User } from '../types';
import { TenantModel } from '../models/Tenant';
import { publicTenantFields } from './tenantDisplay';
import { formatPublicProfile } from './profileFormat';

export function buildJwtFromUser(user: User): JWTPayload {
  const payload: JWTPayload = {
    userId: user.id!,
    email: user.email,
    role: user.role,
  };
  if (user.role !== 'superadmin' && user.tenant_id != null && Number(user.tenant_id) > 0) {
    payload.tenantId = Number(user.tenant_id);
  }
  return payload;
}

/** Login/register/Firebase user payload aligned with GET /api/auth/profile. */
export async function buildAuthUserResponse(user: User) {
  const profile = formatPublicProfile(user);
  let tenantName: string | undefined;
  let tenantSlug: string | undefined;
  if (user.tenant_id != null && Number(user.tenant_id) > 0) {
    const t = await TenantModel.findById(Number(user.tenant_id));
    tenantName = t?.name;
    tenantSlug = t?.slug ?? undefined;
  }
  return {
    ...profile,
    ...publicTenantFields(user.tenant_id, tenantName, tenantSlug),
  };
}

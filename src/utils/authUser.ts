import { JWTPayload, User } from '../types';
import { TenantModel } from '../models/Tenant';
import { userIsActive } from './userActive';
import { publicTenantFields } from './tenantDisplay';

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

export async function buildAuthUserResponse(user: User) {
  let tenantName: string | undefined;
  let tenantSlug: string | undefined;
  if (user.tenant_id != null && Number(user.tenant_id) > 0) {
    const t = await TenantModel.findById(Number(user.tenant_id));
    tenantName = t?.name;
    tenantSlug = t?.slug ?? undefined;
  }
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: userIsActive(user.is_active),
    ...publicTenantFields(user.tenant_id, tenantName, tenantSlug),
  };
}

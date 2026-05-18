import { JWTPayload, User } from '../types';
import { TenantModel } from '../models/Tenant';
import { userIsActive } from './userActive';

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
  let tenant_name: string | undefined;
  if (user.tenant_id != null && Number(user.tenant_id) > 0) {
    const t = await TenantModel.findById(Number(user.tenant_id));
    tenant_name = t?.name;
  }
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: userIsActive(user.is_active),
    tenant_id: user.tenant_id != null ? Number(user.tenant_id) : null,
    ...(tenant_name ? { tenant_name } : {}),
  };
}

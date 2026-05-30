import { userIsActive } from './userActive';
import { publicTenantFields } from './tenantDisplay';

export type AdminPublic = {
  id: number;
  name: string;
  email: string;
  role: 'admin';
  is_active: boolean;
  tenant_id: number | null;
  tenant_name?: string;
  created_at?: string;
};

export function formatAdminPublic(user: {
  id?: number;
  name: string;
  email: string;
  role?: string;
  tenant_id?: number | null;
  tenant_name?: string;
  tenant_slug?: string | null;
  is_active?: boolean | number | string | null;
  created_at?: Date | string | null;
}): AdminPublic {
  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: 'admin',
    is_active: userIsActive(user.is_active),
    ...publicTenantFields(user.tenant_id, user.tenant_name, user.tenant_slug),
    ...(user.created_at != null && {
      created_at: new Date(user.created_at).toISOString(),
    }),
  };
}

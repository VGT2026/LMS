import { TenantModel, TenantRow } from '../models/Tenant';
import { isHiddenTenantDisplayName, isHiddenTenantSlug } from './tenantDisplay';
import { parseOptionalTenantId } from './tenantScope';
import { userIsActive } from './userActive';

export function isPublicSignupTenant(t: TenantRow): boolean {
  return userIsActive(t.is_active) && !isHiddenTenantDisplayName(t.name) && !isHiddenTenantSlug(t.slug);
}

export async function listPublicSignupOrganizations(): Promise<Array<{ id: number; name: string }>> {
  const rows = await TenantModel.findAll(true);
  return rows.filter(isPublicSignupTenant).map((t) => ({ id: t.id, name: t.name }));
}

export type RegistrationTenantResult =
  | { ok: true; tenant_id: number }
  | { ok: false; message: string };

/** Resolve tenant for student self-registration (tenant_id from body is source of truth). */
export async function resolveRegistrationTenantId(rawTenantId: unknown): Promise<RegistrationTenantResult> {
  const publicOrgs = await listPublicSignupOrganizations();

  if (publicOrgs.length > 0) {
    const tenantId = parseOptionalTenantId(rawTenantId);
    if (tenantId == null) {
      return { ok: false, message: 'Please select a valid organization' };
    }
    const tenant = await TenantModel.findById(tenantId);
    if (!tenant || !isPublicSignupTenant(tenant)) {
      return { ok: false, message: 'Please select a valid organization' };
    }
    return { ok: true, tenant_id: tenantId };
  }

  const defaultTenantId = parseInt(process.env.DEFAULT_TENANT_ID || '1', 10);
  const tenant_id = Number.isFinite(defaultTenantId) && defaultTenantId > 0 ? defaultTenantId : 1;
  return { ok: true, tenant_id };
}

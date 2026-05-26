/** Tenant labels we do not expose to end users (legacy seed / placeholder org). */
const HIDDEN_TENANT_NAMES = new Set(['platform default']);
const HIDDEN_TENANT_SLUGS = new Set(['platform-default']);

export function isHiddenTenantDisplayName(name: string | null | undefined): boolean {
  if (!name?.trim()) return false;
  return HIDDEN_TENANT_NAMES.has(name.trim().toLowerCase());
}

export function isHiddenTenantSlug(slug: string | null | undefined): boolean {
  if (!slug?.trim()) return false;
  return HIDDEN_TENANT_SLUGS.has(slug.trim().toLowerCase());
}

/** Public API tenant fields — omits tenant_name for placeholder org names. */
export function publicTenantFields(
  tenantId: number | null | undefined,
  tenantName?: string | null,
  tenantSlug?: string | null
): { tenant_id: number | null; tenant_name?: string } {
  const id =
    tenantId != null && Number(tenantId) > 0 && Number.isFinite(Number(tenantId))
      ? Number(tenantId)
      : null;
  if (id == null) {
    return { tenant_id: null };
  }
  if (isHiddenTenantDisplayName(tenantName) || isHiddenTenantSlug(tenantSlug)) {
    return { tenant_id: id };
  }
  const trimmed = tenantName?.trim();
  return trimmed ? { tenant_id: id, tenant_name: trimmed } : { tenant_id: id };
}

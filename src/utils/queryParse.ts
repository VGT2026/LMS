/** First value for a query field (repeated keys become arrays; `Number([x])` is NaN). */
export function queryScalar(v: unknown): string | undefined {
  if (v === undefined || v === null) return undefined;
  if (Array.isArray(v)) return v.length > 0 && v[0] != null ? String(v[0]) : undefined;
  if (typeof v === 'object') return undefined;
  return String(v);
}

/** Safe integers for MySQL LIMIT/OFFSET (NaN binds break mysql2 pooled statements). */
export function parsePageLimit(
  rawPage: unknown,
  rawLimit: unknown,
  maxLimit: number = 10_000
): { page: number; limit: number } {
  const pStr = queryScalar(rawPage);
  const lStr = queryScalar(rawLimit);

  const p = pStr !== undefined && pStr !== '' ? Number(pStr) : 1;
  const l = lStr !== undefined && lStr !== '' ? Number(lStr) : 10;

  const page = Number.isFinite(p) && p >= 1 ? Math.min(Math.floor(p), 1_000_000) : 1;
  const cap = Math.max(1, Math.min(maxLimit, 100_000));
  const limit = Number.isFinite(l) && l >= 1 ? Math.min(Math.max(Math.floor(l), 1), cap) : 10;

  return { page, limit };
}

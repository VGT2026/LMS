/** Parse MySQL JSON column or API array into a plain array. */
export function parseJsonArray(raw: unknown): unknown[] {
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

/** Course / roadmap IDs as strings (frontend contract). */
export function parseIdStringArray(raw: unknown): string[] {
  const arr = parseJsonArray(raw);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of arr) {
    const s = String(item).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function parseTargetJobRoleId(raw: unknown): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

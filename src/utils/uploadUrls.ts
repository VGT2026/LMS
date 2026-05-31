/** Server origin for static /uploads URLs (no /api suffix). */
export function getPublicAssetOrigin(): string {
  const port = process.env.PORT || '3001';
  const raw = (process.env.API_BASE_URL || process.env.PUBLIC_URL || `http://localhost:${port}`).trim();
  return raw.replace(/\/api\/?$/i, '').replace(/\/$/, '');
}

/** Turn a stored path or relative upload URL into a browser-loadable absolute URL. */
export function resolvePublicUploadUrl(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed.replace(/\/api\/uploads\//i, '/uploads/');
  }
  if (trimmed.startsWith('/uploads/')) {
    return `${getPublicAssetOrigin()}${trimmed}`;
  }
  if (trimmed.startsWith('uploads/')) {
    return `${getPublicAssetOrigin()}/${trimmed}`;
  }
  return trimmed;
}

export function buildUploadFileUrl(subdir: string, filename: string): string {
  return `${getPublicAssetOrigin()}/uploads/${subdir}/${filename}`;
}

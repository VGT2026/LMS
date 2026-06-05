import { Request } from 'express';
import { buildUploadFileUrl, normalizeUploadPathForStorage } from './uploadUrls';
import { pickUploadedImage } from './imageUpload';

const THUMBNAIL_BODY_FIELDS = [
  'image',
  'imageUrl',
  'image_url',
  'coverImage',
  'cover_image',
  'thumbnail',
  'thumbnail_url',
  'thumbnailUrl',
] as const;

/** Read thumbnail/image from JSON body (supports common frontend field names). */
export function parseCourseThumbnailFromBody(body: Record<string, unknown>): string | null {
  for (const field of THUMBNAIL_BODY_FIELDS) {
    const raw = body[field];
    if (typeof raw !== 'string') continue;
    const stored = normalizeUploadPathForStorage(raw);
    if (stored) return stored;
  }
  return null;
}

/** Read thumbnail from multipart file upload and/or JSON body fields. */
export function parseCourseThumbnailFromRequest(req: Request): string | null {
  const uploaded = pickUploadedImage(req);
  if (uploaded) {
    return normalizeUploadPathForStorage(buildUploadFileUrl('images', uploaded.filename));
  }
  return parseCourseThumbnailFromBody(req.body as Record<string, unknown>);
}

export function isCourseThumbnailClearRequested(body: Record<string, unknown>): boolean {
  return (
    body.thumbnail === '' ||
    body.thumbnail_url === '' ||
    body.thumbnailUrl === '' ||
    body.image === '' ||
    body.image_url === '' ||
    body.imageUrl === ''
  );
}

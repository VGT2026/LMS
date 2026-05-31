import { resolvePublicUploadUrl } from './uploadUrls';

/** Read thumbnail/image from JSON body (supports common frontend field names). */
export function parseCourseThumbnailFromBody(body: Record<string, unknown>): string | null {
  const raw =
    body.thumbnail ??
    body.thumbnail_url ??
    body.thumbnailUrl ??
    body.image ??
    body.imageUrl ??
    body.image_url ??
    body.coverImage ??
    body.cover_image;

  if (typeof raw !== 'string') return null;
  return resolvePublicUploadUrl(raw);
}

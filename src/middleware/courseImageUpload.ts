import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { courseImageUpload } from '../utils/imageUpload';
import { sendError } from '../utils/response';

/** Accept optional course cover image on create/update (JSON or multipart). */
export function optionalCourseImageUpload(req: Request, res: Response, next: NextFunction): void {
  courseImageUpload.fields([
    { name: 'image', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'file', maxCount: 1 },
  ])(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      sendError(res, err.message, 400);
      return;
    }
    if (err instanceof Error) {
      sendError(res, err.message, 400);
      return;
    }
    next();
  });
}

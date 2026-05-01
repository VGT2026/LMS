import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/auth';
import { JWTPayload } from '../types';
import { sendError } from '../utils/response';
import { UserRole } from '../types';
import { UserModel } from '../models/User';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: JWTPayload;
    }
  }
}

export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      sendError(res, 'Access token required', 401);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = verifyToken(token);

    // Verify user is still active in database (blocks deactivated users from accessing API)
    const user = await UserModel.findById(decoded.userId);
    if (!user) {
      sendError(res, 'User not found', 401);
      return;
    }
    if (!user.is_active) {
      sendError(res, 'Account is deactivated. Please contact administrator.', 401);
      return;
    }

    req.user = decoded;
    next();
  } catch (error) {
    sendError(res, 'Invalid or expired token', 401);
  }
};

/** Optional auth: sets req.user if valid token present, does not fail if no token */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }
    const token = authHeader.substring(7);
    const decoded = verifyToken(token);
    const user = await UserModel.findById(decoded.userId);
    if (user && user.is_active) {
      req.user = decoded;
    }
    next();
  } catch {
    next();
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    if (!roles.includes(req.user.role)) {
      sendError(res, 'Insufficient permissions', 403);
      return;
    }

    next();
  };
};

// Specific role-based middleware
export const requireStudent = authorize('student');
export const requireInstructor = authorize('instructor');
export const requireAdmin = authorize('admin');
export const requireInstructorOrAdmin = authorize('instructor', 'admin');
export const requireAnyAuthenticated = authorize('student', 'instructor', 'admin');
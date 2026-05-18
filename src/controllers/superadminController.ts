import { Request, Response } from 'express';
import { sendSuccess, sendError, sendPagination } from '../utils/response';
import { UserModel } from '../models/User';
import { CourseModel } from '../models/Course';
import { AuditLogModel } from '../models/AuditLog';
import { validatePasswordStrength } from '../utils/passwordPolicy';
import { parsePageLimit, queryScalar } from '../utils/queryParse';

function adminPublic(user: { id?: number; name: string; email: string; role: string; is_active: boolean }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    is_active: user.is_active,
  };
}

/** POST /api/auth/superadmin/admin */
export const createAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = req.user!;
    const { name, email, password } = req.body || {};

    if (!name || !email || !password) {
      sendError(res, 'Name, email, and password are required', 400);
      return;
    }

    const nameTrim = String(name).trim();
    if (nameTrim.length < 2) {
      sendError(res, 'Name must be at least 2 characters long', 400);
      return;
    }

    const emailNorm = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailNorm)) {
      sendError(res, 'Please enter a valid email address', 400);
      return;
    }

    const pwdError = validatePasswordStrength(String(password));
    if (pwdError) {
      sendError(res, pwdError, 400);
      return;
    }

    if (await UserModel.existsByEmail(emailNorm)) {
      sendError(res, 'User with this email already exists', 409);
      return;
    }

    let firebaseUid: string | undefined;
    const { ensureFirebaseUser, isFirebaseConfigured } = await import('../utils/firebase');
    if (isFirebaseConfigured()) {
      try {
        const fb = await ensureFirebaseUser(emailNorm, String(password), nameTrim);
        if (fb) firebaseUid = fb.uid;
      } catch (err: any) {
        const code = err?.code || err?.errorInfo?.code || '';
        if (code === 'auth/email-already-exists') {
          sendError(res, 'User with this email already exists in Firebase', 409);
          return;
        }
        console.error('Firebase create admin error:', err);
        sendError(res, 'Failed to create Firebase login for admin. Try again or check Firebase config.', 500);
        return;
      }
    }

    const created = await UserModel.create({
      name: nameTrim,
      email: emailNorm,
      password: String(password),
      role: 'admin',
      is_active: true,
      firebase_uid: firebaseUid,
    });

    await AuditLogModel.record({
      actor_id: actor.userId,
      action: 'superadmin.admin.create',
      target_user_id: created.id,
      metadata: { email: emailNorm },
    });

    sendSuccess(
      res,
      {
        ...adminPublic(created),
        firebaseLinked: Boolean(firebaseUid),
        loginHint: firebaseUid
          ? 'Sign in with email and password (Firebase or /api/auth/login).'
          : 'Sign in with POST /api/auth/login using this email and password.',
      },
      'Admin account created successfully',
      201
    );
  } catch (err) {
    console.error('createAdmin error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** POST /api/auth/superadmin/admins/:userId/sync-firebase — link Firebase login for an existing admin */
export const syncAdminFirebase = async (req: Request, res: Response): Promise<void> => {
  try {
    const idParam = req.params.userId ?? req.params.id;
    const idString = Array.isArray(idParam) ? idParam[0] : idParam;
    const userId = parseInt(String(idString), 10);
    const { password } = req.body || {};

    if (isNaN(userId)) {
      sendError(res, 'Invalid user ID', 400);
      return;
    }
    if (!password || String(password).length < 8) {
      sendError(res, 'password is required (min 8 characters) to sync Firebase login', 400);
      return;
    }

    const target = await UserModel.findById(userId);
    if (!target) {
      sendError(res, 'User not found', 404);
      return;
    }
    if (target.role !== 'admin') {
      sendError(res, 'Can only sync Firebase for admin users', 400);
      return;
    }

    const { ensureFirebaseUser, isFirebaseConfigured } = await import('../utils/firebase');
    if (!isFirebaseConfigured()) {
      sendError(res, 'Firebase is not configured on this server', 503);
      return;
    }

    const fb = await ensureFirebaseUser(target.email, String(password), target.name);
    if (!fb) {
      sendError(res, 'Failed to sync Firebase user', 500);
      return;
    }

    const updated = await UserModel.update(userId, {
      firebase_uid: fb.uid,
      password: String(password),
    });

    await AuditLogModel.record({
      actor_id: req.user!.userId,
      action: 'superadmin.admin.firebase_sync',
      target_user_id: userId,
    });

    const safe = updated ? adminPublic(updated) : adminPublic(target);
    sendSuccess(res, { ...safe, firebaseLinked: true }, 'Admin Firebase login synced');
  } catch (err) {
    console.error('syncAdminFirebase error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** GET /api/auth/superadmin/admins */
export const listAdmins = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit } = parsePageLimit(req.query.page, req.query.limit);
    const search = queryScalar(req.query.search)?.trim();

    const result = await UserModel.findAll({
      page,
      limit,
      role: 'admin',
      search: search || undefined,
    });

    const admins = result.users.map((u) => {
      const { password: _, ...rest } = u;
      return rest;
    });

    sendPagination(res, admins, result.page, result.limit, result.total, 'Admins retrieved successfully');
  } catch (err) {
    console.error('listAdmins error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** PATCH /api/auth/superadmin/admins/:userId/deactivate — toggles is_active for admin users only */
export const toggleAdminDeactivate = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = req.user!;
    const idParam = req.params.userId ?? req.params.id;
    const idString = Array.isArray(idParam) ? idParam[0] : idParam;
    const userId = parseInt(String(idString), 10);

    if (isNaN(userId)) {
      sendError(res, 'Invalid user ID', 400);
      return;
    }

    if (userId === actor.userId) {
      sendError(res, 'Cannot deactivate your own account', 400);
      return;
    }

    const target = await UserModel.findById(userId);
    if (!target) {
      sendError(res, 'User not found', 404);
      return;
    }

    if (target.role !== 'admin') {
      sendError(res, 'Can only toggle status for admin users', 400);
      return;
    }

    const updated = await UserModel.toggleActiveStatus(userId);
    if (!updated) {
      sendError(res, 'User not found', 404);
      return;
    }

    await AuditLogModel.record({
      actor_id: actor.userId,
      action: updated.is_active ? 'superadmin.admin.activate' : 'superadmin.admin.deactivate',
      target_user_id: userId,
    });

    const { password: _, ...safe } = updated;
    sendSuccess(res, safe, 'Admin status updated successfully');
  } catch (err) {
    console.error('toggleAdminDeactivate error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** GET /api/auth/superadmin/stats */
export const getSuperadminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [userStats, courseCounts] = await Promise.all([
      UserModel.getStats(),
      CourseModel.getDashboardCounts(),
    ]);

    sendSuccess(
      res,
      {
        totalUsers: Number(userStats.total),
        activeUsers: Number(userStats.active),
        totalAdmins: Number(userStats.byRole.admin),
        totalSuperadmins: Number(userStats.byRole.superadmin),
        totalInstructors: Number(userStats.byRole.instructor),
        totalStudents: Number(userStats.byRole.student),
        totalCourses: Number(courseCounts.total),
        activeCourses: Number(courseCounts.active),
        usersByRole: userStats.byRole,
      },
      'Superadmin stats retrieved'
    );
  } catch (err) {
    console.error('getSuperadminStats error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

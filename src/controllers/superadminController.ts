import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { UserModel } from '../models/User';
import { CourseModel } from '../models/Course';
import { AuditLogModel } from '../models/AuditLog';
import { validateAdminPassword } from '../utils/passwordPolicy';
import { parsePageLimit, queryScalar } from '../utils/queryParse';
import { formatAdminPublic } from '../utils/adminUserFormat';

async function tryLinkFirebase(
  email: string,
  password: string,
  displayName: string
): Promise<string | undefined> {
  try {
    const { ensureFirebaseUser, isFirebaseConfigured } = await import('../utils/firebase');
    if (!isFirebaseConfigured()) return undefined;
    const fb = await ensureFirebaseUser(email, password, displayName);
    return fb?.uid;
  } catch (err) {
    console.warn('[Superadmin] Firebase link skipped (admin still created in DB):', (err as Error)?.message ?? err);
    return undefined;
  }
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

    const pwdError = validateAdminPassword(String(password));
    if (pwdError) {
      sendError(res, pwdError, 400);
      return;
    }

    if (await UserModel.existsByEmail(emailNorm)) {
      sendError(res, 'User with this email already exists', 409);
      return;
    }

    const firebaseUid = await tryLinkFirebase(emailNorm, String(password), nameTrim);

    let created;
    try {
      created = await UserModel.create({
        name: nameTrim,
        email: emailNorm,
        password: String(password),
        role: 'admin',
        is_active: true,
        firebase_uid: firebaseUid,
      });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        sendError(res, 'User with this email already exists', 409);
        return;
      }
      console.error('createAdmin DB insert error:', err);
      throw err;
    }

    await AuditLogModel.record({
      actor_id: actor.userId,
      action: 'superadmin.admin.create',
      target_user_id: created.id,
      metadata: { email: emailNorm, firebaseLinked: Boolean(firebaseUid) },
    });

    sendSuccess(
      res,
      { admin: formatAdminPublic(created) },
      'Admin account created successfully',
      201
    );
  } catch (err: any) {
    console.error('createAdmin error:', err);
    const detail = err?.message || String(err);
    sendError(
      res,
      process.env.NODE_ENV === 'development' ? `Internal server error: ${detail}` : 'Internal server error',
      500,
      process.env.NODE_ENV === 'development' ? detail : undefined
    );
  }
};

/** POST /api/auth/superadmin/admins/:userId/sync-firebase */
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
    const pwdError = validateAdminPassword(String(password || ''));
    if (pwdError) {
      sendError(res, pwdError, 400);
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

    const row = updated || target;
    sendSuccess(res, { admin: formatAdminPublic(row), firebaseLinked: true }, 'Admin Firebase login synced');
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

    const admins = result.users.map((u) => formatAdminPublic(u));

    sendSuccess(res, admins, 'Admins retrieved successfully');
  } catch (err: any) {
    console.error('listAdmins error:', err);
    sendError(
      res,
      process.env.NODE_ENV === 'development' ? `Internal server error: ${err.message}` : 'Internal server error',
      500
    );
  }
};

/** PATCH /api/auth/superadmin/admins/:userId/deactivate */
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

    sendSuccess(res, { admin: formatAdminPublic(updated) }, 'Admin status updated successfully');
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

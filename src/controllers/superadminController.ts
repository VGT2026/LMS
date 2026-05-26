import { Request, Response } from 'express';
import { sendSuccess, sendError, sendPagination } from '../utils/response';
import { UserModel } from '../models/User';
import { CourseModel } from '../models/Course';
import { AuditLogModel } from '../models/AuditLog';
import { validateAdminPassword } from '../utils/passwordPolicy';
import { parsePageLimit, queryScalar } from '../utils/queryParse';
import { formatAdminPublic } from '../utils/adminUserFormat';
import { formatPlatformUser } from '../utils/platformUserFormat';
import { UserRole } from '../types';
import { TenantModel } from '../models/Tenant';
import { parseOptionalTenantId } from '../utils/tenantScope';

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
    const { name, email, password, tenant_name } = req.body || {};

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

    const tenantNameTrim = String(tenant_name ?? '').trim();
    if (tenantNameTrim.length < 2) {
      sendError(res, 'tenant_name is required', 400);
      return;
    }

    const createdTenant = await TenantModel.createUniqueFromName(tenantNameTrim);
    const tenantId = createdTenant.id;

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
        tenant_id: tenantId,
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
      metadata: { email: emailNorm, firebaseLinked: Boolean(firebaseUid), tenantId },
    });

    const tenant = await TenantModel.findById(tenantId);
    sendSuccess(
      res,
      {
        admin: formatAdminPublic({
          ...created,
          tenant_id: tenantId,
          tenant_name: tenant?.name,
        }),
      },
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

async function listUsersByRole(
  req: Request,
  res: Response,
  role: Extract<UserRole, 'student' | 'instructor'>,
  label: string
): Promise<void> {
  try {
    const { page, limit } = parsePageLimit(req.query.page, req.query.limit);
    const search = queryScalar(req.query.search)?.trim();

    const tenant_id = parseOptionalTenantId(req.query.tenant_id);

    const result = await UserModel.findAll({
      page,
      limit,
      role,
      search: search || undefined,
      ...(tenant_id != null ? { tenant_id } : {}),
    });

    const rows = result.users.map((u) => formatPlatformUser(u));
    sendPagination(res, rows, result.page, result.limit, result.total, `${label} retrieved successfully`);
  } catch (err: any) {
    console.error(`listUsersByRole(${role}) error:`, err);
    sendError(
      res,
      process.env.NODE_ENV === 'development' ? `Internal server error: ${err.message}` : 'Internal server error',
      500
    );
  }
}

/** GET /api/auth/superadmin/students */
export const listStudents = async (req: Request, res: Response): Promise<void> => {
  await listUsersByRole(req, res, 'student', 'Students');
};

/** GET /api/auth/superadmin/instructors */
export const listSuperadminInstructors = async (req: Request, res: Response): Promise<void> => {
  await listUsersByRole(req, res, 'instructor', 'Instructors');
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

/** GET /api/auth/superadmin/tenants */
export const listTenants = async (req: Request, res: Response): Promise<void> => {
  try {
    const activeOnly = req.query.active_only === 'true';
    const tenants = await TenantModel.findAll(activeOnly);
    sendSuccess(res, tenants, 'Tenants retrieved successfully');
  } catch (err) {
    console.error('listTenants error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** PATCH /api/auth/superadmin/users/:userId/tenant */
export const moveUserTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const actor = req.user!;
    const idParam = req.params.userId ?? req.params.id;
    const userId = parseInt(String(Array.isArray(idParam) ? idParam[0] : idParam), 10);
    const tenantId = parseOptionalTenantId(req.body?.tenant_id);

    if (isNaN(userId)) {
      sendError(res, 'Invalid user ID', 400);
      return;
    }
    if (tenantId == null) {
      sendError(res, 'tenant_id is required', 400);
      return;
    }

    const tenant = await TenantModel.findById(tenantId);
    if (!tenant) {
      sendError(res, 'Tenant not found', 404);
      return;
    }

    const target = await UserModel.findById(userId);
    if (!target) {
      sendError(res, 'User not found', 404);
      return;
    }
    if (target.role === 'superadmin') {
      sendError(res, 'Cannot assign tenant to superadmin', 400);
      return;
    }

    const updated = await UserModel.update(userId, { tenant_id: tenantId });
    await AuditLogModel.record({
      actor_id: actor.userId,
      action: 'superadmin.user.tenant_move',
      target_user_id: userId,
      metadata: { tenantId },
    });

    sendSuccess(res, { user: updated, tenant }, 'User moved to tenant');
  } catch (err) {
    console.error('moveUserTenant error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** GET /api/auth/superadmin/stats */
export const getSuperadminStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [userStats, courseCounts, tenants] = await Promise.all([
      UserModel.getStats(),
      CourseModel.getDashboardCounts(),
      TenantModel.findAll(true),
    ]);

    const byTenant = await Promise.all(
      tenants.map(async (t) => {
        const [users, courses] = await Promise.all([
          UserModel.getStats(t.id),
          CourseModel.getDashboardCounts(t.id),
        ]);
        return {
          tenantId: t.id,
          name: t.name,
          slug: t.slug,
          totalUsers: Number(users.total),
          activeUsers: Number(users.active),
          totalStudents: Number(users.byRole.student),
          totalInstructors: Number(users.byRole.instructor),
          totalAdmins: Number(users.byRole.admin),
          totalCourses: Number(courses.total),
          activeCourses: Number(courses.active),
        };
      })
    );

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
        byTenant,
      },
      'Superadmin stats retrieved'
    );
  } catch (err) {
    console.error('getSuperadminStats error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

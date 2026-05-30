import { Router, Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import {
  login,
  register,
  getProfile,
  updateProfile,
  changePassword,
  createInstructor,
  getAllUsers,
  getInstructors,
  toggleUserStatus,
  updateUserRole,
  resetAdminDev,
  devAdminLogin,
  firebaseAuth,
  searchUsers,
  listPublicOrganizations,
} from '../controllers/authController';
import {
  getCareerRoadmap,
  replaceRoadmapCourses,
  appendRoadmapCourse,
  removeRoadmapCourse,
} from '../controllers/careerRoadmapController';
import {
  createAdmin,
  listAdmins,
  toggleAdminDeactivate,
  syncAdminFirebase,
  getSuperadminStats,
  listStudents,
  listSuperadminInstructors,
  listTenants,
  moveUserTenant,
  getAdminOverview,
} from '../controllers/superadminController';
import { authenticate, requireAdmin, requireSuperadmin } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import { USER_ROLES } from '../utils/rolePolicy';

const router = Router();

const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map((e: any) => e.msg || e.path).join(', ');
    return res.status(400).json({ success: false, message: msg || 'Validation failed' });
  }
  next();
};

const createAdminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: parseInt(process.env.SUPERADMIN_CREATE_ADMIN_MAX || '5', 10),
  message: {
    success: false,
    message: 'Too many create-admin attempts. Please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const loginValidation = [
  body('email').isEmail().withMessage('Valid email required').trim(),
  body('password').notEmpty().withMessage('Password required'),
];

const registerValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('confirmPassword').custom((value, { req }) => {
    if (value !== req.body.password) {
      throw new Error('Password confirmation does not match password');
    }
    return true;
  }),
  body('tenant_id').optional().isInt({ min: 1 }).withMessage('tenant_id must be a positive integer'),
];

const createAdminValidation = [
  body('name').trim().isLength({ min: 2, max: 50 }).withMessage('Name must be 2–50 characters'),
  body('tenant_name')
    .trim()
    .notEmpty()
    .isLength({ min: 2, max: 255 })
    .withMessage('tenant_name must be at least 2 characters'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
];

// Public routes
router.get('/organizations', listPublicOrganizations);
router.get('/tenants', listPublicOrganizations);
router.post('/login', loginValidation, handleValidation, login);
router.post('/register', registerValidation, handleValidation, register);
router.post(
  '/firebase',
  [body('idToken').notEmpty().withMessage('Firebase ID token required')],
  handleValidation,
  firebaseAuth
);

router.get('/reset-admin', resetAdminDev);
router.post('/dev-admin-login', devAdminLogin);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.post('/profile', authenticate, updateProfile);
router.patch('/profile', authenticate, updateProfile);
router.get('/career-roadmap', authenticate, getCareerRoadmap);
router.put('/career-roadmap/courses', authenticate, replaceRoadmapCourses);
router.post('/career-roadmap/courses/:courseId', authenticate, appendRoadmapCourse);
router.delete('/career-roadmap/courses/:courseId', authenticate, removeRoadmapCourse);
router.post('/change-password', authenticate, changePassword);
router.patch('/change-password', authenticate, changePassword);
router.get('/search', authenticate, searchUsers);
router.get('/instructors', authenticate, getInstructors);

// Admin dashboard routes (admin + superadmin)
router.get('/admin/instructors', authenticate, requireAdmin, getInstructors);

router.post(
  '/admin/instructor',
  authenticate,
  requireAdmin,
  [
    body('name').trim().isLength({ min: 2, max: 50 }),
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
  ],
  handleValidation,
  createInstructor
);

router.get('/admin/users', authenticate, requireAdmin, getAllUsers);
router.patch('/admin/users/:id/toggle-status', authenticate, requireAdmin, toggleUserStatus);
router.patch(
  '/admin/users/:id/role',
  authenticate,
  requireAdmin,
  [body('role').isIn(USER_ROLES)],
  handleValidation,
  updateUserRole
);

// Superadmin-only routes
router.post(
  '/superadmin/admin',
  authenticate,
  requireSuperadmin,
  createAdminLimiter,
  createAdminValidation,
  handleValidation,
  createAdmin
);

router.get('/superadmin/students', authenticate, requireSuperadmin, listStudents);
router.get('/superadmin/instructors', authenticate, requireSuperadmin, listSuperadminInstructors);
router.get('/superadmin/admins', authenticate, requireSuperadmin, listAdmins);
router.get(
  '/superadmin/admins/:adminId/overview',
  authenticate,
  requireSuperadmin,
  getAdminOverview
);

router.patch(
  '/superadmin/admins/:userId/deactivate',
  authenticate,
  requireSuperadmin,
  toggleAdminDeactivate
);

router.post(
  '/superadmin/admins/:userId/sync-firebase',
  authenticate,
  requireSuperadmin,
  [body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')],
  handleValidation,
  syncAdminFirebase
);

router.get('/superadmin/stats', authenticate, requireSuperadmin, getSuperadminStats);
router.get('/superadmin/tenants', authenticate, requireSuperadmin, listTenants);
router.patch(
  '/superadmin/users/:userId/tenant',
  authenticate,
  requireSuperadmin,
  [body('tenant_id').isInt({ min: 1 }).withMessage('tenant_id must be a positive integer')],
  handleValidation,
  moveUserTenant
);

export default router;

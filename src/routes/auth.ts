import { Router, Request, Response, NextFunction } from 'express';
import { login, register, getProfile, updateProfile, changePassword, createInstructor, getAllUsers, getInstructors, toggleUserStatus, updateUserRole, resetAdminDev, devAdminLogin, firebaseAuth, searchUsers } from '../controllers/authController';
import { authenticate, requireAdmin } from '../middleware/auth';
import { body, validationResult } from 'express-validator';

const router = Router();

const handleValidation = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors.array().map((e: any) => e.msg || e.path).join(', ');
    return res.status(400).json({ success: false, message: msg || 'Validation failed' });
  }
  next();
};

// Validation middleware (no normalizeEmail - we normalize in controller to avoid any transform issues)
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
];

// Public routes
router.post('/login', loginValidation, handleValidation, login);
router.post('/register', registerValidation, handleValidation, register);
router.post('/firebase', [
  body('idToken').notEmpty().withMessage('Firebase ID token required'),
], handleValidation, firebaseAuth);

// Forgot/reset password: use Firebase sendPasswordResetEmail on frontend (no backend implementation)

// Dev-only: reset admin password (visit /api/auth/reset-admin in browser)
router.get('/reset-admin', resetAdminDev);
// Dev-only: login as admin with just password (bypasses email)
router.post('/dev-admin-login', devAdminLogin);

// Protected routes
router.get('/profile', authenticate, getProfile);
// POST aliases: some environments/proxies mishandle PATCH — same handlers
router.post('/profile', authenticate, updateProfile);
router.patch('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);
router.patch('/change-password', authenticate, changePassword);
router.get('/search', authenticate, searchUsers);
router.get('/instructors', authenticate, getInstructors); // Allow all auth users to see instructors

// Admin routes
router.post('/admin/instructor', authenticate, requireAdmin, [
  body('name').trim().isLength({ min: 2, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
], createInstructor);

router.get('/admin/users', authenticate, requireAdmin, getAllUsers);

// router.get('/admin/instructors', authenticate, requireAdmin, getInstructors); // Moved to public authenticated

router.patch('/admin/users/:id/toggle-status', authenticate, requireAdmin, toggleUserStatus);

router.patch('/admin/users/:id/role', authenticate, requireAdmin, [
  body('role').isIn(['student', 'instructor', 'admin']),
], updateUserRole);

export default router;
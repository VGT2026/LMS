import crypto from 'crypto';
import { Request, Response } from 'express';
import { sendSuccess, sendError, sendPagination } from '../utils/response';
import { comparePassword, generateToken, hashPassword } from '../utils/auth';
import { LoginRequest, RegisterRequest, User, UserRole } from '../types';
import { UserModel } from '../models/User';
import { verifyFirebaseToken, isFirebaseConfigured } from '../utils/firebase';
import { parsePageLimit, queryScalar } from '../utils/queryParse';

/** Dev-only: Direct admin login by password only. POST /api/auth/dev-admin-login { "password": "..." } */
export const devAdminLogin = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') {
    sendError(res, 'Not available', 403);
    return;
  }
  try {
    const { password } = req.body || {};
    const devPassword = process.env.DEV_ADMIN_PASSWORD || 'admin123';
    if (password !== devPassword) {
      sendError(res, 'Invalid credentials', 401);
      return;
    }
    const admin = await UserModel.findByEmail('admin@lmspro.com');
    if (!admin || admin.role !== 'admin') {
      sendError(res, 'Admin not found. Visit /api/auth/reset-admin first', 404);
      return;
    }
    const token = generateToken({ userId: admin.id!, email: admin.email, role: admin.role });
    const { password: _, ...user } = admin;
    sendSuccess(res, { user, token }, 'Login successful');
  } catch (err) {
    console.error('Dev admin login error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** Dev-only: Reset admin password to admin123. Visit GET /api/auth/reset-admin */
export const resetAdminDev = async (req: Request, res: Response): Promise<void> => {
  if (process.env.NODE_ENV !== 'development') {
    sendError(res, 'Not available in production', 403);
    return;
  }
  try {
    const adminEmail = 'admin@lmspro.com';
    const adminPassword = process.env.DEV_ADMIN_PASSWORD || 'admin123';
    const existing = await UserModel.findByEmail(adminEmail);
    if (!existing) {
      const hash = await hashPassword(adminPassword);
      await UserModel.create({
        name: 'System Administrator',
        email: adminEmail,
        password: hash,
        role: 'admin',
        is_active: true,
      });
      sendSuccess(res, { message: 'Admin account created successfully.' }, 'Admin created');
    } else {
      const hash = await hashPassword(adminPassword);
      await UserModel.update(existing.id!, { password: hash });
      sendSuccess(res, { message: 'Admin password reset successfully.' }, 'Password reset');
    }
  } catch (err) {
    console.error('Reset admin error:', err);
    sendError(res, 'Failed to reset admin', 500);
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password }: LoginRequest = req.body;

    // Validate input
    if (!email || !password) {
      sendError(res, 'Email and password are required', 400);
      return;
    }

    // Normalize email (lowercase) for lookup
    const normalizedEmail = String(email).trim().toLowerCase();

    // Find user by email
    const user = await UserModel.findByEmail(normalizedEmail);
    if (!user) {
      console.warn('[AUTH] Login failed - user not found:', normalizedEmail);
      sendError(res, 'Invalid credentials', 401);
      return;
    }

    // Check if user is active
    if (!user.is_active) {
      console.warn('[AUTH] Login failed - account deactivated:', normalizedEmail);
      sendError(res, 'Account is deactivated', 401);
      return;
    }

    // Firebase users have no password; they must use Firebase login
    if (!user.password) {
      console.warn('[AUTH] Login failed - firebase-only user:', normalizedEmail);
      sendError(res, 'Use Firebase sign-in for this account', 401);
      return;
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      sendError(res, 'Invalid credentials', 401);
      return;
    }

    // Generate token
    const token = generateToken({
      userId: user.id!,
      email: user.email,
      role: user.role,
    });

    // Return user info (excluding password)
    const { password: _, ...userWithoutPassword } = user;

    sendSuccess(res, {
      user: userWithoutPassword,
      token,
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, confirmPassword }: Omit<RegisterRequest, 'role'> = req.body;

    // Validate input
    if (!name || !email || !password || !confirmPassword) {
      sendError(res, 'All fields are required', 400);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      sendError(res, 'Please enter a valid email address', 400);
      return;
    }

    // Validate name
    if (name.trim().length < 2) {
      sendError(res, 'Name must be at least 2 characters long', 400);
      return;
    }

    // Validate password
    if (password.length < 6) {
      sendError(res, 'Password must be at least 6 characters long', 400);
      return;
    }

    if (password !== confirmPassword) {
      sendError(res, 'Passwords do not match', 400);
      return;
    }

    // Check if user already exists (normalize for consistency)
    const existingUser = await UserModel.existsByEmail(email.trim().toLowerCase());
    if (existingUser) {
      sendError(res, 'User with this email already exists', 409);
      return;
    }

    // Create student user (only students can register themselves)
    const newUser = await UserModel.create({
      name: name.trim(),
      email: email.toLowerCase(),
      password,
      role: 'student',
      is_active: true,
    });

    // Generate token
    const token = generateToken({
      userId: newUser.id!,
      email: newUser.email,
      role: newUser.role,
    });

    // Return user info (excluding password)
    const { password: _, ...userWithoutPassword } = newUser;

    sendSuccess(res, {
      user: userWithoutPassword,
      token,
    }, 'Student registration successful. Welcome to LMS Pro!', 201);
  } catch (error) {
    console.error('Registration error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    // User info is attached by auth middleware
    const user = req.user;

    if (!user) {
      sendError(res, 'User not authenticated', 401);
      return;
    }

    // Fetch user profile from database
    const userProfile = await UserModel.findById(user.userId);
    if (!userProfile) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Return user info (excluding password)
    const { password, ...profile } = userProfile;

    sendSuccess(res, profile, 'Profile retrieved successfully');
  } catch (error) {
    console.error('Get profile error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

/** PATCH /api/auth/profile — update display name (all authenticated roles) */
export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser) {
      sendError(res, 'User not authenticated', 401);
      return;
    }

    const { name, target_job_role_id } = req.body as { name?: string; target_job_role_id?: string | null };

    const updateData: Record<string, any> = {};

    if (name !== undefined) {
      if (typeof name !== 'string') {
        sendError(res, 'Name must be a string', 400);
        return;
      }
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        sendError(res, 'Name must be at least 2 characters long', 400);
        return;
      }
      if (trimmed.length > 120) {
        sendError(res, 'Name is too long', 400);
        return;
      }
      updateData.name = trimmed;
    }

    if (target_job_role_id !== undefined) {
      updateData.target_job_role_id = target_job_role_id || null;
    }

    if (Object.keys(updateData).length === 0) {
      sendError(res, 'No fields to update', 400);
      return;
    }

    const updated = await UserModel.update(authUser.userId, updateData);
    if (!updated) {
      sendError(res, 'User not found', 404);
      return;
    }

    const { password, ...profile } = updated;
    sendSuccess(res, profile, 'Profile updated successfully');
  } catch (error) {
    console.error('Update profile error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

/** PATCH /api/auth/change-password — email/password accounts only */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const authUser = req.user;
    if (!authUser) {
      sendError(res, 'User not authenticated', 401);
      return;
    }

    const { currentPassword, newPassword } = req.body as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!currentPassword || !newPassword) {
      sendError(res, 'Current password and new password are required', 400);
      return;
    }

    if (newPassword.length < 6) {
      sendError(res, 'New password must be at least 6 characters long', 400);
      return;
    }

    if (newPassword === currentPassword) {
      sendError(res, 'New password must be different from the current password', 400);
      return;
    }

    const userRow = await UserModel.findById(authUser.userId);
    if (!userRow) {
      sendError(res, 'User not found', 404);
      return;
    }

    if (!userRow.password) {
      sendError(
        res,
        'Password change is not available for this account. Use Forgot password or your sign-in provider settings.',
        400
      );
      return;
    }

    const match = await comparePassword(currentPassword, userRow.password);
    if (!match) {
      sendError(res, 'Current password is incorrect', 401);
      return;
    }

    await UserModel.update(authUser.userId, { password: newPassword });
    sendSuccess(res, { ok: true }, 'Password updated successfully');
  } catch (error) {
    console.error('Change password error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const createInstructor = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only admin can create instructors
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const { name, email, password }: { name: string; email: string; password: string } = req.body;

    // Validate input
    if (!name || !email || !password) {
      sendError(res, 'Name, email, and password are required', 400);
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      sendError(res, 'Please enter a valid email address', 400);
      return;
    }

    // Validate name
    if (name.trim().length < 2) {
      sendError(res, 'Name must be at least 2 characters long', 400);
      return;
    }

    // Validate password
    if (password.length < 6) {
      sendError(res, 'Password must be at least 6 characters long', 400);
      return;
    }

    const emailNorm = email.toLowerCase().trim();
    const nameTrim = name.trim();

    // Check if user already exists
    const existingUser = await UserModel.existsByEmail(emailNorm);
    if (existingUser) {
      sendError(res, 'User with this email already exists', 409);
      return;
    }

    // Create Firebase Auth user first (so instructor can log in)
    const { createFirebaseUser, isFirebaseConfigured } = await import('../utils/firebase');
    if (isFirebaseConfigured()) {
      try {
        await createFirebaseUser(emailNorm, password, nameTrim);
      } catch (err: any) {
        const code = err?.code || err?.errorInfo?.code || '';
        if (code === 'auth/email-already-exists' || code === 'auth/uid-already-exists') {
          sendError(res, 'User with this email already exists', 409);
          return;
        }
        console.error('Firebase createUser error:', err);
        sendError(res, 'Failed to create user. Please try again.', 500);
        return;
      }
    }

    // Create instructor user in database
    let newInstructor;
    try {
      newInstructor = await UserModel.create({
        name: nameTrim,
        email: emailNorm,
        password,
        role: 'instructor',
        is_active: true,
      });
    } catch (err: any) {
      if (err?.code === 'ER_DUP_ENTRY') {
        sendError(res, 'User with this email already exists', 409);
        return;
      }
      throw err;
    }

    // Send credentials email to instructor
    let emailSent = false;
    const { sendInstructorCredentialsEmail, isEmailConfigured } = await import('../utils/email');
    if (isEmailConfigured()) {
      emailSent = await sendInstructorCredentialsEmail(
        emailNorm,
        nameTrim,
        emailNorm,
        password
      );
      if (!emailSent) {
        console.warn('Failed to send instructor credentials email to', email);
      }
    }

    // Return instructor info (excluding password)
    const { password: _, ...instructorWithoutPassword } = newInstructor;

    sendSuccess(res, {
      instructor: instructorWithoutPassword,
      emailSent,
    }, 'Instructor account created successfully', 201);
  } catch (error) {
    console.error('Create instructor error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only admin can view all users
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const { role: qRole, page: qPage, limit: qLimit, search: qSearch } = req.query;

    const { page, limit } = parsePageLimit(qPage, qLimit);
    const options: Parameters<typeof UserModel.findAll>[0] = { page, limit };

    const roleStr = queryScalar(qRole);
    if (roleStr === 'student' || roleStr === 'instructor' || roleStr === 'admin') {
      options.role = roleStr as UserRole;
    }

    const searchStr = queryScalar(qSearch);
    if (searchStr?.trim()) {
      options.search = searchStr.trim();
    }

    const result = await UserModel.findAll(options);

    // Return users without passwords
    const usersWithoutPasswords = result.users.map(user => {
      const { password, ...userWithoutPassword } = user;
      return userWithoutPassword;
    });

    sendPagination(res, usersWithoutPasswords, result.page, result.limit, result.total, 'Users retrieved successfully');
  } catch (error) {
    console.error('Get all users error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const toggleUserStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only admin can toggle user status
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const { id } = req.params;
    const idString = Array.isArray(id) ? id[0] : id;
    const userId = parseInt(idString);

    if (isNaN(userId)) {
      sendError(res, 'Invalid user ID', 400);
      return;
    }

    // Prevent admin from deactivating themselves
    if (userId === adminUser.userId) {
      sendError(res, 'Cannot deactivate your own account', 400);
      return;
    }

    const updatedUser = await UserModel.toggleActiveStatus(userId);

    if (!updatedUser) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Return user without password
    const { password, ...userWithoutPassword } = updatedUser;

    sendSuccess(res, userWithoutPassword, 'User status updated successfully');
  } catch (error) {
    console.error('Toggle user status error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const getInstructors = async (req: Request, res: Response): Promise<void> => {
  try {
    // Allow any authenticated user to view instructors
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const instructors = await UserModel.findByRole('instructor');
    const instructorsWithoutPasswords = instructors.map(instructor => {
      const { password, ...rest } = instructor;
      return rest;
    });

    sendSuccess(res, instructorsWithoutPasswords, 'Instructors retrieved successfully');
  } catch (error) {
    console.error('Get instructors error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

export const searchUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      sendError(res, 'Authentication required', 401);
      return;
    }

    const { query } = req.query;
    if (!query || typeof query !== 'string') {
      sendError(res, 'Search query is required', 400);
      return;
    }

    const result = await UserModel.findAll({
      search: query,
      page: 1,
      limit: 20,
      is_active: true
    });

    // Filter out current user and return minimal info
    const users = result.users
      .filter(u => u.id !== user.userId)
      .filter(u => !(user.role === 'student' && u.role === 'admin'))
      .map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatar: u.avatar
      }));

    sendSuccess(res, users, 'Users found');
  } catch (error) {
    console.error('Search users error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

/** Forgot password: generate reset token, store in DB, send email (or return link if email not configured) */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    if (!normalizedEmail) {
      sendError(res, 'Email is required', 400);
      return;
    }

    const user = await UserModel.findByEmail(normalizedEmail);
    if (user && user.password) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 60 * 60 * 1000);
      await UserModel.setPasswordResetToken(normalizedEmail, token, expires);

      const baseUrl = process.env.FRONTEND_URL || process.env.RESET_PASSWORD_BASE || 'http://localhost:8080';
      const resetLink = `${baseUrl.replace(/\/$/, '')}/reset-password?token=${token}`;

      const { sendPasswordResetEmail, isEmailConfigured } = await import('../utils/email');
      if (isEmailConfigured()) {
        const sent = await sendPasswordResetEmail(normalizedEmail, resetLink);
        if (sent) {
          return sendSuccess(res, { message: 'If an account exists, you will receive a password reset link.' }, 'Check your email');
        }
        console.error('Failed to send password reset email');
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('\n📧 Password reset link (email not configured):', resetLink, '\n');
        return sendSuccess(res, {
          message: 'Email not configured. Use the link below to reset your password.',
          resetLink,
          token,
        }, 'Check your email');
      }
      return sendSuccess(res, { message: 'If an account exists, you will receive a reset link.', token, resetLink }, 'Check your email');
    }

    sendSuccess(res, { message: 'If an account exists with this email, you will receive a password reset link.' }, 'Check your email');
  } catch (err) {
    console.error('Forgot password error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** Reset password: validate token and set new password */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || typeof token !== 'string') {
      sendError(res, 'Reset token is required', 400);
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      sendError(res, 'Password must be at least 6 characters', 400);
      return;
    }

    const user = await UserModel.findByResetToken(token);
    if (!user) {
      sendError(res, 'Invalid or expired reset link. Please request a new one.', 400);
      return;
    }

    await UserModel.update(user.id!, { password: newPassword });
    await UserModel.clearPasswordReset(user.id!);

    sendSuccess(res, { message: 'Password updated successfully. You can now log in.' }, 'Password reset successful');
  } catch (err) {
    console.error('Reset password error:', err);
    sendError(res, 'Internal server error', 500);
  }
};

/** Firebase Auth: verify ID token, find or create user, return app JWT */
export const firebaseAuth = async (req: Request, res: Response): Promise<void> => {
  if (!isFirebaseConfigured()) {
    sendError(res, 'Firebase auth not configured', 503);
    return;
  }

  try {
    const { idToken, name: displayName, password } = req.body || {};
    if (!idToken || typeof idToken !== 'string') {
      sendError(res, 'Firebase ID token required', 400);
      return;
    }
    const providedPassword = typeof password === 'string' && password.length > 0 ? password : undefined;

    const firebaseUser = await verifyFirebaseToken(idToken);
    if (!firebaseUser) {
      sendError(res, 'Invalid or expired Firebase token', 401);
      return;
    }

    const { uid, email, name: firebaseName } = firebaseUser;
    const name = displayName || firebaseName || email?.split('@')[0] || 'User';
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (!normalizedEmail) {
      sendError(res, 'Email required from Firebase', 400);
      return;
    }

    let user = await UserModel.findByFirebaseUid(uid);

    if (!user) {
      const existingByEmail = await UserModel.findByEmail(normalizedEmail);
      if (existingByEmail) {
        // Link existing account: add firebase_uid
        await UserModel.update(existingByEmail.id!, { firebase_uid: uid });
        user = await UserModel.findById(existingByEmail.id!);
      } else {
        try {
          user = await UserModel.createFromFirebase({
            firebase_uid: uid,
            email: normalizedEmail,
            name: name.trim() || 'User',
            role: 'student',
            password: providedPassword,
          });
        } catch (err: any) {
          // If two requests race on first login, handle duplicate email gracefully
          if (err?.code === 'ER_DUP_ENTRY') {
            const existingNow = await UserModel.findByEmail(normalizedEmail);
            if (existingNow) {
              await UserModel.update(existingNow.id!, { firebase_uid: uid });
              user = await UserModel.findById(existingNow.id!);
            } else {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    }

    if (!user) {
      sendError(res, 'Failed to create or retrieve user', 500);
      return;
    }

    // Ensure DB password is not null (some existing Firebase users may have NULL from older migrations)
    if (!providedPassword && !user.password) {
      try {
        const fallback = crypto.randomBytes(32).toString('hex');
        const updated = await UserModel.update(user.id!, { password: fallback });
        if (updated) user = updated;
      } catch (_) {
        // ignore
      }
    }

    // Optional: store/update hashed password in DB (never store plain text)
    // This keeps DB password non-null and in sync with the last Firebase login password when provided.
    if (providedPassword) {
      try {
        const updated = await UserModel.update(user.id!, { password: providedPassword });
        if (updated) user = updated;
      } catch (e) {
        console.warn('Failed to sync password for user', user.id);
      }
    }

    if (!user.is_active) {
      sendError(res, 'Account is deactivated', 401);
      return;
    }

    const token = generateToken({
      userId: user.id!,
      email: user.email,
      role: user.role,
    });

    const { password: _, ...userWithoutPassword } = user;
    sendSuccess(res, { user: userWithoutPassword, token }, 'Login successful');
  } catch (err: any) {
    console.error('Firebase auth error:', err);
    sendError(res, process.env.NODE_ENV === 'development' ? `Internal server error: ${err.message}` : 'Internal server error', 500);
  }
};

export const updateUserRole = async (req: Request, res: Response): Promise<void> => {
  try {
    // Only admin can update user roles
    const adminUser = req.user;
    if (!adminUser || adminUser.role !== 'admin') {
      sendError(res, 'Access denied. Admin privileges required.', 403);
      return;
    }

    const { id } = req.params;
    const { role: roleParam } = req.body;
    const idString = Array.isArray(id) ? id[0] : id;
    const userId = parseInt(idString);

    if (isNaN(userId)) {
      sendError(res, 'Invalid user ID', 400);
      return;
    }

    const role = Array.isArray(roleParam) ? roleParam[0] : roleParam;
    if (!role || !['student', 'instructor', 'admin'].includes(role)) {
      sendError(res, 'Invalid role specified', 400);
      return;
    }

    // Prevent admin from demoting themselves
    if (userId === adminUser.userId && role !== 'admin') {
      sendError(res, 'Cannot change your own admin role', 400);
      return;
    }

    const updatedUser = await UserModel.update(userId, { role });

    if (!updatedUser) {
      sendError(res, 'User not found', 404);
      return;
    }

    // Return user without password
    const { password, ...userWithoutPassword } = updatedUser;

    sendSuccess(res, userWithoutPassword, 'User role updated successfully');
  } catch (error) {
    console.error('Update user role error:', error);
    sendError(res, 'Internal server error', 500);
  }
};

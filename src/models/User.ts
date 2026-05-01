import { User as UserType, UserRole } from '../types';
import DatabaseHelper from '../utils/database';
import { hashPassword } from '../utils/auth';
import crypto from 'crypto';

export class UserModel {
  // Find user by ID
  static async findById(id: number): Promise<UserType | null> {
    const query = `
      SELECT id, name, email, password, role, avatar, is_active,
             preferred_categories, completed_course_ids, target_job_role_id,
             created_at, updated_at
      FROM users WHERE id = ?
    `;
    return DatabaseHelper.findOne<UserType>(query, [id]);
  }

  // Find user by Firebase UID
  static async findByFirebaseUid(firebaseUid: string): Promise<UserType | null> {
    const query = `
      SELECT id, name, email, password, role, avatar, is_active, firebase_uid,
             preferred_categories, completed_course_ids, target_job_role_id,
             created_at, updated_at
      FROM users WHERE firebase_uid = ?
    `;
    return DatabaseHelper.findOne<UserType>(query, [firebaseUid]);
  }

  // Find user by email (case-insensitive, trim-aware for admin compatibility)
  static async findByEmail(email: string): Promise<UserType | null> {
    const normalized = String(email || '').trim().toLowerCase();
    const query = `
      SELECT id, name, email, password, role, avatar, is_active,
             preferred_categories, completed_course_ids, target_job_role_id,
             created_at, updated_at
      FROM users WHERE LOWER(TRIM(email)) = ?
    `;
    return DatabaseHelper.findOne<UserType>(query, [normalized]);
  }

  // Create new user
  static async create(userData: Omit<UserType, 'id' | 'created_at' | 'updated_at'>): Promise<UserType> {
    // Hash password if provided
    let hashedPassword = userData.password;
    if (userData.password && !userData.password.startsWith('$2a$') && !userData.password.startsWith('$2b$')) {
      hashedPassword = await hashPassword(userData.password);
    }

    const query = `
      INSERT INTO users (name, email, password, role, avatar, is_active,
                        preferred_categories, completed_course_ids, target_job_role_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await DatabaseHelper.insert(query, [
      userData.name,
      userData.email,
      hashedPassword,
      userData.role,
      userData.avatar || null,
      userData.is_active !== undefined ? userData.is_active : true,
      JSON.stringify(userData.preferred_categories || []),
      JSON.stringify(userData.completed_course_ids || []),
      userData.target_job_role_id || null
    ]);

    // Return the created user
    const user = await this.findById(result.insertId!);
    if (!user) {
      throw new Error('Failed to retrieve created user');
    }

    return user;
  }

  // Create user from Firebase (no password)
  static async createFromFirebase(data: {
    firebase_uid: string;
    email: string;
    name: string;
    role?: UserRole;
    password?: string;
  }): Promise<UserType> {
    const role = data.role || 'student';
    const rawPassword =
      typeof data.password === 'string' && data.password.length > 0
        ? data.password
        : crypto.randomBytes(32).toString('hex');
    const hashedPassword =
      rawPassword.startsWith('$2a$') || rawPassword.startsWith('$2b$') ? rawPassword : await hashPassword(rawPassword);
    const query = `
      INSERT INTO users (name, email, password, firebase_uid, role, avatar, is_active,
                        preferred_categories, completed_course_ids, target_job_role_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await DatabaseHelper.insert(query, [
      data.name,
      data.email.trim().toLowerCase(),
      hashedPassword,
      data.firebase_uid,
      role,
      null,
      true,
      JSON.stringify([]),
      JSON.stringify([]),
      null
    ]);

    const user = await this.findById(result.insertId!);
    if (!user) throw new Error('Failed to retrieve created user');
    return user;
  }

  // Update user
  static async update(id: number, updates: Partial<UserType>): Promise<UserType | null> {
    const updateFields: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || key === 'created_at') continue; // Skip immutable fields

      if (key === 'preferred_categories' || key === 'completed_course_ids') {
        updateFields.push(`${key} = ?`);
        values.push(JSON.stringify(value || []));
      } else if (key === 'password' && value && typeof value === 'string' && !value.startsWith('$2a$') && !value.startsWith('$2b$')) {
        // Hash password if it's being updated and not already hashed (bcrypt uses $2a$ or $2b$)
        updateFields.push(`${key} = ?`);
        values.push(await hashPassword(value));
      } else {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    values.push(id);

    await DatabaseHelper.update(query, values);
    return this.findById(id);
  }

  // Delete user
  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = ?';
    const result = await DatabaseHelper.delete(query, [id]);
    return result.affectedRows! > 0;
  }

  // Get all users with pagination and filtering
  static async findAll(options: {
    page?: number;
    limit?: number;
    role?: UserRole;
    search?: string;
    is_active?: boolean;
  } = {}): Promise<{ users: UserType[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, role, search, is_active } = options;

    let whereConditions: string[] = [];
    let params: any[] = [];

    // Add role filter
    if (role) {
      whereConditions.push('role = ?');
      params.push(role);
    }

    // Add active status filter
    if (is_active !== undefined) {
      whereConditions.push('is_active = ?');
      params.push(is_active);
    }

    // Add search filter
    if (search) {
      whereConditions.push('(name LIKE ? OR email LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await DatabaseHelper.findOne<{ total: number }>(countQuery, params);
    const total = countResult?.total || 0;

    // Get paginated results
    const { query: paginatedQuery, params: paginatedParams } = DatabaseHelper.getPaginationQuery(
      `SELECT id, name, email, password, role, avatar, is_active,
              CASE
                WHEN role = 'student' THEN COALESCE((SELECT COUNT(*) FROM enrollments e WHERE e.user_id = users.id), 0)
                WHEN role = 'instructor' THEN COALESCE((
                  SELECT COUNT(*)
                  FROM enrollments e
                  INNER JOIN courses c ON c.id = e.course_id
                  WHERE c.instructor_id = users.id
                ), 0)
                ELSE 0
              END AS enrolled,
              preferred_categories, completed_course_ids, target_job_role_id,
              created_at, updated_at FROM users ${whereClause}`,
      page,
      limit
    );

    const users = await DatabaseHelper.findMany<UserType>(paginatedQuery, [...params, ...paginatedParams]);

    return {
      users,
      total,
      page,
      limit
    };
  }

  // Get users by role
  static async findByRole(role: UserRole): Promise<UserType[]> {
    const query = `
      SELECT id, name, email, password, role, avatar, is_active,
             preferred_categories, completed_course_ids, target_job_role_id,
             created_at, updated_at
      FROM users WHERE role = ? AND is_active = TRUE
      ORDER BY created_at DESC
    `;
    return DatabaseHelper.findMany<UserType>(query, [role]);
  }

  // Check if user exists by email
  static async existsByEmail(email: string): Promise<boolean> {
    const normalized = String(email || '').trim().toLowerCase();
    const count = await DatabaseHelper.count('users', 'LOWER(TRIM(email)) = ?', [normalized]);
    return count > 0;
  }

  // Password reset: set token and expiry
  static async setPasswordResetToken(email: string, token: string, expires: Date): Promise<boolean> {
    const normalized = String(email || '').trim().toLowerCase();
    const query = `UPDATE users SET password_reset_token = ?, password_reset_expires = ? WHERE LOWER(TRIM(email)) = ?`;
    const result = await DatabaseHelper.update(query, [token, expires, normalized]);
    return (result.affectedRows ?? 0) > 0;
  }

  // Find user by valid reset token
  static async findByResetToken(token: string): Promise<UserType | null> {
    const query = `
      SELECT id, name, email, password, role, avatar, is_active,
             preferred_categories, completed_course_ids, target_job_role_id,
             created_at, updated_at
      FROM users WHERE password_reset_token = ? AND password_reset_expires > NOW()
    `;
    return DatabaseHelper.findOne<UserType>(query, [token]);
  }

  // Clear reset token after use
  static async clearPasswordReset(id: number): Promise<void> {
    await DatabaseHelper.update(
      'UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = ?',
      [id]
    );
  }

  // Toggle user active status
  static async toggleActiveStatus(id: number): Promise<UserType | null> {
    const user = await this.findById(id);
    if (!user) return null;

    return this.update(id, { is_active: !user.is_active });
  }

  // Get user statistics
  static async getStats(): Promise<{
    total: number;
    byRole: Record<UserRole, number>;
    active: number;
  }> {
    const total = await DatabaseHelper.count('users');

    const stats: Record<UserRole, number> = {
      student: 0,
      instructor: 0,
      admin: 0
    };

    for (const role of Object.keys(stats) as UserRole[]) {
      stats[role] = await DatabaseHelper.count('users', 'role = ? AND is_active = TRUE', [role]);
    }

    const active = await DatabaseHelper.count('users', 'is_active = TRUE');

    return {
      total,
      byRole: stats,
      active
    };
  }
}

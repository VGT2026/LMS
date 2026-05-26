import { Course as CourseType, CourseApprovalStatus } from '../types';
import DatabaseHelper from '../utils/database';
import { tableHasColumn } from '../utils/mysqlSchema';

export class CourseModel {
  // Find course by ID
  static async findById(id: number): Promise<CourseType | null> {
    const hasApprovalStatus = await tableHasColumn('courses', 'approval_status');
    const approvalProjection = hasApprovalStatus
      ? 'c.approval_status'
      : `'approved' AS approval_status`;
    const query = `
      SELECT c.id, c.title, c.description, c.instructor_id, c.tenant_id, c.category, c.thumbnail,
             c.duration, c.price, c.level, c.is_active, ${approvalProjection}, c.created_at, c.updated_at,
             u.name as instructor_name, u.email as instructor_email
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE c.id = ?
    `;
    const course = await DatabaseHelper.findOne<CourseType & { instructor_name?: string; instructor_email?: string }>(query, [id]);

    if (course) {
      return {
        ...course,
        instructor: course.instructor_name || 'Unassigned'
      };
    }

    return null;
  }

  // Find course by ID with full module and lesson details (enrolled count, modules with lessons/videos)
  static async findByIdWithModules(id: number): Promise<(CourseType & {
    modules?: { id: number; title: string; description?: string; lessons: number; lessonDetails?: { id: number; title: string; video_url?: string; duration?: number }[] }[];
    students?: number;
    enrolledCount?: number;
  }) | null> {
    const course = await this.findById(id);
    if (!course) return null;

    const modulesQuery = `
      SELECT cm.id, cm.title, cm.description, cm.pdf_url, cm.order_index
      FROM course_modules cm
      WHERE cm.course_id = ?
      ORDER BY cm.order_index ASC, cm.id ASC
    `;
    const { results: moduleRows } = await DatabaseHelper.execute<{ id: number; title: string; description?: string; pdf_url?: string; order_index: number }>(modulesQuery, [id]);

    const modules: { id: number; title: string; description?: string; pdf_url?: string; order_index: number; lessons: number; lessonDetails?: { id: number; title: string; content?: string; video_url?: string; pdf_url?: string; duration?: number; order_index?: number }[] }[] = [];

    for (const m of moduleRows) {
      const lessonsQuery = `
        SELECT id, title, content, video_url, pdf_url, duration, order_index
        FROM lessons WHERE module_id = ?
        ORDER BY order_index ASC, id ASC
      `;
      const { results: lessonRows } = await DatabaseHelper.execute<{ id: number; title: string; content?: string; video_url?: string; pdf_url?: string; duration?: number; order_index: number }>(lessonsQuery, [m.id]);
      modules.push({
        id: m.id,
        title: m.title,
        description: m.description,
        pdf_url: m.pdf_url,
        order_index: m.order_index,
        lessons: lessonRows.length,
        lessonDetails: lessonRows.map((l) => ({ id: l.id, title: l.title, content: l.content, video_url: l.video_url, pdf_url: l.pdf_url, duration: l.duration, order_index: l.order_index })),
      });
    }

    const studentCountQuery = `SELECT COUNT(*) as count FROM enrollments WHERE course_id = ?`;
    const { results: countResult } = await DatabaseHelper.execute<{ count: number }>(studentCountQuery, [id]);
    const students = countResult[0]?.count ?? 0;

    return {
      ...course,
      modules,
      students,
      enrolledCount: students,
    } as any;
  }

  // Create new course
  static async create(courseData: Omit<CourseType, 'id' | 'created_at' | 'updated_at'>): Promise<CourseType> {
    const query = `
      INSERT INTO courses (title, description, instructor_id, tenant_id, category, thumbnail, duration, price, level, is_active, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // Handle instructor assignment - if instructor name is provided, find the user ID
    let instructorId = courseData.instructor_id;
    if (!instructorId && (courseData as any).instructor_name) {
      // This would be implemented when we have user lookup functionality
      instructorId = undefined;
    }

    const approvalStatus = courseData.approval_status || 'pending';

    const result = await DatabaseHelper.insert(query, [
      courseData.title,
      courseData.description || null,
      instructorId,
      courseData.tenant_id ?? null,
      courseData.category,
      courseData.thumbnail || null,
      courseData.duration || '8 weeks',
      courseData.price || 0,
      courseData.level || 'beginner',
      courseData.is_active !== undefined ? courseData.is_active : true,
      approvalStatus
    ]);

    const course = await this.findById(result.insertId!);
    if (!course) {
      throw new Error('Failed to retrieve created course');
    }

    return course;
  }

  // Update course
  static async update(id: number, updates: Partial<CourseType>): Promise<CourseType | null> {
    const updateFields: string[] = [];
    const values: any[] = [];

    // Build dynamic update query
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'id' || key === 'created_at' || key === 'instructor_name' || key === 'instructor_email') continue;

      if (key === 'instructor_id') {
        updateFields.push('instructor_id = ?');
        values.push(value || null);
      } else {
        updateFields.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updateFields.length === 0) {
      return this.findById(id);
    }

    const query = `UPDATE courses SET ${updateFields.join(', ')} WHERE id = ?`;
    values.push(id);

    await DatabaseHelper.update(query, values);
    return this.findById(id);
  }

  // Assign instructor to course
  static async assignInstructor(courseId: number, instructorId: number | null): Promise<CourseType | null> {
    return this.update(courseId, { instructor_id: instructorId ?? undefined });
  }

  // Get all courses with pagination and filtering
  static async findAll(options: {
    page?: number;
    limit?: number;
    category?: string;
    instructor_id?: number;
    is_active?: boolean;
    include_inactive?: boolean;
    search?: string;
    /** Narrow by workflow state (ignored if approval_status column is missing → empty page) */
    approval_status?: CourseApprovalStatus;
    tenant_id?: number | null;
    /** Student: only courses they are enrolled in (within tenant when tenant_id set). */
    enrolled_user_id?: number;
  } = {}): Promise<{ courses: CourseType[]; total: number; page: number; limit: number }> {
    const {
      page = 1,
      limit = 10,
      category,
      instructor_id,
      is_active,
      include_inactive,
      search,
      approval_status: approvalFilter,
      tenant_id: tenantFilter,
      enrolled_user_id,
    } = options;

    const hasApprovalStatus = await tableHasColumn('courses', 'approval_status');
    const approvalProjection = hasApprovalStatus
      ? 'c.approval_status'
      : `'approved' AS approval_status`;

    if (approvalFilter !== undefined && !hasApprovalStatus) {
      return { courses: [], total: 0, page, limit };
    }

    let whereConditions: string[] = [];
    let params: any[] = [];

    // Add filters
    if (category) {
      whereConditions.push('c.category = ?');
      params.push(category);
    }

    if (instructor_id) {
      whereConditions.push('c.instructor_id = ?');
      params.push(instructor_id);
    }

    if (tenantFilter != null && tenantFilter > 0) {
      whereConditions.push('c.tenant_id = ?');
      params.push(tenantFilter);
    }

    if (enrolled_user_id != null && enrolled_user_id > 0) {
      whereConditions.push(
        'EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?)'
      );
      params.push(enrolled_user_id);
    }

    if (approvalFilter !== undefined && hasApprovalStatus) {
      whereConditions.push('c.approval_status = ?');
      params.push(approvalFilter);
    } else {
      if (include_inactive) {
        if (hasApprovalStatus) {
          whereConditions.push("(c.approval_status = 'approved' OR c.approval_status IS NULL)");
        }
      } else if (is_active !== undefined) {
        whereConditions.push('c.is_active = ?');
        params.push(is_active);
        if (is_active && hasApprovalStatus) {
          whereConditions.push("(c.approval_status = 'approved' OR c.approval_status IS NULL)");
        }
      }
    }

    if (search) {
      whereConditions.push('(c.title LIKE ? OR c.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM courses c ${whereClause}`;
    const countResult = await DatabaseHelper.findOne<{ total: number }>(countQuery, params);
    const total = countResult?.total || 0;

    // Get paginated results (include module_count and students)
    // Must qualify sort column: both `courses` and `users` have `created_at` (MySQL error 1052 otherwise).
    const { query: paginatedQuery, params: paginatedParams } = DatabaseHelper.getPaginationQuery(
      `SELECT c.id, c.title, c.description, c.instructor_id, c.tenant_id, c.category, c.thumbnail,
              c.duration, c.price, c.level, c.is_active, ${approvalProjection}, c.created_at, c.updated_at,
              u.name as instructor_name, u.email as instructor_email,
              (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) as module_count,
              (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as students
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       ${whereClause}`,
      page,
      limit,
      'c.created_at DESC'
    );

    const courses = await DatabaseHelper.findMany<CourseType & { instructor_name?: string; instructor_email?: string; module_count?: number; students?: number }>(
      paginatedQuery,
      [...params, ...paginatedParams]
    );

    // Transform courses to include instructor name and ensure numeric counts
    const transformedCourses = courses.map(course => ({
      ...course,
      instructor: course.instructor_name || 'Unassigned',
      module_count: Number(course.module_count ?? 0),
      students: Number(course.students ?? 0)
    }));

    return {
      courses: transformedCourses,
      total,
      page,
      limit
    };
  }

  // Get courses by instructor
  static async findByInstructor(instructorId: number): Promise<CourseType[]> {
    const result = await this.findAll({ instructor_id: instructorId, limit: 1000 });
    return result.courses;
  }

  /** Published catalog rows for roadmap AI (active + approved, optional tenant). */
  static async findPublishableByIds(
    courseIds: number[],
    tenantId?: number | null
  ): Promise<
    Array<{
      id: number;
      title: string;
      description?: string | null;
      category: string;
      thumbnail?: string | null;
      duration?: string | null;
      instructor_name?: string | null;
      tenant_id?: number | null;
    }>
  > {
    if (courseIds.length === 0) return [];

    const hasApprovalStatus = await tableHasColumn('courses', 'approval_status');
    const unique = [...new Set(courseIds)];
    const placeholders = unique.map(() => '?').join(',');
    const params: Array<number> = [...unique];

    const conditions = [`c.id IN (${placeholders})`, 'c.is_active = TRUE'];
    if (hasApprovalStatus) {
      conditions.push("(c.approval_status = 'approved' OR c.approval_status IS NULL)");
    }
    if (tenantId != null && tenantId > 0) {
      conditions.push('c.tenant_id = ?');
      params.push(tenantId);
    }

    const query = `
      SELECT c.id, c.title, c.description, c.category, c.thumbnail, c.duration, c.tenant_id,
             u.name AS instructor_name
      FROM courses c
      LEFT JOIN users u ON c.instructor_id = u.id
      WHERE ${conditions.join(' AND ')}
    `;

    return DatabaseHelper.findMany(query, params);
  }

  /** Ensure course IDs exist and belong to tenant (when tenantId set). */
  static async validateIdsForTenant(
    courseIds: number[],
    tenantId: number | null
  ): Promise<{ valid: number[]; invalid: number[] }> {
    if (courseIds.length === 0) {
      return { valid: [], invalid: [] };
    }

    const unique = [...new Set(courseIds)];
    const placeholders = unique.map(() => '?').join(',');
    const rows = await DatabaseHelper.findMany<{ id: number; tenant_id: number | null }>(
      `SELECT id, tenant_id FROM courses WHERE id IN (${placeholders})`,
      unique
    );
    const byId = new Map(rows.map((r) => [Number(r.id), r.tenant_id]));

    const valid: number[] = [];
    const invalid: number[] = [];
    for (const id of courseIds) {
      if (!byId.has(id)) {
        invalid.push(id);
        continue;
      }
      const courseTenant = byId.get(id);
      if (
        tenantId != null &&
        tenantId > 0 &&
        courseTenant != null &&
        Number(courseTenant) !== tenantId
      ) {
        invalid.push(id);
        continue;
      }
      valid.push(id);
    }
    return { valid, invalid };
  }

  /** Lightweight counts for admin dashboard (tolerates missing optional columns). */
  static async getDashboardCounts(tenantId?: number | null): Promise<{ total: number; active: number }> {
    const scoped = tenantId != null && tenantId > 0;
    const tenantWhere = scoped ? 'tenant_id = ?' : '';
    const tenantParams = scoped ? [tenantId] : [];
    const activeWhere = scoped ? 'tenant_id = ? AND is_active = TRUE' : 'is_active = TRUE';

    const total = await DatabaseHelper.count('courses', tenantWhere, tenantParams);
    const hasIsActive = await tableHasColumn('courses', 'is_active');
    if (!hasIsActive) {
      return { total, active: total };
    }
    try {
      const active = await DatabaseHelper.count('courses', activeWhere, tenantParams);
      return { total, active };
    } catch (e) {
      console.warn('[CourseModel] is_active count failed, using total:', (e as Error)?.message);
      return { total, active: total };
    }
  }

  // Get course statistics
  static async getStats(): Promise<{
    total: number;
    active: number;
    byCategory: Record<string, number>;
    byLevel: Record<string, number>;
  }> {
    const { total, active } = await this.getDashboardCounts();

    const byCategory: Record<string, number> = {};
    const byLevel: Record<string, number> = {};

    if (await tableHasColumn('courses', 'category')) {
      try {
        const categoryResults = await DatabaseHelper.findMany<{ category: string; count: number | bigint }>(
          'SELECT category, COUNT(*) AS count FROM courses GROUP BY category'
        );
        categoryResults.forEach((row) => {
          if (row.category != null) {
            byCategory[row.category] = Number(row.count ?? 0);
          }
        });
      } catch (e) {
        console.warn('[CourseModel] category stats skipped:', (e as Error)?.message);
      }
    }

    if (await tableHasColumn('courses', 'level')) {
      try {
        const levelResults = await DatabaseHelper.findMany<{ level: string; count: number | bigint }>(
          'SELECT level, COUNT(*) AS count FROM courses GROUP BY level'
        );
        levelResults.forEach((row) => {
          if (row.level != null) {
            byLevel[row.level] = Number(row.count ?? 0);
          }
        });
      } catch (e) {
        console.warn('[CourseModel] level stats skipped:', (e as Error)?.message);
      }
    }

    return {
      total,
      active,
      byCategory,
      byLevel,
    };
  }

  // Get all unique categories
  static async getAllCategories(): Promise<string[]> {
    const query = 'SELECT DISTINCT category FROM courses WHERE category IS NOT NULL AND category != "" ORDER BY category ASC';
    const results = await DatabaseHelper.findMany<{ category: string }>(query);
    return results.map(r => r.category).filter(cat => cat && cat.trim());
  }
}
import { Course as CourseType } from '../types';
import DatabaseHelper from '../utils/database';

export class CourseModel {
  // Find course by ID
  static async findById(id: number): Promise<CourseType | null> {
    const query = `
      SELECT c.id, c.title, c.description, c.instructor_id, c.category, c.thumbnail,
             c.duration, c.price, c.level, c.is_active, c.approval_status, c.created_at, c.updated_at,
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
      INSERT INTO courses (title, description, instructor_id, category, thumbnail, duration, price, level, is_active, approval_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  } = {}): Promise<{ courses: CourseType[]; total: number; page: number; limit: number }> {
    const { page = 1, limit = 10, category, instructor_id, is_active, include_inactive, search } = options;

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

    if (include_inactive) {
      // Include both active and inactive, but only approved
      whereConditions.push("(c.approval_status = 'approved' OR c.approval_status IS NULL)");
    } else if (is_active !== undefined) {
      whereConditions.push('c.is_active = ?');
      params.push(is_active);
      if (is_active) {
        whereConditions.push("(c.approval_status = 'approved' OR c.approval_status IS NULL)");
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
    const { query: paginatedQuery, params: paginatedParams } = DatabaseHelper.getPaginationQuery(
      `SELECT c.id, c.title, c.description, c.instructor_id, c.category, c.thumbnail,
              c.duration, c.price, c.level, c.is_active, c.approval_status, c.created_at, c.updated_at,
              u.name as instructor_name, u.email as instructor_email,
              (SELECT COUNT(*) FROM course_modules WHERE course_id = c.id) as module_count,
              (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as students
       FROM courses c
       LEFT JOIN users u ON c.instructor_id = u.id
       ${whereClause}`,
      page,
      limit
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

  // Get course statistics
  static async getStats(): Promise<{
    total: number;
    active: number;
    byCategory: Record<string, number>;
    byLevel: Record<string, number>;
  }> {
    const total = await DatabaseHelper.count('courses');

    const active = await DatabaseHelper.count('courses', 'is_active = TRUE');

    // Category stats
    const categoryQuery = 'SELECT category, COUNT(*) as count FROM courses GROUP BY category';
    const categoryResults = await DatabaseHelper.findMany<{ category: string; count: number }>(categoryQuery);
    const byCategory: Record<string, number> = {};
    categoryResults.forEach(row => {
      byCategory[row.category] = row.count;
    });

    // Level stats
    const levelQuery = 'SELECT level, COUNT(*) as count FROM courses GROUP BY level';
    const levelResults = await DatabaseHelper.findMany<{ level: string; count: number }>(levelQuery);
    const byLevel: Record<string, number> = {};
    levelResults.forEach(row => {
      byLevel[row.level] = row.count;
    });

    return {
      total,
      active,
      byCategory,
      byLevel
    };
  }

  // Get all unique categories
  static async getAllCategories(): Promise<string[]> {
    const query = 'SELECT DISTINCT category FROM courses WHERE category IS NOT NULL AND category != "" ORDER BY category ASC';
    const results = await DatabaseHelper.findMany<{ category: string }>(query);
    return results.map(r => r.category).filter(cat => cat && cat.trim());
  }
}
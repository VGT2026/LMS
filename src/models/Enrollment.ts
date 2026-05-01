import DatabaseHelper from '../utils/database';

export interface EnrollmentRow {
  id: number;
  user_id: number;
  course_id: number;
  progress_percentage: number;
  completed_at: Date | null;
  enrolled_at: Date;
  last_accessed_at: Date;
  completed_lessons?: string[] | null;
}

export class EnrollmentModel {
  static async findByUser(userId: number): Promise<EnrollmentRow[]> {
    const query = `
      SELECT id, user_id, course_id, progress_percentage, completed_at, enrolled_at, last_accessed_at
      FROM enrollments WHERE user_id = ?
      ORDER BY enrolled_at DESC
    `;
    return DatabaseHelper.findMany<EnrollmentRow>(query, [userId]);
  }

  static async findByCourse(courseId: number): Promise<EnrollmentRow[]> {
    const query = `
      SELECT id, user_id, course_id, progress_percentage, completed_at, enrolled_at, last_accessed_at
      FROM enrollments WHERE course_id = ?
    `;
    return DatabaseHelper.findMany<EnrollmentRow>(query, [courseId]);
  }

  static async countByCourse(courseId: number): Promise<number> {
    return DatabaseHelper.count('enrollments', 'course_id = ?', [courseId]);
  }

  static async create(userId: number, courseId: number): Promise<EnrollmentRow | null> {
    const query = `
      INSERT INTO enrollments (user_id, course_id, progress_percentage)
      VALUES (?, ?, 0)
    `;
    const result = await DatabaseHelper.insert(query, [userId, courseId]);
    if (result.insertId) {
      const row = await DatabaseHelper.findOne<EnrollmentRow>(
        'SELECT id, user_id, course_id, progress_percentage, completed_at, enrolled_at, last_accessed_at FROM enrollments WHERE id = ?',
        [result.insertId]
      );
      return row;
    }
    return null;
  }

  static async findByUserAndCourse(userId: number, courseId: number): Promise<EnrollmentRow | null> {
    const query = `
      SELECT id, user_id, course_id, progress_percentage, completed_at, enrolled_at, last_accessed_at,
        completed_lessons
      FROM enrollments WHERE user_id = ? AND course_id = ?
    `;
    const row = await DatabaseHelper.findOne<EnrollmentRow & { completed_lessons?: string | string[] | null }>(query, [userId, courseId]);
    if (!row) return null;
    // Parse completed_lessons: MySQL may return JSON string or array
    const completedLessons = row.completed_lessons;
    const parsed = Array.isArray(completedLessons)
      ? completedLessons
      : typeof completedLessons === 'string'
        ? (JSON.parse(completedLessons || '[]') as string[])
        : [];
    return { ...row, completed_lessons: parsed } as EnrollmentRow;
  }

  static async updateProgress(
    userId: number,
    courseId: number,
    progressPercentage: number,
    completedLessons: string[]
  ): Promise<EnrollmentRow | null> {
    const enrollment = await this.findByUserAndCourse(userId, courseId);
    if (!enrollment) return null;

    const completedAt = progressPercentage >= 100 ? new Date() : null;
    const completedLessonsJson = JSON.stringify(completedLessons);

    const query = `
      UPDATE enrollments
      SET progress_percentage = ?, completed_lessons = ?, completed_at = ?, last_accessed_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND course_id = ?
    `;
    await DatabaseHelper.update(query, [progressPercentage, completedLessonsJson, completedAt, userId, courseId]);
    return this.findByUserAndCourse(userId, courseId);
  }

  static async getEnrolledCoursesWithDetails(userId: number): Promise<Array<{
    id: number;
    title: string;
    description?: string;
    category: string;
    thumbnail?: string;
    instructor?: string;
    progress_percentage: number;
    completed_at: Date | null;
    enrolled_at: Date;
    module_count?: number;
    students?: number;
  }>> {
    const enrollments = await this.findByUser(userId);
    if (enrollments.length === 0) return [];

    const { CourseModel } = await import('./Course');
    const result: Array<any> = [];

    for (const e of enrollments) {
      const course = await CourseModel.findById(e.course_id);
      if (course) {
        const [moduleCount, students] = await Promise.all([
          DatabaseHelper.count('course_modules', 'course_id = ?', [e.course_id]),
          this.countByCourse(e.course_id),
        ]);
        result.push({
          id: course.id,
          title: course.title,
          description: course.description,
          category: course.category,
          thumbnail: course.thumbnail,
          instructor: (course as any).instructor,
          progress_percentage: e.progress_percentage,
          completed_at: e.completed_at,
          enrolled_at: e.enrolled_at,
          module_count: moduleCount,
          students,
          is_active: course.is_active !== false,
        });
      }
    }

    return result;
  }

  static async getStudentStats(userId: number): Promise<{
    enrolledCourses: number;
    inProgress: number;
    completed: number;
    overallProgress: number;
    certificates: number;
  }> {
    const enrollments = await this.findByUser(userId);
    const { CourseModel } = await import('./Course');
    const activeEnrollments: typeof enrollments = [];
    for (const e of enrollments) {
      const course = await CourseModel.findById(e.course_id);
      if (course?.is_active) activeEnrollments.push(e);
    }
    const completed = activeEnrollments.filter((e) => e.completed_at != null);
    const inProgress = activeEnrollments.filter((e) => e.completed_at == null);
    const overallProgress =
      activeEnrollments.length > 0
        ? Math.round(activeEnrollments.reduce((s, e) => s + e.progress_percentage, 0) / activeEnrollments.length)
        : 0;

    return {
      enrolledCourses: activeEnrollments.length,
      inProgress: inProgress.length,
      completed: completed.length,
      overallProgress,
      certificates: completed.length,
    };
  }

  static async getInstructorStats(instructorId: number): Promise<{
    totalCourses: number;
    activeCourses: number;
    totalStudents: number;
    avgProgress: number;
  }> {
    const { CourseModel } = await import('./Course');
    const courses = await CourseModel.findByInstructor(instructorId);
    let totalStudents = 0;
    let totalProgress = 0;
    let progressCount = 0;

    for (const c of courses) {
      const enrollments = await this.findByCourse(c.id!);
      totalStudents += enrollments.length;
      for (const e of enrollments) {
        totalProgress += Number(e.progress_percentage) || 0;
        progressCount++;
      }
    }

    return {
      totalCourses: courses.length,
      activeCourses: courses.filter((c) => c.is_active).length,
      totalStudents,
      avgProgress: progressCount > 0 ? Math.round(totalProgress / progressCount) : 0,
    };
  }

  static async findByCourseWithUserDetails(courseId: number): Promise<Array<{
    id: number;
    user_id: number;
    user_name: string;
    user_email: string;
    progress_percentage: number;
    enrolled_at: Date;
    completed_at: Date | null;
    status: 'active' | 'completed';
  }>> {
    const query = `
      SELECT 
        e.id,
        e.user_id,
        u.name as user_name,
        u.email as user_email,
        e.progress_percentage,
        e.enrolled_at,
        e.completed_at,
        CASE WHEN e.progress_percentage = 100 THEN 'completed' ELSE 'active' END as status
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.course_id = ?
      ORDER BY e.enrolled_at DESC
    `;
    return DatabaseHelper.findMany(query, [courseId]);
  }
}

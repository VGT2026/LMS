import DatabaseHelper from '../utils/database';

export interface SubmissionRow {
  id: number;
  assignment_id: number;
  user_id: number;
  content?: string | null;
  file_url?: string | null;
  submitted_at: Date;
  grade?: number | null;
  feedback?: string | null;
  graded_at?: Date | null;
  graded_by?: number | null;
}

export class SubmissionModel {
  static async findByAssignmentAndUser(assignmentId: number, userId: number): Promise<SubmissionRow | null> {
    const query = `
      SELECT id, assignment_id, user_id, content, file_url, submitted_at, grade, feedback, graded_at, graded_by
      FROM submissions WHERE assignment_id = ? AND user_id = ?
    `;
    return DatabaseHelper.findOne<SubmissionRow>(query, [assignmentId, userId]);
  }

  static async findByAssignment(assignmentId: number): Promise<SubmissionRow[]> {
    const query = `
      SELECT id, assignment_id, user_id, content, file_url, submitted_at, grade, feedback, graded_at, graded_by
      FROM submissions WHERE assignment_id = ?
      ORDER BY submitted_at DESC
    `;
    return DatabaseHelper.findMany<SubmissionRow>(query, [assignmentId]);
  }

  static async findByAssignmentWithUsers(assignmentId: number): Promise<(SubmissionRow & { user_name?: string; user_email?: string })[]> {
    const query = `
      SELECT s.id, s.assignment_id, s.user_id, s.content, s.file_url, s.submitted_at, s.grade, s.feedback, s.graded_at, s.graded_by,
             u.name as user_name, u.email as user_email
      FROM submissions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.assignment_id = ?
      ORDER BY s.submitted_at DESC
    `;
    return DatabaseHelper.findMany<any>(query, [assignmentId]);
  }

  static async create(assignmentId: number, userId: number, content: string): Promise<SubmissionRow | null> {
    const query = `
      INSERT INTO submissions (assignment_id, user_id, content)
      VALUES (?, ?, ?)
    `;
    const result = await DatabaseHelper.insert(query, [assignmentId, userId, content]);
    if (result.insertId) {
      return this.findById(result.insertId);
    }
    return null;
  }

  static async findById(id: number): Promise<SubmissionRow | null> {
    const query = `
      SELECT id, assignment_id, user_id, content, file_url, submitted_at, grade, feedback, graded_at, graded_by
      FROM submissions WHERE id = ?
    `;
    return DatabaseHelper.findOne<SubmissionRow>(query, [id]);
  }

  static async findByUser(userId: number): Promise<(SubmissionRow & { assignment_title?: string; course_id?: number; course_title?: string; max_points?: number })[]> {
    const query = `
      SELECT s.id, s.assignment_id, s.user_id, s.content, s.file_url, s.submitted_at, s.grade, s.feedback, s.graded_at, s.graded_by,
             a.title as assignment_title, a.course_id, a.max_points, c.title as course_title
      FROM submissions s
      LEFT JOIN assignments a ON s.assignment_id = a.id
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE s.user_id = ?
      ORDER BY s.submitted_at DESC
    `;
    return DatabaseHelper.findMany<any>(query, [userId]);
  }

  static async updateGrade(id: number, grade: number, feedback: string, gradedBy: number | null): Promise<SubmissionRow | null> {
    const query = `
      UPDATE submissions SET grade = ?, feedback = ?, graded_at = ?, graded_by = ? WHERE id = ?
    `;
    await DatabaseHelper.update(query, [grade, feedback, new Date(), gradedBy, id]);
    return this.findById(id);
  }
}

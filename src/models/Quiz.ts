import { Quiz as QuizType } from '../types';
import DatabaseHelper from '../utils/database';

export class QuizModel {
  static async findById(id: number): Promise<QuizType | null> {
    const query = `
      SELECT q.id, q.course_id, q.title, q.description, q.due_date, q.time_limit,
             q.total_points, q.passing_score, q.is_active, q.created_at, q.updated_at,
             q.available_from, q.available_until, q.questions_json,
             c.title as course_title
      FROM quizzes q
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE q.id = ?
    `;
    const row = await DatabaseHelper.findOne<any>(query, [id]);
    return row ? this.mapRow(row) : null;
  }

  static async findByCourse(courseId: number): Promise<QuizType[]> {
    const query = `
      SELECT q.id, q.course_id, q.title, q.description, q.due_date, q.time_limit,
             q.total_points, q.passing_score, q.is_active, q.created_at, q.updated_at,
             c.title as course_title
      FROM quizzes q
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE q.course_id = ?
      ORDER BY COALESCE(q.due_date, '9999-12-31') ASC, q.created_at ASC
    `;
    const rows = await DatabaseHelper.findMany<any>(query, [courseId]);
    return rows.map(r => this.mapRow(r));
  }

  /** Get quizzes from courses the student is enrolled in (for calendar) */
  static async findForStudent(userId: number): Promise<QuizType[]> {
    const query = `
      SELECT q.id, q.course_id, q.title, q.description, q.due_date, q.time_limit,
             q.total_points, q.passing_score, q.is_active, q.created_at, q.updated_at,
             q.available_from, q.available_until, q.questions_json,
             c.title as course_title
      FROM quizzes q
      LEFT JOIN courses c ON q.course_id = c.id
      INNER JOIN enrollments e ON e.course_id = q.course_id AND e.user_id = ?
      WHERE c.is_active = 1 AND (q.is_active = 1 OR q.is_active = TRUE)
      ORDER BY COALESCE(q.due_date, '9999-12-31') ASC, q.created_at ASC
    `;
    const rows = await DatabaseHelper.findMany<any>(query, [userId]);
    return rows.map(r => this.mapRow(r));
  }

  static async create(data: {
    course_id: number;
    title: string;
    description?: string;
    due_date?: Date | string | null;
    time_limit?: number;
    total_points?: number;
    passing_score?: number;
  }): Promise<QuizType> {
    const query = `
      INSERT INTO quizzes (course_id, title, description, due_date, time_limit, total_points, passing_score, available_from, available_until, questions_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const qj = (data as any).questions_json != null ? JSON.stringify((data as any).questions_json) : null;
    const result = await DatabaseHelper.insert(query, [
      data.course_id,
      data.title,
      data.description || null,
      data.due_date || null,
      data.time_limit ?? 30,
      data.total_points ?? 100,
      data.passing_score ?? 60,
      (data as any).available_from ?? null,
      (data as any).available_until ?? null,
      qj,
    ]);
    const created = await this.findById(result.insertId!);
    if (!created) throw new Error('Failed to retrieve created quiz');
    return created;
  }

  static async update(id: number, updates: Partial<QuizType>): Promise<QuizType | null> {
    const fields: string[] = [];
    const values: unknown[] = [];

    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.due_date !== undefined) {
      fields.push('due_date = ?');
      values.push(updates.due_date);
    }
    if (updates.time_limit !== undefined) {
      fields.push('time_limit = ?');
      values.push(updates.time_limit);
    }
    if (updates.total_points !== undefined) {
      fields.push('total_points = ?');
      values.push(updates.total_points);
    }
    if (updates.passing_score !== undefined) {
      fields.push('passing_score = ?');
      values.push(updates.passing_score);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = ?');
      values.push(updates.is_active ? 1 : 0);
    }
    if ((updates as any).available_from !== undefined) {
      fields.push('available_from = ?');
      values.push((updates as any).available_from);
    }
    if ((updates as any).available_until !== undefined) {
      fields.push('available_until = ?');
      values.push((updates as any).available_until);
    }
    if ((updates as any).questions_json !== undefined) {
      fields.push('questions_json = ?');
      const v = (updates as any).questions_json;
      values.push(typeof v === 'string' ? v : JSON.stringify(v));
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await DatabaseHelper.update(
      `UPDATE quizzes SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    const result = await DatabaseHelper.delete('DELETE FROM quizzes WHERE id = ?', [id]);
    return (result.affectedRows ?? 0) > 0;
  }

  /** Normalized rows from legacy `quiz_questions` (used when `questions_json` is empty). */
  static async findLegacyQuizQuestions(quizId: number): Promise<
    Array<{
      id: number;
      question: string;
      options: unknown;
      correct_answer: number;
      points: unknown;
    }>
  > {
    const query = `
      SELECT id, question, options, correct_answer, points
      FROM quiz_questions
      WHERE quiz_id = ?
      ORDER BY id ASC
    `;
    return DatabaseHelper.findMany(query, [quizId]);
  }

  private static mapRow(row: any): QuizType {
    let questionsJson: unknown = row.questions_json;
    if (typeof questionsJson === 'string') {
      try {
        questionsJson = JSON.parse(questionsJson);
      } catch {
        questionsJson = null;
      }
    }
    return {
      id: row.id,
      course_id: row.course_id,
      title: row.title,
      description: row.description,
      due_date: row.due_date,
      time_limit: row.time_limit,
      total_points: row.total_points,
      passing_score: row.passing_score,
      is_active: row.is_active === 1 || row.is_active === true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      course_title: row.course_title,
      available_from: row.available_from,
      available_until: row.available_until,
      questions_json: questionsJson as any,
    };
  }
}

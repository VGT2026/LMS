import { Assignment as AssignmentType } from '../types';
import DatabaseHelper from '../utils/database';

export class AssignmentModel {
  static async findById(id: number): Promise<AssignmentType | null> {
    const query = `
      SELECT a.id, a.course_id, a.title, a.description, a.due_date, a.max_points, a.questions,
             a.is_published, a.created_at, a.updated_at, c.title as course_title
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.id = ?
    `;
    const row = await DatabaseHelper.findOne<any>(query, [id]);
    if (!row) return null;
    return this.mapRow(row);
  }

  static async findByCourse(courseId: number): Promise<AssignmentType[]> {
    const query = `
      SELECT a.id, a.course_id, a.title, a.description, a.due_date, a.max_points, a.questions,
             a.is_published, a.created_at, a.updated_at, c.title as course_title
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      WHERE a.course_id = ?
      ORDER BY a.due_date ASC
    `;
    const rows = await DatabaseHelper.findMany<any>(query, [courseId]);
    return rows.map(r => this.mapRow(r));
  }

  static async findForStudent(userId: number): Promise<AssignmentType[]> {
    const query = `
      SELECT a.id, a.course_id, a.title, a.description, a.due_date, a.max_points, a.questions,
             a.is_published, a.created_at, a.updated_at, c.title as course_title
      FROM assignments a
      LEFT JOIN courses c ON a.course_id = c.id
      INNER JOIN enrollments e ON e.course_id = a.course_id AND e.user_id = ?
      WHERE c.is_active = 1 AND (a.is_published = 1 OR a.is_published = TRUE)
      ORDER BY a.due_date ASC
    `;
    const rows = await DatabaseHelper.findMany<any>(query, [userId]);
    return rows.map(r => this.mapRow(r));
  }

  static async create(data: {
    course_id: number;
    title: string;
    description?: string;
    due_date: Date;
    max_points?: number;
    questions?: unknown;
    is_published?: boolean;
  }): Promise<AssignmentType> {
    const query = `
      INSERT INTO assignments (course_id, title, description, due_date, max_points, questions, is_published)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await DatabaseHelper.insert(query, [
      data.course_id,
      data.title,
      data.description || null,
      data.due_date,
      data.max_points ?? 100,
      data.questions ? JSON.stringify(data.questions) : null,
      data.is_published ? 1 : 0,
    ]);
    const created = await this.findById(result.insertId!);
    if (!created) throw new Error('Failed to retrieve created assignment');
    return created;
  }

  static async update(id: number, updates: Partial<AssignmentType>): Promise<AssignmentType | null> {
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
    if (updates.max_points !== undefined) {
      fields.push('max_points = ?');
      values.push(updates.max_points);
    }
    if ((updates as any).questions !== undefined) {
      fields.push('questions = ?');
      values.push(JSON.stringify((updates as any).questions));
    }
    if (updates.is_published !== undefined) {
      fields.push('is_published = ?');
      values.push(updates.is_published ? 1 : 0);
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    await DatabaseHelper.update(
      `UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`,
      values
    );
    return this.findById(id);
  }

  static async delete(id: number): Promise<boolean> {
    const result = await DatabaseHelper.delete('DELETE FROM assignments WHERE id = ?', [id]);
    return (result.affectedRows ?? 0) > 0;
  }

  private static mapRow(row: any): AssignmentType {
    const questions = row.questions;
    const parsed = typeof questions === 'string' ? (questions ? JSON.parse(questions) : null) : questions;
    return {
      id: row.id,
      course_id: row.course_id,
      title: row.title,
      description: row.description,
      due_date: row.due_date,
      max_points: row.max_points,
      is_published: row.is_published === 1 || row.is_published === true,
      created_at: row.created_at,
      updated_at: row.updated_at,
      course_title: row.course_title,
      questions: parsed ?? [],
    };
  }
}

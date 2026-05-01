import { CourseModule, Lesson } from '../types';
import DatabaseHelper from '../utils/database';

export interface ModuleWithLessons extends CourseModule {
  lessons?: { id: number; title: string; content?: string; video_url?: string; pdf_url?: string; duration?: number; order_index: number }[];
}

export class ModuleModel {
  static async findByCourseId(courseId: number): Promise<ModuleWithLessons[]> {
    const modulesQuery = `
      SELECT id, course_id, title, description, pdf_url, order_index, created_at, updated_at
      FROM course_modules WHERE course_id = ?
      ORDER BY order_index ASC, id ASC
    `;
    const modules = await DatabaseHelper.findMany<CourseModule>(modulesQuery, [courseId]);

    const result: ModuleWithLessons[] = [];
    for (const mod of modules) {
      const lessonsQuery = `
        SELECT id, title, content, video_url, pdf_url, duration, order_index
        FROM lessons WHERE module_id = ?
        ORDER BY order_index ASC, id ASC
      `;
      const lessons = await DatabaseHelper.findMany<{ id: number; title: string; content?: string; video_url?: string; pdf_url?: string; duration?: number; order_index: number }>(lessonsQuery, [mod.id!]);
      result.push({ ...mod, lessons });
    }
    return result;
  }

  static async create(courseId: number, data: { title: string; description?: string; pdf_url?: string; order_index?: number }): Promise<CourseModule> {
    const order = data.order_index ?? 0;
    const query = `
      INSERT INTO course_modules (course_id, title, description, pdf_url, order_index)
      VALUES (?, ?, ?, ?, ?)
    `;
    const result = await DatabaseHelper.insert(query, [courseId, data.title, data.description || null, data.pdf_url || null, order]);
    const created = await DatabaseHelper.findOne<CourseModule>('SELECT * FROM course_modules WHERE id = ?', [result.insertId!]);
    return created!;
  }

  static async update(moduleId: number, updates: Partial<CourseModule>): Promise<CourseModule | null> {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.title !== undefined) {
      fields.push('title = ?');
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push('description = ?');
      values.push(updates.description);
    }
    if (updates.order_index !== undefined) {
      fields.push('order_index = ?');
      values.push(updates.order_index);
    }
    if (updates.pdf_url !== undefined) {
      fields.push('pdf_url = ?');
      values.push(updates.pdf_url);
    }
    if (fields.length === 0) return null;
    values.push(moduleId);
    await DatabaseHelper.update(`UPDATE course_modules SET ${fields.join(', ')} WHERE id = ?`, values);
    return DatabaseHelper.findOne<CourseModule>('SELECT * FROM course_modules WHERE id = ?', [moduleId]);
  }

  static async delete(moduleId: number): Promise<boolean> {
    const result = await DatabaseHelper.delete('DELETE FROM course_modules WHERE id = ?', [moduleId]);
    return (result as any).affectedRows > 0;
  }

  static async getCourseId(moduleId: number): Promise<number | null> {
    const row = await DatabaseHelper.findOne<{ course_id: number }>('SELECT course_id FROM course_modules WHERE id = ?', [moduleId]);
    return row?.course_id ?? null;
  }
}

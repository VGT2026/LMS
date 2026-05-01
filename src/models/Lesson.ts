import { Lesson as LessonType } from '../types';
import DatabaseHelper from '../utils/database';

export class LessonModel {
  static async findByModuleId(moduleId: number): Promise<LessonType[]> {
    const query = `
      SELECT id, module_id, title, content, video_url, pdf_url, duration, order_index, is_free, created_at, updated_at
      FROM lessons WHERE module_id = ?
      ORDER BY order_index ASC, id ASC
    `;
    return DatabaseHelper.findMany<LessonType>(query, [moduleId]);
  }

  static async create(moduleId: number, data: { title: string; content?: string; video_url?: string; pdf_url?: string; duration?: number; is_free?: boolean; order_index?: number }): Promise<LessonType> {
    const order = data.order_index ?? 0;
    const query = `
      INSERT INTO lessons (module_id, title, content, video_url, pdf_url, duration, order_index, is_free)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const result = await DatabaseHelper.insert(query, [
      moduleId,
      data.title,
      data.content || null,
      data.video_url || null,
      data.pdf_url || null,
      data.duration ?? null,
      order,
      data.is_free ?? false,
    ]);
    const created = await DatabaseHelper.findOne<LessonType>('SELECT * FROM lessons WHERE id = ?', [result.insertId!]);
    return created!;
  }

  static async update(lessonId: number, updates: Partial<LessonType>): Promise<LessonType | null> {
    const fields: string[] = [];
    const values: any[] = [];
    const allowed = ['title', 'content', 'video_url', 'pdf_url', 'duration', 'order_index', 'is_free'];
    for (const key of allowed) {
      const val = (updates as any)[key];
      if (val !== undefined) {
        fields.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (fields.length === 0) return null;
    values.push(lessonId);
    await DatabaseHelper.update(`UPDATE lessons SET ${fields.join(', ')} WHERE id = ?`, values);
    return DatabaseHelper.findOne<LessonType>('SELECT * FROM lessons WHERE id = ?', [lessonId]);
  }

  static async delete(lessonId: number): Promise<boolean> {
    const result = await DatabaseHelper.delete('DELETE FROM lessons WHERE id = ?', [lessonId]);
    return (result as any).affectedRows > 0;
  }

  static async getModuleId(lessonId: number): Promise<number | null> {
    const row = await DatabaseHelper.findOne<{ module_id: number }>('SELECT module_id FROM lessons WHERE id = ?', [lessonId]);
    return row?.module_id ?? null;
  }
}

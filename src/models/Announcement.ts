import DatabaseHelper from '../utils/database';

export interface AnnouncementRow {
  id: number;
  course_id: number | null;
  user_id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  author_name?: string;
}

export class AnnouncementModel {
  static async findByCourse(courseId: number): Promise<AnnouncementRow[]> {
    const query = `
      SELECT a.id, a.course_id, a.user_id, a.title, a.content, a.type, a.is_active,
             a.created_at, a.updated_at, u.name as author_name
      FROM announcements a
      JOIN users u ON a.user_id = u.id
      WHERE a.course_id = ? AND a.is_active = TRUE
      ORDER BY a.created_at DESC
    `;
    return DatabaseHelper.findMany<AnnouncementRow>(query, [courseId]);
  }

  static async create(data: {
    course_id: number;
    user_id: number;
    title: string;
    content: string;
    type?: 'info' | 'warning' | 'success' | 'error';
  }): Promise<AnnouncementRow> {
    const query = `
      INSERT INTO announcements (course_id, user_id, title, content, type)
      VALUES (?, ?, ?, ?, ?)
    `;
    const type = data.type ?? 'info';
    const result = await DatabaseHelper.execute(query, [
      data.course_id,
      data.user_id,
      data.title,
      data.content,
      type,
    ]);
    const insertId = (result as any).insertId;
    const created = await DatabaseHelper.findOne<AnnouncementRow>(
      'SELECT a.*, u.name as author_name FROM announcements a JOIN users u ON a.user_id = u.id WHERE a.id = ?',
      [insertId]
    );
    return created!;
  }

  static async delete(id: number): Promise<void> {
    await DatabaseHelper.execute('DELETE FROM announcements WHERE id = ?', [id]);
  }
}

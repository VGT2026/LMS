import DatabaseHelper from '../utils/database';

export interface AISummary {
  id?: number;
  user_id: number;
  course_id?: number;
  lesson_id?: number;
  original_content: string;
  original_content_length: number;
  title: string;
  short_summary: string;
  key_points?: string[];
  study_notes?: string;
  word_count?: number;
  reading_time?: string;
  content_type?: 'text' | 'pdf';
  created_at?: Date;
  updated_at?: Date;
}

export interface AISummaryWithUser extends AISummary {
  user_name?: string;
  course_title?: string;
}

/**
 * AISummaryModel - Manages AI-generated summaries in the database
 */
export class AISummaryModel {
  /**
   * Create and save a new summary
   */
  static async create(data: Omit<AISummary, 'id' | 'created_at' | 'updated_at'>): Promise<AISummary> {
    const query = `
      INSERT INTO ai_summaries (
        user_id, course_id, lesson_id,
        original_content, original_content_length,
        title, short_summary, key_points, study_notes,
        word_count, reading_time, content_type
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const keyPointsJSON = data.key_points ? JSON.stringify(data.key_points) : null;

    const result = await DatabaseHelper.insert(query, [
      data.user_id,
      data.course_id || null,
      data.lesson_id || null,
      data.original_content,
      data.original_content_length,
      data.title.trim().slice(0, 255),
      data.short_summary,
      keyPointsJSON,
      data.study_notes || null,
      data.word_count || 0,
      data.reading_time || null,
      data.content_type || 'text',
    ]);

    const row = await this.findById(result.insertId!);
    if (!row) throw new Error('Failed to retrieve created summary');
    return row;
  }

  /**
   * Find summary by ID
   */
  static async findById(id: number): Promise<AISummary | null> {
    const query = `
      SELECT
        id, user_id, course_id, lesson_id,
        original_content, original_content_length,
        title, short_summary, key_points, study_notes,
        word_count, reading_time, content_type,
        created_at, updated_at
      FROM ai_summaries
      WHERE id = ?
    `;

    const summary = await DatabaseHelper.findOne<any>(query, [id]);
    if (summary && summary.key_points) {
      summary.key_points = JSON.parse(summary.key_points);
    }
    return summary as AISummary | null;
  }

  /**
   * Find all summaries for a user
   */
  static async findByUserId(
    userId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<AISummary[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    const query = `
      SELECT
        id, user_id, course_id, lesson_id,
        original_content, original_content_length,
        title, short_summary, key_points, study_notes,
        word_count, reading_time, content_type,
        created_at, updated_at
      FROM ai_summaries
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const summaries = await DatabaseHelper.findMany<any>(query, [
      userId,
      safeLimit,
      safeOffset,
    ]);

    return summaries.map((s: any) => {
      if (s.key_points) {
        s.key_points = JSON.parse(s.key_points);
      }
      return s as AISummary;
    });
  }

  /**
   * Find summaries for a specific course
   */
  static async findByCourseId(
    courseId: number,
    limit: number = 20,
    offset: number = 0
  ): Promise<AISummaryWithUser[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const safeOffset = Math.max(0, offset);

    const query = `
      SELECT
        s.id, s.user_id, s.course_id, s.lesson_id,
        s.original_content, s.original_content_length,
        s.title, s.short_summary, s.key_points, s.study_notes,
        s.word_count, s.reading_time, s.content_type,
        s.created_at, s.updated_at,
        u.name as user_name
      FROM ai_summaries s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.course_id = ?
      ORDER BY s.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const summaries = await DatabaseHelper.findMany<any>(query, [
      courseId,
      safeLimit,
      safeOffset,
    ]);

    return summaries.map((s: any) => {
      if (s.key_points) {
        s.key_points = JSON.parse(s.key_points);
      }
      return s as AISummaryWithUser;
    });
  }

  /**
   * Update an existing summary
   */
  static async update(id: number, data: Partial<AISummary>): Promise<AISummary> {
    const allowedFields = [
      'title',
      'short_summary',
      'key_points',
      'study_notes',
      'word_count',
      'reading_time',
      'course_id',
      'lesson_id',
    ];

    const updates: string[] = [];
    const values: any[] = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        if (key === 'key_points' && Array.isArray(value)) {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
      }
    }

    if (updates.length === 0) {
      const existing = await this.findById(id);
      if (!existing) throw new Error('Summary not found');
      return existing;
    }

    values.push(id);
    const query = `UPDATE ai_summaries SET ${updates.join(', ')} WHERE id = ?`;

    const { results } = await DatabaseHelper.execute(query, values);
    if (!results || (results as any)[0]?.affectedRows === undefined) {
      throw new Error('Failed to update summary');
    }

    const updated = await this.findById(id);
    if (!updated) throw new Error('Failed to retrieve updated summary');
    return updated;
  }

  /**
   * Delete a summary
   */
  static async delete(id: number): Promise<boolean> {
    const query = 'DELETE FROM ai_summaries WHERE id = ?';
    const { results } = await DatabaseHelper.execute(query, [id]);
    return (results as any)[0]?.affectedRows > 0;
  }

  /**
   * Get user's summary count
   */
  static async countByUserId(userId: number): Promise<number> {
    const query = 'SELECT COUNT(*) as count FROM ai_summaries WHERE user_id = ?';
    const result = await DatabaseHelper.findOne<{ count: number }>(query, [userId]);
    return result?.count || 0;
  }

  /**
   * Get total words summarized for a user
   */
  static async getTotalWordsSummarized(userId: number): Promise<number> {
    const query = 'SELECT SUM(original_content_length) as total FROM ai_summaries WHERE user_id = ?';
    const result = await DatabaseHelper.findOne<{ total: number }>(query, [userId]);
    return result?.total || 0;
  }
}

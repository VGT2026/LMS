import DatabaseHelper from '../utils/database';

export interface QuizAttemptRow {
  id: number;
  quiz_id: number;
  user_id: number;
  tab_lock_id: string | null;
  answers_json: unknown;
  logs_json: unknown;
  score: number | null;
  correct_count: number | null;
  wrong_count: number | null;
  started_at: Date;
  submitted_at: Date | null;
}

export class QuizAttemptModel {
  static async findById(id: number): Promise<QuizAttemptRow | null> {
    return DatabaseHelper.findOne<QuizAttemptRow>(
      'SELECT id, quiz_id, user_id, tab_lock_id, answers_json, logs_json, score, correct_count, wrong_count, started_at, submitted_at FROM quiz_attempts WHERE id = ?',
      [id]
    );
  }

  static async findActiveByQuizAndUser(quizId: number, userId: number): Promise<QuizAttemptRow | null> {
    return DatabaseHelper.findOne<QuizAttemptRow>(
      `SELECT id, quiz_id, user_id, tab_lock_id, answers_json, logs_json, score, correct_count, wrong_count, started_at, submitted_at
       FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND submitted_at IS NULL ORDER BY started_at DESC LIMIT 1`,
      [quizId, userId]
    );
  }

  static async findSubmittedByQuizAndUser(quizId: number, userId: number): Promise<QuizAttemptRow | null> {
    return DatabaseHelper.findOne<QuizAttemptRow>(
      `SELECT id, quiz_id, user_id, tab_lock_id, answers_json, logs_json, score, correct_count, wrong_count, started_at, submitted_at
       FROM quiz_attempts WHERE quiz_id = ? AND user_id = ? AND submitted_at IS NOT NULL ORDER BY submitted_at DESC LIMIT 1`,
      [quizId, userId]
    );
  }

  static async create(data: {
    quiz_id: number;
    user_id: number;
    tab_lock_id?: string | null;
    answers_json?: unknown;
    logs_json?: unknown;
  }): Promise<QuizAttemptRow | null> {
    const q = `
      INSERT INTO quiz_attempts (quiz_id, user_id, tab_lock_id, answers_json, logs_json, started_at)
      VALUES (?, ?, ?, ?, ?, NOW())
    `;
    const answers = data.answers_json != null ? JSON.stringify(data.answers_json) : null;
    const logs = data.logs_json != null ? JSON.stringify(data.logs_json) : JSON.stringify([]);
    const result = await DatabaseHelper.insert(q, [
      data.quiz_id,
      data.user_id,
      data.tab_lock_id ?? null,
      answers,
      logs,
    ]);
    if (!result.insertId) return null;
    return this.findById(result.insertId);
  }

  static async updateAnswers(id: number, answers: unknown): Promise<void> {
    await DatabaseHelper.update(
      'UPDATE quiz_attempts SET answers_json = ? WHERE id = ? AND submitted_at IS NULL',
      [JSON.stringify(answers ?? {}), id]
    );
  }

  static async appendLog(id: number, entry: { t: string; type: string; detail?: string }): Promise<void> {
    const row = await DatabaseHelper.findOne<{ logs_json: string | null }>(
      'SELECT logs_json FROM quiz_attempts WHERE id = ?',
      [id]
    );
    let logs: unknown[] = [];
    if (row?.logs_json) {
      try {
        logs = JSON.parse(row.logs_json as string);
        if (!Array.isArray(logs)) logs = [];
      } catch {
        logs = [];
      }
    }
    logs.push(entry);
    await DatabaseHelper.update('UPDATE quiz_attempts SET logs_json = ? WHERE id = ?', [JSON.stringify(logs), id]);
  }

  static async submit(
    id: number,
    data: { score: number; correct_count: number; wrong_count: number; answers: unknown }
  ): Promise<QuizAttemptRow | null> {
    await DatabaseHelper.update(
      `UPDATE quiz_attempts SET submitted_at = NOW(), score = ?, correct_count = ?, wrong_count = ?, answers_json = ?
       WHERE id = ? AND submitted_at IS NULL`,
      [data.score, data.correct_count, data.wrong_count, JSON.stringify(data.answers ?? {}), id]
    );
    return this.findById(id);
  }

  static async setTabLock(id: number, tabLockId: string): Promise<void> {
    await DatabaseHelper.update('UPDATE quiz_attempts SET tab_lock_id = ? WHERE id = ?', [tabLockId, id]);
  }

  /** Get all submitted attempts for a user, joined with quiz + course info */
  static async findByUser(userId: number): Promise<any[]> {
    const query = `
      SELECT qa.id, qa.quiz_id, qa.user_id, qa.score, qa.correct_count, qa.wrong_count,
             qa.started_at, qa.submitted_at,
             q.title AS quiz_title, q.total_points, q.course_id,
             c.title AS course_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      LEFT JOIN courses c ON q.course_id = c.id
      WHERE qa.user_id = ? AND qa.submitted_at IS NOT NULL
      ORDER BY qa.submitted_at DESC
    `;
    return DatabaseHelper.findMany<any>(query, [userId]);
  }
}

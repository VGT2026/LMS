import DatabaseHelper from '../utils/database';

export interface SupportTicket {
  id?: number;
  user_id: number;
  subject: string;
  category: string;
  message: string;
  created_at?: Date;
}

export interface SupportTicketWithUser extends SupportTicket {
  user_name?: string;
  user_email?: string;
  user_role?: string;
}

export class SupportTicketModel {
  static async create(data: Omit<SupportTicket, 'id' | 'created_at'>): Promise<SupportTicket> {
    const query = `
      INSERT INTO support_tickets (user_id, subject, category, message)
      VALUES (?, ?, ?, ?)
    `;

    const result = await DatabaseHelper.insert(query, [
      data.user_id,
      data.subject.trim().slice(0, 255),
      data.category.trim().slice(0, 64),
      data.message.trim(),
    ]);

    const row = await this.findById(result.insertId!);
    if (!row) throw new Error('Failed to retrieve created support ticket');
    return row;
  }

  static async findById(id: number): Promise<SupportTicket | null> {
    const query = `
      SELECT id, user_id, subject, category, message, created_at
      FROM support_tickets
      WHERE id = ?
    `;
    return DatabaseHelper.findOne<SupportTicket>(query, [id]);
  }

  static async findRecentWithUser(limit: number = 10): Promise<SupportTicketWithUser[]> {
    const safeLimit = Math.min(Math.max(1, limit), 100);
    const query = `
      SELECT
        t.id,
        t.user_id,
        t.subject,
        t.category,
        t.message,
        t.created_at,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role
      FROM support_tickets t
      INNER JOIN users u ON u.id = t.user_id
      WHERE u.role IN ('student', 'instructor')
      ORDER BY t.created_at DESC
      LIMIT ?
    `;
    try {
      return await DatabaseHelper.findMany<SupportTicketWithUser>(query, [safeLimit]);
    } catch (err: unknown) {
      const code = (err as { code?: string; errno?: number })?.code;
      const errno = (err as { errno?: number })?.errno;
      if (code === 'ER_NO_SUCH_TABLE' || errno === 1146) {
        console.warn(
          '[SupportTicket] support_tickets table missing — run `npm run db:migrate` or deploy with `npm start` (migrations first). Returning [].'
        );
        return [];
      }
      throw err;
    }
  }
}


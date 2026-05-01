import DatabaseHelper from '../utils/database';

export interface Conversation {
  id: number;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationParticipant {
  conversation_id: number;
  user_id: number;
  last_read_at: Date | null;
  created_at: Date;
}

export interface ConversationWithDetails extends Conversation {
  participants: {
    user_id: number;
    name: string;
    avatar: string | null;
    role: string;
  }[];
  last_message?: {
    content: string;
    sender_id: number;
    created_at: Date;
    is_read: boolean;
  };
  unread_count?: number;
}

export class ConversationModel {
  static async create(participantIds: number[]): Promise<number> {
    return DatabaseHelper.transaction(async (connection) => {
      // Create conversation
      const [result] = await connection.query('INSERT INTO conversations () VALUES ()');
      const conversationId = (result as any).insertId;

      // Add participants
      for (const userId of participantIds) {
        await connection.query(
          'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
          [conversationId, userId]
        );
      }

      return conversationId;
    });
  }

  static async findByUser(userId: number): Promise<ConversationWithDetails[]> {
    const query = `
      SELECT c.id, c.created_at, c.updated_at
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
      ORDER BY c.updated_at DESC
    `;
    const conversations = await DatabaseHelper.findMany<Conversation>(query, [userId]);

    const results: ConversationWithDetails[] = [];

    for (const conv of conversations) {
      // Get participants
      const participantsQuery = `
        SELECT u.id as user_id, u.name, u.avatar, u.role
        FROM users u
        JOIN conversation_participants cp ON u.id = cp.user_id
        WHERE cp.conversation_id = ?
      `;
      const participants = await DatabaseHelper.findMany<any>(participantsQuery, [conv.id]);

      // Get last message
      const lastMessageQuery = `
        SELECT content, sender_id, created_at, is_read
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const lastMessage = await DatabaseHelper.findOne<any>(lastMessageQuery, [conv.id]);

      // Get unread count
      const unreadQuery = `
        SELECT COUNT(*) as count
        FROM messages
        WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE
      `;
      const unreadResult = await DatabaseHelper.findOne<{ count: number }>(unreadQuery, [conv.id, userId]);

      results.push({
        ...conv,
        participants,
        last_message: lastMessage || undefined,
        unread_count: unreadResult?.count || 0
      });
    }

    return results;
  }

  static async findById(id: number): Promise<Conversation | null> {
    return DatabaseHelper.findOne<Conversation>('SELECT * FROM conversations WHERE id = ?', [id]);
  }

  static async getParticipants(conversationId: number): Promise<number[]> {
    const rows = await DatabaseHelper.findMany<{ user_id: number }>(
      'SELECT user_id FROM conversation_participants WHERE conversation_id = ?',
      [conversationId]
    );
    return rows.map(r => r.user_id);
  }
}

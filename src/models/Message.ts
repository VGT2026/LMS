import DatabaseHelper from '../utils/database';

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  is_read: boolean;
  created_at: Date;
}

export class MessageModel {
  static async create(conversationId: number, senderId: number, content: string): Promise<Message> {
    const query = `
      INSERT INTO messages (conversation_id, sender_id, content)
      VALUES (?, ?, ?)
    `;
    const result = await DatabaseHelper.insert(query, [conversationId, senderId, content]);
    
    // Update conversation updated_at
    await DatabaseHelper.update(
      'UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [conversationId]
    );

    const message = await this.findById(result.insertId!);
    if (!message) throw new Error('Failed to create message');
    return message;
  }

  static async findByConversation(conversationId: number, limit = 50, offset = 0): Promise<Message[]> {
    const lim = Math.max(1, Math.min(Math.floor(Number(limit)) || 50, 500));
    const off = Math.min(Math.max(0, Math.floor(Number(offset)) || 0), 10_000_000);
    const query = `
      SELECT * FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
      LIMIT ${lim} OFFSET ${off}
    `;
    return DatabaseHelper.findMany<Message>(query, [conversationId]);
  }

  static async findById(id: number): Promise<Message | null> {
    return DatabaseHelper.findOne<Message>('SELECT * FROM messages WHERE id = ?', [id]);
  }

  static async markAsRead(conversationId: number, userId: number): Promise<void> {
    // Mark messages as read where sender is NOT the current user
    await DatabaseHelper.update(
      'UPDATE messages SET is_read = TRUE WHERE conversation_id = ? AND sender_id != ? AND is_read = FALSE',
      [conversationId, userId]
    );
    
    // Update last_read_at for participant
    await DatabaseHelper.update(
      'UPDATE conversation_participants SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?',
      [conversationId, userId]
    );
  }
}

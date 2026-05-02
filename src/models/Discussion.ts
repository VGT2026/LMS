import DatabaseHelper from '../utils/database';

export interface DiscussionPost {
  id: number;
  author_id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  likes_count: number;
  reply_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface DiscussionReply {
  id: number;
  post_id: number;
  author_id: number;
  content: string;
  parent_reply_id?: number | null;
  created_at: Date;
  updated_at: Date;
}

export interface DiscussionPostWithAuthor extends DiscussionPost {
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  is_liked?: boolean; // If current user liked it
}

export interface DiscussionReplyWithAuthor extends DiscussionReply {
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  replies?: DiscussionReplyWithAuthor[];
}

export class DiscussionModel {
  // Posts
  static async createPost(authorId: number, title: string, content: string): Promise<DiscussionPost> {
    const query = `
      INSERT INTO discussions (user_id, title, content)
      VALUES (?, ?, ?)
    `;
    const result = await DatabaseHelper.insert(query, [authorId, title, content]);
    const post = await this.findPostById(result.insertId!);
    if (!post) throw new Error('Failed to create post');
    return post;
  }

  static async findPostById(id: number): Promise<DiscussionPost | null> {
    return DatabaseHelper.findOne<DiscussionPost>(
      'SELECT id, user_id as author_id, title, content, is_pinned, COALESCE(likes_count, 0) as likes_count, COALESCE(reply_count, 0) as reply_count, created_at, updated_at FROM discussions WHERE id = ?',
      [id]
    );
  }

  static async findAllPosts(userId?: number, limit = 50, offset = 0): Promise<DiscussionPostWithAuthor[]> {
    const query = `
      SELECT p.id, p.user_id as author_id, p.title, p.content, p.is_pinned,
             COALESCE(p.likes_count, 0) as likes_count, COALESCE(p.reply_count, 0) as reply_count,
             p.created_at, p.updated_at,
             u.name as author_name, u.avatar as author_avatar, u.role as author_role,
             EXISTS(SELECT 1 FROM discussion_likes dl WHERE dl.discussion_id = p.id AND dl.user_id = ?) as is_liked
      FROM discussions p
      JOIN users u ON p.user_id = u.id
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT ${Math.max(1, Math.min(Math.floor(Number(limit)) || 50, 500))} OFFSET ${Math.min(
        Math.max(0, Math.floor(Number(offset)) || 0),
        10_000_000
      )}
    `;
    const rows = await DatabaseHelper.findMany<Omit<DiscussionPostWithAuthor, 'is_liked'> & { is_liked: number }>(
      query,
      [userId || 0]
    );
    return rows.map(row => ({
      ...row,
      is_liked: !!row.is_liked
    }));
  }

  static async toggleLike(postId: number, userId: number): Promise<boolean> {
    const existing = await DatabaseHelper.findOne('SELECT * FROM discussion_likes WHERE discussion_id = ? AND user_id = ?', [postId, userId]);

    if (existing) {
      await DatabaseHelper.delete('DELETE FROM discussion_likes WHERE discussion_id = ? AND user_id = ?', [postId, userId]);
      await DatabaseHelper.update('UPDATE discussions SET likes_count = GREATEST(0, COALESCE(likes_count, 0) - 1) WHERE id = ?', [postId]);
      return false; // unliked
    } else {
      await DatabaseHelper.insert('INSERT INTO discussion_likes (discussion_id, user_id) VALUES (?, ?)', [postId, userId]);
      await DatabaseHelper.update('UPDATE discussions SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = ?', [postId]);
      return true; // liked
    }
  }

  // Replies (parentReplyId = reply to another reply, null = reply to post)
  static async createReply(postId: number, authorId: number, content: string, parentReplyId?: number | null): Promise<DiscussionReply> {
    const query = `
      INSERT INTO discussion_replies (discussion_id, user_id, content, parent_reply_id)
      VALUES (?, ?, ?, ?)
    `;
    const result = await DatabaseHelper.insert(query, [postId, authorId, content, parentReplyId ?? null]);

    await DatabaseHelper.update('UPDATE discussions SET reply_count = COALESCE(reply_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [postId]);

    const reply = await this.findReplyById(result.insertId!);
    if (!reply) throw new Error('Failed to create reply');
    return reply;
  }

  static async findReplyById(id: number): Promise<DiscussionReply | null> {
    const row = await DatabaseHelper.findOne<{ id: number; discussion_id: number; user_id: number; content: string; parent_reply_id?: number | null; created_at: Date; updated_at: Date }>(
      'SELECT id, discussion_id as post_id, user_id as author_id, content, parent_reply_id, created_at, updated_at FROM discussion_replies WHERE id = ?',
      [id]
    );
    return row as unknown as DiscussionReply | null;
  }

  static async findRepliesByPostId(postId: number): Promise<DiscussionReplyWithAuthor[]> {
    const query = `
      SELECT r.id, r.discussion_id as post_id, r.user_id as author_id, r.content, r.parent_reply_id, r.created_at, r.updated_at,
             u.name as author_name, u.avatar as author_avatar, u.role as author_role
      FROM discussion_replies r
      JOIN users u ON r.user_id = u.id
      WHERE r.discussion_id = ?
      ORDER BY r.created_at ASC
    `;
    const rows = await DatabaseHelper.findMany<DiscussionReplyWithAuthor & { parent_reply_id?: number | null }>(query, [postId]);
    // Build nested tree: top-level = parent_reply_id is null
    const byId = new Map<number, DiscussionReplyWithAuthor>();
    for (const r of rows) {
      const { parent_reply_id, ...rest } = r;
      byId.set(r.id, { ...rest, replies: [] });
    }
    const topLevel: DiscussionReplyWithAuthor[] = [];
    for (const r of rows) {
      const node = byId.get(r.id)!;
      const parentId = r.parent_reply_id;
      if (parentId == null) {
        topLevel.push(node);
      } else {
        const parent = byId.get(parentId);
        if (parent) {
          if (!parent.replies) parent.replies = [];
          parent.replies.push(node);
        } else {
          topLevel.push(node);
        }
      }
    }
    return topLevel;
  }

  static async togglePin(postId: number): Promise<boolean> {
    const post = await this.findPostById(postId);
    if (!post) return false;
    const newPinned = !post.is_pinned;
    await DatabaseHelper.update('UPDATE discussions SET is_pinned = ? WHERE id = ?', [newPinned, postId]);
    return newPinned;
  }
}

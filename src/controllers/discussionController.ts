import { Request, Response } from 'express';
import { sendSuccess, sendError } from '../utils/response';
import { DiscussionModel } from '../models/Discussion';

export const getPosts = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { limit, offset } = req.query;
    const posts = await DiscussionModel.findAllPosts(
      userId ?? 0,
      limit ? parseInt(limit as string) : 50,
      offset ? parseInt(offset as string) : 0
    );
    sendSuccess(res, posts, 'Discussion posts retrieved');
  } catch (error) {
    console.error('Error fetching discussion posts:', error);
    sendError(res, 'Failed to fetch discussion posts', 500);
  }
};

export const createPost = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: 'Title and content are required' });
    }

    const post = await DiscussionModel.createPost(userId, title, content);
    res.status(201).json(post);
  } catch (error) {
    console.error('Error creating discussion post:', error);
    res.status(500).json({ message: 'Failed to create discussion post' });
  }
};

export const getPostDetails = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string);
    const post = await DiscussionModel.findPostById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    const replies = await DiscussionModel.findRepliesByPostId(postId);
    sendSuccess(res, { ...post, replies }, 'Post details retrieved');
  } catch (error) {
    console.error('Error fetching post details:', error);
    res.status(500).json({ message: 'Failed to fetch post details' });
  }
};

export const toggleLike = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string);
    const userId = (req as any).user.userId;

    const liked = await DiscussionModel.toggleLike(postId, userId);
    res.json({ liked });
  } catch (error) {
    console.error('Error toggling like:', error);
    res.status(500).json({ message: 'Failed to toggle like' });
  }
};

export const createReply = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string);
    const userId = (req as any).user.userId;
    const { content, parent_reply_id: parentReplyId } = req.body;

    if (!content) {
      return res.status(400).json({ message: 'Content is required' });
    }

    const reply = await DiscussionModel.createReply(postId, userId, content, parentReplyId ?? null);
    res.status(201).json(reply);
  } catch (error) {
    console.error('Error creating reply:', error);
    res.status(500).json({ message: 'Failed to create reply' });
  }
};

export const togglePin = async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id as string);
    const post = await DiscussionModel.findPostById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    const pinned = await DiscussionModel.togglePin(postId);
    res.json({ pinned });
  } catch (error) {
    console.error('Error toggling pin:', error);
    res.status(500).json({ message: 'Failed to toggle pin' });
  }
};

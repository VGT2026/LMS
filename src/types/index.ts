export type UserRole = 'student' | 'instructor' | 'admin';

export interface User {
  id?: number;
  name: string;
  email: string;
  password?: string;
  firebase_uid?: string;
  role: UserRole;
  avatar?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
  // Student specific fields
  preferred_categories?: string[];
  completed_course_ids?: string[];
  target_job_role_id?: number;
}

export type CourseApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface Course {
  id?: number;
  title: string;
  description?: string;
  instructor_id?: number;
  instructor?: string;
  category: string;
  thumbnail?: string;
  duration?: string;
  price?: number;
  level?: 'beginner' | 'intermediate' | 'advanced';
  is_active?: boolean;
  approval_status?: CourseApprovalStatus;
  created_at?: Date;
  updated_at?: Date;
}

export interface CourseModule {
  id?: number;
  course_id: number;
  title: string;
  description?: string;
  pdf_url?: string;
  order_index: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface Lesson {
  id?: number;
  module_id: number;
  title: string;
  content?: string;
  video_url?: string;
  pdf_url?: string;
  duration?: number;
  order_index: number;
  is_free: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface Enrollment {
  id?: number;
  user_id: number;
  course_id: number;
  progress_percentage: number;
  completed_at?: Date;
  enrolled_at?: Date;
  last_accessed_at?: Date;
}

export interface AssignmentQuestion {
  id: string;
  type: 'mcq' | 'short-answer' | 'long-answer';
  text: string;
  options?: string[];
  correctOption?: number;
  points: number;
}

export interface Assignment {
  id?: number;
  course_id: number;
  title: string;
  description?: string;
  due_date: Date;
  max_points: number;
  is_published?: boolean;
  created_at?: Date;
  updated_at?: Date;
  course_title?: string;
  questions?: AssignmentQuestion[];
}

export interface Submission {
  id?: number;
  assignment_id: number;
  user_id: number;
  content?: string;
  file_url?: string;
  submitted_at?: Date;
  grade?: number;
  feedback?: string;
  graded_at?: Date;
  graded_by?: number;
}

export interface Quiz {
  id?: number;
  course_id: number;
  title: string;
  description?: string;
  due_date?: Date | string | null;
  time_limit?: number;
  total_points: number;
  passing_score: number;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
  course_title?: string;
  /** When set, exam is only allowed in [available_from, available_until] */
  available_from?: Date | string | null;
  available_until?: Date | string | null;
  /** MCQ payload: { id, prompt|question, options[], correct, points? }[] */
  questions_json?: unknown;
}

export interface QuizQuestion {
  id?: number;
  quiz_id: number;
  question: string;
  options: string[];
  correct_answer: number;
  points: number;
  explanation?: string;
}

export interface QuizAttempt {
  id?: number;
  quiz_id: number;
  user_id: number;
  score: number;
  total_points: number;
  started_at: Date;
  completed_at?: Date;
}

export interface Discussion {
  id?: number;
  course_id?: number;
  user_id: number;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface DiscussionReply {
  id?: number;
  discussion_id: number;
  user_id: number;
  content: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Certificate {
  id?: number;
  user_id: number;
  course_id: number;
  certificate_url: string;
  issued_at: Date;
}

export interface Announcement {
  id?: number;
  course_id?: number;
  user_id: number;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'error';
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export interface JobRole {
  id?: number;
  title: string;
  description: string;
  salary_range: string;
  demand: 'low' | 'medium' | 'high' | 'critical';
  growth: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface Roadmap {
  id?: number;
  job_role_id: number;
  course_id: number;
  order_index: number;
  created_at?: Date;
  updated_at?: Date;
}

export interface UserProgress {
  id?: number;
  user_id: number;
  job_role_id: number;
  current_course_id?: number;
  completed_courses: number[];
  skills_progress: Record<string, number>;
  created_at?: Date;
  updated_at?: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends Omit<User, 'id' | 'is_active' | 'created_at' | 'updated_at'> {
  confirmPassword: string;
}

export interface CreateInstructorRequest {
  name: string;
  email: string;
  password: string;
}

export interface JWTPayload {
  userId: number;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
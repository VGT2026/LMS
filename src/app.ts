import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import courseRoutes from './routes/course';
import dashboardRoutes from './routes/dashboard';
import moduleRoutes from './routes/module';
import uploadRoutes from './routes/upload';
import supportRoutes from './routes/support';
import messageRoutes from './routes/message';
import assignmentRoutes from './routes/assignment';
import quizRoutes from './routes/quiz';
import quizAttemptRoutes from './routes/quizAttempt';
import discussionRoutes from './routes/discussion';
import enrollmentRoutes from './routes/enrollment';
import aiRoutesOpenAI from './routes/aiOpenAI';
import announcementRoutes from './routes/announcement';

dotenv.config();

function normalizeCorsOrigin(value: string): string {
  let s = value.trim();
  while (s.length > 0) {
    if (s.endsWith('/*')) {
      s = s.slice(0, -2);
    } else if (s.endsWith('/')) {
      s = s.slice(0, -1);
    } else {
      break;
    }
  }
  return s;
}

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export function createApp(): express.Application {
  const app = express();

  const corsRaw =
    process.env.CORS_ORIGIN?.trim() ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080,http://localhost:8081');
  const allowedCorsOrigins = new Set(
    corsRaw
      .split(',')
      .map(normalizeCorsOrigin)
      .filter(Boolean)
  );
  if (process.env.NODE_ENV === 'production' && allowedCorsOrigins.size === 0) {
    console.warn(
      '[CORS] NODE_ENV=production but CORS_ORIGIN is empty — browsers will be blocked unless Origin is omitted (e.g. curl).'
    );
  }
  const allowedCorsOriginsList = [...allowedCorsOrigins];

  app.use(helmet());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedCorsOrigins.has(normalizeCorsOrigin(origin))) return callback(null, true);
        console.warn(
          `[CORS] Blocked origin: ${origin}. Allowed: ${allowedCorsOriginsList.join(', ') || '(none)'}`
        );
        callback(null, false);
      },
      credentials: true,
    })
  );
  app.use(morgan('combined'));
  app.use(limiter);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.get('/health', (req, res) => {
    res.status(200).json({
      success: true,
      message: 'LMS Backend API is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
    });
  });

  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  app.use('/api/auth', authRoutes);
  app.use('/api/courses', courseRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/enrollments', enrollmentRoutes);
  app.use('/api/modules', moduleRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/support', supportRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use('/api/quizzes', quizRoutes);
  app.use('/api/quiz-attempts', quizAttemptRoutes);
  app.use('/api/discussions', discussionRoutes);
  app.use('/api/ai', aiRoutesOpenAI);
  app.use('/api/announcements', announcementRoutes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: 'Route not found',
      path: req.originalUrl,
    });
  });

  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('Error:', err);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { error: err.message }),
    });
  });

  return app;
}

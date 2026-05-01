import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

// Import configurations and utilities
import { testConnection } from './config/database';
import { UserModel } from './models/User';
import { hashPassword } from './utils/auth';
import { ensureDatabaseSchema } from './utils/schemaInitializer';

// Import routes
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

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'), // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(helmet()); // Security headers
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8081',
  credentials: true,
}));
app.use(morgan('combined')); // Logging
app.use(limiter); // Rate limiting
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'LMS Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Serve uploaded files (videos, etc.)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API routes
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);

  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message }),
  });
});

// Initialize admin user
const initializeAdminUser = async (): Promise<void> => {
  // Check if admin user already exists
  const existingAdmin = await UserModel.findByEmail('admin@lmspro.com');
  if (!existingAdmin) {
    // Create admin user
    const hashedPassword = await hashPassword('admin123');
    await UserModel.create({
      name: 'System Administrator',
      email: 'admin@lmspro.com',
      password: hashedPassword,
      role: 'admin',
      is_active: true,
    });
    console.log('✅ Admin user initialized');
  } else {
    console.log('✅ Admin user already exists');
  }
};

// Start server
const startServer = async () => {
  try {
    // Test database connection
    await testConnection();

    // Ensure the database schema exists before creating the admin user
    await ensureDatabaseSchema();

    // Initialize admin user
    await initializeAdminUser();

    app.listen(PORT, () => {
      console.log(`🚀 LMS Backend API server running on port ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/health`);
      if (process.env.NODE_ENV === 'development') {
        console.log(`👤 Dev admin: admin@lmspro.com`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

startServer();
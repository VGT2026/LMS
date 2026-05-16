import dotenv from 'dotenv';
import { createApp } from './app';
import { testConnection } from './config/database';
import { UserModel } from './models/User';
import { hashPassword } from './utils/auth';

dotenv.config();

const PORT = process.env.PORT || 3001;
const app = createApp();

const initializeAdminUser = async (): Promise<void> => {
  try {
    const existingAdmin = await UserModel.findByEmail('admin@lmspro.com');
    if (!existingAdmin) {
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
  } catch (error) {
    console.error('❌ Failed to initialize admin user:', error);
  }
};

const initializeSuperadminUser = async (): Promise<void> => {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  const name = process.env.SUPERADMIN_NAME?.trim() || 'Super Administrator';
  if (!email || !password) {
    return;
  }
  try {
    const existing = await UserModel.findByEmail(email);
    if (!existing) {
      await UserModel.create({
        name,
        email,
        password,
        role: 'superadmin',
        is_active: true,
      });
      console.log('✅ Superadmin user initialized:', email);
    } else if (existing.role !== 'superadmin') {
      await UserModel.update(existing.id!, { role: 'superadmin' });
      console.log('✅ Existing user upgraded to superadmin:', email);
    }
  } catch (error) {
    console.error('❌ Failed to initialize superadmin user:', error);
  }
};

const startServer = async () => {
  try {
    await testConnection();
    await initializeAdminUser();
    await initializeSuperadminUser();

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

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  startServer();
}

export { app };

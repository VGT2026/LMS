import { UserModel } from '../models/User';
import { hashPassword } from '../utils/auth';

const serverStyleAdmin = async () => {
  try {
    console.log('🏗️ Creating admin user server-style...');

    // Check if admin exists (like server does)
    const existingAdmin = await UserModel.findByEmail('admin@lmspro.com');

    if (existingAdmin) {
      console.log('Admin already exists, skipping creation');
      return;
    }

    // Create admin exactly like server does
    const hashedPassword = await hashPassword('admin123');
    console.log('Hashed password:', hashedPassword.substring(0, 20) + '...');

    const newAdmin = await UserModel.create({
      name: 'System Administrator',
      email: 'admin@lmspro.com',
      password: hashedPassword,
      role: 'admin',
      is_active: true,
    });

    console.log('✅ Admin created with ID:', newAdmin.id);
    console.log('Email:', newAdmin.email);
    console.log('Role:', newAdmin.role);

    // Test login immediately
    console.log('\n🧪 Testing login...');
    const loginUser = await UserModel.findByEmail('admin@lmspro.com');

    if (loginUser) {
      console.log('User found for login test');
      console.log('Password hash:', loginUser.password.substring(0, 20) + '...');

      // Import and test password comparison
      const { comparePassword } = await import('../utils/auth');
      const isValid = await comparePassword('admin123', loginUser.password);
      console.log('Password verification:', isValid ? '✅ SUCCESS' : '❌ FAILED');
    }

  } catch (error) {
    console.error('❌ Server-style admin creation failed:', error);
  }
};

// Run server-style creation
serverStyleAdmin();
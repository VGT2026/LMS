import { UserModel } from '../models/User';
import { hashPassword } from '../utils/auth';

const manualAdminCreate = async () => {
  try {
    console.log('🔧 Manually creating admin user...');

    // First, try to delete existing admin
    console.log('Deleting existing admin...');
    await UserModel.update(13, { is_active: false }); // Soft delete by deactivating

    // Create new admin with manually hashed password
    const password = 'admin123';
    const hashedPassword = await hashPassword(password);

    console.log('Creating new admin with password:', password);
    console.log('Hashed password:', hashedPassword.substring(0, 20) + '...');

    const newAdmin = await UserModel.create({
      name: 'System Administrator',
      email: 'admin@lmspro.com',
      password: hashedPassword,
      role: 'admin',
      is_active: true,
    });

    console.log('✅ New admin created with ID:', newAdmin.id);
    console.log('Email:', newAdmin.email);
    console.log('Role:', newAdmin.role);

  } catch (error) {
    console.error('❌ Manual admin creation failed:', error);
  }
};

// Run manual creation
manualAdminCreate();
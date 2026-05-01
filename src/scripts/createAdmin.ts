import dotenv from 'dotenv';
dotenv.config();

import { UserModel } from '../models/User';
import { hashPassword } from '../utils/auth';

const createAdmin = async () => {
  try {
    const email = 'admin@lmspro.com';
    const password = 'admin123';

    const existing = await UserModel.findByEmail(email);
    if (existing) {
      const hash = await hashPassword(password);
      await UserModel.update(existing.id!, { password: hash, is_active: true });
      console.log('✅ Admin password reset: admin@lmspro.com / admin123');
      return;
    }

    const hash = await hashPassword(password);
    await UserModel.create({
      name: 'System Administrator',
      email,
      password: hash,
      role: 'admin',
      is_active: true,
    });
    console.log('✅ Admin created: admin@lmspro.com / admin123');
  } catch (error) {
    console.error('❌ Failed:', error);
    process.exit(1);
  }
};

createAdmin();

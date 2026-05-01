/**
 * Test admin login - run: npm run test:admin
 * Verifies admin exists and password admin123 works
 */
import dotenv from 'dotenv';
dotenv.config();

import { UserModel } from '../models/User';
import { comparePassword, hashPassword } from '../utils/auth';

async function test() {
  console.log('\n--- Admin Login Test ---\n');
  const email = 'admin@lmspro.com';
  const password = 'admin123';

  const user = await UserModel.findByEmail(email);
  console.log('1. findByEmail(admin@lmspro.com):', user ? `Found (id=${user.id}, role=${user.role}, is_active=${user.is_active})` : 'NOT FOUND');

  if (!user) {
    console.log('\n❌ Admin user not found. Run: npm run db:reset-admin, then restart server.\n');
    process.exit(1);
  }

  const match = await comparePassword(password, user.password);
  console.log('2. Password check (admin123):', match ? 'MATCH ✓' : 'NO MATCH ✗');

  if (!match) {
    console.log('\nResetting admin password...');
    const freshHash = await hashPassword(password);
    await UserModel.update(user.id!, { password: freshHash });
    const updated = await UserModel.findByEmail(email);
    const match2 = updated ? await comparePassword(password, updated.password) : false;
    console.log('After reset:', match2 ? 'MATCH ✓' : 'NO MATCH ✗');
  }

  console.log('\n--- Done ---\n');
  process.exit(match ? 0 : 1);
}

test().catch((err) => {
  console.error(err);
  process.exit(1);
});

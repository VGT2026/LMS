import dotenv from 'dotenv';
import { UserModel } from '../models/User';
import { getSuperadminBootstrapConfig } from '../utils/superadminBootstrap';
import { userRoleAllows } from '../utils/mysqlSchema';

dotenv.config();

/**
 * Create or repair the bootstrap superadmin (role + password when upgrading).
 * Usage: npm run db:ensure-superadmin
 * Force password reset: SUPERADMIN_RESET_PASSWORD=true npm run db:ensure-superadmin
 */
async function main(): Promise<void> {
  const { email, password, name } = getSuperadminBootstrapConfig();
  const roleOk = await userRoleAllows('superadmin');
  if (!roleOk) {
    console.error('❌ users.role ENUM does not include superadmin. Run npm run db:migrate first.');
    process.exit(1);
  }

  const existing = await UserModel.findByEmail(email);
  if (!existing) {
    await UserModel.create({
      name,
      email,
      password,
      role: 'superadmin',
      is_active: true,
    });
    console.log('✅ Created superadmin:', email);
    process.exit(0);
  }

  const updates: { role?: 'superadmin'; password?: string; is_active?: boolean } = {};
  if (existing.role !== 'superadmin') {
    updates.role = 'superadmin';
  }
  if (!existing.is_active) {
    updates.is_active = true;
  }

  const forceReset = process.env.SUPERADMIN_RESET_PASSWORD === 'true';
  const shouldSyncPassword =
    forceReset || existing.role !== 'superadmin' || process.env.SUPERADMIN_SYNC_PASSWORD === 'true';

  if (shouldSyncPassword) {
    updates.password = password;
  }

  if (Object.keys(updates).length === 0) {
    console.log('⏭️ Superadmin already configured:', email);
    console.log('   To reset password: SUPERADMIN_RESET_PASSWORD=true npm run db:ensure-superadmin');
    process.exit(0);
  }

  await UserModel.update(existing.id!, updates);
  console.log('✅ Updated superadmin:', email, Object.keys(updates).join(', '));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

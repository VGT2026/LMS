/**
 * Default bootstrap account (override with SUPERADMIN_* env on Railway).
 * Change password after first login in production.
 */
export function getSuperadminBootstrapConfig(): {
  email: string;
  password: string;
  name: string;
} {
  return {
    email: process.env.SUPERADMIN_EMAIL?.trim().toLowerCase() || 'superadmin@lmspro.com',
    password: process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!',
    name: process.env.SUPERADMIN_NAME?.trim() || 'Super Administrator',
  };
}

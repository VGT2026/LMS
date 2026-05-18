/**
 * Superadmin acceptance flow (run against local or Railway API).
 *
 *   API_BASE_URL=https://lms-production-7308.up.railway.app \
 *   SUPERADMIN_EMAIL=superadmin@lmspro.com \
 *   SUPERADMIN_PASSWORD=SuperAdmin123! \
 *   npm run test:superadmin-acceptance
 */
import dotenv from 'dotenv';
import { API_ORIGIN } from './apiOrigin';

dotenv.config();

const BASE = `${API_ORIGIN}/api/auth`;

type Json = Record<string, unknown>;

async function request(
  method: string,
  path: string,
  body?: Json,
  token?: string
): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let json: Json = {};
  try {
    json = (await res.json()) as Json;
  } catch {
    json = { message: 'Non-JSON response' };
  }
  return { status: res.status, json };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const superEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@lmspro.com';
  const superPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
  const testAdminEmail = `admin.test.${Date.now()}@lmspro.com`;
  const testAdminPassword = 'TestAdmin1';
  const testAdminName = 'Acceptance Test Admin';

  console.log('API:', BASE);

  // 1. Login superadmin
  const loginSuper = await request('POST', '/login', { email: superEmail, password: superPassword });
  assert(loginSuper.status === 200, `1. superadmin login expected 200, got ${loginSuper.status}: ${loginSuper.json.message}`);
  const superToken = (loginSuper.json.data as Json)?.token as string;
  assert(Boolean(superToken), '1. superadmin login missing token');
  const superRole = ((loginSuper.json.data as Json)?.user as Json)?.role;
  assert(superRole === 'superadmin', `1. expected role superadmin, got ${superRole}`);
  console.log('✓ 1. Superadmin login');

  // 2. Create admin
  const create = await request(
    'POST',
    '/superadmin/admin',
    { name: testAdminName, email: testAdminEmail, password: testAdminPassword },
    superToken
  );
  assert(
    create.status === 201 || create.status === 200,
    `2. create admin expected 201, got ${create.status}: ${create.json.message}`
  );
  const admin = (create.json.data as Json)?.admin as Json;
  assert(admin?.email === testAdminEmail, '2. create admin wrong email in response');
  assert(admin?.role === 'admin', '2. create admin wrong role');
  console.log('✓ 2. POST /superadmin/admin');

  // 3. Login as new admin
  const loginAdmin = await request('POST', '/login', {
    email: testAdminEmail,
    password: testAdminPassword,
  });
  assert(loginAdmin.status === 200, `3. admin login expected 200, got ${loginAdmin.status}: ${loginAdmin.json.message}`);
  const adminRole = ((loginAdmin.json.data as Json)?.user as Json)?.role;
  assert(adminRole === 'admin', `3. expected role admin, got ${adminRole}`);
  assert(Boolean((loginAdmin.json.data as Json)?.token), '3. admin login missing token');
  console.log('✓ 3. New admin login');

  // 4. List admins
  const list = await request('GET', '/superadmin/admins', undefined, superToken);
  assert(list.status === 200, `4. list admins expected 200, got ${list.status}`);
  const rows = list.json.data as Json[];
  assert(Array.isArray(rows), '4. data must be array');
  assert(rows.some((r) => r.email === testAdminEmail), '4. new admin not in list');
  console.log('✓ 4. GET /superadmin/admins');

  // 5. Student/admin cannot create admin (401 without token)
  const noAuth = await request('POST', '/superadmin/admin', {
    name: 'X',
    email: 'x@test.com',
    password: 'pass12',
  });
  assert(noAuth.status === 401, `5. no token expected 401, got ${noAuth.status}`);
  console.log('✓ 5. POST /superadmin/admin without token → 401');

  // 6. Admin JWT cannot create admin → 403
  const adminToken = (loginAdmin.json.data as Json)?.token as string;
  const forbidden = await request(
    'POST',
    '/superadmin/admin',
    { name: 'Bad', email: `bad.${Date.now()}@test.com`, password: 'pass12' },
    adminToken
  );
  assert(forbidden.status === 403, `6. admin create expected 403, got ${forbidden.status}`);
  console.log('✓ 6. POST /superadmin/admin as admin → 403');

  console.log('\nAll superadmin acceptance checks passed.');
}

main().catch((err) => {
  console.error('\nAcceptance test failed:', err.message || err);
  process.exit(1);
});

/**
 * Multi-tenant isolation acceptance (local or Railway).
 *
 *   API_BASE_URL=http://localhost:3000 npm run test:tenant-isolation
 */
import dotenv from 'dotenv';
import { API_ORIGIN } from './apiOrigin';

dotenv.config();

const AUTH = `${API_ORIGIN}/api/auth`;
const COURSES = `${API_ORIGIN}/api/courses`;

type Json = Record<string, unknown>;

async function request(
  base: string,
  method: string,
  path: string,
  body?: Json,
  token?: string
): Promise<{ status: number; json: Json }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base}${path}`, {
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

function data(json: Json): Json {
  return (json.data as Json) || json;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const superEmail = process.env.SUPERADMIN_EMAIL || 'superadmin@lmspro.com';
  const superPassword = process.env.SUPERADMIN_PASSWORD || 'SuperAdmin123!';
  const ts = Date.now();

  console.log('API:', AUTH);

  const loginSuper = await request(AUTH, 'POST', '/login', {
    email: superEmail,
    password: superPassword,
  });
  assert(loginSuper.status === 200, `superadmin login: ${loginSuper.json.message}`);
  const superToken = data(loginSuper.json).token as string;
  console.log('✓ superadmin login');

  const tenantA = `Org A ${ts}`;
  const tenantB = `Org B ${ts}`;
  const adminAEmail = `admin.a.${ts}@lmspro.com`;
  const adminBEmail = `admin.b.${ts}@lmspro.com`;
  const password = 'TestAdmin1!';

  for (const [label, email, tenant_name] of [
    ['A', adminAEmail, tenantA],
    ['B', adminBEmail, tenantB],
  ] as const) {
    const create = await request(
      AUTH,
      'POST',
      '/superadmin/admin',
      { name: `Admin ${label}`, email, password, tenant_name },
      superToken
    );
    assert(create.status === 201 || create.status === 200, `create admin ${label}: ${create.json.message}`);
    const admin = data(create.json).admin as Json;
    assert(admin?.tenant_id != null, `admin ${label} missing tenant_id`);
    console.log(`✓ created admin ${label} tenant_id=${admin.tenant_id}`);
  }

  const loginA = await request(AUTH, 'POST', '/login', { email: adminAEmail, password });
  const loginB = await request(AUTH, 'POST', '/login', { email: adminBEmail, password });
  assert(loginA.status === 200 && loginB.status === 200, 'admin logins failed');

  const userA = data(loginA.json).user as Json;
  const userB = data(loginB.json).user as Json;
  const tokenA = data(loginA.json).token as string;
  const tokenB = data(loginB.json).token as string;

  assert(userA.tenant_id != null && userB.tenant_id != null, 'login missing tenant_id');
  assert(userA.tenant_id !== userB.tenant_id, 'admins must be in different tenants');
  console.log('✓ 5. login returns tenant_id per admin');

  const instrAEmail = `instr.a.${ts}@lmspro.com`;
  const createInstrA = await request(
    AUTH,
    'POST',
    '/admin/instructor',
    { name: 'Instructor A', email: instrAEmail, password: 'Instructor1!' },
    tokenA
  );
  assert(createInstrA.status === 201 || createInstrA.status === 200, `create instructor A: ${createInstrA.json.message}`);

  const instrListA = await request(AUTH, 'GET', '/admin/instructors', undefined, tokenA);
  const instructorsA = (data(instrListA.json) as Json[]) || [];
  const instrA = instructorsA.find((i) => i.email === instrAEmail) as Json | undefined;
  assert(instrA?.id != null, 'instructor A not in admin A list');

  const createCourseA = await request(
    COURSES,
    'POST',
    '/',
    {
      title: `Course A ${ts}`,
      category: 'Testing',
      instructor_id: instrA!.id,
    },
    tokenA
  );
  assert(createCourseA.status === 201 || createCourseA.status === 200, `create course A: ${createCourseA.json.message}`);
  const courseA = data(createCourseA.json) as Json;
  console.log('✓ 1. Admin A created instructor + course');

  const listB = await request(COURSES, 'GET', '/', undefined, tokenB);
  assert(listB.status === 200, `admin B list courses: ${listB.json.message}`);
  const rowsB = (data(listB.json) as Json[]) || [];
  const leaked = rowsB.some((c) => c.id === courseA.id || String(c.title).includes(`Course A ${ts}`));
  assert(!leaked, 'Admin B must not see Admin A courses');
  console.log('✓ 2. Admin B GET /courses does not see Admin A courses');

  const listSuper = await request(AUTH, 'GET', '/superadmin/tenants', undefined, superToken);
  assert(listSuper.status === 200, `list tenants: ${listSuper.json.message}`);
  const tenants = data(listSuper.json) as Json[];
  assert(Array.isArray(tenants) && tenants.length >= 2, 'superadmin should see tenants');
  console.log('✓ 4. Superadmin lists tenants');

  const statsSuper = await request(AUTH, 'GET', '/superadmin/stats', undefined, superToken);
  assert(statsSuper.status === 200, `superadmin stats: ${statsSuper.json.message}`);
  const byTenant = (data(statsSuper.json) as Json).byTenant as Json[] | undefined;
  assert(Array.isArray(byTenant) && byTenant.length >= 2, 'stats missing byTenant breakdown');
  console.log('✓ 4. Superadmin stats include per-tenant breakdown');

  console.log('\nAll tenant isolation checks passed.');
}

main().catch((e) => {
  console.error('\nFAILED:', (e as Error).message);
  process.exit(1);
});

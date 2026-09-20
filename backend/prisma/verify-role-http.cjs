// End-to-end smoke test against the disposable database used by verify-role-migration.cjs.
const { PrismaClient } = require('@prisma/client');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const url = new URL(process.env.DATABASE_URL || 'postgresql://invalid/');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/role_migration_test' || process.env.DIRECT_URL !== url.href) throw new Error('Disposable local database required');
const db = new PrismaClient();
const password = `Test-${randomBytes(18).toString('hex')}!A1`;
const email = `operator-${Date.now()}@example.com`;
const port = 55440;
let server;
async function call(endpoint, cookie, body, method) {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1${endpoint}`, {
    method: method || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, data: await res.json(), cookie: res.headers.get('set-cookie')?.split(';')[0] };
}
async function main() {
  server = spawn(process.execPath, [path.resolve(__dirname, '../dist/start.js')], {
    cwd: os.tmpdir(), windowsHide: true,
    env: { ...process.env, NODE_ENV: 'test', PORT: String(port), JWT_SECRET: randomBytes(32).toString('hex'), SYSTEM_ADMIN_EMAIL: email, SYSTEM_ADMIN_PASSWORD: password },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.on('data', b => { logs += b.toString(); });
  server.stderr.on('data', b => { logs += b.toString(); });
  for (let i = 0; i < 80; i++) {
    if (logs.includes('System admin seed completed')) break;
    if (server.exitCode !== null) throw new Error(`Server startup failed: ${logs}`);
    await new Promise(r => setTimeout(r, 250));
  }
  const operator = await call('/auth/login', null, { email, password });
  assert.equal(operator.status, 200);
  assert.equal(operator.data.data.user.role, 'System Admin');
  assert.equal((await call('/admin/tenants', operator.cookie)).status, 200);
  assert.equal((await call('/crm/contacts', operator.cookie)).status, 403);
  const tenant = await db.tenant.create({ data: { name: 'HTTP fixture', slug: `http-${Date.now()}`, status: 'ACTIVE' } });
  const admin = await db.user.create({ data: { tenantId: tenant.id, firstName: 'Client', lastName: 'Admin', email: `admin-${Date.now()}@camxian.com`, role: 'Client Admin', passwordHash: await bcrypt.hash(password, 10), mustChangePassword: true } });
  let login = await call('/auth/login', null, { email: admin.email, password });
  assert.equal(login.status, 200);
  assert.equal(login.data.data.user.mustChangePassword, true);
  assert.equal((await call('/administration/roles', login.cookie)).status, 403);
  const newPassword = `${password}Changed2!`;
  assert.equal((await call('/auth/change-password', login.cookie, { currentPassword: password, password: newPassword })).status, 200);
  login = await call('/auth/login', null, { email: admin.email, password: newPassword });
  assert.equal((await call('/administration/roles', login.cookie)).status, 403);
  assert.equal((await call('/auth/onboarding/complete', login.cookie, {})).status, 200);
  const role = await call('/administration/roles', login.cookie, { name: 'HTTP Sales', permissions: [{ module: 'contacts', canView: true, canCreate: false, canEdit: false, canDelete: false }] });
  assert.equal(role.status, 201);
  const staffEmail = `staff-${Date.now()}@camxian.com`;
  const staff = await call('/administration/users', login.cookie, { email: staffEmail, firstName: 'Staff', lastName: 'Member', password, role: 'HTTP Sales' });
  assert.equal(staff.status, 201);
  const staffId = staff.data.data.id;
  await db.user.update({ where: { id: staffId }, data: { mustChangePassword: false } });
  const staffLogin = await call('/auth/login', null, { email: staffEmail, password });
  assert.equal(staffLogin.status, 200);
  assert.equal((await call('/crm/contacts', staffLogin.cookie)).status, 200);
  assert.equal((await call('/administration/roles', staffLogin.cookie)).status, 403);
  assert.equal((await call('/admin/tenants', staffLogin.cookie)).status, 404);
  assert.equal((await call(`/administration/roles/${role.data.data.id}`, login.cookie, { permissions: [] }, 'PUT')).status, 200);
  assert.equal((await call('/crm/contacts', staffLogin.cookie)).status, 403);
  const another = await db.tenant.create({ data: { name: 'Other tenant', slug: `other-${Date.now()}` } });
  const outsider = await db.user.create({ data: { tenantId: another.id, email: `other-${Date.now()}@camxian.com`, firstName: 'Other', lastName: 'Staff', role: 'Other' } });
  assert.equal((await call('/administration/roles/assign', login.cookie, { userId: outsider.id, roleId: role.data.data.id })).status, 404);
  console.log('PASS: migrated application starts; operator separation, password/onboarding order, custom-role creation, user creation, live permission revocation, and cross-tenant assignment denial.');
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(async () => { server?.kill(); await db.$disconnect(); });

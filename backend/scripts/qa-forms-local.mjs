// Disposable local browser fixture. No configured database or email provider is used.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { randomBytes, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';

const root = resolve(import.meta.dirname, '../..');
const db = await PGlite.create(); await replayCrmMigrations(db);
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0 }); await socket.start();
const database = `postgresql://postgres:postgres@${socket.getServerConn()}/leadcrm_forms_test_${Date.now()}?connection_limit=1&statement_cache_size=0`;
Object.assign(process.env, { NODE_ENV: 'test', DATABASE_URL: database, DIRECT_URL: database, JWT_SECRET: randomBytes(32).toString('hex'), ENCRYPTION_KEY: randomBytes(32).toString('hex'), APP_URL: 'http://localhost:3016', CORS_ORIGIN: 'http://localhost:3016', ALLOWED_ORIGINS: 'http://localhost:3016', BREVO_API_KEY: '', BREVO_SMS_SENDER: '' });
const require = createRequire(import.meta.url), Module = require('node:module'), originalResolve = Module._resolveFilename;
Module._resolveFilename = function(request, parent, isMain, options) { return request === '@leadcrm/shared' ? resolve(root, 'backend/dist/shared/src/index.js') : originalResolve.call(this, request, parent, isMain, options); };
const shared = require('@leadcrm/shared');
const prisma = require('../dist/backend/src/config/database.config.js').default;
const app = require('../dist/backend/src/app.js').default;
const bcrypt = require('bcryptjs');
const tenant = await prisma.tenant.create({ data: { name: 'Forms QA disposable fixture', slug: randomUUID(), onboardingStep: 3, onboardingCompletedAt: new Date() } });
const user = await prisma.user.create({ data: { tenantId: tenant.id, firstName: 'Forms', lastName: 'Tester', email: 'forms-qa@camxian.com', passwordHash: await bcrypt.hash('Forms-Local-QA-2026!', 10), role: 'Client Admin', status: 'ACTIVE', mustChangePassword: false, onboardingCompletedAt: new Date(), emailVerified: new Date() } });
await prisma.productInterest.create({ data: { tenantId: tenant.id, name: 'Smart Lock', dealValue: 100 } });
for (const [name, type] of [['Age', 'Number'], ['Preferred visit', 'Date'], ['Notes', 'Long Text'], ['Referral', 'Text'], ['Customer category', 'Dropdown']]) {
  const definition = { ...shared.ClosingFieldInputSchema.parse({ name, type, module: 'leads', group: 'Basic Information', required: false, ...(type === 'Dropdown' ? { options: ['Home', 'Business'] } : {}) }), id: randomUUID(), version: 1 };
  await prisma.closingFieldDefinition.create({ data: { tenantId: tenant.id, id: definition.id, definition } });
}
const form = await prisma.marketingForm.create({ data: { tenantId: tenant.id, createdById: user.id, ...shared.defaultContactForm('Forms Builder QA') } });
const server = app.listen(4106, '127.0.0.1', () => console.log(`Disposable Forms API ready on 127.0.0.1:4106; form ${form.id}`));
let closing = false;
async function close() { if (closing) return; closing = true; server.closeAllConnections(); await new Promise(done => server.close(done)); await prisma.$disconnect(); await socket.stop(); await db.close(); process.exit(0); }
process.on('SIGINT', close); process.on('SIGTERM', close);

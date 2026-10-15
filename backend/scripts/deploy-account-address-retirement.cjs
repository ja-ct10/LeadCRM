// Separate operator cutover; never called by Coolify startup/db:deploy.
// --status/--verify are read-only. Before --retire, obtain explicit approval,
// verify a restorable backup, pause all writers and stop older APIs/workers.
// Required: CRM_ACCOUNTS_EXPECT_DATABASE, CRM_ACCOUNTS_VERIFY_API,
// CRM_ACCOUNTS_VERIFY_COMMIT (40-char SHA), CRM_ACCOUNTS_VERIFY_TOKEN.
// Retirement attestations: CRM_ACCOUNTS_PRODUCTION_APPROVAL and
// CRM_ACCOUNTS_CUTOVER_READY must both equal the verified SHA.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { readFileSync, readdirSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { spawnSync } = require('node:child_process');
const { deploymentPlan, migrate, verifyAppliedHistory } = require('./deploy-crm-imports.cjs');
const root = resolve(__dirname, '../prisma');
const expansion = '20261201000000_accounts_full_address';
const retirement = '20261202000000_retire_account_address_columns';
const fields = ['city', 'province', 'country'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
const finished = row => row.finished_at && !row.rolled_back_at;

// Execute the exact existing dependency guard, without the UPDATE/DROP portion.
// A READ ONLY transaction independently prevents accidental writes in verification.
const sql = readFileSync(join(root, 'migrations', retirement, 'migration.sql'), 'utf8');
const dependencyGuard = sql.match(/DO \$\$[\s\S]*?END \$\$;/)?.[0];
if (!dependencyGuard || !dependencyGuard.includes('ACCOUNT_ADDRESS_SCHEDULED_CAMPAIGN_REQUIRES_REPAIR')) fail('ACCOUNT_DEPENDENCY_GUARD_MISSING');

async function readStatus(tx) {
  const [identity] = await tx.$queryRawUnsafe('SELECT current_database() AS database');
  const [{ present }] = await tx.$queryRawUnsafe("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present");
  const records = present ? await tx.$queryRawUnsafe('SELECT migration_name, finished_at, rolled_back_at, checksum FROM public._prisma_migrations') : [];
  const columns = await tx.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Account'");
  return { database: identity.database, records, columns: columns.map(row => row.column_name) };
}

function accountDeployment(status, names = readdirSync(join(root, 'migrations'))) {
  verifyAppliedHistory(status.records, names);
  if (status.records.some(row => !row.finished_at && !row.rolled_back_at)) fail('FAILED_MIGRATION_REQUIRES_RECOVERY');
  if (!status.columns.includes('address')) fail('ACCOUNT_ADDRESS_COLUMN_MISSING');
  const present = fields.filter(field => status.columns.includes(field));
  const applied = status.records.some(row => row.migration_name === retirement && finished(row));
  if (applied && present.length) fail('ACCOUNT_RETIREMENT_SCHEMA_DRIFT');
  if (!applied && present.length !== 3) fail('ACCOUNT_ADDRESS_PARTIAL_SCHEMA_REQUIRES_REPAIR');
  if (!status.records.some(row => row.migration_name === expansion && finished(row))) fail('ACCOUNT_ADDRESS_EXPANSION_REQUIRED');
  const plan = deploymentPlan(status.records, names);
  const exclude = plan.exclude.filter(name => name !== retirement);
  const pending = names.filter(name => /^\d+_/.test(name) && name <= plan.through && !exclude.includes(name)
    && !status.records.some(row => row.migration_name === name && finished(row)));
  if (pending.some(name => name !== retirement)) fail('ACCOUNT_UNEXPECTED_PENDING_MIGRATIONS');
  return { applied, present, through: plan.through, exclude, pending };
}

async function readOnly(db, work) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '60s'");
    return work(tx);
  }, { maxWait: 10000, timeout: 120000 });
}

async function verifyAccountsRelease({ api, commit, token }, request = fetch) {
  if (!api || !/^[a-f0-9]{40}$/.test(commit || '') || !token) fail('ACCOUNT_RELEASE_CONFIGURATION_REQUIRED');
  const url = new URL(api);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) fail('HTTPS_API_REQUIRED');
  const get = async path => {
    const response = await request(api.replace(/\/$/, '') + path, {
      headers: { Authorization: `Bearer ${token}`, Cookie: `leadcrm_token=${token}`, 'Cache-Control': 'no-cache' },
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) fail('ACCOUNT_API_CHECK_FAILED');
    return response.json();
  };
  const health = await get('/health');
  if (health.commit !== commit || !health.capabilities?.includes('accounts-full-address-contract-v1')) fail('ACCOUNT_RELEASE_NOT_SERVING');
  const me = await get('/auth/me'), user = me.data?.user ?? me.data;
  if (!user?.id || !user.tenantId || user.role !== 'Client Admin') fail('ACCOUNT_ADMIN_VERIFICATION_REQUIRED');
  const rows = [];
  for (const archived of [false, true]) {
    const seen = new Set();
    let expectedTotal;
    for (let page = 1; ; page++) {
      const list = await get(`/crm/accounts?page=${page}&limit=100&archived=${archived}`);
      if (!Array.isArray(list.data) || !Number.isInteger(list.meta?.total) || typeof list.meta.hasMore !== 'boolean') fail('ACCOUNT_LIST_CONTRACT_INVALID');
      expectedTotal ??= list.meta.total;
      if (expectedTotal !== list.meta.total) fail('ACCOUNT_PAGINATION_INVALID');
      for (const account of list.data) {
        if (!account.id || seen.has(account.id) || account.tenantId !== user.tenantId || fields.some(key => Object.hasOwn(account, key))
          || !(account.address === null || typeof account.address === 'string')) fail('ACCOUNT_PUBLIC_CONTRACT_INVALID');
        seen.add(account.id);
        if (!archived) {
          const detail = (await get(`/crm/accounts/${encodeURIComponent(account.id)}`)).data;
          if (!detail || detail.id !== account.id || detail.tenantId !== user.tenantId || detail.address !== account.address
            || fields.some(key => Object.hasOwn(detail, key))) fail('ACCOUNT_DETAIL_CONTRACT_INVALID');
        }
        rows.push({ id: account.id, address: account.address, isArchived: archived });
      }
      if (!list.meta.hasMore) { if (seen.size !== expectedTotal) fail('ACCOUNT_PAGINATION_INVALID'); break; }
      if (!list.data.length || page >= 10000) fail('ACCOUNT_PAGINATION_INVALID');
    }
  }
  return { commit, userId: user.id, tenantId: user.tenantId, rows };
}

// Reproduce the immutable SQL's address projection using only SELECTs. This
// intentionally retains its historical-country-default rule for stored rows.
async function preservationSnapshot(tx, split) {
  const [accounts] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,
    md5(coalesce(string_agg(md5((to_jsonb(a)-ARRAY['address','city','province','country'])::text), '' ORDER BY id), '')) AS preserved FROM public."Account" a`);
  const projection = split ? `WITH RECURSIVE addresses AS (
    SELECT id, address AS value, ARRAY[city,province,country] AS parts, 0 AS step FROM public."Account"
    UNION ALL
    SELECT a.id, CASE
      WHEN c.component IS NULL OR c.component = '' THEN a.value
      WHEN a.step = 2 AND n.component = 'philippines' AND coalesce(btrim(a.value,E' \\t\\r\\n'),'') = '' THEN a.value
      WHEN strpos(' ' || n.address || ' ', ' ' || n.component || ' ') > 0 THEN a.value
      WHEN coalesce(btrim(a.value,E' \\t\\r\\n'),'') = '' THEN c.component
      ELSE rtrim(a.value,E' \\t\\r\\n,;') || ', ' || c.component END,
      a.parts, a.step+1 FROM addresses a
      CROSS JOIN LATERAL (SELECT btrim(a.parts[a.step+1],E' \\t\\r\\n') AS component) c
      CROSS JOIN LATERAL (SELECT btrim(regexp_replace(lower(c.component),'[[:space:],;]+',' ','g')) AS component,
        btrim(regexp_replace(lower(coalesce(a.value,'')),'[[:space:],;]+',' ','g')) AS address) n WHERE a.step < 3
    ) SELECT md5(coalesce(string_agg(md5(jsonb_build_array(id,value)::text), '' ORDER BY id), '')) AS digest FROM addresses WHERE step=3`
    : `SELECT md5(coalesce(string_agg(md5(jsonb_build_array(id,address)::text), '' ORDER BY id), '')) AS digest FROM public."Account"`;
  const [addresses] = await tx.$queryRawUnsafe(projection);
  const relationships = {};
  for (const table of ['AccountProductInterest', 'TaskAccount', 'Lead', 'Contact', 'Deal']) {
    if (table === 'AccountProductInterest') {
      const [linkTable] = await tx.$queryRawUnsafe(`SELECT to_regclass('public."AccountProductInterest"') IS NOT NULL AS present`);
      if (!linkTable.present) continue;
    }
    // Identifiers come exclusively from this fixed allowlist.
    const [state] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count,
      md5(coalesce(string_agg(md5(to_jsonb(t)::text), '' ORDER BY to_jsonb(t)::text), '')) AS digest FROM public."${table}" t`);
    relationships[table] = state;
  }
  return { accounts, addresses, relationships };
}

function assertCutoverApproval(env, commit) {
  if (env.CRM_ACCOUNTS_PRODUCTION_APPROVAL !== commit) fail('ACCOUNT_EXPLICIT_PRODUCTION_APPROVAL_REQUIRED');
  if (env.CRM_ACCOUNTS_CUTOVER_READY !== commit) fail('ACCOUNT_BACKUP_AND_WRITER_SHUTDOWN_NOT_VERIFIED');
}

async function runAccountsCutover(db, mode, env = process.env, request = fetch, apply = migrate) {
  if (!['--status', '--verify', '--retire'].includes(mode)) fail('INVALID_MODE');
  const status = await readOnly(db, readStatus);
  let plan;
  try { plan = accountDeployment(status); }
  catch (error) {
    if (mode !== '--status') throw error;
    return { database: status.database, migrations: status.records.filter(row => [expansion, retirement].includes(row.migration_name)),
      presentRetiredColumns: fields.filter(field => status.columns.includes(field)), blocked: accountErrorCode(error), readOnly: true };
  }
  if (mode === '--status') return { database: status.database, migrations: status.records.filter(row => [expansion, retirement].includes(row.migration_name)),
    presentRetiredColumns: plan.present, pending: plan.pending, readOnly: true, releaseAndDependenciesVerified: false };
  if (!env.CRM_ACCOUNTS_EXPECT_DATABASE || status.database !== env.CRM_ACCOUNTS_EXPECT_DATABASE) fail('ACCOUNT_DATABASE_IDENTITY_REQUIRED');
  const release = await verifyAccountsRelease({ api: env.CRM_ACCOUNTS_VERIFY_API, commit: env.CRM_ACCOUNTS_VERIFY_COMMIT, token: env.CRM_ACCOUNTS_VERIFY_TOKEN }, request);
  const source = env.SOURCE_COMMIT || spawnSync('git', ['rev-parse', 'HEAD'], { cwd: resolve(__dirname, '../..'), encoding: 'utf8', windowsHide: true }).stdout?.trim();
  if (source !== release.commit) fail('ACCOUNT_LOCAL_RELEASE_MISMATCH');
  const before = await readOnly(db, async tx => {
    const users = await tx.$queryRawUnsafe('SELECT id FROM public."User" WHERE id=$1 AND "tenantId"=$2 AND status=\'ACTIVE\' AND role=\'Client Admin\'', release.userId, release.tenantId);
    if (users.length !== 1) fail('VERIFIED_API_DATABASE_MISMATCH');
    const rows = await tx.$queryRawUnsafe('SELECT id,address,"isArchived" FROM public."Account" WHERE "tenantId"=$1 ORDER BY id', release.tenantId);
    if (JSON.stringify(rows) !== JSON.stringify([...release.rows].sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) fail('ACCOUNT_API_DATABASE_MISMATCH');
    await tx.$executeRawUnsafe(dependencyGuard);
    return mode === '--retire' && !plan.applied ? preservationSnapshot(tx, true) : null;
  });
  const report = { database: status.database, commit: release.commit, authenticatedReads: true, dependenciesVerified: true,
    applied: plan.applied, presentRetiredColumns: plan.present };
  if (mode === '--verify' || plan.applied) return report;
  assertCutoverApproval(env, release.commit);
  // Include applied history and only this pending migration. The plan has already
  // rejected every other pending nondeferred migration, and no marker bypasses SQL.
  await db.$disconnect();
  await apply(plan.through, plan.exclude);
  await readOnly(db, async tx => {
    const afterStatus = await readStatus(tx);
    if (!accountDeployment(afterStatus).applied) fail('ACCOUNT_RETIREMENT_LEDGER_POSTCHECK_FAILED');
    const after = await preservationSnapshot(tx, false);
    if (JSON.stringify(before) !== JSON.stringify(after)) fail('ACCOUNT_PRESERVATION_POSTCHECK_FAILED');
  });
  return { ...report, applied: true, presentRetiredColumns: [], preservationVerified: true };
}

function accountErrorCode(error) {
  return String(error.meta?.message || error.message || '').match(/ACCOUNT_[A-Z_]+/)?.[0] || error.code || error.errorCode || error.name;
}

async function main() {
  const db = new PrismaClient({ log: [], datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } } });
  try { console.log(JSON.stringify(await runAccountsCutover(db, process.argv[2]), null, 2)); }
  finally { await db.$disconnect(); }
}
module.exports = { expansion, retirement, dependencyGuard, accountDeployment, verifyAccountsRelease, preservationSnapshot, assertCutoverApproval, runAccountsCutover, accountErrorCode };
if (require.main === module) main().catch(error => { console.error('[account-retirement]', accountErrorCode(error)); process.exitCode = 1; });

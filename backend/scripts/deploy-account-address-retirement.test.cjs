const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');
const { createHash } = require('node:crypto');
const { expansion, retirement, dependencyGuard, accountDeployment, verifyAccountsRelease, assertCutoverApproval } = require('./deploy-account-address-retirement.cjs');
const { deploymentPlan } = require('./deploy-crm-imports.cjs');
const directory = join(__dirname, '../prisma/migrations');
const names = readdirSync(directory).filter(name => /^\d+_/.test(name));
const records = names.map(migration_name => ({ migration_name, finished_at: new Date(), rolled_back_at: null,
  checksum: createHash('sha256').update(readFileSync(join(directory, migration_name, 'migration.sql'))).digest('hex') }));
const pending = () => ({ database: 'test', columns: ['address','city','province','country'], records: records.filter(row => row.migration_name !== retirement) });

test('normal deployment defers Account retirement; controlled plan includes only it', () => {
  const status = pending();
  assert.ok(deploymentPlan(status.records, names).exclude.includes(retirement));
  const controlled = accountDeployment(status, names);
  assert.deepEqual(controlled.pending, [retirement]);
  assert.ok(!controlled.exclude.includes(retirement));
  const deferred = ['20261110000000_retire_unused_crm_columns','20261112000000_retire_lead_nonform_columns','20261129000000_retire_contact_obsolete_columns','20261130000000_remove_contact_job_title'];
  status.records = status.records.filter(row => !deferred.includes(row.migration_name));
  assert.deepEqual(accountDeployment(status, names).exclude, deferred);
});
test('requires expansion, consistent columns, clean history and no other pending migrations', () => {
  const status = pending();
  assert.throws(() => accountDeployment({ ...status, records: status.records.filter(row => row.migration_name !== expansion) }, names), /ACCOUNT_ADDRESS_EXPANSION_REQUIRED/);
  for (const columns of [['address'], ['address','city'], ['address','city','country']]) assert.throws(() => accountDeployment({ ...status, columns }, names), /PARTIAL_SCHEMA/);
  assert.throws(() => accountDeployment({ ...status, records }, names), /SCHEMA_DRIFT/);
  assert.throws(() => accountDeployment({ ...status, records: [...status.records, {migration_name:retirement,finished_at:null,rolled_back_at:null}] }, names), /FAILED_MIGRATION/);
  const other = '20261203000000_optional_closed_won_defaults';
  assert.throws(() => accountDeployment({ ...status, records: status.records.filter(row => row.migration_name !== other) }, names), /UNEXPECTED_PENDING/);
  const corrupt = status.records.map(row => row.migration_name === expansion ? { ...row, checksum: 'invalid' } : row);
  assert.throws(() => accountDeployment({ ...status, records: corrupt }, names), /CHECKSUM_MISMATCH/);
  assert.equal(accountDeployment({ ...status, columns: ['address'], records }, names).applied, true);
});
test('explicit approval and backup/writer attestation are separate mandatory gates', () => {
  const commit = 'a'.repeat(40);
  assert.throws(() => assertCutoverApproval({}, commit), /EXPLICIT_PRODUCTION_APPROVAL/);
  assert.throws(() => assertCutoverApproval({ CRM_ACCOUNTS_PRODUCTION_APPROVAL: commit }, commit), /BACKUP_AND_WRITER/);
  assert.doesNotThrow(() => assertCutoverApproval({ CRM_ACCOUNTS_PRODUCTION_APPROVAL: commit, CRM_ACCOUNTS_CUTOVER_READY: commit }, commit));
});
test('read-only dependency guard contains no consolidation or column drops', () => {
  assert.match(dependencyGuard, /ACTIVE_WORKFLOW_REQUIRES_REPAIR/);
  assert.match(dependencyGuard, /ACTIVE_AUDIENCE_REQUIRES_REPAIR/);
  assert.match(dependencyGuard, /SCHEDULED_CAMPAIGN_REQUIRES_REPAIR/);
  assert.doesNotMatch(dependencyGuard, /\b(UPDATE|DELETE|ALTER|DROP|INSERT|CREATE)\b/i);
});

const commit = 'a'.repeat(40);
const config = { api: 'https://crm.example/api/v1', commit, token: 'test-token' };
function apiFixture(overrides = {}) {
  const account = { id:'account',tenantId:'tenant',address:'123 Street',productInterests:[] };
  return async url => ({ ok:true, json:async () => {
    if (url.endsWith('/health')) return overrides.health ?? {commit,capabilities:['accounts-full-address-contract-v1']};
    if (url.endsWith('/auth/me')) return overrides.me ?? {data:{id:'admin',tenantId:'tenant',role:'Client Admin'}};
    if (url.endsWith('/crm/accounts/account')) return {data:overrides.detail ?? account};
    const archived = url.includes('archived=true');
    return overrides.list ?? {data:archived?[]:[{...account,...overrides.account}],meta:{total:archived?0:1,hasMore:false}};
  }});
}
test('requires exact HTTPS release, authenticated admin, tenant-safe list/detail and pagination', async () => {
  const release = await verifyAccountsRelease(config,apiFixture());
  assert.equal(release.rows.length,1);
  await assert.rejects(verifyAccountsRelease({...config,api:'http://crm.example'},apiFixture()),/HTTPS_API/);
  await assert.rejects(verifyAccountsRelease(config,apiFixture({health:{commit:'b'.repeat(40),capabilities:[]}})),/NOT_SERVING/);
  await assert.rejects(verifyAccountsRelease(config,apiFixture({me:{data:{id:'admin',tenantId:'tenant',role:'Sales'}}})),/ADMIN_VERIFICATION/);
  for (const account of [{city:'Manila'},{tenantId:'foreign'},{address:undefined}]) await assert.rejects(verifyAccountsRelease(config,apiFixture({account})),/PUBLIC_CONTRACT/);
  await assert.rejects(verifyAccountsRelease(config,apiFixture({detail:{id:'account',tenantId:'tenant',address:'wrong'}})),/DETAIL_CONTRACT/);
  await assert.rejects(verifyAccountsRelease(config,apiFixture({list:{data:[],meta:{total:1,hasMore:false}}})),/PAGINATION/);
});

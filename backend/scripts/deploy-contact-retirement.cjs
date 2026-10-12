// Controlled Contact retirement. Normal db:deploy remains additive/compatible.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { deploymentPlan, migrate, verifyAppliedHistory } = require('./deploy-crm-imports.cjs');
const preservation = '20261128000000_preserve_contact_retirement_history';
const legacy = '20261110000000_retire_unused_crm_columns';
const retirement = '20261129000000_retire_contact_obsolete_columns';
const fields = ['customerType','recordType','score','linkedinUrl','activeProducts','lastContactedAt','qualifiedAt','disqualifiedReason'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
const finished = row => row.finished_at && !row.rolled_back_at;

async function verifyContactRelease({ api, commit, token }, request = fetch) {
  if (!api || !/^[a-f0-9]{40}$/.test(commit || '') || !token) fail('CONTACT_RELEASE_CONFIGURATION_REQUIRED');
  const url = new URL(api);
  if (url.protocol !== 'https:' || url.username || url.password) fail('HTTPS_API_REQUIRED');
  const get = async path => {
    const response = await request(api.replace(/\/$/, '') + path, { headers: { Authorization: `Bearer ${token}`, Cookie: `leadcrm_token=${token}`, 'Cache-Control': 'no-cache' }, redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (!response.ok) fail('CONTACT_API_CHECK_FAILED');
    return response.json();
  };
  const health = await get('/health');
  if (health.commit !== commit || !health.capabilities?.includes('contact-retirement-contract-v1')) fail('CONTACT_RELEASE_NOT_SERVING');
  const me = await get('/auth/me'), user = me.data?.user ?? me.data;
  if (!user?.id || !user?.tenantId || user.role !== 'Client Admin') fail('CONTACT_ADMIN_VERIFICATION_REQUIRED');
  const counts = { active: 0, archived: 0 };
  for (const archived of [false,true]) {
    let page = 1;
    for (;;) {
      const list = await get(`/crm/contacts?page=${page}&limit=100&archived=${archived}`);
      if (!Array.isArray(list.data) || !Number.isInteger(list.meta?.total)) fail('CONTACT_LIST_CONTRACT_INVALID');
      for (const contact of list.data) {
        if (fields.some(key => Object.hasOwn(contact,key)) || !Array.isArray(contact.productInterests)) fail('CONTACT_PUBLIC_CONTRACT_INVALID');
        if (!archived) {
          const detail = (await get(`/crm/contacts/${encodeURIComponent(contact.id)}`)).data;
          if (!detail || detail.id !== contact.id || fields.some(key=>Object.hasOwn(detail,key))) fail('CONTACT_DETAIL_CONTRACT_INVALID');
        }
      }
      counts[archived ? 'archived' : 'active'] += list.data.length;
      if (!list.meta.hasMore) {
        if (counts[archived ? 'archived' : 'active'] !== list.meta.total) fail('CONTACT_PAGINATION_INVALID');
        break;
      }
      if (!list.data.length || page++ > 10000) fail('CONTACT_PAGINATION_INVALID');
    }
  }
  return { commit, userId:user.id, tenantId:user.tenantId, counts };
}
async function main() {
  const mode = process.argv[2];
  if (!['--verify','--retire'].includes(mode)) fail('INVALID_MODE');
  const release = await verifyContactRelease({ api:process.env.CRM_CONTACTS_VERIFY_API, commit:process.env.CRM_CONTACTS_VERIFY_COMMIT, token:process.env.CRM_CONTACTS_VERIFY_TOKEN });
  const db = new PrismaClient({ log:[], datasources:{db:{url:process.env.DIRECT_URL || process.env.DATABASE_URL}} });
  try {
    const [{ database }] = await db.$queryRawUnsafe('SELECT current_database() AS database');
    if (!process.env.CRM_CONTACTS_EXPECT_DATABASE || database !== process.env.CRM_CONTACTS_EXPECT_DATABASE) fail('CONTACT_DATABASE_IDENTITY_REQUIRED');
    if (!await db.user.findFirst({where:{id:release.userId,tenantId:release.tenantId,status:'ACTIVE',role:'Client Admin'},select:{id:true}})) fail('VERIFIED_API_DATABASE_MISMATCH');
    const counts = await db.$queryRawUnsafe('SELECT "isArchived",count(*)::int AS n FROM public."Contact" WHERE "tenantId"=$1 GROUP BY "isArchived"',release.tenantId);
    for (const archived of [false,true]) if ((counts.find(row=>row.isArchived===archived)?.n ?? 0) !== release.counts[archived?'archived':'active']) fail('CONTACT_API_DATABASE_COUNT_MISMATCH');
    const records = await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at,checksum FROM public._prisma_migrations');
    const names = readdirSync(resolve(__dirname,'../prisma/migrations'));
    verifyAppliedHistory(records,names);
    const plan = deploymentPlan(records,names);
    if (!records.some(row=>row.migration_name===preservation && finished(row))) fail('CONTACT_PRESERVATION_MIGRATION_REQUIRED');
    const columns = await db.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Contact'");
    const present = fields.filter(field=>columns.some(row=>row.column_name===field));
    console.log(JSON.stringify({database,commit:release.commit,authenticatedReads:true,counts:release.counts,presentRetiredColumns:present}));
    if (mode==='--verify') return;
    if (records.some(row=>row.migration_name===retirement && finished(row))) {
      if (present.length) fail('CONTACT_RETIREMENT_SCHEMA_DRIFT');
      return;
    }
    // Operator attestation is mandatory after the exact release has served reads.
    // Stop every older backend/worker, verify a restorable backup, then set this.
    if (process.env.CRM_CONTACTS_CUTOVER_READY !== release.commit) fail('CONTACT_OLD_INSTANCES_AND_BACKUP_NOT_VERIFIED');
    await db.$executeRawUnsafe('SELECT crm_history.capture_contact_retirement()');
    // Never clear populated legacy values merely to pass the immutable old SQL.
    // Its guard must succeed naturally or block this whole cutover for review.
    const exclude = plan.exclude.filter(name=>![legacy,retirement].includes(name));
    await db.$executeRawUnsafe(`COMMENT ON TABLE crm_history.contact_retired_values IS 'leadcrm-contact-retirement-compatible-v1:${release.commit}'`);
    try {
      await db.$disconnect();
      migrate(retirement,exclude);
      const remaining = await db.$queryRawUnsafe("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Contact' AND column_name IN ('customerType','recordType','score','linkedinUrl','activeProducts','lastContactedAt','qualifiedAt','disqualifiedReason')");
      if (remaining.length) fail('CONTACT_RETIREMENT_POSTCHECK_FAILED');
      const ledger = await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at FROM public._prisma_migrations');
      if (![legacy,retirement].every(name=>ledger.some(row=>row.migration_name===name && finished(row)))) fail('CONTACT_RETIREMENT_LEDGER_POSTCHECK_FAILED');
      console.log(JSON.stringify({retirement,remainingRetiredColumns:0,ledgerVerified:true}));
    } finally { await db.$executeRawUnsafe('COMMENT ON TABLE crm_history.contact_retired_values IS NULL'); }
  } finally { await db.$disconnect(); }
}
module.exports={verifyContactRelease};
if (require.main===module) main().catch(error=>{ console.error('[contact-retirement]',error.code || error.errorCode || error.name);process.exitCode=1; });

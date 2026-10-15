// Separate operator cutover. Normal db:deploy never removes these columns.
'use strict';
const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { deploymentPlan, migrate, verifyAppliedHistory } = require('./deploy-crm-imports.cjs');
const preservation = '20261209000000_account_notes_preservation';
const retirement = '20261210000000_retire_account_internal_notes';
const fields = ['internalNotes'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
function cutoverApproval(env) {
  const sha = env.CRM_ACCOUNT_NOTES_VERIFY_COMMIT;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) fail('ACCOUNT_NOTES_EXACT_RELEASE_REQUIRED');
  for (const key of ['CRM_ACCOUNT_NOTES_PRODUCTION_APPROVAL','CRM_ACCOUNT_NOTES_CUTOVER_READY','CRM_ACCOUNT_NOTES_BACKUP_VERIFIED','CRM_ACCOUNT_NOTES_FRONTEND_VERIFIED']) {
    if (env[key] !== sha) fail('ACCOUNT_NOTES_CUTOVER_APPROVAL_REQUIRED');
  }
  return sha;
}
async function status(db) {
  const rows = await db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name='internalNotes'`);
  const history = await db.$queryRawUnsafe(`SELECT to_regclass('crm_history.account_legacy_notes') IS NOT NULL AS present`);
  return { retiredColumns: rows.map(row=>row.column_name), preservationPresent: history[0].present };
}
async function verifyRelease(env, fetcher = fetch) {
  const sha = env.CRM_ACCOUNT_NOTES_VERIFY_COMMIT;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !env.CRM_ACCOUNT_NOTES_VERIFY_TOKEN) fail('ACCOUNT_NOTES_EXACT_RELEASE_REQUIRED');
  let url; try { url = new URL(env.CRM_ACCOUNT_NOTES_VERIFY_API); } catch { fail('ACCOUNT_NOTES_API_REQUIRED'); }
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.protocol==='http:' && !['127.0.0.1','localhost'].includes(url.hostname)) fail('ACCOUNT_NOTES_API_REQUIRED');
  const base = url.href.replace(/\/$/,'');
  const request = async path => { const response=await fetcher(base+path,{headers:{Authorization:`Bearer ${env.CRM_ACCOUNT_NOTES_VERIFY_TOKEN}`},redirect:'error',signal:AbortSignal.timeout(15000)}); if(!response.ok)fail('ACCOUNT_NOTES_RELEASE_CHECK_FAILED');return response.json(); };
  const health = await request('/health');
  if(health.commit!==sha || !health.capabilities?.includes('accounts-activity-notes-v1'))fail('ACCOUNT_NOTES_RELEASE_NOT_SERVING');
  const me = (await request('/auth/me')).data;
  if (!me?.id || !me.tenantId || me.role !== 'Client Admin') fail('ACCOUNT_NOTES_ADMIN_VERIFICATION_REQUIRED');
  const result=await request('/crm/accounts?limit=1');
  if(!Array.isArray(result.data) || result.data.some(row=>row.tenantId !== me.tenantId || fields.some(key=>key in row)))fail('ACCOUNT_NOTES_API_STILL_EXPOSES_FIELDS');
  let frontend; try { frontend = new URL(env.CRM_ACCOUNT_NOTES_VERIFY_FRONTEND); } catch { fail('ACCOUNT_NOTES_FRONTEND_REQUIRED'); }
  if (frontend.username || frontend.password || frontend.search || frontend.hash || !['https:', 'http:'].includes(frontend.protocol) || frontend.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(frontend.hostname)) fail('ACCOUNT_NOTES_FRONTEND_REQUIRED');
  const response = await fetcher(new URL('/api/release', frontend), { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok || (await response.json()).commit !== sha) fail('ACCOUNT_NOTES_FRONTEND_RELEASE_MISMATCH');
  return sha;
}
async function run(db, mode, env=process.env, dependencies={}) {
  if(!['--status','--verify','--retire'].includes(mode))fail('ACCOUNT_NOTES_INVALID_MODE');
  const expected=env.CRM_ACCOUNT_NOTES_EXPECT_DATABASE;
  for (const connection of [env.DATABASE_URL, env.DIRECT_URL || env.DATABASE_URL]) {
    let database;try{database=decodeURIComponent(new URL(connection).pathname.slice(1));}catch{fail('ACCOUNT_NOTES_DATABASE_REQUIRED');}
    if(!expected || expected!==database)fail('ACCOUNT_NOTES_DATABASE_MISMATCH');
  }
  const primary = new URL(env.DATABASE_URL), direct = new URL(env.DIRECT_URL || env.DATABASE_URL);
  if(primary.hostname !== direct.hostname || primary.username !== direct.username) fail('ACCOUNT_NOTES_DIRECT_DATABASE_MISMATCH');
  if(mode==='--status')return status(db);
  if(mode==='--retire')cutoverApproval(env);
  const sha=await verifyRelease(env,dependencies.fetcher);
  const local=readdirSync(resolve(__dirname,'../prisma/migrations')).filter(name=>/^\d+_/.test(name));
  const records=await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at,checksum FROM "_prisma_migrations"');
  verifyAppliedHistory(records,local);
  if(!records.some(row=>row.migration_name===preservation&&row.finished_at&&!row.rolled_back_at))fail('ACCOUNT_NOTES_PRESERVATION_REQUIRED');
  const current=await status(db);
  if(mode==='--verify'||!current.retiredColumns.length&&current.preservationPresent)return {commit:sha,...current};
  if(current.retiredColumns.length!==fields.length||!current.preservationPresent)fail('ACCOUNT_NOTES_PARTIAL_RETIREMENT');
  // Approval attests that writers are paused and a restore-tested backup exists.
  await db.$executeRawUnsafe('SELECT crm_history.reconcile_account_notes()');
  await db.$executeRawUnsafe(`COMMENT ON TABLE crm_history.account_legacy_notes IS 'leadcrm-account-notes-compatible-v1:${sha}'`);
  try{
    const plan=deploymentPlan(records,local);
    await (dependencies.migrate??migrate)(plan.through,plan.exclude.filter(name=>name!==retirement));
    const after=await status(db);
    if(after.retiredColumns.length||!after.preservationPresent)fail('ACCOUNT_NOTES_RETIREMENT_POSTCHECK_FAILED');
    return {commit:sha,preservationVerified:true,...after};
  }finally{await db.$executeRawUnsafe('COMMENT ON TABLE crm_history.account_legacy_notes IS NULL');}
}
module.exports={run,status,cutoverApproval,verifyRelease,preservation,retirement};
if(require.main===module){
  require('dotenv').config({quiet:true});
  const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({datasources:{db:{url:process.env.DIRECT_URL||process.env.DATABASE_URL}}});
  run(db,process.argv[2]).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error('[account-notes-retirement]',error.code??error.name);process.exitCode=1;}).finally(()=>db.$disconnect());
}

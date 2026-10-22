// Separate operator cutover. Normal db:deploy never removes these columns.
'use strict';
const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawnSync } = require('node:child_process');
const { deploymentPlan, migrate, verifyAppliedHistory } = require('./deploy-crm-imports.cjs');
const preservation = '20261207000000_account_field_preservation';
const retirement = '20261208000000_retire_account_fields';
const fields = ['assignedUserId','productInterests','activeProducts','productInterestOther','productsNormalized'];
const fail = code => { throw Object.assign(new Error(code), { code }); };
function connectionIdentity(env) {
  const expected=env.CRM_ACCOUNT_FIELDS_EXPECT_DATABASE;
  const parse=value=>{
    let url;try{url=new URL(value);}catch{fail('ACCOUNT_FIELDS_DATABASE_REQUIRED');}
    if(!['postgres:','postgresql:'].includes(url.protocol))fail('ACCOUNT_FIELDS_DATABASE_REQUIRED');
    if(!expected||decodeURIComponent(url.pathname.slice(1))!==expected)fail('ACCOUNT_FIELDS_DATABASE_MISMATCH');
    return url;
  };
  const primary=parse(env.DATABASE_URL),direct=parse(env.DIRECT_URL||env.DATABASE_URL);
  if(primary.hostname!==direct.hostname||decodeURIComponent(primary.username)!==decodeURIComponent(direct.username)||(primary.port||'5432')!==(direct.port||'5432'))fail('ACCOUNT_FIELDS_DIRECT_DATABASE_MISMATCH');
  return expected;
}
function cutoverApproval(env) {
  const sha = env.CRM_ACCOUNT_FIELDS_VERIFY_COMMIT;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '')) fail('ACCOUNT_FIELDS_EXACT_RELEASE_REQUIRED');
  for (const key of ['CRM_ACCOUNT_FIELDS_PRODUCTION_APPROVAL','CRM_ACCOUNT_FIELDS_CUTOVER_READY','CRM_ACCOUNT_FIELDS_BACKUP_VERIFIED','CRM_ACCOUNT_FIELDS_FRONTEND_VERIFIED']) {
    if (env[key] !== sha) fail('ACCOUNT_FIELDS_CUTOVER_APPROVAL_REQUIRED');
  }
  return sha;
}
async function status(db) {
  const rows = await db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name IN ('assignedUserId','productInterests','activeProducts','productInterestOther','productsNormalized') ORDER BY column_name`);
  const links = await db.$queryRawUnsafe(`SELECT to_regclass('public."AccountProductInterest"') IS NOT NULL AS present`);
  return { retiredColumns: rows.map(row=>row.column_name), productLinksPresent: links[0].present };
}
async function verifyReleaseDetails(env, fetcher = fetch) {
  const sha = env.CRM_ACCOUNT_FIELDS_VERIFY_COMMIT;
  if (!/^[a-f0-9]{40}$/.test(sha ?? '') || !env.CRM_ACCOUNT_FIELDS_VERIFY_TOKEN) fail('ACCOUNT_FIELDS_EXACT_RELEASE_REQUIRED');
  let url; try { url = new URL(env.CRM_ACCOUNT_FIELDS_VERIFY_API); } catch { fail('ACCOUNT_FIELDS_API_REQUIRED'); }
  if (!['https:','http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.protocol==='http:' && !['127.0.0.1','localhost'].includes(url.hostname)) fail('ACCOUNT_FIELDS_API_REQUIRED');
  const base = url.href.replace(/\/$/,'');
  const request = async path => { const response=await fetcher(base+path,{headers:{Authorization:`Bearer ${env.CRM_ACCOUNT_FIELDS_VERIFY_TOKEN}`,Cookie:`leadcrm_token=${env.CRM_ACCOUNT_FIELDS_VERIFY_TOKEN}`,'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(15000)}); if(!response.ok)fail('ACCOUNT_FIELDS_RELEASE_CHECK_FAILED');return response.json(); };
  const health = await request('/health');
  if(health.commit!==sha || !health.capabilities?.includes('accounts-field-retirement-v1'))fail('ACCOUNT_FIELDS_RELEASE_NOT_SERVING');
  const identity = (await request('/auth/me')).data;
  const me = identity?.user ?? identity;
  if (!me?.id || !me.tenantId || me.role !== 'Client Admin') fail('ACCOUNT_FIELDS_ADMIN_VERIFICATION_REQUIRED');
  const result=await request('/crm/accounts?limit=1');
  if(!Array.isArray(result.data) || result.data.some(row=>row.tenantId !== me.tenantId || [...fields,'assignedUser','productInterest','productInterestId','productInterestIds','activeProductIds','productLinks'].some(key=>key in row)))fail('ACCOUNT_FIELDS_API_STILL_EXPOSES_FIELDS');
  let frontend; try { frontend = new URL(env.CRM_ACCOUNT_FIELDS_VERIFY_FRONTEND); } catch { fail('ACCOUNT_FIELDS_FRONTEND_REQUIRED'); }
  if (frontend.username || frontend.password || frontend.search || frontend.hash || !['https:', 'http:'].includes(frontend.protocol) || frontend.protocol === 'http:' && !['127.0.0.1', 'localhost'].includes(frontend.hostname)) fail('ACCOUNT_FIELDS_FRONTEND_REQUIRED');
  const response = await fetcher(new URL('/api/release', frontend), { redirect: 'error', signal: AbortSignal.timeout(15000) });
  if (!response.ok || (await response.json()).commit !== sha) fail('ACCOUNT_FIELDS_FRONTEND_RELEASE_MISMATCH');
  return {commit:sha,userId:me.id,tenantId:me.tenantId};
}
// Retain the exported verifier's existing string return contract.
async function verifyRelease(env, fetcher = fetch) { return (await verifyReleaseDetails(env,fetcher)).commit; }
function verifyLocalRelease(env,sha) {
  const source=env.SOURCE_COMMIT||spawnSync('git',['rev-parse','HEAD'],{cwd:resolve(__dirname,'../..'),encoding:'utf8',windowsHide:true}).stdout?.trim();
  if(source!==sha)fail('ACCOUNT_FIELDS_LOCAL_RELEASE_MISMATCH');
}
async function readOnly(db,work) {
  return db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '60s'");
    return work(tx);
  },{maxWait:10000,timeout:120000});
}
async function verifyDatabaseIdentity(tx,release,expected) {
  const [identity]=await tx.$queryRawUnsafe('/* account-fields:identity */ SELECT current_database() AS database');
  if(identity?.database!==expected)fail('ACCOUNT_FIELDS_DATABASE_MISMATCH');
  const actors=await tx.$queryRawUnsafe('/* account-fields:actor */ SELECT id FROM public."User" WHERE id=$1 AND "tenantId"=$2 AND status=\'ACTIVE\' AND role=\'Client Admin\'',release.userId,release.tenantId);
  if(actors.length!==1)fail('ACCOUNT_FIELDS_API_DATABASE_MISMATCH');
}
async function verifyPreservation(tx) {
  // Match exact current snapshots while allowing older preserved versions.
  // This SELECT never pauses workflows or rewrites saved layouts.
  const [state]=await tx.$queryRawUnsafe(`/* account-fields:preservation */ WITH source AS (
    SELECT a."tenantId" AS tenant_id,a.id AS account_id,
      jsonb_build_object('assignedUserId',a."assignedUserId",'productInterests',a."productInterests",'activeProducts',a."activeProducts",'productInterestOther',a."productInterestOther",'productsNormalized',a."productsNormalized",'isArchived',a."isArchived",'updatedAt',a."updatedAt") AS retired_values,
      coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l."productInterestId") FROM public."AccountProductInterest" l WHERE l."tenantId"=a."tenantId" AND l."accountId"=a.id),'[]'::jsonb) AS product_links
    FROM public."Account" a
  ), matched AS (
    SELECT s.* FROM source s WHERE EXISTS (SELECT 1 FROM crm_history.account_retired_values h
      WHERE h.tenant_id=s.tenant_id AND h.account_id=s.account_id AND h.retired_values=s.retired_values AND h.product_links=s.product_links)
  ) SELECT (SELECT count(*) FROM source)-(SELECT count(*) FROM matched) AS "missingAccounts",
    (SELECT count(*) FROM public."AccountProductInterest" l LEFT JOIN public."Account" a ON a.id=l."accountId" AND a."tenantId"=l."tenantId" WHERE a.id IS NULL) AS "orphanedLinks",
    (SELECT count(*) FROM public."AccountProductInterest") AS "sourceLinks",
    (SELECT coalesce(sum(jsonb_array_length(product_links)),0) FROM matched) AS "preservedLinks"`);
  if(!state||BigInt(state.missingAccounts)!==0n||BigInt(state.orphanedLinks)!==0n||BigInt(state.sourceLinks)!==BigInt(state.preservedLinks))fail('ACCOUNT_FIELDS_PRESERVATION_MISMATCH');
}
async function run(db, mode, env=process.env, dependencies={}) {
  if(!['--status','--verify','--retire'].includes(mode))fail('ACCOUNT_FIELDS_INVALID_MODE');
  const expected=connectionIdentity(env);
  if(mode==='--status')return status(db);
  if(mode==='--retire')cutoverApproval(env);
  const release=await verifyReleaseDetails(env,dependencies.fetcher);
  const sha=release.commit;
  verifyLocalRelease(env,sha);
  const local=readdirSync(resolve(__dirname,'../prisma/migrations')).filter(name=>/^\d+_/.test(name));
  const records=await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at,checksum FROM "_prisma_migrations"');
  verifyAppliedHistory(records,local);
  if(records.some(row=>!row.finished_at&&!row.rolled_back_at))fail('ACCOUNT_FIELDS_FAILED_MIGRATION_REQUIRES_RECOVERY');
  if(!records.some(row=>row.migration_name===preservation&&row.finished_at&&!row.rolled_back_at))fail('ACCOUNT_FIELDS_PRESERVATION_REQUIRED');
  const current=await status(db);
  const alreadyRetired=!current.retiredColumns.length&&!current.productLinksPresent;
  if(!alreadyRetired&&(current.retiredColumns.length!==fields.length||!current.productLinksPresent))fail('ACCOUNT_FIELDS_PARTIAL_RETIREMENT');
  if(alreadyRetired&&!records.some(row=>row.migration_name===retirement&&row.finished_at&&!row.rolled_back_at))fail('ACCOUNT_FIELDS_RETIREMENT_LEDGER_MISMATCH');
  await readOnly(db,async tx=>{
    await verifyDatabaseIdentity(tx,release,expected);
    if(mode==='--verify'&&!alreadyRetired)await verifyPreservation(tx);
  });
  if(mode==='--verify'||alreadyRetired)return {commit:sha,...current};
  // Valid approvals and matching API/database identity precede reconciliation.
  await db.$executeRawUnsafe('SELECT crm_history.reconcile_account_fields()');
  await readOnly(db,verifyPreservation);
  await db.$executeRawUnsafe(`COMMENT ON TABLE crm_history.account_retired_values IS 'leadcrm-accounts-fields-compatible-v1:${sha}'`);
  try{
    const plan=deploymentPlan(records,local);
    // Approving Account fields must not also apply later expansions or retirements.
    const exclude=[...new Set([...plan.exclude.filter(name=>name!==retirement),...local.filter(name=>name!==retirement&&!records.some(row=>row.migration_name===name&&row.finished_at&&!row.rolled_back_at))])];
    await (dependencies.migrate??migrate)(retirement,exclude);
    const after=await status(db);
    if(after.retiredColumns.length||after.productLinksPresent)fail('ACCOUNT_FIELDS_RETIREMENT_POSTCHECK_FAILED');
    return {commit:sha,preservationVerified:true,...after};
  }finally{await db.$executeRawUnsafe('COMMENT ON TABLE crm_history.account_retired_values IS NULL');}
}
module.exports={run,status,connectionIdentity,cutoverApproval,verifyRelease,verifyLocalRelease,verifyPreservation,preservation,retirement};
if(require.main===module){
  require('dotenv').config({quiet:true});
  const {PrismaClient}=require('@prisma/client');const db=new PrismaClient({datasources:{db:{url:process.env.DIRECT_URL||process.env.DATABASE_URL}}});
  run(db,process.argv[2]).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error('[account-fields-retirement]',error.code??error.name);process.exitCode=1;}).finally(()=>db.$disconnect());
}
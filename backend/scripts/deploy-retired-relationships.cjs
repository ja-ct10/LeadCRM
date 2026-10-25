// Read-only status/verification; destructive retirement is a separate exact-release
// operator action. This tool never sends SMS or changes application records.
'use strict';
const { readdirSync } = require('node:fs');
const { resolve } = require('node:path');
const { deploymentPlan, migrate, verifyAppliedHistory } = require('./deploy-crm-imports.cjs');
const preservation='20261225000000_preserve_retired_relationships';
const retirement='20261226000000_retire_unused_relationship_tables';
const canonical='20261102000000_retire_relationship_compatibility';
const prefix='CRM_RETIRED_RELATIONS_';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const finished=row=>row.finished_at&&!row.rolled_back_at;
function connectionIdentity(env){
  const expected=env[prefix+'EXPECT_DATABASE'];
  const parse=value=>{let url;try{url=new URL(value);}catch{fail('RETIRED_RELATIONS_DATABASE_REQUIRED');}
    if(!['postgres:','postgresql:'].includes(url.protocol))fail('RETIRED_RELATIONS_DATABASE_REQUIRED');
    if(!expected||decodeURIComponent(url.pathname.slice(1))!==expected)fail('RETIRED_RELATIONS_DATABASE_MISMATCH');return url;};
  const primary=parse(env.DATABASE_URL),direct=parse(env.DIRECT_URL||env.DATABASE_URL);
  if(primary.hostname!==direct.hostname||decodeURIComponent(primary.username)!==decodeURIComponent(direct.username))fail('RETIRED_RELATIONS_DIRECT_DATABASE_MISMATCH');
  return expected;
}
function cutoverApproval(env){
  const sha=env[prefix+'VERIFY_COMMIT'];
  if(!/^[a-f0-9]{40}$/.test(sha??''))fail('RETIRED_RELATIONS_EXACT_RELEASE_REQUIRED');
  for(const key of ['PRODUCTION_APPROVAL','WRITERS_STOPPED','BACKUP_VERIFIED','FRONTEND_VERIFIED'])
    if(env[prefix+key]!==sha)fail('RETIRED_RELATIONS_CUTOVER_APPROVAL_REQUIRED');
  return sha;
}
function endpoint(value,code){
  let url;try{url=new URL(value);}catch{fail(code);}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash
    ||url.protocol==='http:'&&!['127.0.0.1','localhost','[::1]'].includes(url.hostname))fail(code);
  return url;
}
async function verifyRelease(env,fetcher=fetch){
  const sha=env[prefix+'VERIFY_COMMIT'],token=env[prefix+'VERIFY_TOKEN'];
  if(!/^[a-f0-9]{40}$/.test(sha??'')||!token)fail('RETIRED_RELATIONS_EXACT_RELEASE_REQUIRED');
  const api=endpoint(env[prefix+'VERIFY_API'],'RETIRED_RELATIONS_API_REQUIRED').href.replace(/\/$/,'');
  const frontend=endpoint(env[prefix+'VERIFY_FRONTEND'],'RETIRED_RELATIONS_FRONTEND_REQUIRED');
  const get=async path=>{
    const response=await fetcher(api+path,{headers:{Authorization:`Bearer ${token}`,Cookie:`leadcrm_token=${token}`,'Cache-Control':'no-cache'},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)fail('RETIRED_RELATIONS_RELEASE_CHECK_FAILED');return response.json();
  };
  const health=await get('/health');
  if(health.commit!==sha||!health.capabilities?.includes('retired-relationships-v1'))fail('RETIRED_RELATIONS_RELEASE_NOT_SERVING');
  const me=(await get('/auth/me')).data,actor=me?.user??me;
  if(!actor?.id||!actor.tenantId||actor.role!=='Client Admin')fail('RETIRED_RELATIONS_ADMIN_VERIFICATION_REQUIRED');
  const tasks=await get('/operations/tasks?limit=1'),campaigns=await get('/marketing/campaigns?limit=1');
  if(!Array.isArray(tasks.data)||!Array.isArray(campaigns.data)
    ||tasks.data.some(row=>row.tenantId!==actor.tenantId||'retiredAccountLinks' in row)
    ||campaigns.data.some(row=>row.tenantId!==actor.tenantId||'smsLinkHistory' in row))fail('RETIRED_RELATIONS_API_SHAPE_MISMATCH');
  if(campaigns.data.length){
    const report=(await get('/marketing/campaigns/'+encodeURIComponent(campaigns.data[0].id)+'/report')).data;
    if(!report||report.tenantId!==actor.tenantId||!Array.isArray(report.recipients)
      ||report.recipients.some(row=>'smsLinkHistory' in row))fail('RETIRED_RELATIONS_REPORT_SHAPE_MISMATCH');
  }
  const response=await fetcher(new URL('/api/release',frontend),{redirect:'error',signal:AbortSignal.timeout(15000)});
  if(!response.ok||(await response.json()).commit!==sha)fail('RETIRED_RELATIONS_FRONTEND_RELEASE_MISMATCH');
  return {commit:sha,userId:actor.id,tenantId:actor.tenantId};
}
async function status(db){
  const [objects]=await db.$queryRawUnsafe(`/* retired-relations:objects */ SELECT current_database() AS database,
    to_regclass('public."TaskAccount"') IS NOT NULL AS "taskAccountPresent",
    to_regclass('public."SmsCampaignLink"') IS NOT NULL AS "smsCampaignLinkPresent",
    to_regprocedure('public.leadcrm_verify_retired_relationships()') IS NOT NULL AS "verifierPresent"`);
  const columns=await db.$queryRawUnsafe(`/* retired-relations:columns */ SELECT table_name,column_name,is_nullable,data_type,column_default
    FROM information_schema.columns WHERE table_schema='public' AND
    ((table_name='Task' AND column_name IN ('accountId','retiredAccountLinks')) OR (table_name='CampaignContact' AND column_name='smsLinkHistory'))`);
  const guards=await db.$queryRawUnsafe(`/* retired-relations:guards */ SELECT c.relname AS "table",t.tgname AS name,t.tgenabled::text AS enabled
    FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal AND
      ((c.relname IN ('TaskAccount','SmsCampaignLink') AND t.tgname IN ('freeze_retired_relationship_rows','freeze_retired_relationship_truncate','crm_relationship_projection'))
      OR (c.relname='Task' AND t.tgname='protect_retired_account_links') OR (c.relname='CampaignContact' AND t.tgname='protect_retired_sms_links'))`);
  const indexes=await db.$queryRawUnsafe(`/* retired-relations:indexes */ SELECT i.indisvalid AS valid,pg_get_indexdef(i.indexrelid) AS definition
    FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relname='CampaignContact_smsLinkHistory_idx'`);
  const preserved=objects.verifierPresent?await db.$queryRawUnsafe('SELECT * FROM public.leadcrm_verify_retired_relationships()'):[];
  return {...objects,columns,guards,indexes,preserved};
}
function verifyStructure(current,expected){
  if(current.database!==expected)fail('RETIRED_RELATIONS_DATABASE_MISMATCH');
  if(current.taskAccountPresent!==current.smsCampaignLinkPresent)fail('RETIRED_RELATIONS_PARTIAL_RETIREMENT');
  if(current.columns.some(row=>row.table_name==='Task'&&row.column_name==='accountId')
    ||current.guards.some(row=>row.name==='crm_relationship_projection'))fail('RETIRED_RELATIONS_CANONICAL_CUTOVER_REQUIRED');
  for(const [table,column] of [['Task','retiredAccountLinks'],['CampaignContact','smsLinkHistory']])
    if(!current.columns.some(row=>row.table_name===table&&row.column_name===column&&row.data_type==='jsonb'&&row.is_nullable==='NO'&&/^'\[\]'::jsonb$/.test(row.column_default??'')))fail('RETIRED_RELATIONS_PRESERVATION_SCHEMA_REQUIRED');
  const active=(table,name)=>current.guards.some(row=>row.table===table&&row.name===name&&['O','A'].includes(row.enabled));
  if(!active('Task','protect_retired_account_links')||!active('CampaignContact','protect_retired_sms_links'))fail('RETIRED_RELATIONS_ARCHIVE_GUARDS_REQUIRED');
  if(current.taskAccountPresent)for(const table of ['TaskAccount','SmsCampaignLink'])for(const trigger of ['freeze_retired_relationship_rows','freeze_retired_relationship_truncate'])
    if(!active(table,trigger))fail('RETIRED_RELATIONS_SOURCE_GUARDS_REQUIRED');
  if(!current.verifierPresent||current.preserved.length!==2)fail('RETIRED_RELATIONS_PRESERVATION_REQUIRED');
  if(!current.indexes.some(row=>row.valid&&/USING gin/i.test(row.definition)&&/smsLinkHistory/.test(row.definition)))fail('RETIRED_RELATIONS_LOOKUP_INDEX_REQUIRED');
}
async function run(db,mode,env=process.env,dependencies={}){
  if(!['--status','--verify','--retire'].includes(mode))fail('RETIRED_RELATIONS_INVALID_MODE');
  const expected=connectionIdentity(env);
  if(mode==='--retire')cutoverApproval(env);
  if(mode==='--status')return status(db);
  const release=await verifyRelease(env,dependencies.fetcher);
  const local=readdirSync(resolve(__dirname,'../prisma/migrations')).filter(name=>/^\d+_/.test(name));
  const records=await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at,checksum FROM "_prisma_migrations"');
  verifyAppliedHistory(records,local);
  if(records.some(row=>!row.finished_at&&!row.rolled_back_at))fail('RETIRED_RELATIONS_FAILED_MIGRATION_REQUIRES_RECOVERY');
  if(!records.some(row=>row.migration_name===preservation&&finished(row)))fail('RETIRED_RELATIONS_PRESERVATION_REQUIRED');
  if(!records.some(row=>row.migration_name===canonical&&finished(row)))fail('RETIRED_RELATIONS_CANONICAL_CUTOVER_REQUIRED');
  const actor=await db.user.findFirst({where:{id:release.userId,tenantId:release.tenantId,status:'ACTIVE'},select:{id:true}});
  if(!actor)fail('RETIRED_RELATIONS_API_DATABASE_MISMATCH');
  const current=await status(db);verifyStructure(current,expected);
  if(mode==='--verify')return {...release,...current};
  if(!current.taskAccountPresent){
    if(!records.some(row=>row.migration_name===retirement&&finished(row)))fail('RETIRED_RELATIONS_RETIREMENT_LEDGER_MISMATCH');
    return {...release,...current,alreadyRetired:true};
  }
  const marker='leadcrm-retired-relationships-v1:'+release.commit;
  await db.$executeRawUnsafe(`COMMENT ON TABLE public."TaskAccount" IS '${marker}'`);
  try{
    await db.$executeRawUnsafe(`COMMENT ON TABLE public."SmsCampaignLink" IS '${marker}'`);
    const plan=deploymentPlan(records,local);
    // Apply only this DROP. Other pending migrations, including independent
    // guarded retirements, are excluded rather than approved by this command.
    const exclude=[...new Set([...plan.exclude.filter(name=>name!==retirement),...local.filter(name=>name!==retirement&&!records.some(row=>row.migration_name===name&&finished(row)))])];
    await (dependencies.migrate??migrate)(retirement,exclude);
    const after=await status(db);verifyStructure(after,expected);
    if(after.taskAccountPresent||after.smsCampaignLinkPresent)fail('RETIRED_RELATIONS_RETIREMENT_POSTCHECK_FAILED');
    return {...release,...after,preservationVerified:true};
  }finally{
    await db.$executeRawUnsafe(`DO $$ BEGIN
      IF to_regclass('public."TaskAccount"') IS NOT NULL THEN EXECUTE 'COMMENT ON TABLE public."TaskAccount" IS NULL'; END IF;
      IF to_regclass('public."SmsCampaignLink"') IS NOT NULL THEN EXECUTE 'COMMENT ON TABLE public."SmsCampaignLink" IS NULL'; END IF;
    END $$;`);
  }
}
module.exports={run,status,verifyStructure,verifyRelease,connectionIdentity,cutoverApproval,preservation,retirement,canonical};
if(require.main===module){
  require('dotenv').config({quiet:true});
  const {PrismaClient}=require('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:process.env.DIRECT_URL||process.env.DATABASE_URL}}});
  run(db,process.argv[2]).then(report=>console.log(JSON.stringify(report,(_,value)=>typeof value==='bigint'?value.toString():value,2)))
    .catch(error=>{console.error('[retired-relations]',error.code??error.name);process.exitCode=1;}).finally(()=>db.$disconnect());
}

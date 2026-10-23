// Explicit operator cutover; normal startup keeps both retirements deferred.
'use strict';
const {readdirSync}=require('node:fs');
const {resolve}=require('node:path');
const {spawnSync}=require('node:child_process');
const notes=require('./deploy-account-notes-retirement.cjs');
const {deploymentPlan,migrate,verifyAppliedHistory}=require('./deploy-crm-imports.cjs');
const {retiredAccountWorkflowReferences}=require('../../shared/src/contracts/account-retirement.js');
const retirement='20261227000000_retire_account_notes_and_tags';
const prefix='CRM_ACCOUNT_COLUMNS_';
const finished=row=>row.finished_at&&!row.rolled_back_at;
const fail=code=>{throw Object.assign(new Error(code),{code});};
function connectionIdentity(env){
  const expected=env[prefix+'EXPECT_DATABASE'];
  const parse=value=>{let url;try{url=new URL(value);}catch{fail('ACCOUNT_COLUMNS_DATABASE_REQUIRED');}
    if(!['postgres:','postgresql:'].includes(url.protocol)||!expected||decodeURIComponent(url.pathname.slice(1))!==expected)fail('ACCOUNT_COLUMNS_DATABASE_MISMATCH');return url;};
  const primary=parse(env.DATABASE_URL),direct=parse(env.DIRECT_URL||env.DATABASE_URL);
  // Runtime and migration roles can differ on the same private database.
  if(primary.hostname!==direct.hostname||(primary.port||'5432')!==(direct.port||'5432'))fail('ACCOUNT_COLUMNS_DIRECT_DATABASE_MISMATCH');
  return expected;
}
function cutoverApproval(env){
  const sha=env[prefix+'VERIFY_COMMIT'];
  if(!/^[a-f0-9]{40}$/.test(sha??''))fail('ACCOUNT_COLUMNS_EXACT_RELEASE_REQUIRED');
  for(const key of ['PRODUCTION_APPROVAL','WRITERS_STOPPED','BACKUP_VERIFIED','FRONTEND_VERIFIED'])
    if(env[prefix+key]!==sha)fail('ACCOUNT_COLUMNS_CUTOVER_APPROVAL_REQUIRED');
  return sha;
}
function notesEnvironment(env){
  const mapped={...env};
  for(const key of ['EXPECT_DATABASE','VERIFY_COMMIT','VERIFY_TOKEN','VERIFY_API','VERIFY_FRONTEND','PRODUCTION_APPROVAL','BACKUP_VERIFIED','FRONTEND_VERIFIED'])mapped['CRM_ACCOUNT_NOTES_'+key]=env[prefix+key];
  mapped.CRM_ACCOUNT_NOTES_CUTOVER_READY=env[prefix+'WRITERS_STOPPED'];
  return mapped;
}
async function verifyRelease(env,fetcher=fetch){
  const sha=await notes.verifyRelease(notesEnvironment(env),fetcher);
  const source=env.SOURCE_COMMIT||spawnSync('git',['rev-parse','HEAD'],{cwd:resolve(__dirname,'../..'),encoding:'utf8',windowsHide:true}).stdout?.trim();
  if(source!==sha)fail('ACCOUNT_COLUMNS_LOCAL_RELEASE_MISMATCH');
  const api=env[prefix+'VERIFY_API'].replace(/\/$/,'');
  const get=async path=>{const token=env[prefix+'VERIFY_TOKEN'];const response=await fetcher(api+path,{headers:{Authorization:`Bearer ${token}`,Cookie:`leadcrm_token=${token}`},redirect:'error',signal:AbortSignal.timeout(15000)});
    if(!response.ok)fail('ACCOUNT_COLUMNS_RELEASE_CHECK_FAILED');return response.json();};
  const health=await get('/health');
  if(health.commit!==sha||!health.capabilities?.includes('accounts-columns-retirement-v1'))fail('ACCOUNT_COLUMNS_RELEASE_NOT_SERVING');
  const identity=(await get('/auth/me')).data,actor=identity?.user??identity;
  if(!actor?.id||!actor.tenantId||actor.role!=='Client Admin')fail('ACCOUNT_COLUMNS_ADMIN_VERIFICATION_REQUIRED');
  const accounts=await get('/crm/accounts?limit=1');
  if(!Array.isArray(accounts.data)||accounts.data.some(row=>row.tenantId!==actor.tenantId||'tags' in row||'internalNotes' in row))fail('ACCOUNT_COLUMNS_API_STILL_EXPOSES_FIELDS');
  return {commit:sha,userId:actor.id,tenantId:actor.tenantId,accounts:accounts.data};
}
async function status(db){
  const columns=await db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name IN ('internalNotes','tags') ORDER BY column_name`);
  const [state]=await db.$queryRawUnsafe(`SELECT current_database() AS database,count(*)::int AS accounts,
    count(*) FILTER (WHERE jsonb_array_length(COALESCE(NULLIF(to_jsonb(a)->'tags','null'::jsonb),'[]'::jsonb))>0)::int AS "nonemptyTags",
    md5(COALESCE(string_agg((to_jsonb(a)-'tags'-'internalNotes')::text,'' ORDER BY a.id),'')) AS fingerprint FROM public."Account" a`);
  return {...state,retiredColumns:columns.map(row=>row.column_name)};
}
function verifyStructure(current,records,expected){
  if(current.database!==expected)fail('ACCOUNT_COLUMNS_DATABASE_MISMATCH');
  for(const [column,name] of [['internalNotes',notes.retirement],['tags',retirement]]){
    if(records.some(row=>row.migration_name===name&&finished(row))===current.retiredColumns.includes(column))fail('ACCOUNT_COLUMNS_RETIREMENT_LEDGER_MISMATCH');
  }
  if(current.nonemptyTags)fail('ACCOUNT_COLUMNS_TAG_VALUES_PRESENT');
}
async function verifyReferences(tx){
  const dependencies=await tx.$queryRawUnsafe(`/* account-columns:dependencies */ SELECT pg_describe_object(d.classid,d.objid,d.objsubid) AS dependency FROM pg_depend d JOIN pg_attribute a ON a.attrelid=d.refobjid AND a.attnum=d.refobjsubid WHERE d.refobjid='public."Account"'::regclass AND a.attname='tags' AND NOT a.attisdropped AND d.classid<>'pg_attrdef'::regclass`);
  if(dependencies.length)fail('ACCOUNT_COLUMNS_DEPENDENCIES_PRESENT');
  const workflows=await tx.$queryRawUnsafe(`/* account-columns:workflows */ SELECT trigger,conditions,actions,"tenantId" FROM public."Workflow" WHERE "isActive" OR status='ACTIVE'`);
  const templates=await tx.$queryRawUnsafe(`/* account-columns:templates */ SELECT id,"tenantId",subject,content FROM public."Template"`);
  for(const workflow of workflows){
    const actions=[...(Array.isArray(workflow.actions)?workflow.actions:[])];
    for(const action of [...actions]){
      const template=templates.find(row=>row.id===action.config?.templateId&&row.tenantId===workflow.tenantId);
      if(template)actions.push({type:'send_email',config:{subject:template.subject,body:template.content}});
    }
    if(retiredAccountWorkflowReferences({...workflow,actions}).some(field=>['tags','record.tags','account.tags','accounts.tags'].includes(field)))fail('ACCOUNT_COLUMNS_EXECUTABLE_REFERENCES_PRESENT');
  }
  const audiences=await tx.$queryRawUnsafe(`/* account-columns:audiences */ SELECT id FROM public."TargetAudienceCondition" WHERE field IN ('account.tags','accounts.tags') LIMIT 1`);
  if(audiences.length)fail('ACCOUNT_COLUMNS_EXECUTABLE_REFERENCES_PRESENT');
}
async function run(db,mode,env=process.env,dependencies={}){
  if(!['--status','--verify','--retire'].includes(mode))fail('ACCOUNT_COLUMNS_INVALID_MODE');
  const expected=connectionIdentity(env);
  if(mode==='--retire')cutoverApproval(env);
  if(mode==='--status')return status(db);
  const release=await verifyRelease(env,dependencies.fetcher);
  const local=readdirSync(resolve(__dirname,'../prisma/migrations')).filter(name=>/^\d+_/.test(name));
  const records=await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at,checksum FROM "_prisma_migrations"');
  verifyAppliedHistory(records,local);
  if(records.some(row=>!row.finished_at&&!row.rolled_back_at))fail('ACCOUNT_COLUMNS_FAILED_MIGRATION_REQUIRES_RECOVERY');
  if(!records.some(row=>row.migration_name===notes.preservation&&finished(row)))fail('ACCOUNT_COLUMNS_NOTES_PRESERVATION_REQUIRED');
  const current=await db.$transaction(async tx=>{
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    const actors=await tx.$queryRawUnsafe(`SELECT id FROM public."User" WHERE id=$1 AND "tenantId"=$2 AND status='ACTIVE' AND role='Client Admin'`,release.userId,release.tenantId);
    if(actors.length!==1)fail('ACCOUNT_COLUMNS_API_DATABASE_MISMATCH');
    for(const account of release.accounts){
      const rows=await tx.$queryRawUnsafe('SELECT id,"tenantId",name FROM public."Account" WHERE id=$1 AND "tenantId"=$2',account.id,release.tenantId);
      if(rows.length!==1||rows[0].name!==account.name)fail('ACCOUNT_COLUMNS_API_DATABASE_MISMATCH');
    }
    await verifyReferences(tx);
    return status(tx);
  });
  verifyStructure(current,records,expected);
  if(mode==='--verify'||!current.retiredColumns.length)return {commit:release.commit,...current};
  if(current.retiredColumns.includes('internalNotes'))await (dependencies.notesRun??notes.run)(db,'--retire',notesEnvironment(env),dependencies);
  const updatedRecords=await db.$queryRawUnsafe('SELECT migration_name,finished_at,rolled_back_at,checksum FROM "_prisma_migrations"');
  verifyAppliedHistory(updatedRecords,local);
  const before=await status(db);
  if(before.retiredColumns.includes('internalNotes'))fail('ACCOUNT_COLUMNS_NOTES_RETIREMENT_REQUIRED');
  const [column]=await db.$queryRawUnsafe(`SELECT col_description(attrelid,attnum) AS comment FROM pg_attribute WHERE attrelid='public."Account"'::regclass AND attname='tags' AND NOT attisdropped`);
  if(!column)fail('ACCOUNT_COLUMNS_RETIREMENT_LEDGER_MISMATCH');
  await db.$executeRawUnsafe(`COMMENT ON COLUMN public."Account".tags IS 'leadcrm-account-columns-v1:${release.commit}'`);
  try{
    const plan=deploymentPlan(updatedRecords,local);
    const exclude=[...new Set([...plan.exclude.filter(name=>name!==retirement),...local.filter(name=>name!==retirement&&!updatedRecords.some(row=>row.migration_name===name&&finished(row)))])];
    await (dependencies.migrate??migrate)(retirement,exclude);
    const after=await status(db);
    if(after.retiredColumns.length||after.accounts!==before.accounts||after.fingerprint!==before.fingerprint)fail('ACCOUNT_COLUMNS_RETIREMENT_POSTCHECK_FAILED');
    return {commit:release.commit,...after,preservationVerified:true};
  }finally{
    const previous=column.comment==null?'NULL':"'"+column.comment.replaceAll("'","''")+"'";
    await db.$executeRawUnsafe(`DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name='tags') THEN EXECUTE 'COMMENT ON COLUMN public."Account".tags IS ${previous.replaceAll("'","''")}'; END IF; END $$;`);
  }
}
module.exports={run,status,verifyRelease,verifyReferences,verifyStructure,connectionIdentity,cutoverApproval,notesEnvironment,retirement};
if(require.main===module){
  require('dotenv').config({quiet:true});const {PrismaClient}=require('@prisma/client');
  const db=new PrismaClient({datasources:{db:{url:process.env.DIRECT_URL||process.env.DATABASE_URL}}});
  run(db,process.argv[2]).then(report=>console.log(JSON.stringify(report,null,2))).catch(error=>{console.error('[account-columns-retirement]',error.code??error.name);process.exitCode=1;}).finally(()=>db.$disconnect());
}

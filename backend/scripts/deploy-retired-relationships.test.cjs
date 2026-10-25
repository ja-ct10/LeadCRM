'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const {run,cutoverApproval,connectionIdentity,verifyRelease,verifyStructure,preservation,retirement,canonical}=require('./deploy-retired-relationships.cjs');
const sha='a'.repeat(40);
const env={SOURCE_COMMIT:sha,DATABASE_URL:'postgresql://operator@127.0.0.1/fixture',CRM_RETIRED_RELATIONS_EXPECT_DATABASE:'fixture',
  CRM_RETIRED_RELATIONS_VERIFY_COMMIT:sha,CRM_RETIRED_RELATIONS_VERIFY_TOKEN:'fixture-token',
  CRM_RETIRED_RELATIONS_VERIFY_API:'http://127.0.0.1:4000/api/v1',CRM_RETIRED_RELATIONS_VERIFY_FRONTEND:'http://127.0.0.1:3000',
  CRM_RETIRED_RELATIONS_PRODUCTION_APPROVAL:sha,CRM_RETIRED_RELATIONS_WRITERS_STOPPED:sha,
  CRM_RETIRED_RELATIONS_BACKUP_VERIFIED:sha,CRM_RETIRED_RELATIONS_FRONTEND_VERIFIED:sha};
const response=data=>({ok:true,json:async()=>data});
async function healthy(url){
  const path=String(url);
  if(path.includes('/health'))return response({commit:sha,capabilities:['retired-relationships-v1']});
  if(path.includes('/api/release'))return response({commit:sha});
  if(path.includes('/auth/me'))return response({data:{id:'admin',tenantId:'tenant',role:'Client Admin'}});
  if(path.endsWith('/campaigns/campaign/report'))return response({data:{id:'campaign',tenantId:'tenant',recipients:[{id:'recipient'}]}});
  return response({data:[{id:path.includes('/operations/tasks')?'task':'campaign',tenantId:'tenant'}]});
}
function fixture(){
  let present=true;
  const writes=[];
  const records=['20261028000000_retire_legacy_crm_imports','20261101000000_expand_canonical_relationships',canonical,preservation].map(name=>({
    migration_name:name,finished_at:new Date(),rolled_back_at:null,
    checksum:createHash('sha256').update(readFileSync(resolve(__dirname,'../prisma/migrations',name,'migration.sql'))).digest('hex'),
  }));
  const columns=[{table_name:'Task',column_name:'retiredAccountLinks',data_type:'jsonb',is_nullable:'NO',column_default:"'[]'::jsonb"},
    {table_name:'CampaignContact',column_name:'smsLinkHistory',data_type:'jsonb',is_nullable:'NO',column_default:"'[]'::jsonb"}];
  const guard=(table,name)=>({table,name,enabled:'O'});
  const archiveGuards=[guard('Task','protect_retired_account_links'),guard('CampaignContact','protect_retired_sms_links')];
  const sourceGuards=['TaskAccount','SmsCampaignLink'].flatMap(table=>[guard(table,'freeze_retired_relationship_rows'),guard(table,'freeze_retired_relationship_truncate')]);
  const db={user:{findFirst:async()=>({id:'admin'})},$executeRawUnsafe:async sql=>{writes.push(sql);return 0;},$queryRawUnsafe:async sql=>{
    if(sql.includes('FROM "_prisma_migrations"'))return records;
    if(sql.includes('retired-relations:objects'))return [{database:'fixture',taskAccountPresent:present,smsCampaignLinkPresent:present,verifierPresent:true}];
    if(sql.includes('retired-relations:columns'))return columns;
    if(sql.includes('retired-relations:guards'))return [...archiveGuards,...(present?sourceGuards:[])];
    if(sql.includes('retired-relations:indexes'))return [{valid:true,definition:'CREATE INDEX "CampaignContact_smsLinkHistory_idx" ON public."CampaignContact" USING gin ("smsLinkHistory" jsonb_path_ops)'}];
    if(sql.includes('leadcrm_verify_retired_relationships'))return ['TaskAccount','SmsCampaignLink'].map(source_table=>({source_table,source_rows:present?1:null,preserved_rows:1}));
    throw Error('Unexpected query: '+sql);
  }};
  return {db,writes,records,columns,archiveGuards,sourceGuards,setRetired:()=>{present=false;}};
}
test('retirement requires all exact-release attestations before database access',async()=>{
  assert.equal(cutoverApproval(env),sha);
  for(const key of ['PRODUCTION_APPROVAL','WRITERS_STOPPED','BACKUP_VERIFIED','FRONTEND_VERIFIED']){
    const invalid={...env,['CRM_RETIRED_RELATIONS_'+key]:'b'.repeat(40)};
    await assert.rejects(run(new Proxy({},{get(){throw Error('Database access forbidden');}}),'--retire',invalid),/CUTOVER_APPROVAL_REQUIRED/);
  }
  assert.throws(()=>connectionIdentity({...env,DIRECT_URL:'postgresql://other@127.0.0.1/fixture'}),/DIRECT_DATABASE_MISMATCH/);
  assert.throws(()=>connectionIdentity({...env,DIRECT_URL:'postgresql://operator@elsewhere/fixture'}),/DIRECT_DATABASE_MISMATCH/);
  assert.throws(()=>connectionIdentity({...env,DIRECT_URL:'postgresql://operator@127.0.0.1:6432/fixture'}),/DIRECT_DATABASE_MISMATCH/);
  assert.throws(()=>connectionIdentity({...env,CRM_RETIRED_RELATIONS_EXPECT_DATABASE:'production'}),/DATABASE_MISMATCH/);
});
test('verification checks serving builds, privileged actor and hidden snapshot payloads',async()=>{
  assert.deepEqual(await verifyRelease(env,healthy),{commit:sha,userId:'admin',tenantId:'tenant'});
  const cases=[
    ['/health',{commit:sha,capabilities:[]},/RELEASE_NOT_SERVING/],
    ['/api/release',{commit:'b'.repeat(40)},/FRONTEND_RELEASE_MISMATCH/],
    ['/auth/me',{data:{id:'staff',tenantId:'tenant',role:'Sales'}},/ADMIN_VERIFICATION_REQUIRED/],
    ['/operations/tasks',{data:[{id:'task',tenantId:'other'}]},/API_SHAPE_MISMATCH/],
    ['/operations/tasks',{data:[{id:'task',tenantId:'tenant',retiredAccountLinks:[]}]},/API_SHAPE_MISMATCH/],
    ['/campaigns/campaign/report',{data:{tenantId:'tenant',recipients:[{smsLinkHistory:[]}]}},/REPORT_SHAPE_MISMATCH/],
  ];
  for(const [match,data,error] of cases)await assert.rejects(verifyRelease(env,url=>String(url).includes(match)?response(data):healthy(url)),error);
  await assert.rejects(verifyRelease({...env,CRM_RETIRED_RELATIONS_VERIFY_API:'http://production.example/api/v1'},healthy),/API_REQUIRED/);
});
test('status and verify are read-only and reject missing prerequisite migration or archive guard',async()=>{
  const f=fixture();
  assert.equal((await run(f.db,'--status',env)).taskAccountPresent,true);
  await run(f.db,'--verify',env,{fetcher:healthy});
  assert.deepEqual(f.writes,[]);
  f.records.splice(f.records.findIndex(row=>row.migration_name===canonical),1);
  await assert.rejects(run(f.db,'--retire',env,{fetcher:healthy}),/CANONICAL_CUTOVER_REQUIRED/);
  assert.deepEqual(f.writes,[]);
  const g=fixture();g.archiveGuards.pop();
  await assert.rejects(run(g.db,'--verify',env,{fetcher:healthy}),/ARCHIVE_GUARDS_REQUIRED/);
  assert.deepEqual(g.writes,[]);
});
test('retire applies only the requested DROP and clears markers after success or failure',async()=>{
  const f=fixture();let plan;
  const result=await run(f.db,'--retire',env,{fetcher:healthy,migrate:async(through,exclude)=>{plan={through,exclude};f.setRetired();}});
  assert.equal(result.preservationVerified,true);
  assert.equal(plan.through,retirement);
  assert.ok(!plan.exclude.includes(retirement));
  assert.ok(plan.exclude.includes('20261208000000_retire_account_fields'));
  assert.ok(plan.exclude.includes('20261112000000_retire_lead_nonform_columns'));
  assert.equal(f.writes.filter(sql=>sql.includes(`IS 'leadcrm-retired-relationships-v1:${sha}'`)).length,2);
  assert.match(f.writes.at(-1),/COMMENT ON TABLE public\."SmsCampaignLink" IS NULL/);
  const g=fixture();await assert.rejects(run(g.db,'--retire',env,{fetcher:healthy,migrate:async()=>{throw Error('blocked');}}),/blocked/);
  assert.match(g.writes.at(-1),/COMMENT ON TABLE public\."TaskAccount" IS NULL/);
});
test('structure rejects nullable archives, old scalar projections and partial source removal',()=>{
  const base={database:'fixture',taskAccountPresent:true,smsCampaignLinkPresent:false,columns:[],guards:[],indexes:[],preserved:[]};
  assert.throws(()=>verifyStructure(base,'fixture'),/PARTIAL_RETIREMENT/);
  assert.throws(()=>verifyStructure({...base,smsCampaignLinkPresent:true,columns:[{table_name:'Task',column_name:'accountId'}]},'fixture'),/CANONICAL_CUTOVER_REQUIRED/);
});

test('local retirement source must match the serving release before database access',async()=>{
  await assert.rejects(run(new Proxy({},{get(){throw Error('Database access forbidden');}}),'--retire',{...env,SOURCE_COMMIT:'b'.repeat(40)},{fetcher:healthy}),/RETIRED_RELATIONS_LOCAL_RELEASE_MISMATCH/);
});
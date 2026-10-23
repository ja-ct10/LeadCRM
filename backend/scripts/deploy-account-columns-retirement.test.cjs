const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readdirSync}=require('node:fs');
const {resolve}=require('node:path');
const {deploymentPlan}=require('./deploy-crm-imports.cjs');
const {connectionIdentity,cutoverApproval,verifyRelease,verifyStructure,verifyReferences,run,retirement}=require('./deploy-account-columns-retirement.cjs');
const notes='20261210000000_retire_account_internal_notes';
const sha='a'.repeat(40),prefix='CRM_ACCOUNT_COLUMNS_';
const env={DATABASE_URL:'postgresql://app@127.0.0.1/fixture',DIRECT_URL:'postgresql://migrator@127.0.0.1/fixture',SOURCE_COMMIT:sha};
for(const key of ['VERIFY_COMMIT','PRODUCTION_APPROVAL','WRITERS_STOPPED','BACKUP_VERIFIED','FRONTEND_VERIFIED'])env[prefix+key]=sha;
Object.assign(env,{CRM_ACCOUNT_COLUMNS_EXPECT_DATABASE:'fixture',CRM_ACCOUNT_COLUMNS_VERIFY_API:'http://127.0.0.1:4000/api/v1',CRM_ACCOUNT_COLUMNS_VERIFY_TOKEN:'synthetic-token',CRM_ACCOUNT_COLUMNS_VERIFY_FRONTEND:'http://127.0.0.1:3000'});
const healthy=async url=>({ok:true,json:async()=>String(url).includes('/health')?{commit:sha,capabilities:['accounts-activity-notes-v1','accounts-columns-retirement-v1']}:String(url).includes('/api/release')?{commit:sha}:String(url).includes('/auth/me')?{data:{user:{id:'admin',tenantId:'tenant',role:'Client Admin'}}}:{data:[{id:'account',tenantId:'tenant',name:'Company'}]}});
test('every exact-release attestation precedes any database operation',async()=>{
  assert.equal(cutoverApproval(env),sha);
  assert.equal(connectionIdentity(env),'fixture');
  for(const key of ['PRODUCTION_APPROVAL','WRITERS_STOPPED','BACKUP_VERIFIED','FRONTEND_VERIFIED'])
    await assert.rejects(run(new Proxy({},{get(){throw Error('Database accessed');}}),'--retire',{...env,[prefix+key]:'b'.repeat(40)}),/CUTOVER_APPROVAL_REQUIRED/);
  assert.throws(()=>connectionIdentity({...env,DIRECT_URL:'postgresql://migrator@127.0.0.1/other'}),/DATABASE_MISMATCH/);
  assert.throws(()=>connectionIdentity({...env,DIRECT_URL:'postgresql://migrator@127.0.0.1:5433/fixture'}),/DIRECT_DATABASE_MISMATCH/);
});
test('verifies current nested auth response, both serving releases and omitted columns',async()=>{
  assert.equal((await verifyRelease(env,healthy)).userId,'admin');
  await assert.rejects(verifyRelease({...env,SOURCE_COMMIT:'b'.repeat(40)},healthy),/LOCAL_RELEASE_MISMATCH/);
  for(const field of ['tags','internalNotes'])await assert.rejects(verifyRelease(env,async url=>String(url).includes('/crm/accounts')?{ok:true,json:async()=>({data:[{tenantId:'tenant',[field]:[]}]})}:healthy(url)),/API_STILL_EXPOSES_FIELDS/);
  await assert.rejects(verifyRelease(env,async url=>String(url).includes('/api/release')?{ok:true,json:async()=>({commit:'b'.repeat(40)})}:healthy(url)),/FRONTEND_RELEASE_MISMATCH/);
});
test('schema state must agree with both migration receipts and contain no tag values',()=>{
  const current={database:'fixture',retiredColumns:['internalNotes','tags'],nonemptyTags:0};
  verifyStructure(current,[],'fixture');
  assert.throws(()=>verifyStructure({...current,nonemptyTags:1},[],'fixture'),/TAG_VALUES_PRESENT/);
  assert.throws(()=>verifyStructure({...current,retiredColumns:['tags']},[],'fixture'),/LEDGER_MISMATCH/);
  verifyStructure({...current,retiredColumns:['tags']},[{migration_name:notes,finished_at:new Date()}],'fixture');
  assert.throws(()=>verifyStructure(current,[{migration_name:retirement,finished_at:new Date()}],'fixture'),/LEDGER_MISMATCH/);
});
test('preflight rejects executable references before either column drop and preserves ordinary text',async()=>{
  const state={workflows:[],templates:[],dependencies:[],audiences:[]};
  const db={$queryRawUnsafe:async sql=>state[Object.keys(state).find(key=>sql.includes('account-columns:'+key))]};
  await verifyReferences(db);
  state.workflows=[{trigger:'account.updated',actions:[{type:'update_field',config:{field:'tags',value:[]}}]}];
  await assert.rejects(verifyReferences(db),/EXECUTABLE_REFERENCES_PRESENT/);
  state.workflows=[{trigger:'account.updated',actions:[{type:'update_field',config:{field:'name',value:'Ordinary tags'}}]}];
  await verifyReferences(db);
  state.dependencies=[{dependency:'unexpected index'}];
  await assert.rejects(verifyReferences(db),/DEPENDENCIES_PRESENT/);
});
test('normal deployment always defers both column drops',()=>{
  const local=readdirSync(resolve(__dirname,'../prisma/migrations')).filter(name=>/^\d+_/.test(name));
  const plan=deploymentPlan([{migration_name:'20261028000000_retire_legacy_crm_imports',finished_at:new Date()},{migration_name:'20261101000000_expand_canonical_relationships',finished_at:new Date()}],local);
  assert.ok(plan.exclude.includes(retirement));assert.ok(plan.exclude.includes(notes));
});

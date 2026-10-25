const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const {cutoverApproval,verifyRelease,run,retirement,preservation}=require('./deploy-account-fields-retirement.cjs');
const {deploymentPlan}=require('./deploy-crm-imports.cjs');
const sha='a'.repeat(40);
const env={DATABASE_URL:'postgresql://fixture@127.0.0.1/fixture',CRM_ACCOUNT_FIELDS_EXPECT_DATABASE:'fixture',CRM_ACCOUNT_FIELDS_VERIFY_COMMIT:sha,CRM_ACCOUNT_FIELDS_VERIFY_TOKEN:'synthetic-token',CRM_ACCOUNT_FIELDS_VERIFY_API:'http://127.0.0.1:4000/api/v1',CRM_ACCOUNT_FIELDS_VERIFY_FRONTEND:'http://127.0.0.1:3000',CRM_ACCOUNT_FIELDS_PRODUCTION_APPROVAL:sha,CRM_ACCOUNT_FIELDS_CUTOVER_READY:sha,CRM_ACCOUNT_FIELDS_BACKUP_VERIFIED:sha,CRM_ACCOUNT_FIELDS_FRONTEND_VERIFIED:sha};
const healthy=async url=>({ok:true,json:async()=>String(url).includes('/health')?{commit:sha,capabilities:['accounts-field-retirement-v1']}:String(url).includes('/api/release')?{commit:sha}:String(url).includes('/auth/me')?{data:{id:'admin',tenantId:'tenant',role:'Client Admin'}}:{data:[{id:'account',tenantId:'tenant',name:'Company'}]}});
test('Account field cutover requires every exact-release attestation before any database operation',async()=>{
  assert.equal(cutoverApproval(env),sha);
  for(const key of ['CRM_ACCOUNT_FIELDS_PRODUCTION_APPROVAL','CRM_ACCOUNT_FIELDS_CUTOVER_READY','CRM_ACCOUNT_FIELDS_BACKUP_VERIFIED','CRM_ACCOUNT_FIELDS_FRONTEND_VERIFIED']){
    const missing={...env,[key]:'b'.repeat(40)};
    await assert.rejects(run(new Proxy({},{get(){throw Error('Database must not be accessed');}}),'--retire',missing),/ACCOUNT_FIELDS_CUTOVER_APPROVAL_REQUIRED/);
  }
  await assert.rejects(run({},'--status',{...env,CRM_ACCOUNT_FIELDS_EXPECT_DATABASE:'other'}),/DATABASE_MISMATCH/);
  await assert.rejects(run({},'--status',{...env,DIRECT_URL:'postgresql://fixture@127.0.0.1/other'}),/DATABASE_MISMATCH/);
});
test('release verification checks both serving revisions and rejects exposed retired fields',async()=>{
  assert.equal(await verifyRelease(env,healthy),sha);
  await assert.rejects(verifyRelease(env,async url=>String(url).includes('/api/release')?{ok:true,json:async()=>({commit:'b'.repeat(40)})}:healthy(url)),/FRONTEND_RELEASE_MISMATCH/);
  await assert.rejects(verifyRelease(env,async url=>String(url).includes('/crm/accounts')?{ok:true,json:async()=>({data:[{assignedUserId:'old'}]})}:healthy(url)),/API_STILL_EXPOSES_FIELDS/);
  await assert.rejects(verifyRelease(env,async url=>String(url).includes('/auth/me')?{ok:true,json:async()=>({data:{id:'staff',tenantId:'tenant',role:'Sales'}})}:healthy(url)),/ADMIN_VERIFICATION_REQUIRED/);
});
test('normal migration deployment defers physical Account field retirement',()=>{
  const names=['20261028000000_retire_legacy_crm_imports','20261101000000_expand_canonical_relationships',preservation,retirement];
  const plan=deploymentPlan([{migration_name:'20261028000000_retire_legacy_crm_imports',finished_at:new Date()},{migration_name:'20261101000000_expand_canonical_relationships',finished_at:new Date()}],names);
  assert.ok(plan.exclude.includes(retirement));
  assert.ok(!plan.exclude.includes(preservation));
});

test('AccountProductInterest retirement never applies the new Task/SMS expansion or other pending transitions',async()=>{
  const records=['20261028000000_retire_legacy_crm_imports','20261101000000_expand_canonical_relationships',preservation].map(migration_name=>({
    migration_name,finished_at:new Date(),rolled_back_at:null,
    checksum:createHash('sha256').update(readFileSync(resolve(__dirname,'../prisma/migrations',migration_name,'migration.sql'))).digest('hex'),
  }));
  let retired=false,applied;
  const writes=[];
  const db={
    $queryRawUnsafe:async sql=>sql.includes('"_prisma_migrations"')?records:sql.includes('information_schema.columns')
      ?retired?[]:['assignedUserId','productInterests','activeProducts','productInterestOther','productsNormalized'].map(column_name=>({column_name}))
      :[{present:!retired}],
    $executeRawUnsafe:async sql=>{writes.push(sql);return 0;},
  };
  const report=await run(db,'--retire',env,{fetcher:healthy,migrate:async(through,exclude)=>{applied={through,exclude};retired=true;}});
  assert.equal(report.preservationVerified,true);
  assert.equal(applied.through,retirement);
  assert.ok(!applied.exclude.includes(retirement));
  assert.ok(applied.exclude.includes('20261225000000_preserve_retired_relationships'));
  assert.ok(applied.exclude.includes('20261226000000_retire_unused_relationship_tables'));
  assert.match(writes.at(-1),/COMMENT ON TABLE crm_history.account_retired_values IS NULL/);
});

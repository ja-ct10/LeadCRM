const {test}=require('node:test');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const {createHash}=require('node:crypto');
const {cutoverApproval,verifyRelease,run,retirement,preservation}=require('./deploy-account-fields-retirement.cjs');
const {deploymentPlan}=require('./deploy-crm-imports.cjs');
const sha='a'.repeat(40);
const env={SOURCE_COMMIT:sha,DATABASE_URL:'postgresql://fixture@127.0.0.1/fixture',CRM_ACCOUNT_FIELDS_EXPECT_DATABASE:'fixture',CRM_ACCOUNT_FIELDS_VERIFY_COMMIT:sha,CRM_ACCOUNT_FIELDS_VERIFY_TOKEN:'synthetic-token',CRM_ACCOUNT_FIELDS_VERIFY_API:'http://127.0.0.1:4000/api/v1',CRM_ACCOUNT_FIELDS_VERIFY_FRONTEND:'http://127.0.0.1:3000',CRM_ACCOUNT_FIELDS_PRODUCTION_APPROVAL:sha,CRM_ACCOUNT_FIELDS_CUTOVER_READY:sha,CRM_ACCOUNT_FIELDS_BACKUP_VERIFIED:sha,CRM_ACCOUNT_FIELDS_FRONTEND_VERIFIED:sha};
const healthy=async url=>({ok:true,json:async()=>String(url).includes('/health')?{commit:sha,capabilities:['accounts-field-retirement-v1']}:String(url).includes('/api/release')?{commit:sha}:String(url).includes('/auth/me')?{data:{id:'admin',tenantId:'tenant',role:'Client Admin'}}:{data:[{id:'account',tenantId:'tenant',name:'Company'}]}});
function fixture(){
  const records=['20261028000000_retire_legacy_crm_imports','20261101000000_expand_canonical_relationships',preservation].map(migration_name=>({
    migration_name,finished_at:new Date(),rolled_back_at:null,
    checksum:createHash('sha256').update(readFileSync(resolve(__dirname,'../prisma/migrations',migration_name,'migration.sql'))).digest('hex'),
  }));
  const state={retired:false,database:'fixture',actors:[{id:'admin'}],preservation:{missingAccounts:0n,orphanedLinks:0n,sourceLinks:3n,preservedLinks:3n}};
  const commands=[];
  let readOnly=false;
  const db={
    $transaction:async work=>{readOnly=true;try{return await work(db);}finally{readOnly=false;}},
    $queryRawUnsafe:async(sql,...args)=>{
      commands.push({sql,args,readOnly});
      if(sql.includes('"_prisma_migrations"'))return records;
      if(sql.includes('information_schema.columns'))return state.retired?[]:['assignedUserId','productInterests','activeProducts','productInterestOther','productsNormalized'].map(column_name=>({column_name}));
      if(sql.includes('to_regclass'))return [{present:!state.retired}];
      if(sql.includes('account-fields:identity'))return [{database:state.database}];
      if(sql.includes('account-fields:actor'))return state.actors;
      if(sql.includes('account-fields:preservation'))return [state.preservation];
      throw Error('Unexpected query: '+sql);
    },
    $executeRawUnsafe:async sql=>{
      commands.push({sql,readOnly});
      if(readOnly&&!/^SET\b/.test(sql))throw Error('Read-only transaction rejected mutation');
      return 0;
    },
  };
  return {db,state,commands,records,mutations:()=>commands.filter(command=>!command.readOnly&&/^(SELECT crm_history\.reconcile|COMMENT)/.test(command.sql))};
}

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

test('frontend proxy verification supplies the session cookie and accepts wrapped identity',async()=>{
  const requests=[];
  assert.equal(await verifyRelease(env,async(url,options)=>{
    requests.push({url:String(url),options});
    return String(url).includes('/auth/me')?{ok:true,json:async()=>({data:{user:{id:'admin',tenantId:'tenant',role:'Client Admin'}}})}:healthy(url);
  }),sha);
  const authenticated=requests.filter(request=>!request.url.includes('/api/release'));
  assert.equal(authenticated.length,3);
  for(const {options} of authenticated){
    assert.equal(options.headers.Cookie,'leadcrm_token=synthetic-token');
    assert.equal(options.headers.Authorization,'Bearer synthetic-token');
    assert.equal(options.redirect,'error');
  }
});

test('normal migration deployment defers physical Account field retirement',()=>{
  const names=['20261028000000_retire_legacy_crm_imports','20261101000000_expand_canonical_relationships',preservation,retirement];
  const plan=deploymentPlan([{migration_name:'20261028000000_retire_legacy_crm_imports',finished_at:new Date()},{migration_name:'20261101000000_expand_canonical_relationships',finished_at:new Date()}],names);
  assert.ok(plan.exclude.includes(retirement));
  assert.ok(!plan.exclude.includes(preservation));
});

test('mismatched local release is rejected before database access or mutation',async()=>{
  await assert.rejects(run(new Proxy({},{get(){throw Error('Database must not be accessed');}}),'--retire',{...env,SOURCE_COMMIT:'b'.repeat(40)},{fetcher:healthy}),/ACCOUNT_FIELDS_LOCAL_RELEASE_MISMATCH/);
});

test('verify checks actual database, same-tenant admin and preservation without reconciliation',async()=>{
  const f=fixture();
  assert.deepEqual(await run(f.db,'--verify',env,{fetcher:healthy}),{commit:sha,retiredColumns:['assignedUserId','productInterests','activeProducts','productInterestOther','productsNormalized'],productLinksPresent:true});
  assert.deepEqual(f.mutations(),[]);
  const actor=f.commands.find(command=>command.sql.includes('account-fields:actor'));
  assert.deepEqual(actor.args,['admin','tenant']);
  assert.match(actor.sql,/status='ACTIVE' AND role='Client Admin'/);
  assert.equal(actor.readOnly,true);
  assert.equal(f.commands.find(command=>command.sql.includes('account-fields:preservation')).readOnly,true);
  for(const [field,value,error] of [['database','different',/ACCOUNT_FIELDS_DATABASE_MISMATCH/],['actors',[],/ACCOUNT_FIELDS_API_DATABASE_MISMATCH/]]){
    const g=fixture();g.state[field]=value;
    await assert.rejects(run(g.db,'--retire',env,{fetcher:healthy}),error);
    assert.deepEqual(g.mutations(),[]);
  }
});

test('verify fails closed for stale snapshots, lost links and orphaned tenant relationships',async()=>{
  for(const change of [{missingAccounts:1n},{preservedLinks:2n},{orphanedLinks:1n}]){
    const f=fixture();Object.assign(f.state.preservation,change);
    await assert.rejects(run(f.db,'--verify',env,{fetcher:healthy}),/ACCOUNT_FIELDS_PRESERVATION_MISMATCH/);
    assert.deepEqual(f.mutations(),[]);
  }
});

test('retire reconciles only after identity checks and verifies equality before marking DROP',async()=>{
  const f=fixture();f.state.preservation.preservedLinks=2n;
  await assert.rejects(run(f.db,'--retire',env,{fetcher:healthy,migrate:async()=>{throw Error('Must not migrate');}}),/ACCOUNT_FIELDS_PRESERVATION_MISMATCH/);
  assert.deepEqual(f.mutations().map(command=>command.sql),['SELECT crm_history.reconcile_account_fields()']);
});

test('AccountProductInterest retirement never applies new Task/SMS expansion or other pending transitions',async()=>{
  const f=fixture();let applied;
  const report=await run(f.db,'--retire',env,{fetcher:healthy,migrate:async(through,exclude)=>{applied={through,exclude};f.state.retired=true;}});
  assert.equal(report.preservationVerified,true);
  assert.equal(applied.through,retirement);
  assert.ok(!applied.exclude.includes(retirement));
  assert.ok(applied.exclude.includes('20261225000000_preserve_retired_relationships'));
  assert.ok(applied.exclude.includes('20261226000000_retire_unused_relationship_tables'));
  assert.match(f.commands.at(-1).sql,/COMMENT ON TABLE crm_history.account_retired_values IS NULL/);
});

test('already absent sources require a successful retirement ledger entry',async()=>{
  const f=fixture();f.state.retired=true;
  await assert.rejects(run(f.db,'--verify',env,{fetcher:healthy}),/ACCOUNT_FIELDS_RETIREMENT_LEDGER_MISMATCH/);
  assert.deepEqual(f.mutations(),[]);
});
test('Account operator rejects mismatched direct hosts, roles, ports and non-PostgreSQL URLs',async()=>{
  for(const direct of ['postgresql://fixture@elsewhere/fixture','postgresql://other@127.0.0.1/fixture','postgresql://fixture@127.0.0.1:6432/fixture'])
    await assert.rejects(run({},'--status',{...env,DIRECT_URL:direct}),/ACCOUNT_FIELDS_DIRECT_DATABASE_MISMATCH/);
  await assert.rejects(run({},'--status',{...env,DATABASE_URL:'https://fixture@127.0.0.1/fixture'}),/ACCOUNT_FIELDS_DATABASE_REQUIRED/);
});
test('real PostgreSQL engine validates current snapshots, stale versions, tenant links and retirement ledger',async()=>{
  const {PGlite}=require('@electric-sql/pglite');
  const pg=await PGlite.create();
  const sqlDb={
    $queryRawUnsafe:async(sql,...args)=>(await pg.query(sql,args)).rows,
    $executeRawUnsafe:async sql=>pg.exec(sql),
    $transaction:async work=>{
      await pg.exec('BEGIN');
      try{const result=await work(sqlDb);await pg.exec('COMMIT');return result;}
      catch(error){await pg.exec('ROLLBACK');throw error;}
    },
  };
  try{
    await pg.exec(`CREATE SCHEMA crm_history;
      CREATE TABLE "_prisma_migrations" (migration_name text,finished_at timestamptz,rolled_back_at timestamptz,checksum text);
      CREATE TABLE "User" (id text,"tenantId" text,status text,role text);
      INSERT INTO "User" VALUES ('admin','tenant','ACTIVE','Client Admin');
      CREATE TABLE "Account" (id text PRIMARY KEY,"tenantId" text,"assignedUserId" text,"productInterests" text[],"activeProducts" text[],"productInterestOther" text,"productsNormalized" boolean,"isArchived" boolean,"updatedAt" timestamp);
      INSERT INTO "Account" VALUES ('account','tenant',NULL,ARRAY['Interest'],ARRAY['Purchased'],'Original detail',false,false,'2026-01-01'),('empty-account','tenant',NULL,ARRAY[]::text[],ARRAY[]::text[],NULL,false,true,'2026-01-01');
      CREATE TABLE "AccountProductInterest" ("accountId" text,"tenantId" text,"productInterestId" text,position int,interested boolean,"activeProduct" boolean);
      INSERT INTO "AccountProductInterest" VALUES ('account','tenant','product',7,true,true);
      CREATE TABLE crm_history.account_retired_values (tenant_id text,account_id text,retired_values jsonb,product_links jsonb);
      INSERT INTO crm_history.account_retired_values SELECT a."tenantId",a.id,
        jsonb_build_object('assignedUserId',a."assignedUserId",'productInterests',a."productInterests",'activeProducts',a."activeProducts",'productInterestOther',a."productInterestOther",'productsNormalized',a."productsNormalized",'isArchived',a."isArchived",'updatedAt',a."updatedAt"),
        coalesce((SELECT jsonb_agg(to_jsonb(l) ORDER BY l."productInterestId") FROM "AccountProductInterest" l WHERE l."accountId"=a.id AND l."tenantId"=a."tenantId"),'[]'::jsonb) FROM "Account" a;
      INSERT INTO crm_history.account_retired_values SELECT tenant_id,account_id,retired_values||'{"productInterestOther":"Older detail"}'::jsonb,product_links FROM crm_history.account_retired_values WHERE account_id='account';`);
    const checksum=createHash('sha256').update(readFileSync(resolve(__dirname,'../prisma/migrations',preservation,'migration.sql'))).digest('hex');
    await pg.query('INSERT INTO "_prisma_migrations" VALUES ($1,now(),NULL,$2)',[preservation,checksum]);
    const fixtureDatabase=(await pg.query('SELECT current_database() AS name')).rows[0].name;
    const actualEnv={...env,DATABASE_URL:`postgresql://fixture@127.0.0.1/${fixtureDatabase}`,CRM_ACCOUNT_FIELDS_EXPECT_DATABASE:fixtureDatabase};
    const report=await run(sqlDb,'--verify',actualEnv,{fetcher:healthy});
    assert.equal(report.commit,sha);
    assert.equal(report.productLinksPresent,true);
    assert.equal((await pg.query('SELECT count(*)::int AS count FROM crm_history.account_retired_values')).rows[0].count,3);
    await pg.exec(`UPDATE "Account" SET "productInterestOther"='Uncaptured change' WHERE id='account'`);
    await assert.rejects(run(sqlDb,'--verify',actualEnv,{fetcher:healthy}),/ACCOUNT_FIELDS_PRESERVATION_MISMATCH/);
    await pg.exec(`UPDATE "Account" SET "productInterestOther"='Original detail' WHERE id='account';
      UPDATE "AccountProductInterest" SET "tenantId"='different'`);
    await assert.rejects(run(sqlDb,'--verify',actualEnv,{fetcher:healthy}),/ACCOUNT_FIELDS_PRESERVATION_MISMATCH/);
    await pg.exec(`UPDATE "AccountProductInterest" SET "tenantId"='tenant';
      DROP TABLE "AccountProductInterest";
      ALTER TABLE "Account" DROP COLUMN "assignedUserId",DROP COLUMN "productInterests",DROP COLUMN "activeProducts",DROP COLUMN "productInterestOther",DROP COLUMN "productsNormalized";`);
    await assert.rejects(run(sqlDb,'--verify',actualEnv,{fetcher:healthy}),/ACCOUNT_FIELDS_RETIREMENT_LEDGER_MISMATCH/);
    const retirementChecksum=createHash('sha256').update(readFileSync(resolve(__dirname,'../prisma/migrations',retirement,'migration.sql'))).digest('hex');
    await pg.query('INSERT INTO "_prisma_migrations" VALUES ($1,now(),NULL,$2)',[retirement,retirementChecksum]);
    assert.deepEqual(await run(sqlDb,'--verify',actualEnv,{fetcher:healthy}),{commit:sha,retiredColumns:[],productLinksPresent:false});
  }finally{await pg.close();}
});
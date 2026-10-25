// Durable loopback PostgreSQL, real backup/restore, HTTP and Prisma deployment.
// No production credentials, provider calls or synthetic migration receipts
// are used for the six retirements executed by this test.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { notificationTestPostgres } from './notification-test-postgres.mjs';
const root = resolve(import.meta.dirname,'../..');
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
const sha = 'a'.repeat(40);
const pg = await notificationTestPostgres();
let db, appDb, backend, frontend, maintenance;
const started = Date.now();
try {
  const excluded = ['20261110000000_retire_unused_crm_columns','20261112000000_retire_lead_nonform_columns','20261129000000_retire_contact_obsolete_columns','20261130000000_remove_contact_job_title','20261210000000_retire_account_internal_notes','20261227000000_retire_account_notes_and_tags'];
  const database = 'leadcrm_crm_columns_cutover_test_1';
  const direct = await pg.database(database,{exclude:excluded});
  pg.executeSql(database, `CREATE ROLE crm_columns_app LOGIN;
    GRANT USAGE ON SCHEMA public,crm_history TO crm_columns_app;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO crm_columns_app;
    INSERT INTO "Tenant"(id,name,slug,status,"onboardingStep","onboardingCompletedAt","updatedAt") VALUES('cutover-tenant','Cutover','cutover','ACTIVE',3,now(),now()),('cutover-other','Other','cutover-other','ACTIVE',3,now(),now());
    INSERT INTO "User"(id,"tenantId",email,"firstName","lastName",role,status,"mustChangePassword","onboardingCompletedAt","updatedAt") VALUES('cutover-admin','cutover-tenant','crmoperator@camxian.com','CRM','Operator','Client Admin','ACTIVE',false,now(),now());
    INSERT INTO "Account"(id,"tenantId",name,notes,"internalNotes","updatedAt") VALUES('cutover-account','cutover-tenant','Retained Account','Surviving Account.notes',E'Private Unicode café\\nretained',now());
    INSERT INTO "Contact"(id,"tenantId","firstName","lastName","accountId","customerType",score,"linkedinUrl","activeProducts","jobTitle","isArchived","updatedAt") VALUES
      ('cutover-contact','cutover-tenant','Current','Contact','cutover-account','Prospect',93,'https://example.test/profile',ARRAY['Historical purchase'],'Retained title',false,now()),
      ('cutover-archived','cutover-other','Archived','Contact',NULL,'Customer',0,'',ARRAY[]::text[],'',true,now());
    INSERT INTO "Lead"(id,"tenantId","firstName","lastName",description,website,"productInterestOther","updatedAt") VALUES('10000000-0000-4000-8000-000000000001','cutover-tenant','Historic','Lead',E'Exact historical\\ntext','https://example.test','Retained other',now());
    INSERT INTO "Pipeline"(id,"tenantId",name,"updatedAt") VALUES('cutover-pipeline','cutover-tenant','Sales',now());
    INSERT INTO "Stage"(id,"tenantId","pipelineId",name,"order","requiredFields") VALUES('cutover-stage','cutover-tenant','cutover-pipeline','Won',0,'{}');
    INSERT INTO "Deal"(id,"tenantId","pipelineId","stageId",title,value,"accountId","updatedAt","closingSnapshot","closingValues") VALUES('cutover-deal','cutover-tenant','cutover-pipeline','cutover-stage','Retained Deal',12345.67,'cutover-account',now(),'{"version":7,"reference":"keep"}','{"reference":"keep"}');
    INSERT INTO "ContactDeal"(id,"tenantId","contactId","dealId") VALUES('cutover-contact-deal','cutover-tenant','cutover-contact','cutover-deal');
    INSERT INTO "Workflow"(id,"tenantId",name,trigger,conditions,actions,status,"isActive","updatedAt") VALUES('cutover-history','cutover-tenant','Historical definition','contact.updated','{"conditions":[{"field":"score","operator":"equals","value":75}]}','[]','DRAFT',false,now());`);
  const runtime = new URL(direct); runtime.username = 'crm_columns_app';
  Object.assign(process.env,qaEnvironment(root,{DATABASE_URL:runtime.href,DIRECT_URL:direct,SOURCE_COMMIT:sha}));
  const Module = require('node:module');
  const original = Module._resolveFilename;
  Module._resolveFilename = function(request,...args) { return request === '@leadcrm/shared' ? resolve(root,'backend/dist/shared/src/index.js') : original.call(this,request,...args); };
  const { PrismaClient } = require('@prisma/client');
  db = new PrismaClient({datasources:{db:{url:direct}},log:[]});
  const operator = require('./deploy-crm-columns-retirement.cjs');
  const initial = await operator.run(db,'--plan',{...process.env,CRM_COLUMNS_EXPECT_DATABASE:database});
  assert.deepEqual(initial.pending,excluded);
  assert.equal(initial.applied,150);
  // The immutable legacy migration must block populated data, even if archived.
  pg.executeSql(database, `UPDATE "Contact" SET "disqualifiedReason"='Never discard' WHERE id='cutover-archived'`);
  await assert.rejects(operator.audit(db),/IMMUTABLE_VALUE_GUARD_BLOCKED/);
  pg.executeSql(database, `UPDATE "Contact" SET "disqualifiedReason"=NULL WHERE id='cutover-archived'; UPDATE "Workflow" SET "isActive"=true,status='ACTIVE' WHERE id='cutover-history'`);
  await assert.rejects(operator.audit(db),/DEPENDENCIES_REQUIRE_REPAIR/);
  pg.executeSql(database, `UPDATE "Workflow" SET "isActive"=false,status='DRAFT',trigger='account.updated',conditions='{"field":"internalNotes"}' WHERE id='cutover-history'`);
  await assert.rejects(operator.audit(db),/DEPENDENCIES_REQUIRE_REPAIR/);
  assert.match(pg.executeSql(database,`SELECT status FROM "Workflow" WHERE id='cutover-history'`),/DRAFT/);
  pg.executeSql(database, `UPDATE "Workflow" SET trigger='contact.updated',conditions='{"conditions":[{"field":"score","operator":"equals","value":75}]}' WHERE id='cutover-history'`);
  await assert.rejects(operator.writeFence({...process.env,CRM_COLUMNS_EXPECT_DATABASE:database},url=>new PrismaClient({datasources:{db:{url}},log:[]})),/APPLICATION_WRITES_NOT_PAUSED/);
  // A real archive is restored independently before the cutover is allowed.
  const backup = resolve(pg.directory,'before.dump');
  const bin = process.env.POSTGRES_TEST_BIN || 'C:/Program Files/PostgreSQL/17/bin';
  const exe = name => resolve(bin,name+(process.platform==='win32'?'.exe':''));
  const libpqUrl = value => { const url = new URL(value); url.search = ''; return url.href; };
  execFileSync(exe('pg_dump'),['--dbname',libpqUrl(direct),'--format=custom','--file',backup],{windowsHide:true,env:process.env});
  const restoreName = 'leadcrm_crm_columns_restore_20261023000001';
  const restore = await pg.database(restoreName,{migrate:false});
  execFileSync(exe('pg_restore'),['--dbname',libpqUrl(restore),'--exit-on-error',backup],{windowsHide:true,env:process.env});
  const restoredDb = new PrismaClient({datasources:{db:{url:restore}},log:[]});
  const before = await operator.snapshot(db);
  try {
    const restoredSnapshot = await operator.snapshot(restoredDb);
    if (restoredSnapshot.__schema !== before.__schema) {
      const sourceSchema = await operator.schemaSnapshot(db), restoredSchema = await operator.schemaSnapshot(restoredDb);
      for (const key of Object.keys(sourceSchema)) if (operator.digest(sourceSchema[key]) !== operator.digest(restoredSchema[key])) {
        console.log('RESTORE_SCHEMA_DIFFERENCE',key,JSON.stringify(sourceSchema[key].filter(row=>!restoredSchema[key].some(other=>operator.digest(row)===operator.digest(other))).slice(0,2)),JSON.stringify(restoredSchema[key].filter(row=>!sourceSchema[key].some(other=>operator.digest(row)===operator.digest(other))).slice(0,2)));
      }
    }
    assert.equal(operator.digest(restoredSnapshot),operator.digest(before));
  }
  finally { await restoredDb.$disconnect(); }
  const evidence = resolve(pg.directory,'verified-backup.json');
  writeFileSync(evidence,JSON.stringify({database,commit:sha,restored:true,backupSha256:createHash('sha256').update(readFileSync(backup)).digest('hex'),snapshotDigest:operator.digest(before),retiredDigest:operator.digest(await operator.retiredValues(db))}));
  console.log('PASS: actual PostgreSQL archive checksum, restore and exact retained snapshot');
  const app = require('../dist/backend/src/app.js').default;
  appDb = require('../dist/backend/src/config/database.config.js').default;
  maintenance = require('../dist/backend/src/core/maintenance/crm-retirement-maintenance.js').crmRetirementMaintenance;
  const { createAuthSessionToken } = require('../dist/backend/src/core/auth/auth-session.js');
  const token = await createAuthSessionToken({id:'cutover-admin',tenantId:'cutover-tenant',role:'Client Admin',email:'crmoperator@camxian.com'},{userAgent:'Disposable CRM cutover test'},db);
  const until = new Date(Date.now()+300000).toISOString();
  maintenance.begin(Date.parse(until)); await maintenance.drain();
  pg.executeSql(database, `ALTER ROLE crm_columns_app IN DATABASE ${database} SET default_transaction_read_only=on`);
  backend = app.listen(0,'127.0.0.1'); await new Promise(done=>backend.once('listening',done));
  frontend = createServer((_request,response)=>{response.setHeader('Content-Type','application/json');response.end(JSON.stringify({commit:sha}));});
  frontend.listen(0,'127.0.0.1'); await new Promise(done=>frontend.once('listening',done));
  const localApi = `http://127.0.0.1:${backend.address().port}/api/v1`;
  const localFrontend = `http://127.0.0.1:${frontend.address().port}`;
  const config = {...process.env,CRM_COLUMNS_EXPECT_DATABASE:database,CRM_COLUMNS_VERIFY_COMMIT:sha,CRM_COLUMNS_VERIFY_TOKEN:token,
    CRM_COLUMNS_VERIFY_API:localApi,CRM_COLUMNS_VERIFY_FRONTEND:localFrontend,
    CRM_COLUMNS_DEADLINE:until,CRM_COLUMNS_BACKUP_EVIDENCE:evidence};
  for(const key of ['PRODUCTION_APPROVAL','BACKUP_VERIFIED','FRONTEND_VERIFIED','WRITERS_STOPPED']) config['CRM_COLUMNS_'+key]=sha;
  const dependencies = {};
  assert.equal((await operator.run(db,'--verify',config,dependencies)).pending.length,6);
  const actualEvidence = JSON.parse(readFileSync(evidence,'utf8'));
  writeFileSync(evidence,JSON.stringify({...actualEvidence,snapshotDigest:'0'.repeat(64)}));
  await assert.rejects(operator.run(db,'--retire',config,dependencies),/BACKUP_BASELINE_CHANGED/);
  writeFileSync(evidence,JSON.stringify(actualEvidence));
  let stages = 0;
  const rollout = require('./deploy-crm-imports.cjs');
  await assert.rejects(operator.run(db,'--retire',config,{...dependencies,migrate:(...args)=>{
    if (++stages === 3) throw Error('DISPOSABLE_REHEARSAL_INTERRUPTION');
    return rollout.migrate(...args);
  }}),/DISPOSABLE_REHEARSAL_INTERRUPTION/);
  assert.equal((await operator.run(db,'--plan',config)).applied,152);
  await assert.rejects(operator.run(db,'--retire',config,dependencies),/BACKUP_BASELINE_CHANGED/);
  execFileSync(exe('pg_dump'),['--dbname',libpqUrl(direct),'--format=custom','--file',backup],{windowsHide:true,env:process.env});
  const retryRestore = await pg.database('leadcrm_crm_columns_retry_restore_test_1',{migrate:false});
  execFileSync(exe('pg_restore'),['--dbname',libpqUrl(retryRestore),'--exit-on-error',backup],{windowsHide:true,env:process.env});
  const retryDb = new PrismaClient({datasources:{db:{url:retryRestore}},log:[]});
  const retrySnapshot = await operator.snapshot(db);
  try { assert.equal(operator.digest(await operator.snapshot(retryDb)),operator.digest(retrySnapshot)); }
  finally { await retryDb.$disconnect(); }
  writeFileSync(evidence,JSON.stringify({database,commit:sha,restored:true,backupSha256:createHash('sha256').update(readFileSync(backup)).digest('hex'),snapshotDigest:operator.digest(retrySnapshot),retiredDigest:operator.digest(await operator.retiredValues(db))}));
  const final = await operator.run(db,'--retire',config,dependencies);
  assert.equal(final.receipts.length,4);
  assert.deepEqual(final.remaining,[]);
  assert.equal((await operator.run(db,'--plan',config)).applied,156);
  assert.deepEqual((await operator.run(db,'--retire',config,dependencies)).remaining,[]);
  assert.match(pg.executeSql(database,`SELECT notes FROM "Account" WHERE id='cutover-account'`),/Surviving Account.notes/);
  assert.match(pg.executeSql(database,`SELECT retired_values->>'jobTitle' FROM crm_history.contact_retired_values WHERE contact_id='cutover-contact' AND retired_values ? 'jobTitle'`),/Retained title/);
  assert.match(pg.executeSql(database,`SELECT count(*) FROM "ContactDeal" WHERE id='cutover-contact-deal'`),/\b1\b/);
  assert.match(pg.executeSql(database,`SELECT status FROM "Workflow" WHERE id='cutover-history'`),/DRAFT/);
  const denied = await fetch(localApi+'/crm/accounts/cutover-account',{method:'PATCH',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{"name":"Should not write"}'});
  assert.equal(denied.status,503);
  pg.executeSql(database, `ALTER ROLE crm_columns_app IN DATABASE ${database} RESET default_transaction_read_only;
    SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND usename='crm_columns_app' AND pid<>pg_backend_pid();`);
  maintenance.resume();
  await appDb.$disconnect();
  const me = await fetch(localApi+'/auth/me',{headers:{Authorization:'Bearer '+token}});
  assert.equal(me.status,200);
  const own = await fetch(localApi+'/crm/contacts',{headers:{Authorization:'Bearer '+token}});
  assert.equal(own.status,200);
  assert.ok((await own.json()).data.every(row=>row.tenantId==='cutover-tenant'));
  const write = await fetch(localApi+'/crm/accounts/cutover-account',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{"name":"Updated disposable Account"}'});
  assert.equal(write.status,200,await write.text());
  assert.equal((await db.account.findUnique({where:{id:'cutover-account'}})).name,'Updated disposable Account');
  const { withSession } = require('./crm-columns-operator-session.cjs');
  assert.deepEqual((await withSession(db,value=>operator.run(db,'--verify',{...config,CRM_COLUMNS_VERIFY_TOKEN:value}))).pending,[]);
  await assert.rejects(withSession(db,async()=>{throw Error('DISPOSABLE_SESSION_FAILURE');}),/DISPOSABLE_SESSION_FAILURE/);
  const temporary = await db.session.findMany({where:{userAgent:{startsWith:'CRM column cutover '}}});
  assert.equal(temporary.length,2);
  assert.ok(temporary.every(row=>row.revokedAt && +row.expiresAt-+row.createdAt<=600100));
  // The standalone production-data rehearsal also runs as a separate process:
  // real compiled HTTP, real runtime fence and no verifier dependency injection.
  pg.executeSql(restoreName,`ALTER ROLE crm_columns_app IN DATABASE ${restoreName} SET default_transaction_read_only=on`);
  const restoreEvidence = resolve(pg.directory,'standalone-restore-evidence.json');
  writeFileSync(restoreEvidence,JSON.stringify({...actualEvidence,database:restoreName}));
  const restoreRuntime = new URL(runtime.href); restoreRuntime.pathname='/'+restoreName;
  const childEnv = qaEnvironment(root,{...config,DATABASE_URL:restoreRuntime.href,DIRECT_URL:restore,CRM_COLUMNS_EXPECT_DATABASE:restoreName,CRM_COLUMNS_BACKUP_EVIDENCE:restoreEvidence});
  const child = spawn(process.execPath,[resolve(root,'backend/scripts/rehearse-crm-columns-retirement.cjs')],{cwd:root,env:childEnv,windowsHide:true,stdio:'inherit'});
  const code = await new Promise((done,fail)=>{child.once('error',fail);child.once('exit',done);});
  assert.equal(code,0,'Standalone restored-database rehearsal must pass all real operator gates');
  pg.executeSql(restoreName,`ALTER ROLE crm_columns_app IN DATABASE ${restoreName} RESET default_transaction_read_only`);
  console.log(`PASS: all six real Prisma receipts, partial-cutover recovery, exact data/schema/security preservation, populated/archived fields, tenant boundaries, guarded writes, repeat execution and restored HTTP writes (${Date.now()-started}ms)`);
  Module._resolveFilename = original;
} finally {
  maintenance?.resume();
  backend?.closeAllConnections(); frontend?.closeAllConnections();
  await Promise.all([backend&&new Promise(done=>backend.close(done)),frontend&&new Promise(done=>frontend.close(done)),db?.$disconnect(),appDb?.$disconnect()]);
  pg.stop();
}

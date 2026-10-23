// Durable loopback PostgreSQL only. No production configuration or providers.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {notificationTestPostgres,runNotificationTestFile} from './notification-test-postgres.mjs';
const notes='20261210000000_retire_account_internal_notes';
const retirement='20261227000000_retire_account_notes_and_tags';
const sql=name=>readFileSync(resolve(import.meta.dirname,'../prisma/migrations',name,'migration.sql'),'utf8');
const pg=await notificationTestPostgres();
try{
  const name='leadcrm_account_columns_test_1';
  await pg.database(name,{exclude:[notes,retirement]});
  const exec=source=>pg.executeSql(name,source);
  exec(`INSERT INTO "Tenant"(id,name,slug,"updatedAt") VALUES('column-tenant','Columns','columns',now());
    INSERT INTO "Account"(id,"tenantId",name,notes,"internalNotes",tags,"updatedAt") VALUES('column-account','column-tenant','Keep Company','Keep public notes','Keep private history',ARRAY['Preserve this tag'],now());`);
  const rejects=(source,code)=>assert.throws(()=>exec(source),new RegExp(code));
  rejects(sql(retirement),'ACCOUNT_COLUMNS_NOTES_RETIREMENT_REQUIRED');
  exec(`COMMENT ON TABLE crm_history.account_legacy_notes IS 'leadcrm-account-notes-compatible-v1:${'a'.repeat(40)}';`+sql(notes));
  exec(`INSERT INTO "_prisma_migrations"(id,checksum,migration_name,finished_at) VALUES('${randomUUID()}','${createHash('sha256').update(sql(notes)).digest('hex')}','${notes}',now());`);
  rejects(sql(retirement),'ACCOUNT_COLUMNS_VERIFIED_CUTOVER_REQUIRED');
  exec(`COMMENT ON COLUMN "Account".tags IS 'leadcrm-account-columns-v1:${'a'.repeat(40)}';`);
  rejects(sql(retirement),'ACCOUNT_COLUMNS_TAG_VALUES_PRESENT');
  exec(`UPDATE "Account" SET tags='{}';
    INSERT INTO "Workflow"(id,"tenantId",name,trigger,conditions,actions,"isActive",status,"updatedAt") VALUES('tag-workflow','column-tenant','Tag reference','account.updated','{"conditions":[{"field":"record.tags","operator":"contains","value":"old"}]}','[]',true,'ACTIVE',now());`);
  rejects(sql(retirement),'ACCOUNT_COLUMNS_EXECUTABLE_REFERENCES_PRESENT');
  exec(`UPDATE "Workflow" SET conditions=NULL,actions='[{"type":"update_field","config":{"field":"name","value":"Ordinary tags text"}}]' WHERE id='tag-workflow';
    CREATE VIEW account_tag_dependency AS SELECT tags FROM "Account";`);
  rejects(sql(retirement),'ACCOUNT_COLUMNS_DEPENDENCIES_PRESENT');
  exec('DROP VIEW account_tag_dependency');
  const fingerprint=()=>exec(`SELECT md5(string_agg((to_jsonb(a)-'internalNotes'-'tags')::text,'' ORDER BY id)) FROM "Account" a;`).trim();
  const before=fingerprint();
  exec(sql(retirement));
  assert.equal(fingerprint(),before,'Every surviving Account value is unchanged');
  assert.match(exec(`SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' AND column_name IN ('tags','internalNotes');`),/\b0\b/);
  assert.match(exec(`SELECT count(*) FROM crm_history.account_legacy_notes WHERE note_value='Keep private history';`),/\b1\b/);
  assert.match(exec(`SELECT count(*) FROM "Activity" WHERE description='Keep private history';`),/\b1\b/);
  console.log('Native migration guards, rollback, exact Account preservation and legacy-note history: PASS');
  const operatorUrl=await pg.database('leadcrm_account_operator_test_1',{exclude:[notes,retirement]});
  pg.executeSql('leadcrm_account_operator_test_1',`INSERT INTO "Tenant"(id,name,slug,"updatedAt") VALUES('operator-tenant','Operator','operator',now());
    INSERT INTO "User"(id,"tenantId",email,"firstName","lastName",role,status,"updatedAt") VALUES('operator-admin','operator-tenant','operator@example.test','Operator','Admin','Client Admin','ACTIVE',now());
    INSERT INTO "Account"(id,"tenantId",name,"updatedAt") VALUES('operator-account','operator-tenant','Operator Company',now());`);
  const require=createRequire(import.meta.url);
  const {PrismaClient}=require('@prisma/client');
  const {run}=require('./deploy-account-columns-retirement.cjs');
  const client=new PrismaClient({datasources:{db:{url:operatorUrl}}});
  const saved={DATABASE_URL:process.env.DATABASE_URL,DIRECT_URL:process.env.DIRECT_URL};
  process.env.DATABASE_URL=process.env.DIRECT_URL=operatorUrl;
  try{
    const sha='a'.repeat(40),env={DATABASE_URL:operatorUrl,DIRECT_URL:operatorUrl,SOURCE_COMMIT:sha,
      CRM_ACCOUNT_COLUMNS_EXPECT_DATABASE:'leadcrm_account_operator_test_1',CRM_ACCOUNT_COLUMNS_VERIFY_API:'http://127.0.0.1:4000/api/v1',
      CRM_ACCOUNT_COLUMNS_VERIFY_FRONTEND:'http://127.0.0.1:3000',CRM_ACCOUNT_COLUMNS_VERIFY_TOKEN:'synthetic-token'};
    for(const key of ['VERIFY_COMMIT','PRODUCTION_APPROVAL','WRITERS_STOPPED','BACKUP_VERIFIED','FRONTEND_VERIFIED'])env['CRM_ACCOUNT_COLUMNS_'+key]=sha;
    const fetcher=async url=>({ok:true,json:async()=>String(url).includes('/health')?{commit:sha,capabilities:['accounts-activity-notes-v1','accounts-columns-retirement-v1']}
      :String(url).includes('/api/release')?{commit:sha}:String(url).includes('/auth/me')?{data:{user:{id:'operator-admin',tenantId:'operator-tenant',role:'Client Admin'}}}
      :{data:[{id:'operator-account',tenantId:'operator-tenant',name:'Operator Company'}]}});
    const before=await client.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name');
    assert.equal((await run(client,'--verify',env,{fetcher})).retiredColumns.length,2);
    assert.deepEqual((await run(client,'--retire',env,{fetcher})).retiredColumns,[]);
    assert.deepEqual((await run(client,'--retire',env,{fetcher})).retiredColumns,[],'Repeated cutover is a verified no-op');
    const after=await client.$queryRawUnsafe('SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY migration_name');
    assert.deepEqual(after.filter(row=>!before.some(old=>old.migration_name===row.migration_name)).map(row=>row.migration_name),[notes,retirement]);
    console.log('Native operator, migration checksums, bounded two-migration deployment and repeated verification: PASS');
  }finally{await client.$disconnect();for(const [key,value] of Object.entries(saved)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
  const url=await pg.database('leadcrm_crm_polish_test_1');
  const code=await runNotificationTestFile('src/modules/crm/companies/organization-polish.integration.test.ts',url);
  assert.equal(code,0,'Account HTTP functionality must pass with both columns absent');
  const importsUrl=await pg.database('leadcrm_forms_test_2');
  assert.equal(await runNotificationTestFile('src/modules/crm/imports/imports.integration.test.ts',importsUrl),0,'CSV imports must pass with both columns absent');
  console.log(JSON.stringify({postgres:pg.version,durability:pg.durability,columnsAbsent:true,guardsPassed:true,httpPassed:true}));
}finally{pg.stop();}

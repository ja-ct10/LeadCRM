import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const expansion=readFileSync(resolve(__dirname,'../../../prisma/migrations/20261225000000_preserve_retired_relationships/migration.sql'),'utf8');
const retirement=readFileSync(resolve(__dirname,'../../../prisma/migrations/20261226000000_retire_unused_relationship_tables/migration.sql'),'utf8');
const canonical='20261102000000_retire_relationship_compatibility';
async function fixture(populated=true){
  const db=await PGlite.create();
  await db.exec(`CREATE TABLE "_prisma_migrations" (migration_name text,finished_at timestamptz,rolled_back_at timestamptz);
    INSERT INTO "_prisma_migrations" VALUES ('${canonical}',now(),NULL);
    CREATE TABLE "Task" (id text PRIMARY KEY,"tenantId" text NOT NULL,title text NOT NULL DEFAULT '',"updatedAt" timestamp NOT NULL DEFAULT '2026-01-01',UNIQUE(id,"tenantId"));
    CREATE TABLE "Account" (id text PRIMARY KEY,"tenantId" text NOT NULL,UNIQUE(id,"tenantId"));
    CREATE TABLE "CampaignContact" (id text PRIMARY KEY,"tenantId" text NOT NULL,status text NOT NULL DEFAULT 'sent',UNIQUE(id,"tenantId"));
    CREATE TABLE "TaskAccount" ("taskId" text NOT NULL,"accountId" text NOT NULL,"tenantId" text NOT NULL,position int NOT NULL DEFAULT 0,
      PRIMARY KEY("taskId","accountId"),FOREIGN KEY("taskId","tenantId") REFERENCES "Task"(id,"tenantId") ON DELETE CASCADE,
      FOREIGN KEY("accountId","tenantId") REFERENCES "Account"(id,"tenantId") ON DELETE CASCADE);
    CREATE TABLE "SmsCampaignLink" (id text PRIMARY KEY,"tenantId" text NOT NULL,"campaignContactId" text NOT NULL,url text NOT NULL,
      "clickedAt" timestamp,"lastClickedAt" timestamp,"clickCount" int NOT NULL DEFAULT 0,
      FOREIGN KEY("campaignContactId","tenantId") REFERENCES "CampaignContact"(id,"tenantId") ON DELETE CASCADE);`);
  if(populated)await db.exec(`INSERT INTO "Task"(id,"tenantId") VALUES ('task','tenant'),('empty','tenant'),('foreign','other');
    INSERT INTO "Account" VALUES ('a','tenant'),('b','tenant');
    INSERT INTO "TaskAccount" VALUES ('task','a','tenant',5),('task','b','tenant',-1);
    INSERT INTO "CampaignContact"(id,"tenantId") VALUES ('recipient','tenant'),('other-recipient','other');
    INSERT INTO "SmsCampaignLink" VALUES ('abcdefghijklmnopqrstuvwx','tenant','recipient','https://example.com/a','2026-01-01','2026-01-03',4),
      ('123456789012345678901234','tenant','recipient','https://example.com/b',NULL,NULL,0);`);
  return db;
}
async function failsAndRollback(db:PGlite,sql:string,error:RegExp){
  await expect(db.exec(sql)).rejects.toThrow(error);
  await db.exec('ROLLBACK');
}
it('preserves exact ordered relationships and historical links without rewriting parent time, then freezes both sources and archives',async()=>{
  const db=await fixture();
  try{
    const links=(await db.query('SELECT to_jsonb(l) AS row FROM "TaskAccount" l ORDER BY position,"accountId"')).rows.map(row=>row.row);
    const sms=(await db.query('SELECT to_jsonb(l) AS row FROM "SmsCampaignLink" l ORDER BY id')).rows.map(row=>row.row);
    const before=(await db.query('SELECT id,"updatedAt" FROM "Task" ORDER BY id')).rows;
    await db.exec(expansion);
    expect((await db.query('SELECT "retiredAccountLinks" FROM "Task" WHERE id=\'task\'')).rows[0]).toEqual({retiredAccountLinks:links});
    expect((await db.query('SELECT "smsLinkHistory" FROM "CampaignContact" WHERE id=\'recipient\'')).rows[0]).toEqual({smsLinkHistory:sms});
    expect((await db.query('SELECT id,"updatedAt" FROM "Task" ORDER BY id')).rows).toEqual(before);
    for(const sql of ['UPDATE "TaskAccount" SET position=0','DELETE FROM "TaskAccount"','TRUNCATE "TaskAccount"',
      'UPDATE "SmsCampaignLink" SET "clickCount"=9','DELETE FROM "SmsCampaignLink"','TRUNCATE "SmsCampaignLink"'])
      await expect(db.exec(sql)).rejects.toThrow('RETIRED_RELATIONSHIP_SOURCE_FROZEN');
    await expect(db.exec(`UPDATE "Task" SET "retiredAccountLinks"='[]' WHERE id='task'`)).rejects.toThrow('ARCHIVE_IMMUTABLE');
    await expect(db.exec(`UPDATE "CampaignContact" SET "smsLinkHistory"='[]' WHERE id='recipient'`)).rejects.toThrow('ARCHIVE_IMMUTABLE');
    await expect(db.exec(`UPDATE "Task" SET "tenantId"='other' WHERE id='task'`)).rejects.toThrow('ARCHIVE_IMMUTABLE');
    await expect(db.exec(`INSERT INTO "CampaignContact" (id,"tenantId","smsLinkHistory") SELECT 'copy',"tenantId","smsLinkHistory" FROM "CampaignContact" WHERE id='recipient'`)).rejects.toThrow('ARCHIVE_INSERT_FORBIDDEN');
    await db.exec(`UPDATE "Task" SET title='Allowed normal edit' WHERE id='task'; INSERT INTO "Task"(id,"tenantId") VALUES ('new','tenant')`);
    expect((await db.query('SELECT * FROM leadcrm_verify_retired_relationships()')).rows).toHaveLength(2);
    expect((await db.query(`SELECT id FROM "CampaignContact" WHERE "smsLinkHistory" @> '[{"id":"abcdefghijklmnopqrstuvwx"}]'::jsonb`)).rows).toEqual([{id:'recipient'}]);
  }finally{await db.close();}
},60000);
it('requires verified cutover and canonical retirement, then drops only sources with all captured facts intact',async()=>{
  const db=await fixture();
  try{
    await db.exec(expansion);
    const snapshots=(await db.query('SELECT "smsLinkHistory" FROM "CampaignContact" ORDER BY id')).rows;
    await failsAndRollback(db,retirement,/VERIFIED_CUTOVER_REQUIRED/);
    await db.exec(`COMMENT ON TABLE "TaskAccount" IS 'leadcrm-retired-relationships-v1:${'a'.repeat(40)}'; COMMENT ON TABLE "SmsCampaignLink" IS 'leadcrm-retired-relationships-v1:${'a'.repeat(40)}'; ALTER TABLE "Task" ADD COLUMN "accountId" text;`);
    await failsAndRollback(db,retirement,/CANONICAL_CUTOVER_REQUIRED/);
    await db.exec('ALTER TABLE "Task" DROP COLUMN "accountId"');
    await db.exec(`UPDATE "_prisma_migrations" SET rolled_back_at=now()`);
    await failsAndRollback(db,retirement,/CANONICAL_CUTOVER_REQUIRED/);
    await db.exec('UPDATE "_prisma_migrations" SET rolled_back_at=NULL');
    await db.exec('CREATE TABLE external_link (id text PRIMARY KEY REFERENCES "SmsCampaignLink"(id))');
    await failsAndRollback(db,retirement,/depend/i);
    expect((await db.query(`SELECT to_regclass('"TaskAccount"') IS NOT NULL AS present`)).rows[0]).toEqual({present:true});
    await db.exec('DROP TABLE external_link');
    await db.exec(retirement);
    expect((await db.query(`SELECT to_regclass('"TaskAccount"') AS task,to_regclass('"SmsCampaignLink"') AS sms`)).rows[0]).toEqual({task:null,sms:null});
    expect((await db.query('SELECT "smsLinkHistory" FROM "CampaignContact" ORDER BY id')).rows).toEqual(snapshots);
    expect((await db.query('SELECT * FROM leadcrm_verify_retired_relationships()')).rows.map(row=>row.source_rows)).toEqual([null,null]);
    await expect(db.exec(`UPDATE "CampaignContact" SET "smsLinkHistory"='[]' WHERE id='recipient'`)).rejects.toThrow('ARCHIVE_IMMUTABLE');
  }finally{await db.close();}
},60000);
it('rejects inconsistent legacy tenant links transactionally and permits an empty fresh replay without a fake approval marker',async()=>{
  const db=await fixture();
  try{
    await db.exec(`ALTER TABLE "TaskAccount" DROP CONSTRAINT "TaskAccount_accountId_tenantId_fkey"; UPDATE "TaskAccount" SET "tenantId"='other' WHERE "accountId"='a'`)
      .catch(async()=>{await db.exec('ALTER TABLE "TaskAccount" DISABLE TRIGGER ALL; UPDATE "TaskAccount" SET "tenantId"=\'other\' WHERE "accountId"=\'a\'; ALTER TABLE "TaskAccount" ENABLE TRIGGER ALL');});
    await failsAndRollback(db,expansion,/SCOPE_MISMATCH/);
    expect((await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='Task' AND column_name='retiredAccountLinks'`)).rows).toEqual([]);
  }finally{await db.close();}
  const empty=await fixture(false);
  try{await empty.exec(expansion);await empty.exec(retirement);expect((await empty.query('SELECT * FROM leadcrm_verify_retired_relationships()')).rows).toHaveLength(2);}
  finally{await empty.close();}
},60000);

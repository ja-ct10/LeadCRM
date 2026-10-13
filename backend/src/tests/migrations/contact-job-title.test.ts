import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { replayCrmMigrations } from '../replay-crm-migrations';

const migration = '20261130000000_remove_contact_job_title';
const sql = readFileSync(resolve(__dirname, '../../../prisma/migrations', migration, 'migration.sql'), 'utf8');
let db: PGlite;
const columns = async () => (await db.query<{ column_name: string }>(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Contact' ORDER BY column_name`)).rows;
const snapshot = async () => (await db.query(`SELECT jsonb_build_object(
  'contacts', (SELECT jsonb_agg(to_jsonb(c)-'jobTitle' ORDER BY id) FROM "Contact" c),
  'users', (SELECT jsonb_agg(u ORDER BY id) FROM "User" u),
  'accounts', (SELECT jsonb_agg(a ORDER BY id) FROM "Account" a),
  'products', (SELECT jsonb_agg(p ORDER BY "contactId","productInterestId") FROM "ContactProductInterest" p),
  'deals', (SELECT jsonb_agg(d ORDER BY id) FROM "Deal" d),
  'links', (SELECT jsonb_agg(l ORDER BY id) FROM "ContactDeal" l),
  'workflows', (SELECT jsonb_agg(w ORDER BY id) FROM "Workflow" w),
  'campaigns', (SELECT jsonb_agg(c ORDER BY id) FROM "Campaign" c)
) AS state`)).rows;
async function rejects(reason: RegExp) {
  const before = await snapshot();
  await expect(db.exec(sql)).rejects.toThrow(reason);
  await db.exec('ROLLBACK');
  expect(await columns()).toContainEqual({ column_name: 'jobTitle' });
  expect(await snapshot()).toEqual(before);
}

beforeAll(async () => {
  db = await PGlite.create();
  await replayCrmMigrations(db, migration);
  await db.exec(`
    INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('title','Title test','title-test',now());
    INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"jobTitle","updatedAt") VALUES ('user','title','user@example.test','User','Agent','Sales','Retained user title',now());
    INSERT INTO "Account" (id,"tenantId",name,"updatedAt") VALUES ('account','title','Acme',now());
    INSERT INTO "Contact" (id,"tenantId","firstName","lastName","jobTitle",notes,"accountId","assignedUserId","updatedAt","isArchived")
      VALUES ('contact','title','Nora','Lim','Buyer','Retained note','account','user',now(),false), ('archived','title','Archived','Contact','Manager','Archived note','account','user',now(),true);
    INSERT INTO "ProductInterest" (id,"tenantId",name,"dealValue","updatedAt") VALUES ('product','title','CCTV',1000,now());
    INSERT INTO "ContactProductInterest" ("tenantId","contactId","productInterestId",position,interested,"activeProduct") VALUES ('title','contact','product',0,true,true);
    INSERT INTO "Pipeline" (id,"tenantId",name,"updatedAt") VALUES ('pipeline','title','Sales',now());
    INSERT INTO "Stage" (id,"tenantId","pipelineId",name,"order","isWon","requiredFields") VALUES ('stage','title','pipeline','Won',0,true,'{}');
    INSERT INTO "Deal" (id,"tenantId",title,value,"pipelineId","stageId","updatedAt") VALUES ('deal','title','Retained deal',1000,'pipeline','stage',now());
    INSERT INTO "ContactDeal" (id,"tenantId","contactId","dealId") VALUES ('link','title','contact','deal');
    INSERT INTO "Workflow" (id,"tenantId",name,trigger,actions,conditions,"updatedAt") VALUES ('workflow','title','Historical draft','contact.updated','[]','{}',now());
    INSERT INTO "TargetAudience" (id,"tenantId",name,"isActive","updatedAt") VALUES ('audience','title','Historical audience',false,now());
    INSERT INTO "TargetAudienceCondition" (id,"targetAudienceId",field,operator,value) VALUES ('condition','audience','jobTitle','equals','Buyer');
    INSERT INTO "Template" (id,"tenantId",name,type,content,"updatedAt") VALUES ('template','title','Historical template','Email','Hello {{jobTitle}}',now());
    INSERT INTO "Campaign" (id,"tenantId",name,type,"audienceSource","emailTemplateId","updatedAt") VALUES ('campaign','title','Historical draft','EMAIL','CONTACTS','template',now());
  `);
}, 60_000);
afterAll(async () => { await db?.close(); });

describe.sequential('Contact Job Title retirement on disposable PostgreSQL', () => {
  it.each([
    { field: 'contact.jobTitle', operator: 'equals', value: 'Buyer' },
    { field: 'event.changedFields', operator: 'contains', value: 'jobTitle' },
    { changedFields: ['jobTitle'] },
  ])('blocks active Workflow selectors and rolls back: %j', async condition => {
    await db.query(`UPDATE "Workflow" SET "isActive"=true, status='ACTIVE', conditions=$1::jsonb`, [JSON.stringify(condition)]);
    await rejects(/ACTIVE_WORKFLOW_REQUIRES_REPAIR/);
    await db.exec(`UPDATE "Workflow" SET "isActive"=false, status='DRAFT'`);
  });
  it('blocks active Workflow message tokens', async () => {
    await db.exec(`UPDATE "Workflow" SET "isActive"=true, status='ACTIVE', conditions='{}', actions='[{"type":"send_email","config":{"body":"Hello {{jobTitle}}"}}]'`);
    await rejects(/ACTIVE_WORKFLOW_REQUIRES_REPAIR/);
    await db.exec(`UPDATE "Workflow" SET "isActive"=false, status='DRAFT'`);
  });
  it('blocks active Workflow tokens in referenced templates', async () => {
    await db.exec(`UPDATE "Workflow" SET "isActive"=true, status='ACTIVE', actions='[{"type":"send_email","config":{"templateId":"template"}}]'`);
    await rejects(/ACTIVE_WORKFLOW_REQUIRES_REPAIR/);
    await db.exec(`UPDATE "Workflow" SET "isActive"=false, status='DRAFT'`);
  });
  it('blocks active audiences without changing their historical conditions', async () => {
    await db.exec(`UPDATE "TargetAudience" SET "isActive"=true`);
    await rejects(/ACTIVE_AUDIENCE_REQUIRES_REPAIR/);
    await db.exec(`UPDATE "TargetAudience" SET "isActive"=false`);
  });
  it('blocks scheduled template tokens and schedule conditions', async () => {
    await db.exec(`UPDATE "Campaign" SET status='SCHEDULED'`);
    await rejects(/SCHEDULED_CAMPAIGN_REQUIRES_REPAIR/);
    await db.exec(`UPDATE "Campaign" SET body='Hello', "scheduleConfig"='{"source":"CONTACTS","conditions":[{"field":"jobTitle"}]}'`);
    await rejects(/SCHEDULED_CAMPAIGN_REQUIRES_REPAIR/);
    await db.exec(`UPDATE "Campaign" SET status='DRAFT'`);
  });
  it('blocks scheduled template subject tokens', async () => {
    await db.exec(`UPDATE "Template" SET subject='Hello {{jobTitle}}', content='Safe content'; UPDATE "Campaign" SET status='SCHEDULED', "scheduleConfig"='{}'`);
    await rejects(/SCHEDULED_CAMPAIGN_REQUIRES_REPAIR/);
    await db.exec(`UPDATE "Campaign" SET status='DRAFT'`);
  });
  it('refuses unknown database dependencies without CASCADE', async () => {
    await db.exec(`CREATE VIEW contact_title_dependency AS SELECT "jobTitle" FROM "Contact"`);
    await rejects(/depend/);
    await db.exec('DROP VIEW contact_title_dependency');
  });
  it('drops only Contact.jobTitle while preserving all other columns, rows, archived records and relationships', async () => {
    const before = await snapshot(), originalColumns = await columns();
    await db.exec(sql);
    expect(await columns()).toEqual(originalColumns.filter(column => column.column_name !== 'jobTitle'));
    expect(await snapshot()).toEqual(before);
    expect((await db.query(`SELECT "jobTitle" FROM "User" WHERE id='user'`)).rows).toEqual([{ jobTitle: 'Retained user title' }]);
  });
});

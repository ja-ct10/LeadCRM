// Disposable PostgreSQL only. Never reads .env or connects to production.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { replayCrmMigrations } from './replay-crm-migrations.mjs';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

const preserve = '20261128000000_preserve_contact_retirement_history';
const retire = '20261129000000_retire_contact_obsolete_columns';
const legacy = '20261110000000_retire_unused_crm_columns';
const sql = name => readFileSync(resolve(import.meta.dirname, '../prisma/migrations', name, 'migration.sql'), 'utf8');
const fields = ['customerType','recordType','score','linkedinUrl','activeProducts','lastContactedAt','qualifiedAt','disqualifiedReason'];
const native = process.env.CONTACT_RETIREMENT_TEST_DATABASE_URL;
let db;
if (native) {
  const url = new URL(native);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname) && /^\/leadcrm_contact_retirement_\d+$/.test(url.pathname), 'Only a named disposable native database is accepted');
  const client = new PrismaClient({datasources:{db:{url:native}}});
  db = {
    query: async (query, params=[]) => ({rows:await client.$queryRawUnsafe(query,...params)}),
    exec: async source => {
      const result = spawnSync(process.env.CONTACT_RETIREMENT_TEST_PSQL || 'C:/Program Files/PostgreSQL/17/bin/psql.exe', ['-X','-q','-h',url.hostname,'-p',url.port,'-U','postgres','-d',url.pathname.slice(1),'-v','ON_ERROR_STOP=1'], {input:source,encoding:'utf8',windowsHide:true,timeout:40000});
      if (result.error || result.status!==0) throw new Error(result.error?.message || result.stderr);
    },
    close:()=>client.$disconnect(),
  };
} else db = await PGlite.create();
let checks = 0;
const nativeDiff = () => {
  const schema = resolve(import.meta.dirname,'../prisma/schema.prisma');
  const result = spawnSync(process.execPath,[resolve(import.meta.dirname,'../../node_modules/prisma/build/index.js'),'migrate','diff','--from-schema-datasource',schema,'--to-schema-datamodel',schema,'--script'],{encoding:'utf8',windowsHide:true,env:{...process.env,DATABASE_URL:native,DIRECT_URL:native},timeout:40000});
  assert.equal(result.status,0,result.stderr);
  return result.stdout;
};
const unrelatedDiff = source => source.split(/(?=^-- )/m).filter(block=>!block.includes('ALTER TABLE "Contact"') && !block.includes('ALTER TABLE "Deal" DROP COLUMN "billingFrequency";')).join('').trim();
let baselineDiff;
const columns = async () => (await db.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Contact' ORDER BY 1`)).rows;
const snapshot = async () => (await db.query(`SELECT jsonb_build_object(
 'contacts',(SELECT jsonb_agg(to_jsonb(c)-ARRAY['${fields.join("','")}'] ORDER BY id) FROM public."Contact" c),
 'deals',(SELECT jsonb_agg(to_jsonb(d)-'billingFrequency' ORDER BY id) FROM public."Deal" d),
 'links',(SELECT jsonb_agg(l ORDER BY id) FROM public."ContactDeal" l),
 'products',(SELECT jsonb_agg(l ORDER BY "contactId","productInterestId") FROM public."ContactProductInterest" l),
 'workflows',(SELECT jsonb_agg(w ORDER BY id) FROM public."Workflow" w),
 'campaigns',(SELECT jsonb_agg(c ORDER BY id) FROM public."Campaign" c)
) AS state`)).rows;
const rejects = async (source, pattern) => {
  const before = await columns(); const state = await snapshot();
  await assert.rejects(db.exec(source), pattern); await db.exec('ROLLBACK');
  assert.deepEqual(await columns(), before); assert.deepEqual(await snapshot(), state); checks++;
};
try {
  await replayCrmMigrations(db, { before: preserve, exclude: [legacy] });
  if (native) baselineDiff = nativeDiff();
  await db.exec(`
    INSERT INTO public."Tenant" (id,name,slug,"updatedAt") VALUES ('retire','Retirement','retire',now());
    INSERT INTO public."Contact" (id,"tenantId","firstName","lastName","updatedAt","isArchived","customerType",score,"recordType","linkedinUrl","activeProducts","productInterests","lifecycleStage","customerSince","convertedAt")
      VALUES ('historic','retire','Archived','Customer',now(),true,'Customer',92,'Individual','https://example.test/profile',ARRAY['Unmatched old purchase'],ARRAY['Retained interest'],'CUSTOMER','2020-01-01','2020-01-01'),
        ('current','retire','Current','Contact',now(),false,'Prospect',75,NULL,NULL,ARRAY[]::text[],ARRAY[]::text[],'LEAD',NULL,NULL);
    INSERT INTO public."Pipeline" (id,"tenantId",name,"updatedAt") VALUES ('p','retire','Sales',now());
    INSERT INTO public."Stage" (id,"tenantId","pipelineId",name,"order","isWon","requiredFields") VALUES ('won','retire','p','Won',0,true,'{}');
    INSERT INTO public."Deal" (id,"tenantId","pipelineId","stageId",title,value,"updatedAt","closingSnapshot") VALUES ('d','retire','p','won','Historic sale',12500.50,now(),'{"price":"original"}');
    INSERT INTO public."ContactDeal" (id,"tenantId","contactId","dealId") VALUES ('l','retire','historic','d');
    INSERT INTO public."ProductInterest" (id,"tenantId",name,"dealValue","updatedAt") VALUES ('product','retire','Old purchase',0,now());
    INSERT INTO public."ContactProductInterest" ("tenantId","contactId","productInterestId",position,interested,"activeProduct") VALUES ('retire','historic','product',0,false,true);
    INSERT INTO public."Workflow" (id,"tenantId",name,trigger,actions,conditions,"updatedAt") VALUES ('w','retire','Historic draft','contact.updated','[]','{"operator":"AND","conditions":[{"field":"contact.score","operator":"greater_than","value":80}]}',now());
    INSERT INTO public."Campaign" (id,"tenantId",name,type,"audienceSource",body,"updatedAt") VALUES ('campaign','retire','Retired token draft','EMAIL','CONTACTS','Old {{activeProductIds}}',now());
  `);
  const original = await columns(), state = await snapshot();
  await rejects(sql(retire), /crm_history|does not exist/);
  await db.exec(sql(preserve));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM crm_history.contact_retired_values')).rows[0].n, 2); checks++;
  assert.equal((await db.query(`SELECT retired_values->>'linkedinUrl' AS url FROM crm_history.contact_retired_values WHERE contact_id='historic'`)).rows[0].url,'https://example.test/profile');
  await rejects(sql(retire), /LEGACY_MIGRATION_REQUIRED/);
  // Preserve populated legacy timestamps, but never bypass the existing guard.
  await db.exec(`UPDATE public."Contact" SET "qualifiedAt"='2020-01-01' WHERE id='historic'`);
  await db.exec('SELECT crm_history.capture_contact_retirement()');
  await rejects(sql(legacy), /retired columns contain data/);
  assert.equal((await db.query(`SELECT count(*)::int AS n FROM crm_history.contact_retired_values WHERE retired_values->>'qualifiedAt' IS NOT NULL`)).rows[0].n,1);
  // Fixture repair only; live populated legacy data requires its own reviewed decision.
  await db.exec(`UPDATE public."Contact" SET "qualifiedAt"=NULL WHERE id='historic'`);
  await db.exec(sql(legacy));
  await rejects(sql(retire), /COMPATIBLE_RELEASE_NOT_VERIFIED/);
  await db.exec(`COMMENT ON TABLE crm_history.contact_retired_values IS 'leadcrm-contact-retirement-compatible-v1:${'a'.repeat(40)}'`);
  for (const [field,value] of [['score','99'],['linkedinUrl',"'https://example.test/new'"],['activeProducts',"ARRAY['Unexpected purchase']"]]) {
    await db.exec(`UPDATE public."Contact" SET "${field}"=${value} WHERE id='historic'`);
    await rejects(sql(retire), /UNPRESERVED_VALUES/);
    await db.exec('SELECT crm_history.capture_contact_retirement()');
  }
  await db.exec(`UPDATE public."Workflow" SET "isActive"=true,status='ACTIVE'`);
  await rejects(sql(retire), /ACTIVE_WORKFLOW_REQUIRES_REPAIR/);
  await db.exec(`UPDATE public."Workflow" SET conditions='{"operator":"AND","conditions":[{"field":"event.changedFields","operator":"contains","value":"score"}]}'`);
  await rejects(sql(retire), /ACTIVE_WORKFLOW_REQUIRES_REPAIR/);
  await db.exec(`UPDATE public."Workflow" SET conditions='{"changedFields":["activeProducts"]}'`);
  await rejects(sql(retire), /ACTIVE_WORKFLOW_REQUIRES_REPAIR/);
  await db.exec(`UPDATE public."Workflow" SET "isActive"=false,status='DRAFT',conditions='{"operator":"AND","conditions":[{"field":"contact.score","operator":"greater_than","value":80}]}'`);
  await db.exec(`INSERT INTO public."TargetAudience" (id,"tenantId",name,"updatedAt") VALUES ('a','retire','Needs repair',now()); INSERT INTO public."TargetAudienceCondition" (id,"targetAudienceId",field,operator,value) VALUES ('ac','a','score','gte','80')`);
  await rejects(sql(retire), /ACTIVE_AUDIENCE_REQUIRES_REPAIR/);
  await db.exec(`UPDATE public."TargetAudience" SET "isActive"=false`);
  await db.exec(`UPDATE public."Campaign" SET status='SCHEDULED'`);
  await rejects(sql(retire), /SCHEDULED_CAMPAIGN_REQUIRES_REPAIR/);
  await db.exec(`UPDATE public."Campaign" SET status='DRAFT'`);
  await db.exec(`CREATE VIEW contact_retirement_dependency AS SELECT score FROM public."Contact"`);
  await rejects(sql(retire), /depend/);
  await db.exec('DROP VIEW contact_retirement_dependency');
  await rejects(`BEGIN; UPDATE crm_history.contact_retired_values SET retired_values='{}'; COMMIT;`, /immutable/);
  const retained = await snapshot(); const history = (await db.query('SELECT * FROM crm_history.contact_retired_values ORDER BY id')).rows;
  await db.exec(sql(retire));
  assert.deepEqual(await columns(), original.filter(c => !fields.includes(c.column_name)));
  assert.deepEqual(await snapshot(),retained);
  assert.deepEqual((await db.query('SELECT * FROM crm_history.contact_retired_values ORDER BY id')).rows,history);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public."Contact"')).rows[0].n,2);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public."Contact" WHERE "isArchived"')).rows[0].n,1);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public."ContactProductInterest" WHERE "activeProduct" AND NOT interested')).rows[0].n,1);
  assert.deepEqual(state,retained); checks++;
  if (native) {
    const finalDiff = nativeDiff();
    assert.ok(!finalDiff.includes('"Contact"'),`Contact schema drift: ${finalDiff}`);
    assert.equal(unrelatedDiff(finalDiff),unrelatedDiff(baselineDiff),'Contact retirement must not change existing unrelated schema differences'); checks++;
  }
  console.log(`Contact retirement (${native?'native PostgreSQL':'PGlite'}): ${checks} checks passed; eight columns absent; archive, rows, relationships, prices and draft history preserved; unsafe changes rollback${native?'; Contact Prisma diff empty, preexisting unrelated differences unchanged':''}.`);
} finally { await db.close(); }

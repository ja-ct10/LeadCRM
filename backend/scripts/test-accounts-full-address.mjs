// Creates its own loopback PostgreSQL cluster; never reads application credentials.
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { PrismaClient } from '@prisma/client';
import { notificationTestPostgres, runNotificationTestFile } from './notification-test-postgres.mjs';

const root = resolve(import.meta.dirname, '../..');
const migration = '20261201000000_accounts_full_address';
const retirement = '20261202000000_retire_account_address_columns';
const migrations = join(root, 'backend/prisma/migrations');
const require = createRequire(import.meta.url);
const { qaEnvironment } = require('../../scripts/qa-environment.cjs');
if (process.platform === 'win32' && !process.env.POSTGRES_TEST_BIN) process.env.POSTGRES_TEST_BIN = 'C:/Program Files/PostgreSQL/17/bin';
const cluster = await notificationTestPostgres();
let client;
let checks = 0;
try {
  const name = `leadcrm_accounts_full_address_${Date.now()}`;
  const url = await cluster.database(name, { migrate: false });
  const env = qaEnvironment(root, { DATABASE_URL: url, DIRECT_URL: url });
  const cli = join(root, 'node_modules/prisma/build/index.js');
  const schema = join(root, 'backend/prisma/schema.prisma');
  const previous = join(cluster.directory, 'previous');
  mkdirSync(join(previous, 'migrations'), { recursive: true });
  cpSync(schema, join(previous, 'schema.prisma'));
  for (const entry of readdirSync(migrations)) {
    if (entry !== migration && entry !== retirement) cpSync(join(migrations, entry), join(previous, 'migrations', entry), { recursive: true });
  }
  const prisma = args => execFileSync(process.execPath, [cli, ...args], { cwd: join(root, 'backend'), env, windowsHide: true, encoding: 'utf8', timeout: 120000 });
  prisma(['migrate', 'deploy', '--schema', join(previous, 'schema.prisma')]);
  client = new PrismaClient({ datasources: { db: { url } } });
  const columns = () => client.$queryRawUnsafe(`SELECT column_name, data_type, column_default, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='Account' ORDER BY column_name`);
  const beforeColumns = await columns();
  for (const field of ['address', 'city', 'province', 'country', 'notes', 'internalNotes', 'activeProducts']) assert.ok(beforeColumns.some(column => column.column_name === field));
  assert.match(beforeColumns.find(column => column.column_name === 'country').column_default, /Philippines/);
  checks++;
  const diff = () => prisma(['migrate', 'diff', '--from-url', url, '--to-schema-datamodel', schema, '--script']);
  const withoutAddressDrops = source => source.replace(/^ALTER TABLE "Account" DROP COLUMN "city",\r?\nDROP COLUMN "country",\r?\nDROP COLUMN "province";\r?\n?/m, '').replace(/^--.*$/gm, '').replace(/\s+/g, ' ').trim();
  const beforeDiff = withoutAddressDrops(diff());
  const cases = [
    [null, 'Makati City', 'Metro Manila', 'Philippines', 'Makati City, Metro Manila, Philippines'],
    ['123 Main St', 'Makati City', 'Metro Manila', 'Philippines', '123 Main St, Makati City, Metro Manila, Philippines'],
    ['123 Main St, MAKATI CITY, Metro Manila, Philippines', 'Makati City', 'Metro Manila', 'Philippines', '123 Main St, MAKATI CITY, Metro Manila, Philippines'],
    ['123 Main St\nMakati City; Metro  Manila, Philippines', ' makati city ', 'Metro Manila', ' Philippines ', '123 Main St\nMakati City; Metro  Manila, Philippines'],
    ['123 Main St, Manila', 'Manila', 'Manila', null, '123 Main St, Manila'],
    ['123 Manilaville Road', 'Manila', null, null, '123 Manilaville Road, Manila'],
    [null, null, null, 'Philippines', null],
    ['', ' ', null, ' philippines ', ''],
    [' \t\n', null, null, 'Philippines', ' \t\n'],
    [null, null, 'Laguna', null, 'Laguna'],
    [null, null, null, 'Canada', 'Canada'],
    ['42 Queen Street\nToronto, Ontario, Canada', 'Toronto', 'Ontario', 'Canada', '42 Queen Street\nToronto, Ontario, Canada'],
    ['Café 7,', 'São Paulo', 'São Paulo', 'Brazil', 'Café 7, São Paulo, Brazil'],
    ['Explicit Philippines', null, null, 'Philippines', 'Explicit Philippines'],
    ['X'.repeat(6000), null, 'Laguna', null, 'X'.repeat(6000) + ', Laguna'],
    [null, null, null, null, null],
  ];
  const quote = value => value == null ? 'NULL' : "'" + value.replaceAll("'", "''") + "'";
  cluster.executeSql(name, `
    INSERT INTO "Tenant" (id,name,slug,"updatedAt") VALUES ('address','Address','address-test',now()), ('foreign','Foreign','address-foreign',now());
    INSERT INTO "User" (id,"tenantId",email,"firstName","lastName",role,"updatedAt") VALUES ('address-user','address','address@example.test','Address','Admin','Client Admin',now());
    ${cases.map(([address, city, province, country], index) => `INSERT INTO "Account" (id,"tenantId",name,address,city,province,country,notes,"internalNotes","activeProducts","productInterests",tags,"assignedUserId","isArchived","updatedAt") VALUES ('case-${index}','${index === 15 ? 'foreign' : 'address'}','Case ${index}',${[address, city, province, country].map(quote).join(',')},'Retained notes','Retained internal notes',ARRAY['Historical active product'],ARRAY['Historical interest'],ARRAY['Retained tag'],${index === 15 ? 'NULL' : "'address-user'"},${index === 12},'2020-01-01');`).join('\n')}
    INSERT INTO "ProductInterest" (id,"tenantId",name,"dealValue","updatedAt") VALUES ('address-product','address','Historical active product',1000,now());
    INSERT INTO "AccountProductInterest" ("tenantId","accountId","productInterestId",position,interested,"activeProduct") VALUES ('address','case-1','address-product',0,true,true);
    INSERT INTO "Contact" (id,"tenantId","firstName","lastName","accountId","updatedAt") VALUES ('address-contact','address','Retained','Contact','case-1',now());
    INSERT INTO "Lead" (id,"tenantId","firstName","lastName","accountId","updatedAt") VALUES ('address-lead','address','Retained','Lead','case-1',now());
    INSERT INTO "Pipeline" (id,"tenantId",name,"updatedAt") VALUES ('address-pipeline','address','Address pipeline',now());
    INSERT INTO "Stage" (id,"tenantId","pipelineId",name,"order") VALUES ('address-stage','address','address-pipeline','Lead',0);
    INSERT INTO "Deal" (id,"tenantId",title,value,"pipelineId","stageId","accountId","updatedAt") VALUES ('address-deal','address','Retained deal',1000,'address-pipeline','address-stage','case-1',now());
  `);
  const snapshot = () => client.$queryRawUnsafe(`SELECT jsonb_build_object(
    'accounts',(SELECT jsonb_agg(to_jsonb(a)-ARRAY['address','city','province','country'] ORDER BY id) FROM "Account" a),
    'products',(SELECT jsonb_agg(p ORDER BY "accountId","productInterestId") FROM "AccountProductInterest" p),
    'contacts',(SELECT jsonb_agg(c ORDER BY id) FROM "Contact" c),
    'leads',(SELECT jsonb_agg(l ORDER BY id) FROM "Lead" l),
    'deals',(SELECT jsonb_agg(d ORDER BY id) FROM "Deal" d)
  ) AS state`);
  const before = await snapshot();
  const retireSql = readFileSync(join(migrations, retirement, 'migration.sql'), 'utf8');
  cluster.executeSql(name, `INSERT INTO "Workflow" (id,"tenantId",name,trigger,actions,conditions,"isActive",status,"updatedAt") VALUES ('address-workflow','address','Address dependency','account.updated','[]','{"operator":"AND","conditions":[{"field":"account.city","operator":"equals","value":"Makati City"}]}',true,'ACTIVE',now());`);
  assert.throws(() => cluster.executeSql(name, retireSql), /ACCOUNT_ADDRESS_ACTIVE_WORKFLOW_REQUIRES_REPAIR/); checks++;
  assert.deepEqual(await columns(), beforeColumns); checks++;
  assert.deepEqual(await snapshot(), before); checks++;
  cluster.executeSql(name, `UPDATE "Workflow" SET "isActive"=false, status='DRAFT' WHERE id='address-workflow';`);
  const output = prisma(['migrate', 'deploy', '--schema', schema]);
  assert.ok(output.includes(migration));
  assert.ok(output.includes(retirement));
  for (let index = 0; index < cases.length; index++) {
    const [row] = await client.$queryRawUnsafe('SELECT address FROM "Account" WHERE id=$1', `case-${index}`);
    assert.equal(row.address, cases[index][4], `Migration address case ${index}`); checks++;
  }
  assert.deepEqual(await columns(), beforeColumns.filter(column => !['city','province','country'].includes(column.column_name))); checks++;
  assert.deepEqual(await snapshot(), before); checks++;
  assert.equal(withoutAddressDrops(diff()), beforeDiff); checks++;
  const addresses = await client.$queryRawUnsafe('SELECT id,address FROM "Account" ORDER BY id');
  cluster.executeSql(name, retireSql);
  assert.deepEqual(await client.$queryRawUnsafe('SELECT id,address FROM "Account" ORDER BY id'), addresses); checks++;
  assert.deepEqual(await snapshot(), before); checks++;
  const ledger = await client.$queryRawUnsafe('SELECT checksum,finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1', migration);
  assert.equal(ledger.length, 1); assert.ok(ledger[0].finished_at); assert.equal(ledger[0].rolled_back_at, null); checks++;
  const historical = await client.$queryRawUnsafe(`SELECT conditions FROM "Workflow" WHERE id='address-workflow'`);
  assert.equal(historical[0].conditions.conditions[0].field, 'account.city'); checks++;
  const retiredLedger = await client.$queryRawUnsafe('SELECT finished_at,rolled_back_at FROM "_prisma_migrations" WHERE migration_name=$1', retirement);
  assert.equal(retiredLedger.length, 1); assert.ok(retiredLedger[0].finished_at); assert.equal(retiredLedger[0].rolled_back_at, null); checks++;
  console.log(`${cluster.version}: ${checks} migration checks passed; exactly city/province/country dropped from Account; other columns and relationships preserved; migrations deployed only to the disposable database.`);
  const code = await runNotificationTestFile('src/modules/crm/companies/accounts-full-address.integration.test.ts', url);
  assert.equal(code, 0, 'Account persistence, import, sorting and filtering tests must pass');
} finally {
  await client?.$disconnect();
  cluster.stop();
}

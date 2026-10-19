// Read-only preflight. The migration repeats this exact dependency query under locks.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const migration = '20261219000000_remove_deal_industry';
const sql = readFileSync(resolve(__dirname, '../prisma/migrations', migration, 'migration.sql'), 'utf8');
const dependencyQuery = sql.split('-- dependency-query:start')[1].split('-- dependency-query:end')[0].trim();

async function inspectDealIndustry(db) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const present = await tx.$queryRawUnsafe(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'Deal' AND column_name = 'industry') AS present`);
    const impact = present[0].present ? await tx.$queryRawUnsafe(`SELECT "tenantId", count(*)::int AS total,
      count(*) FILTER (WHERE industry IS NULL)::int AS "nullValues",
      count(*) FILTER (WHERE industry IS NOT NULL AND btrim(industry) = '')::int AS "emptyValues",
      count(*) FILTER (WHERE industry IS NOT NULL AND btrim(industry) <> '')::int AS "populatedValues"
      FROM public."Deal" GROUP BY "tenantId" ORDER BY "tenantId"`) : [];
    return { migration, columnPresent: present[0].present, impact, dependencies: await tx.$queryRawUnsafe(dependencyQuery) };
  }, { timeout: 60000 });
}
module.exports = { inspectDealIndustry, dependencyQuery, migration };

if (require.main === module) {
  require('dotenv').config({ path: resolve(__dirname, '../.env') });
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  inspectDealIndustry(db).then(report => {
    console.log(JSON.stringify(report, null, 2));
    if (report.dependencies.length) process.exitCode = 2;
  }).catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
}

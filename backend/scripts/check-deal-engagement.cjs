// Read-only inspection. Does not run migrations, backfills, provider calls or seeds.
async function inspectDealEngagement(db) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    const stages = await tx.$queryRawUnsafe(`SELECT s."tenantId", s."pipelineId", s.id, s.name, s."isWon", s."isLost", s.probability,
      (SELECT count(*)::int FROM "Deal" d WHERE d."stageId" = s.id AND d."tenantId" = s."tenantId") AS deals
      FROM "Stage" s JOIN "Pipeline" p ON p.id = s."pipelineId" AND p."tenantId" = s."tenantId"
      WHERE lower(btrim(p.name)) = 'sales pipeline' ORDER BY s."tenantId", s."pipelineId", s."order"`);
    const customers = await tx.$queryRawUnsafe(`SELECT "tenantId", 'lead' AS module, status::text, count(*)::int FROM "Lead" GROUP BY "tenantId", status
      UNION ALL SELECT "tenantId", 'contact', status::text, count(*)::int FROM "Contact" GROUP BY "tenantId", status`);
    const pipelines = await tx.$queryRawUnsafe(`SELECT "tenantId", count(*)::int FROM "Pipeline" WHERE lower(btrim(name)) = 'sales pipeline' GROUP BY "tenantId" HAVING count(*) > 1`);
    const blockers = [...pipelines.map(row => ({ ...row, reason: 'Duplicate Sales Pipelines' }))];
    const groups = new Map();
    for (const stage of stages) {
      const name = stage.name.trim().toLowerCase();
      const outcome = ['closed won', 'closed deal'].includes(name) ? 'won' : ['closed lost', 'cancelled'].includes(name) ? 'lost' : null;
      if (!outcome) continue;
      if (outcome === 'won' ? !stage.isWon || stage.isLost : !stage.isLost || stage.isWon) blockers.push({ id: stage.id, reason: 'Terminal flags disagree' });
      const key = `${stage.tenantId}:${stage.pipelineId}:${outcome}`;
      if (groups.has(key)) blockers.push({ id: stage.id, reason: 'Duplicate terminal stage' });
      groups.set(key, stage.id);
    }
    const dependencies = await tx.$queryRawUnsafe(`SELECT "tenantId", id, trigger, status FROM "Workflow"
      WHERE (conditions::text || actions::text || coalesce("draftDefinition"::text, '')) ~* 'closed[ _](won|lost)|"closed"'`);
    const preservation = await tx.$queryRawUnsafe(`SELECT d."tenantId", count(*)::int AS deals,
      sum(d.value)::text AS "totalDealValue", count(*) FILTER (WHERE d."wonConfirmedAt" IS NOT NULL)::int AS "confirmedSales",
      (SELECT count(*)::int FROM "DealStageHistory" h WHERE h."tenantId" = d."tenantId") AS "stageHistory",
      (SELECT count(*)::int FROM "LeadDeal" l WHERE l."tenantId" = d."tenantId") AS "leadLinks",
      (SELECT count(*)::int FROM "ContactDeal" c WHERE c."tenantId" = d."tenantId") AS "contactLinks"
      FROM "Deal" d GROUP BY d."tenantId" ORDER BY d."tenantId"`);
    return { stages, customers, dependencies, preservation, blockers };
  });
}
module.exports = { inspectDealEngagement };
if (require.main === module) {
  require('dotenv').config({ path: require('node:path').resolve(__dirname, '../.env') });
  const db = new (require('@prisma/client').PrismaClient)();
  inspectDealEngagement(db).then(report => { console.log(JSON.stringify(report, null, 2)); if (report.blockers.length) process.exitCode = 2; })
    .catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
}

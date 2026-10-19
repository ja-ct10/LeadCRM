// Explicit, tenant-scoped maintenance after the coordinated migration. No provider calls.
const { resolve } = require('node:path');
require('dotenv').config({ path: resolve(__dirname, '../.env') });
async function main() {
  const args = process.argv.slice(2), tenantId = args[args.indexOf('--tenant') + 1];
  if (!args.includes('--tenant') || !tenantId || tenantId.startsWith('--')) throw Error('Supply --tenant <tenantId>. Default mode is read-only; --apply performs the backfill.');
  const db = require('../dist/backend/src/config/database.config').default;
  try {
    const deals = await db.deal.findMany({ where: { tenantId, deletedAt: null }, select: { id: true } });
    const report = { tenantId, mode: args.includes('--apply') ? 'apply' : 'read-only', deals: deals.length, attribution: null };
    if (!args.includes('--apply')) { console.log(JSON.stringify(report, null, 2)); return; }
    const actor = await db.user.findFirst({ where: { tenantId, role: 'Client Admin', status: 'ACTIVE' }, orderBy: { id: 'asc' } });
    if (!actor) throw Error('An active Client Admin in this tenant is required.');
    const { tenantContext } = require('../dist/backend/src/core/tenant/tenant-context');
    const { crmActor } = require('../dist/backend/src/modules/crm/access/crm-record-access.service');
    const { salesTransaction } = require('../dist/backend/src/modules/crm/leads/lead-automation.service');
    const { evaluateDealEngagement } = require('../dist/backend/src/modules/crm/deals/deal-engagement.service');
    const { classifyCustomerRecord } = require('../dist/backend/src/modules/crm/customer-classification.service');
    const { backfillDealAttribution } = require('../dist/backend/src/integrations/gmail/mailbox-deal-attribution');
    await tenantContext.run({ tenantId }, () => crmActor.run({ tenantId, userId: actor.id }, async () => {
      report.attribution = await db.$transaction(tx => backfillDealAttribution(tx, tenantId), { timeout: 120000 });
      const now = new Date();
      for (const deal of deals) await salesTransaction(tx => evaluateDealEngagement(tx, tenantId, deal.id, actor.id, now, false));
      for (const kind of ['lead', 'contact']) {
        const records = await db[kind].findMany({ where: { tenantId, isArchived: false, deletedAt: null }, select: { id: true } });
        for (const record of records) await salesTransaction(tx => classifyCustomerRecord(tx, tenantId,
          kind === 'lead' ? { leadId: record.id } : { contactId: record.id }, actor.id, {}, now, false));
      }
    }));
    console.log(JSON.stringify(report, null, 2));
  } finally { await db.$disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

import { crmActor } from '../access/crm-record-access.service';
import prisma from '../../../config/database.config';
import { salesContext } from '../leads/sales-context';
import { mayReadContactAccount, presentContactAccount } from '../contacts-v2/contact-account-access';
import { DealAddressSourceSchema, resolveDealAddress } from '@leadcrm/shared';
import { loadDealAddressOptions } from './deal-address';
import { dealStaleness } from './deal-staleness';

/** Apply source-module visibility to Deal responses, including nested Contacts. */
export async function presentDealResponse<T>(tenantId: string, response: T, now = new Date()): Promise<T> {
  const actor = crmActor.getStore();
  if (actor && !actor.readRecords) return crmActor.run({ ...actor, readRecords: true, readPolicy: undefined }, () => presentDealResponse(tenantId, response, now));
  const db = salesContext.getStore() ?? prisma;
  const permitted = await mayReadContactAccount(db, tenantId);
  const ids = new Set<string>();
  const related = { leadId: new Set<string>(), contactId: new Set<string>(), accountId: new Set<string>() };
  function collect(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== 'object' || value instanceof Date) return;
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string' && 'pipelineId' in record && 'stageId' in record) ids.add(record.id);
    for (const key of ['leadId', 'contactId', 'accountId'] as const) if (typeof record[key] === 'string') related[key].add(record[key]);
    Object.values(record).forEach(collect);
  }
  collect(response);
  const [leads, contacts, accounts] = await Promise.all([
    related.leadId.size ? db.lead.findMany({ where: { tenantId, id: { in: [...related.leadId] } }, select: { id: true } }) : [],
    related.contactId.size ? db.contact.findMany({ where: { tenantId, id: { in: [...related.contactId] } }, select: { id: true } }) : [],
    permitted && related.accountId.size ? db.account.findMany({ where: { tenantId, id: { in: [...related.accountId] } }, select: { id: true } }) : [],
  ]);
  const visible = { leadId: new Set(leads.map(row => row.id)), contactId: new Set(contacts.map(row => row.id)), accountId: new Set(accounts.map(row => row.id)) };
  const relationKey = new Map<string, keyof typeof visible>([['lead', 'leadId'], ['contact', 'contactId'], ['account', 'accountId'], ['organization', 'accountId'], ['leadDeals', 'leadId'], ['contactDeals', 'contactId']]);
  const deals = ids.size ? await db.deal.findMany({ where: { tenantId, id: { in: [...ids] } }, select: {
    id: true, address: true, addressSource: true, accountId: true,
    stageChangedAt: true, createdAt: true, isArchived: true, deletedAt: true,
    stageHistories: { where: { tenantId }, orderBy: { movedAt: 'desc' }, take: 1, select: { movedAt: true } },
    stage: { select: { id: true, name: true, rottenAfterDays: true, isWon: true, isLost: true } },
    pipeline: { select: { isArchived: true } },
    leadDeals: { where: { tenantId }, select: { leadId: true } }, contactDeals: { where: { tenantId }, select: { contactId: true } },
  } }) : [];
  const options = deals.length ? await loadDealAddressOptions(db, tenantId, deals.map(deal => ({ ...deal,
    leadIds: deal.leadDeals.map(link => link.leadId), contactIds: deal.contactDeals.map(link => link.contactId) }))) : new Map();
  const contexts = new Map(deals.map(deal => [deal.id, resolveDealAddress(deal.address, deal.addressSource, options.get(deal.id) ?? [])]));
  const staleness = new Map(deals.map(deal => [deal.id, dealStaleness(deal, now)]));
  const stageChanges = new Map(deals.map(deal => [deal.id, (deal.stageHistories[0]?.movedAt ?? deal.createdAt).toISOString()]));
  function visit(value: unknown, key?: string): unknown {
    const relation = relationKey.get(key ?? '');
    if (Array.isArray(value)) return value.filter(entry => !relation || !entry?.[relation] || visible[relation].has(entry[relation])).map(entry => visit(entry));
    if (!value || typeof value !== 'object' || value instanceof Date) return value;
    const source = value as Record<string, unknown>;
    if (relation && typeof source.id === 'string' && !visible[relation].has(source.id)) return null;
    const record = 'companyFromAccount' in source ? presentContactAccount(source, permitted && (!source.accountId || visible.accountId.has(String(source.accountId)))) : source;
    const presented = Object.fromEntries(Object.entries(record).map(([key, entry]) =>
      [key, Object.prototype.hasOwnProperty.call(visible, key) && typeof entry === 'string' && !visible[key as keyof typeof visible].has(entry) ? null : visit(entry, key)]));
    const context = typeof record.id === 'string' && 'pipelineId' in record && 'stageId' in record ? contexts.get(record.id) : undefined;
    if (context) {
      presented.staleness = staleness.get(record.id as string);
      presented.lastStageChangeDate = stageChanges.get(record.id as string);
      const selection = DealAddressSourceSchema.safeParse(record.addressSource);
      const visible = selection.success && context.options.some(option => option.type === selection.data.type && option.id === selection.data.id);
      // Unavailable references must not reveal source IDs or labels to unauthorized readers.
      presented.addressSource = visible ? selection.data : null;
      presented.addressContext = { ...context, source: context.source && context.options.some(option => option.type === context.source!.type && option.id === context.source!.id) ? context.source : null };
    }
    return presented;
  }
  return visit(response) as T;
}

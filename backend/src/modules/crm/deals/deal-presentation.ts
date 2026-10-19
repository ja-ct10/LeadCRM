import prisma from '../../../config/database.config';
import { salesContext } from '../leads/sales-context';
import { mayReadContactAccount, presentContactAccount } from '../contacts-v2/contact-account-access';
import { DealAddressSourceSchema, resolveDealAddress } from '@leadcrm/shared';
import { loadDealAddressOptions } from './deal-address';
import { dealStaleness } from './deal-staleness';

/** Apply source-module visibility to Deal responses, including nested Contacts. */
export async function presentDealResponse<T>(tenantId: string, response: T, now = new Date()): Promise<T> {
  const db = salesContext.getStore() ?? prisma;
  const permitted = await mayReadContactAccount(db, tenantId);
  const ids = new Set<string>();
  function collect(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== 'object' || value instanceof Date) return;
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string' && 'pipelineId' in record && 'stageId' in record) ids.add(record.id);
    Object.values(record).forEach(collect);
  }
  collect(response);
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
  function visit(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object' || value instanceof Date) return value;
    const source = value as Record<string, unknown>;
    const record = 'companyFromAccount' in source ? presentContactAccount(source, permitted) : source;
    const presented = Object.fromEntries(Object.entries(record).map(([key, entry]) =>
      [key, !permitted && (key === 'organization' || key === 'account') ? null : visit(entry)]));
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

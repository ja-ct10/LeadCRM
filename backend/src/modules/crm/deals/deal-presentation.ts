import prisma from '../../../config/database.config';
import { salesContext } from '../leads/sales-context';
import { mayReadContactAccount, presentContactAccount } from '../contacts-v2/contact-account-access';
import { DealAddressSourceSchema, resolveDealAddress } from '@leadcrm/shared';
import { loadDealAddressOptions } from './deal-address';
import { dealStaleness } from './deal-staleness';
import { crmReadWhere, mayReadCrmModule } from '../access/crm-record-access.service';

/** Apply source-module visibility to Deal responses, including nested Contacts. */
export async function presentDealResponse<T>(tenantId: string, response: T, now = new Date()): Promise<T> {
  const db = salesContext.getStore() ?? prisma;
  const permitted = await mayReadContactAccount(db, tenantId);
  const ids = new Set<string>();
  const leadIds = new Set<string>(), contactIds = new Set<string>();
  function collect(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if (!value || typeof value !== 'object' || value instanceof Date) return;
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string' && 'pipelineId' in record && 'stageId' in record) ids.add(record.id);
    if (typeof record.leadId === 'string') leadIds.add(record.leadId);
    if (typeof record.contactId === 'string') contactIds.add(record.contactId);
    Object.values(record).forEach(collect);
  }
  collect(response);
  const [leads, contacts] = await Promise.all([
    leadIds.size && await mayReadCrmModule(db, tenantId, 'leads')
      ? db.lead.findMany({ where: { tenantId, id: { in: [...leadIds] }, AND: [await crmReadWhere(db, tenantId, 'leads')] }, select: { id: true } }) : [],
    contactIds.size && await mayReadCrmModule(db, tenantId, 'contacts')
      ? db.contact.findMany({ where: { tenantId, id: { in: [...contactIds] }, AND: [await crmReadWhere(db, tenantId, 'contacts')] }, select: { id: true } }) : [],
  ]);
  const visibleLeads = new Set(leads.map(lead => lead.id)), visibleContacts = new Set(contacts.map(contact => contact.id));
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
    const presented = Object.fromEntries(Object.entries(record).map(([key, entry]) => {
      if (!permitted && (key === 'organization' || key === 'account')) return [key, null];
      const visible = key.startsWith('lead') ? visibleLeads : visibleContacts;
      if (key === 'leadDeals' || key === 'contactDeals') {
        const idKey = key === 'leadDeals' ? 'leadId' : 'contactId';
        return [key, Array.isArray(entry) ? entry.filter(link => visible.has(link[idKey])).map(visit) : entry];
      }
      if (key === 'leadIds' || key === 'contactIds') return [key, Array.isArray(entry) ? entry.filter(id => visible.has(id)) : entry];
      if (key === 'leadId' || key === 'contactId') return [key, typeof entry === 'string' && visible.has(entry) ? entry : null];
      if (key === 'lead' || key === 'contact') {
        const id = entry && typeof entry === 'object' ? (entry as Record<string, unknown>).id : null;
        return [key, typeof id === 'string' && visible.has(id) ? visit(entry) : null];
      }
      return [key, visit(entry)];
    }));
    // Singular compatibility fields follow the first remaining visible participant.
    for (const type of ['lead', 'contact'] as const) {
      const links = presented[`${type}Deals`] as Record<string, unknown>[] | undefined;
      if (Array.isArray(links) && `${type}Id` in record) {
        presented[`${type}Id`] = links[0]?.[`${type}Id`] ?? null;
        presented[type] = links[0]?.[type] ?? null;
      }
    }
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

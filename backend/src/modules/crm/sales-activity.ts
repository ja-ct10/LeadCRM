import type { Prisma } from '@prisma/client';
import { crmActor, crmReadWhere, mayReadCrmModule } from './access/crm-record-access.service';

/** Compact persisted Deal dates, restricted to authorized people and Deals. Profile updates never enter this projection. */
export async function salesActivityDates(db: Prisma.TransactionClient, tenantId: string, module: 'leads' | 'contacts', people: Array<{ id: string; createdAt: Date }>) {
  const dates = new Map(people.map(person => [person.id, person.createdAt]));
  if (!people.length || !await mayReadCrmModule(db, tenantId, 'deals')) return dates;
  const ids = people.map(person => person.id);
  const actor = crmActor.getStore();
  const converted = new Map<string, string>();
  if (module === 'contacts') {
    // Only canonical IDs for already-authorized Contacts; no source Lead profile is disclosed.
    const read = () => db.lead.findMany({ where: { tenantId, contactId: { in: ids }, convertedAt: { not: null } }, select: { id: true, contactId: true } });
    const sources = actor ? await crmActor.run({ ...actor, readRecords: false }, async () => await read()) : await read();
    for (const source of sources) if (source.contactId) converted.set(source.id, source.contactId);
  }
  const sourceIds = module === 'leads' ? ids : [...converted.keys()];
  const dealScope = await crmReadWhere(db, tenantId, 'deals');
  const readDates = () => db.deal.findMany({ where: { tenantId, AND: [dealScope], OR: [
    { leadDeals: { some: { tenantId, leadId: { in: sourceIds } } } },
    ...(module === 'contacts' ? [{ contactDeals: { some: { tenantId, contactId: { in: ids } } } }] : []),
  ] }, select: { createdAt: true,
    leadDeals: { where: { tenantId, leadId: { in: sourceIds } }, select: { leadId: true } },
    contactDeals: { where: { tenantId, contactId: { in: module === 'contacts' ? ids : [] } }, select: { contactId: true } },
  } });
  // Explicit Deal scope plus authorized person IDs is the projection boundary.
  // Generic junction scoping also requires Lead View, which must not hide a Contact's canonical sales history.
  const deals = actor ? await crmActor.run({ ...actor, readRecords: false }, async () => await readDates()) : await readDates();
  for (const deal of deals) {
    const associated = [...deal.leadDeals.map(link => module === 'leads' ? link.leadId : converted.get(link.leadId)), ...deal.contactDeals.map(link => link.contactId)];
    for (const id of associated) if (id && dates.has(id) && deal.createdAt > dates.get(id)!) dates.set(id, deal.createdAt);
  }
  return dates;
}

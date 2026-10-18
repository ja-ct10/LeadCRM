import type { Prisma } from '@prisma/client';
import { dealAddressKey, type DealAddressOption, type DealAddressSource } from '@leadcrm/shared';
import { mayReadCrmModule } from '../access/crm-record-access.service';
import { ValidationError } from '../../../shared/errors/http-error';

export interface AddressRelationships { id: string; accountId?: string | null; leadIds?: string[]; contactIds?: string[] }

/** One batch per source module, regardless of the number of Deals on a page. */
export async function loadDealAddressOptions(db: Prisma.TransactionClient, tenantId: string, deals: AddressRelationships[]) {
  const [leadsVisible, contactsVisible, accountsVisible] = await Promise.all(
    (['leads', 'contacts', 'accounts'] as const).map(module => mayReadCrmModule(db, tenantId, module)));
  const active = { tenantId, isArchived: false, deletedAt: null };
  const select = { id: true, firstName: true, lastName: true, address: true, accountId: true };
  const [leads, contacts] = await Promise.all([
    leadsVisible ? db.lead.findMany({ where: { ...active, id: { in: [...new Set(deals.flatMap(deal => deal.leadIds ?? []))] } }, select }) : [],
    contactsVisible ? db.contact.findMany({ where: { ...active, id: { in: [...new Set(deals.flatMap(deal => deal.contactIds ?? []))] } }, select }) : [],
  ]);
  const accountIds = [...new Set([...deals.map(deal => deal.accountId), ...leads.map(lead => lead.accountId), ...contacts.map(contact => contact.accountId)].filter((id): id is string => !!id))];
  const accounts = accountsVisible ? await db.account.findMany({ where: { ...active, id: { in: accountIds } }, select: { id: true, name: true, address: true } }) : [];
  return new Map(deals.map(deal => {
    const people = [...leads.filter(person => deal.leadIds?.includes(person.id)).map(person => ({ ...person, type: 'lead' as const })),
      ...contacts.filter(person => deal.contactIds?.includes(person.id)).map(person => ({ ...person, type: 'contact' as const }))];
    const linkedAccounts = new Set([deal.accountId, ...people.map(person => person.accountId)]);
    const options: DealAddressOption[] = [
      ...accounts.filter(account => linkedAccounts.has(account.id) && account.address?.trim()).map(account => ({ type: 'account' as const, id: account.id, label: `Company: ${account.name}`, address: account.address! })),
      ...people.filter(person => person.address?.trim()).map(person => ({ type: person.type, id: person.id, label: `${person.type === 'lead' ? 'Lead' : 'Contact'}: ${person.firstName} ${person.lastName}`.trim(), address: person.address! })),
    ];
    return [deal.id, options];
  }));
}

export async function assertDealAddressSource(db: Prisma.TransactionClient, tenantId: string, source: DealAddressSource | null | undefined, links: Omit<AddressRelationships, 'id'>) {
  if (!source) return;
  const options = (await loadDealAddressOptions(db, tenantId, [{ ...links, id: 'selection' }])).get('selection')!;
  if (!options.some(option => dealAddressKey(option) === dealAddressKey(source))) {
    throw new ValidationError('Customer Address: select an available address from this Deal’s linked Lead, Contact, or Account.');
  }
}
